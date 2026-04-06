import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useColorScheme } from 'react-native';
import { healthService } from '@/services/healthService';
import type { WorkoutExercise, GenerateWorkoutParams } from '@/services/workoutEngine';
import { Colors, WORKOUT_STYLE_COLORS, ZEAL_ACCENT_COLORS } from '@/constants/colors';
import type { GeneratedPlanSchedule, DayPrescription, WeekSchedule } from '@/services/planEngine';
import { generateWorkoutAsync } from '@/services/aiWorkoutGenerator';
import { generateCoreFinisherFromEngine } from '@/services/workoutEngine';
import type { PlanGoal, PlanLength, ExperienceLevel as PlanExperienceLevel } from '@/services/planConstants';
import { ALL_EQUIPMENT_IDS, HOME_EQUIPMENT_PRESET, CROSSFIT_EQUIPMENT_PRESET } from '@/mocks/equipmentData';
import { type FitnessLevel } from '@/constants/fitnessLevel';

export type AppTheme = 'system' | 'dark' | 'light' | 'zeal' | 'neon';
export type Sex = 'male' | 'female' | 'prefer_not';
export type { FitnessLevel };
export type SpecialLifeCase =
  | 'none'
  | 'pregnant'
  | 'postpartum'
  | 'injury'
  | 'disability'
  | 'chronic_pain';
export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active';
export type MuscleStatus = 'recovering' | 'building' | 'ready';

export interface MuscleReadinessItem {
  name: string;
  status: MuscleStatus;
  value: number;
  lastWorked: string;
}

export interface SavedGym {
  id: string;
  name: string;
  equipment: Record<string, number>;
}

export interface PlannedWorkout {
  id: string;
  date: string;
  style: string;
  split: string;
  muscles: string[];
  duration: number;
  createdAt: string;
  exercises?: WorkoutExercise[];
}

export interface WorkoutOverride {
  style: string;
  split: string;
  duration: number;
  rest: number;
  muscles: string[];
  setDate: string;
}

export interface SavedWorkout {
  id: string;
  name: string;
  exercises: { exerciseId: string; name: string; }[];
  defaultFocus: string;
  createdAt: string;
  lastUsed: string;
}

export interface WorkoutPlan {
  id: string;
  name: string;
  goal: string;
  goalId: PlanGoal;
  style: string;
  event: string[];
  daysPerWeek: number;
  sessionDuration: number;
  trainingSplit: string;
  experienceLevel: string;
  planLength: number;
  startDate: string;
  endDate: string;
  createdAt: string;
  active: boolean;
  schedule?: GeneratedPlanSchedule;
  missedDays?: string[];
  completedDays?: string[];
  equipment?: Record<string, number>;
  pausedAt?: string;  // ISO date when plan was paused; undefined = active
  is75Hard?: boolean; // true when this plan backs a 75 Hard challenge
}

export interface PlanGenerationProgress {
  planId: string;
  current: number;
  total: number;
  phase: 'week1' | 'background' | 'done' | 'error';
}

export type ExercisePreference = 'liked' | 'disliked' | 'neutral';

export interface LastModifyState {
  style: string;
  split: string;
  duration: number;
  rest: number;
  muscles: string[];
  gymPreset: 'commercial' | string | null;
  setDate?: string;  // YYYY-MM-DD — stamped automatically by saveLastModifyState, controls day-boundary clearing
}

const STORAGE_KEY = '@zeal_app_state_v4';
const OVERRIDE_STORAGE_KEY = '@zeal_workout_override';
const SAVED_WORKOUTS_KEY = '@zeal_saved_workouts_v1';
const EXERCISE_PREFS_KEY = '@zeal_exercise_prefs_v3';
const WORKOUT_PLAN_KEY = '@zeal_workout_plan_v2';
const PLAN_SCHEDULE_KEY = '@zeal_plan_schedule_v1';
const ONBOARDING_KEY = '@zeal_onboarding_v1';
const NOTIF_PREFS_KEY = '@zeal_notif_prefs_v1';
const LAST_MODIFY_KEY = '@zeal_last_modify_v1';
const PLANNED_WORKOUTS_KEY = '@zeal_planned_workouts_v1';
const IS_LOGGED_IN_KEY = '@zeal_is_logged_in_v1';
/** Same key as WorkoutTrackingContext — today’s generated workout + creative title. */
const DAILY_GENERATED_SNAPSHOT_KEY = '@zeal_daily_generated_workout_v1';

export interface NotifPrefs {
  dailyEnabled: boolean;
  dailyHour: number;
  dailyMinute: number;
  streakEnabled: boolean;
  streakHour: number;
  streakMinute: number;
  weeklySummaryEnabled: boolean;
}

const DEFAULT_LIKED_EXERCISE_IDS: string[] = [
  // Chest
  'barbell_bench_press', 'incline_barbell_bench', 'decline_barbell_bench',
  'dumbbell_bench_press', 'incline_dumbbell_bench', 'cable_chest_fly',
  'pec_deck_fly', 'dumbbell_chest_fly', 'cable_crossover', 'machine_chest_press', 'dip',
  // Back
  'pull_up', 'lat_pulldown', 'barbell_bent_over_row', 'dumbbell_row',
  'cable_seated_row', 'seated_row_machine', 't_bar_row', 'straight_arm_pulldown',
  'face_pull', 'rear_delt_fly', 'assisted_pull_up', 'back_extension',
  // Shoulders
  'standing_overhead_press', 'seated_dumbbell_shoulder_press', 'arnold_press',
  'machine_shoulder_press', 'dumbbell_lateral_raise', 'cable_lateral_raise',
  'dumbbell_front_raise',
  // Arms
  'barbell_curl', 'dumbbell_curl', 'hammer_curl', 'ez_bar_curl', 'preacher_curl', 'cable_curl',
  'cable_tricep_pushdown', 'skull_crusher', 'overhead_tricep_extension', 'close_grip_bench_press',
  // Legs & Glutes
  'barbell_back_squat', 'goblet_squat', 'front_squat', 'hack_squat', 'leg_press',
  'bulgarian_split_squat', 'conventional_deadlift', 'romanian_deadlift', 'single_leg_rdl',
  'trap_bar_deadlift', 'sumo_deadlift', 'dumbbell_rdl',
  'hip_thrust', 'glute_bridge', 'leg_extension', 'leg_curl',
  'standing_calf_raise', 'seated_calf_raise',
  'reverse_lunge', 'walking_lunge', 'step_up',
  // Core
  'plank', 'hanging_leg_raise', 'ab_wheel_rollout', 'russian_twist',
  // Cardio & Conditioning
  'box_jump', 'kettlebell_swing', 'farmers_carry',
  'treadmill_run', 'rowing_machine_intervals', 'assault_bike_intervals', 'jump_rope_intervals',
  // Bodyweight
  'push_up', 'bodyweight_squat',
];

