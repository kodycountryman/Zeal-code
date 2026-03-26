import React, { useCallback, useEffect, memo } from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Info, ArrowLeftRight, Trash2 } from 'lucide-react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const BTN_W = 64;
const REVEAL_W = BTN_W * 3;
const SNAP_THRESHOLD = 30;
const DELETE_THRESHOLD = REVEAL_W + 80;

interface Props {
  id: string;
  isOpen: boolean;
  onOpen: (id: string | null) => void;
  onInfo: () => void;
  onSwap: () => void;
  onDelete: () => void;
  rowBg: string;
  /**
   * External gesture that should take priority (eg the list/ScrollView gesture).
   * We wire this via requireExternalGestureToFail which is the gesture-handler equivalent of waitFor={...}.
   */
  waitForGesture?: Parameters<ReturnType<typeof Gesture.Pan>['requireExternalGestureToFail']>[0];
  children: React.ReactNode;
}

function SwipeableExerciseRow({
  id,
  isOpen,
  onOpen,
  onInfo,
  onSwap,
  onDelete,
  rowBg,
  waitForGesture,
  children,
}: Props) {
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);
  const hardPullProgress = useSharedValue(0);
  const revealProgress = useDerivedValue(() => {
    const v = Math.abs(translateX.value) / REVEAL_W;
    return clamp(v, 0, 1);
  });
  const isOpenSV = useSharedValue(false);
  const hardHapticFired = useSharedValue(false);

  const closeRow = useCallback((animated = true) => {
    isOpenSV.value = false;
    if (animated) {
      translateX.value = withSpring(0, { damping: 24, stiffness: 380, mass: 0.7 });
    } else {
      translateX.value = 0;
    }
    hardPullProgress.value = withTiming(0, { duration: 150 });
  }, [hardPullProgress, isOpenSV, translateX]);

  // Snap close when another row opens (isOpen toggled to false externally)
  useEffect(() => {
    if (!isOpen) closeRow(true);
  }, [isOpen, closeRow]);

  const iconScale = useDerivedValue(() => (
    interpolate(revealProgress.value, [0, 0.6, 1], [0.4, 1.1, 1], Extrapolation.CLAMP)
  ));
  const deleteBg = useDerivedValue(() => (
    hardPullProgress.value > 0.5 ? '#e53935' : '#c0392b'
  ));

  const rowAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    // Transparent so ambient glow / background shows through the list
    backgroundColor: 'transparent',
  }));

  const actionsAnimatedStyle = useAnimatedStyle(() => ({
    // Fade buttons in only as the user swipes — at rest they're invisible
    opacity: clamp(revealProgress.value * 2, 0, 1),
  }));

  const deleteBtnAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: deleteBg.value,
  }));

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const handleInfo = useCallback(() => {
    closeRow(true);
    onInfo();
  }, [closeRow, onInfo]);

  const handleSwap = useCallback(() => {
    closeRow(true);
    onSwap();
  }, [closeRow, onSwap]);

  const handleDelete = useCallback(() => {
    onDelete();
  }, [onDelete]);

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10]) // locks into horizontal swipe after 10px
    .failOffsetY([-8, 8]) // fails quickly on vertical movement (closest equivalent to failVerticalPointers)
    .onBegin(() => {
      startX.value = translateX.value;
      hardHapticFired.value = false;
    })
    .onUpdate((e) => {
      const next = Math.min(0, startX.value + e.translationX);
      translateX.value = next;

      const progress = clamp((Math.abs(next) - REVEAL_W) / (DELETE_THRESHOLD - REVEAL_W), 0, 1);
      hardPullProgress.value = progress;

      if (Math.abs(next) >= DELETE_THRESHOLD) {
        if (!hardHapticFired.value) {
          hardHapticFired.value = true;
          if (Platform.OS !== 'web') {
            runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Heavy);
          }
        }
      } else {
        hardHapticFired.value = false;
      }
    })
    .onEnd((e) => {
      const currentX = translateX.value;
      const hardPull = Math.abs(currentX) >= DELETE_THRESHOLD;
      if (hardPull) {
        if (Platform.OS !== 'web') {
          runOnJS(Haptics.notificationAsync)(Haptics.NotificationFeedbackType.Warning);
        }
        translateX.value = withTiming(-600, { duration: 200 }, () => {
          runOnJS(onDelete)();
        });
        return;
      }

      const shouldOpen = Math.abs(currentX) > SNAP_THRESHOLD || e.velocityX < -500;
      if (shouldOpen) {
        isOpenSV.value = true;
        translateX.value = withSpring(-REVEAL_W, { damping: 20, stiffness: 360, mass: 0.7 });
        runOnJS(onOpen)(id);
      } else {
        isOpenSV.value = false;
        translateX.value = withSpring(0, { damping: 24, stiffness: 400, mass: 0.7 });
        hardPullProgress.value = withTiming(0, { duration: 200 });
        runOnJS(onOpen)(null);
      }
    });

  if (waitForGesture) {
    pan.requireExternalGestureToFail(waitForGesture);
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.actions, actionsAnimatedStyle]} pointerEvents="box-none">
        <Pressable
          style={({ pressed }) => [styles.infoBtn, pressed && { opacity: 0.75 }]}
          onPress={handleInfo}
        >
          <Animated.View style={iconAnimatedStyle}>
            <Info size={20} color="#ffffff" strokeWidth={2.2} />
          </Animated.View>
        </Pressable>

        <View style={[styles.divider, { left: BTN_W }]} />

        <Pressable
          style={({ pressed }) => [styles.swapBtn, pressed && { opacity: 0.75 }]}
          onPress={handleSwap}
        >
          <Animated.View style={iconAnimatedStyle}>
            <ArrowLeftRight size={20} color="#ffffff" strokeWidth={2.2} />
          </Animated.View>
        </Pressable>

        <View style={[styles.divider, { left: BTN_W * 2 }]} />

        <Animated.View style={[styles.deleteBtn, deleteBtnAnimatedStyle]}>
          <Pressable
            style={({ pressed }) => [styles.deleteBtnInner, pressed && { opacity: 0.75 }]}
            onPress={handleDelete}
          >
            <Animated.View style={iconAnimatedStyle}>
              <Trash2 size={20} color="#ffffff" strokeWidth={2.2} />
            </Animated.View>
          </Pressable>
        </Animated.View>
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.rowContent, rowAnimatedStyle]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

export default memo(SwipeableExerciseRow);

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  actions: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    width: REVEAL_W,
  },
  infoBtn: {
    width: BTN_W,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1d6fce',
  },
  swapBtn: {
    width: BTN_W,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#b8600a',
  },
  deleteBtn: {
    width: BTN_W,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  deleteBtnInner: {
    flex: 1,
    width: '100%' as const,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    width: 1,
    top: 8,
    bottom: 8,
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  rowContent: {
    width: '100%' as const,
  },
});
