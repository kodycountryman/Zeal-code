const { withInfoPlist, withEntitlementsPlist } = require('@expo/config-plugins');

// ─────────────────────────────────────────────────────────────────
// Config plugin — wires Live Activity support into the native build.
// Runs automatically during `expo prebuild` / EAS Build.
//
// Adds to iOS Info.plist:
//   NSSupportsLiveActivities = YES
//   NSSupportsLiveActivitiesFrequentUpdates = YES
//
// NSSupportsLiveActivitiesFrequentUpdates allows up to 15 updates/hr
// (vs 5/hr default) — needed for the rest timer + pace updates.
// ─────────────────────────────────────────────────────────────────

const withLiveActivityInfoPlist = (config) =>
  withInfoPlist(config, (mod) => {
    mod.modResults['NSSupportsLiveActivities'] = true;
    mod.modResults['NSSupportsLiveActivitiesFrequentUpdates'] = true;
    return mod;
  });

module.exports = (config) => withLiveActivityInfoPlist(config);
