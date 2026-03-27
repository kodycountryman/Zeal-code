/**
 * Swift-like spring for React Native Animated.spring — fast, minimal bounce.
 * Use with spread: Animated.spring(anim, { toValue: 1, ...SWIFT_SPRING }).start();
 */
export const SWIFT_SPRING = {
  speed: 20,
  bounciness: 4,
  useNativeDriver: true as const,
};

/** Reanimated withSpring — similar snappy feel (tune stiffness/damping). */
export const SWIFT_REANIMATED_SPRING = {
  damping: 28,
  stiffness: 320,
  mass: 0.65,
} as const;
