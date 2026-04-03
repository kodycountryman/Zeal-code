import type { ExerciseRole } from '@/services/engineConstants';

console.log('[StyleFormats] Shared format definitions loaded');

export type WorkoutFormatId =
  | 'straight_sets'
  | 'supersets'
  | 'tri_sets'
  | 'giant_sets'
  | 'drop_sets'
  | 'rest_pause'
  | 'ascending_sets'
  | 'descending_sets'
  | 'wave_loading'
  | 'cluster_sets'
  | 'pyramid'
  | 'amrap'
  | 'emom'
  | 'tabata'
  | 'rft'
  | 'chipper'
  | 'ladder'
  | 'circuit'
  | 'station_run'
  | 'flow_sequence'
  | 'hold_sequence'
  | 'zone_steady'
  | 'tempo_intervals'
  | 'interval_repeats';

export interface FormatRepScheme {
  min_reps: number;
  max_reps: number;
  fixed_reps?: number;
}

export interface FormatSetScheme {
  min_sets: number;
  max_sets: number;
  fixed_sets?: number;
}

export interface FormatRestScheme {
  between_sets_seconds: number;
  between_exercises_seconds: number;
  work_rest_ratio?: { work: number; rest: number };
}

export interface FormatTimeCap {
  has_time_cap: boolean;
  default_cap_minutes?: number;
  min_cap_minutes?: number;
  max_cap_minutes?: number;
}

export interface WorkoutFormat {
  id: WorkoutFormatId;
  name: string;
  description: string;
  rep_scheme: FormatRepScheme;
  set_scheme: FormatSetScheme;
  rest_scheme: FormatRestScheme;
  time_cap: FormatTimeCap;
  supports_load: boolean;
  supports_rounds: boolean;
  round_range?: { min: number; max: number };
  group_type: 'superset' | 'circuit' | 'rounds' | null;
  exercises_per_group: { min: number; max: number };
  weight_progression: 'constant' | 'ascending' | 'descending' | 'wave' | 'drop' | 'none';
  rest_between_drops_seconds?: number;
  drop_percentage?: { min: number; max: number };
}

