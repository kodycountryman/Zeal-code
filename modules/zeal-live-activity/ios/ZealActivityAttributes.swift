import Foundation
#if canImport(ActivityKit)
import ActivityKit

// ─────────────────────────────────────────────────────────────────
// Shared data model used by both the main app target (ActivityKit
// calls) and the Widget Extension target (SwiftUI rendering).
// The Widget Extension compiles its own copy from widget/.
// ─────────────────────────────────────────────────────────────────

/// Static metadata set once when the activity starts.
@available(iOS 16.1, *)
public struct ZealActivityAttributes: ActivityAttributes {
    public typealias ContentState = ZealActivityState

    /// "workout" or "run"
    public var activityType: String

    public init(activityType: String) {
        self.activityType = activityType
    }
}

#endif

/// Dynamic content that updates throughout the activity.
public struct ZealActivityState: Codable, Hashable {
    /// Primary label — exercise name ("Bench Press") or "Active Run"
    public var title: String

    /// Secondary label — "Set 3 of 4" or "2.4 mi"
    public var subtitle: String

    /// Tertiary value — "225 lbs" or "8:32 / mi"
    public var detail: String

    /// When set, the UI renders a live countdown timer to this date.
    public var restTimerEnd: Date?

    public init(
        title: String,
        subtitle: String,
        detail: String,
        restTimerEnd: Date? = nil
    ) {
        self.title = title
        self.subtitle = subtitle
        self.detail = detail
        self.restTimerEnd = restTimerEnd
    }
}
