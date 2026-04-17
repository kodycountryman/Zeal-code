/**
 * Run Insights Engine
 *
 * Pure functions that crunch a `RunLog[]` history into the analytics surfaced
 * by the RunInsights UI: pace/mileage trends, training load (ACWR), pace by
 * type, distribution histograms, fastest splits, etc.
 *
 * All distances stay in METERS internally; the UI converts to display units.
 * All paces are seconds-per-meter; helpers exist on `runTrackingService` for
 * mile/km conversion.
 */

import { RunLog, Split, RunType, METERS_PER_MILE, METERS_PER_KM } from '@/types/run';

const DAY_MS = 86_400_000;

// ─── Helpers ────────────────────────────────────────────────────────────

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekKey(date: Date): string {
  const w = startOfWeek(date);
  return `${w.getFullYear()}-${String(w.getMonth() + 1).padStart(2, '0')}-${String(w.getDate()).padStart(2, '0')}`;
}

function shortWeekLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Weekly Trends ──────────────────────────────────────────────────────

export interface WeeklyTrendBucket {
  weekStart: Date;
  weekKey: string;
  label: string;            // "Mar 3"
  totalMeters: number;
  totalSeconds: number;
  runCount: number;
  averagePaceSecondsPerMeter: number | null; // weighted by distance
}

/**
 * Build N most-recent weekly buckets (oldest first) from the history.
 * Buckets without runs are still included so the chart has continuous bars.
 */
export function getWeeklyTrend(history: RunLog[], weeks = 12): WeeklyTrendBucket[] {
  const now = new Date();
  const currentWeek = startOfWeek(now);
  const buckets: WeeklyTrendBucket[] = [];

  for (let w = weeks - 1; w >= 0; w--) {
    const ws = new Date(currentWeek);
    ws.setDate(ws.getDate() - w * 7);
    const key = weekKey(ws);
    buckets.push({
      weekStart: ws,
      weekKey: key,
      label: shortWeekLabel(ws),
      totalMeters: 0,
      totalSeconds: 0,
      runCount: 0,
      averagePaceSecondsPerMeter: null,
    });
  }

  const indexByKey = new Map<string, number>();
  buckets.forEach((b, i) => indexByKey.set(b.weekKey, i));

  for (const r of history) {
    const t = new Date(r.startTime);
    const key = weekKey(t);
    const idx = indexByKey.get(key);
    if (idx === undefined) continue;
    buckets[idx].totalMeters += r.distanceMeters;
    buckets[idx].totalSeconds += r.durationSeconds;
    buckets[idx].runCount += 1;
  }

  for (const b of buckets) {
    b.averagePaceSecondsPerMeter = b.totalMeters > 0 ? b.totalSeconds / b.totalMeters : null;
  }

  return buckets;
}

// ─── Pace by Run Type ───────────────────────────────────────────────────

export interface PaceByTypeBucket {
  runType: RunType;
  label: string;
  count: number;
  averagePaceSecondsPerMeter: number;  // weighted by distance
  totalMeters: number;
}

const RUN_TYPE_LABELS: Record<RunType, string> = {
  easy: 'Easy',
  recovery: 'Recovery',
  long_run: 'Long Run',
  tempo: 'Tempo',
  interval: 'Intervals',
  fartlek: 'Fartlek',
  hill_repeats: 'Hills',
  progression: 'Progression',
  race: 'Race',
  free: 'Free',
};

export function getPaceByRunType(history: RunLog[]): PaceByTypeBucket[] {
  const groups = new Map<RunType, { totalSec: number; totalMeters: number; count: number }>();
  for (const r of history) {
    if (r.distanceMeters < 100) continue;
    const t = (r.runType ?? 'free') as RunType;
    const g = groups.get(t) ?? { totalSec: 0, totalMeters: 0, count: 0 };
    g.totalSec += r.durationSeconds;
    g.totalMeters += r.distanceMeters;
    g.count += 1;
    groups.set(t, g);
  }
  const result: PaceByTypeBucket[] = [];
  for (const [runType, g] of groups) {
    if (g.totalMeters <= 0) continue;
    result.push({
      runType,
      label: RUN_TYPE_LABELS[runType],
      count: g.count,
      averagePaceSecondsPerMeter: g.totalSec / g.totalMeters,
      totalMeters: g.totalMeters,
    });
  }
  // Sort by typical effort: recovery → easy → long → tempo → interval → race
  const ORDER: RunType[] = ['recovery', 'easy', 'long_run', 'progression', 'fartlek', 'tempo', 'hill_repeats', 'interval', 'race', 'free'];
  return result.sort((a, b) => ORDER.indexOf(a.runType) - ORDER.indexOf(b.runType));
}

