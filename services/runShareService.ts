/**
 * Run Share Service
 *
 * Captures a rendered ShareCard view as a PNG and hands it off to the
 * native share sheet. Consumers render the ShareCard off-screen, pass its
 * ref to `captureAndShareRun()`, and this service handles the rest.
 */

import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Platform, type View } from 'react-native';

interface ShareOptions {
  /** Ref to the view to capture. Must be on-mount (collapsable={false}). */
  viewRef: React.RefObject<View | null>;
  /** Optional filename (defaults to zeal-run-TS.png) */
  filename?: string;
  /** Pixel density multiplier for the capture. 2 = retina-ish. */
  pixelRatio?: number;
}

/**
 * Snapshot a view and open the native share sheet with the resulting PNG.
 * Returns true on success, false if the device doesn't support sharing or
 * capture failed.
 */
export async function captureAndShareRun({
  viewRef,
  filename = `zeal-run-${Date.now()}.png`,
  pixelRatio = 2.5,
}: ShareOptions): Promise<boolean> {
  if (!viewRef.current) {
    __DEV__ && console.log('[RunShare] captureAndShareRun: ref is null');
    return false;
  }

  if (Platform.OS === 'web') {
    __DEV__ && console.log('[RunShare] Sharing not supported on web');
    return false;
  }

  // Phase 9: brief settle delay so MapView tiles in the share card have a
  // chance to finish painting before view-shot snapshots them. The card is
  // mounted off-screen as soon as RunSummary opens, so by the time the user
  // taps Share the tiles are usually already cached — but on the FIRST share
  // immediately after a run, this 600ms window prevents grey tiles in the
  // captured image.
  await new Promise(r => setTimeout(r, 600));

  try {
    const uri = await captureRef(viewRef, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
      fileName: filename,
      // iOS/Android both honor pixel density multipliers
      // @ts-ignore - snapshotContentContainer isn't in the types but is supported
      snapshotContentContainer: false,
    });

    const available = await Sharing.isAvailableAsync();
    if (!available) {
      __DEV__ && console.log('[RunShare] Sharing not available on device');
      return false;
    }

    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      dialogTitle: 'Share your run',
      UTI: 'public.png',
    });
    return true;
  } catch (e) {
    __DEV__ && console.log('[RunShare] Failed to capture/share:', e);
    return false;
  }
}
