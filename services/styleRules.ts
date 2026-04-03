import type { WorkoutFormatId } from '@/services/styleFormats';
import type { RestTier } from '@/services/engineConstants';
import { type FitnessLevel, FITNESS_LEVELS } from '@/constants/fitnessLevel';

console.log('[StyleRules] Style-specific generation rules loaded');

export type { FitnessLevel };

export interface FormatSelectionRule {
  format: WorkoutFormatId;
  weight: number;
  min_fitness_level?: FitnessLevel;
  max_fitness_level?: FitnessLevel;
  cooldown_days?: number;
}

export interface StyleRestOverride {
  heavy_compound: { floor: number; ceiling: number; base: number };
  moderate_compound: { floor: number; ceiling: number; base: number };
  isolation: { floor: number; ceiling: number; base: number };
  core: { floor: number; ceiling: number; base: number };
  quick_bodyweight: { floor: number; ceiling: number; base: number };
}

export interface SupersetRule {
  enabled: boolean;
  default_for_isolation: boolean;
  never_superset_primaries: boolean;
  never_superset_heavy_compounds: boolean;
  min_supersets: number;
  max_supersets: number;
  allowed_pairing_types: ('antagonist' | 'compound_set' | 'pre_exhaust' | 'post_exhaust')[];
}

export interface ProgressionModel {
  beginner: {
    rep_increase_per_week: number;
    load_increase_percent_per_week: number;
    set_increase_frequency_weeks: number;
    max_load_increase_lbs_upper: number;
    max_load_increase_lbs_lower: number;
    deload_frequency_weeks: number;
    deload_volume_reduction: number;
  };
  intermediate: {
    rep_increase_per_week: number;
    load_increase_percent_per_week: number;
    set_increase_frequency_weeks: number;
    max_load_increase_lbs_upper: number;
    max_load_increase_lbs_lower: number;
    deload_frequency_weeks: number;
    deload_volume_reduction: number;
  };
  advanced: {
    rep_increase_per_week: number;
    load_increase_percent_per_week: number;
    set_increase_frequency_weeks: number;
    max_load_increase_lbs_upper: number;
    max_load_increase_lbs_lower: number;
    deload_frequency_weeks: number;
    deload_volume_reduction: number;
  };
}

export interface TimeMathConfig {
  transition_buffer_seconds: number;
  distraction_factor: number;
  warmup_time_budget_fraction: number;
  cooldown_time_budget_fraction: number;
  metcon_time_budget_fraction?: number;
  strength_time_budget_fraction?: number;
  max_working_minutes?: number;
  fixed_minutes?: number;
  work_rest_ratio?: { work: number; rest: number };
  round_time_seconds?: number;
  station_time_seconds?: number;
  run_time_seconds?: number;
}

export interface MetconConfig {
  available_formats: WorkoutFormatId[];
  default_time_cap_minutes: number;
  min_exercises: number;
  max_exercises: number;
  format_selection: FormatSelectionRule[];
}

export interface StyleGenerationRules {
  style_id: string;
  display_name: string;
  available_formats: WorkoutFormatId[];
  primary_format: WorkoutFormatId;
  format_selection: FormatSelectionRule[];
  session_architecture_id: string;
  rest_overrides: StyleRestOverride;
  superset_rules: SupersetRule;
  progression: ProgressionModel;
  time_math: TimeMathConfig;
  metcon?: MetconConfig;
  rep_range: { min: number; max: number };
  set_range: { min: number; max: number };
  compounds_first: boolean;
  pattern_priority: string[];
  exercise_count: { min: number; max: number };
  special_rules: string[];
}

export const STRENGTH_RULES: StyleGenerationRules = {
  style_id: 'strength',
  display_name: 'Strength',
  available_formats: ['straight_sets', 'wave_loading', 'cluster_sets', 'ascending_sets', 'descending_sets', 'pyramid', 'supersets'],
  primary_format: 'straight_sets',
  format_selection: [
    { format: 'straight_sets', weight: 40 },
    { format: 'ascending_sets', weight: 20 },
    { format: 'wave_loading', weight: 15, min_fitness_level: 'intermediate' },
    { format: 'cluster_sets', weight: 10, min_fitness_level: 'advanced' },
    { format: 'pyramid', weight: 10, min_fitness_level: 'intermediate' },
    { format: 'supersets', weight: 5 },
  ],
  session_architecture_id: 'strength',
  rest_overrides: {
    heavy_compound:    { floor: 120, ceiling: 300, base: 180 },
    moderate_compound: { floor: 90,  ceiling: 210, base: 120 },
    isolation:         { floor: 45,  ceiling: 150, base: 75  },
    core:              { floor: 30,  ceiling: 120, base: 45  },
    quick_bodyweight:  { floor: 20,  ceiling: 90,  base: 30  },
  },
  superset_rules: {
    enabled: true,
    default_for_isolation: false,
    never_superset_primaries: true,
    never_superset_heavy_compounds: true,
    min_supersets: 1,
    max_supersets: 2,
    allowed_pairing_types: ['antagonist'],
  },
  progression: {
    beginner: {
      rep_increase_per_week: 1,
      load_increase_percent_per_week: 2.5,
      set_increase_frequency_weeks: 4,
      max_load_increase_lbs_upper: 5,
      max_load_increase_lbs_lower: 10,
      deload_frequency_weeks: 6,
      deload_volume_reduction: 0.40,
    },
    intermediate: {
      rep_increase_per_week: 0,
      load_increase_percent_per_week: 2.0,
      set_increase_frequency_weeks: 3,
      max_load_increase_lbs_upper: 5,
      max_load_increase_lbs_lower: 10,
      deload_frequency_weeks: 5,
      deload_volume_reduction: 0.35,
    },
    advanced: {
      rep_increase_per_week: 0,
      load_increase_percent_per_week: 1.0,
      set_increase_frequency_weeks: 2,
      max_load_increase_lbs_upper: 2.5,
      max_load_increase_lbs_lower: 5,
      deload_frequency_weeks: 4,
      deload_volume_reduction: 0.30,
    },
  },
  time_math: {
    transition_buffer_seconds: 45,
    distraction_factor: 0.875,
    warmup_time_budget_fraction: 0.0,
    cooldown_time_budget_fraction: 0.0,
  },
  rep_range: { min: 1, max: 6 },
  set_range: { min: 3, max: 5 },
  compounds_first: true,
  pattern_priority: ['squat', 'hinge', 'push', 'pull', 'isolation'],
  exercise_count: { min: 6, max: 8 },
  special_rules: [
    'NEVER_SUPERSET_PRIMARY_COMPOUNDS',
    'HEAVY_COMPOUND_FIRST',
    'WAVE_LOADING_ONLY_FOR_PRIMARY',
    'CLUSTER_SETS_ONLY_ADVANCED',
  ],
};

