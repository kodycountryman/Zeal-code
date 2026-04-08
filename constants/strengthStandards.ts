/**
 * Strength Standards — percentile lookup tables for key compound lifts.
 *
 * Thresholds are expressed as **bodyweight multipliers** (1RM / bodyweight).
 * This avoids needing separate tables per weight class.
 *
 * Sources: aggregated from Strength Level, Symmetric Strength, and ExRx data.
 * Each tier boundary represents the approximate percentile ceiling:
 *   beginner  →  0-20th   (< 6 months training)
 *   novice    → 20-40th   (6-12 months)
 *   intermediate → 40-60th (1-3 years)
 *   advanced  → 60-80th   (3-5+ years)
 *   elite     → 80-95th+  (competitive)
 */

export type RadarCategory =
  | 'upper_push'
  | 'upper_pull'
  | 'lower_push'
  | 'lower_pull'
  | 'core'
  | 'conditioning';

export type StrengthTier = 'Beginner' | 'Novice' | 'Intermediate' | 'Advanced' | 'Elite';

export const TIER_COLORS: Record<StrengthTier, string> = {
  Beginner: '#6b7280',      // gray
  Novice: '#3b82f6',        // blue
  Intermediate: '#f59e0b',  // amber
  Advanced: '#f87116',      // orange
  Elite: '#eab308',         // gold
};

export const TIER_PERCENTILE_RANGES: Record<StrengthTier, [number, number]> = {
  Beginner: [0, 20],
  Novice: [20, 40],
  Intermediate: [40, 60],
  Advanced: [60, 80],
  Elite: [80, 99],
};

interface TierThresholds {
  beginner: number;
  novice: number;
  intermediate: number;
  advanced: number;
  elite: number;
}

export interface StrengthStandard {
  exerciseName: string;
  aliases: string[];
  radarCategory: RadarCategory;
  isPrimary: boolean; // primary lift for this category (used for radar if multiple available)
  male: TierThresholds;
  female: TierThresholds;
}

/**
 * Strength standards for 10 key compound lifts.
 * Values are 1RM / bodyweight multipliers.
 *
 * Matching is done by exercise name (case-insensitive) against exerciseName + aliases.
 */
