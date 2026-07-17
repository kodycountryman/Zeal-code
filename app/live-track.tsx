/**
 * Live Track — freestyle workout logging screen.
 *
 * The user builds their workout as they go at the gym: add exercises,
 * log sets with weight/reps, use the rest timer, then finish. Saving
 * goes through the standard WorkoutTrackingContext pipeline so PRs,
 * muscle readiness, training score and health sync all work identically
 * to planned workouts.
 *
 * Architecture:
 *   - startWorkout(emptyShell) on mount initialises the tracking context.
 *   - addExerciseToActiveWorkout + initExerciseLog wires each new exercise in.
 *   - updateSetLog / markSetDone / addSet / removeSet drive per-set state.
 *   - beginPostWorkout() on Finish → saves log → navigate back → PostWorkoutSheet
 *     shows on the Workout tab (exactly the same as a planned session).
 *   - resetWorkout() on Discard cleans the context cleanly.
 */
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  cancelAnimation,
  runOnJS,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useZealTheme } from '@/context/AppContext';
import { useWorkoutTracking } from '@/context/WorkoutTrackingContext';
import { PlatformIcon } from '@/components/PlatformIcon';
import WheelPicker from '@/components/WheelPicker';
import RestTimerBar from '@/components/RestTimerBar';
import ExercisePicker from '@/components/live-track/ExercisePicker';
import type { WorkoutExercise, GeneratedWorkout } from '@/services/workoutEngine';
import { saveTemplate } from '@/services/workoutTemplateService';
import { SWIFT_REANIMATED_SPRING } from '@/constants/animation';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function defaultTitle(): string {
  const now = new Date();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hour = now.getHours();
  const period = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
  return `${days[now.getDay()]} ${period} Workout`;
}

// Empty GeneratedWorkout shell — the workout engine shape is reused as-is
// so all downstream context code (PR tracking, muscle readiness, etc.) works.
function makeShell(title: string): GeneratedWorkout {
  return {
    warmup: [],
    workout: [],
    cardio: [],
    cooldown: [],
    recovery: [],
    estimatedDuration: 60,
    style: 'Freestyle',
    split: title,
    metconFormat: null,
    metconTimeCap: null,
    metconRounds: null,
  };
}

// ─── Set-logging constants ────────────────────────────────────────────────────

const CHIP_H = 44;
const PICKER_H = 132; // CHIP_H * 3 — expanded wheel height
const CHIP_SPRING = { damping: 22, stiffness: 280, mass: 0.8 } as const;
/** 0, 5, 10, … 1000 lb */
const WEIGHT_VALUES = Array.from({ length: 201 }, (_, i) => i * 5);
/** 1 – 50 reps */
const REPS_VALUES = Array.from({ length: 50 }, (_, i) => i + 1);

// ─── CollapsedChip ────────────────────────────────────────────────────────────
// Handles both tap-to-expand and swipe-to-change without a FlatList.
// Using a FlatList (WheelPicker) for every collapsed chip caused the app to
// freeze on modal dismiss due to simultaneous FlatList cleanup.

