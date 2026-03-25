import type { WorkoutFormatId } from '@/services/styleFormats';
import type { FitnessLevel } from '@/services/styleRules';

console.log('[StyleTables] Cross-style reference tables loaded');

export const FORMAT_AVAILABILITY: Record<string, WorkoutFormatId[]> = {
  strength:     ['straight_sets', 'wave_loading', 'cluster_sets', 'ascending_sets', 'descending_sets', 'pyramid', 'supersets'],
  bodybuilding: ['straight_sets', 'supersets', 'tri_sets', 'giant_sets', 'drop_sets', 'rest_pause', 'ascending_sets', 'descending_sets'],
  crossfit:     ['straight_sets', 'ascending_sets', 'wave_loading', 'amrap', 'emom', 'rft', 'chipper', 'ladder'],
  hiit:         ['tabata', 'circuit', 'emom', 'interval_repeats'],
  hyrox:        ['station_run', 'circuit', 'straight_sets'],
  cardio:       ['zone_steady', 'tempo_intervals', 'interval_repeats'],
  pilates:      ['flow_sequence', 'straight_sets', 'hold_sequence'],
  mobility:     ['hold_sequence', 'flow_sequence', 'straight_sets'],
};

export interface RestPeriodEntry {
  floor: number;
  ceiling: number;
  base: number;
}

export const REST_PERIOD_MATRIX: Record<string, Record<string, RestPeriodEntry>> = {
  strength: {
    heavy_compound:    { floor: 120, ceiling: 300, base: 180 },
    moderate_compound: { floor: 90,  ceiling: 210, base: 120 },
    isolation:         { floor: 45,  ceiling: 150, base: 75  },
    core:              { floor: 30,  ceiling: 120, base: 45  },
    quick_bodyweight:  { floor: 20,  ceiling: 90,  base: 30  },
  },
  bodybuilding: {
    heavy_compound:    { floor: 90,  ceiling: 240, base: 150 },
    moderate_compound: { floor: 60,  ceiling: 180, base: 90  },
    isolation:         { floor: 30,  ceiling: 120, base: 60  },
    core:              { floor: 30,  ceiling: 90,  base: 45  },
    quick_bodyweight:  { floor: 20,  ceiling: 75,  base: 30  },
  },
  crossfit: {
    heavy_compound:    { floor: 90,  ceiling: 240, base: 150 },
    moderate_compound: { floor: 60,  ceiling: 180, base: 90  },
    isolation:         { floor: 30,  ceiling: 90,  base: 45  },
    core:              { floor: 20,  ceiling: 60,  base: 30  },
    quick_bodyweight:  { floor: 10,  ceiling: 45,  base: 20  },
  },
  hiit: {
    heavy_compound:    { floor: 45,  ceiling: 120, base: 60  },
    moderate_compound: { floor: 30,  ceiling: 90,  base: 45  },
    isolation:         { floor: 15,  ceiling: 60,  base: 30  },
    core:              { floor: 10,  ceiling: 45,  base: 20  },
    quick_bodyweight:  { floor: 10,  ceiling: 30,  base: 15  },
  },
  hyrox: {
    heavy_compound:    { floor: 30,  ceiling: 90,  base: 45  },
    moderate_compound: { floor: 20,  ceiling: 60,  base: 30  },
    isolation:         { floor: 15,  ceiling: 45,  base: 20  },
    core:              { floor: 10,  ceiling: 30,  base: 15  },
    quick_bodyweight:  { floor: 10,  ceiling: 30,  base: 15  },
  },
  cardio: {
    heavy_compound:    { floor: 30,  ceiling: 90,  base: 45  },
    moderate_compound: { floor: 20,  ceiling: 60,  base: 30  },
    isolation:         { floor: 15,  ceiling: 45,  base: 20  },
    core:              { floor: 10,  ceiling: 30,  base: 15  },
    quick_bodyweight:  { floor: 10,  ceiling: 30,  base: 15  },
  },
  pilates: {
    heavy_compound:    { floor: 15,  ceiling: 45,  base: 30  },
    moderate_compound: { floor: 10,  ceiling: 30,  base: 20  },
    isolation:         { floor: 10,  ceiling: 30,  base: 15  },
    core:              { floor: 5,   ceiling: 20,  base: 10  },
    quick_bodyweight:  { floor: 5,   ceiling: 15,  base: 10  },
  },
  mobility: {
    heavy_compound:    { floor: 10,  ceiling: 30,  base: 15  },
    moderate_compound: { floor: 10,  ceiling: 30,  base: 15  },
    isolation:         { floor: 5,   ceiling: 20,  base: 10  },
    core:              { floor: 5,   ceiling: 15,  base: 10  },
    quick_bodyweight:  { floor: 5,   ceiling: 15,  base: 10  },
  },
};