export const STRENGTH_STANDARDS: StrengthStandard[] = [
  // ─── Upper Push ───────────────────────────────────────────
  {
    exerciseName: 'Barbell Bench Press',
    aliases: ['Bench Press', 'Flat Bench Press', 'Flat Barbell Bench Press'],
    radarCategory: 'upper_push',
    isPrimary: true,
    male:   { beginner: 0.50, novice: 0.75, intermediate: 1.00, advanced: 1.25, elite: 1.50 },
    female: { beginner: 0.25, novice: 0.40, intermediate: 0.60, advanced: 0.80, elite: 1.00 },
  },
  {
    exerciseName: 'Standing Overhead Press',
    aliases: ['Overhead Press', 'OHP', 'Barbell Overhead Press', 'Military Press', 'Strict Press'],
    radarCategory: 'upper_push',
    isPrimary: false,
    male:   { beginner: 0.35, novice: 0.50, intermediate: 0.65, advanced: 0.85, elite: 1.05 },
    female: { beginner: 0.20, novice: 0.30, intermediate: 0.45, advanced: 0.60, elite: 0.75 },
  },

  // ─── Upper Pull ───────────────────────────────────────────
  {
    exerciseName: 'Barbell Bent-Over Row',
    aliases: ['Bent Over Row', 'Barbell Row', 'Pendlay Row'],
    radarCategory: 'upper_pull',
    isPrimary: true,
    male:   { beginner: 0.40, novice: 0.60, intermediate: 0.80, advanced: 1.05, elite: 1.30 },
    female: { beginner: 0.20, novice: 0.35, intermediate: 0.50, advanced: 0.70, elite: 0.85 },
  },
  {
    exerciseName: 'Pull-Up',
    aliases: ['Pullup', 'Pull Up', 'Weighted Pull-Up', 'Weighted Pullup', 'Chin-Up', 'Chin Up'],
    radarCategory: 'upper_pull',
    isPrimary: false,
    // Pull-up multiplier: (bodyweight + added weight) / bodyweight
    // beginner = bodyweight only, elite = BW + 50-70% BW
    male:   { beginner: 1.00, novice: 1.10, intermediate: 1.25, advanced: 1.45, elite: 1.70 },
    female: { beginner: 0.70, novice: 0.85, intermediate: 1.00, advanced: 1.15, elite: 1.35 },
  },

  // ─── Lower Push ───────────────────────────────────────────
  {
    exerciseName: 'Barbell Back Squat',
    aliases: ['Back Squat', 'Squat', 'Barbell Squat', 'Low Bar Squat', 'High Bar Squat'],
    radarCategory: 'lower_push',
    isPrimary: true,
    male:   { beginner: 0.60, novice: 0.90, intermediate: 1.20, advanced: 1.55, elite: 1.90 },
    female: { beginner: 0.35, novice: 0.55, intermediate: 0.80, advanced: 1.05, elite: 1.30 },
  },
  {
    exerciseName: 'Leg Press',
    aliases: ['Machine Leg Press', '45-Degree Leg Press'],
    radarCategory: 'lower_push',
    isPrimary: false,
    // Leg press multipliers are higher because the machine removes stabilization
    male:   { beginner: 1.00, novice: 1.50, intermediate: 2.00, advanced: 2.75, elite: 3.50 },
    female: { beginner: 0.60, novice: 1.00, intermediate: 1.50, advanced: 2.00, elite: 2.75 },
  },

  // ─── Lower Pull ───────────────────────────────────────────
  {
    exerciseName: 'Conventional Deadlift',
    aliases: ['Deadlift', 'Barbell Deadlift'],
    radarCategory: 'lower_pull',
    isPrimary: true,
    male:   { beginner: 0.75, novice: 1.00, intermediate: 1.40, advanced: 1.80, elite: 2.20 },
    female: { beginner: 0.40, novice: 0.65, intermediate: 0.90, advanced: 1.20, elite: 1.50 },
  },
  {
    exerciseName: 'Romanian Deadlift',
    aliases: ['RDL', 'Barbell RDL', 'Stiff-Leg Deadlift'],
    radarCategory: 'lower_pull',
    isPrimary: false,
    male:   { beginner: 0.50, novice: 0.70, intermediate: 0.95, advanced: 1.20, elite: 1.50 },
    female: { beginner: 0.30, novice: 0.45, intermediate: 0.65, advanced: 0.85, elite: 1.10 },
  },
  {
    exerciseName: 'Trap Bar Deadlift',
    aliases: ['Hex Bar Deadlift'],
    radarCategory: 'lower_pull',
    isPrimary: false,
    male:   { beginner: 0.80, novice: 1.10, intermediate: 1.50, advanced: 1.90, elite: 2.30 },
    female: { beginner: 0.45, novice: 0.70, intermediate: 1.00, advanced: 1.30, elite: 1.60 },
  },
  {
    exerciseName: 'Barbell Hip Thrust',
    aliases: ['Hip Thrust', 'Barbell Glute Bridge', 'Glute Bridge'],
    radarCategory: 'lower_pull',
    isPrimary: false,
    male:   { beginner: 0.60, novice: 0.90, intermediate: 1.25, advanced: 1.60, elite: 2.00 },
    female: { beginner: 0.40, novice: 0.70, intermediate: 1.00, advanced: 1.40, elite: 1.80 },
  },
];

// ─── Lookup Helpers ─────────────────────────────────────────

const _nameIndex = new Map<string, StrengthStandard>();
for (const std of STRENGTH_STANDARDS) {
  _nameIndex.set(std.exerciseName.toLowerCase(), std);
  for (const alias of std.aliases) {
    _nameIndex.set(alias.toLowerCase(), std);
  }
}

export function findStandard(exerciseName: string): StrengthStandard | null {
  return _nameIndex.get(exerciseName.toLowerCase()) ?? null;
}

/**
 * Estimate 1RM from a weight × reps set using the Epley formula.
 */
export function est1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

/**
 * Get a 0-99 percentile for a given lift, sex, bodyweight, and estimated 1RM.
 * Returns null if the exercise is not in the standards table.
 */
