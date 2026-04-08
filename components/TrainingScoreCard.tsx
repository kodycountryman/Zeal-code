import React, { memo, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme, useAppContext } from '@/context/AppContext';
import { useWorkoutTracking } from '@/context/WorkoutTrackingContext';
import GlassCard from '@/components/GlassCard';
import MetricSlot from '@/components/MetricSlot';
import MetricPickerSheet from '@/components/MetricPickerSheet';
import MetricDetailSheet from '@/components/MetricDetailSheet';
import { SWIFT_SPRING } from '@/constants/animation';
import { useMetricSlots } from '@/hooks/useMetricSlots';
import {
  resolveMetricValue,
  getMetricDef,
  type MetricSlotKey,
  type MetricSlotInput,
} from '@/constants/metricSlots';

interface LastWorkout {
  split: string;
  duration: number;
}

interface Props {
  score: number;
  tier: string;
  readiness: number;
  targetDone?: number;
  targetTotal?: number;
  calories?: number | null;
  steps?: number | null;
  heartRate?: number | null;
  weeklyHoursMin?: number;
  lastWorkout?: LastWorkout | null;
  onPress: () => void;
  variant?: 'solid' | 'glass';
}


function TrainingScoreCard({
  score,
  tier,
  readiness,
  targetDone = 0,
  targetTotal = 12,
  calories = null,
  steps = null,
  heartRate = null,
  weeklyHoursMin = 0,
  lastWorkout = null,
  onPress,
  variant = 'solid',
}: Props) {
  const { colors, accent, isDark } = useZealTheme();
  const progressPercent = Math.min((score / 100) * 100, 100);

  const ctx = useAppContext();
  const tracking = useWorkoutTracking();
  const { slots, updateSlot } = useMetricSlots();
  const [pickerSlotIndex, setPickerSlotIndex] = useState<number | null>(null);
  const [detailSlotIndex, setDetailSlotIndex] = useState<number | null>(null);

  const [displayScore, setDisplayScore] = useState<number>(score);
  const prevScoreRef = useRef<number>(score);
  const animRef = useRef<number | null>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const prev = prevScoreRef.current;
    prevScoreRef.current = score;
    if (prev === score) return;

    const diff = score - prev;
    const steps = Math.min(Math.abs(diff), 30);
    const stepDuration = Math.max(20, Math.floor(600 / steps));
    let step = 0;

    if (animRef.current) cancelAnimationFrame(animRef.current);

    const tick = () => {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(prev + diff * eased));
      if (step < steps) {
        setTimeout(() => { animRef.current = requestAnimationFrame(tick); }, stepDuration);
      } else {
        setDisplayScore(score);
        Animated.sequence([
          Animated.spring(scaleAnim, { toValue: 1.08, ...SWIFT_SPRING }),
          Animated.spring(scaleAnim, { toValue: 1, ...SWIFT_SPRING }),
        ]).start();
      }
    };
    animRef.current = requestAnimationFrame(tick);

    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [score, scaleAnim]);

  const cardShadow = !isDark ? {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  } : {};

  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const dividerColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const verticalDivider = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.09)';
  const mutedColor = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)';

  const targetCapped = Math.min(targetDone, targetTotal);

  // Build the data bag for the value resolver
  const slotInput = useMemo<MetricSlotInput>(() => {
    const history = tracking.workoutHistory;

    // Longest ever consecutive-day streak
    const allDays = [...new Set(history.map((l) => l.date))].sort();
    let longestStreakDays = allDays.length > 0 ? 1 : 0;
    let curRun = allDays.length > 0 ? 1 : 0;
    for (let i = 1; i < allDays.length; i++) {
      const prev = new Date(allDays[i - 1]);
      const curr = new Date(allDays[i]);
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
      if (diffDays === 1) {
        curRun++;
        longestStreakDays = Math.max(longestStreakDays, curRun);
      } else if (diffDays > 1) {
        curRun = 1;
      }
    }

    // Unique exercise names logged this calendar week
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const thisWeekFullLogs = history.filter((l) => new Date(l.date) >= weekStart);
    const uniqueNames = new Set<string>();
    for (const log of thisWeekFullLogs) {
      if ((log as any).exercises) {
        for (const ex of (log as any).exercises as Array<{ exerciseName: string }>) {
          if (ex.exerciseName) uniqueNames.add(ex.exerciseName);
        }
      }
    }
    const exercisesThisWeekCount = uniqueNames.size;

    // Consistency % — sessions completed vs (targetTotal × 4) in last 28 days
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const sessionsLast4Wks = history.filter((l) => new Date(l.date) >= fourWeeksAgo).length;
    const consistencyPct = targetTotal > 0
      ? Math.min(100, Math.round((sessionsLast4Wks / (targetTotal * 4)) * 100))
      : 0;

    return {
      workoutHistory: history,
      weeklyHoursMin,
      streak: ctx.streak,
      targetDone,
      targetTotal,
      calories: calories ?? null,
      steps: steps ?? null,
      heartRate: heartRate ?? null,
      healthConnected: ctx.healthConnected,
      longestStreakDays,
      exercisesThisWeekCount,
      consistencyPct,
      bodyWeight: ctx.weight ?? null,
    };
  }, [tracking.workoutHistory, weeklyHoursMin, ctx.streak, ctx.healthConnected,
      ctx.weight, targetDone, targetTotal, calories, steps, heartRate]);

  const handleSlotPress = useCallback((index: number) => {
    const key = slots[index];
    if (key === null) {
      setPickerSlotIndex(index);
    } else {
      setDetailSlotIndex(index);
    }
  }, [slots]);

  const handleSlotLongPress = useCallback((index: number) => {
    setPickerSlotIndex(index);
  }, []);

  const handleCardPress = useCallback(() => {
    requestAnimationFrame(() => onPress());
  }, [onPress]);

  return (
    <>
      <GlassCard
        style={[styles.card, { borderWidth: 1, borderColor: cardBorder }, cardShadow]}
        onPress={handleCardPress}
        testID="training-score-card"
        variant={variant}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.label, { color: colors.text }]}>
            Training Score
          </Text>
          <PlatformIcon name="chevron-right" size={16} color={colors.textSecondary} />
        </View>

        <View style={styles.scoreRow}>
          {score === 0 ? (
            <Text style={[styles.scoreNumber, { color: colors.textSecondary, letterSpacing: -1 }]}>—</Text>
          ) : (
            <Animated.Text style={[styles.scoreNumber, { color: colors.score, transform: [{ scale: scaleAnim }] }]}>{displayScore}</Animated.Text>
          )}
          <Text style={[styles.tierLabel, { color: mutedColor }]}>{tier}</Text>
        </View>

        <View style={[styles.progressTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]}>
          {score > 0 && (
            <View
              style={[
                styles.progressFill,
                { width: `${progressPercent}%` as any, backgroundColor: colors.score },
              ]}
            />
          )}
        </View>

        <View style={styles.readinessRow}>
          <View style={styles.readinessLeft}>
            <PlatformIcon name="zap" size={11} color={colors.readiness} fill={colors.readiness} />
            <Text style={[styles.readinessLabel, { color: colors.textSecondary }]}>
              Readiness{' '}
            </Text>
            <Text style={[styles.readinessValue, { color: colors.readiness }]}>
              {readiness}%
            </Text>
          </View>
          <View style={styles.targetRight}>
            <PlatformIcon name="target" size={11} color={colors.textSecondary} />
            <Text style={[styles.readinessLabel, { color: colors.textSecondary }]}>
              {' '}Target{' '}
            </Text>
            <Text style={[styles.targetValue, { color: colors.text }]}>
              {targetCapped}
              <Text style={[styles.targetTotal, { color: colors.textSecondary }]}>/{targetTotal}</Text>
            </Text>
          </View>
        </View>

        <View style={[styles.metricsDivider, { backgroundColor: dividerColor }]} />

        {/* 4 customisable metric slots */}
        <View style={styles.metricsRow}>
          {slots.map((key, i) => {
            const def = key ? (getMetricDef(key) ?? null) : null;
            const resolved = key ? resolveMetricValue(key, slotInput) : null;
            return (
              <React.Fragment key={i}>
                {i > 0 && (
                  <View style={[styles.verticalDivider, { backgroundColor: verticalDivider }]} />
                )}
                <MetricSlot
                  slotIndex={i}
                  def={def}
                  resolved={resolved}
                  onPress={handleSlotPress}
                  onLongPress={handleSlotLongPress}
                  isDark={isDark}
                  textColor={colors.text}
                  mutedColor={mutedColor}
                  borderColor={isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)'}
                  accent={accent}
                />
              </React.Fragment>
            );
          })}
        </View>
      </GlassCard>

      <MetricPickerSheet
        visible={pickerSlotIndex !== null}
        slotIndex={pickerSlotIndex}
        currentKey={pickerSlotIndex !== null ? (slots[pickerSlotIndex] ?? null) : null}
        onSelect={updateSlot}
        onClose={() => setPickerSlotIndex(null)}
      />

      <MetricDetailSheet
        visible={detailSlotIndex !== null}
        slotIndex={detailSlotIndex}
        metricKey={detailSlotIndex !== null ? (slots[detailSlotIndex] ?? null) : null}
        slotInput={slotInput}
        onClose={() => setDetailSlotIndex(null)}
        onChangeMetric={(idx) => {
          setDetailSlotIndex(null);
          setPickerSlotIndex(idx);
        }}
      />
    </>
  );
}

