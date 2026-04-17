import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Platform, AppState, type AppStateStatus } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAppContext, type MuscleReadinessItem } from '@/context/AppContext';
import type { GeneratedWorkout, WorkoutExercise } from '@/services/workoutEngine';
import { healthService } from '@/services/healthService';
import { generateWorkoutAsync, enforceStyleGrouping } from '@/services/aiWorkoutGenerator';
import { generateWorkout, generateCoreFinisherFromEngine } from '@/services/workoutEngine';
import { PRO_STYLES_SET } from '@/services/proGate';
import { useSubscription } from '@/context/SubscriptionContext';
import {
  scheduleRestCompleteNotification,
  cancelRestCompleteNotification,
  scheduleWeeklySummary,
} from '@/services/notificationService';
import { buildCreativeWorkoutTitle } from '@/services/workoutTitle';
import { calcCurrentStreak } from '@/services/milestonesData';

const HISTORY_KEY = '@zeal_workout_history_v1';
const PR_KEY = '@zeal_pr_history_v1';
const WEEKLY_HOURS_KEY = '@zeal_weekly_hours_v1';
const SEEN_HEALTH_IMPORTS_KEY = '@zeal_health_seen_imports_v1';
/** Persists today’s generated workout + title until local calendar day changes (survives app kill). */
const DAILY_GENERATED_SNAPSHOT_KEY = '@zeal_daily_generated_workout_v1';

interface DailyGeneratedSnapshot {
  date: string;
  workout: GeneratedWorkout;
  title?: string;
}

export type DifficultyLevel = 'easy' | 'moderate' | 'hard' | 'brutal';
export type PostWorkoutStep = 'prs' | 'feedback' | 'save' | null;

export const STAR_MULTIPLIERS: Record<number, number> = {
  1: 0.8,
  2: 0.9,
  3: 1.0,
  4: 1.2,
  5: 1.4,
};

export interface SetLog {
  setNumber: number;
  weight: number;
  reps: number;
  done: boolean;
}

export interface ExerciseLog {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string;
  sets: SetLog[];
  timeCap?: string;
  scoreRounds?: string;
  notes?: string;
  duration?: string;
  distance?: string;
  completed: boolean;
  prHit: boolean;
}

export interface PersonalRecord {
  exerciseName: string;
  type: 'weight' | 'reps' | 'volume';
  value: number;
  date: string;
  sessionId: string;
}

export interface WorkoutLog {
  id: string;
  date: string;
  workoutName: string;
  workoutStyle: string;
  split: string;
  duration: number;
  exercises: ExerciseLog[];
  totalSets: number;
  totalVolume: number;
  prsHit: number;
  trainingScore: number;
  difficulty: DifficultyLevel;
  starRating: number;
  rpe: number;
  whatWentWell: string[];
  isManualLog?: boolean;
  calories?: number;
  muscleGroups?: string[];
  muscleSetCounts?: Record<string, number>; // muscle name → completed sets
  startTime?: string;
}

export interface HealthImportItem {
  id: string;
  startDate: string;
  endDate: string;
  duration: number;
  activityType: string;
  calories?: number;
  sourceName?: string;
  suggestedStyle: string;
  dateStr: string;
}

export interface DuplicateCandidate {
  id: string;
  healthImport: HealthImportItem;
  zealLog: WorkoutLog;
}

export interface TrainingScoreBreakdown {
  basePoints: number;
  volumePoints: number;
  intensityPoints: number;
  prBonus: number;
  difficultyMultiplier: number;
  finalScore: number;
}

function mapHealthActivityToZealStyle(activityType: string): string {
  const s = activityType.toLowerCase();
  if (s.includes('pilates')) return 'Pilates';
  if (s.includes('hyrox')) return 'Hyrox';
  if (s.includes('yoga') || s.includes('stretch') || s.includes('flexib') || s.includes('mobil')) return 'Mobility';
  if (s.includes('hiit') || s.includes('high intensity')) return 'HIIT';
  if (s.includes('crossfit') || s.includes('cross train') || s.includes('crosstraining') || s.includes('functional')) return 'CrossFit';
  if (s.includes('run') || s.includes('walk') || s.includes('cycl') || s.includes('cardio') || s.includes('rowing') || s.includes('elliptical') || s.includes('stair') || s.includes('swim')) return 'Cardio';
  if (s.includes('strength') || s.includes('weight') || s.includes('traditional') || s.includes('resistance')) return 'Strength';
  return 'Strength';
}

