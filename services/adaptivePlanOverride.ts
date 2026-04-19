/**
 * Adaptive Plan Override
 *
 * Plan engine schedules deloads at fixed weeks (4 and 8 by default — see
 * services/planEngine.ts:453–468). This helper layers a runtime override
 * on top: when recent RPE or muscle readiness signals indicate the user
 * needs a break, today's prescription is rewritten with deload-tier
 * volume/intensity modifiers regardless of where the scheduled phase
 * sits in the plan.
 *
 * Pure function — no state writes. Caller decides whether to honor.
 *
 * The original plan structure is unchanged. If the user "earns" an
 * adaptive deload mid-Build week, the next week resumes wherever the
 * scheduled phase progression had it — we don't retroactively rewrite
 * the plan. This keeps the plan file stable and makes the override easy
 * to reason about ("today only").
 */

import type { WorkoutLog } from '@/context/WorkoutTrackingContext';
import type { MuscleReadinessItem } from '@/context/AppContext';
import type { DayPrescription } from '@/services/planEngine';

const ADAPTIVE_DELOAD = {
  /** Trailing-session window for the RPE check. Matches Stage 8's window. */
  rpe_window_sessions: 5,
  /** Avg RPE >= this across the trailing window → trigger an override. */
  rpe_threshold: 7.5,
  /** ANY broad muscle below this readiness → trigger an override. */
  readiness_low_threshold: 50,
  /** Modifiers applied when override fires. Match planEngine deload tier. */
  deload_volume_modifier: 0.6,
  deload_intensity_modifier: 0.7,
  /** Cooldown — don't override more than once within this many days, so a
   *  legitimate Build week isn't permanently held hostage by one bad week. */
  cooldown_days_between_overrides: 5,
} as const;

export interface AdaptiveOverrideResult {
  /** Possibly-modified prescription. Caller passes this to generation. */
  prescription: DayPrescription | null;
  /** True when the deload override was applied. */
  overridden: boolean;
  /** Human-readable reason for UX surfacing. Null when not overridden. */
  reason: string | null;
}

/**
 * Decide whether today's prescription should be overridden to a deload
 * based on recent user signal. See module docstring for rationale.
 */
export function maybeAdaptiveDeload(
  prescription: DayPrescription | null,
  history: WorkoutLog[],
  readiness: MuscleReadinessItem[],
  today: Date = new Date(),
): AdaptiveOverrideResult {
  // Nothing to override — non-plan day, rest day, or already a scheduled deload.
  if (!prescription) {
    return { prescription, overridden: false, reason: null };
  }
  if (prescription.is_rest) {
    return { prescription, overridden: false, reason: null };
  }
  if (prescription.is_deload_week) {
    return { prescription, overridden: false, reason: null };
  }

  // Cooldown: if any of the last N completed sessions already had an
  // adaptive override applied, don't fire again. Persisted via the
  // adaptiveDeloadApplied marker on WorkoutLog by the caller.
  const todayMs = today.getTime();
  const cooldownCutoffMs = todayMs - ADAPTIVE_DELOAD.cooldown_days_between_overrides * 86_400_000;
  const recentOverride = history.find(log => {
    if (!log.adaptiveDeloadApplied) return false;
    const logMs = new Date(`${log.date}T00:00:00`).getTime();
    return logMs >= cooldownCutoffMs;
  });
  if (recentOverride) {
    return { prescription, overridden: false, reason: null };
  }

  // ── Trigger 1: rolling RPE elevated ──
  // Use the trailing N completed sessions. Need at least the full window
  // before this trigger fires — one bad day shouldn't deload an
  // otherwise-fine plan (the cooldown check above handles repeat days).
  let rpeReason: string | null = null;
  if (history.length >= ADAPTIVE_DELOAD.rpe_window_sessions) {
    const recent = history.slice(0, ADAPTIVE_DELOAD.rpe_window_sessions);
    const avgRpe = recent.reduce((sum, l) => sum + (l.rpe ?? 6), 0) / recent.length;
    if (avgRpe >= ADAPTIVE_DELOAD.rpe_threshold) {
      rpeReason = `Auto deload — recent RPE elevated (avg ${avgRpe.toFixed(1)} across last ${recent.length})`;
    }
  }

  // ── Trigger 2: muscle readiness depleted ──
  // ANY broad muscle below the low threshold qualifies. The hybrid gate in
  // Stage 3/4 already nudges per-exercise selection; this trigger fires the
  // bigger lever (whole-day volume/intensity reduction) when readiness has
  // collapsed broadly.
  let readinessReason: string | null = null;
  const lowMuscle = readiness.find(m => m.value < ADAPTIVE_DELOAD.readiness_low_threshold);
  if (lowMuscle) {
    readinessReason = `Auto deload — ${lowMuscle.name} readiness at ${Math.round(lowMuscle.value)}%`;
  }

  const reason = rpeReason ?? readinessReason;
  if (!reason) {
    return { prescription, overridden: false, reason: null };
  }

  // Apply override — deep-ish copy (only the two fields change). Other
  // prescription fields (style, session_type, intervals, etc.) carry
  // through unchanged so the rest of generation sees the same workout
  // intent, just dialed back.
  return {
    prescription: {
      ...prescription,
      volume_modifier: ADAPTIVE_DELOAD.deload_volume_modifier,
      intensity_modifier: ADAPTIVE_DELOAD.deload_intensity_modifier,
    },
    overridden: true,
    reason,
  };
}
