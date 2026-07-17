/**
 * Cloud sync primitives — one push/pull per user-owned entity.
 *
 * Conventions:
 *   - Pulls return `null` on error so callers fall back to local cache.
 *   - Pushes are fire-and-forget (errors logged in __DEV__ only).
 *   - Mutable lists (gyms, workouts, plans, planned, prefs) use replaceAll
 *     semantics (upsert known + delete missing).
 *   - Append-only collections (history, PRs) use upsertMany (no delete).
 *   - Idempotency: every row keyed on (user_id, client_id) UNIQUE so
 *     re-pushing the same local id is a no-op.
 *   - Conflict policy: last-write-wins via updated_at (server stamps it).
 */

import { supabase } from './supabase';
import type {
  SavedGym,
  SavedWorkout,
  ExercisePreference,
  WorkoutPlan,
  PlannedWorkout,
} from '@/context/AppContext';
import type { GeneratedPlanSchedule } from './planEngine';
import type { WorkoutLog, PersonalRecord } from '@/context/WorkoutTrackingContext';
import type { RunLog, RunPR, RunPreferences, RunPRType } from '@/types/run';

const log = (...args: unknown[]) => {
  if (__DEV__) console.warn('[cloudSync]', ...args);
};

// ──────────────────────────────────────────────────────────────────────
// Saved Gyms — replaceAll
// ──────────────────────────────────────────────────────────────────────

export async function pullSavedGyms(userId: string): Promise<SavedGym[] | null> {
  const { data, error } = await supabase
    .from('zeal_saved_gyms')
    .select('client_id, name, equipment')
    .eq('user_id', userId);
  if (error) {
    log('pullSavedGyms', error.message);
    return null;
  }
  return (data ?? []).map((r) => ({
    id: r.client_id as string,
    name: r.name as string,
    equipment: (r.equipment as Record<string, number>) ?? {},
  }));
}

export async function pushSavedGyms(userId: string, gyms: SavedGym[]): Promise<void> {
  if (gyms.length > 0) {
    const rows = gyms.map((g) => ({
      user_id: userId,
      client_id: g.id,
      name: g.name,
      equipment: g.equipment ?? {},
    }));
    const { error } = await supabase
      .from('zeal_saved_gyms')
      .upsert(rows, { onConflict: 'user_id,client_id' });
    if (error) log('pushSavedGyms upsert', error.message);
  }
  await deleteMissing('zeal_saved_gyms', userId, gyms.map((g) => g.id));
}

// ──────────────────────────────────────────────────────────────────────
// Saved Workouts — replaceAll
// ──────────────────────────────────────────────────────────────────────

export async function pullSavedWorkouts(userId: string): Promise<SavedWorkout[] | null> {
  const { data, error } = await supabase
    .from('zeal_saved_workouts')
    .select('client_id, data')
    .eq('user_id', userId);
  if (error) {
    log('pullSavedWorkouts', error.message);
    return null;
  }
  return (data ?? []).map((r) => r.data as SavedWorkout);
}

export async function pushSavedWorkouts(userId: string, workouts: SavedWorkout[]): Promise<void> {
  if (workouts.length > 0) {
    const rows = workouts.map((w) => ({
      user_id: userId,
      client_id: w.id,
      data: w,
    }));
    const { error } = await supabase
      .from('zeal_saved_workouts')
      .upsert(rows, { onConflict: 'user_id,client_id' });
    if (error) log('pushSavedWorkouts upsert', error.message);
  }
  await deleteMissing('zeal_saved_workouts', userId, workouts.map((w) => w.id));
}

// ──────────────────────────────────────────────────────────────────────
// Exercise Preferences — replaceAll (composite PK on user_id+exercise_id)
// ──────────────────────────────────────────────────────────────────────

export async function pullExercisePreferences(
  userId: string,
): Promise<Record<string, ExercisePreference> | null> {
  const { data, error } = await supabase
    .from('zeal_exercise_preferences')
    .select('exercise_id, preference')
    .eq('user_id', userId);
  if (error) {
    log('pullExercisePreferences', error.message);
    return null;
  }
  const out: Record<string, ExercisePreference> = {};
  for (const r of data ?? []) {
    out[r.exercise_id as string] = r.preference as ExercisePreference;
  }
  return out;
}

