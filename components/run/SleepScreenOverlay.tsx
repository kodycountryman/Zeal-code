import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  StatusBar,
  Platform,
} from 'react-native';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme } from '@/context/AppContext';

/**
 * Phase 10 — Run Sleep Screen.
 *
 * A low-glance, no-touch overlay for runs. Shows current time, pace, and
 * distance in oversized type. Background is fully blacked out so the rest
 * of the run UI can't be tapped accidentally (a tap on the run screen
 * during a long effort can pause/end a run, with no good way to recover).
 *
 * Dismissal: small "X" in the top-right corner — small target so it can't
 * be hit by a sweaty palm. Plus a long-press anywhere as a backup.
 *
 * Brightness: when mounted, drops device brightness to ~20% via
 * expo-brightness, restores on dismiss. Lazy-imported so the bundle still
 * loads in Expo Go.
 */

interface Props {
  visible: boolean;
  onDismiss: () => void;
  /** Current pace string already formatted ("5:32/mi"), or null when unavailable. */
  paceText: string | null;
  /** Current distance string ("3.42 mi"). */
  distanceText: string;
  /** Elapsed time ("32:14"). */
  elapsedText: string;
}

export default function SleepScreenOverlay({
  visible,
  onDismiss,
  paceText,
  distanceText,
  elapsedText,
}: Props) {
  const { accent } = useZealTheme();
  const [now, setNow] = useState<Date>(new Date());
  const prevBrightnessRef = useRef<number | null>(null);

  // Live clock — update every 30s (no need for second-by-second)
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, [visible]);

  // Dim screen on mount, restore on unmount.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      try {
        const Brightness: any = await import('expo-brightness').catch(() => null);
        if (!Brightness || cancelled) return;
        const current = await Brightness.getBrightnessAsync().catch(() => null);
        if (typeof current === 'number') prevBrightnessRef.current = current;
        await Brightness.setBrightnessAsync(0.2).catch(() => {});
      } catch (e) {
        __DEV__ && console.log('[SleepScreen] Failed to dim:', e);
      }
    })();
    return () => {
      cancelled = true;
      const prev = prevBrightnessRef.current;
      if (prev === null) return;
      (async () => {
        try {
          const Brightness: any = await import('expo-brightness').catch(() => null);
          if (!Brightness) return;
          await Brightness.setBrightnessAsync(prev).catch(() => {});
        } catch {}
      })();
    };
  }, [visible]);

  const clockText = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <TouchableOpacity
        style={styles.root}
        activeOpacity={1}
        onLongPress={onDismiss}
        delayLongPress={700}
      >
        {/* Small X in top-right — deliberate target, hard to hit accidentally */}
        <TouchableOpacity
          style={styles.dismissBtn}
          onPress={onDismiss}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          testID="sleep-screen-dismiss"
        >
          <PlatformIcon name="x" size={16} color="rgba(255,255,255,0.45)" />
        </TouchableOpacity>

        {/* Center stats stack */}
        <View style={styles.centerStack}>
          <Text style={styles.clock}>{clockText}</Text>
          <Text style={[styles.bigStat, { color: accent }]}>{distanceText}</Text>
          <Text style={styles.label}>DISTANCE</Text>

          <View style={styles.divider} />

          <Text style={styles.bigStat}>{paceText ?? '—:—'}</Text>
          <Text style={styles.label}>PACE</Text>

          <View style={styles.divider} />

          <Text style={styles.bigStat}>{elapsedText}</Text>
          <Text style={styles.label}>TIME</Text>
        </View>

        <Text style={styles.hint}>Long-press anywhere to wake</Text>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
    paddingHorizontal: 28,
  },
  dismissBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 24,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  centerStack: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  clock: {
    fontSize: 52,
    fontFamily: 'Outfit_300Light',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: -2,
    marginBottom: 36,
  },
  bigStat: {
    fontSize: 64,
    fontFamily: 'Outfit_800ExtraBold',
    color: '#ffffff',
    letterSpacing: -3,
    lineHeight: 70,
  },
  label: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    color: 'rgba(255,255,255,0.30)',
    letterSpacing: 2.4,
    marginBottom: 24,
    marginTop: -2,
  },
  divider: {
    width: 28,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginVertical: 4,
  },
  hint: {
    textAlign: 'center',
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
    color: 'rgba(255,255,255,0.20)',
    letterSpacing: 0.5,
  },
});
