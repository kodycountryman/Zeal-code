/**
 * Customizable metric slot system for the Training Score card.
 * Users can assign any of these metrics to 4 personal dashboard slots.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type MetricSlotKey =
  // Workout data (always available)
  | 'streak'
  | 'weeklyHours'
  | 'sessionsThisWeek'
  | 'target'
  | 'prsThisMonth'
  | 'avgDuration'
  | 'volumeThisWeek'
  | 'longestStreak'
  | 'exercisesThisWeek'
  | 'consistencyPct'
  // Health data (requires Apple Health / Health Connect)
  | 'caloriesToday'
  | 'stepsToday'
  | 'restingBpm'
  | 'restingHeartRate'
  // Body metrics
  | 'bodyWeight';

export type MetricGroup = 'workout' | 'health';

export interface MetricSlotDefinition {
  key: MetricSlotKey;
  label: string;       // Full label for picker list
  shortLabel: string;  // Short label shown in the slot
  icon: string;        // PlatformIcon name
  group: MetricGroup;
  description: string;
  requiresHealth?: boolean;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const METRIC_REGISTRY: MetricSlotDefinition[] = [
  // — Workout group —
  {
    key: 'streak',
    label: 'Streak',
    shortLabel: 'Streak',
    icon: 'flame',
    group: 'workout',
    description: 'Consecutive training days',
  },
  {
    key: 'weeklyHours',
    label: 'Weekly Hours',
    shortLabel: 'Hours',
    icon: 'clock',
    group: 'workout',
    description: 'Total training time this week',
  },
  {
    key: 'sessionsThisWeek',
    label: 'Sessions This Week',
    shortLabel: 'Sessions',
    icon: 'dumbbell',
    group: 'workout',
    description: 'Workouts completed this week',
  },
  {
    key: 'target',
    label: 'Weekly Target',
    shortLabel: 'Target',
    icon: 'target',
    group: 'workout',
    description: 'Progress toward your weekly session goal',
  },
  {
    key: 'prsThisMonth',
    label: 'PRs This Month',
    shortLabel: 'PRs',
    icon: 'trophy',
    group: 'workout',
    description: 'Personal records set this month',
  },
  {
    key: 'avgDuration',
    label: 'Avg Duration',
    shortLabel: 'Avg',
    icon: 'timer',
    group: 'workout',
    description: 'Average workout length',
  },
  {
    key: 'volumeThisWeek',
    label: 'Volume This Week',
    shortLabel: 'Volume',
    icon: 'bar-chart',
    group: 'workout',
    description: 'Total weight moved this week',
  },
  {
    key: 'longestStreak',
    label: 'Longest Streak',
    shortLabel: 'Best',
    icon: 'award',
    group: 'workout',
    description: 'All-time best consecutive training days',
  },
  {
    key: 'exercisesThisWeek',
    label: 'Exercises This Week',
    shortLabel: 'Moves',
    icon: 'layers',
    group: 'workout',
    description: 'Unique movements performed this week',
  },
  {
    key: 'consistencyPct',
    label: 'Consistency',
    shortLabel: 'Consist.',
    icon: 'trending-up',
    group: 'workout',
    description: 'Sessions hit vs target over the last 4 weeks',
  },
  // — Health group —
  {
    key: 'caloriesToday',
    label: 'Calories Today',
    shortLabel: 'Calories',
    icon: 'flame',
    group: 'health',
    description: 'Active calories burned today',
    requiresHealth: true,
  },
  {
    key: 'stepsToday',
    label: 'Steps Today',
    shortLabel: 'Steps',
    icon: 'footprints',
    group: 'health',
    description: 'Steps taken today',
    requiresHealth: true,
  },
  {
    key: 'restingBpm',
    label: 'Resting BPM',
    shortLabel: 'BPM',
    icon: 'heart-pulse',
    group: 'health',
    description: 'Resting heart rate',
    requiresHealth: true,
  },
  {
    key: 'restingHeartRate',
    label: 'Resting Heart Rate',
    shortLabel: 'HR',
    icon: 'heart',
    group: 'health',
    description: 'Resting heart rate from Health',
    requiresHealth: true,
  },
  // — Body metrics —
  {
    key: 'bodyWeight',
    label: 'Body Weight',
    shortLabel: 'Weight',
    icon: 'scale',
    group: 'workout',
    description: 'Your current logged body weight',
  },
];

// ─── Defaults ─────────────────────────────────────────────────────────────────

/** Slot 1 pre-loaded with Streak. Slots 2-4 empty until user configures. */
export const DEFAULT_METRIC_SLOTS: (MetricSlotKey | null)[] = [
  'streak',
  null,
  null,
  null,
];

export const METRIC_SLOT_STORAGE_KEY = 'zeal_metric_slot_config_v1';

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getMetricDef(key: MetricSlotKey): MetricSlotDefinition | undefined {
  return METRIC_REGISTRY.find((m) => m.key === key);
}

