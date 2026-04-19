/**
 * Train tab — unified home for Workout + Run.
 *
 * Layout:
 *   ┌─────────────────────────────────────────────┐
 *   │  STATIC OVERLAY HEADER (never slides)       │ ← zIndex 10
 *   │  [avatar] [Workout/Run]    [pill] [gear?]   │
 *   ├─────────────────────────────────────────────┤
 *   │                                             │
 *   │  SLIDING CONTENT (both screens mounted)     │
 *   │  workout slot ──slides──> run slot          │
 *   │                                             │
 *   └─────────────────────────────────────────────┘
 *
 * Both sub-screens stay mounted side-by-side in a horizontally-translating
 * row. When the user taps the mode toggle, the row springs left/right. The
 * sub-screens still render their own TabHeaders internally, but those are
 * visually occluded by the static overlay — the user only ever sees the
 * overlay header, which stays anchored.
 *
 * Interactive header elements (avatar, settings gear) live on the overlay
 * and dispatch into each sub-screen via imperative refs (see
 * WorkoutScreenHandle / RunScreenHandle). This keeps the sub-screens'
 * local drawer state intact without lifting it up.
 *
 * `?mode=run|workout` query params continue to work for legacy deep links
 * from the old /workout and /run routes.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import { Image, View, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTrain } from '@/context/TrainContext';
import { useAppTour } from '@/context/AppTourContext';
import { useAppContext, useZealTheme } from '@/context/AppContext';
import { PlatformIcon } from '@/components/PlatformIcon';
import ModeToggleIcons from '@/components/train/ModeToggleIcons';
import MiniSessionBar from '@/components/train/MiniSessionBar';
import WorkoutScreen, { openWorkoutProfileDrawer } from './workout';
import RunScreen, { openRunSettingsDrawer } from './run';

// Shared timing for the content slide, gear entrance, and title crossfade.
// `withTiming` (not `withSpring`) because a spring's tail-end overshoot was
// briefly pushing the sliding row past its target, exposing the root View
// behind the viewport edges and — on the toggle's bubble — making the
// indicator appear to "bounce back" toward the other slot before settling.
// Ease-out cubic lands smoothly without any rebound.
const SLIDE_DURATION_MS = 300;
const SLIDE_EASING = Easing.out(Easing.cubic);

export default function TrainScreen() {
  const { mode, loaded, syncFromQueryParam } = useTrain();
  const { tourCompleted, loaded: tourLoaded, startTour } = useAppTour();
  const { colors } = useZealTheme();
  const { userPhotoUri } = useAppContext();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { width: screenWidth } = useWindowDimensions();
  const tourAutoTriggered = useRef(false);

  // Drawers inside each embedded screen are opened via exported helpers
  // from those route files (see openWorkoutProfileDrawer /
  // openRunSettingsDrawer) — avoids forwardRef on the default route
  // exports, which broke expo-router's static analysis.

  useEffect(() => {
    syncFromQueryParam(params.mode);
  }, [params.mode, syncFromQueryParam]);

  // Tour — first-focus on workout mode starts the walkthrough once per install.
  useFocusEffect(
    useCallback(() => {
      if (!tourLoaded) return;
      if (tourCompleted) return;
      if (tourAutoTriggered.current) return;
      if (mode !== 'workout') return;
      tourAutoTriggered.current = true;
      __DEV__ && console.log('[train] Auto-starting app tour on workout focus');
      const t = setTimeout(() => startTour(), 1200);
      return () => clearTimeout(t);
    }, [tourLoaded, tourCompleted, mode, startTour]),
  );

  // ── Content slide ───────────────────────────────────────────────────────
  // translateX: 0 when workout visible, -screenWidth when run visible.
  const translateX = useSharedValue(mode === 'workout' ? 0 : -screenWidth);
  useEffect(() => {
    translateX.value = withTiming(
      mode === 'workout' ? 0 : -screenWidth,
      { duration: SLIDE_DURATION_MS, easing: SLIDE_EASING },
    );
  }, [mode, screenWidth, translateX]);
  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // ── Gear entrance ───────────────────────────────────────────────────────
  // 0 = workout mode (no gear), 1 = run mode (gear visible). The gear's
  // wrapper collapses from width 40 → 0 in workout mode; the mode-toggle
  // pill sits in a flex row and naturally tightens to fill the space.
  const gearProgress = useSharedValue(mode === 'run' ? 1 : 0);
  useEffect(() => {
    gearProgress.value = withTiming(mode === 'run' ? 1 : 0, { duration: SLIDE_DURATION_MS, easing: SLIDE_EASING });
  }, [mode, gearProgress]);
  const gearStyle = useAnimatedStyle(() => ({
    opacity: gearProgress.value,
    width: interpolate(gearProgress.value, [0, 1], [0, 40]),
    transform: [{ translateX: interpolate(gearProgress.value, [0, 1], [20, 0]) }],
  }));

  // ── Title crossfade ────────────────────────────────────────────────────
  // Quick opacity dip during mode change. Uses the same progress source as
  // the content slide so the title swap syncs with the content.
  const titleProgress = useSharedValue(mode === 'workout' ? 0 : 1);
  useEffect(() => {
    titleProgress.value = withTiming(mode === 'workout' ? 0 : 1, { duration: SLIDE_DURATION_MS, easing: SLIDE_EASING });
  }, [mode, titleProgress]);
  const workoutTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(titleProgress.value, [0, 1], [1, 0]),
  }));
  const runTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(titleProgress.value, [0, 1], [0, 1]),
  }));

  const handleAvatarPress = useCallback(() => {
    if (mode === 'workout') {
      openWorkoutProfileDrawer();
    } else {
      // TODO(profile): route to a shared profile drawer once AthleteProfileDrawer
      // is wired into the run flow. For now, tapping the avatar in run mode
      // opens the run settings drawer (matches existing behavior).
      openRunSettingsDrawer();
    }
  }, [mode]);

  const handleGearPress = useCallback(() => {
    openRunSettingsDrawer();
  }, []);

  if (!loaded) return null;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]} collapsable={false}>
      {/* Sliding content — both screens mounted side-by-side. Their own
          TabHeaders still render but are fully occluded by the overlay. */}
      <Animated.View
        style={[
          styles.slideRow,
          { width: screenWidth * 2 },
          slideStyle,
        ]}
      >
        <View style={{ width: screenWidth }}>
          <WorkoutScreen />
        </View>
        <View style={{ width: screenWidth }}>
          <RunScreen />
        </View>
      </Animated.View>

      {/* Static overlay header — anchored at the top, never slides. Custom
          (not TabHeader) so we can cross-fade the title text in place. */}
      <View
        style={[
          styles.overlay,
          { backgroundColor: colors.background },
        ]}
      >
        <SafeAreaView edges={['top']}>
          <View style={styles.headerRow}>
            {/* Left cluster — avatar + animated title swap */}
            <View style={styles.headerLeft}>
              <TouchableOpacity
                style={[
                  styles.avatarBtn,
                  { borderColor: userPhotoUri ? 'transparent' : colors.border },
                ]}
                onPress={handleAvatarPress}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Open profile"
                testID="train-overlay-avatar"
              >
                {userPhotoUri ? (
                  <Image source={{ uri: userPhotoUri }} style={styles.avatarImage} />
                ) : (
                  <PlatformIcon name="user" size={17} color={colors.textSecondary} />
                )}
              </TouchableOpacity>
              <View style={styles.titleBox}>
                <Animated.Text
                  style={[styles.headerTitle, { color: colors.text }, workoutTitleStyle]}
                  numberOfLines={1}
                >
                  Workout
                </Animated.Text>
                <Animated.Text
                  style={[styles.headerTitle, styles.headerTitleAbs, { color: colors.text }, runTitleStyle]}
                  numberOfLines={1}
                >
                  Run
                </Animated.Text>
              </View>
            </View>

            {/* Right cluster — mode toggle + animated settings gear */}
            <View style={styles.rightCluster}>
              <ModeToggleIcons />
              <Animated.View style={[styles.gearWrap, gearStyle]}>
                <TouchableOpacity
                  onPress={handleGearPress}
                  activeOpacity={0.7}
                  style={[styles.gearBtn, { borderColor: colors.border }]}
                  accessibilityRole="button"
                  accessibilityLabel="Run settings"
                  testID="train-overlay-settings"
                >
                  <PlatformIcon name="settings" size={15} color={colors.textSecondary} />
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
        </SafeAreaView>
      </View>

      {/* MiniSessionBar stays above the dock, below the overlay — unchanged. */}
      <MiniSessionBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // Clip the off-screen half of the sliding row.
    overflow: 'hidden',
  },
  slideRow: {
    flex: 1,
    flexDirection: 'row',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    // Above the sliding content. The sliding screens' own headers continue
    // to render underneath — that's intentional; the overlay occludes them
    // so the user only ever sees this static header.
    zIndex: 10,
    elevation: 10,
  },
  // Matches TabHeader's row spacing so the overlay lines up with each
  // screen's own header underneath (important when backgrounds aren't
  // perfectly opaque across themes).
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
    gap: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  avatarBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  // Title cross-fade container: two stacked Animated.Texts. The first drives
  // layout (so the avatar + title width stays correct); the second is
  // absolutely positioned on top, fading in to replace it.
  titleBox: {
    position: 'relative',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.5,
  },
  headerTitleAbs: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  rightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gearWrap: {
    // Width is driven by the animated style; overflow:hidden clips the gear
    // during the collapse so it doesn't bleed beyond its wrapper.
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
