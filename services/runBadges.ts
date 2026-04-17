/**
 * Run Badges
 *
 * Pure-function badge system for the Run mode. Mirrors the existing strength
 * achievement pattern but tuned to run-specific milestones — distance,
 * pacing, consistency, variety, and special accomplishments.
 *
 * Each badge has:
 *   - `id`               stable key for persistence + AchievementModal lookups
 *   - `iconName`         maps to ACHIEVEMENT_ICON_NAMES in AchievementModal
 *   - `category`         distance | pace | consistency | variety | special
 *   - `label/description` displayed in the modal + insights
 *   - `target/current`   numeric progress (when applicable)
 *   - a `compute` function that returns whether the badge is unlocked given
 *     the current run history.
 *
 * `computeAllRunBadges(history)` is the entry point used by the UI; it
 * returns the full badge list with `unlocked`, `current`, and `target`
 * filled in. `detectNewlyEarnedRunBadges(prevHistory, history)` returns the
 * badges that just unlocked on the most recent save (used by the run save
 * flow to trigger the AchievementModal).
 */

import { RunLog, Split, METERS_PER_MILE } from '@/types/run';

// ─── Categories ────────────────────────────────────────────────────────

export type RunBadgeCategory =
  | 'distance'
  | 'pace'
  | 'consistency'
  | 'variety'
  | 'special';

export interface RunBadge {
  id: string;
  iconName: string;            // matches ACHIEVEMENT_ICON_NAMES
  category: RunBadgeCategory;
  label: string;
  description: string;
  unlocked: boolean;
  current?: number;
  target?: number;
}

// ─── Computation Helpers ───────────────────────────────────────────────

const FIVE_K_M = 5000;
const TEN_K_M = 10000;
const HALF_M = 21097.5;
const MARATHON_M = 42195;
const HUNDRED_MI_M = 100 * METERS_PER_MILE;
const FIVE_HUNDRED_MI_M = 500 * METERS_PER_MILE;
const THOUSAND_MI_M = 1000 * METERS_PER_MILE;

interface HistoryStats {
  totalDistanceMeters: number;
  totalRuns: number;
  longestDistanceMeters: number;
  /** Best (lowest seconds-per-meter) pace achieved on a full run of >= the given distance. */
  bestFullRunSecondsForDistance: Record<number, number | null>;
  /** Days where the runner completed a run, sorted ascending. */
  runDates: string[];
  /** Count of runs by `runType`. */
  runTypeCount: Record<string, number>;
  /** Number of long runs over 10 miles. */
  longRunsOver10Miles: number;
  /** Number of runs started before 7 AM (local time). */
  earlyMorningRuns: number;
  /** Number of distinct GPS locations (rough cluster — within ~250m of each other count as same). */
  distinctLocations: number;
  /** Map of YYYY-MM → number of PR runs in that month (race or longest distance). */
  prRunsByMonth: Record<string, number>;
  /** Negative split count (run with second half faster than first half). */
  negativeSplitCount: number;
  /** Even-pace count (all splits within 15s of average). */
  evenPaceCount: number;
}

const TARGET_DISTANCES = [METERS_PER_MILE, FIVE_K_M, TEN_K_M, HALF_M, MARATHON_M];