export const BODYBUILDING_RULES: StyleGenerationRules = {
  style_id: 'bodybuilding',
  display_name: 'Bodybuilding',
  available_formats: ['straight_sets', 'supersets', 'tri_sets', 'giant_sets', 'drop_sets', 'rest_pause', 'ascending_sets', 'descending_sets'],
  primary_format: 'straight_sets',
  format_selection: [
    { format: 'straight_sets', weight: 25 },
    { format: 'supersets', weight: 30 },
    { format: 'drop_sets', weight: 15, min_fitness_level: 'intermediate' },
    { format: 'tri_sets', weight: 10, min_fitness_level: 'intermediate' },
    { format: 'giant_sets', weight: 5, min_fitness_level: 'advanced' },
    { format: 'rest_pause', weight: 10, min_fitness_level: 'advanced' },
    { format: 'ascending_sets', weight: 5 },
  ],
  session_architecture_id: 'bodybuilding',
  rest_overrides: {
    heavy_compound:    { floor: 90,  ceiling: 240, base: 150 },
    moderate_compound: { floor: 60,  ceiling: 180, base: 90  },
    isolation:         { floor: 30,  ceiling: 120, base: 60  },
    core:              { floor: 30,  ceiling: 90,  base: 45  },
    quick_bodyweight:  { floor: 20,  ceiling: 75,  base: 30  },
  },
  superset_rules: {
    enabled: true,
    default_for_isolation: true,
    never_superset_primaries: true,
    never_superset_heavy_compounds: true,
    min_supersets: 1,
    max_supersets: 3,
    allowed_pairing_types: ['antagonist', 'compound_set', 'pre_exhaust', 'post_exhaust'],
  },
  progression: {
    beginner: {
      rep_increase_per_week: 1,
      load_increase_percent_per_week: 2.0,
      set_increase_frequency_weeks: 3,
      max_load_increase_lbs_upper: 5,
      max_load_increase_lbs_lower: 10,
      deload_frequency_weeks: 6,
      deload_volume_reduction: 0.35,
    },
    intermediate: {
      rep_increase_per_week: 1,
      load_increase_percent_per_week: 1.5,
      set_increase_frequency_weeks: 3,
      max_load_increase_lbs_upper: 5,
      max_load_increase_lbs_lower: 5,
      deload_frequency_weeks: 5,
      deload_volume_reduction: 0.30,
    },
    advanced: {
      rep_increase_per_week: 0,
      load_increase_percent_per_week: 1.0,
      set_increase_frequency_weeks: 2,
      max_load_increase_lbs_upper: 2.5,
      max_load_increase_lbs_lower: 5,
      deload_frequency_weeks: 4,
      deload_volume_reduction: 0.25,
    },
  },
  time_math: {
    transition_buffer_seconds: 37,
    distraction_factor: 0.875,
    warmup_time_budget_fraction: 0.0,
    cooldown_time_budget_fraction: 0.0,
  },
  rep_range: { min: 8, max: 15 },
  set_range: { min: 3, max: 4 },
  compounds_first: true,
  pattern_priority: ['push', 'pull', 'squat', 'hinge', 'isolation'],
  exercise_count: { min: 5, max: 10 },
  special_rules: [
    'SUPERSETS_DEFAULT_FOR_ISOLATION',
    'DROP_SETS_ONLY_ON_LAST_SET',
    'TRI_SETS_SAME_MUSCLE_GROUP',
    'GIANT_SETS_ADVANCED_ONLY',
    'REST_PAUSE_ONLY_ISOLATION',
  ],
};

