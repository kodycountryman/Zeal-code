import React from 'react';
import { View, StyleSheet, TouchableOpacity, type StyleProp, type ViewStyle, type LayoutChangeEvent } from 'react-native';
import { BlurView } from 'expo-blur';
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

  const borderColor = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)';
  const tint = isDark ? 'rgba(38,38,38,0.96)' : 'rgba(255,255,255,0.76)';
  const blurIntensity = isDark ? 62 : 36;

  const cardStyle: StyleProp<ViewStyle> = [
    styles.base,
    { borderColor, backgroundColor: variant === 'glass' ? tint : colors.card },
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity style={cardStyle} onPress={onPress} activeOpacity={activeOpacity} testID={testID} onLayout={onLayout}>
        {variant === 'glass' ? <BlurView intensity={blurIntensity} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} /> : null}
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={cardStyle} testID={testID} onLayout={onLayout}>
      {variant === 'glass' ? <BlurView intensity={blurIntensity} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} /> : null}
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

