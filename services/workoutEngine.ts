// ═══════════════════════════════════════════════════════
// LEGACY INTERFACES — other files depend on these shapes
// ═══════════════════════════════════════════════════════

export interface WorkoutExercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  rest: string;
  muscleGroup: string;
  equipment: string;
  notes: string;
  type: string;
  movementType: string;
  groupType: 'superset' | 'circuit' | 'rounds' | null;
  groupId: string | null;
  suggestedWeight: string;
  lastSessionWeight: string;
  lastSessionReps: string;
  exerciseRef: { movement_pattern?: string; equipment_required?: string[] } | null;
}

export interface CardioItem {
  name: string;
  duration: string;
  format: string;
  rpe: string;
  notes: string;
}

export interface WarmupItem {
  name: string;
  description: string;
  swappable: boolean;
}

export interface CooldownItem {
  name: string;
  description: string;
}

export interface RecoveryItem {
  name: string;
  description: string;
  benefit: string;
}

export interface SeventyFiveHardSession {
  label: string;
  isOutdoor: boolean;
  modality: string;
  exercises: WorkoutExercise[];
  estimatedDuration: number;
}

export interface GeneratedWorkout {
  warmup: WarmupItem[];
  workout: WorkoutExercise[];
  coreFinisher?: WorkoutExercise[];
  cardio: CardioItem[];
  cooldown: CooldownItem[];
  recovery: RecoveryItem[];
  estimatedDuration: number;
  style: string;
  split: string;
  metconFormat: string | null;
  metconTimeCap: number | null;
  metconRounds: number | null;
  /** Present when style is 75 Hard — per-session exercise blocks */
  sessions75Hard?: SeventyFiveHardSession[];
}

export interface GenerateWorkoutParams {
  style: string;
  split: string;
  targetDuration: number;
  restSlider: number;
  availableEquipment: Record<string, number>;
  fitnessLevel: string;
  sex: string;
  specialLifeCase: string;
  specialLifeCaseDetail: string;
  warmUp: boolean;
  coolDown: boolean;
  recovery: boolean;
  addCardio: boolean;
  specificMuscles: string[];
  seedOffset?: number;
  planPhase?: string;
  volumeModifier?: number;
  bodyweightLbs?: number;
  cacheVariantKey?: string;
}

// ═══════════════════════════════════════════════════════
// V2 ENGINE CODE STARTS BELOW
// ═══════════════════════════════════════════════════════

import {
  getZealExerciseDatabase,
  getExerciseDatabase,
  WARMUP_EXERCISES,
  COOLDOWN_EXERCISES,
  RECOVERY_ITEMS,
  type Exercise,
  type MovementType,
  type ZealExercise,
  type MuscleGroup,
  type DefaultLoadTable,
  type LoadEntry,
} from '@/mocks/exerciseDatabase';

import type { DayPrescription } from '@/services/planEngine';

import {
  REST_TIERS,
  TRANSITION_BUFFER_SECONDS,
  DISTRACTION_BUFFER_FACTOR,
  SCORING_WEIGHTS,
  EXERCISE_POPULARITY_SCORES,
  MIN_EXERCISES_PER_STYLE,
  MAX_EXERCISES_PER_STYLE,
  STYLE_ENGINE_CONFIGS,
  STYLE_DURATION_OVERRIDES,
  PROGRESSIVE_OVERLOAD,
  FEEDBACK_ADJUSTMENT,
  WARMUP_EXERCISE_COUNT,
  COOLDOWN_EXERCISE_COUNT,
  SPLIT_TO_MUSCLES,
  UPPER_BODY_MUSCLES,
  mapLegacyStyleToEngine,
  mapEngineStyleToDisplay,
  getDifficultyKey,
  type RestTier,
  type ExerciseRole,
  type StyleEngineConfig,
} from '@/services/engineConstants';

import {
  getStyleRules,
  calculateStyleRestSeconds,
  selectFormatForStyle,
  selectMetconFormat,
  getAMRAPParams,
  getEMOMParams,
  getRFTParams,
  getChipperParams,
  getLadderParams,
  getTabataParams,
  getHyroxRunDistance,
  getHyroxStationCount,
  getPilatesPositionOrder,
  getMobilityRegionOrder,
  getExerciseCountForPhase,
  type FitnessLevel,
  type StyleGenerationRules,
} from '@/services/styleRules';

import {
  getArchitectureForStyle,
  type SessionArchitecture,
  type SessionPhase,
  type WorkoutFormatId,
} from '@/services/styleFormats';

import {
  lookupRestForStyleAndTier,
  isStyleCircuitBased,
  isStylePositionOrdered,
  TRANSITION_BUFFER_BY_STYLE,
  DISTRACTION_FACTOR_BY_STYLE,
} from '@/services/styleTables';

console.log('[WorkoutEngineV2] Master Rules Engine v1.3 + Style System loaded');

export interface ScoredExercise {
  exercise: ZealExercise;
  score: number;
  role: ExerciseRole;
  restTier: RestTier;
}

export interface SelectedExercise {
  exercise: ZealExercise;
  role: ExerciseRole;
  restTier: RestTier;
  sets: number;
  reps: number;
  loadLbs: number;
  restSeconds: number;
  setDurationSeconds: number;
  exerciseTotalSeconds: number;
}

export interface PlanPrescription {
  style: string;
  split: string;
  targetDurationMinutes: number;
  volumeModifier: number;
  intensityModifier: number;
}

export interface TrainingLogEntry {
  exerciseId: string;
  date: string;
  rpe: number;
  weightUsed: number;
  repsCompleted: number;
  setsCompleted: number;
}

export interface FeedbackData {
  recentSessions: { rpe: number; date: string }[];
}

export interface EngineParams {
  style: string;
  split: string;
  targetDuration: number;
  restSlider: number;
  availableEquipment: Record<string, number>;
  fitnessLevel: string;
  sex: string;
  specialLifeCase: string;
  specialLifeCaseDetail: string;
  warmUp: boolean;
  coolDown: boolean;
  recovery: boolean;
  addCardio: boolean;
  specificMuscles: string[];
  seedOffset?: number;
  exercisePreferences?: Record<string, 'liked' | 'disliked' | 'neutral'>;
  trainingLog?: TrainingLogEntry[];
  feedbackData?: FeedbackData;
  planPrescription?: PlanPrescription | null;
}

export interface EngineWarmupItem {
  name: string;
  description: string;
  swappable: boolean;
  targetMuscles: string[];
}

export interface EngineCooldownItem {
  name: string;
  description: string;
  targetMuscles: string[];
}

export interface EngineWorkoutExercise {
  exerciseRef: ZealExercise;
  role: ExerciseRole;
  sets: number;
  reps: number;
  loadLbs: number;
  restSeconds: number;
  setDurationSeconds: number;
  exerciseTotalSeconds: number;
  groupType: 'superset' | 'circuit' | 'rounds' | null;
  groupId: string | null;
}

