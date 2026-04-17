import React, { memo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme } from '@/context/AppContext';
import { useTrain, type TrainMode } from '@/context/TrainContext';
import { useWorkoutTracking, useWorkoutElapsed } from '@/context/WorkoutTrackingContext';
import { useRun } from '@/context/RunContext';

/**
 * Persistent bar that surfaces an in-progress session that lives on the
 * OTHER mode from the one currently visible.
 *
 * Renders when:
 *   - mode === 'run' AND a workout is active → "Workout in progress · {time}"
 *   - mode === 'workout' AND a run is active → "Run in progress · {time}"
 * Otherwise: null (no render, no layout cost).
 *
 * Tapping the bar flips TrainContext to the active mode so the user jumps
 * straight back to their live session. State is already preserved in the
 * respective contexts — this bar is the visual anchor, not the storage.
 *
 * Sits above the FloatingDock (bottom: 100 to clear the 76px dock + safe
 * area), orange-accent-bordered to match "active session" visual language.
 */
function MiniSessionBar() {
  const { colors, accent, isDark } = useZealTheme();
  const { mode, setMode } = useTrain();

  const tracking = useWorkoutTracking();
  const run = useRun();

  const workoutElapsed = useWorkoutElapsed();
  const runElapsed = run.liveMetrics.elapsedSeconds;

  const workoutActive = tracking.isWorkoutActive;
  const runActive = run.status === 'running' || run.status === 'paused';

  // Decide which (if any) cross-mode session to surface.
  const surfaceWorkout = mode === 'run' && workoutActive;
  const surfaceRun = mode === 'workout' && runActive;
  const visible = surfaceWorkout || surfaceRun;

  // Pulse animation matching the rest of the app's "active" language.
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(1);
  useEffect(() => {
    if (!visible) return;
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
  }, [visible, pulseScale, pulseOpacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  if (!visible) return null;

  const activeMode: TrainMode = surfaceWorkout ? 'workout' : 'run';
  const label = surfaceWorkout ? 'Workout in progress' : 'Run in progress';
  const paused = surfaceWorkout ? tracking.isPaused : run.status === 'paused';
  const elapsed = surfaceWorkout ? workoutElapsed : runElapsed;
  const elapsedText = formatElapsed(elapsed);

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    setMode(activeMode);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.85}
      style={[
        styles.bar,
        {
          backgroundColor: isDark ? 'rgba(32,32,32,0.94)' : 'rgba(255,255,255,0.94)',
          borderColor: `${accent}59`,
          shadowColor: accent,
        },
      ]}
      testID="train-mini-session-bar"
      accessibilityRole="button"
      accessibilityLabel={`${label}${paused ? ', paused' : ''}, ${elapsedText}. Tap to return.`}
    >
      <Animated.View style={[styles.dot, { backgroundColor: paused ? colors.textMuted : accent }, pulseStyle]} />
      <View style={styles.labelCol}>
        <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
          {label}
          {paused && ' · Paused'}
        </Text>
        <Text style={[styles.elapsed, { color: colors.textSecondary }]} numberOfLines={1}>
          {elapsedText}
        </Text>
      </View>
      <PlatformIcon name="chevron-right" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

export default memo(MiniSessionBar);

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatElapsed(totalSeconds: number): string {
  if (!isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const hrs = Math.floor(totalSeconds / 3600);
  const min = Math.floor((totalSeconds % 3600) / 60);
  const sec = Math.floor(totalSeconds % 60);
  if (hrs > 0) {
    return `${hrs}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${min}:${String(sec).padStart(2, '0')}`;
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 12,
    right: 12,
    // Sits above the FloatingDock. Dock is ~76px tall and carries its own
    // safe-area bottom padding, so 100 clears it with a breathing gap.
    bottom: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    // Elevated so it reads as floating, not as another card.
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  labelCol: {
    flex: 1,
    flexDirection: 'column',
    gap: 1,
  },
  label: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0,
  },
  elapsed: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
    letterSpacing: 0.3,
  },
});