export async function pushExercisePreferences(
  userId: string,
  prefs: Record<string, ExercisePreference>,
): Promise<void> {
  const entries = Object.entries(prefs);
  if (entries.length > 0) {
    const rows = entries.map(([exercise_id, preference]) => ({
      user_id: userId,
      exercise_id,
      preference,
    }));
    const { error } = await supabase
      .from('zeal_exercise_preferences')
      .upsert(rows, { onConflict: 'user_id,exercise_id' });
    if (error) log('pushExercisePreferences upsert', error.message);
  }
  // Delete stale prefs that no longer exist locally.
  const localIds = new Set(Object.keys(prefs));
  const { data: remote } = await supabase
    .from('zeal_exercise_preferences')
    .select('exercise_id')
    .eq('user_id', userId);
  const toDelete = (remote ?? [])
    .map((r) => r.exercise_id as string)
    .filter((id) => !localIds.has(id));
  if (toDelete.length > 0) {
    const { error } = await supabase
      .from('zeal_exercise_preferences')
      .delete()
      .eq('user_id', userId)
      .in('exercise_id', toDelete);
    if (error) log('pushExercisePreferences delete', error.message);
  }
}

// ──────────────────────────────────────────────────────────────────────
// Workout / Run Plans — replaceAll
// One row per local plan id. The schedule rides along in its own column.
// ──────────────────────────────────────────────────────────────────────

export interface CloudPlanRow {
  plan: WorkoutPlan;
  schedule: GeneratedPlanSchedule | null;
}

export async function pullWorkoutPlans(userId: string): Promise<CloudPlanRow[] | null> {
  const { data, error } = await supabase
    .from('zeal_workout_plans')
    .select('client_id, mode, active, data, schedule')
    .eq('user_id', userId);
  if (error) {
    log('pullWorkoutPlans', error.message);
    return null;
  }
  return (data ?? []).map((r) => ({
    plan: r.data as WorkoutPlan,
    schedule: (r.schedule as GeneratedPlanSchedule | null) ?? null,
  }));
}

export async function pushWorkoutPlans(
  userId: string,
  plans: { plan: WorkoutPlan; schedule: GeneratedPlanSchedule | null }[],
): Promise<void> {
  if (plans.length > 0) {
    const rows = plans.map(({ plan, schedule }) => ({
      user_id: userId,
      client_id: plan.id,
      mode: (plan.mode ?? 'strength') as 'strength' | 'run' | 'hybrid',
      active: plan.active ?? true,
      data: plan,
      schedule,
    }));
    const { error } = await supabase
      .from('zeal_workout_plans')
      .upsert(rows, { onConflict: 'user_id,client_id' });
    if (error) log('pushWorkoutPlans upsert', error.message);
  }
  await deleteMissing(
    'zeal_workout_plans',
    userId,
    plans.map((p) => p.plan.id),
  );
}

// ──────────────────────────────────────────────────────────────────────
// Planned Workouts — replaceAll
// ──────────────────────────────────────────────────────────────────────

export async function pullPlannedWorkouts(userId: string): Promise<PlannedWorkout[] | null> {
  const { data, error } = await supabase
    .from('zeal_planned_workouts')
    .select('client_id, data')
    .eq('user_id', userId);
  if (error) {
    log('pullPlannedWorkouts', error.message);
    return null;
  }
  return (data ?? []).map((r) => r.data as PlannedWorkout);
}

export async function pushPlannedWorkouts(
  userId: string,
  planned: PlannedWorkout[],
): Promise<void> {
  if (planned.length > 0) {
    const rows = planned.map((p) => ({
      user_id: userId,
      client_id: p.id,
      scheduled_date: p.date,
      data: p,
    }));
    const { error } = await supabase
      .from('zeal_planned_workouts')
      .upsert(rows, { onConflict: 'user_id,client_id' });
    if (error) log('pushPlannedWorkouts upsert', error.message);
  }
  await deleteMissing(
    'zeal_planned_workouts',
    userId,
    planned.map((p) => p.id),
  );
}

