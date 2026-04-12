import React, { useCallback, useEffect, useRef, memo } from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { PlatformIcon } from '@/components/PlatformIcon';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  interpolate,
  Extrapolation,
  useAnimatedStyle,
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
  /** When false, horizontal swipe is disabled (e.g. while reordering via grip drag). */
  enabled?: boolean;
  children: React.ReactNode;
}

// Individual action button — glass rounded square with color tint
function ActionButton({
  progress,
  icon,
  onPress,
}: {
  progress: SharedValue<number>;
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
      [0, 0, 1],
      [0, 0.9, 1],
      Extrapolation.CLAMP,
    );
    return { transform: [{ scale }], opacity };
  });

  return (
    <Pressable
      style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
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
  enabled = true,
  children,
}: Props) {
  const swipeableRef = useRef<SwipeableMethods>(null);

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
      return (<View style={styles.actionsContainer}>
        <ActionButton
          progress={progress}
          icon={<PlatformIcon name="info" size={22} color="rgba(10,132,255,0.9)" strokeWidth={2} />}
          onPress={handleInfo}
        />
        <ActionButton
          progress={progress}
          icon={<PlatformIcon name="arrow-left-right" size={22} color="rgba(255,159,10,0.9)" strokeWidth={2} />}
          onPress={handleSwap}
        />
        <ActionButton
          progress={progress}
          icon={<PlatformIcon name="trash" size={22} color="rgba(255,69,58,0.9)" strokeWidth={2} />}
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
      enabled={enabled}
      activeOffsetX={[-8, 8]}
      failOffsetY={[-5, 5]}
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
      <View style={[styles.rowFront, { backgroundColor: rowBg }]}>{children}</View>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
});
