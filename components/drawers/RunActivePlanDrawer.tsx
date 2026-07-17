import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BaseDrawer from '@/components/drawers/BaseDrawer';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useAppContext, useZealTheme } from '@/context/AppContext';
import { useRun } from '@/context/RunContext';
import type { DayPrescription } from '@/services/planEngine';
import { PHASE_DISPLAY_NAMES } from '@/services/planConstants';
import type { PlanPhase } from '@/services/planConstants';
import { formatPace } from '@/services/runTrackingService';
import { METERS_PER_KM, METERS_PER_MILE } from '@/types/run';

const RUN_BLUE = '#3b82f6';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelectDay: (day: DayPrescription) => void;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toTitle(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatDistance(miles: number | undefined, units: 'imperial' | 'metric'): string | null {
  if (!miles || miles <= 0) return null;
  if (units === 'metric') return `${((miles * METERS_PER_MILE) / METERS_PER_KM).toFixed(1)} km`;
  return `${miles.toFixed(miles >= 10 ? 0 : 1)} mi`;
}

function formatPaceRange(day: DayPrescription, units: 'imperial' | 'metric'): string | null {
  if (!day.target_pace_min_sec_per_mile || !day.target_pace_max_sec_per_mile) return null;
  if (units === 'metric') {
    const min = day.target_pace_min_sec_per_mile * (METERS_PER_KM / METERS_PER_MILE);
    const max = day.target_pace_max_sec_per_mile * (METERS_PER_KM / METERS_PER_MILE);
    return `${formatPace(min)}-${formatPace(max)}/km`;
  }
  return `${formatPace(day.target_pace_min_sec_per_mile)}-${formatPace(day.target_pace_max_sec_per_mile)}/mi`;
}

export default function RunActivePlanDrawer({ visible, onClose, onSelectDay }: Props) {
  const { colors, isDark } = useZealTheme();
  const ctx = useAppContext();
  const run = useRun();
  const plan = ctx.activeRunPlan;
  const schedule = ctx.runPlanSchedule;
  const today = useMemo(() => todayStr(), []);

  const runDays = useMemo(
    () => (schedule?.weeks ?? []).flatMap(week => week.days).filter(day => day.activity_type === 'run' && !day.is_rest),
    [schedule],
  );

  const completedRunDates = useMemo(() => new Set(run.runHistory.map(log => log.date)), [run.runHistory]);
  const completedPlanRunCount = runDays.filter(day => completedRunDates.has(day.date)).length;
  const nextRun = runDays.find(day => day.date >= today && !completedRunDates.has(day.date)) ?? runDays[0] ?? null;

  const header = (
    <View style={styles.header}>
      <View style={styles.headerTitleWrap}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Run Plan</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
          {plan?.name ?? 'Active running schedule'}
        </Text>
      </View>
      <TouchableOpacity onPress={onClose} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <PlatformIcon name="x" size={16} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );

  if (!plan || !schedule) {
    return (
      <BaseDrawer visible={visible} onClose={onClose} header={header} stackBehavior="push">
        <View style={styles.content}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No active run plan found.</Text>
        </View>
      </BaseDrawer>
    );
  }

  return (
    <BaseDrawer visible={visible} onClose={onClose} header={header} stackBehavior="push">
      <View style={styles.content}>
        <View style={[styles.summaryCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
          <View style={styles.summaryMetric}>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{completedPlanRunCount}/{runDays.length}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>runs done</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryMetric}>
            <Text style={[styles.summaryValue, { color: RUN_BLUE }]}>
              {nextRun ? formatDistance(nextRun.target_distance_miles, run.preferences.units) ?? '--' : '--'}
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>next run</Text>
          </View>
        </View>

        {schedule.weeks.map((week) => {
          const phaseLabel = PHASE_DISPLAY_NAMES[week.phase as PlanPhase] ?? week.phase;
          return (
            <View key={week.week_number} style={styles.weekBlock}>
              <View style={styles.weekHeader}>
                <Text style={[styles.weekTitle, { color: colors.text }]}>Week {week.week_number}</Text>
                <Text style={[styles.weekPhase, { color: colors.textMuted }]}>{phaseLabel}</Text>
              </View>

              {week.days.map((day) => {
                const isRun = day.activity_type === 'run' && !day.is_rest;
                const isToday = day.date === today;
                const isComplete = completedRunDates.has(day.date);
                const distance = formatDistance(day.target_distance_miles, run.preferences.units);
                const pace = formatPaceRange(day, run.preferences.units);
                return (
                  <TouchableOpacity
                    key={`${week.week_number}-${day.date}`}
                    onPress={() => isRun ? onSelectDay(day) : undefined}
                    activeOpacity={isRun ? 0.75 : 1}
                    style={[
                      styles.dayRow,
                      {
                        borderColor: isToday ? `${RUN_BLUE}70` : colors.border,
                        backgroundColor: isToday
                          ? `${RUN_BLUE}14`
                          : isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.02)',
                        opacity: isRun ? 1 : 0.58,
                      },
                    ]}
                  >
                    <View style={[styles.dayIcon, { backgroundColor: isRun ? `${RUN_BLUE}1f` : colors.cardSecondary }]}>
                      <PlatformIcon
                        name={isComplete ? 'check' : isRun ? 'person-standing' : 'moon'}
                        size={14}
                        color={isComplete ? '#22c55e' : isRun ? RUN_BLUE : colors.textMuted}
                      />
                    </View>
                    <View style={styles.dayCopy}>
                      <Text style={[styles.dayTitle, { color: colors.text }]} numberOfLines={1}>
                        {isRun
                          ? day.run_description || `${toTitle(day.run_type ?? 'easy')} Run`
                          : day.rest_suggestion || 'Rest Day'}
                      </Text>
                      <Text style={[styles.daySubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                        {[formatDateLabel(day.date), distance, pace].filter(Boolean).join(' • ')}
                      </Text>
                    </View>
                    {isRun ? <PlatformIcon name="chevron-right" size={14} color={colors.textMuted} /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}

        <View style={{ height: 20 }} />
      </View>
    </BaseDrawer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 12,
  },
  headerTitleWrap: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
  },
  content: {
    paddingHorizontal: 20,
    gap: 14,
    paddingBottom: 8,
  },
  summaryCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryMetric: {
    flex: 1,
    gap: 2,
  },
  summaryValue: {
    fontSize: 24,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.3,
  },
  summaryLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
  },
  summaryDivider: {
    width: 1,
    height: 40,
    marginHorizontal: 14,
  },
  weekBlock: {
    gap: 8,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  weekTitle: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
  },
  weekPhase: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
  },
  dayRow: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dayIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCopy: {
    flex: 1,
    gap: 3,
  },
  dayTitle: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
  },
  daySubtitle: {
    fontSize: 11,
    fontFamily: 'Outfit_400Regular',
  },
  emptyText: {
    fontSize: 13,
    fontFamily: 'Outfit_400Regular',
    textAlign: 'center',
    paddingVertical: 28,
  },
});
