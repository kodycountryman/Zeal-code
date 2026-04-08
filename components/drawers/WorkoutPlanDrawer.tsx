import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BaseDrawer from '@/components/drawers/BaseDrawer';
import EquipmentDrawer from '@/components/drawers/EquipmentDrawer';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme, useAppContext, type WorkoutPlan } from '@/context/AppContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { useSeventyFiveHard } from '@/context/SeventyFiveHardContext';
import { useWorkoutTracking } from '@/context/WorkoutTrackingContext';
import { PRO_STYLES_SET, showProGate } from '@/services/proGate';
import { WORKOUT_STYLE_COLORS } from '@/constants/colors';
import { generatePlanSchedule, generate75HardSchedule, type PlanGenerationInput, type DayPrescription } from '@/services/planEngine';
import { COMMERCIAL_EQUIPMENT_PRESET, HOME_EQUIPMENT_PRESET } from '@/mocks/equipmentData';
import type { GenerateWorkoutParams } from '@/services/workoutEngine';
import {
  PLAN_GOALS,
  PLAN_EVENTS,
  DAYS_PER_WEEK_OPTIONS,
  SESSION_DURATION_OPTIONS,
  PLAN_LENGTHS,
  EXPERIENCE_MODIFIERS,
  PHASE_COLORS,
  PHASE_DISPLAY_NAMES,
  getPhaseStructure,
  type PlanGoal,
  type PlanLength,
  type PlanPhase,
  type ExperienceLevel,
} from '@/services/planConstants';

interface Props {
  visible: boolean;
  onClose: () => void;
  editPlan?: WorkoutPlan;
}

// ── Local helpers ─────────────────────────────────────────────────────────────

const GOAL_COLORS: Record<string, string> = {
  build_strength:    WORKOUT_STYLE_COLORS.Strength     ?? '#a78bfa',
  build_muscle:      WORKOUT_STYLE_COLORS.Bodybuilding ?? '#f97316',
  lose_fat:          WORKOUT_STYLE_COLORS.HIIT         ?? '#ef4444',
  improve_endurance: WORKOUT_STYLE_COLORS.Cardio       ?? '#22c55e',
  general_fitness:   WORKOUT_STYLE_COLORS.CrossFit     ?? '#f87116',
  event_preparation: WORKOUT_STYLE_COLORS.Hyrox        ?? '#06b6d4',
  improve_mobility:  WORKOUT_STYLE_COLORS.Mobility     ?? '#86efac',
};

function getStyleForGoal(goal: string): string {
  switch (goal) {
    case 'build_strength':    return 'Strength';
    case 'build_muscle':      return 'Bodybuilding';
    case 'lose_fat':          return 'HIIT';
    case 'improve_endurance': return 'HIIT';
    case 'general_fitness':   return 'CrossFit';
    case 'event_preparation': return 'Hyrox';
    case 'improve_mobility':  return 'Mobility';
    default:                  return 'Strength';
  }
}

const SPLIT_BY_DAYS: Record<number, string[]> = {
  2: ['Full Body', 'Upper / Lower'],
  3: ['Full Body', 'Push / Pull / Legs', 'Upper / Lower / Full'],
  4: ['Upper / Lower', 'Push / Pull / Legs', 'Full Body'],
  5: ['Push / Pull / Legs', 'Upper / Lower / Full'],
  6: ['Push / Pull / Legs', 'Upper / Lower', 'Body Part Split'],
  7: ['Push / Pull / Legs', 'Body Part Split'],
};

const EXP_CONFIG: Record<ExperienceLevel, {
  label: string;
  description: string;
  rpeCap: number;
  note: string;
}> = {
  beginner: {
    label: 'Beginner',
    description: 'Less than 1 year of consistent training',
    rpeCap: EXPERIENCE_MODIFIERS.beginner.intensity_cap_rpe,
    note: 'Moderate volume · Focus on form',
  },
  intermediate: {
    label: 'Intermediate',
    description: '1–3 years of consistent training',
    rpeCap: EXPERIENCE_MODIFIERS.intermediate.intensity_cap_rpe,
    note: 'Progressive overload · Higher intensity',
  },
  advanced: {
    label: 'Advanced',
    description: '3+ years, comfortable with complex lifts',
    rpeCap: EXPERIENCE_MODIFIERS.advanced.intensity_cap_rpe,
    note: 'Max overreach · Full periodization',
  },
};

