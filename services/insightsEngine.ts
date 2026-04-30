/**
 * insightsEngine.ts — Computation layer for the Insights drawer.
 *
 * Keeps all heavy logic out of the UI. The drawer imports these functions
 * and feeds them data from context.
 */

import type { WorkoutLog, PersonalRecord, ExerciseLog } from '@/context/WorkoutTrackingContext';
import { est1RM, findStandard } from '@/constants/strengthStandards';
import { normalizeMuscleGroup } from '@/utils/muscleGroups';

// ─── Types ──────────────────────────────────────────────────

export interface InsightTip {
  id: string;
  icon: string;          // lucide icon name
  title: string;
  body: string;
  priority: number;      // 1 = highest
  accentColor?: string;
}

export interface WeeklyVolume {
  weekLabel: string;     // "Mar 3" etc.
  totalVolume: number;
  weekStart: string;     // YYYY-MM-DD (Monday)
}

export interface DayBar {
  dayLabel: string;      // "Mon", "Tue", ...
  date: string;          // YYYY-MM-DD
  duration: number;      // minutes
  isToday: boolean;
}

export interface ConsistencyCell {
  date: string;
  workoutCount: number;
  dayOfWeek: number;     // 0=Mon ... 6=Sun
  weekIndex: number;     // 0=oldest
}

// Style-specific insight data
export interface BBInsight {
  type: 'bodybuilding';
  muscleVolume: { muscle: string; sets: number; recommended: [number, number] }[];
  underworked: string[];
}

export interface StrengthInsight {
  type: 'strength';
  topLifts: { name: string; e1rm: number; previousE1rm: number | null; trend: 'up' | 'down' | 'flat' }[];
}

export interface ConditioningInsight {
  type: 'conditioning';
  sessionsThisWeek: number;
  avgRPE: number | null;
  avgDuration: number;
}

export interface RecoveryInsight {
  type: 'recovery';
  sessionsThisWeek: number;
  areasTargeted: string[];
  coveragePercent: number;
}

export type StyleInsightData = BBInsight | StrengthInsight | ConditioningInsight | RecoveryInsight;

// ─── Helpers ────────────────────────────────────────────────

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday = 1
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekStartDate(): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

// ─── AI Coach: Pattern Detection ────────────────────────────

interface MuscleReadiness {
  name: string;
  status: string;
  value: number;
  lastWorked: string;
}

export function detectInsightPatterns(
  history: WorkoutLog[],
  prHistory: PersonalRecord[],
  muscleReadiness: MuscleReadiness[],
  userProfile: { sex: string; weight: number; workoutStyle: string },
): InsightTip[] {
  const tips: InsightTip[] = [];
  const today = new Date();
  const fourWeeksAgo = daysAgo(28);
  const recentHistory = history.filter(l => new Date(l.date + 'T00:00:00') >= fourWeeksAgo);
  const oneWeekAgo = daysAgo(7);
  const thisWeek = history.filter(l => new Date(l.date + 'T00:00:00') >= oneWeekAgo);

  // 1. Time-of-day pattern
  const withTime = recentHistory.filter(l => l.startTime);
  if (withTime.length >= 3) {
    const hours = withTime.map(l => new Date(l.startTime!).getHours());
    const morningCount = hours.filter(h => h < 9).length;
    const eveningCount = hours.filter(h => h >= 17).length;

    if (morningCount / withTime.length > 0.6) {
      tips.push({
        id: 'morning_trainer',
        icon: 'sunrise',
        title: 'Early Bird Advantage',
        body: 'You tend to train in the morning. A small protein + carb snack 30 minutes before can boost performance by up to 12%.',
        priority: 7,
      });
    } else if (eveningCount / withTime.length > 0.6) {
      tips.push({
        id: 'evening_trainer',
        icon: 'moon',
        title: 'Evening Warrior',
        body: 'You usually train after 5 PM. Try to finish 2+ hours before bed and avoid screens right after — your sleep quality will thank you.',
        priority: 7,
      });
    }
  }

  // 2. Leg day avoidance
  if (recentHistory.length >= 4) {
    const legSessions = recentHistory.filter(l => {
      const split = (l.split || '').toLowerCase();
      const muscles = (l.muscleGroups || []).map(m => m.toLowerCase());
      return split.includes('leg') || split.includes('lower') ||
        muscles.some(m => m.includes('quad') || m.includes('ham') || m.includes('glute'));
    }).length;
    const legPct = Math.round((legSessions / recentHistory.length) * 100);

    if (legPct < 25 && recentHistory.length >= 6) {
      tips.push({
        id: 'skipping_legs',
        icon: 'footprints',
        title: 'Don\'t Skip Leg Day',
        body: `Only ${legPct}% of your recent sessions target lower body. Adding a dedicated leg day improves total-body strength and hormonal response.`,
        priority: 4,
      });
    }
  }

  // 3. Push/Pull imbalance
  if (recentHistory.length >= 4) {
    let pushVol = 0;
    let pullVol = 0;
    for (const log of recentHistory) {
      for (const ex of log.exercises) {
        const mg = (ex.muscleGroup || '').toLowerCase();
        const sets = ex.sets.length;
        if (mg.includes('chest') || mg.includes('delt') || mg.includes('shoulder') || mg.includes('tricep')) {
          pushVol += sets;
        } else if (mg.includes('back') || mg.includes('lat') || mg.includes('bicep') || mg.includes('rear') || mg.includes('rhomb') || mg.includes('trap')) {
          pullVol += sets;
        }
      }
    }

    if (pushVol > 0 && pullVol > 0 && pushVol > pullVol * 1.5) {
      tips.push({
        id: 'push_pull_imbalance',
        icon: 'scale',
        title: 'Push/Pull Imbalance',
        body: `Your push volume (${pushVol} sets) is ${Math.round(pushVol / pullVol * 10) / 10}x your pull volume (${pullVol} sets). Adding more rows and pull-ups can protect your shoulders.`,
        priority: 3,
      });
    }
  }

  // 4. Plateau detection
  if (recentHistory.length >= 3) {
    const threeWeeksAgo = daysAgo(21);
    const recentPRs = prHistory.filter(pr =>
      pr.type === 'weight' && new Date(pr.date + 'T00:00:00') >= threeWeeksAgo
    );
    const recentPRExercises = new Set(recentPRs.map(pr => pr.exerciseName.toLowerCase()));

    // Find exercises trained 3+ times in 3 weeks without a PR
    const exerciseCounts = new Map<string, number>();
    for (const log of recentHistory.filter(l => new Date(l.date + 'T00:00:00') >= threeWeeksAgo)) {
      for (const ex of log.exercises) {
        const name = ex.exerciseName.toLowerCase();
        if (findStandard(ex.exerciseName)) { // only track compound lifts
          exerciseCounts.set(name, (exerciseCounts.get(name) || 0) + 1);
        }
      }
    }

    for (const [name, count] of exerciseCounts) {
      if (count >= 3 && !recentPRExercises.has(name)) {
        const displayName = name.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
        tips.push({
          id: `plateau_${name}`,
          icon: 'trending-flat',
          title: 'Plateau Alert',
          body: `Your ${displayName} hasn't improved in 3+ weeks despite regular training. Try adding a pause rep variant, drop sets, or adjusting rep ranges.`,
          priority: 4,
        });
        break; // only show one plateau tip
      }
    }
  }

  // 5. Consistency drop
  if (recentHistory.length >= 4) {
    const weekAvg = recentHistory.length / 4;
    const thisWeekCount = thisWeek.length;
    const dayOfWeek = today.getDay(); // 0=Sun, 6=Sat
    const weekProgress = dayOfWeek === 0 ? 1 : dayOfWeek / 7;

    // Only flag if we're past mid-week and significantly behind
    if (weekProgress >= 0.5 && thisWeekCount < weekAvg * 0.6 * weekProgress) {
      tips.push({
        id: 'consistency_drop',
        icon: 'calendar-minus',
        title: 'Stay Consistent',
        body: `You've averaged ${Math.round(weekAvg)} sessions/week lately, but only ${thisWeekCount} this week so far. Even a quick 20-minute session keeps the momentum going.`,
        priority: 5,
      });
    }
  }

  // 6. Overreaching / deload suggestion
  if (history.length >= 8) {
    const weeks: number[] = [];
    for (let i = 0; i < 5; i++) {
      const weekStart = daysAgo((i + 1) * 7);
      const weekEnd = daysAgo(i * 7);
      const weekLogs = history.filter(l => {
        const d = new Date(l.date + 'T00:00:00');
        return d >= weekStart && d < weekEnd;
      });
      weeks.push(weekLogs.reduce((sum, l) => sum + l.totalVolume, 0));
    }

    // Check if volume has been increasing for 4+ consecutive weeks
    let increasing = 0;
    for (let i = 0; i < weeks.length - 1; i++) {
      if (weeks[i] > weeks[i + 1] * 1.05) increasing++;
      else break;
    }

    if (increasing >= 3) {
      tips.push({
        id: 'deload_needed',
        icon: 'battery-low',
        title: 'Time for a Deload?',
        body: `You've been progressively increasing volume for ${increasing + 1} weeks. A deload week at 50% volume helps your body recover and supercompensate.`,
        priority: 2,
      });
    }
  }

  // 7. PR streak
  const weekPRs = prHistory.filter(pr => new Date(pr.date + 'T00:00:00') >= oneWeekAgo);
  if (weekPRs.length >= 3) {
    tips.push({
      id: 'pr_streak',
      icon: 'trophy',
      title: 'PR Machine!',
      body: `${weekPRs.length} personal records this week! You're on fire. Keep riding this wave.`,
      priority: 8,
      accentColor: '#eab308',
    });
  }

  // 8. Recovery concern
  const recoveringCount = muscleReadiness.filter(m => m.status === 'recovering').length;
  if (recoveringCount >= 3) {
    tips.push({
      id: 'recovery_concern',
      icon: 'heart-pulse',
      title: 'Recovery Day?',
      body: `${recoveringCount} muscle groups are still recovering. Today might be a good day for mobility work or light cardio.`,
      priority: 2,
    });
  }

  // Sort by priority (lower number = higher priority)
  tips.sort((a, b) => a.priority - b.priority);
  return tips;
}

// ─── Training Load Trend ────────────────────────────────────

export type LoadStatus = 'on_track' | 'building' | 'deload' | 'overreaching';

export interface TrainingLoadData {
  weeks: WeeklyVolume[];
  rollingAverage: number[];
  currentStatus: LoadStatus;
  statusLabel: string;
}

