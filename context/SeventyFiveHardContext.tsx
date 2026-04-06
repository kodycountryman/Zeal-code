import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Alert } from 'react-native';
import {
  type SeventyFiveHardState,
  type SeventyFiveHardDay,
  type ChecklistItem,
  type OutdoorActivity,
  SEVENTY_FIVE_HARD_STORAGE_KEY,
  createEmptyDay,
  isDayFullyComplete,
} from '@/services/seventyFiveHardTypes';
import { useWorkoutTracking } from '@/context/WorkoutTrackingContext';

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getYesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysBetween(startDate: string, endDate: string): number {
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  const start = Date.UTC(sy, sm - 1, sd);
  const end = Date.UTC(ey, em - 1, ed);
  return Math.floor((end - start) / 86_400_000);
}

function persist(state: SeventyFiveHardState | null) {
  if (state) {
    AsyncStorage.setItem(SEVENTY_FIVE_HARD_STORAGE_KEY, JSON.stringify(state)).catch(
      (e) => __DEV__ && console.warn('[75Hard] Failed to persist state:', e)
    );
  } else {
    AsyncStorage.removeItem(SEVENTY_FIVE_HARD_STORAGE_KEY).catch(
      (e) => __DEV__ && console.warn('[75Hard] Failed to remove state:', e)
    );
  }
}

