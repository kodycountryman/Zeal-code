package expo.modules.zealglassview

import android.content.Context
import android.view.View
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.views.ExpoView

// ─────────────────────────────────────────────────────────────────
// Android no-op — UIGlassEffect is iOS-only.
// Renders a plain transparent View so the layout is preserved.
// ─────────────────────────────────────────────────────────────────

class ZealGlassAndroidView(context: Context) : ExpoView(context) {
    init {
        setBackgroundColor(android.graphics.Color.TRANSPARENT)
    }
}

class ZealGlassViewModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("ZealGlassView")
        View(ZealGlassAndroidView::class) {}
    }
}
