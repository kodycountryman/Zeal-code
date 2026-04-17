import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Pressable,
  Platform,
  Dimensions,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import BaseDrawer from '@/components/drawers/BaseDrawer';
import DrawerHeader from '@/components/drawers/DrawerHeader';
import Chip from '@/components/Chip';
import Button from '@/components/Button';
import WheelPicker from '@/components/WheelPicker';
import { useZealTheme } from '@/context/AppContext';
import { useWorkoutTracking } from '@/context/WorkoutTrackingContext';
import { useRun } from '@/context/RunContext';
import { WORKOUT_STYLE_KEYS, MUSCLE_GROUPS } from '@/constants/workoutStyles';
import { METERS_PER_MILE, METERS_PER_KM } from '@/types/run';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Mode = 'simple' | 'advanced';

const DURATION_VALUES = Array.from({ length: 60 }, (_, i) => (i + 1) * 5); // 5–300 min, 5-min step
const RPE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** YYYY-MM-DD for a given Date. Uses local time so "today" matches the user's clock. */
function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Human-friendly label for the date pill — "Today" / "Yesterday" / "Mar 12". */
function formatDateChip(d: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - t.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function parseNumberOrUndef(s: string): number | undefined {
  if (s.trim() === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/**
 * Manual retroactive workout logger. Two modes:
 *   - Simple: date/style/duration/muscles/RPE (5 required fields)
 *   - Advanced: + HR avg/max, distance, calories, start/end time, notes
 *
 * Mode toggle is non-destructive — Advanced values persist when flipping to
 * Simple and back so a user can inspect the shorter form without losing work.
 * All persistence flows through `tracking.logPreviousWorkout()` which mirrors
 * the live-workout save pipeline (streak, weekly hours, AsyncStorage).
 */
export default function LogPreviousWorkoutDrawer({ visible, onClose }: Props) {
  const { colors, accent } = useZealTheme();
  const tracking = useWorkoutTracking();
  const run = useRun();

  const [mode, setMode] = useState<Mode>('simple');

  // Core (Simple + Advanced)
  const [date, setDate] = useState<Date>(() => new Date());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [style, setStyle] = useState<string | null>(null);
  const [durationMin, setDurationMin] = useState<number>(45);
  const [muscles, setMuscles] = useState<string[]>([]);
  const [rpe, setRpe] = useState<number | null>(null);

  // Advanced-only
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [startPickerOpen, setStartPickerOpen] = useState(false);
  const [endPickerOpen, setEndPickerOpen] = useState(false);
  const [distanceStr, setDistanceStr] = useState('');
  const [caloriesStr, setCaloriesStr] = useState('');
  const [avgHrStr, setAvgHrStr] = useState('');
  const [maxHrStr, setMaxHrStr] = useState('');
  const [notes, setNotes] = useState('');

  // Reset form whenever the drawer closes so a subsequent open is fresh.
  useEffect(() => {
    if (!visible) {
      setMode('simple');
      setDate(new Date());
      setStyle(null);
      setDurationMin(45);
      setMuscles([]);
      setRpe(null);
      setStartTime(null);
      setEndTime(null);
      setDistanceStr('');
      setCaloriesStr('');
      setAvgHrStr('');
      setMaxHrStr('');
      setNotes('');
    }
  }, [visible]);

  const toggleMuscle = useCallback((m: string) => {
    setMuscles((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }, []);

  const distanceUnit: 'mi' | 'km' = run.preferences.units === 'metric' ? 'km' : 'mi';
  const metersPerUnit = distanceUnit === 'km' ? METERS_PER_KM : METERS_PER_MILE;

  // Save button is enabled only when the Simple required set is satisfied.
  // Advanced fields are always optional, so flipping modes doesn't change this.
  const canSave = useMemo(() => {
    if (!style) return false;
    if (durationMin <= 0) return false;
    if (muscles.length === 0) return false;
    if (rpe === null) return false;
    return true;
  }, [style, durationMin, muscles, rpe]);

  const handleSave = useCallback(() => {
    if (!canSave || style === null || rpe === null) return;

    // Combine the chosen log date (YYYY-MM-DD) with any picked start/end
    // times so ISO strings have the correct day. We use getHours/minutes
    // from the time picker and apply them onto the chosen date.
    const buildIso = (t: Date | null): string | undefined => {
      if (!t) return undefined;
      const combined = new Date(date);
      combined.setHours(t.getHours(), t.getMinutes(), 0, 0);
      return combined.toISOString();
    };

    // Distance: form shows user's preferred unit; we persist meters so future
    // analytics don't have to reconcile units across RunLog and WorkoutLog.
    const distanceVal = parseNumberOrUndef(distanceStr);
    const distanceMeters = distanceVal !== undefined ? distanceVal * metersPerUnit : undefined;

    tracking.logPreviousWorkout({
      date: toYmd(date),
      style,
      duration: durationMin,
      muscleGroups: muscles,
      rpe,
      calories: parseNumberOrUndef(caloriesStr),
      startTime: buildIso(startTime),
      endTime: buildIso(endTime),
      averageHeartRate: parseNumberOrUndef(avgHrStr),
      maxHeartRate: parseNumberOrUndef(maxHrStr),
      distanceMeters,
      notes: notes.trim() || undefined,
    });

    onClose();
  }, [
    canSave, date, style, durationMin, muscles, rpe, distanceStr, metersPerUnit,
    caloriesStr, startTime, endTime, avgHrStr, maxHrStr, notes, tracking, onClose,
  ]);

  const cardBg = colors.cardSecondary;
  const cardBorder = colors.border;

  const header = <DrawerHeader title="Log Previous Workout" onClose={onClose} />;

  const footer = (
    <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
      <Button
        label="Save Workout"
        variant="primary"
        size="lg"
        fullWidth
        onPress={handleSave}
        disabled={!canSave}
        testID="log-previous-save-button"
      />
    </View>
  );

  return (
    <BaseDrawer visible={visible} onClose={onClose} header={header} footer={footer} hasTextInput>
      <View style={styles.content}>
        {/* Mode toggle — Simple default, Advanced reveals wearable-backfill fields */}
        <View style={[styles.segmentControl, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          {(['simple', 'advanced'] as const).map((m) => {
            const selected = mode === m;
            return (
              <TouchableOpacity
                key={m}
                onPress={() => setMode(m)}
                activeOpacity={0.8}
                style={[styles.segmentButton, selected && { backgroundColor: accent }]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.segmentButtonText, { color: selected ? '#fff' : colors.text }]}>
                  {m === 'simple' ? 'Simple' : 'Advanced'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Date */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Date</Text>
          <TouchableOpacity
            style={[styles.pill, { backgroundColor: cardBg, borderColor: cardBorder }]}
            onPress={() => setDatePickerOpen(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Workout date: ${formatDateChip(date)}`}
          >
            <Text style={[styles.pillText, { color: colors.text }]}>{formatDateChip(date)}</Text>
          </TouchableOpacity>
        </View>

        {/* Style (single-select) */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Style</Text>
          <View style={styles.chipGrid}>
            {WORKOUT_STYLE_KEYS.map((s) => (
              <Chip
                key={s}
                label={s}
                variant="selectable"
                selected={style === s}
                onPress={() => setStyle(s)}
              />
            ))}
          </View>
        </View>

        {/* Duration */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Duration</Text>
          <View style={[styles.wheelWrap, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <WheelPicker
              values={DURATION_VALUES}
              selectedValue={durationMin}
              onValueChange={setDurationMin}
              suffix=" min"
              textColor={colors.text}
              bgColor={cardBg}
            />
          </View>
        </View>

        {/* Muscles (multi-select) */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Muscles Trained</Text>
          <View style={styles.chipGrid}>
            {MUSCLE_GROUPS.map((m) => (
              <Chip
                key={m}
                label={m}
                variant="selectable"
                selected={muscles.includes(m)}
                onPress={() => toggleMuscle(m)}
              />
            ))}
          </View>
        </View>

        {/* RPE — always visible (Simple + Advanced) */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Effort (RPE)</Text>
          <View style={styles.chipGrid}>
            {RPE_VALUES.map((v) => (
              <Chip
                key={v}
                label={String(v)}
                variant="selectable"
                selected={rpe === v}
                onPress={() => setRpe(v)}
              />
            ))}
          </View>
        </View>

        {/* Advanced-only fields */}
        {mode === 'advanced' && (
          <>
            {/* Start / End time */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Start / End Time</Text>
              <View style={styles.timeRow}>
                <TouchableOpacity
                  style={[styles.pill, styles.timePill, { backgroundColor: cardBg, borderColor: cardBorder }]}
                  onPress={() => setStartPickerOpen(true)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.pillLabel, { color: colors.textMuted }]}>Start</Text>
                  <Text style={[styles.pillText, { color: startTime ? colors.text : colors.textMuted }]}>
                    {startTime ? formatTime(startTime) : '—'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pill, styles.timePill, { backgroundColor: cardBg, borderColor: cardBorder }]}
                  onPress={() => setEndPickerOpen(true)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.pillLabel, { color: colors.textMuted }]}>End</Text>
                  <Text style={[styles.pillText, { color: endTime ? colors.text : colors.textMuted }]}>
                    {endTime ? formatTime(endTime) : '—'}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.hint, { color: colors.textMuted }]}>
                Optional — Duration is the canonical value; times are informational.
              </Text>
            </View>

            {/* Distance */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Distance</Text>
              <View style={[styles.inputRow, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={distanceStr}
                  onChangeText={setDistanceStr}
                  placeholder="0.0"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                />
                <Text style={[styles.inputSuffix, { color: colors.textMuted }]}>{distanceUnit}</Text>
              </View>
            </View>

            {/* Calories */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Calories</Text>
              <View style={[styles.inputRow, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={caloriesStr}
                  onChangeText={setCaloriesStr}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                />
                <Text style={[styles.inputSuffix, { color: colors.textMuted }]}>kcal</Text>
              </View>
            </View>

            {/* HR row */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Heart Rate</Text>
              <View style={styles.timeRow}>
                <View style={[styles.inputRow, styles.hrInput, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                  <Text style={[styles.inputPrefix, { color: colors.textMuted }]}>Avg</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={avgHrStr}
                    onChangeText={setAvgHrStr}
                    placeholder="—"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                  />
                  <Text style={[styles.inputSuffix, { color: colors.textMuted }]}>bpm</Text>
                </View>
                <View style={[styles.inputRow, styles.hrInput, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                  <Text style={[styles.inputPrefix, { color: colors.textMuted }]}>Max</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={maxHrStr}
                    onChangeText={setMaxHrStr}
                    placeholder="—"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                  />
                  <Text style={[styles.inputSuffix, { color: colors.textMuted }]}>bpm</Text>
                </View>
              </View>
            </View>

            {/* Notes */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Notes</Text>
              <TextInput
                style={[styles.notesInput, { backgroundColor: cardBg, borderColor: cardBorder, color: colors.text }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="How did it feel?"
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </>
        )}

        <View style={{ height: 32 }} />
      </View>

      {/* Date picker (iOS modal, Android native dialog) */}
      {Platform.OS === 'ios' && (
        <Modal transparent animationType="fade" visible={datePickerOpen} onRequestClose={() => setDatePickerOpen(false)}>
          <Pressable style={styles.pickerBackdrop} onPress={() => setDatePickerOpen(false)}>
            <Pressable style={[styles.pickerSheet, { backgroundColor: colors.card }]} onPress={() => {}}>
              <View style={styles.pickerHeader}>
                <Text style={[styles.pickerTitle, { color: colors.text }]}>Workout Date</Text>
                <TouchableOpacity onPress={() => setDatePickerOpen(false)} activeOpacity={0.7}>
                  <Text style={[styles.pickerDone, { color: accent }]}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={date}
                mode="date"
                display="inline"
                maximumDate={new Date()}
                onChange={(_, d) => { if (d) setDate(d); }}
                accentColor={accent}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}
      {Platform.OS === 'android' && datePickerOpen && (
        <DateTimePicker
          value={date}
          mode="date"
          display="calendar"
          maximumDate={new Date()}
          onChange={(_, d) => {
            setDatePickerOpen(false);
            if (d) setDate(d);
          }}
        />
      )}

      {/* Start-time picker */}
      {Platform.OS === 'ios' && (
        <Modal transparent animationType="fade" visible={startPickerOpen} onRequestClose={() => setStartPickerOpen(false)}>
          <Pressable style={styles.pickerBackdrop} onPress={() => setStartPickerOpen(false)}>
            <Pressable style={[styles.pickerSheet, { backgroundColor: colors.card }]} onPress={() => {}}>
              <View style={styles.pickerHeader}>
                <Text style={[styles.pickerTitle, { color: colors.text }]}>Start Time</Text>
                <TouchableOpacity onPress={() => setStartPickerOpen(false)} activeOpacity={0.7}>
                  <Text style={[styles.pickerDone, { color: accent }]}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={startTime ?? new Date()}
                mode="time"
                display="spinner"
                onChange={(_, d) => { if (d) setStartTime(d); }}
                accentColor={accent}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}
      {Platform.OS === 'android' && startPickerOpen && (
        <DateTimePicker
          value={startTime ?? new Date()}
          mode="time"
          display="clock"
          onChange={(_, d) => {
            setStartPickerOpen(false);
            if (d) setStartTime(d);
          }}
        />
      )}

      {/* End-time picker */}
      {Platform.OS === 'ios' && (
        <Modal transparent animationType="fade" visible={endPickerOpen} onRequestClose={() => setEndPickerOpen(false)}>
          <Pressable style={styles.pickerBackdrop} onPress={() => setEndPickerOpen(false)}>
            <Pressable style={[styles.pickerSheet, { backgroundColor: colors.card }]} onPress={() => {}}>
              <View style={styles.pickerHeader}>
                <Text style={[styles.pickerTitle, { color: colors.text }]}>End Time</Text>
                <TouchableOpacity onPress={() => setEndPickerOpen(false)} activeOpacity={0.7}>
                  <Text style={[styles.pickerDone, { color: accent }]}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={endTime ?? new Date()}
                mode="time"
                display="spinner"
                onChange={(_, d) => { if (d) setEndTime(d); }}
                accentColor={accent}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}
      {Platform.OS === 'android' && endPickerOpen && (
        <DateTimePicker
          value={endTime ?? new Date()}
          mode="time"
          display="clock"
          onChange={(_, d) => {
            setEndPickerOpen(false);
            if (d) setEndTime(d);
          }}
        />
      )}
    </BaseDrawer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 4,
    gap: 18,
  },
  segmentControl: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonText: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.2,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  pillLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  pillText: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
  },
  wheelWrap: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  timePill: {
    flex: 1,
    alignSelf: 'stretch',
    paddingVertical: 10,
  },
  hint: {
    fontSize: 11,
    fontFamily: 'Outfit_400Regular',
    lineHeight: 15,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  hrInput: {
    flex: 1,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
    padding: 0,
  },
  inputPrefix: {
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.3,
  },
  inputSuffix: {
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
    letterSpacing: 0.3,
  },
  notesInput: {
    minHeight: 96,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: 'Outfit_400Regular',
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  // Modal date/time picker — mirrors AboutMeDrawer's pattern.
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  pickerTitle: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
  pickerDone: {
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
  },
});
