/**
 * foodSearch — Search for food items across local sources and USDA FoodData Central.
 */
import type { FoodItem } from '@/types/nutrition';

const USDA_API_KEY = process.env.EXPO_PUBLIC_USDA_API_KEY || 'DEMO_KEY';
const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1/foods/search';

// ─── Local search (recent + custom foods) ─────────────────

export function searchLocal(
  query: string,
  recentFoods: FoodItem[],
  customFoods: FoodItem[],
): FoodItem[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];

  const seen = new Set<string>();
  const results: FoodItem[] = [];

  for (const food of [...recentFoods, ...customFoods]) {
    if (seen.has(food.id)) continue;
    const name = food.name.toLowerCase();
    const brand = food.brand?.toLowerCase() ?? '';
    if (name.includes(q) || brand.includes(q)) {
      seen.add(food.id);
      results.push(food);
    }
    if (results.length >= 5) break;
  }

  return results;
}

// ─── USDA FoodData Central search ─────────────────────────

function extractNutrient(nutrients: any[], name: string): number {
  const match = nutrients.find((n: any) => n.nutrientName === name);
  return match?.value ?? 0;
}

export async function searchUSDA(
  query: string,
  signal?: AbortSignal,
): Promise<FoodItem[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  try {
    const params = new URLSearchParams({
      query: q,
      pageSize: '8',
      dataType: 'Branded,Survey (FNDDS)',
      api_key: USDA_API_KEY,
    });

    const resp = await fetch(`${USDA_BASE}?${params}`, { signal });
    if (!resp.ok) return [];

    const data = await resp.json();
    if (!data.foods?.length) return [];

    return data.foods
      .filter((f: any) => {
        const cal = extractNutrient(f.foodNutrients ?? [], 'Energy');
        return cal > 0;
      })
      .slice(0, 8)
      .map((f: any): FoodItem | null => {
        const nuts = f.foodNutrients ?? [];
        const calories = extractNutrient(nuts, 'Energy');
        const protein = extractNutrient(nuts, 'Protein');
        const fat = extractNutrient(nuts, 'Total lipid (fat)');
        const carbs = extractNutrient(nuts, 'Carbohydrate, by difference');
        const fiber = extractNutrient(nuts, 'Fiber, total dietary') || undefined;
        const sugar = extractNutrient(nuts, 'Sugars, total including NLEA') || undefined;

        // USDA nutrients are ALWAYS per 100g for both Branded and FNDDS.
        // servingSize is the default serving (used for display/convenience).
        const servingGrams = f.servingSize ?? 100;
        const servingUnit = f.servingSizeUnit ?? 'g';
        const servingLabel = f.householdServingFullText || `${servingGrams}${servingUnit}`;

        // Sanity check: if calories per 100g is unreasonably high (>1000), likely bad data
        if (calories > 1000) return null;

        const name = f.description ?? 'Unknown';
        // Title-case the name (USDA often returns ALL CAPS for branded)
        const displayName = name
          .split(' ')
          .map((w: string) =>
            w.length > 2
              ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
              : w.toLowerCase(),
          )
          .join(' ');

        return {
          id: String(f.fdcId),
          name: displayName,
          brand: f.brandName || f.brandOwner || undefined,
          servingSizes: [{ label: servingLabel, grams: servingGrams }],
          nutrientsPer100g: {
            calories,
            protein,
            fat,
            carbs,
            fiber,
            sugar,
          },
          source: 'openfoodfacts', // reuse existing type — it's just "external DB"
        };
      })
      .filter((f: FoodItem | null): f is FoodItem => f !== null);
  } catch (e: any) {
    if (e?.name === 'AbortError') return [];
    __DEV__ && console.warn('[foodSearch] USDA search error:', e);
    return [];
  }
}

// ─── Combined search ──────────────────────────────────────

export async function searchAll(
  query: string,
  recentFoods: FoodItem[],
  customFoods: FoodItem[],
  signal?: AbortSignal,
): Promise<FoodItem[]> {
  const local = searchLocal(query, recentFoods, customFoods);

  const remote = await searchUSDA(query, signal);

  const localIds = new Set(local.map((f) => f.id));
  const deduped = remote.filter((f) => !localIds.has(f.id));

  return [...local, ...deduped].slice(0, 8);
}
