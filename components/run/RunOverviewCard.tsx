import React, { memo, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
import Chip from '@/components/Chip';
import { useRouter } from 'expo-router';
import { formatPace } from '@/services/runTrackingService';
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
  const { colors, isDark } = useZealTheme();
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

  const isRunPrescription = todayPrescription?.activity_type === 'run' && !todayPrescription.is_rest;

  const handleStartRun = () => {
    if (onPress) {
      onPress();
      return;
    }
    router.push('/train?mode=run');
  };

  // Nothing planned today — render nothing. Completed runs intentionally do
  // not surface here; run history lives in the calendar and the Run tab.
  if (!isRunPrescription) {
    return null;
  }

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
            {paceText && <Chip variant="neutral" icon="zap" label={paceText} />}
            {todayPrescription?.run_type && !todayPrescription.run_description && (
              <Chip variant="neutral" label={todayPrescription.run_type.replace(/_/g, ' ')} />
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
});