export const [SeventyFiveHardProvider, useSeventyFiveHard] = createContextHook(() => {
  const [state, setState] = useState<SeventyFiveHardState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const missedDayCheckedRef = useRef(false);
  const { workoutHistory } = useWorkoutTracking();

  // ── Load from AsyncStorage on mount ──
  useEffect(() => {
    AsyncStorage.getItem(SEVENTY_FIVE_HARD_STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            setState(JSON.parse(raw));
          } catch {
            __DEV__ && console.warn('[75Hard] Failed to parse stored state');
          }
        }
      })
      .catch((e) => __DEV__ && console.warn('[75Hard] Failed to load state:', e))
      .finally(() => setLoaded(true));
  }, []);

  // ── Derived values ──
  const isActive = state?.active === true;

  const currentDay = useMemo(() => {
    if (!state?.active) return 0;
    const today = getTodayStr();
    // Count fully completed days before today + 1
    let completedCount = 0;
    for (const [dateKey, day] of Object.entries(state.days)) {
      if (dateKey < today && isDayFullyComplete(day)) {
        completedCount++;
      }
    }
    return Math.min(completedCount + 1, 75);
  }, [state]);

  const todayChecklist = useMemo((): SeventyFiveHardDay => {
    const today = getTodayStr();
    if (!state?.days[today]) return createEmptyDay(today);
    return state.days[today];
  }, [state]);

  // ── Auto-detect workout completion from workoutHistory ──
  useEffect(() => {
    if (!state?.active || !loaded) return;
    const today = getTodayStr();
    const todayLogs = workoutHistory.filter((l) => l.date === today);
    if (todayLogs.length === 0) return;

    setState((prev) => {
      if (!prev?.active) return prev;
      const existing = prev.days[today] ?? createEmptyDay(today);

      let changed = false;
      const updated = { ...existing };

      if (!updated.workout1Complete && todayLogs.length >= 1) {
        updated.workout1Complete = true;
        changed = true;
      }
      if (!updated.workout2Complete && todayLogs.length >= 2) {
        updated.workout2Complete = true;
        changed = true;
      }

      if (!changed) return prev;

      const newState = {
        ...prev,
        days: { ...prev.days, [today]: updated },
      };
      persist(newState);
      __DEV__ && console.log('[75Hard] Auto-detected workout completion from history');
      return newState;
    });
  }, [workoutHistory, state?.active, loaded]);

  // ── Missed day warning (runs once per app open) ──
  useEffect(() => {
    if (!state?.active || !loaded || missedDayCheckedRef.current) return;
    missedDayCheckedRef.current = true;

    const yesterday = getYesterdayStr();
    // Only check if yesterday is within the challenge window
    if (yesterday < state.startDate) return;

    const yesterdayData = state.days[yesterday];
    // If yesterday has no entry at all, that's a missed day too
    if (yesterdayData && isDayFullyComplete(yesterdayData)) return;

    // Yesterday was incomplete — prompt user
    Alert.alert(
      '75 Hard — Missed Items',
      'You didn\'t complete all items yesterday. What would you like to do?',
      [
        {
          text: 'Keep Going',
          style: 'cancel',
          onPress: () => {
            __DEV__ && console.log('[75Hard] User chose to keep going after missed day');
          },
        },
        {
          text: 'Reset to Day 1',
          style: 'destructive',
          onPress: () => resetChallenge(),
        },
      ],
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.active, loaded, state?.startDate]);

  // ── Actions ──

  const updateState = useCallback((updater: (prev: SeventyFiveHardState) => SeventyFiveHardState) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      persist(next);
      return next;
    });
  }, []);

  const toggleItem = useCallback((item: ChecklistItem) => {
    const today = getTodayStr();
    updateState((prev) => {
      const existing = prev.days[today] ?? createEmptyDay(today);
      return {
        ...prev,
        days: {
          ...prev.days,
          [today]: { ...existing, [item]: !existing[item] },
        },
      };
    });
  }, [updateState]);

  const savePhoto = useCallback((uri: string) => {
    const today = getTodayStr();
    updateState((prev) => {
      const existing = prev.days[today] ?? createEmptyDay(today);
      return {
        ...prev,
        days: {
          ...prev.days,
          [today]: { ...existing, photoComplete: true, photoUri: uri },
        },
      };
    });
  }, [updateState]);

  const setOutdoorConfig = useCallback((activity: OutdoorActivity, duration: number) => {
    updateState((prev) => ({
      ...prev,
      outdoor2Config: { activity, duration },
    }));
  }, [updateState]);

  const markOutdoorComplete = useCallback(() => {
    const today = getTodayStr();
    updateState((prev) => {
      const existing = prev.days[today] ?? createEmptyDay(today);
      return {
        ...prev,
        days: {
          ...prev.days,
          [today]: { ...existing, workout2Complete: true },
        },
      };
    });
  }, [updateState]);

  const unmarkOutdoorComplete = useCallback(() => {
    const today = getTodayStr();
    updateState((prev) => {
      const existing = prev.days[today] ?? createEmptyDay(today);
      const { outdoor2Config: _removed, ...restState } = prev;
      return {
        ...restState,
        days: {
          ...prev.days,
          [today]: { ...existing, workout2Complete: false },
        },
      };
    });
  }, [updateState]);

  const startChallenge = useCallback((startDay: number = 1) => {
    const today = getTodayStr();
    const days: Record<string, SeventyFiveHardDay> = {};

    // If picking up, pre-fill prior days as fully complete (honor system)
    if (startDay > 1) {
      for (let i = 0; i < startDay - 1; i++) {
        const d = new Date();
        d.setDate(d.getDate() - (startDay - 1 - i));
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        days[dateStr] = {
          date: dateStr,
          workout1Complete: true,
          workout2Complete: true,
          waterComplete: true,
          readingComplete: true,
          dietComplete: true,
          photoComplete: true,
        };
      }
    }

    // Today starts empty
    days[today] = createEmptyDay(today);

    // Calculate startDate based on pick-up offset
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (startDay - 1));
    const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;

    const newState: SeventyFiveHardState = {
      active: true,
      startDate: startDateStr,
      currentDay: startDay,
      days,
      resetHistory: [],
    };

    setState(newState);
    persist(newState);
    missedDayCheckedRef.current = false;
    __DEV__ && console.log(`[75Hard] Challenge started at day ${startDay}`);
  }, []);

  const resetChallenge = useCallback(() => {
    setState((prev) => {
      if (!prev) return prev;
      const today = getTodayStr();
      const newState: SeventyFiveHardState = {
        active: true,
        startDate: today,
        currentDay: 1,
        days: { [today]: createEmptyDay(today) },
        resetHistory: [...prev.resetHistory, today],
      };
      persist(newState);
      __DEV__ && console.log('[75Hard] Challenge reset to Day 1');
      return newState;
    });
  }, []);

  const endChallenge = useCallback(() => {
    setState(null);
    persist(null);
    __DEV__ && console.log('[75Hard] Challenge ended');
  }, []);

  const getAdherenceStats = useCallback(() => {
    if (!state) return null;
    const entries = Object.values(state.days);
    const total = entries.length;
    if (total === 0) return null;

    return {
      workout1: entries.filter((d) => d.workout1Complete).length,
      workout2: entries.filter((d) => d.workout2Complete).length,
      water: entries.filter((d) => d.waterComplete).length,
      reading: entries.filter((d) => d.readingComplete).length,
      diet: entries.filter((d) => d.dietComplete).length,
      photo: entries.filter((d) => d.photoComplete).length,
      total,
      fullyComplete: entries.filter(isDayFullyComplete).length,
    };
  }, [state]);

  const getMissedDays = useCallback(() => {
    if (!state) return [];
    const today = getTodayStr();
    return Object.values(state.days).filter(
      (d) => d.date < today && !isDayFullyComplete(d)
    );
  }, [state]);

  return useMemo(() => ({
    state,
    loaded,
    isActive,
    currentDay,
    todayChecklist,

    toggleItem,
    savePhoto,
    setOutdoorConfig,
    markOutdoorComplete,
    unmarkOutdoorComplete,
    startChallenge,
    resetChallenge,
    endChallenge,
    getAdherenceStats,
    getMissedDays,
  }), [
    state,
    loaded,
    isActive,
    currentDay,
    todayChecklist,
    toggleItem,
    savePhoto,
    setOutdoorConfig,
    markOutdoorComplete,
    unmarkOutdoorComplete,
    startChallenge,
    resetChallenge,
    endChallenge,
    getAdherenceStats,
    getMissedDays,
  ]);
});
