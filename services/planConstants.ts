console.log('[PlanConstants] Loading Phase 5 plan generation constants');

export type PlanGoal =
  | 'build_strength'
  | 'build_muscle'
  | 'lose_fat'
  | 'improve_endurance'
  | 'general_fitness'
  | 'event_preparation'
  | 'improve_mobility';

export type PlanPhase =
  | 'foundation'
  | 'build'
  | 'intensify'
  | 'peak'
  | 'deload'
  | 'taper'
  | 'test';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export interface PlanGoalOption {
  id: PlanGoal;
  label: string;
  description: string;
  icon: string;
}

export const PLAN_GOALS: PlanGoalOption[] = [
  { id: 'build_strength', label: 'Build Strength', description: 'Increase maximal force output', icon: 'trending' },
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
