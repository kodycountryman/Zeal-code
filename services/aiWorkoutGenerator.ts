// ─────────────────────────────────────────────────────────────────────────────
// AI Enhancement Layer for Workout Generation
// ─────────────────────────────────────────────────────────────────────────────
// The rule engine (workoutEngine.ts) is the sole generation path — exercise
// selection, format choice, set/rep schemes, and rest are all deterministic.
// No AI is involved in workout generation. (The former CrossFit MetCon AI
// decorator was removed: it overwrote the engine's user-pinned format.)
// ─────────────────────────────────────────────────────────────────────────────

import type {
  GeneratedWorkout,
  GenerateWorkoutParams,
} from '@/services/workoutEngine';
import { generateWorkout } from '@/services/workoutEngine';
import type { DayPrescription } from '@/services/planEngine';

// ─── Main Generation Entry Point ─────────────────────────────────────────────

export function generateWorkoutAsync(
  params: GenerateWorkoutParams,
  prescription?: DayPrescription | null,
  _hasPro?: boolean,
): GeneratedWorkout {
  // All workout generation goes through the rule engine.
  // The exercise database is the single source of truth — exercises are filtered
  // by style, split (via SPLIT_TO_MUSCLES), equipment, and contraindications.
  // Split enforcement is structural: an exercise physically cannot appear in the
  // wrong split because its primary_muscles don't match the target muscle list.
  return generateWorkout(params, prescription);
}

// ─── Style Grouping Enforcement ──────────────────────────────────────────────
// Applied to cached workouts to ensure grouping rules match the style.

export function enforceStyleGrouping<T extends { groupType: string | null; groupId: string | null }>(exercises: T[], style: string): T[] {
  switch (style) {
    case 'Strength': {
      return exercises.map(ex => ({ ...ex, groupType: null, groupId: null }));
    }
    case 'Bodybuilding': {
      const allowedGroups = new Set<string>();
      return exercises.map(ex => {
        if (ex.groupType === 'superset' && ex.groupId) {
          if (!allowedGroups.has(ex.groupId)) {
            if (allowedGroups.size >= 2) {
              return { ...ex, groupType: null, groupId: null };
            }
            allowedGroups.add(ex.groupId);
          }
        }
        return ex;
      });
    }
    case 'CrossFit': {
      return exercises.map(ex =>
        ex.groupType === 'rounds' ? ex : { ...ex, groupType: null, groupId: null },
      );
    }
    case 'HIIT':
    case 'Mobility':
    case 'Pilates': {
      return exercises.map(ex =>
        ex.groupType === 'circuit' ? ex : { ...ex, groupType: null, groupId: null },
      );
    }
    case 'Hybrid': {
      return exercises.map(ex =>
        ex.groupType === 'circuit' ? ex : { ...ex, groupType: null, groupId: null },
      );
    }
    case 'Low-Impact': {
      return exercises.map(ex => ({ ...ex, groupType: null, groupId: null }));
    }
    default:
      return exercises;
  }
}
