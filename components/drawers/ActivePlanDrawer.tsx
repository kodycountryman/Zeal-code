import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import BaseDrawer from '@/components/drawers/BaseDrawer';
import { PlatformIcon } from '@/components/PlatformIcon';
import PlanDayPreviewDrawer from '@/components/drawers/PlanDayPreviewDrawer';
import type { DayPrescription } from '@/services/planEngine';

import { useZealTheme, useAppContext } from '@/context/AppContext';
import { WORKOUT_STYLE_COLORS } from '@/constants/colors';
import { PHASE_DISPLAY_NAMES, PHASE_COLORS } from '@/services/planConstants';
import type { WeekSchedule } from '@/services/planEngine';
import { getEventMilestones, handleMissedDays } from '@/services/planEngine';
import type { PlanPhase } from '@/services/planConstants';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const PHASE_INITIALS: Record<string, string> = {
  foundation: 'F',
  build: 'B',
  intensify: 'I',
  peak: 'P',
  deload: 'D',
  taper: 'T',
  test: 'TS',
};

interface Props {
  visible: boolean;
  onClose: () => void;
  onStartNewPlan: () => void;
  onEditPlan: () => void;
}

function formatDateShort(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return dateStr; }
}

function formatDateFull(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return dateStr; }
}

function getWeeksLeft(endDate: string): number {
  const now = new Date();
  const end = new Date(endDate + 'T00:00:00');
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (7 * 24 * 60 * 60 * 1000)));
}