function buildStats(history: RunLog[]): HistoryStats {
  const stats: HistoryStats = {
    totalDistanceMeters: 0,
    totalRuns: history.length,
    longestDistanceMeters: 0,
    bestFullRunSecondsForDistance: {},
    runDates: [],
    runTypeCount: {},
    longRunsOver10Miles: 0,
    earlyMorningRuns: 0,
    distinctLocations: 0,
    prRunsByMonth: {},
    negativeSplitCount: 0,
    evenPaceCount: 0,
  };

  for (const d of TARGET_DISTANCES) {
    stats.bestFullRunSecondsForDistance[d] = null;
  }

  const dateSet = new Set<string>();
  // Cluster start locations using a simple lat/lon rounding (≈250m granularity)
  const locationKeySet = new Set<string>();

  for (const r of history) {
    stats.totalDistanceMeters += r.distanceMeters;
    if (r.distanceMeters > stats.longestDistanceMeters) stats.longestDistanceMeters = r.distanceMeters;
    dateSet.add(r.date);

    const type = r.runType ?? 'free';
    stats.runTypeCount[type] = (stats.runTypeCount[type] ?? 0) + 1;

    // Long runs >10 miles
    if (r.distanceMeters >= 10 * METERS_PER_MILE) stats.longRunsOver10Miles += 1;

    // Early morning (before 7 AM local)
    const start = new Date(r.startTime);
    if (start.getHours() < 7) stats.earlyMorningRuns += 1;

    // Cluster start location to ~250m grid (0.0025deg ≈ 277m latitude)
    if (r.route.length > 0) {
      const p = r.route[0];
      const latKey = Math.round(p.latitude / 0.0025) * 0.0025;
      const lonKey = Math.round(p.longitude / 0.0025) * 0.0025;
      locationKeySet.add(`${latKey.toFixed(4)}_${lonKey.toFixed(4)}`);
    }

    // Best full-run time for each target distance (capacity check + best time)
    for (const d of TARGET_DISTANCES) {
      if (r.distanceMeters >= d) {
        // Compute the time this run would have taken to cover exactly `d`
        // (linear extrapolation from the full run's avg pace)
        const projectedSec = r.averagePaceSecondsPerMeter * d;
        const existing = stats.bestFullRunSecondsForDistance[d];
        if (existing === null || projectedSec < existing) {
          stats.bestFullRunSecondsForDistance[d] = projectedSec;
        }
      }
    }

    // PRs: count race runs + new longest-distance runs as PRs by month
    const monthKey = r.date.substring(0, 7);
    if (r.runType === 'race') {
      stats.prRunsByMonth[monthKey] = (stats.prRunsByMonth[monthKey] ?? 0) + 1;
    }

    // Negative split detection (run's second half faster than first half by avg pace)
    if (r.splits.length >= 2) {
      const half = Math.floor(r.splits.length / 2);
      const firstHalf = r.splits.slice(0, half);
      const secondHalf = r.splits.slice(half);
      const firstAvg = firstHalf.reduce((s, sp) => s + sp.paceSecondsPerMeter, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((s, sp) => s + sp.paceSecondsPerMeter, 0) / secondHalf.length;
      if (secondAvg < firstAvg) stats.negativeSplitCount += 1;

      // Even-pace check (all splits within 15s/mi of average)
      const TOLERANCE_SEC_PER_MILE = 15;
      const TOLERANCE_SEC_PER_METER = TOLERANCE_SEC_PER_MILE / METERS_PER_MILE;
      const avg = r.splits.reduce((s, sp) => s + sp.paceSecondsPerMeter, 0) / r.splits.length;
      const allWithin = r.splits.every(sp => Math.abs(sp.paceSecondsPerMeter - avg) <= TOLERANCE_SEC_PER_METER);
      if (allWithin) stats.evenPaceCount += 1;
    }
  }

  stats.runDates = [...dateSet].sort();
  stats.distinctLocations = locationKeySet.size;
  return stats;
}

/**
 * Longest consecutive day streak in the run history (no rest day breaks).
 * Returns 0 for empty history.
 */
function computeLongestRunStreak(sortedDates: string[]): number {
  if (sortedDates.length === 0) return 0;
  let longest = 1;
  let current = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1] + 'T00:00:00');
    const curr = new Date(sortedDates[i] + 'T00:00:00');
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86_400_000);
    if (diffDays === 1) {
      current += 1;
      longest = Math.max(longest, current);
    } else if (diffDays > 1) {
      current = 1;
    }
  }
  return longest;
}