export function getTrainingLoadTrend(history: WorkoutLog[], weekCount: number = 8): TrainingLoadData {
  const now = new Date();
  const weeks: WeeklyVolume[] = [];

  for (let i = weekCount - 1; i >= 0; i--) {
    const weekStart = new Date(getMondayOfWeek(now));
    weekStart.setDate(weekStart.getDate() - i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weekLogs = history.filter(l => {
      const d = new Date(l.date + 'T00:00:00');
      return d >= weekStart && d < weekEnd;
    });

    const totalVolume = weekLogs.reduce((sum, l) => sum + l.totalVolume, 0);
    const label = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    weeks.push({
      weekLabel: label,
      totalVolume,
      weekStart: dateStr(weekStart),
    });
  }

  // 4-week rolling average
  const rollingAverage: number[] = [];
  for (let i = 0; i < weeks.length; i++) {
    if (i < 3) {
      rollingAverage.push(0);
    } else {
      const avg = (weeks[i - 3].totalVolume + weeks[i - 2].totalVolume + weeks[i - 1].totalVolume + weeks[i].totalVolume) / 4;
      rollingAverage.push(Math.round(avg));
    }
  }

  // Determine status based on current week vs rolling average
  const currentVol = weeks[weeks.length - 1]?.totalVolume ?? 0;
  const lastAvg = rollingAverage[rollingAverage.length - 1];
  let currentStatus: LoadStatus = 'on_track';
  let statusLabel = 'On Track';

  if (lastAvg > 0) {
    const ratio = currentVol / lastAvg;
    if (ratio < 0.7) { currentStatus = 'deload'; statusLabel = 'Deload Week'; }
    else if (ratio > 1.3) { currentStatus = 'overreaching'; statusLabel = 'Overreaching'; }
    else if (ratio > 1.1) { currentStatus = 'building'; statusLabel = 'Building'; }
  }

  return { weeks, rollingAverage, currentStatus, statusLabel };
}

// ─── This Week Bar Chart ────────────────────────────────────

export function getWeekDayBars(history: WorkoutLog[]): DayBar[] {
  const weekStart = getWeekStartDate();
  const today = getTodayStr();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const bars: DayBar[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const ds = dateStr(d);
    const dayLogs = history.filter(l => l.date === ds);
    const totalDuration = dayLogs.reduce((sum, l) => sum + l.duration, 0);

    bars.push({
      dayLabel: dayNames[d.getDay()],
      date: ds,
      duration: totalDuration,
      isToday: ds === today,
    });
  }

  return bars;
}

// ─── Consistency Heatmap ────────────────────────────────────

export function getConsistencyData(history: WorkoutLog[], weekCount: number = 12): {
  cells: ConsistencyCell[];
  totalDays: number;
  activeDays: number;
} {
  const workoutDates = new Map<string, number>();
  for (const log of history) {
    workoutDates.set(log.date, (workoutDates.get(log.date) || 0) + 1);
  }

  const now = new Date();
  const startMonday = getMondayOfWeek(now);
  startMonday.setDate(startMonday.getDate() - (weekCount - 1) * 7);

  const cells: ConsistencyCell[] = [];
  let activeDays = 0;
  const totalDays = weekCount * 7;

  for (let w = 0; w < weekCount; w++) {
    for (let d = 0; d < 7; d++) {
      const cellDate = new Date(startMonday);
      cellDate.setDate(cellDate.getDate() + w * 7 + d);
      const ds = dateStr(cellDate);
      const count = workoutDates.get(ds) || 0;
      if (count > 0) activeDays++;

      cells.push({
        date: ds,
        workoutCount: count,
        dayOfWeek: d,
        weekIndex: w,
      });
    }
  }

  return { cells, totalDays, activeDays };
}

// ─── Style-Specific Insights ────────────────────────────────

const RECOMMENDED_WEEKLY_SETS: Record<string, [number, number]> = {
  Chest: [10, 20],
  Back: [14, 22],
  Shoulders: [10, 18],
  Biceps: [8, 14],
  Triceps: [8, 14],
  Quads: [10, 18],
  Hamstrings: [8, 16],
  Glutes: [8, 16],
  Core: [6, 12],
  Calves: [6, 12],
};

export function getStyleInsights(
  style: string,
  history: WorkoutLog[],
  prHistory: PersonalRecord[],
  _userProfile: { sex: string; weight: number },
): StyleInsightData {
  const oneWeekAgo = daysAgo(7);
  const fourWeeksAgo = daysAgo(28);
  const thisWeek = history.filter(l => new Date(l.date + 'T00:00:00') >= oneWeekAgo);
  const recentHistory = history.filter(l => new Date(l.date + 'T00:00:00') >= fourWeeksAgo);

  switch (style) {
    case 'Bodybuilding': {
      // Volume per muscle group this week
      const muscleSetCounts: Record<string, number> = {};
      for (const log of thisWeek) {
        for (const ex of log.exercises) {
          const mg = normalizeMuscleGroup(ex.muscleGroup);
          muscleSetCounts[mg] = (muscleSetCounts[mg] || 0) + ex.sets.filter(s => s.done).length;
        }
      }

      const muscleVolume = Object.entries(RECOMMENDED_WEEKLY_SETS).map(([muscle, recommended]) => ({
        muscle,
        sets: muscleSetCounts[muscle] || 0,
        recommended,
      }));

      const underworked = muscleVolume
        .filter(m => m.sets < m.recommended[0] && m.sets > 0)
        .map(m => m.muscle);

      return { type: 'bodybuilding', muscleVolume, underworked };
    }

    case 'Strength': {
      const keyLifts = ['Barbell Bench Press', 'Barbell Back Squat', 'Conventional Deadlift'];
      const topLifts: StrengthInsight['topLifts'] = [];

      for (const liftName of keyLifts) {
        // Current best e1RM from recent logs
        let bestE1RM = 0;
        for (const log of recentHistory) {
          for (const ex of log.exercises) {
            if (ex.exerciseName.toLowerCase() === liftName.toLowerCase()) {
              for (const set of ex.sets) {
                if (set.weight > 0 && set.reps > 0) {
                  const e = est1RM(set.weight, set.reps);
                  if (e > bestE1RM) bestE1RM = e;
                }
              }
            }
          }
        }

        // Previous 4 weeks best
        const olderHistory = history.filter(l => {
          const d = new Date(l.date + 'T00:00:00');
          return d >= daysAgo(56) && d < fourWeeksAgo;
        });
        let prevE1RM: number | null = null;
        for (const log of olderHistory) {
          for (const ex of log.exercises) {
            if (ex.exerciseName.toLowerCase() === liftName.toLowerCase()) {
              for (const set of ex.sets) {
                if (set.weight > 0 && set.reps > 0) {
                  const e = est1RM(set.weight, set.reps);
                  if (prevE1RM === null || e > prevE1RM) prevE1RM = e;
                }
              }
            }
          }
        }

        if (bestE1RM > 0) {
          let trend: 'up' | 'down' | 'flat' = 'flat';
          if (prevE1RM !== null) {
            if (bestE1RM > prevE1RM * 1.02) trend = 'up';
            else if (bestE1RM < prevE1RM * 0.98) trend = 'down';
          }
          topLifts.push({ name: liftName, e1rm: bestE1RM, previousE1rm: prevE1RM, trend });
        }
      }

      return { type: 'strength', topLifts };
    }

    case 'CrossFit':
    case 'HIIT': {
      const styleLogs = thisWeek.filter(l => l.workoutStyle === style);
      const avgRPE = styleLogs.length > 0
        ? Math.round(styleLogs.reduce((sum, l) => sum + l.rpe, 0) / styleLogs.length * 10) / 10
        : null;
      const avgDuration = styleLogs.length > 0
        ? Math.round(styleLogs.reduce((sum, l) => sum + l.duration, 0) / styleLogs.length)
        : 0;

      return {
        type: 'conditioning',
        sessionsThisWeek: styleLogs.length,
        avgRPE,
        avgDuration,
      };
    }

    case 'Mobility':
    case 'Pilates': {
      const styleLogs = thisWeek.filter(l => l.workoutStyle === style);
      const areasSet = new Set<string>();
      for (const log of styleLogs) {
        for (const ex of log.exercises) {
          areasSet.add(normalizeMuscleGroup(ex.muscleGroup));
        }
      }
      const allMuscles = Object.keys(RECOMMENDED_WEEKLY_SETS);
      const coveragePercent = allMuscles.length > 0
        ? Math.round((areasSet.size / allMuscles.length) * 100)
        : 0;

      return {
        type: 'recovery',
        sessionsThisWeek: styleLogs.length,
        areasTargeted: Array.from(areasSet),
        coveragePercent,
      };
    }

    default: {
      // Fallback: conditioning-style insight
      const styleLogs = thisWeek.filter(l => l.workoutStyle === style);
      return {
        type: 'conditioning',
        sessionsThisWeek: styleLogs.length,
        avgRPE: null,
        avgDuration: styleLogs.length > 0
          ? Math.round(styleLogs.reduce((sum, l) => sum + l.duration, 0) / styleLogs.length)
          : 0,
      };
    }
  }
}

// ─── PR Grouping ────────────────────────────────────────────

export type PRCategory = 'Upper Push' | 'Upper Pull' | 'Lower' | 'Core' | 'Other';

export interface GroupedPR {
  exerciseName: string;
  weight: number;
  reps: number;
  e1rm: number;
  date: string;
  category: PRCategory;
  trend: 'up' | 'down' | 'flat';
}

export function getGroupedPRs(prHistory: PersonalRecord[], workoutHistory: WorkoutLog[]): GroupedPR[] {
  // Best weight PR per exercise
  const bestByExercise = new Map<string, { weight: number; reps: number; date: string }>();

  for (const pr of prHistory) {
    if (pr.type === 'weight') {
      const key = pr.exerciseName.toLowerCase();
      const existing = bestByExercise.get(key);
      if (!existing || pr.value > existing.weight) {
        bestByExercise.set(key, { weight: pr.value, reps: existing?.reps ?? 1, date: pr.date });
      }
    }
    if (pr.type === 'reps') {
      const key = pr.exerciseName.toLowerCase();
      const existing = bestByExercise.get(key);
      if (existing && pr.value > existing.reps) {
        bestByExercise.set(key, { ...existing, reps: pr.value });
      }
    }
  }

  // Categorize by muscle group from workout logs
  const exerciseMuscle = new Map<string, string>();
  for (const log of workoutHistory) {
    for (const ex of log.exercises) {
      if (!exerciseMuscle.has(ex.exerciseName.toLowerCase())) {
        exerciseMuscle.set(ex.exerciseName.toLowerCase(), ex.muscleGroup);
      }
    }
  }

  function categorize(exerciseName: string): PRCategory {
    const std = findStandard(exerciseName);
    if (std) {
      if (std.radarCategory === 'upper_push') return 'Upper Push';
      if (std.radarCategory === 'upper_pull') return 'Upper Pull';
      if (std.radarCategory === 'lower_body') return 'Lower';
      if (std.radarCategory === 'core') return 'Core';
    }
    const mg = exerciseMuscle.get(exerciseName.toLowerCase()) || '';
    const norm = normalizeMuscleGroup(mg);
    if (['Chest', 'Shoulders', 'Triceps'].includes(norm)) return 'Upper Push';
    if (['Back', 'Biceps'].includes(norm)) return 'Upper Pull';
    if (['Quads', 'Hamstrings', 'Glutes', 'Calves'].includes(norm)) return 'Lower';
    if (norm === 'Core') return 'Core';
    return 'Other';
  }

  // Find 4-week-ago PRs for trend
  const fourWeeksAgo = daysAgo(28);
  const oldPRs = new Map<string, number>();
  for (const pr of prHistory) {
    if (pr.type === 'weight' && new Date(pr.date + 'T00:00:00') < fourWeeksAgo) {
      const key = pr.exerciseName.toLowerCase();
      const existing = oldPRs.get(key);
      if (!existing || pr.value > existing) {
        oldPRs.set(key, pr.value);
      }
    }
  }

  const results: GroupedPR[] = [];
  for (const [key, { weight, reps, date }] of bestByExercise) {
    if (weight <= 0) continue;
    const displayName = key.split(' ').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ');
    const e1rm = est1RM(weight, reps);
    const oldWeight = oldPRs.get(key);
    let trend: 'up' | 'down' | 'flat' = 'flat';
    if (oldWeight !== undefined) {
      if (weight > oldWeight * 1.02) trend = 'up';
      else if (weight < oldWeight * 0.98) trend = 'down';
    }

    results.push({
      exerciseName: displayName,
      weight,
      reps,
      e1rm,
      date,
      category: categorize(displayName),
      trend,
    });
  }

  results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return results;
}

// ═══════════════════════════════════════════════════════════
// STATS FOR NERDS
// ═══════════════════════════════════════════════════════════

// ─── Lifetime Totals ────────────────────────────────────────

export interface LifetimeTotals {
  totalVolumeLbs: number;
  funEquivalent: string;
  totalHours: number;
  totalSets: number;
  totalWorkouts: number;
  trainingAgeDays: number;
  firstWorkoutDate: string | null;
}

const FUN_EQUIVALENTS: { threshold: number; label: (n: number) => string }[] = [
  { threshold: 5_000_000, label: (v) => `${(v / 5_000_000).toFixed(1)} Space Shuttles` },
  { threshold: 2_000_000, label: (v) => `${Math.round(v / 80_000)} grand pianos` },
  { threshold: 500_000,   label: (v) => `${Math.round(v / 44_000)} school buses` },
  { threshold: 100_000,   label: (v) => `${Math.round(v / 4_000)} grizzly bears` },
  { threshold: 10_000,    label: (v) => `${Math.round(v / 2_000)} grand pianos` },
  { threshold: 0,         label: (v) => `${v.toLocaleString()} lb — keep going!` },
];

export function getLifetimeTotals(history: WorkoutLog[]): LifetimeTotals {
  let totalVolumeLbs = 0;
  let totalMinutes = 0;
  let totalSets = 0;

  for (const log of history) {
    totalVolumeLbs += log.totalVolume;
    totalMinutes += log.duration;
    totalSets += log.totalSets;
  }

  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const firstDate = sorted.length > 0 ? sorted[0].date : null;
  const trainingAgeDays = firstDate
    ? Math.floor((Date.now() - new Date(firstDate + 'T00:00:00').getTime()) / 86400000)
    : 0;

  const funEquivalent = FUN_EQUIVALENTS.find(f => totalVolumeLbs >= f.threshold)?.label(totalVolumeLbs)
    ?? `${totalVolumeLbs.toLocaleString()} lb`;

  return {
    totalVolumeLbs,
    funEquivalent,
    totalHours: Math.round(totalMinutes / 60 * 10) / 10,
    totalSets,
    totalWorkouts: history.length,
    trainingAgeDays,
    firstWorkoutDate: firstDate,
  };
}

// ─── Strength Ratios ────────────────────────────────────────

export interface StrengthRatios {
  lifts: { name: string; e1rm: number; bwMultiplier: number }[];
  dotsScore: number | null;
}

/**
 * DOTS coefficient lookup — simplified polynomial from the official DOTS formula.
 * DOTS = total * 500 / (a*bw^4 + b*bw^3 + c*bw^2 + d*bw + e)
 */
function dotsCoefficient(sex: string, bodyweightKg: number): number {
  const bw = bodyweightKg;
  if (sex === 'female') {
    // Female DOTS coefficients
    const a = -0.0000010706;
    const b = 0.0005158568;
    const c = -0.1126655495;
    const d = 13.6175032;
    const e = -57.96288;
    return 500 / (a * bw ** 4 + b * bw ** 3 + c * bw ** 2 + d * bw + e);
  }
  // Male DOTS coefficients
  const a = -0.000001093;
  const b = 0.0007391293;
  const c = -0.1918759221;
  const d = 24.0900756;
  const e = -307.75076;
  return 500 / (a * bw ** 4 + b * bw ** 3 + c * bw ** 2 + d * bw + e);
}

export function getStrengthRatios(
  history: WorkoutLog[],
  prHistory: PersonalRecord[],
  sex: string,
  bodyweightLbs: number,
): StrengthRatios {
  const keyLifts = ['Barbell Bench Press', 'Barbell Back Squat', 'Conventional Deadlift', 'Standing Overhead Press'];
  const lifts: StrengthRatios['lifts'] = [];
  let bigThreeTotal = 0;
  let bigThreeCount = 0;

  for (const liftName of keyLifts) {
    let bestE1RM = 0;
    // Check PRs
    for (const pr of prHistory) {
      if (pr.type === 'weight' && pr.exerciseName.toLowerCase() === liftName.toLowerCase()) {
        if (pr.value > bestE1RM) bestE1RM = pr.value;
      }
    }
    // Check workout logs for better sets
    for (const log of history) {
      for (const ex of log.exercises) {
        if (ex.exerciseName.toLowerCase() === liftName.toLowerCase()) {
          for (const set of ex.sets) {
            if (set.weight > 0 && set.reps > 0) {
              const e = est1RM(set.weight, set.reps);
              if (e > bestE1RM) bestE1RM = e;
            }
          }
        }
      }
    }

    if (bestE1RM > 0) {
      lifts.push({
        name: liftName.replace('Barbell ', '').replace('Standing ', '').replace('Conventional ', ''),
        e1rm: bestE1RM,
        bwMultiplier: Math.round((bestE1RM / bodyweightLbs) * 100) / 100,
      });
      // Big 3: Bench, Squat, Deadlift
      if (liftName !== 'Standing Overhead Press') {
        bigThreeTotal += bestE1RM;
        bigThreeCount++;
      }
    }
  }

  let dotsScore: number | null = null;
  if (bigThreeCount === 3 && bodyweightLbs > 0) {
    const bwKg = bodyweightLbs * 0.453592;
    const coeff = dotsCoefficient(sex, bwKg);
    dotsScore = Math.round(bigThreeTotal * 0.453592 * coeff);
  }

  return { lifts, dotsScore };
}

// ─── Progressive Overload Rate ──────────────────────────────

export interface OverloadData {
  weeklyVolumeChange: number | null; // % change vs 4 weeks ago
  isProgressing: boolean;
}

export function getProgressiveOverload(history: WorkoutLog[]): OverloadData {
  const now = new Date();
  const thisWeekStart = getMondayOfWeek(now);
  const lastMonthStart = new Date(thisWeekStart);
  lastMonthStart.setDate(lastMonthStart.getDate() - 28);
  const lastMonthEnd = new Date(lastMonthStart);
  lastMonthEnd.setDate(lastMonthEnd.getDate() + 7);

  const thisWeekLogs = history.filter(l => {
    const d = new Date(l.date + 'T00:00:00');
    return d >= thisWeekStart;
  });
  const thenWeekLogs = history.filter(l => {
    const d = new Date(l.date + 'T00:00:00');
    return d >= lastMonthStart && d < lastMonthEnd;
  });

  const thisVol = thisWeekLogs.reduce((s, l) => s + l.totalVolume, 0);
  const thenVol = thenWeekLogs.reduce((s, l) => s + l.totalVolume, 0);

  if (thenVol === 0) return { weeklyVolumeChange: null, isProgressing: false };

  const change = Math.round(((thisVol - thenVol) / thenVol) * 100);
  return { weeklyVolumeChange: change, isProgressing: change > 0 };
}

// ─── Pattern Analysis ───────────────────────────────────────

export interface PatternAnalysis {
  bestDay: { day: string; avgScore: number } | null;
  preferredTime: { label: string; pct: number }[] | null;   // Morning/Afternoon/Evening
  exerciseVariety: number;                                    // unique exercises in 4 weeks
  mostTrainedExercise: { name: string; count: number } | null;
  mostTrainedMuscle: { name: string; sets: number } | null;
  leastTrainedMuscle: { name: string; sets: number } | null;
  mostImprovedExercise: { name: string; pctGain: number } | null;
  difficultyDistribution: { easy: number; moderate: number; hard: number; brutal: number };
  avgRPETrend: { current: number; previous: number } | null; // last 2 weeks vs prior 2
  topWentWellTags: { tag: string; count: number }[];
}

export function getPatternAnalysis(
  history: WorkoutLog[],
  prHistory: PersonalRecord[],
): PatternAnalysis {
  const fourWeeksAgo = daysAgo(28);
  const recent = history.filter(l => new Date(l.date + 'T00:00:00') >= fourWeeksAgo);

  // ─ Best training day ─
  const dayScores: Record<string, { total: number; count: number }> = {};
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  for (const log of recent) {
    const d = new Date(log.date + 'T00:00:00');
    const day = dayNames[d.getDay()];
    if (!dayScores[day]) dayScores[day] = { total: 0, count: 0 };
    dayScores[day].total += log.trainingScore;
    dayScores[day].count++;
  }
  let bestDay: PatternAnalysis['bestDay'] = null;
  let bestAvg = 0;
  for (const [day, { total, count }] of Object.entries(dayScores)) {
    const avg = total / count;
    if (avg > bestAvg) { bestAvg = avg; bestDay = { day, avgScore: Math.round(avg) }; }
  }

  // ─ Preferred workout time ─
  let preferredTime: PatternAnalysis['preferredTime'] = null;
  const withTime = recent.filter(l => l.startTime);
  if (withTime.length >= 3) {
    let morning = 0, afternoon = 0, evening = 0;
    for (const l of withTime) {
      const h = new Date(l.startTime!).getHours();
      if (h < 12) morning++;
      else if (h < 17) afternoon++;
      else evening++;
    }
    const total = withTime.length;
    preferredTime = [
      { label: 'Morning', pct: Math.round((morning / total) * 100) },
      { label: 'Afternoon', pct: Math.round((afternoon / total) * 100) },
      { label: 'Evening', pct: Math.round((evening / total) * 100) },
    ];
  }

  // ─ Exercise variety ─
  const exerciseSet = new Set<string>();
  for (const log of recent) {
    for (const ex of log.exercises) exerciseSet.add(ex.exerciseName.toLowerCase());
  }

  // ─ Most trained exercise ─
  const exerciseCounts = new Map<string, number>();
  for (const log of recent) {
    for (const ex of log.exercises) {
      const name = ex.exerciseName;
      exerciseCounts.set(name, (exerciseCounts.get(name) || 0) + 1);
    }
  }
  let mostTrainedExercise: PatternAnalysis['mostTrainedExercise'] = null;
  let maxExCount = 0;
  for (const [name, count] of exerciseCounts) {
    if (count > maxExCount) { maxExCount = count; mostTrainedExercise = { name, count }; }
  }

  // ─ Most / least trained muscle ─
  const muscleSets = new Map<string, number>();
  for (const log of recent) {
    for (const ex of log.exercises) {
      const mg = normalizeMuscleGroup(ex.muscleGroup);
      muscleSets.set(mg, (muscleSets.get(mg) || 0) + ex.sets.filter(s => s.done).length);
    }
  }
  let mostTrainedMuscle: PatternAnalysis['mostTrainedMuscle'] = null;
  let leastTrainedMuscle: PatternAnalysis['leastTrainedMuscle'] = null;
  let maxSets = 0, minSets = Infinity;
  for (const [name, sets] of muscleSets) {
    if (sets > maxSets) { maxSets = sets; mostTrainedMuscle = { name, sets }; }
    if (sets < minSets) { minSets = sets; leastTrainedMuscle = { name, sets }; }
  }

  // ─ Most improved exercise (biggest 1RM % gain) ─
  // Compare best 1RM from last 2 weeks vs prior 2 weeks
  const twoWeeksAgo = daysAgo(14);
  const recentE1RMs = new Map<string, number>();
  const olderE1RMs = new Map<string, number>();

  for (const log of history) {
    const d = new Date(log.date + 'T00:00:00');
    for (const ex of log.exercises) {
      for (const set of ex.sets) {
        if (set.weight > 0 && set.reps > 0) {
          const e = est1RM(set.weight, set.reps);
          const key = ex.exerciseName;
          if (d >= twoWeeksAgo) {
            if (!recentE1RMs.has(key) || e > recentE1RMs.get(key)!) recentE1RMs.set(key, e);
          } else if (d >= fourWeeksAgo) {
            if (!olderE1RMs.has(key) || e > olderE1RMs.get(key)!) olderE1RMs.set(key, e);
          }
        }
      }
    }
  }

  let mostImprovedExercise: PatternAnalysis['mostImprovedExercise'] = null;
  let bestGain = 0;
  for (const [name, recentVal] of recentE1RMs) {
    const olderVal = olderE1RMs.get(name);
    if (olderVal && olderVal > 0) {
      const gain = ((recentVal - olderVal) / olderVal) * 100;
      if (gain > bestGain) { bestGain = gain; mostImprovedExercise = { name, pctGain: Math.round(gain) }; }
    }
  }

  // ─ Difficulty distribution ─
  const difficultyDistribution = { easy: 0, moderate: 0, hard: 0, brutal: 0 };
  for (const log of recent) {
    const d = log.difficulty as keyof typeof difficultyDistribution;
    if (d in difficultyDistribution) difficultyDistribution[d]++;
  }

  // ─ Average RPE trend ─
  let avgRPETrend: PatternAnalysis['avgRPETrend'] = null;
  const last2Weeks = history.filter(l => new Date(l.date + 'T00:00:00') >= twoWeeksAgo);
  const prior2Weeks = history.filter(l => {
    const d = new Date(l.date + 'T00:00:00');
    return d >= fourWeeksAgo && d < twoWeeksAgo;
  });
  if (last2Weeks.length > 0 && prior2Weeks.length > 0) {
    const currentRPE = Math.round(last2Weeks.reduce((s, l) => s + l.rpe, 0) / last2Weeks.length * 10) / 10;
    const prevRPE = Math.round(prior2Weeks.reduce((s, l) => s + l.rpe, 0) / prior2Weeks.length * 10) / 10;
    avgRPETrend = { current: currentRPE, previous: prevRPE };
  }

  // ─ Top "what went well" tags ─
  const tagCounts = new Map<string, number>();
  for (const log of recent) {
    for (const tag of log.whatWentWell || []) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }
  const topWentWellTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));

  return {
    bestDay,
    preferredTime,
    exerciseVariety: exerciseSet.size,
    mostTrainedExercise,
    mostTrainedMuscle,
    leastTrainedMuscle,
    mostImprovedExercise,
    difficultyDistribution,
    avgRPETrend,
    topWentWellTags,
  };
}

