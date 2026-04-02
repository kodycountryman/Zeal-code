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
  popularity_bonus: 50,
};

export const POPULAR_EXERCISES_BY_STYLE: Record<string, string[]> = {
  strength: [
    'barbell_back_squat',
    'conventional_deadlift',
    'barbell_bench_press',
    'standing_overhead_press',
    'pull_up',
    'barbell_bent_over_row',
    'romanian_deadlift',
    'front_squat',
    'trap_bar_deadlift',
    'sumo_deadlift',
    'hip_thrust',
    'close_grip_bench_press',
    'incline_barbell_bench',
    'dumbbell_bench_press',
    'lat_pulldown',
    'seated_dumbbell_shoulder_press',
    'incline_dumbbell_bench',
    'cable_chest_fly',
    'pec_deck_fly',
    'cable_crossover',
    'dumbbell_lateral_raise',
    'cable_lateral_raise',
    'face_pull',
    'cable_tricep_pushdown',
    'skull_crusher',
    'dumbbell_curl',
    'hammer_curl',
    'ez_bar_curl',
    'dumbbell_row',
    'lat_pulldown',
    'hip_thrust',
    'leg_press',
    'romanian_deadlift',
    'cable_seated_row',
    'preacher_curl',
    'incline_barbell_bench',
  ],
  bodybuilding: [
    'incline_dumbbell_bench',
    'cable_chest_fly',
    'pec_deck_fly',
    'cable_crossover',
    'dumbbell_lateral_raise',
    'cable_lateral_raise',
    'face_pull',
    'cable_tricep_pushdown',
    'skull_crusher',
    'dumbbell_curl',
    'hammer_curl',
    'ez_bar_curl',
    'dumbbell_row',
    'lat_pulldown',
    'hip_thrust',
    'leg_press',
    'romanian_deadlift',
    'cable_seated_row',
    'preacher_curl',
    'incline_barbell_bench',
    'barbell_back_squat',
    'conventional_deadlift',
    'barbell_bench_press',
    'standing_overhead_press',
    'pull_up',
    'barbell_bent_over_row',
    'romanian_deadlift',
    'front_squat',
    'trap_bar_deadlift',
    'sumo_deadlift',
    'hip_thrust',
    'close_grip_bench_press',
    'incline_barbell_bench',
    'dumbbell_bench_press',
    'lat_pulldown',
    'seated_dumbbell_shoulder_press',
  ],
  crossfit: [
    'barbell_back_squat',
    'pull_up',
    'push_up',
    'burpee',
    'kettlebell_swing',
    'wall_ball',
    'toes_to_bar',
    'thruster',
    'clean_and_jerk',
    'box_jump',
    'double_under',
    'rowing_machine_intervals',
    'power_clean',
    'hang_clean',
    'dumbbell_snatch',
    'assault_bike_intervals',
    'ring_dip',
    'rope_climb',
  ],
  hiit: [
    'burpee',
    'mountain_climber',
    'jump_squat',
    'battle_rope_slams',
    'high_knees',
    'push_up',
    'box_jump',
    'skater_jump',
    'plyo_push_up',
    'bear_crawl',
    'jump_rope_intervals',
    'assault_bike_intervals',
    'inchworm_to_push_up',
    'broad_jump',
    'lunge_jump',
    'star_jump',
    'speed_skater',
  ],
  cardio: [
    'treadmill_run',
    'rowing_machine_intervals',
    'assault_bike_intervals',
    'stationary_bike_intervals',
    'jump_rope_intervals',
    'stair_climber',
    'elliptical_intervals',
    'ski_erg_intervals',
  ],
  pilates: [
    'pilates_hundred',
    'pilates_roll_up',
    'pilates_teaser',
    'pilates_single_leg_stretch',
    'pilates_swimming',
    'pilates_bridge',
    'pilates_criss_cross',
    'pilates_double_leg_stretch',
    'pilates_seal',
    'pilates_saw',
    'pilates_mermaid',
    'pilates_side_leg_series',
    'pilates_spine_stretch',
  ],
  low_impact: [
    'leg_press',
    'leg_extension',
    'leg_curl',
    'chest_press_machine',
    'lat_pulldown',
    'cable_seated_row',
    'dumbbell_curl',
    'cable_tricep_pushdown',
    'dumbbell_lateral_raise',
    'face_pull',
    'hip_thrust',
    'cable_chest_fly',
    'seated_dumbbell_shoulder_press',
    'dumbbell_row',
    'hammer_curl',
    'cable_lateral_raise',
    'preacher_curl',
    'incline_dumbbell_bench',
    'pec_deck_fly',
    'cable_crossover',
    'push_up',
    'plank',
    'walking_lunge',
    'dumbbell_bench_press',
    'seated_calf_raise',
  ],
  mobility: [
    'worlds_greatest_stretch',
    'hip_90_90_stretch',
    'downward_dog',
    'pigeon_stretch',
    'cat_cow',
    'thoracic_spine_rotation',
    'couch_stretch',
    'childs_pose',
    'seated_spinal_twist',
    'hip_circles',
    'leg_swings_forward',
    'inchworm',
    'foam_roll_quads',
    'foam_roll_hamstrings',
    'foam_roll_upper_back',
  ],
};

