import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import BaseDrawer from '@/components/drawers/BaseDrawer';
import DrawerHeader from '@/components/drawers/DrawerHeader';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme, useAppContext, type WorkoutPlan } from '@/context/AppContext';
import {
  HYBRID_PLAN_PRESETS,
  RUN_PLAN_CONFIGS,
  type HybridPlanConfig,
  type PlanGoal,
  type ExperienceLevel,
  buildHybridWeeklyTemplate,
} from '@/services/planConstants';
import { generateHybridPlanSchedule, type GenerateHybridPlanInput } from '@/services/planEngine';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Step = 1 | 2 | 3 | 4 | 5;

const EXPERIENCE_OPTIONS: { value: ExperienceLevel; label: string; description: string }[] = [
  { value: 'beginner',     label: 'Beginner',     description: 'New to hybrid training or returning' },
  { value: 'intermediate', label: 'Intermediate', description: 'Consistent with both lifting + running' },
  { value: 'advanced',     label: 'Advanced',     description: 'Experienced hybrid athlete' },
];

const DAY_LABELS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

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

function slotLabel(slot: { activity_type: string; run_type?: string; strength_session?: string }): string {
  if (slot.activity_type === 'rest') return 'Rest';
  if (slot.activity_type === 'strength') return slot.strength_session ?? 'Strength';
  if (slot.activity_type === 'run') {
    if (slot.run_type === 'long_run') return 'Long Run';
    if (slot.run_type === 'tempo') return 'Tempo';
    if (slot.run_type === 'interval') return 'Intervals';
    if (slot.run_type === 'recovery') return 'Recovery Run';
    return 'Easy Run';
  }
  return '—';
}

