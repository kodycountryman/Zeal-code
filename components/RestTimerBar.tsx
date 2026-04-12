import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PanResponder, Switch } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
  interpolateColor,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme } from '@/context/AppContext';
import { useWorkoutTracking, useRestTimeRemaining } from '@/context/WorkoutTrackingContext';
import { SWIFT_REANIMATED_SPRING } from '@/constants/animation';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const PRESETS = [
  { label: '1m', seconds: 60 },
  { label: '1.5m', seconds: 90 },
  { label: '2m', seconds: 120 },
] as const;

function RestTimerBar() {
  const { isDark } = useZealTheme();
  const tracking = useWorkoutTracking();
  const restTimeRemaining = useRestTimeRemaining();

  const progressShared = useSharedValue(1);
  const expandShared = useSharedValue(0);

  const [isMinimized, setIsMinimized] = useState(false);

  const shouldRender = tracking.showRestTimer && tracking.isWorkoutActive;
  const isActive = shouldRender && tracking.isRestActive && restTimeRemaining > 0;
  const isUrgent = restTimeRemaining <= 15 && restTimeRemaining > 0;

  const handleToggle = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsMinimized(prev => !prev);
  }, []);

  const handleCancel = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    tracking.cancelRestTimer();
  }, [tracking]);

  const handlePreset = useCallback((seconds: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    tracking.setRestPreset(seconds);
  }, [tracking]);

  const handleAdjust = useCallback((delta: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    tracking.adjustRestTimer(delta);
  }, [tracking]);

  const handleAutoRestToggle = useCallback((value: boolean) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    tracking.setAutoRestTimer(value);
  }, [tracking]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 8,
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 25) {
          setIsMinimized(true);
        } else if (gs.dy < -25) {
          setIsMinimized(false);
        }
      },
    })
  ).current;

  const chevronColor2 = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)';

  useEffect(() => {
    if (!shouldRender) return;
    if (isActive && tracking.restTimeTotal > 0) {
      const ratio = restTimeRemaining / tracking.restTimeTotal;
      const targetRatio = Math.max(0, (restTimeRemaining - 1) / tracking.restTimeTotal);
      cancelAnimation(progressShared);
      progressShared.value = ratio;
      progressShared.value = withTiming(targetRatio, {
        duration: 1000,
        easing: Easing.linear,
      });
    } else {
      cancelAnimation(progressShared);
      progressShared.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restTimeRemaining, isActive, tracking.restTimeTotal, shouldRender]);

  useEffect(() => {
    const shouldExpand = isActive && !isMinimized;
    if (shouldExpand) {
      expandShared.value = withSpring(1, SWIFT_REANIMATED_SPRING);
    } else {
      expandShared.value = withSpring(0, SWIFT_REANIMATED_SPRING);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, isMinimized]);

  useEffect(() => {
    if (!isActive) {
      setIsMinimized(false);
    }
  }, [isActive]);

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
    const widthPct = interpolate(progressShared.value, [0, 1], [0, 100]);
    return {
      backgroundColor: color,
      width: `${widthPct}%` as `${number}%`,
    };
  });

  const clockAnimStyle = useAnimatedStyle(() => ({
    maxHeight: interpolate(expandShared.value, [0, 1], [0, 108]),
    opacity: expandShared.value,
    overflow: 'hidden' as const,
  }));

  const cardBg = isDark ? 'rgba(22,22,22,0.98)' : 'rgba(255,255,255,0.98)';
  const chipBg = isDark ? '#2a2a2a' : '#d8d8d8';
  const countdownColor = isUrgent ? '#ef4444' : (isDark ? '#ffffff' : '#111111');
  const dividerColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';

  if (!shouldRender) return null;

  const CardContent = () => (
    <>
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, progressAnimStyle]} />
      </View>

      <Animated.View style={[styles.clockSection, clockAnimStyle]}>
        <View style={styles.clockRow}>
          <Text style={[styles.countdown, { color: countdownColor }]}>
            {formatTime(restTimeRemaining)}
          </Text>
          <View style={styles.clockSpacer} />
          <TouchableOpacity
            onPress={handleCancel}
            activeOpacity={0.7}
            style={[styles.cancelPill, { backgroundColor: isDark ? '#333' : '#ddd' }]}
          >
            <Text style={[styles.cancelPillText, { color: isDark ? '#aaa' : '#555' }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleToggle}
            activeOpacity={0.6}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.chevronBtn}
            {...panResponder.panHandlers}
          >
            {isMinimized ? (
              <PlatformIcon name="chevron-up" size={22} color={chevronColor2} strokeWidth={3.5} />
            ) : (
              <PlatformIcon name="chevron-down" size={22} color={chevronColor2} strokeWidth={3.5} />
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>

      <View style={styles.topRow}>
        <Text style={[styles.restLabel, { color: isDark ? '#888' : '#777' }]}>REST TIMER</Text>
        <View style={styles.topRowRight}>
          {isActive && isMinimized ? (
            <>
              <TouchableOpacity
                onPress={handleCancel}
                activeOpacity={0.7}
                style={[styles.cancelPillSmall, { backgroundColor: isDark ? '#333' : '#ddd' }]}
              >
                <Text style={[styles.cancelPillSmallText, { color: isDark ? '#aaa' : '#555' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleToggle}
                activeOpacity={0.6}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.expandChevronBtn}
              >
                <PlatformIcon name="chevron-up" size={20} color={chevronColor2} strokeWidth={3} />
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.autoRestRow}>
              <Text style={[styles.autoRestLabel, { color: isDark ? '#888' : '#777' }]}>Auto Rest</Text>
              <Switch
                value={tracking.autoRestTimer}
                onValueChange={handleAutoRestToggle}
                trackColor={{ false: isDark ? '#3a3a3a' : '#d1d1d6', true: 'rgba(248,113,22,0.4)' }}
                thumbColor={tracking.autoRestTimer ? '#f87116' : (isDark ? '#888' : '#aaa')}
                ios_backgroundColor={isDark ? '#3a3a3a' : '#d1d1d6'}
                style={styles.autoRestSwitch}
              />
            </View>
          )}
        </View>
      </View>

      <View style={styles.buttonsRow}>
        <View style={styles.leftGroup}>
          {PRESETS.map((preset) => {
            const isPresetActive = isActive && tracking.restTimeTotal === preset.seconds;
            return (
              <TouchableOpacity
                key={preset.label}
                style={[
                  styles.btn,
                  { backgroundColor: isPresetActive ? 'rgba(248,113,22,0.15)' : chipBg },
                  isPresetActive && styles.btnActive,
                ]}
                onPress={() => handlePreset(preset.seconds)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.btnText,
                    { color: isPresetActive ? '#f87116' : (isDark ? '#ccc' : '#444') },
                    isPresetActive && styles.btnTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {preset.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.divider, { backgroundColor: dividerColor }]} />

        <View style={styles.rightGroup}>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: chipBg }]}
            onPress={() => handleAdjust(-15)}
            activeOpacity={0.7}
          >
            <Text style={[styles.btnText, { color: '#f87116' }]} numberOfLines={1}>-15s</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: chipBg }]}
            onPress={() => handleAdjust(15)}
            activeOpacity={0.7}
          >
            <Text style={[styles.btnText, { color: '#22c55e' }]} numberOfLines={1}>+15s</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ height: 6 }} />
    </>
  );

  return (
    <View style={styles.outerWrap}>
      <View style={[styles.card, { backgroundColor: cardBg }]}>
        <CardContent />
      </View>
    </View>
  );
}

