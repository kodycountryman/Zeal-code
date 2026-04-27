/**
 * Run Step Counter — Phase 8.
 *
 * Two strategies in priority order:
 *   1. Native iOS Pedometer (CMPedometer via expo-sensors). Lazy-imported so
 *      the bundle still loads in Expo Go (which doesn't ship the native module).
 *   2. Cadence-based estimate as a fallback. Uses 170 steps-per-minute, the
 *      typical efficient running cadence — close enough for summary display
 *      when no pedometer data is available.
 *
 * Caller flow: run completes → call estimateRunSteps(startMs, endMs, durationSec).
 * Returns a number suitable for RunLog.steps. Never throws — falls back to the
 * cadence estimate on any error.
 */

import { Platform } from 'react-native';

const TYPICAL_RUNNING_CADENCE_SPM = 170; // steps per minute (both feet)

/** Cadence-based fallback. Always works, no native deps. */
function estimateFromCadence(durationSeconds: number): number {
  if (durationSeconds <= 0) return 0;
  return Math.round((durationSeconds / 60) * TYPICAL_RUNNING_CADENCE_SPM);
}

/**
 * Query CMPedometer for the actual step count between two timestamps.
 * Returns null if the module isn't available, the user denied permission,
 * or the query fails. Caller should fall back to estimateFromCadence in
 * those cases.
 */
async function queryPedometer(startMs: number, endMs: number): Promise<number | null> {
  if (Platform.OS !== 'ios') return null;
  try {
    // Lazy import — expo-sensors might not be linked in Expo Go.
    const sensors: any = await import('expo-sensors').catch(() => null);
    if (!sensors?.Pedometer) return null;
    const Pedometer = sensors.Pedometer;

    const isAvailable = await Pedometer.isAvailableAsync();
    if (!isAvailable) return null;

    // Permissions are auto-prompted on first call on iOS.
    const result = await Pedometer.getStepCountAsync(new Date(startMs), new Date(endMs));
    if (typeof result?.steps === 'number' && result.steps >= 0) {
      return result.steps;
    }
    return null;
  } catch (e) {
    __DEV__ && console.log('[runStepCounter] Pedometer query failed:', e);
    return null;
  }
}

/**
 * Get a step count for a completed run. Tries the real pedometer first,
 * falls back to a cadence-based estimate on any failure.
 */
export async function estimateRunSteps(
  startMs: number,
  endMs: number,
  durationSeconds: number,
): Promise<number> {
  const real = await queryPedometer(startMs, endMs);
  if (real !== null) return real;
  return estimateFromCadence(durationSeconds);
}