export const FORMAT_DEFINITIONS: Record<WorkoutFormatId, WorkoutFormat> = {
  straight_sets: {
    id: 'straight_sets',
    name: 'Straight Sets',
    description: 'All sets of one exercise before moving to the next. Same weight and reps across sets.',
    rep_scheme: { min_reps: 1, max_reps: 30 },
    set_scheme: { min_sets: 2, max_sets: 6 },
    rest_scheme: { between_sets_seconds: 90, between_exercises_seconds: 120 },
    time_cap: { has_time_cap: false },
    supports_load: true,
    supports_rounds: false,
    group_type: null,
    exercises_per_group: { min: 1, max: 1 },
    weight_progression: 'constant',
  },

  supersets: {
    id: 'supersets',
    name: 'Supersets',
    description: 'Two exercises back-to-back with no rest between. Rest after both exercises.',
    rep_scheme: { min_reps: 6, max_reps: 15 },
    set_scheme: { min_sets: 3, max_sets: 4 },
    rest_scheme: { between_sets_seconds: 0, between_exercises_seconds: 90 },
    time_cap: { has_time_cap: false },
    supports_load: true,
    supports_rounds: false,
    group_type: 'superset',
    exercises_per_group: { min: 2, max: 2 },
    weight_progression: 'constant',
  },

  tri_sets: {
    id: 'tri_sets',
    name: 'Tri-Sets',
    description: 'Three exercises back-to-back with no rest between. Rest after all three.',
    rep_scheme: { min_reps: 8, max_reps: 15 },
    set_scheme: { min_sets: 3, max_sets: 4 },
    rest_scheme: { between_sets_seconds: 0, between_exercises_seconds: 120 },
    time_cap: { has_time_cap: false },
    supports_load: true,
    supports_rounds: false,
    group_type: 'superset',
    exercises_per_group: { min: 3, max: 3 },
    weight_progression: 'constant',
  },

  giant_sets: {
    id: 'giant_sets',
    name: 'Giant Sets',
    description: 'Four exercises back-to-back with no rest between. Rest after all four.',
    rep_scheme: { min_reps: 8, max_reps: 15 },
    set_scheme: { min_sets: 3, max_sets: 4 },
    rest_scheme: { between_sets_seconds: 0, between_exercises_seconds: 150 },
    time_cap: { has_time_cap: false },
    supports_load: true,
    supports_rounds: false,
    group_type: 'superset',
    exercises_per_group: { min: 4, max: 4 },
    weight_progression: 'constant',
  },

  drop_sets: {
    id: 'drop_sets',
    name: 'Drop Sets',
    description: 'Perform to near-failure, reduce weight 10-25%, continue reps. Repeat 1-3 drops.',
    rep_scheme: { min_reps: 8, max_reps: 15 },
    set_scheme: { min_sets: 1, max_sets: 3 },
    rest_scheme: { between_sets_seconds: 0, between_exercises_seconds: 120 },
    time_cap: { has_time_cap: false },
    supports_load: true,
    supports_rounds: false,
    group_type: null,
    exercises_per_group: { min: 1, max: 1 },
    weight_progression: 'drop',
    rest_between_drops_seconds: 0,
    drop_percentage: { min: 10, max: 25 },
  },

  rest_pause: {
    id: 'rest_pause',
    name: 'Rest-Pause',
    description: 'Reps to near-failure, rest 15-30s, additional reps. Typically 2-3 mini-sets.',
    rep_scheme: { min_reps: 6, max_reps: 12 },
    set_scheme: { min_sets: 2, max_sets: 3 },
    rest_scheme: { between_sets_seconds: 20, between_exercises_seconds: 120 },
    time_cap: { has_time_cap: false },
    supports_load: true,
    supports_rounds: false,
    group_type: null,
    exercises_per_group: { min: 1, max: 1 },
    weight_progression: 'constant',
  },

  ascending_sets: {
    id: 'ascending_sets',
    name: 'Ascending Sets (Ramp-Up)',
    description: 'Weight increases each set while reps stay the same or decrease.',
    rep_scheme: { min_reps: 3, max_reps: 8 },
    set_scheme: { min_sets: 3, max_sets: 5 },
    rest_scheme: { between_sets_seconds: 120, between_exercises_seconds: 150 },
    time_cap: { has_time_cap: false },
    supports_load: true,
    supports_rounds: false,
    group_type: null,
    exercises_per_group: { min: 1, max: 1 },
    weight_progression: 'ascending',
  },

  descending_sets: {
    id: 'descending_sets',
    name: 'Descending Sets',
    description: 'Weight decreases each set while reps increase.',
    rep_scheme: { min_reps: 5, max_reps: 15 },
    set_scheme: { min_sets: 3, max_sets: 5 },
    rest_scheme: { between_sets_seconds: 90, between_exercises_seconds: 120 },
    time_cap: { has_time_cap: false },
    supports_load: true,
    supports_rounds: false,
    group_type: null,
    exercises_per_group: { min: 1, max: 1 },
    weight_progression: 'descending',
  },

  wave_loading: {
    id: 'wave_loading',
    name: 'Wave Loading',
    description: 'Alternating heavy/light sets in waves. E.g., 3/2/1 then 3/2/1 at higher weight.',
    rep_scheme: { min_reps: 1, max_reps: 5 },
    set_scheme: { min_sets: 6, max_sets: 9 },
    rest_scheme: { between_sets_seconds: 150, between_exercises_seconds: 180 },
    time_cap: { has_time_cap: false },
    supports_load: true,
    supports_rounds: false,
    group_type: null,
    exercises_per_group: { min: 1, max: 1 },
    weight_progression: 'wave',
  },

  cluster_sets: {
    id: 'cluster_sets',
    name: 'Cluster Sets',
    description: 'Break a heavy set into mini-sets of 2-3 reps with 15-30s intra-set rest.',
    rep_scheme: { min_reps: 2, max_reps: 3 },
    set_scheme: { min_sets: 4, max_sets: 6 },
    rest_scheme: { between_sets_seconds: 25, between_exercises_seconds: 180 },
    time_cap: { has_time_cap: false },
    supports_load: true,
    supports_rounds: false,
    group_type: null,
    exercises_per_group: { min: 1, max: 1 },
    weight_progression: 'constant',
  },

  pyramid: {
    id: 'pyramid',
    name: 'Pyramid',
    description: 'Weight increases then decreases across sets (ascending then descending).',
    rep_scheme: { min_reps: 2, max_reps: 12 },
    set_scheme: { min_sets: 5, max_sets: 7 },
    rest_scheme: { between_sets_seconds: 120, between_exercises_seconds: 150 },
    time_cap: { has_time_cap: false },
    supports_load: true,
    supports_rounds: false,
    group_type: null,
    exercises_per_group: { min: 1, max: 1 },
    weight_progression: 'wave',
  },

  amrap: {
    id: 'amrap',
    name: 'AMRAP',
    description: 'As Many Rounds/Reps As Possible within a time cap.',
    rep_scheme: { min_reps: 5, max_reps: 20 },
    set_scheme: { fixed_sets: 1, min_sets: 1, max_sets: 1 },
    rest_scheme: { between_sets_seconds: 0, between_exercises_seconds: 0 },
    time_cap: { has_time_cap: true, default_cap_minutes: 12, min_cap_minutes: 6, max_cap_minutes: 20 },
    supports_load: true,
    supports_rounds: false,
    group_type: 'circuit',
    exercises_per_group: { min: 3, max: 6 },
    weight_progression: 'constant',
  },

  emom: {
    id: 'emom',
    name: 'EMOM',
    description: 'Every Minute On the Minute. Perform prescribed reps at the start of each minute.',
    rep_scheme: { min_reps: 5, max_reps: 15 },
    set_scheme: { fixed_sets: 1, min_sets: 1, max_sets: 1 },
    rest_scheme: { between_sets_seconds: 0, between_exercises_seconds: 0, work_rest_ratio: { work: 40, rest: 20 } },
    time_cap: { has_time_cap: true, default_cap_minutes: 12, min_cap_minutes: 8, max_cap_minutes: 20 },
    supports_load: true,
    supports_rounds: true,
    round_range: { min: 8, max: 20 },
    group_type: 'circuit',
    exercises_per_group: { min: 2, max: 4 },
    weight_progression: 'constant',
  },

  tabata: {
    id: 'tabata',
    name: 'Tabata',
    description: '20 seconds work, 10 seconds rest, 8 rounds per exercise.',
    rep_scheme: { min_reps: 1, max_reps: 1 },
    set_scheme: { fixed_sets: 8, min_sets: 8, max_sets: 8 },
    rest_scheme: { between_sets_seconds: 10, between_exercises_seconds: 60, work_rest_ratio: { work: 20, rest: 10 } },
    time_cap: { has_time_cap: true, default_cap_minutes: 4, min_cap_minutes: 4, max_cap_minutes: 4 },
    supports_load: false,
    supports_rounds: true,
    round_range: { min: 8, max: 8 },
    group_type: 'circuit',
    exercises_per_group: { min: 1, max: 8 },
    weight_progression: 'none',
  },

  rft: {
    id: 'rft',
    name: 'RFT (Rounds For Time)',
    description: 'Complete prescribed rounds of exercises as fast as possible.',
    rep_scheme: { min_reps: 5, max_reps: 21 },
    set_scheme: { fixed_sets: 1, min_sets: 1, max_sets: 1 },
    rest_scheme: { between_sets_seconds: 0, between_exercises_seconds: 0 },
    time_cap: { has_time_cap: true, default_cap_minutes: 15, min_cap_minutes: 8, max_cap_minutes: 25 },
    supports_load: true,
    supports_rounds: true,
    round_range: { min: 3, max: 5 },
    group_type: 'rounds',
    exercises_per_group: { min: 3, max: 6 },
    weight_progression: 'constant',
  },

  chipper: {
    id: 'chipper',
    name: 'Chipper',
    description: 'Long list of exercises performed once through, chipping away at each.',
    rep_scheme: { min_reps: 10, max_reps: 50 },
    set_scheme: { fixed_sets: 1, min_sets: 1, max_sets: 1 },
    rest_scheme: { between_sets_seconds: 0, between_exercises_seconds: 0 },
    time_cap: { has_time_cap: true, default_cap_minutes: 20, min_cap_minutes: 12, max_cap_minutes: 30 },
    supports_load: true,
    supports_rounds: false,
    group_type: 'circuit',
    exercises_per_group: { min: 6, max: 10 },
    weight_progression: 'constant',
  },

  ladder: {
    id: 'ladder',
    name: 'Ladder',
    description: 'Reps increase or decrease each round (e.g., 1-2-3-4-5 or 10-9-8-7...).',
    rep_scheme: { min_reps: 1, max_reps: 21 },
    set_scheme: { fixed_sets: 1, min_sets: 1, max_sets: 1 },
    rest_scheme: { between_sets_seconds: 0, between_exercises_seconds: 0 },
    time_cap: { has_time_cap: true, default_cap_minutes: 15, min_cap_minutes: 8, max_cap_minutes: 20 },
    supports_load: true,
    supports_rounds: true,
    round_range: { min: 5, max: 10 },
    group_type: 'circuit',
    exercises_per_group: { min: 2, max: 4 },
    weight_progression: 'constant',
  },

  circuit: {
    id: 'circuit',
    name: 'Circuit',
    description: 'Move through exercises in sequence with minimal rest. Repeat for rounds.',
    rep_scheme: { min_reps: 10, max_reps: 20 },
    set_scheme: { min_sets: 3, max_sets: 5 },
    rest_scheme: { between_sets_seconds: 15, between_exercises_seconds: 60, work_rest_ratio: { work: 40, rest: 20 } },
    time_cap: { has_time_cap: false },
    supports_load: false,
    supports_rounds: true,
    round_range: { min: 3, max: 5 },
    group_type: 'circuit',
    exercises_per_group: { min: 4, max: 8 },
    weight_progression: 'none',
  },

  station_run: {
    id: 'station_run',
    name: 'Station-Run-Station',
    description: 'Alternating running segments with exercise stations. Hyrox race format.',
    rep_scheme: { min_reps: 10, max_reps: 30 },
    set_scheme: { fixed_sets: 1, min_sets: 1, max_sets: 1 },
    rest_scheme: { between_sets_seconds: 0, between_exercises_seconds: 30 },
    time_cap: { has_time_cap: false },
    supports_load: true,
    supports_rounds: true,
    round_range: { min: 4, max: 8 },
    group_type: 'rounds',
    exercises_per_group: { min: 2, max: 2 },
    weight_progression: 'constant',
  },

  flow_sequence: {
    id: 'flow_sequence',
    name: 'Flow Sequence',
    description: 'Exercises performed in a specific positional flow with minimal transition.',
    rep_scheme: { min_reps: 5, max_reps: 15 },
    set_scheme: { min_sets: 2, max_sets: 3 },
    rest_scheme: { between_sets_seconds: 15, between_exercises_seconds: 30 },
    time_cap: { has_time_cap: false },
    supports_load: false,
    supports_rounds: false,
    group_type: null,
    exercises_per_group: { min: 1, max: 1 },
    weight_progression: 'none',
  },

  hold_sequence: {
    id: 'hold_sequence',
    name: 'Hold Sequence',
    description: 'Exercises held for time rather than counted reps. Used in mobility and stretching.',
    rep_scheme: { min_reps: 1, max_reps: 3 },
    set_scheme: { min_sets: 2, max_sets: 3 },
    rest_scheme: { between_sets_seconds: 10, between_exercises_seconds: 15 },
    time_cap: { has_time_cap: false },
    supports_load: false,
    supports_rounds: false,
    group_type: null,
    exercises_per_group: { min: 1, max: 1 },
    weight_progression: 'none',
  },

  zone_steady: {
    id: 'zone_steady',
    name: 'Zone Steady State',
    description: 'Continuous effort at a target heart rate zone. Used for cardio sessions.',
    rep_scheme: { min_reps: 1, max_reps: 1 },
    set_scheme: { fixed_sets: 1, min_sets: 1, max_sets: 1 },
    rest_scheme: { between_sets_seconds: 0, between_exercises_seconds: 120 },
    time_cap: { has_time_cap: false },
    supports_load: false,
    supports_rounds: false,
    group_type: null,
    exercises_per_group: { min: 1, max: 3 },
    weight_progression: 'none',
  },

  tempo_intervals: {
    id: 'tempo_intervals',
    name: 'Tempo Intervals',
    description: 'Alternating between tempo pace and recovery pace.',
    rep_scheme: { min_reps: 1, max_reps: 1 },
    set_scheme: { min_sets: 4, max_sets: 10 },
    rest_scheme: { between_sets_seconds: 60, between_exercises_seconds: 120, work_rest_ratio: { work: 60, rest: 60 } },
    time_cap: { has_time_cap: false },
    supports_load: false,
    supports_rounds: true,
    round_range: { min: 4, max: 10 },
    group_type: null,
    exercises_per_group: { min: 1, max: 2 },
    weight_progression: 'none',
  },

  interval_repeats: {
    id: 'interval_repeats',
    name: 'Interval Repeats',
    description: 'High-intensity intervals with prescribed rest. Used in HIIT and cardio.',
    rep_scheme: { min_reps: 1, max_reps: 1 },
    set_scheme: { min_sets: 6, max_sets: 12 },
    rest_scheme: { between_sets_seconds: 30, between_exercises_seconds: 60, work_rest_ratio: { work: 30, rest: 30 } },
    time_cap: { has_time_cap: false },
    supports_load: false,
    supports_rounds: true,
    round_range: { min: 6, max: 12 },
    group_type: 'circuit',
    exercises_per_group: { min: 3, max: 6 },
    weight_progression: 'none',
  },
};