// ─── Projections ────────────────────────────────────────────

export interface Projections {
  monthPace: { current: number; projected: number; lastMonth: number } | null;
  strengthProjection: { exercise: string; target: string; weeksAway: number | null } | null;
}

export function getProjections(
  history: WorkoutLog[],
  prHistory: PersonalRecord[],
  bodyweightLbs: number,
): Projections {
  const now = new Date();

  // ─ Month pace ─
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const thisMonthCount = history.filter(l => new Date(l.date + 'T00:00:00') >= thisMonthStart).length;
  const lastMonthCount = history.filter(l => {
    const d = new Date(l.date + 'T00:00:00');
    return d >= lastMonthStart && d <= lastMonthEnd;
  }).length;

  const monthPace = dayOfMonth >= 3 ? {
    current: thisMonthCount,
    projected: Math.round((thisMonthCount / dayOfMonth) * daysInMonth),
    lastMonth: lastMonthCount,
  } : null;

  // ─ Strength projection: weeks to 2x BW squat ─
  let strengthProjection: Projections['strengthProjection'] = null;
  const target2xBW = bodyweightLbs * 2;

  // Find squat e1RM progression over last 8 weeks
  const squatE1RMs: { date: Date; e1rm: number }[] = [];
  for (const log of history) {
    for (const ex of log.exercises) {
      if (ex.exerciseName.toLowerCase().includes('squat') && ex.exerciseName.toLowerCase().includes('barbell')) {
        for (const set of ex.sets) {
          if (set.weight > 0 && set.reps > 0) {
            squatE1RMs.push({ date: new Date(log.date + 'T00:00:00'), e1rm: est1RM(set.weight, set.reps) });
          }
        }
      }
    }
  }

  if (squatE1RMs.length >= 2) {
    squatE1RMs.sort((a, b) => a.date.getTime() - b.date.getTime());
    const latest = squatE1RMs[squatE1RMs.length - 1];
    const earliest = squatE1RMs[0];
    const weeksBetween = (latest.date.getTime() - earliest.date.getTime()) / (7 * 86400000);

    if (weeksBetween >= 2 && latest.e1rm < target2xBW) {
      const weeklyGain = (latest.e1rm - earliest.e1rm) / weeksBetween;
      if (weeklyGain > 0) {
        const weeksToTarget = Math.ceil((target2xBW - latest.e1rm) / weeklyGain);
        strengthProjection = {
          exercise: 'Back Squat',
          target: `2x BW (${target2xBW} lb)`,
          weeksAway: weeksToTarget,
        };
      }
    }
  }

  return { monthPace, strengthProjection };
}