export function getPercentile(
  sex: string,
  exerciseName: string,
  bodyweightLbs: number,
  estimated1RM: number,
): number | null {
  const std = findStandard(exerciseName);
  if (!std || bodyweightLbs <= 0) return null;

  const thresholds = sex === 'female' ? std.female : std.male;
  const ratio = estimated1RM / bodyweightLbs;

  // Interpolate within tier ranges
  const tiers: { key: StrengthTier; floor: number; ceiling: number; pctFloor: number; pctCeiling: number }[] = [
    { key: 'Beginner',     floor: 0,                        ceiling: thresholds.beginner,     pctFloor: 0,  pctCeiling: 20 },
    { key: 'Novice',       floor: thresholds.beginner,      ceiling: thresholds.novice,       pctFloor: 20, pctCeiling: 40 },
    { key: 'Intermediate', floor: thresholds.novice,        ceiling: thresholds.intermediate, pctFloor: 40, pctCeiling: 60 },
    { key: 'Advanced',     floor: thresholds.intermediate,  ceiling: thresholds.advanced,     pctFloor: 60, pctCeiling: 80 },
    { key: 'Elite',        floor: thresholds.advanced,      ceiling: thresholds.elite,        pctFloor: 80, pctCeiling: 99 },
  ];

  // Below beginner floor
  if (ratio <= 0) return 0;

  // Above elite ceiling
  if (ratio >= thresholds.elite) return 99;

  for (const tier of tiers) {
    if (ratio <= tier.ceiling) {
      const range = tier.ceiling - tier.floor;
      if (range <= 0) return tier.pctFloor;
      const progress = (ratio - tier.floor) / range;
      return Math.round(tier.pctFloor + progress * (tier.pctCeiling - tier.pctFloor));
    }
  }

  return 99;
}

/**
 * Get the tier label for a percentile value.
 */
export function getTierForPercentile(percentile: number): StrengthTier {
  if (percentile < 20) return 'Beginner';
  if (percentile < 40) return 'Novice';
  if (percentile < 60) return 'Intermediate';
  if (percentile < 80) return 'Advanced';
  return 'Elite';
}

/**
 * For a given exercise and percentile, compute the 1RM needed to reach the next tier.
 */
export function getNextTierTarget(
  sex: string,
  exerciseName: string,
  bodyweightLbs: number,
  currentPercentile: number,
): { tier: StrengthTier; target1RM: number } | null {
  const std = findStandard(exerciseName);
  if (!std || bodyweightLbs <= 0) return null;

  const thresholds = sex === 'female' ? std.female : std.male;
  const currentTier = getTierForPercentile(currentPercentile);

  const nextTierMap: Partial<Record<StrengthTier, { tier: StrengthTier; multiplier: number }>> = {
    Beginner:     { tier: 'Novice',       multiplier: thresholds.novice },
    Novice:       { tier: 'Intermediate', multiplier: thresholds.intermediate },
    Intermediate: { tier: 'Advanced',     multiplier: thresholds.advanced },
    Advanced:     { tier: 'Elite',        multiplier: thresholds.elite },
  };

  const next = nextTierMap[currentTier];
  if (!next) return null; // already elite

  return {
    tier: next.tier,
    target1RM: Math.round(next.multiplier * bodyweightLbs),
  };
}

export interface RadarPercentileResult {
  category: RadarCategory;
  label: string;
  percentile: number | null;  // null = no data
  tier: StrengthTier | null;
  drivingExercise: string | null;
  drivingE1RM: number | null;
}

export const RADAR_CATEGORY_LABELS: Record<RadarCategory, string> = {
  upper_push: 'Upper Push',
  upper_pull: 'Upper Pull',
  lower_push: 'Lower Push',
  lower_pull: 'Lower Pull',
  core: 'Core',
  conditioning: 'Conditioning',
};

interface PREntry {
  exerciseName: string;
  type: string;
  value: number;
  date: string;
}

interface LogEntry {
  workoutStyle: string;
  duration: number;
  date: string;
  exercises?: Array<{
    exerciseName: string;
    sets: Array<{ weight: number; reps: number }>;
  }>;
}

/**
 * Compute radar percentile data from the user's PR history and workout logs.
 *
 * For strength categories (upper_push, upper_pull, lower_push, lower_pull):
 *   Uses the best estimated 1RM from PRs matched to known exercises.
 *
 * For conditioning:
 *   Uses HIIT/CrossFit/Cardio session frequency as a proxy.
 *
 * For core:
 *   Not enough standardized data — returns null unless we add weighted core standards later.
 */
