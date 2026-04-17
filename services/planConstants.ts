__DEV__ && console.log('[PlanConstants] Loading Phase 5 plan generation constants');

export type PlanGoal =
  | 'build_strength'
  | 'build_muscle'
  | 'lose_fat'
  | 'improve_endurance'
  | 'general_fitness'
  | 'event_preparation'
  | 'improve_mobility'
  | 'run_5k'
  | 'run_10k'
  | 'run_half_marathon'
  | 'run_marathon'
  | 'run_general'
  | 'hybrid_lift_run';

/**
 * Returns true when a PlanGoal is a run-mode training plan.
 * Used by the plan engine to branch into run-specific scheduling.
 */
export function isRunPlanGoal(goal: PlanGoal): boolean {
  return goal === 'run_5k' || goal === 'run_10k' ||
    goal === 'run_half_marathon' || goal === 'run_marathon' ||
    goal === 'run_general';
}

export function isHybridPlanGoal(goal: PlanGoal): boolean {
  return goal === 'hybrid_lift_run';
}

export type PlanPhase =
  | 'foundation'
  | 'build'
  | 'intensify'
  | 'peak'
  | 'deload'
  | 'taper'
  | 'test';

import { type FitnessLevel } from '@/constants/fitnessLevel';
export type ExperienceLevel = FitnessLevel;

export interface PlanGoalOption {
  id: PlanGoal;
  label: string;
  description: string;
  icon: string;
}

export const PLAN_GOALS: PlanGoalOption[] = [
  { id: 'build_strength', label: 'Build Strength', description: 'Increase maximal force output', icon: 'trending-up' },
  { id: 'build_muscle', label: 'Build Muscle', description: 'Hypertrophy-focused training', icon: 'dumbbell' },
  { id: 'lose_fat', label: 'Lose Fat', description: 'Body recomposition & fat loss', icon: 'scale' },
  { id: 'improve_endurance', label: 'Improve Endurance', description: 'Cardiovascular capacity', icon: 'heart' },
  { id: 'general_fitness', label: 'General Fitness', description: 'Well-rounded conditioning', icon: 'activity' },
  { id: 'event_preparation', label: 'Event Preparation', description: 'Peak for a specific competition', icon: 'trophy' },
  { id: 'improve_mobility', label: 'Improve Mobility', description: 'Flexibility & joint health', icon: 'wind' },
];

export const PLAN_EVENTS = [
  'Hyrox Race',
  'CrossFit Competition',
  '5K',
  '10K',
  'Half Marathon',
  'Marathon',
  'Powerlifting Meet',
  'Bodybuilding Show',
  'Olympic Weightlifting',
  'Obstacle Race',
  'Triathlon',
  'Military/Police Test',
  'No specific event',
] as const;

export type PlanEvent = typeof PLAN_EVENTS[number];

export const PLAN_LENGTHS = [4, 8, 12, 16] as const;
export type PlanLength = typeof PLAN_LENGTHS[number];

export const DAYS_PER_WEEK_OPTIONS = [2, 3, 4, 5, 6, 7] as const;
export const SESSION_DURATION_OPTIONS = [30, 45, 60, 75, 90] as const;

export interface PhaseWeek {
  week_number: number;
  phase: PlanPhase;
  volume_level: 'low' | 'moderate' | 'high' | 'very_high' | 'deload';
  intensity_rpe: number;
  volume_modifier: number;
  intensity_modifier: number;
  is_deload: boolean;
  notes: string;
}

export interface PhaseStructure {
  phases: PhaseWeek[];
}

const FOUR_WEEK_STRENGTH: PhaseWeek[] = [
  { week_number: 1, phase: 'foundation', volume_level: 'moderate', intensity_rpe: 6, volume_modifier: 0.85, intensity_modifier: 0.80, is_deload: false, notes: 'Build base volume' },
  { week_number: 2, phase: 'build', volume_level: 'high', intensity_rpe: 7, volume_modifier: 1.0, intensity_modifier: 0.85, is_deload: false, notes: 'Increase working sets' },
  { week_number: 3, phase: 'intensify', volume_level: 'very_high', intensity_rpe: 8, volume_modifier: 1.10, intensity_modifier: 0.92, is_deload: false, notes: 'Peak volume week' },
  { week_number: 4, phase: 'deload', volume_level: 'deload', intensity_rpe: 5, volume_modifier: 0.60, intensity_modifier: 0.70, is_deload: true, notes: 'Recovery & adaptation' },
];

const FOUR_WEEK_MUSCLE: PhaseWeek[] = [
  { week_number: 1, phase: 'foundation', volume_level: 'moderate', intensity_rpe: 6, volume_modifier: 0.90, intensity_modifier: 0.75, is_deload: false, notes: 'Accumulation phase' },
  { week_number: 2, phase: 'build', volume_level: 'high', intensity_rpe: 7, volume_modifier: 1.0, intensity_modifier: 0.80, is_deload: false, notes: 'Volume ramp' },
  { week_number: 3, phase: 'intensify', volume_level: 'very_high', intensity_rpe: 8, volume_modifier: 1.15, intensity_modifier: 0.85, is_deload: false, notes: 'Overreach' },
  { week_number: 4, phase: 'deload', volume_level: 'deload', intensity_rpe: 5, volume_modifier: 0.55, intensity_modifier: 0.65, is_deload: true, notes: 'Super-compensate' },
];