export const SUPERSET_ELIGIBILITY: Record<string, {
  enabled: boolean;
  default_for_isolation: boolean;
  min: number;
  max: number;
}> = {
  strength:     { enabled: true,  default_for_isolation: false, min: 0, max: 1 },
  bodybuilding: { enabled: true,  default_for_isolation: true,  min: 1, max: 3 },
  crossfit:     { enabled: false, default_for_isolation: false, min: 0, max: 0 },
  hiit:         { enabled: false, default_for_isolation: false, min: 0, max: 0 },
  hyrox:        { enabled: false, default_for_isolation: false, min: 0, max: 0 },
  cardio:       { enabled: false, default_for_isolation: false, min: 0, max: 0 },
  pilates:      { enabled: false, default_for_isolation: false, min: 0, max: 0 },
  mobility:     { enabled: false, default_for_isolation: false, min: 0, max: 0 },
};

export const PROGRESSION_SPEED: Record<string, Record<FitnessLevel, {
  volume_increase_per_week: number;
  intensity_increase_per_week: number;
  deload_frequency_weeks: number;
  deload_reduction: number;
}>> = {
  strength: {
    beginner:     { volume_increase_per_week: 0.05, intensity_increase_per_week: 0.025, deload_frequency_weeks: 6, deload_reduction: 0.40 },
    intermediate: { volume_increase_per_week: 0.03, intensity_increase_per_week: 0.020, deload_frequency_weeks: 5, deload_reduction: 0.35 },
    advanced:     { volume_increase_per_week: 0.02, intensity_increase_per_week: 0.010, deload_frequency_weeks: 4, deload_reduction: 0.30 },
  },
  bodybuilding: {
    beginner:     { volume_increase_per_week: 0.05, intensity_increase_per_week: 0.020, deload_frequency_weeks: 6, deload_reduction: 0.35 },
    intermediate: { volume_increase_per_week: 0.04, intensity_increase_per_week: 0.015, deload_frequency_weeks: 5, deload_reduction: 0.30 },
    advanced:     { volume_increase_per_week: 0.02, intensity_increase_per_week: 0.010, deload_frequency_weeks: 4, deload_reduction: 0.25 },
  },
  crossfit: {
    beginner:     { volume_increase_per_week: 0.05, intensity_increase_per_week: 0.025, deload_frequency_weeks: 6, deload_reduction: 0.40 },
    intermediate: { volume_increase_per_week: 0.03, intensity_increase_per_week: 0.020, deload_frequency_weeks: 5, deload_reduction: 0.35 },
    advanced:     { volume_increase_per_week: 0.02, intensity_increase_per_week: 0.015, deload_frequency_weeks: 4, deload_reduction: 0.30 },
  },
  hiit: {
    beginner:     { volume_increase_per_week: 0.04, intensity_increase_per_week: 0.000, deload_frequency_weeks: 6, deload_reduction: 0.35 },
    intermediate: { volume_increase_per_week: 0.03, intensity_increase_per_week: 0.000, deload_frequency_weeks: 5, deload_reduction: 0.30 },
    advanced:     { volume_increase_per_week: 0.02, intensity_increase_per_week: 0.000, deload_frequency_weeks: 4, deload_reduction: 0.25 },
  },
  hyrox: {
    beginner:     { volume_increase_per_week: 0.04, intensity_increase_per_week: 0.000, deload_frequency_weeks: 6, deload_reduction: 0.30 },
    intermediate: { volume_increase_per_week: 0.03, intensity_increase_per_week: 0.000, deload_frequency_weeks: 5, deload_reduction: 0.25 },
    advanced:     { volume_increase_per_week: 0.02, intensity_increase_per_week: 0.000, deload_frequency_weeks: 4, deload_reduction: 0.20 },
  },
  cardio: {
    beginner:     { volume_increase_per_week: 0.03, intensity_increase_per_week: 0.000, deload_frequency_weeks: 8, deload_reduction: 0.20 },
    intermediate: { volume_increase_per_week: 0.02, intensity_increase_per_week: 0.000, deload_frequency_weeks: 6, deload_reduction: 0.20 },
    advanced:     { volume_increase_per_week: 0.01, intensity_increase_per_week: 0.000, deload_frequency_weeks: 5, deload_reduction: 0.15 },
  },
  pilates: {
    beginner:     { volume_increase_per_week: 0.03, intensity_increase_per_week: 0.000, deload_frequency_weeks: 8, deload_reduction: 0.20 },
    intermediate: { volume_increase_per_week: 0.02, intensity_increase_per_week: 0.000, deload_frequency_weeks: 6, deload_reduction: 0.20 },
    advanced:     { volume_increase_per_week: 0.01, intensity_increase_per_week: 0.000, deload_frequency_weeks: 5, deload_reduction: 0.15 },
  },
  mobility: {
    beginner:     { volume_increase_per_week: 0.02, intensity_increase_per_week: 0.000, deload_frequency_weeks: 0, deload_reduction: 0 },
    intermediate: { volume_increase_per_week: 0.01, intensity_increase_per_week: 0.000, deload_frequency_weeks: 0, deload_reduction: 0 },
    advanced:     { volume_increase_per_week: 0.01, intensity_increase_per_week: 0.000, deload_frequency_weeks: 0, deload_reduction: 0 },
  },
};