export const CROSSFIT_RULES: StyleGenerationRules = {
  style_id: 'crossfit',
  display_name: 'CrossFit',
  available_formats: ['straight_sets', 'ascending_sets', 'wave_loading', 'amrap', 'emom', 'rft', 'chipper', 'ladder'],
  primary_format: 'amrap',
  format_selection: [
    { format: 'amrap', weight: 30 },
    { format: 'emom', weight: 25 },
    { format: 'rft', weight: 20 },
    { format: 'chipper', weight: 10, min_fitness_level: 'intermediate' },
    { format: 'ladder', weight: 10, min_fitness_level: 'intermediate' },
    { format: 'straight_sets', weight: 5 },
  ],
  session_architecture_id: 'crossfit',
  rest_overrides: {
    heavy_compound:    { floor: 90,  ceiling: 240, base: 150 },
    moderate_compound: { floor: 60,  ceiling: 180, base: 90  },
    isolation:         { floor: 30,  ceiling: 90,  base: 45  },
    core:              { floor: 20,  ceiling: 60,  base: 30  },
    quick_bodyweight:  { floor: 10,  ceiling: 45,  base: 20  },
  },
  superset_rules: {
    enabled: false,
    default_for_isolation: false,
    never_superset_primaries: true,
    never_superset_heavy_compounds: true,
    min_supersets: 0,
    max_supersets: 0,
    allowed_pairing_types: [],
  },
  progression: {
    beginner: {
      rep_increase_per_week: 1,
      load_increase_percent_per_week: 2.5,
      set_increase_frequency_weeks: 4,
      max_load_increase_lbs_upper: 5,
      max_load_increase_lbs_lower: 10,
      deload_frequency_weeks: 6,
      deload_volume_reduction: 0.40,
    },
    intermediate: {
      rep_increase_per_week: 0,
      load_increase_percent_per_week: 2.0,
      set_increase_frequency_weeks: 3,
      max_load_increase_lbs_upper: 5,
      max_load_increase_lbs_lower: 10,
      deload_frequency_weeks: 5,
      deload_volume_reduction: 0.35,
    },
    advanced: {
      rep_increase_per_week: 0,
      load_increase_percent_per_week: 1.5,
      set_increase_frequency_weeks: 2,
      max_load_increase_lbs_upper: 5,
      max_load_increase_lbs_lower: 5,
      deload_frequency_weeks: 4,
      deload_volume_reduction: 0.30,
    },
  },
  time_math: {
    transition_buffer_seconds: 30,
    distraction_factor: 0.90,
    warmup_time_budget_fraction: 0.0,
    cooldown_time_budget_fraction: 0.0,
    strength_time_budget_fraction: 0.40,
    metcon_time_budget_fraction: 0.55,
  },
  metcon: {
    available_formats: ['amrap', 'emom', 'rft', 'chipper', 'ladder'],
    default_time_cap_minutes: 12,
    min_exercises: 3,
    max_exercises: 6,
    format_selection: [
      { format: 'amrap', weight: 30 },
      { format: 'emom', weight: 25 },
      { format: 'rft', weight: 20 },
      { format: 'chipper', weight: 15, min_fitness_level: 'intermediate' },
      { format: 'ladder', weight: 10, min_fitness_level: 'intermediate' },
    ],
  },
  rep_range: { min: 3, max: 15 },
  set_range: { min: 3, max: 5 },
  compounds_first: true,
  pattern_priority: ['squat', 'push', 'pull', 'hinge', 'plyometric', 'cardio'],
  exercise_count: { min: 5, max: 10 },
  special_rules: [
    'NO_TRADITIONAL_SUPERSETS',
    'STRENGTH_BLOCK_BEFORE_METCON',
    'CHIPPER_MIN_6_EXERCISES',
    'EMOM_ALTERNATING_MOVEMENTS',
    'LADDER_ASCENDING_OR_DESCENDING',
  ],
};

export const HIIT_RULES: StyleGenerationRules = {
  style_id: 'hiit',
  display_name: 'HIIT',
  available_formats: ['tabata', 'circuit', 'emom', 'interval_repeats'],
  primary_format: 'circuit',
  format_selection: [
    { format: 'circuit', weight: 35 },
    { format: 'tabata', weight: 25 },
    { format: 'emom', weight: 20 },
    { format: 'interval_repeats', weight: 20 },
  ],
  session_architecture_id: 'hiit',
  rest_overrides: {
    heavy_compound:    { floor: 45,  ceiling: 120, base: 60  },
    moderate_compound: { floor: 30,  ceiling: 90,  base: 45  },
    isolation:         { floor: 15,  ceiling: 60,  base: 30  },
    core:              { floor: 10,  ceiling: 45,  base: 20  },
    quick_bodyweight:  { floor: 10,  ceiling: 30,  base: 15  },
  },
  superset_rules: {
    enabled: false,
    default_for_isolation: false,
    never_superset_primaries: true,
    never_superset_heavy_compounds: true,
    min_supersets: 0,
    max_supersets: 0,
    allowed_pairing_types: [],
  },
  progression: {
    beginner: {
      rep_increase_per_week: 1,
      load_increase_percent_per_week: 0,
      set_increase_frequency_weeks: 3,
      max_load_increase_lbs_upper: 0,
      max_load_increase_lbs_lower: 0,
      deload_frequency_weeks: 6,
      deload_volume_reduction: 0.35,
    },
    intermediate: {
      rep_increase_per_week: 0,
      load_increase_percent_per_week: 0,
      set_increase_frequency_weeks: 2,
      max_load_increase_lbs_upper: 0,
      max_load_increase_lbs_lower: 0,
      deload_frequency_weeks: 5,
      deload_volume_reduction: 0.30,
    },
    advanced: {
      rep_increase_per_week: 0,
      load_increase_percent_per_week: 0,
      set_increase_frequency_weeks: 2,
      max_load_increase_lbs_upper: 0,
      max_load_increase_lbs_lower: 0,
      deload_frequency_weeks: 4,
      deload_volume_reduction: 0.25,
    },
  },
  time_math: {
    transition_buffer_seconds: 20,
    distraction_factor: 0.90,
    warmup_time_budget_fraction: 0.0,
    cooldown_time_budget_fraction: 0.0,
    max_working_minutes: 30,
    work_rest_ratio: { work: 40, rest: 20 },
  },
  rep_range: { min: 10, max: 20 },
  set_range: { min: 3, max: 5 },
  compounds_first: false,
  pattern_priority: ['plyometric', 'squat', 'push', 'pull', 'cardio'],
  exercise_count: { min: 4, max: 8 },
  special_rules: [
    'NO_TRADITIONAL_SUPERSETS',
    'CIRCUIT_GROUPING_DEFAULT',
    'TABATA_8_ROUNDS_FIXED',
    'MAX_30_MIN_WORKING_TIME',
    'BODYWEIGHT_PREFERRED',
  ],
};

