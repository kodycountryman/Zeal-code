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
}: Props) {
  const { colors, accent, isDark } = useZealTheme();

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
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

  const cardBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';
  const label = getDynamicLabel();

  const isRestDay = title === 'Rest Day';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.78 : 1}
      disabled={!onPress}
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: cardBorder },
        cardShadow,
      ]}
      testID="workout-overview-card"
    >
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
          style={[styles.pulseDot, { backgroundColor: accent, opacity: pulseAnim }]}
        />
      </View>

      <Text style={[styles.workoutTitle, { color: colors.text }]} numberOfLines={1}>
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


    </TouchableOpacity>
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
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  workoutTitle: {
    fontSize: 30,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.8,
    lineHeight: 34,
    marginTop: -2,
  },
  muscleGroups: {
    fontSize: 13,
    fontWeight: '500',
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
    fontWeight: '500',
  },
  restSubline: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: -2,
  },

});
