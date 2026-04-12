import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, LayoutAnimation, UIManager, Platform } from 'react-native';
import { useZealTheme } from '@/context/AppContext';
import { PlatformIcon } from '@/components/PlatformIcon';
import MealEntryRow from '@/components/nutrition/MealEntryRow';
import { mealCalories } from '@/services/nutritionUtils';
import type { MealEntry, MealType } from '@/types/nutrition';
import { MEAL_LABELS } from '@/types/nutrition';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  mealType: MealType;
  entries: MealEntry[];
  onAddFood: () => void;
  onTapEntry: (entry: MealEntry) => void;
  onDeleteEntry: (entryId: string) => void;
}

export default function MealSection({
  mealType,
  entries,
  onAddFood,
  onTapEntry,
  onDeleteEntry,
}: Props) {
  const { colors, isDark } = useZealTheme();
  const [collapsed, setCollapsed] = useState(false);

  const toggleCollapse = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsed((prev) => !prev);
  }, []);

  const totalCal = mealCalories(entries);
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor,
        },
      ]}
    >
      {/* Header */}
      <Pressable style={styles.header} onPress={toggleCollapse}>
        <View style={styles.headerLeft}>
          <PlatformIcon
            name={collapsed ? 'chevron-right' : 'chevron-down'}
            size={16}
            color={colors.textMuted}
          />
          <Text style={[styles.mealLabel, { color: colors.text }]}>
            {MEAL_LABELS[mealType]}
          </Text>
        </View>
        <Text style={[styles.totalCal, { color: colors.textSecondary }]}>
          {totalCal > 0 ? `${totalCal} cal` : ''}
        </Text>
      </Pressable>

      {/* Content */}
      {!collapsed && (
        <>
          {entries.map((entry) => (
            <MealEntryRow
              key={entry.id}
              entry={entry}
              onTap={() => onTapEntry(entry)}
              onDelete={() => onDeleteEntry(entry.id)}
            />
          ))}

          {/* Add Food Button */}
          <Pressable
            style={({ pressed }) => [
              styles.addButton,
              pressed && { opacity: 0.6 },
            ]}
            onPress={onAddFood}
          >
            <PlatformIcon name="plus" size={16} color={colors.textMuted} />
            <Text style={[styles.addText, { color: colors.textMuted }]}>
              Add Food
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mealLabel: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
    lineHeight: 20,
  },
  totalCal: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 14,
    lineHeight: 18,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  addText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 14,
    lineHeight: 18,
  },
});
