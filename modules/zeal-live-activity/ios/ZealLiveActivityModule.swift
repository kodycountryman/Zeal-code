import ExpoModulesCore
import Foundation
#if canImport(ActivityKit)
import ActivityKit
#endif

// ─────────────────────────────────────────────────────────────────
// Expo Module — exposes Live Activity controls to TypeScript.
//
// IMPORTANT: All ActivityKit-typed properties are type-erased to
// Any? on the class so the Swift runtime can load this module on
// any iOS version without resolving Activity<T>. Each function
// guards #available(iOS 16.2, *) before casting.
// ─────────────────────────────────────────────────────────────────

public class ZealLiveActivityModule: Module {

    // Type-erased to avoid referencing iOS 16.1+ types at class load.
    private var currentActivityRef: Any?

    public func definition() -> ModuleDefinition {
        Name("ZealLiveActivity")

        // ── isAvailable ───────────────────────────────────────────
        Function("isAvailable") { () -> Bool in
            if #available(iOS 16.2, *) {
                return ActivityAuthorizationInfo().areActivitiesEnabled
            }
            return false
        }

        // ── startActivity ─────────────────────────────────────────
        AsyncFunction("startActivity") { (params: [String: Any], promise: Promise) in
            guard #available(iOS 16.2, *) else {
                promise.resolve(nil)
                return
            }
            guard ActivityAuthorizationInfo().areActivitiesEnabled else {
                promise.reject("LIVE_ACTIVITY_DISABLED", "Live Activities are disabled on this device.")
                return
            }

            let activityType = params["type"] as? String ?? "workout"
            let title        = params["title"]    as? String ?? ""
            let subtitle     = params["subtitle"] as? String ?? ""
            let detail       = params["detail"]   as? String ?? ""

            let attributes = ZealActivityAttributes(activityType: activityType)
            let state      = ZealActivityState(title: title, subtitle: subtitle, detail: detail)

            do {
                if let existing = self.currentActivityRef as? Activity<ZealActivityAttributes> {
                    await existing.end(nil, dismissalPolicy: .immediate)
                    self.currentActivityRef = nil
                }
                let activity = try Activity.request(
                    attributes: attributes,
                    content: .init(state: state, staleDate: nil),
                    pushType: nil
                )
                self.currentActivityRef = activity
                promise.resolve(activity.id)
            } catch {
                promise.reject("START_FAILED", error.localizedDescription)
            }
        }

        // ── updateActivity ────────────────────────────────────────
        AsyncFunction("updateActivity") { (activityId: String, params: [String: Any], promise: Promise) in
            guard #available(iOS 16.2, *) else { promise.resolve(nil); return }
            guard let activity = self.currentActivityRef as? Activity<ZealActivityAttributes> else {
                promise.resolve(nil); return
            }

            let title    = params["title"]    as? String ?? activity.content.state.title
            let subtitle = params["subtitle"] as? String ?? activity.content.state.subtitle
            let detail   = params["detail"]   as? String ?? activity.content.state.detail

            let newState = ZealActivityState(
                title: title,
                subtitle: subtitle,
                detail: detail,
                restTimerEnd: nil
            )
            await activity.update(.init(state: newState, staleDate: nil))
            promise.resolve(nil)
        }

        // ── startRestTimer ────────────────────────────────────────
        AsyncFunction("startRestTimer") { (activityId: String, durationSeconds: Double, promise: Promise) in
            guard #available(iOS 16.2, *) else { promise.resolve(nil); return }
            guard let activity = self.currentActivityRef as? Activity<ZealActivityAttributes> else {
                promise.resolve(nil); return
            }

            let current  = activity.content.state
            let timerEnd = Date().addingTimeInterval(durationSeconds)
            let newState = ZealActivityState(
                title: current.title,
                subtitle: current.subtitle,
                detail: current.detail,
                restTimerEnd: timerEnd
            )
            await activity.update(.init(state: newState, staleDate: nil))
            promise.resolve(nil)
        }

        // ── endActivity ───────────────────────────────────────────
        AsyncFunction("endActivity") { (activityId: String, promise: Promise) in
            guard #available(iOS 16.2, *) else { promise.resolve(nil); return }
            if let activity = self.currentActivityRef as? Activity<ZealActivityAttributes> {
                await activity.end(nil, dismissalPolicy: .immediate)
                self.currentActivityRef = nil
            }
            promise.resolve(nil)
        }
    }
}