export default function HybridPlanBuilderDrawer({ visible, onClose }: Props) {
  const { colors, accent } = useZealTheme();
  const ctx = useAppContext();

  const [step, setStep] = useState<Step>(1);
  const [selectedPreset, setSelectedPreset] = useState<HybridPlanConfig | null>(null);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | null>(null);
  const [strengthDays, setStrengthDays] = useState<number | null>(null);
  const [runDays, setRunDays] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const totalDays = (strengthDays ?? 0) + (runDays ?? 0);

  const previewTemplate = useMemo(() => {
    if (!selectedPreset || !strengthDays || !runDays) return null;
    return buildHybridWeeklyTemplate(
      strengthDays,
      runDays,
      selectedPreset.strengthSplit,
      selectedPreset.runGoal,
    );
  }, [selectedPreset, strengthDays, runDays]);

  const runCfg = selectedPreset ? RUN_PLAN_CONFIGS[selectedPreset.runGoal] : null;

  const reset = useCallback(() => {
    setStep(1);
    setSelectedPreset(null);
    setExperienceLevel(null);
    setStrengthDays(null);
    setRunDays(null);
    setIsSaving(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const canAdvance = useMemo(() => {
    if (step === 1) return !!selectedPreset;
    if (step === 2) return !!experienceLevel;
    if (step === 3) return !!strengthDays && !!runDays && totalDays >= 3 && totalDays <= 7;
    if (step === 4) return !!previewTemplate;
    return true;
  }, [step, selectedPreset, experienceLevel, strengthDays, runDays, totalDays, previewTemplate]);

  const handleBack = useCallback(() => {
    if (step === 1) return handleClose();
    setStep(prev => Math.max(1, prev - 1) as Step);
  }, [step, handleClose]);

  const handleNext = useCallback(() => {
    if (!canAdvance) return;
    // When moving off step 1, pre-fill defaults from preset
    if (step === 1 && selectedPreset) {
      if (!strengthDays) setStrengthDays(selectedPreset.defaultStrengthDays);
      if (!runDays) setRunDays(selectedPreset.defaultRunDays);
    }
    setStep(prev => Math.min(5, prev + 1) as Step);
  }, [canAdvance, step, selectedPreset, strengthDays, runDays]);

  const handleGenerate = useCallback(async () => {
    if (!selectedPreset || !experienceLevel || !strengthDays || !runDays || !runCfg) return;
    setIsSaving(true);
    try {
      const startDate = todayStr();
      const planLength = selectedPreset.defaultWeeks;
      const endDate = addDays(startDate, planLength * 7 - 1);

      const genInput: GenerateHybridPlanInput = {
        goal: 'hybrid_lift_run',
        style: selectedPreset.strengthStyle,
        event: runCfg.event ? [runCfg.event] : [],
        daysPerWeek: strengthDays + runDays,
        sessionDuration: 60,
        experienceLevel,
        planLength: (planLength <= 16 ? planLength : 16) as 4 | 8 | 12 | 16,
        startDate,
        trainingSplit: selectedPreset.strengthSplit,
        runGoal: selectedPreset.runGoal,
        strengthStyle: selectedPreset.strengthStyle,
        strengthSplit: selectedPreset.strengthSplit,
        strengthDays,
        runDays,
      };

      const schedule = generateHybridPlanSchedule(genInput);

      const planId = `hybrid_plan_${Date.now()}`;
      const plan: WorkoutPlan = {
        id: planId,
        name: selectedPreset.label,
        goal: selectedPreset.label,
        goalId: 'hybrid_lift_run',
        style: selectedPreset.strengthStyle,
        event: runCfg.event ? [runCfg.event] : [],
        daysPerWeek: strengthDays + runDays,
        sessionDuration: 60,
        trainingSplit: selectedPreset.strengthSplit,
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
        mode: 'hybrid',
        runGoalId: selectedPreset.runGoal,
        strengthStyle: selectedPreset.strengthStyle,
        strengthSplit: selectedPreset.strengthSplit,
        strengthDays,
        runDays,
      };

      ctx.saveActivePlan(plan, schedule);
      handleClose();
    } catch (e) {
      __DEV__ && console.error('[HybridPlanBuilderDrawer] Failed to generate plan:', e);
      Alert.alert('Error', 'Failed to create your hybrid plan. Please try again.');
      setIsSaving(false);
    }
  }, [selectedPreset, experienceLevel, strengthDays, runDays, runCfg, ctx, handleClose]);

  const headerContent = (
    <DrawerHeader
      title="New Hybrid Plan"
      onBack={step > 1 ? handleBack : undefined}
      onClose={step === 1 ? handleClose : undefined}
    />
  );

  const progressPct = (step / 5) * 100;

  return (
    <BaseDrawer visible={visible} onClose={handleClose} header={headerContent}>
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
        {/* ── Step 1: Preset ──────────────────────────────────────────── */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Pick a hybrid template</Text>
            <Text style={[styles.stepSub, { color: colors.textSecondary }]}>
              Each combines a strength style with a run goal — we'll handle the scheduling.
            </Text>
            <View style={{ gap: 10 }}>
              {HYBRID_PLAN_PRESETS.map((preset) => {
                const selected = selectedPreset?.id === preset.id;
                return (
                  <TouchableOpacity
                    key={preset.id}
                    style={[
                      styles.optionRow,
                      { backgroundColor: colors.cardSecondary, borderColor: selected ? accent : colors.border },
                      selected && { backgroundColor: `${accent}12` },
                    ]}
                    onPress={() => setSelectedPreset(preset)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.optionIconWrap, { backgroundColor: selected ? `${accent}25` : `${colors.border}80` }]}>
                      <PlatformIcon name={preset.icon as any} size={18} color={selected ? accent : colors.textSecondary} />
                    </View>
                    <View style={styles.optionBody}>
                      <Text style={[styles.optionLabel, { color: selected ? accent : colors.text }]}>{preset.label}</Text>
                      <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
                        {preset.description}
                      </Text>
                      <Text style={[styles.optionMeta, { color: colors.textMuted }]}>
                        {preset.defaultStrengthDays}× strength · {preset.defaultRunDays}× run · {preset.defaultWeeks} weeks
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
            <Text style={[styles.stepTitle, { color: colors.text }]}>How experienced are you?</Text>
            <Text style={[styles.stepSub, { color: colors.textSecondary }]}>
              We'll scale both strength volume and running mileage.
            </Text>
            <View style={{ gap: 10 }}>
              {EXPERIENCE_OPTIONS.map((opt) => {
                const selected = experienceLevel === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.optionRow,
                      { backgroundColor: colors.cardSecondary, borderColor: selected ? accent : colors.border },
                      selected && { backgroundColor: `${accent}12` },
                    ]}
                    onPress={() => setExperienceLevel(opt.value)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.optionBody}>
                      <Text style={[styles.optionLabel, { color: selected ? accent : colors.text }]}>{opt.label}</Text>
                      <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>{opt.description}</Text>
                    </View>
                    {selected && <PlatformIcon name="check-circle" size={20} color={accent} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Step 3: Day Allocation ───────────────────────────────────── */}
        {step === 3 && selectedPreset && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Split your week</Text>
            <Text style={[styles.stepSub, { color: colors.textSecondary }]}>
              How many days for lifting vs running? Total {totalDays}/7 days
              {totalDays > 7 ? ' — too many' : ''}
            </Text>

            <View style={[styles.allocationCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
              <View style={styles.allocationRow}>
                <View style={styles.allocationLabel}>
                  <PlatformIcon name="dumbbell" size={18} color={accent} />
                  <Text style={[styles.allocationLabelText, { color: colors.text }]}>Strength</Text>
                </View>
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    style={[styles.stepperButton, { borderColor: colors.border }]}
                    onPress={() => setStrengthDays(Math.max(1, (strengthDays ?? selectedPreset.defaultStrengthDays) - 1))}
                    activeOpacity={0.7}
                  >
                    <PlatformIcon name="minus" size={14} color={colors.text} />
                  </TouchableOpacity>
                  <Text style={[styles.stepperValue, { color: colors.text }]}>
                    {strengthDays ?? selectedPreset.defaultStrengthDays}
                  </Text>
                  <TouchableOpacity
                    style={[styles.stepperButton, { borderColor: colors.border }]}
                    onPress={() => setStrengthDays(Math.min(5, (strengthDays ?? selectedPreset.defaultStrengthDays) + 1))}
                    activeOpacity={0.7}
                  >
                    <PlatformIcon name="plus" size={14} color={colors.text} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.allocationDivider, { backgroundColor: colors.border }]} />

              <View style={styles.allocationRow}>
                <View style={styles.allocationLabel}>
                  <PlatformIcon name="figure-run" size={18} color={accent} />
                  <Text style={[styles.allocationLabelText, { color: colors.text }]}>Running</Text>
                </View>
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    style={[styles.stepperButton, { borderColor: colors.border }]}
                    onPress={() => setRunDays(Math.max(1, (runDays ?? selectedPreset.defaultRunDays) - 1))}
                    activeOpacity={0.7}
                  >
                    <PlatformIcon name="minus" size={14} color={colors.text} />
                  </TouchableOpacity>
                  <Text style={[styles.stepperValue, { color: colors.text }]}>
                    {runDays ?? selectedPreset.defaultRunDays}
                  </Text>
                  <TouchableOpacity
                    style={[styles.stepperButton, { borderColor: colors.border }]}
                    onPress={() => setRunDays(Math.min(5, (runDays ?? selectedPreset.defaultRunDays) + 1))}
                    activeOpacity={0.7}
                  >
                    <PlatformIcon name="plus" size={14} color={colors.text} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.allocationDivider, { backgroundColor: colors.border }]} />

              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.textMuted }]}>Total training days</Text>
                <Text style={[styles.totalValue, { color: totalDays > 7 ? '#ef4444' : accent }]}>
                  {totalDays}/7
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Step 4: Weekly Template Preview ─────────────────────────── */}
        {step === 4 && previewTemplate && selectedPreset && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Your typical week</Text>
            <Text style={[styles.stepSub, { color: colors.textSecondary }]}>
              This is how a regular week looks — weekly volume and intensity scale with each phase.
            </Text>

            <View style={{ gap: 6 }}>
              {previewTemplate.map((slot, i) => {
                const isStrength = slot.activity_type === 'strength';
                const isRun = slot.activity_type === 'run';
                const isRest = slot.activity_type === 'rest';
                const tint = isStrength ? accent : isRun ? '#3b82f6' : colors.textMuted;
                return (
                  <View
                    key={i}
                    style={[
                      styles.weekSlotRow,
                      {
                        backgroundColor: isRest ? 'transparent' : colors.cardSecondary,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.weekDayLabel, { color: colors.textMuted }]}>
                      {DAY_LABELS_SHORT[slot.day_of_week]}
                    </Text>
                    {!isRest && (
                      <View style={[styles.weekSlotIconWrap, { backgroundColor: `${tint}18` }]}>
                        <PlatformIcon
                          name={isStrength ? 'dumbbell' : 'figure-run'}
                          size={14}
                          color={tint}
                        />
                      </View>
                    )}
                    {isRest && (
                      <View style={[styles.weekSlotIconWrap, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' }]}>
                        <PlatformIcon name="moon" size={13} color={colors.textMuted} />
                      </View>
                    )}
                    <Text style={[styles.weekSlotLabel, { color: isRest ? colors.textMuted : colors.text }]}>
                      {slotLabel(slot)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Step 5: Review ──────────────────────────────────────────── */}
        {step === 5 && selectedPreset && experienceLevel && strengthDays && runDays && runCfg && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Ready to start?</Text>
            <Text style={[styles.stepSub, { color: colors.textSecondary }]}>
              Here's your hybrid plan summary.
            </Text>

            <View style={[styles.reviewCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
              <View style={styles.reviewHeader}>
                <View style={[styles.reviewIconWrap, { backgroundColor: `${accent}20` }]}>
                  <PlatformIcon name={selectedPreset.icon as any} size={22} color={accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.reviewTitle, { color: colors.text }]}>{selectedPreset.label}</Text>
                  <Text style={[styles.reviewSub, { color: colors.textSecondary }]}>{selectedPreset.description}</Text>
                </View>
              </View>

              <View style={[styles.reviewDivider, { backgroundColor: colors.border }]} />

              <View style={styles.reviewStatsRow}>
                <View style={styles.reviewStat}>
                  <Text style={[styles.reviewStatValue, { color: accent }]}>{selectedPreset.defaultWeeks}</Text>
                  <Text style={[styles.reviewStatLabel, { color: colors.textMuted }]}>weeks</Text>
                </View>
                <View style={[styles.reviewStatDivider, { backgroundColor: colors.border }]} />
                <View style={styles.reviewStat}>
                  <Text style={[styles.reviewStatValue, { color: accent }]}>{strengthDays}</Text>
                  <Text style={[styles.reviewStatLabel, { color: colors.textMuted }]}>lift/wk</Text>
                </View>
                <View style={[styles.reviewStatDivider, { backgroundColor: colors.border }]} />
                <View style={styles.reviewStat}>
                  <Text style={[styles.reviewStatValue, { color: accent }]}>{runDays}</Text>
                  <Text style={[styles.reviewStatLabel, { color: colors.textMuted }]}>run/wk</Text>
                </View>
              </View>

              <View style={[styles.reviewDivider, { backgroundColor: colors.border }]} />

              <View style={{ gap: 6 }}>
                <View style={styles.reviewMetaRow}>
                  <Text style={[styles.reviewMetaLabel, { color: colors.textMuted }]}>Strength</Text>
                  <Text style={[styles.reviewMetaValue, { color: colors.text }]}>
                    {selectedPreset.strengthStyle} · {selectedPreset.strengthSplit}
                  </Text>
                </View>
                <View style={styles.reviewMetaRow}>
                  <Text style={[styles.reviewMetaLabel, { color: colors.textMuted }]}>Run Goal</Text>
                  <Text style={[styles.reviewMetaValue, { color: colors.text }]}>{runCfg.label}</Text>
                </View>
                <View style={styles.reviewMetaRow}>
                  <Text style={[styles.reviewMetaLabel, { color: colors.textMuted }]}>Experience</Text>
                  <Text style={[styles.reviewMetaValue, { color: colors.text }]}>
                    {EXPERIENCE_OPTIONS.find(e => e.value === experienceLevel)?.label}
                  </Text>
                </View>
                <View style={styles.reviewMetaRow}>
                  <Text style={[styles.reviewMetaLabel, { color: colors.textMuted }]}>Peak mileage</Text>
                  <Text style={[styles.reviewMetaValue, { color: colors.text }]}>
                    {runCfg.peakWeeklyMilesByLevel[experienceLevel]} mi/wk
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

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
  allocationCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
  },
  allocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  allocationLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  allocationLabelText: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
  },
  allocationDivider: {
    height: StyleSheet.hairlineWidth,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    fontSize: 20,
    fontFamily: 'Outfit_800ExtraBold',
    minWidth: 30,
    textAlign: 'center',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  totalLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.6,
  },
  totalValue: {
    fontSize: 16,
    fontFamily: 'Outfit_800ExtraBold',
  },
  weekSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  weekDayLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.8,
    width: 34,
  },
  weekSlotIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekSlotLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
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