function getCurrentWeek(startDate: string): number {
  const now = new Date();
  const start = new Date(startDate + 'T00:00:00');
  const diff = now.getTime() - start.getTime();
  return Math.max(1, Math.ceil(diff / (7 * 24 * 60 * 60 * 1000)));
}

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ActivePlanDrawer({ visible, onClose, onStartNewPlan, onEditPlan }: Props) {
  const { colors, accent } = useZealTheme();
  const ctx = useAppContext();
  const router = useRouter();

  const plan = ctx.activePlan;
  const schedule = ctx.planSchedule;

  const [selectedWeekIdx, setSelectedWeekIdx] = useState<number>(0);
  const [previewDay, setPreviewDay] = useState<DayPrescription | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [recoveryDismissed, setRecoveryDismissed] = useState(false);
  const phaseScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible) {
      if (plan && schedule) {
        const cw = getCurrentWeek(plan.startDate);
        const idx = Math.max(0, Math.min(cw - 1, schedule.weeks.length - 1));
        setSelectedWeekIdx(idx);
        // Scroll timeline to current week (36px dot + 6px gap = 42px per item)
        setTimeout(() => {
          phaseScrollRef.current?.scrollTo({ x: idx * 42, animated: true });
        }, 150);
      }
    }
  }, [visible, plan, schedule]);

  const handlePausePlan = useCallback(() => {
    if (!plan) return;
    const today = getTodayStr();
    ctx.saveActivePlan({ ...plan, pausedAt: today }, schedule ?? null);
  }, [ctx, plan, schedule]);

  const handleResumePlan = useCallback(() => {
    if (!plan) return;
    const { pausedAt: _, ...rest } = plan;
    ctx.saveActivePlan({ ...rest }, schedule ?? null);
  }, [ctx, plan, schedule]);

  const handleCancelPlan = useCallback(() => {
    Alert.alert(
      'Cancel Plan',
      'Are you sure you want to cancel your current workout plan? This cannot be undone.',
      [
        { text: 'Keep Plan', style: 'cancel' },
        {
          text: 'Cancel Plan',
          style: 'destructive',
          onPress: () => {
            onClose();
            setTimeout(() => {
              ctx.saveActivePlan(null, null);
            }, 400);
          },
        },
      ]
    );
  }, [ctx, onClose]);

  const handleStartNew = useCallback(() => {
    onClose();
    setTimeout(() => onStartNewPlan(), 350);
  }, [onClose, onStartNewPlan]);

  const handlePrevWeek = useCallback(() => {
    setSelectedWeekIdx(prev => Math.max(0, prev - 1));
  }, []);

  const handleNextWeek = useCallback(() => {
    if (!schedule) return;
    setSelectedWeekIdx(prev => Math.min(schedule.weeks.length - 1, prev + 1));
  }, [schedule]);

  const selectedWeek: WeekSchedule | null = useMemo(() => {
    if (!schedule || selectedWeekIdx >= schedule.weeks.length) return null;
    return schedule.weeks[selectedWeekIdx];
  }, [schedule, selectedWeekIdx]);

  const milestones = useMemo(() => {
    if (!plan) return [];
    return getEventMilestones(plan.event, plan.planLength, plan.startDate);
  }, [plan]);

  const currentWeekMilestone = useMemo(() => {
    if (!selectedWeek || milestones.length === 0) return null;
    return milestones.find(m => m.week === selectedWeek.week_number) ?? null;
  }, [selectedWeek, milestones]);

  // Today's prescription from plan schedule
  const todayPrescription = useMemo(() => {
    return ctx.getTodayPrescription();
  }, [ctx, visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Missed day recovery recommendation
  const missedRecovery = useMemo(() => {
    if (!plan?.missedDays?.length) return null;
    const total = plan.missedDays.length;
    // Count consecutive days missed backwards from yesterday
    const today = getTodayStr();
    let consecutive = 0;
    for (let i = 1; i <= total; i++) {
      const d = new Date(today + 'T00:00:00');
      d.setDate(d.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (plan.missedDays.includes(ds)) {
        consecutive++;
      } else {
        break;
      }
    }
    return handleMissedDays(total, consecutive);
  }, [plan?.missedDays]);

  if (!plan) return null;

  const today = getTodayStr();
  const styleColor = WORKOUT_STYLE_COLORS[plan.style] ?? accent;
  const currentWeek = getCurrentWeek(plan.startDate);
  const weeksLeft = getWeeksLeft(plan.endDate);
  const isPlanComplete = plan.endDate < today;
  const isPlanPaused = !!plan.pausedAt;

  // Adherence stats
  const totalTrainingDays = schedule
    ? schedule.weeks.reduce((sum, w) => sum + w.days.filter(d => !d.is_rest).length, 0)
    : plan.daysPerWeek * plan.planLength;
  const completedCount = plan.completedDays?.length ?? 0;
  const progressPct = totalTrainingDays > 0
    ? Math.min(100, Math.round((completedCount / totalTrainingDays) * 100))
    : 0;
  const adherencePct = totalTrainingDays > 0 ? Math.round((completedCount / totalTrainingDays) * 100) : 0;

  const headerContent = (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <PlatformIcon name="sparkles" size={15} color={accent} />
        <Text style={[styles.headerLabel, { color: accent }]}>ACTIVE PLAN</Text>
      </View>
      <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
        <PlatformIcon name="x" size={14} color="#888" />
      </TouchableOpacity>
    </View>
  );

  return (
    <BaseDrawer visible={visible} onClose={onClose} header={headerContent}>
      <View style={styles.content}>

        {/* ── Plan identity ─────────────────────────────── */}
        <Text style={[styles.planName, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{plan.name}</Text>

        <View style={styles.tagRow}>
          <View style={[styles.tag, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
            <Text style={[styles.tagText, { color: colors.textSecondary }]}>{plan.style}</Text>
          </View>
          <View style={[styles.tag, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
            <Text style={[styles.tagText, { color: colors.textSecondary }]}>{plan.goal}</Text>
          </View>
          <View style={[styles.tag, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
            <Text style={[styles.tagText, { color: colors.textSecondary }]}>
              {plan.experienceLevel.charAt(0).toUpperCase() + plan.experienceLevel.slice(1)}
            </Text>
          </View>
          {plan.equipment !== undefined && (
            <View style={[styles.tag, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
              <Text style={[styles.tagText, { color: colors.textSecondary }]}>
                {Object.values(plan.equipment).filter(v => v > 0).length === 0
                  ? 'Bodyweight'
                  : `${Object.values(plan.equipment).filter(v => v > 0).length} items`}
              </Text>
            </View>
          )}
        </View>

        {/* ── Paused banner ───────────────────────────── */}
        {isPlanPaused && !isPlanComplete && (
          <View style={[styles.pausedBanner, { backgroundColor: '#60a5fa0d', borderColor: '#60a5fa30' }]}>
            <PlatformIcon name="pause-circle" size={14} color="#60a5fa" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.pausedBannerTitle, { color: '#60a5fa' }]}>Plan Paused</Text>
              <Text style={[styles.pausedBannerSub, { color: colors.textSecondary }]}>
                Paused {plan.pausedAt ? `on ${formatDateShort(plan.pausedAt)}` : ''}. Tap Resume Plan below to continue.
              </Text>
            </View>
          </View>
        )}

        {isPlanComplete ? (
          /* ── PLAN COMPLETE HERO ──────────────────────── */
          <View style={[styles.completionCard, { backgroundColor: '#22c55e0d', borderColor: '#22c55e35' }]}>
            <View style={styles.completionTop}>
              <View style={[styles.completionIconWrap, { backgroundColor: '#22c55e20' }]}>
                <PlatformIcon name="trophy" size={26} color="#22c55e" />
              </View>
              <View style={styles.completionTextBlock}>
                <Text style={[styles.completionTitle, { color: colors.text }]}>Plan Complete</Text>
                <Text style={[styles.completionSub, { color: colors.textSecondary }]}>
                  {formatDateShort(plan.startDate)} → {formatDateShort(plan.endDate)}
                </Text>
              </View>
            </View>
            <View style={[styles.completionDivider, { backgroundColor: '#22c55e20' }]} />
            <View style={styles.completionStats}>
              <View style={styles.completionStat}>
                <Text style={[styles.completionStatNum, { color: '#22c55e' }]}>{completedCount}</Text>
                <Text style={[styles.completionStatLabel, { color: colors.textSecondary }]}>days done</Text>
              </View>
              <View style={[styles.completionStatDivider, { backgroundColor: '#22c55e20' }]} />
              <View style={styles.completionStat}>
                <Text style={[styles.completionStatNum, { color: '#22c55e' }]}>{adherencePct}%</Text>
                <Text style={[styles.completionStatLabel, { color: colors.textSecondary }]}>adherence</Text>
              </View>
              <View style={[styles.completionStatDivider, { backgroundColor: '#22c55e20' }]} />
              <View style={styles.completionStat}>
                <Text style={[styles.completionStatNum, { color: '#22c55e' }]}>{plan.planLength}</Text>
                <Text style={[styles.completionStatLabel, { color: colors.textSecondary }]}>weeks</Text>
              </View>
            </View>
          </View>
        ) : (
          /* ── PROGRESS (active plan) ──────────────────── */
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>PROGRESS</Text>
              <Text style={[styles.progressWeek, { color: colors.textSecondary }]}>
                Week {currentWeek} of {plan.planLength}
              </Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
              <View style={[styles.progressFill, { width: `${progressPct}%`, backgroundColor: styleColor }]} />
            </View>
            <View style={styles.progressFooter}>
              <Text style={[styles.progressPct, { color: styleColor }]}>{progressPct}% complete</Text>
              <Text style={[styles.progressLeft, { color: colors.textMuted }]}>{weeksLeft}w left</Text>
            </View>
          </View>
        )}

        {/* ── Today's session (active plan only) ───────── */}
        {!isPlanComplete && todayPrescription ? (
          <View style={[
            styles.todayCard,
            { backgroundColor: colors.cardSecondary, borderColor: colors.border },
          ]}>
            <View style={[styles.todayAccentBar, { backgroundColor: `${styleColor}60` }]} />
            <View style={styles.todayBody}>
              <Text style={[styles.todayLabel, { color: styleColor }]}>TODAY</Text>
              {todayPrescription.is_rest ? (
                <View style={styles.todayMain}>
                  <PlatformIcon name="moon" size={18} color={colors.textSecondary} />
                  <View style={styles.todayTextBlock}>
                    <Text style={[styles.todaySession, { color: colors.text }]}>Recovery Day</Text>
                    {todayPrescription.rest_suggestion ? (
                      <Text style={[styles.todaySub, { color: colors.textSecondary }]} numberOfLines={2}>
                        {todayPrescription.rest_suggestion}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ) : (
                <View style={styles.todayMain}>
                  <PlatformIcon name="dumbbell" size={18} color={styleColor} />
                  <View style={styles.todayTextBlock}>
                    <Text style={[styles.todaySession, { color: colors.text }]} numberOfLines={1}>
                      {todayPrescription.session_type || todayPrescription.style}
                    </Text>
                    <View style={styles.todayMetaRow}>
                      <PlatformIcon name="clock" size={11} color={colors.textMuted} />
                      <Text style={[styles.todayMetaText, { color: colors.textMuted }]}>
                        {todayPrescription.target_duration} min
                      </Text>
                      <Text style={[styles.todayMetaDot, { color: colors.textMuted }]}>·</Text>
                      <Text style={[styles.todayMetaText, { color: colors.textMuted }]}>
                        {PHASE_DISPLAY_NAMES[todayPrescription.phase as PlanPhase] ?? todayPrescription.phase}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          </View>
        ) : null}

        {/* ── Start today CTA (training day only) ──────── */}
        {!isPlanComplete && todayPrescription && !todayPrescription.is_rest && (
          <TouchableOpacity
            style={[styles.startTodayBtn, { backgroundColor: styleColor }]}
            onPress={() => {
              onClose();
              setTimeout(() => router.push('/(tabs)/workout' as any), 350);
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.startTodayBtnText}>Start Today's Workout</Text>
            <PlatformIcon name="chevron-right" size={15} color="rgba(255,255,255,0.7)" style={{ marginRight: 14 }} />
          </TouchableOpacity>
        )}

        {/* ── Missed day recovery ───────────────────────── */}
        {!isPlanComplete && missedRecovery && !recoveryDismissed && (
          <View style={[styles.recoveryCard, { backgroundColor: '#f59e0b0d', borderColor: '#f59e0b30' }]}>
            <View style={styles.recoveryHeader}>
              <PlatformIcon name="alert-triangle" size={13} color="#f59e0b" />
              <Text style={styles.recoveryTitle}>
                {plan.missedDays!.length === 1 ? '1 missed day' : `${plan.missedDays!.length} missed days`}
              </Text>
            </View>
            <Text style={[styles.recoveryMessage, { color: colors.textSecondary }]}>
              {missedRecovery.message}
            </Text>
            <TouchableOpacity
              style={styles.recoveryDismissBtn}
              onPress={() => setRecoveryDismissed(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.recoveryDismissText}>Got it</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Adherence analytics ──────────────────────── */}
        {!isPlanComplete && completedCount > 0 && (
          <View style={[styles.adherenceCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginBottom: 10 }]}>ADHERENCE</Text>
            <View style={styles.adherenceRow}>
              <View style={styles.adherenceStat}>
                <Text style={[styles.adherenceNum, { color: '#22c55e' }]}>{completedCount}</Text>
                <Text style={[styles.adherenceLabel, { color: colors.textSecondary }]}>done</Text>
              </View>
              <View style={[styles.adherenceDivider, { backgroundColor: colors.border }]} />
              <View style={styles.adherenceStat}>
                <Text style={[styles.adherenceNum, { color: plan.missedDays?.length ? '#ef4444' : colors.textMuted }]}>
                  {plan.missedDays?.length ?? 0}
                </Text>
                <Text style={[styles.adherenceLabel, { color: colors.textSecondary }]}>missed</Text>
              </View>
              <View style={[styles.adherenceDivider, { backgroundColor: colors.border }]} />
              <View style={styles.adherenceStat}>
                <Text style={[styles.adherenceNum, { color: colors.text }]}>{totalTrainingDays}</Text>
                <Text style={[styles.adherenceLabel, { color: colors.textSecondary }]}>total</Text>
              </View>
              <View style={[styles.adherenceDivider, { backgroundColor: colors.border }]} />
              <View style={styles.adherenceStat}>
                <Text style={[styles.adherenceNum, { color: styleColor }]}>{adherencePct}%</Text>
                <Text style={[styles.adherenceLabel, { color: colors.textSecondary }]}>rate</Text>
              </View>
            </View>
            <View style={[styles.adherenceTrack, { backgroundColor: colors.border }]}>
              <View style={[styles.adherenceFill, { width: `${adherencePct}%` as any, backgroundColor: styleColor }]} />
              {(plan.missedDays?.length ?? 0) > 0 && (
                <View style={[
                  styles.adherenceMissedFill,
                  {
                    width: `${Math.round(((plan.missedDays?.length ?? 0) / totalTrainingDays) * 100)}%` as any,
                    left: `${adherencePct}%` as any,
                  },
                ]} />
              )}
            </View>
          </View>
        )}

        {/* ── Phase timeline ────────────────────────────── */}
        {schedule && schedule.weeks.length > 0 && (
          <>
            <View style={styles.phaseTimeline}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>PHASE TIMELINE</Text>
              <ScrollView
                ref={phaseScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.phaseTimelineScroll}
              >
                {schedule.weeks.map((week, idx) => {
                  const isCurrentWeek = week.week_number === currentWeek;
                  const isSelected = idx === selectedWeekIdx;
                  const dotBg = isSelected ? `${accent}60` : 'rgba(255,255,255,0.06)';
                  const dotBorderColor = isSelected ? `${accent}60` : isCurrentWeek ? `${accent}50` : 'transparent';
                  const dotTextColor = isSelected ? '#fff' : isCurrentWeek ? `${accent}CC` : colors.textSecondary;
                  const phaseInitial = PHASE_INITIALS[week.phase] ?? week.phase.charAt(0).toUpperCase();
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.phaseWeekDot,
                        {
                          backgroundColor: dotBg,
                          borderColor: dotBorderColor,
                          borderWidth: isCurrentWeek && !isSelected ? 1.5 : isSelected ? 0 : 1,
                        },
                      ]}
                      onPress={() => setSelectedWeekIdx(idx)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`Week ${week.week_number}, ${PHASE_DISPLAY_NAMES[week.phase as PlanPhase] ?? week.phase}${week.is_deload ? ', Deload' : ''}${isCurrentWeek ? ', current week' : ''}`}
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Text style={[styles.phaseWeekPhase, { color: dotTextColor }]}>{phaseInitial}</Text>
                      <Text style={[styles.phaseWeekNum, { color: dotTextColor }]}>{week.week_number}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* ── Week detail ───────────────────────────── */}
            <View style={styles.weekDetailSection}>
              {/* Nav row */}
              <View style={styles.weekNav}>
                <TouchableOpacity
                  onPress={handlePrevWeek}
                  disabled={selectedWeekIdx === 0}
                  activeOpacity={0.7}
                  style={[styles.weekNavBtn, { opacity: selectedWeekIdx === 0 ? 0.3 : 1 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Previous week"
                  accessibilityState={{ disabled: selectedWeekIdx === 0 }}
                >
                  <PlatformIcon name="chevron-left" size={18} color={colors.text} />
                </TouchableOpacity>

                <View style={styles.weekNavCenter}>
                  <Text style={[styles.weekNavTitle, { color: colors.text }]}>
                    Week {selectedWeek?.week_number ?? selectedWeekIdx + 1}
                  </Text>
                  {selectedWeek && (
                    <View style={[styles.phaseBadge, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                      <Text style={[styles.phaseBadgeText, { color: colors.textSecondary }]}>
                        {PHASE_DISPLAY_NAMES[selectedWeek.phase as PlanPhase] ?? selectedWeek.phase}
                        {selectedWeek.is_deload ? ' · Deload' : ''}
                      </Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  onPress={handleNextWeek}
                  disabled={!schedule || selectedWeekIdx >= schedule.weeks.length - 1}
                  activeOpacity={0.7}
                  style={[
                    styles.weekNavBtn,
                    { opacity: !schedule || selectedWeekIdx >= schedule.weeks.length - 1 ? 0.3 : 1 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Next week"
                  accessibilityState={{ disabled: !schedule || selectedWeekIdx >= schedule.weeks.length - 1 }}
                >
                  <PlatformIcon name="chevron-right" size={18} color={colors.text} />
                </TouchableOpacity>
              </View>

              {/* Week notes */}
              {selectedWeek?.notes ? (
                <View style={[styles.infoRow, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
                  <PlatformIcon name="trending-up" size={12} color={colors.textSecondary} />
                  <Text style={[styles.infoRowText, { color: colors.textSecondary }]}>{selectedWeek.notes}</Text>
                </View>
              ) : null}

              {/* Event milestone */}
              {currentWeekMilestone && (
                <View style={[styles.infoRow, { backgroundColor: '#f59e0b12', borderColor: '#f59e0b30' }]}>
                  <PlatformIcon name="target" size={12} color="#f59e0b" />
                  <Text style={[styles.infoRowText, { color: '#f59e0b' }]}>{currentWeekMilestone.label}</Text>
                </View>
              )}

              {/* Day grid */}
              <View style={styles.dayGrid}>
                {selectedWeek?.days.map((day, dIdx) => {
                  const isToday = day.date === today;
                  const isPast = day.date < today;
                  const isMissed = plan.missedDays?.includes(day.date);
                  const isCompleted = !day.is_rest && plan.completedDays?.includes(day.date);

                  // Resolved border/background based on state priority
                  const cardBg = isCompleted
                    ? '#22c55e0d'
                    : day.is_rest
                      ? colors.cardSecondary
                      : `${accent}08`;
                  const cardBorder = isCompleted
                    ? '#22c55e40'
                    : isToday
                      ? styleColor
                      : isMissed
                        ? '#ef444430'
                        : colors.border;

                  const CardWrapper = day.is_rest ? View : TouchableOpacity;
                  return (
                    <CardWrapper
                      key={dIdx}
                      style={[
                        styles.dayCard,
                        {
                          backgroundColor: cardBg,
                          borderColor: cardBorder,
                          borderWidth: isToday || isCompleted ? 1.5 : 1,
                        },
                      ]}
                      {...(!day.is_rest && {
                        onPress: () => {
                          setPreviewDay(day);
                          setPreviewVisible(true);
                        },
                        activeOpacity: 0.75,
                        accessibilityRole: 'button' as const,
                        accessibilityLabel: `${DAY_LABELS[new Date(day.date + 'T00:00:00').getDay()] ?? ''} ${formatDateShort(day.date)}, ${day.session_type || day.style}, ${day.target_duration} minutes${isCompleted ? ', completed' : isMissed ? ', missed' : isToday ? ', today' : ''}`,
                        accessibilityHint: 'Tap to preview this workout',
                      })}
                    >
                      <View style={styles.dayCardHeader}>
                        <Text style={[
                          styles.dayLabel,
                          { color: isCompleted ? '#22c55e' : isToday ? styleColor : colors.textSecondary },
                        ]}>
                          {DAY_LABELS[new Date(day.date + 'T00:00:00').getDay()] ?? `D${dIdx + 1}`}
                        </Text>
                        <View style={styles.dayCardHeaderRight}>
                          {isCompleted && (
                            <PlatformIcon name="check-circle" size={14} color="#22c55e" fill="#22c55e" />
                          )}
                          <Text style={[styles.dayDate, { color: colors.textMuted }]}>
                            {formatDateShort(day.date)}
                          </Text>
                        </View>
                      </View>

                      {day.is_rest ? (
                        <View style={styles.restContent}>
                          <PlatformIcon name="moon" size={14} color={colors.textMuted} />
                          <Text style={[styles.restLabel, { color: colors.textSecondary }]}>Rest</Text>
                        </View>
                      ) : (
                        <View style={styles.trainingContent}>
                          <View style={styles.dayStyleRow}>
                            <PlatformIcon name="dumbbell" size={11} color={isCompleted ? '#22c55e' : isToday ? accent : colors.text} />
                            <Text style={[styles.dayStyleText, { color: isCompleted ? '#22c55e' : isToday ? accent : colors.text }]} numberOfLines={1}>
                              {day.session_type || day.style}
                            </Text>
                          </View>
                          <View style={styles.dayMetaRow}>
                            <PlatformIcon name="clock" size={10} color={colors.textMuted} />
                            <Text style={[styles.dayMetaText, { color: colors.textMuted }]}>
                              {day.target_duration}min
                            </Text>
                          </View>
                          <View style={styles.dayTagRow}>
                            {day.is_deload_week && (
                              <View style={styles.deloadTag}>
                                <Text style={styles.deloadTagText}>Deload</Text>
                              </View>
                            )}
                            {!day.is_deload_week && day.intensity_modifier > 0 && day.intensity_modifier < 0.9 && (
                              <View style={styles.effortTag}>
                                <Text style={styles.effortTagText}>~{Math.round(day.intensity_modifier * 100)}% effort</Text>
                              </View>
                            )}
                            {isPast && !day.is_rest && isMissed && !isCompleted && (
                              <View style={styles.missedTag}>
                                <PlatformIcon name="alert-triangle" size={9} color="#ef4444" />
                                <Text style={styles.missedTagText}>Missed</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      )}
                    </CardWrapper>
                  );
                })}
              </View>
            </View>
          </>
        )}

        {/* ── Stats grid ────────────────────────────────── */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCell, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
            <View style={styles.statHeader}>
              <PlatformIcon name="calendar" size={12} color={accent} />
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>START</Text>
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{formatDateShort(plan.startDate)}</Text>
          </View>
          <View style={[styles.statCell, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
            <View style={styles.statHeader}>
              <PlatformIcon name="calendar" size={12} color={accent} />
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>END</Text>
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{formatDateFull(plan.endDate)}</Text>
          </View>
          <View style={[styles.statCell, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
            <View style={styles.statHeader}>
              <PlatformIcon name="dumbbell" size={12} color={accent} />
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>DAYS/WEEK</Text>
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{plan.daysPerWeek} days</Text>
          </View>
          <View style={[styles.statCell, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
            <View style={styles.statHeader}>
              <PlatformIcon name="clock" size={12} color={accent} />
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>DURATION</Text>
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{plan.sessionDuration} min</Text>
          </View>
          <View style={[styles.statCell, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
            <View style={styles.statHeader}>
              <PlatformIcon name="star" size={12} color={accent} />
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>LEVEL</Text>
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {plan.experienceLevel.charAt(0).toUpperCase() + plan.experienceLevel.slice(1)}
            </Text>
          </View>
          <View style={[styles.statCell, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
            <View style={styles.statHeader}>
              <PlatformIcon name="bar-chart-3" size={12} color={accent} />
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>WEEKS LEFT</Text>
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{weeksLeft} weeks</Text>
          </View>
        </View>

        {/* ── Schedule overview ─────────────────────────── */}
        {schedule && (
          <View style={[styles.scheduleStats, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
            <View style={styles.scheduleRow}>
              <Text style={[styles.scheduleRowLabel, { color: colors.textSecondary }]}>Total training days</Text>
              <Text style={[styles.scheduleRowValue, { color: colors.text }]}>{schedule.total_training_days}</Text>
            </View>
            <View style={[styles.scheduleRow, { borderTopWidth: 0.5, borderTopColor: colors.border }]}>
              <Text style={[styles.scheduleRowLabel, { color: colors.textSecondary }]}>Total rest days</Text>
              <Text style={[styles.scheduleRowValue, { color: colors.text }]}>{schedule.total_rest_days}</Text>
            </View>
            <View style={[styles.scheduleRow, { borderTopWidth: 0.5, borderTopColor: colors.border }]}>
              <Text style={[styles.scheduleRowLabel, { color: colors.textSecondary }]}>Phases</Text>
              <Text style={[styles.scheduleRowValue, { color: colors.text }]}>
                {schedule.phases_used.map(p => PHASE_DISPLAY_NAMES[p as PlanPhase] ?? p).join(', ')}
              </Text>
            </View>
          </View>
        )}

        {/* ── Actions ───────────────────────────────────── */}
        {!isPlanComplete && (
          <TouchableOpacity
            style={[styles.ghostBtn, { borderColor: styleColor + '40' }]}
            onPress={() => { onClose(); setTimeout(() => onEditPlan(), 350); }}
            activeOpacity={0.7}
          >
            <PlatformIcon name="pencil" size={14} color={styleColor} />
            <Text style={[styles.ghostBtnText, { color: styleColor }]}>Edit Plan</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.ghostBtn, { borderColor: colors.border }]}
          onPress={handleStartNew}
          activeOpacity={0.7}
        >
          <PlatformIcon name="refresh" size={14} color={colors.textSecondary} />
          <Text style={[styles.ghostBtnText, { color: colors.textSecondary }]}>Start New Plan</Text>
        </TouchableOpacity>

        {!isPlanComplete && (
          plan.pausedAt ? (
            <TouchableOpacity
              style={[styles.ghostBtn, { borderColor: '#22c55e40' }]}
              onPress={handleResumePlan}
              activeOpacity={0.7}
            >
              <PlatformIcon name="play" size={14} color="#22c55e" />
              <Text style={[styles.ghostBtnText, { color: '#22c55e' }]}>Resume Plan</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.ghostBtn, { borderColor: colors.border }]}
              onPress={handlePausePlan}
              activeOpacity={0.7}
            >
              <PlatformIcon name="pause" size={14} color={colors.textSecondary} />
              <Text style={[styles.ghostBtnText, { color: colors.textSecondary }]}>Pause Plan</Text>
            </TouchableOpacity>
          )
        )}

        <TouchableOpacity
          style={[styles.cancelBtn, { borderColor: '#ef444430' }]}
          onPress={handleCancelPlan}
          activeOpacity={0.7}
        >
          <PlatformIcon name="trash" size={14} color="#ef4444" />
          <Text style={styles.cancelBtnText}>Cancel Plan</Text>
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </View>

      <PlanDayPreviewDrawer
        visible={previewVisible}
        onClose={() => setPreviewVisible(false)}
        onClosePlan={onClose}
        day={previewDay}
      />
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

  content: { paddingHorizontal: 16, gap: 16, paddingBottom: 8 },
  planName: { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.5 },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  tagText: { fontSize: 12, fontWeight: '600' as const },

  // Plan completion card
  completionCard: {
    borderRadius: 16, borderWidth: 1, padding: 16, gap: 12,
  },
  completionTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  completionIconWrap: {
    width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
  },
  completionTextBlock: { flex: 1, gap: 3 },
  completionTitle: { fontSize: 20, fontWeight: '800' as const, letterSpacing: -0.3 },
  completionSub: { fontSize: 12 },
  completionDivider: { height: 1 },
  completionStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  completionStat: { alignItems: 'center', gap: 3, flex: 1 },
  completionStatNum: { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.5 },
  completionStatLabel: { fontSize: 11 },
  completionStatDivider: { width: 1, height: 32 },

  // Progress
  progressSection: { gap: 6 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { fontSize: 10, fontWeight: '700' as const, letterSpacing: 0.8 },
  progressWeek: { fontSize: 12, fontWeight: '500' as const },
  progressTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 5, borderRadius: 3 },
  progressFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  progressPct: { fontSize: 11, fontWeight: '600' as const },
  progressLeft: { fontSize: 11 },

  // Today card
  todayCard: {
    flexDirection: 'row', borderRadius: 16, borderWidth: 1, overflow: 'hidden',
  },
  todayAccentBar: { width: 4, borderRadius: 0 },
  todayBody: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, gap: 6 },
  todayLabel: { fontSize: 10, fontWeight: '700' as const, letterSpacing: 1 },
  todayMain: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  todayTextBlock: { flex: 1, gap: 3 },
  todaySession: { fontSize: 17, fontWeight: '700' as const, letterSpacing: -0.2 },
  todaySub: { fontSize: 12, fontWeight: '400' as const },
  todayMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  todayMetaText: { fontSize: 12 },
  todayMetaDot: { fontSize: 12 },

  // Start today CTA
  startTodayBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 16, paddingVertical: 14,
  },
  startTodayBtnText: {
    fontSize: 15, fontWeight: '700' as const, color: '#fff', letterSpacing: -0.2, flex: 1, textAlign: 'center' as const,
  },

  // Recovery card
  recoveryCard: {
    borderRadius: 12, borderWidth: 1, padding: 12, gap: 6,
  },
  recoveryHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  recoveryTitle: { fontSize: 12, fontWeight: '700' as const, color: '#f59e0b' },
  recoveryMessage: { fontSize: 12, fontWeight: '400' as const, lineHeight: 17 },

  // Phase timeline
  sectionLabel: { fontSize: 10, fontWeight: '700' as const, letterSpacing: 0.8, marginBottom: 8 },
  phaseTimeline: { gap: 0 },
  phaseTimelineScroll: { gap: 6, paddingRight: 16 },
  phaseWeekDot: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5,
  },
  phaseWeekPhase: { fontSize: 11, fontWeight: '800' as const, lineHeight: 13 },
  phaseWeekNum: { fontSize: 9, fontWeight: '500' as const, lineHeight: 11 },
  deloadDot: { position: 'absolute', bottom: -1, width: 6, height: 6, borderRadius: 3 },

  // Week detail
  weekDetailSection: { gap: 10 },
  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekNavBtn: { padding: 4 },
  weekNavCenter: { alignItems: 'center', gap: 4 },
  weekNavTitle: { fontSize: 18, fontWeight: '800' as const },
  phaseBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  phaseBadgeText: { fontSize: 11, fontWeight: '600' as const },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8,
  },
  infoRowText: { fontSize: 12, fontWeight: '500' as const, flex: 1 },

  // Day grid
  dayGrid: { gap: 6 },
  dayCard: { borderRadius: 12, padding: 12, gap: 5 },
  dayCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayCardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dayLabel: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.5 },
  dayDate: { fontSize: 10 },
  restContent: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  restLabel: { fontSize: 13, fontWeight: '500' as const },
  trainingContent: { gap: 3 },
  dayStyleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dayStyleText: { fontSize: 13, fontWeight: '600' as const, flex: 1 },
  dayMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dayMetaText: { fontSize: 11 },
  dayTagRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  deloadTag: {
    alignSelf: 'flex-start', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2, backgroundColor: '#22c55e20',
  },
  deloadTagText: { fontSize: 10, fontWeight: '600' as const, color: '#22c55e' },
  missedTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2, backgroundColor: '#ef444420',
  },
  missedTagText: { fontSize: 10, fontWeight: '600' as const, color: '#ef4444' },
  effortTag: {
    alignSelf: 'flex-start', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2, backgroundColor: 'rgba(255,255,255,0.07)',
  },
  effortTagText: { fontSize: 10, fontWeight: '600' as const, color: '#9a9a9a' },

  // Stats grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCell: {
    width: '47%' as any, borderRadius: 12, borderWidth: 1,
    padding: 14, gap: 6,
  },
  statHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statLabel: { fontSize: 9, fontWeight: '700' as const, letterSpacing: 0.6 },
  statValue: { fontSize: 16, fontWeight: '700' as const },

  // Schedule overview
  scheduleStats: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  scheduleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  scheduleRowLabel: { fontSize: 12, fontWeight: '500' as const },
  scheduleRowValue: { fontSize: 14, fontWeight: '600' as const, maxWidth: '60%' as any, textAlign: 'right' as const },

  // Actions
  ghostBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderRadius: 14, paddingVertical: 14,
  },
  ghostBtnText: { fontSize: 14, fontWeight: '600' as const },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14, borderWidth: 1,
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600' as const, color: '#ef4444' },

  // Paused banner
  pausedBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: 12, borderWidth: 1, padding: 12,
  },
  pausedBannerTitle: { fontSize: 13, fontWeight: '700' as const },
  pausedBannerSub: { fontSize: 12, marginTop: 2, lineHeight: 17 },

  // Recovery dismiss
  recoveryDismissBtn: {
    alignSelf: 'flex-end', marginTop: 4,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, backgroundColor: '#f59e0b20',
  },
  recoveryDismissText: { fontSize: 12, fontWeight: '600' as const, color: '#f59e0b' },

  // Adherence card
  adherenceCard: {
    borderRadius: 14, borderWidth: 1, padding: 14, gap: 10,
  },
  adherenceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
  },
  adherenceStat: { alignItems: 'center', gap: 3, flex: 1 },
  adherenceDivider: { width: 1, height: 28 },
  adherenceNum: { fontSize: 20, fontWeight: '800' as const, letterSpacing: -0.5 },
  adherenceLabel: { fontSize: 10, fontWeight: '600' as const, letterSpacing: 0.4 },
  adherenceTrack: {
    height: 4, borderRadius: 2, overflow: 'hidden', flexDirection: 'row',
  },
  adherenceFill: { height: 4 },
  adherenceMissedFill: { height: 4, position: 'absolute', top: 0, backgroundColor: '#ef4444' },
});
