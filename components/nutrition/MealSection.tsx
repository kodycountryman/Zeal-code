import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useZealTheme } from '@/context/AppContext';
import { PlatformIcon } from '@/components/PlatformIcon';
import GlassCard from '@/components/GlassCard';
import { mealCalories } from '@/services/nutritionUtils';
import type { AppIconName } from '@/constants/iconMap';
import type { MealEntry, MealType } from '@/types/nutrition';
import { MEAL_LABELS } from '@/types/nutrition';

// ─── Meal icon mapping ──────────────────────────────────

const MEAL_ICONS: Record<MealType, { name: AppIconName; color: string }> = {
  breakfast: { name: 'sun', color: '#f59e0b' },
  lunch: { name: 'utensils', color: '#22c55e' },
  dinner: { name: 'moon', color: '#6366f1' },
  snacks: { name: 'zap', color: '#ec4899' },
};

interface Props {
  mealType: MealType;
  entries: MealEntry[];
  onPress: () => void;
}

export default function MealSection({ mealType, entries, onPress }: Props) {
  const { colors, isDark } = useZealTheme();

  const totalCal = mealCalories(entries);
  const icon = MEAL_ICONS[mealType];

  return (
    <GlassCard style={styles.tile}>
      <Pressable
        style={styles.inner}
        onPress={onPress}
        android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
      >
        {/* Icon + Label */}
        <View style={styles.topRow}>
          <View style={[styles.iconCircle, { backgroundColor: icon.color + '18' }]}>
            <PlatformIcon name={icon.name} size={20} color={icon.color} />
          </View>
          <PlatformIcon name="plus" size={16} color={colors.textMuted} />
        </View>

        <Text style={[styles.mealLabel, { color: colors.text }]}>
          {MEAL_LABELS[mealType]}
        </Text>

        {/* Stats */}
        <View style={styles.statsRow}>
          <Text style={[styles.calText, { color: colors.textSecondary }]}>
            {totalCal > 0 ? `${totalCal} cal` : '0 cal'}
          </Text>
          {entries.length > 0 && (
            <Text style={[styles.countText, { color: colors.textMuted }]}>
              {entries.length} item{entries.length !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
      </Pressable>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    padding: 0,
    overflow: 'hidden',
  },
  inner: {
    padding: 14,
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealLabel: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    lineHeight: 18,
  },
  statsRow: {
    gap: 2,
  },
  calText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
    lineHeight: 16,
  },
  countText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    lineHeight: 14,
  },
});
