import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');
const GLOW_SIZE = Math.round(Math.min(width, height) * 1.3);

interface Props {
  color: string;
  opacity?: number;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

function makeStop(r: number, g: number, b: number, desatAmt: number, alpha: number): string {
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  const nr = Math.round(r + (gray - r) * desatAmt);
  const ng = Math.round(g + (gray - g) * desatAmt);
  const nb = Math.round(b + (gray - b) * desatAmt);
  return `rgba(${nr},${ng},${nb},${alpha})`;
}

export default function AmbientGlow({ color, opacity = 0.015 }: Props) {
  const rgb = hexToRgb(color);
  const transparent = 'rgba(0,0,0,0)';

  const stop0 = rgb ? makeStop(rgb.r, rgb.g, rgb.b, 0.55, opacity) : `rgba(255,255,255,${opacity})`;
  const stop1 = rgb ? makeStop(rgb.r, rgb.g, rgb.b, 0.60, opacity * 0.65) : `rgba(255,255,255,${opacity * 0.65})`;
  const stop2 = rgb ? makeStop(rgb.r, rgb.g, rgb.b, 0.65, opacity * 0.22) : `rgba(255,255,255,${opacity * 0.22})`;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <View style={[styles.glow, styles.bottomLeft]}>
        <LinearGradient
          colors={[stop0, stop1, stop2, transparent]}
          locations={[0, 0.38, 0.72, 1]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
        />
      </View>
      <View style={[styles.glow, styles.topRight]}>
        <LinearGradient
          colors={[stop0, stop1, stop2, transparent]}
          locations={[0, 0.38, 0.72, 1]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
    width: GLOW_SIZE,
    height: GLOW_SIZE,
  },
  bottomLeft: {
    bottom: -(GLOW_SIZE * 0.35),
    left: -(GLOW_SIZE * 0.35),
  },
  topRight: {
    top: -(GLOW_SIZE * 0.35),
    right: -(GLOW_SIZE * 0.35),
  },
});