export function getRadarPercentiles(
  sex: string,
  bodyweightLbs: number,
  prHistory: PREntry[],
  workoutHistory: LogEntry[],
): RadarPercentileResult[] {
  const categories: RadarCategory[] = ['upper_push', 'upper_pull', 'lower_push', 'lower_pull', 'core', 'conditioning'];

  // Build best e1RM per exercise from PRs
  const best1RM = new Map<string, { e1rm: number; exerciseName: string }>();
  for (const pr of prHistory) {
    if (pr.type !== 'weight') continue;
    const std = findStandard(pr.exerciseName);
    if (!std) continue;

    // For weight PRs, assume at least 1 rep if no rep data
    const e1rm = pr.value; // weight PRs store the weight itself; est1RM with reps would be better
    const existing = best1RM.get(pr.exerciseName.toLowerCase());
    if (!existing || e1rm > existing.e1rm) {
      best1RM.set(pr.exerciseName.toLowerCase(), { e1rm, exerciseName: pr.exerciseName });
    }
  }

  // Also scan workout logs for best sets (in case PRs are sparse)
  for (const log of workoutHistory) {
    if (!log.exercises) continue;
    for (const ex of log.exercises) {
      const std = findStandard(ex.exerciseName);
      if (!std) continue;
      for (const set of ex.sets) {
        if (set.weight > 0 && set.reps > 0) {
          const e1rm = est1RM(set.weight, set.reps);
          const key = ex.exerciseName.toLowerCase();
          const existing = best1RM.get(key);
          if (!existing || e1rm > existing.e1rm) {
            best1RM.set(key, { e1rm, exerciseName: ex.exerciseName });
          }
        }
      }
    }
  }

  // Group best results by radar category, preferring primary exercises
  const categoryBest = new Map<RadarCategory, { percentile: number; exerciseName: string; e1rm: number; isPrimary: boolean }>();

  for (const [, { e1rm, exerciseName }] of best1RM) {
    const std = findStandard(exerciseName);
    if (!std) continue;

    const pct = getPercentile(sex, exerciseName, bodyweightLbs, e1rm);
    if (pct === null) continue;

    const existing = categoryBest.get(std.radarCategory);
    // Prefer primary lift, or higher percentile if same priority
    if (!existing || (std.isPrimary && !existing.isPrimary) || (std.isPrimary === existing.isPrimary && pct > existing.percentile)) {
      categoryBest.set(std.radarCategory, { percentile: pct, exerciseName, e1rm, isPrimary: std.isPrimary });
    }
  }

  // Conditioning: frequency-based heuristic
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  const recentConditioningSessions = workoutHistory.filter(log => {
    const style = log.workoutStyle;
    const isConditioning = style === 'HIIT' || style === 'CrossFit';
    return isConditioning && new Date(log.date + 'T00:00:00') >= fourWeeksAgo;
  }).length;

  // Map sessions/4 weeks to percentile: 0=0, 4=20, 8=40, 12=60, 16=80, 20+=95
  const conditioningPct = recentConditioningSessions === 0
    ? null
    : Math.min(99, Math.round((recentConditioningSessions / 20) * 99));

  return categories.map(cat => {
    if (cat === 'conditioning') {
      return {
        category: cat,
        label: RADAR_CATEGORY_LABELS[cat],
        percentile: conditioningPct,
        tier: conditioningPct !== null ? getTierForPercentile(conditioningPct) : null,
        drivingExercise: null,
        drivingE1RM: null,
      };
    }

    if (cat === 'core') {
      // No standardized core strength data — show null
      return {
        category: cat,
        label: RADAR_CATEGORY_LABELS[cat],
        percentile: null,
        tier: null,
        drivingExercise: null,
        drivingE1RM: null,
      };
    }

    const best = categoryBest.get(cat);
    return {
      category: cat,
      label: RADAR_CATEGORY_LABELS[cat],
      percentile: best?.percentile ?? null,
      tier: best ? getTierForPercentile(best.percentile) : null,
      drivingExercise: best?.exerciseName ?? null,
      drivingE1RM: best?.e1rm ?? null,
    };
  });
}
