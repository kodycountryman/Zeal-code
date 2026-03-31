import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BaseDrawer from '@/components/drawers/BaseDrawer';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  TrendingUp,
  Scale,
  Heart,
  Wind,
  Trophy,
  Zap,
  Flame,
  Activity,
  Target,
  Sparkles,
  Calendar,
  Clock,
  Star,
  BarChart3,
  Info,
} from 'lucide-react-native';

import { useZealTheme, useAppContext, type WorkoutPlan } from '@/context/AppContext';
import { WORKOUT_STYLE_COLORS } from '@/constants/colors';
import { getStyleConfig } from '@/services/workoutConfig';
import { generatePlanSchedule, type PlanGenerationInput } from '@/services/planEngine';
import { PLAN_GOALS, type PlanGoal, type PlanLength, type ExperienceLevel as PlanExpLevel } from '@/services/planConstants';

interface Props {
  visible: boolean;
  onClose: () => void;
}

interface GoalOption {
  id: string;
  label: string;
  desc: string;
  icon: string;
}

interface StyleOption {
  id: string;
  label: string;
  desc: string;
  icon: string;
  color: string;
}

const GOALS: GoalOption[] = [
  { id: 'build_strength', label: 'Build Strength', desc: 'Increase maximal force', icon: 'trending' },
  { id: 'build_muscle', label: 'Build Muscle', desc: 'Hypertrophy-focused', icon: 'dumbbell' },
  { id: 'lose_fat', label: 'Lose Fat', desc: 'Body recomposition', icon: 'scale' },
  { id: 'improve_endurance', label: 'Improve Endurance', desc: 'Cardiovascular capacity', icon: 'heart' },
  { id: 'general_fitness', label: 'General Fitness', desc: 'Well-rounded conditioning', icon: 'activity' },
  { id: 'event_preparation', label: 'Event Preparation', desc: 'Peak for competition', icon: 'trophy' },
  { id: 'improve_mobility', label: 'Improve Mobility', desc: 'Flexibility & joint health', icon: 'wind' },
];

const STYLES: StyleOption[] = [
  { id: 'Strength', label: 'Strength', desc: 'Compound lifts, progressive overload', icon: 'dumbbell', color: WORKOUT_STYLE_COLORS.Strength },
  { id: 'Bodybuilding', label: 'Bodybuilding', desc: 'Volume-focused hypertrophy', icon: 'trending', color: WORKOUT_STYLE_COLORS.Bodybuilding },
  { id: 'CrossFit', label: 'CrossFit', desc: 'Varied functional movements', icon: 'zap', color: WORKOUT_STYLE_COLORS.CrossFit },
  { id: 'Hyrox', label: 'HYROX', desc: 'Run + functional stations', icon: 'activity', color: WORKOUT_STYLE_COLORS.Hyrox },
  { id: 'Cardio', label: 'Cardio', desc: 'Heart rate and endurance', icon: 'heart', color: WORKOUT_STYLE_COLORS.Cardio },
  { id: 'HIIT', label: 'HIIT', desc: 'High-intensity intervals', icon: 'flame', color: WORKOUT_STYLE_COLORS.HIIT },
  { id: 'Mobility', label: 'Mobility', desc: 'Joint health and recovery', icon: 'wind', color: WORKOUT_STYLE_COLORS.Mobility },
  { id: 'Low-Impact', label: 'Low-Impact', desc: 'Joint-friendly, higher reps', icon: 'heart', color: WORKOUT_STYLE_COLORS['Low-Impact'] ?? '#86efac' },
];

const EVENTS = [
  'Hyrox Race', 'CrossFit Competition', 'Powerlifting Meet', 'Bodybuilding Show',
  'Marathon', 'Half Marathon', '5K', '10K', 'Olympic Weightlifting',
  'Obstacle Race', 'Triathlon', 'Military/Police Test', 'No specific event',
];

const DAYS_OPTIONS = [2, 3, 4, 5, 6, 7];
const DURATION_OPTIONS = [30, 45, 60, 75, 90];
const PLAN_LENGTHS = [4, 8, 12, 16];