// ─── Pace Distribution Histogram ────────────────────────────────────────

export interface PaceHistogramBucket {
  /** sec/mile lower bound of this bucket */
  paceLowSecPerMile: number;
  paceHighSecPerMile: number;
  count: number;
  totalMeters: number;
}

/**
 * Histogram of average pace across all runs, bucketed in 30-second-per-mile
 * windows from 5:00/mi to 14:00/mi. Returns only buckets with ≥1 run.
 */
export function getPaceHistogram(history: RunLog[]): PaceHistogramBucket[] {
  const BUCKET_WIDTH = 30; // seconds per mile
  const MIN = 300; // 5:00/mi
  const MAX = 840; // 14:00/mi
  const buckets: PaceHistogramBucket[] = [];
  for (let p = MIN; p < MAX; p += BUCKET_WIDTH) {
    buckets.push({
      paceLowSecPerMile: p,
      paceHighSecPerMile: p + BUCKET_WIDTH,
      count: 0,
      totalMeters: 0,
    });
  }
  for (const r of history) {
    if (r.distanceMeters < 100 || r.averagePaceSecondsPerMeter <= 0) continue;
    const paceSecPerMile = r.averagePaceSecondsPerMeter * METERS_PER_MILE;
    if (paceSecPerMile < MIN || paceSecPerMile >= MAX) continue;
    const bucketIdx = Math.floor((paceSecPerMile - MIN) / BUCKET_WIDTH);
    if (bucketIdx < 0 || bucketIdx >= buckets.length) continue;
    buckets[bucketIdx].count += 1;
    buckets[bucketIdx].totalMeters += r.distanceMeters;
  }
  return buckets.filter(b => b.count > 0);
}

// ─── Fastest Splits Leaderboard ─────────────────────────────────────────

export interface FastestSplit {
  paceSecondsPerMeter: number;   // pace within the split
  distanceMeters: number;         // size of the split (mile or km)
  durationSeconds: number;        // time taken to cover the split
  runId: string;
  date: string;                   // YYYY-MM-DD
  splitIndex: number;
  unit: 'imperial' | 'metric';
}

/**
 * Top N fastest splits across all runs (across mile-or-km splits).
 */
export function getFastestSplits(history: RunLog[], n = 10): FastestSplit[] {
  const all: FastestSplit[] = [];
  for (const r of history) {
    for (const s of r.splits) {
      if (s.paceSecondsPerMeter <= 0) continue;
      all.push({
        paceSecondsPerMeter: s.paceSecondsPerMeter,
        distanceMeters: s.distanceMeters,
        durationSeconds: s.durationSeconds,
        runId: r.id,
        date: r.date,
        splitIndex: s.index,
        unit: s.unit,
      });
    }
  }
  return all
    .sort((a, b) => a.paceSecondsPerMeter - b.paceSecondsPerMeter)
    .slice(0, n);
}

// ─── Training Load — Acute:Chronic Workload Ratio (ACWR) ────────────────

export type LoadStatus = 'undertraining' | 'optimal' | 'overreaching' | 'high_risk' | 'insufficient_data';

export interface TrainingLoad {
  acuteMeters: number;          // last 7 days
  chronicMeters: number;        // last 28 days, divided by 4 to compare apples-to-apples
  ratio: number;                // acute / chronic (target 0.8-1.3)
  status: LoadStatus;
  /** "+12% vs last week" — simple WoW change. */
  weekOverWeekChangePct: number | null;
  weekOverWeekIsRisky: boolean; // true when WoW > 10% (classic 10% rule)
  message: string;
}

