import React, { useCallback, useEffect, useRef, memo } from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Info, ArrowLeftRight, Trash2 } from 'lucide-react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { type RelationPropType } from 'react-native-gesture-handler/lib/typescript/components/utils';
import Animated, {
  interpolate,
  Extrapolation,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

const BTN_SIZE = 52;
const BTN_GAP = 7;
const BTN_PAD = 10;
const REVEAL_W = BTN_SIZE * 3 + BTN_GAP * 2 + BTN_PAD * 2;

interface Props {
  id: string;
  isOpen: boolean;
  onOpen: (id: string | null) => void;
  onInfo: () => void;
  onSwap: () => void;
  onDelete: () => void;
  rowBg: string;
  /**
   * External gesture that should take priority (e.g. the list/ScrollView gesture).
   */
  waitForGesture?: RelationPropType;
  /** When false, horizontal swipe is disabled (e.g. while reordering via grip drag). */
  enabled?: boolean;
  children: React.ReactNode;
}

// Individual action button — glass rounded square with color tint
function ActionButton({
  progress,
  accentColor,
  icon,
  onPress,
}: {
  progress: SharedValue<number>;
  accentColor: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  const animStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      progress.value,
      [0, 0.6, 1],
      [0.5, 1.05, 1],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      progress.value,
      [0, 0.4, 1],
      [0, 0.9, 1],
      Extrapolation.CLAMP,
    );
    return { transform: [{ scale }], opacity };
  });

  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionBtn,
        {
          backgroundColor: accentColor.replace(/[\d.]+\)$/, '0.18)'),
          borderColor: accentColor.replace(/[\d.]+\)$/, '0.4)'),
        },
        pressed && { opacity: 0.7 },
      ]}
      onPress={onPress}
      hitSlop={0}
    >
      <Animated.View style={animStyle}>{icon}</Animated.View>
    </Pressable>
  );
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
  enabled = true,
  children,
}: Props) {
  const swipeableRef = useRef<SwipeableMethods>(null);
  const progressRef = useRef<SharedValue<number> | null>(null);

  const rowAnimStyle = useAnimatedStyle(() => {
    const p = progressRef.current;
    if (!p) return { opacity: 1 };
    return {
      opacity: interpolate(p.value, [0, 0.35, 1], [1, 0.6, 0], Extrapolation.CLAMP),
    };
  });

  useEffect(() => {
    if (!enabled) {
      swipeableRef.current?.close();
    }
  }, [enabled]);

  // Close this row when another row becomes the open one
  useEffect(() => {
    if (!isOpen) {
      swipeableRef.current?.close();
    }
  }, [isOpen]);

  const handleSwipeOpen = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onOpen(id);
  }, [id, onOpen]);

  const handleSwipeClose = useCallback(() => {
    onOpen(null);
  }, [onOpen]);

  const handleInfo = useCallback(() => {
    swipeableRef.current?.close();
    onInfo();
  }, [onInfo]);

  const handleSwap = useCallback(() => {
    swipeableRef.current?.close();
    onSwap();
  }, [onSwap]);

  const handleDelete = useCallback(() => {
    swipeableRef.current?.close();
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    onDelete();
  }, [onDelete]);

  const renderRightActions = useCallback(
    (progress: SharedValue<number>) => {
      progressRef.current = progress;
      return (<View style={styles.actionsContainer}>
        <ActionButton
          progress={progress}
          accentColor="rgba(10,132,255,0.82)"
          icon={<Info size={19} color="rgba(10,132,255,0.9)" strokeWidth={2} />}
          onPress={handleInfo}
        />
        <ActionButton
          progress={progress}
          accentColor="rgba(255,159,10,0.82)"
          icon={<ArrowLeftRight size={19} color="rgba(255,159,10,0.9)" strokeWidth={2} />}
          onPress={handleSwap}
        />
        <ActionButton
          progress={progress}
          accentColor="rgba(255,69,58,0.82)"
          icon={<Trash2 size={19} color="rgba(255,69,58,0.9)" strokeWidth={2} />}
          onPress={handleDelete}
        />
      </View>);
    },
    [handleInfo, handleSwap, handleDelete],
  );

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={REVEAL_W / 2}
      overshootRight={false}
      enableTrackpadTwoFingerGesture={false}
      friction={1}
      onSwipeableOpen={handleSwipeOpen}
      onSwipeableClose={handleSwipeClose}
      // Run simultaneously with the scroll gesture instead of waiting for it to
      // fail — the pan wins on horizontal movement, scroll wins on vertical.
      simultaneousWithExternalGesture={waitForGesture}
      enabled={enabled}
      // Lower threshold so RNGH activates (and cancels the Pressable's JS
      // responder) after just 5 px of horizontal travel instead of the default 10.
      dragOffsetFromRightEdge={5}
      dragOffsetFromLeftEdge={5}
      animationOptions={{
        mass: 0.5,
        damping: 40,
        stiffness: 500,
        overshootClamping: true,
      }}
      containerStyle={styles.container}
    >
      <Animated.View style={[styles.rowFront, { backgroundColor: rowBg }, rowAnimStyle]}>{children}</Animated.View>
    </ReanimatedSwipeable>
  );
}

export default memo(SwipeableExerciseRow);

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  rowFront: {
    alignSelf: 'stretch',
    width: '100%',
  },
  actionsContainer: {
    width: REVEAL_W,
    flexDirection: 'row',
    alignItems: 'center',
    gap: BTN_GAP,
    paddingHorizontal: BTN_PAD,
  },
  actionBtn: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
