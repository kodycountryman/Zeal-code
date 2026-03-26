const fs = require("fs");
const path = require("path");

let pkg = {};
try {
  const pkgPath = path.join(process.cwd(), "package.json");
  pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
} catch {
  pkg = {};
}

const payload = {
  sessionId: "7d0698",
  runId: process.env.EAS_BUILD_ID || "local-preinstall",
  hypothesisId: "H_BUILD_ENV",
  location: "scripts/debug-preinstall.js:1",
  message: "preinstall environment snapshot",
  data: {
    cwd: process.cwd(),
    easBuild: process.env.EAS_BUILD || null,
    easBuildProfile: process.env.EAS_BUILD_PROFILE || null,
    npmConfigLegacyPeerDeps: process.env.npm_config_legacy_peer_deps || null,
    npmConfigUserAgent: process.env.npm_config_user_agent || null,
    react: pkg?.dependencies?.react || null,
    lucideReactNative: pkg?.dependencies?.["lucide-react-native"] || null,
    expoDevClient: pkg?.dependencies?.["expo-dev-client"] || null
  },
  timestamp: Date.now()
};

// #region agent log
fetch("http://127.0.0.1:7653/ingest/1f0cd0e5-9cce-4051-a869-dbf507bfae4b",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"7d0698"},body:JSON.stringify(payload)}).catch(()=>{});
// #endregion
