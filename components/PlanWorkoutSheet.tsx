import React, { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import {
  X, CalendarPlus, Trash2, CheckCircle, ChevronRight, AlertCircle, Clock,
  Dumbbell, RefreshCw, Plus, ArrowUp, ArrowDown, ArrowUpDown, Search,
  Repeat2,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useZealTheme, useAppContext, type PlannedWorkout, type MuscleReadinessItem } from '@/context/AppContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { WORKOUT_STYLE_COLORS, TRAINING_SPLITS } from '@/constants/colors';
import { type WorkoutExercise } from '@/services/workoutEngine';
import { generateWorkoutAsync } from '@/services/aiWorkoutGenerator';
import { getZealExerciseDatabase, type ZealExercise } from '@/mocks/exerciseDatabase';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STYLE_OPTIONS = ['Strength', 'Bodybuilding', 'CrossFit', 'HIIT', 'Cardio', 'Hyrox', 'Mobility', 'Pilates', 'Low-Impact'] as const;

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

function getTopMuscles(muscleReadiness: MuscleReadinessItem[], count: number = 3): string[] {
  return muscleReadiness
    .filter(m => m.status !== 'recovering')
    .sort((a, b) => b.value - a.value)
    .slice(0, count)
    .map(m => m.name);
}

function getConflictingSplits(plannedWorkouts: PlannedWorkout[], targetDate: string): string[] {
  const target = new Date(targetDate + 'T00:00:00');
  const conflicts: string[] = [];
  for (const pw of plannedWorkouts) {
    if (pw.date === targetDate) continue;
    const d = new Date(pw.date + 'T00:00:00');
    const diffDays = Math.abs((target.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 1) conflicts.push(pw.split);
  }
  return conflicts;
}

function generateId(): string {
  return `pw_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

function zealToWorkoutEx(ze: ZealExercise, sets: number, reps: string, rest: string): WorkoutExercise {
  return {
    id: `ws_${ze.id}_${Math.random().toString(36).substr(2, 5)}`,
    name: ze.name,
    sets,
    reps,
    rest,
    muscleGroup: ze.primary_muscles.slice(0, 2).map(m => m.replace(/_/g, ' ')).join(', '),
    equipment: (ze.equipment_required[0] ?? 'bodyweight').replace(/_/g, ' '),
    notes: '',
    type: ze.movement_pattern,
    movementType: ze.is_compound ? 'moderateCompound' : 'isolation',
    groupType: null,
    groupId: null,
    suggestedWeight: '',
    lastSessionWeight: '',
    lastSessionReps: '',
    exerciseRef: ze,
  };
}

function estimateDuration(count: number, fallback: number): number {
  if (count === 0) return fallback;
  return Math.max(15, Math.round(count * 4.5));
}

interface Props {
  visible: boolean;
  targetDate: string | null;
  onClose: () => void;
}

type Step = 'existing' | 'style' | 'split' | 'confirm' | 'workout';

export default function PlanWorkoutSheet({ visible, targetDate, onClose }: Props) {
  const { colors, accent, isDark } = useZealTheme();
  const ctx = useAppContext();
  const { hasPro } = useSubscription();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['70%', '92%'], []);
  const insets = useSafeAreaInsets();
  const topOffset = Math.max(insets.top, 0) + 16;

  const [step, setStep] = useState<Step>('style');
  const [selectedStyle, setSelectedStyle] = useState<string>('');
  const [selectedSplit, setSelectedSplit] = useState<string>('');
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const durationAnim = useRef(new Animated.Value(1)).current;

  const [genExercises, setGenExercises] = useState<WorkoutExercise[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [genSeedOffset, setGenSeedOffset] = useState<number>(0);

  const [swapTargetId, setSwapTargetId] = useState<string | null>(null);
  const [swapAlts, setSwapAlts] = useState<ZealExercise[]>([]);

  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [editSets, setEditSets] = useState<string>('');
  const [editReps, setEditReps] = useState<string>('');

  const [showAddPanel, setShowAddPanel] = useState<boolean>(false);
  const [addQuery, setAddQuery] = useState<string>('');

  const [reorderActiveId, setReorderActiveId] = useState<string | null>(null);

  const existingPlan = useMemo(() => {
    if (!targetDate) return null;
    return ctx.getPlannedWorkoutForDate(targetDate);
  }, [targetDate, ctx]);

  const conflictingSplits = useMemo(() => {
    if (!targetDate) return [];
    return getConflictingSplits(ctx.plannedWorkouts, targetDate);
  }, [targetDate, ctx.plannedWorkouts]);

  const topMuscles = useMemo(() => getTopMuscles(ctx.muscleReadiness), [ctx.muscleReadiness]);

  const splitOptions = useMemo(() => TRAINING_SPLITS[selectedStyle] ?? ['Full Body'], [selectedStyle]);

  const recommendedSplit = useMemo(() => {
    if (!splitOptions.length) return '';
    const filtered = splitOptions.filter(sp => !conflictingSplits.some(c =>
      c.toLowerCase().includes(sp.toLowerCase()) || sp.toLowerCase().includes(c.toLowerCase())
    ));
    return filtered[0] ?? splitOptions[0];
  }, [splitOptions, conflictingSplits]);

  const styleColor = WORKOUT_STYLE_COLORS[selectedStyle] ?? accent;

  const addFilteredExercises = useMemo(() => {
    if (!addQuery.trim()) return [];
    const q = addQuery.toLowerCase().trim();
    const db = getZealExerciseDatabase();
    return db.filter(z =>
      z.name.toLowerCase().includes(q) ||
      z.primary_muscles.some(m => m.replace(/_/g, ' ').includes(q))
    ).slice(0, 25);
  }, [addQuery]);

  useEffect(() => {
    if (visible && targetDate) {
      const defaultStyle = ctx.workoutStyle || 'Strength';
      setSelectedStyle(defaultStyle);
      setSelectedSplit('');
      setGenExercises([]);
      setGenSeedOffset(0);
      setSwapTargetId(null);
      setSwapAlts([]);
      setEditTargetId(null);
      setShowAddPanel(false);
      setAddQuery('');
      setReorderActiveId(null);
      setStep(existingPlan ? 'existing' : 'style');
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible, targetDate, ctx.workoutStyle, existingPlan]);

  useEffect(() => {
    if (selectedStyle && step === 'split' && !selectedSplit) {
      setSelectedSplit(recommendedSplit);
    }
  }, [step, selectedStyle, selectedSplit, recommendedSplit]);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(durationAnim, { toValue: 1.06, duration: 90, useNativeDriver: true }),
      Animated.timing(durationAnim, { toValue: 1, duration: 130, useNativeDriver: true }),
    ]).start();
  }, [genExercises.length, durationAnim]);

  const handleDismiss = useCallback(() => { onClose(); }, [onClose]);

  const transitionStep = useCallback((nextStep: Step, nextSplit?: string) => {
    Animated.timing(fadeAnim, {
      toValue: 0, duration: 100, useNativeDriver: true,
    }).start(() => {
      if (nextSplit !== undefined) setSelectedSplit(nextSplit);
      if (nextStep === 'style') setGenExercises([]);
      setSwapTargetId(null);
      setSwapAlts([]);
      setEditTargetId(null);
      setShowAddPanel(false);
      setReorderActiveId(null);
      setStep(nextStep);
      if (nextStep === 'workout') {
        setTimeout(() => bottomSheetRef.current?.snapToIndex(1), 80);
      } else {
        setTimeout(() => bottomSheetRef.current?.snapToIndex(0), 80);
      }
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 160, useNativeDriver: true,
      }).start();
    });
  }, [fadeAnim]);

  const doGenerate = useCallback((seedOff: number) => {
    console.log('[PlanWorkoutSheet] Generating workout — style:', selectedStyle, 'split:', selectedSplit || recommendedSplit, 'seed:', seedOff);
    setIsGenerating(true);
    setSwapTargetId(null);
    setSwapAlts([]);
    setEditTargetId(null);
    setShowAddPanel(false);
    setReorderActiveId(null);
    generateWorkoutAsync({
      style: selectedStyle,
      split: selectedSplit || recommendedSplit,
      targetDuration: ctx.targetDuration,
      restSlider: ctx.restBetweenSets,
      availableEquipment: ctx.selectedEquipment,
      fitnessLevel: ctx.fitnessLevel,
      sex: ctx.sex,
      specialLifeCase: ctx.specialLifeCase,
      specialLifeCaseDetail: ctx.specialLifeCaseDetail,
      warmUp: false,
      coolDown: false,
      recovery: false,
      addCardio: false,
      specificMuscles: topMuscles,
      seedOffset: seedOff,
    }, undefined, hasPro).then((result) => {
      setGenExercises(result.workout);
      console.log('[PlanWorkoutSheet] Generated', result.workout.length, 'exercises');
    }).catch((e) => {
      console.log('[PlanWorkoutSheet] Generation error:', e);
      setGenExercises([]);
    }).finally(() => {
      setIsGenerating(false);
    });
  }, [selectedStyle, selectedSplit, recommendedSplit, ctx, topMuscles]);

  useEffect(() => {
    if (step === 'workout' && genExercises.length === 0 && !isGenerating) {
      doGenerate(genSeedOffset);
    }
  }, [step, genExercises.length, isGenerating, doGenerate, genSeedOffset]);

  const handleRegeneratePress = useCallback(() => {
    const next = genSeedOffset + 1;
    setGenSeedOffset(next);
    doGenerate(next);
  }, [genSeedOffset, doGenerate]);

  const handleStyleSelect = useCallback((style: string) => {
    setSelectedStyle(style);
    setGenExercises([]);
  }, []);

  const handleStyleNext = useCallback(() => {
    const splits = TRAINING_SPLITS[selectedStyle] ?? ['Full Body'];
    const rec = splits.filter(sp => !conflictingSplits.some(c =>
      c.toLowerCase().includes(sp.toLowerCase()) || sp.toLowerCase().includes(c.toLowerCase())
    ))[0] ?? splits[0];
    transitionStep('split', rec);
  }, [selectedStyle, conflictingSplits, transitionStep]);

  const handleSplitNext = useCallback(() => {
    transitionStep('confirm');
  }, [transitionStep]);

  const handleConfirmNext = useCallback(() => {
    transitionStep('workout');
  }, [transitionStep]);

  const handlePlanIt = useCallback(() => {
    if (!targetDate) return;
    const estDur = estimateDuration(genExercises.length, ctx.targetDuration);
    const workout: PlannedWorkout = {
      id: generateId(),
      date: targetDate,
      style: selectedStyle,
      split: selectedSplit || recommendedSplit,
      muscles: topMuscles,
      duration: estDur,
      createdAt: new Date().toISOString(),
      exercises: genExercises.length > 0 ? genExercises : undefined,
    };
    console.log('[PlanWorkoutSheet] Saving planned workout with', genExercises.length, 'exercises');
    ctx.savePlannedWorkout(workout);
    onClose();
  }, [targetDate, selectedStyle, selectedSplit, recommendedSplit, topMuscles, genExercises, ctx, onClose]);

  const handleDelete = useCallback(() => {
    if (!existingPlan) return;
    ctx.deletePlannedWorkout(existingPlan.id);
    onClose();
  }, [existingPlan, ctx, onClose]);

  const handleSwapTap = useCallback((ex: WorkoutExercise) => {
    if (swapTargetId === ex.id) {
      setSwapTargetId(null);
      setSwapAlts([]);
      return;
    }
    const zealRef = ex.exerciseRef as ZealExercise | null;
    const subIds: string[] = (zealRef as any)?.substitutes ?? [];
    const db = getZealExerciseDatabase();
    const alts = db.filter(z => subIds.includes(z.id)).slice(0, 6);
    setSwapAlts(alts);
    setSwapTargetId(ex.id);
    setEditTargetId(null);
    setReorderActiveId(null);
  }, [swapTargetId]);

  const handleSwapConfirm = useCallback((alt: ZealExercise) => {
    setGenExercises(prev => prev.map(ex => {
      if (ex.id !== swapTargetId) return ex;
      return zealToWorkoutEx(alt, ex.sets, ex.reps, ex.rest);
    }));
    setSwapTargetId(null);
    setSwapAlts([]);
  }, [swapTargetId]);

  const handleEditTap = useCallback((ex: WorkoutExercise) => {
    if (editTargetId === ex.id) {
      setEditTargetId(null);
      return;
    }
    setEditTargetId(ex.id);
    setEditSets(String(ex.sets));
    setEditReps(ex.reps);
    setSwapTargetId(null);
    setSwapAlts([]);
    setReorderActiveId(null);
  }, [editTargetId]);

  const handleEditConfirm = useCallback(() => {
    const sets = parseInt(editSets, 10);
    if (!editTargetId) return;
    setGenExercises(prev => prev.map(ex => {
      if (ex.id !== editTargetId) return ex;
      return { ...ex, sets: Math.min(10, Math.max(1, isNaN(sets) ? ex.sets : sets)), reps: editReps.trim() || ex.reps };
    }));
    setEditTargetId(null);
  }, [editTargetId, editSets, editReps]);

  const handleRemoveExercise = useCallback((id: string) => {
    setGenExercises(prev => prev.filter(ex => ex.id !== id));
    if (swapTargetId === id) { setSwapTargetId(null); setSwapAlts([]); }
    if (editTargetId === id) setEditTargetId(null);
    if (reorderActiveId === id) setReorderActiveId(null);
  }, [swapTargetId, editTargetId, reorderActiveId]);

  const handleMoveUp = useCallback((id: string) => {
    setGenExercises(prev => {
      const idx = prev.findIndex(e => e.id === id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }, []);

  const handleMoveDown = useCallback((id: string) => {
    setGenExercises(prev => {
      const idx = prev.findIndex(e => e.id === id);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }, []);

  const handleAddExercise = useCallback((ze: ZealExercise) => {
    const newEx = zealToWorkoutEx(ze, 3, '10', '60s');
    setGenExercises(prev => [...prev, newEx]);
    setShowAddPanel(false);
    setAddQuery('');
  }, []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.65}
        pressBehavior="close"
      />
    ),
    []
  );

  const dateLabel = targetDate ? formatDateLabel(targetDate) : '';

  const renderExerciseRow = (ex: WorkoutExercise, index: number, total: number) => {
    const isSwapTarget = swapTargetId === ex.id;
    const isEditTarget = editTargetId === ex.id;
    const isReorderActive = reorderActiveId === ex.id;
    const rowAccent = isSwapTarget || isEditTarget || isReorderActive ? styleColor : colors.border;

    return (
      <View
        key={ex.id}
        style={[
          styles.exRow,
          { borderColor: rowAccent, backgroundColor: (isSwapTarget || isEditTarget || isReorderActive) ? `${styleColor}06` : 'transparent' },
        ]}
      >
        <View style={styles.exRowMain}>
          <TouchableOpacity
            style={styles.reorderHandle}
            onPress={() => {
              setReorderActiveId(isReorderActive ? null : ex.id);
              setSwapTargetId(null);
              setEditTargetId(null);
            }}
            activeOpacity={0.6}
          >
            <ArrowUpDown size={13} color={isReorderActive ? styleColor : `${colors.border}80`} strokeWidth={2} />
          </TouchableOpacity>

          <View style={[styles.indexBubble, { backgroundColor: `${styleColor}14` }]}>
            <Text style={[styles.indexText, { color: styleColor }]}>{index + 1}</Text>
          </View>

          <Text style={[styles.exName, { color: colors.text }]} numberOfLines={1}>{ex.name}</Text>

          <TouchableOpacity
            style={[styles.setsRepsBadge, { backgroundColor: isEditTarget ? `${styleColor}20` : `${styleColor}12` }]}
            onPress={() => handleEditTap(ex)}
            activeOpacity={0.7}
          >
            <Text style={[styles.setsRepsText, { color: styleColor }]}>{ex.sets}×{ex.reps}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.exActionBtn, isSwapTarget && { backgroundColor: `${styleColor}14`, borderRadius: 8 }]}
            onPress={() => handleSwapTap(ex)}
            activeOpacity={0.7}
          >
            <Repeat2 size={14} color={isSwapTarget ? styleColor : colors.textMuted} strokeWidth={2} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.exActionBtn}
            onPress={() => handleRemoveExercise(ex.id)}
            activeOpacity={0.7}
          >
            <Trash2 size={14} color={colors.textMuted} strokeWidth={1.8} />
          </TouchableOpacity>
        </View>

        <View style={styles.exMetaRow}>
          <Text style={[styles.exMeta, { color: colors.textMuted }]}>{ex.muscleGroup}</Text>
          {ex.rest ? (
            <Text style={[styles.exMeta, { color: colors.textMuted }]}>{ex.rest} rest</Text>
          ) : null}
        </View>

        {isEditTarget && (
          <View style={[styles.editRow, { borderTopColor: `${colors.border}60` }]}>
            <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Sets</Text>
            <TextInput
              style={[styles.editInput, { color: colors.text, backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0', borderColor: `${colors.border}80` }]}
              value={editSets}
              onChangeText={setEditSets}
              keyboardType="number-pad"
              maxLength={2}
              selectTextOnFocus
            />
            <Text style={[styles.editLabel, { color: colors.textSecondary }]}>Reps</Text>
            <TextInput
              style={[styles.editInput, styles.editInputReps, { color: colors.text, backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0', borderColor: `${colors.border}80` }]}
              value={editReps}
              onChangeText={setEditReps}
              keyboardType="default"
              maxLength={8}
              placeholder="e.g. 8-10"
              placeholderTextColor={colors.textMuted}
              selectTextOnFocus
            />
            <TouchableOpacity
              style={[styles.editConfirmBtn, { backgroundColor: styleColor }]}
              onPress={handleEditConfirm}
              activeOpacity={0.8}
            >
              <CheckCircle size={14} color="#fff" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        )}

        {isReorderActive && (
          <View style={[styles.reorderRow, { borderTopColor: `${colors.border}60` }]}>
            <TouchableOpacity
              style={[styles.moveBtn, { borderColor: colors.border, opacity: index === 0 ? 0.3 : 1 }]}
              onPress={() => handleMoveUp(ex.id)}
              disabled={index === 0}
              activeOpacity={0.7}
            >
              <ArrowUp size={13} color={colors.textSecondary} strokeWidth={2} />
              <Text style={[styles.moveBtnText, { color: colors.textSecondary }]}>Up</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.moveBtn, { borderColor: colors.border, opacity: index === total - 1 ? 0.3 : 1 }]}
              onPress={() => handleMoveDown(ex.id)}
              disabled={index === total - 1}
              activeOpacity={0.7}
            >
              <ArrowDown size={13} color={colors.textSecondary} strokeWidth={2} />
              <Text style={[styles.moveBtnText, { color: colors.textSecondary }]}>Down</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setReorderActiveId(null)}
              style={[styles.moveDoneBtn, { backgroundColor: `${styleColor}14` }]}
              activeOpacity={0.7}
            >
              <Text style={[styles.moveDoneText, { color: styleColor }]}>Done</Text>
            </TouchableOpacity>
          </View>
        )}

        {isSwapTarget && (
          <View style={[styles.swapPanel, { borderTopColor: `${colors.border}60`, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}>
            <Text style={[styles.swapPanelTitle, { color: colors.textSecondary }]}>SWAP WITH</Text>
            {swapAlts.length === 0 ? (
              <Text style={[styles.swapNoAlts, { color: colors.textMuted }]}>No alternatives found</Text>
            ) : (
              swapAlts.map(alt => (
                <TouchableOpacity
                  key={alt.id}
                  style={[styles.swapAltRow, { borderBottomColor: `${colors.border}50` }]}
                  onPress={() => handleSwapConfirm(alt)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.swapAltDot, { backgroundColor: styleColor }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.swapAltName, { color: colors.text }]}>{alt.name}</Text>
                    <Text style={[styles.swapAltMuscle, { color: colors.textMuted }]}>
                      {alt.primary_muscles[0]?.replace(/_/g, ' ')}
                    </Text>
                  </View>
                  <ChevronRight size={14} color={colors.textMuted} />
                </TouchableOpacity>
              ))
            )}
            <TouchableOpacity
              style={styles.swapCancelBtn}
              onPress={() => { setSwapTargetId(null); setSwapAlts([]); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.swapCancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      backgroundStyle={[styles.sheetBg, { backgroundColor: colors.card }]}
      handleIndicatorStyle={[styles.handle, { backgroundColor: colors.border }]}
      enablePanDownToClose
      enableOverDrag={false}
      topInset={topOffset}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
    >
      <BottomSheetScrollView
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.headerIcon, { backgroundColor: `${accent}18` }]}>
              <CalendarPlus size={20} color={accent} strokeWidth={1.8} />
            </View>
            <View>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                {existingPlan && step === 'existing' ? 'Planned Workout' : 'Plan Workout'}
              </Text>
              <Text style={[styles.headerDate, { color: colors.textSecondary }]}>{dateLabel}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <X size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <Animated.View style={[styles.stepContainer, { opacity: fadeAnim }]}>

          {step === 'existing' && existingPlan && (
            <View style={styles.existingContainer}>
              <View style={styles.existingStyleBadge}>
                <View style={[styles.existingStyleDot, { backgroundColor: accent }]} />
                <Text style={[styles.existingStyleBadgeText, { color: colors.textSecondary }]}>{existingPlan.style.toUpperCase()}</Text>
              </View>

              <Text style={[styles.existingSplitText, { color: colors.text }]}>{existingPlan.split}</Text>
              <Text style={[styles.existingDateText, { color: colors.textSecondary }]}>{dateLabel}</Text>

              <View style={styles.existingStatsRow}>
                <View style={[styles.existingStatPill, { backgroundColor: isDark ? '#1e1e1e' : '#f0f0f0' }]}>
                  <Clock size={13} color={colors.textSecondary} />
                  <Text style={[styles.existingStatText, { color: colors.text }]}>{existingPlan.duration} min</Text>
                </View>
                {existingPlan.muscles.length > 0 && (
                  <View style={[styles.existingStatPill, { backgroundColor: isDark ? '#1e1e1e' : '#f0f0f0' }]}>
                    <Dumbbell size={13} color={colors.textSecondary} />
                    <Text style={[styles.existingStatText, { color: colors.text }]}>
                      {existingPlan.muscles.slice(0, 2).join(', ')}
                    </Text>
                  </View>
                )}
                {existingPlan.exercises && existingPlan.exercises.length > 0 && (
                  <View style={[styles.existingStatPill, { backgroundColor: isDark ? '#1e1e1e' : '#f0f0f0' }]}>
                    <Text style={[styles.existingStatText, { color: colors.text }]}>
                      {existingPlan.exercises.length} exercises
                    </Text>
                  </View>
                )}
              </View>

              {existingPlan.exercises && existingPlan.exercises.length > 0 && (
                <View style={[styles.existingExSection, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}>
                  <Text style={[styles.existingExLabel, { color: colors.textSecondary }]}>EXERCISES</Text>
                  {existingPlan.exercises.slice(0, 6).map((ex, i) => (
                    <View key={ex.id} style={[styles.existingExRow, { borderBottomColor: `${colors.border}50` }]}>
                      <Text style={[styles.existingExNum, { color: colors.textMuted }]}>{String(i + 1).padStart(2, '0')}</Text>
                      <Text style={[styles.existingExName, { color: colors.text }]} numberOfLines={1}>{ex.name}</Text>
                      <Text style={[styles.existingExSets, { color: colors.textSecondary }]}>{ex.sets}×{ex.reps}</Text>
                    </View>
                  ))}
                  {existingPlan.exercises.length > 6 && (
                    <Text style={[styles.existingExMore, { color: colors.textMuted }]}>
                      +{existingPlan.exercises.length - 6} more exercises
                    </Text>
                  )}
                </View>
              )}

              <TouchableOpacity
                style={[styles.modifyBtn, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}
                onPress={() => transitionStep('style')}
                activeOpacity={0.8}
              >
                <Text style={[styles.modifyBtnText, { color: colors.text }]}>Change Workout Plan</Text>
                <ChevronRight size={16} color={colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.deleteBtn, { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' }]}
                onPress={handleDelete}
                activeOpacity={0.8}
              >
                <Trash2 size={16} color="#ef4444" />
                <Text style={styles.deleteBtnText}>Remove Plan</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'style' && (
            <View style={styles.stepContent}>
              <Text style={[styles.stepLabel, { color: colors.textSecondary }]}>STEP 1 OF 4</Text>
              <Text style={[styles.stepTitle, { color: colors.text }]}>Choose a style</Text>

              {topMuscles.length > 0 && (
                <View style={[styles.suggestBanner, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', borderColor: colors.border }]}>
                  <AlertCircle size={13} color={colors.textSecondary} strokeWidth={2} />
                  <Text style={[styles.suggestText, { color: colors.textSecondary }]}>
                    Freshest muscles: <Text style={{ color: colors.text, fontFamily: 'Outfit_600SemiBold' }}>{topMuscles.join(', ')}</Text>
                  </Text>
                </View>
              )}

              <View style={styles.styleGrid}>
                {STYLE_OPTIONS.map((s) => {
                  const sColor = WORKOUT_STYLE_COLORS[s] ?? accent;
                  const isSelected = selectedStyle === s;
                  const isRecommended = s === ctx.workoutStyle;
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[
                        styles.styleChip,
                        { borderColor: isSelected ? sColor : colors.border },
                        isSelected && { backgroundColor: `${sColor}18` },
                      ]}
                      onPress={() => handleStyleSelect(s)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.styleDot, { backgroundColor: sColor }]} />
                      <Text style={[styles.styleChipText, { color: isSelected ? sColor : colors.text }]}>{s}</Text>
                      {isRecommended && (
                        <View style={[styles.recBadge, { backgroundColor: `${sColor}22` }]}>
                          <Text style={[styles.recBadgeText, { color: sColor }]}>REC</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[styles.nextBtn, { backgroundColor: selectedStyle ? styleColor : colors.border }]}
                onPress={handleStyleNext}
                disabled={!selectedStyle}
                activeOpacity={0.85}
              >
                <Text style={[styles.nextBtnText, { color: selectedStyle ? '#fff' : colors.textSecondary }]}>Next</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 'split' && (
            <View style={styles.stepContent}>
              <Text style={[styles.stepLabel, { color: colors.textSecondary }]}>STEP 2 OF 4</Text>
              <Text style={[styles.stepTitle, { color: colors.text }]}>Choose a focus</Text>

              {conflictingSplits.length > 0 && (
                <View style={[styles.conflictBanner, { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)' }]}>
                  <AlertCircle size={13} color="#ef4444" strokeWidth={2} />
                  <Text style={[styles.conflictText, { color: '#ef4444' }]}>
                    Adjacent day has: <Text style={{ fontFamily: 'Outfit_600SemiBold' }}>{conflictingSplits.join(', ')}</Text> — similar splits highlighted
                  </Text>
                </View>
              )}

              <View style={styles.splitGrid}>
                {splitOptions.map((sp) => {
                  const isSelected = selectedSplit === sp || (!selectedSplit && sp === recommendedSplit);
                  const isConflict = conflictingSplits.some(c =>
                    c.toLowerCase().includes(sp.toLowerCase()) || sp.toLowerCase().includes(c.toLowerCase())
                  );
                  const isRec = sp === recommendedSplit;
                  return (
                    <TouchableOpacity
                      key={sp}
                      style={[
                        styles.splitChip,
                        { borderColor: isSelected ? styleColor : isConflict ? 'rgba(239,68,68,0.4)' : colors.border },
                        isSelected && { backgroundColor: `${styleColor}18` },
                        isConflict && !isSelected && { backgroundColor: 'rgba(239,68,68,0.06)' },
                      ]}
                      onPress={() => setSelectedSplit(sp)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.splitChipText,
                        { color: isSelected ? styleColor : isConflict ? '#ef4444' : colors.text },
                      ]}>
                        {sp}
                      </Text>
                      {isRec && !isConflict && (
                        <View style={[styles.recBadge, { backgroundColor: `${styleColor}22` }]}>
                          <Text style={[styles.recBadgeText, { color: styleColor }]}>REC</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.navRow}>
                <TouchableOpacity
                  style={[styles.backBtn, { borderColor: colors.border }]}
                  onPress={() => transitionStep('style')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.backBtnText, { color: colors.textSecondary }]}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.nextBtnFlex, { backgroundColor: styleColor }]}
                  onPress={handleSplitNext}
                  activeOpacity={0.85}
                >
                  <Text style={styles.nextBtnText}>Next</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {step === 'confirm' && (
            <View style={styles.stepContent}>
              <Text style={[styles.stepLabel, { color: colors.textSecondary }]}>STEP 3 OF 4</Text>
              <Text style={[styles.stepTitle, { color: colors.text }]}>Confirm plan</Text>

              <View style={[styles.confirmCard, { backgroundColor: colors.cardSecondary, borderColor: `${styleColor}30` }]}>
                <View style={[styles.confirmAccentBar, { backgroundColor: styleColor }]} />
                <View style={styles.confirmCardInner}>
                  <View style={styles.confirmRow}>
                    <Text style={[styles.confirmLabel, { color: colors.textSecondary }]}>DATE</Text>
                    <Text style={[styles.confirmValue, { color: colors.text }]}>{dateLabel}</Text>
                  </View>
                  <View style={[styles.confirmRowDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.confirmRow}>
                    <Text style={[styles.confirmLabel, { color: colors.textSecondary }]}>STYLE</Text>
                    <View style={styles.confirmStyleRow}>
                      <View style={[styles.styleDot, { backgroundColor: styleColor }]} />
                      <Text style={[styles.confirmValue, { color: styleColor }]}>{selectedStyle}</Text>
                    </View>
                  </View>
                  <View style={[styles.confirmRowDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.confirmRow}>
                    <Text style={[styles.confirmLabel, { color: colors.textSecondary }]}>FOCUS</Text>
                    <Text style={[styles.confirmValue, { color: colors.text }]}>{selectedSplit || recommendedSplit}</Text>
                  </View>
                  <View style={[styles.confirmRowDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.confirmRow}>
                    <Text style={[styles.confirmLabel, { color: colors.textSecondary }]}>DURATION</Text>
                    <Text style={[styles.confirmValue, { color: colors.text }]}>{ctx.targetDuration} min</Text>
                  </View>
                </View>
              </View>

              {topMuscles.length > 0 && (
                <View style={[styles.muscleRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
                  <Text style={[styles.muscleRowLabel, { color: colors.textSecondary }]}>Target muscles</Text>
                  <View style={styles.muscleChips}>
                    {topMuscles.map(m => (
                      <View key={m} style={[styles.muscleChip, { backgroundColor: `${styleColor}18`, borderColor: `${styleColor}30` }]}>
                        <Text style={[styles.muscleChipText, { color: styleColor }]}>{m}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={[styles.nextWorkoutHint, { backgroundColor: `${styleColor}0c`, borderColor: `${styleColor}25` }]}>
                <Text style={[styles.nextWorkoutHintText, { color: colors.textSecondary }]}>
                  Next you'll preview and customize the generated exercise list
                </Text>
              </View>

              <View style={styles.navRow}>
                <TouchableOpacity
                  style={[styles.backBtn, { borderColor: colors.border }]}
                  onPress={() => transitionStep('split')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.backBtnText, { color: colors.textSecondary }]}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.nextBtnFlex, { backgroundColor: styleColor }]}
                  onPress={handleConfirmNext}
                  activeOpacity={0.85}
                >
                  <Text style={styles.nextBtnText}>Build Workout</Text>
                  <ChevronRight size={16} color="#fff" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {step === 'workout' && (
            <View style={styles.stepContent}>
              <View style={styles.workoutStepHeader}>
                <View>
                  <Text style={[styles.stepLabel, { color: colors.textSecondary }]}>STEP 4 OF 4</Text>
                  <Text style={[styles.stepTitle, { color: colors.text }]}>Build your workout</Text>
                </View>
                <TouchableOpacity
                  style={[styles.regenBtn, { borderColor: colors.border }]}
                  onPress={handleRegeneratePress}
                  activeOpacity={0.7}
                  disabled={isGenerating}
                >
                  <RefreshCw size={13} color={isGenerating ? colors.textMuted : colors.textSecondary} strokeWidth={2} />
                  <Text style={[styles.regenBtnText, { color: isGenerating ? colors.textMuted : colors.textSecondary }]}>
                    Regenerate
                  </Text>
                </TouchableOpacity>
              </View>

              <Animated.View style={[styles.durationPill, { backgroundColor: `${styleColor}12`, borderColor: `${styleColor}25`, transform: [{ scale: durationAnim }] }]}>
                <Clock size={13} color={styleColor} strokeWidth={2} />
                <Text style={[styles.durationPillText, { color: styleColor }]}>
                  ~{estimateDuration(genExercises.length, ctx.targetDuration)} min
                </Text>
                <View style={[styles.durationDivider, { backgroundColor: `${styleColor}30` }]} />
                <Text style={[styles.durationCountText, { color: `${styleColor}b0` }]}>
                  {genExercises.length} {genExercises.length === 1 ? 'exercise' : 'exercises'}
                </Text>
              </Animated.View>

              {isGenerating ? (
                <View style={styles.loadingContainer}>
                  {[0, 1, 2, 3, 4].map(i => (
                    <View
                      key={i}
                      style={[styles.skeletonRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', width: `${85 - i * 8}%` }]}
                    />
                  ))}
                  <ActivityIndicator color={styleColor} style={{ marginTop: 8 }} />
                  <Text style={[styles.loadingText, { color: colors.textMuted }]}>Generating workout…</Text>
                </View>
              ) : showAddPanel ? (
                <View style={[styles.addPanel, { backgroundColor: isDark ? '#1a1a1a' : '#f8f8f8', borderColor: colors.border }]}>
                  <View style={styles.addPanelHeader}>
                    <Text style={[styles.addPanelTitle, { color: colors.text }]}>Add Exercise</Text>
                    <TouchableOpacity onPress={() => { setShowAddPanel(false); setAddQuery(''); }} activeOpacity={0.7}>
                      <X size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <View style={[styles.searchRow, { backgroundColor: isDark ? '#111' : '#ececec', borderColor: colors.border }]}>
                    <Search size={14} color={colors.textMuted} />
                    <TextInput
                      style={[styles.searchInput, { color: colors.text }]}
                      value={addQuery}
                      onChangeText={setAddQuery}
                      placeholder="Search by name or muscle…"
                      placeholderTextColor={colors.textMuted}
                      autoFocus
                    />
                    {addQuery.length > 0 && (
                      <TouchableOpacity onPress={() => setAddQuery('')} activeOpacity={0.7}>
                        <X size={14} color={colors.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>
                  {addQuery.length === 0 && (
                    <Text style={[styles.searchHint, { color: colors.textMuted }]}>Type to search exercises</Text>
                  )}
                  {addQuery.length > 0 && addFilteredExercises.length === 0 && (
                    <Text style={[styles.searchHint, { color: colors.textMuted }]}>No exercises found</Text>
                  )}
                  {addFilteredExercises.map(ze => (
                    <TouchableOpacity
                      key={ze.id}
                      style={[styles.addResultRow, { borderBottomColor: `${colors.border}50` }]}
                      onPress={() => handleAddExercise(ze)}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.addResultName, { color: colors.text }]}>{ze.name}</Text>
                        <Text style={[styles.addResultMeta, { color: colors.textMuted }]}>
                          {ze.primary_muscles[0]?.replace(/_/g, ' ')} · {(ze.equipment_required[0] ?? 'bodyweight').replace(/_/g, ' ')}
                        </Text>
                      </View>
                      <View style={[styles.addResultIcon, { backgroundColor: `${styleColor}14` }]}>
                        <Plus size={14} color={styleColor} strokeWidth={2.5} />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <>
                  {genExercises.length === 0 ? (
                    <View style={styles.emptyExState}>
                      <Dumbbell size={28} color={colors.textMuted} strokeWidth={1.5} />
                      <Text style={[styles.emptyExText, { color: colors.textMuted }]}>No exercises — tap Add or Regenerate</Text>
                    </View>
                  ) : (
                    genExercises.map((ex, i) => renderExerciseRow(ex, i, genExercises.length))
                  )}
                  <TouchableOpacity
                    style={[styles.addExBtn, { borderColor: `${styleColor}40`, backgroundColor: `${styleColor}08` }]}
                    onPress={() => { setShowAddPanel(true); setAddQuery(''); }}
                    activeOpacity={0.7}
                  >
                    <Plus size={15} color={styleColor} strokeWidth={2.5} />
                    <Text style={[styles.addExBtnText, { color: styleColor }]}>Add Exercise</Text>
                  </TouchableOpacity>
                </>
              )}

              <View style={styles.navRow}>
                <TouchableOpacity
                  style={[styles.backBtn, { borderColor: colors.border }]}
                  onPress={() => transitionStep('confirm')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.backBtnText, { color: colors.textSecondary }]}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.planItBtn, { backgroundColor: styleColor }]}
                  onPress={handlePlanIt}
                  activeOpacity={0.85}
                >
                  <CheckCircle size={18} color="#fff" strokeWidth={2} />
                  <Text style={styles.planItBtnText}>Plan It</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

        </Animated.View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetBg: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
  },
  container: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.3,
  },
  headerDate: {
    fontSize: 13,
    marginTop: 1,
    fontFamily: 'Outfit_400Regular',
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    marginBottom: 20,
  },
  stepContainer: {
    flex: 1,
  },
  stepContent: {
    gap: 16,
  },
  stepLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 1,
  },
  stepTitle: {
    fontSize: 22,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.5,
    marginTop: -6,
  },
  suggestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  suggestText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  conflictBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  conflictText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
  styleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  styleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  styleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  styleChipText: {
    fontSize: 14,
    fontFamily: 'Outfit_500Medium',
    letterSpacing: -0.1,
  },
  recBadge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  recBadgeText: {
    fontSize: 9,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.5,
  },
  splitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  splitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  splitChipText: {
    fontSize: 14,
    fontFamily: 'Outfit_500Medium',
  },
  nextBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  nextBtnFlex: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  nextBtnText: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    color: '#fff',
    letterSpacing: -0.2,
  },
  navRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  backBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  backBtnText: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
  },
  confirmCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  confirmAccentBar: {
    height: 4,
    width: '100%',
  },
  confirmCardInner: {
    padding: 16,
    gap: 0,
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  confirmRowDivider: {
    height: 1,
  },
  confirmLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.8,
  },
  confirmValue: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: -0.1,
  },
  confirmStyleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  muscleRow: {
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  muscleRowLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.8,
  },
  muscleChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  muscleChip: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  muscleChipText: {
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
  },
  nextWorkoutHint: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  nextWorkoutHintText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Outfit_400Regular',
    textAlign: 'center' as const,
  },
  planItBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 16,
  },
  planItBtnText: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    color: '#fff',
    letterSpacing: -0.2,
  },
  existingContainer: {
    gap: 14,
  },
  existingStyleBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  existingStyleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  existingStyleBadgeText: {
    fontSize: 10,
    fontWeight: '800' as const,
    letterSpacing: 0.7,
  },
  existingSplitText: {
    fontSize: 24,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  existingDateText: {
    fontSize: 13,
    marginBottom: 4,
  },
  existingStatsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  existingStatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  existingStatText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  existingExSection: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
  },
  existingExLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  existingExRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  existingExNum: {
    width: 22,
    fontSize: 11,
    fontWeight: '700' as const,
  },
  existingExName: {
    fontSize: 14,
    fontFamily: 'Outfit_500Medium',
    flex: 1,
  },
  existingExSets: {
    fontSize: 13,
    fontWeight: '600' as const,
    flexShrink: 0,
  },
  existingExMore: {
    fontSize: 12,
    paddingVertical: 8,
    textAlign: 'center' as const,
  },
  modifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    marginTop: 4,
  },
  modifyBtnText: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
  },
  deleteBtnText: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
    color: '#ef4444',
  },
  workoutStepHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  regenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 2,
  },
  regenBtnText: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: 'flex-start' as const,
  },
  durationPillText: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.2,
  },
  durationDivider: {
    width: 1,
    height: 12,
    marginHorizontal: 2,
  },
  durationCountText: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
  },
  loadingContainer: {
    gap: 10,
    paddingVertical: 12,
    alignItems: 'center' as const,
  },
  skeletonRow: {
    height: 44,
    borderRadius: 10,
  },
  loadingText: {
    fontSize: 13,
    marginTop: 4,
    fontFamily: 'Outfit_400Regular',
  },
  emptyExState: {
    alignItems: 'center' as const,
    gap: 10,
    paddingVertical: 24,
  },
  emptyExText: {
    fontSize: 14,
    textAlign: 'center' as const,
  },
  exRow: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 4,
  },
  exRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  reorderHandle: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  indexBubble: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  indexText: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
  exName: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
    flex: 1,
    letterSpacing: -0.2,
  },
  setsRepsBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexShrink: 0,
  },
  setsRepsText: {
    fontSize: 13,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  exActionBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  exMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 29,
    paddingRight: 4,
  },
  exMeta: {
    fontSize: 11,
    fontFamily: 'Outfit_400Regular',
    textTransform: 'capitalize' as const,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    marginTop: 4,
    paddingLeft: 4,
  },
  editLabel: {
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.3,
  },
  editInput: {
    width: 44,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    textAlign: 'center' as const,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  editInputReps: {
    width: 70,
  },
  editConfirmBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto' as any,
  },
  reorderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    marginTop: 4,
  },
  moveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  moveBtnText: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
  },
  moveDoneBtn: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 'auto' as any,
  },
  moveDoneText: {
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
  },
  swapPanel: {
    marginTop: 8,
    borderTopWidth: 1,
    paddingTop: 10,
    gap: 2,
  },
  swapPanelTitle: {
    fontSize: 10,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  swapNoAlts: {
    fontSize: 13,
    textAlign: 'center' as const,
    paddingVertical: 8,
  },
  swapAltRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
  },
  swapAltDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    flexShrink: 0,
  },
  swapAltName: {
    fontSize: 14,
    fontFamily: 'Outfit_500Medium',
  },
  swapAltMuscle: {
    fontSize: 11,
    textTransform: 'capitalize' as const,
  },
  swapCancelBtn: {
    alignSelf: 'flex-end' as const,
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginTop: 2,
  },
  swapCancelText: {
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
  },
  addExBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1.5,
    borderRadius: 12,
    borderStyle: 'dashed' as const,
    paddingVertical: 13,
    marginTop: 4,
  },
  addExBtnText: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
  },
  addPanel: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 200,
  },
  addPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  addPanelTitle: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.2,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 14,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Outfit_400Regular',
    padding: 0,
  },
  searchHint: {
    fontSize: 13,
    textAlign: 'center' as const,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  addResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
  addResultName: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: -0.1,
  },
  addResultMeta: {
    fontSize: 11,
    marginTop: 1,
    textTransform: 'capitalize' as const,
  },
  addResultIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
