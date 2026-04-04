import type { EligibleStyle } from '@/mocks/exerciseDatabase';
import { FITNESS_LEVELS } from '@/constants/fitnessLevel';

export type RestTier = 'heavy_compound' | 'moderate_compound' | 'isolation' | 'core' | 'quick_bodyweight';

export type ExerciseRole = 'primary' | 'secondary' | 'accessory';

export interface RestTierConfig {
  floor_seconds: number;
  ceiling_seconds: number;
  base_rest_seconds: number;
}

// Generic fallback rest values — only used by legacy calculateRest() export.
// The main generateWorkout() pipeline uses REST_PERIOD_MATRIX from styleTables.ts
// which provides per-style overrides (e.g. strength heavy_compound = 180s base).
export const REST_TIERS: Record<RestTier, RestTierConfig> = {
  heavy_compound:    { floor_seconds: 90,  ceiling_seconds: 300, base_rest_seconds: 150 },
  moderate_compound: { floor_seconds: 60,  ceiling_seconds: 210, base_rest_seconds: 105 },
  isolation:         { floor_seconds: 30,  ceiling_seconds: 150, base_rest_seconds: 60  },
  core:              { floor_seconds: 30,  ceiling_seconds: 120, base_rest_seconds: 45  },
  quick_bodyweight:  { floor_seconds: 20,  ceiling_seconds: 90,  base_rest_seconds: 30  },
};

export const REST_SLIDER_MIN = 0.5;
export const REST_SLIDER_MAX = 2.0;

export const TRANSITION_BUFFER_SECONDS = 37;

export const DISTRACTION_BUFFER_FACTOR = 0.875;

export const SCORING_WEIGHTS = {
  muscle_match: 30,
  equipment_match: 15,
  preference_liked: 100,
  preference_disliked: -25,
  recency_penalty_per_day: -2,
  recency_window_days: 5,
  difficulty_match: 10,
  pattern_diversity: 15,
  variation_family_penalty: -20,  // Increased from -8: prevents 6 bench press variants in one workout
  style_popularity_scale: 0.5, // Scales -100..100 → -50..+50 effective score range
};

// Max exercises allowed from the same variation family (e.g., bench press variants).
// Prevents over-representation of one movement pattern (e.g., 6 chest presses).
export const MAX_EXERCISES_PER_VARIATION_FAMILY = 2;

// Muscle Group Size Tier — deterministic ordering within architecture phases.
// Larger muscles sort earlier so big-muscle accessories precede small-muscle
// accessories (e.g., rear delt work before bicep curls on Pull Day).
// This is a SEPARATE ordering layer from compound/isolation and score.
export const MUSCLE_GROUP_SIZE_TIER: Record<string, number> = {
  // Tier 3 — Large muscles (sort first within phase)
  chest: 3, upper_chest: 3, lower_chest: 3,
  lats: 3, quads: 3, hamstrings: 3, glutes: 3,

  // Tier 2 — Medium muscles (sort middle)
  upper_back: 2, lower_back: 2,
  front_delt: 2, side_delt: 2, rear_delt: 2,
  traps: 2, rhomboids: 2,
  hip_flexors: 2, adductors: 2, abductors: 2,

  // Tier 1 — Small muscles (sort last within phase)
  biceps: 1, triceps: 1,
  forearms: 1, calves: 1, neck: 1,

  // Core (typically handled by mandatory finisher phase)
  core: 1, obliques: 1, transverse_abdominis: 1,
};

/** Returns the highest muscle size tier among an exercise's primary muscles. */
export function getMuscleSizeTier(primaryMuscles: string[]): number {
  if (!primaryMuscles || primaryMuscles.length === 0) return 1;
  let max = 1;
  for (const m of primaryMuscles) {
    const tier = MUSCLE_GROUP_SIZE_TIER[m] ?? 1;
    if (tier > max) max = tier;
  }
  return max;
}

// POPULAR_EXERCISES_BY_STYLE removed in v1.5 — popularity is now per-exercise
// in the style_popularity field of each ZealExercise in exerciseSchema.json.