// ──────────────────────────────────────────────────────────────────────
// Workout History — upsertMany (append-only, capped to 100 locally)
// ──────────────────────────────────────────────────────────────────────

export async function pullWorkoutHistory(userId: string): Promise<WorkoutLog[] | null> {
  const { data, error } = await supabase
    .from('zeal_workout_history')
    .select('data, workout_date')
    .eq('user_id', userId)
    .order('workout_date', { ascending: false });
  if (error) {
    log('pullWorkoutHistory', error.message);
    return null;
  }
  return (data ?? []).map((r) => r.data as WorkoutLog);
}

export async function pushWorkoutHistory(userId: string, logs: WorkoutLog[]): Promise<void> {
  if (logs.length === 0) return;
  const rows = logs.map((l) => ({
    user_id: userId,
    client_id: l.id,
    workout_date: l.date,
    data: l,
  }));
  const { error } = await supabase
    .from('zeal_workout_history')
    .upsert(rows, { onConflict: 'user_id,client_id' });
  if (error) log('pushWorkoutHistory', error.message);
}

// ──────────────────────────────────────────────────────────────────────
// Personal Records (workout) — replaceAll
// PRs locally don't carry a stable id, so we synthesize one from the
// (exerciseName, type, date) triple — same algorithm both sides.
// ──────────────────────────────────────────────────────────────────────

function prClientId(pr: PersonalRecord): string {
  return `${pr.exerciseName}|${pr.type}|${pr.date}|${pr.sessionId}`;
}

export async function pullPersonalRecords(userId: string): Promise<PersonalRecord[] | null> {
  const { data, error } = await supabase
    .from('zeal_personal_records')
    .select('data')
    .eq('user_id', userId);
  if (error) {
    log('pullPersonalRecords', error.message);
    return null;
  }
  return (data ?? []).map((r) => r.data as PersonalRecord);
}

export async function pushPersonalRecords(
  userId: string,
  prs: PersonalRecord[],
): Promise<void> {
  if (prs.length > 0) {
    const rows = prs.map((pr) => ({
      user_id: userId,
      client_id: prClientId(pr),
      data: pr,
    }));
    const { error } = await supabase
      .from('zeal_personal_records')
      .upsert(rows, { onConflict: 'user_id,client_id' });
    if (error) log('pushPersonalRecords upsert', error.message);
  }
  await deleteMissing('zeal_personal_records', userId, prs.map(prClientId));
}

// ──────────────────────────────────────────────────────────────────────
// Run History — upsertMany (append-only)
// ──────────────────────────────────────────────────────────────────────

export async function pullRunHistory(userId: string): Promise<RunLog[] | null> {
  const { data, error } = await supabase
    .from('zeal_run_history')
    .select('data')
    .eq('user_id', userId)
    .order('run_date', { ascending: false });
  if (error) {
    log('pullRunHistory', error.message);
    return null;
  }
  return (data ?? []).map((r) => r.data as RunLog);
}

export async function pushRunHistory(userId: string, runs: RunLog[]): Promise<void> {
  if (runs.length === 0) return;
  const rows = runs.map((r) => ({
    user_id: userId,
    client_id: r.id,
    run_date: r.date,
    data: r,
  }));
  const { error } = await supabase
    .from('zeal_run_history')
    .upsert(rows, { onConflict: 'user_id,client_id' });
  if (error) log('pushRunHistory', error.message);
}

// ──────────────────────────────────────────────────────────────────────
// Run PRs — replaceAll, keyed by pr_type (one best per type)
// ──────────────────────────────────────────────────────────────────────

export async function pullRunPRs(userId: string): Promise<RunPR[] | null> {
  const { data, error } = await supabase
    .from('zeal_run_prs')
    .select('data')
    .eq('user_id', userId);
  if (error) {
    log('pullRunPRs', error.message);
    return null;
  }
  return (data ?? []).map((r) => r.data as RunPR);
}

