/**
 * Single source of truth for mapping exercise-level muscle group strings
 * (e.g. "chest", "front_delt", "lats") to the broad readiness categories
 * used by MuscleReadinessItem (e.g. "Chest", "Shoulders", "Back").
 *
 * Prior to this file, this mapping lived inline in services/insightsEngine.ts
 * and the readiness-decrement code in WorkoutTrackingContext.tsx used raw
 * keys without normalizing — the key mismatch meant readiness never actually
 * dropped after a workout. See plans/muscle-readiness for full context.
 */

/** Broad muscle categories tracked by the muscle readiness system. */
export const BROAD_MUSCLE_NAMES = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Core',
  'Calves',
] as const;

export type BroadMuscleName = (typeof BROAD_MUSCLE_NAMES)[number];

/**
 * Normalize a detailed/exercise-level muscle group string to a broad readiness
 * category. Falls through to the original string when no mapping matches so
 * callers can decide what to do with unknown groups.
 */
export function normalizeMuscleGroup(mg: string): string {
  const lower = mg.toLowerCase();
  if (lower.includes('chest') || lower.includes('pec')) return 'Chest';
  if (
    lower.includes('lat') ||
    lower.includes('upper_back') ||
    lower.includes('lower_back') ||
    lower.includes('rhomb') ||
    lower.includes('trap')
  ) return 'Back';
  if (lower.includes('delt') || lower.includes('shoulder')) return 'Shoulders';
  if (lower.includes('bicep')) return 'Biceps';
  if (lower.includes('tricep')) return 'Triceps';
  if (lower.includes('quad')) return 'Quads';
  if (lower.includes('ham')) return 'Hamstrings';
  if (lower.includes('glute')) return 'Glutes';
  if (lower.includes('core') || lower.includes('oblique') || lower.includes('ab')) return 'Core';
  if (lower.includes('calf') || lower.includes('calves')) return 'Calves';
  return mg;
}
