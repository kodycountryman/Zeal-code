import {
  type PlanGoal,
  type PlanPhase,
  type PlanLength,
  type ExperienceLevel,
  type PhaseWeek,
  type WeeklyTemplate,
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
