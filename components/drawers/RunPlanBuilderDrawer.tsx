import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import BaseDrawer from '@/components/drawers/BaseDrawer';
import DrawerHeader from '@/components/drawers/DrawerHeader';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme, useAppContext, type WorkoutPlan } from '@/context/AppContext';
import { useWorkoutTracking } from '@/context/WorkoutTrackingContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { showProGate } from '@/services/proGate';
import {
  RUN_PLAN_GOAL_OPTIONS,
  RUN_PLAN_CONFIGS,
  type RunPlanConfig,
  type PlanGoal,
  type ExperienceLevel,
} from '@/services/planConstants';
import { generateRunPlanSchedule, type GenerateRunPlanInput } from '@/services/planEngine';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Step = 1 | 2 | 3 | 4 | 5;

const EXPERIENCE_OPTIONS: { value: ExperienceLevel; label: string; description: string }[] = [
  { value: 'beginner',     label: 'Beginner',     description: 'New to running or returning after a break' },
  { value: 'intermediate', label: 'Intermediate', description: 'Regular runner — 15-25 miles per week' },
  { value: 'advanced',     label: 'Advanced',     description: 'Experienced — 30+ miles per week' },
];

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function parseTargetTime(input: string, distanceMiles: number | null): number | null {
  // Accept "H:MM:SS" or "MM:SS" — returns pace in seconds per mile
  if (!input.trim() || !distanceMiles || distanceMiles <= 0) return null;
  const parts = input.split(':').map(p => parseInt(p, 10));
  if (parts.some(p => isNaN(p))) return null;
  let totalSec = 0;
  if (parts.length === 3) totalSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
  else if (parts.length === 2) totalSec = parts[0] * 60 + parts[1];
  else return null;
  if (totalSec <= 0) return null;
  return Math.round(totalSec / distanceMiles);
}

function formatPaceDisplay(secPerMile: number | null): string {
  if (!secPerMile) return '';
  const min = Math.floor(secPerMile / 60);
  const sec = secPerMile % 60;
  return `${min}:${String(sec).padStart(2, '0')}/mi`;
}