function getIconComponent(icon: string, color: string, size: number = 20) {
  switch (icon) {
    case 'dumbbell': return <Dumbbell size={size} color={color} />;
    case 'trending': return <TrendingUp size={size} color={color} />;
    case 'scale': return <Scale size={size} color={color} />;
    case 'heart': return <Heart size={size} color={color} />;
    case 'wind': return <Wind size={size} color={color} />;
    case 'trophy': return <Trophy size={size} color={color} />;
    case 'zap': return <Zap size={size} color={color} />;
    case 'flame': return <Flame size={size} color={color} />;
    case 'activity': return <Activity size={size} color={color} />;
    case 'target': return <Target size={size} color={color} />;
    default: return <Dumbbell size={size} color={color} />;
  }
}

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

export default function WorkoutPlanDrawer({ visible, onClose }: Props) {
  const { colors, accent } = useZealTheme();
  const ctx = useAppContext();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState('');
  const [style, setStyle] = useState('');
  const [events, setEvents] = useState<string[]>([]);
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [sessionDuration, setSessionDuration] = useState(60);
  const [trainingSplit, setTrainingSplit] = useState('');
  const [experience, setExperience] = useState('');
  const [planLength, setPlanLength] = useState(8);
  const [startDate, setStartDate] = useState(getTodayStr());

  useEffect(() => {
    if (visible) {
      setStep(1);
      setGoal('');
      setStyle('');
      setEvents([]);
      setDaysPerWeek(4);
      setSessionDuration(60);
      setTrainingSplit('');
      setExperience('');
      setPlanLength(8);
      setStartDate(getTodayStr());
    }
  }, [visible]);

  const splitOptions = useMemo(() => {
    const cfg = getStyleConfig(style);
    return cfg.slot_options.length > 0 ? cfg.slot_options : ['Full Body'];
  }, [style]);

  const splitSlotLabel = useMemo(() => {
    return getStyleConfig(style).slot_label;
  }, [style]);

  const endDate = useMemo(() => addWeeks(startDate, planLength), [startDate, planLength]);

  const canGoNext = useMemo(() => {
    switch (step) {
      case 1: return goal.length > 0;
      case 2: return style.length > 0;
      case 3: return true;
      case 4: return true;
      case 5: return experience.length > 0;
      case 6: return true;
      case 7: return true;
      default: return false;
    }
  }, [step, goal, style, experience]);

  const handleNext = useCallback(() => {
    if (!canGoNext) return;
    if (step < 7) setStep(s => s + 1);
  }, [canGoNext, step]);

  const handleBack = useCallback(() => {
    if (step > 1) setStep(s => s - 1);
  }, [step]);

  const handleToggleEvent = useCallback((event: string) => {
    if (event === 'No specific event') {
      setEvents(['No specific event']);
      return;
    }
    setEvents(prev => {
      const filtered = prev.filter(e => e !== 'No specific event');
      if (filtered.includes(event)) return filtered.filter(e => e !== event);
      return [...filtered, event];
    });
  }, []);

  const handleGenerate = useCallback(() => {
    const goalLabel = GOALS.find(g => g.id === goal)?.label ?? goal;
    const planName = `${planLength}-Week ${style} ${goalLabel} Plan`;

    const genInput: PlanGenerationInput = {
      goal: goal as PlanGoal,
      style,
      event: events,
      daysPerWeek,
      sessionDuration,
      experienceLevel: (experience || 'intermediate') as PlanExpLevel,
      planLength: planLength as PlanLength,
      startDate,
    };

    console.log('[WorkoutPlanDrawer] Generating plan schedule...');
    const schedule = generatePlanSchedule(genInput);
    console.log('[WorkoutPlanDrawer] Schedule generated:', schedule.weeks.length, 'weeks,', schedule.total_training_days, 'training days');

    const plan: WorkoutPlan = {
      id: `plan_${Date.now()}`,
      name: planName,
      goal: goalLabel,
      goalId: goal as PlanGoal,
      style,
      event: events,
      daysPerWeek,
      sessionDuration,
      trainingSplit: trainingSplit || splitOptions[0] || 'Full Body',
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
    console.log('[WorkoutPlanDrawer] Generated plan:', plan.name);
    onClose();
  }, [goal, style, events, daysPerWeek, sessionDuration, trainingSplit, splitOptions, experience, planLength, startDate, endDate, ctx, onClose]);

  const goalLabel = GOALS.find(g => g.id === goal)?.label ?? '';
  const expLabel = experience === 'beginner' ? 'Beginner' : experience === 'intermediate' ? 'Intermediate' : experience === 'advanced' ? 'Advanced' : '';

  const progressWidth = `${(step / 7) * 100}%` as const;

  const headerContent = (
    <>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Sparkles size={16} color={accent} />
          <Text style={[styles.headerLabel, { color: accent }]}>WORKOUT PLAN</Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
          <X size={16} color="#888" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
      <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
        <View style={[styles.progressFill, { width: progressWidth, backgroundColor: accent }]} />
      </View>
    </>
  );

  const footerContent = (
    <View style={[styles.navRow, { borderTopColor: colors.border, backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, 16) }]}>
      {step > 1 ? (
        <TouchableOpacity style={styles.navBtn} onPress={handleBack} activeOpacity={0.7}>
          <ChevronLeft size={16} color={colors.textSecondary} />
          <Text style={[styles.navBtnText, { color: colors.textSecondary }]}>Back</Text>
        </TouchableOpacity>
      ) : <View style={styles.navBtn} />}

      {step < 7 ? (
        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: canGoNext ? accent : colors.border }]}
          onPress={handleNext}
          disabled={!canGoNext}
          activeOpacity={0.85}
        >
          <Text style={[styles.nextBtnText, { color: canGoNext ? '#fff' : colors.textMuted }]}>
            {step === 6 ? 'Review' : 'Next'}
          </Text>
          <ChevronRight size={16} color={canGoNext ? '#fff' : colors.textMuted} />
        </TouchableOpacity>
      ) : (
        <View style={styles.navBtn} />
      )}
    </View>
  );

  return (
    <BaseDrawer visible={visible} onClose={onClose} header={headerContent} footer={footerContent} hasTextInput>
      <View style={styles.content}>
        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>What's your main goal?</Text>
            <Text style={[styles.stepSub, { color: colors.textSecondary }]}>Choose what you're training toward</Text>
            <View style={styles.goalGrid}>
              {GOALS.map(g => {
                const isSelected = goal === g.id;
                return (
                  <TouchableOpacity
                    key={g.id}
                    style={[
                      styles.goalCard,
                      { backgroundColor: colors.cardSecondary, borderColor: isSelected ? accent : colors.border },
                      isSelected && { backgroundColor: `${accent}12` },
                    ]}
                    onPress={() => { setGoal(g.id); }}
                    activeOpacity={0.7}
                  >
                    {getIconComponent(g.icon, isSelected ? accent : colors.textSecondary, 22)}
                    <Text style={[styles.goalLabel, { color: isSelected ? accent : colors.text }]}>{g.label}</Text>
                    <Text style={[styles.goalDesc, { color: colors.textSecondary }]}>{g.desc}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Training style</Text>
            <Text style={[styles.stepSub, { color: colors.textSecondary }]}>How do you like to train?</Text>
            <View style={styles.goalGrid}>
              {STYLES.map(s => {
                const isSelected = style === s.id;
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[
                      styles.goalCard,
                      { backgroundColor: colors.cardSecondary, borderColor: isSelected ? s.color : colors.border },
                      isSelected && { backgroundColor: `${s.color}12` },
                    ]}
                    onPress={() => { setStyle(s.id); setTrainingSplit(''); }}
                    activeOpacity={0.7}
                  >
                    {getIconComponent(s.icon, isSelected ? s.color : colors.textSecondary, 22)}
                    <Text style={[styles.goalLabel, { color: isSelected ? s.color : colors.text }]}>{s.label}</Text>
                    <Text style={[styles.goalDesc, { color: colors.textSecondary }]}>{s.desc}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Specific event or goal?</Text>
            <Text style={[styles.stepSub, { color: colors.textSecondary }]}>Optional — helps tailor your plan</Text>
            <View style={styles.chipWrap}>
              {EVENTS.map(ev => {
                const isSelected = events.includes(ev);
                return (
                  <TouchableOpacity
                    key={ev}
                    style={[
                      styles.eventChip,
                      { borderColor: isSelected ? accent : colors.border },
                      isSelected && { backgroundColor: `${accent}18` },
                    ]}
                    onPress={() => handleToggleEvent(ev)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.eventChipText, { color: isSelected ? accent : colors.text }]}>{ev}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[styles.skipHint, { color: colors.textMuted }]}>Skip — no specific event</Text>
          </View>
        )}

        {step === 4 && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Schedule</Text>
            <Text style={[styles.stepSub, { color: colors.textSecondary }]}>Set your weekly cadence and session length</Text>

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>DAYS PER WEEK</Text>
            <View style={styles.pillRow}>
              {DAYS_OPTIONS.map(d => {
                const isSelected = daysPerWeek === d;
                return (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.dayPill,
                      { borderColor: isSelected ? accent : colors.border },
                      isSelected && { backgroundColor: accent },
                    ]}
                    onPress={() => { setDaysPerWeek(d); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dayPillText, { color: isSelected ? '#fff' : colors.text }]}>{d}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 18 }]}>SESSION DURATION (MINUTES)</Text>
            <View style={styles.pillRow}>
              {DURATION_OPTIONS.map(d => {
                const isSelected = sessionDuration === d;
                return (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.durationPill,
                      { borderColor: isSelected ? accent : colors.border },
                      isSelected && { backgroundColor: `${accent}18` },
                    ]}
                    onPress={() => { setSessionDuration(d); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.durationPillText, { color: isSelected ? accent : colors.text }]}>{d}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 18 }]}>{splitSlotLabel}</Text>
            <View style={styles.chipWrap}>
              {splitOptions.map(sp => {
                const isSelected = trainingSplit === sp || (!trainingSplit && sp === splitOptions[0]);
                return (
                  <TouchableOpacity
                    key={sp}
                    style={[
                      styles.splitChip,
                      { borderColor: isSelected ? accent : colors.border },
                      isSelected && { backgroundColor: `${accent}18` },
                    ]}
                    onPress={() => { setTrainingSplit(sp); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.splitChipText, { color: isSelected ? accent : colors.text }]}>{sp}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {step === 5 && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Your experience level</Text>
            <Text style={[styles.stepSub, { color: colors.textSecondary }]}>This shapes the intensity and complexity</Text>

            {[
              { id: 'beginner', label: 'Beginner', desc: 'Less than 1 year of consistent training' },
              { id: 'intermediate', label: 'Intermediate', desc: '1–3 years of consistent training' },
              { id: 'advanced', label: 'Advanced', desc: '3+ years, familiar with complex movements' },
            ].map(lvl => {
              const isSelected = experience === lvl.id;
              return (
                <TouchableOpacity
                  key={lvl.id}
                  style={[
                    styles.expCard,
                    { borderColor: isSelected ? accent : colors.border, backgroundColor: colors.cardSecondary },
                    isSelected && { backgroundColor: `${accent}10`, borderColor: accent },
                  ]}
                  onPress={() => { setExperience(lvl.id); }}
                  activeOpacity={0.7}
                >
                  <View style={styles.expCardContent}>
                    <Text style={[styles.expLabel, { color: isSelected ? accent : colors.text }]}>{lvl.label}</Text>
                    <Text style={[styles.expDesc, { color: colors.textSecondary }]}>{lvl.desc}</Text>
                  </View>
                  {isSelected && (
                    <View style={[styles.checkCircle, { backgroundColor: accent }]}>
                      <Text style={styles.checkMark}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {step === 6 && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Plan length & start date</Text>
            <Text style={[styles.stepSub, { color: colors.textSecondary }]}>How long do you want to commit?</Text>

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>PLAN LENGTH</Text>
            <View style={styles.pillRow}>
              {PLAN_LENGTHS.map(w => {
                const isSelected = planLength === w;
                return (
                  <TouchableOpacity
                    key={w}
                    style={[
                      styles.lengthPill,
                      { borderColor: isSelected ? accent : colors.border },
                      isSelected && { backgroundColor: `${accent}18` },
                    ]}
                    onPress={() => { setPlanLength(w); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.lengthPillText, { color: isSelected ? accent : colors.text }]}>{w}w</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={[styles.infoRow, { backgroundColor: `${accent}10`, borderColor: `${accent}30` }]}>
              <Info size={14} color={accent} />
              <Text style={[styles.infoText, { color: accent }]}>
                {planLength <= 4 ? '1 mesocycle — foundation to deload' : planLength <= 8 ? '2 mesocycles with progressive overload' : planLength <= 12 ? '3 mesocycles — full periodization' : '4 mesocycles — comprehensive program'}
              </Text>
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 18 }]}>START DATE</Text>
            <View style={[styles.dateInput, { borderColor: colors.border, backgroundColor: colors.cardSecondary }]}>
              <Calendar size={16} color={colors.textSecondary} />
              <TextInput
                style={[styles.dateInputText, { color: colors.text }]}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
        )}

        {step === 7 && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Ready to generate</Text>
            <Text style={[styles.stepSub, { color: colors.textSecondary }]}>Your plan will be placed on the calendar</Text>

            <View style={[styles.summaryCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
              {[
                { icon: <Target size={14} color={accent} />, label: 'Goal', value: goalLabel },
                { icon: <Zap size={14} color={accent} />, label: 'Style', value: style + (events.length > 0 && events[0] !== 'No specific event' ? ` · ${events.join(', ')}` : '') },
                { icon: <Calendar size={14} color={accent} />, label: 'Days/week', value: `${daysPerWeek} days` },
                { icon: <Clock size={14} color={accent} />, label: 'Duration', value: `${sessionDuration} min/session` },
                { icon: <Star size={14} color={accent} />, label: 'Level', value: expLabel },
                { icon: <BarChart3 size={14} color={accent} />, label: 'Length', value: `${planLength} weeks` },
                { icon: <Calendar size={14} color={accent} />, label: 'Dates', value: formatDateRange(startDate, endDate) },
              ].map((row, i) => (
                <View key={i} style={[styles.summaryRow, i > 0 && { borderTopWidth: 0.5, borderTopColor: colors.border }]}>
                  <View style={styles.summaryRowLeft}>
                    {row.icon}
                    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{row.label}</Text>
                  </View>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>{row.value}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.generateBtn, { backgroundColor: accent }]}
              onPress={handleGenerate}
              activeOpacity={0.85}
            >
              <Sparkles size={16} color="#fff" />
              <Text style={styles.generateBtnText}>Generate Plan</Text>
            </TouchableOpacity>

            <Text style={[styles.generateNote, { color: colors.textMuted }]}>
              Usually takes 10–30 seconds
            </Text>
          </View>
        )}

      </View>
    </BaseDrawer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerLabel: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(128,128,128,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  progressBar: { height: 3, marginHorizontal: 16, borderRadius: 2, marginBottom: 12 },
  progressFill: { height: 3, borderRadius: 2 },
  content: { paddingHorizontal: 16, paddingBottom: 8 },
  stepContent: { gap: 14 },
  stepTitle: { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.5 },
  stepSub: { fontSize: 13, marginBottom: 4 },
  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  goalCard: {
    width: '47%' as any, borderRadius: 14, borderWidth: 1.5, padding: 16, gap: 6,
  },
  goalLabel: { fontSize: 14, fontWeight: '700' as const },
  goalDesc: { fontSize: 11 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  eventChip: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  eventChipText: { fontSize: 13, fontWeight: '500' as const },
  skipHint: { fontSize: 12, fontStyle: 'italic' as const },
  fieldLabel: { fontSize: 10, fontWeight: '700' as const, letterSpacing: 0.8 },
  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  dayPill: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  dayPillText: { fontSize: 16, fontWeight: '700' as const },
  durationPill: {
    borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10,
  },
  durationPillText: { fontSize: 14, fontWeight: '600' as const },
  splitChip: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  splitChipText: { fontSize: 13, fontWeight: '500' as const },
  expCard: {
    borderWidth: 1.5, borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  expCardContent: { flex: 1, gap: 4 },
  expLabel: { fontSize: 16, fontWeight: '700' as const },
  expDesc: { fontSize: 12 },
  checkCircle: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: '700' as const },
  lengthPill: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 22, paddingVertical: 12 },
  lengthPillText: { fontSize: 15, fontWeight: '600' as const },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, marginTop: 8,
  },
  infoText: { fontSize: 12, fontWeight: '500' as const },
  dateInput: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  },
  dateInputText: { flex: 1, fontSize: 15, fontWeight: '500' as const, padding: 0 },
  summaryCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  summaryRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  summaryRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryLabel: { fontSize: 12, fontWeight: '500' as const },
  summaryValue: { fontSize: 14, fontWeight: '600' as const, textAlign: 'right' as const, flexShrink: 1, maxWidth: '55%' as any },
  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, paddingVertical: 16, marginTop: 4,
  },
  generateBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' as const },
  generateNote: { fontSize: 11, textAlign: 'center' as const, marginTop: 4 },
  navRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 0.5,
  },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 60 },
  navBtnText: { fontSize: 14, fontWeight: '600' as const },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12,
  },
  nextBtnText: { fontSize: 14, fontWeight: '700' as const },
});
