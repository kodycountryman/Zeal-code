import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import BaseDrawer from '@/components/drawers/BaseDrawer';
import {
  X,
  Sparkles,
  Calendar,
  Clock,
  Star,
  BarChart3,
  Dumbbell,
  RefreshCw,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Moon,
  Zap,
  Target,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react-native';

import { useZealTheme, useAppContext } from '@/context/AppContext';
import { WORKOUT_STYLE_COLORS } from '@/constants/colors';
import { PHASE_DISPLAY_NAMES, PHASE_COLORS } from '@/services/planConstants';
import type { DayPrescription, WeekSchedule } from '@/services/planEngine';
import { getEventMilestones, handleMissedDays } from '@/services/planEngine';
import type { PlanPhase } from '@/services/planConstants';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

interface Props {
  visible: boolean;
  onClose: () => void;
  onStartNewPlan: () => void;
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

export default function ActivePlanDrawer({ visible, onClose, onStartNewPlan }: Props) {
  const { colors, accent } = useZealTheme();
  const ctx = useAppContext();

  const plan = ctx.activePlan;
  const schedule = ctx.planSchedule;

  const [selectedWeekIdx, setSelectedWeekIdx] = useState<number>(0);

  useEffect(() => {
    if (visible) {
      if (plan && schedule) {
        const cw = getCurrentWeek(plan.startDate);
        const idx = Math.max(0, Math.min(cw - 1, schedule.weeks.length - 1));
        setSelectedWeekIdx(idx);
      }
    }
  }, [visible, plan, schedule]);

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

  if (!plan) return null;

  const styleColor = WORKOUT_STYLE_COLORS[plan.style] ?? accent;
  const currentWeek = getCurrentWeek(plan.startDate);
  const weeksLeft = getWeeksLeft(plan.endDate);
  const progressPct = Math.min(100, Math.round((currentWeek / plan.planLength) * 100));
  const today = getTodayStr();

  const headerContent = (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Sparkles size={16} color={accent} />
        <Text style={[styles.headerLabel, { color: accent }]}>ACTIVE PLAN</Text>
      </View>
      <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
        <X size={16} color="#888" strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
  );

  return (
    <BaseDrawer visible={visible} onClose={onClose} header={headerContent}>
      <View style={styles.content}>
        <Text style={[styles.planName, { color: colors.text }]}>{plan.name}</Text>

        <View style={styles.tagRow}>
          <View style={[styles.tag, { backgroundColor: `${styleColor}20` }]}>
            <Text style={[styles.tagText, { color: styleColor }]}>{plan.style}</Text>
          </View>
          <View style={[styles.tag, { backgroundColor: `${accent}15` }]}>
            <Text style={[styles.tagText, { color: accent }]}>{plan.goal}</Text>
          </View>
          <View style={[styles.tag, { backgroundColor: `${accent}15` }]}>
            <Text style={[styles.tagText, { color: accent }]}>{plan.experienceLevel.charAt(0).toUpperCase() + plan.experienceLevel.slice(1)}</Text>
          </View>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>PROGRESS</Text>
            <Text style={[styles.progressWeek, { color: colors.textSecondary }]}>Week {currentWeek} of {plan.planLength}</Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
            <View style={[styles.progressFill, { width: `${progressPct}%`, backgroundColor: accent }]} />
          </View>
        </View>

        {schedule && schedule.weeks.length > 0 && (
          <>
            <View style={styles.phaseTimeline}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>PHASE TIMELINE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.phaseTimelineScroll}>
                {schedule.weeks.map((week, idx) => {
                  const phaseColor = PHASE_COLORS[week.phase as PlanPhase] ?? accent;
                  const isCurrentWeek = week.week_number === currentWeek;
                  const isSelected = idx === selectedWeekIdx;
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.phaseWeekDot,
                        { backgroundColor: `${phaseColor}30`, borderColor: isSelected ? phaseColor : 'transparent' },
                        isCurrentWeek && { borderColor: '#fff', borderWidth: 2 },
                      ]}
                      onPress={() => {
                        setSelectedWeekIdx(idx);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.phaseWeekNum, { color: phaseColor }]}>{week.week_number}</Text>
                      {week.is_deload && <View style={[styles.deloadIndicator, { backgroundColor: '#22c55e' }]} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.weekDetailSection}>
              <View style={styles.weekNav}>
                <TouchableOpacity onPress={handlePrevWeek} disabled={selectedWeekIdx === 0} activeOpacity={0.7}>
                  <ChevronLeft size={20} color={selectedWeekIdx === 0 ? colors.textMuted : colors.text} />
                </TouchableOpacity>
                <View style={styles.weekNavCenter}>
                  <Text style={[styles.weekNavTitle, { color: colors.text }]}>
                    Week {selectedWeek?.week_number ?? selectedWeekIdx + 1}
                  </Text>
                  {selectedWeek && (
                    <View style={[styles.phaseBadge, { backgroundColor: `${PHASE_COLORS[selectedWeek.phase as PlanPhase] ?? accent}20` }]}>
                      <Text style={[styles.phaseBadgeText, { color: PHASE_COLORS[selectedWeek.phase as PlanPhase] ?? accent }]}>
                        {PHASE_DISPLAY_NAMES[selectedWeek.phase as PlanPhase] ?? selectedWeek.phase}
                        {selectedWeek.is_deload ? ' · Deload' : ''}
                      </Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity onPress={handleNextWeek} disabled={!schedule || selectedWeekIdx >= schedule.weeks.length - 1} activeOpacity={0.7}>
                  <ChevronRight size={20} color={!schedule || selectedWeekIdx >= schedule.weeks.length - 1 ? colors.textMuted : colors.text} />
                </TouchableOpacity>
              </View>

              {selectedWeek?.notes ? (
                <View style={[styles.weekNotesRow, { backgroundColor: `${accent}08`, borderColor: `${accent}20` }]}>
                  <TrendingUp size={12} color={accent} />
                  <Text style={[styles.weekNotesText, { color: accent }]}>{selectedWeek.notes}</Text>
                </View>
              ) : null}

              {currentWeekMilestone && (
                <View style={[styles.milestoneRow, { backgroundColor: '#f59e0b15', borderColor: '#f59e0b30' }]}>
                  <Target size={12} color="#f59e0b" />
                  <Text style={[styles.milestoneText, { color: '#f59e0b' }]}>{currentWeekMilestone.label}</Text>
                </View>
              )}

              <View style={styles.dayGrid}>
                {selectedWeek?.days.map((day, dIdx) => {
                  const isToday = day.date === today;
                  const isPast = day.date < today;
                  const isMissed = plan.missedDays?.includes(day.date);
                  const phaseColor = PHASE_COLORS[day.phase as PlanPhase] ?? accent;

                  return (
                    <View
                      key={dIdx}
                      style={[
                        styles.dayCard,
                        {
                          backgroundColor: day.is_rest ? `${colors.cardSecondary}` : `${phaseColor}08`,
                          borderColor: isToday ? accent : colors.border,
                          borderWidth: isToday ? 2 : 1,
                        },
                        isMissed && { opacity: 0.5 },
                      ]}
                    >
                      <View style={styles.dayCardHeader}>
                        <Text style={[styles.dayLabel, { color: isToday ? accent : colors.textSecondary }]}>
                          {DAY_LABELS[dIdx] ?? `D${dIdx + 1}`}
                        </Text>
                        <Text style={[styles.dayDate, { color: colors.textMuted }]}>
                          {formatDateShort(day.date)}
                        </Text>
                      </View>

                      {day.is_rest ? (
                        <View style={styles.restDayContent}>
                          <Moon size={16} color={colors.textMuted} />
                          <Text style={[styles.restLabel, { color: colors.textSecondary }]}>Rest</Text>
                          {day.rest_suggestion ? (
                            <Text style={[styles.restSuggestion, { color: colors.textMuted }]} numberOfLines={2}>
                              {day.rest_suggestion}
                            </Text>
                          ) : null}
                        </View>
                      ) : (
                        <View style={styles.trainingDayContent}>
                          <View style={styles.dayStyleRow}>
                            <Dumbbell size={12} color={phaseColor} />
                            <Text style={[styles.dayStyleText, { color: phaseColor }]} numberOfLines={1}>
                              {day.session_type || day.style}
                            </Text>
                          </View>
                          <View style={styles.dayMetaRow}>
                            <Clock size={10} color={colors.textMuted} />
                            <Text style={[styles.dayMetaText, { color: colors.textMuted }]}>
                              {day.target_duration}min
                            </Text>
                          </View>
                          {day.is_deload_week && (
                            <View style={[styles.deloadTag, { backgroundColor: '#22c55e20' }]}>
                              <Text style={styles.deloadTagText}>Deload</Text>
                            </View>
                          )}
                          {isPast && !day.is_rest && isMissed && (
                            <View style={[styles.missedTag, { backgroundColor: '#ef444420' }]}>
                              <AlertTriangle size={10} color="#ef4444" />
                              <Text style={styles.missedTagText}>Missed</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        )}

        <View style={styles.statsGrid}>
          <View style={[styles.statCell, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
            <View style={styles.statHeader}>
              <Calendar size={12} color={accent} />
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>START</Text>
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{formatDateShort(plan.startDate)}</Text>
          </View>
          <View style={[styles.statCell, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
            <View style={styles.statHeader}>
              <Calendar size={12} color={accent} />
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>END</Text>
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{formatDateFull(plan.endDate)}</Text>
          </View>
          <View style={[styles.statCell, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
            <View style={styles.statHeader}>
              <Dumbbell size={12} color={accent} />
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>DAYS/WEEK</Text>
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{plan.daysPerWeek} days</Text>
          </View>
          <View style={[styles.statCell, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
            <View style={styles.statHeader}>
              <Clock size={12} color={accent} />
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>DURATION</Text>
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{plan.sessionDuration} min</Text>
          </View>
          <View style={[styles.statCell, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
            <View style={styles.statHeader}>
              <Star size={12} color={accent} />
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>LEVEL</Text>
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{plan.experienceLevel.charAt(0).toUpperCase() + plan.experienceLevel.slice(1)}</Text>
          </View>
          <View style={[styles.statCell, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
            <View style={styles.statHeader}>
              <BarChart3 size={12} color={accent} />
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>WEEKS LEFT</Text>
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{weeksLeft} weeks</Text>
          </View>
        </View>

        {schedule && (
          <View style={[styles.scheduleStats, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
            <View style={styles.scheduleStatRow}>
              <Text style={[styles.scheduleStatLabel, { color: colors.textSecondary }]}>Total training days</Text>
              <Text style={[styles.scheduleStatValue, { color: colors.text }]}>{schedule.total_training_days}</Text>
            </View>
            <View style={[styles.scheduleStatRow, { borderTopWidth: 0.5, borderTopColor: colors.border }]}>
              <Text style={[styles.scheduleStatLabel, { color: colors.textSecondary }]}>Total rest days</Text>
              <Text style={[styles.scheduleStatValue, { color: colors.text }]}>{schedule.total_rest_days}</Text>
            </View>
            <View style={[styles.scheduleStatRow, { borderTopWidth: 0.5, borderTopColor: colors.border }]}>
              <Text style={[styles.scheduleStatLabel, { color: colors.textSecondary }]}>Phases</Text>
              <Text style={[styles.scheduleStatValue, { color: colors.text }]}>
                {schedule.phases_used.map(p => PHASE_DISPLAY_NAMES[p as PlanPhase] ?? p).join(', ')}
              </Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.ghostBtn, { borderColor: colors.border }]}
          onPress={handleStartNew}
          activeOpacity={0.7}
        >
          <RefreshCw size={14} color={colors.textSecondary} />
          <Text style={[styles.ghostBtnText, { color: colors.textSecondary }]}>Start New Plan</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.cancelBtn, { borderColor: '#ef444430' }]}
          onPress={handleCancelPlan}
          activeOpacity={0.7}
        >
          <Trash2 size={14} color="#ef4444" />
          <Text style={styles.cancelBtnText}>Cancel Plan</Text>
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </View>
    </BaseDrawer>
  );
}

const styles = StyleSheet.create({
  sheetBg: { borderTopLeftRadius: 28, borderTopRightRadius: 28 },
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
  tag: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5 },
  tagText: { fontSize: 12, fontWeight: '600' as const },
  progressSection: { gap: 8 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { fontSize: 10, fontWeight: '700' as const, letterSpacing: 0.8 },
  progressWeek: { fontSize: 12, fontWeight: '500' as const },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  sectionLabel: { fontSize: 10, fontWeight: '700' as const, letterSpacing: 0.8, marginBottom: 8 },
  phaseTimeline: { gap: 0 },
  phaseTimelineScroll: { gap: 6, paddingRight: 16 },
  phaseWeekDot: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  phaseWeekNum: { fontSize: 12, fontWeight: '700' as const },
  deloadIndicator: {
    position: 'absolute', bottom: -2, width: 8, height: 3, borderRadius: 2,
  },
  weekDetailSection: { gap: 12 },
  weekNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  weekNavCenter: { alignItems: 'center', gap: 4 },
  weekNavTitle: { fontSize: 18, fontWeight: '800' as const },
  phaseBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  phaseBadgeText: { fontSize: 11, fontWeight: '600' as const },
  weekNotesRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8,
  },
  weekNotesText: { fontSize: 12, fontWeight: '500' as const, flex: 1 },
  milestoneRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8,
  },
  milestoneText: { fontSize: 12, fontWeight: '600' as const, flex: 1 },
  dayGrid: { gap: 6 },
  dayCard: {
    borderRadius: 12, padding: 12, gap: 6,
  },
  dayCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  dayLabel: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.5 },
  dayDate: { fontSize: 10 },
  restDayContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  restLabel: { fontSize: 13, fontWeight: '600' as const },
  restSuggestion: { fontSize: 11, flex: 1 },
  trainingDayContent: { gap: 4 },
  dayStyleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dayStyleText: { fontSize: 13, fontWeight: '600' as const },
  dayMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dayMetaText: { fontSize: 11 },
  deloadTag: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  deloadTagText: { fontSize: 10, fontWeight: '600' as const, color: '#22c55e' },
  missedTag: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  missedTagText: { fontSize: 10, fontWeight: '600' as const, color: '#ef4444' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCell: {
    width: '47%' as any, borderRadius: 12, borderWidth: 1,
    padding: 14, gap: 6,
  },
  statHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statLabel: { fontSize: 9, fontWeight: '700' as const, letterSpacing: 0.6 },
  statValue: { fontSize: 16, fontWeight: '700' as const },
  scheduleStats: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  scheduleStatRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  scheduleStatLabel: { fontSize: 12, fontWeight: '500' as const },
  scheduleStatValue: { fontSize: 14, fontWeight: '600' as const, maxWidth: '60%' as any, textAlign: 'right' as const },
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
});
