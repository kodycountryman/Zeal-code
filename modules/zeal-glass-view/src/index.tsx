import React from 'react';
import { Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { requireOptionalNativeComponent } from 'expo-modules-core';

// ─────────────────────────────────────────────────────────────────
// <GlassView> — real UIGlassEffect on iOS 26+, BlurView elsewhere.
// ─────────────────────────────────────────────────────────────────

const NativeGlassView = Platform.OS === 'ios'
  ? requireOptionalNativeComponent<{ style?: StyleProp<ViewStyle> }>('ZealGlassView')
  : null;

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
