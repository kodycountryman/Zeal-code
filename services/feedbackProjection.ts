/**
 * Feedback Projection
 *
 * Pure helpers that project the user's `WorkoutLog[]` history into the two
 * shapes the engine consumes — `TrainingLogEntry[]` (per-exercise last
 * performance, drives Stage 4 recency penalty + Stage 5 progressive
 * overload) and `FeedbackData` (trailing RPE window, drives Stage 8
 * feedback adjustment).
 *
 * Lives outside `WorkoutTrackingContext` so it's testable in isolation
 * and so other callers (e.g. plan engine, pre-generation scoring) can
 * reuse it without circular imports.
 */

import type { WorkoutLog } from '@/context/WorkoutTrackingContext';
import type { TrainingLogEntry, FeedbackData } from '@/services/workoutEngine';

/** Number of most-recent sessions whose RPE feeds Stage 8's avg. Matches
 *  FEEDBACK_ADJUSTMENT.trailing_window_sessions in services/engineConstants.ts. */
const FEEDBACK_TRAILING_SESSIONS = 5;

/** Don't surface a "last performance" reference older than this. Beyond it,
 *  progressive overload from a stale baseline becomes unreliable (the user
 *  may have detrained / rebuilt). */
const TRAINING_LOG_LOOKBACK_DAYS = 21;

/**
 * Pick the heaviest completed set from an exercise log, scored by Epley 1RM
 * so the reference favors quality (heavy + low reps) over volume (light +
 * high reps). The engine's progressive-overload check compares the chosen
 * set's `repsCompleted` to the next workout's `reps` target — so picking
 * the heaviest set is what unlocks +5/+10 lb bumps.
 */
function pickReferenceSet(log: WorkoutLog['exercises'][number]): WorkoutLog['exercises'][number]['sets'][number] | null {
  const done = (log.sets ?? []).filter(s => s.done && s.weight > 0 && s.reps > 0);
  if (done.length === 0) return null;
  // Epley estimate — same formula used by getSuggestedWeight in the context.
  const epley = (w: number, r: number) => w * (1 + r / 30);
  return done.reduce((best, s) => epley(s.weight, s.reps) > epley(best.weight, best.reps) ? s : best);
}

/**
 * For each unique exercise touched in the lookback window, project to a
 * single TrainingLogEntry using the most recent session's heaviest set.
 *
 * Only entries with both weight > 0 and reps > 0 contribute — bodyweight /
 * time-tracked exercises (e.g. plank holds) don't have a meaningful
 * "weightUsed" for progressive overload, so they're excluded. The engine
 * gracefully falls back to default load tables for anything missing.
 */
export function buildTrainingLog(history: WorkoutLog[], today: Date = new Date()): TrainingLogEntry[] {
  if (!history || history.length === 0) return [];
  const cutoffMs = today.getTime() - TRAINING_LOG_LOOKBACK_DAYS * 86_400_000;
  const seen = new Set<string>();
  const out: TrainingLogEntry[] = [];

  // history is maintained newest-first by the context; iterate in order so
  // the FIRST entry we see for a given exerciseId wins (most recent).
  for (const log of history) {
    const logDateMs = new Date(`${log.date}T00:00:00`).getTime();
    if (logDateMs < cutoffMs) break; // sorted newest-first → safe to bail early

    const setsCount = log.exercises?.length ?? 0;
    if (setsCount === 0) continue;

    for (const ex of log.exercises) {
      if (!ex.exerciseId || seen.has(ex.exerciseId)) continue;
      const ref = pickReferenceSet(ex);
      if (!ref) continue;

      const completedSetCount = ex.sets.filter(s => s.done).length;

      out.push({
        exerciseId: ex.exerciseId,
        date: log.date,
        rpe: log.rpe ?? 6,
        weightUsed: ref.weight,
        repsCompleted: ref.reps,
        setsCompleted: completedSetCount,
      });
      seen.add(ex.exerciseId);
    }
  }

  return out;
}

/**
 * Trailing RPE window for Stage 8. Includes manual / health-imported logs —
 * if the user took the time to backfill an RPE, it's real signal even if
 * inferred from chip selection rather than live tracking.
 */
export function buildFeedbackData(history: WorkoutLog[]): FeedbackData {
  if (!history || history.length === 0) return { recentSessions: [] };
  const recent = history.slice(0, FEEDBACK_TRAILING_SESSIONS);
  return {
    recentSessions: recent.map(l => ({ rpe: l.rpe ?? 6, date: l.date })),
  };
}