// ─── Self Comparison ────────────────────────────────────────

export interface SelfComparison {
  thisWeekVsFirst: {
    thisWeekVolume: number;
    firstWeekVolume: number;
    thisWeekDuration: number;
    firstWeekDuration: number;
    volumeChange: number | null; // %
  } | null;
  thisMonthVsLast: {
    thisMonthWorkouts: number;
    lastMonthWorkouts: number;
    thisMonthVolume: number;
    lastMonthVolume: number;
    thisMonthPRs: number;
    lastMonthPRs: number;
  } | null;
}

export function getSelfComparison(
  history: WorkoutLog[],
  prHistory: PersonalRecord[],
): SelfComparison {
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const now = new Date();

  // ─ This week vs first week ─
  let thisWeekVsFirst: SelfComparison['thisWeekVsFirst'] = null;
  if (sorted.length >= 2) {
    const firstDate = new Date(sorted[0].date + 'T00:00:00');
    const firstWeekEnd = new Date(firstDate);
    firstWeekEnd.setDate(firstWeekEnd.getDate() + 7);

    const weekStart = getWeekStartDate();
    const firstWeekLogs = sorted.filter(l => {
      const d = new Date(l.date + 'T00:00:00');
      return d >= firstDate && d < firstWeekEnd;
    });
    const thisWeekLogs = history.filter(l => new Date(l.date + 'T00:00:00') >= weekStart);

    if (firstWeekLogs.length > 0) {
      const fwVol = firstWeekLogs.reduce((s, l) => s + l.totalVolume, 0);
      const twVol = thisWeekLogs.reduce((s, l) => s + l.totalVolume, 0);
      const fwDur = firstWeekLogs.reduce((s, l) => s + l.duration, 0);
      const twDur = thisWeekLogs.reduce((s, l) => s + l.duration, 0);

      thisWeekVsFirst = {
        thisWeekVolume: twVol,
        firstWeekVolume: fwVol,
        thisWeekDuration: twDur,
        firstWeekDuration: fwDur,
        volumeChange: fwVol > 0 ? Math.round(((twVol - fwVol) / fwVol) * 100) : null,
      };
    }
  }

  // ─ This month vs last month ─
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const thisMonthLogs = history.filter(l => new Date(l.date + 'T00:00:00') >= thisMonthStart);
  const lastMonthLogs = history.filter(l => {
    const d = new Date(l.date + 'T00:00:00');
    return d >= lastMonthStart && d <= lastMonthEnd;
  });

  const thisMonthPRs = prHistory.filter(p => new Date(p.date + 'T00:00:00') >= thisMonthStart).length;
  const lastMonthPRs = prHistory.filter(p => {
    const d = new Date(p.date + 'T00:00:00');
    return d >= lastMonthStart && d <= lastMonthEnd;
  }).length;

  const thisMonthVsLast: SelfComparison['thisMonthVsLast'] = {
    thisMonthWorkouts: thisMonthLogs.length,
    lastMonthWorkouts: lastMonthLogs.length,
    thisMonthVolume: thisMonthLogs.reduce((s, l) => s + l.totalVolume, 0),
    lastMonthVolume: lastMonthLogs.reduce((s, l) => s + l.totalVolume, 0),
    thisMonthPRs,
    lastMonthPRs,
  };

  return { thisWeekVsFirst, thisMonthVsLast };
}

// ═══════════════════════════════════════════════════════════
// STYLE-SPECIFIC TRACKER DATA
// ═══════════════════════════════════════════════════════════

// ─── Strength Tracker ───────────────────────────────────────

export interface StrengthTrackerData {
  type: 'strength';
  liftHistory: { name: string; dataPoints: { date: string; e1rm: number }[] }[];
  dotsScore: number | null;
  volumePerSession: { date: string; volume: number }[];
  repRangeDistribution: { range: string; sets: number; pct: number }[];
  splitFrequency: { split: string; count: number }[];
}

function getStrengthTrackerData(history: WorkoutLog[], prHistory: PersonalRecord[], sex: string, bodyweightLbs: number): StrengthTrackerData {
  const styleLogs = history.filter(l => l.workoutStyle === 'Strength');
  const keyLifts = ['Barbell Bench Press', 'Barbell Back Squat', 'Conventional Deadlift'];

  // Lift history: last 8 data points per lift
  const liftHistory = keyLifts.map(liftName => {
    const points: { date: string; e1rm: number }[] = [];
    for (const log of styleLogs) {
      for (const ex of log.exercises) {
        if (ex.exerciseName.toLowerCase() === liftName.toLowerCase()) {
          let best = 0;
          for (const set of ex.sets) {
            if (set.weight > 0 && set.reps > 0) {
              const e = est1RM(set.weight, set.reps);
              if (e > best) best = e;
            }
          }
          if (best > 0) points.push({ date: log.date, e1rm: best });
        }
      }
    }
    points.sort((a, b) => a.date.localeCompare(b.date));
    return { name: liftName.replace('Barbell ', '').replace('Conventional ', ''), dataPoints: points.slice(-8) };
  }).filter(l => l.dataPoints.length > 0);

  // DOTS score
  let dotsScore: number | null = null;
  let bigThreeTotal = 0;
  let bigThreeCount = 0;
  for (const liftName of keyLifts) {
    let best = 0;
    for (const pr of prHistory) {
      if (pr.type === 'weight' && pr.exerciseName.toLowerCase() === liftName.toLowerCase() && pr.value > best) best = pr.value;
    }
    for (const log of history) {
      for (const ex of log.exercises) {
        if (ex.exerciseName.toLowerCase() === liftName.toLowerCase()) {
          for (const set of ex.sets) {
            if (set.weight > 0 && set.reps > 0) { const e = est1RM(set.weight, set.reps); if (e > best) best = e; }
          }
        }
      }
    }
    if (best > 0) { bigThreeTotal += best; bigThreeCount++; }
  }
  if (bigThreeCount === 3 && bodyweightLbs > 0) {
    const bwKg = bodyweightLbs * 0.453592;
    const a = -0.000001093, b = 0.0007391293, c = -0.1918759221, d = 24.0900756, e = -307.75076;
    const coeff = sex === 'female'
      ? 500 / (-0.0000010706 * bwKg ** 4 + 0.0005158568 * bwKg ** 3 + -0.1126655495 * bwKg ** 2 + 13.6175032 * bwKg + -57.96288)
      : 500 / (a * bwKg ** 4 + b * bwKg ** 3 + c * bwKg ** 2 + d * bwKg + e);
    dotsScore = Math.round(bigThreeTotal * 0.453592 * coeff);
  }

  // Volume per session
  const volumePerSession = styleLogs.slice(-12).map(l => ({ date: l.date, volume: l.totalVolume }));

  // Rep range distribution
  let strength = 0, hypertrophy = 0, endurance = 0;
  for (const log of styleLogs) {
    for (const ex of log.exercises) {
      for (const set of ex.sets) {
        if (!set.done) continue;
        if (set.reps <= 5) strength++;
        else if (set.reps <= 12) hypertrophy++;
        else endurance++;
      }
    }
  }
  const totalSets = strength + hypertrophy + endurance;
  const repRangeDistribution = totalSets > 0 ? [
    { range: '1-5 (Strength)', sets: strength, pct: Math.round((strength / totalSets) * 100) },
    { range: '6-12 (Hypertrophy)', sets: hypertrophy, pct: Math.round((hypertrophy / totalSets) * 100) },
    { range: '12+ (Endurance)', sets: endurance, pct: Math.round((endurance / totalSets) * 100) },
  ] : [];

  // Split frequency
  const splitCounts = new Map<string, number>();
  for (const log of styleLogs) {
    const s = log.split || 'Unspecified';
    splitCounts.set(s, (splitCounts.get(s) || 0) + 1);
  }
  const splitFrequency = [...splitCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([split, count]) => ({ split, count }));

  return { type: 'strength', liftHistory, dotsScore, volumePerSession, repRangeDistribution, splitFrequency };
}