const FOUR_WEEK_FAT_LOSS: PhaseWeek[] = [
  { week_number: 1, phase: 'foundation', volume_level: 'high', intensity_rpe: 6, volume_modifier: 1.0, intensity_modifier: 0.75, is_deload: false, notes: 'High volume, moderate intensity' },
  { week_number: 2, phase: 'build', volume_level: 'high', intensity_rpe: 7, volume_modifier: 1.05, intensity_modifier: 0.80, is_deload: false, notes: 'Push conditioning' },
  { week_number: 3, phase: 'intensify', volume_level: 'very_high', intensity_rpe: 8, volume_modifier: 1.10, intensity_modifier: 0.85, is_deload: false, notes: 'Peak metabolic stress' },
  { week_number: 4, phase: 'deload', volume_level: 'deload', intensity_rpe: 5, volume_modifier: 0.60, intensity_modifier: 0.65, is_deload: true, notes: 'Active recovery' },
];

const FOUR_WEEK_ENDURANCE: PhaseWeek[] = [
  { week_number: 1, phase: 'foundation', volume_level: 'moderate', intensity_rpe: 5, volume_modifier: 0.85, intensity_modifier: 0.70, is_deload: false, notes: 'Aerobic base' },
  { week_number: 2, phase: 'build', volume_level: 'high', intensity_rpe: 6, volume_modifier: 1.0, intensity_modifier: 0.75, is_deload: false, notes: 'Build volume' },
  { week_number: 3, phase: 'intensify', volume_level: 'very_high', intensity_rpe: 7, volume_modifier: 1.10, intensity_modifier: 0.80, is_deload: false, notes: 'Tempo & threshold' },
  { week_number: 4, phase: 'deload', volume_level: 'deload', intensity_rpe: 4, volume_modifier: 0.55, intensity_modifier: 0.60, is_deload: true, notes: 'Recovery week' },
];

const FOUR_WEEK_GENERAL: PhaseWeek[] = [
  { week_number: 1, phase: 'foundation', volume_level: 'moderate', intensity_rpe: 6, volume_modifier: 0.90, intensity_modifier: 0.75, is_deload: false, notes: 'General conditioning' },
  { week_number: 2, phase: 'build', volume_level: 'high', intensity_rpe: 7, volume_modifier: 1.0, intensity_modifier: 0.80, is_deload: false, notes: 'Balanced training' },
  { week_number: 3, phase: 'intensify', volume_level: 'high', intensity_rpe: 8, volume_modifier: 1.05, intensity_modifier: 0.88, is_deload: false, notes: 'Challenge week' },
  { week_number: 4, phase: 'deload', volume_level: 'deload', intensity_rpe: 5, volume_modifier: 0.60, intensity_modifier: 0.68, is_deload: true, notes: 'Recover & adapt' },
];

// ─── Run Plan Phase Templates ──────────────────────────────────────────────
// Running requires gentler volume progression than strength (10% rule) and
// more emphasis on deload/recovery weeks to manage injury risk.

const FOUR_WEEK_RUN_5K: PhaseWeek[] = [
  { week_number: 1, phase: 'foundation', volume_level: 'moderate', intensity_rpe: 5, volume_modifier: 0.85, intensity_modifier: 0.70, is_deload: false, notes: 'Easy aerobic base — all miles conversational' },
  { week_number: 2, phase: 'build', volume_level: 'high', intensity_rpe: 6, volume_modifier: 1.0, intensity_modifier: 0.78, is_deload: false, notes: 'Add strides and short tempo' },
  { week_number: 3, phase: 'intensify', volume_level: 'high', intensity_rpe: 7, volume_modifier: 1.05, intensity_modifier: 0.85, is_deload: false, notes: 'Race-pace intervals + tempo' },
  { week_number: 4, phase: 'deload', volume_level: 'deload', intensity_rpe: 4, volume_modifier: 0.55, intensity_modifier: 0.65, is_deload: true, notes: 'Recovery week — all easy' },
];

const FOUR_WEEK_RUN_10K: PhaseWeek[] = [
  { week_number: 1, phase: 'foundation', volume_level: 'moderate', intensity_rpe: 5, volume_modifier: 0.85, intensity_modifier: 0.70, is_deload: false, notes: 'Build aerobic foundation' },
  { week_number: 2, phase: 'build', volume_level: 'high', intensity_rpe: 6, volume_modifier: 1.0, intensity_modifier: 0.78, is_deload: false, notes: 'Tempo + long run progression' },
  { week_number: 3, phase: 'intensify', volume_level: 'high', intensity_rpe: 7, volume_modifier: 1.08, intensity_modifier: 0.85, is_deload: false, notes: 'Cruise intervals at threshold' },
  { week_number: 4, phase: 'deload', volume_level: 'deload', intensity_rpe: 4, volume_modifier: 0.55, intensity_modifier: 0.65, is_deload: true, notes: 'Recovery week' },
];

