import {
  type PlanGoal,
  type PlanPhase,
  type PlanLength,
  type ExperienceLevel,
  type PhaseWeek,
  type WeeklyTemplate,
  type RunType,
  type RunPlanConfig,
  type HybridSlot,
  RUN_PLAN_CONFIGS,
  isRunPlanGoal,
  buildHybridWeeklyTemplate,
  getPhaseStructure,
  EXPERIENCE_MODIFIERS,
  REST_DAY_SUGGESTIONS,
  EVENT_TAPER_WEEKS,
  EVENT_SPECIFIC_MODIFICATIONS,
  VOLUME_GUARDRAILS,
  MISSED_DAY_RULES,
  PHASE_REP_RANGES,
} from '@/services/planConstants';

import { WORKOUT_SESSION_CONFIG } from '@/services/workoutConfig';

export interface DayPrescription {
  day_of_week: number;
  week_number: number;
  date: string;
  phase: PlanPhase;
  style: string;
  session_type: string;
  target_duration: number;
  volume_modifier: number;
  intensity_modifier: number;
  is_rest: boolean;
  rest_suggestion: string;
  notes: string;
  is_deload_week: boolean;
  event_milestone?: string;
  // ── Run-specific fields (populated only for run-mode plans) ────────────
  /** Activity type: 'strength' | 'run' | 'rest' — defaults to 'strength' on existing plans */
  activity_type?: 'strength' | 'run' | 'rest' | 'cross_train';
  /** Run workout classification (easy, tempo, long_run, etc) */
  run_type?: RunType;
  /** Target distance in miles for run prescriptions */
  target_distance_miles?: number;
  /** Target pace range (seconds per mile) for the prescribed effort */
  target_pace_min_sec_per_mile?: number;
  target_pace_max_sec_per_mile?: number;
  /** Short human-readable description: "4 miles easy + 6x strides" */
  run_description?: string;
  /** Structured interval spec for interval/fartlek/hill workouts */
  intervals?: {
    warmup_minutes?: number;
    cooldown_minutes?: number;
    repeats: {
      work_seconds?: number;
      work_distance_meters?: number;
      recovery_seconds?: number;
      count: number;
      target_pace_sec_per_mile?: number;
      description?: string;
    }[];
  };
}

export interface GeneratedPlanSchedule {
  weeks: WeekSchedule[];
  total_training_days: number;
  total_rest_days: number;
  phases_used: PlanPhase[];
}

export interface WeekSchedule {
  week_number: number;
  phase: PlanPhase;
  phase_week: PhaseWeek;
  days: DayPrescription[];
  is_deload: boolean;
  notes: string;
}

export interface PlanGenerationInput {
  goal: PlanGoal;
  style: string;
  event: string[];
  daysPerWeek: number;
  sessionDuration: number;
  experienceLevel: ExperienceLevel;
  planLength: PlanLength;
  startDate: string;
  trainingSplit?: string;
  is75Hard?: boolean;
}

