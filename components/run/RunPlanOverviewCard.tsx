import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PlatformIcon } from '@/components/PlatformIcon';
import GlassCard from '@/components/GlassCard';
import Chip from '@/components/Chip';
import { useZealTheme, type WorkoutPlan } from '@/context/AppContext';
import { formatPace } from '@/services/runTrackingService';
import type { DayPrescription } from '@/services/planEngine';
import type { RunLog, RunUnits } from '@/types/run';
import { METERS_PER_KM, METERS_PER_MILE } from '@/types/run';

const RUN_BLUE = '#3b82f6';

interface Props {
  todayPrescription?: DayPrescription | null;
  activePlan?: WorkoutPlan | null;
  completedRun?: RunLog | null;
  units: RunUnits;
  variant?: 'solid' | 'glass';
  onPress?: () => void;
  onOpenActivePlan?: () => void;
}

function toTitle(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatRunTypeTitle(value: string | null | undefined): string | null {
  if (!value) return null;
  const title = toTitle(value);
  if (/run$/i.test(title)) return title;
  if (/^interval$/i.test(title)) return 'Intervals';
  return `${title} Run`;
}

function formatRestDayTitle(day: DayPrescription | null | undefined): string {
  const suggestion = day?.rest_suggestion
    ?.replace(/\s*[-–—]\s*\d+\s*(?:min|mins|minutes)\b\.?/gi, '')
    ?.replace(/\b\d+\s*(?:min|mins|minutes)\b\s*/gi, '')
    ?.trim();
  if (!suggestion) return 'Rest Day';
  if (/^rest\b/i.test(suggestion)) return suggestion;
  return `Rest Day - ${toTitle(suggestion)}`;
}

function formatDistanceFromMiles(miles: number | undefined, units: RunUnits): string | null {
  if (!miles || miles <= 0) return null;
  if (units === 'metric') return `${((miles * METERS_PER_MILE) / METERS_PER_KM).toFixed(1)} km`;
  return `${miles.toFixed(miles >= 10 ? 0 : 1)} mi`;
}

function formatDistanceFromMeters(meters: number, units: RunUnits): string {
  if (units === 'metric') return `${(meters / METERS_PER_KM).toFixed(2)} km`;
  return `${(meters / METERS_PER_MILE).toFixed(2)} mi`;
}

function formatPlanPace(day: DayPrescription | null | undefined, units: RunUnits): string | null {
  if (!day?.target_pace_min_sec_per_mile || !day.target_pace_max_sec_per_mile) return null;
  const mid = (day.target_pace_min_sec_per_mile + day.target_pace_max_sec_per_mile) / 2;
  if (units === 'metric') {
    return `${formatPace(mid * (METERS_PER_KM / METERS_PER_MILE))}/km`;
  }
  return `${formatPace(mid)}/mi`;
}

function RunPlanOverviewCard({
  todayPrescription,
  activePlan,
  completedRun,
  units,
  variant = 'solid',
  onPress,
  onOpenActivePlan,
}: Props) {
  const { colors, isDark } = useZealTheme();
  const cardBorder = completedRun
    ? (isDark ? 'rgba(59,130,246,0.28)' : 'rgba(59,130,246,0.18)')
    : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)');
  const rowPressBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const isRunDay = todayPrescription?.activity_type === 'run' && !todayPrescription.is_rest;
  const isRestDay = todayPrescription?.is_rest || todayPrescription?.activity_type === 'rest';

  const cardShadow = !isDark
    ? {
        shadowColor: RUN_BLUE,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 14,
        elevation: 5,
      }
    : {
        shadowColor: RUN_BLUE,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 3,
      };

  if (completedRun) {
    const distance = formatDistanceFromMeters(completedRun.distanceMeters, units);
    const pace = completedRun.averagePaceSecondsPerMeter > 0
      ? units === 'metric'
        ? `${formatPace(completedRun.averagePaceSecondsPerMeter * METERS_PER_KM)}/km`
        : `${formatPace(completedRun.averagePaceSecondsPerMeter * METERS_PER_MILE)}/mi`
      : null;
    return (
      <GlassCard variant={variant} style={[styles.card, styles.compactCard, { borderColor: cardBorder }, cardShadow]} testID="run-plan-overview-card">
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={1}
          onPressIn={(e) => (e.target as any)?.setNativeProps?.({ style: { backgroundColor: rowPressBg } })}
          onPressOut={(e) => (e.target as any)?.setNativeProps?.({ style: { backgroundColor: 'transparent' } })}
          style={styles.completedRow}
        >
          <View style={[styles.pulseDot, { backgroundColor: RUN_BLUE }]} />
          <Text style={[styles.completedLabel, { color: colors.textSecondary }]}>Completed Today —</Text>
          <Text style={[styles.completedTitle, { color: colors.text }]} numberOfLines={1}>{distance}</Text>
          {pace ? <Text style={[styles.completedPace, { color: RUN_BLUE }]}>{pace}</Text> : null}
          <PlatformIcon name="chevron-right" size={12} color={colors.textMuted} strokeWidth={1.8} />
        </TouchableOpacity>
      </GlassCard>
    );
  }

  const title = isRunDay
    ? (formatRunTypeTitle(todayPrescription?.run_type) || todayPrescription?.session_type || "Today's Run")
    : isRestDay
    ? formatRestDayTitle(todayPrescription)
    : activePlan?.name || 'Run Plan Active';
  const distance = formatDistanceFromMiles(todayPrescription?.target_distance_miles, units);
  const pace = formatPlanPace(todayPrescription, units);
  const runType = todayPrescription?.run_type ? toTitle(todayPrescription.run_type) : null;
  const duration = todayPrescription?.target_duration ? `${todayPrescription.target_duration} min` : null;

  return (
    <GlassCard
      onPress={onPress}
      activeOpacity={onPress ? 0.78 : 1}
      variant={variant}
      style={[styles.card, { borderColor: cardBorder }, cardShadow]}
      testID="run-plan-overview-card"
    >
      <View style={styles.inner}>
        <View style={styles.labelRow}>
          <View style={styles.labelLeft}>
            <View style={[styles.pulseDot, { backgroundColor: RUN_BLUE }]} />
            <Text style={[styles.label, { color: colors.textSecondary }]}>Run Plan</Text>
          </View>
          <PlatformIcon name="chevron-right" size={13} color={colors.textMuted} strokeWidth={1.8} />
        </View>

        <Text
          style={[styles.title, isRestDay && styles.restTitle, { color: isRestDay ? colors.textSecondary : colors.text }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {title}
        </Text>

        {(isRunDay || isRestDay) ? (
          <View style={styles.metaRow}>
            {isRunDay && duration ? <Chip variant="neutral" icon="clock" label={duration} /> : null}
            {distance ? <Chip variant="neutral" icon="compass" label={distance} /> : null}
            {pace ? <Chip variant="neutral" icon="zap" label={pace} /> : null}
            {runType ? <Chip variant="neutral" label={runType} /> : null}
          </View>
        ) : null}
      </View>
    </GlassCard>
  );
}

export default memo(RunPlanOverviewCard);

const styles = StyleSheet.create({
  card: {
    borderRadius: 26,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
  },
  compactCard: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  inner: {
    gap: 10,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  labelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
    letterSpacing: 0,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  restTitle: {
    fontSize: 19,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0,
    lineHeight: 25,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
  },
  completedLabel: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
  },
  completedTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 15,
    flex: 1,
  },
  completedPace: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 13,
  },
});