export type SessionPhaseId =
  | 'warmup'
  | 'activation'
  | 'primary_compound'
  | 'secondary_compound'
  | 'accessories'
  | 'core'
  | 'finisher'
  | 'metcon'
  | 'strength_block'
  | 'station_block'
  | 'supine_series'
  | 'seated_prone'
  | 'side_lying'
  | 'kneeling'
  | 'standing_balance'
  | 'upper_flow'
  | 'lower_flow'
  | 'spine_flow'
  | 'hip_flow'
  | 'cooldown'
  | 'cardio_main'
  | 'circuit_block'
  | 'tabata_block'
  | 'emom_block'
  | 'run_segment'
  | 'station_segment'
  | 'conditioning_block';

export interface SessionPhase {
  id: SessionPhaseId;
  name: string;
  exercise_count: { min: number; max: number };
  role_filter: ExerciseRole[];
  preferred_formats: WorkoutFormatId[];
  time_budget_fraction: number;
  muscle_filter?: string[];
  movement_filter?: string[];
  position_filter?: string[];
  is_compound_only?: boolean;
  is_isolation_only?: boolean;
}

export interface SessionArchitecture {
  phases: SessionPhase[];
  total_phase_fraction: number;
}

export const STRENGTH_ARCHITECTURE: SessionArchitecture = {
  phases: [
    {
      id: 'primary_compound',
      name: 'Primary Compound',
      exercise_count: { min: 1, max: 2 },
      role_filter: ['primary'],
      preferred_formats: ['straight_sets', 'wave_loading', 'cluster_sets', 'ascending_sets'],
      time_budget_fraction: 0.35,
      is_compound_only: true,
    },
    {
      id: 'secondary_compound',
      name: 'Secondary Compound',
      exercise_count: { min: 1, max: 2 },
      role_filter: ['secondary'],
      preferred_formats: ['straight_sets', 'ascending_sets'],
      time_budget_fraction: 0.25,
      is_compound_only: true,
    },
    {
      id: 'accessories',
      name: 'Accessories',
      exercise_count: { min: 1, max: 3 },
      role_filter: ['accessory'],
      preferred_formats: ['straight_sets', 'supersets'],
      time_budget_fraction: 0.25,
      is_isolation_only: true,
    },
    {
      id: 'core',
      name: 'Core',
      exercise_count: { min: 1, max: 2 },
      role_filter: ['accessory'],
      preferred_formats: ['straight_sets', 'supersets'],
      time_budget_fraction: 0.15,
      muscle_filter: ['core', 'obliques', 'transverse_abdominis'],
    },
  ],
  total_phase_fraction: 1.0,
};