function addDays(dateStr: string, days: number): string {
  // Use UTC to avoid DST shifts — local midnight can jump to previous day during spring-forward
  const [y, m, d] = dateStr.split('-').map(Number);
  const ms = Date.UTC(y, m - 1, d) + days * 86_400_000;
  const result = new Date(ms);
  return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, '0')}-${String(result.getUTCDate()).padStart(2, '0')}`;
}

function getDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00');
  return d.getDay();
}

function buildWeeklyTemplate(
  daysPerWeek: number,
  style: string,
  goal: PlanGoal,
  trainingSplit?: string,
): WeeklyTemplate[] {
  __DEV__ && console.log('[PlanEngine] Building weekly template: days=', daysPerWeek, 'style=', style, 'split=', trainingSplit);

  const template: WeeklyTemplate[] = [];
  const totalDays = 7;
  const restDays = totalDays - daysPerWeek;

  const trainingDayIndices: number[] = [];
  if (daysPerWeek <= 3) {
    const spread = [1, 3, 5];
    for (let i = 0; i < daysPerWeek; i++) {
      trainingDayIndices.push(spread[i]);
    }
  } else if (daysPerWeek === 4) {
    trainingDayIndices.push(1, 2, 4, 5);
  } else if (daysPerWeek === 5) {
    trainingDayIndices.push(1, 2, 3, 5, 6);
  } else if (daysPerWeek === 6) {
    trainingDayIndices.push(1, 2, 3, 4, 5, 6);
  } else {
    for (let i = 0; i < 7; i++) trainingDayIndices.push(i);
  }

  const trainingSet = new Set(trainingDayIndices);
  let sessionIdx = 0;

  const splitRotation = getSplitRotation(style, daysPerWeek, goal, trainingSplit);

  for (let dayNum = 0; dayNum < 7; dayNum++) {
    if (trainingSet.has(dayNum)) {
      const sessionType = splitRotation[sessionIdx % splitRotation.length];
      template.push({
        day_number: dayNum,
        is_rest: false,
        style,
        session_type: sessionType,
      });
      sessionIdx++;
    } else {
      const suggestion = REST_DAY_SUGGESTIONS[dayNum % REST_DAY_SUGGESTIONS.length];
      template.push({
        day_number: dayNum,
        is_rest: true,
        style: '',
        session_type: '',
        rest_suggestion: suggestion,
      });
    }
  }

  return template;
}

const SPLIT_NAME_TO_ROTATION: Record<string, string[]> = {
  'Full Body':             ['Full Body'],
  'Upper / Lower':         ['Upper', 'Lower'],
  'Push / Pull / Legs':    ['Push', 'Pull', 'Legs'],
  'Upper / Lower / Full':  ['Upper', 'Lower', 'Full Body'],
  'Body Part Split':       ['Chest', 'Back', 'Shoulders', 'Legs', 'Arms', 'Full Body'],
};

function getSplitRotation(style: string, daysPerWeek: number, goal: PlanGoal, trainingSplit?: string): string[] {
  // If user explicitly selected a split, expand it to fill daysPerWeek
  if (trainingSplit) {
    const base = SPLIT_NAME_TO_ROTATION[trainingSplit];
    if (base) {
      const rotation: string[] = [];
      for (let i = 0; i < daysPerWeek; i++) {
        rotation.push(base[i % base.length]);
      }
      return rotation;
    }
  }
  // Fallback: hardcoded rotation for styles that don't use user-selected splits
  switch (style) {
    case 'Strength':
    case 'Bodybuilding': {
      if (daysPerWeek <= 2) return ['Full Body', 'Full Body'];
      if (daysPerWeek === 3) return ['Push', 'Pull', 'Legs'];
      if (daysPerWeek === 4) return ['Upper', 'Lower', 'Upper', 'Lower'];
      if (daysPerWeek === 5) return ['Push', 'Pull', 'Legs', 'Upper', 'Lower'];
      if (daysPerWeek === 6) return ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'];
      return ['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full Body', 'Full Body'];
    }
    case 'Hybrid': {
      if (daysPerWeek <= 2) return ['Full Body', 'Full Body'];
      if (daysPerWeek === 3) return ['Push', 'Pull', 'Legs'];
      if (daysPerWeek === 4) return ['Upper', 'Lower', 'Upper', 'Lower'];
      if (daysPerWeek === 5) return ['Push', 'Pull', 'Legs', 'Upper', 'Lower'];
      if (daysPerWeek === 6) return ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'];
      return ['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full Body', 'Full Body'];
    }
    case 'CrossFit':
      return ['Auto', 'Auto', 'Auto', 'Auto', 'Auto', 'Auto', 'Auto'].slice(0, daysPerWeek);
    case 'Hyrox': {
      if (daysPerWeek <= 2) return ['Auto', 'Auto'];
      if (daysPerWeek === 3) return ['Strength Circuit', 'Compromised Run', 'Station Practice'];
      if (daysPerWeek === 4) return ['Strength Circuit', 'Compromised Run', 'Station Practice', 'Half Simulation'];
      if (daysPerWeek === 5) return ['Strength Circuit', 'Compromised Run', 'Station Practice', 'Half Simulation', 'Full Simulation'];
      return ['Strength Circuit', 'Compromised Run', 'Station Practice', 'Half Simulation', 'Full Simulation', 'Auto'].slice(0, daysPerWeek);
    }
    case 'HIIT': {
      if (daysPerWeek <= 2) return ['Full Body', 'Full Body'];
      if (daysPerWeek === 3) return ['Full Body', 'Upper', 'Lower'];
      return ['Full Body', 'Upper', 'Lower', 'Core Blast', 'Full Body'].slice(0, daysPerWeek);
    }
    case 'Mobility':
      return ['Full-Body Flow', 'Targeted', 'Foam Rolling + Stretch', 'Recovery Day', 'Auto', 'Full-Body Flow', 'Targeted'].slice(0, daysPerWeek);
    case 'Pilates':
      return ['Classical Mat Flow', 'Themed Flow', 'Pilates Circuit', 'Reformer Flow', 'Auto', 'Classical Mat Flow', 'Themed Flow'].slice(0, daysPerWeek);
    case 'Low-Impact': {
      if (daysPerWeek <= 2) return ['Full Body', 'Full Body'];
      if (daysPerWeek === 3) return ['Full Body', 'Upper', 'Lower'];
      if (daysPerWeek === 4) return ['Full Body', 'Upper', 'Lower', 'Push Day'];
      if (daysPerWeek === 5) return ['Full Body', 'Upper', 'Lower', 'Push Day', 'Pull Day'];
      return ['Full Body', 'Upper', 'Lower', 'Push Day', 'Pull Day', 'Seated Circuit'].slice(0, daysPerWeek);
    }
    case 'Running': {
      // Goal-aware rotation: uses input.goal to pick the right mix of sessions.
      // Each session type maps to a RunType in generateRunPlanSchedule().
      if (goal === 'run_marathon') {
        if (daysPerWeek <= 3) return ['Easy Run', 'Tempo', 'Long Run'];
        if (daysPerWeek === 4) return ['Easy Run', 'Tempo', 'Easy Run', 'Long Run'];
        if (daysPerWeek === 5) return ['Easy Run', 'Threshold', 'Easy Run', 'Recovery Run', 'Long Run'];
        return ['Easy Run', 'Threshold', 'Easy Run', 'Tempo', 'Recovery Run', 'Long Run'].slice(0, daysPerWeek);
      }
      if (goal === 'run_half_marathon') {
        if (daysPerWeek <= 3) return ['Easy Run', 'Tempo', 'Long Run'];
        if (daysPerWeek === 4) return ['Easy Run', 'Tempo', 'Easy Run', 'Long Run'];
        if (daysPerWeek === 5) return ['Easy Run', 'Intervals', 'Easy Run', 'Tempo', 'Long Run'];
        return ['Easy Run', 'Intervals', 'Easy Run', 'Tempo', 'Recovery Run', 'Long Run'].slice(0, daysPerWeek);
      }
      if (goal === 'run_10k') {
        if (daysPerWeek <= 3) return ['Easy Run', 'Intervals', 'Long Run'];
        if (daysPerWeek === 4) return ['Easy Run', 'Intervals', 'Tempo', 'Long Run'];
        return ['Easy Run', 'Intervals', 'Tempo', 'Easy Run', 'Long Run'].slice(0, daysPerWeek);
      }
      if (goal === 'run_5k') {
        if (daysPerWeek <= 3) return ['Easy Run', 'Intervals', 'Long Run'];
        if (daysPerWeek === 4) return ['Easy Run', 'Intervals', 'Tempo', 'Long Run'];
        return ['Easy Run', 'Intervals', 'Tempo', 'Recovery Run', 'Long Run'].slice(0, daysPerWeek);
      }
      // run_general — rotating weeks handled via phase, keep the mix balanced
      if (daysPerWeek <= 3) return ['Easy Run', 'Tempo', 'Long Run'];
      if (daysPerWeek === 4) return ['Easy Run', 'Tempo', 'Intervals', 'Long Run'];
      return ['Easy Run', 'Tempo', 'Intervals', 'Easy Run', 'Long Run'].slice(0, daysPerWeek);
    }
    default:
      return Array(daysPerWeek).fill('Full Body');
  }
}

function applyExperienceModifiers(
  phaseWeeks: PhaseWeek[],
  level: ExperienceLevel,
): PhaseWeek[] {
  const mods = EXPERIENCE_MODIFIERS[level];
  return phaseWeeks.map(pw => ({
    ...pw,
    volume_modifier: Math.min(mods.volume_cap, pw.volume_modifier * mods.progression_rate),
    intensity_rpe: Math.min(mods.intensity_cap_rpe, pw.intensity_rpe),
  }));
}

function applyEventModifications(
  phaseWeeks: PhaseWeek[],
  events: string[],
  planLength: number,
): PhaseWeek[] {
  if (events.length === 0 || events.includes('No specific event')) return phaseWeeks;

  const primaryEvent = events[0];
  const taperWeeks = EVENT_TAPER_WEEKS[primaryEvent] ?? 0;
  const mods = EVENT_SPECIFIC_MODIFICATIONS[primaryEvent];

  if (taperWeeks > 0 && phaseWeeks.length > taperWeeks + 1) {
    for (let i = phaseWeeks.length - taperWeeks; i < phaseWeeks.length; i++) {
      phaseWeeks[i] = {
        ...phaseWeeks[i],
        phase: 'taper',
        volume_modifier: 0.55 + (phaseWeeks.length - i - 1) * 0.05,
        intensity_modifier: 0.80,
        is_deload: false,
        notes: `Taper week ${i - (phaseWeeks.length - taperWeeks) + 1} — ${mods?.notes ?? 'Reduce volume, maintain intensity'}`,
      };
    }
  }

  return phaseWeeks;
}

function validateSchedule(weeks: WeekSchedule[]): void {
  for (const week of weeks) {
    const trainingDays = week.days.filter(d => !d.is_rest);
    if (trainingDays.length > VOLUME_GUARDRAILS.max_training_days_per_week) {
      __DEV__ && console.warn('[PlanEngine] Week', week.week_number, 'exceeds max training days:', trainingDays.length);
    }

    const restDays = week.days.filter(d => d.is_rest);
    if (restDays.length < VOLUME_GUARDRAILS.min_rest_days_per_week && trainingDays.length < 7) {
      __DEV__ && console.warn('[PlanEngine] Week', week.week_number, 'has fewer than minimum rest days:', restDays.length);
    }
  }
  __DEV__ && console.log('[PlanEngine] Schedule validation complete:', weeks.length, 'weeks');
}

export function generatePlanSchedule(input: PlanGenerationInput): GeneratedPlanSchedule {
  __DEV__ && console.log('[PlanEngine] === PLAN GENERATION START ===');
  __DEV__ && console.log('[PlanEngine] Goal:', input.goal, 'Style:', input.style, 'Length:', input.planLength, 'weeks');
  __DEV__ && console.log('[PlanEngine] Days/week:', input.daysPerWeek, 'Duration:', input.sessionDuration, 'min');
  __DEV__ && console.log('[PlanEngine] Experience:', input.experienceLevel, 'Events:', input.event);

  let phaseWeeks = getPhaseStructure(input.planLength, input.goal);
  __DEV__ && console.log('[PlanEngine] Step 1: Phase structure loaded,', phaseWeeks.length, 'weeks');

  phaseWeeks = applyEventModifications(phaseWeeks, input.event, input.planLength);
  __DEV__ && console.log('[PlanEngine] Step 2: Event modifications applied');

  const weeklyTemplate = buildWeeklyTemplate(input.daysPerWeek, input.style, input.goal, input.trainingSplit);
  __DEV__ && console.log('[PlanEngine] Step 3: Weekly template built,', weeklyTemplate.length, 'days/week');

  phaseWeeks = applyExperienceModifiers(phaseWeeks, input.experienceLevel);
  __DEV__ && console.log('[PlanEngine] Step 4: Experience modifiers applied');

  const weeks: WeekSchedule[] = [];
  let totalTraining = 0;
  let totalRest = 0;
  const phasesUsed = new Set<PlanPhase>();

  for (let w = 0; w < phaseWeeks.length; w++) {
    const pw = phaseWeeks[w];
    phasesUsed.add(pw.phase);

    const weekStartDate = addDays(input.startDate, w * 7);
    const days: DayPrescription[] = [];

    for (let d = 0; d < 7; d++) {
      const dayDate = addDays(weekStartDate, d);
      const tmpl = weeklyTemplate[d];

      if (tmpl.is_rest || pw.is_deload) {
        const isDeloadTraining = pw.is_deload && !tmpl.is_rest;

        if (isDeloadTraining) {
          days.push({
            day_of_week: d,
            week_number: pw.week_number,
            date: dayDate,
            phase: pw.phase,
            style: input.style,
            session_type: tmpl.session_type,
            target_duration: Math.round(input.sessionDuration * 0.7),
            volume_modifier: pw.volume_modifier,
            intensity_modifier: pw.intensity_modifier,
            is_rest: false,
            rest_suggestion: '',
            notes: `Deload — ${pw.notes}`,
            is_deload_week: true,
          });
          totalTraining++;
        } else if (tmpl.is_rest) {
          days.push({
            day_of_week: d,
            week_number: pw.week_number,
            date: dayDate,
            phase: pw.phase,
            style: '',
            session_type: '',
            target_duration: 0,
            volume_modifier: 0,
            intensity_modifier: 0,
            is_rest: true,
            rest_suggestion: tmpl.rest_suggestion ?? REST_DAY_SUGGESTIONS[d % REST_DAY_SUGGESTIONS.length],
            notes: 'Rest day',
            is_deload_week: pw.is_deload,
          });
          totalRest++;
        }
      } else {
        days.push({
          day_of_week: d,
          week_number: pw.week_number,
          date: dayDate,
          phase: pw.phase,
          style: input.style,
          session_type: tmpl.session_type,
          target_duration: input.sessionDuration,
          volume_modifier: pw.volume_modifier,
          intensity_modifier: pw.intensity_modifier,
          is_rest: false,
          rest_suggestion: '',
          notes: pw.notes,
          is_deload_week: false,
        });
        totalTraining++;
      }
    }

    weeks.push({
      week_number: pw.week_number,
      phase: pw.phase,
      phase_week: pw,
      days,
      is_deload: pw.is_deload,
      notes: pw.notes,
    });
  }

  __DEV__ && console.log('[PlanEngine] Step 5: Schedule generated,', weeks.length, 'weeks');

  validateSchedule(weeks);
  __DEV__ && console.log('[PlanEngine] Step 6: Validation complete');

  __DEV__ && console.log('[PlanEngine] Total training days:', totalTraining, 'rest days:', totalRest);
  __DEV__ && console.log('[PlanEngine] Phases used:', [...phasesUsed].join(', '));
  __DEV__ && console.log('[PlanEngine] === PLAN GENERATION COMPLETE ===');

  return {
    weeks,
    total_training_days: totalTraining,
    total_rest_days: totalRest,
    phases_used: [...phasesUsed],
  };
}

/**
 * 75 Hard — generates an 11-week, 7-day/week schedule with no rest days.
 * Periodization: foundation (wk 1-2) → build (wk 3-5) → intensify (wk 6-8) → peak (wk 9-11)
 * Deload baked into week 4 and week 8 (reduced volume, still training).
 * Duration locked at 45 min per 75 Hard rules.
 */
export function generate75HardSchedule(input: PlanGenerationInput): GeneratedPlanSchedule {
  __DEV__ && console.log('[PlanEngine] === 75 HARD SCHEDULE GENERATION START ===');

  const TOTAL_WEEKS = 11;
  const SESSION_DURATION = 45;

  // Phase assignments by week (1-indexed)
  const phaseByWeek: { phase: PlanPhase; volMod: number; intMod: number; isDeload: boolean; notes: string }[] = [
    { phase: 'foundation', volMod: 0.85, intMod: 0.80, isDeload: false, notes: 'Foundation — build habits, moderate volume' },
    { phase: 'foundation', volMod: 0.90, intMod: 0.85, isDeload: false, notes: 'Foundation — ramp up' },
    { phase: 'build',      volMod: 1.00, intMod: 0.90, isDeload: false, notes: 'Build — increasing volume & intensity' },
    { phase: 'deload',     volMod: 0.60, intMod: 0.70, isDeload: true,  notes: 'Deload — recovery week' },
    { phase: 'build',      volMod: 1.05, intMod: 0.95, isDeload: false, notes: 'Build — pushing volume' },
    { phase: 'intensify',  volMod: 1.10, intMod: 1.00, isDeload: false, notes: 'Intensify — peak training stress' },
    { phase: 'intensify',  volMod: 1.10, intMod: 1.05, isDeload: false, notes: 'Intensify — high intensity' },
    { phase: 'deload',     volMod: 0.60, intMod: 0.70, isDeload: true,  notes: 'Deload — mid-challenge recovery' },
    { phase: 'peak',       volMod: 1.00, intMod: 1.10, isDeload: false, notes: 'Peak — sharpen performance' },
    { phase: 'peak',       volMod: 1.00, intMod: 1.10, isDeload: false, notes: 'Peak — maintain intensity' },
    { phase: 'peak',       volMod: 0.95, intMod: 1.05, isDeload: false, notes: 'Peak — final push' },
  ];

  // Build 7-day split rotation (all training, no rest)
  const splitRotation = getSplitRotation(input.style, 7, input.goal, input.trainingSplit);

  const weeks: WeekSchedule[] = [];
  let totalTraining = 0;
  const phasesUsed = new Set<PlanPhase>();
  let globalDayIdx = 0;

  for (let w = 0; w < TOTAL_WEEKS; w++) {
    const pw = phaseByWeek[w];
    phasesUsed.add(pw.phase);

    const weekStartDate = addDays(input.startDate, w * 7);
    const days: DayPrescription[] = [];

    for (let d = 0; d < 7; d++) {
      // Stop at 75 days total
      if (globalDayIdx >= 75) {
        break;
      }

      const dayDate = addDays(weekStartDate, d);
      const sessionType = splitRotation[globalDayIdx % splitRotation.length];
      const duration = pw.isDeload ? Math.round(SESSION_DURATION * 0.7) : SESSION_DURATION;

      days.push({
        day_of_week: d,
        week_number: w + 1,
        date: dayDate,
        phase: pw.phase,
        style: input.style,
        session_type: sessionType,
        target_duration: duration,
        volume_modifier: pw.volMod,
        intensity_modifier: pw.intMod,
        is_rest: false,
        rest_suggestion: '',
        notes: pw.notes,
        is_deload_week: pw.isDeload,
      });

      totalTraining++;
      globalDayIdx++;
    }

    if (days.length === 0) break;

    const phaseWeek: PhaseWeek = {
      week_number: w + 1,
      phase: pw.phase,
      volume_level: pw.isDeload ? 'deload' : pw.volMod >= 1.1 ? 'very_high' : pw.volMod >= 1.0 ? 'high' : 'moderate',
      intensity_rpe: pw.isDeload ? 5 : pw.intMod >= 1.05 ? 9 : pw.intMod >= 0.95 ? 8 : 7,
      volume_modifier: pw.volMod,
      intensity_modifier: pw.intMod,
      is_deload: pw.isDeload,
      notes: pw.notes,
    };

    weeks.push({
      week_number: w + 1,
      phase: pw.phase,
      phase_week: phaseWeek,
      days,
      is_deload: pw.isDeload,
      notes: pw.notes,
    });
  }

  __DEV__ && console.log('[PlanEngine] 75 Hard schedule: ', totalTraining, 'training days across', weeks.length, 'weeks');
  __DEV__ && console.log('[PlanEngine] === 75 HARD SCHEDULE GENERATION COMPLETE ===');

  return {
    weeks,
    total_training_days: totalTraining,
    total_rest_days: 0,
    phases_used: [...phasesUsed],
  };
}

// ═══════════════════════════════════════════════════════════════════════
// RUN PLAN GENERATION
// ═══════════════════════════════════════════════════════════════════════

/**
 * Pace reference (seconds per mile) for each run type, derived from the
 * user's current 5K pace or fitness level. These are coarse defaults —
 * the app can refine with per-user data over time.
 *
 * Default assumes an intermediate runner with a 10:00/mi easy pace.
 */
interface PaceTable {
  easy_min: number;
  easy_max: number;
  tempo_min: number;
  tempo_max: number;
  threshold_min: number;
  threshold_max: number;
  interval_min: number;
  interval_max: number;
  long_min: number;
  long_max: number;
  recovery_min: number;
  recovery_max: number;
  race_pace: number;
}

/** Default pace tables (sec/mile) per experience level, for open-ended run plans. */
const DEFAULT_PACE_TABLES: Record<ExperienceLevel, PaceTable> = {
  beginner: {
    easy_min: 660, easy_max: 780,           // 11:00-13:00
    tempo_min: 540, tempo_max: 600,         // 9:00-10:00
    threshold_min: 510, threshold_max: 570, // 8:30-9:30
    interval_min: 480, interval_max: 540,   // 8:00-9:00
    long_min: 720, long_max: 840,           // 12:00-14:00
    recovery_min: 780, recovery_max: 900,   // 13:00-15:00
    race_pace: 600,                          // 10:00
  },
  intermediate: {
    easy_min: 540, easy_max: 660,           // 9:00-11:00
    tempo_min: 450, tempo_max: 510,         // 7:30-8:30
    threshold_min: 420, threshold_max: 480, // 7:00-8:00
    interval_min: 390, interval_max: 450,   // 6:30-7:30
    long_min: 600, long_max: 720,           // 10:00-12:00
    recovery_min: 660, recovery_max: 780,   // 11:00-13:00
    race_pace: 510,                          // 8:30
  },
  advanced: {
    easy_min: 450, easy_max: 540,           // 7:30-9:00
    tempo_min: 390, tempo_max: 420,         // 6:30-7:00
    threshold_min: 360, threshold_max: 390, // 6:00-6:30
    interval_min: 330, interval_max: 390,   // 5:30-6:30
    long_min: 480, long_max: 600,           // 8:00-10:00
    recovery_min: 540, recovery_max: 660,   // 9:00-11:00
    race_pace: 420,                          // 7:00
  },
};

/**
 * Compute a pace table derived from the user's target race time.
 * Falls back to DEFAULT_PACE_TABLES[experience] when no target provided.
 */
function computePaceTable(
  experience: ExperienceLevel,
  targetPaceSecPerMile?: number,
): PaceTable {
  if (!targetPaceSecPerMile || targetPaceSecPerMile <= 0) {
    return DEFAULT_PACE_TABLES[experience];
  }
  // Base training paces off the target race pace using standard offsets:
  //   easy = race + 90-120s, tempo = race + 20-40s, threshold = race + 5-20s,
  //   intervals = race - 10 to + 10s, long = race + 120-150s,
  //   recovery = race + 150-180s.
  const p = targetPaceSecPerMile;
  return {
    easy_min: p + 90,
    easy_max: p + 120,
    tempo_min: p + 20,
    tempo_max: p + 40,
    threshold_min: p + 5,
    threshold_max: p + 20,
    interval_min: p - 10,
    interval_max: p + 10,
    long_min: p + 120,
    long_max: p + 150,
    recovery_min: p + 150,
    recovery_max: p + 180,
    race_pace: p,
  };
}

/** Map a session_type label (from getSplitRotation) to its RunType. */
function sessionTypeToRunType(sessionType: string): RunType {
  const s = sessionType.toLowerCase();
  if (s.includes('easy')) return 'easy';
  if (s.includes('recovery')) return 'recovery';
  if (s.includes('tempo')) return 'tempo';
  if (s.includes('threshold')) return 'threshold';
  if (s.includes('interval')) return 'interval';
  if (s.includes('long')) return 'long_run';
  if (s.includes('hill')) return 'hill_repeats';
  if (s.includes('fartlek')) return 'fartlek';
  if (s.includes('progression')) return 'progression';
  if (s.includes('race')) return 'race';
  return 'easy';
}

/**
 * Compute the target distance in miles for a single run session.
 *
 * Strategy:
 *   - Long run grows linearly from start → peak across the non-taper weeks,
 *     capped at cfg.longRunPeakMiles.
 *   - Easy/tempo/threshold/recovery are a fraction of the weekly mileage target.
 *   - Intervals are shorter overall (warmup + reps + cooldown).
 *   - Race week: the long_run slot becomes the race itself.
 */
function computeRunDistance(params: {
  runType: RunType;
  weekIdx: number; // 0-based
  totalWeeks: number;
  taperWeeks: number;
  cfg: RunPlanConfig;
  weeklyMilesStart: number;
  weeklyMilesPeak: number;
  daysPerWeek: number;
  volumeModifier: number;
  isDeload: boolean;
}): number {
  const {
    runType, weekIdx, totalWeeks, taperWeeks, cfg,
    weeklyMilesStart, weeklyMilesPeak, daysPerWeek,
    volumeModifier, isDeload,
  } = params;

  // Compute this week's target mileage via linear interpolation up to peak,
  // then taper down for the final N weeks.
  const rampWeeks = Math.max(1, totalWeeks - taperWeeks);
  let weeklyMiles: number;
  if (weekIdx < rampWeeks) {
    const progress = weekIdx / Math.max(1, rampWeeks - 1);
    weeklyMiles = weeklyMilesStart + (weeklyMilesPeak - weeklyMilesStart) * progress;
  } else {
    // Taper: ramp from peak down to ~40% over the taper weeks
    const taperIdx = weekIdx - rampWeeks;
    const taperProgress = taperIdx / Math.max(1, taperWeeks - 1);
    weeklyMiles = weeklyMilesPeak * (1 - taperProgress * 0.6);
  }
  if (isDeload) weeklyMiles *= 0.6;
  weeklyMiles *= volumeModifier;

  // Long run grows to the peak, capped
  const longRunMiles = (() => {
    if (weekIdx < rampWeeks) {
      const progress = weekIdx / Math.max(1, rampWeeks - 1);
      const startLong = Math.max(3, cfg.longRunPeakMiles * 0.4);
      return Math.min(cfg.longRunPeakMiles, startLong + (cfg.longRunPeakMiles - startLong) * progress);
    }
    // Taper long run
    const taperIdx = weekIdx - rampWeeks;
    const taperProgress = taperIdx / Math.max(1, taperWeeks - 1);
    return Math.max(3, cfg.longRunPeakMiles * (1 - taperProgress * 0.6));
  })();

  const nonLongDays = Math.max(1, daysPerWeek - 1);
  const nonLongWeekly = Math.max(0, weeklyMiles - longRunMiles);

  switch (runType) {
    case 'long_run': return Math.max(2, Math.round(longRunMiles * 10) / 10);
    case 'race': return cfg.raceDistanceMiles ?? longRunMiles;
    case 'recovery': return Math.max(1.5, Math.round((nonLongWeekly / nonLongDays) * 0.7 * 10) / 10);
    case 'easy': return Math.max(2, Math.round((nonLongWeekly / nonLongDays) * 10) / 10);
    case 'tempo': return Math.max(3, Math.round((nonLongWeekly / nonLongDays) * 0.9 * 10) / 10);
    case 'threshold': return Math.max(3, Math.round((nonLongWeekly / nonLongDays) * 0.95 * 10) / 10);
    case 'interval': return Math.max(3, Math.round((nonLongWeekly / nonLongDays) * 0.85 * 10) / 10);
    case 'fartlek': return Math.max(3, Math.round((nonLongWeekly / nonLongDays) * 0.9 * 10) / 10);
    case 'hill_repeats': return Math.max(3, Math.round((nonLongWeekly / nonLongDays) * 0.8 * 10) / 10);
    case 'progression': return Math.max(3, Math.round((nonLongWeekly / nonLongDays) * 0.95 * 10) / 10);
    default: return Math.max(2, Math.round((nonLongWeekly / nonLongDays) * 10) / 10);
  }
}

/** Build a short human-readable description of a run prescription. */
function buildRunDescription(runType: RunType, distanceMiles: number, paceSecPerMile: number): string {
  const paceMin = Math.floor(paceSecPerMile / 60);
  const paceSec = Math.round(paceSecPerMile % 60);
  const paceStr = `${paceMin}:${String(paceSec).padStart(2, '0')}/mi`;
  const distStr = distanceMiles >= 10
    ? `${distanceMiles.toFixed(0)} mi`
    : `${distanceMiles.toFixed(1)} mi`;
  switch (runType) {
    case 'easy': return `${distStr} easy @ ${paceStr}`;
    case 'recovery': return `${distStr} recovery @ ${paceStr}`;
    case 'tempo': return `${distStr} tempo @ ${paceStr}`;
    case 'threshold': return `${distStr} threshold @ ${paceStr}`;
    case 'interval': return `${distStr} w/ intervals`;
    case 'long_run': return `${distStr} long run @ ${paceStr}`;
    case 'fartlek': return `${distStr} fartlek`;
    case 'hill_repeats': return `${distStr} w/ hill repeats`;
    case 'progression': return `${distStr} progression @ ${paceStr}`;
    case 'race': return `${distStr} race day`;
    case 'race_pace': return `${distStr} @ race pace ${paceStr}`;
    default: return `${distStr} @ ${paceStr}`;
  }
}

/** Translate a target distance at a given pace into expected duration in minutes. */
function estimateRunDurationMinutes(distanceMiles: number, paceSecPerMile: number): number {
  const secs = distanceMiles * paceSecPerMile;
  return Math.round(secs / 60);
}

export interface GenerateRunPlanInput extends PlanGenerationInput {
  /** Optional target pace (seconds per mile) to calibrate prescriptions. */
  targetPaceSecPerMile?: number;
  /** Optional runner-supplied starting weekly mileage override. */
  startingWeeklyMiles?: number;
}

/**
 * Generate a run-mode training plan.
 *
 * Wraps `generatePlanSchedule` — leveraging all existing phase / taper /
 * experience / calendar logic — and then post-processes each DayPrescription
 * to fill in the run-specific fields (distance, pace, run_type, description).
 */
export function generateRunPlanSchedule(input: GenerateRunPlanInput): GeneratedPlanSchedule {
  if (!isRunPlanGoal(input.goal)) {
    throw new Error(`[PlanEngine] generateRunPlanSchedule called with non-run goal: ${input.goal}`);
  }
  const cfg = RUN_PLAN_CONFIGS[input.goal as 'run_5k' | 'run_10k' | 'run_half_marathon' | 'run_marathon' | 'run_general'];

  // Force style to 'Running' so getSplitRotation picks our run session mix.
  // Append the race event if this plan targets a race (makes the existing
  // event-taper logic inside generatePlanSchedule kick in automatically).
  const runningInput: PlanGenerationInput = {
    ...input,
    style: 'Running',
    event: input.event.length > 0
      ? input.event
      : cfg.event ? [cfg.event] : [],
  };

  __DEV__ && console.log('[PlanEngine] === RUN PLAN GENERATION START ===');
  __DEV__ && console.log('[PlanEngine] Goal:', cfg.id, cfg.label);

  // Reuse the core generator — it returns a schedule with empty run fields
  const schedule = generatePlanSchedule(runningInput);

  // ─── Post-process: fill in run-specific fields on each DayPrescription ──
  const taperWeeks = cfg.event ? (EVENT_TAPER_WEEKS[cfg.event] ?? 1) : 1;
  const level = input.experienceLevel;
  const weeklyMilesStart = input.startingWeeklyMiles ?? cfg.startingWeeklyMilesByLevel[level];
  const weeklyMilesPeak = Math.max(weeklyMilesStart, cfg.peakWeeklyMilesByLevel[level]);
  const paceTable = computePaceTable(level, input.targetPaceSecPerMile);

  schedule.weeks.forEach((week, weekIdx) => {
    const isRaceWeek = cfg.raceDistanceMiles !== null && weekIdx === schedule.weeks.length - 1;
    for (const day of week.days) {
      if (day.is_rest) {
        day.activity_type = 'rest';
        continue;
      }
      day.activity_type = 'run';

      // Determine run type from the session label set by getSplitRotation
      let runType = sessionTypeToRunType(day.session_type);

      // On race week, promote the long run slot to the race
      if (isRaceWeek && runType === 'long_run' && cfg.raceDistanceMiles !== null) {
        runType = 'race';
      }

      // Compute target distance
      const distanceMiles = computeRunDistance({
        runType,
        weekIdx,
        totalWeeks: schedule.weeks.length,
        taperWeeks,
        cfg,
        weeklyMilesStart,
        weeklyMilesPeak,
        daysPerWeek: input.daysPerWeek,
        volumeModifier: day.volume_modifier || 1,
        isDeload: day.is_deload_week,
      });

      // Compute target pace range
      let paceMin: number;
      let paceMax: number;
      switch (runType) {
        case 'easy':         paceMin = paceTable.easy_min;       paceMax = paceTable.easy_max;       break;
        case 'recovery':     paceMin = paceTable.recovery_min;   paceMax = paceTable.recovery_max;   break;
        case 'tempo':        paceMin = paceTable.tempo_min;      paceMax = paceTable.tempo_max;      break;
        case 'threshold':    paceMin = paceTable.threshold_min;  paceMax = paceTable.threshold_max;  break;
        case 'interval':     paceMin = paceTable.interval_min;   paceMax = paceTable.interval_max;   break;
        case 'long_run':     paceMin = paceTable.long_min;       paceMax = paceTable.long_max;       break;
        case 'race':         paceMin = paceTable.race_pace;      paceMax = paceTable.race_pace;      break;
        case 'fartlek':      paceMin = paceTable.threshold_min;  paceMax = paceTable.easy_max;       break;
        case 'hill_repeats': paceMin = paceTable.interval_min;   paceMax = paceTable.tempo_max;      break;
        case 'progression':  paceMin = paceTable.tempo_min;      paceMax = paceTable.easy_max;       break;
        case 'race_pace':    paceMin = paceTable.race_pace - 10; paceMax = paceTable.race_pace + 10; break;
        default:             paceMin = paceTable.easy_min;       paceMax = paceTable.easy_max;       break;
      }

      const middlePace = Math.round((paceMin + paceMax) / 2);

      day.run_type = runType;
      day.target_distance_miles = distanceMiles;
      day.target_pace_min_sec_per_mile = paceMin;
      day.target_pace_max_sec_per_mile = paceMax;
      day.target_duration = estimateRunDurationMinutes(distanceMiles, middlePace);
      day.run_description = buildRunDescription(runType, distanceMiles, middlePace);

      // Intervals get a structured spec
      if (runType === 'interval') {
        day.intervals = {
          warmup_minutes: 10,
          cooldown_minutes: 10,
          repeats: [{
            work_distance_meters: 400,
            recovery_seconds: 90,
            count: 6,
            target_pace_sec_per_mile: paceTable.interval_min,
            description: '6 × 400m @ 5K pace w/ 90s recovery',
          }],
        };
      } else if (runType === 'hill_repeats') {
        day.intervals = {
          warmup_minutes: 10,
          cooldown_minutes: 10,
          repeats: [{
            work_seconds: 60,
            recovery_seconds: 90,
            count: 8,
            description: '8 × 60s hill repeats, jog down recovery',
          }],
        };
      } else if (runType === 'fartlek') {
        day.intervals = {
          warmup_minutes: 10,
          cooldown_minutes: 10,
          repeats: [{
            work_seconds: 60,
            recovery_seconds: 60,
            count: 8,
            description: '8 × 1min hard / 1min easy',
          }],
        };
      }
    }
  });

  __DEV__ && console.log('[PlanEngine] === RUN PLAN GENERATION COMPLETE ===');
  return schedule;
}

// ═══════════════════════════════════════════════════════════════════════
// HYBRID PLAN GENERATION (lift + run)
// ═══════════════════════════════════════════════════════════════════════

/** Map a RunType to the (paceMin, paceMax) range from a PaceTable. */
function paceRangeForRunType(runType: RunType, paceTable: PaceTable): { min: number; max: number } {
  switch (runType) {
    case 'easy':         return { min: paceTable.easy_min,       max: paceTable.easy_max };
    case 'recovery':     return { min: paceTable.recovery_min,   max: paceTable.recovery_max };
    case 'tempo':        return { min: paceTable.tempo_min,      max: paceTable.tempo_max };
    case 'threshold':    return { min: paceTable.threshold_min,  max: paceTable.threshold_max };
    case 'interval':     return { min: paceTable.interval_min,   max: paceTable.interval_max };
    case 'long_run':     return { min: paceTable.long_min,       max: paceTable.long_max };
    case 'race':         return { min: paceTable.race_pace,      max: paceTable.race_pace };
    case 'fartlek':      return { min: paceTable.threshold_min,  max: paceTable.easy_max };
    case 'hill_repeats': return { min: paceTable.interval_min,   max: paceTable.tempo_max };
    case 'progression':  return { min: paceTable.tempo_min,      max: paceTable.easy_max };
    case 'race_pace':    return { min: paceTable.race_pace - 10, max: paceTable.race_pace + 10 };
    default:             return { min: paceTable.easy_min,       max: paceTable.easy_max };
  }
}

export interface GenerateHybridPlanInput extends PlanGenerationInput {
  /** Run goal driving the run side of the hybrid plan. */
  runGoal: Extract<PlanGoal, 'run_5k' | 'run_10k' | 'run_half_marathon' | 'run_marathon' | 'run_general'>;
  /** Strength style — 'Strength' | 'Bodybuilding' | etc. */
  strengthStyle: string;
  /** Strength split — key from HYBRID_STRENGTH_ROTATIONS. */
  strengthSplit: string;
  /** How many strength days per week. */
  strengthDays: number;
  /** How many run days per week. */
  runDays: number;
  /** Target race pace (sec/mile) — calibrates run prescriptions. */
  targetPaceSecPerMile?: number;
  /** Override starting weekly mileage. */
  startingWeeklyMiles?: number;
}

/**
 * Generate a hybrid training plan combining strength and running.
 *
 * Architecture:
 *   1. Phase structure driven by the RUN goal (race is typically the primary
 *      driver). Event taper, experience modifiers all applied normally.
 *   2. Weekly template from `buildHybridWeeklyTemplate` decides which day-of-
 *      week is strength / run / rest, with smart placement (long run Sunday,
 *      hard run ≥2 days from legs, ≥1 rest/week).
 *   3. For strength slots — generate a DayPrescription with the strength
 *      style + session from the template.
 *   4. For run slots — compute distance + pace using the same helpers as
 *      `generateRunPlanSchedule` so metrics are identical.
 */
export function generateHybridPlanSchedule(input: GenerateHybridPlanInput): GeneratedPlanSchedule {
  if (input.strengthDays + input.runDays > 7) {
    throw new Error('[PlanEngine] strengthDays + runDays cannot exceed 7');
  }
  if (input.strengthDays < 1 || input.runDays < 1) {
    throw new Error('[PlanEngine] Hybrid plan requires at least 1 strength day and 1 run day');
  }

  __DEV__ && console.log('[PlanEngine] === HYBRID PLAN GENERATION START ===');
  __DEV__ && console.log('[PlanEngine] Strength:', input.strengthStyle, input.strengthSplit, `${input.strengthDays}d/wk`);
  __DEV__ && console.log('[PlanEngine] Run:', input.runGoal, `${input.runDays}d/wk`);

  const runCfg = RUN_PLAN_CONFIGS[input.runGoal];

  // Phase structure driven by run goal (the race drives periodization)
  let phaseWeeks = getPhaseStructure(input.planLength, input.runGoal);
  const eventList = input.event.length > 0 ? input.event : runCfg.event ? [runCfg.event] : [];
  phaseWeeks = applyEventModifications(phaseWeeks, eventList, input.planLength);
  phaseWeeks = applyExperienceModifiers(phaseWeeks, input.experienceLevel);

  // Weekly template — which day-of-week gets which activity
  const template = buildHybridWeeklyTemplate(
    input.strengthDays,
    input.runDays,
    input.strengthSplit,
    input.runGoal,
  );

  // Run pacing / mileage prep
  const taperWeeks = runCfg.event ? (EVENT_TAPER_WEEKS[runCfg.event] ?? 1) : 1;
  const weeklyMilesStart = input.startingWeeklyMiles ?? runCfg.startingWeeklyMilesByLevel[input.experienceLevel];
  const weeklyMilesPeak = Math.max(weeklyMilesStart, runCfg.peakWeeklyMilesByLevel[input.experienceLevel]);
  const paceTable = computePaceTable(input.experienceLevel, input.targetPaceSecPerMile);

  const weeks: WeekSchedule[] = [];
  let totalTraining = 0;
  let totalRest = 0;
  const phasesUsed = new Set<PlanPhase>();

  for (let w = 0; w < phaseWeeks.length; w++) {
    const pw = phaseWeeks[w];
    phasesUsed.add(pw.phase);
    const weekStartDate = addDays(input.startDate, w * 7);
    const isRaceWeek = runCfg.raceDistanceMiles !== null && w === phaseWeeks.length - 1;
    const days: DayPrescription[] = [];

    for (let d = 0; d < 7; d++) {
      const dayDate = addDays(weekStartDate, d);
      const slot = template[d];

      if (slot.activity_type === 'rest') {
        days.push({
          day_of_week: d,
          week_number: pw.week_number,
          date: dayDate,
          phase: pw.phase,
          style: '',
          session_type: '',
          target_duration: 0,
          volume_modifier: 0,
          intensity_modifier: 0,
          is_rest: true,
          rest_suggestion: REST_DAY_SUGGESTIONS[d % REST_DAY_SUGGESTIONS.length],
          notes: 'Rest day',
          is_deload_week: pw.is_deload,
          activity_type: 'rest',
        });
        totalRest++;
        continue;
      }

      if (slot.activity_type === 'strength') {
        const durationMultiplier = pw.is_deload ? 0.7 : 1;
        days.push({
          day_of_week: d,
          week_number: pw.week_number,
          date: dayDate,
          phase: pw.phase,
          style: input.strengthStyle,
          session_type: slot.strength_session ?? 'Full Body',
          target_duration: Math.round(input.sessionDuration * durationMultiplier),
          volume_modifier: pw.volume_modifier,
          intensity_modifier: pw.intensity_modifier,
          is_rest: false,
          rest_suggestion: '',
          notes: pw.is_deload ? `Deload — ${pw.notes}` : pw.notes,
          is_deload_week: pw.is_deload,
          activity_type: 'strength',
        });
        totalTraining++;
        continue;
      }

      // Run slot
      let runType: RunType = slot.run_type ?? 'easy';

      // Promote long-run slot → race on race week
      if (isRaceWeek && runType === 'long_run' && runCfg.raceDistanceMiles !== null) {
        runType = 'race';
      }

      const distanceMiles = computeRunDistance({
        runType,
        weekIdx: w,
        totalWeeks: phaseWeeks.length,
        taperWeeks,
        cfg: runCfg,
        weeklyMilesStart,
        weeklyMilesPeak,
        daysPerWeek: input.runDays,
        volumeModifier: pw.volume_modifier || 1,
        isDeload: pw.is_deload,
      });

      const { min: paceMin, max: paceMax } = paceRangeForRunType(runType, paceTable);
      const middlePace = Math.round((paceMin + paceMax) / 2);

      const dayPrescription: DayPrescription = {
        day_of_week: d,
        week_number: pw.week_number,
        date: dayDate,
        phase: pw.phase,
        style: 'Running',
        session_type: slot.run_type ? slot.run_type.replace('_', ' ') : 'Easy Run',
        target_duration: estimateRunDurationMinutes(distanceMiles, middlePace),
        volume_modifier: pw.volume_modifier,
        intensity_modifier: pw.intensity_modifier,
        is_rest: false,
        rest_suggestion: '',
        notes: pw.is_deload ? 'Deload — all easy effort' : pw.notes,
        is_deload_week: pw.is_deload,
        activity_type: 'run',
        run_type: runType,
        target_distance_miles: distanceMiles,
        target_pace_min_sec_per_mile: paceMin,
        target_pace_max_sec_per_mile: paceMax,
        run_description: buildRunDescription(runType, distanceMiles, middlePace),
      };

      if (runType === 'interval') {
        dayPrescription.intervals = {
          warmup_minutes: 10,
          cooldown_minutes: 10,
          repeats: [{
            work_distance_meters: 400,
            recovery_seconds: 90,
            count: 6,
            target_pace_sec_per_mile: paceTable.interval_min,
            description: '6 × 400m @ 5K pace w/ 90s recovery',
          }],
        };
      } else if (runType === 'hill_repeats') {
        dayPrescription.intervals = {
          warmup_minutes: 10,
          cooldown_minutes: 10,
          repeats: [{
            work_seconds: 60,
            recovery_seconds: 90,
            count: 8,
            description: '8 × 60s hill repeats, jog down recovery',
          }],
        };
      } else if (runType === 'fartlek') {
        dayPrescription.intervals = {
          warmup_minutes: 10,
          cooldown_minutes: 10,
          repeats: [{
            work_seconds: 60,
            recovery_seconds: 60,
            count: 8,
            description: '8 × 1min hard / 1min easy',
          }],
        };
      }

      days.push(dayPrescription);
      totalTraining++;
    }

    weeks.push({
      week_number: pw.week_number,
      phase: pw.phase,
      phase_week: pw,
      days,
      is_deload: pw.is_deload,
      notes: pw.notes,
    });
  }

  __DEV__ && console.log('[PlanEngine] Hybrid schedule:', weeks.length, 'weeks,', totalTraining, 'training days,', totalRest, 'rest');
  __DEV__ && console.log('[PlanEngine] === HYBRID PLAN GENERATION COMPLETE ===');

  return {
    weeks,
    total_training_days: totalTraining,
    total_rest_days: totalRest,
    phases_used: [...phasesUsed],
  };
}

export function getPrescriptionForDate(
  schedule: GeneratedPlanSchedule,
  dateStr: string,
): DayPrescription | null {
  for (const week of schedule.weeks) {
    for (const day of week.days) {
      if (day.date === dateStr) return day;
    }
  }
  return null;
}

export function getCurrentWeekFromSchedule(
  schedule: GeneratedPlanSchedule,
  dateStr: string,
): WeekSchedule | null {
  for (const week of schedule.weeks) {
    if (week.days.some(d => d.date === dateStr)) return week;
  }
  return null;
}

export interface MissedDayResult {
  action: 'slide_forward' | 'resume' | 'repeat_week' | 'restart_phase';
  message: string;
}

export function handleMissedDays(
  missedDayCount: number,
  missedConsecutiveDays: number,
): MissedDayResult {
  if (missedConsecutiveDays >= MISSED_DAY_RULES.restart_phase_threshold_days) {
    return {
      action: 'restart_phase',
      message: 'You\'ve missed 2+ weeks. Consider restarting the current phase to rebuild momentum.',
    };
  }
  if (missedConsecutiveDays >= MISSED_DAY_RULES.repeat_week_threshold_days) {
    return {
      action: 'repeat_week',
      message: 'Full week missed. This week will be repeated to maintain your progress.',
    };
  }
  if (missedDayCount >= MISSED_DAY_RULES.resume_threshold) {
    return {
      action: 'resume',
      message: '3+ days missed. Resuming at your next scheduled session — no cramming.',
    };
  }
  return {
    action: 'slide_forward',
    message: 'Missed day will slide forward. Your split order is preserved.',
  };
}

export function getEventMilestones(
  events: string[],
  planLength: number,
  startDate: string,
): { week: number; date: string; label: string }[] {
  if (events.length === 0 || events.includes('No specific event')) return [];

  const milestones: { week: number; date: string; label: string }[] = [];
  const primaryEvent = events[0];

  const halfwayWeek = Math.floor(planLength / 2);
  milestones.push({
    week: halfwayWeek,
    date: addDays(startDate, halfwayWeek * 7),
    label: 'Halfway point',
  });

  const taperStart = planLength - (EVENT_TAPER_WEEKS[primaryEvent] ?? 1);
  if (taperStart > 0 && taperStart < planLength) {
    milestones.push({
      week: taperStart,
      date: addDays(startDate, taperStart * 7),
      label: `Taper begins for ${primaryEvent}`,
    });
  }

  milestones.push({
    week: planLength,
    date: addDays(startDate, planLength * 7),
    label: `${primaryEvent}`,
  });

  return milestones;
}