export default memo(RestTimerBar);

const styles = StyleSheet.create({
  outerWrap: {
    width: '100%',
    marginBottom: 22,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    paddingBottom: 10,
  },
  progressTrack: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(128,128,128,0.15)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
  },
  clockSection: {
    overflow: 'hidden',
  },
  clockRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    gap: 0,
  },
  clockSpacer: {
    flex: 1,
  },
  chevronBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
    marginLeft: 8,
    padding: 4,
  },
  countdown: {
    fontSize: 52,
    fontWeight: '800' as const,
    letterSpacing: -2,
    lineHeight: 62,
  },
  cancelPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  cancelPillText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  cancelPillSmall: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
  },
  cancelPillSmallText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  restLabel: {
    fontSize: 10,
    fontWeight: '800' as const,
    letterSpacing: 1.5,
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  leftGroup: {
    flex: 3,
    flexDirection: 'row',
    gap: 5,
  },
  divider: {
    width: 1,
    height: 28,
    marginHorizontal: 8,
  },
  rightGroup: {
    flex: 2,
    flexDirection: 'row',
    gap: 5,
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  btnActive: {
    borderColor: '#f87116',
  },
  btnText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  btnTextActive: {
    fontWeight: '700' as const,
  },
  topRowRight: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  expandChevronBtn: {
    padding: 4,
  },
  autoRestRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  autoRestLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.3,
  },
  autoRestSwitch: {
    transform: [{ scaleX: 0.78 }, { scaleY: 0.78 }],
  },
});
