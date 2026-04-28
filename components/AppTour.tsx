import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Modal,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAppTour, TOUR_STEPS, type HighlightRect } from '@/context/AppTourContext';
import AppTourTooltip from '@/components/AppTourTooltip';

const OVERLAY_COLOR = 'rgba(0,0,0,0.55)';
const SPOT_PADDING = 10;
const { height: SCREEN_H } = Dimensions.get('window');

export default function AppTour() {
  const {
    tourActive,
    currentStep,
    advanceStep,
    goBack,
    skipTour,
    getTargetRect,
  } = useAppTour();

  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const overlayFade = useRef(new Animated.Value(0)).current;
  const tooltipFade = useRef(new Animated.Value(0)).current;
  const tooltipSlide = useRef(new Animated.Value(20)).current;

  const [activeRect, setActiveRect] = useState<HighlightRect | null>(null);
  const [visible, setVisible] = useState(false);
  const waitingForTabRef = useRef(false);

  // ── Show/hide modal ─────────────────────────────────────────────
  useEffect(() => {
    if (tourActive) {
      setVisible(true);
      overlayFade.setValue(0);
      tooltipFade.setValue(0);
      tooltipSlide.setValue(20);
      Animated.timing(overlayFade, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        measureAndShowTooltip();
      });
    } else if (visible) {
      Animated.timing(overlayFade, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setVisible(false);
        setActiveRect(null);
      });
    }
  }, [tourActive]);

  // ── Measure target for current step ─────────────────────────────
  const measureAndShowTooltip = useCallback(() => {
    const step = TOUR_STEPS[currentStep];
    if (!step) return;

    const rect = getTargetRect(step.targetTestID);
    setActiveRect(rect);

    // If target not found, try polling for up to 1s
    if (!rect && step.targetTestID) {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        const found = getTargetRect(step.targetTestID);
        if (found) {
          clearInterval(interval);
          setActiveRect(found);
          showTooltip();
        } else if (attempts >= 10) {
          clearInterval(interval);
          // Fall back to centered tooltip
          setActiveRect(null);
          showTooltip();
        }
      }, 100);
      return;
    }

    showTooltip();
  }, [currentStep, getTargetRect]);

  const showTooltip = useCallback(() => {
    tooltipFade.setValue(0);
    tooltipSlide.setValue(20);
    Animated.parallel([
      Animated.timing(tooltipFade, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(tooltipSlide, {
        toValue: 0,
        tension: 80,
        friction: 12,
        useNativeDriver: true,
      }),
    ]).start();
  }, [tooltipFade, tooltipSlide]);

  const hideTooltipAndAdvance = useCallback(() => {
    Animated.parallel([
      Animated.timing(tooltipFade, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(tooltipSlide, {
        toValue: -10,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      advanceStep();
    });
  }, [tooltipFade, tooltipSlide, advanceStep]);

  // ── Re-measure when step changes ───────────────────────────────
  useEffect(() => {
    if (!tourActive || !visible) return;
    // Small delay to let new step's target register
    const timer = setTimeout(() => {
      measureAndShowTooltip();
    }, 200);
    return () => clearTimeout(timer);
  }, [currentStep, tourActive, visible]);

  // ── Tab-switch detection ────────────────────────────────────────
  useEffect(() => {
    if (!waitingForTabRef.current) return;
    // pathname changed — tab switched
    waitingForTabRef.current = false;
    // Let the new tab mount and measure targets
    setTimeout(() => {
      // advanceStep was already called in hideTooltipAndAdvance
    }, 400);
  }, [pathname]);

  // ── Handlers ───────────────────────────────────────────────────
  const handleSpotlightPress = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }

    const step = TOUR_STEPS[currentStep];

    if (step.isTabSwitch) {
      // Navigate to the target tab
      waitingForTabRef.current = true;
      if (step.targetTestID === 'dock-home') {
        router.push('/');
      } else if (step.targetTestID === 'dock-train' || step.targetTestID === 'dock-workout') {
        // dock-workout is the legacy testID; dock-train is the Phase-1 rename.
        // Both resolve to the same navigation target.
        router.push('/train?mode=workout');
      }
    }

    if (currentStep >= TOUR_STEPS.length - 1) {
      // Last step — complete tour
      handleComplete();
    } else {
      hideTooltipAndAdvance();
    }
  }, [currentStep, hideTooltipAndAdvance, router]);

  const handleComplete = useCallback(() => {
    Animated.timing(overlayFade, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      skipTour(); // marks as completed
    });
  }, [overlayFade, skipTour]);

  const handleSkip = useCallback(() => {
    Animated.timing(overlayFade, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      skipTour();
    });
  }, [overlayFade, skipTour]);

  const handleBack = useCallback(() => {
    if (currentStep <= 0) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync();

    // If going back crosses a tab boundary, navigate first
    const prevStep = TOUR_STEPS[currentStep - 1];
    const currStep = TOUR_STEPS[currentStep];
    if (prevStep.tab !== currStep.tab) {
      if (prevStep.tab === 'train') router.push('/train?mode=workout');
      else router.push('/');
    }

    Animated.parallel([
      Animated.timing(tooltipFade, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(tooltipSlide, { toValue: 10, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      goBack();
    });
  }, [currentStep, goBack, tooltipFade, tooltipSlide, router]);

  if (!visible) return null;

  const step = TOUR_STEPS[currentStep];
  if (!step) return null;

  const isLast = currentStep === TOUR_STEPS.length - 1;
  const rect = activeRect;

  // Spotlight gap dimensions
  const spotX = rect ? rect.x - SPOT_PADDING : 0;
  const spotY = rect ? rect.y - SPOT_PADDING : 0;
  const spotW = rect ? rect.width + SPOT_PADDING * 2 : 0;
  const spotH = rect ? rect.height + SPOT_PADDING * 2 : 0;
  const spotR = rect ? Math.min(16, spotH / 2) : 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleSkip}
    >
      <Animated.View style={[styles.overlay, { opacity: overlayFade }]}>
        {rect ? (
          <View style={StyleSheet.absoluteFill}>
            {/* Four overlay pieces — block taps outside target */}
            <TouchableOpacity
              style={[styles.overlayPiece, { top: 0, left: 0, right: 0, height: spotY }]}
              activeOpacity={1}
              onPress={() => {}}
            />
            <TouchableOpacity
              style={[styles.overlayPiece, { top: spotY + spotH, left: 0, right: 0, bottom: 0 }]}
              activeOpacity={1}
              onPress={() => {}}
            />
            <TouchableOpacity
              style={[styles.overlayPiece, { top: spotY, left: 0, width: spotX, height: spotH }]}
              activeOpacity={1}
              onPress={() => {}}
            />
            <TouchableOpacity
              style={[styles.overlayPiece, { top: spotY, left: spotX + spotW, right: 0, height: spotH }]}
              activeOpacity={1}
              onPress={() => {}}
            />

            {/* Subtle ring around target */}
            <View
              style={[
                styles.spotlightRing,
                {
                  left: spotX,
                  top: spotY,
                  width: spotW,
                  height: spotH,
                  borderRadius: spotR,
                  borderColor: `${step.iconColor}30`,
                },
              ]}
            />

            {/* Tap-through hit area */}
            <TouchableOpacity
              style={[
                styles.spotlightHitArea,
                {
                  left: spotX,
                  top: spotY,
                  width: spotW,
                  height: spotH,
                  borderRadius: spotR,
                },
              ]}
              activeOpacity={0.9}
              onPress={handleSpotlightPress}
            />
          </View>
        ) : (
          <View style={StyleSheet.absoluteFill}>
            <TouchableOpacity
              style={[styles.overlayPiece, StyleSheet.absoluteFill]}
              activeOpacity={1}
              onPress={() => {}}
            />
          </View>
        )}

        {/* Tooltip */}
        <AppTourTooltip
          stepIndex={currentStep}
          title={step.title}
          body={step.body}
          icon={step.icon}
          iconColor={step.iconColor}
          tapHint={step.tapHint}
          isLast={isLast}
          targetRect={rect}
          arrowDirection={step.arrowDirection}
          tooltipFade={tooltipFade}
          tooltipSlide={tooltipSlide}
          onSkip={handleSkip}
          onBack={handleBack}
          onFinish={handleComplete}
        />

      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  overlayPiece: {
    position: 'absolute',
    backgroundColor: OVERLAY_COLOR,
  },
  spotlightRing: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderWidth: 1,
    zIndex: 10,
  },
  spotlightHitArea: {
    position: 'absolute',
    zIndex: 15,
    backgroundColor: 'transparent',
  },
  closeBtn: {
    position: 'absolute',
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
});