export async function pushRunPRs(userId: string, prs: RunPR[]): Promise<void> {
  if (prs.length > 0) {
    const rows = prs.map((pr) => ({
      user_id: userId,
      pr_type: pr.type as RunPRType,
      data: pr,
    }));
    const { error } = await supabase
      .from('zeal_run_prs')
      .upsert(rows, { onConflict: 'user_id,pr_type' });
    if (error) log('pushRunPRs upsert', error.message);
  }
  // Delete stale types
  const local = new Set(prs.map((p) => p.type));
  const { data: remote } = await supabase
    .from('zeal_run_prs')
    .select('pr_type')
    .eq('user_id', userId);
  const toDelete = (remote ?? [])
    .map((r) => r.pr_type as string)
    .filter((t) => !local.has(t as RunPRType));
  if (toDelete.length > 0) {
    const { error } = await supabase
      .from('zeal_run_prs')
      .delete()
      .eq('user_id', userId)
      .in('pr_type', toDelete);
    if (error) log('pushRunPRs delete', error.message);
  }
}

// ──────────────────────────────────────────────────────────────────────
// Run Preferences — single blob per user
// ──────────────────────────────────────────────────────────────────────

export async function pullRunPreferences(userId: string): Promise<RunPreferences | null> {
  const { data, error } = await supabase
    .from('zeal_run_preferences')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    log('pullRunPreferences', error.message);
    return null;
  }
  return (data?.data as RunPreferences | undefined) ?? null;
}

export async function pushRunPreferences(
  userId: string,
  prefs: RunPreferences,
): Promise<void> {
  const { error } = await supabase
    .from('zeal_run_preferences')
    .upsert(
      { user_id: userId, data: prefs },
      { onConflict: 'user_id' },
    );
  if (error) log('pushRunPreferences', error.message);
}

// ──────────────────────────────────────────────────────────────────────
// Profile settings (extended profile blob)
// Stored on zeal_profiles.settings — caller-shaped JSON.
// ──────────────────────────────────────────────────────────────────────

export interface ProfileSettings {
  dateOfBirth?: string;
  heightFt?: number;
  heightIn?: number;
  weight?: number;
  sex?: string;
  bodyFat?: number;
  trainingGoals?: string[];
  specialLifeCase?: string;
  specialLifeCaseDetail?: string;
  activityLevel?: string;
  workoutStyle?: string;
  trainingSplit?: string;
  targetDuration?: number;
  restBetweenSets?: number;
  warmUp?: boolean;
  coolDown?: boolean;
  recovery?: boolean;
  addCardio?: boolean;
  coreFinisher?: boolean;
  selectedEquipment?: Record<string, number>;
  notifPrefs?: unknown;
}

export async function pullProfileSettings(userId: string): Promise<ProfileSettings | null> {
  const { data, error } = await supabase
    .from('zeal_profiles')
    .select('settings')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    log('pullProfileSettings', error.message);
    return null;
  }
  return ((data?.settings as ProfileSettings | undefined) ?? null);
}

export async function pushProfileSettings(
  userId: string,
  settings: ProfileSettings,
): Promise<void> {
  const { error } = await supabase
    .from('zeal_profiles')
    .update({ settings })
    .eq('id', userId);
  if (error) log('pushProfileSettings', error.message);
}

// ──────────────────────────────────────────────────────────────────────
// Internal helpers
// ──────────────────────────────────────────────────────────────────────

/**
 * Delete every row for user where client_id is NOT in `keepIds`.
 * Used by replaceAll-style pushes to clean up rows the user removed locally.
 */
async function deleteMissing(
  table:
    | 'zeal_saved_gyms'
    | 'zeal_saved_workouts'
    | 'zeal_workout_plans'
    | 'zeal_planned_workouts'
    | 'zeal_personal_records',
  userId: string,
  keepIds: string[],
): Promise<void> {
  let query = supabase.from(table).delete().eq('user_id', userId);
  if (keepIds.length > 0) {
    // Postgrest accepts a parenthesized comma-separated list for not-in.
    const escaped = keepIds.map((id) => `"${id.replace(/"/g, '\\"')}"`).join(',');
    query = query.not('client_id', 'in', `(${escaped})`);
  }
  const { error } = await query;
  if (error) log(`deleteMissing ${table}`, error.message);
}
