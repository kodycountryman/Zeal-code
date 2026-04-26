import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

// ─────────────────────────────────────────────────────────────────
// TEMPORARILY STUBBED — always uses BlurView fallback.
// Native UIGlassEffect path disabled while bisecting launch crash.
// ─────────────────────────────────────────────────────────────────

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
