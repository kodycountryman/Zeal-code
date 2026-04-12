import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
} from 'react-native';
import BaseDrawer from '@/components/drawers/BaseDrawer';
import DrawerHeader from '@/components/drawers/DrawerHeader';
import { useZealTheme } from '@/context/AppContext';
import { useNutrition } from '@/context/NutritionContext';
import { MEAL_LABELS } from '@/types/nutrition';
import type { ServingSize } from '@/types/nutrition';

// ─── Helpers ──────────────────────────────────────────

function parseNum(val: string): number {
  const n = parseFloat(val.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

// ─── Component ────────────────────────────────────────

export default function ManualFoodEntrySheet() {
  const { colors, accent, isDark } = useZealTheme();
  const {
    manualFoodEntryVisible,
    setManualFoodEntryVisible,
    selectedMealType,
    saveCustomFood,
    addMealEntry,
  } = useNutrition();

  // Form state
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [servingLabel, setServingLabel] = useState('');
  const [servingGrams, setServingGrams] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const mealLabel = selectedMealType ? MEAL_LABELS[selectedMealType] : 'Meal';

  const resetForm = useCallback(() => {
    setName('');
    setBrand('');
    setServingLabel('');
    setServingGrams('');
    setCalories('');
    setProtein('');
    setFat('');
    setCarbs('');
    setErrors({});
  }, []);

  const handleClose = useCallback(() => {
    setManualFoodEntryVisible(false);
    resetForm();
  }, [setManualFoodEntryVisible, resetForm]);

  const handleSubmit = useCallback(() => {
    // Validate required fields
    const newErrors: Record<string, boolean> = {};
    if (!name.trim()) newErrors.name = true;
    if (!servingGrams.trim() || parseNum(servingGrams) <= 0) newErrors.servingGrams = true;
    if (!calories.trim()) newErrors.calories = true;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    Keyboard.dismiss();

    const gramsVal = parseNum(servingGrams);
    const calsVal = parseNum(calories);
    const proteinVal = parseNum(protein);
    const fatVal = parseNum(fat);
    const carbsVal = parseNum(carbs);

    // Build the serving size
    const serving: ServingSize = {
      label: servingLabel.trim() || `${gramsVal}g`,
      grams: gramsVal,
    };

    // Convert to per-100g for canonical storage
    const factor = gramsVal > 0 ? 100 / gramsVal : 1;

    const customFood = saveCustomFood({
      name: name.trim(),
      brand: brand.trim() || undefined,
      servingSizes: [serving],
      nutrientsPer100g: {
        calories: calsVal * factor,
        protein: proteinVal * factor,
        fat: fatVal * factor,
        carbs: carbsVal * factor,
      },
      source: 'custom',
    });

    if (selectedMealType) {
      addMealEntry(customFood, selectedMealType, {
        servingSize: serving,
        quantity: 1,
      });
    }

    handleClose();
  }, [
    name, brand, servingLabel, servingGrams, calories, protein, fat, carbs,
    selectedMealType, saveCustomFood, addMealEntry, handleClose,
  ]);

  // ── Input style builder ──

  const inputStyle = useCallback(
    (field?: string) => [
      styles.input,
      {
        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.card,
        borderColor: errors[field ?? ''] ? '#EF4444' : colors.border,
        color: colors.text,
      },
    ],
    [colors, isDark, errors],
  );

  const placeholderColor = colors.textMuted;

  // ── Render ──

  return (
    <BaseDrawer
      visible={manualFoodEntryVisible}
      onClose={handleClose}
      hasTextInput
      snapPoints={['92%']}
      header={
        <DrawerHeader title="Create Food" onClose={handleClose} />
      }
      footer={
        <View style={styles.footerWrap}>
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: accent }]}
            onPress={handleSubmit}
            activeOpacity={0.8}
          >
            <Text style={styles.submitText}>Add to {mealLabel}</Text>
          </TouchableOpacity>
        </View>
      }
    >
      <View style={styles.content}>
        {/* ── Food Details Section ── */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Food Details</Text>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Food Name *</Text>
            <TextInput
              style={inputStyle('name')}
              value={name}
              onChangeText={(t) => { setName(t); setErrors((e) => ({ ...e, name: false })); }}
              placeholder="e.g. Greek Yogurt"
              placeholderTextColor={placeholderColor}
              returnKeyType="next"
              autoCapitalize="words"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Brand (optional)</Text>
            <TextInput
              style={inputStyle()}
              value={brand}
              onChangeText={setBrand}
              placeholder="e.g. Fage"
              placeholderTextColor={placeholderColor}
              returnKeyType="next"
              autoCapitalize="words"
            />
          </View>
        </View>

        {/* ── Serving Size Section ── */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Serving Size</Text>

          <View style={styles.row}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Label</Text>
              <TextInput
                style={inputStyle()}
                value={servingLabel}
                onChangeText={setServingLabel}
                placeholder="e.g. 1 Cup"
                placeholderTextColor={placeholderColor}
                returnKeyType="next"
                autoCapitalize="words"
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Grams *</Text>
              <TextInput
                style={inputStyle('servingGrams')}
                value={servingGrams}
                onChangeText={(t) => { setServingGrams(t); setErrors((e) => ({ ...e, servingGrams: false })); }}
                placeholder="150"
                placeholderTextColor={placeholderColor}
                keyboardType="decimal-pad"
                returnKeyType="next"
              />
            </View>
          </View>
        </View>

        {/* ── Nutrition Section ── */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Nutrition (per serving)</Text>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Calories *</Text>
            <TextInput
              style={inputStyle('calories')}
              value={calories}
              onChangeText={(t) => { setCalories(t); setErrors((e) => ({ ...e, calories: false })); }}
              placeholder="0"
              placeholderTextColor={placeholderColor}
              keyboardType="decimal-pad"
              returnKeyType="next"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Protein (g)</Text>
              <TextInput
                style={inputStyle()}
                value={protein}
                onChangeText={setProtein}
                placeholder="0"
                placeholderTextColor={placeholderColor}
                keyboardType="decimal-pad"
                returnKeyType="next"
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Fat (g)</Text>
              <TextInput
                style={inputStyle()}
                value={fat}
                onChangeText={setFat}
                placeholder="0"
                placeholderTextColor={placeholderColor}
                keyboardType="decimal-pad"
                returnKeyType="next"
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Carbs (g)</Text>
              <TextInput
                style={inputStyle()}
                value={carbs}
                onChangeText={setCarbs}
                placeholder="0"
                placeholderTextColor={placeholderColor}
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
            </View>
          </View>
        </View>
      </View>
    </BaseDrawer>
  );
}

// ─── Styles ──────────────────────────────────────────

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 32,
    gap: 16,
  },
  section: {
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  fieldGroup: {
    gap: 4,
  },
  label: {
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
    marginLeft: 2,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Outfit_500Medium',
  },
  row: {
    flexDirection: 'row',
  },
  footerWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  submitBtn: {
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    color: '#fff',
    fontSize: 17,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.2,
  },
});
