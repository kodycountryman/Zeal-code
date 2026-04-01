import React from 'react';
import { Platform, type StyleProp, type ViewStyle } from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { SFSymbol } from 'sf-symbols-typescript';
import { type AppIconName, SF_SYMBOL_MAP, LUCIDE_MAP } from '@/constants/iconMap';

type PlatformIconProps = {
  name: AppIconName;
  size?: number;
  color?: string;
  /** SF Symbol weight — only applies on iOS */
  weight?: SymbolViewProps['weight'];
  /** Lucide strokeWidth — mapped to SF Symbol weight on iOS */
  strokeWidth?: number;
  /** Fill color — appends .fill to SF Symbol name on iOS if set */
  fill?: string;
  /** Optional style forwarded to the underlying icon element */
  style?: StyleProp<ViewStyle>;
};

function strokeWidthToWeight(sw: number): SymbolViewProps['weight'] {
  if (sw <= 1.5) return 'bold';
  if (sw < 2.5) return 'bold';
  return 'black';
}

export function PlatformIcon({
  name,
  size = 24,
  color = '#ffffff',
  weight,
  strokeWidth,
  fill,
  style,
}: PlatformIconProps) {
  if (Platform.OS === 'ios') {
    const resolvedWeight: SymbolViewProps['weight'] =
      weight ?? (strokeWidth !== undefined ? strokeWidthToWeight(strokeWidth) : 'black');

    const hasFill = fill !== undefined && fill !== 'transparent' && fill !== 'none' && fill !== '';
    const baseName = SF_SYMBOL_MAP[name];
    const symbolName = hasFill ? `${baseName}.fill` : baseName;

    return (
      <SymbolView
        name={symbolName as SFSymbol}
        size={size}
        tintColor={color}
        weight={resolvedWeight}
        resizeMode="scaleAspectFit"
        style={[{ width: size, height: size }, style]}
      />
    );
  }

  // Android: render Lucide equivalent
  const LucideIcon = LUCIDE_MAP[name];
  return <LucideIcon size={size} color={color} strokeWidth={strokeWidth} fill={fill} style={style} />;
}
