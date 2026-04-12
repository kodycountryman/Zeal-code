import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as Haptics from 'expo-haptics';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated as RNAnimated,
  Platform,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
  interpolate,
  interpolateColor,
  runOnJS,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useRouter, usePathname } from 'expo-router';
import { PlatformIcon } from '@/components/PlatformIcon';
import type { AppIconName } from '@/constants/iconMap';
import { showProGate, PRO_GOLD, PRO_LOCKED_OPACITY } from '@/services/proGate';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useZealTheme } from '@/context/AppContext';
import { getContrastTextColor } from '@/constants/colors';
import { useTourTarget } from '@/context/AppTourContext';
import { useWorkoutTracking } from '@/context/WorkoutTrackingContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { SWIFT_SPRING, SWIFT_REANIMATED_SPRING } from '@/constants/animation';

type TabDef = {
  key: 'home' | 'workout' | 'coach' | 'nutrition';
  label: string;
  route: '/' | '/workout' | '/coach' | '/nutrition';
  iconName: AppIconName;
  testID: string;
};

const TABS: TabDef[] = [
  { key: 'home', label: 'Home', route: '/', iconName: 'home', testID: 'dock-home' },
  { key: 'workout', label: 'Workout', route: '/workout', iconName: 'dumbbell', testID: 'dock-workout' },
  { key: 'coach', label: 'Coach', route: '/coach', iconName: 'brain', testID: 'dock-coach' },
  { key: 'nutrition', label: 'Nutrition', route: '/nutrition', iconName: 'apple', testID: 'dock-nutrition' },
];

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function FloatingDock() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors, accent, isDark } = useZealTheme();
  const tracking = useWorkoutTracking();
  const { hasPro, openPaywall } = useSubscription();

  const [menuOpen, setMenuOpen] = useState(false);
  // Legacy RN Animated for the menu modal (unchanged from previous version)
  const fadeAnim = useRef(new RNAnimated.Value(0)).current;
  const slideAnim = useRef(new RNAnimated.Value(30)).current;

  // AppTour refs — keep the test IDs so the tour still finds these targets.
  const tourHomeRef = useTourTarget('dock-home');
  const tourWorkoutRef = useTourTarget('dock-workout');
  const tourPlusRef = useTourTarget('dock-plus');

  // ───── Theme-derived colors ─────
  const bgHex = colors.background;
  const r = parseInt(bgHex.slice(1, 3), 16);
  const g = parseInt(bgHex.slice(3, 5), 16);
  const b = parseInt(bgHex.slice(5, 7), 16);
  const darkGradient: [string, string, string, string, string] = [
    `rgba(${r},${g},${b},1)`,
    `rgba(${r},${g},${b},0.96)`,
    `rgba(${r},${g},${b},0.75)`,
    `rgba(${r},${g},${b},0.3)`,
    `rgba(${r},${g},${b},0)`,
  ];
  const gradientHeight = 180;

  const dockBlurTint = isDark ? 'dark' : 'light';
  const dockBorderColor = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
  const dockInnerStroke = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)';
  const inactiveIconColor = isDark ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.42)';

  // ───── Active tab index (derived from pathname) ─────
  const activeIndex = useMemo(() => {
    const idx = TABS.findIndex((t) => {
      if (t.route === '/') return pathname === '/' || pathname === '/index';
      return pathname === t.route;
    });
    return idx === -1 ? 0 : idx;
  }, [pathname]);

  // ───── Pill layout (measured via onLayout) ─────
  const [pillInnerWidth, setPillInnerWidth] = useState(0);
  const tabWidth = pillInnerWidth / TABS.length;

  // ───── Shared values driving the bubble ─────
  // bubbleX is measured in "slot units" (0..TABS.length-1) so it's layout-independent.
  // We multiply by tabWidth inside useAnimatedStyle for the actual px translation.
  const bubbleX = useSharedValue<number>(activeIndex);
  // Dragging flag — when true, suppress the useEffect snap so the user's finger owns the bubble.
  const isDragging = useSharedValue<boolean>(false);
  // Start-of-pan snapshot
  const dragStart = useSharedValue<number>(0);
  // Plain-JS mirror of the ref so onLayout only snaps once on first measure
  const hasMeasured = useRef(false);

  // When the route changes (via tap, deep link, or drag-release), spring bubble to that tab.
  // Skip animation on the very first measurement so the bubble mounts exactly under the active tab.
  useEffect(() => {
    if (!hasMeasured.current) return;
    if (isDragging.value) return;
    bubbleX.value = withSpring(activeIndex, SWIFT_REANIMATED_SPRING);
  }, [activeIndex, bubbleX, isDragging]);

  const onPillLayout = (e: LayoutChangeEvent) => {
    // Measure the BlurView's inner content width (= layout.width - horizontal padding).
    // paddingHorizontal: 4 on each side → subtract 8.
    const w = e.nativeEvent.layout.width - 8;
    if (w > 0 && w !== pillInnerWidth) {
      setPillInnerWidth(w);
      if (!hasMeasured.current) {
        // First measure — snap without animation so mount doesn't spring from 0
        bubbleX.value = activeIndex;
        hasMeasured.current = true;
      }
    }
  };

  // ───── Bubble animated style (translateX in px) ─────
  const bubbleAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: bubbleX.value * tabWidth }],
      width: tabWidth > 0 ? tabWidth : 0,
    };
  }, [tabWidth]);

  // ───── Menu helpers (unchanged) ─────
  const openMenu = () => {
    setMenuOpen(true);
    RNAnimated.parallel([
      RNAnimated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      RNAnimated.spring(slideAnim, { toValue: 0, ...SWIFT_SPRING }),
    ]).start();
  };

  const closeMenu = () => {
    RNAnimated.parallel([
      RNAnimated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      RNAnimated.spring(slideAnim, { toValue: 30, ...SWIFT_SPRING }),
    ]).start(() => setMenuOpen(false));
  };

  const handlePlusPress = () => {
    if (menuOpen) {
      closeMenu();
    } else {
      if (typeof Haptics !== 'undefined') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      openMenu();
    }
  };

  // ───── Navigation helpers ─────
  const navigateToTab = (index: number) => {
    const tab = TABS[index];
    if (!tab) return;
    closeMenu();
    router.push(tab.route);
  };

  const fireSelectionHaptic = () => {
    if (typeof Haptics !== 'undefined') {
      void Haptics.selectionAsync();
    }
  };

  const handleTabTap = (index: number) => {
    if (index === activeIndex) {
      // Re-tap current tab: just nav (in case of stacked screens), no haptic
      navigateToTab(index);
      return;
    }
    fireSelectionHaptic();
    // Spring immediately toward the tapped index for responsive feel
    bubbleX.value = withSpring(index, SWIFT_REANIMATED_SPRING);
    navigateToTab(index);
  };

  // ───── Pan gesture: drag bubble between tabs ─────
  const panGesture = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .failOffsetY([-12, 12])
    .onStart(() => {
      isDragging.value = true;
      dragStart.value = bubbleX.value;
    })
    .onUpdate((e) => {
      if (tabWidth <= 0) return;
      const next = dragStart.value + e.translationX / tabWidth;
      // Clamp to [0, TABS.length - 1]
      if (next < 0) {
        bubbleX.value = 0;
      } else if (next > TABS.length - 1) {
        bubbleX.value = TABS.length - 1;
      } else {
        bubbleX.value = next;
      }
    })
    .onEnd(() => {
      const nearest = Math.round(bubbleX.value);
      const clamped = Math.max(0, Math.min(TABS.length - 1, nearest));
      bubbleX.value = withSpring(clamped, SWIFT_REANIMATED_SPRING);
      isDragging.value = false;
      if (clamped !== activeIndex) {
        runOnJS(fireSelectionHaptic)();
        runOnJS(navigateToTab)(clamped);
      }
    });

  const menuItems = [
    { icon: <PlatformIcon name="hammer" size={20} color={accent} />, label: 'Build Workout', onPress: () => { closeMenu(); setTimeout(() => tracking.setBuildWorkoutVisible(true), 100); }, locked: false },
    {
      icon: <PlatformIcon name="sparkles" size={20} color={hasPro ? accent : colors.textMuted} />,
      label: 'Start a Plan',
      onPress: () => {
        if (!hasPro) {
          closeMenu();
          setTimeout(() => showProGate('planBuilder', openPaywall), 200);
          return;
        }
        closeMenu();
        setTimeout(() => tracking.setWorkoutPlanVisible(true), 100);
      },
      locked: !hasPro,
    },
    { icon: <PlatformIcon name="clipboard-list" size={20} color={accent} />, label: 'Log Previous', onPress: () => { closeMenu(); setTimeout(() => tracking.setLogPreviousVisible(true), 100); }, locked: false },
  ];

  const dockBottom = insets.bottom > 0 ? insets.bottom : 16;
  const menuBaseBottom = dockBottom + 100;

  return (
    <>
      <View style={[styles.wrapper, { paddingBottom: dockBottom }]} pointerEvents="box-none">
        {/* Background gradient fade behind dock */}
        <LinearGradient
          colors={darkGradient}
          locations={[0, 0.2, 0.5, 0.78, 1]}
          start={{ x: 0, y: 1 }}
          end={{ x: 0, y: 0 }}
          style={[styles.gradientLayer, { height: gradientHeight }]}
          pointerEvents="none"
        />

        <View style={styles.dockRow} pointerEvents="box-none">
          {/* ───── Left: Glass pill with 4 tabs + draggable bubble ───── */}
          <View style={styles.pillContainer}>
            <GestureDetector gesture={panGesture}>
              <BlurView
                intensity={isDark ? 70 : 55}
                tint={dockBlurTint}
                style={[styles.pill, { borderColor: dockBorderColor }]}
                onLayout={onPillLayout}
              >
                {/* Subtle inner stroke for glass refraction effect */}
                <View
                  pointerEvents="none"
                  style={[
                    StyleSheet.absoluteFillObject,
                    styles.pillInnerStroke,
                    { borderColor: dockInnerStroke },
                  ]}
                />

                {/* Single shared bubble — absolutely positioned, translated by shared value */}
                {tabWidth > 0 && (
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.activeBubble,
                      bubbleAnimatedStyle,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.14)'
                          : 'rgba(255,255,255,0.65)',
                        borderColor: isDark
                          ? 'rgba(255,255,255,0.22)'
                          : 'rgba(255,255,255,0.85)',
                        shadowColor: accent,
                      },
                    ]}
                  >
                    {/* Top-left glass highlight */}
                    <LinearGradient
                      colors={
                        isDark
                          ? ['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0)']
                          : ['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.30)', 'rgba(255,255,255,0)']
                      }
                      locations={[0, 0.5, 1]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFillObject as any}
                    />
                  </Animated.View>
                )}

                {/* Tabs */}
                {TABS.map((tab, index) => {
                  const ref =
                    tab.key === 'home'
                      ? (tourHomeRef as any)
                      : tab.key === 'workout'
                        ? (tourWorkoutRef as any)
                        : undefined;
                  return (
                    <DockTab
                      key={tab.key}
                      ref={ref}
                      tab={tab}
                      index={index}
                      bubbleX={bubbleX}
                      accent={accent}
                      inactiveIconColor={inactiveIconColor}
                      onPress={() => handleTabTap(index)}
                    />
                  );
                })}
              </BlurView>
            </GestureDetector>
          </View>

          {/* ───── Right: Standalone glass + button ───── */}
          <TouchableOpacity
            ref={tourPlusRef as any}
            onPress={handlePlusPress}
            testID="dock-plus"
            activeOpacity={0.85}
            style={styles.plusTouchable}
          >
            <View
              style={[
                styles.plusButton,
                {
                  backgroundColor: accent,
                  shadowColor: accent,
                  borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.6)',
                },
              ]}
            >
              {menuOpen ? (
                <PlatformIcon name="x" size={22} color={getContrastTextColor(accent)} strokeWidth={2.8} />
              ) : (
                <PlatformIcon name="plus" size={26} color={getContrastTextColor(accent)} strokeWidth={2.8} />
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* ───── Action menu modal ───── */}
      {menuOpen && (
        <Modal
          visible={menuOpen}
          transparent
          animationType="none"
          statusBarTranslucent
          onRequestClose={closeMenu}
        >
          <Pressable style={styles.modalOverlay} onPress={closeMenu}>
            {Platform.OS !== 'web' ? (
              <BlurView
                intensity={isDark ? 55 : 40}
                tint={isDark ? 'dark' : 'light'}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <View style={[styles.modalDark, StyleSheet.absoluteFill]} />

            <View style={styles.menuContent} pointerEvents="box-none">
              <RNAnimated.View
                style={[
                  styles.menuItemsCol,
                  {
                    bottom: menuBaseBottom,
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                  },
                ]}
              >
                {menuItems.map((item, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.menuPill,
                      {
                        backgroundColor: isDark ? 'rgba(30,30,30,0.96)' : 'rgba(255,255,255,0.96)',
                        borderColor: isDark ? '#333' : '#e5e5e5',
                      },
                      item.locked && { opacity: PRO_LOCKED_OPACITY },
                    ]}
                    onPress={item.onPress}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.menuPillIcon, { backgroundColor: `${accent}18` }]}>
                      {item.icon}
                    </View>
                    <Text style={[styles.menuPillLabel, { color: colors.text }]}>{item.label}</Text>
                    {item.locked && <PlatformIcon name="crown" size={14} color={PRO_GOLD} strokeWidth={2} />}
                  </TouchableOpacity>
                ))}
              </RNAnimated.View>
            </View>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════
// DockTab — individual tab whose icon/label interpolate
// based on how close the shared bubble is to its slot.
// ══════════════════════════════════════════════════════════
type DockTabProps = {
  tab: TabDef;
  index: number;
  bubbleX: ReturnType<typeof useSharedValue<number>>;
  accent: string;
  inactiveIconColor: string;
  onPress: () => void;
};

const DockTab = React.forwardRef<any, DockTabProps>(function DockTab(
  { tab, index, bubbleX, accent, inactiveIconColor, onPress },
  ref,
) {
  // closeness: 1 when bubble sits directly on this tab, 0 when one-or-more slots away
  const closeness = useDerivedValue(() => {
    const dist = Math.abs(bubbleX.value - index);
    return Math.max(0, 1 - dist);
  });

  const iconContainerStyle = useAnimatedStyle(() => {
    const scale = interpolate(closeness.value, [0, 1], [1, 1.08], Extrapolation.CLAMP);
    return { transform: [{ scale }] };
  });

  // Reanimated cannot animate Lucide icon colors (they're props, not style).
  // We fake it by overlaying a second tinted View via useAnimatedStyle opacity,
  // but the cleanest path is: render BOTH icons stacked, fade between them.
  const inactiveIconStyle = useAnimatedStyle(() => ({
    opacity: 1 - closeness.value,
  }));
  const activeIconStyle = useAnimatedStyle(() => ({
    opacity: closeness.value,
  }));

  const labelStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      closeness.value,
      [0, 1],
      [inactiveIconColor, accent],
    );
    return { color };
  });

  return (
    <AnimatedTouchable
      ref={ref as any}
      style={styles.tab}
      onPress={onPress}
      testID={tab.testID}
      activeOpacity={0.75}
    >
      <Animated.View style={[styles.iconStack, iconContainerStyle]}>
        <Animated.View style={[StyleSheet.absoluteFillObject as any, styles.iconCenter, inactiveIconStyle]}>
          <PlatformIcon name={tab.iconName} size={18} color={inactiveIconColor} strokeWidth={2} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFillObject as any, styles.iconCenter, activeIconStyle]}>
          <PlatformIcon name={tab.iconName} size={20} color={accent} strokeWidth={2.5} />
        </Animated.View>
      </Animated.View>
      <Animated.Text style={[styles.tabLabel, labelStyle]} numberOfLines={1}>
        {tab.label}
      </Animated.Text>
    </AnimatedTouchable>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    pointerEvents: 'box-none',
  } as any,
  gradientLayer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },

  // ───── Dock row layout (pill on left + plus on right) ─────
  dockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 12,
  },

  // ───── Glass pill (4 tabs) ─────
  pillContainer: {
    flex: 1,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 3,
    paddingVertical: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 10,
  },
  pillInnerStroke: {
    borderRadius: 999,
    borderWidth: 1,
    margin: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 4,
    position: 'relative',
  },
  iconStack: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBubble: {
    position: 'absolute',
    top: 2,
    left: 2,
    bottom: 2,
    // width comes from bubbleAnimatedStyle
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  tabLabel: {
    fontSize: 9,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.2,
  },

  // ───── Standalone + button (iOS-style glass FAB) ─────
  plusTouchable: {
    // hit area sizing handled by plusButton
  },
  plusButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 12,
  },

  // ───── Action menu ─────
  modalOverlay: {
    flex: 1,
  },
  modalDark: {
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  menuContent: {
    flex: 1,
  },
  menuItemsCol: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 40,
  },
  menuPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 22,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 10,
  },
  menuPillIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuPillLabel: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    flex: 1,
  },
});
