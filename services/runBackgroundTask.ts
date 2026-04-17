/**
 * Background Location Task — module-scope definition
 *
 * TaskManager requires `defineTask` to be called synchronously at module-import
 * time (not inside a component or useEffect), so that when iOS/Android wakes
 * the JS runtime to deliver background location samples, the task handler is
 * already registered.
 *
 * This module MUST be imported once from the app entry point (e.g. _layout.tsx)
 * so the side-effect `defineTask` call runs before any call to
 * `Location.startLocationUpdatesAsync`.
 *
 * The task function has no access to React state or the runTrackingService
 * singleton (those may be cold when running in the background). It writes
 * points to an AsyncStorage buffer; the foreground app drains that buffer
 * when it comes back to life.
 */

import * as TaskManager from 'expo-task-manager';
import type { LocationObject } from 'expo-location';
import { appendBackgroundPoints, BufferedPoint } from '@/services/runBackgroundBuffer';

export const RUN_TRACKING_TASK_NAME = 'zeal-run-tracking-task';

interface LocationTaskData {
  locations: LocationObject[];
}

// Define the task exactly once. Guard against duplicate registration if the
// module is somehow evaluated twice (Fast Refresh, etc.).
if (!TaskManager.isTaskDefined(RUN_TRACKING_TASK_NAME)) {
  TaskManager.defineTask(RUN_TRACKING_TASK_NAME, async ({ data, error }) => {
    if (error) {
      __DEV__ && console.log('[RunTask] Task error:', error);
      return;
    }
    if (!data) return;
    const { locations } = data as LocationTaskData;
    if (!locations || locations.length === 0) return;

    const points: BufferedPoint[] = locations.map((loc) => ({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      altitude: loc.coords.altitude ?? null,
      timestamp: loc.timestamp,
      accuracy: loc.coords.accuracy ?? null,
      speed: loc.coords.speed ?? null,
    }));

    await appendBackgroundPoints(points);
    __DEV__ && console.log(`[RunTask] Buffered ${points.length} background point(s)`);
  });
}