// ─── Bodybuilding Tracker ───────────────────────────────────

export interface BodybuildingTrackerData {
  type: 'bodybuilding';
  muscleVolumeWeekly: { muscle: string; sets: number; recommended: [number, number] }[];
  pumpScore: number;
  weakPoints: string[];
  volumeTrend: { week: string; volume: number }[];
}

function getBodybuildingTrackerData(history: WorkoutLog[]): BodybuildingTrackerData {
  const styleLogs = history.filter(l => l.workoutStyle === 'Bodybuilding');
  const oneWeekAgo = daysAgo(7);
  const thisWeek = styleLogs.filter(l => new Date(l.date + 'T00:00:00') >= oneWeekAgo);

  // Muscle volume
  const muscleSets: Record<string, number> = {};
  let pumpSets = 0;
  for (const log of thisWeek) {
    for (const ex of log.exercises) {
      const mg = normalizeMuscleGroup(ex.muscleGroup);
      const doneSets = ex.sets.filter(s => s.done);
      muscleSets[mg] = (muscleSets[mg] || 0) + doneSets.length;
      pumpSets += doneSets.filter(s => s.reps >= 8 && s.reps <= 12).length;
    }
  }

  const muscleVolumeWeekly = Object.entries(RECOMMENDED_WEEKLY_SETS).map(([muscle, rec]) => ({
    muscle, sets: muscleSets[muscle] || 0, recommended: rec as [number, number],
  }));

  const weakPoints = muscleVolumeWeekly
    .filter(m => m.sets > 0 && m.sets < m.recommended[0])
    .map(m => m.muscle);

  // Volume trend (last 8 weeks)
  const now = new Date();
  const volumeTrend: { week: string; volume: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const ws = new Date(getMondayOfWeek(now));
    ws.setDate(ws.getDate() - i * 7);
    const we = new Date(ws);
    we.setDate(we.getDate() + 7);
    const weekLogs = styleLogs.filter(l => { const d = new Date(l.date + 'T00:00:00'); return d >= ws && d < we; });
    const vol = weekLogs.reduce((s, l) => s + l.totalVolume, 0);
    volumeTrend.push({ week: ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), volume: vol });
  }

  return { type: 'bodybuilding', muscleVolumeWeekly, pumpScore: pumpSets, weakPoints, volumeTrend };
}

// ─── CrossFit Tracker ───────────────────────────────────────

export interface CrossFitTrackerData {
  type: 'crossfit';
  sessionsPerWeek: { week: string; count: number }[];
  movementCoverage: { pattern: string; count: number }[];
  avgRPE: number | null;
  avgDuration: number;
  totalSessions: number;
}

function getCrossFitTrackerData(history: WorkoutLog[]): CrossFitTrackerData {
  const styleLogs = history.filter(l => l.workoutStyle === 'CrossFit');
  const fourWeeksAgo = daysAgo(28);
  const recent = styleLogs.filter(l => new Date(l.date + 'T00:00:00') >= fourWeeksAgo);

  // Sessions per week
  const now = new Date();
  const sessionsPerWeek: { week: string; count: number }[] = [];
  for (let i = 3; i >= 0; i--) {
    const ws = new Date(getMondayOfWeek(now));
    ws.setDate(ws.getDate() - i * 7);
    const we = new Date(ws);
    we.setDate(we.getDate() + 7);
    const count = styleLogs.filter(l => { const d = new Date(l.date + 'T00:00:00'); return d >= ws && d < we; }).length;
    sessionsPerWeek.push({ week: ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), count });
  }

  // Movement pattern coverage
  const patternCounts = new Map<string, number>();
  for (const log of recent) {
    for (const ex of log.exercises) {
      const mg = (ex.muscleGroup || '').toLowerCase();
      let pattern = 'other';
      if (mg.includes('chest') || mg.includes('delt') || mg.includes('tricep')) pattern = 'push';
      else if (mg.includes('back') || mg.includes('lat') || mg.includes('bicep')) pattern = 'pull';
      else if (mg.includes('quad') || mg.includes('glute')) pattern = 'squat';
      else if (mg.includes('ham') || mg.includes('lower_back')) pattern = 'hinge';
      else if (mg.includes('core')) pattern = 'core';
      patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + 1);
    }
  }
  const movementCoverage = [...patternCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([pattern, count]) => ({ pattern: pattern.charAt(0).toUpperCase() + pattern.slice(1), count }));

  const avgRPE = recent.length > 0 ? Math.round(recent.reduce((s, l) => s + l.rpe, 0) / recent.length * 10) / 10 : null;
  const avgDuration = recent.length > 0 ? Math.round(recent.reduce((s, l) => s + l.duration, 0) / recent.length) : 0;

  return { type: 'crossfit', sessionsPerWeek, movementCoverage, avgRPE, avgDuration, totalSessions: recent.length };
}

// ─── HIIT Tracker ───────────────────────────────────────────

export interface HIITTrackerData {
  type: 'hiit';
  sessionsPerWeek: { week: string; count: number }[];
  intensityCurve: { date: string; rpe: number }[];
  avgDuration: number;
  avgCalories: number | null;
  recoveryGaps: number[];  // days between sessions
}

function getHIITTrackerData(history: WorkoutLog[]): HIITTrackerData {
  const styleLogs = history.filter(l => l.workoutStyle === 'HIIT');
  const fourWeeksAgo = daysAgo(28);
  const recent = styleLogs.filter(l => new Date(l.date + 'T00:00:00') >= fourWeeksAgo);

  const now = new Date();
  const sessionsPerWeek: { week: string; count: number }[] = [];
  for (let i = 3; i >= 0; i--) {
    const ws = new Date(getMondayOfWeek(now));
    ws.setDate(ws.getDate() - i * 7);
    const we = new Date(ws);
    we.setDate(we.getDate() + 7);
    const count = styleLogs.filter(l => { const d = new Date(l.date + 'T00:00:00'); return d >= ws && d < we; }).length;
    sessionsPerWeek.push({ week: ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), count });
  }

  const intensityCurve = recent.slice(-10).map(l => ({ date: l.date, rpe: l.rpe }));
  const avgDuration = recent.length > 0 ? Math.round(recent.reduce((s, l) => s + l.duration, 0) / recent.length) : 0;
  const calsLogs = recent.filter(l => l.calories && l.calories > 0);
  const avgCalories = calsLogs.length > 0 ? Math.round(calsLogs.reduce((s, l) => s + (l.calories || 0), 0) / calsLogs.length) : null;

  // Recovery gaps
  const sorted = [...recent].sort((a, b) => a.date.localeCompare(b.date));
  const recoveryGaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap = Math.round((new Date(sorted[i].date + 'T00:00:00').getTime() - new Date(sorted[i - 1].date + 'T00:00:00').getTime()) / 86400000);
    recoveryGaps.push(gap);
  }

  return { type: 'hiit', sessionsPerWeek, intensityCurve, avgDuration, avgCalories, recoveryGaps };
}

// ─── Hyrox Tracker ──────────────────────────────────────────

export interface HyroxTrackerData {
  type: 'hyrox';
  stationTimes: { station: string; avgDuration: number; sessionCount: number }[];
  weakestStation: string | null;
  totalSessions: number;
  avgSessionDuration: number;
}

const HYROX_STATIONS = [
  'Wall Ball', 'Sled Push', 'Sled Pull', 'Burpee Broad Jump',
  'Rowing', 'Farmers Carry', 'Lunge', 'SkiErg',
];

function getHyroxTrackerData(history: WorkoutLog[]): HyroxTrackerData {
  const styleLogs = history.filter(l => l.workoutStyle === 'Hyrox');

  const stationData: Record<string, { totalDur: number; count: number }> = {};
  for (const station of HYROX_STATIONS) stationData[station] = { totalDur: 0, count: 0 };

  for (const log of styleLogs) {
    for (const ex of log.exercises) {
      const name = ex.exerciseName.toLowerCase();
      for (const station of HYROX_STATIONS) {
        if (name.includes(station.toLowerCase()) || name.includes(station.toLowerCase().replace(' ', ''))) {
          const dur = ex.duration ? parseFloat(ex.duration) : (ex.sets.length * 2); // estimate 2 min per set
          stationData[station].totalDur += dur;
          stationData[station].count++;
          break;
        }
      }
    }
  }

  const stationTimes = HYROX_STATIONS.map(station => ({
    station,
    avgDuration: stationData[station].count > 0 ? Math.round(stationData[station].totalDur / stationData[station].count) : 0,
    sessionCount: stationData[station].count,
  }));

  const withData = stationTimes.filter(s => s.avgDuration > 0);
  const weakestStation = withData.length > 0
    ? withData.sort((a, b) => b.avgDuration - a.avgDuration)[0].station
    : null;

  const avgSessionDuration = styleLogs.length > 0
    ? Math.round(styleLogs.reduce((s, l) => s + l.duration, 0) / styleLogs.length) : 0;

  return { type: 'hyrox', stationTimes, weakestStation, totalSessions: styleLogs.length, avgSessionDuration };
}

// ─── Mobility / Pilates Tracker ─────────────────────────────

export interface MobilityTrackerData {
  type: 'mobility';
  sessionsPerWeek: { week: string; count: number }[];
  areaCoverage: { area: string; minutes: number }[];
  rpeTrend: { date: string; rpe: number }[];
  consistencyStreak: number;
  totalSessions: number;
}

function getMobilityTrackerData(history: WorkoutLog[], style: string): MobilityTrackerData {
  const styleLogs = history.filter(l => l.workoutStyle === style);

  const now = new Date();
  const sessionsPerWeek: { week: string; count: number }[] = [];
  for (let i = 3; i >= 0; i--) {
    const ws = new Date(getMondayOfWeek(now));
    ws.setDate(ws.getDate() - i * 7);
    const we = new Date(ws);
    we.setDate(we.getDate() + 7);
    const count = styleLogs.filter(l => { const d = new Date(l.date + 'T00:00:00'); return d >= ws && d < we; }).length;
    sessionsPerWeek.push({ week: ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), count });
  }

  // Area coverage (approximate minutes per muscle group)
  const areaMins = new Map<string, number>();
  const fourWeeksAgo = daysAgo(28);
  const recent = styleLogs.filter(l => new Date(l.date + 'T00:00:00') >= fourWeeksAgo);
  for (const log of recent) {
    const minsPerEx = log.exercises.length > 0 ? log.duration / log.exercises.length : 0;
    for (const ex of log.exercises) {
      const mg = normalizeMuscleGroup(ex.muscleGroup);
      areaMins.set(mg, (areaMins.get(mg) || 0) + minsPerEx);
    }
  }
  const areaCoverage = [...areaMins.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([area, minutes]) => ({ area, minutes: Math.round(minutes) }));

  const rpeTrend = recent.slice(-10).map(l => ({ date: l.date, rpe: l.rpe }));

  // Consistency streak (consecutive weeks with at least 1 session)
  let consistencyStreak = 0;
  for (let i = 0; i < 12; i++) {
    const ws = new Date(getMondayOfWeek(now));
    ws.setDate(ws.getDate() - i * 7);
    const we = new Date(ws);
    we.setDate(we.getDate() + 7);
    const hasSession = styleLogs.some(l => { const d = new Date(l.date + 'T00:00:00'); return d >= ws && d < we; });
    if (hasSession) consistencyStreak++;
    else break;
  }

  return { type: 'mobility', sessionsPerWeek, areaCoverage, rpeTrend, consistencyStreak, totalSessions: styleLogs.length };
}

