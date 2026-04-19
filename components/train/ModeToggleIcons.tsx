import React, { memo, useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform, type LayoutChangeEvent } from 'react-native';
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
 * The Train tab's mode-switcher. One pill containing two icons
 * (dumbbell | figure-run), with a sliding circular indicator that springs to
 * whichever mode is active — a mini echo of the FloatingDock's active bubble.
 *
 * Each icon carries a small status dot indicating the off-screen mode's state:
 *   - Orange pulse → that mode has an active session right now
 *   - Green dot    → that mode has been completed today
 *   - No dot       → that mode is idle (nothing started/completed today)
 *
 * The currently-active icon never gets a status dot — you're already looking
 * at it, so the status is implied by the visible screen.
 *
 * Suppressed on hybrid days (TrainContext.isHybridToday) because the layout
 * switches to a stacked-cards view with no toggle needed.
 */

// Timing curve tuned to match the TrainScreen content slide exactly so the
// bubble, content, and header elements all land on the same frame. Using
// `withTiming` (not `withSpring`) because the spring's overshoot made the
// bubble briefly pass its target and recoil — read as a "bounce back to the
// other slot" glitch by the user.
const BUBBLE_DURATION_MS = 300;
const BUBBLE_EASING = Easing.out(Easing.cubic);

const MODES: TrainMode[] = ['workout', 'run'];

function ModeToggleIcons() {
  const { colors, accent, isDark } = useZealTheme();
  const { mode, setMode, isHybridToday } = useTrain();
  const tracking = useWorkoutTracking();
  const run = useRun();

  const workoutActive = tracking.isWorkoutActive;
  const runActive = run.status === 'running' || run.status === 'paused';

  const workoutDoneToday = !workoutActive && tracking.todayLogs.length > 0;
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

  // ── Sliding bubble measurement ──────────────────────────────────────────
  // We capture each slot's x offset on first layout, then animate a shared
  // value between [0, 1] where the two endpoints index into the measured
  // offsets. Same measurement pattern as FloatingDock.
  const [slotXOffsets, setSlotXOffsets] = useState<number[]>([0, 0]);
  const [slotWidth, setSlotWidth] = useState(0);

  const handleSlotLayout = (index: number) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setSlotXOffsets((prev) => {
      if (prev[index] === x) return prev;
      const next = [...prev];
      next[index] = x;
      return next;
    });
    if (width > 0) setSlotWidth(width);
  };

  const bubbleX = useSharedValue(0);
  useEffect(() => {
    const targetIdx = MODES.indexOf(mode);
    const targetX = slotXOffsets[targetIdx] ?? 0;
    bubbleX.value = withTiming(targetX, { duration: BUBBLE_DURATION_MS, easing: BUBBLE_EASING });
  }, [mode, slotXOffsets, bubbleX]);

  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: bubbleX.value }],
  }));

  if (isHybridToday) return null;

  // Pill background tints — match the floating-dock palette so the header
  // toggle reads as a miniature of the dock.
  const pillBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const bubbleBg = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.9)';

  return (
    <View style={[styles.pill, { backgroundColor: pillBg }]}>
      {/* Sliding indicator — pointer-events off so taps pass through to the
          underlying slot buttons. Only renders once we've measured the
          slots to avoid flashing a bubble at x=0 on first paint. */}
      {slotWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.bubble,
            { width: slotWidth, backgroundColor: bubbleBg },
            bubbleStyle,
          ]}
        />
      )}

      <ModeSlot
        iconName="dumbbell"
        selected={mode === 'workout'}
        accentColor={accent}
        mutedColor={colors.textMuted}
        onPress={() => handleTap('workout')}
        onLayout={handleSlotLayout(0)}
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
      <ModeSlot
        iconName="figure-run"
        selected={mode === 'run'}
        accentColor={accent}
        mutedColor={colors.textMuted}
        onPress={() => handleTap('run')}
        onLayout={handleSlotLayout(1)}
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

// ─── ModeSlot (single icon inside the pill with optional status dot + pulse)

interface ModeSlotProps {
  iconName: 'dumbbell' | 'figure-run';
  selected: boolean;
  accentColor: string;
  mutedColor: string;
  onPress: () => void;
  onLayout: (e: LayoutChangeEvent) => void;
  statusDot: 'none' | 'active' | 'done';
  testID?: string;
  accessibilityLabel?: string;
}

function ModeSlot({
  iconName,
  selected,
  accentColor,
  mutedColor,
  onPress,
  onLayout,
  statusDot,
  testID,
  accessibilityLabel,
}: ModeSlotProps) {
  // Status-dot pulse (unchanged from prior implementation).
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
      onLayout={onLayout}
      activeOpacity={0.7}
      style={styles.slot}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
    >
      <PlatformIcon name={iconName} size={18} color={iconColor} strokeWidth={selected ? 2.25 : 2} />
      {statusDot === 'active' && (
        <Animated.View style={[styles.dot, { backgroundColor: accentColor }, pulseStyle]} />
      )}
      {statusDot === 'done' && <View style={[styles.dot, { backgroundColor: '#22c55e' }]} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: 18,
    position: 'relative',
    overflow: 'hidden',
  },
  // Sliding circle indicator. Height matches the slot so the pill-minus-padding
  // gives a perfect circle when slotWidth ≈ (pill height - 2*padding).
  bubble: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 0,
    borderRadius: 999,
  },
  slot: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    // Explicit z-index above bubble so icon + status dot render on top.
    zIndex: 1,
  },
  dot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