export const BODYBUILDING_ARCHITECTURE: SessionArchitecture = {
  phases: [
    {
      id: 'primary_compound',
      name: 'Primary Compound',
      exercise_count: { min: 1, max: 2 },
      role_filter: ['primary'],
      preferred_formats: ['straight_sets', 'ascending_sets'],
      time_budget_fraction: 0.25,
      is_compound_only: true,
    },
    {
      id: 'secondary_compound',
      name: 'Secondary Compound',
      exercise_count: { min: 1, max: 2 },
      role_filter: ['secondary'],
      preferred_formats: ['straight_sets', 'supersets'],
      time_budget_fraction: 0.20,
    },
    {
      id: 'accessories',
      name: 'Isolation Work',
      exercise_count: { min: 2, max: 4 },
      role_filter: ['accessory'],
      preferred_formats: ['supersets', 'drop_sets', 'tri_sets', 'giant_sets'],
      time_budget_fraction: 0.35,
      is_isolation_only: true,
    },
    {
      id: 'finisher',
      name: 'Finisher',
      exercise_count: { min: 1, max: 2 },
      role_filter: ['accessory'],
      preferred_formats: ['drop_sets', 'rest_pause', 'supersets'],
      time_budget_fraction: 0.10,
    },
    {
      id: 'core',
      name: 'Core',
      exercise_count: { min: 1, max: 2 },
      role_filter: ['accessory'],
      preferred_formats: ['supersets', 'straight_sets'],
      time_budget_fraction: 0.10,
      muscle_filter: ['core', 'obliques', 'transverse_abdominis'],
    },
  ],
  total_phase_fraction: 1.0,
};

export const CROSSFIT_ARCHITECTURE: SessionArchitecture = {
  phases: [
    {
      id: 'strength_block',
      name: 'Strength',
      exercise_count: { min: 1, max: 3 },
      role_filter: ['primary', 'secondary'],
      preferred_formats: ['straight_sets', 'ascending_sets', 'wave_loading'],
      time_budget_fraction: 0.40,
      is_compound_only: true,
      // Exclude cardio/plyometric — CrossFit strength block is traditional barbell/gymnastics strength work
      movement_filter: ['push', 'pull', 'squat', 'hinge', 'lunge', 'carry'],
    },
    {
      id: 'metcon',
      name: 'MetCon',
      // Wider range: Chippers need 7–10, AMRAP/EMOM/RFT work well with 4–6
      exercise_count: { min: 4, max: 8 },
      role_filter: ['primary', 'secondary', 'accessory'],
      preferred_formats: ['amrap', 'emom', 'rft', 'chipper', 'ladder'],
      time_budget_fraction: 0.55,
    },
    {
      id: 'core',
      name: 'Core',
      exercise_count: { min: 0, max: 1 },
      role_filter: ['accessory'],
      preferred_formats: ['straight_sets'],
      time_budget_fraction: 0.05,
      muscle_filter: ['core', 'obliques'],
    },
  ],
  total_phase_fraction: 1.0,
};