const FOUR_WEEK_RUN_HALF: PhaseWeek[] = [
  { week_number: 1, phase: 'foundation', volume_level: 'moderate', intensity_rpe: 5, volume_modifier: 0.85, intensity_modifier: 0.70, is_deload: false, notes: 'Easy miles + 1 quality session' },
  { week_number: 2, phase: 'build', volume_level: 'high', intensity_rpe: 6, volume_modifier: 1.0, intensity_modifier: 0.75, is_deload: false, notes: 'Tempo + progressive long run' },
  { week_number: 3, phase: 'intensify', volume_level: 'very_high', intensity_rpe: 7, volume_modifier: 1.10, intensity_modifier: 0.82, is_deload: false, notes: 'Half-marathon pace work' },
  { week_number: 4, phase: 'deload', volume_level: 'deload', intensity_rpe: 4, volume_modifier: 0.55, intensity_modifier: 0.60, is_deload: true, notes: 'Recovery week' },
];

const FOUR_WEEK_RUN_MARATHON: PhaseWeek[] = [
  { week_number: 1, phase: 'foundation', volume_level: 'moderate', intensity_rpe: 5, volume_modifier: 0.85, intensity_modifier: 0.68, is_deload: false, notes: 'Build aerobic base, gentle miles' },
  { week_number: 2, phase: 'build', volume_level: 'high', intensity_rpe: 6, volume_modifier: 1.0, intensity_modifier: 0.72, is_deload: false, notes: 'Long run progression + tempo' },
  { week_number: 3, phase: 'intensify', volume_level: 'very_high', intensity_rpe: 7, volume_modifier: 1.10, intensity_modifier: 0.78, is_deload: false, notes: 'Marathon-pace segments, peak long run' },
  { week_number: 4, phase: 'deload', volume_level: 'deload', intensity_rpe: 4, volume_modifier: 0.55, intensity_modifier: 0.60, is_deload: true, notes: 'Recovery week — reset for next block' },
];

const FOUR_WEEK_RUN_GENERAL: PhaseWeek[] = [
  { week_number: 1, phase: 'foundation', volume_level: 'moderate', intensity_rpe: 5, volume_modifier: 0.90, intensity_modifier: 0.72, is_deload: false, notes: 'Easy base week' },
  { week_number: 2, phase: 'build', volume_level: 'high', intensity_rpe: 6, volume_modifier: 1.0, intensity_modifier: 0.78, is_deload: false, notes: 'Tempo week' },
  { week_number: 3, phase: 'intensify', volume_level: 'high', intensity_rpe: 7, volume_modifier: 1.05, intensity_modifier: 0.82, is_deload: false, notes: 'Speed week — intervals' },
  { week_number: 4, phase: 'deload', volume_level: 'deload', intensity_rpe: 4, volume_modifier: 0.60, intensity_modifier: 0.65, is_deload: true, notes: 'Recovery week' },
];

// ─── Run Plan Configuration ────────────────────────────────────────────────
// Each run goal has a default plan length, days/week, target race distance,
// and typical weekly mileage progression. Used by the builder + engine.

export type RunType =
  | 'easy'
  | 'tempo'
  | 'threshold'
  | 'long_run'
  | 'interval'
  | 'recovery'
  | 'race_pace'
  | 'fartlek'
  | 'hill_repeats'
  | 'progression'
  | 'race';

export interface RunPlanConfig {
  id: PlanGoal;
  label: string;
  shortLabel: string;
  description: string;
  icon: string;
  defaultWeeks: 4 | 8 | 10 | 12 | 16;
  defaultDaysPerWeek: 3 | 4 | 5 | 6;
  raceDistanceMiles: number | null; // null for general running
  longRunPeakMiles: number; // peak long-run distance in the program
  /** Approximate starting weekly mileage in miles, scaled by experience level */
  startingWeeklyMilesByLevel: { beginner: number; intermediate: number; advanced: number };
  /** Approximate peak weekly mileage before taper */
  peakWeeklyMilesByLevel: { beginner: number; intermediate: number; advanced: number };
  event?: string; // matches PLAN_EVENTS entry if this goal maps to a race event
}

