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
  /** Optional unit suffix shown after the value (e.g., "g", "cal") */
  unit?: string;
}

export default function MacroCard({ label, value, goal, color, icon, unit }: Props) {
  const { colors, isDark } = useZealTheme();
  const pct = macroPercentage(value, goal);
  const over = isOverGoal(value, goal);
  const progress = Math.min(pct, 100);

  const fillBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)';
  const valueColor = over ? '#ef4444' : colors.text;
  const secondaryColor = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.50)';

  const displayValue = Math.round(value);
  const displayText = unit ? `${displayValue}${unit}` : `${displayValue}`;

  return (
    <View style={[styles.card, { borderColor: color, backgroundColor: fillBg }]}>
      {/* Progress dot on top border */}
      <View
        style={[
          styles.dot,
          {
            backgroundColor: color,
            left: `${4 + progress * 0.92}%` as any,
          },
        ]}
      />

      <PlatformIcon name={icon} size={24} color={color} />

      <Text
        style={[styles.value, { color: valueColor }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {displayText}
      </Text>

      {/* Percentage + over-goal warning */}
      <View style={styles.pctRow}>
        {over && (
          <PlatformIcon name="alert-triangle" size={12} color="#ef4444" />
        )}
        <Text style={[styles.pctLabel, { color: over ? '#ef4444' : secondaryColor }]}>
          {pct}%
        </Text>
      </View>

      <Text
        style={[styles.label, { color }]}
        numberOfLines={1}
      >
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 16,
    paddingTop: 18,
    paddingBottom: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    top: -5,
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: -5,
  },
  value: {
    fontFamily: 'Outfit_800ExtraBold',
    fontSize: 28,
    lineHeight: 32,
    marginTop: 4,
  },
  pctRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  pctLabel: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    lineHeight: 16,
  },
  label: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 10,
    lineHeight: 12,
    marginTop: 2,
    letterSpacing: 1,
  },
});
