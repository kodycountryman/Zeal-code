import React, { memo, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
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
import { useWorkoutTracking } from '@/context/WorkoutTrackingContext';
import { useRun } from '@/context/RunContext';

/**
 * The Train tab's mode-switcher. Two icons (dumbbell | figure-run) side-by-side.
 * Tapping an icon calls `trainContext.setMode(mode)`. Each icon carries a
 * small status dot indicating the off-screen mode's state:
 *   - Orange pulse → that mode has an active session right now
 *   - Green dot    → that mode has been completed today
 *   - No dot       → that mode is idle (nothing started/completed today)
 *
 * The currently-active icon never gets a status dot — you're already looking
 * at it, so the status is implied by the visible screen.
 *
 * This component is rendered in the Train tab's TabHeader rightSlot. It's
 * suppressed on hybrid days (TrainContext.isHybridToday) because the layout
 * switches to a stacked-cards view with no toggle needed.
 */
function ModeToggleIcons() {
  const { colors, accent } = useZealTheme();
  const { mode, setMode, isHybridToday } = useTrain();
  const tracking = useWorkoutTracking();
  const run = useRun();

  const workoutActive = tracking.isWorkoutActive;
  const runActive = run.status === 'running' || run.status === 'paused';

  // A workout is "done today" if the latest log's date is today. The
  // tracking context exposes todayLogs via the completion flag pattern.
  const workoutDoneToday = !workoutActive && tracking.todayLogs.length > 0;

  // A run is "done today" if any run in history has today's date.
  const runDoneToday =
    !runActive &&
    run.runHistory.some((r) => {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return r.date === today;
    });

  const handleTap = (next: TrainMode) => {
    if (next === mode) return;
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    setMode(next);
  };

  // Hidden on hybrid days — HybridLayout shows both modalities stacked so
  // a toggle would be redundant.
  if (isHybridToday) return null;

  return (
    <View style={styles.row}>
      <ModeIcon
        iconName="dumbbell"
        selected={mode === 'workout'}
        onPress={() => handleTap('workout')}
        accentColor={accent}
        mutedColor={colors.textMuted}
        statusDot={
          mode === 'workout'
            ? 'none'
            : workoutActive
              ? 'active'
              : workoutDoneToday
                ? 'done'
                : 'none'
        }
        testID="train-toggle-workout"
        accessibilityLabel={`Workout mode${mode === 'workout' ? ', selected' : ''}`}
      />
      <ModeIcon
        iconName="figure-run"
        selected={mode === 'run'}
        onPress={() => handleTap('run')}
        accentColor={accent}
        mutedColor={colors.textMuted}
        statusDot={
          mode === 'run'
            ? 'none'
            : runActive
              ? 'active'
              : runDoneToday
                ? 'done'
                : 'none'
        }
        testID="train-toggle-run"
        accessibilityLabel={`Run mode${mode === 'run' ? ', selected' : ''}`}
      />
    </View>
  );
}

export default memo(ModeToggleIcons);

// ─── ModeIcon (single icon with optional status dot + pulse) ──────────────

interface ModeIconProps {
  iconName: 'dumbbell' | 'figure-run';
  selected: boolean;
  onPress: () => void;
  accentColor: string;
  mutedColor: string;
  statusDot: 'none' | 'active' | 'done';
  testID?: string;
  accessibilityLabel?: string;
}

function ModeIcon({
  iconName,
  selected,
  onPress,
  accentColor,
  mutedColor,
  statusDot,
  testID,
  accessibilityLabel,
}: ModeIconProps) {
  // Pulse animation for the "active session" dot. Re-use the same timing as
  // the pulseDot in WorkoutOverviewCard / RunOverviewCard so the motion
  // language is consistent across the app.
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    if (statusDot !== 'active') return;
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
  }, [statusDot, pulseScale, pulseOpacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const iconColor = selected ? accentColor : mutedColor;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.iconBtn}
      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
    >
      <PlatformIcon name={iconName} size={22} color={iconColor} strokeWidth={selected ? 2.5 : 2} />
      {statusDot === 'active' && (
        <Animated.View style={[styles.dot, { backgroundColor: accentColor }, pulseStyle]} />
      )}
      {statusDot === 'done' && <View style={[styles.dot, { backgroundColor: '#22c55e' }]} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  iconBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