// ─── Low-Impact Tracker ─────────────────────────────────────

export interface LowImpactTrackerData {
  type: 'low_impact';
  sessionsPerWeek: { week: string; count: number }[];
  exerciseVariety: number;
  bodyFocus: { area: string; pct: number }[];
  rpeTrend: { date: string; rpe: number }[];
  avgDuration: number;
}

function getLowImpactTrackerData(history: WorkoutLog[]): LowImpactTrackerData {
  const styleLogs = history.filter(l => l.workoutStyle === 'Low-Impact');
  const fourWeeksAgo = daysAgo(28);
  const recent = styleLogs.filter(l => new Date(l.date + 'T00:00:00') >= fourWeeksAgo);

  const now = new Date();
  const sessionsPerWeek: { week: string; count: number }[] = [];
  for (let i = 3; i >= 0; i--) {
    const ws = new Date(getMondayOfWeek(now));
    ws.setDate(ws.getDate() - i * 7);
    const we = new Date(ws);
    we.setDate(we.getDate() + 7);
    const count = styleLogs.filter(l => { const d = new Date(l.date + 'T00:00:00'); return d >= ws && d < we; }).length;
    sessionsPerWeek.push({ week: ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), count });
  }

  const exerciseSet = new Set<string>();
  const areaCount = new Map<string, number>();
  for (const log of recent) {
    for (const ex of log.exercises) {
      exerciseSet.add(ex.exerciseName);
      const mg = normalizeMuscleGroup(ex.muscleGroup);
      areaCount.set(mg, (areaCount.get(mg) || 0) + 1);
    }
  }

  const totalExercises = [...areaCount.values()].reduce((s, v) => s + v, 0);
  const bodyFocus = [...areaCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([area, count]) => ({ area, pct: totalExercises > 0 ? Math.round((count / totalExercises) * 100) : 0 }));

  const rpeTrend = recent.slice(-10).map(l => ({ date: l.date, rpe: l.rpe }));
  const avgDuration = recent.length > 0 ? Math.round(recent.reduce((s, l) => s + l.duration, 0) / recent.length) : 0;

  return { type: 'low_impact', sessionsPerWeek, exerciseVariety: exerciseSet.size, bodyFocus, rpeTrend, avgDuration };
}

// ─── Main Entry Point ───────────────────────────────────────

export type StyleTrackerData =
  | StrengthTrackerData
  | BodybuildingTrackerData
  | CrossFitTrackerData
  | HIITTrackerData
  | HyroxTrackerData
  | MobilityTrackerData
  | LowImpactTrackerData;

export function getStyleTrackerData(
  style: string,
  history: WorkoutLog[],
  prHistory: PersonalRecord[],
  userProfile: { sex: string; weight: number },
): StyleTrackerData {
  switch (style) {
    case 'Strength': return getStrengthTrackerData(history, prHistory, userProfile.sex, userProfile.weight);
    case 'Bodybuilding': return getBodybuildingTrackerData(history);
    case 'CrossFit': return getCrossFitTrackerData(history);
    case 'HIIT': return getHIITTrackerData(history);
    case 'Hyrox': return getHyroxTrackerData(history);
    case 'Mobility': return getMobilityTrackerData(history, 'Mobility');
    case 'Pilates': return getMobilityTrackerData(history, 'Pilates');
    case 'Low-Impact': return getLowImpactTrackerData(history);
    default: return getCrossFitTrackerData(history); // fallback
  }
}

// ═══════════════════════════════════════════════════════════
// INSIGHTS TAB — Additional Data
// ═══════════════════════════════════════════════════════════

export interface MuscleReadinessSummary {
  ready: number;
  building: number;
  recovering: number;
  muscles: { name: string; status: string; lastWorked: string }[];
}

export function getMuscleReadinessSummary(muscleReadiness: MuscleReadiness[]): MuscleReadinessSummary {
  let ready = 0, building = 0, recovering = 0;
  for (const m of muscleReadiness) {
    if (m.status === 'ready') ready++;
    else if (m.status === 'building') building++;
    else if (m.status === 'recovering') recovering++;
  }
  return {
    ready, building, recovering,
    muscles: muscleReadiness.map(m => ({ name: m.name, status: m.status, lastWorked: m.lastWorked })),
  };
}

export interface DurationTrend {
  dataPoints: number[]; // last 20 session durations
  avgRecent: number;
  avgOlder: number;
  trend: 'up' | 'down' | 'flat';
}

export function getDurationTrend(history: WorkoutLog[]): DurationTrend {
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const dataPoints = sorted.slice(-20).map(l => l.duration);

  const half = Math.floor(dataPoints.length / 2);
  const recent = dataPoints.slice(half);
  const older = dataPoints.slice(0, half);
  const avgRecent = recent.length > 0 ? Math.round(recent.reduce((s, v) => s + v, 0) / recent.length) : 0;
  const avgOlder = older.length > 0 ? Math.round(older.reduce((s, v) => s + v, 0) / older.length) : 0;

  let trend: 'up' | 'down' | 'flat' = 'flat';
  if (avgOlder > 0 && avgRecent > avgOlder * 1.1) trend = 'up';
  else if (avgOlder > 0 && avgRecent < avgOlder * 0.9) trend = 'down';

  return { dataPoints, avgRecent, avgOlder, trend };
}

export interface PeakPerformanceWindow {
  bestWindow: string | null; // "6-8 AM"
  bestAvgScore: number;
  distribution: { window: string; avgScore: number; count: number }[];
}

export function getPeakPerformanceWindow(history: WorkoutLog[]): PeakPerformanceWindow {
  const windows = [
    { label: '5-7 AM', min: 5, max: 7 },
    { label: '7-9 AM', min: 7, max: 9 },
    { label: '9-11 AM', min: 9, max: 11 },
    { label: '11 AM-1 PM', min: 11, max: 13 },
    { label: '1-3 PM', min: 13, max: 15 },
    { label: '3-5 PM', min: 15, max: 17 },
    { label: '5-7 PM', min: 17, max: 19 },
    { label: '7-9 PM', min: 19, max: 21 },
    { label: '9-11 PM', min: 21, max: 23 },
  ];

  const withTime = history.filter(l => l.startTime);
  if (withTime.length < 3) return { bestWindow: null, bestAvgScore: 0, distribution: [] };

  const windowData: Record<string, { total: number; count: number }> = {};
  for (const w of windows) windowData[w.label] = { total: 0, count: 0 };

  for (const log of withTime) {
    const hour = new Date(log.startTime!).getHours();
    for (const w of windows) {
      if (hour >= w.min && hour < w.max) {
        windowData[w.label].total += log.trainingScore;
        windowData[w.label].count++;
        break;
      }
    }
  }

  const distribution = windows
    .map(w => ({
      window: w.label,
      avgScore: windowData[w.label].count > 0 ? Math.round(windowData[w.label].total / windowData[w.label].count) : 0,
      count: windowData[w.label].count,
    }))
    .filter(d => d.count > 0);

  let bestWindow: string | null = null;
  let bestAvgScore = 0;
  for (const d of distribution) {
    if (d.avgScore > bestAvgScore && d.count >= 2) {
      bestAvgScore = d.avgScore;
      bestWindow = d.window;
    }
  }

  return { bestWindow, bestAvgScore, distribution };
}

export interface SplitAdherence {
  splits: { name: string; pct: number; sets: number }[];
}

export function getSplitAdherence(history: WorkoutLog[]): SplitAdherence {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonth = history.filter(l => new Date(l.date + 'T00:00:00') >= monthStart);

  const groupSets: Record<string, number> = { Push: 0, Pull: 0, Legs: 0, Core: 0 };
  for (const log of thisMonth) {
    for (const ex of log.exercises) {
      const mg = normalizeMuscleGroup(ex.muscleGroup);
      const sets = ex.sets.filter(s => s.done).length;
      if (['Chest', 'Shoulders', 'Triceps'].includes(mg)) groupSets['Push'] += sets;
      else if (['Back', 'Biceps'].includes(mg)) groupSets['Pull'] += sets;
      else if (['Quads', 'Hamstrings', 'Glutes', 'Calves'].includes(mg)) groupSets['Legs'] += sets;
      else if (mg === 'Core') groupSets['Core'] += sets;
    }
  }

  const total = Object.values(groupSets).reduce((s, v) => s + v, 0);
  const splits = Object.entries(groupSets).map(([name, sets]) => ({
    name,
    pct: total > 0 ? Math.round((sets / total) * 100) : 0,
    sets,
  }));

  return { splits };
}

export interface CalorieTrend {
  weeklyTotals: { week: string; calories: number }[];
}

export function getCalorieTrend(history: WorkoutLog[]): CalorieTrend {
  const now = new Date();
  const weeklyTotals: { week: string; calories: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const ws = new Date(getMondayOfWeek(now));
    ws.setDate(ws.getDate() - i * 7);
    const we = new Date(ws);
    we.setDate(we.getDate() + 7);
    const weekLogs = history.filter(l => {
      const d = new Date(l.date + 'T00:00:00');
      return d >= ws && d < we && l.calories && l.calories > 0;
    });
    const total = weekLogs.reduce((s, l) => s + (l.calories || 0), 0);
    weeklyTotals.push({ week: ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), calories: total });
  }
  return { weeklyTotals };
}

// ═══════════════════════════════════════════════════════════
// STATS TAB — Additional Data
// ═══════════════════════════════════════════════════════════

export interface RestDayPatterns {
  avgRestDays: number;
  longestGap: number;
  longestGapDates: string | null;
}

export function getRestDayPatterns(history: WorkoutLog[]): RestDayPatterns {
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) return { avgRestDays: 0, longestGap: 0, longestGapDates: null };

  const fourWeeksAgo = daysAgo(28);
  const recent = sorted.filter(l => new Date(l.date + 'T00:00:00') >= fourWeeksAgo);

  const gaps: number[] = [];
  let longestGap = 0;
  let longestGapStart = '';

  for (let i = 1; i < recent.length; i++) {
    const gap = Math.round((new Date(recent[i].date + 'T00:00:00').getTime() - new Date(recent[i - 1].date + 'T00:00:00').getTime()) / 86400000) - 1;
    if (gap > 0) gaps.push(gap);
    if (gap > longestGap) { longestGap = gap; longestGapStart = recent[i - 1].date; }
  }

  const avgRestDays = gaps.length > 0 ? Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length * 10) / 10 : 0;

  return { avgRestDays, longestGap, longestGapDates: longestGapStart || null };
}

export interface ExerciseFrequency {
  top: { name: string; count: number }[];
  bottom: { name: string; count: number }[];
}

