import SwiftUI
import WidgetKit

// ─────────────────────────────────────────────────────────────────
// Entry point for the ZealWidget extension target.
// If you add more widgets (home screen, watch complications) in the
// future, list them here alongside ZealLiveActivityWidget.
// ─────────────────────────────────────────────────────────────────

@main
struct ZealWidgetBundle: WidgetBundle {
    var body: some Widget {
        ZealLiveActivityWidget()
    }
}