export const HIIT_ARCHITECTURE: SessionArchitecture = {
  phases: [
    {
      id: 'circuit_block',
      name: 'Circuit',
      exercise_count: { min: 6, max: 10 },
      role_filter: ['primary', 'secondary', 'accessory'],
      preferred_formats: ['circuit', 'emom', 'interval_repeats', 'tabata'],
      time_budget_fraction: 0.85,
    },
    {
      id: 'finisher',
      name: 'Finisher',
      exercise_count: { min: 1, max: 2 },
      role_filter: ['accessory'],
      preferred_formats: ['tabata', 'interval_repeats'],
      time_budget_fraction: 0.15,
    },
  ],
  total_phase_fraction: 1.0,
};

export const HYROX_ARCHITECTURE: SessionArchitecture = {
  phases: [
    {
      id: 'station_block',
      name: 'Station-Run Pairs',
      exercise_count: { min: 4, max: 8 },
      role_filter: ['primary', 'secondary', 'accessory'],
      preferred_formats: ['station_run'],
      time_budget_fraction: 1.0,
    },
  ],
  total_phase_fraction: 1.0,
};

export const CARDIO_ARCHITECTURE: SessionArchitecture = {
  phases: [
    {
      id: 'cardio_main',
      name: 'Main Cardio',
      exercise_count: { min: 1, max: 3 },
      role_filter: ['primary', 'secondary', 'accessory'],
      preferred_formats: ['zone_steady', 'tempo_intervals', 'interval_repeats'],
      time_budget_fraction: 1.0,
      movement_filter: ['cardio'],
    },
  ],
  total_phase_fraction: 1.0,
};

export const PILATES_ARCHITECTURE: SessionArchitecture = {
  phases: [
    {
      id: 'supine_series',
      name: 'Supine Series',
      exercise_count: { min: 2, max: 3 },
      role_filter: ['primary', 'secondary', 'accessory'],
      preferred_formats: ['flow_sequence'],
      time_budget_fraction: 0.25,
      position_filter: ['supine'],
    },
    {
      id: 'seated_prone',
      name: 'Seated / Prone',
      exercise_count: { min: 2, max: 3 },
      role_filter: ['primary', 'secondary', 'accessory'],
      preferred_formats: ['flow_sequence'],
      time_budget_fraction: 0.25,
      position_filter: ['seated', 'prone'],
    },
    {
      id: 'side_lying',
      name: 'Side-Lying',
      exercise_count: { min: 1, max: 2 },
      role_filter: ['accessory'],
      preferred_formats: ['flow_sequence'],
      time_budget_fraction: 0.20,
      position_filter: ['side_lying'],
    },
    {
      id: 'kneeling',
      name: 'Kneeling / Standing',
      exercise_count: { min: 1, max: 2 },
      role_filter: ['accessory'],
      preferred_formats: ['flow_sequence'],
      time_budget_fraction: 0.15,
      position_filter: ['kneeling', 'standing'],
    },
    {
      id: 'cooldown',
      name: 'Cooldown Flow',
      exercise_count: { min: 1, max: 2 },
      role_filter: ['accessory'],
      preferred_formats: ['flow_sequence', 'hold_sequence'],
      time_budget_fraction: 0.15,
    },
  ],
  total_phase_fraction: 1.0,
};

export const MOBILITY_ARCHITECTURE: SessionArchitecture = {
  phases: [
    {
      id: 'upper_flow',
      name: 'Upper Body Flow',
      exercise_count: { min: 2, max: 3 },
      role_filter: ['primary', 'secondary', 'accessory'],
      preferred_formats: ['hold_sequence', 'flow_sequence'],
      time_budget_fraction: 0.25,
      muscle_filter: ['front_delt', 'side_delt', 'rear_delt', 'lats', 'upper_back', 'chest', 'traps'],
    },
    {
      id: 'spine_flow',
      name: 'Spine & Core',
      exercise_count: { min: 2, max: 3 },
      role_filter: ['primary', 'secondary', 'accessory'],
      preferred_formats: ['hold_sequence', 'flow_sequence'],
      time_budget_fraction: 0.25,
      muscle_filter: ['core', 'obliques', 'lower_back', 'transverse_abdominis'],
    },
    {
      id: 'hip_flow',
      name: 'Hip & Lower Body',
      exercise_count: { min: 2, max: 3 },
      role_filter: ['primary', 'secondary', 'accessory'],
      preferred_formats: ['hold_sequence', 'flow_sequence'],
      time_budget_fraction: 0.30,
      muscle_filter: ['hip_flexors', 'glutes', 'hamstrings', 'quads', 'adductors', 'abductors', 'calves'],
    },
    {
      id: 'lower_flow',
      name: 'Full Body Integration',
      exercise_count: { min: 1, max: 2 },
      role_filter: ['accessory'],
      preferred_formats: ['flow_sequence'],
      time_budget_fraction: 0.20,
    },
  ],
  total_phase_fraction: 1.0,
};

