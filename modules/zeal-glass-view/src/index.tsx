import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

// ─────────────────────────────────────────────────────────────────
// <GlassView> — Expo BlurView fallback. Native glass is intentionally disabled.
// ─────────────────────────────────────────────────────────────────

const NativeGlassView: React.ComponentType<{ children?: React.ReactNode; style?: StyleProp<ViewStyle> }> | null = null;

interface GlassViewProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  tint?: 'dark' | 'light' | 'default';
}

export function GlassView({
  children,
  style,
  intensity = 70,
  tint = 'dark',
}: GlassViewProps) {
  if (NativeGlassView) {
    return (
      <NativeGlassView style={[styles.base, style]}>
        {children}
      </NativeGlassView>
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