export const HYROX_RULES: StyleGenerationRules = {
  style_id: 'hyrox',
  display_name: 'Hyrox',
  available_formats: ['station_run', 'circuit', 'straight_sets'],
  primary_format: 'station_run',
  format_selection: [
    { format: 'station_run', weight: 80 },
    { format: 'circuit', weight: 15 },
    { format: 'straight_sets', weight: 5 },
  ],
  session_architecture_id: 'hyrox',
  rest_overrides: {
    heavy_compound:    { floor: 30,  ceiling: 90,  base: 45  },
    moderate_compound: { floor: 20,  ceiling: 60,  base: 30  },
    isolation:         { floor: 15,  ceiling: 45,  base: 20  },
    core:              { floor: 10,  ceiling: 30,  base: 15  },
    quick_bodyweight:  { floor: 10,  ceiling: 30,  base: 15  },
  },
  superset_rules: {
    enabled: false,
    default_for_isolation: false,
    never_superset_primaries: true,
    never_superset_heavy_compounds: true,
    min_supersets: 0,
    max_supersets: 0,
    allowed_pairing_types: [],
  },
  progression: {
    beginner: {
      rep_increase_per_week: 2,
      load_increase_percent_per_week: 0,
      set_increase_frequency_weeks: 4,
      max_load_increase_lbs_upper: 0,
      max_load_increase_lbs_lower: 0,
      deload_frequency_weeks: 6,
      deload_volume_reduction: 0.30,
    },
    intermediate: {
      rep_increase_per_week: 1,
      load_increase_percent_per_week: 0,
      set_increase_frequency_weeks: 3,
      max_load_increase_lbs_upper: 0,
      max_load_increase_lbs_lower: 0,
      deload_frequency_weeks: 5,
      deload_volume_reduction: 0.25,
    },
    advanced: {
      rep_increase_per_week: 0,
      load_increase_percent_per_week: 0,
      set_increase_frequency_weeks: 2,
      max_load_increase_lbs_upper: 0,
      max_load_increase_lbs_lower: 0,
      deload_frequency_weeks: 4,
      deload_volume_reduction: 0.20,
    },
  },
  time_math: {
    transition_buffer_seconds: 15,
    distraction_factor: 0.95,
    warmup_time_budget_fraction: 0.0,
    cooldown_time_budget_fraction: 0.0,
    station_time_seconds: 180,
    run_time_seconds: 240,
  },
  rep_range: { min: 8, max: 20 },
  set_range: { min: 1, max: 3 },
  compounds_first: false,
  pattern_priority: ['cardio', 'squat', 'carry', 'push', 'lunge'],
  exercise_count: { min: 6, max: 16 },
  special_rules: [
    'STATION_RUN_ALTERNATING',
    'NO_TRADITIONAL_SUPERSETS',
    'RUN_DISTANCE_SCALES_WITH_DURATION',
    'HYROX_STATION_IDS_PREFERRED',
  ],
};

export const CARDIO_RULES: StyleGenerationRules = {
  style_id: 'cardio',
  display_name: 'Cardio',
  available_formats: ['zone_steady', 'tempo_intervals', 'interval_repeats'],
  primary_format: 'zone_steady',
  format_selection: [
    { format: 'zone_steady', weight: 40 },
    { format: 'tempo_intervals', weight: 35 },
    { format: 'interval_repeats', weight: 25 },
  ],
  session_architecture_id: 'cardio',
  rest_overrides: {
    heavy_compound:    { floor: 30,  ceiling: 90,  base: 45  },
    moderate_compound: { floor: 20,  ceiling: 60,  base: 30  },
    isolation:         { floor: 15,  ceiling: 45,  base: 20  },
    core:              { floor: 10,  ceiling: 30,  base: 15  },
    quick_bodyweight:  { floor: 10,  ceiling: 30,  base: 15  },
  },
  superset_rules: {
    enabled: false,
    default_for_isolation: false,
    never_superset_primaries: true,
    never_superset_heavy_compounds: true,
    min_supersets: 0,
    max_supersets: 0,
    allowed_pairing_types: [],
  },
  progression: {
    beginner: {
      rep_increase_per_week: 0,
      load_increase_percent_per_week: 0,
      set_increase_frequency_weeks: 0,
      max_load_increase_lbs_upper: 0,
      max_load_increase_lbs_lower: 0,
      deload_frequency_weeks: 8,
      deload_volume_reduction: 0.20,
    },
    intermediate: {
      rep_increase_per_week: 0,
      load_increase_percent_per_week: 0,
      set_increase_frequency_weeks: 0,
      max_load_increase_lbs_upper: 0,
      max_load_increase_lbs_lower: 0,
      deload_frequency_weeks: 6,
      deload_volume_reduction: 0.20,
    },
    advanced: {
      rep_increase_per_week: 0,
      load_increase_percent_per_week: 0,
      set_increase_frequency_weeks: 0,
      max_load_increase_lbs_upper: 0,
      max_load_increase_lbs_lower: 0,
      deload_frequency_weeks: 5,
      deload_volume_reduction: 0.15,
    },
  },
  time_math: {
    transition_buffer_seconds: 15,
    distraction_factor: 0.95,
    warmup_time_budget_fraction: 0.0,
    cooldown_time_budget_fraction: 0.0,
  },
  rep_range: { min: 1, max: 1 },
  set_range: { min: 1, max: 3 },
  compounds_first: false,
  pattern_priority: ['cardio'],
  exercise_count: { min: 2, max: 5 },
  special_rules: [
    'DURATION_BASED_NOT_REP_BASED',
    'ZONE_2_DEFAULT_FOR_BEGINNERS',
    'TEMPO_INTERVALS_FOR_INTERMEDIATE',
    'SPRINT_INTERVALS_FOR_ADVANCED',
  ],
};

