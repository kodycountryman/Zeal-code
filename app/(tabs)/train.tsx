/**
 * Train tab — unified home for Workout + Run.
 *
 * Phase 3 composition: conditionally render WorkoutScreen or RunScreen based
 * on TrainContext.mode, with legacy `?mode=run` / `?mode=workout` query params
 * honored on mount.
 *
 * Phase 4 additions:
 *   - Horizontal swipe gesture at this level that calls setMode(). Uses
 *     react-native-gesture-handler's PanGestureHandler with activeOffsetX +
 *     failOffsetY tuned so the gesture only fires on clearly-horizontal
 *     swipes and yields to vertical ScrollViews inside the child screens.
 *   - Toggle itself is rendered inside each screen's TabHeader rightSlot
 *     (components/train/ModeToggleIcons.tsx reads TrainContext directly).
 *
 * Phase 5 adds <MiniSessionBar /> floating above the active screen.
 */
import React, { useEffect, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTrain } from '@/context/TrainContext';
import MiniSessionBar from '@/components/train/MiniSessionBar';
import WorkoutScreen from './workout';
import RunScreen from './run';

// Horizontal distance before the pan gesture activates. Keep this larger than
// the typical vertical scroll jitter so it only fires on intentional swipes.
const SWIPE_ACTIVATION_X = 24;
// Vertical slop that causes the pan to yield to the inner ScrollView.
const SWIPE_FAIL_Y = 12;
// Horizontal distance required at release to count as a completed swipe.
const SWIPE_COMMIT_THRESHOLD = 60;

export default function TrainScreen() {
  const { mode, loaded, setMode, syncFromQueryParam } = useTrain();
  const params = useLocalSearchParams<{ mode?: string }>();

  // Apply the ?mode=run|workout query param exactly once on mount. Legacy
  // redirects from /workout and /run pass this through so the user lands on
  // the right modality even when they came from a pre-Train-tab code path.
  useEffect(() => {
    syncFromQueryParam(params.mode);
  }, [params.mode, syncFromQueryParam]);

  // Commit the mode switch with light haptic feedback — called from the
  // gesture's worklet via runOnJS.
  const handleSwipeCommit = useCallback(
    (next: 'workout' | 'run') => {
      if (next === mode) return;
      if (Platform.OS !== 'web') {
        Haptics.selectionAsync().catch(() => {});
      }
      setMode(next);
    },
    [mode, setMode],
  );

  // Pan gesture — only fires on clearly-horizontal swipes, yields to vertical
  // scrolling. On release, commits the mode if the swipe cleared the commit
  // threshold in the direction of the opposite mode.
  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-SWIPE_ACTIVATION_X, SWIPE_ACTIVATION_X])
    .failOffsetY([-SWIPE_FAIL_Y, SWIPE_FAIL_Y])
    .onEnd((event) => {
      'worklet';
      const dx = event.translationX;
      if (Math.abs(dx) < SWIPE_COMMIT_THRESHOLD) return;
      // Swipe right (dx > 0) → show Workout (left page). Swipe left → Run (right).
      const next: 'workout' | 'run' = dx > 0 ? 'workout' : 'run';
      runOnJS(handleSwipeCommit)(next);
    });

  // Don't render until storage has resolved the last-used mode so we don't
  // flash the wrong screen. `loaded` turns true within milliseconds.
  if (!loaded) return null;

  return (
    <GestureDetector gesture={swipeGesture}>
      <View style={styles.root} collapsable={false}>
        {mode === 'run' ? <RunScreen /> : <WorkoutScreen />}
        {/* Floats above the active screen, below the dock. Self-hides when
            no cross-mode session is active. */}
        <MiniSessionBar />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