export const RUN_PLAN_CONFIGS: Record<Extract<PlanGoal, 'run_5k' | 'run_10k' | 'run_half_marathon' | 'run_marathon' | 'run_general'>, RunPlanConfig> = {
  run_5k: {
    id: 'run_5k',
    label: '5K Training',
    shortLabel: '5K',
    description: 'Train for a 5K race — 3-4 runs/week with speed work.',
    icon: 'figure-run',
    defaultWeeks: 8,
    defaultDaysPerWeek: 4,
    raceDistanceMiles: 3.1,
    longRunPeakMiles: 5,
    startingWeeklyMilesByLevel: { beginner: 8,  intermediate: 15, advanced: 22 },
    peakWeeklyMilesByLevel:     { beginner: 15, intermediate: 25, advanced: 35 },
    event: '5K',
  },
  run_10k: {
    id: 'run_10k',
    label: '10K Training',
    shortLabel: '10K',
    description: 'Build to a 10K race with tempo + long runs.',
    icon: 'figure-run',
    defaultWeeks: 10,
    defaultDaysPerWeek: 4,
    raceDistanceMiles: 6.2,
    longRunPeakMiles: 8,
    startingWeeklyMilesByLevel: { beginner: 10, intermediate: 18, advanced: 28 },
    peakWeeklyMilesByLevel:     { beginner: 20, intermediate: 32, advanced: 45 },
    event: '10K',
  },
  run_half_marathon: {
    id: 'run_half_marathon',
    label: 'Half Marathon',
    shortLabel: 'Half',
    description: '12-week plan with progressive long runs to 12 miles.',
    icon: 'figure-run',
    defaultWeeks: 12,
    defaultDaysPerWeek: 4,
    raceDistanceMiles: 13.1,
    longRunPeakMiles: 12,
    startingWeeklyMilesByLevel: { beginner: 12, intermediate: 22, advanced: 32 },
    peakWeeklyMilesByLevel:     { beginner: 25, intermediate: 40, advanced: 55 },
    event: 'Half Marathon',
  },
  run_marathon: {
    id: 'run_marathon',
    label: 'Marathon',
    shortLabel: 'Marathon',
    description: '16-week marathon build, peak 20-mile long run.',
    icon: 'figure-run',
    defaultWeeks: 16,
    defaultDaysPerWeek: 5,
    raceDistanceMiles: 26.2,
    longRunPeakMiles: 20,
    startingWeeklyMilesByLevel: { beginner: 18, intermediate: 28, advanced: 40 },
    peakWeeklyMilesByLevel:     { beginner: 35, intermediate: 50, advanced: 70 },
    event: 'Marathon',
  },
  run_general: {
    id: 'run_general',
    label: 'General Running',
    shortLabel: 'General',
    description: 'Ongoing fitness — rotating easy/tempo/speed/recovery weeks.',
    icon: 'figure-run',
    defaultWeeks: 8,
    defaultDaysPerWeek: 4,
    raceDistanceMiles: null,
    longRunPeakMiles: 6,
    startingWeeklyMilesByLevel: { beginner: 8,  intermediate: 15, advanced: 25 },
    peakWeeklyMilesByLevel:     { beginner: 16, intermediate: 28, advanced: 42 },
  },
};

export const RUN_PLAN_GOAL_OPTIONS: RunPlanConfig[] = [
  RUN_PLAN_CONFIGS.run_5k,
  RUN_PLAN_CONFIGS.run_10k,
  RUN_PLAN_CONFIGS.run_half_marathon,
  RUN_PLAN_CONFIGS.run_marathon,
  RUN_PLAN_CONFIGS.run_general,
];

function repeat4WeekBlock(block: PhaseWeek[], times: number): PhaseWeek[] {
  const result: PhaseWeek[] = [];
  for (let cycle = 0; cycle < times; cycle++) {
    for (const week of block) {
      result.push({
        ...week,
        week_number: cycle * 4 + week.week_number,
        volume_modifier: Math.min(1.30, week.volume_modifier + cycle * 0.03),
        intensity_modifier: Math.min(1.0, week.intensity_modifier + cycle * 0.03),
      });
    }
  }
  return result;
}

function build8WeekPhases(base4: PhaseWeek[]): PhaseWeek[] {
  return repeat4WeekBlock(base4, 2);
}

function build12WeekPhases(base4: PhaseWeek[]): PhaseWeek[] {
  return repeat4WeekBlock(base4, 3);
}

function build16WeekPhases(base4: PhaseWeek[]): PhaseWeek[] {
  return repeat4WeekBlock(base4, 4);
}

function getBaseBlock(goal: PlanGoal): PhaseWeek[] {
  switch (goal) {
    case 'build_strength': return FOUR_WEEK_STRENGTH;
    case 'build_muscle': return FOUR_WEEK_MUSCLE;
    case 'lose_fat': return FOUR_WEEK_FAT_LOSS;
    case 'improve_endurance': return FOUR_WEEK_ENDURANCE;
    case 'general_fitness': return FOUR_WEEK_GENERAL;
    case 'event_preparation': return FOUR_WEEK_STRENGTH;
    case 'improve_mobility': return FOUR_WEEK_ENDURANCE;
    case 'run_5k': return FOUR_WEEK_RUN_5K;
    case 'run_10k': return FOUR_WEEK_RUN_10K;
    case 'run_half_marathon': return FOUR_WEEK_RUN_HALF;
    case 'run_marathon': return FOUR_WEEK_RUN_MARATHON;
    case 'run_general': return FOUR_WEEK_RUN_GENERAL;
    // Hybrid — generic balanced block, overridden by run sub-goal in engine
    case 'hybrid_lift_run': return FOUR_WEEK_GENERAL;
    default: return FOUR_WEEK_GENERAL;
  }
}