export const STRENGTH_PUSH_ARCHITECTURE: SessionArchitecture = {
  phases: [
    {
      id: 'primary_compound',
      name: 'Main Press',
      exercise_count: { min: 1, max: 1 },
      role_filter: ['primary'],
      preferred_formats: ['straight_sets', 'ascending_sets', 'wave_loading'],
      time_budget_fraction: 0.25,
      is_compound_only: true,
      movement_filter: ['push'],
      muscle_filter: ['chest', 'upper_chest', 'lower_chest'],
    },
    {
      id: 'secondary_compound',
      name: 'Second Press (OHP)',
      exercise_count: { min: 1, max: 1 },
      role_filter: ['primary', 'secondary'],
      preferred_formats: ['straight_sets', 'ascending_sets'],
      time_budget_fraction: 0.22,
      is_compound_only: true,
      movement_filter: ['push'],
      muscle_filter: ['front_delt', 'side_delt'],
    },
    {
      id: 'accessories',
      name: 'Chest + Shoulder Superset',
      exercise_count: { min: 2, max: 2 },
      role_filter: ['primary', 'secondary', 'accessory'],
      preferred_formats: ['supersets', 'straight_sets'],
      time_budget_fraction: 0.28,
      muscle_filter: ['chest', 'upper_chest', 'lower_chest', 'front_delt', 'side_delt'],
    },
    {
      id: 'finisher',
      name: 'Tricep Finisher',
      exercise_count: { min: 2, max: 2 },
      role_filter: ['primary', 'secondary', 'accessory'],
      preferred_formats: ['supersets', 'straight_sets'],
      time_budget_fraction: 0.25,
      muscle_filter: ['triceps'],
    },
  ],
  total_phase_fraction: 1.0,
};

export const STRENGTH_PULL_ARCHITECTURE: SessionArchitecture = {
  phases: [
    {
      id: 'primary_compound',
      name: 'Heavy Hinge',
      exercise_count: { min: 1, max: 1 },
      role_filter: ['primary', 'secondary'],
      preferred_formats: ['straight_sets', 'ascending_sets', 'wave_loading'],
      time_budget_fraction: 0.24,
      is_compound_only: true,
      movement_filter: ['hinge'],
    },
    {
      id: 'secondary_compound',
      name: 'Vertical Pull',
      exercise_count: { min: 1, max: 1 },
      role_filter: ['primary', 'secondary'],
      preferred_formats: ['straight_sets', 'ascending_sets'],
      time_budget_fraction: 0.20,
      is_compound_only: true,
      movement_filter: ['pull'],
      muscle_filter: ['lats'],
    },
    {
      id: 'secondary_compound',
      name: 'Horizontal Pull',
      exercise_count: { min: 1, max: 1 },
      role_filter: ['secondary', 'accessory'],
      preferred_formats: ['straight_sets'],
      time_budget_fraction: 0.20,
      is_compound_only: true,
      movement_filter: ['pull'],
      muscle_filter: ['upper_back', 'rhomboids', 'lower_back', 'traps'],
    },
    {
      id: 'accessories',
      name: 'Upper Back + Rear Delt Superset',
      exercise_count: { min: 2, max: 2 },
      role_filter: ['accessory', 'secondary'],
      preferred_formats: ['supersets', 'straight_sets'],
      time_budget_fraction: 0.20,
      muscle_filter: ['upper_back', 'rear_delt', 'traps', 'rhomboids'],
    },
    {
      id: 'finisher',
      name: 'Bicep Finisher',
      exercise_count: { min: 2, max: 2 },
      role_filter: ['accessory'],
      preferred_formats: ['supersets', 'straight_sets'],
      time_budget_fraction: 0.16,
      muscle_filter: ['biceps', 'forearms'],
    },
  ],
  total_phase_fraction: 1.0,
};

export const STRENGTH_LEGS_ARCHITECTURE: SessionArchitecture = {
  phases: [
    {
      id: 'primary_compound',
      name: 'Main Squat',
      exercise_count: { min: 1, max: 2 },
      role_filter: ['primary', 'secondary'],
      preferred_formats: ['straight_sets', 'ascending_sets', 'wave_loading'],
      time_budget_fraction: 0.28,
      is_compound_only: true,
      movement_filter: ['squat'],
    },
    {
      id: 'secondary_compound',
      name: 'Hip Hinge',
      exercise_count: { min: 1, max: 1 },
      role_filter: ['secondary'],
      preferred_formats: ['straight_sets', 'ascending_sets'],
      time_budget_fraction: 0.22,
      is_compound_only: true,
      movement_filter: ['hinge'],
      muscle_filter: ['hamstrings', 'glutes'],
    },
    {
      id: 'secondary_compound',
      name: 'Single Leg',
      exercise_count: { min: 1, max: 1 },
      role_filter: ['secondary', 'accessory'],
      preferred_formats: ['straight_sets'],
      time_budget_fraction: 0.20,
      movement_filter: ['lunge'],
    },
    {
      id: 'accessories',
      name: 'Hamstrings + Calves Superset',
      exercise_count: { min: 2, max: 2 },
      role_filter: ['accessory'],
      preferred_formats: ['supersets', 'straight_sets'],
      time_budget_fraction: 0.20,
      muscle_filter: ['hamstrings', 'calves', 'adductors', 'abductors', 'glutes'],
      movement_filter: ['squat', 'hinge', 'lunge', 'isolation'],
    },
    {
      id: 'core',
      name: 'Core Finisher',
      exercise_count: { min: 0, max: 1 },
      role_filter: ['accessory'],
      preferred_formats: ['straight_sets'],
      time_budget_fraction: 0.10,
      muscle_filter: ['core', 'obliques', 'hip_flexors', 'transverse_abdominis'],
    },
  ],
  total_phase_fraction: 1.0,
};