export interface EngineResult {
  exercises: EngineWorkoutExercise[];
  warmup: EngineWarmupItem[];
  cooldown: EngineCooldownItem[];
  recovery: { name: string; description: string; benefit: string }[];
  estimatedWorkingSeconds: number;
  estimatedTotalSeconds: number;
  targetMuscles: string[];
  engineStyle: string;
  metconFormat: string | null;
  metconTimeCap: number | null;
  metconRounds: number | null;
  feedbackApplied: boolean;
  planApplied: boolean;
  selectedFormat: string | null;
  sessionArchitectureUsed: string | null;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function getDaySeed(): number {
  const d = new Date();
  const dayBase = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  const secondOffset = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  return dayBase + secondOffset * 37;
}

function shuffleArray<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function determineRestTier(exercise: ZealExercise, role: ExerciseRole): RestTier {
  if (exercise.movement_pattern === 'cardio' || exercise.movement_pattern === 'plyometric') {
    return 'quick_bodyweight';
  }
  if (exercise.movement_pattern === 'rotation' || exercise.movement_pattern === 'pilates' || exercise.movement_pattern === 'mobility') {
    return 'core';
  }
  if (exercise.is_compound && exercise.spinal_load === 'heavy') {
    return 'heavy_compound';
  }
  if (exercise.is_compound) {
    return role === 'accessory' ? 'isolation' : 'moderate_compound';
  }
  if (exercise.equipment_required.length === 0 || (exercise.equipment_required.length === 1 && exercise.equipment_required[0] === 'bodyweight')) {
    if (!exercise.is_compound && exercise.primary_muscles.some(m => m === 'core' || m === 'obliques' || m === 'transverse_abdominis')) {
      return 'core';
    }
    return 'quick_bodyweight';
  }
  return 'isolation';
}

function calculateTieredRest(restTier: RestTier, sliderMultiplier: number): number {
  const config = REST_TIERS[restTier];
  const rawRest = config.base_rest_seconds * sliderMultiplier;
  const clamped = clamp(rawRest, config.floor_seconds, config.ceiling_seconds);
  return Math.round(clamped / 5) * 5;
}

function calculateStyleAwareRest(style: string, restTier: RestTier, sliderMultiplier: number): number {
  const override = lookupRestForStyleAndTier(style, restTier);
  const rawRest = override.base * sliderMultiplier;
  const clamped = clamp(rawRest, override.floor, override.ceiling);
  return Math.round(clamped / 5) * 5;
}

function calculateSetDuration(exercise: ZealExercise, reps: number): number {
  let dur = reps * exercise.default_tempo_seconds_per_rep;
  if (exercise.is_unilateral) {
    dur *= 2;
  }
  return dur;
}

function calculateExerciseTime(setDuration: number, restSeconds: number, sets: number, setupTime: number, styleTransitionBuffer?: number): number {
  const transitionBuffer = styleTransitionBuffer ?? TRANSITION_BUFFER_SECONDS;
  return (setDuration * sets) + (restSeconds * (sets - 1)) + setupTime + transitionBuffer;
}

function resolveSliderMultiplier(rawSlider: number): number {
  return clamp(rawSlider * 2.0, 0.5, 2.0);
}

function resolveAutoStyle(params: EngineParams): string {
  const rawStyle = (params.style ?? '').toLowerCase().trim();
  if (rawStyle !== 'auto') return params.style;

  const split = (params.split ?? '').toLowerCase().trim();
  if (['amrap', 'emom', 'rft', 'chipper', 'ladder'].includes(split)) return 'CrossFit';
  if (split.includes('hyrox') || split.includes('simulation')) return 'Hyrox';
  if (split.includes('zone') || split.includes('fartlek') || split.includes('tempo') || split.includes('interval')) return 'Cardio';
  if (split.includes('flow') || split.includes('recovery')) return 'Mobility';
  if (split.includes('pilates') || split.includes('reformer')) return 'Pilates';
  return 'Strength';
}

function resolveAutoSplitForStyle(style: string, split: string, duration: number, level: FitnessLevel): string {
  const rawSplit = (split ?? '').trim();
  if (rawSplit.toLowerCase() !== 'auto') return rawSplit;

  // Deterministic, context-driven Auto resolver (never random).
  switch (style) {
    case 'crossfit':
      if (duration >= 65) return 'Chipper';
      if (duration >= 50) return 'RFT';
      if (duration <= 35) return 'EMOM';
      return level === 'beginner' ? 'AMRAP' : 'Ladder';
    case 'hyrox':
      if (duration >= 75) return 'Half Simulation';
      if (duration >= 55) return 'Compromised Run';
      return 'Station Practice';
    case 'cardio':
      if (duration >= 50) return 'Steady-State (Zone 2)';
      if (duration <= 30) return 'Intervals';
      return 'Tempo';
    case 'mobility':
      return duration <= 20 ? 'Recovery Day' : 'Full-Body Flow';
    case 'pilates':
      return duration >= 45 ? 'Classical Mat Flow' : 'Pilates Circuit';
    default:
      return rawSplit;
  }
}

function stage1PlanCheck(params: EngineParams): {
  effectiveStyle: string;
  effectiveSplit: string;
  effectiveDuration: number;
  volumeModifier: number;
  intensityModifier: number;
  planApplied: boolean;
} {
  console.log('[EngineV2] Stage 1: Plan Check');

  const plan = params.planPrescription;
  if (plan) {
    console.log('[EngineV2] Active plan found:', plan.style, plan.split, plan.targetDurationMinutes, 'min');
    const engineStyle = mapLegacyStyleToEngine(plan.style);

    const durationOverride = STYLE_DURATION_OVERRIDES[engineStyle];
    let effectiveDuration = plan.targetDurationMinutes;
    if (durationOverride?.fixed_minutes) {
      effectiveDuration = durationOverride.fixed_minutes;
      console.log('[EngineV2] Plan duration overridden by style fixed:', effectiveDuration);
    } else if (durationOverride?.max_working_minutes && effectiveDuration > durationOverride.max_working_minutes) {
      effectiveDuration = durationOverride.max_working_minutes;
      console.log('[EngineV2] Plan duration capped by style max:', effectiveDuration);
    }

    return {
      effectiveStyle: engineStyle,
      effectiveSplit: plan.split,
      effectiveDuration,
      volumeModifier: plan.volumeModifier,
      intensityModifier: plan.intensityModifier,
      planApplied: true,
    };
  }

  const resolvedStyle = resolveAutoStyle(params);
  const engineStyle = mapLegacyStyleToEngine(resolvedStyle);
  let effectiveDuration = params.targetDuration;

  const durationOverride = STYLE_DURATION_OVERRIDES[engineStyle];
  if (durationOverride?.fixed_minutes) {
    effectiveDuration = durationOverride.fixed_minutes;
  } else if (durationOverride?.max_working_minutes && effectiveDuration > durationOverride.max_working_minutes) {
    effectiveDuration = durationOverride.max_working_minutes;
  }

  console.log('[EngineV2] No plan active. style=', engineStyle, 'duration=', effectiveDuration);
  const level = (params.fitnessLevel as FitnessLevel) || 'intermediate';
  const resolvedSplit = resolveAutoSplitForStyle(engineStyle, params.split, effectiveDuration, level);
  if (resolvedSplit !== params.split) {
    console.log('[EngineV2] Auto split resolved:', params.split, '→', resolvedSplit, 'for style', engineStyle);
  }
  return {
    effectiveStyle: engineStyle,
    effectiveSplit: resolvedSplit,
    effectiveDuration,
    volumeModifier: 1.0,
    intensityModifier: 1.0,
    planApplied: false,
  };
}

function stage2SplitResolution(split: string, specificMuscles: string[]): string[] {
  console.log('[EngineV2] Stage 2: Split Resolution, split=', split, 'specificMuscles=', specificMuscles.length);

  if (specificMuscles.length > 0) {
    const lowered = specificMuscles.map(m => m.toLowerCase().replace(/\s+/g, '_'));
    console.log('[EngineV2] Using specific muscles:', lowered);
    return lowered;
  }

  const muscles = SPLIT_TO_MUSCLES[split];
  if (muscles && muscles.length > 0) {
    console.log('[EngineV2] Split resolved to:', muscles);
    return muscles;
  }

  console.log('[EngineV2] No split mapping found, defaulting to full body');
  return SPLIT_TO_MUSCLES['Full Body'] ?? ['chest', 'lats', 'quads', 'core'];
}

// ═══════════════════════════════════════════════════════
// EQUIPMENT ID NORMALIZATION BRIDGE
// Converts legacy drawer IDs → canonical schema IDs
// ═══════════════════════════════════════════════════════
const DRAWER_TO_SCHEMA_EQUIPMENT: Record<string, string> = {
  olympic_bar_45: 'barbell', kilo_bar: 'barbell', hex_bar: 'barbell',
  safety_squat_bar: 'barbell', swiss_grip_bar: 'barbell', cambered_bar: 'barbell',
  womens_bar_35: 'barbell', ez_bar: 'ez_curl_bar',
  db_fixed_set: 'dumbbell', db_hex_set: 'dumbbell', db_powerblock: 'dumbbell',
  db_nuobell: 'dumbbell', db_5: 'dumbbell', db_10: 'dumbbell', db_15: 'dumbbell',
  db_20: 'dumbbell', db_25: 'dumbbell', db_30: 'dumbbell', db_35: 'dumbbell',
  db_40: 'dumbbell', db_50: 'dumbbell',
  kb_8kg: 'kettlebell', kb_12kg: 'kettlebell', kb_16kg: 'kettlebell',
  kb_20kg: 'kettlebell', kb_24kg: 'kettlebell', kb_28kg: 'kettlebell',
  kb_32kg: 'kettlebell', kb_40kg: 'kettlebell', kb_adjustable: 'kettlebell',
  plate_45: 'weight_plates', plate_35: 'weight_plates', plate_25: 'weight_plates',
  plate_15: 'weight_plates', plate_10: 'weight_plates', plate_5: 'weight_plates',
  plate_2_5: 'weight_plates', plate_1_5: 'weight_plates',
  bumper_45: 'weight_plates', bumper_35: 'weight_plates', bumper_25: 'weight_plates',
  bumper_10: 'weight_plates', change_plate_2_5: 'weight_plates', fractional_1_25: 'weight_plates',
  cable_crossover: 'cable_machine', functional_trainer: 'cable_machine', dual_pulley: 'cable_machine',
  lat_pulldown: 'lat_pulldown_machine', seated_row: 'seated_row_machine', row_machine: 'seated_row_machine',
  leg_press: 'leg_press_machine', hack_squat: 'hack_squat_machine',
  leg_extension: 'leg_extension_machine', lying_leg_curl: 'leg_curl_machine',
  seated_leg_curl: 'leg_curl_machine', hip_abduction: 'lateral_raise_machine',
  hip_adduction: 'lateral_raise_machine', pec_deck: 'pec_deck_machine',
  glute_ham: 'roman_chair', back_extension: 'roman_chair',
  pullup_bar: 'pull_up_bar', dip_bar: 'dip_station', parallel_bars: 'dip_station',
  trx: 'trx_suspension', sled_push: 'sled', sled_pull: 'sled',
  med_ball_6: 'medicine_ball', med_ball_10: 'medicine_ball', med_ball_14: 'medicine_ball',
  med_ball_20: 'medicine_ball', slam_ball_20: 'slam_ball', slam_ball_30: 'slam_ball',
  slam_ball_40: 'slam_ball', wall_ball_14: 'medicine_ball', wall_ball_20: 'medicine_ball',
  mobility_bands: 'resistance_bands', yoga_mat: 'pilates_mat',
};

const COMMERCIAL_GYM_DEFAULTS: Record<string, number> = {
  barbell: 1, ez_curl_bar: 1, trap_bar: 1, weight_plates: 1,
  dumbbell: 1, kettlebell: 1,
  cable_machine: 1, lat_pulldown_machine: 1, seated_row_machine: 1,
  leg_press_machine: 1, hack_squat_machine: 1, leg_extension_machine: 1,
  leg_curl_machine: 1, pec_deck_machine: 1, chest_press_machine: 1,
  shoulder_press_machine: 1, lateral_raise_machine: 1, roman_chair: 1,
  smith_machine: 1, flat_bench: 1, adjustable_bench: 1,
  squat_rack: 1, power_rack: 1, pull_up_bar: 1, dip_station: 1,
  treadmill: 1, stationary_bike: 1, rowing_machine: 1, assault_bike: 1,
  ski_erg: 1, plyo_box: 1, battle_ropes: 1, jump_rope: 1,
  medicine_ball: 1, slam_ball: 1, sled: 1, ab_wheel: 1,
  resistance_bands: 1, foam_roller: 1,
};

function normalizeEquipmentIds(rawEquipment: Record<string, number>): Record<string, number> {
  const hasKeys = Object.keys(rawEquipment).length > 0;
  const hasAny = Object.values(rawEquipment).some(v => v > 0);

  if (!hasKeys) {
    console.log('[EngineV2] Equipment never configured (first launch) — defaulting to commercial gym');
    return { ...COMMERCIAL_GYM_DEFAULTS, bodyweight: 1 };
  }

  if (!hasAny) {
    console.log('[EngineV2] No equipment selected — restricting to bodyweight only');
    return { bodyweight: 1 };
  }

  const normalized: Record<string, number> = { bodyweight: 1 };
  for (const [id, qty] of Object.entries(rawEquipment)) {
    if (qty <= 0) continue;
    const schemaId = DRAWER_TO_SCHEMA_EQUIPMENT[id] ?? id;
    normalized[schemaId] = Math.max(normalized[schemaId] ?? 0, qty);
  }
  console.log('[EngineV2] Normalized equipment IDs:', Object.keys(normalized));
  return normalized;
}

function stage3PoolFiltering(
  style: string,
  targetMuscles: string[],
  availableEquipment: Record<string, number>,
  specialLifeCase: string,
  specialLifeCaseDetail: string,
): ZealExercise[] {
  console.log('[EngineV2] Stage 3: Exercise Pool Filtering');
  let pool = [...getZealExerciseDatabase()];
  const startCount = pool.length;

  if (style === 'low_impact') {
    pool = pool.filter(ex =>
      ex.eligible_styles.includes('strength' as never) ||
      ex.eligible_styles.includes('bodybuilding' as never)
    );
    pool = pool.filter(ex => ex.spinal_load === 'none' || ex.spinal_load === 'light');
    pool = pool.filter(ex => ex.difficulty_tier === 'beginner' || ex.difficulty_tier === 'intermediate');
    pool = pool.filter(ex => !(ex.movement_pattern as string === 'cardio'));
    pool = pool.filter(ex => !(ex.movement_pattern as string === 'plyometric'));
    console.log('[EngineV2] After low_impact style gate:', pool.length, '/', startCount);
  } else {
    pool = pool.filter(ex => ex.eligible_styles.includes(style as never));
    console.log('[EngineV2] After style gate:', pool.length, '/', startCount);
  }

  const normalizedEquipment = normalizeEquipmentIds(availableEquipment);
  const hasEquipment = Object.keys(normalizedEquipment).length > 0 &&
    Object.values(normalizedEquipment).some(v => v > 0);

  if (hasEquipment) {
    const availIds = new Set(Object.keys(normalizedEquipment).filter(k => normalizedEquipment[k] > 0));
    pool = pool.filter(ex => {
      const required = ex.equipment_required.filter(e => e !== 'bodyweight');
      if (required.length === 0) return true;
      return required.every(eq => availIds.has(eq));
    });
    console.log('[EngineV2] After equipment gate:', pool.length);
  }

  if (specialLifeCase === 'pregnant') {
    const trimesterTags = ['pregnancy_t1', 'pregnancy_t2', 'pregnancy_t3'];
    pool = pool.filter(ex => !ex.contraindication_tags.some(t => trimesterTags.includes(t)));
    pool = pool.filter(ex => ex.spinal_load !== 'heavy');
    console.log('[EngineV2] After pregnancy contraindication gate:', pool.length);
  } else if (specialLifeCase === 'postpartum') {
    pool = pool.filter(ex => !ex.contraindication_tags.includes('diastasis_recti' as never));
    pool = pool.filter(ex => ex.spinal_load !== 'heavy');
    console.log('[EngineV2] After postpartum gate:', pool.length);
  } else if (specialLifeCase === 'injury' && specialLifeCaseDetail) {
    const injuryArea = specialLifeCaseDetail.toLowerCase();
    const injuryTags = [
      'shoulder_injury', 'shoulder_impingement', 'overhead_restricted',
      'knee_injury', 'acl_tear', 'ankle_injury',
      'lower_back_injury', 'herniated_disc',
      'wrist_injury', 'carpal_tunnel',
      'hip_injury', 'hip_replacement',
      'neck_injury', 'elbow_injury',
    ];
    const matchingTags = injuryTags.filter(t => injuryArea.includes(t.split('_')[0]));
    if (matchingTags.length > 0) {
      pool = pool.filter(ex => !ex.contraindication_tags.some(t => matchingTags.includes(t)));
    }

    const injuryMuscles = injuryArea.split(/[,\s]+/).filter(Boolean);
    if (injuryMuscles.length > 0) {
      pool = pool.filter(ex => {
        const allMuscles = [...ex.primary_muscles, ...ex.secondary_muscles];
        return !allMuscles.some(m => injuryMuscles.includes(m));
      });
    }
    console.log('[EngineV2] After injury contraindication gate:', pool.length);
  }

  if (style === 'low_impact') {
    const LOW_IMPACT_EXCLUDED_IDS = new Set([
      'barbell_back_squat', 'conventional_deadlift', 'sumo_deadlift', 'trap_bar_deadlift',
      'barbell_bench_press', 'standing_overhead_press', 'barbell_bent_over_row',
      'front_squat', 'good_morning', 'zercher_squat', 'power_clean', 'hang_clean',
      'clean_and_jerk', 'snatch', 'dumbbell_snatch',
    ]);
    pool = pool.filter(ex => !LOW_IMPACT_EXCLUDED_IDS.has(ex.id));
    console.log('[EngineV2] After low_impact heavy exercise exclusion gate:', pool.length);
  }

  if (style === 'strength' || style === 'bodybuilding') {
    const beforeConditioningFilter = pool.length;
    pool = pool.filter(ex => {
      if ((ex.movement_pattern as string) === 'cardio') return false;
      if (ex.equipment_required.includes('sled' as never)) return false;
      if (ex.equipment_required.includes('battle_ropes' as never)) return false;
      if ((ex.movement_pattern as string) === 'plyometric') return false;
      return true;
    });
    console.log('[EngineV2] After conditioning/sled gate for', style, ':', pool.length, '/', beforeConditioningFilter);
  }

  if (targetMuscles.length > 0) {
    // Filter by PRIMARY muscles only to prevent wrong-split exercises leaking in
    // via secondary muscles (e.g., squat has secondary: lower_back → would pass Pull filter).
    const muscleFiltered = pool.filter(ex =>
      ex.primary_muscles.some(m => targetMuscles.includes(m))
    );
    if (muscleFiltered.length > 0) {
      pool = muscleFiltered;
    } else {
      console.log('[EngineV2] Muscle filter returned 0 results, keeping full pool');
    }
    console.log('[EngineV2] After muscle group gate:', pool.length);
  }

  console.log('[EngineV2] Pool filtering complete:', pool.length, 'exercises remain');
  return pool;
}

function applyPositionOrdering(
  scored: ScoredExercise[],
  style: string,
): ScoredExercise[] {
  if (!isStylePositionOrdered(style)) return scored;

  const positionOrder = style === 'pilates'
    ? getPilatesPositionOrder()
    : ['standing', 'kneeling', 'seated', 'quadruped', 'supine', 'prone', 'side_lying'];

  const posMap = new Map<string, number>();
  positionOrder.forEach((p, i) => posMap.set(p, i));

  const sorted = [...scored].sort((a, b) => {
    const posA = a.exercise.position;
    const posB = b.exercise.position;
    const idxA = posMap.get(posA) ?? 99;
    const idxB = posMap.get(posB) ?? 99;
    if (idxA !== idxB) return idxA - idxB;
    return b.score - a.score;
  });

  console.log('[EngineV2] Applied position ordering for', style, ':', sorted.slice(0, 5).map(s => `${s.exercise.name}(${s.exercise.position})`).join(', '));
  return sorted;
}

function applyArchitecturePhaseSelection(
  scored: ScoredExercise[],
  style: string,
  split: string,
  fitnessLevel: string,
  targetMuscles: string[],
  rng: () => number,
): ScoredExercise[] {
  const architecture = getArchitectureForStyle(style, split);
  if (!architecture || architecture.phases.length === 0) return scored;

  console.log('[EngineV2] Applying session architecture for', style, ':', architecture.phases.length, 'phases');

  const selected: ScoredExercise[] = [];
  const usedIds = new Set<string>();
  const level = (fitnessLevel as FitnessLevel) || 'intermediate';

  for (const phase of architecture.phases) {
    const count = getExerciseCountForPhase(phase.exercise_count.min, phase.exercise_count.max, level, rng);

    let candidates = scored.filter(s => {
      if (usedIds.has(s.exercise.id)) return false;
      if (phase.role_filter.length > 0 && !phase.role_filter.includes(s.role)) return false;
      if (phase.is_compound_only && !s.exercise.is_compound) return false;
      if (phase.is_isolation_only && s.exercise.is_compound) return false;
      if (phase.muscle_filter && phase.muscle_filter.length > 0) {
        const hasMatch = s.exercise.primary_muscles.some(m => phase.muscle_filter!.includes(m));
        if (!hasMatch) return false;
      }
      if (phase.movement_filter && phase.movement_filter.length > 0) {
        if (!phase.movement_filter.includes(s.exercise.movement_pattern)) return false;
      }
      if (phase.position_filter && phase.position_filter.length > 0) {
        if (!phase.position_filter.includes(s.exercise.position)) return false;
      }
      return true;
    });

    candidates.sort((a, b) => b.score - a.score);

    const picked = candidates.slice(0, count);
    for (const p of picked) {
      selected.push(p);
      usedIds.add(p.exercise.id);
    }

    console.log('[EngineV2] Phase', phase.name, ':', picked.length, '/', count, 'exercises');
  }

  for (const s of scored) {
    if (!usedIds.has(s.exercise.id)) {
      selected.push(s);
      usedIds.add(s.exercise.id);
    }
  }

  return selected;
}

function stage4Scoring(
  pool: ZealExercise[],
  targetMuscles: string[],
  style: string,
  split: string,
  fitnessLevel: string,
  availableEquipment: Record<string, number>,
  exercisePreferences: Record<string, 'liked' | 'disliked' | 'neutral'>,
  trainingLog: TrainingLogEntry[],
  rng: () => number,
): ScoredExercise[] {
  console.log('[EngineV2] Stage 4: Exercise Selection & Scoring (Style-Aware)');

  const config = STYLE_ENGINE_CONFIGS[style];
  const styleRules = getStyleRules(style);
  const usedPatterns = new Set<string>();
  const usedFamilies = new Set<string>();
  const now = Date.now();

  const scored: ScoredExercise[] = pool.map(ex => {
    let score = 0;

    const primaryMatch = ex.primary_muscles.some(m => targetMuscles.includes(m));
    const secondaryMatch = ex.secondary_muscles.some(m => targetMuscles.includes(m));
    if (primaryMatch) score += SCORING_WEIGHTS.muscle_match;
    else if (secondaryMatch) score += SCORING_WEIGHTS.muscle_match * 0.5;

    const normalizedEquip = normalizeEquipmentIds(availableEquipment);
    const hasEquip = Object.keys(normalizedEquip).length > 0;
    if (hasEquip) {
      const required = ex.equipment_required.filter(e => e !== 'bodyweight');
      if (required.length === 0 || required.every(eq => (normalizedEquip[eq] ?? 0) > 0)) {
        score += SCORING_WEIGHTS.equipment_match;
      }
    } else {
      score += SCORING_WEIGHTS.equipment_match;
    }

    const pref = exercisePreferences[ex.id];
    if (pref === 'liked') score += SCORING_WEIGHTS.preference_liked;
    else if (pref === 'disliked') score += SCORING_WEIGHTS.preference_disliked;

    const recentLogs = trainingLog.filter(l => l.exerciseId === ex.id);
    if (recentLogs.length > 0) {
      const lastLog = recentLogs[recentLogs.length - 1];
      const daysSinceLast = Math.floor((now - new Date(lastLog.date).getTime()) / 86400000);
      if (daysSinceLast <= SCORING_WEIGHTS.recency_window_days) {
        score += SCORING_WEIGHTS.recency_penalty_per_day * (SCORING_WEIGHTS.recency_window_days - daysSinceLast);
      }
    }

    if (ex.difficulty_tier === fitnessLevel) {
      score += SCORING_WEIGHTS.difficulty_match;
    } else if (
      (fitnessLevel === 'intermediate' && ex.difficulty_tier === 'beginner') ||
      (fitnessLevel === 'intermediate' && ex.difficulty_tier === 'advanced')
    ) {
      score += SCORING_WEIGHTS.difficulty_match * 0.5;
    }

    if (config && !usedPatterns.has(ex.movement_pattern)) {
      score += SCORING_WEIGHTS.pattern_diversity;
    }

    if (usedFamilies.has(ex.variation_family) && ex.variation_family) {
      score += SCORING_WEIGHTS.variation_family_penalty;
    }

    if (styleRules.special_rules.includes('BODYWEIGHT_PREFERRED')) {
      const isBodyweight = ex.equipment_required.length === 0 ||
        (ex.equipment_required.length === 1 && ex.equipment_required[0] === 'bodyweight');
      if (isBodyweight) score += 8;
    }

    const popularityDelta = EXERCISE_POPULARITY_SCORES[ex.id] ?? 0;
    score += popularityDelta;

    score += rng() * 20;

    let role: ExerciseRole = 'accessory';
    if (primaryMatch && ex.is_compound) role = 'primary';
    else if (primaryMatch || (secondaryMatch && ex.is_compound)) role = 'secondary';

    const restTier = determineRestTier(ex, role);

    return { exercise: ex, score, role, restTier };
  });

  scored.sort((a, b) => b.score - a.score);

  if (isStylePositionOrdered(style)) {
    const posOrdered = applyPositionOrdering(scored, style);
    const archOrdered = applyArchitecturePhaseSelection(posOrdered, style, split, fitnessLevel, targetMuscles, rng);
    console.log('[EngineV2] Position-ordered & architecture-selected:', archOrdered.length, 'exercises');
    return archOrdered;
  }

  if (config?.compounds_first) {
    const compounds = scored.filter(s => s.exercise.is_compound);
    const nonCompounds = scored.filter(s => !s.exercise.is_compound);
    const reordered = [...compounds, ...nonCompounds];

    const patternOrdered: ScoredExercise[] = [];
    const used = new Set<string>();
    if (config.pattern_priority) {
      for (const pattern of config.pattern_priority) {
        const match = reordered.find(s => s.exercise.movement_pattern === pattern && !used.has(s.exercise.id));
        if (match) {
          patternOrdered.push(match);
          used.add(match.exercise.id);
          usedPatterns.add(match.exercise.movement_pattern);
          if (match.exercise.variation_family) usedFamilies.add(match.exercise.variation_family);
        }
      }
    }
    for (const s of reordered) {
      if (!used.has(s.exercise.id)) {
        patternOrdered.push(s);
        used.add(s.exercise.id);
      }
    }
    const archOrdered = applyArchitecturePhaseSelection(patternOrdered, style, split, fitnessLevel, targetMuscles, rng);
    console.log('[EngineV2] Scored & architecture-ordered:', archOrdered.length, 'exercises, top 5:', archOrdered.slice(0, 5).map(s => `${s.exercise.name}(${s.score.toFixed(1)})`).join(', '));
    return archOrdered;
  }

  const archOrdered = applyArchitecturePhaseSelection(scored, style, split, fitnessLevel, targetMuscles, rng);
  console.log('[EngineV2] Scored:', archOrdered.length, 'exercises');
  return archOrdered;
}

function stage5LoadAndReps(
  scoredExercises: ScoredExercise[],
  style: string,
  sex: string,
  fitnessLevel: string,
  sliderMultiplier: number,
  trainingLog: TrainingLogEntry[],
  volumeModifier: number,
  intensityModifier: number,
  rng: () => number,
): SelectedExercise[] {
  console.log('[EngineV2] Stage 5: Load & Rep Assignment');

  const config = STYLE_ENGINE_CONFIGS[style];

  return scoredExercises.map(scored => {
    const ex = scored.exercise;

    let minReps = ex.rep_range_floor ?? 8;
    let maxReps = ex.rep_range_ceiling ?? 12;
    if (config?.rep_range_override) {
      minReps = Math.max(minReps, config.rep_range_override.min);
      maxReps = Math.min(maxReps, config.rep_range_override.max);
      if (minReps > maxReps) maxReps = minReps;
    }
    if (style === 'strength' && ex.is_compound) {
      if (scored.role === 'primary') {
        minReps = Math.max(ex.rep_range_floor ?? 8, 3);
        maxReps = Math.min(ex.rep_range_ceiling ?? 12, 6);
        if (minReps > maxReps) maxReps = minReps;
      } else if (scored.role === 'secondary') {
        minReps = Math.max(ex.rep_range_floor ?? 8, 5);
        maxReps = Math.min(ex.rep_range_ceiling ?? 12, 8);
        if (minReps > maxReps) maxReps = minReps;
      }
    }
    const reps = minReps + Math.floor(rng() * (maxReps - minReps + 1));

    let minSets = 2;
    let maxSets = 4;
    if (config?.set_range_override) {
      minSets = config.set_range_override.min;
      maxSets = config.set_range_override.max;
    }
    let sets = minSets + Math.floor(rng() * (maxSets - minSets + 1));
    sets = Math.round(sets * volumeModifier);
    sets = clamp(sets, 1, 6);

    const diffKey = getDifficultyKey(sex, fitnessLevel);
    const loadTable = ex.default_load_table as DefaultLoadTable;
    const loadEntry: LoadEntry = (loadTable as unknown as Record<string, LoadEntry>)[diffKey] ?? loadTable.male_intermediate;

    let loadLbs: number;
    const lastLog = trainingLog.find(l => l.exerciseId === ex.id);
    if (lastLog && lastLog.weightUsed > 0) {
      const isUpper = ex.primary_muscles.some(m => UPPER_BODY_MUSCLES.has(m as never));
      const increment = isUpper ? PROGRESSIVE_OVERLOAD.upper_body_increment_lbs : PROGRESSIVE_OVERLOAD.lower_body_increment_lbs;
      if (lastLog.repsCompleted >= reps + PROGRESSIVE_OVERLOAD.reps_exceed_threshold) {
        loadLbs = lastLog.weightUsed + increment;
        console.log('[EngineV2] Progressive overload for', ex.name, ':', lastLog.weightUsed, '->', loadLbs);
      } else {
        loadLbs = lastLog.weightUsed;
      }
    } else {
      loadLbs = loadEntry.absolute_fallback_lbs;
    }

    loadLbs = Math.round(loadLbs * intensityModifier);
    if (ex.weight_increment > 0) loadLbs = Math.round(loadLbs / ex.weight_increment) * ex.weight_increment;
    if (loadLbs < 0) loadLbs = 0;

    const restSeconds = calculateStyleAwareRest(style, scored.restTier, sliderMultiplier);
    const styleTransition = TRANSITION_BUFFER_BY_STYLE[style] ?? TRANSITION_BUFFER_SECONDS;
    const setDuration = calculateSetDuration(ex, reps);
    const totalTime = calculateExerciseTime(setDuration, restSeconds, sets, ex.setup_time_seconds, styleTransition);

    return {
      exercise: ex,
      role: scored.role,
      restTier: scored.restTier,
      sets,
      reps,
      loadLbs,
      restSeconds,
      setDurationSeconds: setDuration,
      exerciseTotalSeconds: totalTime,
    };
  });
}

function stage6TimeValidation(
  selected: SelectedExercise[],
  targetMinutes: number,
  style: string,
): SelectedExercise[] {
  console.log('[EngineV2] Stage 6: Time Validation');

  const distractionFactor = DISTRACTION_FACTOR_BY_STYLE[style] ?? DISTRACTION_BUFFER_FACTOR;
  const usableTarget = targetMinutes * 60 * distractionFactor;
  const isStrengthStyle = style === 'strength' || style === 'bodybuilding';
  const minExercises = isStrengthStyle ? 6 : (MIN_EXERCISES_PER_STYLE[style] ?? 4);
  const maxExercises = MAX_EXERCISES_PER_STYLE[style] ?? 10;

  let current = selected.slice(0, maxExercises);

  const getTotalTime = (exs: SelectedExercise[]): number =>
    exs.reduce((sum, e) => sum + e.exerciseTotalSeconds, 0);

  let iterations = 0;
  const maxIterations = 30;

  // PHASE 1: Ensure we always start with at least minExercises
  while (current.length < minExercises && current.length < selected.length) {
    current.push(selected[current.length]);
  }

  let totalTime = getTotalTime(current);

  // PHASE 2: For strength — apply superset time savings FIRST before reducing sets or removing
  if (isStrengthStyle && totalTime > usableTarget) {
    const pairedFirstIndices = new Set<number>();
    const usedSupersetIndices = new Set<number>();
    for (let i = 0; i < current.length - 1; i++) {
      if (usedSupersetIndices.has(i)) continue;
      const a = current[i];
      const b = current[i + 1];
      if (usedSupersetIndices.has(i + 1)) continue;
      if (a.role === 'primary' && b.role === 'primary') continue;
      const aHeavy = a.exercise.is_compound && (a.exercise.spinal_load as string) === 'heavy';
      const bHeavy = b.exercise.is_compound && (b.exercise.spinal_load as string) === 'heavy';
      if (aHeavy && bHeavy) continue;
      const aMuscles = new Set(a.exercise.primary_muscles as string[]);
      const bMuscles = new Set(b.exercise.primary_muscles as string[]);
      const differentMuscle = ![...aMuscles].some(m => bMuscles.has(m));
      const oneIsIso = !a.exercise.is_compound || !b.exercise.is_compound;
      if (differentMuscle || oneIsIso) {
        pairedFirstIndices.add(i);
        usedSupersetIndices.add(i);
        usedSupersetIndices.add(i + 1);
      }
    }
    if (pairedFirstIndices.size > 0) {
      const withSupersets = current.map((ex, i) => {
        if (pairedFirstIndices.has(i)) {
          const newTime = ex.setDurationSeconds * ex.sets + ex.exercise.setup_time_seconds + 30;
          console.log('[EngineV2] Superset time-save:', ex.exercise.name, Math.round(ex.exerciseTotalSeconds), 's ->', Math.round(newTime), 's');
          return { ...ex, restSeconds: 0, exerciseTotalSeconds: newTime };
        }
        return ex;
      });
      const timeWithSupersets = getTotalTime(withSupersets);
      console.log('[EngineV2] Time with supersets:', Math.round(timeWithSupersets), 's / target:', Math.round(usableTarget), 's');
      if (timeWithSupersets <= usableTarget * 1.1) {
        current = withSupersets;
        totalTime = timeWithSupersets;
        console.log('[EngineV2] Superset strategy applied, keeping all', current.length, 'exercises');
      }
    }
  }

  // PHASE 3: Reduce sets before removing exercises
  while (totalTime > usableTarget * 1.05 && iterations < maxIterations) {
    let reduced = false;
    for (let i = current.length - 1; i >= 0; i--) {
      if (current[i].sets > 2) {
        current[i] = { ...current[i], sets: current[i].sets - 1 };
        current[i] = {
          ...current[i],
          exerciseTotalSeconds: calculateExerciseTime(
            current[i].setDurationSeconds, current[i].restSeconds, current[i].sets, current[i].exercise.setup_time_seconds
          ),
        };
        reduced = true;
        break;
      }
    }
    if (!reduced) break;
    totalTime = getTotalTime(current);
    iterations++;
  }

  // PHASE 4: Only remove exercises above minimum
  while (totalTime > usableTarget && current.length > minExercises && iterations < maxIterations) {
    const removed = current[current.length - 1];
    console.log('[EngineV2] Over budget (', Math.round(totalTime), 's >', Math.round(usableTarget), 's). Removing:', removed.exercise.name);
    current = current.slice(0, -1);
    totalTime = getTotalTime(current);
    iterations++;
  }

  // PHASE 5: Add more exercises if under budget
  if (totalTime < usableTarget * 0.85 && current.length < selected.length && current.length < maxExercises) {
    let addIdx = current.length;
    while (totalTime < usableTarget * 0.9 && addIdx < selected.length && addIdx < maxExercises && iterations < maxIterations) {
      const toAdd = selected[addIdx];
      console.log('[EngineV2] Under budget. Adding:', toAdd.exercise.name);
      current.push(toAdd);
      totalTime = getTotalTime(current);
      addIdx++;
      iterations++;
    }
  }

  // PHASE 6: Boost sets if still under budget
  if (totalTime < usableTarget * 0.8) {
    for (let i = 0; i < current.length && totalTime < usableTarget * 0.9; i++) {
      if (current[i].sets < 5) {
        current[i] = { ...current[i], sets: current[i].sets + 1 };
        current[i] = {
          ...current[i],
          exerciseTotalSeconds: calculateExerciseTime(
            current[i].setDurationSeconds, current[i].restSeconds, current[i].sets, current[i].exercise.setup_time_seconds
          ),
        };
        totalTime = getTotalTime(current);
      }
    }
  }

  console.log('[EngineV2] Time validation result:', current.length, 'exercises,', Math.round(totalTime), 's /', Math.round(usableTarget), 's target (', Math.round(totalTime / usableTarget * 100), '%)');
  return current;
}

function getMobilityWarmupDescription(exerciseName: string): string {
  const lower = exerciseName.toLowerCase();
  const isHeldStretch =
    lower.includes('stretch') ||
    lower.includes('pigeon') ||
    lower.includes('downward') ||
    lower.includes('90/90') ||
    lower.includes("child") ||
    lower.includes('couch') ||
    lower.includes('doorway') ||
    lower.includes('fold');
  if (isHeldStretch) return 'Hold 30-45 seconds each side, breathe into the stretch';
  return '10-12 reps each side, slow and controlled';
}

function buildMobilityFirstWarmup(
  workedMuscles: Set<string>,
  targetMuscles: string[],
  count: number,
  rng: () => number,
): EngineWarmupItem[] {
  const allMuscles = new Set([...Array.from(workedMuscles), ...targetMuscles]);
  const db = getZealExerciseDatabase();

  const mobilityTargeted = db.filter(ex =>
    ex.is_warmup_eligible &&
    ex.movement_pattern === 'mobility' &&
    ex.warmup_for_muscles.some(m => allMuscles.has(m))
  );

  const mobilityGeneral = db.filter(ex =>
    ex.is_warmup_eligible &&
    ex.movement_pattern === 'mobility' &&
    !mobilityTargeted.some(t => t.id === ex.id)
  );

  const otherTargeted = db.filter(ex =>
    ex.is_warmup_eligible &&
    ex.movement_pattern !== 'mobility' &&
    ex.warmup_for_muscles.some(m => allMuscles.has(m))
  );

  const mobilitySlots = Math.ceil(count * 0.8);
  const warmup: EngineWarmupItem[] = [];

  for (const ex of shuffleArray(mobilityTargeted, rng)) {
    if (warmup.length >= mobilitySlots) break;
    warmup.push({
      name: ex.name,
      description: getMobilityWarmupDescription(ex.name),
      swappable: true,
      targetMuscles: ex.warmup_for_muscles,
    });
  }

  if (warmup.length < mobilitySlots) {
    for (const ex of shuffleArray(mobilityGeneral, rng)) {
      if (warmup.length >= mobilitySlots) break;
      if (!warmup.some(w => w.name === ex.name)) {
        warmup.push({
          name: ex.name,
          description: getMobilityWarmupDescription(ex.name),
          swappable: true,
          targetMuscles: ex.warmup_for_muscles,
        });
      }
    }
  }

  for (const ex of shuffleArray(otherTargeted, rng)) {
    if (warmup.length >= count) break;
    if (!warmup.some(w => w.name === ex.name)) {
      warmup.push({
        name: ex.name,
        description: `${ex.default_tempo_seconds_per_rep * 10} seconds, controlled pace`,
        swappable: true,
        targetMuscles: ex.warmup_for_muscles,
      });
    }
  }

  if (warmup.length < count) {
    for (const w of shuffleArray(WARMUP_EXERCISES, rng)) {
      if (warmup.length >= count) break;
      if (!warmup.some(existing => existing.name === w.name)) {
        warmup.push({
          name: w.name,
          description: w.description,
          swappable: w.swappable,
          targetMuscles: [],
        });
      }
    }
  }

  const mobilityCount = warmup.filter(w =>
    db.find(ex => ex.name === w.name)?.movement_pattern === 'mobility'
  ).length;
  console.log(`[WarmupBuilder] ${warmup.length} exercises — ${mobilityCount} mobility/stretch (${Math.round(mobilityCount / warmup.length * 100)}%), targeted muscles: ${Array.from(allMuscles).join(', ')}`);
  return warmup;
}

function stage7WarmupCooldown(
  targetMuscles: string[],
  warmUp: boolean,
  coolDown: boolean,
  recoveryEnabled: boolean,
  rng: () => number,
  exercises: EngineWorkoutExercise[],
): {
  warmup: EngineWarmupItem[];
  cooldown: EngineCooldownItem[];
  recovery: { name: string; description: string; benefit: string }[];
} {
  console.log('[EngineV2] Stage 7: Warmup/Cooldown Generation');

  const warmup: EngineWarmupItem[] = [];
  if (warmUp) {
    const workedMuscles = new Set(exercises.flatMap(e => e.exerciseRef.primary_muscles));
    const count = WARMUP_EXERCISE_COUNT.min + Math.floor(rng() * (WARMUP_EXERCISE_COUNT.max - WARMUP_EXERCISE_COUNT.min + 1));
    const built = buildMobilityFirstWarmup(workedMuscles, targetMuscles, count, rng);
    warmup.push(...built);
    console.log('[EngineV2] Warmup:', warmup.length, 'exercises (80%+ mobility/stretching targeted)');
  }

  const cooldown: EngineCooldownItem[] = [];
  if (coolDown) {
    const workedMuscles = new Set(exercises.flatMap(e => e.exerciseRef.primary_muscles));

    const cooldownEligible = getZealExerciseDatabase().filter(ex =>
      ex.is_cooldown_eligible &&
      ex.cooldown_for_muscles.some(m => workedMuscles.has(m) || targetMuscles.includes(m))
    );

    const count = COOLDOWN_EXERCISE_COUNT.min + Math.floor(rng() * (COOLDOWN_EXERCISE_COUNT.max - COOLDOWN_EXERCISE_COUNT.min + 1));

    if (cooldownEligible.length >= count) {
      const shuffled = shuffleArray(cooldownEligible, rng).slice(0, count);
      for (const ex of shuffled) {
        cooldown.push({
          name: ex.name,
          description: `Hold 30-45 seconds each side`,
          targetMuscles: ex.cooldown_for_muscles,
        });
      }
    }

    if (cooldown.length < COOLDOWN_EXERCISE_COUNT.min) {
      const fallback = shuffleArray(COOLDOWN_EXERCISES, rng);
      for (const c of fallback) {
        if (cooldown.length >= count) break;
        if (!cooldown.some(existing => existing.name === c.name)) {
          cooldown.push({
            name: c.name,
            description: c.description,
            targetMuscles: [],
          });
        }
      }
    }
    console.log('[EngineV2] Cooldown:', cooldown.length, 'exercises');
  }

  const recovery: { name: string; description: string; benefit: string }[] = [];
  if (recoveryEnabled) {
    const count = 2 + Math.floor(rng() * 2);
    const shuffled = shuffleArray(RECOVERY_ITEMS, rng).slice(0, count);
    recovery.push(...shuffled);
  }

  return { warmup, cooldown, recovery };
}

function stage8FeedbackAdjustment(
  exercises: SelectedExercise[],
  feedbackData: FeedbackData | undefined,
  planApplied: boolean,
): { adjusted: SelectedExercise[]; applied: boolean } {
  console.log('[EngineV2] Stage 8: Feedback Adjustment Layer');

  if (!feedbackData || feedbackData.recentSessions.length === 0) {
    console.log('[EngineV2] No feedback data available, skipping adjustment');
    return { adjusted: exercises, applied: false };
  }

  const recent = feedbackData.recentSessions.slice(-FEEDBACK_ADJUSTMENT.trailing_window_sessions);
  const avgRpe = recent.reduce((sum, s) => sum + s.rpe, 0) / recent.length;

  console.log('[EngineV2] Trailing RPE average:', avgRpe.toFixed(1), 'from', recent.length, 'sessions');

  let volumeFactor = 1.0;
  let intensityFactor = 1.0;

  if (avgRpe <= FEEDBACK_ADJUSTMENT.rpe_too_easy_threshold) {
    volumeFactor = FEEDBACK_ADJUSTMENT.volume_increase_factor;
    intensityFactor = FEEDBACK_ADJUSTMENT.intensity_increase_factor;
    console.log('[EngineV2] RPE too easy, increasing volume by', (volumeFactor - 1) * 100, '% and intensity by', (intensityFactor - 1) * 100, '%');
  } else if (avgRpe >= FEEDBACK_ADJUSTMENT.rpe_too_hard_threshold) {
    volumeFactor = FEEDBACK_ADJUSTMENT.volume_reduction_factor;
    intensityFactor = FEEDBACK_ADJUSTMENT.intensity_reduction_factor;
    console.log('[EngineV2] RPE too hard, reducing volume by', (1 - volumeFactor) * 100, '% and intensity by', (1 - intensityFactor) * 100, '%');
  } else {
    console.log('[EngineV2] RPE in target range, no adjustment needed');
    return { adjusted: exercises, applied: false };
  }

  if (planApplied) {
    volumeFactor = clamp(volumeFactor, 0.85, 1.15);
    intensityFactor = clamp(intensityFactor, 0.90, 1.10);
    console.log('[EngineV2] Plan active — clamping feedback adjustments');
  }

  const adjusted = exercises.map(ex => {
    const newSets = clamp(Math.round(ex.sets * volumeFactor), 1, 6);
    const newLoad = Math.round(ex.loadLbs * intensityFactor / ex.exercise.weight_increment) * ex.exercise.weight_increment;
    const newTime = calculateExerciseTime(ex.setDurationSeconds, ex.restSeconds, newSets, ex.exercise.setup_time_seconds);

    return {
      ...ex,
      sets: newSets,
      loadLbs: Math.max(0, newLoad),
      exerciseTotalSeconds: newTime,
    };
  });

  return { adjusted, applied: true };
}

function applyStyleAwareSupersets(
  exercises: EngineWorkoutExercise[],
  style: string,
  config: StyleEngineConfig,
  rng: () => number,
): void {
  const styleRules = getStyleRules(style);
  const supersetRules = styleRules.superset_rules;

  if (!supersetRules.enabled) {
    console.log('[EngineV2] Supersets disabled for style:', style);
    return;
  }

  const targetCount = supersetRules.min_supersets + Math.floor(rng() * (supersetRules.max_supersets - supersetRules.min_supersets + 1));
  if (targetCount <= 0 || exercises.length < 2) return;

  let created = 0;
  let groupCounter = 0;

  const isCoreExercise = (ex: EngineWorkoutExercise): boolean =>
    ex.exerciseRef.primary_muscles.some(m => m === 'core' || m === 'obliques' || m === 'transverse_abdominis');

  const tryPair = (startIdx: number, endIdx: number): void => {
    for (let i = startIdx; i <= endIdx - 1 && created < targetCount; i++) {
      const a = exercises[i];
      const b = exercises[i + 1];
      if (a.groupType || b.groupType) continue;

      if (supersetRules.never_superset_heavy_compounds) {
        if (a.exerciseRef.is_compound && a.exerciseRef.spinal_load === 'heavy' &&
            b.exerciseRef.is_compound && b.exerciseRef.spinal_load === 'heavy') continue;
      }

      if (supersetRules.never_superset_primaries) {
        if (a.role === 'primary' && b.role === 'primary') continue;
      }

      if (isCoreExercise(a) !== isCoreExercise(b)) continue;

      const aMuscles = new Set(a.exerciseRef.primary_muscles);
      const bMuscles = new Set(b.exerciseRef.primary_muscles);
      const differentMuscle = ![...aMuscles].some(m => bMuscles.has(m));
      const oneIsIso = !a.exerciseRef.is_compound || !b.exerciseRef.is_compound;
      const bothIso = !a.exerciseRef.is_compound && !b.exerciseRef.is_compound;

      let canSuperset = false;

      if (supersetRules.default_for_isolation && bothIso) {
        canSuperset = true;
      } else if (differentMuscle && supersetRules.allowed_pairing_types.includes('antagonist')) {
        canSuperset = true;
      } else if (!differentMuscle && oneIsIso && supersetRules.allowed_pairing_types.includes('compound_set')) {
        canSuperset = true;
      } else if (!differentMuscle && oneIsIso && supersetRules.allowed_pairing_types.includes('pre_exhaust')) {
        canSuperset = true;
      } else if (!differentMuscle && oneIsIso && supersetRules.allowed_pairing_types.includes('post_exhaust')) {
        canSuperset = true;
      }

      if (canSuperset) {
        groupCounter++;
        const gid = `superset_${groupCounter}`;
        a.groupType = 'superset';
        a.groupId = gid;
        b.groupType = 'superset';
        b.groupId = gid;
        created++;
        i++;
      }
    }
  };

  tryPair(2, exercises.length - 1);

  if (created < supersetRules.min_supersets && exercises.length >= 3) {
    console.log('[EngineV2] Min supersets not met (' + created + '/' + supersetRules.min_supersets + '), trying fallback from index 1');
    tryPair(1, exercises.length - 1);
  }

  if (created < supersetRules.min_supersets && exercises.length >= 2) {
    console.log('[EngineV2] Still not met, forcing last eligible pair');
    for (let i = exercises.length - 2; i >= 0; i--) {
      const a = exercises[i];
      const b = exercises[i + 1];
      if (a.groupType || b.groupType) continue;
      const isPrimaryPair = supersetRules.never_superset_primaries && a.role === 'primary' && b.role === 'primary';
      const isHeavyPair = supersetRules.never_superset_heavy_compounds &&
        a.exerciseRef.is_compound && a.exerciseRef.spinal_load === 'heavy' &&
        b.exerciseRef.is_compound && b.exerciseRef.spinal_load === 'heavy';
      const isMixedCore = isCoreExercise(a) !== isCoreExercise(b);
      if (!isPrimaryPair && !isHeavyPair && !isMixedCore) {
        groupCounter++;
        const gid = `superset_${groupCounter}`;
        a.groupType = 'superset';
        a.groupId = gid;
        b.groupType = 'superset';
        b.groupId = gid;
        created++;
        break;
      }
    }
  }

  console.log('[EngineV2] Applied', created, 'style-aware supersets for', style, '(target:', targetCount, ', min:', supersetRules.min_supersets + ')');
}

function applyCircuitGrouping(exercises: EngineWorkoutExercise[]): void {
  if (exercises.length < 2) return;
  const gid = 'circuit_1';
  for (const ex of exercises) {
    ex.groupType = 'circuit';
    ex.groupId = gid;
  }
  console.log('[EngineV2] Grouped', exercises.length, 'exercises as circuit');
}

// Map the user-facing CrossFit split label to the internal WorkoutFormatId.
function cfSplitToFormatId(split: string): WorkoutFormatId | null {
  switch (split.toLowerCase().trim()) {
    case 'amrap':   return 'amrap';
    case 'emom':    return 'emom';
    case 'rft':     return 'rft';
    case 'chipper': return 'chipper';
    case 'ladder':  return 'ladder';
    default:        return null; // 'auto' or unrecognised → random selection
  }
}

function applyStyleAwareGrouping(
  exercises: EngineWorkoutExercise[],
  style: string,
  config: StyleEngineConfig,
  fitnessLevel: string,
  rng: () => number,
  availableEquipment: Record<string, number>,
  targetDuration?: number,
  requestedSplit?: string,
): { format: string | null; timeCap: number | null; rounds: number | null } {
  const styleRules = getStyleRules(style);
  const level = (fitnessLevel as FitnessLevel) || 'intermediate';

  if (style === 'crossfit') {
    const normalizedEquip = normalizeEquipmentIds(availableEquipment);
    const hasGymEquipment = Object.entries(normalizedEquip).some(([k, v]) => k !== 'bodyweight' && v > 0);

    const isBodyweightOnly = (e: EngineWorkoutExercise): boolean => {
      const req = e.exerciseRef.equipment_required ?? [];
      return req.length === 0 || (req.length === 1 && req[0] === 'bodyweight');
    };

    const isGoodCrossfitStrengthLift = (e: EngineWorkoutExercise): boolean => {
      if (!e.exerciseRef.is_compound) return false;
      if (e.exerciseRef.movement_pattern === 'cardio' || e.exerciseRef.movement_pattern === 'plyometric') return false;
      // Prefer loaded barbell/dumbbell/kettlebell lifts when equipment exists.
      if (hasGymEquipment && isBodyweightOnly(e)) return false;
      // Nudge toward "heavy" patterns over things like bodyweight lunges.
      if (hasGymEquipment && (e.exerciseRef.spinal_load === 'none' || e.exerciseRef.spinal_load === 'light')) return false;
      return ['squat', 'hinge', 'push', 'pull'].includes(e.exerciseRef.movement_pattern as unknown as string);
    };

    // Strength block: ALWAYS start CrossFit with 2-4 movements.
    // Prefer heavy compounds, but hard-fallback so a strength opener is never missing.
    const cfSessionDuration = targetDuration ?? 45;
    const targetStrengthCount = hasGymEquipment ? (cfSessionDuration >= 50 ? 4 : 3) : 2;
    const minStrengthCount = Math.min(2, exercises.length);

    const strengthCandidates = exercises.filter(isGoodCrossfitStrengthLift);
    const fallbackCompoundCandidates = exercises.filter(e =>
      e.exerciseRef.is_compound &&
      e.exerciseRef.movement_pattern !== 'cardio' &&
      e.exerciseRef.movement_pattern !== 'plyometric'
    );
    const fallbackAnyStrengthish = exercises.filter(e =>
      e.exerciseRef.movement_pattern !== 'cardio'
    );

    const strengthBlock: EngineWorkoutExercise[] = [];
    const usedStrengthIds = new Set<string>();
    const tryAddStrength = (pool: EngineWorkoutExercise[], maxToTake: number) => {
      for (const ex of pool) {
        if (strengthBlock.length >= maxToTake) break;
        if (usedStrengthIds.has(ex.exerciseRef.id)) continue;
        strengthBlock.push(ex);
        usedStrengthIds.add(ex.exerciseRef.id);
      }
    };

    tryAddStrength(strengthCandidates, targetStrengthCount);
    if (strengthBlock.length < minStrengthCount) {
      tryAddStrength(fallbackCompoundCandidates, targetStrengthCount);
    }
    if (strengthBlock.length < minStrengthCount) {
      tryAddStrength(fallbackAnyStrengthish, targetStrengthCount);
    }

    const strengthIds = new Set(strengthBlock.map(s => s.exerciseRef.id));

    // Reorder so the session always opens with the strength block.
    if (strengthBlock.length > 0) {
      const ordered = [
        ...strengthBlock,
        ...exercises.filter(e => !strengthIds.has(e.exerciseRef.id)),
      ];
      exercises.splice(0, exercises.length, ...ordered);
    }

    // Metcon pool is everything not in strength block.
    const metconCandidates = exercises.filter(e => !strengthIds.has(e.exerciseRef.id));
    // If we're short (tiny sessions), just take what we have.
    let metconPool = metconCandidates;

    // Honour the user's explicit format choice; fall back to random when 'Auto'.
    const pinnedFormat = requestedSplit ? cfSplitToFormatId(requestedSplit) : null;
    const formatId: WorkoutFormatId = pinnedFormat ?? selectMetconFormat(level, rng);
    const formatName = formatId === 'amrap' ? 'AMRAP'
      : formatId === 'emom' ? 'EMOM'
      : formatId === 'rft' ? 'For Time'
      : formatId === 'chipper' ? 'Chipper'
      : formatId === 'ladder' ? 'Ladder'
      : 'AMRAP';

    // Derive the metcon time budget from the session duration using CrossFit's 55% fraction
    const METCON_FRACTION = 0.55;
    const TRANSITION_BUFFER_MIN = 2;
    const sessionDuration = targetDuration ?? 45;
    const metconBudgetMin = Math.max(8, Math.round(sessionDuration * METCON_FRACTION) - TRANSITION_BUFFER_MIN);

    let timeCap: number | null = null;
    let rounds: number | null = null;

    if (formatId === 'amrap') {
      // Keep AMRAP concise: too many 1-set stations reads noisy and kills pacing.
      const maxAmrapExercises = sessionDuration >= 55 ? 6 : 5;
      metconPool = metconCandidates.slice(0, Math.max(3, Math.min(maxAmrapExercises, metconCandidates.length)));
      const params = getAMRAPParams(metconBudgetMin, level);
      timeCap = params.time_cap_minutes;
      // AMRAP: single timed block — sets = 1, reps are moderate (cycle through repeatedly)
      for (const ex of metconPool) {
        const amrapMin = level === 'beginner' ? 8 : level === 'intermediate' ? 10 : 12;
        const amrapMax = level === 'beginner' ? 13 : level === 'intermediate' ? 15 : 18;
        ex.reps = amrapMin + Math.floor(rng() * (amrapMax - amrapMin + 1));
        ex.sets = 1;
        ex.restSeconds = 0;
      }
    } else if (formatId === 'emom') {
      const emomParams = getEMOMParams(metconBudgetMin, level);
      const emomExerciseCount = Math.min(emomParams.exercises_per_rotation, metconCandidates.length);
      // EMOM duration must be a multiple of exercise count (each round = 1 min per exercise)
      const emomMinutes = emomParams.total_minutes;
      // Verify divisibility — getEMOMParams already ensures this, but clamp if exercise pool was smaller
      const adjustedMinutes = emomExerciseCount > 0
        ? Math.floor(emomMinutes / emomExerciseCount) * emomExerciseCount
        : emomMinutes;
      timeCap = adjustedMinutes;
      rounds = adjustedMinutes; // EMOM total minutes = number of 1-minute slots
      metconPool = metconCandidates.slice(0, emomExerciseCount);

      // EMOM: small rep counts completable within ~40 s to earn rest within the minute
      for (const ex of metconPool) {
        const req = ex.exerciseRef.equipment_required ?? [];
        const name = (ex.exerciseRef.name ?? '').toLowerCase();
        const id = (ex.exerciseRef.id ?? '').toLowerCase();
        const pattern = (ex.exerciseRef.movement_pattern as unknown as string) ?? '';
        const isRowingMachine =
          req.includes('rowing_machine' as never) ||
          (pattern === 'cardio' && (name.includes('rowing') || name.includes('rower') || name.includes('erg') || id.includes('rowing')));

        if (isRowingMachine) {
          // 200–500m is realistic per-minute work for most users.
          // We store as a small integer so CrossFit metadata normalization renders `${n*100}m`.
          ex.reps = 2 + Math.floor(rng() * 4); // 2..5 → 200..500m
        } else {
          const emomMin = level === 'beginner' ? 5 : level === 'intermediate' ? 8 : 10;
          const emomMax = level === 'beginner' ? 9 : level === 'intermediate' ? 12 : 15;
          ex.reps = emomMin + Math.floor(rng() * (emomMax - emomMin + 1));
        }
        ex.sets = 1;
        ex.restSeconds = 0;
      }
      console.log('[EngineV2] EMOM structure:', adjustedMinutes, 'min with', emomExerciseCount, 'exercise(s),', adjustedMinutes / emomExerciseCount, 'rounds');
    } else if (formatId === 'rft') {
      const maxRftExercises = sessionDuration >= 55 ? 5 : 4;
      metconPool = metconCandidates.slice(0, Math.max(3, Math.min(maxRftExercises, metconCandidates.length)));
      const params = getRFTParams(level, rng, metconBudgetMin);
      timeCap = params.time_cap_minutes;
      rounds = params.rounds;
      // RFT: moderate reps per round — total volume = reps × rounds
      for (const ex of metconPool) {
        const rftMin = level === 'beginner' ? 8 : level === 'intermediate' ? 10 : 12;
        const rftMax = level === 'beginner' ? 12 : level === 'intermediate' ? 15 : 21;
        ex.reps = rftMin + Math.floor(rng() * (rftMax - rftMin + 1));
        ex.sets = params.rounds;
        ex.restSeconds = 0;
      }
    } else if (formatId === 'chipper') {
      const maxChipperExercises = sessionDuration >= 60 ? 8 : 6;
      metconPool = metconCandidates.slice(0, Math.max(4, Math.min(maxChipperExercises, metconCandidates.length)));
      const chipParams = getChipperParams(level);
      timeCap = Math.max(chipParams.min_time_cap, Math.min(chipParams.max_time_cap, metconBudgetMin));
      // Chipper: bigger descending rep schemes feel more "real" than random 15–30.
      // Keep it simple and consistent so it reads like classic chipper programming.
      const count = metconPool.length;
      const baseScheme =
        level === 'beginner'
          ? [40, 30, 20, 10]
          : level === 'intermediate'
            ? [60, 50, 40, 30, 20, 10]
            : [80, 70, 60, 50, 40, 30, 20, 10];
      const scheme = baseScheme.slice(0, Math.max(1, Math.min(count, baseScheme.length)));

      // If more exercises than the base scheme, extend with 20s then finish with 10.
      while (scheme.length < count) scheme.splice(Math.max(0, scheme.length - 1), 0, 20);
      if (scheme.length > count) scheme.length = count;

      for (let i = 0; i < metconPool.length; i++) {
        const ex = metconPool[i];
        const target = scheme[i] ?? chipParams.max_reps;

        const req = ex.exerciseRef.equipment_required ?? [];
        const name = (ex.exerciseRef.name ?? '').toLowerCase();
        const id = (ex.exerciseRef.id ?? '').toLowerCase();
        const pattern = (ex.exerciseRef.movement_pattern as unknown as string) ?? '';

        const isRowingMachine =
          req.includes('rowing_machine' as never) ||
          (pattern === 'cardio' && (name.includes('rowing') || name.includes('rower') || name.includes('erg') || id.includes('rowing')));
        const isAssaultBike =
          req.includes('assault_bike' as never) ||
          (pattern === 'cardio' && (name.includes('assault bike') || id.includes('assault_bike')));
        const isSkiErg =
          req.includes('ski_erg' as never) ||
          (pattern === 'cardio' && (name.includes('ski') || id.includes('ski_erg')));
        const isRunLike =
          req.includes('treadmill' as never) ||
          (pattern === 'cardio' && (name.includes('run') || id.includes('treadmill') || id.includes('run')));

        // For machines, store a small integer so the CrossFit metadata normalizer renders sensible units.
        // - Row/Ski/Run: `${reps*100}m`
        // - Assault bike: `${reps*2} cal`
        if (isRowingMachine || isSkiErg || isRunLike) {
          // 300–1200m typical chipper chunk; clamp by level.
          const meters = clampInt(target * 20, 300, level === 'beginner' ? 800 : 1200);
          ex.reps = Math.round(meters / 100); // normalizer will display `${reps*100}m`
        } else if (isAssaultBike) {
          // 15–60 cal typical chipper chunk depending on level.
          const cals = clampInt(target, 15, level === 'beginner' ? 35 : level === 'intermediate' ? 50 : 70);
          ex.reps = Math.round(cals / 2); // normalizer will display `${reps*2} cal`
        } else {
          ex.reps = target;
        }

        ex.sets = 1;
        ex.restSeconds = 0;
      }
    } else if (formatId === 'ladder') {
      const maxLadderExercises = sessionDuration >= 55 ? 5 : 4;
      metconPool = metconCandidates.slice(0, Math.max(3, Math.min(maxLadderExercises, metconCandidates.length)));
      const ladderParams = getLadderParams(level, rng);
      // Ladders scale with session duration
      timeCap = Math.max(10, Math.min(35, metconBudgetMin));
      // Use metconRounds to encode the ladder increment so the UI can display "start X · +Y/rd".
      // (We don't track "target round" yet — this is strictly metadata clarity.)
      const ladderInc = level === 'beginner' ? 2 : level === 'intermediate' ? 2 : 3;
      rounds = ladderInc;
      // Set reps to the starting point; direction is encoded in the metconFormat display.
      for (const ex of metconPool) {
        const req = ex.exerciseRef.equipment_required ?? [];
        const name = (ex.exerciseRef.name ?? '').toLowerCase();
        const id = (ex.exerciseRef.id ?? '').toLowerCase();
        const pattern = (ex.exerciseRef.movement_pattern as unknown as string) ?? '';
        const isRowingMachine =
          req.includes('rowing_machine' as never) ||
          (pattern === 'cardio' && (name.includes('rowing') || name.includes('rower') || name.includes('erg') || id.includes('rowing')));

        if (isRowingMachine) {
          // For ladders, rowing reads best as calories: start 8–12 cal, +2/rd.
          const startCals = level === 'beginner' ? 8 : level === 'intermediate' ? 10 : 12;
          ex.reps = Math.round(startCals / 2); // normalizer will show `${reps*2} cal`
        } else {
          ex.reps = ladderParams.direction === 'ascending' ? ladderParams.start_reps : ladderParams.end_reps;
        }
        ex.sets = 1;
        ex.restSeconds = 0;
      }
    }

    for (const ex of metconPool) {
      if (!ex.groupType) {
        ex.groupType = 'circuit';
        ex.groupId = 'metcon_1';
      }
    }

    console.log('[EngineV2] CrossFit format selected:', formatName, 'metconBudget:', metconBudgetMin, 'min → timeCap:', timeCap, 'rounds:', rounds);
    return { format: formatName, timeCap, rounds };
  }

  if (isStyleCircuitBased(style)) {
    const selectedFormat = selectFormatForStyle(style, level, rng);
    console.log('[EngineV2] Circuit-based style', style, 'using format:', selectedFormat);

    if (selectedFormat === 'tabata') {
      const params = getTabataParams();
      applyCircuitGrouping(exercises);
      return { format: 'Tabata', timeCap: Math.ceil(exercises.length * params.total_time_seconds / 60), rounds: params.rounds };
    }

    applyCircuitGrouping(exercises);
    return { format: selectedFormat, timeCap: null, rounds: null };
  }

  if (styleRules.superset_rules.enabled) {
    applyStyleAwareSupersets(exercises, style, config, rng);
  }

  return { format: null, timeCap: null, rounds: null };
}

function buildHyroxSimulation(fullRace: boolean, params: EngineParams): EngineResult {
  console.log('[EngineV2] Hyrox', fullRace ? 'Full' : 'Half', 'Simulation — generating official race structure');
  const stationCount = fullRace ? 8 : 4;

  // Official Hyrox race order: 8 × (1 km run → station). Race ends on the final station — no trailing run.
  // Station seconds are per-modality realistic estimates for an intermediate competitor.
  const HYROX_RACE_STATIONS: Array<{
    name: string; work: string; sets: number; reps: number; notes: string; stationSeconds: number;
  }> = [
    { name: 'SkiErg',           work: '1000m',    sets: 1, reps: 1,   notes: '1000m — steady pace, engage core, pull through full range',        stationSeconds: 240 },
    { name: 'Sled Push',        work: '50m',       sets: 1, reps: 1,   notes: '50m @ race weight — low position, drive through legs',             stationSeconds: 120 },
    { name: 'Sled Pull',        work: '50m',       sets: 1, reps: 1,   notes: '50m — lean back, pull hand over hand, keep tension',               stationSeconds: 150 },
    { name: 'Burpee Broad Jumps', work: '80m',     sets: 1, reps: 1,   notes: '80m — consistent rhythm, jump as far forward as possible each rep', stationSeconds: 240 },
    { name: 'Rowing (Erg)',     work: '1000m',     sets: 1, reps: 1,   notes: '1000m — damper 4-5, drive with legs first, hold 2:00/500m pace',   stationSeconds: 270 },
    { name: "Farmer's Carry",   work: '200m',      sets: 1, reps: 1,   notes: '200m @ race weight — tall posture, controlled breathing',           stationSeconds: 150 },
    { name: 'Sandbag Lunges',   work: '100m',      sets: 1, reps: 1,   notes: '100m — sandbag on shoulder, full step, knee to floor',             stationSeconds: 270 },
    { name: 'Wall Balls',       work: '100 reps',  sets: 1, reps: 100, notes: '100 reps (14/20 lb) — full squat depth, hit target on every rep',  stationSeconds: 330 },
  ];

  const daySeedRng = seededRandom(getDaySeed() + params.targetDuration * 13 + (params.seedOffset ?? 0) * 97);
  const isBackHalf = !fullRace && daySeedRng() >= 0.5;
  const startStationIndex = fullRace ? 0 : (isBackHalf ? 4 : 0);
  const stations = HYROX_RACE_STATIONS.slice(startStationIndex, startStationIndex + stationCount);
  console.log('[EngineV2] Hyrox Half Simulation selection:', fullRace ? 'full' : (isBackHalf ? 'back half' : 'front half'));
  const workoutExercises: EngineWorkoutExercise[] = [];

  const makeExerciseRef = (id: string, name: string, variationFamily: string): ZealExercise => ({
    id, name,
    aliases: [],
    movement_pattern: 'cardio' as never,
    difficulty_tier: 'intermediate' as never,
    eligible_styles: ['hyrox' as never],
    primary_muscles: ['quads' as never, 'hamstrings' as never],
    secondary_muscles: ['glutes' as never, 'core' as never],
    joints_loaded: ['knee' as never, 'hip' as never],
    equipment_required: ['bodyweight' as never],
    equipment_optional: [],
    is_unilateral: false,
    is_compound: true,
    default_tempo_seconds_per_rep: 360,
    setup_time_seconds: 15,
    contraindication_tags: [],
    rom_requirement: 'full' as never,
    spinal_load: 'none' as never,
    position: 'standing' as never,
    weight_increment: 0,
    rep_range_floor: 1,
    rep_range_ceiling: 1,
    default_load_table: {} as never,
    is_warmup_eligible: false,
    is_cooldown_eligible: false,
    warmup_for_muscles: [],
    cooldown_for_muscles: [],
    substitutes: [],
    variation_family: variationFamily,
  });

  // Race format: Run → Station for each of the stationCount pairs. No trailing run after the last station.
  for (let i = 0; i < stations.length; i++) {
    const raceLegNumber = startStationIndex + i + 1;
    // 1 km run leg (360s ≈ 6 min/km, realistic for recreational competitor)
    workoutExercises.push({
      exerciseRef: makeExerciseRef(`hyrox_run_${raceLegNumber}`, `Run — Leg ${raceLegNumber}`, 'hyrox_run'),
      role: 'primary', sets: 1, reps: 1, loadLbs: 0, restSeconds: 0,
      setDurationSeconds: 360, exerciseTotalSeconds: 360, groupType: null, groupId: null,
    });
    // Functional fitness station
    const station = stations[i];
    workoutExercises.push({
      exerciseRef: makeExerciseRef(
        `hyrox_station_${raceLegNumber}`,
        `${station.name} — ${station.work}`,
        'hyrox_station',
      ),
      role: 'primary', sets: station.sets, reps: station.reps, loadLbs: 0, restSeconds: 0,
      setDurationSeconds: station.stationSeconds,
      exerciseTotalSeconds: station.stationSeconds,
      groupType: null, groupId: null,
    });
  }

  const totalSeconds = workoutExercises.reduce((s, e) => s + e.exerciseTotalSeconds, 0);
  const simLabel = fullRace ? 'Full Simulation' : 'Half Simulation';
  return {
    exercises: workoutExercises,
    warmup: [],
    cooldown: [],
    recovery: [],
    estimatedWorkingSeconds: totalSeconds,
    estimatedTotalSeconds: totalSeconds,
    targetMuscles: [],
    engineStyle: 'hyrox',
    metconFormat: simLabel,
    metconTimeCap: null,
    metconRounds: null,
    feedbackApplied: false,
    planApplied: false,
    selectedFormat: simLabel,
    sessionArchitectureUsed: 'hyrox',
  };
}

export function runEngine(params: EngineParams): EngineResult {
  console.log('[EngineV2] === ENGINE START ===');

  // ═══════════════════════════════════════════════════════
  // HYROX SIMULATION OVERRIDE
  // ═══════════════════════════════════════════════════════
  if (params.style === 'hyrox' || params.style === 'Hyrox') {
    const splitLower = params.split.toLowerCase();
    if (splitLower === 'full simulation' || splitLower === 'half simulation') {
      return buildHyroxSimulation(splitLower === 'full simulation', params);
    }
  }

  const seedOff = params.seedOffset ?? 0;
  const perCallVariance = Math.floor(Math.random() * 99991);
  const rng = seededRandom(
    getDaySeed() + params.style.length * 31 + params.split.length * 17
    + params.specificMuscles.length * 7 + Math.round(params.restSlider * 1000)
    + params.targetDuration * 13 + (params.warmUp ? 1 : 0) + (params.coolDown ? 2 : 0)
    + (params.addCardio ? 4 : 0) + (params.recovery ? 8 : 0) + seedOff * 9973
    + perCallVariance
  );

  const s1 = stage1PlanCheck(params);

  const targetMuscles = stage2SplitResolution(s1.effectiveSplit, params.specificMuscles);

  const pool = stage3PoolFiltering(
    s1.effectiveStyle,
    targetMuscles,
    params.availableEquipment,
    params.specialLifeCase,
    params.specialLifeCaseDetail,
  );

  const prefs = params.exercisePreferences ?? {};
  const dislikedSet = new Set(
    Object.entries(prefs)
      .filter(([, v]) => v === 'disliked')
      .map(([id]) => id)
  );
  const hardFilteredPool = dislikedSet.size > 0
    ? pool.filter(ex => !dislikedSet.has(ex.id))
    : pool;
  if (dislikedSet.size > 0) {
    console.log('[EngineV2] Hard-blocked', pool.length - hardFilteredPool.length, 'disliked exercises from pool');
  }

  const rawScored = stage4Scoring(
    hardFilteredPool,
    targetMuscles,
    s1.effectiveStyle,
    s1.effectiveSplit,
    params.fitnessLevel,
    params.availableEquipment,
    prefs,
    params.trainingLog ?? [],
    rng,
  );

  const CORE_MUSCLES_SET = new Set(['core', 'obliques', 'transverse_abdominis']);
  const isCoreDay = s1.effectiveSplit.toLowerCase().includes('core');
  const isStrengthOrBB = s1.effectiveStyle === 'strength' || s1.effectiveStyle === 'bodybuilding';
  const splitLowerForCore = s1.effectiveSplit.toLowerCase().trim();
  const isNoCoreDay = [
    'push', 'push day', 'pull', 'pull day',
    'upper', 'upper body',
    'legs', 'leg day', 'lower', 'lower body',
  ].includes(splitLowerForCore);
  const isLegsOrLowerDay = ['legs', 'leg day', 'lower', 'lower body'].includes(splitLowerForCore);
  const maxCoreExercises = isCoreDay ? 99 : (isStrengthOrBB && isLegsOrLowerDay) ? 1 : isNoCoreDay ? 0 : 1;
  let scored = rawScored;
  if (isStrengthOrBB) {
    let coreCount = 0;
    scored = rawScored.filter(s => {
      const isCoreEx = s.exercise.primary_muscles.every(m => CORE_MUSCLES_SET.has(m as string));
      if (isCoreEx) {
        coreCount++;
        if (coreCount > maxCoreExercises) {
          console.log('[EngineV2] Core cap: removing', s.exercise.name, '(core count', coreCount, ', max:', maxCoreExercises, ')');
          return false;
        }
      }
      return true;
    });
    console.log('[EngineV2] Core cap applied:', rawScored.length - scored.length, 'exercises removed, maxCore:', maxCoreExercises);
  }

  const sliderMultiplier = resolveSliderMultiplier(params.restSlider);

  const withLoadReps = stage5LoadAndReps(
    scored,
    s1.effectiveStyle,
    params.sex,
    params.fitnessLevel,
    sliderMultiplier,
    params.trainingLog ?? [],
    s1.volumeModifier,
    s1.intensityModifier,
    rng,
  );

  const timeValidated = stage6TimeValidation(
    withLoadReps,
    s1.effectiveDuration,
    s1.effectiveStyle,
  );

  const { adjusted, applied: feedbackApplied } = stage8FeedbackAdjustment(
    timeValidated,
    params.feedbackData,
    s1.planApplied,
  );

  const workoutExercises: EngineWorkoutExercise[] = adjusted.map(sel => ({
    exerciseRef: sel.exercise,
    role: sel.role,
    sets: sel.sets,
    reps: sel.reps,
    loadLbs: sel.loadLbs,
    restSeconds: sel.restSeconds,
    setDurationSeconds: sel.setDurationSeconds,
    exerciseTotalSeconds: sel.exerciseTotalSeconds,
    groupType: null,
    groupId: null,
  }));

  const isCoreExercise = (ex: EngineWorkoutExercise): boolean =>
    ex.exerciseRef.primary_muscles.some(m => m === 'core' || m === 'obliques' || m === 'transverse_abdominis');

  if (isStrengthOrBB && isLegsOrLowerDay) {
    const coreExercises = workoutExercises.filter(isCoreExercise);
    const nonCoreExercises = workoutExercises.filter(e => !isCoreExercise(e));
    const keepCore = coreExercises.slice(0, 1);
    workoutExercises.length = 0;
    workoutExercises.push(...nonCoreExercises, ...keepCore);
    for (const ce of keepCore) {
      ce.groupType = null;
      ce.groupId = null;
    }
    console.log('[EngineV2] Core finisher: moved', keepCore.length, 'core exercise(s) to end as individual movement');
  }

  const styleConfig = STYLE_ENGINE_CONFIGS[s1.effectiveStyle];
  let selectedFormat: string | null = null;

  const groupingResult = applyStyleAwareGrouping(
    workoutExercises,
    s1.effectiveStyle,
    styleConfig ?? { allow_supersets: false, superset_min: 0, superset_max: 0, compounds_first: false, pattern_priority: [] },
    params.fitnessLevel,
    rng,
    params.availableEquipment,
    params.targetDuration,
    params.split,
  );

  const metconFormat = groupingResult.format;
  const metconTimeCap = groupingResult.timeCap;
  const metconRounds = groupingResult.rounds;
  selectedFormat = groupingResult.format;

  const { warmup, cooldown, recovery } = stage7WarmupCooldown(
    targetMuscles,
    params.warmUp,
    params.coolDown,
    params.recovery,
    rng,
    workoutExercises,
  );

  const estimatedWorkingSeconds = workoutExercises.reduce((sum, e) => sum + e.exerciseTotalSeconds, 0);
  const estimatedTotalSeconds = estimatedWorkingSeconds;

  const architecture = getArchitectureForStyle(s1.effectiveStyle, s1.effectiveSplit);

  console.log('[EngineV2] === ENGINE COMPLETE (Style System v1.1) ===');
  console.log('[EngineV2] Style:', s1.effectiveStyle, '| Format:', selectedFormat ?? 'straight_sets');
  console.log('[EngineV2] Architecture:', architecture.phases.length, 'phases');
  console.log('[EngineV2] Exercises:', workoutExercises.length);
  console.log('[EngineV2] Working time:', Math.round(estimatedWorkingSeconds / 60), 'min');
  console.log('[EngineV2] Warmup:', warmup.length, 'Cooldown:', cooldown.length, 'Recovery:', recovery.length);
  console.log('[EngineV2] Feedback applied:', feedbackApplied, 'Plan applied:', s1.planApplied);

  return {
    exercises: workoutExercises,
    warmup,
    cooldown,
    recovery,
    estimatedWorkingSeconds,
    estimatedTotalSeconds,
    targetMuscles,
    engineStyle: s1.effectiveStyle,
    metconFormat,
    metconTimeCap,
    metconRounds,
    feedbackApplied,
    planApplied: s1.planApplied,
    selectedFormat,
    sessionArchitectureUsed: s1.effectiveStyle,
  };
}

// ═══════════════════════════════════════════════════════
// CONVERSION HELPERS — EngineResult → Legacy Interfaces
// ═══════════════════════════════════════════════════════

const MUSCLE_DISPLAY_MAP: Record<string, string> = {
  chest: 'Chest', upper_chest: 'Chest', lower_chest: 'Chest',
  front_delt: 'Shoulders', side_delt: 'Shoulders', rear_delt: 'Rear Delts',
  lats: 'Lats', upper_back: 'Back', lower_back: 'Lower Back',
  traps: 'Traps', rhomboids: 'Back',
  biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms',
  quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes',
  hip_flexors: 'Hip Flexors', adductors: 'Adductors', abductors: 'Abductors',
  calves: 'Calves', core: 'Core', obliques: 'Obliques',
  transverse_abdominis: 'Core', pelvic_floor: 'Core', neck: 'Neck',
};

const EQUIPMENT_DISPLAY_MAP: Record<string, string> = {
  barbell: 'Barbell', dumbbell: 'Dumbbell', kettlebell: 'Kettlebell',
  ez_curl_bar: 'EZ Bar', cable_machine: 'Cable', bodyweight: 'Bodyweight',
  resistance_bands: 'Bands', pull_up_bar: 'Pull-Up Bar', dip_station: 'Dip Station',
  flat_bench: 'Bench', adjustable_bench: 'Bench', squat_rack: 'Rack',
  power_rack: 'Rack', smith_machine: 'Smith Machine',
  lat_pulldown_machine: 'Lat Pulldown', leg_press_machine: 'Leg Press',
  leg_curl_machine: 'Leg Curl', leg_extension_machine: 'Leg Extension',
  pec_deck_machine: 'Pec Deck', rowing_machine: 'Rower',
  assault_bike: 'Assault Bike', ski_erg: 'Ski Erg',
  treadmill: 'Treadmill', medicine_ball: 'Med Ball',
  foam_roller: 'Foam Roller', ab_wheel: 'Ab Wheel',
  plyo_box: 'Plyo Box', battle_ropes: 'Battle Ropes',
  sled: 'Sled', jump_rope: 'Jump Rope', trx_suspension: 'TRX',
  trap_bar: 'Trap Bar',
};

function deriveMovementTypeFromEngine(ex: EngineWorkoutExercise): MovementType {
  const z = ex.exerciseRef;
  if (z.movement_pattern === 'cardio' || z.movement_pattern === 'plyometric') return 'circuit';
  if (z.is_compound && z.spinal_load === 'heavy') return 'heavyCompound';
  if (z.is_compound) return 'moderateCompound';
  return 'isolation';
}

function formatRestTime(seconds: number): string {
  if (seconds === 0) return 'None';
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  return `${seconds}s`;
}

function formatLoadDisplay(loadLbs: number, exercise: EngineWorkoutExercise): string {
  if (!isFinite(loadLbs) || isNaN(loadLbs)) return '';
  const z = exercise.exerciseRef;
  const isBodyweight = z.equipment_required.length === 0 ||
    (z.equipment_required.length === 1 && z.equipment_required[0] === 'bodyweight');
  if (isBodyweight && loadLbs === 0) return 'BW';
  if (loadLbs === 0) return 'BW';
  return `${loadLbs} lb`;
}

function hashStringToInt(s: string): number {
  // Stable tiny hash for deterministic formatting choices (no crypto needs)
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function normalizeCrossfitRepsString(
  engineEx: EngineWorkoutExercise,
  fallbackReps: string,
  metconFormat?: string | null,
): string {
  const z = engineEx.exerciseRef;
  const name = (z.name ?? '').toLowerCase();
  const id = (z.id ?? '').toLowerCase();
  const equip = z.equipment_required ?? [];
  const pattern = (z.movement_pattern as unknown as string) ?? '';
  const base = Number.isFinite(engineEx.reps) ? engineEx.reps : 0;

  const isPlankLike =
    name.includes('plank') ||
    id.includes('plank') ||
    name.includes('hollow hold') ||
    id.includes('hollow') ||
    name.includes('superman hold') ||
    id.includes('superman') ||
    name.includes('l-sit') ||
    id.includes('l_sit');

  if (isPlankLike) {
    const seconds = clampInt(base * 5, 20, 120);
    return `${seconds}s`;
  }

  const isCarryLike =
    pattern === 'carry' ||
    name.includes('carry') ||
    id.includes('carry');

  if (isCarryLike) {
    const meters = clampInt(base * 10, 20, 400);
    return `${meters}m`;
  }

  // Rowing machine is the only "row" that should convert to meters/calories.
  // Barbell/dumbbell rows must remain reps.
  const usesFreeWeights =
    equip.includes('barbell' as never) ||
    equip.includes('dumbbell' as never) ||
    equip.includes('kettlebell' as never);

  const isRowingMachine =
    equip.includes('rowing_machine' as never) ||
    // Some data sources name this differently; keep a small fallback gate.
    (pattern === 'cardio' && (name.includes('rowing') || name.includes('rower') || name.includes('erg') || id.includes('rowing')));

  if (isRowingMachine && !usesFreeWeights) {
    // Ladders read better in calories (incrementing by +2/round is intuitive).
    if ((metconFormat ?? '').toLowerCase() === 'ladder') {
      const cals = clampInt(base * 2, 6, 50);
      return `${cals} cal`;
    }

    const useMeters = hashStringToInt(`${z.id}|${z.name}`) % 2 === 0;
    if (useMeters) {
      const meters = clampInt(base * 100, 200, 2000);
      return `${meters}m`;
    }
    const cals = clampInt(base * 2, 10, 60);
    return `${cals} cal`;
  }

  const isAssaultBike =
    equip.includes('assault_bike' as never) ||
    (pattern === 'cardio' && (name.includes('assault bike') || id.includes('assault_bike')));
  if (isAssaultBike) {
    const cals = clampInt(base * 2, 10, 90);
    return `${cals} cal`;
  }

  const isSkiErg =
    equip.includes('ski_erg' as never) ||
    (pattern === 'cardio' && (name.includes('ski') || id.includes('ski_erg')));
  if (isSkiErg) {
    const meters = clampInt(base * 100, 200, 2000);
    return `${meters}m`;
  }

  const isRunLike =
    equip.includes('treadmill' as never) ||
    (pattern === 'cardio' && (name.includes('run') || id.includes('treadmill') || id.includes('run')));
  if (isRunLike) {
    const meters = clampInt(base * 100, 200, 1600);
    return `${meters}m`;
  }

  return fallbackReps;
}

function findLegacyExercise(id: string): Exercise | undefined {
  return getExerciseDatabase().find(e => e.id === id);
}

function convertEngineExerciseToLegacy(
  engineEx: EngineWorkoutExercise,
  index: number,
  displayStyle: string,
  metconFormat?: string | null,
): WorkoutExercise {
  const z = engineEx.exerciseRef;
  const legacyEx = findLegacyExercise(z.id);
  const movementType = deriveMovementTypeFromEngine(engineEx);

  const primaryDisplay = z.primary_muscles
    .map(m => MUSCLE_DISPLAY_MAP[m] ?? m)
    .filter((v, i, a) => a.indexOf(v) === i)[0] ?? 'Full Body';

  const equipDisplay = z.equipment_required.length > 0
    ? (EQUIPMENT_DISPLAY_MAP[z.equipment_required[0]] ?? z.equipment_required[0])
    : 'Bodyweight';

  // Hyrox simulation exercises need special display values:
  // - Run legs get type 'hyroxRun' so the UI renders the dedicated run-divider strip,
  //   and reps '1 km' so the divider shows "RUN — 1 km".
  // - Station exercises get a clean name (strip the work volume suffix) and
  //   the work volume ('1000m', '50m', '100 reps', …) surfaced as the reps string
  //   so it appears naturally in the exercise subtitle row.
  const isHyroxRun = z.variation_family === 'hyrox_run';
  const isHyroxStation = z.variation_family === 'hyrox_station';

  let displayName = z.name;
  let displayReps = `${engineEx.reps}`;
  let displayType = displayStyle;

  if (isHyroxRun) {
    displayType = 'hyroxRun';
    displayReps = '1 km';
  } else if (isHyroxStation) {
    // Name format is "StationName — workVolume" (e.g. "SkiErg — 1000m")
    const dashIdx = z.name.indexOf(' — ');
    if (dashIdx !== -1) {
      displayName = z.name.slice(0, dashIdx);            // "SkiErg"
      displayReps = z.name.slice(dashIdx + 3);           // "1000m"
    }
  }

  // CrossFit metadata normalization: ensure carries are in meters, row is meters or calories,
  // and planks/holds are time-based. The UI infers time-based movements by suffixes like "s"/"min".
  if (displayStyle === 'CrossFit' && !isHyroxRun && !isHyroxStation) {
    displayReps = normalizeCrossfitRepsString(engineEx, displayReps, metconFormat);

    // Clean up machine naming (avoid "intervals" wording in WOD context).
    const req = z.equipment_required ?? [];
    const isRower = req.includes('rowing_machine' as never) || z.id === 'rowing_machine_intervals';
    if (isRower) displayName = 'Rowing Machine';
    const isBike = req.includes('assault_bike' as never) || z.id === 'assault_bike_intervals';
    if (isBike) displayName = 'Assault Bike';
  }

  return {
    id: `${z.id}_${index}`,
    name: displayName,
    sets: engineEx.sets,
    reps: displayReps,
    rest: formatRestTime(engineEx.restSeconds),
    muscleGroup: primaryDisplay,
    equipment: equipDisplay,
    notes: z.name,
    type: displayType,
    movementType,
    groupType: engineEx.groupType,
    groupId: engineEx.groupId,
    suggestedWeight: formatLoadDisplay(engineEx.loadLbs, engineEx),
    lastSessionWeight: '',
    lastSessionReps: '',
    exerciseRef: legacyEx ?? {
      id: z.id,
      name: z.name,
      movementType,
      movement_pattern: z.movement_pattern,
      movementPattern: z.movement_pattern === 'push' ? 'push'
        : z.movement_pattern === 'pull' ? 'pull'
        : z.movement_pattern === 'hinge' ? 'hinge'
        : z.movement_pattern === 'squat' ? 'squat'
        : z.movement_pattern === 'lunge' ? 'lunge'
        : z.movement_pattern === 'carry' ? 'carry'
        : z.movement_pattern === 'cardio' || z.movement_pattern === 'plyometric' ? 'conditioning'
        : 'core',
      primary_muscles: z.primary_muscles,
      secondary_muscles: z.secondary_muscles,
      primaryMuscles: z.primary_muscles.map(m => MUSCLE_DISPLAY_MAP[m] ?? m).filter((v, i, a) => a.indexOf(v) === i),
      secondaryMuscles: z.secondary_muscles.map(m => MUSCLE_DISPLAY_MAP[m] ?? m).filter((v, i, a) => a.indexOf(v) === i),
      equipment_required: z.equipment_required,
      equipment: z.equipment_required.filter(e => e !== 'bodyweight'),
      position: z.position,
      is_unilateral: z.is_unilateral,
      description: z.name,
      setup: '',
      steps: [],
      styles: z.eligible_styles.map(s => mapEngineStyleToDisplay(s)),
      contraindications: z.contraindication_tags,
    },
  };
}

function generateCardioItems(
  addCardio: boolean,
  style: string,
  rng: () => number,
): CardioItem[] {
  if (!addCardio && style !== 'Cardio') return [];
  const cardioFormats = ['Intervals', 'Steady State', 'Tempo'];
  const cardioExercises = ['Battle Ropes', 'Jump Rope', 'Rowing Machine', 'Assault Bike', 'Treadmill Run'];
  const format = cardioFormats[Math.floor(rng() * cardioFormats.length)];
  const ex1 = cardioExercises[Math.floor(rng() * cardioExercises.length)];
  const ex2 = cardioExercises[Math.floor(rng() * cardioExercises.length)];
  const items: CardioItem[] = [];
  if (format === 'Intervals') {
    items.push({
      name: `${ex1}: 40s all-out waves`,
      duration: '10min',
      format: `Intervals (${ex1} & ${ex2})`,
      rpe: '7',
      notes: 'Quick wrists, soft knees',
    });
    if (ex1 !== ex2) {
      items.push({
        name: ex2,
        duration: '10min',
        format: 'Intervals',
        rpe: '6-7',
        notes: 'Stay relaxed, steady pace',
      });
    }
  } else {
    items.push({
      name: `${ex1} ${format}`,
      duration: '20min',
      format,
      rpe: format === 'Tempo' ? '7-8' : '5-6',
      notes: format === 'Tempo' ? 'Push the pace, controlled effort' : 'Easy, conversational pace',
    });
  }
  return items;
}

// ═══════════════════════════════════════════════════════
// PUBLIC GENERATION API
// ═══════════════════════════════════════════════════════

export interface PlanAwareParams extends GenerateWorkoutParams {
  planPrescription?: DayPrescription | null;
}

export function calculateRest(movementType: MovementType, sliderValue: number): number {
  const sliderMultiplier = clamp((sliderValue / 100) * 2.0, 0.5, 2.0);
  let restTier: RestTier;
  if (movementType === 'heavyCompound') restTier = 'heavy_compound';
  else if (movementType === 'moderateCompound') restTier = 'moderate_compound';
  else if (movementType === 'circuit') restTier = 'quick_bodyweight';
  else restTier = 'isolation';
  return calculateTieredRest(restTier, sliderMultiplier);
}

const DISPLAY_TO_MUSCLE_KEYS: Record<string, string[]> = {
  'Chest': ['chest', 'upper_chest', 'lower_chest'],
  'Back': ['lats', 'upper_back', 'rhomboids', 'traps'],
  'Lats': ['lats'],
  'Shoulders': ['front_delt', 'side_delt', 'rear_delt'],
  'Rear Delts': ['rear_delt'],
  'Biceps': ['biceps'],
  'Triceps': ['triceps'],
  'Forearms': ['forearms'],
  'Quads': ['quads'],
  'Hamstrings': ['hamstrings'],
  'Glutes': ['glutes'],
  'Calves': ['calves'],
  'Core': ['core', 'obliques', 'transverse_abdominis'],
  'Obliques': ['obliques'],
  'Hip Flexors': ['hip_flexors'],
  'Adductors': ['adductors'],
  'Abductors': ['abductors'],
  'Lower Back': ['lower_back'],
  'Traps': ['traps'],
  'Full Body': ['chest', 'lats', 'quads', 'hamstrings', 'core', 'glutes'],
};

function extractWorkedMusclesFromLegacy(exercises: WorkoutExercise[]): Set<string> {
  const worked = new Set<string>();
  for (const ex of exercises) {
    const ref = ex.exerciseRef as { primary_muscles?: string[] } | null;
    const primaryMuscles = ref?.primary_muscles;
    if (Array.isArray(primaryMuscles) && primaryMuscles.length > 0) {
      primaryMuscles.forEach(m => worked.add(m));
    } else {
      const keys = DISPLAY_TO_MUSCLE_KEYS[ex.muscleGroup];
      if (keys) keys.forEach(m => worked.add(m));
    }
  }
  return worked;
}

/** Build full workout rows from saved-workout refs (id + display name only). */
export function workoutExercisesFromSavedRefs(
  refs: { exerciseId: string; name: string }[],
  workoutStyle: string,
): WorkoutExercise[] {
  const db = getZealExerciseDatabase();
  const styleKey = workoutStyle.trim() || 'Strength';

  return refs.map((ref) => {
    const ze = db.find(z => z.id === ref.exerciseId)
      ?? db.find(z => z.name === ref.name)
      ?? db.find(z => z.aliases.some(a => a.toLowerCase() === ref.name.toLowerCase()));
    const id = `loaded_${ref.exerciseId}_${Math.random().toString(36).slice(2, 9)}`;

    if (ze) {
      const primaryMuscle = ze.primary_muscles[0] ?? 'full_body';
      const muscleLabel = primaryMuscle
        .split('_')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      const equipLabel = ze.equipment_required[0]
        ? ze.equipment_required[0].split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        : 'Bodyweight';
      const movementType: MovementType = ze.is_compound ? 'moderateCompound' : 'isolation';
      const sets = styleKey.toLowerCase().includes('strength') ? 4 : 3;
      return {
        id,
        name: ze.name,
        sets,
        reps: '10',
        rest: '90 sec',
        muscleGroup: muscleLabel,
        equipment: equipLabel,
        notes: '',
        type: styleKey,
        movementType,
        groupType: null,
        groupId: null,
        suggestedWeight: '',
        lastSessionWeight: '',
        lastSessionReps: '',
        exerciseRef: ze,
      };
    }

    return {
      id,
      name: ref.name,
      sets: 3,
      reps: '10',
      rest: '90 sec',
      muscleGroup: 'Full Body',
      equipment: 'Bodyweight',
      notes: '',
      type: styleKey,
      movementType: 'moderateCompound' as MovementType,
      groupType: null,
      groupId: null,
      suggestedWeight: '',
      lastSessionWeight: '',
      lastSessionReps: '',
      exerciseRef: null,
    };
  });
}

export function generateWorkoutFromSavedExercises(
  exercises: WorkoutExercise[],
  restSlider: number,
  sex: string,
  fitnessLevel: string,
  warmUp: boolean,
  coolDown: boolean,
  recovery: boolean,
): GeneratedWorkout {
  console.log('[WorkoutEngine] generateWorkoutFromSavedExercises:', exercises.length, 'exercises');
  const rng = seededRandom(getDaySeed() + exercises.length * 7);

  const workedMuscles = extractWorkedMusclesFromLegacy(exercises);
  console.log('[WorkoutEngine] Saved workout worked muscles:', Array.from(workedMuscles).join(', '));

  const warmupItems: WarmupItem[] = [];
  if (warmUp) {
    const count = 4 + Math.floor(rng() * 3);
    const built = buildMobilityFirstWarmup(workedMuscles, [], count, rng);
    for (const item of built) {
      warmupItems.push({ name: item.name, description: item.description, swappable: item.swappable });
    }
    console.log('[WorkoutEngine] Saved warmup:', warmupItems.length, 'items (80%+ mobility/stretching targeted)');
  }

  const cooldownItems: CooldownItem[] = [];
  if (coolDown) {
    const cooldownEligible = getZealExerciseDatabase().filter(ex =>
      ex.is_cooldown_eligible &&
      ex.cooldown_for_muscles.some(m => workedMuscles.has(m))
    );
    const count = 3 + Math.floor(rng() * 2);
    const shuffledCooldown = shuffleArray(cooldownEligible, rng).slice(0, count);
    for (const ex of shuffledCooldown) {
      cooldownItems.push({
        name: ex.name,
        description: 'Hold 30-45 seconds each side',
      });
    }
    if (cooldownItems.length < count) {
      const fallback = shuffleArray(COOLDOWN_EXERCISES, rng);
      for (const c of fallback) {
        if (cooldownItems.length >= count) break;
        if (!cooldownItems.some(e => e.name === c.name)) {
          cooldownItems.push({ name: c.name, description: c.description });
        }
      }
    }
    console.log('[WorkoutEngine] Saved cooldown:', cooldownItems.length, 'items (', cooldownEligible.length, 'eligible from DB)');
  }

  const recoveryItems: RecoveryItem[] = recovery
    ? shuffleArray(RECOVERY_ITEMS, rng).slice(0, 2 + Math.floor(rng() * 2))
    : [];

  const estimatedDuration = Math.max(15, Math.round(exercises.length * 4.5));

  return {
    warmup: warmupItems,
    workout: exercises,
    cardio: [],
    cooldown: cooldownItems,
    recovery: recoveryItems,
    estimatedDuration,
    style: 'Saved',
    split: 'Custom',
    metconFormat: null,
    metconTimeCap: null,
    metconRounds: null,
  };
}

export function generateWorkout(params: GenerateWorkoutParams, prescription?: DayPrescription | null): GeneratedWorkout {
  const planPrescriptionForEngine = prescription ? {
    style: prescription.style,
    split: prescription.session_type,
    targetDurationMinutes: prescription.target_duration,
    volumeModifier: prescription.volume_modifier,
    intensityModifier: prescription.intensity_modifier,
  } : undefined;

  const engineParams: EngineParams = {
    style: params.style,
    split: params.split,
    targetDuration: prescription?.target_duration ?? params.targetDuration,
    restSlider: params.restSlider,
    availableEquipment: params.availableEquipment,
    fitnessLevel: params.fitnessLevel,
    sex: params.sex,
    specialLifeCase: params.specialLifeCase,
    specialLifeCaseDetail: params.specialLifeCaseDetail,
    warmUp: params.warmUp,
    coolDown: params.coolDown,
    recovery: params.recovery,
    addCardio: params.addCardio,
    specificMuscles: params.specificMuscles,
    seedOffset: params.seedOffset,
    planPrescription: planPrescriptionForEngine,
  };

  const result = runEngine(engineParams);
  const displayStyle = mapEngineStyleToDisplay(result.engineStyle);

  const workoutExercises = result.exercises.map((ex, i) =>
    convertEngineExerciseToLegacy(ex, i, displayStyle, result.metconFormat)
  );

  const warmupItems: WarmupItem[] = result.warmup.map(w => ({
    name: w.name,
    description: w.description,
    swappable: w.swappable,
  }));

  const cooldownItems: CooldownItem[] = result.cooldown.map(c => ({
    name: c.name,
    description: c.description,
  }));

  const rng = seededRandom(getDaySeed() + params.style.length);
  const cardioItems = generateCardioItems(params.addCardio, params.style, rng);

  const estimatedMin = Math.round(result.estimatedWorkingSeconds / 60);

  console.log('[WorkoutEngine] generateWorkout complete:', workoutExercises.length, 'exercises,', estimatedMin, 'min');

  return {
    warmup: warmupItems,
    workout: workoutExercises,
    cardio: cardioItems,
    cooldown: cooldownItems,
    recovery: result.recovery,
    estimatedDuration: estimatedMin,
    style: params.style || displayStyle,
    split: params.split,
    metconFormat: result.metconFormat,
    metconTimeCap: result.metconTimeCap,
    metconRounds: result.metconRounds,
  };
}

// ─────────────────────────────────────────────────────────────
// PUBLIC HELPER — used by AI workout path to generate warmup /
// cooldown / recovery via the rule engine instead of AI
// ─────────────────────────────────────────────────────────────

const HIGH_INTENSITY_STYLES = new Set(['CrossFit', 'HIIT', 'Hybrid', 'Hyrox']);
const LOW_INTENSITY_STYLES  = new Set(['Mobility', 'Pilates', 'Low-Impact']);

function normalizeMuscleGroupToEnums(muscleGroup: string): string[] {
  const g = muscleGroup.toLowerCase();
  if (g.includes('quad') || g === 'legs' || g === 'lower body') return ['quads'];
  if (g.includes('hamstring'))                                    return ['hamstrings'];
  if (g.includes('glute') || g.includes('hip flexor'))           return ['glutes', 'hip_flexors'];
  if (g.includes('chest') || g.includes('pec'))                  return ['chest'];
  if (g.includes('lat') || (g.includes('back') && !g.includes('lower'))) return ['lats', 'upper_back'];
  if (g.includes('lower back') || g.includes('erector'))         return ['lower_back'];
  if (g.includes('shoulder') || g.includes('delt'))              return ['front_delt', 'side_delt'];
  if (g.includes('core') || g.includes('abs') || g.includes('oblique')) return ['core'];
  if (g.includes('bicep'))                                        return ['biceps'];
  if (g.includes('tricep'))                                       return ['triceps'];
  if (g.includes('calf') || g.includes('calv'))                  return ['calves'];
  if (g.includes('full body') || g.includes('compound'))         return ['quads', 'chest', 'lats', 'core'];
  return [];
}

export function buildWarmupCooldownRecovery(
  params: GenerateWorkoutParams,
  workoutExercises: WorkoutExercise[],
): { warmup: WarmupItem[]; cooldown: CooldownItem[]; recovery: RecoveryItem[] } {
  const rng = seededRandom(
    getDaySeed() + params.style.length * 31 + params.split.length * 17
  );

  const workedMuscles = new Set(
    workoutExercises.flatMap(e => normalizeMuscleGroupToEnums(e.muscleGroup ?? ''))
  );
  const targetMuscles = params.specificMuscles.length > 0
    ? params.specificMuscles
    : Array.from(workedMuscles);

  // Warmup
  const warmup: WarmupItem[] = [];
  if (params.warmUp) {
    const count = WARMUP_EXERCISE_COUNT.min +
      Math.floor(rng() * (WARMUP_EXERCISE_COUNT.max - WARMUP_EXERCISE_COUNT.min + 1));
    const built = buildMobilityFirstWarmup(workedMuscles, targetMuscles, count, rng);
    warmup.push(...built.map(w => ({ name: w.name, description: w.description, swappable: w.swappable })));
  }

  // Cooldown — target muscles worked, fallback to classic static stretches
  const cooldown: CooldownItem[] = [];
  if (params.coolDown) {
    const cooldownEligible = getZealExerciseDatabase().filter(ex =>
      ex.is_cooldown_eligible &&
      ex.cooldown_for_muscles.some(m => workedMuscles.has(m) || targetMuscles.includes(m))
    );
    const count = COOLDOWN_EXERCISE_COUNT.min +
      Math.floor(rng() * (COOLDOWN_EXERCISE_COUNT.max - COOLDOWN_EXERCISE_COUNT.min + 1));

    if (cooldownEligible.length >= count) {
      shuffleArray(cooldownEligible, rng).slice(0, count).forEach(ex => {
        cooldown.push({ name: ex.name, description: 'Hold 30–45 seconds each side' });
      });
    }
    if (cooldown.length < COOLDOWN_EXERCISE_COUNT.min) {
      for (const c of shuffleArray(COOLDOWN_EXERCISES, rng)) {
        if (cooldown.length >= count) break;
        if (!cooldown.some(e => e.name === c.name)) {
          cooldown.push({ name: c.name, description: c.description });
        }
      }
    }
  }

  // Style-aware recovery
  const recovery: RecoveryItem[] = [];
  if (params.recovery) {
    const intensity = HIGH_INTENSITY_STYLES.has(params.style) ? 'high'
      : LOW_INTENSITY_STYLES.has(params.style) ? 'low'
      : 'medium';
    const eligible = RECOVERY_ITEMS.filter(r => r.intensity === intensity || r.intensity === 'any');
    const count = 2 + Math.floor(rng() * 2);
    // Deduplicate by name before slicing
    const seen = new Set<string>();
    const deduped = shuffleArray(eligible, rng).filter(r => {
      if (seen.has(r.name)) return false;
      seen.add(r.name);
      return true;
    });
    recovery.push(...deduped.slice(0, count).map(r => ({
      name: r.name,
      description: r.description,
      benefit: r.benefit,
    })));
  }

  return { warmup, cooldown, recovery };
}

