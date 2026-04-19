/**
 * Workout Share Service
 *
 * Mirrors runShareService — captures a rendered PostWorkoutShareCard view as
 * a PNG and hands it off to the native share sheet. The PostWorkoutSheet
 * mounts the card off-screen, passes its ref to `captureAndShareWorkout()`,
 * and this service handles the rest.
 */

import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Platform, type View } from 'react-native';

interface ShareOptions {
  /** Ref to the view to capture. Must be on-mount with collapsable={false}. */
  viewRef: React.RefObject<View | null>;
  /** Optional filename. Defaults to zeal-workout-TS.png. */
  filename?: string;
  /** Pixel density multiplier for the capture. 2 = retina-ish. */
  pixelRatio?: number;
}

/**
 * Snapshot the workout share card and open the native share sheet with the
 * resulting PNG. Returns true on success, false if the platform doesn't
 * support sharing or capture failed.
 */
export async function captureAndShareWorkout({
  viewRef,
  filename = `zeal-workout-${Date.now()}.png`,
  pixelRatio = 2.5,
}: ShareOptions): Promise<boolean> {
  if (!viewRef.current) {
    __DEV__ && console.log('[WorkoutShare] captureAndShareWorkout: ref is null');
    return false;
  }

  if (Platform.OS === 'web') {
    __DEV__ && console.log('[WorkoutShare] Sharing not supported on web');
    return false;
  }

  try {
    const uri = await captureRef(viewRef, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
      fileName: filename,
      // @ts-ignore - snapshotContentContainer is supported but missing from types
      snapshotContentContainer: false,
    });

    const available = await Sharing.isAvailableAsync();
    if (!available) {
      __DEV__ && console.log('[WorkoutShare] Sharing not available on device');
      return false;
    }

    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      dialogTitle: 'Share your workout',
      UTI: 'public.png',
    });
    return true;
  } catch (e) {
    __DEV__ && console.log('[WorkoutShare] Failed to capture/share:', e);
    return false;
  }
}
