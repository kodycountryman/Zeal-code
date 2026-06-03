// Resolve @expo/config-plugins from the project root so this plugin works
// whether loaded by the top-level resolver or a nested one (e.g. @expo/config).
const path = require('path');
let withXcodeProject;
try {
  const resolved = require.resolve('@expo/config-plugins', {
    paths: [path.join(__dirname, '..', 'node_modules'), path.join(__dirname, '..')],
  });
  withXcodeProject = require(resolved).withXcodeProject;
} catch {
  // @expo/config-plugins not resolvable in this context (e.g. Android EAS build).
  // Return a no-op plugin so Android builds are unaffected.
  module.exports = (config) => config;
  return;
}

function patchShellScript(script) {
  return script.replace(
    /`\\?"\$NODE_BINARY\\?" --print "require\('path'\)\.dirname\(require\.resolve\('react-native\/package\.json'\)\) \+ '\/scripts\/react-native-xcode\.sh'"`/,
    '"$(\\"$NODE_BINARY\\" --print "require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'")"'
  );
}

module.exports = function withXcodePathSpaces(config) {
  return withXcodeProject(config, (config) => {
    const phases = config.modResults.hash.project.objects.PBXShellScriptBuildPhase ?? {};

    for (const phase of Object.values(phases)) {
      if (!phase || typeof phase !== 'object' || typeof phase.shellScript !== 'string') {
        continue;
      }

      if (phase.shellScript.includes('react-native-xcode.sh')) {
        phase.shellScript = patchShellScript(phase.shellScript);
      }
    }

    return config;
  });
};
