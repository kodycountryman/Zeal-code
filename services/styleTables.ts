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
  hybrid:       ['straight_sets', 'ascending_sets', 'wave_loading', 'circuit', 'amrap'],
};

export interface RestPeriodEntry {
  floor: number;
  ceiling: number;
  base: number;
}

export const REST_PERIOD_MATRIX: Record<string, Record<string, RestPeriodEntry>> = {
  strength: {
    heavy_compound:    { floor: 120, ceiling: 300, base: 180 },  // Guide: 3:00-5:00, default 3:00
    moderate_compound: { floor: 90,  ceiling: 210, base: 150 },  // Guide: 2:00-3:30, default 2:30
    isolation:         { floor: 90,  ceiling: 150, base: 105 },  // Guide: 1:30-2:30, default 1:45
    core:              { floor: 60,  ceiling: 90,  base: 60  },  // Guide: 1:00-1:30, default 1:00
    quick_bodyweight:  { floor: 20,  ceiling: 90,  base: 30  },
  },
  bodybuilding: {
    heavy_compound:    { floor: 90,  ceiling: 150, base: 120 },  // Guide: 1:30-2:30, default 2:00
    moderate_compound: { floor: 60,  ceiling: 120, base: 90  },
    isolation:         { floor: 60,  ceiling: 90,  base: 60  },  // Guide: 1:00-1:30, default 1:00
    core:              { floor: 30,  ceiling: 60,  base: 45  },
    quick_bodyweight:  { floor: 20,  ceiling: 45,  base: 30  },
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
  hybrid: {
    heavy_compound:    { floor: 120, ceiling: 300, base: 180 },
    moderate_compound: { floor: 60,  ceiling: 180, base: 90  },
    isolation:         { floor: 30,  ceiling: 60,  base: 45  },
    core:              { floor: 20,  ceiling: 60,  base: 30  },
    quick_bodyweight:  { floor: 15,  ceiling: 45,  base: 30  },
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
  hybrid:       { enabled: false, default_for_isolation: false, min: 0, max: 0 },
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
  hybrid: {
    beginner:     { volume_increase_per_week: 0.05, intensity_increase_per_week: 0.025, deload_frequency_weeks: 6, deload_reduction: 0.40 },
    intermediate: { volume_increase_per_week: 0.03, intensity_increase_per_week: 0.020, deload_frequency_weeks: 5, deload_reduction: 0.35 },
    advanced:     { volume_increase_per_week: 0.02, intensity_increase_per_week: 0.010, deload_frequency_weeks: 4, deload_reduction: 0.30 },
  },
};

export const EXERCISE_COUNT_RANGES: Record<string, { min: number; max: number }> = {
  strength:     { min: 3,  max: 7  },   // Guide: 3-4 (30min) to 5-6 (60min) + core
  bodybuilding: { min: 4,  max: 9  },   // Guide: 4-5 (30min) to 7-9 (60min)
  crossfit:     { min: 2,  max: 8  },   // Guide: 2-4 (30min) to 4-6 (60min) + A/C
  hiit:         { min: 4,  max: 10 },   // Guide: 4-6 (30min) to 8-10 (60min)
  hyrox:        { min: 2,  max: 16 },
  cardio:       { min: 1,  max: 4  },   // Guide: 1-2 (30min) to 2-4 (60min)
  pilates:      { min: 12, max: 34 },   // Guide: 12-15 (30min) to 28-34 (60min)
  mobility:     { min: 10, max: 25 },   // Guide: 10-12 (20min) to 20-25 (45min)
  low_impact:   { min: 3,  max: 8  },
  hybrid:       { min: 4,  max: 10 },
};

export const REP_RANGE_BY_STYLE: Record<string, { min: number; max: number }> = {
  strength:     { min: 1,  max: 6  },
  bodybuilding: { min: 6,  max: 12 },  // Guide: 6-12 (isolation: 10-20 handled by role clamping)
  crossfit:     { min: 3,  max: 15 },
  hiit:         { min: 10, max: 20 },
  hyrox:        { min: 8,  max: 20 },
  cardio:       { min: 1,  max: 1  },
  pilates:      { min: 8,  max: 15 },
  mobility:     { min: 5,  max: 10 },
  low_impact:   { min: 12, max: 20 },
  hybrid:       { min: 3,  max: 20 },
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
  hybrid:       { min: 3, max: 5 },
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
  hybrid:       true,
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
  hybrid:       ['squat', 'hinge', 'push', 'pull', 'plyometric', 'isolation'],
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

/**
 * HIIT work:rest ratios scaled by fitness level.
 * - Beginner: 1:2 or 1:3 (more recovery time)
 * - Intermediate: 1:1 (equal work and rest)
 * - Advanced: 2:1 or 3:1 (minimal rest, higher intensity)
 * Each level provides an array of presets the engine can select from.
 */
export const HIIT_WORK_REST_BY_LEVEL: Record<string, { work: number; rest: number }[]> = {
  beginner:     [{ work: 20, rest: 40 }, { work: 20, rest: 60 }, { work: 30, rest: 60 }],
  intermediate: [{ work: 30, rest: 30 }, { work: 40, rest: 40 }, { work: 45, rest: 45 }],
  advanced:     [{ work: 40, rest: 20 }, { work: 45, rest: 15 }, { work: 60, rest: 30 }],
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
  hybrid:       40,
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
  hybrid:       0.875,
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
