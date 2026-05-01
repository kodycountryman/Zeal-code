/**
 * NutritionContext — State management for the nutrition tracker.
 *
 * Follows the same createContextHook + AsyncStorage pattern as WorkoutTrackingContext.
 * All meal data is stored locally with a 90-day rolling window.
 */
import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type {
  DailyLog,
  MealEntry,
  MealType,
  WaterEntry,
  NutritionGoals,
  CustomFood,
  FoodItem,
} from '@/types/nutrition';
import { createEmptyDailyLog, DEFAULT_GOALS } from '@/types/nutrition';
import {
  recomputeDailyTotals,
  getTodayStr,
  generateId,
  computeNutrients,
} from '@/services/nutritionUtils';
import { useAppContext } from '@/context/AppContext';

// ─── AsyncStorage Keys ──────────────────────────────────

const DAILY_LOGS_KEY = '@zeal_nutrition_daily_logs_v1';
const GOALS_KEY = '@zeal_nutrition_goals_v1';
const CUSTOM_FOODS_KEY = '@zeal_nutrition_custom_foods_v1';
const RECENT_FOODS_KEY = '@zeal_nutrition_recent_foods_v1';

const MAX_RECENT_FOODS = 50;
const MAX_DAYS_STORED = 90;

// ─── Context ────────────────────────────────────────────