export const EXERCISE_COUNT_RANGES: Record<string, { min: number; max: number }> = {
  strength:     { min: 4,  max: 8  },
  bodybuilding: { min: 5,  max: 10 },
  crossfit:     { min: 5,  max: 10 },
  hiit:         { min: 4,  max: 8  },
  hyrox:        { min: 6,  max: 16 },
  cardio:       { min: 2,  max: 5  },
  pilates:      { min: 5,  max: 10 },
  mobility:     { min: 5,  max: 10 },
  low_impact:   { min: 5,  max: 8  },
};

export const REP_RANGE_BY_STYLE: Record<string, { min: number; max: number }> = {
  strength:     { min: 1,  max: 6  },
  bodybuilding: { min: 8,  max: 15 },
  crossfit:     { min: 3,  max: 15 },
  hiit:         { min: 10, max: 20 },
  hyrox:        { min: 8,  max: 20 },
  cardio:       { min: 1,  max: 1  },
  pilates:      { min: 8,  max: 15 },
  mobility:     { min: 5,  max: 10 },
  low_impact:   { min: 12, max: 20 },
};

export const SET_RANGE_BY_STYLE: Record<string, { min: number; max: number }> = {
  strength:     { min: 3, max: 5 },
  bodybuilding: { min: 3, max: 4 },
  crossfit:     { min: 3, max: 5 },
  hiit:         { min: 3, max: 5 },
  hyrox:        { min: 1, max: 3 },
  cardio:       { min: 1, max: 3 },
  pilates:      { min: 2, max: 3 },
  mobility:     { min: 2, max: 3 },
  low_impact:   { min: 2, max: 4 },
};

export const COMPOUNDS_FIRST_BY_STYLE: Record<string, boolean> = {
  strength:     true,
  bodybuilding: true,
  crossfit:     true,
  hiit:         false,
  hyrox:        false,
  cardio:       false,
  pilates:      false,
  mobility:     false,
  low_impact:   false,
};