export const PILATES_RULES: StyleGenerationRules = {
  style_id: 'pilates',
  display_name: 'Pilates',
  available_formats: ['flow_sequence', 'straight_sets', 'hold_sequence'],
  primary_format: 'flow_sequence',
  format_selection: [
    { format: 'flow_sequence', weight: 60 },
    { format: 'straight_sets', weight: 25 },
    { format: 'hold_sequence', weight: 15 },
  ],
  session_architecture_id: 'pilates',
  rest_overrides: {
    heavy_compound:    { floor: 15,  ceiling: 45,  base: 30  },
    moderate_compound: { floor: 10,  ceiling: 30,  base: 20  },
    isolation:         { floor: 10,  ceiling: 30,  base: 15  },
    core:              { floor: 5,   ceiling: 20,  base: 10  },
    quick_bodyweight:  { floor: 5,   ceiling: 15,  base: 10  },
  },
  superset_rules: {
    enabled: false,
    default_for_isolation: false,
    never_superset_primaries: true,
    never_superset_heavy_compounds: true,
    min_supersets: 0,
    max_supersets: 0,
    allowed_pairing_types: [],
  },
  progression: {
    beginner: {
      rep_increase_per_week: 1,
      load_increase_percent_per_week: 0,
      set_increase_frequency_weeks: 4,
      max_load_increase_lbs_upper: 0,
      max_load_increase_lbs_lower: 0,
      deload_frequency_weeks: 8,
      deload_volume_reduction: 0.20,
    },
    intermediate: {
      rep_increase_per_week: 1,
      load_increase_percent_per_week: 0,
      set_increase_frequency_weeks: 3,
      max_load_increase_lbs_upper: 0,
      max_load_increase_lbs_lower: 0,
      deload_frequency_weeks: 6,
      deload_volume_reduction: 0.20,
    },
    advanced: {
      rep_increase_per_week: 0,
      load_increase_percent_per_week: 0,
      set_increase_frequency_weeks: 2,
      max_load_increase_lbs_upper: 0,
      max_load_increase_lbs_lower: 0,
      deload_frequency_weeks: 5,
      deload_volume_reduction: 0.15,
    },
  },
  time_math: {
    transition_buffer_seconds: 10,
    distraction_factor: 0.95,
    warmup_time_budget_fraction: 0.0,
    cooldown_time_budget_fraction: 0.0,
    max_working_minutes: 50,
  },
  rep_range: { min: 8, max: 15 },
  set_range: { min: 2, max: 3 },
  compounds_first: false,
  pattern_priority: ['pilates', 'rotation', 'isolation', 'hinge'],
  exercise_count: { min: 5, max: 10 },
  special_rules: [
    'NO_TRADITIONAL_SUPERSETS',
    'POSITION_FLOW_ORDERING',
    'SUPINE_FIRST_STANDING_LAST',
    'MINIMAL_REST_BETWEEN_EXERCISES',
    'CONTROLLED_TEMPO_REQUIRED',
  ],
};

export const MOBILITY_RULES: StyleGenerationRules = {
  style_id: 'mobility',
  display_name: 'Mobility',
  available_formats: ['hold_sequence', 'flow_sequence', 'straight_sets'],
  primary_format: 'hold_sequence',
  format_selection: [
    { format: 'hold_sequence', weight: 50 },
    { format: 'flow_sequence', weight: 35 },
    { format: 'straight_sets', weight: 15 },
  ],
  session_architecture_id: 'mobility',
  rest_overrides: {
    heavy_compound:    { floor: 10,  ceiling: 30,  base: 15  },
    moderate_compound: { floor: 10,  ceiling: 30,  base: 15  },
    isolation:         { floor: 5,   ceiling: 20,  base: 10  },
    core:              { floor: 5,   ceiling: 15,  base: 10  },
    quick_bodyweight:  { floor: 5,   ceiling: 15,  base: 10  },
  },
  superset_rules: {
    enabled: false,
    default_for_isolation: false,
    never_superset_primaries: true,
    never_superset_heavy_compounds: true,
    min_supersets: 0,
    max_supersets: 0,
    allowed_pairing_types: [],
  },
  progression: {
    beginner: {
      rep_increase_per_week: 0,
      load_increase_percent_per_week: 0,
      set_increase_frequency_weeks: 4,
      max_load_increase_lbs_upper: 0,
      max_load_increase_lbs_lower: 0,
      deload_frequency_weeks: 0,
      deload_volume_reduction: 0,
    },
    intermediate: {
      rep_increase_per_week: 0,
      load_increase_percent_per_week: 0,
      set_increase_frequency_weeks: 3,
      max_load_increase_lbs_upper: 0,
      max_load_increase_lbs_lower: 0,
      deload_frequency_weeks: 0,
      deload_volume_reduction: 0,
    },
    advanced: {
      rep_increase_per_week: 0,
      load_increase_percent_per_week: 0,
      set_increase_frequency_weeks: 2,
      max_load_increase_lbs_upper: 0,
      max_load_increase_lbs_lower: 0,
      deload_frequency_weeks: 0,
      deload_volume_reduction: 0,
    },
  },
  time_math: {
    transition_buffer_seconds: 10,
    distraction_factor: 0.95,
    warmup_time_budget_fraction: 0.0,
    cooldown_time_budget_fraction: 0.0,
    max_working_minutes: 45,
  },
  rep_range: { min: 5, max: 10 },
  set_range: { min: 2, max: 3 },
  compounds_first: false,
  pattern_priority: ['mobility', 'rotation', 'hinge', 'squat'],
  exercise_count: { min: 5, max: 10 },
  special_rules: [
    'NO_TRADITIONAL_SUPERSETS',
    'HOLD_TIMES_NOT_REPS',
    'FLOW_POSITION_ORDERING',
    'UPPER_THEN_SPINE_THEN_LOWER',
    'MINIMAL_TRANSITION',
  ],
};

