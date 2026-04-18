/**
 * muscleReadiness.ts — Single authoritative function for computing
 * MuscleReadinessItem[] from a user's workout history.
 *
 * Every readiness write path (saveWorkout, deleteWorkout, app init) should
 * pass the current `workoutHistory` and `new Date()` through this helper
 * and replace the stored readiness with its output. That keeps the
 * readiness display and the PPL recommender honest without needing to
 * mutate running state across dozens of code paths.
 *
 * Readiness model (preserves the existing in-app formulas):
 *   • Drop per muscle per session:
 *       volumeFactor  = min(1, sets / 8)
 *       baseDrop      = round((15 + volumeFactor * 35) * difficultyMultiplier)
 *       drop          = clamp(10, 65, baseDrop)
 *   • Recovery over time (ease-out):
 *       recoveryFraction = min(1, daysAgo / 4)
 *       eased            = 1 - (1 - recoveryFraction) ^ 1.8
 *       recovered        = round(drop * eased)
 *   • Per-session delta applied to baseline 100:
 *       sessionValue = clamp(15, 100, 100 - drop + recovered)
 *   • Multi-session stacking uses the minimum per-session sessionValue
 *     within the 7-day window, so a fresh hard session always dominates
 *     a partially-recovered older one.
 */

import type { MuscleReadinessItem, MuscleStatus } from '@/context/AppContext';
import type { WorkoutLog } from '@/context/WorkoutTrackingContext';
import { BROAD_MUSCLE_NAMES, normalizeMuscleGroup } from '@/utils/muscleGroups';

const DIFFICULTY_MULTIPLIER: Record<string, number> = {
  easy: 0.6,
  moderate: 0.85,
  hard: 1.0,
  brutal: 1.25,
};

/** Number of days to look back when computing readiness. */
const LOOKBACK_DAYS = 7;

/** Build a fresh, fully-rested readiness array (baseline shape). */
function freshReadiness(): MuscleReadinessItem[] {
  return BROAD_MUSCLE_NAMES.map((name) => ({
    name,
    status: 'ready' as const,
    value: 100,
    lastWorked: 'Never',
  }));
}

function statusFor(value: number): MuscleStatus {
  if (value >= 80) return 'ready';
  if (value >= 50) return 'building';
  return 'recovering';
}

function daysAgoLabel(daysAgo: number): string {
  if (daysAgo <= 0) return 'Today';
  if (daysAgo === 1) return '1d ago';
  return `${daysAgo}d ago`;
}

/**
 * Return a broad-muscle → completed-sets map for one workout log.
 * Prefers `muscleSetCounts` (written by saveWorkout) but normalizes each key
 * through `normalizeMuscleGroup` so older/raw keys like "front_delt" still
 * collapse onto "Shoulders". Falls back to iterating `exercises` when the
 * counts map is missing or empty.
 */
function broadMuscleSetCountsForLog(log: WorkoutLog): Record<string, number> {
  const counts: Record<string, number> = {};

  if (log.muscleSetCounts && Object.keys(log.muscleSetCounts).length > 0) {
    for (const [rawName, sets] of Object.entries(log.muscleSetCounts)) {
      const broad = normalizeMuscleGroup(rawName);
      counts[broad] = (counts[broad] ?? 0) + sets;
    }
    return counts;
  }

  // Fallback: derive from the exercise list (e.g. manually-logged sessions
  // that predate muscleSetCounts).
  for (const ex of log.exercises ?? []) {
    const doneSets = (ex.sets ?? []).filter((s) => s.done).length;
    if (doneSets === 0) continue;
    const broad = normalizeMuscleGroup(ex.muscleGroup);
    counts[broad] = (counts[broad] ?? 0) + doneSets;
  }
  return counts;
}

/** Midnight-aligned day delta between two dates. */
function daysBetween(a: Date, b: Date): number {
  const ms = a.getTime() - b.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/**
 * Recompute muscle readiness from scratch using the last `LOOKBACK_DAYS` of
 * workout history. Pure function — safe to call from any reducer or effect.
 */
export function recalculateReadinessFromHistory(
  history: WorkoutLog[],
  today: Date = new Date(),
): MuscleReadinessItem[] {
  const base = freshReadiness();
  if (!history || history.length === 0) return base;

  // Per-muscle best-known value + most-recent workout day.
  // We iterate newest-first so the first log that touches a muscle sets its
  // lastWorked label; subsequent older logs can only lower the value further
  // (via `min`), not move lastWorked backward in time.
  const muscleMap = new Map<string, MuscleReadinessItem>();
  for (const m of base) muscleMap.set(m.name, m);

  const todayMidnight = new Date(today);
  todayMidnight.setHours(0, 0, 0, 0);

  const sortedDesc = [...history].sort((a, b) => b.date.localeCompare(a.date));

  for (const log of sortedDesc) {
    // log.date is YYYY-MM-DD; parse at local midnight for a stable delta.
    const logDate = new Date(`${log.date}T00:00:00`);
    const daysAgo = daysBetween(todayMidnight, logDate);
    if (daysAgo > LOOKBACK_DAYS) continue;

    const diffMul = DIFFICULTY_MULTIPLIER[log.difficulty] ?? 1.0;
    const setCounts = broadMuscleSetCountsForLog(log);
    const label = daysAgoLabel(daysAgo);

    for (const [broadName, sets] of Object.entries(setCounts)) {
      const m = muscleMap.get(broadName);
      if (!m || sets <= 0) continue;

      // Matches the existing saveWorkout formula — keep it consistent.
      const volumeFactor = Math.min(1.0, sets / 8);
      const baseDrop = Math.round((15 + volumeFactor * 35) * diffMul);
      const drop = Math.min(65, Math.max(10, baseDrop));

      const recoveryFraction = Math.min(1, daysAgo / 4);
      const eased = 1 - Math.pow(1 - recoveryFraction, 1.8);
      const recovered = Math.round(drop * eased);

      const sessionValue = Math.min(100, Math.max(15, 100 - drop + recovered));

      // If this is the first (most recent) session that touched this muscle,
      // stamp lastWorked. Otherwise keep the newest label already recorded.
      if (m.lastWorked === 'Never') {
        m.lastWorked = label;
      }
      // Multi-session stacking: the most-fatigued recent session wins.
      if (sessionValue < m.value) {
        m.value = sessionValue;
      }
    }
  }

  // Finalize status from final values.
  for (const m of muscleMap.values()) {
    m.status = statusFor(m.value);
  }

  return Array.from(muscleMap.values());
}

/**
 * Build a broad-muscle set-count map for a freshly-completed workout,
 * suitable for persistence on the WorkoutLog.muscleSetCounts field so the
 * recalc helper doesn't have to walk exercises on every pass.
 *
 * Accepts the shape that saveWorkout already builds (raw detailed keys like
 * "chest", "front_delt") and returns broad-keyed counts.
 */
export function normalizeSetCounts(
  rawCounts: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [raw, sets] of Object.entries(rawCounts)) {
    if (!sets) continue;
    const broad = normalizeMuscleGroup(raw);
    out[broad] = (out[broad] ?? 0) + sets;
  }
  return out;
}

/** Return the unique broad muscle names touched by a raw set-count map. */
export function broadMuscleNamesFromRawCounts(
  rawCounts: Record<string, number>,
): string[] {
  const seen = new Set<string>();
  for (const [raw, sets] of Object.entries(rawCounts)) {
    if (!sets) continue;
    seen.add(normalizeMuscleGroup(raw));
  }
  return Array.from(seen);
}