export default memo(TrainingScoreCard);

const styles = StyleSheet.create({
  card: {
    borderRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    gap: 10,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: -0.2,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: -6,
  },
  tierLabel: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
    letterSpacing: 0,
  },
  emptyScoreState: {
    gap: 6,
  },
  emptyHint: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
    lineHeight: 17,
    letterSpacing: 0.1,
  },
  scoreNumber: {
    fontSize: 44,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -2,
    lineHeight: 48,
  },
  progressTrack: {
    height: 7,
    borderRadius: 3.5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3.5,
    minWidth: 8,
  },
  readinessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  readinessLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  targetRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  readinessLabel: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
    letterSpacing: 0.1,
  },
  readinessValue: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0,
  },
  targetValue: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0,
  },
  targetTotal: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
    letterSpacing: 0,
  },
  lastWorkoutLine: {
    fontSize: 11,
    fontFamily: 'Outfit_400Regular',
    letterSpacing: 0.1,
    marginTop: -4,
  },
  metricsDivider: {
    height: 1,
    marginHorizontal: -20,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verticalDivider: {
    width: 1,
    height: 34,
  },
  // reserved for Steps 3 & 4 modal styles
  modalSectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  modalBody: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  modalDivider: {
    height: 1,
    marginHorizontal: 20,
  },
  modalTipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 10,
  },
  modalTip: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '400',
  },
});
