/**
 * Run PR Detection — analyses a completed run against the existing PR history
 * and returns any new personal records that were set.
 *
 * Distance PRs (fastest_5k etc.) are detected by scanning the run's GPS route
 * for the fastest contiguous segment matching the target distance. This means
 * a 10K run can also set a new fastest 5K PR if the runner ran a fast 5K split.
 */

import {
  RunLog,
  RunPR,
  RunPRType,
  RoutePoint,
  METERS_PER_MILE,
} from '@/types/run';

const FIVE_K_METERS = 5000;
const TEN_K_METERS = 10000;
const HALF_MARATHON_METERS = 21097.5;
const MARATHON_METERS = 42195;

/** Minimum total distance required for a run to be eligible for a given PR type. */
const PR_MINIMUM_DISTANCE: Record<RunPRType, number> = {
  fastest_mile: METERS_PER_MILE,
  fastest_5k: FIVE_K_METERS,
  fastest_10k: TEN_K_METERS,
  fastest_half_marathon: HALF_MARATHON_METERS,
  fastest_marathon: MARATHON_METERS,
  longest_distance: 0,
  longest_duration: 0,
  highest_elevation_gain: 0,
};

/**
 * Find the fastest contiguous route segment of at least `targetMeters` distance.
 * Returns the duration in seconds, or null if the route is too short.
 *
 * Uses a two-pointer sliding window over the route polyline. Because GPS
 * samples are irregular, we accumulate distance between consecutive points
 * and find the shortest time window that covers >= targetMeters.
 */
function fastestSegmentSeconds(route: RoutePoint[], targetMeters: number): number | null {
  if (route.length < 2) return null;

  // Pre-compute cumulative distance between consecutive points
  const cumDistance: number[] = [0];
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1];
    const b = route[i];
    // Reuse haversine math inline to avoid circular import
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const φ1 = toRad(a.latitude);
    const φ2 = toRad(b.latitude);
    const Δφ = toRad(b.latitude - a.latitude);
    const Δλ = toRad(b.longitude - a.longitude);
    const ha = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(ha), Math.sqrt(1 - ha));
    cumDistance.push(cumDistance[i - 1] + 6371000 * c);
  }

  const totalDistance = cumDistance[cumDistance.length - 1];
  if (totalDistance < targetMeters) return null;

  let bestSeconds = Infinity;
  let left = 0;

  for (let right = 1; right < route.length; right++) {
    while (left < right && cumDistance[right] - cumDistance[left + 1] >= targetMeters) {
      left++;
    }
    const distInWindow = cumDistance[right] - cumDistance[left];
    if (distInWindow >= targetMeters) {
      const timeMs = route[right].timestamp - route[left].timestamp;
      if (timeMs > 0) {
        // Pro-rate: if window covers more than targetMeters, scale time down
        const scaledTimeMs = timeMs * (targetMeters / distInWindow);
        const seconds = scaledTimeMs / 1000;
        if (seconds < bestSeconds) bestSeconds = seconds;
      }
    }
  }

  return isFinite(bestSeconds) ? bestSeconds : null;
}

/**
 * Compute candidate PR values for a finished run.
 * Returns a partial record — only includes types where the run has data.
 */
export function computeRunPRCandidates(run: RunLog): Partial<Record<RunPRType, number>> {
  const candidates: Partial<Record<RunPRType, number>> = {};

  // Distance-based fastest PRs (search within route for sliding-window best)
  if (run.distanceMeters >= METERS_PER_MILE) {
    const t = fastestSegmentSeconds(run.route, METERS_PER_MILE);
    if (t !== null) candidates.fastest_mile = t;
  }
  if (run.distanceMeters >= FIVE_K_METERS) {
    const t = fastestSegmentSeconds(run.route, FIVE_K_METERS);
    if (t !== null) candidates.fastest_5k = t;
  }
  if (run.distanceMeters >= TEN_K_METERS) {
    const t = fastestSegmentSeconds(run.route, TEN_K_METERS);
    if (t !== null) candidates.fastest_10k = t;
  }
  if (run.distanceMeters >= HALF_MARATHON_METERS) {
    const t = fastestSegmentSeconds(run.route, HALF_MARATHON_METERS);
    if (t !== null) candidates.fastest_half_marathon = t;
  }
  if (run.distanceMeters >= MARATHON_METERS) {
    const t = fastestSegmentSeconds(run.route, MARATHON_METERS);
    if (t !== null) candidates.fastest_marathon = t;
  }

  // Distance / duration / elevation absolute PRs
  candidates.longest_distance = run.distanceMeters;
  candidates.longest_duration = run.durationSeconds;
  candidates.highest_elevation_gain = run.elevationGainMeters;

  return candidates;
}

/**
 * Compare a run's candidate PRs against the existing PR history.
 * Returns an array of new PR objects (only the ones that beat existing records,
 * or set a record where none existed before).
 *
 * For "fastest_*" types, lower is better. For "longest_*" / "highest_*", higher is better.
 */
export function detectNewPRs(run: RunLog, existingPRs: RunPR[]): RunPR[] {
  const candidates = computeRunPRCandidates(run);
  const newPRs: RunPR[] = [];

  const existingByType = new Map<RunPRType, RunPR>();
  for (const pr of existingPRs) {
    existingByType.set(pr.type, pr);
  }

  const isFasterIsBetter = (type: RunPRType) => type.startsWith('fastest_');

  for (const [typeKey, value] of Object.entries(candidates)) {
    const type = typeKey as RunPRType;
    if (value === undefined || value === null) continue;
    if (value <= 0) continue;

    // Skip distance-based PRs that don't meet the minimum total distance threshold
    if (run.distanceMeters < PR_MINIMUM_DISTANCE[type] && PR_MINIMUM_DISTANCE[type] > 0) continue;

    const existing = existingByType.get(type);
    let isBetter = false;
    if (!existing) {
      isBetter = true;
    } else if (isFasterIsBetter(type)) {
      isBetter = value < existing.value;
    } else {
      isBetter = value > existing.value;
    }

    if (isBetter) {
      newPRs.push({
        type,
        value,
        unit: isFasterIsBetter(type) ? 'seconds' : (type === 'longest_duration' ? 'seconds' : 'meters'),
        runId: run.id,
        date: run.date,
      });
    }
  }

  return newPRs;
}

/**
 * Merge new PRs into the existing PR list, replacing any same-type entries.
 * Returns a new sorted array (most recent PRs first).
 */
export function mergePRs(existing: RunPR[], newOnes: RunPR[]): RunPR[] {
  if (newOnes.length === 0) return existing;
  const newTypes = new Set(newOnes.map(p => p.type));
  const filtered = existing.filter(p => !newTypes.has(p.type));
  return [...newOnes, ...filtered];
}

/**
 * Human-readable label for a PR type.
 */
export function prTypeLabel(type: RunPRType): string {
  switch (type) {
    case 'fastest_mile': return 'Fastest Mile';
    case 'fastest_5k': return 'Fastest 5K';
    case 'fastest_10k': return 'Fastest 10K';
    case 'fastest_half_marathon': return 'Fastest Half Marathon';
    case 'fastest_marathon': return 'Fastest Marathon';
    case 'longest_distance': return 'Longest Distance';
    case 'longest_duration': return 'Longest Duration';
    case 'highest_elevation_gain': return 'Most Elevation Gain';
  }
}
