import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import BaseDrawer from '@/components/drawers/BaseDrawer';
import DrawerHeader from '@/components/drawers/DrawerHeader';
import { useZealTheme } from '@/context/AppContext';
import { useNutrition } from '@/context/NutritionContext';
import { MEAL_LABELS } from '@/types/nutrition';
import type { FoodItem, ServingSize } from '@/types/nutrition';
import { searchAll } from '@/services/foodSearch';

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
    recentFoods,
    customFoods,
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

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<FoodItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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
    setSuggestions([]);
    setShowSuggestions(false);
  }, []);

  const handleClose = useCallback(() => {
    setManualFoodEntryVisible(false);
    resetForm();
  }, [setManualFoodEntryVisible, resetForm]);

  // ── Autocomplete search ──
  const handleNameChange = useCallback(
    (text: string) => {
      setName(text);
      setErrors((e) => ({ ...e, name: false }));

      // Cancel pending debounce + in-flight request
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();

      if (text.trim().length < 3) {
        setSuggestions([]);
        setShowSuggestions(false);
        setSearching(false);
        return;
      }

      setSearching(true);
      debounceRef.current = setTimeout(() => {
        const controller = new AbortController();
        abortRef.current = controller;

        searchAll(text, recentFoods, customFoods, controller.signal)
          .then((results) => {
            // Only update if this request wasn't aborted
            if (!controller.signal.aborted) {
              setSuggestions(results);
              setShowSuggestions(results.length > 0);
              setSearching(false);
            }
          })
          .catch(() => {
            if (!controller.signal.aborted) {
              setSuggestions([]);
              setShowSuggestions(false);
              setSearching(false);
            }
          });
      }, 300);
    },
    [recentFoods, customFoods],
  );

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  // ── Select suggestion → fill form ──
  const handleSelectSuggestion = useCallback((food: FoodItem) => {
    const serving = food.servingSizes[0];
    const per100 = food.nutrientsPer100g;
    const factor = serving ? serving.grams / 100 : 1;

    setName(food.name);
    setBrand(food.brand ?? '');
    setServingLabel(serving?.label ?? '');
    setServingGrams(serving ? String(serving.grams) : '100');
    setCalories(String(Math.round(per100.calories * factor)));
    setProtein(String(Math.round(per100.protein * factor * 10) / 10));
    setFat(String(Math.round(per100.fat * factor * 10) / 10));
    setCarbs(String(Math.round(per100.carbs * factor * 10) / 10));
    setShowSuggestions(false);
    setSuggestions([]);
    setErrors({});
  }, []);

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

    const gramsVal = Math.min(Math.max(parseNum(servingGrams), 0.1), 5000);
    const calsVal = Math.max(parseNum(calories), 0);
    const proteinVal = Math.max(parseNum(protein), 0);
    const fatVal = Math.max(parseNum(fat), 0);
    const carbsVal = Math.max(parseNum(carbs), 0);

    // Macro consistency check
    const macroCals = Math.round(proteinVal * 4 + carbsVal * 4 + fatVal * 9);
    if (calsVal > 0 && macroCals > 0 && Math.abs(macroCals - calsVal) / calsVal > 0.3) {
      Alert.alert(
        'Macro Mismatch',
        `Your macros add up to ~${macroCals} cal but you entered ${Math.round(calsVal)} cal. Double-check your values.`,
        [
          { text: 'Fix It', style: 'cancel' },
          { text: 'Log Anyway', onPress: () => doSubmit(gramsVal, calsVal, proteinVal, fatVal, carbsVal) },
        ],
      );
      return;
    }

    doSubmit(gramsVal, calsVal, proteinVal, fatVal, carbsVal);
  }, [
    name, servingGrams, calories, protein, fat, carbs, servingLabel, brand,
    selectedMealType, saveCustomFood, addMealEntry, handleClose,
  ]);

  const doSubmit = useCallback(
    (gramsVal: number, calsVal: number, proteinVal: number, fatVal: number, carbsVal: number) => {
      const serving: ServingSize = {
        label: servingLabel.trim() || `${gramsVal}g`,
        grams: gramsVal,
      };

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
    },
    [name, brand, servingLabel, selectedMealType, saveCustomFood, addMealEntry, handleClose],
  );

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
      snapPoints={['100%']}
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
            <View>
              <TextInput
                style={inputStyle('name')}
                value={name}
                onChangeText={handleNameChange}
                placeholder="e.g. Greek Yogurt"
                placeholderTextColor={placeholderColor}
                returnKeyType="next"
                autoCapitalize="words"
              />
              {searching && (
                <View style={styles.searchingIndicator}>
                  <ActivityIndicator size="small" color={colors.textMuted} />
                </View>
              )}
            </View>

            {/* ── Autocomplete Suggestions ── */}
            {showSuggestions && suggestions.length > 0 && (
              <View style={[styles.suggestionsWrap, { backgroundColor: isDark ? '#1e1e1e' : '#fff', borderColor: colors.border }]}>
                {suggestions.map((food, idx) => {
                  const serving = food.servingSizes[0];
                  const factor = serving ? serving.grams / 100 : 1;
                  const cal = Math.round(food.nutrientsPer100g.calories * factor);

                  return (
                    <Pressable
                      key={food.id + idx}
                      style={({ pressed }) => [
                        styles.suggestionRow,
                        idx < suggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
                        pressed && { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)' },
                      ]}
                      onPress={() => handleSelectSuggestion(food)}
                    >
                      <View style={styles.suggestionInfo}>
                        <View style={styles.suggestionNameRow}>
                          <Text style={[styles.suggestionName, { color: colors.text }]} numberOfLines={1}>
                            {food.name}
                          </Text>
                          <View style={[
                            styles.sourceBadge,
                            { backgroundColor: food.source === 'custom' ? '#22c55e20' : food.source === 'openfoodfacts' ? '#3b82f620' : '#f59e0b20' },
                          ]}>
                            <Text style={[
                              styles.sourceBadgeText,
                              { color: food.source === 'custom' ? '#22c55e' : food.source === 'openfoodfacts' ? '#3b82f6' : '#f59e0b' },
                            ]}>
                              {food.source === 'custom' ? 'Custom' : food.source === 'openfoodfacts' ? 'USDA' : 'Recent'}
                            </Text>
                          </View>
                        </View>
                        {food.brand ? (
                          <Text style={[styles.suggestionBrand, { color: colors.textMuted }]} numberOfLines={1}>
                            {food.brand}
                          </Text>
                        ) : null}
                      </View>
                      <Text style={[styles.suggestionCal, { color: colors.textSecondary }]}>
                        {cal} cal
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
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
  // ── Autocomplete ──
  searchingIndicator: {
    position: 'absolute',
    right: 12,
    top: 12,
  },
  suggestionsWrap: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 4,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 8,
  },
  suggestionInfo: {
    flex: 1,
    gap: 1,
  },
  suggestionNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  suggestionName: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 14,
    lineHeight: 18,
    flexShrink: 1,
  },
  sourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  sourceBadgeText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 10,
    lineHeight: 14,
  },
  suggestionBrand: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    lineHeight: 14,
  },
  suggestionCal: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
    lineHeight: 16,
  },
});