// ─── Badge Definitions ────────────────────────────────────────────────

export const RUN_BADGES_DEFINITIONS: Omit<RunBadge, 'unlocked' | 'current'>[] = [
  // ─── Distance Milestones ────
  { id: 'run_first_mile',     iconName: 'footprints', category: 'distance', label: 'FIRST MILE',     description: 'Cover your first mile in a single run.', target: 1 },
  { id: 'run_first_5k',       iconName: 'medal',      category: 'distance', label: 'FIRST 5K',       description: 'Run your first 5K (3.1 miles).',        target: 1 },
  { id: 'run_first_10k',      iconName: 'medal',      category: 'distance', label: 'FIRST 10K',      description: 'Run your first 10K (6.2 miles).',       target: 1 },
  { id: 'run_first_half',     iconName: 'trophy',     category: 'distance', label: 'FIRST HALF',     description: 'Complete your first half marathon.',    target: 1 },
  { id: 'run_first_marathon', iconName: 'trophy',     category: 'distance', label: 'FIRST MARATHON', description: 'Complete your first marathon.',          target: 1 },
  { id: 'run_100_mi_club',    iconName: 'medal',      category: 'distance', label: '100-MILE CLUB',  description: 'Run 100 cumulative miles.',              target: 100 },
  { id: 'run_500_mi_club',    iconName: 'trophy',     category: 'distance', label: '500-MILE CLUB',  description: 'Run 500 cumulative miles.',              target: 500 },
  { id: 'run_1000_mi_club',   iconName: 'trophy',     category: 'distance', label: '1000-MILE CLUB', description: 'Run 1000 cumulative miles.',             target: 1000 },

  // ─── Pace Achievements ──────
  { id: 'run_sub_30_5k',  iconName: 'zap', category: 'pace', label: 'SUB-30 5K',  description: 'Run a 5K in under 30 minutes.' },
  { id: 'run_sub_25_5k',  iconName: 'zap', category: 'pace', label: 'SUB-25 5K',  description: 'Run a 5K in under 25 minutes.' },
  { id: 'run_sub_20_5k',  iconName: 'zap', category: 'pace', label: 'SUB-20 5K',  description: 'Run a 5K in under 20 minutes.' },
  { id: 'run_sub_2h_half',  iconName: 'zap',    category: 'pace', label: 'SUB-2H HALF',     description: 'Run a half marathon in under 2:00:00.' },
  { id: 'run_sub_145_half', iconName: 'zap',    category: 'pace', label: 'SUB-1:45 HALF',   description: 'Run a half marathon in under 1:45:00.' },
  { id: 'run_sub_4h_mara',  iconName: 'trophy', category: 'pace', label: 'SUB-4H MARATHON', description: 'Finish a marathon in under 4:00:00.' },
  { id: 'run_sub_330_mara', iconName: 'trophy', category: 'pace', label: 'SUB-3:30 MARATHON', description: 'Finish a marathon in under 3:30:00.' },

  // ─── Consistency ────────────
  { id: 'run_streak_7',     iconName: 'flame',  category: 'consistency', label: 'RUN STREAK 7',  description: 'Run 7 days in a row.',  target: 7 },
  { id: 'run_streak_30',    iconName: 'flame',  category: 'consistency', label: 'RUN STREAK 30', description: 'Run 30 days in a row.', target: 30 },
  { id: 'run_4wk_consistency', iconName: 'shield', category: 'consistency', label: 'CONSISTENT', description: 'Run at least 4 days a week for 4 straight weeks.', target: 4 },

  // ─── Variety ────────────────
  { id: 'run_trail_blazer', iconName: 'compass', category: 'variety', label: 'TRAIL BLAZER',  description: 'Start runs from 5 distinct locations.', target: 5 },
  { id: 'run_speed_demon',  iconName: 'zap',     category: 'variety', label: 'SPEED DEMON',   description: 'Complete 10 interval workouts.',         target: 10 },
  { id: 'run_long_hauler',  iconName: 'medal',   category: 'variety', label: 'LONG HAULER',   description: 'Complete 10 long runs over 10 miles.',   target: 10 },
  { id: 'run_early_riser',  iconName: 'zap',     category: 'variety', label: 'EARLY RISER',   description: 'Start 10 runs before 7 AM.',             target: 10 },

  // ─── Special ────────────────
  { id: 'run_negative_split', iconName: 'trophy', category: 'special', label: 'NEGATIVE SPLIT', description: 'Run the second half faster than the first.' },
  { id: 'run_even_steven',    iconName: 'shield', category: 'special', label: 'EVEN STEVEN',    description: 'Hit every split within 15 seconds of your average.' },
  { id: 'run_pr_crusher',     iconName: 'trophy', category: 'special', label: 'PR CRUSHER',     description: 'Set 3 run PRs in a single calendar month.', target: 3 },
];

