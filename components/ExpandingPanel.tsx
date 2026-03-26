/**
 * ExpandingPanel — smooth "unroll from top" expansion animation.
 *
 * Strategy:
 *  - Inner content is absolutely positioned so it renders at its natural height
 *    regardless of the outer container's animated height.
 *  - overflow: 'hidden' on the outer Animated.View clips the content as it
 *    unrolls, giving a true reveal-from-top effect with no layout shift.
 *  - The last non-null children are cached so the content stays visible during
 *    the close animation (avoids an abrupt disappear-then-shrink sequence).
 *  - Easing: cubic-bezier(0.4, 0, 0.2, 1) — Material Design standard curve.
 *
 * Bug fixes vs original implementation:
 *  1. Removed the `changed` guard in onLayout — it prevented reopening when
 *     measuredH already equalled the new height after a close/remount cycle.
 *  2. visibleRef guards the close-animation callback so it never unmounts the
 *     panel if visible has already flipped back to true (rapid open/close race).
 *  3. When visible flips to true and we already have a measurement, we animate
 *     immediately from the effect rather than waiting for a new onLayout event.
 */
import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const DURATION = 280;
const BEZIER = Easing.bezier(0.4, 0, 0.2, 1);

interface Props {
  visible: boolean;
  children: React.ReactNode;
}

export default function ExpandingPanel({ visible, children }: Props) {
  const heightSV = useSharedValue(0);
  const measuredH = useRef(0);
  const [mounted, setMounted] = useState(visible);

  // Track latest visible without stale-closure issues inside worklet callbacks.
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  // Always cache the last non-null children so the content stays
  // visible during the closing animation instead of vanishing instantly.
  const savedChildren = useRef<React.ReactNode>(children);
  if (children != null) {
    savedChildren.current = children;
  }

  useEffect(() => {
    if (visible) {
      setMounted(true);
      // If we already have a prior measurement (i.e. this is a re-open after
      // a previous close), animate open immediately. Otherwise onLayout will
      // fire once the freshly-mounted content has laid out and trigger the
      // animation from there.
      if (measuredH.current > 0) {
        heightSV.value = withTiming(measuredH.current, { duration: DURATION, easing: BEZIER });
      }
    } else {
      heightSV.value = withTiming(0, { duration: DURATION, easing: BEZIER }, (finished) => {
        // Guard: only unmount if visible hasn't flipped back to true while the
        // close animation was running (rapid open→close→open race condition).
        if (finished && !visibleRef.current) {
          runOnJS(setMounted)(false);
        }
      });
    }
  }, [visible, heightSV]);

  // Measure the inner content's natural height and animate the outer
  // container to match it on open (or when content size changes while open).
  // The `changed` guard has been intentionally removed: without it, a
  // remounted panel (same content height as before) still triggers the
  // open animation correctly.
  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      if (h <= 0) return;
      measuredH.current = h;
      if (visible) {
        heightSV.value = withTiming(h, { duration: DURATION, easing: BEZIER });
      }
    },
    [visible, heightSV],
  );

  const outerStyle = useAnimatedStyle(
    () => ({ height: heightSV.value, overflow: 'hidden' }),
    [],
  );

  return (
    <Animated.View style={outerStyle}>
      {mounted && (
        <View
          style={styles.inner}
          onLayout={onLayout}
          pointerEvents={visible ? 'box-none' : 'none'}
        >
          {children ?? savedChildren.current}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  inner: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
});
