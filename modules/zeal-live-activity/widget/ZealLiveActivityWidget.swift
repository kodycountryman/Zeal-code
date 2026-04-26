import ActivityKit
import SwiftUI
import WidgetKit

// ─────────────────────────────────────────────────────────────────
// Zeal+ Live Activity — Lock Screen & Dynamic Island UI
//
// Renders in four Dynamic Island presentations:
//   compactLeading  — SF Symbol icon (dumbbell / figure.run)
//   compactTrailing — rest countdown or current stat
//   minimal         — SF Symbol icon only
//   expanded        — full workout card
// Plus a Lock Screen banner below the Dynamic Island.
// ─────────────────────────────────────────────────────────────────

private let zealOrange = Color(red: 0.973, green: 0.443, blue: 0.086) // #f87116

struct ZealLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: ZealActivityAttributes.self) { context in
            // ── Lock Screen banner ─────────────────────────────
            ZealLockScreenView(context: context)
                .activityBackgroundTint(Color.black.opacity(0.85))
                .activitySystemActionForegroundColor(zealOrange)

        } dynamicIsland: { context in
            DynamicIsland {
                // ── Expanded (long-press) ──────────────────────
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 6) {
                        Image(systemName: context.attributes.activityType == "run"
                              ? "figure.run" : "dumbbell.fill")
                            .foregroundColor(zealOrange)
                            .font(.system(size: 16, weight: .semibold))
                        Text("zeal+")
                            .font(.system(size: 13, weight: .black, design: .rounded))
                            .foregroundColor(zealOrange)
                    }
                }

                DynamicIslandExpandedRegion(.trailing) {
                    if let timerEnd = context.state.restTimerEnd, timerEnd > Date() {
                        VStack(alignment: .trailing, spacing: 0) {
                            Text(timerEnd, style: .timer)
                                .font(.system(size: 18, weight: .bold, design: .monospaced))
                                .foregroundColor(zealOrange)
                            Text("rest")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                    } else {
                        Text(context.state.detail)
                            .font(.system(size: 16, weight: .bold))
                            .foregroundColor(.primary)
                    }
                }

                DynamicIslandExpandedRegion(.center) {
                    Text(context.state.title)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(.primary)
                        .lineLimit(1)
                }

                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.state.subtitle)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

            } compactLeading: {
                // ── Compact leading ────────────────────────────
                Image(systemName: context.attributes.activityType == "run"
                      ? "figure.run" : "dumbbell.fill")
                    .foregroundColor(zealOrange)
                    .font(.system(size: 14, weight: .semibold))

            } compactTrailing: {
                // ── Compact trailing ───────────────────────────
                if let timerEnd = context.state.restTimerEnd, timerEnd > Date() {
                    Text(timerEnd, style: .timer)
                        .font(.system(size: 12, weight: .bold, design: .monospaced))
                        .foregroundColor(zealOrange)
                        .frame(maxWidth: 40)
                } else {
                    Text(context.state.detail)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(zealOrange)
                        .lineLimit(1)
                        .frame(maxWidth: 50)
                }

            } minimal: {
                // ── Minimal (two activities competing) ────────
                Image(systemName: context.attributes.activityType == "run"
                      ? "figure.run" : "dumbbell.fill")
                    .foregroundColor(zealOrange)
                    .font(.system(size: 12, weight: .semibold))
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────
// Lock Screen banner view
// ─────────────────────────────────────────────────────────────────
struct ZealLockScreenView: View {
    let context: ActivityViewContext<ZealActivityAttributes>

    var body: some View {
        HStack(spacing: 14) {
            // Left icon
            ZStack {
                Circle()
                    .fill(zealOrange.opacity(0.18))
                    .frame(width: 46, height: 46)
                Image(systemName: context.attributes.activityType == "run"
                      ? "figure.run" : "dumbbell.fill")
                    .foregroundColor(zealOrange)
                    .font(.system(size: 20, weight: .semibold))
            }

            // Center text
            VStack(alignment: .leading, spacing: 3) {
                Text(context.state.title)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(.primary)
                    .lineLimit(1)
                Text(context.state.subtitle)
                    .font(.system(size: 12))
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            // Right: rest countdown or stat
            if let timerEnd = context.state.restTimerEnd, timerEnd > Date() {
                VStack(alignment: .trailing, spacing: 2) {
                    Text(timerEnd, style: .timer)
                        .font(.system(size: 20, weight: .bold, design: .monospaced))
                        .foregroundColor(zealOrange)
                    Text("rest")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            } else {
                VStack(alignment: .trailing, spacing: 2) {
                    Text(context.state.detail)
                        .font(.system(size: 18, weight: .bold))
                        .foregroundColor(.primary)
                    Text(context.attributes.activityType == "run" ? "active" : "in progress")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }
}
