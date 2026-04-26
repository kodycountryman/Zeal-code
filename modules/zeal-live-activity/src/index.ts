import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

// ─────────────────────────────────────────────────────────────────
// Public TypeScript API for Zeal+ Live Activities.
// Call sites don't need Platform.OS checks — Android resolves
// every function as null/false automatically via the Kotlin no-op.
// ─────────────────────────────────────────────────────────────────

export type ActivityType = 'workout' | 'run';

export interface ActivityParams {
  /** "workout" or "run" — controls the icon and label style */
  type: ActivityType;
  /** Primary label: exercise name or "Active Run" */
  title: string;
  /** Secondary label: "Set 3 of 4" or "2.4 mi" */
  subtitle: string;
  /** Tertiary value: "225 lbs" or "8:32 / mi" */
  detail: string;
}

export interface UpdateParams {
  title?: string;
  subtitle?: string;
  detail?: string;
}

// requireOptionalNativeModule returns null instead of throwing when the
// module isn't compiled in (Expo Go, web). All functions below null-check it.
const NativeModule = Platform.OS !== 'web'
  ? requireOptionalNativeModule('ZealLiveActivity')
  : null;

/**
 * Returns true on iOS 16.2+ when the user has Live Activities enabled.
 * Always returns false on Android and web.
 */
export function isLiveActivityAvailable(): boolean {
  return NativeModule?.isAvailable() ?? false;
}

/**
 * Start a Live Activity when a workout or run begins.
 * Returns the activity ID to pass to update/end calls,
 * or null on Android / unsupported iOS.
 */
export async function startActivity(params: ActivityParams): Promise<string | null> {
  return NativeModule?.startActivity(params) ?? null;
}

/**
 * Update the Live Activity content — call on each set completion,
 * mile split, or pace change. Only provided fields are updated;
 * omitted fields retain their previous value.
 */
export async function updateActivity(activityId: string, params: UpdateParams): Promise<void> {
  await NativeModule?.updateActivity(activityId, params);
}

/**
 * Start a rest-between-sets countdown on the Dynamic Island.
 * iOS renders the timer natively — no JS interval needed.
 * The countdown clears automatically when updateActivity is called next.
 */
export async function startRestTimer(activityId: string, durationSeconds: number): Promise<void> {
  await NativeModule?.startRestTimer(activityId, durationSeconds);
}

/**
 * End and dismiss the Live Activity.
 * Call when the workout ends or the run is stopped.
 */
export async function endActivity(activityId: string): Promise<void> {
  await NativeModule?.endActivity(activityId);
}
