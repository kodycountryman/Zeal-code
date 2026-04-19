import React, { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PlatformIcon } from '@/components/PlatformIcon';
import type { WorkoutLog } from '@/context/WorkoutTrackingContext';
import { WORKOUT_STYLE_COLORS } from '@/constants/colors';

interface Props {
  log: WorkoutLog;
  /** Accent color driving the gradient. Falls back to the style color. */
  accent?: string;
}

const CARD_W = 1080;
const CARD_H = 1920;

function formatVolume(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(v);
}

function formatDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

/**
 * Off-screen 1080×1920 portrait card rendered for capture by
 * `react-native-view-shot`. The PostWorkoutSheet mounts this conditionally
 * (via a sibling overlay positioned off-canvas) before invoking
 * `captureAndShareWorkout`.
 *
 * Visual is intentionally simple — name, date, big stat tiles, optional PR
 * list, Zeal+ wordmark. No route map (workouts aren't geo) and no glass
 * blur (BlurView doesn't capture cleanly via view-shot on all platforms).
 */
const PostWorkoutShareCard = forwardRef<View, Props>(({ log, accent }, ref) => {
  const styleColor = WORKOUT_STYLE_COLORS[log.workoutStyle] ?? accent ?? '#f87116';
  const ax = accent ?? styleColor;

  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <LinearGradient
        colors={['#0a0a0a', '#1a1a1a', '#0a0a0a']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Top accent stripe */}
      <View style={[styles.accentStripe, { backgroundColor: ax }]} />

      <View style={styles.body}>
        {/* Style badge */}
        <View style={[styles.styleBadge, { backgroundColor: styleColor }]}>
          <Text style={styles.styleBadgeText}>{log.workoutStyle.toUpperCase()}</Text>
        </View>

        {/* Workout name */}
        <Text style={styles.workoutName} numberOfLines={2}>{log.workoutName}</Text>

        {/* Date */}
        <Text style={styles.date}>{formatDate(log.date)}</Text>

        {/* 2×2 stat grid */}
        <View style={styles.statGrid}>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{log.duration}</Text>
            <Text style={styles.statUnit}>min</Text>
            <Text style={styles.statLabel}>DURATION</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{log.totalSets}</Text>
            <Text style={styles.statUnit}>sets</Text>
            <Text style={styles.statLabel}>VOLUME</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{formatVolume(log.totalVolume)}</Text>
            <Text style={styles.statUnit}>lbs</Text>
            <Text style={styles.statLabel}>TONNAGE</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={[styles.statValue, { color: ax }]}>{log.trainingScore}</Text>
            <Text style={styles.statUnit}>pts</Text>
            <Text style={styles.statLabel}>SCORE</Text>
          </View>
        </View>

        {/* PRs (when present) */}
        {log.prsHit > 0 && (
          <View style={[styles.prBlock, { borderColor: `${ax}55`, backgroundColor: `${ax}10` }]}>
            <View style={styles.prHeader}>
              <PlatformIcon name="trophy" size={36} color={ax} />
              <Text style={[styles.prHeaderText, { color: ax }]}>
                {log.prsHit === 1 ? 'NEW PERSONAL RECORD' : `${log.prsHit} NEW PERSONAL RECORDS`}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Footer wordmark */}
      <View style={styles.footer}>
        <Text style={styles.wordmarkPrefix}>ZEAL</Text>
        <Text style={[styles.wordmarkPlus, { color: ax }]}>+</Text>
      </View>
    </View>
  );
});

PostWorkoutShareCard.displayName = 'PostWorkoutShareCard';

export default PostWorkoutShareCard;

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    height: CARD_H,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  accentStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 12,
  },
  body: {
    flex: 1,
    paddingHorizontal: 96,
    paddingTop: 240,
    paddingBottom: 96,
    gap: 48,
  },
  styleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 28,
  },
  styleBadgeText: {
    fontSize: 28,
    fontFamily: 'Outfit_700Bold',
    color: '#fff',
    letterSpacing: 3,
  },
  workoutName: {
    fontSize: 96,
    fontFamily: 'Outfit_800ExtraBold',
    color: '#fff',
    lineHeight: 108,
    letterSpacing: -2,
  },
  date: {
    fontSize: 36,
    fontFamily: 'Outfit_500Medium',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.5,
    marginTop: -16,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 64,
    columnGap: 96,
    marginTop: 48,
  },
  statCell: {
    width: (CARD_W - 96 * 2 - 96) / 2, // half-row width minus column gap
  },
  statValue: {
    fontSize: 156,
    fontFamily: 'Outfit_800ExtraBold',
    color: '#fff',
    lineHeight: 156,
    letterSpacing: -4,
  },
  statUnit: {
    fontSize: 32,
    fontFamily: 'Outfit_600SemiBold',
    color: 'rgba(255,255,255,0.6)',
    marginTop: -8,
  },
  statLabel: {
    fontSize: 22,
    fontFamily: 'Outfit_700Bold',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 3,
    marginTop: 24,
  },
  prBlock: {
    marginTop: 24,
    padding: 36,
    borderRadius: 32,
    borderWidth: 3,
  },
  prHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  prHeaderText: {
    fontSize: 36,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 1.5,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    paddingBottom: 80,
    gap: 4,
  },
  wordmarkPrefix: {
    fontSize: 56,
    fontFamily: 'Outfit_800ExtraBold',
    color: '#fff',
    letterSpacing: 4,
  },
  wordmarkPlus: {
    fontSize: 80,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 0,
  },
});
