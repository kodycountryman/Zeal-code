import React from 'react';
import { View, StyleSheet } from 'react-native';
import MacroCard from '@/components/nutrition/MacroCard';
import { macroPercentage } from '@/services/nutritionUtils';
import type { NutrientProfile, MacroGoals } from '@/types/nutrition';
import type { AppIconName } from '@/constants/iconMap';

interface Props {
  totals: NutrientProfile;
  goals: MacroGoals;
}

const MACROS: Array<{
  key: 'calories' | 'protein' | 'fat' | 'carbs';
  label: string;
  color: string;
  icon: AppIconName;
  goalKey: keyof MacroGoals;
}> = [
  { key: 'calories', label: 'Calories', color: '#3b82f6', icon: 'flame', goalKey: 'calories' },
  { key: 'protein', label: 'Protein', color: '#8b5cf6', icon: 'dumbbell', goalKey: 'proteinGrams' },
  { key: 'fat', label: 'Fat', color: '#84cc16', icon: 'droplets', goalKey: 'fatGrams' },
  { key: 'carbs', label: 'Carbs', color: '#f97316', icon: 'zap', goalKey: 'carbsGrams' },
];

export default function MacroSummaryRow({ totals, goals }: Props) {
  return (
    <View style={styles.row}>
      {MACROS.map((m) => (
        <MacroCard
          key={m.key}
          label={m.label}
          value={totals[m.key]}
          goal={goals[m.goalKey]}
          color={m.color}
          icon={m.icon}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
});