export const STRENGTH_FULL_BODY_ARCHITECTURE: SessionArchitecture = {
  phases: [
    {
      id: 'primary_compound',
      name: 'Squat',
      exercise_count: { min: 1, max: 1 },
      role_filter: ['primary', 'secondary'],
      preferred_formats: ['straight_sets', 'ascending_sets'],
      time_budget_fraction: 0.22,
      is_compound_only: true,
      movement_filter: ['squat'],
    },
    {
      id: 'secondary_compound',
      name: 'Press',
      exercise_count: { min: 1, max: 1 },
      role_filter: ['primary', 'secondary'],
      preferred_formats: ['straight_sets', 'ascending_sets'],
      time_budget_fraction: 0.20,
      is_compound_only: true,
      movement_filter: ['push'],
    },
    {
      id: 'secondary_compound',
      name: 'Pull',
      exercise_count: { min: 1, max: 1 },
      role_filter: ['secondary'],
      preferred_formats: ['straight_sets'],
      time_budget_fraction: 0.20,
      is_compound_only: true,
      movement_filter: ['pull'],
    },
    {
      id: 'accessories',
      name: 'Posterior + Pull Superset',
      exercise_count: { min: 2, max: 2 },
      role_filter: ['accessory', 'secondary'],
      preferred_formats: ['supersets', 'straight_sets'],
      time_budget_fraction: 0.22,
      movement_filter: ['hinge', 'pull', 'lunge'],
    },
    {
      id: 'core',
      name: 'Carry + Core',
      exercise_count: { min: 0, max: 1 },
      role_filter: ['accessory'],
      preferred_formats: ['straight_sets', 'supersets'],
      time_budget_fraction: 0.16,
      muscle_filter: ['core', 'obliques', 'hip_flexors'],
    },
  ],
  total_phase_fraction: 1.0,
};

export const STRENGTH_UPPER_ARCHITECTURE: SessionArchitecture = {
  phases: [
    {
      id: 'primary_compound',
      name: 'Main Push (Bench)',
      exercise_count: { min: 1, max: 1 },
      role_filter: ['primary', 'secondary'],
      preferred_formats: ['straight_sets', 'ascending_sets', 'wave_loading'],
      time_budget_fraction: 0.18,
      is_compound_only: true,
      movement_filter: ['push'],
      muscle_filter: ['chest', 'upper_chest', 'lower_chest'],
    },
    {
      id: 'secondary_compound',
      name: 'Main Pull (Pull-Up)',
      exercise_count: { min: 1, max: 1 },
      role_filter: ['primary', 'secondary'],
      preferred_formats: ['straight_sets', 'ascending_sets'],
      time_budget_fraction: 0.17,
      is_compound_only: true,
      movement_filter: ['pull'],
      muscle_filter: ['lats'],
    },
    {
      id: 'secondary_compound',
      name: 'Second Push (OHP)',
      exercise_count: { min: 1, max: 1 },
      role_filter: ['secondary'],
      preferred_formats: ['straight_sets', 'ascending_sets'],
      time_budget_fraction: 0.16,
      is_compound_only: true,
      movement_filter: ['push'],
      muscle_filter: ['front_delt', 'side_delt'],
    },
    {
      id: 'secondary_compound',
      name: 'Second Pull (Row)',
      exercise_count: { min: 1, max: 1 },
      role_filter: ['secondary', 'accessory'],
      preferred_formats: ['straight_sets'],
      time_budget_fraction: 0.16,
      is_compound_only: true,
      movement_filter: ['pull'],
      muscle_filter: ['upper_back', 'rhomboids', 'lower_back'],
    },
    {
      id: 'accessories',
      name: 'Accessory Push + Pull Superset',
      exercise_count: { min: 2, max: 2 },
      role_filter: ['accessory'],
      preferred_formats: ['supersets', 'straight_sets'],
      time_budget_fraction: 0.18,
    },
    {
      id: 'finisher',
      name: 'Arms Finisher',
      exercise_count: { min: 2, max: 2 },
      role_filter: ['accessory'],
      preferred_formats: ['supersets', 'straight_sets'],
      time_budget_fraction: 0.15,
      muscle_filter: ['biceps', 'triceps'],
    },
  ],
  total_phase_fraction: 1.0,
};

export const STRENGTH_LOWER_ARCHITECTURE: SessionArchitecture = {
  phases: [
    {
      id: 'primary_compound',
      name: 'Main Squat',
      exercise_count: { min: 1, max: 2 },
      role_filter: ['primary', 'secondary'],
      preferred_formats: ['straight_sets', 'ascending_sets', 'wave_loading'],
      time_budget_fraction: 0.28,
      is_compound_only: true,
      movement_filter: ['squat'],
    },
    {
      id: 'secondary_compound',
      name: 'Hinge',
      exercise_count: { min: 1, max: 1 },
      role_filter: ['secondary'],
      preferred_formats: ['straight_sets', 'ascending_sets'],
      time_budget_fraction: 0.22,
      is_compound_only: true,
      movement_filter: ['hinge'],
    },
    {
      id: 'secondary_compound',
      name: 'Single Leg / Lunge',
      exercise_count: { min: 1, max: 1 },
      role_filter: ['secondary', 'accessory'],
      preferred_formats: ['straight_sets'],
      time_budget_fraction: 0.20,
      movement_filter: ['lunge'],
    },
    {
      id: 'accessories',
      name: 'Quad + Hamstring Superset',
      exercise_count: { min: 2, max: 2 },
      role_filter: ['accessory'],
      preferred_formats: ['supersets', 'straight_sets'],
      time_budget_fraction: 0.18,
      muscle_filter: ['quads', 'hamstrings', 'glutes', 'adductors', 'abductors'],
      movement_filter: ['squat', 'hinge', 'lunge', 'isolation'],
    },
    {
      id: 'core',
      name: 'Calves + Core',
      exercise_count: { min: 1, max: 2 },
      role_filter: ['accessory'],
      preferred_formats: ['straight_sets'],
      time_budget_fraction: 0.12,
      muscle_filter: ['calves', 'core', 'obliques', 'hip_flexors'],
      movement_filter: ['isolation', 'squat', 'hinge'],
    },
  ],
  total_phase_fraction: 1.0,
};

