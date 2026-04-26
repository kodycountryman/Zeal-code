package expo.modules.zealliveactivity

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// ─────────────────────────────────────────────────────────────────
// Android no-op implementation.
// Live Activities are iOS-only. This module satisfies the Expo
// Module requirement so the TypeScript API works on both platforms
// without any Platform.OS checks in call sites.
// All functions resolve silently — zero Android APIs are called.
// ─────────────────────────────────────────────────────────────────

class ZealLiveActivityModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("ZealLiveActivity")

        Function("isAvailable") {
            false
        }

        AsyncFunction("startActivity") { _: Map<String, Any?> ->
            null
        }

        AsyncFunction("updateActivity") { _: String, _: Map<String, Any?> ->
            null
        }

        AsyncFunction("startRestTimer") { _: String, _: Double ->
            null
        }

        AsyncFunction("endActivity") { _: String ->
            null
        }
    }
}
