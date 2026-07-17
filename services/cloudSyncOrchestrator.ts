/**
 * Cloud sync orchestrator — coordinates first-sync migration and login
 * hydration across all entities. Local AsyncStorage stays the source of
 * truth for runtime; Supabase is the cross-device mirror.
 *
 * Strategy
 * ────────
 *   On sign-in, for each entity:
 *     1. Pull cloud rows.
 *     2. If cloud is empty AND local has data, push local up
 *        (first-sync migration — idempotent thanks to (user_id, client_id)
 *        UNIQUE constraints, so re-runs are safe).
 *     3. Otherwise, return cloud rows so the calling context can replace
 *        local state with the authoritative cross-device snapshot.
 *
 *   After hydration, contexts call the per-entity push helpers in
 *   `services/cloudSync.ts` whenever they save locally; that keeps cloud
 *   in sync without ongoing orchestration here.
 *
 *   The `@zeal_cloud_first_sync_<userId>` AsyncStorage flag tracks which
 *   user has completed first-sync on this device — prevents duplicate
 *   uploads if a user signs out + back in.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  pullSavedGyms, pushSavedGyms,
  pullSavedWorkouts, pushSavedWorkouts,
  pullExercisePreferences, pushExercisePreferences,
  pullWorkoutPlans, pushWorkoutPlans,
  pullPlannedWorkouts, pushPlannedWorkouts,
  pullWorkoutHistory, pushWorkoutHistory,
  pullPersonalRecords, pushPersonalRecords,
  pullRunHistory, pushRunHistory,
  pullRunPRs, pushRunPRs,
  pullRunPreferences, pushRunPreferences,
  pullProfileSettings, pushProfileSettings,
  type ProfileSettings,
  type CloudPlanRow,
} from './cloudSync';
import type {
  SavedGym, SavedWorkout, ExercisePreference, WorkoutPlan, PlannedWorkout,
} from '@/context/AppContext';
import type { GeneratedPlanSchedule } from './planEngine';
import type { WorkoutLog, PersonalRecord } from '@/context/WorkoutTrackingContext';
import type { RunLog, RunPR, RunPreferences } from '@/types/run';

const FIRST_SYNC_PREFIX = '@zeal_cloud_first_sync_';

const log = (...args: unknown[]) => {
  if (__DEV__) console.log('[cloudSyncOrchestrator]', ...args);
};

// ──────────────────────────────────────────────────────────────────────
// Snapshot type — what hydrate returns. null fields mean "no cloud data,
// keep local". When cloud has data, the field holds the cross-device
// snapshot the context should replace local state with.
// ──────────────────────────────────────────────────────────────────────

export interface CloudSnapshot {
  profileSettings: ProfileSettings | null;
  savedGyms: SavedGym[] | null;
  savedWorkouts: SavedWorkout[] | null;
  exercisePreferences: Record<string, ExercisePreference> | null;
  plans: CloudPlanRow[] | null;
  plannedWorkouts: PlannedWorkout[] | null;
  workoutHistory: WorkoutLog[] | null;
  personalRecords: PersonalRecord[] | null;
  runHistory: RunLog[] | null;
  runPRs: RunPR[] | null;
  runPreferences: RunPreferences | null;
}

/**
 * Provider passed by the caller (AppContext / WorkoutTrackingContext /
 * RunContext) so the orchestrator can read a snapshot of CURRENT local
 * state at the moment of first-sync. Each field is optional — pass what
 * you have access to from the calling site.
 */
export interface LocalSnapshotProvider {
  getProfileSettings?: () => ProfileSettings;
  getSavedGyms?: () => SavedGym[];
  getSavedWorkouts?: () => SavedWorkout[];
  getExercisePreferences?: () => Record<string, ExercisePreference>;
  getPlans?: () => { plan: WorkoutPlan; schedule: GeneratedPlanSchedule | null }[];
  getPlannedWorkouts?: () => PlannedWorkout[];
  getWorkoutHistory?: () => WorkoutLog[];
  getPersonalRecords?: () => PersonalRecord[];
  getRunHistory?: () => RunLog[];
  getRunPRs?: () => RunPR[];
  getRunPreferences?: () => RunPreferences | null;
}

// ──────────────────────────────────────────────────────────────────────
// First-sync flag
// ──────────────────────────────────────────────────────────────────────

async function hasCompletedFirstSync(userId: string): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(FIRST_SYNC_PREFIX + userId);
    return v === 'done';
  } catch {
    return false;
  }
}

async function markFirstSyncComplete(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(FIRST_SYNC_PREFIX + userId, 'done');
  } catch (e) {
    log('mark first-sync error', e);
  }
}

/**
 * Erase the first-sync marker for a user (used after sign-out / account
 * deletion so the next sign-in re-runs the migration).
 */
export async function clearFirstSyncFlag(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(FIRST_SYNC_PREFIX + userId);
  } catch {
    /* ignore */
  }
}

// ──────────────────────────────────────────────────────────────────────
// hydrateFromCloud — call from context on sign-in
// ──────────────────────────────────────────────────────────────────────

