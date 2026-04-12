/**
 * nutritionUtils — Pure functions for nutrient math.
 *
 * All math normalizes through `nutrientsPer100g`:
 *   finalNutrients = nutrientsPer100g × (servingGrams × quantity / 100)
 */
import type {
  NutrientProfile,
  ServingSize,
  MealEntry,
  DailyLog,
  MacroGoals,
  EMPTY_NUTRIENTS,
} from '@/types/nutrition';

// ─── Compute nutrients for a specific serving ───────────

export function computeNutrients(
  nutrientsPer100g: NutrientProfile,
  serving: ServingSize,
  quantity: number,
): NutrientProfile {
  const factor = (serving.grams * quantity) / 100;
  return {
    calories: Math.round(nutrientsPer100g.calories * factor),
    protein: round1(nutrientsPer100g.protein * factor),
    fat: round1(nutrientsPer100g.fat * factor),
    carbs: round1(nutrientsPer100g.carbs * factor),
    fiber: nutrientsPer100g.fiber != null ? round1(nutrientsPer100g.fiber * factor) : undefined,
    sugar: nutrientsPer100g.sugar != null ? round1(nutrientsPer100g.sugar * factor) : undefined,
    saturatedFat: nutrientsPer100g.saturatedFat != null ? round1(nutrientsPer100g.saturatedFat * factor) : undefined,
    transFat: nutrientsPer100g.transFat != null ? round1(nutrientsPer100g.transFat * factor) : undefined,
    cholesterol: nutrientsPer100g.cholesterol != null ? round1(nutrientsPer100g.cholesterol * factor) : undefined,
    sodium: nutrientsPer100g.sodium != null ? round1(nutrientsPer100g.sodium * factor) : undefined,
    potassium: nutrientsPer100g.potassium != null ? round1(nutrientsPer100g.potassium * factor) : undefined,
    vitaminA: nutrientsPer100g.vitaminA != null ? round1(nutrientsPer100g.vitaminA * factor) : undefined,
    vitaminC: nutrientsPer100g.vitaminC != null ? round1(nutrientsPer100g.vitaminC * factor) : undefined,
    vitaminD: nutrientsPer100g.vitaminD != null ? round1(nutrientsPer100g.vitaminD * factor) : undefined,
    calcium: nutrientsPer100g.calcium != null ? round1(nutrientsPer100g.calcium * factor) : undefined,
    iron: nutrientsPer100g.iron != null ? round1(nutrientsPer100g.iron * factor) : undefined,
  };
}

// ─── Sum nutrients across multiple entries ───────────────

export function sumNutrients(entries: MealEntry[]): NutrientProfile {
  const result: NutrientProfile = { calories: 0, protein: 0, fat: 0, carbs: 0 };

  for (const entry of entries) {
    const n = entry.nutrients;
    result.calories += n.calories;
    result.protein += n.protein;
    result.fat += n.fat;
    result.carbs += n.carbs;
    if (n.fiber != null) result.fiber = (result.fiber ?? 0) + n.fiber;
    if (n.sugar != null) result.sugar = (result.sugar ?? 0) + n.sugar;
    if (n.saturatedFat != null) result.saturatedFat = (result.saturatedFat ?? 0) + n.saturatedFat;
    if (n.transFat != null) result.transFat = (result.transFat ?? 0) + n.transFat;
    if (n.cholesterol != null) result.cholesterol = (result.cholesterol ?? 0) + n.cholesterol;
    if (n.sodium != null) result.sodium = (result.sodium ?? 0) + n.sodium;
    if (n.potassium != null) result.potassium = (result.potassium ?? 0) + n.potassium;
    if (n.vitaminA != null) result.vitaminA = (result.vitaminA ?? 0) + n.vitaminA;
    if (n.vitaminC != null) result.vitaminC = (result.vitaminC ?? 0) + n.vitaminC;
    if (n.vitaminD != null) result.vitaminD = (result.vitaminD ?? 0) + n.vitaminD;
    if (n.calcium != null) result.calcium = (result.calcium ?? 0) + n.calcium;
    if (n.iron != null) result.iron = (result.iron ?? 0) + n.iron;
  }

  // Round the accumulated totals
  result.calories = Math.round(result.calories);
  result.protein = round1(result.protein);
  result.fat = round1(result.fat);
  result.carbs = round1(result.carbs);
  if (result.fiber != null) result.fiber = round1(result.fiber);
  if (result.sugar != null) result.sugar = round1(result.sugar);
  if (result.cholesterol != null) result.cholesterol = round1(result.cholesterol);
  if (result.sodium != null) result.sodium = round1(result.sodium);

  return result;
}

// ─── Recompute daily log totals ──────────────────────────

export function recomputeDailyTotals(log: DailyLog): DailyLog {
  return {
    ...log,
    totals: sumNutrients(log.meals),
    totalWaterMl: log.water.reduce((sum, w) => sum + w.amountMl, 0),
  };
}

// ─── Macro percentages ──────────────────────────────────

export function macroPercentage(current: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.min(Math.round((current / goal) * 100), 999); // cap at 999% to prevent overflow
}

export function isOverGoal(current: number, goal: number): boolean {
  return goal > 0 && current > goal;
}

// ─── Remaining macros ───────────────────────────────────

export function remainingMacros(
  totals: NutrientProfile,
  goals: MacroGoals,
): MacroGoals {
  return {
    calories: Math.max(0, goals.calories - totals.calories),
    proteinGrams: Math.max(0, goals.proteinGrams - totals.protein),
    fatGrams: Math.max(0, goals.fatGrams - totals.fat),
    carbsGrams: Math.max(0, goals.carbsGrams - totals.carbs),
  };
}

// ─── Meal calories ──────────────────────────────────────

export function mealCalories(entries: MealEntry[]): number {
  return entries.reduce((sum, e) => sum + e.nutrients.calories, 0);
}

// ─── Date helpers ───────────────────────────────────────

export function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDateLabel(dateStr: string): string {
  const today = getTodayStr();
  if (dateStr === today) return 'Today';
  if (dateStr === addDays(today, -1)) return 'Yesterday';
  if (dateStr === addDays(today, 1)) return 'Tomorrow';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ─── ID generation ──────────────────────────────────────

export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ─── Rounding helpers ───────────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
