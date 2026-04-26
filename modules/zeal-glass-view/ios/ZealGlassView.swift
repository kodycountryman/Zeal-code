import ExpoModulesCore
import UIKit

// ─────────────────────────────────────────────────────────────────
// ZealGlassView — wraps UIGlassEffect (iOS 26+) as an Expo native view.
// Falls back to UIBlurEffect on iOS 16.2–25.x so the view is never
// transparent.
// ─────────────────────────────────────────────────────────────────

final class ZealGlassView: ExpoView {

    private var effectView: UIVisualEffectView?

    required init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)
        setupEffect()
    }

    private func setupEffect() {
        let effect: UIVisualEffect
        if #available(iOS 26, *) {
            effect = UIGlassEffect()
        } else {
            effect = UIBlurEffect(style: .systemMaterial)
        }
        let ev = UIVisualEffectView(effect: effect)
        ev.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        ev.frame = bounds
        insertSubview(ev, at: 0)
        effectView = ev
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        effectView?.frame = bounds
    }
}
