/**
 * DEPRECATED — kept as no-op stubs for backward compatibility only.
 *
 * The interactive coach-mark tour was replaced in Phase 4 with a full-page
 * swipeable walkthrough at `/walkthrough`. This file's exports remain so the
 * various consumer files (Home, Train, Workout, FloatingDock, ZealTipBanner)
 * don't all need simultaneous edits — every hook/method here is a no-op.
 *
 * To replay the new walkthrough, navigate to `/walkthrough` directly.
 *
 * The legacy AsyncStorage key `@zeal_app_tour_completed_v1` is migrated to
 * the new walkthrough prompt state via `services/walkthroughPrompt.ts`.
 */

import createContextHook from '@nkzw/create-context-hook';
import { useRef } from 'react';
import type { View } from 'react-native';
import type { AppIconName } from '@/constants/iconMap';

// ─── Types (preserved for any external imports) ─────────────────────────────

export interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TourStep {
  id: string;
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

/** Empty — the new walkthrough lives in app/walkthrough.tsx */
export const TOUR_STEPS: TourStep[] = [];

// ─── No-op Provider + Hook ──────────────────────────────────────────────────

export const [AppTourProvider, useAppTour] = createContextHook(() => {
  return {
    tourActive: false,
    currentStep: 0,
    tourCompleted: true,
    loaded: true,
    startTour: () => {},
    advanceStep: () => {},
    goBack: () => {},
    skipTour: () => {},
    resetTour: async () => {},
    registerTarget: (_id: string, _rect: HighlightRect) => {},
    unregisterTarget: (_id: string) => {},
    getTargetRect: (_id: string | null): HighlightRect | null => null,
  };
});

/** No-op hook — returns a ref so consumer JSX (`ref={tourXxxRef}`) keeps working. */
export function useTourTarget(_testID: string) {
  return useRef<View>(null);
}
