import ExpoModulesCore

// ─────────────────────────────────────────────────────────────────
// Registers ZealGlassView as a native Expo view named "ZealGlassView".
// The TypeScript side references this name via requireOptionalNativeComponent.
// ─────────────────────────────────────────────────────────────────

public class ZealGlassViewModule: Module {
    public func definition() -> ModuleDefinition {
        Name("ZealGlassView")

        if #available(iOS 26, *) {
            View(ZealGlassView.self) {
                // No props needed — glass effect is purely visual
            }
        }
    }
}