export function getPhaseStructure(planLength: PlanLength, goal: PlanGoal): PhaseWeek[] {
  const base = getBaseBlock(goal);
  switch (planLength) {
    case 4: return base;
    case 8: return build8WeekPhases(base);
    case 12: return build12WeekPhases(base);
    case 16: return build16WeekPhases(base);
    default: return base;
  }
}

export const PHASE_REP_RANGES: Record<PlanPhase, { min_reps: number; max_reps: number; load_pct: number }> = {
  foundation: { min_reps: 10, max_reps: 15, load_pct: 0.65 },
  build:      { min_reps: 8,  max_reps: 12, load_pct: 0.72 },
  intensify:  { min_reps: 4,  max_reps: 8,  load_pct: 0.82 },
  peak:       { min_reps: 1,  max_reps: 5,  load_pct: 0.90 },
  deload:     { min_reps: 8,  max_reps: 12, load_pct: 0.55 },
  taper:      { min_reps: 3,  max_reps: 6,  load_pct: 0.75 },
  test:       { min_reps: 1,  max_reps: 3,  load_pct: 0.95 },
};

export const PHASE_DISPLAY_NAMES: Record<PlanPhase, string> = {
  foundation: 'Foundation',
  build: 'Build',
  intensify: 'Intensify',
  peak: 'Peak',
  deload: 'Deload',
  taper: 'Taper',
  test: 'Test',
};

export const PHASE_COLORS: Record<PlanPhase, string> = {
  foundation: '#3b82f6',
  build: '#f59e0b',
  intensify: '#ef4444',
  peak: '#8b5cf6',
  deload: '#22c55e',
  taper: '#06b6d4',
  test: '#ec4899',
};

export const EXPERIENCE_MODIFIERS: Record<ExperienceLevel, {
  progression_rate: number;
  deload_frequency_weeks: number;
  volume_cap: number;
  intensity_cap_rpe: number;
}> = {
  beginner: {
    progression_rate: 0.85,
    deload_frequency_weeks: 4,
    volume_cap: 1.0,
    intensity_cap_rpe: 7,
  },
  intermediate: {
    progression_rate: 1.0,
    deload_frequency_weeks: 4,
    volume_cap: 1.15,
    intensity_cap_rpe: 9,
  },
  advanced: {
    progression_rate: 1.15,
    deload_frequency_weeks: 3,
    volume_cap: 1.30,
    intensity_cap_rpe: 10,
  },
};

export interface WeeklyTemplate {
  day_number: number;
  is_rest: boolean;
  style: string;
  session_type: string;
  rest_suggestion?: string;
}

export const REST_DAY_SUGGESTIONS = [
  'Light walk — 20 min',
  'Foam rolling + stretching — 15 min',
  'Full rest',
  'Yoga or light mobility — 20 min',
  'Active recovery swim — 20 min',
  'Gentle cycling — 20 min',
] as const;

export const EVENT_TAPER_WEEKS: Record<string, number> = {
  'Hyrox Race': 2,
  'CrossFit Competition': 1,
  '5K': 1,
  '10K': 1,
  'Half Marathon': 2,
  'Marathon': 3,
  'Powerlifting Meet': 2,
  'Bodybuilding Show': 2,
  'Olympic Weightlifting': 2,
  'Obstacle Race': 1,
  'Triathlon': 2,
  'Military/Police Test': 1,
};

export const EVENT_SPECIFIC_MODIFICATIONS: Record<string, {
  add_simulation_weeks: boolean;
  add_long_session: boolean;
  peak_style_override?: string;
  notes: string;
}> = {
  'Hyrox Race': { add_simulation_weeks: true, add_long_session: false, peak_style_override: 'Hyrox', notes: 'Add full/half simulations in final weeks' },
  'CrossFit Competition': { add_simulation_weeks: false, add_long_session: false, peak_style_override: 'CrossFit', notes: 'Varied WODs, test benchmark workouts' },
  '5K': { add_simulation_weeks: false, add_long_session: true, notes: 'Build to race-pace intervals' },
  '10K': { add_simulation_weeks: false, add_long_session: true, notes: 'Tempo runs + long runs' },
  'Half Marathon': { add_simulation_weeks: false, add_long_session: true, notes: 'Progressive long runs to 10+ miles' },
  'Marathon': { add_simulation_weeks: false, add_long_session: true, notes: 'Peak long run 20 miles, then taper' },
  'Powerlifting Meet': { add_simulation_weeks: true, add_long_session: false, peak_style_override: 'Strength', notes: 'Peak SBD, practice openers' },
  'Bodybuilding Show': { add_simulation_weeks: false, add_long_session: false, peak_style_override: 'Bodybuilding', notes: 'Peak week water/carb manipulation' },
  'Olympic Weightlifting': { add_simulation_weeks: true, add_long_session: false, peak_style_override: 'Strength', notes: 'Peak snatch + C&J' },
  'Obstacle Race': { add_simulation_weeks: false, add_long_session: true, notes: 'Grip endurance + running' },
  'Triathlon': { add_simulation_weeks: false, add_long_session: true, notes: 'Brick workouts in final phase' },
  'Military/Police Test': { add_simulation_weeks: true, add_long_session: true, notes: 'Practice test events under time pressure' },
};

