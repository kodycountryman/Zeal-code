import React, { memo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
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
import type { WorkoutPlan } from '@/context/AppContext';
import type { WorkoutLog } from '@/context/WorkoutTrackingContext';
import { WORKOUT_STYLE_COLORS } from '@/constants/colors';
import GlassCard from '@/components/GlassCard';

const DYNAMIC_LABELS = [
  "Today's Focus",
  "On Deck",
  "Next Up",
  "Today's Session",
  "Scheduled for Today",
  "Recommended Session",
  "Built for Today",
  "For Today",
];

function getDynamicLabel(): string {
  const today = new Date();
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
  );
  return DYNAMIC_LABELS[dayOfYear % DYNAMIC_LABELS.length];
}

interface Props {
  title: string;
  style: string;
  duration: string;
  muscleGroups?: string;
  exerciseCount?: number;
  onPress?: () => void;
  activePlan?: WorkoutPlan | null;
  variant?: 'solid' | 'glass';
  completedLog?: WorkoutLog | null;
}

function WorkoutOverviewCard({
  title,
  style: workoutStyle,
  duration,
  muscleGroups,
  exerciseCount,
  onPress,
  activePlan,
  variant = 'solid',
  completedLog,
}: Props) {
  const { colors, accent, isDark } = useZealTheme();
  const styleAccent = workoutStyle ? (WORKOUT_STYLE_COLORS[workoutStyle] ?? accent) : accent;

  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.6, { duration: 600, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 600, easing: Easing.in(Easing.ease) }),
      ),
      -1,
      false
    );
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: 600, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 600, easing: Easing.in(Easing.ease) }),
      ),
      -1,
      false
    );
  }, [pulseScale, pulseOpacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const cardShadow = !isDark
    ? {
        shadowColor: accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.14,
        shadowRadius: 16,
        elevation: 6,
      }
    : {
        shadowColor: accent,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 3,
      };

  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const label = getDynamicLabel();

  const isRestDay = title === 'Rest Day';

  // ── Completed state ─────────────────────────────────────────────
  if (completedLog) {
    const completedBorder = isDark ? 'rgba(34,197,94,0.22)' : 'rgba(34,197,94,0.18)';
    const chipBg = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';
    return (
      <GlassCard
        onPress={onPress}
        activeOpacity={onPress ? 0.78 : 1}
        variant={variant}
        style={[styles.card, { borderColor: completedBorder }, cardShadow]}
        testID="workout-overview-card"
      >
        <View style={styles.inner}>
          <View style={styles.labelRow}>
            <View style={styles.labelLeft}>
              <View style={[styles.pulseDot, { backgroundColor: '#22c55e' }]} />
              <Text style={[styles.label, { color: colors.textSecondary }]}>Completed Today</Text>
            </View>
            <PlatformIcon name="chevron-right" size={16} color="rgba(255,255,255,0.28)" />
          </View>

          <Text style={[styles.workoutTitle, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
            {completedLog.workoutName}
          </Text>

          <View style={styles.metaRow}>
            <View style={[styles.metaChip, { backgroundColor: chipBg }]}>
              <PlatformIcon name="clock" size={11} color={colors.textSecondary} />
              <Text style={[styles.metaChipText, { color: colors.textSecondary }]}>{completedLog.duration}m</Text>
            </View>
            <View style={[styles.metaChip, { backgroundColor: chipBg }]}>
              <PlatformIcon name="zap" size={11} color="#f87116" fill="#f87116" />
              <Text style={[styles.metaChipText, { color: '#f87116' }]}>+{completedLog.trainingScore} pts</Text>
            </View>
            {completedLog.prsHit > 0 && (
              <View style={[styles.metaChip, { backgroundColor: chipBg }]}>
                <PlatformIcon name="trophy" size={11} color="#f87116" />
                <Text style={[styles.metaChipText, { color: '#f87116' }]}>
                  {completedLog.prsHit} PR{completedLog.prsHit > 1 ? 's' : ''}
                </Text>
              </View>
            )}
          </View>
        </View>
      </GlassCard>
    );
  }
  // ────────────────────────────────────────────────────────────────

  // Strip parenthetical format from title (e.g. "Torque (Amrap)" → "Torque")
  // and extract it as a separate format label for the chips row
  const formatMatch = title.match(/\(([^)]+)\)/);
  const formatLabel = formatMatch ? formatMatch[1] : null;
  const displayTitle = title.replace(/\s*\([^)]+\)\s*/g, '').trim();

  const CardContent = (
    <View style={styles.inner}>
      <View style={styles.labelRow}>
        <View style={styles.labelLeft}>
          <Animated.View
            style={[styles.pulseDot, { backgroundColor: styleAccent }, pulseStyle]}
          />
          <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
        </View>
        {!isRestDay && onPress && (
          <PlatformIcon name="chevron-right" size={16} color="rgba(255,255,255,0.28)" />
        )}
      </View>

      <Text style={[styles.workoutTitle, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {displayTitle}
      </Text>


      {!isRestDay && (
        <View style={styles.metaRow}>
          <View style={[styles.metaChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }]}>
            <PlatformIcon name="clock" size={11} color={colors.textSecondary} />
            <Text style={[styles.metaChipText, { color: colors.textSecondary }]}>{duration}</Text>
          </View>
          {workoutStyle ? (
            <View style={[styles.metaChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }]}>
              <PlatformIcon name="zap" size={11} color={colors.textSecondary} />
              <Text style={[styles.metaChipText, { color: colors.textSecondary }]}>{workoutStyle}</Text>
            </View>
          ) : null}
          {exerciseCount ? (
            <View style={[styles.metaChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }]}>
              <Text style={[styles.metaChipText, { color: colors.textSecondary }]}>~{exerciseCount} exercises</Text>
            </View>
          ) : null}
          {formatLabel ? (
            <View style={[styles.metaChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }]}>
              <Text style={[styles.metaChipText, { color: colors.textSecondary }]}>{formatLabel}</Text>
            </View>
          ) : null}
        </View>
      )}

      {isRestDay && (
        <Text style={[styles.restSubline, { color: colors.textSecondary }]}>
          {duration !== 'Rest Day' ? duration : 'Recovery & regeneration'}
        </Text>
      )}


    </View>
  );

  return (
    <GlassCard
      onPress={onPress}
      activeOpacity={onPress ? 0.78 : 1}
      variant={variant}
      style={[styles.card, { borderColor: cardBorder }, cardShadow]}
      testID="workout-overview-card"
    >
      {CardContent}
    </GlassCard>
  );
}

export default memo(WorkoutOverviewCard);

const styles = StyleSheet.create({
  card: {
    borderRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
    borderWidth: 1,
    gap: 10,
    overflow: 'hidden',
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
  workoutTitle: {
    fontSize: 28,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.5,
    lineHeight: 32,
    marginTop: -2,
  },
  muscleGroups: {
    fontSize: 13,
    fontFamily: 'Outfit_300Light',
    letterSpacing: 0.1,
    marginTop: -2,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  metaChipText: {
    fontSize: 12,
    fontFamily: 'Outfit_300Light',
  },
  restSubline: {
    fontSize: 13,
    fontFamily: 'Outfit_300Light',
    marginTop: -2,
  },
});