export const SEVENTY_FIVE_HARD_RULES = {
  style_id: '75_hard',
  display_name: '75 Hard',
  session_count: 2,
  session_duration_minutes: 45,
  session_1: {
    label: 'SESSION 1',
    is_outdoor: false,
    eligible_styles: ['strength', 'bodybuilding', 'hiit', 'crossfit', 'pilates'] as const,
    default_split: 'Full Body',
  },
  session_2: {
    label: 'SESSION 2 — OUTDOORS',
    is_outdoor: true,
    eligible_styles: ['cardio', 'hiit', 'mobility'] as const,
    default_split: 'Full Body',
  },
  muscle_separation: {
    enabled: true,
    strategy: 'minimize_overlap' as const,
    max_overlap_fraction: 0.30,
  },
  style_selection: {
    avoid_same_style: true,
    prefer_complementary: true,
    complementary_pairs: [
      ['strength', 'cardio'],
      ['bodybuilding', 'mobility'],
      ['crossfit', 'cardio'],
      ['hiit', 'mobility'],
      ['pilates', 'cardio'],
    ] as const,
  },
  recovery_items: [
    { name: 'No Alcohol', description: 'No alcohol. No cheat meals. No exceptions.', benefit: 'Mental discipline' },
    { name: 'Progress Photo', description: 'Take your daily progress photo.', benefit: 'Visual accountability' },
    { name: 'Read 10 Pages', description: 'Read 10 pages of a non-fiction book.', benefit: 'Mental growth' },
    { name: 'Drink 1 Gallon Water', description: 'Drink 1 gallon of water throughout the day.', benefit: 'Hydration & recovery' },
  ],
};

export const LOW_IMPACT_RULES: StyleGenerationRules = {
  style_id: 'low_impact',
  display_name: 'Low-Impact',
  available_formats: ['straight_sets', 'supersets', 'ascending_sets', 'descending_sets'],
  primary_format: 'straight_sets',
  format_selection: [
    { format: 'straight_sets', weight: 50 },
    { format: 'supersets', weight: 30 },
    { format: 'ascending_sets', weight: 10 },
    { format: 'descending_sets', weight: 10 },
  ],
  session_architecture_id: 'bodybuilding',
  rest_overrides: {
    heavy_compound:    { floor: 60,  ceiling: 150, base: 90  },
    moderate_compound: { floor: 45,  ceiling: 120, base: 75  },
    isolation:         { floor: 30,  ceiling: 90,  base: 60  },
    core:              { floor: 20,  ceiling: 60,  base: 30  },
    quick_bodyweight:  { floor: 15,  ceiling: 60,  base: 30  },
  },
  superset_rules: {
    enabled: true,
    default_for_isolation: true,
    never_superset_primaries: true,
    never_superset_heavy_compounds: true,
    min_supersets: 1,
    max_supersets: 2,
    allowed_pairing_types: ['antagonist', 'pre_exhaust', 'post_exhaust'],
  },
  progression: {
    beginner: {
      rep_increase_per_week: 1,
      load_increase_percent_per_week: 1.5,
      set_increase_frequency_weeks: 5,
      max_load_increase_lbs_upper: 2.5,
      max_load_increase_lbs_lower: 5,
      deload_frequency_weeks: 6,
      deload_volume_reduction: 0.30,
    },
    intermediate: {
      rep_increase_per_week: 1,
      load_increase_percent_per_week: 1.0,
      set_increase_frequency_weeks: 4,
      max_load_increase_lbs_upper: 2.5,
      max_load_increase_lbs_lower: 5,
      deload_frequency_weeks: 6,
      deload_volume_reduction: 0.30,
    },
    advanced: {
      rep_increase_per_week: 0,
      load_increase_percent_per_week: 0.5,
      set_increase_frequency_weeks: 3,
      max_load_increase_lbs_upper: 2.5,
      max_load_increase_lbs_lower: 5,
      deload_frequency_weeks: 6,
      deload_volume_reduction: 0.25,
    },
  },
  time_math: {
    transition_buffer_seconds: 30,
    distraction_factor: 0.90,
    warmup_time_budget_fraction: 0.0,
    cooldown_time_budget_fraction: 0.0,
  },
  rep_range: { min: 12, max: 20 },
  set_range: { min: 2, max: 4 },
  compounds_first: false,
  pattern_priority: ['isolation', 'push', 'pull', 'hinge', 'squat', 'lunge'],
  exercise_count: { min: 5, max: 8 },
  special_rules: [
    'NO_HEAVY_BARBELL_COMPOUNDS',
    'LIGHT_SPINAL_LOAD_ONLY',
    'MACHINES_AND_CABLES_PREFERRED',
    'BEGINNER_INTERMEDIATE_DIFFICULTY_ONLY',
    'SUPERSETS_DEFAULT_FOR_ISOLATION',
  ],
};

export const HYBRID_RULES: StyleGenerationRules = {
  style_id: 'hybrid',
  display_name: 'Hybrid',
  available_formats: ['straight_sets', 'ascending_sets', 'wave_loading', 'circuit', 'amrap'],
  primary_format: 'straight_sets',
  format_selection: [
    { format: 'straight_sets', weight: 50 },
    { format: 'ascending_sets', weight: 20, min_fitness_level: 'intermediate' },
    { format: 'wave_loading', weight: 15, min_fitness_level: 'advanced' },
    { format: 'circuit', weight: 10 },
    { format: 'amrap', weight: 5, min_fitness_level: 'intermediate' },
  ],
  session_architecture_id: 'strength',
  rest_overrides: {
    heavy_compound:    { floor: 120, ceiling: 300, base: 180 },
    moderate_compound: { floor: 60,  ceiling: 180, base: 90  },
    isolation:         { floor: 30,  ceiling: 60,  base: 45  },
    core:              { floor: 20,  ceiling: 60,  base: 30  },
    quick_bodyweight:  { floor: 15,  ceiling: 45,  base: 30  },
  },
  superset_rules: {
    enabled: false,
    default_for_isolation: false,
    never_superset_primaries: true,
    never_superset_heavy_compounds: true,
    min_supersets: 0,
    max_supersets: 0,
    allowed_pairing_types: [],
  },
  progression: {
    beginner: {
      rep_increase_per_week: 1,
      load_increase_percent_per_week: 2.5,
      set_increase_frequency_weeks: 4,
      max_load_increase_lbs_upper: 5,
      max_load_increase_lbs_lower: 10,
      deload_frequency_weeks: 6,
      deload_volume_reduction: 0.40,
    },
    intermediate: {
      rep_increase_per_week: 0,
      load_increase_percent_per_week: 2.0,
      set_increase_frequency_weeks: 3,
      max_load_increase_lbs_upper: 5,
      max_load_increase_lbs_lower: 10,
      deload_frequency_weeks: 5,
      deload_volume_reduction: 0.35,
    },
    advanced: {
      rep_increase_per_week: 0,
      load_increase_percent_per_week: 1.0,
      set_increase_frequency_weeks: 2,
      max_load_increase_lbs_upper: 2.5,
      max_load_increase_lbs_lower: 5,
      deload_frequency_weeks: 4,
      deload_volume_reduction: 0.30,
    },
  },
  time_math: {
    transition_buffer_seconds: 40,
    distraction_factor: 0.875,
    warmup_time_budget_fraction: 0.0,
    cooldown_time_budget_fraction: 0.0,
    strength_time_budget_fraction: 0.65,
    metcon_time_budget_fraction: 0.35,
  },
  rep_range: { min: 3, max: 20 },
  set_range: { min: 3, max: 5 },
  compounds_first: true,
  pattern_priority: ['squat', 'hinge', 'push', 'pull', 'plyometric', 'isolation'],
  exercise_count: { min: 5, max: 9 },
  special_rules: [
    'TWO_BLOCK_STRUCTURE',
    'STRENGTH_BLOCK_FIRST',
    'CONDITIONING_FINISHER_LAST',
    'HEAVY_COMPOUNDS_IN_STRENGTH_BLOCK',
    'CIRCUITS_IN_CONDITIONING_BLOCK',
  ],
};