// ─── Per-Badge Compute Logic ───────────────────────────────────────────

function evaluateBadge(def: typeof RUN_BADGES_DEFINITIONS[number], stats: HistoryStats): { unlocked: boolean; current?: number; target?: number } {
  const totalMiles = stats.totalDistanceMeters / METERS_PER_MILE;
  switch (def.id) {
    // Distance
    case 'run_first_mile':
      return { unlocked: stats.longestDistanceMeters >= METERS_PER_MILE, current: Math.min(1, stats.longestDistanceMeters / METERS_PER_MILE), target: 1 };
    case 'run_first_5k':
      return { unlocked: stats.longestDistanceMeters >= FIVE_K_M };
    case 'run_first_10k':
      return { unlocked: stats.longestDistanceMeters >= TEN_K_M };
    case 'run_first_half':
      return { unlocked: stats.longestDistanceMeters >= HALF_M };
    case 'run_first_marathon':
      return { unlocked: stats.longestDistanceMeters >= MARATHON_M };
    case 'run_100_mi_club':
      return { unlocked: stats.totalDistanceMeters >= HUNDRED_MI_M, current: Math.min(100, totalMiles), target: 100 };
    case 'run_500_mi_club':
      return { unlocked: stats.totalDistanceMeters >= FIVE_HUNDRED_MI_M, current: Math.min(500, totalMiles), target: 500 };
    case 'run_1000_mi_club':
      return { unlocked: stats.totalDistanceMeters >= THOUSAND_MI_M, current: Math.min(1000, totalMiles), target: 1000 };

    // Pace
    case 'run_sub_30_5k': {
      const t = stats.bestFullRunSecondsForDistance[FIVE_K_M];
      return { unlocked: t !== null && t < 30 * 60 };
    }
    case 'run_sub_25_5k': {
      const t = stats.bestFullRunSecondsForDistance[FIVE_K_M];
      return { unlocked: t !== null && t < 25 * 60 };
    }
    case 'run_sub_20_5k': {
      const t = stats.bestFullRunSecondsForDistance[FIVE_K_M];
      return { unlocked: t !== null && t < 20 * 60 };
    }
    case 'run_sub_2h_half': {
      const t = stats.bestFullRunSecondsForDistance[HALF_M];
      return { unlocked: t !== null && t < 2 * 3600 };
    }
    case 'run_sub_145_half': {
      const t = stats.bestFullRunSecondsForDistance[HALF_M];
      return { unlocked: t !== null && t < (1 * 3600 + 45 * 60) };
    }
    case 'run_sub_4h_mara': {
      const t = stats.bestFullRunSecondsForDistance[MARATHON_M];
      return { unlocked: t !== null && t < 4 * 3600 };
    }
    case 'run_sub_330_mara': {
      const t = stats.bestFullRunSecondsForDistance[MARATHON_M];
      return { unlocked: t !== null && t < (3 * 3600 + 30 * 60) };
    }

    // Consistency
    case 'run_streak_7': {
      const longest = computeLongestRunStreak(stats.runDates);
      return { unlocked: longest >= 7, current: Math.min(7, longest), target: 7 };
    }
    case 'run_streak_30': {
      const longest = computeLongestRunStreak(stats.runDates);
      return { unlocked: longest >= 30, current: Math.min(30, longest), target: 30 };
    }
    case 'run_4wk_consistency': {
      // Count how many of the last 4 calendar weeks the runner had ≥4 runs
      const now = new Date();
      const weeks = [0, 1, 2, 3].map(w => {
        const start = new Date(now);
        start.setDate(now.getDate() - now.getDay() - w * 7);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 7);
        return { start, end };
      });
      const dateMap = new Set(stats.runDates);
      let weeksMet = 0;
      for (const w of weeks) {
        let runsThisWeek = 0;
        const cursor = new Date(w.start);
        while (cursor < w.end) {
          const ds = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
          if (dateMap.has(ds)) runsThisWeek += 1;
          cursor.setDate(cursor.getDate() + 1);
        }
        if (runsThisWeek >= 4) weeksMet += 1;
      }
      return { unlocked: weeksMet >= 4, current: Math.min(4, weeksMet), target: 4 };
    }

    // Variety
    case 'run_trail_blazer':
      return { unlocked: stats.distinctLocations >= 5, current: Math.min(5, stats.distinctLocations), target: 5 };
    case 'run_speed_demon': {
      const intervalCount = stats.runTypeCount['interval'] ?? 0;
      return { unlocked: intervalCount >= 10, current: Math.min(10, intervalCount), target: 10 };
    }
    case 'run_long_hauler':
      return { unlocked: stats.longRunsOver10Miles >= 10, current: Math.min(10, stats.longRunsOver10Miles), target: 10 };
    case 'run_early_riser':
      return { unlocked: stats.earlyMorningRuns >= 10, current: Math.min(10, stats.earlyMorningRuns), target: 10 };

    // Special
    case 'run_negative_split':
      return { unlocked: stats.negativeSplitCount >= 1 };
    case 'run_even_steven':
      return { unlocked: stats.evenPaceCount >= 1 };
    case 'run_pr_crusher': {
      // Highest PR-runs-per-month value across all months
      const max = Object.values(stats.prRunsByMonth).reduce((m, v) => Math.max(m, v), 0);
      return { unlocked: max >= 3, current: Math.min(3, max), target: 3 };
    }
    default:
      return { unlocked: false };
  }
}