const [NutritionProvider, useNutrition] = createContextHook(() => {
  const app = useAppContext();

  // ── Persisted state ──
  const [dailyLogs, setDailyLogs] = useState<Record<string, DailyLog>>({});
  const [goals, setGoals] = useState<NutritionGoals>(DEFAULT_GOALS);
  const [customFoods, setCustomFoods] = useState<CustomFood[]>([]);
  const [recentFoods, setRecentFoods] = useState<FoodItem[]>([]);

  // ── Transient state ──
  const [loaded, setLoaded] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getTodayStr());

  // ── Drawer visibility ──
  const [foodSearchVisible, setFoodSearchVisible] = useState(false);
  const [manualFoodEntryVisible, setManualFoodEntryVisible] = useState(false);
  const [addFoodSheetVisible, setAddFoodSheetVisible] = useState(false);
  const [aiFoodResultVisible, setAiFoodResultVisible] = useState(false);
  const [goalSetupVisible, setGoalSetupVisible] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<MealType | null>(null);
  const [selectedMealEntry, setSelectedMealEntry] = useState<MealEntry | null>(null);

  // ── Action callbacks (registered by nutrition screen, called by drawers) ──
  const actionCallbacksRef = useRef<{
    onScanFood?: () => void;
    onScanBarcode?: () => void;
    onVoiceFood?: () => void;
  }>({});
  const prevResetTokenRef = useRef<number>(app.newUserResetToken);

  const resetNutritionData = useCallback(() => {
    setDailyLogs({});
    setGoals(DEFAULT_GOALS);
    setCustomFoods([]);
    setRecentFoods([]);
    setSelectedDate(getTodayStr());
    setFoodSearchVisible(false);
    setManualFoodEntryVisible(false);
    setAddFoodSheetVisible(false);
    setAiFoodResultVisible(false);
    setGoalSetupVisible(false);
    setSelectedMealType(null);
    setSelectedMealEntry(null);
    actionCallbacksRef.current = {};
    void AsyncStorage.multiRemove([
      DAILY_LOGS_KEY,
      GOALS_KEY,
      CUSTOM_FOODS_KEY,
      RECENT_FOODS_KEY,
    ]).catch((e) => __DEV__ && console.warn('[NutritionContext] Reset error:', e));
  }, []);

  useEffect(() => {
    if (app.newUserResetToken !== 0 && app.newUserResetToken !== prevResetTokenRef.current) {
      prevResetTokenRef.current = app.newUserResetToken;
      resetNutritionData();
    }
  }, [app.newUserResetToken, resetNutritionData]);

  // ── Hydration from AsyncStorage ──
  useEffect(() => {
    (async () => {
      try {
        const [logsRaw, goalsRaw, customRaw, recentRaw] = await Promise.all([
          AsyncStorage.getItem(DAILY_LOGS_KEY),
          AsyncStorage.getItem(GOALS_KEY),
          AsyncStorage.getItem(CUSTOM_FOODS_KEY),
          AsyncStorage.getItem(RECENT_FOODS_KEY),
        ]);

        if (logsRaw) {
          const parsed = JSON.parse(logsRaw) as Record<string, DailyLog>;
          // Prune entries older than MAX_DAYS_STORED
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - MAX_DAYS_STORED);
          const cutoffStr = cutoff.toISOString().slice(0, 10);
          const pruned: Record<string, DailyLog> = {};
          for (const [date, log] of Object.entries(parsed)) {
            if (date >= cutoffStr) pruned[date] = log;
          }
          setDailyLogs(pruned);
        }

        if (goalsRaw) setGoals(JSON.parse(goalsRaw));
        if (customRaw) setCustomFoods(JSON.parse(customRaw));
        if (recentRaw) setRecentFoods(JSON.parse(recentRaw));
      } catch (e) {
        __DEV__ && console.warn('[NutritionContext] Hydration error:', e);
      }
      setLoaded(true);
    })();
  }, []);

  // ── Persist helpers ──
  const persistLogs = useCallback((logs: Record<string, DailyLog>) => {
    AsyncStorage.setItem(DAILY_LOGS_KEY, JSON.stringify(logs)).catch(console.warn);
  }, []);

  const persistGoals = useCallback((g: NutritionGoals) => {
    AsyncStorage.setItem(GOALS_KEY, JSON.stringify(g)).catch(console.warn);
  }, []);

  const persistCustomFoods = useCallback((foods: CustomFood[]) => {
    AsyncStorage.setItem(CUSTOM_FOODS_KEY, JSON.stringify(foods)).catch(console.warn);
  }, []);

  const persistRecentFoods = useCallback((foods: FoodItem[]) => {
    AsyncStorage.setItem(RECENT_FOODS_KEY, JSON.stringify(foods)).catch(console.warn);
  }, []);

  // ── Today's log (derived) ──
  const todayLog = useMemo((): DailyLog => {
    return dailyLogs[selectedDate] ?? createEmptyDailyLog(selectedDate);
  }, [dailyLogs, selectedDate]);

  // ── Add to recent foods (MRU) ──
  const addToRecent = useCallback((food: FoodItem) => {
    setRecentFoods((prev) => {
      const filtered = prev.filter((f) => f.id !== food.id);
      const next = [food, ...filtered].slice(0, MAX_RECENT_FOODS);
      persistRecentFoods(next);
      return next;
    });
  }, [persistRecentFoods]);

  // ── Meal entry mutations ──

  const addMealEntry = useCallback(
    (food: FoodItem, mealType: MealType, serving: { servingSize: { label: string; grams: number }; quantity: number }) => {
      const nutrients = computeNutrients(food.nutrientsPer100g, serving.servingSize, serving.quantity);
      const entry: MealEntry = {
        id: generateId(),
        foodId: food.id,
        food, // snapshot
        mealType,
        servingSize: serving.servingSize,
        quantity: serving.quantity,
        nutrients,
        loggedAt: new Date().toISOString(),
      };

      setDailyLogs((prev) => {
        const log = prev[selectedDate] ?? createEmptyDailyLog(selectedDate);
        const updated = recomputeDailyTotals({
          ...log,
          meals: [...log.meals, entry],
        });
        const next = { ...prev, [selectedDate]: updated };
        persistLogs(next);
        return next;
      });

      addToRecent(food);
    },
    [selectedDate, persistLogs, addToRecent],
  );

  const removeMealEntry = useCallback(
    (entryId: string) => {
      setDailyLogs((prev) => {
        const log = prev[selectedDate];
        if (!log) return prev;
        const updated = recomputeDailyTotals({
          ...log,
          meals: log.meals.filter((m) => m.id !== entryId),
        });
        const next = { ...prev, [selectedDate]: updated };
        persistLogs(next);
        return next;
      });
    },
    [selectedDate, persistLogs],
  );

  // ── Water mutations ──

  const addWater = useCallback(
    (amountMl: number) => {
      const entry: WaterEntry = {
        id: generateId(),
        amountMl,
        loggedAt: new Date().toISOString(),
      };
      setDailyLogs((prev) => {
        const log = prev[selectedDate] ?? createEmptyDailyLog(selectedDate);
        const updated = recomputeDailyTotals({
          ...log,
          water: [...log.water, entry],
        });
        const next = { ...prev, [selectedDate]: updated };
        persistLogs(next);
        return next;
      });
    },
    [selectedDate, persistLogs],
  );

  const removeLastWater = useCallback(() => {
    setDailyLogs((prev) => {
      const log = prev[selectedDate];
      if (!log || log.water.length === 0) return prev;
      const updated = recomputeDailyTotals({
        ...log,
        water: log.water.slice(0, -1),
      });
      const next = { ...prev, [selectedDate]: updated };
      persistLogs(next);
      return next;
    });
  }, [selectedDate, persistLogs]);

  // ── Goal mutations ──

  const updateGoals = useCallback(
    (updates: Partial<NutritionGoals>) => {
      setGoals((prev) => {
        const next = {
          ...prev,
          ...updates,
          macros: { ...prev.macros, ...(updates.macros ?? {}) },
        };
        persistGoals(next);
        return next;
      });
    },
    [persistGoals],
  );

  // ── Custom food mutations ──

  const saveCustomFood = useCallback(
    (food: Omit<CustomFood, 'id' | 'createdAt'>) => {
      const newFood: CustomFood = {
        ...food,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };
      setCustomFoods((prev) => {
        const next = [newFood, ...prev];
        persistCustomFoods(next);
        return next;
      });
      return newFood;
    },
    [persistCustomFoods],
  );

  const deleteCustomFood = useCallback(
    (foodId: string) => {
      setCustomFoods((prev) => {
        const next = prev.filter((f) => f.id !== foodId);
        persistCustomFoods(next);
        return next;
      });
    },
    [persistCustomFoods],
  );

  // ── Copy meals from another date ──

  const copyMealsFromDate = useCallback(
    (sourceDate: string, targetDate: string, mealTypes?: MealType[]) => {
      setDailyLogs((prev) => {
        const source = prev[sourceDate];
        if (!source) return prev;

        const target = prev[targetDate] ?? createEmptyDailyLog(targetDate);
        const entriesToCopy = mealTypes
          ? source.meals.filter((m) => mealTypes.includes(m.mealType))
          : source.meals;

        const copiedEntries = entriesToCopy.map((entry) => ({
          ...entry,
          id: generateId(),
          loggedAt: new Date().toISOString(),
        }));

        const updated = recomputeDailyTotals({
          ...target,
          meals: [...target.meals, ...copiedEntries],
        });
        const next = { ...prev, [targetDate]: updated };
        persistLogs(next);
        return next;
      });
    },
    [persistLogs],
  );

  // ── Get daily log for any date ──
  const getDailyLog = useCallback(
    (date: string): DailyLog => {
      return dailyLogs[date] ?? createEmptyDailyLog(date);
    },
    [dailyLogs],
  );

  return useMemo(
    () => ({
      // State
      loaded,
      goals,
      todayLog,
      selectedDate,
      customFoods,
      recentFoods,
      dailyLogs,

      // Drawer visibility
      foodSearchVisible,
      setFoodSearchVisible,
      manualFoodEntryVisible,
      setManualFoodEntryVisible,
      addFoodSheetVisible,
      setAddFoodSheetVisible,
      aiFoodResultVisible,
      setAiFoodResultVisible,
      goalSetupVisible,
      setGoalSetupVisible,
      selectedMealType,
      setSelectedMealType,
      selectedMealEntry,
      setSelectedMealEntry,

      // Action callbacks (scanner/voice triggers)
      registerActionCallbacks: (cbs: typeof actionCallbacksRef.current) => {
        actionCallbacksRef.current = cbs;
      },
      triggerScanFood: () => actionCallbacksRef.current.onScanFood?.(),
      triggerScanBarcode: () => actionCallbacksRef.current.onScanBarcode?.(),
      triggerVoiceFood: () => actionCallbacksRef.current.onVoiceFood?.(),

      // Actions
      setSelectedDate,
      addMealEntry,
      removeMealEntry,
      addWater,
      removeLastWater,
      updateGoals,
      saveCustomFood,
      deleteCustomFood,
      copyMealsFromDate,
      getDailyLog,
    }),
    [
      loaded, goals, todayLog, selectedDate, customFoods, recentFoods, dailyLogs,
      foodSearchVisible, manualFoodEntryVisible, addFoodSheetVisible, aiFoodResultVisible,
      goalSetupVisible, selectedMealType, selectedMealEntry,
      addMealEntry, removeMealEntry, addWater, removeLastWater,
      updateGoals, saveCustomFood, deleteCustomFood, copyMealsFromDate, getDailyLog,
    ],
  );
});

export { useNutrition, NutritionProvider };
