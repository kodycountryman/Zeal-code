import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

// ─────────────────────────────────────────────────────────────────
// <GlassView> — Apple Liquid Glass (iOS 26+) with BlurView fallback.
//
// On iOS 26+ native builds, expo-glass-effect renders a real
// UIGlassEffect surface. Everywhere else (older iOS, Android, web,
// Expo Go without the module) we keep the original BlurView look.
// ─────────────────────────────────────────────────────────────────

let LiquidGlassView: React.ComponentType<any> | null = null;
let liquidGlassAvailable = false;
try {
  const glass = require('expo-glass-effect');
  if (glass.isLiquidGlassAvailable?.()) {
    LiquidGlassView = glass.GlassView;
    liquidGlassAvailable = true;
  }
} catch {
  // Module not present in this runtime — BlurView fallback below.
}

interface GlassViewProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  tint?: 'dark' | 'light' | 'default';
  /** Enables the liquid glass touch-response shimmer (iOS 26+ only). */
  interactive?: boolean;
}

export function GlassView({
  children,
  style,
  intensity = 70,
  tint = 'dark',
  interactive = false,
}: GlassViewProps) {
  if (liquidGlassAvailable && LiquidGlassView) {
    return (
      <LiquidGlassView
        glassEffectStyle="regular"
        colorScheme={tint === 'default' ? 'auto' : tint}
        isInteractive={interactive}
        style={[styles.base, style]}
      >
        {children}
      </LiquidGlassView>
    );
  }

  return (
    <BlurView intensity={intensity} tint={tint} style={[styles.base, style]}>
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});