// Aligned with architecture phase sums (styleFormats.ts).
// MIN = sum of phase minimums, MAX = sum of phase maximums.
export const MIN_EXERCISES_PER_STYLE: Record<string, number> = {
  strength: 4,
  bodybuilding: 6,
  crossfit: 5,
  hyrox: 4,
  hiit: 7,
  cardio: 1,
  mobility: 7,
  pilates: 7,
  '75_hard': 5,
  low_impact: 5,
  hybrid: 6,
};

export const MAX_EXERCISES_PER_STYLE: Record<string, number> = {
  strength: 7,      // Guide: max 5-6 at 60 min + 1 core finisher
  bodybuilding: 9,  // Guide: max 7-9 at 60 min (was 12 — caused 12-exercise workouts)
  crossfit: 8,      // Guide: max 4-6 WOD exercises + Part A/C
  hyrox: 16,
  hiit: 10,         // Guide: max 8-10 at 60 min
  cardio: 4,
  mobility: 25,     // Guide: up to 20-25 at 45 min
  pilates: 34,      // Guide: full classical order = 34 exercises at 60 min
  '75_hard': 8,
  low_impact: 8,
  hybrid: 11,
};

// Duration-scaled exercise counts (from Workout Style Guide v1.1).
// Maps (style, duration bucket) → { min, max } exercise count.
// The engine uses the closest bucket ≤ target duration.
export const EXERCISE_COUNT_BY_DURATION: Record<string, Record<number, { min: number; max: number }>> = {
  strength:     { 30: { min: 3, max: 4 }, 45: { min: 4, max: 5 }, 60: { min: 5, max: 6 } },
  bodybuilding: { 30: { min: 4, max: 5 }, 45: { min: 5, max: 7 }, 60: { min: 7, max: 9 } },
  crossfit:     { 30: { min: 2, max: 4 }, 45: { min: 3, max: 5 }, 60: { min: 4, max: 6 } },
  hiit:         { 30: { min: 4, max: 6 }, 45: { min: 6, max: 8 }, 60: { min: 8, max: 10 } },
  hyrox:        { 30: { min: 2, max: 3 }, 45: { min: 3, max: 4 }, 60: { min: 4, max: 8 } },
  cardio:       { 30: { min: 1, max: 2 }, 45: { min: 1, max: 3 }, 60: { min: 2, max: 4 } },
  pilates:      { 30: { min: 12, max: 15 }, 45: { min: 18, max: 22 }, 60: { min: 28, max: 34 } },
  mobility:     { 30: { min: 12, max: 15 }, 45: { min: 15, max: 18 }, 60: { min: 20, max: 25 } },
  low_impact:   { 30: { min: 3, max: 5 }, 45: { min: 5, max: 7 }, 60: { min: 6, max: 8 } },
  hybrid:       { 30: { min: 4, max: 6 }, 45: { min: 5, max: 8 }, 60: { min: 6, max: 10 } },
};

/** Look up exercise count range for a style at a given target duration.
 *  Picks the closest bucket ≤ targetMinutes, falls back to flat MIN/MAX. */
export function getExerciseCountForDuration(
  style: string,
  targetMinutes: number,
): { min: number; max: number } | null {
  const buckets = EXERCISE_COUNT_BY_DURATION[style];
  if (!buckets) return null;
  const thresholds = Object.keys(buckets).map(Number).sort((a, b) => b - a);
  for (const t of thresholds) {
    if (targetMinutes >= t) return buckets[t];
  }
  // Below the lowest bucket — return the smallest
  const smallest = thresholds[thresholds.length - 1];
  return buckets[smallest] ?? null;
}

export interface StyleEngineConfig {
  rep_range_override?: { min: number; max: number };
  set_range_override?: { min: number; max: number };
  allow_supersets: boolean;
  superset_min: number;
  superset_max: number;
  compounds_first: boolean;
  pattern_priority: string[];
  metcon_formats?: string[];
  circuit_grouping?: boolean;
}