export default function RunPlanBuilderDrawer({ visible, onClose }: Props) {
  const { colors, accent } = useZealTheme();
  const ctx = useAppContext();
  const tracking = useWorkoutTracking();
  const { hasPro, openPaywall } = useSubscription();

  const [step, setStep] = useState<Step>(1);
  const [selectedGoal, setSelectedGoal] = useState<PlanGoal | null>(null);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | null>(null);
  const [daysPerWeek, setDaysPerWeek] = useState<number | null>(null);
  const [targetTimeInput, setTargetTimeInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const cfg: RunPlanConfig | null = useMemo(() => {
    if (!selectedGoal) return null;
    return RUN_PLAN_CONFIGS[selectedGoal as keyof typeof RUN_PLAN_CONFIGS] ?? null;
  }, [selectedGoal]);

  const targetPaceSecPerMile = useMemo(() => {
    if (!cfg) return null;
    return parseTargetTime(targetTimeInput, cfg.raceDistanceMiles);
  }, [cfg, targetTimeInput]);

  // ─── Reset on close ────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setStep(1);
    setSelectedGoal(null);
    setExperienceLevel(null);
    setDaysPerWeek(null);
    setTargetTimeInput('');
    setIsSaving(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  // ─── Navigation ────────────────────────────────────────────────────────
  const canAdvance = useMemo(() => {
    if (step === 1) return !!selectedGoal;
    if (step === 2) return !!experienceLevel;
    if (step === 3) return !!daysPerWeek;
    if (step === 4) return true; // target time is optional
    return true;
  }, [step, selectedGoal, experienceLevel, daysPerWeek]);

  const handleBack = useCallback(() => {
    if (step === 1) return handleClose();
    setStep((prev) => Math.max(1, prev - 1) as Step);
  }, [step, handleClose]);

  const handleNext = useCallback(() => {
    if (!canAdvance) return;
    if (step === 1 && cfg) {
      // Pre-fill sensible defaults when we move off step 1
      if (!daysPerWeek) setDaysPerWeek(cfg.defaultDaysPerWeek);
    }
    setStep((prev) => Math.min(5, prev + 1) as Step);
  }, [canAdvance, step, cfg, daysPerWeek]);

  // ─── Generate Plan ─────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!selectedGoal || !cfg || !experienceLevel || !daysPerWeek) return;
    setIsSaving(true);
    try {
      const startDate = todayStr();
      const planLength = cfg.defaultWeeks;
      const endDate = addDays(startDate, planLength * 7 - 1);

      const genInput: GenerateRunPlanInput = {
        goal: selectedGoal,
        style: 'Running',
        event: cfg.event ? [cfg.event] : [],
        daysPerWeek,
        sessionDuration: 60, // run duration computed per-day by the engine
        experienceLevel,
        planLength: (planLength <= 16 ? planLength : 16) as 4 | 8 | 12 | 16,
        startDate,
        trainingSplit: 'Running',
        targetPaceSecPerMile: targetPaceSecPerMile ?? undefined,
      };

      const schedule = generateRunPlanSchedule(genInput);

      const planId = `run_plan_${Date.now()}`;
      const plan: WorkoutPlan = {
        id: planId,
        name: cfg.label,
        goal: cfg.label,
        goalId: selectedGoal,
        style: 'Running',
        event: cfg.event ? [cfg.event] : [],
        daysPerWeek,
        sessionDuration: 60,
        trainingSplit: 'Running',
        experienceLevel,
        planLength,
        startDate,
        endDate,
        createdAt: new Date().toISOString(),
        active: true,
        schedule,
        missedDays: [],
        completedDays: [],
        equipment: {},
        mode: 'run',
        targetPaceSecPerMile: targetPaceSecPerMile ?? undefined,
      };

      ctx.saveActivePlan(plan, schedule);
      handleClose();
    } catch (e) {
      __DEV__ && console.error('[RunPlanBuilderDrawer] Failed to generate plan:', e);
      Alert.alert('Error', 'Failed to create your run plan. Please try again.');
      setIsSaving(false);
    }
  }, [selectedGoal, cfg, experienceLevel, daysPerWeek, targetPaceSecPerMile, ctx, handleClose]);

  // ─── Render ────────────────────────────────────────────────────────────
  const headerContent = (
    <DrawerHeader
      title="New Run Plan"
      onBack={step > 1 ? handleBack : undefined}
      onClose={step === 1 ? handleClose : undefined}
    />
  );

  const progressPct = (step / 5) * 100;

  return (
    <BaseDrawer visible={visible} onClose={handleClose} header={headerContent}>
      {/* Progress bar */}
      <View style={styles.progressWrap}>
        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View style={[styles.progressFill, { width: `${progressPct}%`, backgroundColor: accent }]} />
        </View>
        <Text style={[styles.progressLabel, { color: colors.textMuted }]}>Step {step} of 5</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Step 1: Goal ────────────────────────────────────────────── */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>What are you training for?</Text>
            <Text style={[styles.stepSub, { color: colors.textSecondary }]}>
              Pick a goal — we'll build a periodized plan around it.
            </Text>
            <View style={{ gap: 10 }}>
              {RUN_PLAN_GOAL_OPTIONS.map((opt) => {
                const selected = selectedGoal === opt.id;
                const isLocked = !hasPro && opt.id !== 'run_5k';
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[
                      styles.optionRow,
                      {
                        backgroundColor: colors.cardSecondary,
                        borderColor: selected ? accent : colors.border,
                        opacity: isLocked ? 0.6 : 1,
                      },
                      selected && { backgroundColor: `${accent}12` },
                    ]}
                    onPress={() => {
                      if (isLocked) {
                        showProGate('runPlans', openPaywall);
                        return;
                      }
                      setSelectedGoal(opt.id);
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.optionIconWrap, { backgroundColor: selected ? `${accent}25` : `${colors.border}80` }]}>
                      <PlatformIcon name={opt.icon as any} size={18} color={selected ? accent : colors.textSecondary} />
                    </View>
                    <View style={styles.optionBody}>
                      <View style={styles.optionLabelRow}>
                        <Text style={[styles.optionLabel, { color: selected ? accent : colors.text }]}>{opt.label}</Text>
                        {isLocked && <PlatformIcon name="crown" size={12} color="#d4a93e" />}
                      </View>
                      <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
                        {opt.description}
                      </Text>
                      <Text style={[styles.optionMeta, { color: colors.textMuted }]}>
                        {opt.defaultWeeks} weeks · {opt.defaultDaysPerWeek} days/wk
                        {opt.raceDistanceMiles ? ` · ${opt.raceDistanceMiles} mi race` : ''}
                      </Text>
                    </View>
                    {selected && <PlatformIcon name="check-circle" size={20} color={accent} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Step 2: Experience ───────────────────────────────────────── */}
        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>What's your experience level?</Text>
            <Text style={[styles.stepSub, { color: colors.textSecondary }]}>
              We'll scale your weekly mileage to match.
            </Text>
            <View style={{ gap: 10 }}>
              {EXPERIENCE_OPTIONS.map((opt) => {
                const selected = experienceLevel === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.optionRow,
                      {
                        backgroundColor: colors.cardSecondary,
                        borderColor: selected ? accent : colors.border,
                      },
                      selected && { backgroundColor: `${accent}12` },
                    ]}
                    onPress={() => setExperienceLevel(opt.value)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.optionBody}>
                      <Text style={[styles.optionLabel, { color: selected ? accent : colors.text }]}>{opt.label}</Text>
                      <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
                        {opt.description}
                      </Text>
                      {cfg && (
                        <Text style={[styles.optionMeta, { color: colors.textMuted }]}>
                          Start: ~{cfg.startingWeeklyMilesByLevel[opt.value]}mi/wk · Peak: ~{cfg.peakWeeklyMilesByLevel[opt.value]}mi/wk
                        </Text>
                      )}
                    </View>
                    {selected && <PlatformIcon name="check-circle" size={20} color={accent} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Step 3: Days Per Week ────────────────────────────────────── */}
        {step === 3 && cfg && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>How many days per week can you run?</Text>
            <Text style={[styles.stepSub, { color: colors.textSecondary }]}>
              Recommended: {cfg.defaultDaysPerWeek} days/week for {cfg.shortLabel}
            </Text>
            <View style={styles.pillRow}>
              {[3, 4, 5, 6].map((days) => {
                const selected = daysPerWeek === days;
                return (
                  <TouchableOpacity
                    key={days}
                    style={[
                      styles.dayPill,
                      { backgroundColor: selected ? accent : colors.cardSecondary, borderColor: selected ? accent : colors.border },
                    ]}
                    onPress={() => setDaysPerWeek(days)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.dayPillNumber, { color: selected ? '#fff' : colors.text }]}>{days}</Text>
                    <Text style={[styles.dayPillLabel, { color: selected ? '#fff' : colors.textMuted }]}>days</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Step 4: Target Time (optional) ───────────────────────────── */}
        {step === 4 && cfg && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>
              {cfg.raceDistanceMiles
                ? `Target ${cfg.shortLabel} time? (Optional)`
                : 'Target pace? (Optional)'}
            </Text>
            <Text style={[styles.stepSub, { color: colors.textSecondary }]}>
              {cfg.raceDistanceMiles
                ? `We'll calibrate your training paces around this goal. Skip if you don't have one.`
                : 'Leave blank to use defaults based on your experience level.'}
            </Text>
            {cfg.raceDistanceMiles ? (
              <>
                <TextInput
                  value={targetTimeInput}
                  onChangeText={setTargetTimeInput}
                  placeholder={cfg.raceDistanceMiles >= 13 ? 'e.g. 1:45:00' : 'e.g. 25:00'}
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numbers-and-punctuation"
                  style={[
                    styles.textInput,
                    {
                      color: colors.text,
                      borderColor: targetPaceSecPerMile ? accent : colors.border,
                      backgroundColor: colors.cardSecondary,
                    },
                  ]}
                />
                <Text style={[styles.helperText, { color: colors.textMuted }]}>
                  Format: {cfg.raceDistanceMiles >= 13 ? 'hours:minutes:seconds' : 'minutes:seconds'}
                </Text>
                {targetPaceSecPerMile && (
                  <View style={[styles.paceBadge, { backgroundColor: `${accent}15`, borderColor: `${accent}40` }]}>
                    <PlatformIcon name="target" size={14} color={accent} />
                    <Text style={[styles.paceBadgeText, { color: accent }]}>
                      Target pace: {formatPaceDisplay(targetPaceSecPerMile)}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <View style={[styles.infoBox, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
                <PlatformIcon name="info" size={16} color={colors.textSecondary} />
                <Text style={[styles.infoBoxText, { color: colors.textSecondary }]}>
                  General running plans rotate easy / tempo / speed / recovery weeks.
                  Pace targets will use defaults calibrated to your experience level.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Step 5: Review ──────────────────────────────────────────── */}
        {step === 5 && cfg && experienceLevel && daysPerWeek && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Ready to go?</Text>
            <Text style={[styles.stepSub, { color: colors.textSecondary }]}>
              Here's your plan at a glance.
            </Text>

            <View style={[styles.reviewCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
              <View style={styles.reviewHeader}>
                <View style={[styles.reviewIconWrap, { backgroundColor: `${accent}20` }]}>
                  <PlatformIcon name={cfg.icon as any} size={22} color={accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.reviewTitle, { color: colors.text }]}>{cfg.label}</Text>
                  <Text style={[styles.reviewSub, { color: colors.textSecondary }]}>{cfg.description}</Text>
                </View>
              </View>

              <View style={[styles.reviewDivider, { backgroundColor: colors.border }]} />

              <View style={styles.reviewStatsRow}>
                <View style={styles.reviewStat}>
                  <Text style={[styles.reviewStatValue, { color: accent }]}>{cfg.defaultWeeks}</Text>
                  <Text style={[styles.reviewStatLabel, { color: colors.textMuted }]}>weeks</Text>
                </View>
                <View style={[styles.reviewStatDivider, { backgroundColor: colors.border }]} />
                <View style={styles.reviewStat}>
                  <Text style={[styles.reviewStatValue, { color: accent }]}>{daysPerWeek}</Text>
                  <Text style={[styles.reviewStatLabel, { color: colors.textMuted }]}>days/wk</Text>
                </View>
                <View style={[styles.reviewStatDivider, { backgroundColor: colors.border }]} />
                <View style={styles.reviewStat}>
                  <Text style={[styles.reviewStatValue, { color: accent }]}>{cfg.longRunPeakMiles}</Text>
                  <Text style={[styles.reviewStatLabel, { color: colors.textMuted }]}>peak long mi</Text>
                </View>
              </View>

              <View style={[styles.reviewDivider, { backgroundColor: colors.border }]} />

              <View style={{ gap: 6 }}>
                <View style={styles.reviewMetaRow}>
                  <Text style={[styles.reviewMetaLabel, { color: colors.textMuted }]}>Experience</Text>
                  <Text style={[styles.reviewMetaValue, { color: colors.text }]}>
                    {EXPERIENCE_OPTIONS.find(e => e.value === experienceLevel)?.label}
                  </Text>
                </View>
                <View style={styles.reviewMetaRow}>
                  <Text style={[styles.reviewMetaLabel, { color: colors.textMuted }]}>Weekly mileage</Text>
                  <Text style={[styles.reviewMetaValue, { color: colors.text }]}>
                    {cfg.startingWeeklyMilesByLevel[experienceLevel]} → {cfg.peakWeeklyMilesByLevel[experienceLevel]} mi
                  </Text>
                </View>
                {targetPaceSecPerMile && (
                  <View style={styles.reviewMetaRow}>
                    <Text style={[styles.reviewMetaLabel, { color: colors.textMuted }]}>Target pace</Text>
                    <Text style={[styles.reviewMetaValue, { color: accent }]}>
                      {formatPaceDisplay(targetPaceSecPerMile)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ── Footer CTA ──────────────────────────────────────────────────── */}
      <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            {
              backgroundColor: canAdvance ? accent : colors.border,
              opacity: canAdvance ? 1 : 0.5,
            },
          ]}
          onPress={step === 5 ? handleGenerate : handleNext}
          disabled={!canAdvance || isSaving}
          activeOpacity={0.85}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {step === 5 ? 'Start Plan' : 'Continue'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </BaseDrawer>
  );
}

const styles = StyleSheet.create({
  progressWrap: {
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 10,
    gap: 6,
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 24,
  },
  stepContent: {
    gap: 12,
  },
  stepTitle: {
    fontSize: 22,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.5,
  },
  stepSub: {
    fontSize: 14,
    fontFamily: 'Outfit_400Regular',
    lineHeight: 20,
    marginBottom: 4,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  optionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionBody: {
    flex: 1,
    gap: 2,
  },
  optionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  optionLabel: {
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
  },
  optionDescription: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
    lineHeight: 17,
  },
  optionMeta: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
    marginTop: 3,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  dayPill: {
    flexBasis: '22%',
    flexGrow: 1,
    minWidth: 70,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 2,
  },
  dayPillNumber: {
    fontSize: 24,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.5,
  },
  dayPillLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.5,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 18,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.5,
  },
  helperText: {
    fontSize: 11,
    fontFamily: 'Outfit_400Regular',
  },
  paceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  paceBadgeText: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Outfit_400Regular',
    lineHeight: 19,
  },
  reviewCard: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reviewIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewTitle: {
    fontSize: 18,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.3,
  },
  reviewSub: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
    lineHeight: 17,
    marginTop: 2,
  },
  reviewDivider: {
    height: StyleSheet.hairlineWidth,
  },
  reviewStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewStat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  reviewStatValue: {
    fontSize: 22,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.5,
  },
  reviewStatLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.8,
  },
  reviewStatDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
  },
  reviewMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewMetaLabel: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
  },
  reviewMetaValue: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    color: '#fff',
  },
});