export const VOLUME_GUARDRAILS = {
  max_sets_per_muscle_per_week: 25,
  min_sets_per_muscle_per_week: 6,
  max_consecutive_same_muscle_days: 1,
  min_rest_days_per_week: 1,
  max_training_days_per_week: 7,
} as const;

export const MISSED_DAY_RULES = {
  slide_forward_threshold: 2,
  resume_threshold: 3,
  repeat_week_threshold_days: 7,
  restart_phase_threshold_days: 14,
} as const;

// ═══════════════════════════════════════════════════════════════════════
// HYBRID PLAN CONFIGURATION (lift + run)
// ═══════════════════════════════════════════════════════════════════════

export interface HybridPlanConfig {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: string;
  strengthStyle: string;              // 'Strength' | 'Bodybuilding' | 'General Fitness'
  strengthSplit: string;              // one of SPLIT_NAME_TO_ROTATION keys
  runGoal: Extract<PlanGoal, 'run_5k' | 'run_10k' | 'run_half_marathon' | 'run_marathon' | 'run_general'>;
  defaultWeeks: 4 | 8 | 10 | 12 | 16;
  defaultTotalDays: number;
  defaultStrengthDays: number;
  defaultRunDays: number;
}

export const HYBRID_PLAN_PRESETS: HybridPlanConfig[] = [
  {
    id: 'hybrid_strength_5k',
    label: 'Strength + 5K',
    shortLabel: 'Lift + 5K',
    description: '8 weeks — Push/Pull/Legs + speed-focused running',
    icon: 'figure-run',
    strengthStyle: 'Strength',
    strengthSplit: 'Push / Pull / Legs',
    runGoal: 'run_5k',
    defaultWeeks: 8,
    defaultTotalDays: 5,
    defaultStrengthDays: 3,
    defaultRunDays: 2,
  },
  {
    id: 'hybrid_bb_half',
    label: 'Bodybuilding + Half Marathon',
    shortLabel: 'BB + Half',
    description: '12 weeks — Upper/Lower split + endurance running',
    icon: 'figure-run',
    strengthStyle: 'Bodybuilding',
    strengthSplit: 'Upper / Lower',
    runGoal: 'run_half_marathon',
    defaultWeeks: 12,
    defaultTotalDays: 6,
    defaultStrengthDays: 3,
    defaultRunDays: 3,
  },
  {
    id: 'hybrid_general_fitness',
    label: 'General Fitness Hybrid',
    shortLabel: 'Fitness Hybrid',
    description: '8 weeks — Full-body lifts + easy/tempo running',
    icon: 'figure-run',
    strengthStyle: 'Strength',
    strengthSplit: 'Full Body',
    runGoal: 'run_general',
    defaultWeeks: 8,
    defaultTotalDays: 5,
    defaultStrengthDays: 3,
    defaultRunDays: 2,
  },
  {
    id: 'hybrid_race_prep',
    label: 'Marathon + Strength',
    shortLabel: 'Marathon Hybrid',
    description: '16 weeks — maintenance lifts + full marathon program',
    icon: 'figure-run',
    strengthStyle: 'Strength',
    strengthSplit: 'Upper / Lower',
    runGoal: 'run_marathon',
    defaultWeeks: 16,
    defaultTotalDays: 6,
    defaultStrengthDays: 3,
    defaultRunDays: 3,
  },
  {
    id: 'hybrid_strength_10k',
    label: 'Strength + 10K',
    shortLabel: 'Lift + 10K',
    description: '10 weeks — PPL strength + 10K race prep',
    icon: 'figure-run',
    strengthStyle: 'Strength',
    strengthSplit: 'Push / Pull / Legs',
    runGoal: 'run_10k',
    defaultWeeks: 10,
    defaultTotalDays: 5,
    defaultStrengthDays: 3,
    defaultRunDays: 2,
  },
];

// ─── Weekly Template Allocator ──────────────────────────────────────────
// Decides which day-of-week is strength / run / rest, with smart placement
// rules: long run on Sunday, hard run ≥2 days from leg day, ≥1 rest/week.

export interface HybridSlot {
  day_of_week: number; // 0=Sun..6=Sat
  activity_type: 'strength' | 'run' | 'rest';
  /** For run slots — which run type to prescribe. */
  run_type?: RunType;
  /** For strength slots — optional explicit session override (e.g. 'Legs', 'Push'). */
  strength_session?: string;
}

