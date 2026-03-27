import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Sparkles, Clock, Zap } from 'lucide-react-native';
import { useZealTheme } from '@/context/AppContext';
import type { WorkoutPlan } from '@/context/AppContext';
import { WORKOUT_STYLE_COLORS } from '@/constants/colors';
import GlassCard from '@/components/GlassCard';

const DYNAMIC_LABELS = [
  "TODAY'S FOCUS",
  "ON DECK",
  "NEXT UP",
  "TODAY'S SESSION",
  "SCHEDULED FOR TODAY",
  "RECOMMENDED SESSION",
  "BUILT FOR TODAY",
  "FOR TODAY",
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
  onViewPlan?: () => void;
  variant?: 'solid' | 'glass';
}

export default function WorkoutOverviewCard({
  title,
  style: workoutStyle,
  duration,
  muscleGroups,
  exerciseCount,
  onPress,
  activePlan,
  onViewPlan,
  variant = 'solid',
}: Props) {
  const { colors, accent, isDark } = useZealTheme();
  const styleAccent = workoutStyle ? (WORKOUT_STYLE_COLORS[workoutStyle] ?? accent) : accent;

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

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

  const CardContent = (
    <View style={styles.inner}>
      {activePlan && onViewPlan && (
        <TouchableOpacity
          style={styles.planLink}
          onPress={onViewPlan}
          activeOpacity={0.7}
          testID="workout-overview-plan-link"
        >
          <Sparkles size={11} color={accent} />
          <Text style={[styles.planLinkText, { color: accent }]}>View Workout Plan</Text>
        </TouchableOpacity>
      )}

      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
        <Animated.View
          style={[styles.pulseDot, { backgroundColor: styleAccent, opacity: pulseAnim }]}
        />
      </View>

      <Text style={[styles.workoutTitle, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {title}
      </Text>

      {muscleGroups && !isRestDay && (
        <Text style={[styles.muscleGroups, { color: colors.textSecondary }]} numberOfLines={1}>
          {muscleGroups}
        </Text>
      )}

      {!isRestDay && (
        <View style={styles.metaRow}>
          <View style={[styles.metaChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }]}>
            <Clock size={11} color={colors.textSecondary} />
            <Text style={[styles.metaChipText, { color: colors.textSecondary }]}>{duration}</Text>
          </View>
          {workoutStyle ? (
            <View style={[styles.metaChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }]}>
              <Zap size={11} color={colors.textSecondary} />
              <Text style={[styles.metaChipText, { color: colors.textSecondary }]}>{workoutStyle}</Text>
            </View>
          ) : null}
          {exerciseCount ? (
            <View style={[styles.metaChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }]}>
              <Text style={[styles.metaChipText, { color: colors.textSecondary }]}>~{exerciseCount} exercises</Text>
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

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
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
  planLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  planLinkText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.2,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
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
