import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import BaseDrawer from '@/components/drawers/BaseDrawer';
import DrawerHeader from '@/components/drawers/DrawerHeader';
import { useZealTheme } from '@/context/AppContext';
import { useNutrition } from '@/context/NutritionContext';
import { PlatformIcon } from '@/components/PlatformIcon';
import MealEntryRow from '@/components/nutrition/MealEntryRow';
import { mealCalories } from '@/services/nutritionUtils';
import { MEAL_LABELS } from '@/types/nutrition';
import type { MealEntry, MealType } from '@/types/nutrition';

interface Props {
  visible: boolean;
  mealType: MealType | null;
  entries: MealEntry[];
  onClose: () => void;
  onAddFood: () => void;
}

export default function MealDetailSheet({ visible, mealType, entries, onClose, onAddFood }: Props) {
  const { colors, accent, isDark } = useZealTheme();
  const { removeMealEntry } = useNutrition();

  const mealLabel = mealType ? MEAL_LABELS[mealType] : 'Meal';
  const totalCal = mealCalories(entries);

  const handleDelete = useCallback(
    (entryId: string, foodName: string) => {
      Alert.alert(
        'Delete Entry',
        `Remove "${foodName}" from ${mealLabel}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => removeMealEntry(entryId),
          },
        ],
      );
    },
    [mealLabel, removeMealEntry],
  );

  const handleAddMore = useCallback(() => {
    onClose();
    setTimeout(() => onAddFood(), 300);
  }, [onClose, onAddFood]);

  return (
    <BaseDrawer
      visible={visible}
      onClose={onClose}
      snapPoints={['60%']}
      header={
        <DrawerHeader
          title={mealLabel}
          onClose={onClose}
          rightContent={
            <Text style={[styles.totalCal, { color: colors.textSecondary }]}>
              {totalCal} cal
            </Text>
          }
        />
      }
    >
      <View style={styles.content}>
        {entries.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              No food logged yet.
            </Text>
          </View>
        ) : (
          entries.map((entry) => (
            <MealEntryRow
              key={entry.id}
              entry={entry}
              onTap={() => {
                /* future: edit serving size */
              }}
              onDelete={() => handleDelete(entry.id, entry.food.name)}
            />
          ))
        )}

        {/* Add more food button */}
        <TouchableOpacity
          style={[
            styles.addBtn,
            { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' },
          ]}
          onPress={handleAddMore}
          activeOpacity={0.7}
        >
          <PlatformIcon name="plus" size={18} color={accent} />
          <Text style={[styles.addBtnText, { color: accent }]}>Add Food</Text>
        </TouchableOpacity>
      </View>
    </BaseDrawer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 32,
  },
  totalCal: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 15,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 14,
  },
  addBtnText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
  },
});