export const STYLE_ENGINE_CONFIGS: Record<string, StyleEngineConfig> = {
  strength: {
    rep_range_override: { min: 3, max: 6 },
    set_range_override: { min: 3, max: 5 },
    allow_supersets: true,
    superset_min: 1,
    superset_max: 2,
    compounds_first: true,
    pattern_priority: ['squat', 'hinge', 'push', 'pull', 'isolation'],
  },
  bodybuilding: {
    rep_range_override: { min: 8, max: 12 },
    set_range_override: { min: 3, max: 4 },
    allow_supersets: true,
    superset_min: 1,
    superset_max: 3,
    compounds_first: true,
    pattern_priority: ['push', 'pull', 'squat', 'hinge', 'isolation'],
  },
  crossfit: {
    rep_range_override: { min: 5, max: 15 },
    set_range_override: { min: 3, max: 5 },
    allow_supersets: false,
    superset_min: 0,
    superset_max: 0,
    compounds_first: true,
    pattern_priority: ['squat', 'push', 'pull', 'hinge', 'plyometric', 'cardio'],
    metcon_formats: ['AMRAP', 'EMOM', 'For Time', 'Chipper'],
  },
  hyrox: {
    allow_supersets: false,
    superset_min: 0,
    superset_max: 0,
    compounds_first: false,
    pattern_priority: ['cardio', 'squat', 'carry', 'push', 'lunge'],
  },
  hiit: {
    rep_range_override: { min: 10, max: 20 },
    set_range_override: { min: 3, max: 5 },
    allow_supersets: false,
    superset_min: 0,
    superset_max: 0,
    compounds_first: false,
    pattern_priority: ['plyometric', 'squat', 'push', 'pull', 'cardio'],
    circuit_grouping: true,
  },
  cardio: {
    allow_supersets: false,
    superset_min: 0,
    superset_max: 0,
    compounds_first: false,
    pattern_priority: ['cardio'],
  },
  mobility: {
    rep_range_override: { min: 5, max: 10 },
    set_range_override: { min: 2, max: 3 },
    allow_supersets: false,
    superset_min: 0,
    superset_max: 0,
    compounds_first: false,
    pattern_priority: ['mobility', 'rotation', 'hinge', 'squat'],
  },
  pilates: {
    rep_range_override: { min: 8, max: 15 },
    set_range_override: { min: 2, max: 3 },
    allow_supersets: false,
    superset_min: 0,
    superset_max: 0,
    compounds_first: false,
    pattern_priority: ['pilates', 'rotation', 'isolation', 'hinge'],
  },
  low_impact: {
    rep_range_override: { min: 12, max: 20 },
    set_range_override: { min: 2, max: 4 },
    allow_supersets: true,
    superset_min: 1,
    superset_max: 2,
    compounds_first: false,
    pattern_priority: ['isolation', 'push', 'pull', 'hinge', 'squat', 'lunge'],
  },
  hybrid: {
    rep_range_override: { min: 3, max: 15 },
    set_range_override: { min: 3, max: 5 },
    allow_supersets: false,
    superset_min: 0,
    superset_max: 0,
    compounds_first: true,
    pattern_priority: ['squat', 'hinge', 'push', 'pull', 'plyometric', 'isolation'],
    circuit_grouping: true,
  },
};

export const STYLE_DURATION_OVERRIDES: Record<string, { max_working_minutes?: number; fixed_minutes?: number }> = {
  hiit: { max_working_minutes: 30 },
  '75_hard': { fixed_minutes: 45 },
  mobility: { max_working_minutes: 45 },
  pilates: { max_working_minutes: 50 },
};

export const PROGRESSIVE_OVERLOAD = {
  upper_body_increment_lbs: 5,
  lower_body_increment_lbs: 10,
  reps_exceed_threshold: 2,
};

export const FEEDBACK_ADJUSTMENT = {
  trailing_window_sessions: 5,
  rpe_too_easy_threshold: 4,
  rpe_too_hard_threshold: 8,
  volume_reduction_factor: 0.90,
  volume_increase_factor: 1.05,
  intensity_reduction_factor: 0.95,
  intensity_increase_factor: 1.05,
};

