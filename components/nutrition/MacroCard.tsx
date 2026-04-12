import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useZealTheme } from '@/context/AppContext';
import { PlatformIcon } from '@/components/PlatformIcon';
import type { AppIconName } from '@/constants/iconMap';
import { macroPercentage, isOverGoal } from '@/services/nutritionUtils';

interface Props {
  label: string;
  value: number;
  goal: number;
  color: string;
  icon: AppIconName;
}

export default function MacroCard({ label, value, goal, color, icon }: Props) {
  const { isDark } = useZealTheme();
  const pct = macroPercentage(value, goal);
  const over = isOverGoal(value, goal);
  const progress = Math.min(pct, 100);

  // Position the dot along the top border (4px inset from each side)
  const dotPositionPct = `${progress}%`;

  const fillBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)';

  return (
    <View style={[styles.card, { borderColor: color, backgroundColor: fillBg }]}>
      {/* Progress dot on top border */}
      <View
        style={[
          styles.dot,
          {
            backgroundColor: color,
            left: `${progress}%` as any,
          },
        ]}
      />

      <PlatformIcon name={icon} size={20} color={color} />

      <Text
        style={[
          styles.value,
          { color: over ? '#ef4444' : color },
        ]}
        numberOfLines={1}
      >
        {Math.round(value)}
      </Text>

      <Text style={[styles.pctLabel, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)' }]}>
        {pct}%
      </Text>

      <Text
        style={[
          styles.label,
          { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)' },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    top: -5,
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: -5, // center the dot on its left position
  },
  value: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 22,
    lineHeight: 26,
    marginTop: 4,
  },
  pctLabel: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 12,
    lineHeight: 14,
  },
  label: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 11,
    lineHeight: 13,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