/** The rotations we know how to smart-place — maps split name to its session array. */
const HYBRID_STRENGTH_ROTATIONS: Record<string, string[]> = {
  'Full Body': ['Full Body'],
  'Upper / Lower': ['Upper', 'Lower'],
  'Push / Pull / Legs': ['Push', 'Pull', 'Legs'],
  'Upper / Lower / Full': ['Upper', 'Lower', 'Full Body'],
};

/** Identifies the "legs" session label in a rotation, if any. */
function findLegsLabel(rotation: string[]): string | null {
  for (const s of rotation) {
    const lower = s.toLowerCase();
    if (lower === 'legs' || lower === 'lower' || lower === 'lower body') return s;
  }
  return null;
}

/**
 * Build a 7-slot hybrid weekly template.
 *
 * Invariants:
 *   - Long run on Sunday when runDays ≥ 1
 *   - Tempo/interval run (hard run) ≥ 1 rest day from any legs/lower strength day
 *   - At least 1 rest day per week
 *   - strengthDays + runDays + restDays === 7
 */
export function buildHybridWeeklyTemplate(
  strengthDays: number,
  runDays: number,
  strengthSplit: string,
  runGoal: PlanGoal,
): HybridSlot[] {
  const rotation = HYBRID_STRENGTH_ROTATIONS[strengthSplit] ?? ['Full Body'];
  const legsLabel = findLegsLabel(rotation);

  const hasSpeedFocus = runGoal === 'run_5k' || runGoal === 'run_10k' || runGoal === 'run_general';

  // Hand-crafted templates keyed by (strengthDays, runDays, split)
  const key = `${strengthDays}S_${runDays}R`;

  // ─── 2S + 2R (4 days total) ──────────────────────────────────────────
  if (key === '2S_2R') {
    return [
      { day_of_week: 0, activity_type: 'run', run_type: 'long_run' },
      { day_of_week: 1, activity_type: 'rest' },
      { day_of_week: 2, activity_type: 'strength', strength_session: rotation[0] },
      { day_of_week: 3, activity_type: 'rest' },
      { day_of_week: 4, activity_type: 'run', run_type: 'easy' },
      { day_of_week: 5, activity_type: 'strength', strength_session: rotation[1 % rotation.length] },
      { day_of_week: 6, activity_type: 'rest' },
    ];
  }

  // ─── 3S + 2R (5 days total) — typical hybrid ─────────────────────────
  if (key === '3S_2R') {
    // Place legs on Tuesday (5 days from Sun long run), upper on Thu/Sat
    if (legsLabel && rotation.length >= 2) {
      const nonLegs = rotation.filter(s => s !== legsLabel);
      return [
        { day_of_week: 0, activity_type: 'run', run_type: 'long_run' },
        { day_of_week: 1, activity_type: 'rest' },
        { day_of_week: 2, activity_type: 'strength', strength_session: legsLabel },
        { day_of_week: 3, activity_type: 'run', run_type: 'easy' },
        { day_of_week: 4, activity_type: 'strength', strength_session: nonLegs[0] },
        { day_of_week: 5, activity_type: 'rest' },
        { day_of_week: 6, activity_type: 'strength', strength_session: nonLegs[1 % nonLegs.length] ?? nonLegs[0] },
      ];
    }
    // Full Body — cycle naturally
    return [
      { day_of_week: 0, activity_type: 'run', run_type: 'long_run' },
      { day_of_week: 1, activity_type: 'rest' },
      { day_of_week: 2, activity_type: 'strength', strength_session: rotation[0] },
      { day_of_week: 3, activity_type: 'run', run_type: 'easy' },
      { day_of_week: 4, activity_type: 'strength', strength_session: rotation[1 % rotation.length] },
      { day_of_week: 5, activity_type: 'rest' },
      { day_of_week: 6, activity_type: 'strength', strength_session: rotation[2 % rotation.length] },
    ];
  }

  // ─── 2S + 3R (5 days total) — run-priority hybrid ────────────────────
  if (key === '2S_3R') {
    const hardRun: RunType = hasSpeedFocus ? 'interval' : 'tempo';
    return [
      { day_of_week: 0, activity_type: 'run', run_type: 'long_run' },
      { day_of_week: 1, activity_type: 'strength', strength_session: rotation[0] },
      { day_of_week: 2, activity_type: 'rest' },
      { day_of_week: 3, activity_type: 'run', run_type: 'easy' },
      { day_of_week: 4, activity_type: 'strength', strength_session: rotation[1 % rotation.length] },
      { day_of_week: 5, activity_type: 'rest' },
      { day_of_week: 6, activity_type: 'run', run_type: hardRun },
    ];
  }

  // ─── 3S + 3R (6 days total) — balanced race-prep ─────────────────────
  if (key === '3S_3R') {
    const hardRun: RunType = hasSpeedFocus ? 'interval' : 'tempo';
    if (legsLabel && rotation.length >= 2) {
      const nonLegs = rotation.filter(s => s !== legsLabel);
      return [
        { day_of_week: 0, activity_type: 'run', run_type: 'long_run' },
        { day_of_week: 1, activity_type: 'strength', strength_session: nonLegs[0] },
        { day_of_week: 2, activity_type: 'run', run_type: 'easy' },
        { day_of_week: 3, activity_type: 'strength', strength_session: legsLabel },
        { day_of_week: 4, activity_type: 'rest' },
        { day_of_week: 5, activity_type: 'run', run_type: hardRun },
        { day_of_week: 6, activity_type: 'strength', strength_session: nonLegs[1 % nonLegs.length] ?? nonLegs[0] },
      ];
    }
    return [
      { day_of_week: 0, activity_type: 'run', run_type: 'long_run' },
      { day_of_week: 1, activity_type: 'strength', strength_session: rotation[0] },
      { day_of_week: 2, activity_type: 'run', run_type: 'easy' },
      { day_of_week: 3, activity_type: 'strength', strength_session: rotation[1 % rotation.length] },
      { day_of_week: 4, activity_type: 'rest' },
      { day_of_week: 5, activity_type: 'run', run_type: hardRun },
      { day_of_week: 6, activity_type: 'strength', strength_session: rotation[2 % rotation.length] },
    ];
  }

  // ─── 4S + 2R (6 days total) — strength-priority hybrid ───────────────
  if (key === '4S_2R') {
    // Place legs mid-week, keep Sat light for long run Sun
    if (legsLabel && rotation.length >= 2) {
      const nonLegs = rotation.filter(s => s !== legsLabel);
      return [
        { day_of_week: 0, activity_type: 'run', run_type: 'long_run' },
        { day_of_week: 1, activity_type: 'strength', strength_session: nonLegs[0] },
        { day_of_week: 2, activity_type: 'strength', strength_session: legsLabel },
        { day_of_week: 3, activity_type: 'run', run_type: 'easy' },
        { day_of_week: 4, activity_type: 'strength', strength_session: nonLegs[1 % nonLegs.length] ?? nonLegs[0] },
        { day_of_week: 5, activity_type: 'rest' },
        { day_of_week: 6, activity_type: 'strength', strength_session: nonLegs[0] }, // Upper-focus Sat before long run
      ];
    }
    return [
      { day_of_week: 0, activity_type: 'run', run_type: 'long_run' },
      { day_of_week: 1, activity_type: 'strength', strength_session: rotation[0] },
      { day_of_week: 2, activity_type: 'strength', strength_session: rotation[1 % rotation.length] },
      { day_of_week: 3, activity_type: 'run', run_type: 'easy' },
      { day_of_week: 4, activity_type: 'strength', strength_session: rotation[2 % rotation.length] },
      { day_of_week: 5, activity_type: 'rest' },
      { day_of_week: 6, activity_type: 'strength', strength_session: rotation[3 % rotation.length] },
    ];
  }

  // ─── Fallback algorithmic allocator ──────────────────────────────────
  // Used for combos not covered above (1S+2R, 2S+1R, 4S+3R, etc).
  return fallbackHybridTemplate(strengthDays, runDays, rotation, hasSpeedFocus);
}