export const WARMUP_EXERCISE_COUNT = { min: 3, max: 5 };
export const COOLDOWN_EXERCISE_COUNT = { min: 2, max: 4 };

export const WARMUP_DURATION_ESTIMATE_SECONDS = 300;
export const COOLDOWN_DURATION_ESTIMATE_SECONDS = 300;

export const SPLIT_TO_MUSCLES: Record<string, string[]> = {
  'Push, Pull, Legs':      ['chest', 'upper_chest', 'lower_chest', 'front_delt', 'side_delt', 'triceps', 'lats', 'upper_back', 'lower_back', 'traps', 'rhomboids', 'rear_delt', 'biceps', 'forearms', 'quads', 'hamstrings', 'glutes', 'hip_flexors', 'adductors', 'abductors', 'calves'],
  'Push':                  ['chest', 'upper_chest', 'lower_chest', 'front_delt', 'side_delt', 'triceps'],
  'Pull':                  ['lats', 'upper_back', 'lower_back', 'traps', 'rhomboids', 'rear_delt', 'biceps', 'forearms'],
  'Legs':                  ['quads', 'hamstrings', 'glutes', 'hip_flexors', 'adductors', 'abductors', 'calves'],
  'Push Day':              ['chest', 'upper_chest', 'lower_chest', 'front_delt', 'side_delt', 'triceps'],
  'Pull Day':              ['lats', 'upper_back', 'lower_back', 'traps', 'rhomboids', 'rear_delt', 'biceps', 'forearms'],
  'Leg Day':               ['quads', 'hamstrings', 'glutes', 'hip_flexors', 'adductors', 'abductors', 'calves'],
  'Upper':                 ['chest', 'upper_chest', 'lower_chest', 'front_delt', 'side_delt', 'triceps', 'lats', 'upper_back', 'lower_back', 'traps', 'rhomboids', 'rear_delt', 'biceps', 'forearms'],
  'Lower':                 ['quads', 'hamstrings', 'glutes', 'hip_flexors', 'adductors', 'abductors', 'calves', 'lower_back'],
  'Full Body':             ['chest', 'lats', 'front_delt', 'quads', 'hamstrings', 'glutes', 'core'],
  'Core + Cardio':         ['core', 'obliques', 'transverse_abdominis', 'hip_flexors'],
  'Bro Split':             ['chest', 'upper_chest', 'lats', 'front_delt', 'side_delt', 'rear_delt', 'biceps', 'triceps', 'forearms', 'quads', 'hamstrings', 'glutes'],
  'Arnold Split':          ['chest', 'upper_chest', 'lats', 'upper_back', 'rhomboids', 'rear_delt', 'front_delt', 'side_delt', 'biceps', 'triceps', 'forearms', 'quads', 'hamstrings', 'glutes', 'hip_flexors', 'adductors', 'abductors', 'calves'],
  'Full Body HIIT':        ['chest', 'lats', 'quads', 'hamstrings', 'glutes', 'core', 'front_delt'],
  'Upper HIIT':            ['chest', 'lats', 'front_delt', 'side_delt', 'biceps', 'triceps'],
  'Lower HIIT':            ['quads', 'hamstrings', 'glutes', 'hip_flexors', 'calves', 'adductors'],
  'Core Blast':            ['core', 'obliques', 'hip_flexors', 'transverse_abdominis'],
  'Auto':                  [],
  'AMRAP':                 [],
  'EMOM':                  [],
  'RFT':                   [],
  'Chipper':               [],
  'Ladder':                [],
  'Station Practice':      ['quads', 'hamstrings', 'lats', 'core', 'glutes'],
  'Compromised Run':       ['quads', 'hamstrings', 'calves', 'glutes'],
  'Strength Circuit':      ['quads', 'lats', 'front_delt', 'core', 'glutes'],
  'Half Simulation':       ['quads', 'hamstrings', 'lats', 'core', 'front_delt'],
  'Full Simulation':       ['quads', 'hamstrings', 'lats', 'core', 'front_delt', 'glutes'],
  'Steady-State (Zone 2)': ['quads', 'hamstrings', 'calves'],
  'Tempo':                 ['quads', 'hamstrings', 'calves', 'core'],
  'Intervals':             ['quads', 'hamstrings', 'core', 'calves'],
  'Fartlek':               ['quads', 'hamstrings', 'calves'],
  'Machine Rotation':      ['quads', 'hamstrings', 'lats', 'core'],
  'Bodyweight Circuit':    ['chest', 'lats', 'quads', 'core', 'glutes'],
  'Seated Circuit':        ['quads', 'hamstrings', 'glutes', 'chest', 'lats', 'front_delt', 'biceps', 'triceps'],
  'Full-Body Flow':        ['hip_flexors', 'front_delt', 'lats', 'hamstrings', 'core'],
  'Targeted':              ['hip_flexors', 'hamstrings', 'core'],
  'Foam Rolling + Stretch':['quads', 'hamstrings', 'hip_flexors', 'lats', 'calves'],
  'Recovery Day':          ['quads', 'hamstrings', 'hip_flexors', 'lats'],
  'Classical Mat Flow':    ['core', 'obliques', 'glutes', 'hip_flexors'],
  'Themed Flow':           ['core', 'obliques', 'glutes', 'front_delt'],
  'Pilates Circuit':       ['core', 'obliques', 'glutes', 'quads', 'hip_flexors'],
  'Reformer Flow':         ['core', 'obliques', 'glutes', 'hip_flexors', 'quads'],
  'Session 1 (Indoor)':   [],
  'Session 2 (Outdoor)':  [],
};

