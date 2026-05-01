import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import BaseDrawer from '@/components/drawers/BaseDrawer';
import DrawerHeader from '@/components/drawers/DrawerHeader';
import { useZealTheme } from '@/context/AppContext';
import { useNutrition } from '@/context/NutritionContext';
import { PlatformIcon } from '@/components/PlatformIcon';
import { MEAL_LABELS } from '@/types/nutrition';
import type { AIFoodResult } from '@/services/aiFoodScanner';
import { generateId } from '@/services/nutritionUtils';

interface Props {
  result: AIFoodResult | null;
  onClose: () => void;
}

const CONFIDENCE_COLORS = {
  high: '#22c55e',
  medium: '#f59e0b',
  low: '#ef4444',
};

export default function AIFoodResultSheet({ result, onClose }: Props) {
  const { colors, accent, isDark } = useZealTheme();
  const {
    aiFoodResultVisible,
    setAiFoodResultVisible,
    selectedMealType,
    addMealEntry,
  } = useNutrition();

  const mealLabel = selectedMealType ? MEAL_LABELS[selectedMealType] : 'Meal';

  const handleClose = useCallback(() => {
    setAiFoodResultVisible(false);
    onClose();
  }, [setAiFoodResultVisible, onClose]);

  const handleLogAll = useCallback(() => {
    if (!result || !selectedMealType) return;

    for (const food of result.foods) {
      const foodItem = {
        id: generateId(),
        name: food.name,
        servingSizes: [{ label: `${food.estimatedServingGrams}g`, grams: food.estimatedServingGrams }],
        nutrientsPer100g: {
          calories: food.estimatedServingGrams > 0 ? (food.nutrients.calories / food.estimatedServingGrams) * 100 : 0,
          protein: food.estimatedServingGrams > 0 ? (food.nutrients.protein / food.estimatedServingGrams) * 100 : 0,
          fat: food.estimatedServingGrams > 0 ? (food.nutrients.fat / food.estimatedServingGrams) * 100 : 0,
          carbs: food.estimatedServingGrams > 0 ? (food.nutrients.carbs / food.estimatedServingGrams) * 100 : 0,
        },
        source: 'ai_estimated' as const,
      };

      addMealEntry(foodItem, selectedMealType, {
        servingSize: { label: `${food.estimatedServingGrams}g`, grams: food.estimatedServingGrams },
        quantity: 1,
      });
    }

    handleClose();
  }, [result, selectedMealType, addMealEntry, handleClose]);

  const foods = result?.foods ?? [];

  return (
    <BaseDrawer
      visible={aiFoodResultVisible}
      onClose={handleClose}
      snapPoints={['70%']}
      header={
        <DrawerHeader title="AI Food Scan" onClose={handleClose} />
      }
      footer={
        foods.length > 0 ? (
          <View style={styles.footerWrap}>
            <TouchableOpacity
              style={[styles.logBtn, { backgroundColor: accent }]}
              onPress={handleLogAll}
              activeOpacity={0.8}
            >
              <Text style={styles.logBtnText}>
                Log {foods.length > 1 ? `All ${foods.length} Items` : 'to'} {mealLabel}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null
      }
    >
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {foods.length === 0 ? (
          <View style={styles.emptyWrap}>
            <PlatformIcon name="search" size={40} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No food items detected. Try taking a clearer photo.
            </Text>
          </View>
        ) : (
          foods.map((food, idx) => (
            <View
              key={idx}
              style={[styles.foodCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.cardSecondary }]}
            >
              <View style={styles.foodHeader}>
                <Text style={[styles.foodName, { color: colors.text }]}>{food.name}</Text>
                <View style={[styles.badge, { backgroundColor: CONFIDENCE_COLORS[food.confidence] + '20' }]}>
                  <Text style={[styles.badgeText, { color: CONFIDENCE_COLORS[food.confidence] }]}>
                    {food.confidence}
                  </Text>
                </View>
              </View>
              <Text style={[styles.servingText, { color: colors.textMuted }]}>
                ~{food.estimatedServingGrams}g serving
              </Text>
              <View style={styles.macroRow}>
                <MacroChip label="Cal" value={food.nutrients.calories} color="#3b82f6" colors={colors} isDark={isDark} />
                <MacroChip label="Protein" value={food.nutrients.protein} unit="g" color="#8b5cf6" colors={colors} isDark={isDark} />
                <MacroChip label="Fat" value={food.nutrients.fat} unit="g" color="#84cc16" colors={colors} isDark={isDark} />
                <MacroChip label="Carbs" value={food.nutrients.carbs} unit="g" color="#f97316" colors={colors} isDark={isDark} />
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </BaseDrawer>
  );
}

function MacroChip({
  label,
  value,
  unit,
  color,
  colors,
  isDark,
}: {
  label: string;
  value: number;
  unit?: string;
  color: string;
  colors: any;
  isDark: boolean;
}) {
  return (
    <View style={[styles.macroChip, { backgroundColor: color + '12' }]}>
      <Text style={[styles.macroValue, { color: colors.text }]}>
        {Math.round(value)}{unit ?? ''}
      </Text>
      <Text style={[styles.macroLabel, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 24,
  },
  emptyWrap: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 40,
  },
  emptyText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  foodCard: {
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  foodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  foodName: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 11,
    textTransform: 'capitalize',
  },
  servingText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
  },
  macroRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  macroChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    gap: 2,
  },
  macroValue: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 15,
  },
  macroLabel: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  footerWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  logBtn: {
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logBtnText: {
    color: '#fff',
    fontSize: 17,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.2,
  },
});