function doTimesOverlap(
  healthStart: Date,
  healthEnd: Date,
  zealStartISO: string,
  zealDurationMin: number,
  toleranceMs: number = 25 * 60 * 1000,
): boolean {
  const zealStart = new Date(zealStartISO);
  const zealEnd = new Date(zealStart.getTime() + zealDurationMin * 60 * 1000);
  return (
    healthStart.getTime() <= zealEnd.getTime() + toleranceMs &&
    healthEnd.getTime() >= zealStart.getTime() - toleranceMs
  );
}

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getWeekStart(): string {
  const d = new Date();
  const weekStart = new Date(d);
  weekStart.setDate(d.getDate() - d.getDay());
  return `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
}

function epley1RM(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return weight * (1 + reps / 30);
}

function weightAtReps(oneRM: number, reps: number): number {
  if (reps <= 1) return oneRM;
  return oneRM / (1 + reps / 30);
}

function parseEngineSuggestedWeight(raw: string): number {
  if (!raw || raw === 'BW' || raw === 'Bodyweight') return 0;
  const match = raw.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

function getOverloadIncrement(exercise: WorkoutExercise): number {
  if (exercise.movementType === 'heavyCompound') return 10;
  if (exercise.movementType === 'moderateCompound') return 5;
  return 2.5; // isolation
}

function getRoundingStep(exercise: WorkoutExercise): number {
  return exercise.equipment?.toLowerCase().includes('dumbbell') ? 2.5 : 5;
}

function getSuggestedWeight(
  exercise: WorkoutExercise,
  prHistory: PersonalRecord[],
  workoutHistory: WorkoutLog[],
  fitnessLevel: string,
  sex: string,
  bodyweightLbs: number,
): { suggestedWeight: number; lastWeight: number; lastReps: number; oneRepMax: number } {
  const targetReps = parseInt(exercise.reps, 10) || 8;
  const roundTo = getRoundingStep(exercise);
  const increment = getOverloadIncrement(exercise);

  let best1RM = 0;
  let lastWeight = 0;
  let lastReps = 0;
  let foundLast = false;

  // Tier 1: Workout history — progressive overload from logged sessions
  for (const log of workoutHistory) {
    const exerciseLog = log.exercises.find(e => e.exerciseName === exercise.name);
    if (!exerciseLog) continue;
    const doneSets = exerciseLog.sets.filter(s => s.done && s.weight > 0 && s.reps > 0);
    if (doneSets.length === 0) continue;

    if (!foundLast) {
      const bestInSession = doneSets.reduce((best, s) =>
        epley1RM(s.weight, s.reps) > epley1RM(best.weight, best.reps) ? s : best
      , doneSets[0]);
      lastWeight = bestInSession.weight;
      lastReps = bestInSession.reps;
      foundLast = true;
    }

    for (const s of doneSets) {
      const rm = epley1RM(s.weight, s.reps);
      if (rm > best1RM) best1RM = rm;
    }
  }

  if (best1RM > 0) {
    const targetWeight = weightAtReps(best1RM, targetReps);
    const progressive = Math.round((targetWeight + increment) / roundTo) * roundTo;
    __DEV__ && console.log(`[Suggest] ${exercise.name}: 1RM=${Math.round(best1RM)}, @${targetReps}reps=${Math.round(targetWeight)}, +${increment}→${progressive}`);
    return { suggestedWeight: progressive, lastWeight, lastReps, oneRepMax: Math.round(best1RM) };
  }

  // Tier 2: PR history fallback
  const exercisePRs = prHistory.filter(pr => pr.exerciseName === exercise.name);
  const lastWeightPR = exercisePRs.find(pr => pr.type === 'weight');
  const lastRepsPR = exercisePRs.find(pr => pr.type === 'reps');

  if (lastWeightPR) {
    const prReps = lastRepsPR?.value ?? targetReps;
    const oneRM = epley1RM(lastWeightPR.value, prReps);
    const targetWeight = weightAtReps(oneRM, targetReps);
    const progressive = Math.round((targetWeight + increment) / roundTo) * roundTo;
    __DEV__ && console.log(`[Suggest] ${exercise.name} (PR fallback): 1RM=${Math.round(oneRM)}, +${increment}→${progressive}`);
    return { suggestedWeight: progressive, lastWeight: lastWeightPR.value, lastReps: prReps, oneRepMax: Math.round(oneRM) };
  }

  // Tier 3: AI/engine suggested weight string
  const engineWeight = parseEngineSuggestedWeight(exercise.suggestedWeight);
  if (engineWeight > 0) {
    __DEV__ && console.log(`[Suggest] ${exercise.name} (no data, engine): engineLoad=${engineWeight}`);
    return { suggestedWeight: engineWeight, lastWeight: 0, lastReps: 0, oneRepMax: 0 };
  }

  // Tier 4: Bodyweight-scaled defaults
  const bw = bodyweightLbs > 0 ? bodyweightLbs : 160; // fallback if not set
  const isHeavyCompound = exercise.movementType === 'heavyCompound';
  const isModerateCompound = exercise.movementType === 'moderateCompound';
  const isLowerBody = ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Legs'].includes(exercise.muscleGroup);
  const isUpperBack = ['Back', 'Lats', 'Traps'].includes(exercise.muscleGroup);
  const isChestShoulder = ['Chest', 'Shoulders'].includes(exercise.muscleGroup);
  const isArms = ['Biceps', 'Triceps', 'Forearms'].includes(exercise.muscleGroup);

  let multiplier: number;
  if (isHeavyCompound && isLowerBody) multiplier = 0.75;
  else if (isHeavyCompound && isUpperBack) multiplier = 0.55;
  else if (isHeavyCompound && isChestShoulder) multiplier = 0.50;
  else if (isModerateCompound && isLowerBody) multiplier = 0.45;
  else if (isModerateCompound) multiplier = 0.35;
  else if (isArms) multiplier = 0.12;
  else multiplier = 0.15;

  const sexMul = sex === 'female' ? 0.6 : 1.0;
  const levelMul = fitnessLevel === 'beginner' ? 0.6 : fitnessLevel === 'advanced' ? 1.4 : 1.0;
  const suggested = Math.max(5, Math.round(bw * multiplier * sexMul * levelMul / roundTo) * roundTo);
  __DEV__ && console.log(`[Suggest] ${exercise.name} (no data, BW-scaled): BW=${bw}, mul=${multiplier}, suggested=${suggested}`);
  return { suggestedWeight: suggested, lastWeight: 0, lastReps: 0, oneRepMax: 0 };
}

export const [WorkoutTrackingProvider, useWorkoutTracking] = createContextHook(() => {
  const ctx = useAppContext();
  const currentWorkoutTitleRef = useRef(ctx.currentWorkoutTitle);
  currentWorkoutTitleRef.current = ctx.currentWorkoutTitle;
  const { hasPro, proStatusReady } = useSubscription();

  const [isWorkoutActive, setIsWorkoutActive] = useState<boolean>(false);
  const [_workoutStartTime, setWorkoutStartTime] = useState<number>(0);
  // workoutElapsed and restTimeRemaining are tracked via refs only (workoutElapsedRef, restRemainingRef)
  // to avoid re-rendering the entire context tree every 500ms.
  // Components that need live values use useWorkoutElapsed() or useRestTimeRemaining() hooks.
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const [restTimeTotal, setRestTimeTotal] = useState<number>(0);
  const [isRestActive, setIsRestActive] = useState<boolean>(false);
  const [showRestTimer, setShowRestTimer] = useState<boolean>(false);
  const [isTimerMinimized, setIsTimerMinimized] = useState<boolean>(false);
  const [autoRestTimer, setAutoRestTimer] = useState<boolean>(true);
  const autoRestTimerRef = useRef<boolean>(true);

  const [exerciseLogs, setExerciseLogs] = useState<Record<string, ExerciseLog>>({});
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);

  const [postWorkoutStep, setPostWorkoutStep] = useState<PostWorkoutStep>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>('moderate');
  const [selectedStarRating, setSelectedStarRating] = useState<number>(3);
  const [selectedRpe, setSelectedRpe] = useState<number>(6);
  const [whatWentWell, setWhatWentWell] = useState<string[]>([]);
  const [sessionScoreBreakdown, setSessionScoreBreakdown] = useState<TrainingScoreBreakdown | null>(null);
  const [sessionPRs, setSessionPRs] = useState<PersonalRecord[]>([]);
  const [confirmedPRs, setConfirmedPRs] = useState<PersonalRecord[]>([]);

  const [workoutHistory, setWorkoutHistory] = useState<WorkoutLog[]>([]);
  const [prHistory, setPrHistory] = useState<PersonalRecord[]>([]);
  const [weeklyHoursMin, setWeeklyHoursMin] = useState<number>(0);

  const [activeWorkout, setActiveWorkout] = useState<GeneratedWorkout | null>(null);
  const [currentGeneratedWorkout, setCurrentGeneratedWorkout] = useState<GeneratedWorkout | null>(null);
  const [isGeneratingWorkout, setIsGeneratingWorkout] = useState(false);
  const generatedForDateRef = useRef<string | null>(null);
  const generationReqIdRef = useRef(0);
  const generationInFlightRef = useRef(false);
  const proWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** False until AsyncStorage daily snapshot has been read (avoids duplicate generation on cold start). */
  const snapshotHydratedRef = useRef(false);
  const pendingEnsureAfterHydrateRef = useRef(false);
  const ensureTodayWorkoutGeneratedRef = useRef<() => void>(() => {});

  function resolvePushPullLegs(muscleReadiness: MuscleReadinessItem[]): 'Push' | 'Pull' | 'Legs' {
    const readinessMap: Record<string, number> = {};
    for (const m of muscleReadiness) readinessMap[m.name] = m.value;

    const avg = (muscles: string[]) => {
      const vals = muscles.map(m => readinessMap[m] ?? 80);
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };

    const pushScore = avg(['Chest', 'Shoulders', 'Triceps']);
    const pullScore = avg(['Back', 'Biceps']);
    const legsScore = avg(['Quads', 'Hamstrings', 'Glutes', 'Calves']);

    if (pushScore >= pullScore && pushScore >= legsScore) return 'Push';
    if (pullScore > pushScore && pullScore >= legsScore) return 'Pull';
    return 'Legs';
  }

  const ensureTodayWorkoutGenerated = useCallback(async () => {
    // Re-entrancy guard for quick tab presses.
    if (isGeneratingWorkout) return;
    if (generationInFlightRef.current) return;
    if (isWorkoutActive) return;

    if (!snapshotHydratedRef.current) {
      pendingEnsureAfterHydrateRef.current = true;
      return;
    }

    // Avoid generating with a wrong entitlement snapshot on fresh open.
    if (!proStatusReady) {
      if (!proWaitTimerRef.current) {
        proWaitTimerRef.current = setTimeout(() => {
          proWaitTimerRef.current = null;
          ensureTodayWorkoutGeneratedRef.current();
        }, 250);
      }
      return;
    }

    const todayStr = getTodayStr();
    const hasPlan = !!ctx.activePlan;
    const ov = ctx.workoutOverride;

    // Drop stale workout if calendar day rolled (e.g. app left open past midnight).
    if (currentGeneratedWorkout) {
      const refDay = generatedForDateRef.current;
      if (refDay === todayStr) {
        // Already have a workout generated for today — keep it.
        return;
      } else if (refDay !== null && refDay !== todayStr) {
        setCurrentGeneratedWorkout(null);
        generatedForDateRef.current = null;
        void AsyncStorage.removeItem(DAILY_GENERATED_SNAPSHOT_KEY).catch(() => {});
      } else {
        // refDay is null — workout loaded from snapshot hydration
        generatedForDateRef.current = todayStr;
        return;
      }
    }

    const todayPrescription = ctx.getTodayPrescription();
    const lm = ctx.lastModifyState;

    // Mimic the effective-params logic from the Workout tab.
    let effectiveStyle = ov?.style ?? (
      hasPlan && todayPrescription?.style
        ? todayPrescription.style
        : (lm?.style ?? ctx.workoutStyle)
    );
    const rawSplit = ov?.split ?? (
      hasPlan && todayPrescription?.session_type
        ? todayPrescription.session_type
        : (lm?.split ?? ctx.trainingSplit)
    );
    const effectiveSplit = rawSplit === 'Push, Pull, Legs'
      ? resolvePushPullLegs(ctx.muscleReadiness)
      : rawSplit;
    const effectiveDuration = ov?.duration ?? (
      hasPlan && todayPrescription?.target_duration
        ? todayPrescription.target_duration
        : (lm?.duration ?? ctx.targetDuration)
    );
    const effectiveRest = ov?.rest ?? (lm?.rest ?? ctx.restBetweenSets);
    const effectiveMuscles = hasPlan ? [] : (lm?.muscles ?? []);

    if (!hasPro && PRO_STYLES_SET.has(effectiveStyle)) {
      effectiveStyle = 'Strength';
    }

    const prescription = (!ov && hasPlan) ? todayPrescription : null;

    // Use plan's stored equipment for plan workouts; fall back to user's global settings
    const effectiveEquipment = (prescription && hasPlan)
      ? (ctx.activePlan?.equipment ?? ctx.selectedEquipment)
      : ctx.selectedEquipment;

    const params = {
      style: effectiveStyle,
      split: effectiveSplit,
      targetDuration: effectiveDuration,
      restSlider: effectiveRest,
      availableEquipment: effectiveEquipment,
      fitnessLevel: ctx.fitnessLevel,
      sex: ctx.sex,
      specialLifeCase: ctx.specialLifeCase,
      specialLifeCaseDetail: ctx.specialLifeCaseDetail,
      warmUp: ctx.warmUp,
      coolDown: ctx.coolDown,
      recovery: ctx.recovery,
      addCardio: ctx.addCardio,
      specificMuscles: effectiveMuscles,
      seedOffset: 0,
      // Pass plan phase context so generation matches current training phase
      planPhase: prescription?.phase,
      volumeModifier: prescription?.volume_modifier,
      exercisePreferences: ctx.exercisePreferences,
    };

    // If we have a pre-generated plan day workout in cache, use it directly — skip AI call
    if (hasPlan && !ov) {
      try {
        const planCacheKey = `@zeal_plan_day_workout_${ctx.activePlan?.id}_${todayStr}`;
        const cached = await AsyncStorage.getItem(planCacheKey);
        if (cached) {
          const cachedWorkout: GeneratedWorkout = JSON.parse(cached);
          cachedWorkout.workout = enforceStyleGrouping(cachedWorkout.workout, cachedWorkout.style);
          generatedForDateRef.current = todayStr;
          setCurrentGeneratedWorkout(cachedWorkout);
          ctx.setCurrentWorkoutTitle(
            buildCreativeWorkoutTitle({
              style: cachedWorkout.style,
              split: cachedWorkout.split,
              metconFormat: cachedWorkout.metconFormat,
              duration: cachedWorkout.estimatedDuration,
              previousTitle: currentWorkoutTitleRef.current,
            })
          );
          return;
        }
      } catch {
        // Cache read failed — fall through to normal generation
      }
    }

    const reqId = ++generationReqIdRef.current;
    generationInFlightRef.current = true;
    setIsGeneratingWorkout(true);

    const aiPromise = (async (): Promise<GeneratedWorkout> => {
      try {
        let w = await generateWorkoutAsync(params, prescription, hasPro);
        if (ctx.coreFinisher) {
          try {
            const coreExercises = generateCoreFinisherFromEngine({
                fitnessLevel: ctx.fitnessLevel,
                availableEquipment: effectiveEquipment,
              });
            w = { ...w, coreFinisher: coreExercises };
          } catch (err) {
            __DEV__ && console.log('[WorkoutTracking] Core finisher failed, skipping:', err);
          }
        }
        return w;
      } catch (err) {
        __DEV__ && console.log('[WorkoutTracking] Generation failed, falling back:', err);
        return generateWorkout(params, prescription);
      }
    })();

    const timeoutPromise = new Promise<GeneratedWorkout>((resolve) => {
      setTimeout(() => {
        resolve(generateWorkout(params, prescription));
      }, 20000);
    });

    Promise.race([aiPromise, timeoutPromise])
      .then((w) => {
        if (generationReqIdRef.current !== reqId) return;
        generatedForDateRef.current = todayStr;
        setCurrentGeneratedWorkout(w);
        ctx.setCurrentWorkoutTitle(
          buildCreativeWorkoutTitle({
            style: w.style,
            split: w.split,
            metconFormat: w.metconFormat,
            duration: w.estimatedDuration,
            previousTitle: currentWorkoutTitleRef.current,
          })
        );
      })
      .catch((err) => {
        __DEV__ && console.log('[WorkoutTracking] ensureTodayWorkoutGenerated error:', err);
      })
      .finally(() => {
        if (generationReqIdRef.current !== reqId) return;
        generationInFlightRef.current = false;
        setIsGeneratingWorkout(false);
      });
  }, [
    isGeneratingWorkout,
    isWorkoutActive,
    currentGeneratedWorkout,
    ctx,
    hasPro,
    proStatusReady,
  ]);

  useEffect(() => {
    ensureTodayWorkoutGeneratedRef.current = () => {
      void ensureTodayWorkoutGenerated();
    };
  }, [ensureTodayWorkoutGenerated]);

  const [calendarModalVisible, setCalendarModalVisible] = useState<boolean>(false);
  const [workoutLogDetailVisible, setWorkoutLogDetailVisible] = useState<boolean>(false);
  const [buildWorkoutVisible, setBuildWorkoutVisible] = useState<boolean>(false);
  const [workoutPlanVisible, setWorkoutPlanVisible] = useState<boolean>(false);
  // Plan type chooser — gates access to all three builder drawers (strength,
  // run, hybrid). Home + FAB + Run tab all open this same chooser so the
  // "Start a Plan" entry point is unified across the app.
  const [planChooserVisible, setPlanChooserVisible] = useState<boolean>(false);
  const [exerciseCatalogVisible, setExerciseCatalogVisible] = useState<boolean>(false);
  const [activePlanVisible, setActivePlanVisible] = useState<boolean>(false);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  const [pendingHealthImports, setPendingHealthImports] = useState<HealthImportItem[]>([]);
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
  const [healthImportReviewVisible, setHealthImportReviewVisible] = useState<boolean>(false);
  const [historyLoaded, setHistoryLoaded] = useState<boolean>(false);
  /** Becomes true after daily workout snapshot is read from disk (triggers persist effect). */
  const [dailySnapshotReady, setDailySnapshotReady] = useState(false);
  const hasScanedHealthRef = useRef<boolean>(false);
  const saveTimeRef = useRef<number>(0);

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const workoutTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restTotalRef = useRef<number>(0);
  const restRemainingRef = useRef<number>(0);
  // Wall-clock anchors — used to stay accurate across background/foreground cycles
  const workoutStartWallRef = useRef<number>(0);   // Date.now() when workout started (adjusted for elapsed on resume)
  const restEndWallRef = useRef<number>(0);          // Date.now() when rest timer should reach zero
  const workoutElapsedRef = useRef<number>(0);

  useEffect(() => {
    void Promise.all([
      AsyncStorage.getItem(HISTORY_KEY),
      AsyncStorage.getItem(PR_KEY),
      AsyncStorage.getItem(WEEKLY_HOURS_KEY),
      AsyncStorage.getItem(DAILY_GENERATED_SNAPSHOT_KEY),
    ]).then(([historyRaw, prRaw, hoursRaw, dailyRaw]) => {
      let loadedHistory: WorkoutLog[] = [];
      if (historyRaw) {
        try { loadedHistory = JSON.parse(historyRaw); setWorkoutHistory(loadedHistory); } catch (e) { __DEV__ && console.log('[Tracking] history parse error', e); }
      }
      // If no workout history, ensure muscle readiness is fully reset
      if (loadedHistory.length === 0) {
        const hasStaleReadiness = ctx.muscleReadiness.some(m => m.value < 100);
        if (hasStaleReadiness) {
          const fresh = ctx.muscleReadiness.map(m => ({ ...m, status: 'ready' as const, value: 100, lastWorked: 'Never' }));
          ctx.setMuscleReadiness(fresh);
          ctx.saveState();
          __DEV__ && console.log('[Tracking] Reset stale muscle readiness — no workout history');
        }
      }
      if (prRaw) {
        try { setPrHistory(JSON.parse(prRaw)); } catch (e) { __DEV__ && console.log('[Tracking] PR parse error', e); }
      }
      if (hoursRaw) {
        try {
          const data = JSON.parse(hoursRaw);
          if (data.weekStart === getWeekStart()) {
            setWeeklyHoursMin(data.minutes);
          }
        } catch (e) { __DEV__ && console.log('[Tracking] hours parse error', e); }
      }

      const todayStr = getTodayStr();
      if (dailyRaw) {
        try {
          const data = JSON.parse(dailyRaw) as DailyGeneratedSnapshot;
          if (data?.date === todayStr && data?.workout) {
            setCurrentGeneratedWorkout(data.workout);
            generatedForDateRef.current = todayStr;
            if (typeof data.title === 'string' && data.title.trim()) {
              ctx.setCurrentWorkoutTitle(data.title);
            } else {
              ctx.setCurrentWorkoutTitle(
                buildCreativeWorkoutTitle({
                  style: data.workout.style,
                  split: data.workout.split,
                  metconFormat: data.workout.metconFormat,
                  duration: data.workout.estimatedDuration,
                })
              );
            }
          } else if (data?.date && data.date !== todayStr) {
            void AsyncStorage.removeItem(DAILY_GENERATED_SNAPSHOT_KEY).catch(() => {});
          }
        } catch (e) {
          __DEV__ && console.log('[Tracking] daily snapshot parse error', e);
          void AsyncStorage.removeItem(DAILY_GENERATED_SNAPSHOT_KEY).catch(() => {});
        }
      }

      snapshotHydratedRef.current = true;
      setDailySnapshotReady(true);
      setHistoryLoaded(true);
      __DEV__ && console.log('[Tracking] Loaded history, PRs, hours, daily snapshot');

      if (pendingEnsureAfterHydrateRef.current) {
        pendingEnsureAfterHydrateRef.current = false;
        setTimeout(() => {
          ensureTodayWorkoutGeneratedRef.current();
        }, 0);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time hydrate; ctx.setCurrentWorkoutTitle is stable
  }, []);

  useEffect(() => {
    if (!dailySnapshotReady || !currentGeneratedWorkout) return;
    const day = getTodayStr();
    const payload: DailyGeneratedSnapshot = {
      date: day,
      workout: currentGeneratedWorkout,
      title: ctx.currentWorkoutTitle || '',
    };
    void AsyncStorage.setItem(DAILY_GENERATED_SNAPSHOT_KEY, JSON.stringify(payload));
  }, [dailySnapshotReady, currentGeneratedWorkout, ctx.currentWorkoutTitle]);

  const resetTrackingData = useCallback(async () => {
    __DEV__ && console.log('[Tracking] Resetting all tracking data for new user');
    setWorkoutHistory([]);
    setPrHistory([]);
    setWeeklyHoursMin(0);
    setHistoryLoaded(false);
    setCurrentGeneratedWorkout(null);
    generatedForDateRef.current = null;
    hasScanedHealthRef.current = false;
    try {
      await Promise.all([
        AsyncStorage.removeItem(HISTORY_KEY),
        AsyncStorage.removeItem(PR_KEY),
        AsyncStorage.removeItem(WEEKLY_HOURS_KEY),
        AsyncStorage.removeItem(SEEN_HEALTH_IMPORTS_KEY),
        AsyncStorage.removeItem(DAILY_GENERATED_SNAPSHOT_KEY),
      ]);
    } catch (e) {
      __DEV__ && console.log('[Tracking] error clearing tracking storage', e);
    }
    setHistoryLoaded(true);
  }, []);

  const prevResetTokenRef = useRef<number>(ctx.newUserResetToken);
  useEffect(() => {
    if (ctx.newUserResetToken !== 0 && ctx.newUserResetToken !== prevResetTokenRef.current) {
      prevResetTokenRef.current = ctx.newUserResetToken;
      void resetTrackingData();
    }
  }, [ctx.newUserResetToken, resetTrackingData]);

  useEffect(() => {
    if (!historyLoaded) return;
    if (!ctx.healthConnected || !ctx.healthSyncEnabled) return;
    if (Platform.OS === 'web') return;
    if (hasScanedHealthRef.current) return;
    hasScanedHealthRef.current = true;

    __DEV__ && console.log('[HealthImport] Starting initial health scan...');

    void AsyncStorage.getItem(SEEN_HEALTH_IMPORTS_KEY).then(seenRaw => {
      const seen = new Set<string>(seenRaw ? (JSON.parse(seenRaw) as string[]) : []);

      healthService.getRecentWorkouts(7).then(sessions => {
        __DEV__ && console.log('[HealthImport] Found', sessions.length, 'health sessions');
        const newImports: HealthImportItem[] = [];
        const newDups: DuplicateCandidate[] = [];

        for (const session of sessions) {
          if (seen.has(session.id)) continue;

          const sd = session.startDate;
          const dateStr = `${sd.getFullYear()}-${String(sd.getMonth() + 1).padStart(2, '0')}-${String(sd.getDate()).padStart(2, '0')}`;
          const suggestedStyle = mapHealthActivityToZealStyle(session.activityType);

          const item: HealthImportItem = {
            id: session.id,
            startDate: session.startDate.toISOString(),
            endDate: session.endDate.toISOString(),
            duration: session.duration,
            activityType: session.activityType,
            calories: session.calories,
            sourceName: session.sourceName,
            suggestedStyle,
            dateStr,
          };

          const zealLogsForDay = workoutHistory.filter(l => l.date === dateStr);
          let foundDup = false;

          for (const zealLog of zealLogsForDay) {
            if (zealLog.startTime) {
              if (doTimesOverlap(session.startDate, session.endDate, zealLog.startTime, zealLog.duration)) {
                newDups.push({ id: `dup_${session.id}_${zealLog.id}`, healthImport: item, zealLog });
                foundDup = true;
              }
            } else if (Math.abs(zealLog.duration - session.duration) <= 20) {
              newDups.push({ id: `dup_${session.id}_${zealLog.id}`, healthImport: item, zealLog });
              foundDup = true;
            }
          }

          if (!foundDup) newImports.push(item);
        }

        setPendingHealthImports(newImports);
        setDuplicateCandidates(newDups);
        __DEV__ && console.log('[HealthImport] Pending imports:', newImports.length, 'Duplicates:', newDups.length);
      }).catch(e => __DEV__ && console.log('[HealthImport] getRecentWorkouts error:', e));
    }).catch(e => __DEV__ && console.log('[HealthImport] AsyncStorage error:', e));
  }, [historyLoaded, ctx.healthConnected, ctx.healthSyncEnabled]);

  // (workoutElapsed is now ref-only — no state sync needed)

  useEffect(() => {
    if (isWorkoutActive && !isPaused) {
      // Anchor to wall clock — preserves accumulated elapsed across pause/resume and background
      workoutStartWallRef.current = Date.now() - workoutElapsedRef.current * 1000;
      workoutTimerRef.current = setInterval(() => {
        workoutElapsedRef.current = Math.floor((Date.now() - workoutStartWallRef.current) / 1000);
      }, 500);
    } else {
      if (workoutTimerRef.current) {
        clearInterval(workoutTimerRef.current);
        workoutTimerRef.current = null;
      }
    }
    return () => {
      if (workoutTimerRef.current) clearInterval(workoutTimerRef.current);
    };
  }, [isWorkoutActive, isPaused]);

  useEffect(() => {
    if (isRestActive) {
      restTimerRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((restEndWallRef.current - Date.now()) / 1000));
        restRemainingRef.current = remaining;
        if (remaining <= 0) {
          setIsRestActive(false);
          if (Platform.OS !== 'web') {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            void cancelRestCompleteNotification();
          }
        }
      }, 500);
    } else {
      if (restTimerRef.current) {
        clearInterval(restTimerRef.current);
        restTimerRef.current = null;
      }
    }
    return () => {
      if (restTimerRef.current) clearInterval(restTimerRef.current);
    };
  }, [isRestActive]);

  // Snap both timers to wall-clock truth the moment the app comes back to foreground
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      // Going to background — schedule notification if rest timer is active
      if (prevState === 'active' && nextState !== 'active') {
        if (isRestActive && Platform.OS !== 'web') {
          const remaining = Math.max(0, Math.ceil((restEndWallRef.current - Date.now()) / 1000));
          if (remaining > 0) {
            void scheduleRestCompleteNotification(remaining);
          }
        }
        return;
      }

      // Coming back to foreground — cancel any pending notification + sync timers
      if (nextState === 'active') {
        if (Platform.OS !== 'web') {
          void cancelRestCompleteNotification();
        }
        if (isWorkoutActive && !isPaused) {
          const corrected = Math.floor((Date.now() - workoutStartWallRef.current) / 1000);
          workoutElapsedRef.current = corrected;
        }
        if (isRestActive) {
          const remaining = Math.max(0, Math.ceil((restEndWallRef.current - Date.now()) / 1000));
          restRemainingRef.current = remaining;
          if (remaining <= 0) {
            setIsRestActive(false);
          }
        }
      }
    };
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [isWorkoutActive, isPaused, isRestActive]);

  const startWorkout = useCallback((workout: GeneratedWorkout, preserveLogs = false) => {
    __DEV__ && console.log('[Tracking] Starting workout:', workout.split, 'preserveLogs:', preserveLogs);
    setActiveWorkout(workout);
    setIsWorkoutActive(true);
    setWorkoutStartTime(Date.now());
    workoutStartWallRef.current = Date.now();
    workoutElapsedRef.current = 0;
    setIsPaused(false);
    if (!preserveLogs) {
      setExerciseLogs({});
    }
    setExpandedExercise(null);
    setSessionPRs([]);
    setConfirmedPRs([]);
    setShowRestTimer(true);
  }, []);

  const pauseWorkout = useCallback(() => {
    setIsPaused(prev => !prev);
  }, []);

  const resetWorkout = useCallback(() => {
    __DEV__ && console.log('[Tracking] Resetting workout');
    setIsWorkoutActive(false);
    workoutElapsedRef.current = 0;
    setIsPaused(false);
    setExerciseLogs({});
    setExpandedExercise(null);
    setShowRestTimer(false);
    setIsRestActive(false);
    restRemainingRef.current = 0;
    setActiveWorkout(null);
    setSessionPRs([]);
    setConfirmedPRs([]);
    setIsTimerMinimized(false);
  }, []);

  const startRestTimer = useCallback((seconds: number) => {
    __DEV__ && console.log('[Tracking] Starting rest timer:', seconds, 's');
    restTotalRef.current = seconds;
    restRemainingRef.current = seconds;
    restEndWallRef.current = Date.now() + seconds * 1000;
    setRestTimeTotal(seconds);
    setIsRestActive(true);
    setShowRestTimer(true);
    // Notification is only scheduled when app goes to background (AppState listener)
  }, []);

  const handleSetAutoRestTimer = useCallback((value: boolean) => {
    autoRestTimerRef.current = value;
    setAutoRestTimer(value);
  }, []);

  const adjustRestTimer = useCallback((delta: number) => {
    // Shift the end timestamp by delta — stays accurate even after backgrounding
    restEndWallRef.current = Math.max(Date.now(), restEndWallRef.current + delta * 1000);
    const newRemaining = Math.max(0, Math.ceil((restEndWallRef.current - Date.now()) / 1000));
    restRemainingRef.current = newRemaining;
    // Notification rescheduled automatically if app is backgrounded (AppState listener)
    if (!isRestActive && newRemaining > 0) {
      setIsRestActive(true);
    }
  }, [isRestActive]);

  const setRestPreset = useCallback((seconds: number) => {
    restTotalRef.current = seconds;
    restRemainingRef.current = seconds;
    restEndWallRef.current = Date.now() + seconds * 1000;
    setRestTimeTotal(seconds);
    setIsRestActive(true);
    setShowRestTimer(true);
    // Notification is only scheduled when app goes to background (AppState listener)
  }, []);

  const cancelRestTimer = useCallback(() => {
    setIsRestActive(false);
    restRemainingRef.current = 0;
    setIsTimerMinimized(false);
    if (Platform.OS !== 'web') {
      void cancelRestCompleteNotification();
    }
  }, []);

  const initExerciseLog = useCallback((exercise: WorkoutExercise) => {
    const existing = exerciseLogs[exercise.id];
    if (existing) return;

    const weightData = getSuggestedWeight(exercise, prHistory, workoutHistory, ctx.fitnessLevel, ctx.sex, ctx.weight);
    const targetReps = parseInt(exercise.reps, 10) || 8;

    const sets: SetLog[] = Array.from({ length: exercise.sets }, (_, i) => ({
      setNumber: i + 1,
      weight: Math.round(weightData.suggestedWeight / 5) * 5,
      reps: weightData.lastReps > 0 ? weightData.lastReps : targetReps,
      done: false,
    }));

    const log: ExerciseLog = {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      muscleGroup: exercise.muscleGroup,
      sets,
      completed: false,
      prHit: false,
    };

    setExerciseLogs(prev => ({ ...prev, [exercise.id]: log }));
    __DEV__ && console.log('[Tracking] Initialized exercise log:', exercise.name, 'suggested:', weightData.suggestedWeight, 'last:', weightData.lastWeight);
  }, [exerciseLogs, prHistory, workoutHistory, ctx.fitnessLevel, ctx.sex, ctx.weight]);

  const updateSetLog = useCallback((exerciseId: string, setIndex: number, field: 'weight' | 'reps', value: number) => {
    setExerciseLogs(prev => {
      const log = prev[exerciseId];
      if (!log) return prev;
      const newSets = [...log.sets];
      newSets[setIndex] = { ...newSets[setIndex], [field]: value };
      return { ...prev, [exerciseId]: { ...log, sets: newSets } };
    });
  }, []);

  const applyWeightToAllSets = useCallback((exerciseId: string, weight: number) => {
    setExerciseLogs(prev => {
      const log = prev[exerciseId];
      if (!log) return prev;
      const newSets = log.sets.map(s => ({ ...s, weight }));
      return { ...prev, [exerciseId]: { ...log, sets: newSets } };
    });
  }, []);

  const markSetDone = useCallback((exerciseId: string, setIndex: number, restSeconds: number) => {
    const currentLog = exerciseLogs[exerciseId];
    if (!currentLog) return;
    const willBeMarkedDone = !currentLog.sets[setIndex]?.done;

    setExerciseLogs(prev => {
      const log = prev[exerciseId];
      if (!log) return prev;
      const newSets = [...log.sets];
      newSets[setIndex] = { ...newSets[setIndex], done: !newSets[setIndex].done };

      if (newSets[setIndex].done) {
        const set = newSets[setIndex];
        const currentVolume = set.weight * set.reps;
        const exercisePRs = prHistory.filter(pr => pr.exerciseName === log.exerciseName);
        const hasExistingWeight = exercisePRs.some(pr => pr.type === 'weight');
        const hasExistingReps = exercisePRs.some(pr => pr.type === 'reps');
        const hasExistingVolume = exercisePRs.some(pr => pr.type === 'volume');
        const maxWeight = exercisePRs.find(pr => pr.type === 'weight')?.value ?? 0;
        const maxReps = exercisePRs.find(pr => pr.type === 'reps')?.value ?? 0;
        const maxVolume = exercisePRs.find(pr => pr.type === 'volume')?.value ?? 0;

        let prHit = false;
        const newPRs: PersonalRecord[] = [];

        if (hasExistingWeight && set.weight > maxWeight && set.weight > 0) {
          newPRs.push({ exerciseName: log.exerciseName, type: 'weight', value: set.weight, date: getTodayStr(), sessionId: '' });
          prHit = true;
        }
        if (hasExistingReps && set.reps > maxReps && set.reps > 0) {
          newPRs.push({ exerciseName: log.exerciseName, type: 'reps', value: set.reps, date: getTodayStr(), sessionId: '' });
          prHit = true;
        }
        if (hasExistingVolume && currentVolume > maxVolume && currentVolume > 0) {
          newPRs.push({ exerciseName: log.exerciseName, type: 'volume', value: currentVolume, date: getTodayStr(), sessionId: '' });
          prHit = true;
        }

        if (prHit) {
          setSessionPRs(prev => [...prev, ...newPRs]);
          if (Platform.OS !== 'web') {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          __DEV__ && console.log('[Tracking] PR detected (beaten existing record)!', newPRs);
        }
      }

      return { ...prev, [exerciseId]: { ...log, sets: newSets, prHit: log.prHit || newSets[setIndex].done } };
    });

    if (willBeMarkedDone && restSeconds > 0 && autoRestTimerRef.current) {
      __DEV__ && console.log('[Tracking] Auto-starting rest timer after set done:', restSeconds, 's');
      startRestTimer(restSeconds);
    }
  }, [exerciseLogs, prHistory, startRestTimer]);

  const addSet = useCallback((exerciseId: string) => {
    setExerciseLogs(prev => {
      const log = prev[exerciseId];
      if (!log) return prev;
      const lastSet = log.sets[log.sets.length - 1];
      const newSet: SetLog = {
        setNumber: log.sets.length + 1,
        weight: lastSet?.weight ?? 0,
        reps: lastSet?.reps ?? 8,
        done: false,
      };
      return { ...prev, [exerciseId]: { ...log, sets: [...log.sets, newSet] } };
    });
  }, []);

  const removeSet = useCallback((exerciseId: string, setIndex: number) => {
    setExerciseLogs(prev => {
      const log = prev[exerciseId];
      if (!log || log.sets.length <= 1) return prev;
      const newSets = log.sets
        .filter((_, i) => i !== setIndex)
        .map((s, i) => ({ ...s, setNumber: i + 1 }));
      __DEV__ && console.log('[Tracking] removeSet:', exerciseId, 'setIndex:', setIndex);
      return { ...prev, [exerciseId]: { ...log, sets: newSets } };
    });
  }, []);

  const unmarkExerciseComplete = useCallback((exerciseId: string) => {
    __DEV__ && console.log('[Tracking] unmarkExerciseComplete:', exerciseId);
    setExerciseLogs(prev => {
      const log = prev[exerciseId];
      if (!log) return prev;
      return { ...prev, [exerciseId]: { ...log, completed: false } };
    });
  }, []);

  const markExerciseComplete = useCallback((exerciseId: string, restSeconds?: number) => {
    __DEV__ && console.log('[Tracking] markExerciseComplete:', exerciseId, 'restSeconds:', restSeconds);
    setExerciseLogs(prev => {
      const log = prev[exerciseId];
      if (!log) return prev;
      return { ...prev, [exerciseId]: { ...log, completed: true } };
    });
    setExpandedExercise(null);
    if (restSeconds && restSeconds > 0 && autoRestTimerRef.current) {
      startRestTimer(restSeconds);
    }
  }, [startRestTimer]);

  const updateExerciseResult = useCallback((exerciseId: string, field: string, value: string) => {
    setExerciseLogs(prev => {
      const log = prev[exerciseId];
      if (!log) return prev;
      return { ...prev, [exerciseId]: { ...log, [field]: value } };
    });
  }, []);

  const calculateScore = useCallback((starRating: number, prsForBonus: PersonalRecord[]): TrainingScoreBreakdown => {
    const elapsed = workoutElapsedRef.current;
    const basePoints = Math.floor(elapsed / 300);
    const totalSets = Object.values(exerciseLogs).reduce((acc, log) => acc + log.sets.filter(s => s.done).length, 0);
    const volumePoints = Math.floor(totalSets / 20);
    const totalVolume = Object.values(exerciseLogs).reduce((acc, log) =>
      acc + log.sets.filter(s => s.done).reduce((sum, s) => sum + s.weight * s.reps, 0), 0
    );
    const intensityPoints = Math.floor(totalVolume / 1000);
    const prBonus = prsForBonus.length * 3;

    const multiplier = STAR_MULTIPLIERS[starRating] ?? 1.0;
    const raw = basePoints + volumePoints + intensityPoints + prBonus;
    const hasWork = totalSets > 0 || elapsed > 120;
    const finalScore = Math.min(50, Math.max(hasWork ? 1 : 0, Math.round(raw * multiplier)));

    __DEV__ && console.log('[Tracking] Score calc: base=', basePoints, 'vol=', volumePoints, 'int=', intensityPoints, 'pr=', prBonus, 'mul=', multiplier, 'raw=', raw, 'final=', finalScore);

    return { basePoints, volumePoints, intensityPoints, prBonus, difficultyMultiplier: multiplier, finalScore };
  }, [exerciseLogs]);

  const calculateTrainingScore = useCallback((difficulty: DifficultyLevel): TrainingScoreBreakdown => {
    const starMap: Record<DifficultyLevel, number> = { easy: 1, moderate: 3, hard: 4, brutal: 5 };
    return calculateScore(starMap[difficulty], sessionPRs);
  }, [calculateScore, sessionPRs]);

  const beginPostWorkout = useCallback(() => {
    __DEV__ && console.log('[Tracking] Beginning post-workout flow');

    const realPRs = sessionPRs.filter(pr => {
      const existing = prHistory.find(p => p.exerciseName === pr.exerciseName && p.type === pr.type);
      return existing && pr.value > existing.value;
    });
    setConfirmedPRs(realPRs);
    __DEV__ && console.log('[Tracking] Confirmed PRs (beaten records):', realPRs.length, 'of', sessionPRs.length, 'total');

    setIsWorkoutActive(false);
    setShowRestTimer(false);
    setIsRestActive(false);
    restRemainingRef.current = 0;

    if (realPRs.length > 0) {
      setPostWorkoutStep('prs');
    } else {
      setPostWorkoutStep('feedback');
    }
  }, [sessionPRs, prHistory]);

  const prepareSaveStep = useCallback((starRating: number, rpe: number, wellChips: string[]) => {
    setSelectedStarRating(starRating);
    setSelectedRpe(rpe);
    setWhatWentWell(wellChips);

    const score = calculateScore(starRating, confirmedPRs);
    setSessionScoreBreakdown(score);

    const starToDifficulty: Record<number, DifficultyLevel> = { 1: 'easy', 2: 'easy', 3: 'moderate', 4: 'hard', 5: 'brutal' };
    setSelectedDifficulty(starToDifficulty[starRating] ?? 'moderate');

    setPostWorkoutStep('save');

    // Auto-save the workout log immediately — no manual "Save" tap required.
    // saveWorkout reads from state that was just set above; React batches these
    // so we defer one frame to let the state commit.
    requestAnimationFrame(() => {
      saveWorkoutRef.current?.();
    });
  }, [calculateScore, confirmedPRs]);

  const saveWorkout = useCallback(() => {
    __DEV__ && console.log('[Tracking] Saving workout');
    const score = sessionScoreBreakdown;
    if (!score) {
      __DEV__ && console.log('[Tracking] No score breakdown, cannot save');
      return;
    }

    const totalSets = Object.values(exerciseLogs).reduce((acc, log) => acc + log.sets.filter(s => s.done).length, 0);
    const totalVolume = Object.values(exerciseLogs).reduce((acc, log) =>
      acc + log.sets.filter(s => s.done).reduce((sum, s) => sum + s.weight * s.reps, 0), 0
    );

    // Build per-muscle completed set counts for science-based readiness drops
    const muscleSetCounts: Record<string, number> = {};
    if (activeWorkout) {
      for (const ex of activeWorkout.workout) {
        const log = exerciseLogs[ex.id];
        const doneSets = log ? log.sets.filter(s => s.done).length : 0;
        const muscle = ex.muscleGroup;
        muscleSetCounts[muscle] = (muscleSetCounts[muscle] ?? 0) + doneSets;
      }
    }

    const sessionId = generateId();
    const sessionStartISO = new Date(Date.now() - workoutElapsedRef.current * 1000).toISOString();
    saveTimeRef.current = Date.now();
    const logEntry: WorkoutLog = {
      id: sessionId,
      date: getTodayStr(),
      workoutName: activeWorkout?.split ?? 'Workout',
      workoutStyle: activeWorkout?.style ?? 'Strength',
      split: activeWorkout?.split ?? '',
      duration: Math.round(workoutElapsedRef.current / 60),
      exercises: Object.values(exerciseLogs),
      totalSets,
      totalVolume,
      prsHit: confirmedPRs.length,
      trainingScore: score.finalScore,
      difficulty: selectedDifficulty,
      starRating: selectedStarRating,
      rpe: selectedRpe,
      whatWentWell,
      muscleSetCounts,
      startTime: sessionStartISO,
    };

    const newHistory = [logEntry, ...workoutHistory];
    setWorkoutHistory(newHistory);
    AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory.slice(0, 100))).catch(console.warn);

    const updatedPRs = [...prHistory];
    const allSessionPRs = [...sessionPRs];
    for (const pr of allSessionPRs) {
      const existing = updatedPRs.findIndex(p => p.exerciseName === pr.exerciseName && p.type === pr.type);
      const prWithSession = { ...pr, sessionId };
      if (existing >= 0) {
        if (pr.value > updatedPRs[existing].value) {
          updatedPRs[existing] = prWithSession;
        }
      } else {
        updatedPRs.push(prWithSession);
      }
    }

    for (const log of Object.values(exerciseLogs)) {
      const doneSets = log.sets.filter(s => s.done && s.weight > 0);
      if (doneSets.length === 0) continue;

      const maxW = Math.max(...doneSets.map(s => s.weight));
      const maxR = Math.max(...doneSets.map(s => s.reps));
      const maxV = Math.max(...doneSets.map(s => s.weight * s.reps));

      const hasW = updatedPRs.some(p => p.exerciseName === log.exerciseName && p.type === 'weight');
      const hasR = updatedPRs.some(p => p.exerciseName === log.exerciseName && p.type === 'reps');
      const hasV = updatedPRs.some(p => p.exerciseName === log.exerciseName && p.type === 'volume');

      if (!hasW && maxW > 0) {
        updatedPRs.push({ exerciseName: log.exerciseName, type: 'weight', value: maxW, date: getTodayStr(), sessionId });
        __DEV__ && console.log('[Tracking] Baseline PR:', log.exerciseName, 'weight', maxW);
      }
      if (!hasR && maxR > 0) {
        updatedPRs.push({ exerciseName: log.exerciseName, type: 'reps', value: maxR, date: getTodayStr(), sessionId });
        __DEV__ && console.log('[Tracking] Baseline PR:', log.exerciseName, 'reps', maxR);
      }
      if (!hasV && maxV > 0) {
        updatedPRs.push({ exerciseName: log.exerciseName, type: 'volume', value: maxV, date: getTodayStr(), sessionId });
        __DEV__ && console.log('[Tracking] Baseline PR:', log.exerciseName, 'volume', maxV);
      }
    }

    setPrHistory(updatedPRs);
    AsyncStorage.setItem(PR_KEY, JSON.stringify(updatedPRs)).catch(console.warn);

    const newMinutes = weeklyHoursMin + Math.round(workoutElapsedRef.current / 60);
    setWeeklyHoursMin(newMinutes);
    AsyncStorage.setItem(WEEKLY_HOURS_KEY, JSON.stringify({ weekStart: getWeekStart(), minutes: newMinutes })).catch(console.warn);

    ctx.setTrainingScore(ctx.trainingScore + score.finalScore);
    ctx.setTargetDone(ctx.targetDone + score.finalScore);

    const hours = Math.round(newMinutes / 60 * 10) / 10;
    ctx.setHoursTrainedToday(hours >= 1 ? `${hours}h` : `${newMinutes}m`);

    if (activeWorkout) {
      // Difficulty multiplier — harder sessions cause deeper fatigue
      const difficultyMultiplier: Record<string, number> = {
        easy: 0.6, moderate: 0.85, hard: 1.0, brutal: 1.25,
      };
      const diffMul = difficultyMultiplier[selectedDifficulty] ?? 1.0;

      const updatedReadiness = ctx.muscleReadiness.map(m => {
        const sets = muscleSetCounts[m.name] ?? 0;
        if (sets === 0) return m; // untouched muscle — no change

        // Volume scaling: 1-2 sets = light, 3-5 = moderate, 6-8 = heavy, 9+ = max
        // Base drop 15–50 scaled by sets, then multiplied by difficulty
        const volumeFactor = Math.min(1.0, (sets / 8));          // 0..1 across 1–8 sets
        const baseDrop = Math.round((15 + volumeFactor * 35) * diffMul); // 9–75, capped below
        const drop = Math.min(65, Math.max(10, baseDrop));        // floor 10, ceiling 65

        return { ...m, status: 'recovering' as const, value: Math.max(15, m.value - drop), lastWorked: 'Today' };
      });
      ctx.setMuscleReadiness(updatedReadiness);
    }

    const newStreak = calcCurrentStreak(newHistory.map(l => l.date));
    ctx.setStreak(newStreak);
    ctx.setLastStreakDate(getTodayStr());

    ctx.saveState();

    // Auto-mark plan day completed only when the plan workout (not an override) was finished
    const planDay = ctx.getTodayPrescription();
    if (ctx.activePlan && planDay && !planDay.is_rest && !ctx.workoutOverride) {
      ctx.markDayCompleted(getTodayStr());
    }

    if (ctx.healthSyncEnabled && ctx.healthConnected && Platform.OS !== 'web') {
      const durationSec = workoutElapsedRef.current;
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - durationSec * 1000);
      const estimatedCalories = Math.round(durationSec / 60 * 7);
      healthService.writeWorkout({
        startDate,
        endDate,
        activityType: activeWorkout?.style ?? 'Strength',
        calories: estimatedCalories,
        duration: Math.round(durationSec / 60),
      }).then((success) => {
        __DEV__ && console.log('[Tracking] Health write result:', success);
      }).catch((e) => {
        __DEV__ && console.log('[Tracking] Health write error:', e);
      });
    }

    __DEV__ && console.log('[Tracking] Workout auto-saved. Score:', score?.finalScore ?? 0, 'PRs:', confirmedPRs.length);
  }, [sessionScoreBreakdown, exerciseLogs, confirmedPRs, sessionPRs, activeWorkout, workoutHistory, prHistory, weeklyHoursMin, ctx, selectedDifficulty, selectedStarRating, selectedRpe, whatWentWell]);

  // Stable ref so prepareSaveStep can call saveWorkout after state commits
  const saveWorkoutRef = useRef<() => void>();
  saveWorkoutRef.current = saveWorkout;

  // Dismiss the post-workout modal and clean up state
  const dismissPostWorkout = useCallback(() => {
    __DEV__ && console.log('[Tracking] Dismissing post-workout flow');
    setPostWorkoutStep(null);
    setSessionScoreBreakdown(null);
    setSessionPRs([]);
    setConfirmedPRs([]);
    setIsTimerMinimized(false);
  }, []);

  const discardWorkout = useCallback(() => {
    __DEV__ && console.log('[Tracking] Discarding workout');
    setPostWorkoutStep(null);
    setSessionScoreBreakdown(null);
    setSessionPRs([]);
    setConfirmedPRs([]);
    setIsTimerMinimized(false);
    setExerciseLogs({});
    setExpandedExercise(null);
    setActiveWorkout(null);
  }, []);

  const completeWorkout = useCallback((difficulty: DifficultyLevel, rpe: number, wellChips: string[]) => {
    const starMap: Record<DifficultyLevel, number> = { easy: 1, moderate: 3, hard: 4, brutal: 5 };
    prepareSaveStep(starMap[difficulty], rpe, wellChips);
  }, [prepareSaveStep]);

  const markImportSeen = useCallback((importId: string) => {
    void AsyncStorage.getItem(SEEN_HEALTH_IMPORTS_KEY).then(raw => {
      const seen: string[] = raw ? JSON.parse(raw) : [];
      if (!seen.includes(importId)) {
        seen.push(importId);
        AsyncStorage.setItem(SEEN_HEALTH_IMPORTS_KEY, JSON.stringify(seen)).catch(console.warn);
      }
    }).catch(console.warn);
  }, []);

  const acceptHealthImport = useCallback((importItem: HealthImportItem, style: string, muscleGroups: string[]) => {
    const logEntry: WorkoutLog = {
      id: generateId(),
      date: importItem.dateStr,
      workoutName: `${style} Session`,
      workoutStyle: style,
      split: '',
      duration: importItem.duration,
      exercises: [],
      totalSets: 0,
      totalVolume: 0,
      prsHit: 0,
      trainingScore: 0,
      difficulty: 'moderate',
      starRating: 3,
      rpe: 5,
      whatWentWell: [],
      isManualLog: true,
      calories: importItem.calories,
      muscleGroups,
      startTime: importItem.startDate,
    };
    const newHistory = [logEntry, ...workoutHistory];
    setWorkoutHistory(newHistory);
    AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory.slice(0, 100))).catch(console.warn);

    const newStreak = calcCurrentStreak(newHistory.map(l => l.date));
    ctx.setStreak(newStreak);
    ctx.setLastStreakDate(getTodayStr());

    markImportSeen(importItem.id);
    setPendingHealthImports(prev => prev.filter(i => i.id !== importItem.id));
    __DEV__ && console.log('[HealthImport] Accepted:', importItem.id, style, muscleGroups);
  }, [workoutHistory, markImportSeen, ctx]);

  const dismissHealthImport = useCallback((importId: string) => {
    markImportSeen(importId);
    setPendingHealthImports(prev => prev.filter(i => i.id !== importId));
    __DEV__ && console.log('[HealthImport] Dismissed:', importId);
  }, [markImportSeen]);

  const mergeDuplicate = useCallback((dupId: string) => {
    setDuplicateCandidates(prev => {
      const dup = prev.find(d => d.id === dupId);
      if (dup) markImportSeen(dup.healthImport.id);
      return prev.filter(d => d.id !== dupId);
    });
    __DEV__ && console.log('[HealthImport] Merged (same workout):', dupId);
  }, [markImportSeen]);

  const keepBothDuplicate = useCallback((dupId: string) => {
    setDuplicateCandidates(prev => {
      const dup = prev.find(d => d.id === dupId);
      if (dup) {
        markImportSeen(dup.healthImport.id);
        const { healthImport } = dup;
        const logEntry: WorkoutLog = {
          id: generateId(),
          date: healthImport.dateStr,
          workoutName: `${healthImport.suggestedStyle} Session (Health)`,
          workoutStyle: healthImport.suggestedStyle,
          split: '',
          duration: healthImport.duration,
          exercises: [],
          totalSets: 0,
          totalVolume: 0,
          prsHit: 0,
          trainingScore: 0,
          difficulty: 'moderate',
          starRating: 3,
          rpe: 5,
          whatWentWell: [],
          isManualLog: true,
          calories: healthImport.calories,
          muscleGroups: [],
          startTime: healthImport.startDate,
        };
        setWorkoutHistory(hist => {
          const updated = [logEntry, ...hist];
          AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated.slice(0, 100))).catch(console.warn);
          return updated;
        });
      }
      return prev.filter(d => d.id !== dupId);
    });
    __DEV__ && console.log('[HealthImport] Keep both:', dupId);
  }, [markImportSeen]);

  const dismissDuplicate = useCallback((dupId: string) => {
    setDuplicateCandidates(prev => {
      const dup = prev.find(d => d.id === dupId);
      if (dup) markImportSeen(dup.healthImport.id);
      return prev.filter(d => d.id !== dupId);
    });
    __DEV__ && console.log('[HealthImport] Dismissed duplicate:', dupId);
  }, [markImportSeen]);

  const removeWorkoutLog = useCallback((logId: string) => {
    const logToRemove = workoutHistory.find(l => l.id === logId);
    if (logToRemove) {
      const sessionScore = logToRemove.trainingScore ?? 0;
      const newScore = Math.max(0, ctx.trainingScore - sessionScore);
      const newTargetDone = Math.max(0, ctx.targetDone - sessionScore);
      ctx.setTrainingScore(newScore);
      ctx.setTargetDone(newTargetDone);

      const logDuration = logToRemove.duration;
      let newMinutes = weeklyHoursMin;
      if (logDuration > 0) {
        newMinutes = Math.max(0, weeklyHoursMin - logDuration);
        setWeeklyHoursMin(newMinutes);
        AsyncStorage.setItem(WEEKLY_HOURS_KEY, JSON.stringify({ weekStart: getWeekStart(), minutes: newMinutes })).catch(console.warn);
        const hoursVal = Math.round(newMinutes / 60 * 10) / 10;
        ctx.setHoursTrainedToday(hoursVal >= 1 ? `${hoursVal}h` : newMinutes > 0 ? `${newMinutes}m` : '0h');
      }

      requestAnimationFrame(() => {
        AsyncStorage.getItem('@zeal_app_state_v3').then(raw => {
          if (raw) {
            try {
              const d = JSON.parse(raw);
              d.trainingScore = newScore;
              d.targetDone = newTargetDone;
              if (logDuration > 0) {
                const hv = Math.round(newMinutes / 60 * 10) / 10;
                d.hoursTrainedToday = hv >= 1 ? `${hv}h` : newMinutes > 0 ? `${newMinutes}m` : '0h';
              }
              AsyncStorage.setItem('@zeal_app_state_v3', JSON.stringify(d)).catch(console.warn);
              __DEV__ && console.log('[Tracking] Persisted score after removal: score=', newScore, 'targetDone=', newTargetDone);
            } catch (e) {
              __DEV__ && console.log('[Tracking] Failed to persist score after removal:', e);
            }
          }
        }).catch(console.warn);
      });

      __DEV__ && console.log('[Tracking] Removed log, subtracted score:', sessionScore, 'new total:', newScore);
    }

    const newHistory = workoutHistory.filter(l => l.id !== logId);
    setWorkoutHistory(newHistory);
    AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory)).catch(console.warn);

    const newStreak = calcCurrentStreak(newHistory.map(l => l.date));
    ctx.setStreak(newStreak);
    ctx.setLastStreakDate(getTodayStr());

    // Remove any PRs that were set during the deleted session
    const newPRHistory = prHistory.filter(pr => pr.sessionId !== logId);
    if (newPRHistory.length !== prHistory.length) {
      setPrHistory(newPRHistory);
      AsyncStorage.setItem(PR_KEY, JSON.stringify(newPRHistory)).catch(console.warn);
      __DEV__ && console.log('[Tracking] Removed', prHistory.length - newPRHistory.length, 'PRs for deleted session:', logId);
    }

    // Recalculate muscle readiness from remaining history
    const freshReadiness: MuscleReadinessItem[] = [
      { name: 'Chest', status: 'ready', value: 100, lastWorked: 'Never' },
      { name: 'Back', status: 'ready', value: 100, lastWorked: 'Never' },
      { name: 'Shoulders', status: 'ready', value: 100, lastWorked: 'Never' },
      { name: 'Biceps', status: 'ready', value: 100, lastWorked: 'Never' },
      { name: 'Triceps', status: 'ready', value: 100, lastWorked: 'Never' },
      { name: 'Quads', status: 'ready', value: 100, lastWorked: 'Never' },
      { name: 'Hamstrings', status: 'ready', value: 100, lastWorked: 'Never' },
      { name: 'Glutes', status: 'ready', value: 100, lastWorked: 'Never' },
      { name: 'Core', status: 'ready', value: 100, lastWorked: 'Never' },
      { name: 'Calves', status: 'ready', value: 100, lastWorked: 'Never' },
    ];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Replay remaining logs to rebuild readiness (most recent first)
    const sortedRemaining = [...newHistory].sort((a, b) => b.date.localeCompare(a.date));
    const muscleMap = new Map(freshReadiness.map(m => [m.name, m]));
    const difficultyMultiplier: Record<string, number> = {
      easy: 0.6, moderate: 0.85, hard: 1.0, brutal: 1.25,
    };
    for (const log of sortedRemaining) {
      const logDate = new Date(log.date + 'T00:00:00');
      const daysAgo = Math.max(0, Math.floor((today.getTime() - logDate.getTime()) / 86_400_000));
      if (daysAgo > 7) continue;
      const diffMul = difficultyMultiplier[log.difficulty] ?? 1.0;
      const muscles = log.muscleGroups ?? [];
      for (const name of muscles) {
        const m = muscleMap.get(name);
        if (!m) continue;
        if (m.lastWorked === 'Never' || m.lastWorked === '') {
          const sets = log.muscleSetCounts?.[name] ?? 4; // fallback for old logs without set counts
          const volumeFactor = Math.min(1.0, sets / 8);
          const baseDrop = Math.round((15 + volumeFactor * 35) * diffMul);
          const drop = Math.min(65, Math.max(10, baseDrop));
          // Exponential-ish recovery: faster early, slows near end
          // recoveryFraction goes 0→1 over ~4 days, with a gentle curve
          const recoveryFraction = Math.min(1, daysAgo / 4);
          const eased = 1 - Math.pow(1 - recoveryFraction, 1.8); // ease-out curve
          const recovered = Math.round(drop * eased);
          const newValue = Math.min(100, Math.max(15, 100 - drop + recovered));
          const daysLabel = daysAgo === 0 ? 'Today' : `${daysAgo}d ago`;
          m.value = newValue;
          m.lastWorked = daysLabel;
          m.status = newValue >= 80 ? 'ready' : newValue >= 50 ? 'building' : 'recovering';
        }
      }
    }
    const recalculated = Array.from(muscleMap.values());
    ctx.setMuscleReadiness(recalculated);
    ctx.saveState();
    __DEV__ && console.log('[Tracking] Recalculated muscle readiness after deletion');
  }, [workoutHistory, prHistory, ctx, weeklyHoursMin]);

  const getLogForDate = useCallback((date: string): WorkoutLog | undefined => {
    return workoutHistory.find(l => l.date === date);
  }, [workoutHistory]);

  const getLogsForDate = useCallback((date: string): WorkoutLog[] => {
    return workoutHistory.filter(l => l.date === date);
  }, [workoutHistory]);

  const getExerciseSuggestion = useCallback((exercise: WorkoutExercise) => {
    return getSuggestedWeight(exercise, prHistory, workoutHistory, ctx.fitnessLevel, ctx.sex, ctx.weight);
  }, [prHistory, workoutHistory, ctx.fitnessLevel, ctx.sex, ctx.weight]);

  // Returns the set array from the most recent session containing this exercise
  const getLastSetsForExercise = useCallback((exerciseName: string): SetLog[] => {
    for (const log of workoutHistory) {
      const exLog = log.exercises.find(e => e.exerciseName === exerciseName);
      if (exLog && exLog.sets.some(s => s.done)) return exLog.sets;
    }
    return [];
  }, [workoutHistory]);

  const completedExerciseCount = useMemo(() => {
    return Object.values(exerciseLogs).filter(l => l.completed).length;
  }, [exerciseLogs]);

  const liveTrainingScore = useMemo(() => {
    const basePoints = Math.floor(workoutElapsedRef.current / 300);
    const totalSets = Object.values(exerciseLogs).reduce((acc, log) => acc + log.sets.filter(s => s.done).length, 0);
    const volumePoints = Math.floor(totalSets / 20);
    const totalVolume = Object.values(exerciseLogs).reduce((acc, log) =>
      acc + log.sets.filter(s => s.done).reduce((sum, s) => sum + s.weight * s.reps, 0), 0
    );
    const intensityPoints = Math.floor(totalVolume / 1000);
    const prBonus = sessionPRs.length * 3;
    return Math.min(50, basePoints + volumePoints + intensityPoints + prBonus);
  }, [exerciseLogs, sessionPRs]);

  const selectedLog = useMemo(() => {
    if (!selectedLogId) return null;
    return workoutHistory.find(l => l.id === selectedLogId) ?? null;
  }, [selectedLogId, workoutHistory]);

  const readinessPercent = useMemo(() => {
    if (!activeWorkout) return 0;
    const workedMuscles = new Set(activeWorkout.workout.map(ex => ex.muscleGroup));
    const relevant = ctx.muscleReadiness.filter(m => workedMuscles.has(m.name));
    if (relevant.length === 0) return 85;
    return Math.round(relevant.reduce((sum, m) => sum + m.value, 0) / relevant.length);
  }, [activeWorkout, ctx.muscleReadiness]);

  const todayLogs = useMemo(() => {
    const today = getTodayStr();
    return workoutHistory.filter(l => l.date === today);
  }, [workoutHistory]);

  return useMemo(() => ({
    isWorkoutActive,
    workoutElapsedRef,
    isPaused,
    isRestActive,
    restTimeRemainingRef: restRemainingRef,
    restTimeTotal,
    showRestTimer,
    isTimerMinimized,
    setIsTimerMinimized,
    autoRestTimer,
    setAutoRestTimer: handleSetAutoRestTimer,
    exerciseLogs,
    expandedExercise,
    setExpandedExercise,
    postWorkoutStep,
    setPostWorkoutStep,
    selectedDifficulty,
    selectedStarRating,
    setSelectedStarRating,
    selectedRpe,
    setSelectedRpe,
    whatWentWell,
    setWhatWentWell,
    sessionScoreBreakdown,
    sessionPRs,
    confirmedPRs,
    workoutHistory,
    prHistory,
    activeWorkout,
    currentGeneratedWorkout,
    setCurrentGeneratedWorkout,
    isGeneratingWorkout,
    ensureTodayWorkoutGenerated,
    calendarModalVisible,
    setCalendarModalVisible,
    workoutLogDetailVisible,
    setWorkoutLogDetailVisible,
    buildWorkoutVisible,
    setBuildWorkoutVisible,
    workoutPlanVisible,
    setWorkoutPlanVisible,
    planChooserVisible,
    setPlanChooserVisible,
    exerciseCatalogVisible,
    setExerciseCatalogVisible,
    activePlanVisible,
    setActivePlanVisible,
    selectedLogId,
    setSelectedLogId,
    selectedLog,
    completedExerciseCount,
    liveTrainingScore,
    readinessPercent,
    weeklyHoursMin,
    todayLogs,

    startWorkout,
    pauseWorkout,
    resetWorkout,
    startRestTimer,
    adjustRestTimer,
    setRestPreset,
    cancelRestTimer,
    initExerciseLog,
    updateSetLog,
    applyWeightToAllSets,
    markSetDone,
    addSet,
    removeSet,
    unmarkExerciseComplete,
    markExerciseComplete,
    updateExerciseResult,
    calculateTrainingScore,
    calculateScore,
    beginPostWorkout,
    prepareSaveStep,
    saveWorkout,
    dismissPostWorkout,
    discardWorkout,
    completeWorkout,
    removeWorkoutLog,
    getLogForDate,
    getLogsForDate,
    getExerciseSuggestion,
    getLastSetsForExercise,
    pendingHealthImports,
    duplicateCandidates,
    healthImportReviewVisible,
    setHealthImportReviewVisible,
    acceptHealthImport,
    dismissHealthImport,
    mergeDuplicate,
    keepBothDuplicate,
    dismissDuplicate,
    resetTrackingData,
  }), [
    isWorkoutActive, isPaused, isRestActive,
    restTimeTotal, showRestTimer, isTimerMinimized, setIsTimerMinimized, autoRestTimer, handleSetAutoRestTimer, exerciseLogs, expandedExercise,
    postWorkoutStep, selectedDifficulty, selectedStarRating, selectedRpe, whatWentWell,
    sessionScoreBreakdown, sessionPRs, confirmedPRs, workoutHistory, prHistory, activeWorkout,
    calendarModalVisible, workoutLogDetailVisible,
    buildWorkoutVisible, workoutPlanVisible, planChooserVisible, exerciseCatalogVisible, activePlanVisible,
    selectedLogId, selectedLog, completedExerciseCount, liveTrainingScore,
    readinessPercent, weeklyHoursMin, todayLogs,
    currentGeneratedWorkout, setCurrentGeneratedWorkout,
    isGeneratingWorkout, ensureTodayWorkoutGenerated,
    startWorkout, pauseWorkout, resetWorkout, startRestTimer, adjustRestTimer,
    setRestPreset, cancelRestTimer, initExerciseLog, updateSetLog,
    applyWeightToAllSets, markSetDone, addSet, removeSet, unmarkExerciseComplete, markExerciseComplete,
    updateExerciseResult, calculateTrainingScore, calculateScore, beginPostWorkout, prepareSaveStep,
    saveWorkout, dismissPostWorkout, discardWorkout, completeWorkout,
    removeWorkoutLog, getLogForDate, getLogsForDate,
    getExerciseSuggestion, getLastSetsForExercise,
    pendingHealthImports, duplicateCandidates, healthImportReviewVisible, setHealthImportReviewVisible,
    acceptHealthImport, dismissHealthImport, mergeDuplicate, keepBothDuplicate, dismissDuplicate,
    resetTrackingData,
  ]);
});

/**
 * Subscribe to workout elapsed time at 500ms resolution.
 * Only components that display the live timer should use this hook —
 * it re-renders the consumer every 500ms during an active workout.
 */
export function useWorkoutElapsed(): number {
  const { workoutElapsedRef, isWorkoutActive, isPaused } = useWorkoutTracking();
  const [elapsed, setElapsed] = useState(workoutElapsedRef.current);

  useEffect(() => {
    // Sync immediately on mount or when workout starts/pauses
    setElapsed(workoutElapsedRef.current);
    if (!isWorkoutActive || isPaused) return;
    const id = setInterval(() => setElapsed(workoutElapsedRef.current), 500);
    return () => clearInterval(id);
  }, [isWorkoutActive, isPaused, workoutElapsedRef]);

  return elapsed;
}

/**
 * Subscribe to rest timer remaining at 500ms resolution.
 * Only components that display the rest countdown should use this hook.
 */
export function useRestTimeRemaining(): number {
  const { restTimeRemainingRef, isRestActive } = useWorkoutTracking();
  const [remaining, setRemaining] = useState(restTimeRemainingRef.current);

  useEffect(() => {
    setRemaining(restTimeRemainingRef.current);
    if (!isRestActive) return;
    const id = setInterval(() => setRemaining(restTimeRemainingRef.current), 500);
    return () => clearInterval(id);
  }, [isRestActive, restTimeRemainingRef]);

  return remaining;
}