function findNearestIndex(values: readonly number[], target: number): number {
  let best = 0;
  let bestDist = Math.abs(values[0] - target);
  for (let i = 1; i < values.length; i++) {
    const d = Math.abs(values[i] - target);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

type CollapsedChipProps = {
  value: number;
  values: readonly number[];
  onValueChange: (v: number) => void;
  onTap: () => void;
  interactive: boolean;
  flex: number;
  chipBg: string;
  borderColor: string;
  textColor: string;
  mutedColor: string;
};

function CollapsedChip({
  value, values, onValueChange, onTap, interactive,
  flex, chipBg, borderColor, textColor, mutedColor,
}: CollapsedChipProps) {
  const startYRef = useRef(0);
  const startIdxRef = useRef(0);
  const hasSwiped = useRef(false);

  return (
    <View
      style={{ flex }}
      onStartShouldSetResponder={() => interactive}
      onMoveShouldSetResponder={() => interactive}
      onResponderTerminationRequest={() => false}
      onResponderGrant={e => {
        startYRef.current = e.nativeEvent.pageY;
        startIdxRef.current = findNearestIndex(values, value);
        hasSwiped.current = false;
      }}
      onResponderMove={e => {
        const dy = startYRef.current - e.nativeEvent.pageY;
        if (Math.abs(dy) >= 6) {
          hasSwiped.current = true;
          const delta = Math.round(dy / CHIP_H);
          const newIdx = Math.max(0, Math.min(startIdxRef.current + delta, values.length - 1));
          onValueChange(values[newIdx] as number);
        }
      }}
      onResponderRelease={() => {
        if (!hasSwiped.current) onTap();
      }}
    >
      <View style={{
        borderRadius: 12, borderWidth: 1,
        borderColor,
        backgroundColor: chipBg,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        height: CHIP_H,
      }}>
        <Text style={{
          fontSize: 20, fontFamily: 'Outfit_800ExtraBold',
          color: interactive ? textColor : `${textColor}50`,
        }}>
          {value}
        </Text>
        {interactive && (
          <PlatformIcon name="chevron-down" size={12} color={`${mutedColor}50`}
            style={{ position: 'absolute', right: 5, bottom: 3 }} />
        )}
      </View>
    </View>
  );
}

// ─── SetCheckmarkCircle ───────────────────────────────────────────────────────

type SetCheckmarkCircleProps = {
  done: boolean;
  accent: string;
  borderColor: string;
  onPress: () => void;
  isNextUp?: boolean;
};
function SetCheckmarkCircle({ done, accent, borderColor, onPress, isNextUp }: SetCheckmarkCircleProps) {
  const scale = useSharedValue(done ? 1 : 0);
  useEffect(() => {
    if (done) {
      cancelAnimation(scale);
      scale.value = 0.5;
      scale.value = withSpring(1, SWIFT_REANIMATED_SPRING);
    } else {
      cancelAnimation(scale);
      scale.value = 0;
    }
  }, [done]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      activeOpacity={0.8}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', width: 76, height: 48, gap: 2 }}
    >
      {isNextUp && !done ? (
        <Text style={{ fontSize: 12, fontFamily: 'Outfit_600SemiBold', color: accent, letterSpacing: 0.2, marginRight: 2 }}>Log</Text>
      ) : (
        <View style={{ width: 1 }} />
      )}
      <View style={{
        width: 32, height: 32, borderRadius: 16,
        borderWidth: done ? 0 : 2,
        borderColor: isNextUp && !done ? accent : borderColor,
        backgroundColor: done ? accent : 'transparent',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Animated.View style={iconStyle}>
          <PlatformIcon name="check" size={18} color="#fff" strokeWidth={3} />
        </Animated.View>
      </View>
    </TouchableOpacity>
  );
}

// ─── SetRowPressable ──────────────────────────────────────────────────────────

type SetRowPressableProps = {
  done: boolean;
  flashColor: string;
  onPress: () => void;
  disabled?: boolean;
  style?: any;
  children: React.ReactNode;
};
function SetRowPressable({ done, flashColor, onPress, disabled, style, children }: SetRowPressableProps) {
  const flashOpacity = useSharedValue(0);
  const prevDoneRef = useRef(done);
  useEffect(() => {
    if (done && !prevDoneRef.current) {
      cancelAnimation(flashOpacity);
      flashOpacity.value = 0.12;
      flashOpacity.value = withTiming(0, { duration: 300 });
    }
    prevDoneRef.current = done;
  }, [done]);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flashOpacity.value }));
  return (
    <Pressable onPress={onPress} disabled={disabled} style={style}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: flashColor }, flashStyle]} pointerEvents="none" />
      {children}
    </Pressable>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LiveTrackScreen() {
  const { colors, accent, isDark } = useZealTheme();
  const router = useRouter();
  const tracking = useWorkoutTracking();

  const [title, setTitle] = useState(defaultTitle);
  const [editingTitle, setEditingTitle] = useState(false);
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [activeEditCell, setActiveEditCell] = useState<{
    exId: string; setIdx: number; field: 'weight' | 'reps';
  } | null>(null);

  // Chip expand animation — shared across all set rows (only one open at a time)
  const chipExpandHeight = useSharedValue(CHIP_H);
  const chipExpandStyle = useAnimatedStyle(() => ({
    height: chipExpandHeight.value,
    overflow: 'hidden' as const,
  }));

  const openChip = useCallback((cell: { exId: string; setIdx: number; field: 'weight' | 'reps' }) => {
    chipExpandHeight.value = CHIP_H; // instant reset before React commits new chip
    setActiveEditCell(cell);
    // spring fires from useEffect after React commits — prevents old chip expanding
  }, [chipExpandHeight]);

  // Deferred expand: fires after React has swapped which chip renders as expanded
  useEffect(() => {
    if (activeEditCell) {
      chipExpandHeight.value = withSpring(PICKER_H, CHIP_SPRING);
    }
  }, [activeEditCell]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeChip = useCallback(() => {
    chipExpandHeight.value = withSpring(CHIP_H, CHIP_SPRING, (finished) => {
      if (finished) runOnJS(setActiveEditCell)(null);
    });
  }, [chipExpandHeight]);

  const titleInputRef = useRef<TextInput>(null);
  const hasStartedRef = useRef(false);
  const lastActivityRef = useRef(Date.now());
  const inactivityAlertShownRef = useRef(false);

  // Total completed sets across all exercises — shown in header subtitle
  const completedSetsCount = useMemo(() =>
    Object.values(tracking.exerciseLogs).reduce(
      (sum, log) => sum + log.sets.filter(s => s.done).length,
      0,
    ),
  [tracking.exerciseLogs]);

  // ── Boot: start OR resume the workout context ─────────────────────────────
  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    // If a Freestyle session is already active (user minimized and returned),
    // re-hydrate local state from context rather than starting a new session.
    if (tracking.isWorkoutActive && tracking.activeWorkout?.style === 'Freestyle') {
      setTitle(tracking.activeWorkout.split ?? defaultTitle());
      setExercises(tracking.activeWorkout.workout);
      return;
    }

    tracking.startWorkout(makeShell(title));
  // run once on mount only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Elapsed timer (reads workoutElapsedRef every second) ──────────────────
  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor(tracking.workoutElapsedRef.current));
    }, 1000);
    return () => clearInterval(id);
  }, [tracking.workoutElapsedRef]);

  // ── Inactivity warning — fires once if no set is logged for 45 min ────────
  useEffect(() => {
    if (exercises.length === 0) return;
    const INACTIVITY_MS = 45 * 60 * 1000;
    const id = setInterval(() => {
      if (
        !inactivityAlertShownRef.current &&
        Date.now() - lastActivityRef.current > INACTIVITY_MS
      ) {
        inactivityAlertShownRef.current = true;
        Alert.alert(
          'Still working out?',
          'Your Live Track session has been inactive for 45 minutes.',
          [
            {
              text: 'Keep Going',
              style: 'cancel',
              onPress: () => {
                lastActivityRef.current = Date.now();
                inactivityAlertShownRef.current = false;
              },
            },
            {
              text: 'Finish & Save',
              onPress: () => {
                tracking.beginPostWorkout();
                router.back();
              },
            },
            {
              text: 'Discard',
              style: 'destructive',
              onPress: () => {
                tracking.resetWorkout();
                router.back();
              },
            },
          ],
        );
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [exercises.length, tracking, router]);

  // ── Sync title to context so the saved log uses the right name ────────────
  const commitTitle = useCallback((text: string) => {
    const trimmed = text.trim() || defaultTitle();
    setTitle(trimmed);
    tracking.setActiveWorkoutName(trimmed);
    setEditingTitle(false);
  }, [tracking]);

  // ── Add exercise ──────────────────────────────────────────────────────────
  const handleAddExercise = useCallback((exercise: WorkoutExercise) => {
    setExercises(prev => [...prev, exercise]);
    tracking.addExerciseToActiveWorkout(exercise);
    tracking.initExerciseLog(exercise);
  }, [tracking]);

  // ── Load all exercises from a template at once ────────────────────────────
  const handleLoadTemplate = useCallback((templateExercises: WorkoutExercise[]) => {
    for (const exercise of templateExercises) {
      tracking.addExerciseToActiveWorkout(exercise);
      tracking.initExerciseLog(exercise);
    }
    setExercises(prev => [...prev, ...templateExercises]);
  }, [tracking]);

  // ── Finish ────────────────────────────────────────────────────────────────
  const handleFinish = useCallback(() => {
    if (exercises.length === 0) {
      Alert.alert('Nothing logged', 'Add at least one exercise before finishing.', [{ text: 'OK' }]);
      return;
    }

    const doFinish = () => {
      tracking.beginPostWorkout();
      // PostWorkoutSheet is a BottomSheetModal portal at root level —
      // it floats above whatever screen is active after we dismiss.
      router.back();
    };

    const doDiscard = () => {
      tracking.resetWorkout();
      router.back();
    };

    Alert.alert(
      'Finish Workout?',
      'Your session will be saved and you can rate it.',
      [
        { text: 'Keep Going', style: 'cancel' },
        {
          text: 'Save as Template',
          style: 'default',
          onPress: () => {
            Alert.prompt(
              'Save Template',
              'Name this template so you can reload it next time.',
              [
                { text: 'Cancel', style: 'cancel', onPress: doFinish },
                {
                  text: 'Save',
                  onPress: (name?: string) => {
                    const templateName = (name ?? '').trim() || title;
                    void saveTemplate(templateName, exercises);
                    doFinish();
                  },
                },
              ],
              'plain-text',
              title,
            );
          },
        },
        {
          text: 'Finish',
          style: 'default',
          onPress: doFinish,
        },
        {
          text: 'Discard Workout',
          style: 'destructive',
          onPress: doDiscard,
        },
      ],
    );
  }, [exercises, title, tracking, router]);

  // ── Minimize (dismiss modal, session stays alive) ─────────────────────────
  const handleMinimize = useCallback(() => {
    router.back();
  }, [router]);

  // ── Per-exercise helpers ──────────────────────────────────────────────────
  const handleMarkSet = useCallback((exerciseId: string, setIndex: number) => {
    closeChip();
    const log = tracking.exerciseLogs[exerciseId];
    if (!log) return;
    const set = log.sets[setIndex];
    if (!set) return;
    tracking.markSetDone(exerciseId, setIndex, Number(tracking.autoRestTimer) || 90);
    // Reset inactivity clock and give tactile confirmation
    lastActivityRef.current = Date.now();
    inactivityAlertShownRef.current = false;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [tracking, closeChip]);


  // ─── Render ───────────────────────────────────────────────────────────────

  const logCardBg = isDark ? 'rgba(20,20,20,0.98)' : 'rgba(0,0,0,0.04)';
  const logCardBorder = isDark ? `${colors.border}55` : `${colors.border}40`;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>

      {/* ── Header ── */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleMinimize} activeOpacity={0.7} style={styles.headerSide}>
          <PlatformIcon name="chevron-down" size={22} color={colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          {editingTitle ? (
            <TextInput
              ref={titleInputRef}
              style={[styles.titleInput, { color: colors.text, borderBottomColor: accent }]}
              value={title}
              onChangeText={setTitle}
              onBlur={() => commitTitle(title)}
              onSubmitEditing={() => commitTitle(title)}
              returnKeyType="done"
              autoFocus
              selectTextOnFocus
            />
          ) : (
            <TouchableOpacity onPress={() => setEditingTitle(true)} activeOpacity={0.7}>
              <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                {title}
              </Text>
              <Text style={[styles.headerElapsed, { color: colors.textMuted }]}>
                {formatElapsed(elapsed)}
                {completedSetsCount > 0
                  ? ` · ${completedSetsCount} set${completedSetsCount !== 1 ? 's' : ''}`
                  : ''}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          onPress={handleFinish}
          activeOpacity={0.8}
          style={[styles.finishBtn, { backgroundColor: accent }]}
        >
          <Text style={styles.finishBtnText}>Finish</Text>
        </TouchableOpacity>
      </View>

      {/* ── Rest timer (same component as workout tab) ── */}
      <RestTimerBar />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Empty state ── */}
          {exercises.length === 0 && (
            <Pressable
              style={[styles.emptyCard, { borderColor: colors.border, borderStyle: 'dashed' }]}
              onPress={() => setPickerVisible(true)}
            >
              <View style={[styles.emptyIconWrap, { backgroundColor: `${accent}18` }]}>
                <PlatformIcon name="plus" size={28} color={accent} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Add your first exercise</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                Tap here or the button below to add exercises as you go
              </Text>
            </Pressable>
          )}

          {/* ── Exercise cards ── */}
          {exercises.map((exercise, exIdx) => {
            const log = tracking.exerciseLogs[exercise.id];
            const sets = log?.sets ?? [];
            const firstUndoneIdx = sets.findIndex(s => !s.done);
            const chipBg = colors.cardSecondary;

            return (
              <View key={exercise.id} style={styles.exerciseCard}>
                {/* Exercise header */}
                <View style={[styles.exerciseHeader, { paddingHorizontal: 4, paddingBottom: 6 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.exerciseName, { color: colors.text }]}>{exercise.name}</Text>
                    <Text style={[styles.exerciseMuscle, { color: colors.textMuted }]}>
                      {exercise.muscleGroup}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert('Remove Exercise', `Remove "${exercise.name}" from this workout?`, [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Remove',
                          style: 'destructive',
                          onPress: () => setExercises(prev => prev.filter((_, i) => i !== exIdx)),
                        },
                      ]);
                    }}
                    activeOpacity={0.7}
                    hitSlop={10}
                  >
                    <PlatformIcon name="trash" size={15} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Log card — matches workout tab logSetsCard */}
                <View style={[styles.logCard, { backgroundColor: logCardBg, borderColor: logCardBorder }]}>
                  {/* Column headers */}
                  <View style={styles.setHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <Text style={[styles.setColLabel, { color: colors.textSecondary, width: 32 }]}>Set</Text>
                      <Text style={[styles.setColLabel, { color: colors.textSecondary, flex: 2, textAlign: 'center' }]}>Weight</Text>
                      <Text style={[styles.setColLabel, { color: colors.textSecondary, flex: 1, textAlign: 'center' }]}>Reps</Text>
                    </View>
                    <View style={{ width: 76 }} />
                  </View>

                  {/* Set rows */}
                  {sets.map((set, setIdx) => {
                    const isNextUp = setIdx === firstUndoneIdx;
                    const isWeightActive = activeEditCell?.exId === exercise.id && activeEditCell?.setIdx === setIdx && activeEditCell?.field === 'weight';
                    const isRepsActive = activeEditCell?.exId === exercise.id && activeEditCell?.setIdx === setIdx && activeEditCell?.field === 'reps';
                    const chipInteractive = !set.done;

                    return (
                      <SetRowPressable
                        key={setIdx}
                        done={set.done}
                        flashColor={accent}
                        onPress={() => handleMarkSet(exercise.id, setIdx)}
                        disabled={isWeightActive || isRepsActive}
                        style={[
                          styles.setRow,
                          isNextUp && !set.done && {
                            borderLeftWidth: 3,
                            borderLeftColor: accent,
                            backgroundColor: `${accent}08`,
                          },
                        ]}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8, opacity: set.done ? 0.5 : 1 }}>
                          <Text style={[styles.setNumber, { color: colors.textMuted, width: 32, textAlign: 'center', fontSize: 16, fontFamily: 'Outfit_700Bold' }]}>
                            {set.setNumber}
                          </Text>

                          {/* Weight chip */}
                          {isWeightActive && chipInteractive ? (
                            <View style={{ flex: 2 }}>
                              <Animated.View style={[{
                                borderRadius: 12, borderWidth: 1,
                                borderColor: `${accent}88`,
                                backgroundColor: chipBg,
                                alignItems: 'center' as const,
                                justifyContent: 'center' as const,
                              }, chipExpandStyle]}>
                                <WheelPicker
                                  values={WEIGHT_VALUES}
                                  selectedValue={set.weight}
                                  onValueChange={v => tracking.updateSetLog(exercise.id, setIdx, 'weight', v)}
                                  textColor={colors.text}
                                  bgColor={isDark ? '#1c1c1c' : '#f0f0f0'}
                                  visibleItems={3}
                                />
                              </Animated.View>
                            </View>
                          ) : (
                            <CollapsedChip
                              value={set.weight}
                              values={WEIGHT_VALUES}
                              onValueChange={v => tracking.updateSetLog(exercise.id, setIdx, 'weight', v)}
                              onTap={() => openChip({ exId: exercise.id, setIdx, field: 'weight' })}
                              interactive={chipInteractive}
                              flex={2}
                              chipBg={chipBg}
                              borderColor={colors.border}
                              textColor={colors.text}
                              mutedColor={colors.textMuted}
                            />
                          )}

                          {/* Reps chip */}
                          {isRepsActive && chipInteractive ? (
                            <View style={{ flex: 1 }}>
                              <Animated.View style={[{
                                borderRadius: 12, borderWidth: 1,
                                borderColor: `${accent}88`,
                                backgroundColor: chipBg,
                                alignItems: 'center' as const,
                                justifyContent: 'center' as const,
                              }, chipExpandStyle]}>
                                <WheelPicker
                                  values={REPS_VALUES}
                                  selectedValue={set.reps}
                                  onValueChange={v => tracking.updateSetLog(exercise.id, setIdx, 'reps', v)}
                                  textColor={colors.text}
                                  bgColor={isDark ? '#1c1c1c' : '#f0f0f0'}
                                  visibleItems={3}
                                />
                              </Animated.View>
                            </View>
                          ) : (
                            <CollapsedChip
                              value={set.reps}
                              values={REPS_VALUES}
                              onValueChange={v => tracking.updateSetLog(exercise.id, setIdx, 'reps', v)}
                              onTap={() => openChip({ exId: exercise.id, setIdx, field: 'reps' })}
                              interactive={chipInteractive}
                              flex={1}
                              chipBg={chipBg}
                              borderColor={colors.border}
                              textColor={colors.text}
                              mutedColor={colors.textMuted}
                            />
                          )}
                        </View>

                        <SetCheckmarkCircle
                          done={set.done}
                          accent={accent}
                          borderColor={colors.border}
                          onPress={() => handleMarkSet(exercise.id, setIdx)}
                          isNextUp={isNextUp}
                        />
                      </SetRowPressable>
                    );
                  })}

                  {/* Add Set */}
                  <View style={[styles.setActions, { justifyContent: 'center', marginTop: 8 }]}>
                    <TouchableOpacity
                      style={[styles.addSetBtn, { borderColor: colors.border }]}
                      onPress={() => { closeChip(); tracking.addSet(exercise.id); }}
                      activeOpacity={0.7}
                    >
                      <PlatformIcon name="plus" size={13} color={colors.textSecondary} />
                      <Text style={[styles.addSetText, { color: colors.textSecondary }]}>+ Add Set</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Floating Add Exercise button ── */}
      <View style={[styles.fabContainer, { paddingBottom: 16 }]} pointerEvents="box-none">
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: accent }]}
          onPress={() => setPickerVisible(true)}
          activeOpacity={0.85}
        >
          <PlatformIcon name="plus" size={18} color="#fff" />
          <Text style={styles.fabText}>Add Exercise</Text>
        </TouchableOpacity>
      </View>

      {/* ── Exercise picker ── */}
      <ExercisePicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={handleAddExercise}
        onLoadTemplate={handleLoadTemplate}
      />

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  headerSide: {
    width: 36,
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  headerElapsed: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
    textAlign: 'center',
    marginTop: 1,
    letterSpacing: 0.5,
  },
  titleInput: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.2,
    textAlign: 'center',
    borderBottomWidth: 1.5,
    paddingBottom: 2,
    minWidth: 160,
  },
  finishBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  finishBtnText: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
    color: '#fff',
    letterSpacing: 0.2,
  },
  // Scroll
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  // Empty state
  emptyCard: {
    borderWidth: 1.5,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.2,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: 'Outfit_400Regular',
    textAlign: 'center',
    lineHeight: 18,
  },
  // Exercise card
  exerciseCard: {
    gap: 8,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exerciseName: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.2,
  },
  exerciseMuscle: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
    marginTop: 1,
  },
  // Log card (matches workout tab logSetsCard)
  logCard: {
    borderRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  // Set table
  setHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 4,
    marginBottom: 2,
  },
  setColLabel: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.4,
    textAlign: 'center' as const,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 3,
  },
  setNumber: {
    width: 32,
    textAlign: 'center' as const,
  },
  setActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 0,
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  addSetText: {
    fontSize: 13,
    fontFamily: 'Outfit_600SemiBold',
  },
  // FAB
  fabContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  fabText: {
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
    color: '#fff',
  },
});
