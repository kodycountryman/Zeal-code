/**
 * Run Mode — core data model
 *
 * All distances are stored in METERS internally for math precision.
 * Display formatting (mi/km) happens at the UI layer based on user preference.
 * All times/durations are stored in SECONDS internally.
 */

// ─── Run Types ─────────────────────────────────────────────────────────────

export type RunType =
  | 'easy'         // conversational pace, base building
  | 'tempo'        // sustained hard effort
  | 'interval'     // structured fast/recovery repeats
  | 'long_run'     // weekly long aerobic effort
  | 'race'         // race-day or time trial
  | 'fartlek'      // unstructured speed play
  | 'recovery'     // very easy effort, post-hard-day
  | 'hill_repeats' // hill-focused intervals
  | 'progression'  // negative-split / pace decreasing
  | 'free';        // no specific structure (default)

export type RunStatus = 'idle' | 'warming_up' | 'running' | 'paused' | 'completed';

export type RunUnits = 'imperial' | 'metric';

// ─── GPS Route ─────────────────────────────────────────────────────────────

/**
 * A single GPS sample collected during the run.
 * `pace` is the instantaneous pace in seconds per meter at the time of the sample
 * (computed from the previous point). null for the first point.
 */
export interface RoutePoint {
  latitude: number;
  longitude: number;
  altitude: number | null;     // meters above sea level (may be null if GPS doesn't provide)
  timestamp: number;            // ms since epoch
  accuracy: number | null;      // meters of horizontal accuracy from GPS
  speed: number | null;         // m/s instantaneous from GPS (preferred over pace calc when available)
  pace: number | null;          // seconds per meter, computed
}

// ─── Splits ────────────────────────────────────────────────────────────────

/**
 * One mile or one kilometer split, auto-recorded as the runner crosses each boundary.
 */
export interface Split {
  index: number;                // 1-based split number
  unit: RunUnits;               // mile or km
  distanceMeters: number;       // distance covered in this split (~1609m for mile, 1000m for km)
  durationSeconds: number;      // time taken to cover this split
  paceSecondsPerMeter: number;  // average pace for this split
  elevationChangeMeters: number; // net elevation gain (negative for descents)
  averageHeartRate: number | null; // bpm, if available
}

// ─── Run Log ───────────────────────────────────────────────────────────────

/**
 * The complete log of a finished run. Persisted to AsyncStorage and optionally
 * synced to Apple Health / Health Connect.
 */
export interface RunLog {
  // Identity
  id: string;                    // unique id (timestamp + random)
  date: string;                  // YYYY-MM-DD (local time)
  startTime: string;             // ISO timestamp
  endTime: string;               // ISO timestamp

  // Core metrics
  durationSeconds: number;       // total elapsed (excludes paused time)
  pausedSeconds: number;         // total time spent paused
  distanceMeters: number;        // total distance covered
  averagePaceSecondsPerMeter: number;
  bestPaceSecondsPerMeter: number;  // fastest single split or instantaneous segment
  elevationGainMeters: number;
  elevationLossMeters: number;

  // GPS
  route: RoutePoint[];           // simplified polyline (Douglas-Peucker can reduce later)

  // Splits
  splits: Split[];
  splitUnit: RunUnits;           // whether splits were recorded in mi or km

  // Health
  calories: number | null;
  averageHeartRate: number | null;
  maxHeartRate: number | null;

  // Run metadata
  runType: RunType;
  source: 'gps' | 'treadmill' | 'manual';

  // Subjective
  rating: number | null;         // 1-5 stars
  feelingLevel: number | null;   // 1-5 RPE-style "how did it feel" emoji
  notes: string;

  // Plan linkage
  planDayId?: string;            // links back to plan DayPrescription if completed as part of a plan
  planId?: string;               // links to active plan id

  // Future
  weather?: { tempF: number; condition: string };
  isManualLog?: boolean;
}

// ─── Active Run State ──────────────────────────────────────────────────────

/**
 * State of a currently in-progress run. Persisted to AsyncStorage every 30s
 * for crash recovery.
 */