export const MIN_EXERCISES_PER_STYLE: Record<string, number> = {
  strength: 6,
  bodybuilding: 6,
  crossfit: 5,
  hyrox: 6,
  hiit: 4,
  cardio: 1,
  mobility: 5,
  pilates: 5,
  '75_hard': 5,
  low_impact: 5,
};

export const MAX_EXERCISES_PER_STYLE: Record<string, number> = {
  strength: 8,
  bodybuilding: 9,
  crossfit: 10,
  hyrox: 16,
  hiit: 8,
  cardio: 3,
  mobility: 10,
  pilates: 10,
  '75_hard': 8,
  low_impact: 8,
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
  'Hybrid': 'strength',
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

export const POPULARITY_SCORES = {
  most_popular:     50,
  popular:          30,
  normal:            0,
  unpopular:       -30,
  really_unpopular:-50,
} as const;

export const EXERCISE_POPULARITY_SCORES: Record<string, number> = {
  // MOST POPULAR +50 — gym staples everyone knows
  barbell_back_squat:             50,
  conventional_deadlift:          50,
  barbell_bench_press:            50,
  pull_up:                        50,
  standing_overhead_press:        50,
  romanian_deadlift:              50,
  barbell_bent_over_row:          50,
  dumbbell_bench_press:           50,
  lat_pulldown:                   50,
  hip_thrust:                     50,
  leg_press:                      50,
  dumbbell_curl:                  50,
  hammer_curl:                    50,
  cable_tricep_pushdown:          50,
  dumbbell_lateral_raise:         50,
  face_pull:                      50,
  skull_crusher:                  50,
  dumbbell_row:                   50,
  push_up:                        50,
  plank:                          50,
  walking_lunge:                  50,
  farmers_carry:                  50,
  treadmill_run:                  50,
  rowing_machine_intervals:       50,
  assault_bike_intervals:         50,
  cable_chest_fly:                50,
  ez_bar_curl:                    50,
  incline_dumbbell_bench:         50,
  seated_dumbbell_shoulder_press: 50,
  cable_seated_row:               50,
  preacher_curl:                  50,
  incline_barbell_bench:          50,
  cable_lateral_raise:            50,
  // Machines — elevated to match barbell staples
  leg_extension:                  50,
  leg_curl:                       50,
  hack_squat:                     50,
  seated_calf_raise:              50,
  chest_press_machine:            50,
  shoulder_press_machine:         50,
  cable_crossover:                50,
  pec_deck_fly:                   50,

  // POPULAR +30 — common, well-known movements
  front_squat:                    30,
  goblet_squat:                   30,
  bulgarian_split_squat:          30,
  sumo_deadlift:                  30,
  trap_bar_deadlift:              30,
  dip:                            30,
  close_grip_bench_press:         30,
  arnold_press:                   30,
  t_bar_row:                      30,
  cable_curl:                     30,
  glute_bridge:                   30,
  back_extension:                 30,
  bodyweight_squat:               30,
  reverse_lunge:                  30,
  step_up:                        30,
  hanging_leg_raise:              30,
  ab_wheel_rollout:               30,
  russian_twist:                  30,
  bicycle_crunch:                 30,
  mountain_climber:               30,
  burpee:                         30,
  jump_squat:                     30,
  jump_rope_intervals:            30,
  side_plank:                     30,
  dumbbell_rdl:                   30,
  barbell_curl:                   30,
  inverted_row:                   30,
  standing_calf_raise:            30,
  battle_rope_slams:              30,
  dumbbell_squat:                 30,
  skater_jump:                    30,
  // Additional machines at popular tier
  seated_row_machine:             30,
  smith_machine_squat:            30,
  cable_row:                      30,
  lat_pulldown_wide:              30,
  leg_press_calf_raise:           30,

  // UNPOPULAR -30 — niche / rarely programmed in mainstream gyms
  single_leg_rdl:                -30,
  suitcase_carry:                -30,
  overhead_carry:                -30,
  superman_hold:                 -30,
  copenhagen_plank:              -30,
  pistol_squat:                  -30,
  muscle_up:                     -30,
  hollow_body_hold:              -30,
  broad_jump:                    -30,
  lunge_jump:                    -30,
  bear_crawl:                    -30,
  // CrossFit Olympic movements — penalized out of non-CrossFit styles
  power_clean:                   -50,
  hang_clean:                    -50,
  clean_and_jerk:                -50,
  kettlebell_swing:              -50,
  kettlebell_windmill:           -50,
  dumbbell_power_clean:          -50,
  dumbbell_clean_and_press:      -50,
  box_jump:                       0,

  // Sled exercises — conditioning tools, not regular strength exercises
  sled_pull:                     -50,
  sled_push:                     -50,

  // REALLY UNPOPULAR -50 — surprising to see in a regular workout
  bird_dog:                      -50,
  handstand_push_up:             -50,
  kegel_exercise:                -50,
  tuck_jump:                     -50,
  cable_woodchop:                -30,
};

console.log('[EngineConstants] Popularity tier map:', Object.keys(EXERCISE_POPULARITY_SCORES).length, 'explicit entries (others default to 0)');

export { getStyleRules, ALL_STYLE_RULES, SEVENTY_FIVE_HARD_RULES } from '@/services/styleRules';
export { FORMAT_DEFINITIONS, getArchitectureForStyle } from '@/services/styleFormats';
export { FORMAT_AVAILABILITY, REST_PERIOD_MATRIX, SUPERSET_ELIGIBILITY, PROGRESSION_SPEED } from '@/services/styleTables';
