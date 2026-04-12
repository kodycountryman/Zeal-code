import React, { useCallback, useEffect, useRef, memo } from 'react';
import { View, Pressable, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { PlatformIcon } from '@/components/PlatformIcon';
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

const BTN_W = 64;
const BTN_PAD = 8;
const REVEAL_W = BTN_W + BTN_PAD * 2;

interface Props {
  id: string;
  isOpen: boolean;
  onOpen: (id: string | null) => void;
  onDelete: () => void;
  waitForGesture?: RelationPropType;
  children: React.ReactNode;
}

function DeleteButton({
  progress,
  onPress,
}: {
  progress: SharedValue<number>;
  onPress: () => void;
}) {
  const animStyle = useAnimatedStyle(() => {
    const scale = interpolate(progress.value, [0, 0.6, 1], [0.5, 1.05, 1], Extrapolation.CLAMP);
    const opacity = interpolate(progress.value, [0, 0.4, 1], [0, 0.9, 1], Extrapolation.CLAMP);
    return { transform: [{ scale }], opacity };
  });

  return (
    <Pressable
      style={({ pressed }) => [{
        width: BTN_W,
        height: '100%' as any,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,69,58,0.15)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,69,58,0.35)',
      }, pressed && { opacity: 0.7 }]}
      onPress={onPress}
    >
      <Animated.View style={animStyle}>
        <PlatformIcon name="trash" size={17} color="rgba(255,69,58,0.9)" strokeWidth={2} />
      </Animated.View>
    </Pressable>
  );
}

function SwipeableSetRow({ id, isOpen, onOpen, onDelete, waitForGesture, children }: Props) {
  const swipeableRef = useRef<SwipeableMethods>(null);
  const progressRef = useRef<SharedValue<number> | null>(null);

  useEffect(() => {
    if (!isOpen) swipeableRef.current?.close();
  }, [isOpen]);

  const handleSwipeOpen = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onOpen(id);
  }, [id, onOpen]);

  const handleSwipeClose = useCallback(() => onOpen(null), [onOpen]);

  const handleDelete = useCallback(() => {
    swipeableRef.current?.close();
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onDelete();
  }, [onDelete]);

  const renderRightActions = useCallback((progress: SharedValue<number>) => {
    progressRef.current = progress;
    return (
      <View style={{ width: REVEAL_W, alignItems: 'center', justifyContent: 'center', paddingHorizontal: BTN_PAD }}>
        <DeleteButton progress={progress} onPress={handleDelete} />
      </View>
    );
  }, [handleDelete]);

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
      simultaneousWithExternalGesture={waitForGesture}
      dragOffsetFromRightEdge={5}
      dragOffsetFromLeftEdge={5}
      animationOptions={{ mass: 0.5, damping: 40, stiffness: 500, overshootClamping: true }}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

export default memo(SwipeableSetRow);