function getWeekStart(): Date {
  const d = new Date();
  const day = d.getDay(); // 0 = Sun
  const weekStart = new Date(d);
  weekStart.setDate(d.getDate() - day);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

function getMonthPrefix(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Value resolver ───────────────────────────────────────────────────────────

export interface MetricSlotInput {
  workoutHistory: Array<{
    date: string;
    duration: number;
    totalVolume: number;
    prsHit: number;
  }>;
  weeklyHoursMin: number;
  streak: number;
  targetDone: number;
  targetTotal: number;
  calories: number | null;
  steps: number | null;
  heartRate: number | null;
  healthConnected: boolean;
  // Extended fields for new metrics
  longestStreakDays: number;
  exercisesThisWeekCount: number;
  consistencyPct: number;
  bodyWeight: number | null;
}

export interface ResolvedMetricValue {
  value: string;
  unit: string;
  /** true when the metric needs health but health isn't connected */
  needsHealth: boolean;
}

export function resolveMetricValue(
  key: MetricSlotKey,
  data: MetricSlotInput,
): ResolvedMetricValue {
  const weekStart = getWeekStart();
  const monthPrefix = getMonthPrefix();

  const thisWeekLogs = data.workoutHistory.filter(
    (l) => new Date(l.date) >= weekStart,
  );

  switch (key) {
    case 'streak':
      return { value: String(data.streak), unit: 'day streak', needsHealth: false };

    case 'weeklyHours': {
      const min = data.weeklyHoursMin;
      const display = min === 0 ? '0' : min >= 60
        ? `${Math.round((min / 60) * 10) / 10}`
        : `${min}`;
      const unit = min >= 60 ? 'hrs this week' : 'min this week';
      return { value: display, unit, needsHealth: false };
    }

    case 'sessionsThisWeek':
      return { value: String(thisWeekLogs.length), unit: 'this week', needsHealth: false };

    case 'target':
      return {
        value: `${Math.min(data.targetDone, data.targetTotal)}`,
        unit: `of ${data.targetTotal}`,
        needsHealth: false,
      };

    case 'prsThisMonth': {
      const count = data.workoutHistory
        .filter((l) => l.date.startsWith(monthPrefix))
        .reduce((sum, l) => sum + (l.prsHit ?? 0), 0);
      return { value: String(count), unit: 'PRs this month', needsHealth: false };
    }

    case 'avgDuration': {
      if (data.workoutHistory.length === 0) {
        return { value: '—', unit: 'avg min', needsHealth: false };
      }
      const avg = Math.round(
        data.workoutHistory.reduce((s, l) => s + l.duration, 0) /
          data.workoutHistory.length,
      );
      return { value: String(avg), unit: 'avg min', needsHealth: false };
    }

    case 'volumeThisWeek': {
      const vol = thisWeekLogs.reduce((s, l) => s + (l.totalVolume ?? 0), 0);
      const display = vol === 0 ? '0'
        : vol >= 1000 ? `${Math.round(vol / 100) / 10}k`
        : String(Math.round(vol));
      return { value: display, unit: 'lbs this week', needsHealth: false };
    }

    case 'caloriesToday':
      if (!data.healthConnected) return { value: '—', unit: 'cal', needsHealth: true };
      return {
        value: data.calories !== null && data.calories > 0 ? String(data.calories) : '—',
        unit: 'cal today',
        needsHealth: false,
      };

    case 'stepsToday':
      if (!data.healthConnected) return { value: '—', unit: 'steps', needsHealth: true };
      return {
        value: data.steps !== null && data.steps > 0
          ? data.steps >= 1000 ? `${(data.steps / 1000).toFixed(1)}k` : String(data.steps)
          : '—',
        unit: 'steps today',
        needsHealth: false,
      };

    case 'restingBpm':
      if (!data.healthConnected) return { value: '—', unit: 'bpm', needsHealth: true };
      return {
        value: data.heartRate !== null ? String(data.heartRate) : '—',
        unit: 'bpm',
        needsHealth: false,
      };

    case 'longestStreak':
      return {
        value: String(data.longestStreakDays),
        unit: 'day best',
        needsHealth: false,
      };

    case 'exercisesThisWeek':
      return {
        value: String(data.exercisesThisWeekCount),
        unit: 'moves',
        needsHealth: false,
      };

    case 'consistencyPct':
      return {
        value: `${data.consistencyPct}%`,
        unit: '4-wk avg',
        needsHealth: false,
      };

    case 'restingHeartRate':
      if (!data.healthConnected) return { value: '—', unit: 'bpm', needsHealth: true };
      return {
        value: data.heartRate !== null ? String(data.heartRate) : '—',
        unit: 'bpm resting',
        needsHealth: false,
      };

    case 'bodyWeight':
      return {
        value: data.bodyWeight !== null ? String(data.bodyWeight) : '—',
        unit: 'lbs',
        needsHealth: false,
      };

    default:
      return { value: '—', unit: '', needsHealth: false };
  }
}
