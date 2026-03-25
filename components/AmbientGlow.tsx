import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');
const GLOW_SIZE = Math.round(Math.min(width, height) * 1.1);

interface Props {
  color: string;
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

function desaturate(r: number, g: number, b: number, amount: number): string {
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  const nr = Math.round(r + (gray - r) * amount);
  const ng = Math.round(g + (gray - g) * amount);
  const nb = Math.round(b + (gray - b) * amount);
  return `rgba(${nr},${ng},${nb},0.03)`;
}

export default function AmbientGlow({ color }: Props) {
  const rgb = hexToRgb(color);
  const glowColor = rgb
    ? desaturate(rgb.r, rgb.g, rgb.b, 0.65)
    : 'rgba(255,255,255,0.03)';
  const transparent = 'rgba(0,0,0,0)';

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <View style={[styles.glow, styles.bottomLeft]}>
        <LinearGradient
          colors={[glowColor, transparent]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
        />
      </View>
      <View style={[styles.glow, styles.topRight]}>
        <LinearGradient
          colors={[glowColor, transparent]}
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
    borderRadius: GLOW_SIZE / 2,
    overflow: 'hidden',
  },
  bottomLeft: {
    bottom: -(GLOW_SIZE * 0.4),
    left: -(GLOW_SIZE * 0.4),
  },
  topRight: {
    top: -(GLOW_SIZE * 0.4),
    right: -(GLOW_SIZE * 0.4),
  },
});