export function getExerciseFrequency(history: WorkoutLog[]): ExerciseFrequency {
  const counts = new Map<string, number>();
  for (const log of history) {
    for (const ex of log.exercises) {
      counts.set(ex.exerciseName, (counts.get(ex.exerciseName) || 0) + 1);
    }
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return {
    top: sorted.slice(0, 10).map(([name, count]) => ({ name, count })),
    bottom: sorted.slice(-5).reverse().map(([name, count]) => ({ name, count })),
  };
}

export interface EquipmentUsage {
  items: { name: string; count: number }[];
}

export function getEquipmentUsage(history: WorkoutLog[]): EquipmentUsage {
  const counts = new Map<string, number>();
  for (const log of history) {
    for (const ex of log.exercises) {
      // Equipment is embedded in the exercise data — use muscleGroup as a proxy,
      // or check if the exercise name implies equipment
      const name = ex.exerciseName.toLowerCase();
      if (name.includes('barbell') || name.includes('deadlift') || name.includes('squat') && !name.includes('goblet')) {
        counts.set('Barbell', (counts.get('Barbell') || 0) + 1);
      } else if (name.includes('dumbbell') || name.includes('goblet')) {
        counts.set('Dumbbells', (counts.get('Dumbbells') || 0) + 1);
      } else if (name.includes('cable') || name.includes('lat pulldown') || name.includes('seated row')) {
        counts.set('Cable Machine', (counts.get('Cable Machine') || 0) + 1);
      } else if (name.includes('machine') || name.includes('leg press') || name.includes('smith')) {
        counts.set('Machine', (counts.get('Machine') || 0) + 1);
      } else if (name.includes('kettlebell')) {
        counts.set('Kettlebell', (counts.get('Kettlebell') || 0) + 1);
      } else if (name.includes('band') || name.includes('resistance')) {
        counts.set('Bands', (counts.get('Bands') || 0) + 1);
      } else if (name.includes('pull-up') || name.includes('pullup') || name.includes('chin-up') || name.includes('dip')) {
        counts.set('Pull-Up Bar', (counts.get('Pull-Up Bar') || 0) + 1);
      } else {
        counts.set('Bodyweight', (counts.get('Bodyweight') || 0) + 1);
      }
    }
  }

  const items = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  return { items };
}

export interface MuscleBalanceScore {
  score: number; // 0-100
  details: { muscle: string; deviation: number }[]; // negative = undertrained
  worstMuscle: string | null;
}

export function getMuscleBalanceScore(history: WorkoutLog[]): MuscleBalanceScore {
  const fourWeeksAgo = daysAgo(28);
  const recent = history.filter(l => new Date(l.date + 'T00:00:00') >= fourWeeksAgo);

  const muscleSets: Record<string, number> = {};
  for (const log of recent) {
    for (const ex of log.exercises) {
      const mg = normalizeMuscleGroup(ex.muscleGroup);
      muscleSets[mg] = (muscleSets[mg] || 0) + ex.sets.filter(s => s.done).length;
    }
  }

  // Compare to midpoint of recommended range
  const deviations: { muscle: string; deviation: number }[] = [];
  let totalDeviation = 0;
  let worstMuscle: string | null = null;
  let worstDev = 0;

  for (const [muscle, [min, max]] of Object.entries(RECOMMENDED_WEEKLY_SETS)) {
    const target = (min + max) / 2;
    const actual = (muscleSets[muscle] || 0);
    // Normalize per week (data is 4 weeks)
    const weeklyActual = actual / 4;
    const deviation = target > 0 ? ((weeklyActual - target) / target) * 100 : 0;
    deviations.push({ muscle, deviation: Math.round(deviation) });
    totalDeviation += Math.abs(deviation);

    if (deviation < worstDev) { worstDev = deviation; worstMuscle = muscle; }
  }

  // Score: 100 = perfectly balanced, 0 = completely imbalanced
  const avgDev = deviations.length > 0 ? totalDeviation / deviations.length : 0;
  const score = Math.max(0, Math.min(100, Math.round(100 - avgDev)));

  return { score, details: deviations, worstMuscle };
}

export interface SessionQualityTrend {
  dataPoints: { date: string; score: number }[];
  trend: 'up' | 'down' | 'flat';
}

export function getSessionQualityTrend(history: WorkoutLog[]): SessionQualityTrend {
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const dataPoints = sorted.slice(-20).map(l => ({ date: l.date, score: l.trainingScore }));

  const half = Math.floor(dataPoints.length / 2);
  const recent = dataPoints.slice(half);
  const older = dataPoints.slice(0, half);
  const avgRecent = recent.length > 0 ? recent.reduce((s, v) => s + v.score, 0) / recent.length : 0;
  const avgOlder = older.length > 0 ? older.reduce((s, v) => s + v.score, 0) / older.length : 0;

  let trend: 'up' | 'down' | 'flat' = 'flat';
  if (avgOlder > 0 && avgRecent > avgOlder * 1.1) trend = 'up';
  else if (avgOlder > 0 && avgRecent < avgOlder * 0.9) trend = 'down';

  return { dataPoints, trend };
}

export interface FavoriteExercises {
  liked: string[];
  disliked: string[];
  likedCount: number;
  dislikedCount: number;
}

export function getFavoriteExercises(exercisePrefs: Record<string, string>): FavoriteExercises {
  const liked: string[] = [];
  const disliked: string[] = [];
  for (const [name, pref] of Object.entries(exercisePrefs)) {
    if (pref === 'liked') liked.push(name);
    else if (pref === 'disliked') disliked.push(name);
  }
  return { liked: liked.slice(0, 10), disliked: disliked.slice(0, 10), likedCount: liked.length, dislikedCount: disliked.length };
}

export interface PRTimeline {
  entries: { exerciseName: string; value: number; type: string; date: string }[];
}

export function getPRTimeline(prHistory: PersonalRecord[]): PRTimeline {
  const sorted = [...prHistory]
    .filter(pr => pr.type === 'weight')
    .sort((a, b) => b.date.localeCompare(a.date));
  return {
    entries: sorted.slice(0, 20).map(pr => ({
      exerciseName: pr.exerciseName,
      value: pr.value,
      type: pr.type,
      date: pr.date,
    })),
  };
}

export interface RecordsBoard {
  bestSession: { name: string; score: number; date: string } | null;
  longestSession: { name: string; duration: number; date: string } | null;
  heaviestLift: { exercise: string; weight: number; date: string } | null;
  mostVolume: { name: string; volume: number; date: string } | null;
  mostPRs: { name: string; count: number; date: string } | null;
  mostExercises: { name: string; count: number; date: string } | null;
}

export function getRecordsBoard(history: WorkoutLog[]): RecordsBoard {
  let bestSession: RecordsBoard['bestSession'] = null;
  let longestSession: RecordsBoard['longestSession'] = null;
  let heaviestLift: RecordsBoard['heaviestLift'] = null;
  let mostVolume: RecordsBoard['mostVolume'] = null;
  let mostPRs: RecordsBoard['mostPRs'] = null;
  let mostExercises: RecordsBoard['mostExercises'] = null;

  for (const log of history) {
    if (!bestSession || log.trainingScore > bestSession.score) {
      bestSession = { name: log.workoutName, score: log.trainingScore, date: log.date };
    }
    if (!longestSession || log.duration > longestSession.duration) {
      longestSession = { name: log.workoutName, duration: log.duration, date: log.date };
    }
    if (!mostVolume || log.totalVolume > mostVolume.volume) {
      mostVolume = { name: log.workoutName, volume: log.totalVolume, date: log.date };
    }
    if (!mostPRs || log.prsHit > (mostPRs.count)) {
      mostPRs = { name: log.workoutName, count: log.prsHit, date: log.date };
    }
    if (!mostExercises || log.exercises.length > mostExercises.count) {
      mostExercises = { name: log.workoutName, count: log.exercises.length, date: log.date };
    }
    for (const ex of log.exercises) {
      for (const set of ex.sets) {
        if (!heaviestLift || set.weight > heaviestLift.weight) {
          heaviestLift = { exercise: ex.exerciseName, weight: set.weight, date: log.date };
        }
      }
    }
  }

  return { bestSession, longestSession, heaviestLift, mostVolume, mostPRs, mostExercises };
}

export interface WarmupCompliance {
  totalSessions: number;
  withWarmup: number;
  pct: number;
}

export function getWarmupCompliance(history: WorkoutLog[]): WarmupCompliance {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonth = history.filter(l => new Date(l.date + 'T00:00:00') >= monthStart);

  // Check if any exercise in the session looks like a warm-up (low weight, high reps, or named warm-up)
  let withWarmup = 0;
  for (const log of thisMonth) {
    const hasWarmup = log.exercises.some(ex => {
      const name = ex.exerciseName.toLowerCase();
      return name.includes('warm') || name.includes('stretch') || name.includes('mobility') || name.includes('foam') || name.includes('activation');
    });
    if (hasWarmup) withWarmup++;
  }

  return {
    totalSessions: thisMonth.length,
    withWarmup,
    pct: thisMonth.length > 0 ? Math.round((withWarmup / thisMonth.length) * 100) : 0,
  };
}

// ═══════════════════════════════════════════════════════════
// ACHIEVEMENTS — Badges
// ═══════════════════════════════════════════════════════════

export interface Badge {
  id: string;
  name: string;
  description: string;
  category: 'volume' | 'duration' | 'style' | 'strength' | 'consistency' | 'pattern' | 'progression' | 'endurance';
  icon: string;
  earned: boolean;
  current: number;
  target: number;
}

export function computeBadges(
  history: WorkoutLog[],
  prHistory: PersonalRecord[],
  bodyweightLbs: number,
): Badge[] {
  const totalVolume = history.reduce((s, l) => s + l.totalVolume, 0);
  const totalMinutes = history.reduce((s, l) => s + l.duration, 0);
  const totalHours = totalMinutes / 60;

  // Styles used
  const stylesUsed = new Set(history.map(l => l.workoutStyle));
  const styleCounts = new Map<string, number>();
  for (const log of history) styleCounts.set(log.workoutStyle, (styleCounts.get(log.workoutStyle) || 0) + 1);
  const maxStyleCount = Math.max(...styleCounts.values(), 0);

  // Strength: best e1RM per lift
  const bestE1RM = new Map<string, number>();
  for (const log of history) {
    for (const ex of log.exercises) {
      for (const set of ex.sets) {
        if (set.weight > 0 && set.reps > 0) {
          const e = est1RM(set.weight, set.reps);
          const key = ex.exerciseName.toLowerCase();
          if (!bestE1RM.has(key) || e > bestE1RM.get(key)!) bestE1RM.set(key, e);
        }
      }
    }
  }

  const benchE1RM = bestE1RM.get('barbell bench press') ?? 0;
  const squatE1RM = bestE1RM.get('barbell back squat') ?? 0;
  const deadliftE1RM = bestE1RM.get('conventional deadlift') ?? 0;
  const ohpE1RM = bestE1RM.get('standing overhead press') ?? 0;
  const sbdTotal = benchE1RM + squatE1RM + deadliftE1RM;

  // Consistency: weeks with at least 1 workout
  const weekMap = new Map<string, boolean>();
  for (const log of history) {
    const d = new Date(log.date + 'T00:00:00');
    const monday = getMondayOfWeek(d);
    weekMap.set(dateStr(monday), true);
  }
  let consecutiveWeeks = 0;
  const now = new Date();
  for (let i = 0; i < 52; i++) {
    const ws = new Date(getMondayOfWeek(now));
    ws.setDate(ws.getDate() - i * 7);
    if (weekMap.has(dateStr(ws))) consecutiveWeeks++;
    else break;
  }

  // Pattern: time of day
  const earlyCount = history.filter(l => l.startTime && new Date(l.startTime).getHours() < 7).length;
  const lateCount = history.filter(l => l.startTime && new Date(l.startTime).getHours() >= 20).length;

  // Weekend warrior
  const weekendPairs = new Set<string>();
  const satDates = new Set<string>();
  const sunDates = new Set<string>();
  for (const log of history) {
    const d = new Date(log.date + 'T00:00:00');
    if (d.getDay() === 6) satDates.add(log.date);
    if (d.getDay() === 0) sunDates.add(log.date);
  }
  for (const sat of satDates) {
    const nextDay = new Date(sat + 'T00:00:00');
    nextDay.setDate(nextDay.getDate() + 1);
    if (sunDates.has(dateStr(nextDay))) weekendPairs.add(sat);
  }

  // Double day
  const dateCounts = new Map<string, number>();
  for (const log of history) dateCounts.set(log.date, (dateCounts.get(log.date) || 0) + 1);
  const doubleDays = [...dateCounts.values()].filter(c => c >= 2).length;

  // Comeback kid
  const sortedDates = [...new Set(history.map(l => l.date))].sort();
  let hasComeback = false;
  for (let i = 1; i < sortedDates.length; i++) {
    const gap = Math.round((new Date(sortedDates[i] + 'T00:00:00').getTime() - new Date(sortedDates[i - 1] + 'T00:00:00').getTime()) / 86400000);
    if (gap >= 7) { hasComeback = true; break; }
  }

  // Unique exercises
  const uniqueExercises = new Set<string>();
  for (const log of history) for (const ex of log.exercises) uniqueExercises.add(ex.exerciseName);

  // Progression: consecutive weight increase on same exercise
  const exerciseSessions = new Map<string, { date: string; maxWeight: number }[]>();
  for (const log of history) {
    for (const ex of log.exercises) {
      const maxW = Math.max(...ex.sets.map(s => s.weight), 0);
      if (maxW > 0) {
        if (!exerciseSessions.has(ex.exerciseName)) exerciseSessions.set(ex.exerciseName, []);
        exerciseSessions.get(ex.exerciseName)!.push({ date: log.date, maxWeight: maxW });
      }
    }
  }

  let maxConsecutiveIncrease = 0;
  for (const [, sessions] of exerciseSessions) {
    sessions.sort((a, b) => a.date.localeCompare(b.date));
    let streak = 0;
    for (let i = 1; i < sessions.length; i++) {
      if (sessions[i].maxWeight > sessions[i - 1].maxWeight) streak++;
      else streak = 0;
      if (streak > maxConsecutiveIncrease) maxConsecutiveIncrease = streak;
    }
  }

  // PR week / PR storm
  const weekPRMap = new Map<string, Set<string>>();
  for (const pr of prHistory) {
    const d = new Date(pr.date + 'T00:00:00');
    const monday = getMondayOfWeek(d);
    const key = dateStr(monday);
    if (!weekPRMap.has(key)) weekPRMap.set(key, new Set());
    weekPRMap.get(key)!.add(pr.exerciseName);
  }
  const maxPRExercisesInWeek = Math.max(...[...weekPRMap.values()].map(s => s.size), 0);

  // Endurance: session > 90 min
  const sessionsOver90 = history.filter(l => l.duration >= 90).length;
  // 5 sessions over 60 min in a week
  let volumeWeeks = 0;
  for (const [weekKey] of weekMap) {
    const weekStart = new Date(weekKey + 'T00:00:00');
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const over60 = history.filter(l => {
      const d = new Date(l.date + 'T00:00:00');
      return d >= weekStart && d < weekEnd && l.duration >= 60;
    }).length;
    if (over60 >= 5) volumeWeeks++;
  }

  const badges: Badge[] = [
    // Volume
    { id: 'vol_10k', name: '10K Club', description: 'Move 10,000 lbs', category: 'volume', icon: 'dumbbell', earned: totalVolume >= 10000, current: Math.min(totalVolume, 10000), target: 10000 },
    { id: 'vol_50k', name: 'Iron Stacker', description: 'Move 50,000 lbs', category: 'volume', icon: 'dumbbell', earned: totalVolume >= 50000, current: Math.min(totalVolume, 50000), target: 50000 },
    { id: 'vol_100k', name: 'Ton Lifter', description: 'Move 100,000 lbs', category: 'volume', icon: 'dumbbell', earned: totalVolume >= 100000, current: Math.min(totalVolume, 100000), target: 100000 },
    { id: 'vol_500k', name: 'Half Million', description: 'Move 500,000 lbs', category: 'volume', icon: 'dumbbell', earned: totalVolume >= 500000, current: Math.min(totalVolume, 500000), target: 500000 },
    { id: 'vol_1m', name: 'The Millionaire', description: 'Move 1,000,000 lbs', category: 'volume', icon: 'crown', earned: totalVolume >= 1000000, current: Math.min(totalVolume, 1000000), target: 1000000 },

    // Duration
    { id: 'dur_10h', name: 'Dedicated', description: 'Train 10 hours', category: 'duration', icon: 'flame', earned: totalHours >= 10, current: Math.min(Math.round(totalHours), 10), target: 10 },
    { id: 'dur_50h', name: 'Committed', description: 'Train 50 hours', category: 'duration', icon: 'flame', earned: totalHours >= 50, current: Math.min(Math.round(totalHours), 50), target: 50 },
    { id: 'dur_100h', name: 'Centurion', description: 'Train 100 hours', category: 'duration', icon: 'flame', earned: totalHours >= 100, current: Math.min(Math.round(totalHours), 100), target: 100 },
    { id: 'dur_250h', name: 'Iron Temple', description: 'Train 250 hours', category: 'duration', icon: 'shield', earned: totalHours >= 250, current: Math.min(Math.round(totalHours), 250), target: 250 },
    { id: 'dur_500h', name: 'Monk Mode', description: 'Train 500 hours', category: 'duration', icon: 'crown', earned: totalHours >= 500, current: Math.min(Math.round(totalHours), 500), target: 500 },

    // Style explorer
    { id: 'style_3', name: 'Curious', description: 'Try 3 workout styles', category: 'style', icon: 'target', earned: stylesUsed.size >= 3, current: Math.min(stylesUsed.size, 3), target: 3 },
    { id: 'style_5', name: 'Explorer', description: 'Try 5 workout styles', category: 'style', icon: 'target', earned: stylesUsed.size >= 5, current: Math.min(stylesUsed.size, 5), target: 5 },
    { id: 'style_all', name: 'Renaissance', description: 'Try all 7 styles', category: 'style', icon: 'award', earned: stylesUsed.size >= 7, current: Math.min(stylesUsed.size, 7), target: 7 },
    { id: 'style_10', name: 'Specialist', description: '10 sessions of one style', category: 'style', icon: 'medal', earned: maxStyleCount >= 10, current: Math.min(maxStyleCount, 10), target: 10 },
    { id: 'style_25', name: 'Master', description: '25 sessions of one style', category: 'style', icon: 'crown', earned: maxStyleCount >= 25, current: Math.min(maxStyleCount, 25), target: 25 },

    // Strength
    { id: 'str_1xbench', name: '1x BW Bench', description: 'Bench press your bodyweight', category: 'strength', icon: 'dumbbell', earned: bodyweightLbs > 0 && benchE1RM >= bodyweightLbs, current: benchE1RM, target: bodyweightLbs },
    { id: 'str_1_5xsquat', name: '1.5x BW Squat', description: 'Squat 1.5x bodyweight', category: 'strength', icon: 'dumbbell', earned: bodyweightLbs > 0 && squatE1RM >= bodyweightLbs * 1.5, current: squatE1RM, target: Math.round(bodyweightLbs * 1.5) },
    { id: 'str_2xdead', name: '2x BW Deadlift', description: 'Deadlift 2x bodyweight', category: 'strength', icon: 'dumbbell', earned: bodyweightLbs > 0 && deadliftE1RM >= bodyweightLbs * 2, current: deadliftE1RM, target: bodyweightLbs * 2 },
    { id: 'str_1000', name: '1000 lb Club', description: 'SBD total over 1000 lbs', category: 'strength', icon: 'crown', earned: sbdTotal >= 1000, current: sbdTotal, target: 1000 },
    { id: 'str_bwohp', name: 'BW OHP', description: 'OHP your bodyweight', category: 'strength', icon: 'award', earned: bodyweightLbs > 0 && ohpE1RM >= bodyweightLbs, current: ohpE1RM, target: bodyweightLbs },

    // Consistency
    { id: 'con_month', name: 'Monthly Regular', description: 'Train every week for a month', category: 'consistency', icon: 'flame', earned: consecutiveWeeks >= 4, current: Math.min(consecutiveWeeks, 4), target: 4 },
    { id: 'con_quarter', name: 'Quarterly Grinder', description: 'Train every week for 3 months', category: 'consistency', icon: 'shield', earned: consecutiveWeeks >= 12, current: Math.min(consecutiveWeeks, 12), target: 12 },

    // Pattern
    { id: 'pat_early', name: 'Early Bird', description: '10 workouts before 7 AM', category: 'pattern', icon: 'zap', earned: earlyCount >= 10, current: Math.min(earlyCount, 10), target: 10 },
    { id: 'pat_night', name: 'Night Owl', description: '10 workouts after 8 PM', category: 'pattern', icon: 'zap', earned: lateCount >= 10, current: Math.min(lateCount, 10), target: 10 },
    { id: 'pat_weekend', name: 'Weekend Warrior', description: 'Train Sat + Sun 5 times', category: 'pattern', icon: 'flame', earned: weekendPairs.size >= 5, current: Math.min(weekendPairs.size, 5), target: 5 },
    { id: 'pat_double', name: 'Double Day', description: '2 workouts in one day', category: 'pattern', icon: 'zap', earned: doubleDays >= 1, current: Math.min(doubleDays, 1), target: 1 },
    { id: 'pat_comeback', name: 'Comeback Kid', description: 'Return after 7+ day break', category: 'pattern', icon: 'trophy', earned: hasComeback, current: hasComeback ? 1 : 0, target: 1 },
    { id: 'pat_variety50', name: 'Variety Pack', description: 'Use 50 unique exercises', category: 'pattern', icon: 'target', earned: uniqueExercises.size >= 50, current: Math.min(uniqueExercises.size, 50), target: 50 },
    { id: 'pat_variety100', name: 'Encyclopedia', description: 'Use 100 unique exercises', category: 'pattern', icon: 'award', earned: uniqueExercises.size >= 100, current: Math.min(uniqueExercises.size, 100), target: 100 },

    // Progression
    { id: 'prog_3', name: 'On a Roll', description: 'Increase weight 3 sessions in a row', category: 'progression', icon: 'trophy', earned: maxConsecutiveIncrease >= 3, current: Math.min(maxConsecutiveIncrease, 3), target: 3 },
    { id: 'prog_5', name: 'Unstoppable', description: 'Increase weight 5 sessions in a row', category: 'progression', icon: 'award', earned: maxConsecutiveIncrease >= 5, current: Math.min(maxConsecutiveIncrease, 5), target: 5 },
    { id: 'prog_prweek', name: 'PR Week', description: 'PRs on 3 exercises in one week', category: 'progression', icon: 'trophy', earned: maxPRExercisesInWeek >= 3, current: Math.min(maxPRExercisesInWeek, 3), target: 3 },

    // Endurance
    { id: 'end_marathon', name: 'Marathon Session', description: 'Single session over 90 min', category: 'endurance', icon: 'flame', earned: sessionsOver90 >= 1, current: Math.min(sessionsOver90, 1), target: 1 },
    { id: 'end_volweek', name: 'Volume Week', description: '5 sessions over 60 min in one week', category: 'endurance', icon: 'shield', earned: volumeWeeks >= 1, current: Math.min(volumeWeeks, 1), target: 1 },
  ];

  return badges;
}
