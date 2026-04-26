import ActivityKit
import Foundation

// ─────────────────────────────────────────────────────────────────
// Exact copy of ios/ZealActivityAttributes.swift.
// The Widget Extension is a separate binary and must compile
// this file independently — it cannot import from the main target.
// ─────────────────────────────────────────────────────────────────

public struct ZealActivityAttributes: ActivityAttributes {
    public typealias ContentState = ZealActivityState
    public var activityType: String
    public init(activityType: String) { self.activityType = activityType }
}

public struct ZealActivityState: Codable, Hashable {
    public var title: String
    public var subtitle: String
    public var detail: String
    public var restTimerEnd: Date?
    public init(title: String, subtitle: String, detail: String, restTimerEnd: Date? = nil) {
        self.title = title
        self.subtitle = subtitle
        self.detail = detail
        self.restTimerEnd = restTimerEnd
    }
}