export const STRENGTH_CORE_CARDIO_ARCHITECTURE: SessionArchitecture = {
  phases: [
    {
      id: 'primary_compound',
      name: 'Core Flexion',
      exercise_count: { min: 1, max: 2 },
      role_filter: ['primary', 'secondary', 'accessory'],
      preferred_formats: ['straight_sets'],
      time_budget_fraction: 0.24,
      muscle_filter: ['core', 'transverse_abdominis'],
      movement_filter: ['isolation', 'rotation'],
    },
    {
      id: 'secondary_compound',
      name: 'Hip Flexor / Leg Raise',
      exercise_count: { min: 1, max: 2 },
      role_filter: ['primary', 'secondary', 'accessory'],
      preferred_formats: ['straight_sets'],
      time_budget_fraction: 0.24,
      muscle_filter: ['hip_flexors', 'core', 'transverse_abdominis'],
    },
    {
      id: 'accessories',
      name: 'Rotation + Brace Superset',
      exercise_count: { min: 2, max: 2 },
      role_filter: ['accessory'],
      preferred_formats: ['supersets', 'straight_sets'],
      time_budget_fraction: 0.26,
      muscle_filter: ['obliques', 'core', 'transverse_abdominis'],
    },
    {
      id: 'finisher',
      name: 'Trunk Finisher',
      exercise_count: { min: 1, max: 2 },
      role_filter: ['accessory'],
      preferred_formats: ['supersets', 'straight_sets'],
      time_budget_fraction: 0.26,
      muscle_filter: ['core', 'obliques', 'lower_back'],
    },
  ],
  total_phase_fraction: 1.0,
};

const SPLIT_TO_STRENGTH_ARCHITECTURE: Record<string, SessionArchitecture> = {
  push: STRENGTH_PUSH_ARCHITECTURE,
  'push day': STRENGTH_PUSH_ARCHITECTURE,
  pull: STRENGTH_PULL_ARCHITECTURE,
  'pull day': STRENGTH_PULL_ARCHITECTURE,
  legs: STRENGTH_LEGS_ARCHITECTURE,
  'leg day': STRENGTH_LEGS_ARCHITECTURE,
  upper: STRENGTH_UPPER_ARCHITECTURE,
  lower: STRENGTH_LOWER_ARCHITECTURE,
  'full body': STRENGTH_FULL_BODY_ARCHITECTURE,
  'core + cardio': STRENGTH_CORE_CARDIO_ARCHITECTURE,
  'core+cardio': STRENGTH_CORE_CARDIO_ARCHITECTURE,
};

// Hybrid: strength compounds followed by a conditioning circuit finisher
export const HYBRID_ARCHITECTURE: SessionArchitecture = {
  phases: [
    {
      id: 'strength_block',
      name: 'Strength Block',
      exercise_count: { min: 3, max: 5 },
      role_filter: ['primary', 'secondary'],
      preferred_formats: ['straight_sets', 'ascending_sets'],
      time_budget_fraction: 0.60,
      is_compound_only: true,
      movement_filter: ['push', 'pull', 'squat', 'hinge', 'lunge'],
    },
    {
      id: 'conditioning_block',
      name: 'Conditioning Finisher',
      exercise_count: { min: 3, max: 5 },
      role_filter: ['primary', 'secondary', 'accessory'],
      preferred_formats: ['circuit'],
      time_budget_fraction: 0.35,
      movement_filter: ['squat', 'push', 'pull', 'hinge', 'plyometric', 'carry'],
    },
    {
      id: 'core',
      name: 'Core',
      exercise_count: { min: 0, max: 1 },
      role_filter: ['accessory'],
      preferred_formats: ['straight_sets'],
      time_budget_fraction: 0.05,
      muscle_filter: ['core', 'obliques'],
    },
  ],
  total_phase_fraction: 1.0,
};

export function getArchitectureForStyle(style: string, split?: string): SessionArchitecture {
  if ((style === 'strength' || style === 'bodybuilding') && split) {
    const normalizedSplit = split.toLowerCase().trim();
    const splitArch = SPLIT_TO_STRENGTH_ARCHITECTURE[normalizedSplit];
    if (splitArch) {
      console.log('[StyleFormats] Using split-specific architecture for', style, '/', split);
      return splitArch;
    }
    if (normalizedSplit.includes('push') && !normalizedSplit.includes('pull') && !normalizedSplit.includes('legs')) {
      return STRENGTH_PUSH_ARCHITECTURE;
    }
    if (normalizedSplit.includes('pull') && !normalizedSplit.includes('push') && !normalizedSplit.includes('legs')) {
      return STRENGTH_PULL_ARCHITECTURE;
    }
    if (normalizedSplit.includes('legs') || normalizedSplit.startsWith('leg ')) {
      return STRENGTH_LEGS_ARCHITECTURE;
    }
    if (normalizedSplit === 'upper' || normalizedSplit.includes('upper body')) {
      return STRENGTH_UPPER_ARCHITECTURE;
    }
    if (normalizedSplit === 'lower' || normalizedSplit.includes('lower body')) {
      return STRENGTH_LOWER_ARCHITECTURE;
    }
    if (normalizedSplit.includes('full body') || normalizedSplit.includes('full_body')) {
      return STRENGTH_FULL_BODY_ARCHITECTURE;
    }
    if (normalizedSplit.includes('core')) {
      return STRENGTH_CORE_CARDIO_ARCHITECTURE;
    }
  }
  switch (style) {
    case 'strength': return STRENGTH_ARCHITECTURE;
    case 'bodybuilding': return BODYBUILDING_ARCHITECTURE;
    case 'crossfit': return CROSSFIT_ARCHITECTURE;
    case 'hiit': return HIIT_ARCHITECTURE;
    case 'hyrox': return HYROX_ARCHITECTURE;
    case 'cardio': return CARDIO_ARCHITECTURE;
    case 'pilates': return PILATES_ARCHITECTURE;
    case 'mobility': return MOBILITY_ARCHITECTURE;
    case 'hybrid': return HYBRID_ARCHITECTURE;
    default: return STRENGTH_ARCHITECTURE;
  }
}
