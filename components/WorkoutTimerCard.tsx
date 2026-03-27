import React, { useCallback, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { RotateCcw, Pause, Play } from 'lucide-react-native';
import { useZealTheme } from '@/context/AppContext';
import { useWorkoutTracking } from '@/context/WorkoutTrackingContext';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Isolated from the card shell so timer ticks don’t re-render chrome/controls. */
const TimerDigits = memo(function TimerDigits({ elapsed, color }: { elapsed: number; color: string }) {
  return (
    <Text style={[styles.timer, { color }]}>{formatTime(elapsed)}</Text>
  );
});

export default function WorkoutTimerCard() {
  const { colors, isDark } = useZealTheme();
  const tracking = useWorkoutTracking();
  const cardBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  const handleReset = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    requestAnimationFrame(() => {
      Alert.alert(
        'Reset Workout?',
        'This will clear all tracking data for this session.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reset', style: 'destructive', onPress: tracking.resetWorkout },
        ]
      );
    });
  }, [tracking.resetWorkout]);

  const handlePauseResume = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    requestAnimationFrame(() => {
      tracking.pauseWorkout();
    });
  }, [tracking]);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: cardBorder }]}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>WORKOUT TIMER</Text>
      <View style={styles.row}>
        <TimerDigits elapsed={tracking.workoutElapsed} color={colors.text} />
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.resetBtn, { borderColor: colors.border }]}
            onPress={handleReset}
            activeOpacity={0.7}
          >
            <RotateCcw size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.pauseBtn}
            onPress={handlePauseResume}
            activeOpacity={0.7}
          >
            {tracking.isPaused ? (
              <Play size={22} color="#fff" fill="#fff" />
            ) : (
              <Pause size={22} color="#fff" fill="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  label: {
    fontSize: 10,
    fontWeight: '600' as const,
    letterSpacing: 1,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timer: {
    fontSize: 44,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -2,
    lineHeight: 50,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resetBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#f87116',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f87116',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
});