export interface ActiveRunState {
  id: string;
  startTime: string;             // ISO
  status: RunStatus;
  route: RoutePoint[];
  splits: Split[];
  splitUnit: RunUnits;
  pausedSeconds: number;
  // Track when the latest pause began (null if not currently paused)
  pauseStartedAt: number | null;
  runType: RunType;
  source: 'gps' | 'treadmill';
  planDayId?: string;
  planId?: string;
}

// ─── Run PRs ───────────────────────────────────────────────────────────────

export type RunPRType =
  | 'fastest_mile'
  | 'fastest_5k'
  | 'fastest_10k'
  | 'fastest_half_marathon'
  | 'fastest_marathon'
  | 'longest_distance'
  | 'longest_duration'
  | 'highest_elevation_gain';

export interface RunPR {
  type: RunPRType;
  value: number;                 // for fastest_*, this is durationSeconds; for longest_*, distanceMeters or seconds
  unit: 'seconds' | 'meters';
  runId: string;                 // run that set this PR
  date: string;                  // YYYY-MM-DD
}

// ─── Run Preferences ───────────────────────────────────────────────────────

export interface RunPreferences {
  units: RunUnits;
  /** Default starting source — 'outdoor' uses GPS, 'treadmill' uses the indoor
   * speed-driven simulator. Editable from RunSettingsDrawer; the pre-run UI
   * reads this to decide how to launch. */
  sourceMode: 'outdoor' | 'treadmill';
  autoPauseEnabled: boolean;
  autoPauseSpeedThresholdMps: number; // default 0.67 m/s (~1.5 mph)
  audioCuesEnabled: boolean;
  audioCueSplits: boolean;
  audioCuePace: boolean;
  audioCueHeartRate: boolean;
  keepScreenAwake: boolean;
  weeklyMileageGoalMeters: number | null;
  maxHeartRateOverride: number | null; // null = use 220-age formula
  privacyMaskRouteEdges: boolean;       // mask first/last 200m on shared maps
  // ── Notifications ────────────────────────────────────────────────────────
  /** Daily streak-protection nudge — fires only when no run has been logged today */
  streakReminderEnabled: boolean;
  /** Hour (0-23) for the daily streak reminder, local time */
  streakReminderHour: number;
  /** Minute (0-59) for the daily streak reminder, local time */
  streakReminderMinute: number;
  /** Hour (0-23) for plan-day run reminders (when no explicit time on the prescription) */
  defaultPlanReminderHour: number;
  /** Minute (0-59) for plan-day run reminders */
  defaultPlanReminderMinute: number;
}

export const DEFAULT_RUN_PREFERENCES: RunPreferences = {
  units: 'imperial',
  sourceMode: 'outdoor',
  autoPauseEnabled: true,
  autoPauseSpeedThresholdMps: 0.67,
  audioCuesEnabled: true,
  audioCueSplits: true,
  audioCuePace: false,
  audioCueHeartRate: false,
  keepScreenAwake: true,
  weeklyMileageGoalMeters: null,
  maxHeartRateOverride: null,
  privacyMaskRouteEdges: false,
  streakReminderEnabled: true,
  streakReminderHour: 19, // 7 PM default
  streakReminderMinute: 3,
  defaultPlanReminderHour: 9, // 9 AM default
  defaultPlanReminderMinute: 3,
};

// ─── Storage Keys ──────────────────────────────────────────────────────────

export const RUN_HISTORY_KEY = '@zeal_run_history_v1';
export const RUN_PR_HISTORY_KEY = '@zeal_run_pr_history_v1';
export const RUN_PREFERENCES_KEY = '@zeal_run_preferences_v1';
export const ACTIVE_RUN_KEY = '@zeal_active_run_v1';

// ─── Constants ─────────────────────────────────────────────────────────────

export const METERS_PER_MILE = 1609.344;
export const METERS_PER_KM = 1000;

/** GPS accuracy threshold — discard points worse than this (meters). */
export const GPS_ACCURACY_THRESHOLD_METERS = 30;

/** Minimum distance between accepted GPS points (meters). Prevents jitter accumulation. */
export const GPS_MIN_DISTANCE_METERS = 3;
