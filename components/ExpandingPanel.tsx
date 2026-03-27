/**
 * ExpandingPanel — instant open, short fade on close (no height animation).
 *
 * Height animation caused layout jumps because measured height wasn't ready on
 * the first frame. Opacity + natural layout height avoids that; open is not
 * faded so parent toggles (log sets, etc.) feel immediate.
 */
import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

/** Opening is immediate so toggles (e.g. log sets) feel snappy; closing keeps a short fade. */
const FADE_OUT_DURATION = 120;
const BEZIER = Easing.bezier(0.4, 0, 0.2, 1);

interface Props {
  visible: boolean;
  children: React.ReactNode;
}

export default function ExpandingPanel({ visible, children }: Props) {
  const opacitySV = useSharedValue(visible ? 1 : 0);
  const [mounted, setMounted] = useState(visible);

  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  // Cache last non-null children so content stays during close fade.
  const savedChildren = useRef<React.ReactNode>(children);
  if (children != null) {
    savedChildren.current = children;
  }

  useEffect(() => {
    if (visible) {
      setMounted(true);
      opacitySV.value = 1;
    } else {
      opacitySV.value = withTiming(0, { duration: FADE_OUT_DURATION, easing: BEZIER }, (finished) => {
        if (finished && !visibleRef.current) {
          runOnJS(setMounted)(false);
        }
      });
    }
  }, [visible, opacitySV]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacitySV.value,
  }), []);

  if (!mounted) return null;

  return (
    <Animated.View
      style={[styles.container, animStyle]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      {children ?? savedChildren.current}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});
