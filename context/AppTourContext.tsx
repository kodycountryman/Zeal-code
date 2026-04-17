import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useRef } from 'react';
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppIconName } from '@/constants/iconMap';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TourStep {
  id: string;
  // The 'workout' tab name is legacy — all tour steps targeting workout-
  // related testIDs now live on the 'train' tab (which renders the Workout
  // screen when in workout mode). Navigation handlers route to /train.
  tab: 'home' | 'train';
  targetTestID: string | null;
  title: string;
  body: string;
  icon: AppIconName;
  iconColor: string;
  arrowDirection: 'up' | 'down' | null;
  tapHint: string;
  isTabSwitch?: boolean;
}

// ─── Step Definitions ───────────────────────────────────────────────────────

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'daily-workout',
    tab: 'train',
    targetTestID: 'workout-info-card',
    title: 'Your Daily Workout',
    body: 'Zeal generates a fresh workout based on your style, duration, and goals.',
    icon: 'dumbbell',
    iconColor: '#3b82f6',
    arrowDirection: 'up',
    tapHint: 'Tap to continue',
  },
  {
    id: 'modify',
    tab: 'train',
    targetTestID: 'modify-workout-card',
    title: 'Modify Your Workout',
    body: 'Change your style, duration, split, or target muscles anytime.',
    icon: 'sliders-horizontal',
    iconColor: '#eab308',
    arrowDirection: 'up',
    tapHint: 'Tap to continue',
  },
  {
    id: 'start',
    tab: 'train',
    targetTestID: 'start-workout-card',
    title: 'Start Your Workout',
    body: 'When you\'re ready, tap Start to begin tracking sets, reps, and weight.',
    icon: 'play',
    iconColor: '#22c55e',
    arrowDirection: 'up',
    tapHint: 'Tap to continue',
  },
  {
    id: 'shuffle',
    tab: 'train',
    targetTestID: 'shuffle-workout',
    title: 'Shuffle Exercises',
    body: 'Not feeling an exercise? Shuffle for a new one, or add your own.',
    icon: 'shuffle',
    iconColor: '#06b6d4',
    arrowDirection: 'up',
    tapHint: 'Tap to continue',
  },
  {
    id: 'go-home',
    tab: 'train',
    targetTestID: 'dock-home',
    title: 'Check Your Dashboard',
    body: 'Tap the Home tab to see your training score, insights, and more.',
    icon: 'home',
    iconColor: '#f87116',
    arrowDirection: 'down',
    tapHint: 'Tap the Home tab',
    isTabSwitch: true,
  },
  {
    id: 'score',
    tab: 'home',
    targetTestID: 'training-score-card',
    title: 'Your Training Score',
    body: 'Your score updates as you train. Tap to see full insights and analytics.',
    icon: 'bar-chart-3',
    iconColor: '#8b5cf6',
    arrowDirection: 'down',
    tapHint: 'Tap to continue',
  },
  {
    id: 'profile',
    tab: 'home',
    targetTestID: 'profile-avatar',
    title: 'Your Profile',
    body: 'Set your goals, body data, and fitness level for smarter workouts.',
    icon: 'user',
    iconColor: '#ec4899',
    arrowDirection: 'up',
    tapHint: 'Tap to continue',
  },
  {
    id: 'plus-menu',
    tab: 'home',
    targetTestID: 'dock-plus',
    title: 'The Plus Menu',
    body: 'Start a training plan or build a custom workout.',
    icon: 'plus',
    iconColor: '#f87116',
    arrowDirection: 'down',
    tapHint: 'Tap to continue',
  },
  {
    id: 'done',
    tab: 'home',
    targetTestID: null,
    title: 'You\'re All Set!',
    body: 'Your first workout is waiting. Let\'s go!',
    icon: 'party-popper',
    iconColor: '#22c55e',
    arrowDirection: null,
    tapHint: '',
  },
];

// ─── Storage ────────────────────────────────────────────────────────────────

const TOUR_COMPLETED_KEY = '@zeal_app_tour_completed_v1';

// ─── Context ────────────────────────────────────────────────────────────────

export const [AppTourProvider, useAppTour] = createContextHook(() => {
  const [tourActive, setTourActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [tourCompleted, setTourCompleted] = useState(true); // default true until loaded
  const [loaded, setLoaded] = useState(false);

  const targetRectsRef = useRef(new Map<string, HighlightRect>());

  // Load persisted state
  useEffect(() => {
    (async () => {
      try {
        const val = await AsyncStorage.getItem(TOUR_COMPLETED_KEY);
        setTourCompleted(val === 'true');
      } catch {
        setTourCompleted(true);
      }
      setLoaded(true);
    })();
  }, []);

  const registerTarget = useCallback((testID: string, rect: HighlightRect) => {
    targetRectsRef.current.set(testID, rect);
  }, []);

  const unregisterTarget = useCallback((testID: string) => {
    targetRectsRef.current.delete(testID);
  }, []);

  const getTargetRect = useCallback((testID: string | null): HighlightRect | null => {
    if (!testID) return null;
    return targetRectsRef.current.get(testID) ?? null;
  }, []);

  const startTour = useCallback(() => {
    __DEV__ && console.log('[AppTour] Starting tour');
    setCurrentStep(0);
    setTourActive(true);
  }, []);

  const advanceStep = useCallback(() => {
    setCurrentStep(prev => {
      const next = prev + 1;
      if (next >= TOUR_STEPS.length) {
        setTourActive(false);
        setTourCompleted(true);
        AsyncStorage.setItem(TOUR_COMPLETED_KEY, 'true').catch(() => {});
        __DEV__ && console.log('[AppTour] Tour completed');
        return prev;
      }
      return next;
    });
  }, []);

  const goBack = useCallback(() => {
    setCurrentStep(prev => (prev > 0 ? prev - 1 : prev));
  }, []);

  const skipTour = useCallback(() => {
    __DEV__ && console.log('[AppTour] Tour skipped');
    setTourActive(false);
    setTourCompleted(true);
    AsyncStorage.setItem(TOUR_COMPLETED_KEY, 'true').catch(() => {});
  }, []);

  const resetTour = useCallback(async () => {
    __DEV__ && console.log('[AppTour] Tour reset');
    setTourCompleted(false);
    setCurrentStep(0);
    try {
      await AsyncStorage.removeItem(TOUR_COMPLETED_KEY);
    } catch {}
  }, []);

  return {
    tourActive,
    currentStep,
    tourCompleted,
    loaded,
    startTour,
    advanceStep,
    goBack,
    skipTour,
    resetTour,
    registerTarget,
    unregisterTarget,
    getTargetRect,
  };
});

// ─── useTourTarget Hook ────────────────────────────────────────────────────

export function useTourTarget(testID: string) {
  const { tourActive, registerTarget, unregisterTarget } = useAppTour();
  const ref = useRef<View>(null);

  useEffect(() => {
    if (!tourActive) return;

    const measure = () => {
      ref.current?.measureInWindow((x, y, w, h) => {
        if (w > 0 && h > 0) {
          registerTarget(testID, { x, y, width: w, height: h });
        }
      });
    };

    // Measure after a short delay to ensure layout is complete
    const timer = setTimeout(measure, 150);

    // Re-measure on a second pass in case the first was too early
    const timer2 = setTimeout(measure, 500);

    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
      unregisterTarget(testID);
    };
  }, [tourActive, testID, registerTarget, unregisterTarget]);

  return ref;
}