export function getTrainingLoad(history: RunLog[]): TrainingLoad {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * DAY_MS;
  const fourteenDaysAgo = now - 14 * DAY_MS;
  const twentyEightDaysAgo = now - 28 * DAY_MS;

  let acute = 0;
  let chronic = 0;
  let lastWeek = 0;
  let priorWeek = 0;

  for (const r of history) {
    const t = new Date(r.startTime).getTime();
    if (t >= twentyEightDaysAgo) chronic += r.distanceMeters;
    if (t >= sevenDaysAgo) acute += r.distanceMeters;
    if (t >= sevenDaysAgo) lastWeek += r.distanceMeters;
    else if (t >= fourteenDaysAgo) priorWeek += r.distanceMeters;
  }

  if (chronic === 0) {
    return {
      acuteMeters: acute,
      chronicMeters: 0,
      ratio: 0,
      status: 'insufficient_data',
      weekOverWeekChangePct: null,
      weekOverWeekIsRisky: false,
      message: 'Log a few runs to see your training load.',
    };
  }

  // Normalize chronic to a per-week equivalent for fair comparison
  const chronicPerWeek = chronic / 4;
  const ratio = chronicPerWeek > 0 ? acute / chronicPerWeek : 0;

  let status: LoadStatus = 'optimal';
  let message = 'You\'re in the sweet spot — keep it up.';
  if (ratio < 0.7) {
    status = 'undertraining';
    message = 'Training load is low. Consider adding a run or stretching this week\'s long run.';
  } else if (ratio >= 0.8 && ratio <= 1.3) {
    status = 'optimal';
    message = 'Training load is in the sweet spot for adaptation.';
  } else if (ratio > 1.3 && ratio <= 1.5) {
    status = 'overreaching';
    message = 'Approaching overreach — watch for fatigue and prioritize recovery.';
  } else if (ratio > 1.5) {
    status = 'high_risk';
    message = 'High injury risk — you ramped too fast. Take an easy week.';
  }

  let wowPct: number | null = null;
  let wowRisky = false;
  if (priorWeek > 0) {
    wowPct = ((lastWeek - priorWeek) / priorWeek) * 100;
    wowRisky = wowPct > 10;
  }

  return {
    acuteMeters: acute,
    chronicMeters: chronic,
    ratio,
    status,
    weekOverWeekChangePct: wowPct,
    weekOverWeekIsRisky: wowRisky,
    message,
  };
}

// ─── Aggregate Stats ────────────────────────────────────────────────────

export interface RunAggregateStats {
  totalRuns: number;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  totalElevationMeters: number;
  averagePaceSecondsPerMeter: number | null;
  longestRunMeters: number;
  longestRunId: string | null;
  fastestPaceSecondsPerMeter: number | null;
  /** Average distance per run. */
  averageRunMeters: number;
}

export function getAggregateStats(history: RunLog[]): RunAggregateStats {
  if (history.length === 0) {
    return {
      totalRuns: 0,
      totalDistanceMeters: 0,
      totalDurationSeconds: 0,
      totalElevationMeters: 0,
      averagePaceSecondsPerMeter: null,
      longestRunMeters: 0,
      longestRunId: null,
      fastestPaceSecondsPerMeter: null,
      averageRunMeters: 0,
    };
  }
  let totalMeters = 0;
  let totalSec = 0;
  let totalElev = 0;
  let longestRun: RunLog | null = null;
  let fastestPace: number | null = null;
  for (const r of history) {
    totalMeters += r.distanceMeters;
    totalSec += r.durationSeconds;
    totalElev += r.elevationGainMeters;
    if (!longestRun || r.distanceMeters > longestRun.distanceMeters) longestRun = r;
    if (r.averagePaceSecondsPerMeter > 0) {
      if (fastestPace === null || r.averagePaceSecondsPerMeter < fastestPace) {
        fastestPace = r.averagePaceSecondsPerMeter;
      }
    }
  }
  return {
    totalRuns: history.length,
    totalDistanceMeters: totalMeters,
    totalDurationSeconds: totalSec,
    totalElevationMeters: totalElev,
    averagePaceSecondsPerMeter: totalMeters > 0 ? totalSec / totalMeters : null,
    longestRunMeters: longestRun?.distanceMeters ?? 0,
    longestRunId: longestRun?.id ?? null,
    fastestPaceSecondsPerMeter: fastestPace,
    averageRunMeters: totalMeters / history.length,
  };
}