function fallbackHybridTemplate(
  strengthDays: number,
  runDays: number,
  rotation: string[],
  hasSpeedFocus: boolean,
): HybridSlot[] {
  const slots: HybridSlot[] = Array.from({ length: 7 }, (_, i) => ({
    day_of_week: i,
    activity_type: 'rest' as const,
  }));

  // 1. Long run Sunday
  let runsLeft = runDays;
  if (runsLeft >= 1) {
    slots[0] = { day_of_week: 0, activity_type: 'run', run_type: 'long_run' };
    runsLeft--;
  }

  // 2. Easy/Hard runs — spread Wed, then Fri, then Tue
  const runPreference = [3, 5, 2, 4];
  const hardRun: RunType = hasSpeedFocus ? 'interval' : 'tempo';
  const runTypes: RunType[] = runsLeft >= 2 ? ['easy', hardRun] : ['easy'];
  for (let i = 0; i < runsLeft && i < runPreference.length; i++) {
    const dow = runPreference[i];
    if (slots[dow].activity_type === 'rest') {
      slots[dow] = { day_of_week: dow, activity_type: 'run', run_type: runTypes[i] ?? 'easy' };
    }
  }

  // 3. Fill strength slots in preferred slots
  const strengthPreference = [2, 4, 6, 1, 3, 5];
  let rotIdx = 0;
  for (const dow of strengthPreference) {
    if (strengthDays <= 0) break;
    if (slots[dow].activity_type === 'rest') {
      slots[dow] = {
        day_of_week: dow,
        activity_type: 'strength',
        strength_session: rotation[rotIdx % rotation.length],
      };
      rotIdx++;
      strengthDays--;
    }
  }

  return slots;
}