export const PATTERN_PRIORITY_BY_STYLE: Record<string, string[]> = {
  strength:     ['squat', 'hinge', 'push', 'pull', 'isolation'],
  bodybuilding: ['push', 'pull', 'squat', 'hinge', 'isolation'],
  crossfit:     ['squat', 'push', 'pull', 'hinge', 'plyometric', 'cardio'],
  hiit:         ['plyometric', 'squat', 'push', 'pull', 'cardio'],
  hyrox:        ['cardio', 'squat', 'carry', 'push', 'lunge'],
  cardio:       ['cardio'],
  pilates:      ['pilates', 'rotation', 'isolation', 'hinge'],
  mobility:     ['mobility', 'rotation', 'hinge', 'squat'],
  low_impact:   ['isolation', 'push', 'pull', 'hinge', 'squat', 'lunge'],
};

export const DURATION_OVERRIDES: Record<string, { max_working_minutes?: number; fixed_minutes?: number }> = {
  hiit:     { max_working_minutes: 30 },
  '75_hard': { fixed_minutes: 45 },
  mobility: { max_working_minutes: 45 },
  pilates:  { max_working_minutes: 50 },
};

export const METCON_FORMATS_BY_STYLE: Record<string, WorkoutFormatId[]> = {
  crossfit: ['amrap', 'emom', 'rft', 'chipper', 'ladder'],
};

export const TIME_BUDGET_SPLIT: Record<string, { strength_fraction: number; metcon_fraction: number; core_fraction: number }> = {
  crossfit: { strength_fraction: 0.40, metcon_fraction: 0.55, core_fraction: 0.05 },
};

export const WORK_REST_RATIOS: Record<string, { work: number; rest: number }> = {
  tabata:           { work: 20, rest: 10 },
  circuit:          { work: 40, rest: 20 },
  emom:             { work: 40, rest: 20 },
  interval_repeats: { work: 30, rest: 30 },
};

export const TRANSITION_BUFFER_BY_STYLE: Record<string, number> = {
  strength:     45,
  bodybuilding: 37,
  crossfit:     30,
  hiit:         20,
  hyrox:        15,
  cardio:       15,
  pilates:      10,
  mobility:     10,
  low_impact:   30,
};

export const DISTRACTION_FACTOR_BY_STYLE: Record<string, number> = {
  strength:     0.875,
  bodybuilding: 0.875,
  crossfit:     0.90,
  hiit:         0.90,
  hyrox:        0.95,
  cardio:       0.95,
  pilates:      0.95,
  mobility:     0.95,
  low_impact:   0.90,
};

export const CIRCUIT_GROUPING_STYLES = new Set(['hiit', 'crossfit', 'hyrox']);

export const POSITION_ORDERED_STYLES = new Set(['pilates', 'mobility']);

export function lookupRestForStyleAndTier(style: string, tier: string): RestPeriodEntry {
  const styleRests = REST_PERIOD_MATRIX[style];
  if (styleRests && styleRests[tier]) return styleRests[tier];
  return REST_PERIOD_MATRIX['strength'][tier] ?? { floor: 30, ceiling: 150, base: 60 };
}

export function lookupFormatAvailability(style: string): WorkoutFormatId[] {
  return FORMAT_AVAILABILITY[style] ?? FORMAT_AVAILABILITY['strength'];
}

export function lookupSupersetEligibility(style: string): { enabled: boolean; default_for_isolation: boolean; min: number; max: number } {
  return SUPERSET_ELIGIBILITY[style] ?? SUPERSET_ELIGIBILITY['strength'];
}

export function lookupProgressionSpeed(style: string, level: FitnessLevel) {
  const styleProgression = PROGRESSION_SPEED[style];
  if (styleProgression && styleProgression[level]) return styleProgression[level];
  return PROGRESSION_SPEED['strength'][level];
}

export function isStyleCircuitBased(style: string): boolean {
  return CIRCUIT_GROUPING_STYLES.has(style);
}

export function isStylePositionOrdered(style: string): boolean {
  return POSITION_ORDERED_STYLES.has(style);
}
