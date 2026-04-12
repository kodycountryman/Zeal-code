// ═══════════════════════════════════════════════════════
// Zeal+ Nutrition Tracker — Data Models
// ═══════════════════════════════════════════════════════

// ─── Core Nutrient Profile ──────────────────────────────

export interface NutrientProfile {
  calories: number;
  protein: number;       // grams
  fat: number;           // grams
  carbs: number;         // grams
  fiber?: number;        // grams
  sugar?: number;        // grams
  saturatedFat?: number; // grams
  transFat?: number;     // grams
  cholesterol?: number;  // mg
  sodium?: number;       // mg
  potassium?: number;    // mg
  vitaminA?: number;     // mcg RAE
  vitaminC?: number;     // mg
  vitaminD?: number;     // mcg
  calcium?: number;      // mg
  iron?: number;         // mg
}

export const EMPTY_NUTRIENTS: NutrientProfile = {
  calories: 0,
  protein: 0,
  fat: 0,
  carbs: 0,
};

// ─── Serving ────────────────────────────────────────────

export interface ServingSize {
  label: string;   // "Cup", "100g", "1 slice", "1 tbsp"
  grams: number;   // how many grams this serving equals
}

// ─── Food Item ──────────────────────────────────────────

export type FoodSource = 'openfoodfacts' | 'custom' | 'ai_estimated';

export interface FoodItem {
  id: string;                        // barcode or UUID for custom
  name: string;
  brand?: string;
  barcode?: string;
  servingSizes: ServingSize[];       // first is default
  nutrientsPer100g: NutrientProfile; // canonical form — all math normalizes through this
  imageUrl?: string;
  source: FoodSource;
}

// ─── Meal Logging ───────────────────────────────────────

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
};

export interface MealEntry {
  id: string;
  foodId: string;
  food: FoodItem;                    // denormalized snapshot at time of logging
  mealType: MealType;
  servingSize: ServingSize;
  quantity: number;                  // e.g. 1.5 cups
  nutrients: NutrientProfile;       // pre-computed from nutrientsPer100g × serving × qty
  loggedAt: string;                 // ISO timestamp
}

// ─── Water ──────────────────────────────────────────────

export interface WaterEntry {
  id: string;
  amountMl: number;
  loggedAt: string;
}

// ─── Daily Log ──────────────────────────────────────────

export interface DailyLog {
  date: string;                     // YYYY-MM-DD
  meals: MealEntry[];
  water: WaterEntry[];
  totals: NutrientProfile;         // sum of all meal nutrients (recomputed on mutation)
  totalWaterMl: number;
}

export function createEmptyDailyLog(date: string): DailyLog {
  return {
    date,
    meals: [],
    water: [],
    totals: { ...EMPTY_NUTRIENTS },
    totalWaterMl: 0,
  };
}

// ─── Goals ──────────────────────────────────────────────

export interface MacroGoals {
  calories: number;
  proteinGrams: number;
  fatGrams: number;
  carbsGrams: number;
}

export interface NutritionGoals {
  macros: MacroGoals;
  waterMl: number;
  microTargets?: Partial<Pick<NutrientProfile, 'fiber' | 'sodium' | 'sugar' | 'cholesterol'>>;
}

export const DEFAULT_GOALS: NutritionGoals = {
  macros: {
    calories: 2000,
    proteinGrams: 150,
    fatGrams: 65,
    carbsGrams: 250,
  },
  waterMl: 3000,
  microTargets: {
    fiber: 38,
    sodium: 2300,
    sugar: 36,
    cholesterol: 300,
  },
};

// ─── Custom Food ────────────────────────────────────────

export interface CustomFood extends FoodItem {
  source: 'custom';
  createdAt: string;
}

// ─── AI Estimation ──────────────────────────────────────

export interface AIFoodEstimate {
  foods: Array<{
    name: string;
    estimatedServingGrams: number;
    nutrients: NutrientProfile;
    confidence: 'high' | 'medium' | 'low';
  }>;
}

// ─── History Aggregation ────────────────────────────────

export interface DailySummary {
  date: string;
  totals: NutrientProfile;
  goalMet: boolean;
  waterMl: number;
}
