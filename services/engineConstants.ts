import type { EligibleStyle } from '@/mocks/exerciseDatabase';
import { FITNESS_LEVELS } from '@/constants/fitnessLevel';

export type RestTier = 'heavy_compound' | 'moderate_compound' | 'isolation' | 'core' | 'quick_bodyweight';

export type ExerciseRole = 'primary' | 'secondary' | 'accessory';

export interface RestTierConfig {
  floor_seconds: number;
  ceiling_seconds: number;
  base_rest_seconds: number;
}

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
  variation_family_penalty: -8,
  style_popularity_scale: 0.5, // Scales -100..100 → -50..+50 effective score range
};

// POPULAR_EXERCISES_BY_STYLE removed in v1.5 — popularity is now per-exercise
// in the style_popularity field of each ZealExercise in exerciseSchema.json.

export const MIN_EXERCISES_PER_STYLE: Record<string, number> = {
  strength: 6,
  bodybuilding: 6,
  crossfit: 5,
  hyrox: 6,
  hiit: 6,
  cardio: 1,
  mobility: 5,
  pilates: 5,
  '75_hard': 5,
  low_impact: 5,
  hybrid: 6,
};

export const MAX_EXERCISES_PER_STYLE: Record<string, number> = {
  strength: 8,
  bodybuilding: 9,
  crossfit: 10,
  hyrox: 16,
  hiit: 12,
  cardio: 3,
  mobility: 10,
  pilates: 10,
  '75_hard': 8,
  low_impact: 8,
  hybrid: 11,
};

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
    rep_range_override: { min: 4, max: 10 },
    set_range_override: { min: 3, max: 5 },
    allow_supersets: true,
    superset_min: 1,
    superset_max: 3,
    compounds_first: true,
    pattern_priority: ['squat', 'hinge', 'push', 'pull', 'isolation'],
  },
  bodybuilding: {
    rep_range_override: { min: 8, max: 15 },
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
  hiit: { max_working_minutes: 50 },
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
