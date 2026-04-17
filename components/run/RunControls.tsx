import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme } from '@/context/AppContext';
import type { RunStatus } from '@/types/run';

interface Props {
  status: RunStatus;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  /** When true, show a small warning if GPS hasn't acquired yet. */
  gpsAcquired?: boolean;
}

const triggerHaptic = (style: 'light' | 'medium' | 'heavy' = 'medium') => {
  if (Platform.OS === 'web') return;
  const map = {
    light: Haptics.ImpactFeedbackStyle.Light,
    medium: Haptics.ImpactFeedbackStyle.Medium,
    heavy: Haptics.ImpactFeedbackStyle.Heavy,
  };
  Haptics.impactAsync(map[style]).catch(() => {});
};

export default function RunControls({
  status,
  onStart,
  onPause,
  onResume,
  onStop,
  gpsAcquired = true,
}: Props) {
  const { accent, colors, isDark } = useZealTheme();

  // Pulse animation for the start button
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (status === 'idle') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.06, duration: 900, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    pulse.setValue(1);
  }, [status, pulse]);

  // Pre-run idle state — show large START button
  if (status === 'idle') {
    return (
      <View style={styles.idleContainer}>
        <Animated.View style={[styles.startWrap, { transform: [{ scale: pulse }] }]}>
          <TouchableOpacity
            style={[styles.startButton, { backgroundColor: accent }]}
            onPress={() => {
              triggerHaptic('heavy');
              onStart();
            }}
            activeOpacity={0.8}
            testID="run-start-button"
            accessibilityRole="button"
            accessibilityLabel="Start run"
            accessibilityHint="Begins GPS tracking for a new run"
          >
            <PlatformIcon name="play" size={42} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
        <Text style={[styles.startLabel, { color: colors.text }]}>START RUN</Text>
        {!gpsAcquired && (
          <Text style={[styles.gpsHint, { color: colors.textMuted }]}>
            Acquiring GPS signal...
          </Text>
        )}
      </View>
    );
  }

  // Running or paused — show pause/resume + stop
  const isPaused = status === 'paused';
  const dangerBg = isDark ? 'rgba(239,68,68,0.18)' : 'rgba(239,68,68,0.12)';
  const dangerBorder = 'rgba(239,68,68,0.35)';
  const neutralBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const neutralBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';

  return (
    <View style={styles.activeContainer}>
      {/* Stop — small destructive button on the left */}
      <TouchableOpacity
        style={[styles.sideButton, { backgroundColor: dangerBg, borderColor: dangerBorder }]}
        onPress={() => {
          triggerHaptic('heavy');
          onStop();
        }}
        activeOpacity={0.7}
        testID="run-stop-button"
        accessibilityRole="button"
        accessibilityLabel="Stop run"
        accessibilityHint="Ends the current run and opens the post-run summary"
      >
        <PlatformIcon name="x" size={22} color="#ef4444" />
      </TouchableOpacity>

      {/* Pause / Resume — large circular center button */}
      <TouchableOpacity
        style={[styles.centerButton, { backgroundColor: isPaused ? accent : neutralBg, borderColor: isPaused ? accent : neutralBorder }]}
        onPress={() => {
          triggerHaptic('medium');
          if (isPaused) onResume();
          else onPause();
        }}
        activeOpacity={0.85}
        testID="run-pause-resume-button"
        accessibilityRole="button"
        accessibilityLabel={isPaused ? 'Resume run' : 'Pause run'}
        accessibilityState={{ checked: !isPaused }}
      >
        <PlatformIcon
          name={isPaused ? 'play' : 'pause'}
          size={32}
          color={isPaused ? '#fff' : colors.text}
        />
      </TouchableOpacity>

      {/* Spacer to balance layout symmetrically */}
      <View style={[styles.sideButton, { opacity: 0 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  idleContainer: {
    alignItems: 'center',
    gap: 14,
    paddingVertical: 24,
  },
  startWrap: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  startButton: {
    width: 124,
    height: 124,
    borderRadius: 62,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 6, // optical centering of the play triangle
  },
  startLabel: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 1.5,
  },
  gpsHint: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
  },
  activeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  sideButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
