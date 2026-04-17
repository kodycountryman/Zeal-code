import React, { memo, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme } from '@/context/AppContext';
import { useRun } from '@/context/RunContext';
import GlassCard from '@/components/GlassCard';
import { useRouter } from 'expo-router';
import { formatPace, paceToSecondsPerMile, paceToSecondsPerKm } from '@/services/runTrackingService';
import { METERS_PER_MILE, METERS_PER_KM, RunUnits } from '@/types/run';
import type { DayPrescription } from '@/services/planEngine';

interface Props {
  /** Today's run prescription (when on a hybrid/run plan) */
  todayPrescription?: DayPrescription | null;
  variant?: 'solid' | 'glass';
  onPress?: () => void;
}

const RUN_BLUE = '#3b82f6';

function formatDistance(meters: number, units: RunUnits): string {
  if (units === 'metric') return `${(meters / METERS_PER_KM).toFixed(2)} km`;
  return `${(meters / METERS_PER_MILE).toFixed(2)} mi`;
}

function formatRelativeDay(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const diffDays = Math.round((today.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) {
    return date.toLocaleDateString(undefined, { weekday: 'long' }).toLowerCase();
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatPaceLabel(secPerMeter: number, units: RunUnits): string {
  const secPerUnit = units === 'metric'
    ? paceToSecondsPerKm(secPerMeter)
    : paceToSecondsPerMile(secPerMeter);
  const suffix = units === 'metric' ? '/km' : '/mi';
  return `${formatPace(secPerUnit)}${suffix}`;
}

function buildPrescriptionDescription(p: DayPrescription, units: RunUnits): string {
  if (p.is_rest) return 'Rest day';
  if (p.run_description) return p.run_description;
  const parts: string[] = [];
  if (p.target_distance_miles) {
    const meters = p.target_distance_miles * METERS_PER_MILE;
    parts.push(formatDistance(meters, units));
  }
  if (p.run_type) {
    const pretty = p.run_type.replace(/_/g, ' ');
    parts.push(pretty);
  }
  return parts.join(' • ') || 'Today\'s run';
}

function RunOverviewCard({ todayPrescription, variant = 'solid', onPress }: Props) {
  const { colors, accent, isDark } = useZealTheme();
  const router = useRouter();
  const run = useRun();

  // Pulse animation matching WorkoutOverviewCard's signature dot
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(1);
  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.6, { duration: 600, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 600, easing: Easing.in(Easing.ease) }),
      ),
      -1,
      false,
    );
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: 600, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 600, easing: Easing.in(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [pulseScale, pulseOpacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const cardShadow = !isDark
    ? {
        shadowColor: RUN_BLUE,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.14,
        shadowRadius: 16,
        elevation: 6,
      }
    : {
        shadowColor: RUN_BLUE,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 3,
      };

  // Today's date in YYYY-MM-DD
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const ranToday = useMemo(
    () => run.runHistory.some(r => r.date === todayStr),
    [run.runHistory, todayStr],
  );

  // Weekly mileage progress (against goal if set)
  const weeklyMeters = run.stats.weeklyDistanceMeters;
  const weeklyGoalMeters = run.preferences.weeklyMileageGoalMeters;
  const weeklyProgressPct = weeklyGoalMeters && weeklyGoalMeters > 0
    ? Math.min(1, weeklyMeters / weeklyGoalMeters)
    : 0;

  const lastRun = run.runHistory[0] ?? null;
  const isRunPrescription = todayPrescription?.activity_type === 'run' && !todayPrescription.is_rest;

  const handleStartRun = () => {
    if (onPress) {
      onPress();
      return;
    }
    router.push('/run');
  };

  // ── Empty state — no history, no plan ─────────────────────────────────
  if (!isRunPrescription && !lastRun) {
    return null;
  }

  // ── Today's prescription state (planned run) ──────────────────────────
  if (isRunPrescription) {
    const description = buildPrescriptionDescription(todayPrescription!, run.preferences.units);
    const paceText = todayPrescription?.target_pace_min_sec_per_mile && todayPrescription?.target_pace_max_sec_per_mile
      ? (() => {
          const mid = (todayPrescription.target_pace_min_sec_per_mile + todayPrescription.target_pace_max_sec_per_mile) / 2;
          // mid is sec/mile — convert to chosen unit
          if (run.preferences.units === 'metric') {
            return `${formatPace(mid * (METERS_PER_MILE / METERS_PER_KM))}/km`;
          }
          return `${formatPace(mid)}/mi`;
        })()
      : null;

    return (
      <GlassCard
        onPress={handleStartRun}
        activeOpacity={0.78}
        variant={variant}
        style={[styles.card, { borderColor: cardBorder }, cardShadow]}
        testID="run-overview-card"
      >
        <View style={styles.inner}>
          <View style={styles.labelRow}>
            <View style={styles.labelLeft}>
              <Animated.View style={[styles.pulseDot, { backgroundColor: RUN_BLUE }, pulseStyle]} />
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {ranToday ? "Today's Run · Done" : "Today's Run"}
              </Text>
            </View>
            <PlatformIcon name="chevron-right" size={16} color="rgba(255,255,255,0.28)" />
          </View>

          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
            {description}
          </Text>

          <View style={styles.metaRow}>
            {paceText && (
              <View style={[styles.chip, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }]}>
                <PlatformIcon name="zap" size={11} color={colors.textSecondary} />
                <Text style={[styles.chipText, { color: colors.textSecondary }]}>{paceText}</Text>
              </View>
            )}
            {todayPrescription?.run_type && !todayPrescription.run_description && (
              <View style={[styles.chip, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }]}>
                <Text style={[styles.chipText, { color: colors.textSecondary }]}>
                  {todayPrescription.run_type.replace(/_/g, ' ')}
                </Text>
              </View>
            )}
          </View>

          {weeklyGoalMeters && weeklyGoalMeters > 0 && (
            <View style={styles.weeklyRow}>
              <View style={[styles.weeklyTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
                <View style={[styles.weeklyFill, { width: `${weeklyProgressPct * 100}%`, backgroundColor: RUN_BLUE }]} />
              </View>
              <Text style={[styles.weeklyText, { color: colors.textMuted }]}>
                {formatDistance(weeklyMeters, run.preferences.units)} / {formatDistance(weeklyGoalMeters, run.preferences.units)} this week
              </Text>
            </View>
          )}
        </View>
      </GlassCard>
    );
  }

  // ── Last-run summary state (no plan, has history) ─────────────────────
  if (lastRun) {
    const distStr = formatDistance(lastRun.distanceMeters, run.preferences.units);
    const paceStr = lastRun.averagePaceSecondsPerMeter > 0
      ? formatPaceLabel(lastRun.averagePaceSecondsPerMeter, run.preferences.units)
      : '—';
    const dayLabel = formatRelativeDay(lastRun.date);

    return (
      <GlassCard
        onPress={handleStartRun}
        activeOpacity={0.78}
        variant={variant}
        style={[styles.card, { borderColor: cardBorder }, cardShadow]}
        testID="run-overview-card"
      >
        <View style={styles.inner}>
          <View style={styles.labelRow}>
            <View style={styles.labelLeft}>
              <Animated.View style={[styles.pulseDot, { backgroundColor: RUN_BLUE }, pulseStyle]} />
              <Text style={[styles.label, { color: colors.textSecondary }]}>Last Run · {dayLabel}</Text>
            </View>
            <PlatformIcon name="chevron-right" size={16} color="rgba(255,255,255,0.28)" />
          </View>

          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.text }]}>{distStr.split(' ')[0]}</Text>
              <Text style={[styles.statUnit, { color: colors.textMuted }]}>{distStr.split(' ')[1] ?? ''}</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.text }]}>{paceStr.split('/')[0]}</Text>
              <Text style={[styles.statUnit, { color: colors.textMuted }]}>/{paceStr.split('/')[1] ?? ''}</Text>
            </View>
            {run.stats.weeklyDistanceMeters > 0 && (
              <>
                <View style={[styles.statDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {formatDistance(run.stats.weeklyDistanceMeters, run.preferences.units).split(' ')[0]}
                  </Text>
                  <Text style={[styles.statUnit, { color: colors.textMuted }]}>this wk</Text>
                </View>
              </>
            )}
          </View>

          <TouchableOpacity
            onPress={handleStartRun}
            activeOpacity={0.8}
            style={[styles.startBtn, { backgroundColor: RUN_BLUE }]}
            accessibilityRole="button"
            accessibilityLabel="Start a run"
            accessibilityHint="Opens the run tracking screen"
          >
            <PlatformIcon name="play" size={12} color="#fff" />
            <Text style={styles.startBtnText}>Start Run</Text>
          </TouchableOpacity>
        </View>
      </GlassCard>
    );
  }

  return null;
}

export default memo(RunOverviewCard);

const styles = StyleSheet.create({
  card: {
    borderRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  inner: {
    gap: 12,
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
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.5,
    lineHeight: 28,
    marginTop: -2,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  chipText: {
    fontSize: 12,
    fontFamily: 'Outfit_300Light',
  },
  weeklyRow: {
    gap: 5,
    marginTop: 2,
  },
  weeklyTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  weeklyFill: {
    height: '100%',
    borderRadius: 2,
  },
  weeklyText: {
    fontSize: 11,
    fontFamily: 'Outfit_400Regular',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stat: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 3,
  },
  statValue: {
    fontSize: 22,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.5,
  },
  statUnit: {
    fontSize: 11,
    fontFamily: 'Outfit_400Regular',
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 22,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginTop: 4,
  },
  startBtnText: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
    color: '#fff',
    letterSpacing: 0.2,
  },
});
