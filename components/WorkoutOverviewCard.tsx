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
import Chip from '@/components/Chip';
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
  onOpenActivePlan?: () => void;
  activePlan?: WorkoutPlan | null;
  variant?: 'solid' | 'glass';
  completedLog?: WorkoutLog | null;
  /** When generation honored an adaptive deload override, this carries the
   *  human-readable reason so the card can show a small explainer badge. */
  adaptiveDeloadReason?: string | null;
}

function WorkoutOverviewCard({
  title,
  style: workoutStyle,
  duration,
  muscleGroups,
  exerciseCount,
  onPress,
  onOpenActivePlan,
  activePlan,
  variant = 'solid',
  completedLog,
  adaptiveDeloadReason,
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

  // ── Completed state (compact — expands if active plan) ──────────
  if (completedLog) {
    const completedBorder = isDark ? 'rgba(34,197,94,0.22)' : 'rgba(34,197,94,0.18)';
    const rowPressBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
    return (
      <GlassCard
        variant={variant}
        style={[styles.card, { borderColor: completedBorder, padding: 0 }, cardShadow]}
        testID="workout-overview-card"
      >
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={1}
          onPressIn={(e) => (e.target as any)?.setNativeProps?.({ style: { backgroundColor: rowPressBg } })}
          onPressOut={(e) => (e.target as any)?.setNativeProps?.({ style: { backgroundColor: 'transparent' } })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: activePlan ? 0 : 26 }}
        >
          <View style={[styles.pulseDot, { backgroundColor: '#22c55e' }]} />
          <Text style={{ fontFamily: 'Outfit_500Medium', fontSize: 13, color: colors.textSecondary }}>Completed Today —</Text>
          <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 15, color: colors.text, flex: 1 }} numberOfLines={1}>
            {completedLog.workoutName}
          </Text>
          {completedLog.trainingScore > 0 && (
            <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 13, color: '#f87116' }}>+{completedLog.trainingScore} pts</Text>
          )}
          <PlatformIcon name="chevron-right" size={14} color="rgba(255,255,255,0.28)" />
        </TouchableOpacity>
        {activePlan && onOpenActivePlan && (
          <>
            <View style={{ height: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} />
            <TouchableOpacity
              onPress={onOpenActivePlan}
              activeOpacity={1}
              onPressIn={(e) => (e.target as any)?.setNativeProps?.({ style: { backgroundColor: rowPressBg } })}
              onPressOut={(e) => (e.target as any)?.setNativeProps?.({ style: { backgroundColor: 'transparent' } })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 11 }}
            >
              <PlatformIcon name="sparkles" size={12} color={accent} />
              <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 13, color: colors.text }}>View Active Plan</Text>
              <View style={{ flex: 1 }} />
              <Text style={{ fontFamily: 'Outfit_400Regular', fontSize: 11, color: colors.textMuted }}>
                Week {Math.max(1, Math.ceil((Date.now() - new Date(activePlan.startDate + 'T00:00:00').getTime()) / (7 * 24 * 60 * 60 * 1000)))} of {activePlan.planLength}
              </Text>
              <PlatformIcon name="chevron-right" size={12} color="rgba(255,255,255,0.28)" />
            </TouchableOpacity>
          </>
        )}
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
          <Chip variant="neutral" icon="clock" label={duration} />
          {workoutStyle ? <Chip variant="neutral" icon="zap" label={workoutStyle} /> : null}
          {exerciseCount ? <Chip variant="neutral" label={`~${exerciseCount} exercises`} /> : null}
          {formatLabel ? <Chip variant="neutral" label={formatLabel} /> : null}
        </View>
      )}

      {/* Adaptive deload badge — explains to the user why today is lighter
          than the scheduled phase. Shown only on plan workout days when
          maybeAdaptiveDeload() fired. */}
      {!isRestDay && adaptiveDeloadReason && (
        <View style={[styles.adaptiveBadge, { backgroundColor: `${accent}12`, borderColor: `${accent}40` }]}>
          <Text style={[styles.adaptiveBadgeText, { color: accent }]} numberOfLines={2}>
            {adaptiveDeloadReason}
          </Text>
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
  restSubline: {
    fontSize: 13,
    fontFamily: 'Outfit_300Light',
    marginTop: -2,
  },
  adaptiveBadge: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  adaptiveBadgeText: {
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.1,
    lineHeight: 16,
  },
});