const DEFAULT_DISLIKED_EXERCISE_IDS: string[] = [
  'copenhagen_plank',
  'bird_dog',
  'dead_bug',
  'hollow_body_hold',
  'side_plank',
  'pallof_press',
  'cable_woodchop',
  'curtsy_lunge',
  'wall_sit',
  'landmine_press',
  'cable_pull_through',
  'resistance_band_pull_apart',
  'cable_kickback',
  'tricep_kickback',
  'diamond_push_up',
  'mountain_climber',
];

function buildDefaultExercisePreferences(): Record<string, 'liked' | 'disliked' | 'neutral'> {
  const prefs: Record<string, 'liked' | 'disliked' | 'neutral'> = {};
  for (const id of DEFAULT_LIKED_EXERCISE_IDS) prefs[id] = 'liked';
  for (const id of DEFAULT_DISLIKED_EXERCISE_IDS) prefs[id] = 'disliked';
  return prefs;
}

function getTodayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DEFAULT_MUSCLE_READINESS: MuscleReadinessItem[] = [
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

const DEFAULT_SAVED_GYMS: SavedGym[] = [
  { id: 'default_home', name: 'Home Gym', equipment: HOME_EQUIPMENT_PRESET },
  { id: 'default_crossfit', name: 'CrossFit Gym', equipment: CROSSFIT_EQUIPMENT_PRESET },
];

function getTodayZealAccent(): string {
  const day = new Date().getDate();
  return ZEAL_ACCENT_COLORS[day % ZEAL_ACCENT_COLORS.length];
}

export const [AppProvider, useAppContext] = createContextHook(() => {
  const systemScheme = useColorScheme();

  const [userName, setUserName] = useState<string>('');
  const [userPhotoUri, setUserPhotoUri] = useState<string | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState<string>('');

  const [heightFt, setHeightFt] = useState<number>(5);
  const [heightIn, setHeightIn] = useState<number>(10);
  const [weight, setWeight] = useState<number>(160);
  const [sex, setSex] = useState<Sex>('male');
  const [bodyFat, setBodyFat] = useState<number>(0);
  const [fitnessLevel, setFitnessLevel] = useState<FitnessLevel>('beginner');
  const [trainingGoals, setTrainingGoals] = useState<string[]>(['Build Muscle']);
  const [specialLifeCase, setSpecialLifeCase] = useState<SpecialLifeCase>('none');
  const [specialLifeCaseDetail, setSpecialLifeCaseDetail] = useState<string>('');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderately_active');
  const [muscleReadiness, setMuscleReadiness] =
    useState<MuscleReadinessItem[]>(DEFAULT_MUSCLE_READINESS);

  const [workoutStyle, setWorkoutStyle] = useState<string>('Strength');
  const [trainingSplit, setTrainingSplit] = useState<string>('Push Day');
  const [targetDuration, setTargetDuration] = useState<number>(60);
  const [restBetweenSets, setRestBetweenSets] = useState<number>(0.5);
  const [warmUp, setWarmUp] = useState<boolean>(true);
  const [coolDown, setCoolDown] = useState<boolean>(true);
  const [recovery, setRecovery] = useState<boolean>(false);
  const [addCardio, setAddCardio] = useState<boolean>(false);
  const [coreFinisher, setCoreFinisher] = useState<boolean>(false);

  const [appTheme, setAppTheme] = useState<AppTheme>('dark');
  const [reflectWorkoutColor, setReflectWorkoutColor] = useState<boolean>(false);

  const [selectedEquipment, setSelectedEquipment] = useState<Record<string, number>>({});
  const [savedGyms, setSavedGyms] = useState<SavedGym[]>(DEFAULT_SAVED_GYMS);

  const [workoutOverride, setWorkoutOverride] = useState<WorkoutOverride | null>(null);
  const [settingsSaveVersion, setSettingsSaveVersion] = useState<number>(0);
  const [lastModifyState, setLastModifyState] = useState<LastModifyState | null>(null);

  const [streak, setStreak] = useState<number>(1);
  const [lastStreakDate, setLastStreakDate] = useState<string>(getTodayDateStr());
  const [trainingScore, setTrainingScore] = useState<number>(0);
  const [hoursTrainedToday, setHoursTrainedToday] = useState<string>('0h');
  const [targetDone, setTargetDone] = useState<number>(0);
  const [currentWorkoutTitle, setCurrentWorkoutTitle] = useState<string>('');

  const [savedWorkouts, setSavedWorkouts] = useState<SavedWorkout[]>([]);
  const [exercisePreferences, setExercisePreferences] = useState<Record<string, ExercisePreference>>({});
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [planSchedule, setPlanSchedule] = useState<GeneratedPlanSchedule | null>(null);
  const [loadedWorkout, setLoadedWorkout] = useState<SavedWorkout | null>(null);
  const [plannedWorkouts, setPlannedWorkouts] = useState<PlannedWorkout[]>([]);

  const [healthSyncEnabled, setHealthSyncEnabled] = useState<boolean>(false);
  const [healthConnected, setHealthConnected] = useState<boolean>(false);

  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>({
    dailyEnabled: false,
    dailyHour: 8,
    dailyMinute: 0,
    streakEnabled: false,
    streakHour: 20,
    streakMinute: 0,
    weeklySummaryEnabled: false,
  });

  const [loaded, setLoaded] = useState<boolean>(false);
  const [onboardingComplete, setOnboardingCompleteState] = useState<boolean>(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [showPlusSpotlight, setShowPlusSpotlight] = useState<boolean>(false);
  const [googlePrefill, setGooglePrefill] = useState<{ name: string; photoUri: string | null } | null>(null);
  const [newUserResetToken, setNewUserResetToken] = useState<number>(0);

  // Background plan generation
  const [planGenProgress, setPlanGenProgress] = useState<PlanGenerationProgress | null>(null);
  const planGenRef = useRef<{ abortController: AbortController; promise: Promise<void> } | null>(null);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      AsyncStorage.getItem(OVERRIDE_STORAGE_KEY),
      AsyncStorage.getItem(SAVED_WORKOUTS_KEY),
      AsyncStorage.getItem(EXERCISE_PREFS_KEY),
      AsyncStorage.getItem(WORKOUT_PLAN_KEY),
      AsyncStorage.getItem(PLAN_SCHEDULE_KEY),
      AsyncStorage.getItem(ONBOARDING_KEY),
      AsyncStorage.getItem(NOTIF_PREFS_KEY),
      AsyncStorage.getItem(LAST_MODIFY_KEY),
      AsyncStorage.getItem(PLANNED_WORKOUTS_KEY),
      AsyncStorage.getItem(IS_LOGGED_IN_KEY),
      AsyncStorage.getItem(DAILY_GENERATED_SNAPSHOT_KEY),
    ])
      .then(([raw, overrideRaw, savedWRaw, prefRaw, planRaw, scheduleRaw, onboardingRaw, notifPrefsRaw, lastModifyRaw, plannedWorkoutsRaw, isLoggedInRaw, dailySnapshotRaw]) => {
        if (onboardingRaw === 'true') setOnboardingCompleteState(true);
        if (isLoggedInRaw === 'true') {
          __DEV__ && console.log('[AppContext] Restored logged in session');
          setIsLoggedIn(true);
        }
        if (raw) {
          try {
            const d = JSON.parse(raw);
            if (d.userName) setUserName(d.userName);
            if (d.userPhotoUri !== undefined) setUserPhotoUri(d.userPhotoUri);
            if (d.dateOfBirth !== undefined) setDateOfBirth(d.dateOfBirth);
            if (d.heightFt !== undefined) setHeightFt(d.heightFt);
            if (d.heightIn !== undefined) setHeightIn(d.heightIn);
            if (d.weight !== undefined) setWeight(d.weight);
            if (d.sex) setSex(d.sex);
            if (d.bodyFat !== undefined) setBodyFat(d.bodyFat);
            if (d.fitnessLevel) setFitnessLevel(d.fitnessLevel);
            if (d.trainingGoals) setTrainingGoals(d.trainingGoals);
            if (d.specialLifeCase) setSpecialLifeCase(d.specialLifeCase);
            if (d.specialLifeCaseDetail !== undefined)
              setSpecialLifeCaseDetail(d.specialLifeCaseDetail);
            if (d.activityLevel) setActivityLevel(d.activityLevel);
            if (d.muscleReadiness) setMuscleReadiness(d.muscleReadiness);
            if (d.workoutStyle) setWorkoutStyle(d.workoutStyle);
            if (d.trainingSplit) {
              const SPLIT_MIGRATION: Record<string, string> = {
                'Push Day': 'Push', 'Pull Day': 'Pull', 'Leg Day': 'Legs',
                'Core + Cardio': 'Full Body',
              };
              setTrainingSplit(SPLIT_MIGRATION[d.trainingSplit] ?? d.trainingSplit);
            }
            if (d.targetDuration !== undefined) setTargetDuration(d.targetDuration);
            if (d.restBetweenSets !== undefined) setRestBetweenSets(d.restBetweenSets);
            if (d.warmUp !== undefined) setWarmUp(d.warmUp);
            if (d.coolDown !== undefined) setCoolDown(d.coolDown);
            if (d.recovery !== undefined) setRecovery(d.recovery);
            if (d.addCardio !== undefined) setAddCardio(d.addCardio);
            if (d.coreFinisher !== undefined) setCoreFinisher(d.coreFinisher);
            if (d.appTheme) setAppTheme(d.appTheme);
            if (d.reflectWorkoutColor !== undefined)
              setReflectWorkoutColor(d.reflectWorkoutColor);
            if (d.selectedEquipment) {
              const equipCount = Object.values(d.selectedEquipment as Record<string, number>).filter(v => v > 0).length;
              if (equipCount > 0 || Object.keys(d.selectedEquipment).length > 0) {
                setSelectedEquipment(d.selectedEquipment);
              } else {
                const all: Record<string, number> = {};
                ALL_EQUIPMENT_IDS.forEach((id: string) => { all[id] = 1; });
                setSelectedEquipment(all);
                __DEV__ && console.log('[AppContext] No equipment found in storage, defaulting to commercial');
              }
            }
            if (d.savedGyms) {
              const storedIds = new Set((d.savedGyms as SavedGym[]).map((g) => g.id));
              const merged = [
                ...d.savedGyms,
                ...DEFAULT_SAVED_GYMS.filter((g) => !storedIds.has(g.id)),
              ];
              setSavedGyms(merged);
            }
            if (d.streak !== undefined) setStreak(d.streak);
            if (d.lastStreakDate) setLastStreakDate(d.lastStreakDate);
            if (d.trainingScore !== undefined) setTrainingScore(d.trainingScore);
            if (d.hoursTrainedToday) setHoursTrainedToday(d.hoursTrainedToday);
            if (d.targetDone !== undefined) setTargetDone(d.targetDone);
            if (d.currentWorkoutTitle) setCurrentWorkoutTitle(d.currentWorkoutTitle);
            // Prefer today’s creative title from the daily workout snapshot (same source as Workout tab).
            // Avoids stale main-storage title and fixes load-order vs WorkoutTrackingContext hydrate.
            if (dailySnapshotRaw) {
              try {
                const snap = JSON.parse(dailySnapshotRaw) as { date?: string; title?: string };
                const today = getTodayDateStr();
                if (snap.date === today && typeof snap.title === 'string' && snap.title.trim()) {
                  setCurrentWorkoutTitle(snap.title);
                } else if (snap.date && snap.date !== today) {
                  setCurrentWorkoutTitle('');
                }
              } catch (e) {
                __DEV__ && console.log('[AppContext] daily snapshot title parse error:', e);
              }
            }
            if (d.healthSyncEnabled !== undefined) setHealthSyncEnabled(d.healthSyncEnabled);
            if (d.healthConnected !== undefined) {
              setHealthConnected(d.healthConnected);
              if (d.healthConnected) {
                healthService.setConnectedFromStorage(true);
              }
            }
          } catch (e) {
            __DEV__ && console.log('[AppContext] parse error:', e);
          }
        }
        if (overrideRaw) {
          try {
            const ov = JSON.parse(overrideRaw) as WorkoutOverride;
            const today = getTodayDateStr();
            if (ov.setDate === today) {
              __DEV__ && console.log('[AppContext] Restoring workout override from today:', ov);
              setWorkoutOverride(ov);
            } else {
              __DEV__ && console.log('[AppContext] Workout override expired (set on', ov.setDate, ', today is', today, '). Clearing.');
              AsyncStorage.removeItem(OVERRIDE_STORAGE_KEY).catch(() => {});
            }
          } catch (e) {
            __DEV__ && console.log('[AppContext] override parse error:', e);
          }
        }
        if (savedWRaw) {
          try { setSavedWorkouts(JSON.parse(savedWRaw)); } catch (e) { __DEV__ && console.log('[AppContext] saved workouts parse error:', e); }
        }
        if (prefRaw) {
          try { setExercisePreferences(JSON.parse(prefRaw)); } catch (e) { __DEV__ && console.log('[AppContext] exercise prefs parse error:', e); }
        } else {
          const defaults = buildDefaultExercisePreferences();
          setExercisePreferences(defaults);
          AsyncStorage.setItem(EXERCISE_PREFS_KEY, JSON.stringify(defaults)).catch((e) => __DEV__ && console.warn('[AppContext] Failed to save default exercise prefs:', e));
          __DEV__ && console.log('[AppContext] Applied smart default exercise preferences');
        }
        if (planRaw) {
          try {
            const plan = JSON.parse(planRaw) as WorkoutPlan;
            if (plan.active) setActivePlan(plan);
          } catch (e) { __DEV__ && console.log('[AppContext] plan parse error:', e); }
        }
        if (scheduleRaw) {
          try {
            const sched = JSON.parse(scheduleRaw) as GeneratedPlanSchedule;
            setPlanSchedule(sched);
            __DEV__ && console.log('[AppContext] Restored plan schedule:', sched.weeks.length, 'weeks');
          } catch (e) { __DEV__ && console.log('[AppContext] schedule parse error:', e); }
        }
        if (notifPrefsRaw) {
          try {
            const np = JSON.parse(notifPrefsRaw) as Partial<NotifPrefs>;
            setNotifPrefs(prev => ({ ...prev, ...np }));
            __DEV__ && console.log('[AppContext] Loaded notif prefs:', np);
          } catch (e) { __DEV__ && console.log('[AppContext] notif prefs parse error:', e); }
        }
        if (plannedWorkoutsRaw) {
          try {
            const pw = JSON.parse(plannedWorkoutsRaw) as PlannedWorkout[];
            const today = getTodayDateStr();
            const valid = pw.filter(p => p.date >= today);
            setPlannedWorkouts(valid);
            __DEV__ && console.log('[AppContext] Loaded planned workouts:', valid.length);
          } catch (e) { __DEV__ && console.log('[AppContext] planned workouts parse error:', e); }
        }
        if (lastModifyRaw) {
          try {
            const lm = JSON.parse(lastModifyRaw) as LastModifyState;
            const today = getTodayDateStr();
            if (lm.setDate === today) {
              __DEV__ && console.log('[AppContext] Restoring lastModifyState from today:', lm);
              setLastModifyState(lm);
            } else {
              __DEV__ && console.log('[AppContext] lastModifyState expired (set on', lm.setDate, ', today is', today, '). Clearing.');
              AsyncStorage.removeItem(LAST_MODIFY_KEY).catch(() => {});
            }
          } catch (e) {
            __DEV__ && console.log('[AppContext] lastModifyState parse error:', e);
            AsyncStorage.removeItem(LAST_MODIFY_KEY).catch(() => {});
          }
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const applyWorkoutOverride = useCallback((override: WorkoutOverride) => {
    const withDate = { ...override, setDate: getTodayDateStr() };
    __DEV__ && console.log('[AppContext] Setting workout override:', withDate);
    setWorkoutOverride(withDate);
    AsyncStorage.setItem(OVERRIDE_STORAGE_KEY, JSON.stringify(withDate)).catch((e) =>
      __DEV__ && console.log('[AppContext] override save error:', e)
    );
  }, []);

  const clearWorkoutOverride = useCallback(() => {
    __DEV__ && console.log('[AppContext] Clearing workout override');
    setWorkoutOverride(null);
    AsyncStorage.removeItem(OVERRIDE_STORAGE_KEY).catch(() => {});
  }, []);

  const bumpSettingsSaveVersion = useCallback(() => {
    setSettingsSaveVersion((v) => v + 1);
  }, []);

  const saveLastModifyState = useCallback((state: LastModifyState) => {
    const withDate = { ...state, setDate: getTodayDateStr() };
    __DEV__ && console.log('[AppContext] Saving lastModifyState:', withDate);
    setLastModifyState(withDate);
    AsyncStorage.setItem(LAST_MODIFY_KEY, JSON.stringify(withDate)).catch((e) =>
      __DEV__ && console.log('[AppContext] lastModifyState save error:', e)
    );
  }, []);

  const clearLastModifyState = useCallback(() => {
    setLastModifyState(null);
    AsyncStorage.removeItem(LAST_MODIFY_KEY).catch(() => {});
  }, []);

  const saveSettingsToStorage = useCallback((settings: {
    workoutStyle: string;
    trainingSplit: string;
    targetDuration: number;
    restBetweenSets: number;
    warmUp: boolean;
    coolDown: boolean;
    recovery: boolean;
    addCardio: boolean;
    coreFinisher?: boolean;
  }) => {
    const data = {
      userName,
      userPhotoUri,
      dateOfBirth,
      heightFt,
      heightIn,
      weight,
      sex,
      bodyFat,
      fitnessLevel,
      trainingGoals,
      specialLifeCase,
      specialLifeCaseDetail,
      muscleReadiness,
      workoutStyle: settings.workoutStyle,
      trainingSplit: settings.trainingSplit,
      targetDuration: settings.targetDuration,
      restBetweenSets: settings.restBetweenSets,
      warmUp: settings.warmUp,
      coolDown: settings.coolDown,
      recovery: settings.recovery,
      addCardio: settings.addCardio,
      coreFinisher: settings.coreFinisher ?? coreFinisher,
      appTheme,
      reflectWorkoutColor,
      selectedEquipment,
      savedGyms,
      streak,
      lastStreakDate,
      trainingScore,
      hoursTrainedToday,
      targetDone,
      currentWorkoutTitle,
      healthSyncEnabled,
      healthConnected,
    };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch((e) =>
      __DEV__ && console.log('[AppContext] saveSettingsToStorage error:', e)
    );
  }, [
    userName, userPhotoUri, dateOfBirth, heightFt, heightIn, weight, sex, bodyFat,
    fitnessLevel, trainingGoals, specialLifeCase, specialLifeCaseDetail, muscleReadiness,
    appTheme, reflectWorkoutColor, selectedEquipment, savedGyms,
    streak, lastStreakDate, trainingScore, hoursTrainedToday, targetDone, currentWorkoutTitle,
    healthSyncEnabled, healthConnected,
  ]);

  const saveSavedWorkouts = useCallback((workouts: SavedWorkout[]) => {
    setSavedWorkouts(workouts);
    AsyncStorage.setItem(SAVED_WORKOUTS_KEY, JSON.stringify(workouts)).catch((e) =>
      __DEV__ && console.log('[AppContext] saved workouts save error:', e)
    );
  }, []);

  const saveExercisePreferences = useCallback((prefs: Record<string, ExercisePreference>) => {
    setExercisePreferences(prefs);
    AsyncStorage.setItem(EXERCISE_PREFS_KEY, JSON.stringify(prefs)).catch((e) =>
      __DEV__ && console.log('[AppContext] exercise prefs save error:', e)
    );
  }, []);

  const saveActivePlan = useCallback((plan: WorkoutPlan | null, schedule?: GeneratedPlanSchedule | null) => {
    setActivePlan(plan);
    if (plan) {
      AsyncStorage.setItem(WORKOUT_PLAN_KEY, JSON.stringify(plan)).catch((e) =>
        __DEV__ && console.log('[AppContext] plan save error:', e)
      );
    } else {
      // Cancel any in-flight background generation
      if (planGenTimerRef.current) {
        clearInterval(planGenTimerRef.current);
        planGenTimerRef.current = null;
      }
      if (planGenRef.current) {
        planGenRef.current.abortController.abort();
        planGenRef.current = null;
      }
      setPlanGenProgress(null);
      AsyncStorage.removeItem(WORKOUT_PLAN_KEY).catch(() => {});
      // Clear per-day workout cache when plan is cancelled
      AsyncStorage.getAllKeys()
        .then(keys => keys.filter(k => k.startsWith('@zeal_plan_day_workout_')))
        .then(planKeys => planKeys.length > 0 ? AsyncStorage.multiRemove(planKeys) : Promise.resolve())
        .catch(() => {});
    }
    if (schedule !== undefined) {
      setPlanSchedule(schedule ?? null);
      if (schedule) {
        AsyncStorage.setItem(PLAN_SCHEDULE_KEY, JSON.stringify(schedule)).catch((e) =>
          __DEV__ && console.log('[AppContext] schedule save error:', e)
        );
      } else {
        AsyncStorage.removeItem(PLAN_SCHEDULE_KEY).catch(() => {});
      }
    }
  }, []);

  // ── Background plan generation ─────────────────────────────────────────────
  const planGenCounterRef = useRef(0);
  const planGenTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startPlanGeneration = useCallback(async (
    plan: WorkoutPlan,
    schedule: GeneratedPlanSchedule,
    genParamsFactory: (day: DayPrescription) => GenerateWorkoutParams,
  ): Promise<void> => {
    const todayStr = getTodayDateStr();
    const allWeeks = schedule.weeks as WeekSchedule[];

    const allTrainingDays = allWeeks
      .flatMap(w => w.days)
      .filter((d: DayPrescription) => !d.is_rest && d.date >= todayStr)
      .slice(0, 60);

    if (allTrainingDays.length === 0) return;

    // Split into week 1 and remaining
    const week1Number = allWeeks[0]?.week_number;
    const week1Days = allTrainingDays.filter((d: DayPrescription) => d.week_number === week1Number);
    const remainingDays = allTrainingDays.filter((d: DayPrescription) => d.week_number !== week1Number);

    // Abort any previous generation
    if (planGenRef.current) {
      planGenRef.current.abortController.abort();
    }
    if (planGenTimerRef.current) {
      clearInterval(planGenTimerRef.current);
    }

    const abortController = new AbortController();
    planGenRef.current = { abortController, promise: Promise.resolve() };
    planGenCounterRef.current = 0;

    const totalCount = allTrainingDays.length;

    setPlanGenProgress({
      planId: plan.id,
      current: 0,
      total: totalCount,
      phase: 'week1',
    });

    // Helper: generate and save a single day (updates ref, not state)
    const generateDay = async (d: DayPrescription) => {
      if (abortController.signal.aborted) return;
      try {
        const params = genParamsFactory(d);
        const result = await generateWorkoutAsync(params, d);

        // Attach core finisher if enabled and not a deload week
        const suppressCore = (d.volume_modifier ?? 1.0) < 0.75;
        if (coreFinisher && !suppressCore) {
          result.coreFinisher = generateCoreFinisherFromEngine({
            fitnessLevel: params.fitnessLevel,
            availableEquipment: params.availableEquipment,
          });
        }

        await AsyncStorage.setItem(
          `@zeal_plan_day_workout_${plan.id}_${d.date}`,
          JSON.stringify(result)
        );
        if (d.date === todayStr) {
          const snap = { date: todayStr, workout: result, title: d.session_type };
          await AsyncStorage.setItem('@zeal_daily_generated_workout_v1', JSON.stringify(snap));
        }
      } catch (e) {
        __DEV__ && console.warn('[PlanGen] Failed to generate day', d.date, e);
      }
      planGenCounterRef.current++;
    };

    // Phase 1: Week 1 in parallel
    await Promise.all(week1Days.map(generateDay));

    if (abortController.signal.aborted) return;

    // Sync counter to state once after week 1
    setPlanGenProgress({
      planId: plan.id,
      current: planGenCounterRef.current,
      total: totalCount,
      phase: 'background',
    });

    // Start a throttled interval to sync counter to state (every 2s)
    planGenTimerRef.current = setInterval(() => {
      if (abortController.signal.aborted) {
        if (planGenTimerRef.current) clearInterval(planGenTimerRef.current);
        return;
      }
      setPlanGenProgress(prev => prev ? { ...prev, current: planGenCounterRef.current } : null);
    }, 2000);

    // Phase 2: Remaining weeks in batches of 3
    const BATCH_SIZE = 3;
    const bgPromise = (async () => {
      for (let i = 0; i < remainingDays.length; i += BATCH_SIZE) {
        if (abortController.signal.aborted) return;
        const batch = remainingDays.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(generateDay));
      }
      // Clean up timer
      if (planGenTimerRef.current) {
        clearInterval(planGenTimerRef.current);
        planGenTimerRef.current = null;
      }
      if (!abortController.signal.aborted) {
        setPlanGenProgress({ planId: plan.id, current: totalCount, total: totalCount, phase: 'done' });
      }
    })();

    planGenRef.current.promise = bgPromise;
    // Do NOT await bgPromise — let it run in background
  }, []);

  const clearPlanGenProgress = useCallback(() => {
    setPlanGenProgress(null);
  }, []);

  const cancelPlanGeneration = useCallback(() => {
    if (planGenTimerRef.current) {
      clearInterval(planGenTimerRef.current);
      planGenTimerRef.current = null;
    }
    if (planGenRef.current) {
      planGenRef.current.abortController.abort();
      planGenRef.current = null;
    }
    setPlanGenProgress(null);
  }, []);
  // ───────────────────────────────────────────────────────────────────────────

  const saveNotifPrefs = useCallback((prefs: Partial<NotifPrefs>) => {
    setNotifPrefs(prev => {
      const updated = { ...prev, ...prefs };
      AsyncStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(updated)).catch((e) =>
        __DEV__ && console.log('[AppContext] notif prefs save error:', e)
      );
      __DEV__ && console.log('[AppContext] Saved notif prefs:', updated);
      return updated;
    });
  }, []);

  const savePlannedWorkout = useCallback((workout: PlannedWorkout) => {
    __DEV__ && console.log('[AppContext] Saving planned workout:', workout);
    setPlannedWorkouts(prev => {
      const filtered = prev.filter(p => p.date !== workout.date);
      const updated = [...filtered, workout];
      AsyncStorage.setItem(PLANNED_WORKOUTS_KEY, JSON.stringify(updated)).catch(e =>
        __DEV__ && console.log('[AppContext] planned workouts save error:', e)
      );
      return updated;
    });
  }, []);

  const deletePlannedWorkout = useCallback((id: string) => {
    __DEV__ && console.log('[AppContext] Deleting planned workout:', id);
    setPlannedWorkouts(prev => {
      const updated = prev.filter(p => p.id !== id);
      AsyncStorage.setItem(PLANNED_WORKOUTS_KEY, JSON.stringify(updated)).catch(e =>
        __DEV__ && console.log('[AppContext] planned workouts delete error:', e)
      );
      return updated;
    });
  }, []);

  const getPlannedWorkoutForDate = useCallback((date: string): PlannedWorkout | null => {
    return plannedWorkouts.find(p => p.date === date) ?? null;
  }, [plannedWorkouts]);

  const login = useCallback(() => {
    __DEV__ && console.log('[AppContext] Logging in — setting isLoggedIn = true');
    setIsLoggedIn(true);
    AsyncStorage.setItem(IS_LOGGED_IN_KEY, 'true').catch((e) =>
      __DEV__ && console.log('[AppContext] isLoggedIn save error:', e)
    );
  }, []);

  const logout = useCallback(() => {
    __DEV__ && console.log('[AppContext] Logging out — clearing isLoggedIn');
    setIsLoggedIn(false);
    AsyncStorage.removeItem(IS_LOGGED_IN_KEY).catch((e) =>
      __DEV__ && console.log('[AppContext] isLoggedIn remove error:', e)
    );
  }, []);

  const performFullReset = useCallback(async () => {
    try {
      await AsyncStorage.clear();
      __DEV__ && console.log('[AppContext] AsyncStorage fully cleared');
    } catch (e) {
      console.error('[AppContext] Error clearing AsyncStorage:', e);
    }
    setUserName('Kody');
    setUserPhotoUri(null);
    setDateOfBirth('');
    setHeightFt(6);
    setHeightIn(0);
    setWeight(164);
    setSex('male');
    setBodyFat(15);
    setFitnessLevel('intermediate');
    setTrainingGoals(['Build Muscle']);
    setSpecialLifeCase('none');
    setSpecialLifeCaseDetail('');
    setMuscleReadiness(DEFAULT_MUSCLE_READINESS);
    setWorkoutStyle('Strength');
    setTrainingSplit('Push Day');
    setTargetDuration(60);
    setRestBetweenSets(0.5);
    setWarmUp(true);
    setCoolDown(true);
    setRecovery(false);
    setAddCardio(false);
    setCoreFinisher(false);
    setAppTheme('system');
    setReflectWorkoutColor(false);
    setSelectedEquipment({});
    setSavedGyms(DEFAULT_SAVED_GYMS);
    setWorkoutOverride(null);
    setSettingsSaveVersion(0);
    setLastModifyState(null);
    setStreak(1);
    setLastStreakDate(getTodayDateStr());
    setTrainingScore(0);
    setHoursTrainedToday('0h');
    setTargetDone(0);
    setCurrentWorkoutTitle('');
    setSavedWorkouts([]);
    setExercisePreferences({});
    setActivePlan(null);
    setPlanSchedule(null);
    setLoadedWorkout(null);
    setPlannedWorkouts([]);
    setHealthSyncEnabled(false);
    setHealthConnected(false);
    setNotifPrefs({
      dailyEnabled: false,
      dailyHour: 8,
      dailyMinute: 0,
      streakEnabled: false,
      streakHour: 20,
      streakMinute: 0,
      weeklySummaryEnabled: false,
    });
    setIsLoggedIn(false);
    setOnboardingCompleteState(false);
    setShowPlusSpotlight(false);
    setGooglePrefill(null);
    setNewUserResetToken(t => t + 1);
    __DEV__ && console.log('[AppContext] All in-memory state reset to defaults');
  }, []);

  const deleteAccount = useCallback(async () => {
    __DEV__ && console.log('[AppContext] Deleting account — clearing all storage and resetting state');
    await performFullReset();
  }, [performFullReset]);

  const resetForNewUser = useCallback(async () => {
    __DEV__ && console.log('[AppContext] Resetting for new user — clearing all storage and state');
    await performFullReset();
  }, [performFullReset]);

  const saveOnboardingProfile = useCallback((profile: {
    userName: string;
    userPhotoUri: string | null;
    dateOfBirth: string;
    heightFt: number;
    heightIn: number;
    weight: number;
    sex: Sex;
    fitnessLevel: FitnessLevel;
    trainingGoals: string[];
    workoutStyle: string;
    selectedEquipment: Record<string, number>;
    warmUp: boolean;
    coolDown: boolean;
    recovery: boolean;
    addCardio: boolean;
    coreFinisher: boolean;
  }) => {
    setUserName(profile.userName);
    setUserPhotoUri(profile.userPhotoUri);
    setDateOfBirth(profile.dateOfBirth);
    setHeightFt(profile.heightFt);
    setHeightIn(profile.heightIn);
    setWeight(profile.weight);
    setSex(profile.sex);
    setFitnessLevel(profile.fitnessLevel);
    setTrainingGoals(profile.trainingGoals);
    setWorkoutStyle(profile.workoutStyle);
    setSelectedEquipment(profile.selectedEquipment);
    setWarmUp(profile.warmUp);
    setCoolDown(profile.coolDown);
    setRecovery(profile.recovery);
    setAddCardio(profile.addCardio);
    setCoreFinisher(profile.coreFinisher);
    const data = {
      userName: profile.userName,
      userPhotoUri: profile.userPhotoUri,
      dateOfBirth: profile.dateOfBirth,
      heightFt: profile.heightFt,
      heightIn: profile.heightIn,
      weight: profile.weight,
      sex: profile.sex,
      bodyFat: 0,
      fitnessLevel: profile.fitnessLevel,
      trainingGoals: profile.trainingGoals,
      specialLifeCase: 'none',
      specialLifeCaseDetail: '',
      muscleReadiness: DEFAULT_MUSCLE_READINESS,
      workoutStyle: profile.workoutStyle,
      trainingSplit: 'Push',
      targetDuration: 60,
      restBetweenSets: 0.5,
      warmUp: profile.warmUp,
      coolDown: profile.coolDown,
      recovery: profile.recovery,
      addCardio: profile.addCardio,
      coreFinisher: profile.coreFinisher,
      appTheme: 'dark',
      reflectWorkoutColor: false,
      selectedEquipment: profile.selectedEquipment,
      savedGyms: DEFAULT_SAVED_GYMS,
      streak: 1,
      lastStreakDate: getTodayDateStr(),
      trainingScore: 0,
      hoursTrainedToday: '0h',
      targetDone: 0,
      currentWorkoutTitle: '',
      healthSyncEnabled: false,
      healthConnected: false,
    };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(e =>
      __DEV__ && console.log('[AppContext] saveOnboardingProfile error:', e)
    );
    __DEV__ && console.log('[AppContext] Saved onboarding profile for', profile.userName);
  }, []);

  const completeOnboarding = useCallback(() => {
    __DEV__ && console.log('[AppContext] Marking onboarding complete');
    setOnboardingCompleteState(true);
    setIsLoggedIn(true);
    AsyncStorage.setItem(ONBOARDING_KEY, 'true').catch((e) =>
      __DEV__ && console.log('[AppContext] onboarding save error:', e)
    );
    AsyncStorage.setItem(IS_LOGGED_IN_KEY, 'true').catch((e) =>
      __DEV__ && console.log('[AppContext] isLoggedIn save error on onboarding:', e)
    );
  }, []);

  const markDayMissed = useCallback((dateStr: string) => {
    setActivePlan(prev => {
      if (!prev) return prev;
      // Avoid duplicates — same guard as markDayCompleted
      if ((prev.missedDays ?? []).includes(dateStr)) return prev;
      const missed = [...(prev.missedDays ?? []), dateStr];
      const updated = { ...prev, missedDays: missed };
      AsyncStorage.setItem(WORKOUT_PLAN_KEY, JSON.stringify(updated)).catch((e) => __DEV__ && console.warn('[AppContext] Failed to save missed day to plan:', e));
      return updated;
    });
  }, []);

  const markDayCompleted = useCallback((dateStr: string) => {
    setActivePlan(prev => {
      if (!prev) return prev;
      // Avoid duplicates
      if (prev.completedDays?.includes(dateStr)) return prev;
      const completed = [...(prev.completedDays ?? []), dateStr];
      const updated = { ...prev, completedDays: completed };
      AsyncStorage.setItem(WORKOUT_PLAN_KEY, JSON.stringify(updated)).catch((e) => __DEV__ && console.warn('[AppContext] Failed to save completed day to plan:', e));
      return updated;
    });
  }, []);

  // Auto-detect missed training days: scan past plan days not in completedDays → add to missedDays.
  // Deps on plan id + completedDays.length so it re-runs after each completion but stabilises quickly.
  useEffect(() => {
    if (!activePlan || !planSchedule) return;
    const today = getTodayDateStr();
    const newMissed: string[] = [];
    for (const week of planSchedule.weeks) {
      for (const day of week.days) {
        if (
          !day.is_rest &&
          day.date < today &&
          !(activePlan.completedDays ?? []).includes(day.date) &&
          !(activePlan.missedDays ?? []).includes(day.date)
        ) {
          newMissed.push(day.date);
        }
      }
    }
    if (newMissed.length === 0) return;
    setActivePlan(prev => {
      if (!prev) return prev;
      const combined = [...new Set([...(prev.missedDays ?? []), ...newMissed])];
      const updated = { ...prev, missedDays: combined };
      AsyncStorage.setItem(WORKOUT_PLAN_KEY, JSON.stringify(updated)).catch((e) =>
        __DEV__ && console.warn('[AppContext] Failed to persist auto-detected missed days:', e)
      );
      __DEV__ && console.log(`[AppContext] Auto-marked ${newMissed.length} missed training day(s):`, newMissed);
      return updated;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlan?.id, activePlan?.completedDays?.length, planSchedule]);

  const getTodayPrescription = useCallback((): DayPrescription | null => {
    if (!planSchedule) return null;
    const today = getTodayDateStr();
    for (const week of planSchedule.weeks) {
      for (const day of week.days) {
        if (day.date === today) return day;
      }
    }
    return null;
  }, [planSchedule]);

  const saveState = useCallback(() => {
    const data = {
      userName,
      userPhotoUri,
      dateOfBirth,
      heightFt,
      heightIn,
      weight,
      sex,
      bodyFat,
      fitnessLevel,
      trainingGoals,
      specialLifeCase,
      specialLifeCaseDetail,
      activityLevel,
      muscleReadiness,
      workoutStyle,
      trainingSplit,
      targetDuration,
      restBetweenSets,
      warmUp,
      coolDown,
      recovery,
      addCardio,
      coreFinisher,
      appTheme,
      reflectWorkoutColor,
      selectedEquipment,
      savedGyms,
      streak,
      lastStreakDate,
      trainingScore,
      hoursTrainedToday,
      targetDone,
      currentWorkoutTitle,
      healthSyncEnabled,
      healthConnected,
    };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch((e) =>
      __DEV__ && console.log('[AppContext] save error:', e)
    );
  }, [
    userName,
    userPhotoUri,
    heightFt,
    heightIn,
    weight,
    sex,
    bodyFat,
    fitnessLevel,
    trainingGoals,
    specialLifeCase,
    specialLifeCaseDetail,
    activityLevel,
    muscleReadiness,
    workoutStyle,
    trainingSplit,
    targetDuration,
    restBetweenSets,
    warmUp,
    coolDown,
    recovery,
    addCardio,
    coreFinisher,
    appTheme,
    reflectWorkoutColor,
    selectedEquipment,
    savedGyms,
    streak,
    lastStreakDate,
    trainingScore,
    hoursTrainedToday,
    targetDone,
    currentWorkoutTitle,
    healthSyncEnabled,
    healthConnected,
  ]);

  const effectiveTheme = useMemo(() => {
    let isDark: boolean;
    if (appTheme === 'system') isDark = systemScheme === 'dark';
    else if (appTheme === 'dark' || appTheme === 'zeal') isDark = true;
    else if (appTheme === 'light') isDark = false;
    else if (appTheme === 'neon') isDark = true;
    else isDark = systemScheme === 'dark';

    const baseColors =
      appTheme === 'neon' ? Colors.neon : isDark ? Colors.dark : Colors.light;

    let accent = Colors.accent;
    if (
      reflectWorkoutColor &&
      (appTheme === 'system' || appTheme === 'dark' || appTheme === 'light')
    ) {
      accent = WORKOUT_STYLE_COLORS[workoutStyle] ?? Colors.accent;

    } else if (appTheme === 'zeal') {
      accent = getTodayZealAccent();
    } else if (appTheme === 'neon') {
      accent = '#00e5ff';
    }

    return {
      colors: baseColors,
      accent,
      isDark,
      isZeal: appTheme === 'zeal',
      isNeon: appTheme === 'neon',
    };
  }, [appTheme, systemScheme, workoutStyle, reflectWorkoutColor]);

  return useMemo(
    () => ({
      userName,
      setUserName,
      userPhotoUri,
      setUserPhotoUri,
      dateOfBirth,
      setDateOfBirth,
      heightFt,
      setHeightFt,
      heightIn,
      setHeightIn,
      weight,
      setWeight,
      sex,
      setSex,
      bodyFat,
      setBodyFat,
      fitnessLevel,
      setFitnessLevel,
      trainingGoals,
      setTrainingGoals,
      specialLifeCase,
      setSpecialLifeCase,
      specialLifeCaseDetail,
      setSpecialLifeCaseDetail,
      activityLevel,
      setActivityLevel,
      muscleReadiness,
      setMuscleReadiness,
      workoutStyle,
      setWorkoutStyle,
      trainingSplit,
      setTrainingSplit,
      targetDuration,
      setTargetDuration,
      restBetweenSets,
      setRestBetweenSets,
      warmUp,
      setWarmUp,
      coolDown,
      setCoolDown,
      recovery,
      setRecovery,
      addCardio,
      setAddCardio,
      coreFinisher,
      setCoreFinisher,
      appTheme,
      setAppTheme,
      reflectWorkoutColor,
      setReflectWorkoutColor,
      selectedEquipment,
      setSelectedEquipment,
      savedGyms,
      setSavedGyms,
      effectiveTheme,
      saveState,
      loaded,
      workoutOverride,
      applyWorkoutOverride,
      clearWorkoutOverride,
      settingsSaveVersion,
      bumpSettingsSaveVersion,
      saveSettingsToStorage,
      streak,
      setStreak,
      lastStreakDate,
      setLastStreakDate,
      trainingScore,
      setTrainingScore,
      hoursTrainedToday,
      setHoursTrainedToday,
      targetDone,
      setTargetDone,
      currentWorkoutTitle,
      setCurrentWorkoutTitle,
      savedWorkouts,
      saveSavedWorkouts,
      exercisePreferences,
      saveExercisePreferences,
      activePlan,
      planSchedule,
      saveActivePlan,
      onboardingComplete,
      completeOnboarding,
      isLoggedIn,
      login,
      logout,
      markDayMissed,
      markDayCompleted,
      getTodayPrescription,
      healthSyncEnabled,
      setHealthSyncEnabled,
      healthConnected,
      setHealthConnected,
      notifPrefs,
      saveNotifPrefs,
      loadedWorkout,
      setLoadedWorkout,
      lastModifyState,
      saveLastModifyState,
      clearLastModifyState,
      plannedWorkouts,
      savePlannedWorkout,
      deletePlannedWorkout,
      getPlannedWorkoutForDate,
      showPlusSpotlight,
      setShowPlusSpotlight,
      googlePrefill,
      setGooglePrefill,
      deleteAccount,
      resetForNewUser,
      saveOnboardingProfile,
      newUserResetToken,
      planGenProgress,
      startPlanGeneration,
      clearPlanGenProgress,
      cancelPlanGeneration,
    }),
    [
      userName, userPhotoUri, dateOfBirth, heightFt, heightIn, weight, sex, bodyFat,
      fitnessLevel, trainingGoals, specialLifeCase, specialLifeCaseDetail,
      muscleReadiness, workoutStyle, trainingSplit, targetDuration, restBetweenSets,
      warmUp, coolDown, recovery, addCardio, coreFinisher, setCoreFinisher, appTheme, reflectWorkoutColor,
      selectedEquipment, savedGyms, effectiveTheme, saveState, loaded,
      workoutOverride, applyWorkoutOverride, clearWorkoutOverride,
      settingsSaveVersion, bumpSettingsSaveVersion, saveSettingsToStorage,
      streak, setStreak, lastStreakDate, setLastStreakDate,
      trainingScore, setTrainingScore,
      hoursTrainedToday, setHoursTrainedToday,
      targetDone, setTargetDone,
      currentWorkoutTitle, setCurrentWorkoutTitle,
      savedWorkouts, saveSavedWorkouts,
      exercisePreferences, saveExercisePreferences,
      onboardingComplete, completeOnboarding,
      isLoggedIn, login, logout,
      activePlan, planSchedule, saveActivePlan, markDayMissed, markDayCompleted, getTodayPrescription,
      healthSyncEnabled, setHealthSyncEnabled, healthConnected, setHealthConnected,
      notifPrefs, saveNotifPrefs,
      loadedWorkout, setLoadedWorkout,
      lastModifyState, saveLastModifyState, clearLastModifyState,
      plannedWorkouts, savePlannedWorkout, deletePlannedWorkout, getPlannedWorkoutForDate,
      showPlusSpotlight, setShowPlusSpotlight,
      googlePrefill, setGooglePrefill, deleteAccount, resetForNewUser, saveOnboardingProfile, newUserResetToken,
      planGenProgress, startPlanGeneration, clearPlanGenProgress, cancelPlanGeneration,
    ]
  );
});

export function useZealTheme() {
  const { effectiveTheme } = useAppContext();
  return effectiveTheme;
}
