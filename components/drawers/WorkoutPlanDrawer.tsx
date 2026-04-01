import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BaseDrawer from '@/components/drawers/BaseDrawer';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme, useAppContext, type WorkoutPlan } from '@/context/AppContext';
import { WORKOUT_STYLE_COLORS } from '@/constants/colors';
import { generatePlanSchedule, type PlanGenerationInput } from '@/services/planEngine';
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
    case 'improve_endurance': return 'Cardio';
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

  // Build opacity steps: distribute evenly from 0.35 → 1.0 across non-deload segments
  const nonDeload = segments.filter(s => s.phase !== 'deload');
  const getSegmentOpacity = (seg: PhaseSegment, idx: number) => {
    if (seg.phase === 'deload') return 0.22; // deload always dim
    const pos = nonDeload.findIndex(s => s.startWeek === seg.startWeek);
    const step = nonDeload.length <= 1 ? 1 : pos / (nonDeload.length - 1);
    return 0.35 + step * 0.65; // 0.35 → 1.0
  };

  return (
    <View style={tlStyles.wrap}>
      {/* Bar */}
      <View style={tlStyles.barRow}>
        {segments.map((seg, i) => {
          const opacity = getSegmentOpacity(seg, i);
          const pct = (seg.weeks / total) * 100;
          const isExpanded = expandedPhase === `${seg.phase}-${i}`;
          return (
            <TouchableOpacity
              key={i}
              style={[
                tlStyles.barSegment,
                { width: `${pct}%` as any, backgroundColor: accentColor, opacity, borderRadius: 0 },
                i === 0 && { borderTopLeftRadius: 6, borderBottomLeftRadius: 6 },
                i === segments.length - 1 && { borderTopRightRadius: 6, borderBottomRightRadius: 6 },
                isExpanded && { opacity: 1 },
              ]}
              onPress={() => setExpandedPhase(isExpanded ? null : `${seg.phase}-${i}`)}
              activeOpacity={0.75}
            />
          );
        })}
      </View>

      {/* Labels */}
      <View style={tlStyles.labelRow}>
        {segments.map((seg, i) => {
          const opacity = getSegmentOpacity(seg, i);
          const isExpanded = expandedPhase === `${seg.phase}-${i}`;
          return (
            <TouchableOpacity
              key={i}
              style={tlStyles.labelItem}
              onPress={() => setExpandedPhase(isExpanded ? null : `${seg.phase}-${i}`)}
              activeOpacity={0.7}
            >
              <View style={[tlStyles.dot, { backgroundColor: accentColor, opacity }]} />
              <Text style={[tlStyles.labelText, { color: accentColor, opacity }]} numberOfLines={1}>
                {PHASE_DISPLAY_NAMES[seg.phase]}
              </Text>
              <Text style={tlStyles.labelWeeks}>{seg.weeks}w</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Expanded phase info */}
      {expandedPhase !== null && (() => {
        const [phase] = expandedPhase.split('-');
        const desc = PHASE_DESCRIPTIONS[phase];
        if (!desc) return null;
        return (
          <View style={[tlStyles.phaseInfo, { backgroundColor: `${accentColor}10`, borderColor: `${accentColor}28` }]}>
            <Text style={[tlStyles.phaseInfoName, { color: accentColor }]}>
              {PHASE_DISPLAY_NAMES[phase as PlanPhase] ?? phase}
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

export default function WorkoutPlanDrawer({ visible, onClose }: Props) {
  const { colors, accent } = useZealTheme();
  const ctx = useAppContext();
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

  const isEventGoal = goal === 'event_preparation';
  const totalSteps = isEventGoal ? 7 : 6;
  const goalAccent = goal ? (GOAL_COLORS[goal] ?? accent) : accent;
  const autoStyle = goal ? getStyleForGoal(goal) : 'Strength';

  // Clear split selection when days/week changes so user must re-pick
  useEffect(() => {
    setSelectedSplit('');
  }, [daysPerWeek]);

  useEffect(() => {
    if (visible) {
      setStep(1); setGoal(''); setEvent('');
      setDaysPerWeek(4); setSessionDuration(60);
      setExperience(''); setPlanLength(8);
      setSelectedSplit('');
    }
  }, [visible]);

  const endDate = useMemo(() => addWeeks(startDate, planLength), [startDate, planLength]);

  const phaseSegments = useMemo<PhaseSegment[]>(() => {
    if (!goal || !experience) return [];
    try { return getPhaseSegments(goal as PlanGoal, planLength); } catch { return []; }
  }, [goal, planLength, experience]);

  const canGoNext = useMemo(() => {
    switch (step) {
      case 1: return !!goal;
      // Non-event step 2 = days/split; event step 2 = event picker
      case 2: return isEventGoal ? !!event : !!selectedSplit;
      // Non-event step 3 = session duration (always valid); event step 3 = days/split
      case 3: return isEventGoal ? !!selectedSplit : true;
      case 4: return isEventGoal ? true : !!experience;
      case 5: return isEventGoal ? !!experience : true;
      case 6: return true;
      default: return false;
    }
  }, [step, goal, event, experience, isEventGoal, selectedSplit]);

  const handleNext = useCallback(() => {
    if (!canGoNext) return;
    if (step < totalSteps) setStep(s => s + 1);
  }, [canGoNext, step, totalSteps]);

  const handleBack = useCallback(() => {
    if (step > 1) setStep(s => s - 1);
  }, [step]);

  const handleGenerate = useCallback(() => {
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
      startDate,
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
      }
    }

    const plan: WorkoutPlan = {
      id: `plan_${Date.now()}`,
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
      startDate,
      endDate,
      createdAt: new Date().toISOString(),
      active: true,
      schedule,
      missedDays: [],
    };
    ctx.saveActivePlan(plan, schedule);
    onClose();
  }, [goal, event, daysPerWeek, sessionDuration, experience, planLength, startDate, endDate, autoStyle, isEventGoal, selectedSplit, ctx, onClose]);

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
          <Text style={[styles.headerLabel, { color: goalAccent }]}>WORKOUT PLAN</Text>
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

  return (
    <BaseDrawer visible={visible} onClose={onClose} header={headerContent}>
      <View style={styles.content}>

        {/* ─── Step 1: Goal ───────────────────────────────────────────── */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>What's your goal?</Text>
            <Text style={[styles.stepSub, { color: colors.textSecondary }]}>Choose what you're training toward</Text>
            <View style={styles.goalList}>
              {PLAN_GOALS.map(g => {
                const isSelected = goal === g.id;
                const gColor = GOAL_COLORS[g.id] ?? accent;
                return (
                  <TouchableOpacity
                    key={g.id}
                    style={[
                      styles.goalRow,
                      { backgroundColor: colors.cardSecondary, borderColor: isSelected ? gColor : colors.border },
                      isSelected && { backgroundColor: `${gColor}10` },
                    ]}
                    onPress={() => setGoal(g.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.goalIconWrap, { backgroundColor: isSelected ? `${gColor}20` : `${colors.border}60` }]}>
                      <PlatformIcon name={g.icon as any} size={18} color={isSelected ? gColor : colors.textSecondary} />
                    </View>
                    <View style={styles.goalRowText}>
                      <Text style={[styles.goalLabel, { color: isSelected ? gColor : colors.text }]}>{g.label}</Text>
                      <Text style={[styles.goalDesc, { color: colors.textSecondary }]} numberOfLines={1}>{g.description}</Text>
                    </View>
                    {isSelected && (
                      <View style={[styles.checkCircle, { backgroundColor: gColor }]}>
                        <PlatformIcon name="check" size={12} color="#fff" strokeWidth={3} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ─── Step 2 (event flow only): Event ────────────────────────── */}
        {isEventGoal && step === 2 && (
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
        {step === cs(2, 3) && (
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
        {step === cs(3, 4) && (
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
        {step === cs(4, 5) && (
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

        {/* ─── Plan Length ────────────────────────────────────────────── */}
        {step === cs(5, 6) && (
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

        {/* ─── Preview / Generate ─────────────────────────────────────── */}
        {isPreviewStep && (
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
        <View style={[styles.navRow, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 16) }]}>
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
        </View>

      </View>
    </BaseDrawer>
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
});