/**
 * Pulls the user's full snapshot from Supabase and, on the first sync,
 * pushes empty cloud entities up from local. Returns whatever cloud has
 * for each entity — caller decides whether to replace local state.
 *
 * Safe to call repeatedly. After the first run, the migration step is
 * skipped (subsequent calls just pull).
 */
export async function hydrateFromCloud(
  userId: string,
  local: LocalSnapshotProvider,
): Promise<CloudSnapshot> {
  const firstSyncDone = await hasCompletedFirstSync(userId);
  log('hydrate start', { userId, firstSyncDone });

  // Phase 1 + 2 + 3: pull everything in parallel.
  const [
    profileSettings,
    savedGyms,
    savedWorkouts,
    exercisePreferences,
    plans,
    plannedWorkouts,
    workoutHistory,
    personalRecords,
    runHistory,
    runPRs,
    runPreferences,
  ] = await Promise.all([
    pullProfileSettings(userId),
    pullSavedGyms(userId),
    pullSavedWorkouts(userId),
    pullExercisePreferences(userId),
    pullWorkoutPlans(userId),
    pullPlannedWorkouts(userId),
    pullWorkoutHistory(userId),
    pullPersonalRecords(userId),
    pullRunHistory(userId),
    pullRunPRs(userId),
    pullRunPreferences(userId),
  ]);

  // First-sync migration: when cloud is empty for an entity but local
  // has data, push local up. The (user_id, client_id) UNIQUE constraints
  // make this idempotent — running twice does the same thing as running
  // once.
  if (!firstSyncDone) {
    const tasks: Promise<unknown>[] = [];

    if (local.getProfileSettings && (!profileSettings || isEmptyObj(profileSettings))) {
      const s = local.getProfileSettings();
      if (s && !isEmptyObj(s)) tasks.push(pushProfileSettings(userId, s));
    }
    if (local.getSavedGyms && (savedGyms?.length ?? 0) === 0) {
      const local_ = local.getSavedGyms();
      if (local_.length > 0) tasks.push(pushSavedGyms(userId, local_));
    }
    if (local.getSavedWorkouts && (savedWorkouts?.length ?? 0) === 0) {
      const local_ = local.getSavedWorkouts();
      if (local_.length > 0) tasks.push(pushSavedWorkouts(userId, local_));
    }
    if (
      local.getExercisePreferences &&
      Object.keys(exercisePreferences ?? {}).length === 0
    ) {
      const local_ = local.getExercisePreferences();
      if (Object.keys(local_).length > 0) {
        tasks.push(pushExercisePreferences(userId, local_));
      }
    }
    if (local.getPlans && (plans?.length ?? 0) === 0) {
      const local_ = local.getPlans();
      if (local_.length > 0) tasks.push(pushWorkoutPlans(userId, local_));
    }
    if (local.getPlannedWorkouts && (plannedWorkouts?.length ?? 0) === 0) {
      const local_ = local.getPlannedWorkouts();
      if (local_.length > 0) tasks.push(pushPlannedWorkouts(userId, local_));
    }
    if (local.getWorkoutHistory && (workoutHistory?.length ?? 0) === 0) {
      const local_ = local.getWorkoutHistory();
      if (local_.length > 0) tasks.push(pushWorkoutHistory(userId, local_));
    }
    if (local.getPersonalRecords && (personalRecords?.length ?? 0) === 0) {
      const local_ = local.getPersonalRecords();
      if (local_.length > 0) tasks.push(pushPersonalRecords(userId, local_));
    }
    if (local.getRunHistory && (runHistory?.length ?? 0) === 0) {
      const local_ = local.getRunHistory();
      if (local_.length > 0) tasks.push(pushRunHistory(userId, local_));
    }
    if (local.getRunPRs && (runPRs?.length ?? 0) === 0) {
      const local_ = local.getRunPRs();
      if (local_.length > 0) tasks.push(pushRunPRs(userId, local_));
    }
    if (local.getRunPreferences && !runPreferences) {
      const local_ = local.getRunPreferences();
      if (local_) tasks.push(pushRunPreferences(userId, local_));
    }

    if (tasks.length > 0) {
      log(`first-sync migrating ${tasks.length} entities`);
      await Promise.all(tasks);
    }
    await markFirstSyncComplete(userId);
  }

  log('hydrate done', {
    profileSettings: !!profileSettings,
    savedGyms: savedGyms?.length ?? 0,
    savedWorkouts: savedWorkouts?.length ?? 0,
    exercisePreferences: Object.keys(exercisePreferences ?? {}).length,
    plans: plans?.length ?? 0,
    plannedWorkouts: plannedWorkouts?.length ?? 0,
    workoutHistory: workoutHistory?.length ?? 0,
    personalRecords: personalRecords?.length ?? 0,
    runHistory: runHistory?.length ?? 0,
    runPRs: runPRs?.length ?? 0,
    runPreferences: !!runPreferences,
  });

  return {
    profileSettings,
    savedGyms,
    savedWorkouts,
    exercisePreferences,
    plans,
    plannedWorkouts,
    workoutHistory,
    personalRecords,
    runHistory,
    runPRs,
    runPreferences,
  };
}

function isEmptyObj(obj: object): boolean {
  return obj === null || obj === undefined || Object.keys(obj).length === 0;
}