export const ALL_STYLE_RULES: Record<string, StyleGenerationRules> = {
  strength: STRENGTH_RULES,
  bodybuilding: BODYBUILDING_RULES,
  crossfit: CROSSFIT_RULES,
  hiit: HIIT_RULES,
  hyrox: HYROX_RULES,
  cardio: CARDIO_RULES,
  pilates: PILATES_RULES,
  mobility: MOBILITY_RULES,
  low_impact: LOW_IMPACT_RULES,
  hybrid: HYBRID_RULES,
};

export function getStyleRules(style: string): StyleGenerationRules {
  return ALL_STYLE_RULES[style] ?? STRENGTH_RULES;
}

export function getRestOverrideForStyle(style: string, tier: RestTier): { floor: number; ceiling: number; base: number } {
  const rules = getStyleRules(style);
  return rules.rest_overrides[tier];
}

export function selectFormatForStyle(
  style: string,
  fitnessLevel: FitnessLevel,
  rng: () => number,
  phaseFormats?: WorkoutFormatId[],
): WorkoutFormatId {
  const rules = getStyleRules(style);

  const levelOrder = FITNESS_LEVELS;
  const levelIdx = levelOrder.indexOf(fitnessLevel);

  let candidates = rules.format_selection.filter(fs => {
    if (fs.min_fitness_level) {
      const minIdx = levelOrder.indexOf(fs.min_fitness_level);
      if (levelIdx < minIdx) return false;
    }
    if (fs.max_fitness_level) {
      const maxIdx = levelOrder.indexOf(fs.max_fitness_level);
      if (levelIdx > maxIdx) return false;
    }
    if (phaseFormats && phaseFormats.length > 0) {
      if (!phaseFormats.includes(fs.format)) return false;
    }
    return true;
  });

  if (candidates.length === 0) {
    candidates = [{ format: rules.primary_format, weight: 100 }];
  }

  const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
  let roll = rng() * totalWeight;

  for (const candidate of candidates) {
    roll -= candidate.weight;
    if (roll <= 0) {
      return candidate.format;
    }
  }

  return candidates[candidates.length - 1].format;
}

export function selectMetconFormat(
  fitnessLevel: FitnessLevel,
  rng: () => number,
): WorkoutFormatId {
  const metcon = CROSSFIT_RULES.metcon!;
  return selectFormatForStyle('crossfit', fitnessLevel, rng, metcon.available_formats);
}

export function calculateStyleRestSeconds(
  style: string,
  tier: RestTier,
  sliderMultiplier: number,
): number {
  const override = getRestOverrideForStyle(style, tier);
  const rawRest = override.base * sliderMultiplier;
  const clamped = Math.max(override.floor, Math.min(override.ceiling, rawRest));
  return Math.round(clamped / 5) * 5;
}

export function getExerciseCountForPhase(
  phaseMin: number,
  phaseMax: number,
  fitnessLevel: FitnessLevel,
  rng: () => number,
): number {
  let bias = 0;
  if (fitnessLevel === 'beginner') bias = -0.3;
  else if (fitnessLevel === 'advanced') bias = 0.3;

  const range = phaseMax - phaseMin;
  const raw = phaseMin + Math.round((rng() + bias) * range);
  return Math.max(phaseMin, Math.min(phaseMax, raw));
}

export function shouldApplyDropSets(
  style: string,
  fitnessLevel: FitnessLevel,
  role: string,
  isLastExercise: boolean,
): boolean {
  if (style !== 'bodybuilding') return false;
  if (fitnessLevel === 'beginner') return false;
  if (role === 'primary') return false;
  if (!isLastExercise) return false;
  return true;
}

export function getDropSetParams(
  baseLbs: number,
): { drops: number; percentages: number[] } {
  const drops = 2;
  const percentages = [0.80, 0.60];
  return {
    drops,
    percentages: percentages.map(p => Math.round(baseLbs * p / 5) * 5),
  };
}

export function getWaveLoadingPattern(
  baseLbs: number,
  waves: number,
): { sets: { reps: number; loadLbs: number }[] } {
  const sets: { reps: number; loadLbs: number }[] = [];
  for (let w = 0; w < waves; w++) {
    const waveOffset = w * 0.05;
    sets.push({ reps: 3, loadLbs: Math.round((baseLbs * (0.85 + waveOffset)) / 5) * 5 });
    sets.push({ reps: 2, loadLbs: Math.round((baseLbs * (0.90 + waveOffset)) / 5) * 5 });
    sets.push({ reps: 1, loadLbs: Math.round((baseLbs * (0.95 + waveOffset)) / 5) * 5 });
  }
  return { sets };
}

