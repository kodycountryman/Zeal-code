/**
 * Background Point Buffer
 *
 * When GPS points are received while the app is backgrounded, the background
 * task may fire in a short-lived JS context that doesn't share memory with
 * the main app. We append raw samples to an AsyncStorage buffer so they can
 * be drained and merged into the live route state when the app returns to
 * the foreground (or on next app launch).
 *
 * Buffer entries are append-only until drained. Drain is destructive — it
 * reads and clears in a single atomic pair.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface BufferedPoint {
  latitude: number;
  longitude: number;
  altitude: number | null;
  timestamp: number;
  accuracy: number | null;
  speed: number | null;
}

export const BACKGROUND_BUFFER_KEY = '@zeal_run_bg_buffer_v1';
/** Set to true when a run is actively tracking (foreground OR background). */
export const BACKGROUND_ACTIVE_KEY = '@zeal_run_bg_active_v1';

/** Append a batch of points to the buffer. Safe to call from the background task. */
export async function appendBackgroundPoints(points: BufferedPoint[]): Promise<void> {
  if (points.length === 0) return;
  try {
    const raw = await AsyncStorage.getItem(BACKGROUND_BUFFER_KEY);
    const existing: BufferedPoint[] = raw ? JSON.parse(raw) : [];
    const combined = existing.concat(points);
    await AsyncStorage.setItem(BACKGROUND_BUFFER_KEY, JSON.stringify(combined));
  } catch (e) {
    __DEV__ && console.log('[BGBuffer] Failed to append points:', e);
  }
}

/** Read all buffered points and clear the buffer in one call. */
export async function drainBackgroundPoints(): Promise<BufferedPoint[]> {
  try {
    const raw = await AsyncStorage.getItem(BACKGROUND_BUFFER_KEY);
    if (!raw) return [];
    await AsyncStorage.removeItem(BACKGROUND_BUFFER_KEY);
    return JSON.parse(raw) as BufferedPoint[];
  } catch (e) {
    __DEV__ && console.log('[BGBuffer] Failed to drain points:', e);
    return [];
  }
}

/** Clear the buffer without reading it. */
export async function clearBackgroundBuffer(): Promise<void> {
  try {
    await AsyncStorage.removeItem(BACKGROUND_BUFFER_KEY);
  } catch (e) {
    __DEV__ && console.log('[BGBuffer] Failed to clear buffer:', e);
  }
}

/** Mark the background tracking session as active. */
export async function setBackgroundActive(active: boolean): Promise<void> {
  try {
    if (active) {
      await AsyncStorage.setItem(BACKGROUND_ACTIVE_KEY, '1');
    } else {
      await AsyncStorage.removeItem(BACKGROUND_ACTIVE_KEY);
    }
  } catch (e) {
    __DEV__ && console.log('[BGBuffer] Failed to set active state:', e);
  }
}

/** Check whether background tracking is currently marked active. */
export async function isBackgroundActive(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(BACKGROUND_ACTIVE_KEY);
    return raw === '1';
  } catch {
    return false;
  }
}
