/**
 * Workout Comparison
 *
 * Pure helper — given a freshly-saved WorkoutLog and the user's history,
 * produces a one-line comparison string vs the most recent comparable past
 * workout. Used by PostWorkoutSheet's hero card to give the user immediate
 * context on how today stacked up.
 *
 * Comparison rules:
 *   - "Comparable" = same workoutStyle AND (same split if both have one,
 *     or overlapping muscleGroups otherwise).
 *   - Returns null when no comparable history exists (first-of-its-kind
 *     workout) or when the freshly-saved log is the only entry.
 *
 * Output examples:
 *   "+27% volume vs your last Push Day"
 *   "Same volume, 8 min faster than last time"
 *   "Lower volume than last Pull Day — recovery week?"
 *   "First Strength workout — nice work"  (if no comparable but it's a new style)
 */

import type { WorkoutLog } from '@/context/WorkoutTrackingContext';

/**
 * Find the most recent past WorkoutLog that's comparable to `current`.
 * Skips `current` itself (matched by id).
 *
 * Comparable = same style + (same split OR ≥1 shared muscle group).
 * History is assumed newest-first, which is how WorkoutTrackingContext
 * maintains it.
 */
export function findComparableLog(current: WorkoutLog, history: WorkoutLog[]): WorkoutLog | null {
  const currentMuscles = new Set(current.muscleGroups ?? []);
  for (const candidate of history) {
    if (candidate.id === current.id) continue;
    if (candidate.workoutStyle !== current.workoutStyle) continue;

    const sameSplit = current.split && candidate.split && current.split === candidate.split;
    const candidateMuscles = candidate.muscleGroups ?? [];
    const sharedMuscles = candidateMuscles.some(m => currentMuscles.has(m));

    if (sameSplit || sharedMuscles) {
      return candidate;
    }
  }
  return null;
}

/**
 * Render a one-liner comparing `current` to `prev`. Volume is the primary
 * dimension since it's the most action-correlated metric a strength athlete
 * tracks. Time is a secondary qualifier when volume is roughly flat.
 *
 * Thresholds:
 *   - "+/-X%" if volume diff ≥ 5% (small differences read as noise)
 *   - "Same volume" if within ±5%, then qualified by time delta if ≥ 3 min
 *   - "First Push Day in 21 days" — future enhancement, not in v1
 */
export function describeComparison(current: WorkoutLog, prev: WorkoutLog): string {
  const splitLabel = (current.split && current.split.length > 0)
    ? `${current.split} Day`
    : `${current.workoutStyle} workout`;

  const cur = current.totalVolume;
  const prv = prev.totalVolume;

  // Both volumes ~0 (e.g. a mobility/HIIT session): compare on duration only.
  if (cur < 10 && prv < 10) {
    const minDelta = current.duration - prev.duration;
    if (Math.abs(minDelta) < 3) return `Right around your last ${splitLabel}`;
    if (minDelta > 0) return `${minDelta} min longer than your last ${splitLabel}`;
    return `${Math.abs(minDelta)} min shorter than your last ${splitLabel}`;
  }

  // Avoid divide-by-zero (prev had no volume, current did).
  if (prv < 10 && cur >= 10) {
    return `First real volume on a ${splitLabel} in your recent history`;
  }

  const pctDelta = ((cur - prv) / prv) * 100;
  const absPct = Math.round(Math.abs(pctDelta));

  if (absPct >= 5) {
    if (pctDelta > 0) return `+${absPct}% volume vs your last ${splitLabel}`;
    // Phrase a meaningful drop more gently — could be intentional deload.
    if (absPct >= 25) return `Lower volume than your last ${splitLabel} — recovery week?`;
    return `${absPct}% less volume than your last ${splitLabel}`;
  }

  // Volume roughly flat — qualify by time if it shifted noticeably.
  const minDelta = current.duration - prev.duration;
  if (minDelta <= -3) return `Same volume, ${Math.abs(minDelta)} min faster than last time`;
  if (minDelta >= 3)  return `Same volume, ${minDelta} min longer than last time`;
  return `Right in line with your last ${splitLabel}`;
}

/**
 * Top-level helper consumed by PostWorkoutSheet. Returns null when there's
 * no comparable history; the sheet hides the line in that case.
 */
export function getWorkoutComparison(current: WorkoutLog, history: WorkoutLog[]): string | null {
  const prev = findComparableLog(current, history);
  if (!prev) return null;
  return describeComparison(current, prev);
}