export function getClusterSetParams(
  baseLbs: number,
  clusters: number,
): { reps_per_cluster: number; rest_between_clusters_seconds: number; loadLbs: number; total_clusters: number } {
  return {
    reps_per_cluster: 2,
    rest_between_clusters_seconds: 25,
    loadLbs: Math.round((baseLbs * 0.90) / 5) * 5,
    total_clusters: clusters,
  };
}

export function getTabataParams(): {
  rounds: number;
  work_seconds: number;
  rest_seconds: number;
  total_time_seconds: number;
} {
  return {
    rounds: 8,
    work_seconds: 20,
    rest_seconds: 10,
    total_time_seconds: 240,
  };
}

export function getAMRAPParams(
  timeBudgetMinutes: number,
  fitnessLevel: FitnessLevel,
): { time_cap_minutes: number; target_exercises: number } {
  // AMRAP: 15-35 minute range — scales with session duration
  const cap = Math.min(35, Math.max(15, timeBudgetMinutes));
  const target = fitnessLevel === 'beginner' ? 4
    : fitnessLevel === 'intermediate' ? 5
    : 6;
  return { time_cap_minutes: cap, target_exercises: target };
}

export function getEMOMParams(
  timeBudgetMinutes: number,
  fitnessLevel: FitnessLevel,
): { total_minutes: number; exercises_per_rotation: number } {
  // EMOM: duration MUST be a multiple of exercise count.
  // Each rotation = 1 minute per exercise. Total = exercises × rounds.
  // Target 4-6 exercises, 16-35 minute range.
  const exercises = fitnessLevel === 'beginner' ? 4
    : fitnessLevel === 'intermediate' ? 5
    : 6;
  // Snap total minutes to nearest multiple of exercise count within 16-35 range
  const minRounds = Math.ceil(16 / exercises);
  const maxRounds = Math.floor(35 / exercises);
  const budgetRounds = Math.round(timeBudgetMinutes / exercises);
  const rounds = Math.max(minRounds, Math.min(maxRounds, budgetRounds));
  const total = exercises * rounds;
  return { total_minutes: total, exercises_per_rotation: exercises };
}

export function getRFTParams(
  fitnessLevel: FitnessLevel,
  rng: () => number,
  timeBudgetMinutes?: number,
): { rounds: number; time_cap_minutes: number } {
  const baseRounds = fitnessLevel === 'beginner' ? 3
    : fitnessLevel === 'intermediate' ? 4
    : 5;
  const rounds = baseRounds + Math.floor(rng() * 2);
  // Scale time cap with the session's metcon budget (clamp to sane RFT range 12–35 min)
  const cap = timeBudgetMinutes != null
    ? Math.max(12, Math.min(35, timeBudgetMinutes))
    : 20;
  return { rounds, time_cap_minutes: cap };
}

export function getChipperParams(
  fitnessLevel: FitnessLevel,
): { min_exercises: number; max_exercises: number; min_reps: number; max_reps: number; min_time_cap: number; max_time_cap: number } {
  // Chipper: one pass through a long list; reps are high since each movement is done only once
  if (fitnessLevel === 'beginner') return { min_exercises: 5, max_exercises: 7, min_reps: 10, max_reps: 20, min_time_cap: 12, max_time_cap: 22 };
  if (fitnessLevel === 'intermediate') return { min_exercises: 6, max_exercises: 8, min_reps: 15, max_reps: 30, min_time_cap: 15, max_time_cap: 30 };
  return { min_exercises: 7, max_exercises: 10, min_reps: 20, max_reps: 50, min_time_cap: 18, max_time_cap: 40 };
}

export function getLadderParams(
  fitnessLevel: FitnessLevel,
  rng: () => number,
): { direction: 'ascending' | 'descending'; start_reps: number; end_reps: number; exercises: number } {
  const ascending = rng() > 0.5;
  if (fitnessLevel === 'beginner') {
    return ascending
      ? { direction: 'ascending', start_reps: 1, end_reps: 10, exercises: 2 }
      : { direction: 'descending', start_reps: 10, end_reps: 1, exercises: 2 };
  }
  if (fitnessLevel === 'intermediate') {
    return ascending
      ? { direction: 'ascending', start_reps: 2, end_reps: 15, exercises: 3 }
      : { direction: 'descending', start_reps: 15, end_reps: 2, exercises: 3 };
  }
  return ascending
    ? { direction: 'ascending', start_reps: 3, end_reps: 21, exercises: 3 }
    : { direction: 'descending', start_reps: 21, end_reps: 3, exercises: 3 };
}

export function getHyroxRunDistance(targetDurationMinutes: number): number {
  if (targetDurationMinutes >= 75) return 1000;
  if (targetDurationMinutes >= 60) return 800;
  if (targetDurationMinutes >= 45) return 400;
  return 200;
}

export function getHyroxStationCount(targetDurationMinutes: number): number {
  return Math.max(4, Math.min(8, Math.floor(targetDurationMinutes / 8)));
}

export const HYROX_STATION_IDS = [
  'ski_erg', 'sled_push', 'sled_pull', 'burpee_broad_jump',
  'rowing_machine', 'farmers_carry', 'sandbag_lunge', 'wall_ball',
] as const;

export function getCardioFormatForLevel(fitnessLevel: FitnessLevel): WorkoutFormatId {
  if (fitnessLevel === 'beginner') return 'zone_steady';
  if (fitnessLevel === 'intermediate') return 'tempo_intervals';
  return 'interval_repeats';
}

export function getPilatesPositionOrder(): string[] {
  return ['supine', 'prone', 'seated', 'side_lying', 'kneeling', 'quadruped', 'standing'];
}

export function getMobilityRegionOrder(): string[] {
  return ['upper_body', 'spine_core', 'hip_lower', 'full_body_integration'];
}
