import React, { useState, useMemo, useCallback, useEffect, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  Dimensions,
  InteractionManager,
} from 'react-native';
import { Calendar, X } from 'lucide-react-native';
import { useZealTheme } from '@/context/AppContext';
import { useWorkoutTracking } from '@/context/WorkoutTrackingContext';
import WheelPicker from '@/components/WheelPicker';

const WORKOUT_STYLES = ['Strength', 'Bodybuilding', 'CrossFit', 'Hyrox', 'Cardio', 'HIIT', 'Mobility', 'Pilates'];
const MUSCLE_GROUPS = ['Chest', 'Lats', 'Back', 'Traps', 'Shoulders', 'Rear Delts', 'Biceps', 'Triceps', 'Forearms', 'Core', 'Quads', 'Hamstrings', 'Glutes', 'Calves'];

const DURATION_VALUES = Array.from({ length: 60 }, (_, i) => (i + 1) * 5);
const CALORIES_VALUES = Array.from({ length: 301 }, (_, i) => i * 10);

const SCREEN_W = Dimensions.get('window').width;
const WHEEL_W = Math.floor((SCREEN_W - 44 - 44 - 12) / 2);

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const LogPreviousWheels = memo(function LogPreviousWheels({
  duration,
  setDuration,
  calories,
  setCalories,
  wheelBg,
  wheelText,
  wheelMuted,
  colors,
  durationFormatValue,
  caloriesFormatValue,
}: {
  duration: number;
  setDuration: (n: number) => void;
  calories: number;
  setCalories: (n: number) => void;
  wheelBg: string;
  wheelText: string;
  wheelMuted: string;
  colors: { border: string; textSecondary: string; textMuted: string };
  durationFormatValue: (v: number) => string;
  caloriesFormatValue: (v: number) => string;
}) {
  return (
    <View style={styles.wheelRow}>
      <View style={styles.wheelBlock}>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>DURATION</Text>
        <View style={[styles.wheelCard, { backgroundColor: wheelBg, borderColor: colors.border }]}>
          <WheelPicker
            values={DURATION_VALUES}
            selectedValue={duration}
            onValueChange={setDuration}
            width={WHEEL_W}
            visibleItems={5}
            textColor={wheelText}
            mutedColor={wheelMuted}
            accentColor="#f87116"
            bgColor={wheelBg}
            formatValue={durationFormatValue}
          />
        </View>
        <Text style={[styles.wheelUnit, { color: colors.textMuted }]}>minutes</Text>
      </View>

      <View style={[styles.wheelDivider, { backgroundColor: colors.border }]} />

      <View style={styles.wheelBlock}>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>CALORIES</Text>
        <View style={[styles.wheelCard, { backgroundColor: wheelBg, borderColor: colors.border }]}>
          <WheelPicker
            values={CALORIES_VALUES}
            selectedValue={calories}
            onValueChange={setCalories}
            width={WHEEL_W}
            visibleItems={5}
            textColor={wheelText}
            mutedColor={wheelMuted}
            accentColor="#f87116"
            bgColor={wheelBg}
            formatValue={caloriesFormatValue}
          />
        </View>
        <Text style={[styles.wheelUnit, { color: colors.textMuted }]}>kcal · 0 = skip</Text>
      </View>
    </View>
  );
});

export default function LogPreviousWorkout() {
  const { colors, isDark } = useZealTheme();
  const tracking = useWorkoutTracking();

  const [date, setDate] = useState<string>(getTodayStr());
  const [style, setStyle] = useState<string>('Strength');
  const [duration, setDuration] = useState<number>(45);
  const [calories, setCalories] = useState<number>(0);
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);

  const wheelBg = isDark ? '#1e1e1e' : '#ebebeb';
  const wheelText = isDark ? '#ffffff' : '#111111';
  const wheelMuted = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';

  const durationFormatValue = useMemo(() => (v: number) => `${v}m`, []);
  const caloriesFormatValue = useMemo(() => (v: number) => v === 0 ? '—' : `${v}`, []);

  useEffect(() => {
    if (!tracking.logPreviousVisible) return;
    const task = InteractionManager.runAfterInteractions(() => {
      // Heavy work after sheet slide; reserved for future prefetch.
    });
    return () => task.cancel();
  }, [tracking.logPreviousVisible]);

  const handleSave = useCallback(() => {
    requestAnimationFrame(() => {
      tracking.logPreviousWorkout({
        date,
        style,
        duration,
        calories: calories > 0 ? calories : undefined,
        muscleGroups: selectedMuscles,
      });
      tracking.setLogPreviousVisible(false);
      setDate(getTodayStr());
      setStyle('Strength');
      setDuration(45);
      setCalories(0);
      setSelectedMuscles([]);
    });
  }, [tracking, date, style, duration, calories, selectedMuscles]);

  const toggleMuscle = useCallback((m: string) => {
    setSelectedMuscles(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  }, []);

  const closeModal = useCallback(() => {
    requestAnimationFrame(() => tracking.setLogPreviousVisible(false));
  }, [tracking]);

  if (!tracking.logPreviousVisible) return null;

  const inputBg = isDark ? '#1e1e1e' : '#f0f0f0';

  return (
    <Modal
      visible={tracking.logPreviousVisible}
      transparent
      animationType="slide"
      onRequestClose={closeModal}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: colors.text }]}>Log Previous Workout</Text>
            <TouchableOpacity onPress={closeModal} activeOpacity={0.7}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <TouchableOpacity style={[styles.dateField, { backgroundColor: inputBg }]} activeOpacity={0.7}>
              <Calendar size={16} color={colors.textSecondary} />
              <TextInput
                style={[styles.dateInput, { color: colors.text }]}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
              />
            </TouchableOpacity>

            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>WORKOUT STYLE</Text>
            <View style={styles.chipsWrap}>
              {WORKOUT_STYLES.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.chip,
                    { borderColor: style === s ? '#f87116' : colors.border },
                    style === s && { backgroundColor: '#f8711620' },
                  ]}
                  onPress={() => setStyle(s)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, { color: style === s ? '#f87116' : colors.text }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <LogPreviousWheels
              duration={duration}
              setDuration={setDuration}
              calories={calories}
              setCalories={setCalories}
              wheelBg={wheelBg}
              wheelText={wheelText}
              wheelMuted={wheelMuted}
              colors={colors}
              durationFormatValue={durationFormatValue}
              caloriesFormatValue={caloriesFormatValue}
            />

            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>MUSCLE GROUPS</Text>
            <View style={styles.chipsWrap}>
              {MUSCLE_GROUPS.map(m => (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.chip,
                    { borderColor: selectedMuscles.includes(m) ? '#f87116' : colors.border },
                    selectedMuscles.includes(m) && { backgroundColor: '#f8711620' },
                  ]}
                  onPress={() => toggleMuscle(m)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, { color: selectedMuscles.includes(m) ? '#f87116' : colors.text }]}>
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.7}>
              <Text style={styles.saveBtnText}>Save Workout Log</Text>
            </TouchableOpacity>

            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 22,
    paddingBottom: 34,
    maxHeight: '92%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.3,
  },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 18,
  },
  dateInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500' as const,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  wheelRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 0,
    marginBottom: 18,
  },
  wheelBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  wheelDivider: {
    width: 1,
    height: 80,
    alignSelf: 'center',
    marginHorizontal: 8,
    opacity: 0.3,
  },
  wheelCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  wheelUnit: {
    fontSize: 10,
    fontWeight: '500' as const,
    letterSpacing: 0.3,
  },
  saveBtn: {
    backgroundColor: '#f87116',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
});
