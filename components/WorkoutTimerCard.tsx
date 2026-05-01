import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
  Animated as RNAnimated,
  Switch,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  interpolateColor,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme } from '@/context/AppContext';
import { useWorkoutTracking, useRestTimeRemaining } from '@/context/WorkoutTrackingContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function formatTime(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.max(0, seconds) % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}


const PRESETS = [
  { label: '1m', seconds: 60 },
  { label: '1.5m', seconds: 90 },
  { label: '2m', seconds: 120 },
] as const;

function WorkoutTimerCard({ accent }: { accent: string }) {
  const { colors, isDark } = useZealTheme();
  const tracking = useWorkoutTracking();
  const restTimeRemaining = useRestTimeRemaining();

  const [isMinimized, setIsMinimized] = useState(false);
  // Persists user's preferred state across timer sessions within a workout
  const preferMinimized = useRef(false);
  const prevIsActive = useRef(false);

  const isActive = tracking.isRestActive && restTimeRemaining > 0;
  const isUrgent = restTimeRemaining <= 15 && restTimeRemaining > 0;

  const progressShared = useSharedValue(1);
  const pulseAnim = useRef(new RNAnimated.Value(1)).current;
  const flashAnim = useRef(new RNAnimated.Value(1)).current;
  const prevRemaining = useRef(restTimeRemaining);

  const chipBg = colors.cardSecondary;
  const dividerColor = colors.glass.borderStrong;
  const secondaryBtnBg = colors.glass.control;
  const iconColor = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)';

  // --- Progress bar animation ---
  useEffect(() => {
    if (isActive && tracking.restTimeTotal > 0) {
      const ratio = restTimeRemaining / tracking.restTimeTotal;
      const targetRatio = Math.max(0, (restTimeRemaining - 1) / tracking.restTimeTotal);
      cancelAnimation(progressShared);
      progressShared.value = ratio;
      progressShared.value = withTiming(targetRatio, { duration: 1000, easing: Easing.linear });
    } else if (!isActive) {
      cancelAnimation(progressShared);
      progressShared.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restTimeRemaining, isActive, tracking.restTimeTotal]);

  // --- Urgent pulse ---
  useEffect(() => {
    if (isUrgent) {
      const loop = RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(pulseAnim, { toValue: 0.6, duration: 350, useNativeDriver: true }),
          RNAnimated.timing(pulseAnim, { toValue: 1.0, duration: 350, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUrgent]);

  // --- Completion: 3 flashes then auto-collapse ---
  useEffect(() => {
    if (prevRemaining.current > 0 && restTimeRemaining === 0 && tracking.showRestTimer) {
      RNAnimated.sequence([
        RNAnimated.timing(flashAnim, { toValue: 0.15, duration: 80, useNativeDriver: true }),
        RNAnimated.timing(flashAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
        RNAnimated.timing(flashAnim, { toValue: 0.15, duration: 80, useNativeDriver: true }),
        RNAnimated.timing(flashAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
        RNAnimated.timing(flashAnim, { toValue: 0.15, duration: 80, useNativeDriver: true }),
        RNAnimated.timing(flashAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
      ]).start(() => {
        setTimeout(() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          preferMinimized.current = true;
          setIsMinimized(true);
        }, 1500);
      });
    }
    prevRemaining.current = restTimeRemaining;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restTimeRemaining]);

  // --- Reset preference when workout ends ---
  useEffect(() => {
    if (!tracking.isWorkoutActive) {
      preferMinimized.current = false;
    }
  }, [tracking.isWorkoutActive]);

  // --- Apply preferred state when a new timer session starts ---
  useEffect(() => {
    if (isActive && !prevIsActive.current) {
      // Timer just became active: honour saved preference (false = open on first rest)
      setIsMinimized(preferMinimized.current);
    } else if (!isActive && prevIsActive.current) {
      // Timer just ended: reset local state (preference is preserved in ref)
      setIsMinimized(false);
    }
    prevIsActive.current = isActive;
  }, [isActive]);

  // --- Sync to context ---
  const { setIsTimerMinimized } = tracking;
  useEffect(() => {
    setIsTimerMinimized(isMinimized && isActive);
  }, [isMinimized, isActive, setIsTimerMinimized]);

  const progressAnimStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      progressShared.value,
      [0, 0.125, 0.5, 1],
      ['#ef4444', '#ef4444', '#eab308', '#22c55e'],
    );
    return {
      backgroundColor: color,
      width: `${interpolate(progressShared.value, [0, 1], [0, 100])}%` as `${number}%`,
    };
  });

  // --- Handlers ---
  const handleToggle = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsMinimized(prev => {
      const next = !prev;
      preferMinimized.current = next;
      return next;
    });
  }, []);

  const handleCancel = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    tracking.cancelRestTimer();
    setIsMinimized(false);
  }, [tracking]);

  const handlePreset = useCallback((seconds: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Only expand if no timer is running yet — never expand when already minimized
    if (!isActive) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setIsMinimized(false);
    }
    tracking.setRestPreset(seconds);
  }, [tracking, isActive]);

  const handleAdjust = useCallback((delta: number) => {
    if (!isActive) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    tracking.adjustRestTimer(delta);
  }, [tracking, isActive]);

  const handlePauseResume = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    tracking.pauseWorkout();
  }, [tracking]);

  const handleAutoRestToggle = useCallback((value: boolean) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    tracking.setAutoRestTimer(value);
  }, [tracking]);

  const countdownColor = isUrgent ? '#ef4444' : colors.text;

  return (
    <View>
      {/* ── Preset buttons — always in normal flow ── */}
      <View style={[styles.presetsRow, { marginHorizontal: 16, marginTop: 4, marginBottom: 10 }]}>
        {PRESETS.map((preset) => {
          const isPresetActive = isActive && tracking.restTimeTotal === preset.seconds;
          return (
            <TouchableOpacity
              key={preset.label}
              style={[
                styles.presetBtn,
                { backgroundColor: isPresetActive ? `${accent}18` : chipBg },
                isPresetActive && { borderColor: accent },
              ]}
              onPress={() => handlePreset(preset.seconds)}
              activeOpacity={0.7}
            >
              <Text style={[styles.presetBtnText, { color: isPresetActive ? accent : (isDark ? '#ccc' : '#555') }]}>
                {preset.label}
              </Text>
            </TouchableOpacity>
          );
        })}

        <View style={[styles.vertDivider, { backgroundColor: dividerColor }]} />

        <TouchableOpacity
          style={[styles.presetBtn, { backgroundColor: chipBg, opacity: isActive ? 1 : 0.3 }]}
          onPress={() => handleAdjust(-15)}
          activeOpacity={0.7}
          disabled={!isActive}
        >
          <Text style={[styles.presetBtnText, { color: '#ef4444' }]}>-15s</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.presetBtn, { backgroundColor: chipBg, opacity: isActive ? 1 : 0.3 }]}
          onPress={() => handleAdjust(15)}
          activeOpacity={0.7}
          disabled={!isActive}
        >
          <Text style={[styles.presetBtnText, { color: '#22c55e' }]}>+15s</Text>
        </TouchableOpacity>
      </View>

      {/* ── Expanded panel — normal flow, pushes SafeAreaView height up ── */}
      {isActive && !isMinimized && (
        <TouchableOpacity
          onPress={handleToggle}
          activeOpacity={0.95}
          style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 0 }}
        >
          {/* REST label + Auto Rest toggle */}
          <View style={styles.restLabelRow}>
            <Text style={[styles.restLabel, { color: colors.textMuted }]}>REST</Text>
            <View style={styles.autoRestRow}>
              <Text style={[styles.autoRestLabel, { color: colors.textMuted }]}>Auto Rest</Text>
              <Switch
                value={tracking.autoRestTimer}
                onValueChange={handleAutoRestToggle}
                trackColor={{ false: isDark ? '#3a3a3a' : '#d1d1d6', true: 'rgba(248,113,22,0.4)' }}
                thumbColor={'#ffffff'}
                ios_backgroundColor={isDark ? '#3a3a3a' : '#d1d1d6'}
                style={styles.autoRestSwitch}
              />
            </View>
          </View>
          <RNAnimated.Text
            style={[
              styles.countdown,
              { color: countdownColor, opacity: isUrgent ? pulseAnim : flashAnim },
              { fontVariant: ['tabular-nums'] as any },
            ]}
          >
            {formatTime(restTimeRemaining)}
          </RNAnimated.Text>

          {/* Chevron (centered) + Cancel (right-aligned) */}
          <View style={styles.chevronCancelRow}>
            <View style={{ flex: 1 }} />
            <PlatformIcon name="chevron-up" size={18} color={colors.textSecondary} strokeWidth={2.5} />
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <TouchableOpacity
                onPress={handleCancel}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* ── Minimized: centered time + chevron, cancel right-aligned ── */}
      {isActive && isMinimized && (
        <View style={styles.minimizedRow}>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={handleToggle} activeOpacity={0.7} style={styles.minimizedInner}>
            <Text style={[styles.minimizedTime, { color: colors.textSecondary }]}>
              {formatTime(restTimeRemaining)}
            </Text>
            <PlatformIcon name="chevron-down" size={18} color={colors.textSecondary} strokeWidth={2.5} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <TouchableOpacity
              onPress={handleCancel}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Progress bar — always shown when active ── */}
      {isActive && (
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, progressAnimStyle]} />
        </View>
      )}
    </View>
  );
}

export default memo(WorkoutTimerCard);

const styles = StyleSheet.create({
  presetsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  presetBtn: {
    flex: 1,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  presetBtnText: {
    fontSize: 13,
    fontFamily: 'Outfit_600SemiBold',
  },
  vertDivider: {
    width: 1,
    height: 20,
  },
  minimizedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  minimizedInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  minimizedTime: {
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
  },
  chevronCancelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
  },
  restLabelRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 2,
  },
  autoRestRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  autoRestLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.2,
  },
  autoRestSwitch: {
    transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }],
  },
  restLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 2,
  },
  countdown: {
    fontSize: 44,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -2,
    lineHeight: 50,
  },
  rightControls: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
  },
  pauseBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 5,
  },
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cancelText: {
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
  },
  secondaryBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(128,128,128,0.15)',
  },
  progressFill: {
    height: 3,
  },
});