export const UPPER_BODY_MUSCLES = new Set([
  'chest', 'upper_chest', 'lower_chest',
  'front_delt', 'side_delt', 'rear_delt',
  'lats', 'upper_back', 'traps', 'rhomboids',
  'biceps', 'triceps', 'forearms', 'neck',
]);

export const LEGACY_STYLE_MAP: Record<string, EligibleStyle> = {
  'Strength': 'strength',
  'Bodybuilding': 'bodybuilding',
  'CrossFit': 'crossfit',
  'Hyrox': 'hyrox',
  'HIIT': 'hiit',
  'Mobility': 'mobility',
  'Pilates': 'pilates',
  'Low-Impact': 'low_impact',
  'Hybrid': 'hybrid',
};

export const STYLE_DISPLAY_FROM_ENGINE: Record<string, string> = {
  strength: 'Strength',
  bodybuilding: 'Bodybuilding',
  crossfit: 'CrossFit',
  hyrox: 'Hyrox',
  hiit: 'HIIT',
  mobility: 'Mobility',
  pilates: 'Pilates',
  low_impact: 'Low-Impact',
  hybrid: 'Hybrid',
};

export function mapLegacyStyleToEngine(displayStyle: string): string {
  const mapped = LEGACY_STYLE_MAP[displayStyle];
  return mapped ?? displayStyle.toLowerCase();
}

export function mapEngineStyleToDisplay(engineStyle: string): string {
  return STYLE_DISPLAY_FROM_ENGINE[engineStyle] ?? engineStyle;
}

export function getDifficultyKey(sex: string, fitnessLevel: string): string {
  const s = sex === 'female' ? 'female' : 'male';
  const l = (FITNESS_LEVELS as readonly string[]).includes(fitnessLevel)
    ? fitnessLevel : 'intermediate';
  return `${s}_${l}`;
}

// EXERCISE_POPULARITY_SCORES removed in v1.5 — popularity is now per-exercise
// in the style_popularity field of each ZealExercise in exerciseSchema.json.

export { getStyleRules, ALL_STYLE_RULES, SEVENTY_FIVE_HARD_RULES } from '@/services/styleRules';
export { FORMAT_DEFINITIONS, getArchitectureForStyle } from '@/services/styleFormats';
export { FORMAT_AVAILABILITY, REST_PERIOD_MATRIX, SUPERSET_ELIGIBILITY, PROGRESSION_SPEED } from '@/services/styleTables';
