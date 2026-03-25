import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Modal,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  Flame,
  Heart,
  Dumbbell,
  MousePointerClick,
  ListChecks,
  SlidersHorizontal,
  Plus,
  Flag,
  ChevronRight,
  X,
} from 'lucide-react-native';
import { useZealTheme } from '@/context/AppContext';
import type { LucideIcon } from 'lucide-react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const TOTAL_STEPS = 8;

interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface StepConfig {
  title: string;
  body: string;
  icon: LucideIcon;
  iconColor: string;
}

const STEPS: StepConfig[] = [
  {
    title: 'Pre-Workout',
    body: 'Your warm-up lives here. Check off each movement before you train.',
    icon: Flame,
    iconColor: '#f87116',
  },
  {
    title: 'Post-Workout',
    body: 'Cool-down and recovery protocols to follow after your session.',
    icon: Heart,
    iconColor: '#ef4444',
  },
  {
    title: 'Workout',
    body: 'Your main workout. All exercises, sets, and reps are here.',
    icon: Dumbbell,
    iconColor: '#3b82f6',
  },
  {
    title: 'Exercise Row',
    body: 'Tap any exercise to open the tracking panel and start logging.',
    icon: MousePointerClick,
    iconColor: '#22c55e',
  },
  {
    title: 'Log Sets',
    body: 'Scroll the wheels to set weight and reps, then tap Done for each set.',
    icon: ListChecks,
    iconColor: '#a855f7',
  },
  {
    title: 'Modify Workout',
    body: 'Change your style, split, duration, or target muscles anytime.',
    icon: SlidersHorizontal,
    iconColor: '#eab308',
  },
  {
    title: 'Add Exercise',
    body: 'Add exercises, supersets, or circuits to customize your workout.',
    icon: Plus,
    iconColor: '#06b6d4',
  },
  {
    title: 'Finish Workout',
    body: 'When you\'re done, tap here to log your session and see your results.',
    icon: Flag,
    iconColor: '#f43f5e',
  },
];

interface Props {
  visible: boolean;
  onDismiss: () => void;
  stepRects: (HighlightRect | null)[];
  onRequestTab: (tab: 0 | 1 | 2) => void;
  onRequestExpandFirstExercise: () => void;
  onRequestCollapseExercise: () => void;
  onRequestScrollToTop: () => void;
  onRequestScrollToBottom: () => void;
}