function addWeeks(dateStr: string, weeks: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const sStr = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const eStr = e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${sStr} — ${eStr}`;
}

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface PhaseSegment { phase: PlanPhase; weeks: number; startWeek: number; }

function getPhaseSegments(goal: PlanGoal, length: PlanLength): PhaseSegment[] {
  const weeks = getPhaseStructure(length, goal);
  const segments: PhaseSegment[] = [];
  for (const w of weeks) {
    const last = segments[segments.length - 1];
    if (last && last.phase === w.phase) {
      last.weeks += 1;
    } else {
      segments.push({ phase: w.phase, weeks: 1, startWeek: w.week_number });
    }
  }
  return segments;
}

// ── Phase Timeline ────────────────────────────────────────────────────────────

const PHASE_DESCRIPTIONS: Record<string, string> = {
  foundation:     'Build baseline strength and practice movement patterns at moderate intensity. Establishes the foundation for progressive overload.',
  accumulation:   'Increase training volume week over week. Higher rep ranges drive hypertrophy and build work capacity.',
  intensification:'Load increases while volume decreases. Heavier weights and lower reps develop max strength and neural efficiency.',
  peak:           'Push toward peak output. Intensity is highest, volume is lowest. Designed to express your full strength.',
  deload:         'Active recovery week. Reduced load lets your body adapt, reduces fatigue, and sets you up for the next block.',
  maintenance:    'Hold your current level of fitness. Lower intensity keeps you moving without adding new stress.',
};

interface TimelineProps { segments: PhaseSegment[]; accentColor: string; }

function PhaseTimeline({ segments, accentColor }: TimelineProps) {
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);
  const total = segments.reduce((s, seg) => s + seg.weeks, 0);

  // Deduplicate legend: show each unique phase once with total weeks
  const uniquePhases = useMemo(() => {
    const map = new Map<string, { phase: PlanPhase; totalWeeks: number }>();
    for (const seg of segments) {
      const existing = map.get(seg.phase);
      if (existing) {
        existing.totalWeeks += seg.weeks;
      } else {
        map.set(seg.phase, { phase: seg.phase, totalWeeks: seg.weeks });
      }
    }
    return Array.from(map.values());
  }, [segments]);

  const getPhaseColor = (phase: PlanPhase) => PHASE_COLORS[phase] ?? accentColor;

  return (
    <View style={tlStyles.wrap}>
      {/* Bar */}
      <View style={tlStyles.barRow}>
        {segments.map((seg, i) => {
          const segColor = getPhaseColor(seg.phase);
          const pct = (seg.weeks / total) * 100;
          const isExpanded = expandedPhase === seg.phase;
          return (
            <TouchableOpacity
              key={i}
              style={[
                tlStyles.barSegment,
                { width: `${pct}%` as any, backgroundColor: segColor, opacity: seg.phase === 'deload' ? 0.5 : 1, borderRadius: 0 },
                i === 0 && { borderTopLeftRadius: 6, borderBottomLeftRadius: 6 },
                i === segments.length - 1 && { borderTopRightRadius: 6, borderBottomRightRadius: 6 },
              ]}
              onPress={() => setExpandedPhase(isExpanded ? null : seg.phase)}
              activeOpacity={0.75}
            />
          );
        })}
      </View>

      {/* Legend — deduplicated */}
      <View style={tlStyles.labelRow}>
        {uniquePhases.map(({ phase, totalWeeks }) => {
          const phaseColor = getPhaseColor(phase);
          const isExpanded = expandedPhase === phase;
          return (
            <TouchableOpacity
              key={phase}
              style={tlStyles.labelItem}
              onPress={() => setExpandedPhase(isExpanded ? null : phase)}
              activeOpacity={0.7}
            >
              <View style={[tlStyles.dot, { backgroundColor: phaseColor }]} />
              <Text style={[tlStyles.labelText, { color: phaseColor }]} numberOfLines={1}>
                {PHASE_DISPLAY_NAMES[phase]}
              </Text>
              <Text style={tlStyles.labelWeeks}>{totalWeeks}w</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Expanded phase info */}
      {expandedPhase !== null && (() => {
        const desc = PHASE_DESCRIPTIONS[expandedPhase];
        if (!desc) return null;
        const phaseColor = getPhaseColor(expandedPhase as PlanPhase);
        return (
          <View style={[tlStyles.phaseInfo, { backgroundColor: `${phaseColor}10`, borderColor: `${phaseColor}28` }]}>
            <Text style={[tlStyles.phaseInfoName, { color: phaseColor }]}>
              {PHASE_DISPLAY_NAMES[expandedPhase as PlanPhase] ?? expandedPhase}
            </Text>
            <Text style={tlStyles.phaseInfoDesc}>{desc}</Text>
          </View>
        );
      })()}
    </View>
  );
}

const tlStyles = StyleSheet.create({
  wrap: { gap: 10 },
  barRow: { flexDirection: 'row' as const, height: 10, borderRadius: 6, overflow: 'hidden' as const, gap: 2 },
  barSegment: { height: 10 },
  labelRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 10 },
  labelItem: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  labelText: { fontSize: 11, fontFamily: 'Outfit_600SemiBold' },
  labelWeeks: { fontSize: 11, fontFamily: 'Outfit_400Regular', color: '#888' },
  phaseInfo: {
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 12, gap: 5,
  },
  phaseInfoName: { fontSize: 12, fontFamily: 'Outfit_700Bold', letterSpacing: 0.2 },
  phaseInfoDesc: { fontSize: 12, fontFamily: 'Outfit_400Regular', color: 'rgba(255,255,255,0.55)', lineHeight: 17 },
});

// ── Main Component ────────────────────────────────────────────────────────────

// Goals that map to Pro-only styles (Strength, Bodybuilding)
const PRO_GOALS = new Set(['build_strength', 'build_muscle']);

export default function WorkoutPlanDrawer({ visible, onClose, editPlan }: Props) {
  const { colors, accent } = useZealTheme();
  const ctx = useAppContext();
  const { hasPro, openPaywall } = useSubscription();
  const seventyFiveHard = useSeventyFiveHard();
  const tracking = useWorkoutTracking();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState('');
  const [event, setEvent] = useState('');
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [selectedSplit, setSelectedSplit] = useState<string>('');
  const [sessionDuration, setSessionDuration] = useState(60);
  const [experience, setExperience] = useState<ExperienceLevel | ''>('');
  const [planLength, setPlanLength] = useState<PlanLength>(8);
  const [startDate] = useState(getTodayStr());
  const [preGenProgress, setPreGenProgress] = useState<{ current: number; total: number } | null>(null);
  const [planEquipment, setPlanEquipment] = useState<Record<string, number>>({});
  const [planEquipPresetId, setPlanEquipPresetId] = useState<string>('');
  const [showEquipmentDrawer, setShowEquipmentDrawer] = useState(false);

  // 75 Hard wizard state
  const [is75Hard, setIs75Hard] = useState(false);
  const [hard75PickUpDay, setHard75PickUpDay] = useState(1); // 1 = start fresh
  const [hard75StartFresh, setHard75StartFresh] = useState(true);
  const [hard75Style, setHard75Style] = useState('');

  const isEventGoal = goal === 'event_preparation';
  const totalSteps = is75Hard ? 4 : isEventGoal ? 8 : 7;
  const goalAccent = is75Hard ? '#eab308' : goal ? (GOAL_COLORS[goal] ?? accent) : accent;
  const autoStyle = goal ? getStyleForGoal(goal) : 'Strength';

  // Clear split selection when days/week changes so user must re-pick
  useEffect(() => {
    setSelectedSplit('');
  }, [daysPerWeek]);

  useEffect(() => {
    if (visible) {
      setPreGenProgress(null);

      if (editPlan) {
        // Edit mode — pre-fill from existing plan and jump to preview
        setIs75Hard(false); setHard75PickUpDay(1); setHard75StartFresh(true); setHard75Style('');
        setGoal(editPlan.goalId ?? '');
        setEvent(editPlan.event?.[0] ?? '');
        setDaysPerWeek(editPlan.daysPerWeek);
        setSessionDuration(editPlan.sessionDuration);
        setExperience((editPlan.experienceLevel as ExperienceLevel) || '');
        setPlanLength(editPlan.planLength as PlanLength);
        setSelectedSplit(editPlan.trainingSplit ?? '');
        const equip = editPlan.equipment ?? ctx.selectedEquipment;
        setPlanEquipment({ ...equip });
        const count = Object.values(equip).filter(v => v > 0).length;
        if (count === 0) {
          setPlanEquipPresetId('no_equipment');
        } else {
          const matched = ctx.savedGyms.find(g => {
            const gKeys = Object.keys(g.equipment).filter(k => (g.equipment[k] ?? 0) > 0).sort().join(',');
            const eKeys = Object.keys(equip).filter(k => (equip[k] ?? 0) > 0).sort().join(',');
            return gKeys === eKeys;
          });
          setPlanEquipPresetId(matched?.id ?? 'custom');
        }
        // Jump to step 1 so user can change any setting, then advance to preview
        setStep(1);
      } else {
        // New plan — reset everything
        setStep(1); setGoal(''); setEvent('');
        setDaysPerWeek(4); setSessionDuration(60);
        setExperience(''); setPlanLength(8);
        setSelectedSplit('');
        setIs75Hard(false); setHard75PickUpDay(1); setHard75StartFresh(true); setHard75Style('');
        // Initialize equipment from current settings — detect which preset matches
        const equip = ctx.selectedEquipment;
        setPlanEquipment({ ...equip });
        const count = Object.values(equip).filter(v => v > 0).length;
        if (count === 0) {
          setPlanEquipPresetId('no_equipment');
        } else {
          const matched = ctx.savedGyms.find(g => {
            const gKeys = Object.keys(g.equipment).filter(k => (g.equipment[k] ?? 0) > 0).sort().join(',');
            const eKeys = Object.keys(equip).filter(k => (equip[k] ?? 0) > 0).sort().join(',');
            return gKeys === eKeys;
          });
          setPlanEquipPresetId(matched?.id ?? 'custom');
        }
      }
    }
  }, [visible, editPlan, ctx.selectedEquipment, ctx.savedGyms]);

  const effectiveStartDate = editPlan?.startDate ?? startDate;
  const endDate = useMemo(() => addWeeks(effectiveStartDate, planLength), [effectiveStartDate, planLength]);

  const phaseSegments = useMemo<PhaseSegment[]>(() => {
    if (!goal || !experience) return [];
    try { return getPhaseSegments(goal as PlanGoal, planLength); } catch { return []; }
  }, [goal, planLength, experience]);

  const canGoNext = useMemo(() => {
    if (is75Hard) {
      switch (step) {
        case 1: return true; // Goal already set to 75 Hard
        case 2: return true; // Start fresh / pick up — always valid
        case 3: return !!hard75Style && !!selectedSplit; // Style + split
        default: return false;
      }
    }
    switch (step) {
      case 1: return !!goal;
      // Non-event step 2 = days/split; event step 2 = event picker
      case 2: return isEventGoal ? !!event : !!selectedSplit;
      // Non-event step 3 = session duration (always valid); event step 3 = days/split
      case 3: return isEventGoal ? !!selectedSplit : true;
      case 4: return isEventGoal ? true : !!experience;
      case 5: return isEventGoal ? !!experience : true;
      case 6: return true; // Equipment (event) or Plan Length (normal) — always valid
      case 7: return true; // Plan Length (event) — always valid
      default: return false;
    }
  }, [step, goal, event, experience, isEventGoal, selectedSplit, is75Hard, hard75Style]);

  const handleNext = useCallback(() => {
    if (!canGoNext) return;
    if (step < totalSteps) setStep(s => s + 1);
  }, [canGoNext, step, totalSteps]);

  const handleBack = useCallback(() => {
    if (step > 1) setStep(s => s - 1);
  }, [step]);

  const handleGenerate = useCallback(async () => {
    // ── 75 Hard generation path ───────────────────────────────────────────
    if (is75Hard) {
      const pickUpDay = hard75StartFresh ? 1 : hard75PickUpDay;
      const genInput: PlanGenerationInput = {
        goal: 'general_fitness' as PlanGoal,
        style: hard75Style,
        event: [],
        daysPerWeek: 7,
        sessionDuration: 45,
        experienceLevel: (ctx.fitnessLevel as ExperienceLevel) || 'intermediate',
        planLength: 12 as PlanLength, // unused by generate75HardSchedule but required by type
        startDate: effectiveStartDate,
        trainingSplit: selectedSplit,
        is75Hard: true,
      };

      const schedule = generate75HardSchedule(genInput);

      const plan: WorkoutPlan = {
        id: `plan_${Date.now()}`,
        name: '75 Hard Challenge',
        goal: '75 Hard',
        goalId: 'general_fitness' as PlanGoal,
        style: hard75Style,
        event: [],
        daysPerWeek: 7,
        sessionDuration: 45,
        trainingSplit: selectedSplit,
        experienceLevel: ctx.fitnessLevel || 'intermediate',
        planLength: 11,
        startDate: effectiveStartDate,
        endDate: addWeeks(effectiveStartDate, 11),
        createdAt: new Date().toISOString(),
        active: true,
        schedule,
        missedDays: [],
        completedDays: [],
        equipment: planEquipment,
        is75Hard: true,
      };
      ctx.saveActivePlan(plan, schedule);

      // Initialize 75 Hard context state
      seventyFiveHard.startChallenge(pickUpDay);

      const genParamsFactory = (d: DayPrescription): GenerateWorkoutParams => ({
        style: d.style,
        split: d.session_type,
        targetDuration: d.target_duration,
        restSlider: ctx.restBetweenSets,
        availableEquipment: planEquipment,
        fitnessLevel: ctx.fitnessLevel || 'intermediate',
        sex: ctx.sex,
        specialLifeCase: ctx.specialLifeCase,
        specialLifeCaseDetail: ctx.specialLifeCaseDetail,
        warmUp: true,
        coolDown: true,
        recovery: true,
        addCardio: true,
        specificMuscles: [],
        planPhase: d.phase,
        volumeModifier: d.volume_modifier,
        bodyweightLbs: ctx.weight,
        exercisePreferences: ctx.exercisePreferences,
        cacheVariantKey: `${plan.id}_${d.date}`,
      });

      setPreGenProgress({ current: 0, total: 1 });
      await ctx.startPlanGeneration(plan, schedule, genParamsFactory);
      setPreGenProgress(null);

      // Load today's pre-generated workout into memory so the workout tab
      // shows it immediately rather than triggering a fresh AI generation.
      await tracking.ensureTodayWorkoutGenerated();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onClose();
      return;
    }

    // ── Normal plan generation path ───────────────────────────────────────
    if (!goal || !experience) return;
    const goalOption = PLAN_GOALS.find(g => g.id === goal);
    const goalLabel = goalOption?.label ?? goal;
    const planName = `${planLength}-Week ${goalLabel} Plan`;

    const genInput: PlanGenerationInput = {
      goal: goal as PlanGoal,
      style: autoStyle,
      event: isEventGoal && event ? [event] : [],
      daysPerWeek,
      sessionDuration,
      experienceLevel: experience as ExperienceLevel,
      planLength,
      startDate: effectiveStartDate,
      trainingSplit: selectedSplit,
    };

    const schedule = generatePlanSchedule(genInput);

    // Ensure the plan doesn't open on a rest day.
    // Find how many days into week 1 the first training day falls, then
    // shift ALL day dates backward by that offset so training day 1 = today.
    if (schedule.weeks.length > 0) {
      const firstTrainingIdx = schedule.weeks[0].days.findIndex(d => !d.is_rest);
      if (firstTrainingIdx > 0) {
        for (const week of schedule.weeks) {
          for (const day of week.days) {
            const d = new Date(day.date + 'T00:00:00');
            d.setDate(d.getDate() - firstTrainingIdx);
            day.date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          }
        }
        // For new plans: strip days before today. For edits: keep all past days
        // so the schedule history remains intact for the progress display.
        schedule.weeks[0].days = schedule.weeks[0].days.filter(
          d => d.date >= effectiveStartDate
        );
      }
    }

    const plan: WorkoutPlan = {
      id: editPlan?.id ?? `plan_${Date.now()}`,
      name: planName,
      goal: goalLabel,
      goalId: goal as PlanGoal,
      style: autoStyle,
      event: isEventGoal && event ? [event] : [],
      daysPerWeek,
      sessionDuration,
      trainingSplit: selectedSplit,
      experienceLevel: experience,
      planLength,
      startDate: effectiveStartDate,
      endDate: addWeeks(effectiveStartDate, planLength),
      createdAt: editPlan?.createdAt ?? new Date().toISOString(),
      active: true,
      schedule,
      missedDays: editPlan?.missedDays ?? [],
      completedDays: editPlan?.completedDays ?? [],
      equipment: planEquipment,
    };
    ctx.saveActivePlan(plan, schedule);

    // ── Generate workouts: Week 1 in parallel, rest in background ────────────
    // Always generate all components — user toggles control visibility at render time
    const genParamsFactory = (d: DayPrescription): GenerateWorkoutParams => ({
      style: d.style,
      split: d.session_type,
      targetDuration: d.target_duration,
      restSlider: ctx.restBetweenSets,
      availableEquipment: planEquipment,
      fitnessLevel: experience ?? ctx.fitnessLevel,
      sex: ctx.sex,
      specialLifeCase: ctx.specialLifeCase,
      specialLifeCaseDetail: ctx.specialLifeCaseDetail,
      warmUp: true,
      coolDown: true,
      recovery: true,
      addCardio: true,
      specificMuscles: [],
      planPhase: d.phase,
      volumeModifier: d.volume_modifier,
      bodyweightLbs: ctx.weight,
      exercisePreferences: ctx.exercisePreferences,
      cacheVariantKey: `${plan.id}_${d.date}`,
    });

    setPreGenProgress({ current: 0, total: 1 });
    await ctx.startPlanGeneration(plan, schedule, genParamsFactory);
    setPreGenProgress(null);

    // Load today's pre-generated workout into memory so the workout tab
    // shows it immediately rather than triggering a fresh AI generation.
    await tracking.ensureTodayWorkoutGenerated();

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onClose();
  }, [goal, event, daysPerWeek, sessionDuration, experience, planLength, startDate, endDate, autoStyle, isEventGoal, selectedSplit, planEquipment, editPlan, ctx, onClose, is75Hard, hard75Style, hard75StartFresh, hard75PickUpDay, seventyFiveHard, tracking]);

  const goalOption = PLAN_GOALS.find(g => g.id === goal);
  const expConfig = experience ? EXP_CONFIG[experience] : null;
  const isPreviewStep = step === totalSteps;

  // Map step to content: normalStep vs eventStep (event flow has one extra step)
  const cs = (normalStep: number, eventStep: number) => isEventGoal ? eventStep : normalStep;

  const progressWidth = `${(step / totalSteps) * 100}%` as const;

  const headerContent = (
    <View>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <PlatformIcon name="sparkles" size={14} color={goalAccent} />
          <Text style={[styles.headerLabel, { color: goalAccent }]}>{editPlan ? 'EDIT PLAN' : 'WORKOUT PLAN'}</Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
          <PlatformIcon name="x" size={15} color={colors.textSecondary} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
      <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
        <View style={[styles.progressFill, { width: progressWidth, backgroundColor: goalAccent }]} />
      </View>
    </View>
  );

  return (<>
    <BaseDrawer visible={visible} onClose={onClose} header={headerContent}>
      <View style={styles.content}>

        {/* ─── Step 1: Goal ───────────────────────────────────────────── */}
        {/* ─── 75 Hard: Step 2 — Start Fresh or Pick Up ────────────── */}
        {is75Hard && step === 2 && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Where are you starting?</Text>
            <Text style={[styles.stepSub, { color: colors.textSecondary }]}>Start fresh or pick up where you left off</Text>

            <TouchableOpacity
              style={[
                styles.goalRow,
                { backgroundColor: colors.cardSecondary, borderColor: hard75StartFresh ? goalAccent : colors.border },
                hard75StartFresh && { backgroundColor: `${goalAccent}10` },
              ]}
              onPress={() => { setHard75StartFresh(true); setHard75PickUpDay(1); }}
              activeOpacity={0.7}
            >
              <View style={[styles.goalIconWrap, { backgroundColor: hard75StartFresh ? `${goalAccent}20` : `${colors.border}60` }]}>
                <PlatformIcon name="play" size={18} color={hard75StartFresh ? goalAccent : colors.textSecondary} />
              </View>
              <View style={styles.goalRowText}>
                <Text style={[styles.goalLabel, { color: hard75StartFresh ? goalAccent : colors.text }]}>Start Fresh (Day 1)</Text>
                <Text style={[styles.goalDesc, { color: colors.textSecondary }]}>Begin the challenge from the start</Text>
              </View>
              {hard75StartFresh && (
                <View style={[styles.checkCircle, { backgroundColor: goalAccent }]}>
                  <PlatformIcon name="check" size={12} color="#fff" strokeWidth={3} />
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.goalRow,
                { backgroundColor: colors.cardSecondary, borderColor: !hard75StartFresh ? goalAccent : colors.border },
                !hard75StartFresh && { backgroundColor: `${goalAccent}10` },
              ]}
              onPress={() => setHard75StartFresh(false)}
              activeOpacity={0.7}
            >
              <View style={[styles.goalIconWrap, { backgroundColor: !hard75StartFresh ? `${goalAccent}20` : `${colors.border}60` }]}>
                <PlatformIcon name="fast-forward" size={18} color={!hard75StartFresh ? goalAccent : colors.textSecondary} />
              </View>
              <View style={styles.goalRowText}>
                <Text style={[styles.goalLabel, { color: !hard75StartFresh ? goalAccent : colors.text }]}>Pick Up Where I Am</Text>
                <Text style={[styles.goalDesc, { color: colors.textSecondary }]}>Resume from a specific day</Text>
              </View>
              {!hard75StartFresh && (
                <View style={[styles.checkCircle, { backgroundColor: goalAccent }]}>
                  <PlatformIcon name="check" size={12} color="#fff" strokeWidth={3} />
                </View>
              )}
            </TouchableOpacity>

            {!hard75StartFresh && (
              <View style={[styles.splitPreview, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
                <View style={styles.splitPreviewHeader}>
                  <PlatformIcon name="calendar" size={13} color={colors.textSecondary} />
                  <Text style={[styles.splitPreviewLabel, { color: colors.textSecondary }]}>What day are you on?</Text>
                </View>
                <View style={styles.chipWrap}>
                  {[5, 10, 15, 20, 25, 30, 40, 50, 60].map(d => {
                    const isSelected = hard75PickUpDay === d;
                    return (
                      <TouchableOpacity
                        key={d}
                        style={[
                          styles.eventChip,
                          { borderColor: isSelected ? goalAccent : colors.border },
                          isSelected && { backgroundColor: `${goalAccent}18` },
                        ]}
                        onPress={() => setHard75PickUpDay(d)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.eventChipText, { color: isSelected ? goalAccent : colors.text }]}>Day {d}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        )}

        {/* ─── 75 Hard: Step 3 — Workout 1 Style + Split ─────────────── */}
        {is75Hard && step === 3 && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Workout 1 style</Text>
            <Text style={[styles.stepSub, { color: colors.textSecondary }]}>Your daily AI workout (45 min, indoor)</Text>
            <View style={styles.chipWrap}>
              {(['Strength', 'Bodybuilding', 'CrossFit', 'HIIT', 'Hybrid', 'Mobility'] as const).map(s => {
                const isSelected = hard75Style === s;
                const sColor = WORKOUT_STYLE_COLORS[s] ?? accent;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.eventChip,
                      { borderColor: isSelected ? sColor : colors.border },
                      isSelected && { backgroundColor: `${sColor}18` },
                    ]}
                    onPress={() => setHard75Style(s)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.eventChipText, { color: isSelected ? sColor : colors.text }]}>{s}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {hard75Style && (
              <View style={[styles.splitPreview, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
                <View style={styles.splitPreviewHeader}>
                  <PlatformIcon name="calendar" size={13} color={colors.textSecondary} />
                  <Text style={[styles.splitPreviewLabel, { color: colors.textSecondary }]}>Choose your split</Text>
                </View>
                <View style={styles.splitChipRow}>
                  {(SPLIT_BY_DAYS[7] ?? ['Push / Pull / Legs']).map((session, i) => {
                    const isSelected = selectedSplit === session;
                    const isRecommended = i === 0;
                    return (
                      <TouchableOpacity
                        key={i}
                        style={[
                          styles.splitChipItem,
                          isSelected
                            ? { backgroundColor: goalAccent, borderColor: goalAccent }
                            : { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' },
                        ]}
                        onPress={() => setSelectedSplit(session)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.splitChipItemText, { color: isSelected ? '#fff' : 'rgba(255,255,255,0.8)' }]}>
                          {session}
                        </Text>
                        {isRecommended && !isSelected && (
                          <View style={[styles.recommendedBadge, { backgroundColor: `${goalAccent}22`, borderColor: `${goalAccent}50` }]}>
                            <Text style={[styles.recommendedBadgeText, { color: goalAccent }]}>Recommended</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        )}

        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>What's your goal?</Text>
            <Text style={[styles.stepSub, { color: colors.textSecondary }]}>Choose what you're training toward</Text>
            <View style={styles.goalList}>

              {/* ─── 75 Hard Challenge Card ─── */}
              <TouchableOpacity
                style={[
                  styles.goalRow,
                  { backgroundColor: colors.cardSecondary, borderColor: is75Hard ? '#eab308' : colors.border },
                  is75Hard && { backgroundColor: 'rgba(234,179,8,0.08)' },
                ]}
                onPress={() => {
                  if (!hasPro) { showProGate('75hard', openPaywall); return; }
                  setIs75Hard(true); setGoal('');
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.goalIconWrap, { backgroundColor: is75Hard ? 'rgba(234,179,8,0.2)' : `${colors.border}60` }]}>
                  <PlatformIcon name="trophy" size={18} color={is75Hard ? '#eab308' : colors.textSecondary} />
                </View>
                <View style={styles.goalRowText}>
                  <Text style={[styles.goalLabel, { color: is75Hard ? '#eab308' : colors.text }]}>75 Hard Challenge</Text>
                  <Text style={[styles.goalDesc, { color: colors.textSecondary }]}>75 days · 2 workouts/day · daily checklist</Text>
                </View>
                {!hasPro ? (
                  <View style={[styles.checkCircle, { backgroundColor: 'rgba(212,169,62,0.25)' }]}>
                    <Text style={{ fontSize: 8, fontFamily: 'Outfit_700Bold', color: '#d4a93e', letterSpacing: 0.5 }}>PRO</Text>
                  </View>
                ) : is75Hard ? (
                  <View style={[styles.checkCircle, { backgroundColor: '#eab308' }]}>
                    <PlatformIcon name="check" size={12} color="#fff" strokeWidth={3} />
                  </View>
                ) : null}
              </TouchableOpacity>

              {PLAN_GOALS.map(g => {
                const isSelected = goal === g.id;
                const gColor = GOAL_COLORS[g.id] ?? accent;
                const isProGoal = PRO_GOALS.has(g.id);
                const isLocked = isProGoal && !hasPro;
                return (
                  <TouchableOpacity
                    key={g.id}
                    style={[
                      styles.goalRow,
                      { backgroundColor: colors.cardSecondary, borderColor: isSelected ? gColor : colors.border },
                      isSelected && { backgroundColor: `${gColor}10` },
                      isLocked && { opacity: 0.7 },
                    ]}
                    onPress={() => {
                      if (isLocked) { openPaywall(); return; }
                      setGoal(g.id); setIs75Hard(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.goalIconWrap, { backgroundColor: isSelected ? `${gColor}20` : `${colors.border}60` }]}>
                      <PlatformIcon name={g.icon as any} size={18} color={isSelected ? gColor : colors.textSecondary} />
                    </View>
                    <View style={styles.goalRowText}>
                      <Text style={[styles.goalLabel, { color: isSelected ? gColor : colors.text }]}>{g.label}</Text>
                      <Text style={[styles.goalDesc, { color: colors.textSecondary }]} numberOfLines={1}>{g.description}</Text>
                    </View>
                    {isLocked ? (
                      <View style={[styles.checkCircle, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
                        <PlatformIcon name="lock" size={11} color={colors.textMuted} />
                      </View>
                    ) : isSelected ? (
                      <View style={[styles.checkCircle, { backgroundColor: gColor }]}>
                        <PlatformIcon name="check" size={12} color="#fff" strokeWidth={3} />
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ─── Step 2 (event flow only): Event ────────────────────────── */}
        {!is75Hard && isEventGoal && step === 2 && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Which event?</Text>
            <Text style={[styles.stepSub, { color: colors.textSecondary }]}>Your plan will peak at the right time</Text>
            <View style={styles.chipWrap}>
              {PLAN_EVENTS.filter(e => e !== 'No specific event').map(ev => {
                const isSelected = event === ev;
                return (
                  <TouchableOpacity
                    key={ev}
                    style={[
                      styles.eventChip,
                      { borderColor: isSelected ? goalAccent : colors.border },
                      isSelected && { backgroundColor: `${goalAccent}18` },
                    ]}
                    onPress={() => setEvent(ev)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.eventChipText, { color: isSelected ? goalAccent : colors.text }]}>{ev}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ─── Days Per Week ──────────────────────────────────────────── */}
        {!is75Hard && step === cs(2, 3) && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Days per week?</Text>
            <Text style={[styles.stepSub, { color: colors.textSecondary }]}>We'll build your weekly schedule around this</Text>
            <View style={styles.daysRow}>
              {DAYS_PER_WEEK_OPTIONS.map(d => {
                const isSelected = daysPerWeek === d;
                return (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.dayPill,
                      { borderColor: isSelected ? goalAccent : colors.border },
                      isSelected && { backgroundColor: goalAccent },
                    ]}
                    onPress={() => setDaysPerWeek(d)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dayPillText, { color: isSelected ? '#fff' : colors.text }]}>{d}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={[styles.splitPreview, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
              <View style={styles.splitPreviewHeader}>
                <PlatformIcon name="calendar" size={13} color={colors.textSecondary} />
                <Text style={[styles.splitPreviewLabel, { color: colors.textSecondary }]}>Choose your split</Text>
              </View>
              <View style={styles.splitChipRow}>
                {(SPLIT_BY_DAYS[daysPerWeek] ?? ['Full Body']).map((session, i) => {
                  const isSelected = selectedSplit === session;
                  const isRecommended = i === 0;
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.splitChipItem,
                        isSelected
                          ? { backgroundColor: goalAccent, borderColor: goalAccent }
                          : { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' },
                      ]}
                      onPress={() => setSelectedSplit(session)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.splitChipItemText, { color: isSelected ? '#fff' : 'rgba(255,255,255,0.8)' }]}>
                        {session}
                      </Text>
                      {isRecommended && !isSelected && (
                        <View style={[styles.recommendedBadge, { backgroundColor: `${goalAccent}22`, borderColor: `${goalAccent}50` }]}>
                          <Text style={[styles.recommendedBadgeText, { color: goalAccent }]}>Recommended</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* ─── Session Duration ───────────────────────────────────────── */}
        {!is75Hard && step === cs(3, 4) && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Session length?</Text>
            <Text style={[styles.stepSub, { color: colors.textSecondary }]}>Includes warm-up and cool-down</Text>
            <View style={styles.durationRow}>
              {SESSION_DURATION_OPTIONS.map(d => {
                const isSelected = sessionDuration === d;
                return (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.durationChip,
                      { borderColor: isSelected ? goalAccent : colors.border },
                      isSelected && { backgroundColor: `${goalAccent}18` },
                    ]}
                    onPress={() => setSessionDuration(d)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.durationValue, { color: isSelected ? goalAccent : colors.text }]}>{d}</Text>
                    <Text style={[styles.durationUnit, { color: isSelected ? goalAccent : colors.textSecondary }]}>min</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ─── Experience Level ───────────────────────────────────────── */}
        {!is75Hard && step === cs(4, 5) && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Your experience?</Text>
            <Text style={[styles.stepSub, { color: colors.textSecondary }]}>Shapes volume, intensity, and block structure</Text>
            {(Object.keys(EXP_CONFIG) as ExperienceLevel[]).map(lvl => {
              const cfg = EXP_CONFIG[lvl];
              const isSelected = experience === lvl;
              return (
                <TouchableOpacity
                  key={lvl}
                  style={[
                    styles.expCard,
                    { borderColor: isSelected ? goalAccent : colors.border, backgroundColor: colors.cardSecondary },
                    isSelected && { backgroundColor: `${goalAccent}10`, borderColor: goalAccent },
                  ]}
                  onPress={() => setExperience(lvl)}
                  activeOpacity={0.7}
                >
                  <View style={styles.expCardContent}>
                    <Text style={[styles.expLabel, { color: isSelected ? goalAccent : colors.text }]}>{cfg.label}</Text>
                    <Text style={[styles.expDesc, { color: colors.textSecondary }]}>{cfg.description}</Text>
                    <Text style={[styles.expMeta, { color: colors.textMuted }]}>
                      RPE cap {cfg.rpeCap} · {cfg.note}
                    </Text>
                  </View>
                  {isSelected && (
                    <View style={[styles.checkCircle, { backgroundColor: goalAccent }]}>
                      <PlatformIcon name="check" size={12} color="#fff" strokeWidth={3} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ─── Equipment ──────────────────────────────────────────────── */}
        {!is75Hard && step === cs(5, 6) && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Equipment</Text>
            <Text style={[styles.stepSub, { color: colors.textSecondary }]}>What do you have access to?</Text>

            {/* Saved gyms */}
            {ctx.savedGyms.map(gym => {
              const isSelected = planEquipPresetId === gym.id;
              const itemCount = Object.values(gym.equipment).filter(v => v > 0).length;
              return (
                <View key={gym.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TouchableOpacity
                    style={[
                      styles.goalRow,
                      { flex: 1, backgroundColor: colors.cardSecondary, borderColor: isSelected ? goalAccent : colors.border },
                      isSelected && { backgroundColor: `${goalAccent}10` },
                    ]}
                    onPress={() => { setPlanEquipment({ ...gym.equipment }); setPlanEquipPresetId(gym.id); }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.goalIconWrap, { backgroundColor: isSelected ? `${goalAccent}20` : `${colors.border}60` }]}>
                      <PlatformIcon name={gym.name.toLowerCase().includes('crossfit') ? 'zap' : 'home'} size={18} color={isSelected ? goalAccent : colors.textSecondary} />
                    </View>
                    <View style={styles.goalRowText}>
                      <Text style={[styles.goalLabel, { color: isSelected ? goalAccent : colors.text }]}>{gym.name}</Text>
                      <Text style={[styles.goalDesc, { color: colors.textSecondary }]}>{itemCount} items</Text>
                    </View>
                    {isSelected && (
                      <View style={[styles.checkCircle, { backgroundColor: goalAccent }]}>
                        <PlatformIcon name="check" size={12} color="#fff" strokeWidth={3} />
                      </View>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ padding: 10, borderRadius: 10, backgroundColor: `${colors.border}40` }}
                    onPress={() => { setShowEquipmentDrawer(true); }}
                    activeOpacity={0.7}
                  >
                    <PlatformIcon name="settings" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Quick presets */}
            {([
              { id: 'commercial', label: 'Commercial Gym', desc: 'Full gym access', icon: 'dumbbell', preset: COMMERCIAL_EQUIPMENT_PRESET },
              { id: 'no_equipment', label: 'No Equipment', desc: 'Bodyweight only', icon: 'user', preset: {} as Record<string, number> },
            ] as { id: string; label: string; desc: string; icon: any; preset: Record<string, number> }[]).map(opt => {
              const isSelected = planEquipPresetId === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.goalRow,
                    { backgroundColor: colors.cardSecondary, borderColor: isSelected ? goalAccent : colors.border },
                    isSelected && { backgroundColor: `${goalAccent}10` },
                  ]}
                  onPress={() => { setPlanEquipment({ ...opt.preset }); setPlanEquipPresetId(opt.id); }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.goalIconWrap, { backgroundColor: isSelected ? `${goalAccent}20` : `${colors.border}60` }]}>
                    <PlatformIcon name={opt.icon} size={18} color={isSelected ? goalAccent : colors.textSecondary} />
                  </View>
                  <View style={styles.goalRowText}>
                    <Text style={[styles.goalLabel, { color: isSelected ? goalAccent : colors.text }]}>{opt.label}</Text>
                    <Text style={[styles.goalDesc, { color: colors.textSecondary }]}>{opt.desc}</Text>
                  </View>
                  {isSelected && (
                    <View style={[styles.checkCircle, { backgroundColor: goalAccent }]}>
                      <PlatformIcon name="check" size={12} color="#fff" strokeWidth={3} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}

            <Text style={[styles.goalDesc, { color: colors.textMuted, textAlign: 'center', marginTop: 8 }]}>
              Equipment changes in Settings automatically apply to new workouts
            </Text>
          </View>
        )}

        {/* ─── Plan Length ────────────────────────────────────────────── */}
        {!is75Hard && step === cs(6, 7) && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Plan length?</Text>
            <Text style={[styles.stepSub, { color: colors.textSecondary }]}>More weeks = more mesocycles = better results</Text>
            <View style={styles.lengthRow}>
              {(PLAN_LENGTHS as readonly number[]).map(w => {
                const isSelected = planLength === w;
                const blocks = Math.floor(w / 4);
                return (
                  <TouchableOpacity
                    key={w}
                    style={[
                      styles.lengthCard,
                      { borderColor: isSelected ? goalAccent : colors.border, backgroundColor: colors.cardSecondary },
                      isSelected && { backgroundColor: `${goalAccent}12`, borderColor: goalAccent },
                    ]}
                    onPress={() => setPlanLength(w as PlanLength)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.lengthValue, { color: isSelected ? goalAccent : colors.text }]}>{w}</Text>
                    <Text style={[styles.lengthUnit, { color: isSelected ? goalAccent : colors.textSecondary }]}>wks</Text>
                    <Text style={[styles.lengthBlocks, { color: colors.textMuted }]}>{blocks} cycles</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={[styles.datePreview, { backgroundColor: `${goalAccent}08`, borderColor: `${goalAccent}25` }]}>
              <PlatformIcon name="calendar" size={13} color={goalAccent} />
              <Text style={[styles.datePreviewText, { color: colors.text }]}>
                {formatDateRange(startDate, endDate)}
              </Text>
            </View>
          </View>
        )}

        {/* ─── 75 Hard: Step 4 — Confirm & Start ─────────────────────── */}
        {is75Hard && isPreviewStep && !preGenProgress && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Ready to commit?</Text>
            <Text style={[styles.stepSub, { color: colors.textSecondary }]}>75 days of discipline — no excuses</Text>

            <View style={[styles.summaryCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
              {([
                { icon: 'trophy', label: 'Challenge', value: '75 Hard' },
                { icon: 'calendar', label: 'Duration', value: '75 days (11 weeks)' },
                { icon: 'zap', label: 'Workout 1', value: `${hard75Style} · ${selectedSplit}` },
                { icon: 'sun', label: 'Workout 2', value: 'Outdoor (your choice daily)' },
                { icon: 'clock', label: 'Session', value: '45 min minimum each' },
                { icon: 'play', label: 'Starting', value: hard75StartFresh ? 'Day 1 (fresh start)' : `Day ${hard75PickUpDay} (picking up)` },
              ] as { icon: any; label: string; value: string }[]).map((row, i) => (
                <View
                  key={i}
                  style={[styles.summaryRow, i > 0 && { borderTopWidth: 0.5, borderTopColor: colors.border }]}
                >
                  <View style={styles.summaryRowLeft}>
                    <PlatformIcon name={row.icon} size={13} color={goalAccent} />
                    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{row.label}</Text>
                  </View>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>{row.value}</Text>
                </View>
              ))}
            </View>

            <View style={[styles.datePreview, { backgroundColor: `${goalAccent}08`, borderColor: `${goalAccent}25` }]}>
              <PlatformIcon name="check-circle" size={13} color={goalAccent} />
              <Text style={[styles.datePreviewText, { color: colors.textSecondary }]}>
                Daily: 2 workouts · 1 gal water · 10 pages · strict diet · progress photo
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.generateBtn, { backgroundColor: goalAccent }]}
              onPress={handleGenerate}
              activeOpacity={0.85}
            >
              <PlatformIcon name="trophy" size={16} color="#fff" />
              <Text style={styles.generateBtnText}>Start Challenge</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── Pre-generation loading screen ──────────────────────────── */}
        {preGenProgress && (
          <View style={styles.preGenView}>
            <ActivityIndicator size="large" color={goalAccent} style={{ marginBottom: 20 }} />
            <Text style={[styles.preGenTitle, { color: colors.text }]}>Generating this week</Text>
            <Text style={[styles.preGenSub, { color: colors.textSecondary }]}>
              {ctx.planGenProgress
                ? `Workout ${ctx.planGenProgress.current + 1} of ${ctx.planGenProgress.total}`
                : 'Starting...'}
            </Text>

            {ctx.planGenProgress && (
              <View style={[styles.preGenTrack, { backgroundColor: colors.border }]}>
                <View style={[styles.preGenFill, {
                  width: `${Math.round((ctx.planGenProgress.current / ctx.planGenProgress.total) * 100)}%` as any,
                  backgroundColor: goalAccent,
                }]} />
              </View>
            )}
          </View>
        )}

        {/* ─── Preview / Generate ─────────────────────────────────────── */}
        {!is75Hard && isPreviewStep && !preGenProgress && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Your plan</Text>
            <Text style={[styles.stepSub, { color: colors.textSecondary }]}>Looks good? We'll put it on your calendar.</Text>

            <View style={[styles.summaryCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
              {([
                { icon: 'target', label: 'Goal', value: goalOption?.label ?? '' },
                ...(isEventGoal && event ? [{ icon: 'trophy', label: 'Event', value: event }] : []),
                { icon: 'zap', label: 'Style', value: autoStyle },
                { icon: 'calendar', label: 'Schedule', value: `${daysPerWeek}d/wk · ${selectedSplit}` },
                { icon: 'clock', label: 'Session', value: `${sessionDuration} min` },
                { icon: 'star', label: 'Level', value: expConfig?.label ?? '' },
                { icon: 'dumbbell', label: 'Equipment', value: planEquipPresetId === 'no_equipment' ? 'Bodyweight only' : planEquipPresetId === 'commercial' ? 'Commercial Gym' : ctx.savedGyms.find(g => g.id === planEquipPresetId)?.name ?? `${Object.values(planEquipment).filter(v => v > 0).length} items` },
                { icon: 'calendar', label: 'Dates', value: formatDateRange(startDate, endDate) },
              ] as { icon: any; label: string; value: string }[]).map((row, i) => (
                <View
                  key={i}
                  style={[styles.summaryRow, i > 0 && { borderTopWidth: 0.5, borderTopColor: colors.border }]}
                >
                  <View style={styles.summaryRowLeft}>
                    <PlatformIcon name={row.icon} size={13} color={goalAccent} />
                    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{row.label}</Text>
                  </View>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>{row.value}</Text>
                </View>
              ))}
            </View>

            {phaseSegments.length > 0 && (
              <View style={styles.timelineSection}>
                <Text style={[styles.timelineSectionLabel, { color: colors.textSecondary }]}>PERIODIZATION</Text>
                <PhaseTimeline segments={phaseSegments} accentColor={goalAccent} />
              </View>
            )}

            <TouchableOpacity
              style={[styles.generateBtn, { backgroundColor: goalAccent }]}
              onPress={handleGenerate}
              activeOpacity={0.85}
            >
              <PlatformIcon name="sparkles" size={16} color="#fff" />
              <Text style={styles.generateBtnText}>Start Plan</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── Navigation — inside scroll so it's always measured ───── */}
        {!preGenProgress && <View style={[styles.navRow, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 16) }]}>
          {step > 1 ? (
            <TouchableOpacity style={styles.navBtn} onPress={handleBack} activeOpacity={0.7}>
              <PlatformIcon name="chevron-left" size={16} color={colors.textSecondary} />
              <Text style={[styles.navBtnText, { color: colors.textSecondary }]}>Back</Text>
            </TouchableOpacity>
          ) : <View style={styles.navBtn} />}

          {!isPreviewStep ? (
            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: canGoNext ? goalAccent : colors.border }]}
              onPress={handleNext}
              disabled={!canGoNext}
              activeOpacity={0.85}
            >
              <Text style={[styles.nextBtnText, { color: canGoNext ? '#fff' : colors.textMuted }]}>
                {step === totalSteps - 1 ? 'Review' : 'Next'}
              </Text>
              <PlatformIcon name="chevron-right" size={16} color={canGoNext ? '#fff' : colors.textMuted} />
            </TouchableOpacity>
          ) : <View style={styles.navBtn} />}
        </View>}

      </View>
    </BaseDrawer>

    <EquipmentDrawer
      visible={showEquipmentDrawer}
      onClose={() => {
        setShowEquipmentDrawer(false);
        // Re-sync equipment from context after editing
        const equip = ctx.selectedEquipment;
        setPlanEquipment({ ...equip });
        const matched = ctx.savedGyms.find(g => {
          const gKeys = Object.keys(g.equipment).filter(k => (g.equipment[k] ?? 0) > 0).sort().join(',');
          const eKeys = Object.keys(equip).filter(k => (equip[k] ?? 0) > 0).sort().join(',');
          return gKeys === eKeys;
        });
        if (matched) setPlanEquipPresetId(matched.id);
      }}
    />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8,
  },
  headerLeft: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  headerLabel: { fontSize: 11, fontFamily: 'Outfit_700Bold', letterSpacing: 1 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(128,128,128,0.15)',
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  progressBar: { height: 3, marginHorizontal: 16, borderRadius: 2, marginBottom: 4 },
  progressFill: { height: 3, borderRadius: 2 },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  stepContent: { gap: 14 },
  stepTitle: { fontSize: 22, fontFamily: 'Outfit_800ExtraBold', letterSpacing: -0.5 },
  stepSub: { fontSize: 13, fontFamily: 'Outfit_400Regular', marginBottom: 4 },
  goalList: { gap: 8 },
  goalRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14,
    borderWidth: 1.5, borderRadius: 16, padding: 14,
  },
  goalIconWrap: {
    width: 42, height: 42, borderRadius: 13,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  goalRowText: { flex: 1, gap: 2 },
  goalLabel: { fontSize: 15, fontFamily: 'Outfit_700Bold' },
  goalDesc: { fontSize: 12, fontFamily: 'Outfit_400Regular' },
  checkCircle: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  chipWrap: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8 },
  eventChip: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  eventChipText: { fontSize: 13, fontFamily: 'Outfit_500Medium' },
  daysRow: { flexDirection: 'row' as const, gap: 8 },
  dayPill: {
    width: 46, height: 46, borderRadius: 23, borderWidth: 1.5,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  dayPillText: { fontSize: 17, fontFamily: 'Outfit_700Bold' },
  splitPreview: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  splitPreviewHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  splitPreviewLabel: { fontSize: 11, fontFamily: 'Outfit_600SemiBold', letterSpacing: 0.3 },
  splitChipRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8 },
  splitChipItem: {
    borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 7,
  },
  splitChipItemText: { fontSize: 13, fontFamily: 'Outfit_600SemiBold' },
  recommendedBadge: {
    borderRadius: 8, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2,
  },
  recommendedBadgeText: { fontSize: 10, fontFamily: 'Outfit_600SemiBold', letterSpacing: 0.2 },
  durationRow: { flexDirection: 'row' as const, gap: 10, flexWrap: 'wrap' as const },
  durationChip: {
    flex: 1, minWidth: 60, alignItems: 'center' as const,
    borderWidth: 1.5, borderRadius: 14, paddingVertical: 16, gap: 2,
  },
  durationValue: { fontSize: 22, fontFamily: 'Outfit_800ExtraBold', letterSpacing: -1 },
  durationUnit: { fontSize: 11, fontFamily: 'Outfit_500Medium', letterSpacing: 0.3 },
  expCard: {
    borderWidth: 1.5, borderRadius: 16, padding: 16,
    flexDirection: 'row' as const, alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  expCardContent: { flex: 1, gap: 3 },
  expLabel: { fontSize: 16, fontFamily: 'Outfit_700Bold' },
  expDesc: { fontSize: 12, fontFamily: 'Outfit_400Regular' },
  expMeta: { fontSize: 11, fontFamily: 'Outfit_400Regular', marginTop: 2 },
  lengthRow: { flexDirection: 'row' as const, gap: 10 },
  lengthCard: {
    flex: 1, borderWidth: 1.5, borderRadius: 16,
    paddingVertical: 18, alignItems: 'center' as const, gap: 2,
  },
  lengthValue: { fontSize: 26, fontFamily: 'Outfit_800ExtraBold', letterSpacing: -1 },
  lengthUnit: { fontSize: 12, fontFamily: 'Outfit_600SemiBold' },
  lengthBlocks: { fontSize: 10, fontFamily: 'Outfit_400Regular' },
  datePreview: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10,
  },
  datePreviewText: { fontSize: 13, fontFamily: 'Outfit_500Medium' },
  summaryCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' as const },
  summaryRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16, paddingVertical: 13,
  },
  summaryRowLeft: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  summaryLabel: { fontSize: 12, fontFamily: 'Outfit_500Medium' },
  summaryValue: {
    fontSize: 13, fontFamily: 'Outfit_600SemiBold',
    textAlign: 'right' as const, flexShrink: 1, maxWidth: '55%' as any,
  },
  timelineSection: { gap: 8 },
  timelineSectionLabel: { fontSize: 10, fontFamily: 'Outfit_600SemiBold', letterSpacing: 0.8, paddingLeft: 2 },
  generateBtn: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    justifyContent: 'center' as const, gap: 8,
    borderRadius: 16, paddingVertical: 17, marginTop: 4,
  },
  generateBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Outfit_700Bold', letterSpacing: -0.2 },
  navRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingTop: 16, borderTopWidth: 0.5, marginTop: 8,
  },
  navBtn: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4, minWidth: 70 },
  navBtnText: { fontSize: 14, fontFamily: 'Outfit_600SemiBold' },
  nextBtn: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4,
    borderRadius: 12, paddingHorizontal: 22, paddingVertical: 13,
  },
  nextBtnText: { fontSize: 14, fontFamily: 'Outfit_700Bold' },
  preGenView: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 10,
  },
  preGenTitle: { fontSize: 20, fontFamily: 'Outfit_700Bold', letterSpacing: -0.3 },
  preGenSub: { fontSize: 14, fontFamily: 'Outfit_400Regular' },
  preGenTrack: {
    width: '100%' as any,
    height: 4,
    borderRadius: 2,
    marginTop: 12,
    overflow: 'hidden' as const,
  },
  preGenFill: { height: 4, borderRadius: 2 },
});
