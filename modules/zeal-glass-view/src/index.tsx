import React from 'react';
import { Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { requireOptionalNativeComponent } from 'expo-modules-core';

// ─────────────────────────────────────────────────────────────────
// <GlassView> — real UIGlassEffect on iOS 26+, BlurView elsewhere.
//
// Usage (drop-in replacement for BlurView):
//   <GlassView style={StyleSheet.absoluteFill} intensity={70} tint="dark">
//     {children}
//   </GlassView>
// ─────────────────────────────────────────────────────────────────

// Returns null in Expo Go and on iOS <26 (module not compiled in).
const NativeGlassView = Platform.OS === 'ios'
  ? requireOptionalNativeComponent<{ style?: StyleProp<ViewStyle> }>('ZealGlassView')
  : null;

interface GlassViewProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Blur intensity used by the BlurView fallback (0–100). Ignored on iOS 26+. */
  intensity?: number;
  /** Blur tint used by the BlurView fallback. Ignored on iOS 26+. */
  tint?: 'dark' | 'light' | 'default';
}

export function GlassView({
  children,
  style,
  intensity = 70,
  tint = 'dark',
}: GlassViewProps) {
  // iOS 26+ with native module compiled in → real UIGlassEffect
  if (NativeGlassView) {
    return (
      <NativeGlassView style={[styles.base, style]}>
        {children}
      </NativeGlassView>
    );
  }

  // Fallback: expo-blur BlurView (iOS <26, Android, Expo Go)
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