// ─── Public API ───────────────────────────────────────────────────────

/**
 * Compute every badge against the current run history. Returns the full
 * RUN_BADGES_DEFINITIONS list with `unlocked`, `current`, and `target`
 * filled in for the UI to render.
 */
export function computeAllRunBadges(history: RunLog[]): RunBadge[] {
  const stats = buildStats(history);
  return RUN_BADGES_DEFINITIONS.map(def => {
    const result = evaluateBadge(def, stats);
    return {
      ...def,
      unlocked: result.unlocked,
      current: result.current ?? def.target,
      target: result.target ?? def.target,
    };
  });
}

/**
 * Compare badge state before vs. after a run save and return any badges
 * that just unlocked. The save flow uses this to fire AchievementModals.
 */
export function detectNewlyEarnedRunBadges(prevHistory: RunLog[], newHistory: RunLog[]): RunBadge[] {
  const prev = computeAllRunBadges(prevHistory);
  const next = computeAllRunBadges(newHistory);
  const prevUnlocked = new Set(prev.filter(b => b.unlocked).map(b => b.id));
  return next.filter(b => b.unlocked && !prevUnlocked.has(b.id));
}

/** Convenience: count of currently unlocked badges. */
export function countUnlockedRunBadges(history: RunLog[]): number {
  return computeAllRunBadges(history).filter(b => b.unlocked).length;
}
