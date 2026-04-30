/**
 * runScoreService.ts — Training score contribution from completed runs.
 *
 * Mirrors the cadence of calculateScore() in WorkoutTrackingContext so that
 * runs and gym sessions are weighted comparably on the home Training Score card.
 *
 * Algorithm:
 *   basePoints   = 1 pt per 5 min (same as workouts)
 *   distPoints   = 1 pt per km completed
 *   intensityPts = pace-zone bonus (0–5 pts):
 *     < 4:30 min/km  → 5 pts  (race / interval effort)
 *     4:30–5:30      → 3 pts  (tempo / threshold)
 *     5:30–7:00      → 1 pt   (moderate / conversational)
 *     > 7:00         → 0 pts  (easy / walk)
 *   finalScore = clamp(1, 50, raw)   ← same ceiling as workout score
 *
 * Calibration examples:
 *   5 km easy run @ 7 min/km  (35 min) → 7 + 5 + 0 = 12 pts
 *   5 km moderate @ 6 min/km  (30 min) → 6 + 5 + 1 = 12 pts
 *   10 km tempo   @ 5 min/km  (50 min) → 10 + 10 + 3 = 23 pts
 *   21 km         @ 5:30/km  (~1:57)   → 23 + 21 + 1 = 45 pts
 */

import type { RunLog } from '@/types/run';

export function computeRunTrainingScore(run: RunLog): number {
  // Base: 1 point per 5 minutes
  const basePoints = Math.floor(run.durationSeconds / 300);

  // Distance: 1 point per km
  const distPoints = Math.floor(run.distanceMeters / 1000);

  // Intensity: pace-zone bonus
  // averagePaceSecondsPerMeter * 1000 / 60 → minutes per km
  const paceMinPerKm =
    run.averagePaceSecondsPerMeter && run.averagePaceSecondsPerMeter > 0
      ? (run.averagePaceSecondsPerMeter * 1000) / 60
      : 0;

  const intensityPoints =
    paceMinPerKm > 0 && paceMinPerKm < 4.5   ? 5 :
    paceMinPerKm >= 4.5 && paceMinPerKm < 5.5 ? 3 :
    paceMinPerKm >= 5.5 && paceMinPerKm < 7.0 ? 1 : 0;

  const raw = basePoints + distPoints + intensityPoints;
  const hasWork = run.durationSeconds > 60;

  __DEV__ && console.log(
    '[runScoreService] base=', basePoints,
    'dist=', distPoints,
    'intensity=', intensityPoints,
    'pace=', paceMinPerKm.toFixed(2),
    'raw=', raw,
  );

  return Math.min(50, Math.max(hasWork ? 1 : 0, raw));
}
