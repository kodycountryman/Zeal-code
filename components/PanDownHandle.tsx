/**
 * PanDownHandle — a drag-handle bar for custom Modal components.
 *
 * Renders the visual pill handle AND wraps it in a PanResponder so that
 * a downward swipe (dy > threshold OR fast velocity) triggers onDismiss.
 *
 * Usage:
 *   <PanDownHandle onDismiss={onClose} />
 *
 * Place this at the very top of your modal sheet content.
 */
import React, { useRef } from 'react';
import { View, StyleSheet, PanResponder, Animated } from 'react-native';

interface Props {
  onDismiss: () => void;
  /** Pixel distance down before auto-dismiss. Default: 80 */
  threshold?: number;
  /** Velocity in px/s for snap-dismiss. Default: 600 */
  velocityThreshold?: number;
  /** Color of the pill handle indicator */
  indicatorColor?: string;
}

export default function PanDownHandle({
  onDismiss,
  threshold = 80,
  velocityThreshold = 600,
  indicatorColor = 'rgba(128,128,128,0.4)',
}: Props) {
  const translateY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, gs) => gs.dy > 5 && Math.abs(gs.dx) < Math.abs(gs.dy),
      onPanResponderMove: (_e, gs) => {
        if (gs.dy > 0) {
          translateY.setValue(gs.dy);
        }
      },
      onPanResponderRelease: (_e, gs) => {
        if (gs.dy > threshold || gs.vy > velocityThreshold / 1000) {
          Animated.timing(translateY, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }).start();
          onDismiss();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            stiffness: 300,
            damping: 30,
          }).start();
        }
      },
    })
  ).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[styles.hitArea, { transform: [{ translateY }] }]}
    >
      <View style={[styles.pill, { backgroundColor: indicatorColor }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hitArea: {
    width: '100%',
    paddingTop: 8,
    paddingBottom: 12,
    alignItems: 'center',
    zIndex: 10,
  },
  pill: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
});