export default function WorkoutWalkthrough({
  visible,
  onDismiss,
  stepRects,
  onRequestTab,
  onRequestExpandFirstExercise,
  onRequestCollapseExercise,
  onRequestScrollToTop,
  onRequestScrollToBottom,
}: Props) {
  const insets = useSafeAreaInsets();
  const { accent, isDark } = useZealTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const overlayFade = useRef(new Animated.Value(0)).current;
  const tooltipFade = useRef(new Animated.Value(0)).current;
  const tooltipSlide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (visible) {
      setCurrentStep(0);
      overlayFade.setValue(0);
      tooltipFade.setValue(0);
      tooltipSlide.setValue(20);
      onRequestTab(0);
      Animated.timing(overlayFade, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start(() => {
        showTooltip();
      });
    }
  }, [visible]);

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

  const hideTooltipAndAdvance = useCallback((nextStep: number) => {
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
      setCurrentStep(nextStep);

      if (nextStep === 0) onRequestTab(0);
      else if (nextStep === 1) onRequestTab(2);
      else if (nextStep >= 2 && nextStep <= 4) onRequestTab(1);
      else if (nextStep === 5) {
        onRequestCollapseExercise();
        onRequestScrollToTop();
        onRequestTab(1);
      }
      else if (nextStep >= 6) {
        onRequestTab(1);
        onRequestScrollToBottom();
      }

      if (nextStep === 3) {
        setTimeout(() => {
          showTooltip();
        }, 400);
      } else if (nextStep === 4) {
        onRequestExpandFirstExercise();
        setTimeout(() => {
          showTooltip();
        }, 600);
      } else if (nextStep >= 6) {
        setTimeout(() => {
          showTooltip();
        }, 600);
      } else {
        setTimeout(() => {
          showTooltip();
        }, 350);
      }
    });
  }, [tooltipFade, tooltipSlide, onRequestTab, onRequestExpandFirstExercise, onRequestCollapseExercise, onRequestScrollToTop, onRequestScrollToBottom, showTooltip]);

  const handleNext = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    if (currentStep >= TOTAL_STEPS - 1) {
      Animated.timing(overlayFade, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        onRequestCollapseExercise();
        onRequestScrollToTop();
        onDismiss();
      });
    } else {
      hideTooltipAndAdvance(currentStep + 1);
    }
  }, [currentStep, overlayFade, hideTooltipAndAdvance, onDismiss, onRequestCollapseExercise, onRequestScrollToTop]);

  const handleSkip = useCallback(() => {
    Animated.timing(overlayFade, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onRequestCollapseExercise();
      onRequestTab(1);
      onRequestScrollToTop();
      onDismiss();
    });
  }, [overlayFade, onDismiss, onRequestCollapseExercise, onRequestTab, onRequestScrollToTop]);

  if (!visible) return null;

  const rect = stepRects[currentStep];
  const step = STEPS[currentStep];
  const StepIcon = step.icon;
  const isLast = currentStep === TOTAL_STEPS - 1;

  const spotPadding = 8;
  const spotX = rect ? rect.x - spotPadding : 0;
  const spotY = rect ? rect.y - spotPadding : 0;
  const spotW = rect ? rect.width + spotPadding * 2 : 0;
  const spotH = rect ? rect.height + spotPadding * 2 : 0;
  const spotR = Math.min(16, spotH / 2);

  const tooltipAbove = rect ? (rect.y + rect.height / 2) > SCREEN_H * 0.5 : false;
  const tooltipTop = tooltipAbove
    ? Math.max(insets.top + 20, spotY - 220)
    : spotY + spotH + 16;

  const cardBg = isDark ? 'rgba(24,24,24,0.98)' : 'rgba(255,255,255,0.98)';
  const cardBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';

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
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={[styles.overlayPiece, { top: 0, left: 0, right: 0, height: spotY }]} />
            <View style={[styles.overlayPiece, { top: spotY + spotH, left: 0, right: 0, bottom: 0 }]} />
            <View style={[styles.overlayPiece, { top: spotY, left: 0, width: spotX, height: spotH }]} />
            <View style={[styles.overlayPiece, { top: spotY, left: spotX + spotW, right: 0, height: spotH }]} />
          </View>
        ) : (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={styles.overlayBg} />
          </View>
        )}

        {rect && (
          <View
            style={[
              styles.spotlightCutout,
              {
                left: spotX,
                top: spotY,
                width: spotW,
                height: spotH,
                borderRadius: spotR,
                borderColor: `${step.iconColor}50`,
              },
            ]}
          />
        )}

        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleNext}
        />

        <Animated.View
          style={[
            styles.tooltipCard,
            {
              top: tooltipTop,
              backgroundColor: cardBg,
              borderColor: cardBorder,
              opacity: tooltipFade,
              transform: [{ translateY: tooltipSlide }],
            },
          ]}
          pointerEvents="box-none"
        >
          <View style={styles.tooltipTop}>
            <View style={styles.stepDots}>
              {STEPS.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.stepDot,
                    i === currentStep
                      ? { backgroundColor: step.iconColor, width: 18 }
                      : i < currentStep
                        ? { backgroundColor: `${step.iconColor}60`, width: 6 }
                        : { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)', width: 6 },
                  ]}
                />
              ))}
            </View>
            <Text style={[styles.stepCounter, { color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }]}>
              {currentStep + 1}/{TOTAL_STEPS}
            </Text>
          </View>

          <View style={styles.tooltipBody}>
            <View style={[styles.tooltipIconWrap, { backgroundColor: `${step.iconColor}15` }]}>
              <StepIcon size={22} color={step.iconColor} strokeWidth={2} />
            </View>
            <View style={styles.tooltipText}>
              <Text style={[styles.tooltipTitle, { color: isDark ? '#fff' : '#111' }]}>
                {step.title}
              </Text>
              <Text style={[styles.tooltipDesc, { color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)' }]}>
                {step.body}
              </Text>
            </View>
          </View>

          <View style={styles.tooltipActions}>
            {!isLast && (
              <TouchableOpacity
                style={styles.skipBtn}
                onPress={handleSkip}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.skipText, { color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)' }]}>
                  Skip
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.nextBtn,
                { backgroundColor: step.iconColor },
                isLast && { flex: 1 },
              ]}
              onPress={handleNext}
              activeOpacity={0.85}
            >
              <Text style={styles.nextText}>
                {isLast ? 'Got it!' : 'Next'}
              </Text>
              {!isLast && <ChevronRight size={16} color="#fff" strokeWidth={2.5} />}
            </TouchableOpacity>
          </View>
        </Animated.View>

        <TouchableOpacity
          style={[styles.closeBtn, { top: insets.top + 12 }]}
          onPress={handleSkip}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <X size={18} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.78)',
  },
  overlayPiece: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.78)',
  },
  spotlightCutout: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0)',
    borderWidth: 2,
    zIndex: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#fff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
      default: {},
    }),
  },
  tooltipCard: {
    position: 'absolute',
    left: 20,
    right: 20,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    zIndex: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
      },
      android: {
        elevation: 16,
      },
      default: {},
    }),
  },
  tooltipTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  stepDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  stepDot: {
    height: 5,
    borderRadius: 3,
  },
  stepCounter: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
  },
  tooltipBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 16,
  },
  tooltipIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tooltipText: {
    flex: 1,
    gap: 4,
  },
  tooltipTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  tooltipDesc: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
  },
  tooltipActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  skipBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  nextBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 14,
    paddingVertical: 13,
  },
  nextText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
    letterSpacing: 0.2,
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
