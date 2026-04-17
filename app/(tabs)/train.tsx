/**
 * Train tab — unified home for Workout + Run.
 *
 * Phase 3 composition: conditionally render WorkoutScreen or RunScreen based
 * on TrainContext.mode, with legacy `?mode=run` / `?mode=workout` query params
 * honored on mount.
 *
 * Phase 4 adds:
 *   - <ModeToggleIcons /> injected into each screen's TabHeader rightSlot
 *     via a shared TrainContext read.
 *   - Swipe gesture at this level (PanGestureHandler) that calls setMode.
 *
 * Phase 5 adds <MiniSessionBar /> floating above the active screen.
 *
 * The two legacy routes (/workout and /run) still mount the screens directly
 * — they're useful for deep-link safety during the transition (Phase 6 deletes
 * them). The FloatingDock points ONLY at /train.
 */
import React, { useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useTrain } from '@/context/TrainContext';
import WorkoutScreen from './workout';
import RunScreen from './run';

export default function TrainScreen() {
  const { mode, loaded, syncFromQueryParam } = useTrain();
  const params = useLocalSearchParams<{ mode?: string }>();

  // Apply the ?mode=run|workout query param exactly once on mount. Legacy
  // redirects from /workout and /run pass this through so the user lands on
  // the right modality even when they came from a pre-Train-tab code path.
  useEffect(() => {
    syncFromQueryParam(params.mode);
  }, [params.mode, syncFromQueryParam]);

  // Don't render until storage has resolved the last-used mode so we don't
  // flash the wrong screen. `loaded` turns true within milliseconds.
  if (!loaded) return null;

  return mode === 'run' ? <RunScreen /> : <WorkoutScreen />;
}
