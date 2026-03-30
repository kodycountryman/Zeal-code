import React, { useState, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useRouter, usePathname } from 'expo-router';
import { Home, Dumbbell, Plus, ClipboardList, X, Hammer, Sparkles, Crown } from 'lucide-react-native';
import { showProGate, PRO_GOLD, PRO_LOCKED_OPACITY } from '@/services/proGate';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useZealTheme } from '@/context/AppContext';
import { getContrastTextColor } from '@/constants/colors';
import { useWorkoutTracking } from '@/context/WorkoutTrackingContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { SWIFT_SPRING } from '@/constants/animation';



export default function FloatingDock() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors, accent, isDark } = useZealTheme();
  const tracking = useWorkoutTracking();
  const [menuOpen, setMenuOpen] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const { hasPro, openPaywall } = useSubscription();
  const isHome = pathname === '/' || pathname === '/index';
  const isWorkout = pathname === '/workout';

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

const blueGradient: [string, string, string] = isDark
  ? [`rgba(${r},${g},${b},0.28)`, `rgba(${r},${g},${b},0.12)`, `rgba(${r},${g},${b},0)`]
  : [`rgba(${r},${g},${b},0.10)`, `rgba(${r},${g},${b},0.05)`, `rgba(${r},${g},${b},0)`];

  const gradientHeight = 200;

  const dockBlurTint = isDark ? 'dark' : 'light';

  const openMenu = () => {
    setMenuOpen(true);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, ...SWIFT_SPRING }),
    ]).start();
  };

  const closeMenu = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 30, ...SWIFT_SPRING }),
    ]).start(() => setMenuOpen(false));
  };

  const handlePlusPress = () => {
    if (menuOpen) {
      closeMenu();
    } else {
      if (typeof Haptics !== 'undefined') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      openMenu();
    }
  };

  const handleLogPrevious = () => {
    closeMenu();
    setTimeout(() => tracking.setLogPreviousVisible(true), 100);
  };

  const handleBuildWorkout = () => {
    closeMenu();
    setTimeout(() => tracking.setBuildWorkoutVisible(true), 100);
  };

  const handleStartPlan = () => {
    if (!hasPro) {
      closeMenu();
      setTimeout(() => showProGate('planBuilder', openPaywall), 200);
      return;
    }
    closeMenu();
    setTimeout(() => tracking.setWorkoutPlanVisible(true), 100);
  };

  const dockBottom = insets.bottom > 0 ? insets.bottom : 16;
  const plusBtnBottom = dockBottom + 8;
  const menuBaseBottom = plusBtnBottom + 90;

  const menuItems = [
    { icon: <Hammer size={20} color={accent} />, label: 'Build Workout', onPress: handleBuildWorkout, locked: false },
    {
      icon: <Sparkles size={20} color={hasPro ? accent : colors.textMuted} />,
      label: 'Start a Plan',
      onPress: handleStartPlan,
      locked: !hasPro,
    },
    { icon: <ClipboardList size={20} color={accent} />, label: 'Log Previous', onPress: handleLogPrevious, locked: false },
  ];

  return (
    <>
      <View
        style={[styles.wrapper, { paddingBottom: dockBottom }]}
        pointerEvents="box-none"
      >
        <LinearGradient
          colors={darkGradient}
          locations={[0, 0.2, 0.5, 0.78, 1]}
          start={{ x: 0, y: 1 }}
          end={{ x: 0, y: 0 }}
          style={[styles.gradientLayer, { height: gradientHeight }]}
          pointerEvents="none"
        />
        <LinearGradient
          colors={blueGradient}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 1 }}
          end={{ x: 0, y: 0 }}
          style={[styles.gradientLayer, { height: gradientHeight }]}
          pointerEvents="none"
        />

        <View style={styles.dockContainer} pointerEvents="box-none">
          <BlurView
            intensity={isDark ? 52 : 45}
            tint={dockBlurTint}
            style={[
              styles.dock,
              {
                borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
              },
            ]}
          >
            <TouchableOpacity
              style={styles.tab}
              onPress={() => { closeMenu(); router.push('/'); }}
              testID="dock-home"
              activeOpacity={0.7}
            >
              <View style={styles.tabIndicator}>
                <Home
                  size={22}
                  color={isHome ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.32)'}
                  strokeWidth={isHome ? 2 : 1.6}
                />
              </View>
              <Text style={[styles.tabLabel, { color: isHome ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.32)' }]}>
                Home
              </Text>
            </TouchableOpacity>

            <View style={styles.centerSpacer} />

            <TouchableOpacity
              style={styles.tab}
              onPress={() => { closeMenu(); router.push('/workout'); }}
              testID="dock-workout"
              activeOpacity={0.7}
            >
              <View style={styles.tabIndicator}>
                <Dumbbell
                  size={22}
                  color={isWorkout ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.32)'}
                  strokeWidth={isWorkout ? 2 : 1.6}
                />
              </View>
              <Text style={[styles.tabLabel, { color: isWorkout ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.32)' }]}>
                Workout
              </Text>
            </TouchableOpacity>
          </BlurView>

          <View style={styles.plusAbsoluteWrapper} pointerEvents="box-none">
            <TouchableOpacity
              onPress={handlePlusPress}
              testID="dock-plus"
              activeOpacity={0.85}
            >
              <View style={[styles.plusButton, { backgroundColor: accent, shadowColor: accent }]}>
                {menuOpen ? (
                  <X size={32} color={getContrastTextColor(accent)} strokeWidth={2.5} />
                ) : (
                  <Plus size={40} color={getContrastTextColor(accent)} strokeWidth={2.5} />
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>

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
              <Animated.View
                style={[
                  styles.menuItemsCol,
                  { bottom: menuBaseBottom, opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
                ]}
              >
                {menuItems.map((item, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.menuPill,
                      { backgroundColor: isDark ? 'rgba(30,30,30,0.96)' : 'rgba(255,255,255,0.96)', borderColor: isDark ? '#333' : '#e5e5e5' },
                      item.locked && { opacity: PRO_LOCKED_OPACITY },
                    ]}
                    onPress={item.onPress}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.menuPillIcon, { backgroundColor: `${accent}18` }]}>
                      {item.icon}
                    </View>
                    <Text style={[styles.menuPillLabel, { color: colors.text }]}>
                      {item.label}
                    </Text>
                    {item.locked && (
                      <Crown size={14} color={PRO_GOLD} strokeWidth={2} />
                    )}
                  </TouchableOpacity>
                ))}
              </Animated.View>

              <Animated.View
                style={[
                  styles.closeBtnAbs,
                  {
                    bottom: plusBtnBottom,
                    opacity: fadeAnim,
                  },
                ]}
              >
                <TouchableOpacity
                  onPress={closeMenu}
                  activeOpacity={0.85}
                >
                  <View style={[styles.plusButton, { backgroundColor: accent, shadowColor: accent }]}>
                    <X size={32} color={getContrastTextColor(accent)} strokeWidth={2.5} />
                  </View>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'box-none',
  } as any,
  gradientLayer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  dockContainer: {
    width: '100%',
    paddingHorizontal: 16,
    overflow: 'visible',
  } as any,
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 10,
  } as any,
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  tabIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  centerSpacer: {
    width: 64,
  },
  plusAbsoluteWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'box-none',
  } as any,
  plusButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 12,
  },
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
    fontWeight: '700',
    flex: 1,
  },
  proTag: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#f5c842',
    letterSpacing: 0.8,
    backgroundColor: '#f5c84220',
    borderWidth: 1,
    borderColor: '#f5c84240',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  closeBtnAbs: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
