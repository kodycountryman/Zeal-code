import ExpoModulesCore
import UIKit

// ─────────────────────────────────────────────────────────────────
// ZealGlassView — wraps UIGlassEffect (iOS 26+) as an Expo native view.
// On iOS <26 this class is never instantiated — the TS layer falls
// back to BlurView instead, so no availability guard is needed at
// the call site.
// ─────────────────────────────────────────────────────────────────

@available(iOS 26, *)
final class ZealGlassView: ExpoView {

    private var effectView: UIVisualEffectView?

    required init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)
        setupGlass()
    }

    private func setupGlass() {
        let glass = UIGlassEffect()
        let ev = UIVisualEffectView(effect: glass)
        ev.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        ev.frame = bounds
        // Insert below React subviews so children render on top of glass
        insertSubview(ev, at: 0)
        effectView = ev
    }

    // Ensure the effect view always fills the native frame
    override func layoutSubviews() {
        super.layoutSubviews()
        effectView?.frame = bounds
    }
}
