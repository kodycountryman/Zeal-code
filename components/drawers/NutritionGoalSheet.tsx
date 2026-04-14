import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  Alert,
} from 'react-native';
import BaseDrawer from '@/components/drawers/BaseDrawer';
import DrawerHeader from '@/components/drawers/DrawerHeader';
import { useZealTheme } from '@/context/AppContext';
import { useNutrition } from '@/context/NutritionContext';

function parseNum(val: string): number {
  const n = parseFloat(val.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export default function NutritionGoalSheet() {
  const { colors, accent, isDark } = useZealTheme();
  const { goals, updateGoals, goalSetupVisible, setGoalSetupVisible } = useNutrition();

  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const [water, setWater] = useState('');

  // Sync form with current goals when opening
  useEffect(() => {
    if (goalSetupVisible) {
      setCalories(String(goals.macros.calories));
      setProtein(String(goals.macros.proteinGrams));
      setFat(String(goals.macros.fatGrams));
      setCarbs(String(goals.macros.carbsGrams));
      setWater(String(goals.waterMl));
    }
  }, [goalSetupVisible, goals]);

  const handleClose = useCallback(() => {
    setGoalSetupVisible(false);
  }, [setGoalSetupVisible]);

  const handleSave = useCallback(() => {
    Keyboard.dismiss();

    const cal = parseNum(calories);
    const pro = parseNum(protein);
    const f = parseNum(fat);
    const c = parseNum(carbs);
    const w = parseNum(water);

    if (cal <= 0) {
      Alert.alert('Invalid', 'Calories must be greater than 0.');
      return;
    }

    updateGoals({
      macros: {
        calories: Math.round(cal),
        proteinGrams: Math.round(pro),
        fatGrams: Math.round(f),
        carbsGrams: Math.round(c),
      },
      waterMl: Math.round(w),
    });

    handleClose();
  }, [calories, protein, fat, carbs, water, updateGoals, handleClose]);

  const inputStyle = useCallback(
    () => [
      styles.input,
      {
        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.cardSecondary,
        borderColor: colors.border,
        color: colors.text,
      },
    ],
    [colors, isDark],
  );

  const placeholderColor = colors.textMuted;

  return (
    <BaseDrawer
      visible={goalSetupVisible}
      onClose={handleClose}
      hasTextInput
      snapPoints={['75%']}
      header={<DrawerHeader title="Nutrition Goals" onClose={handleClose} />}
      footer={
        <View style={styles.footerWrap}>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: accent }]}
            onPress={handleSave}
            activeOpacity={0.8}
          >
            <Text style={styles.saveBtnText}>Save Goals</Text>
          </TouchableOpacity>
        </View>
      }
    >
      <View style={styles.content}>
        {/* Macro Goals */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Daily Macros</Text>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Calories</Text>
            <TextInput
              style={inputStyle()}
              value={calories}
              onChangeText={setCalories}
              placeholder="2000"
              placeholderTextColor={placeholderColor}
              keyboardType="number-pad"
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
                placeholder="150"
                placeholderTextColor={placeholderColor}
                keyboardType="number-pad"
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
                placeholder="65"
                placeholderTextColor={placeholderColor}
                keyboardType="number-pad"
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
                placeholder="250"
                placeholderTextColor={placeholderColor}
                keyboardType="number-pad"
                returnKeyType="done"
              />
            </View>
          </View>

          {/* Macro preview */}
          <View style={[styles.previewRow, { borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]}>
            <Text style={[styles.previewText, { color: colors.textMuted }]}>
              Macro calories: {Math.round(parseNum(protein) * 4 + parseNum(carbs) * 4 + parseNum(fat) * 9)}
            </Text>
          </View>
        </View>

        {/* Water Goal */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Hydration</Text>
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Daily Water Goal (ml)</Text>
            <TextInput
              style={inputStyle()}
              value={water}
              onChangeText={setWater}
              placeholder="3000"
              placeholderTextColor={placeholderColor}
              keyboardType="number-pad"
              returnKeyType="done"
            />
          </View>
        </View>
      </View>
    </BaseDrawer>
  );
}

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
  previewRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
  },
  previewText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    textAlign: 'center',
  },
  footerWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  saveBtn: {
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 17,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.2,
  },
});
