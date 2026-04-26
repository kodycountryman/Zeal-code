// ─────────────────────────────────────────────────────────────────
// TEMPORARILY STUBBED — disabling native module to bisect launch crash.
// Restore this file once we identify the crashing module.
// ─────────────────────────────────────────────────────────────────

export type ActivityType = 'workout' | 'run';

export interface ActivityParams {
  type: ActivityType;
  title: string;
  subtitle: string;
  detail: string;
}

export interface UpdateParams {
  title?: string;
  subtitle?: string;
  detail?: string;
}

export function isLiveActivityAvailable(): boolean {
  return false;
}

export async function startActivity(_params: ActivityParams): Promise<string | null> {
  return null;
}

export async function updateActivity(_activityId: string, _params: UpdateParams): Promise<void> {
  // no-op
}

export async function startRestTimer(_activityId: string, _durationSeconds: number): Promise<void> {
  // no-op
}

export async function endActivity(_activityId: string): Promise<void> {
  // no-op
}
