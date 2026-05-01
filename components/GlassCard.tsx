import React from 'react';
import { View, StyleSheet, TouchableOpacity, type StyleProp, type ViewStyle, type LayoutChangeEvent } from 'react-native';
import { GlassView } from '@/modules/zeal-glass-view/src';
import { useZealTheme } from '@/context/AppContext';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'solid' | 'glass';
  onPress?: () => void;
  activeOpacity?: number;
  testID?: string;
  onLayout?: (event: LayoutChangeEvent) => void;
}

export default function GlassCard({
  children,
  style,
  variant = 'glass',
  onPress,
  activeOpacity = 0.7,
  testID,
  onLayout,
}: Props) {
  const { colors, isDark } = useZealTheme();

  const borderColor = colors.glass.cardBorder;
  // Lower opacity so UIGlassEffect / BlurView shows through
  const tint = colors.glass.tint;
  const blurIntensity = isDark ? 70 : 55;

  const cardStyle: StyleProp<ViewStyle> = [
    styles.base,
    { borderColor, backgroundColor: variant === 'glass' ? tint : colors.card },
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity style={cardStyle} onPress={onPress} activeOpacity={activeOpacity} testID={testID} onLayout={onLayout}>
        {variant === 'glass' ? <GlassView intensity={blurIntensity} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} /> : null}
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={cardStyle} testID={testID} onLayout={onLayout}>
      {variant === 'glass' ? <GlassView intensity={blurIntensity} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: 26,
    overflow: 'hidden',
    position: 'relative',
  },
});
