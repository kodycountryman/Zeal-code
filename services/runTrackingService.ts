import * as Location from 'expo-location';
import { Platform } from 'react-native';
import {
  RoutePoint,
  Split,
  RunUnits,
  ActiveRunState,
  GPS_ACCURACY_THRESHOLD_METERS,
  GPS_MIN_DISTANCE_METERS,
  METERS_PER_MILE,
  METERS_PER_KM,
} from '@/types/run';
import {
  RUN_TRACKING_TASK_NAME,
} from '@/services/runBackgroundTask';
import {
  drainBackgroundPoints,
  setBackgroundActive,
  clearBackgroundBuffer,
} from '@/services/runBackgroundBuffer';

// ─── Math Helpers ──────────────────────────────────────────────────────────

const EARTH_RADIUS_METERS = 6371000;

/**
 * Haversine formula — great-circle distance between two GPS points in meters.
 */
export function haversineDistanceMeters(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Convert pace from seconds-per-meter to seconds-per-mile.
 */
export function paceToSecondsPerMile(secondsPerMeter: number): number {
  return secondsPerMeter * METERS_PER_MILE;
}

/**
 * Convert pace from seconds-per-meter to seconds-per-km.
 */
export function paceToSecondsPerKm(secondsPerMeter: number): number {
  return secondsPerMeter * METERS_PER_KM;
}

/**
 * Format a pace value (seconds per unit) as "M:SS" string.
 * Returns "—:—" for invalid input.
 */
export function formatPace(totalSeconds: number): string {
  if (!isFinite(totalSeconds) || totalSeconds <= 0) return '—:—';
  const min = Math.floor(totalSeconds / 60);
  const sec = Math.round(totalSeconds % 60);
  return `${min}:${String(sec).padStart(2, '0')}`;
}

// ─── Route Simplification (Douglas-Peucker) ──────────────────────────────
// Reduces a dense GPS polyline to its essential shape by recursively
// dropping points that lie within `tolerance` meters of the line connecting
// their neighbors. Long runs can capture thousands of points; thinning to
// a few hundred preserves the visible shape while shrinking storage and
// rendering work by an order of magnitude.

/**
 * Perpendicular distance from point P to the line segment A→B (in meters).
 * Uses an equirectangular projection — accurate enough for ≤1km segments,
 * which is what the GPS sample spacing produces.
 */
function perpendicularDistanceMeters(
  pLat: number, pLon: number,
  aLat: number, aLon: number,
  bLat: number, bLon: number,
): number {
  // Project to local meters around point A using equirectangular approx
  const cosLat = Math.cos((aLat * Math.PI) / 180);
  const METERS_PER_DEG_LAT = 111320;
  const ax = 0;
  const ay = 0;
  const bx = (bLon - aLon) * METERS_PER_DEG_LAT * cosLat;
  const by = (bLat - aLat) * METERS_PER_DEG_LAT;
  const px = (pLon - aLon) * METERS_PER_DEG_LAT * cosLat;
  const py = (pLat - aLat) * METERS_PER_DEG_LAT;

  // Distance from P to line AB (line, not segment)
  const denomSq = (bx - ax) ** 2 + (by - ay) ** 2;
  if (denomSq === 0) {
    // A and B coincide — distance is just |PA|
    return Math.sqrt(px * px + py * py);
  }
  const numer = Math.abs((by - ay) * px - (bx - ax) * py);
  return numer / Math.sqrt(denomSq);
}

/**
 * Simplify a GPS polyline using the Douglas-Peucker algorithm.
 * Preserves any point whose perpendicular distance from the simplified
 * line exceeds `toleranceMeters`. Returns the simplified subset of input
 * points (always preserving first + last).
 *
 * Iterative implementation to avoid stack overflows on huge polylines.
 *
 * @param points     Input route polyline.
 * @param toleranceMeters  Larger = more aggressive thinning. 5m is a good
 *                          default for run routes (GPS noise is ~3-10m).
 */
export function simplifyRoute<T extends { latitude: number; longitude: number }>(
  points: T[],
  toleranceMeters = 5,
): T[] {
  const n = points.length;
  if (n < 3) return [...points];

  const keep = new Array<boolean>(n).fill(false);
  keep[0] = true;
  keep[n - 1] = true;

  // Iterative Douglas-Peucker using a stack of (start, end) index pairs
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    if (end <= start + 1) continue;

    let maxDist = 0;
    let maxIdx = -1;
    const a = points[start];
    const b = points[end];
    for (let i = start + 1; i < end; i++) {
      const p = points[i];
      const d = perpendicularDistanceMeters(
        p.latitude, p.longitude,
        a.latitude, a.longitude,
        b.latitude, b.longitude,
      );
      if (d > maxDist) {
        maxDist = d;
        maxIdx = i;
      }
    }

    if (maxDist > toleranceMeters && maxIdx > -1) {
      keep[maxIdx] = true;
      stack.push([start, maxIdx]);
      stack.push([maxIdx, end]);
    }
  }

  const result: T[] = [];
  for (let i = 0; i < n; i++) {
    if (keep[i]) result.push(points[i]);
  }
  return result;
}

// ─── Run Tracking Service ──────────────────────────────────────────────────

interface TrackingState {
  isWatching: boolean;
  watcher: Location.LocationSubscription | null;
  route: RoutePoint[];
  splits: Split[];
  splitUnit: RunUnits;
  /** Cumulative distance in meters since the last split was recorded. */
  distanceSinceLastSplit: number;
  /** Cumulative duration in seconds since the last split. */
  durationSinceLastSplit: number;
  /** Elevation accumulator since last split. */
  elevationSinceLastSplit: number;
  /** Total cumulative distance in meters across the entire run. */
  totalDistanceMeters: number;
  /** Total elevation gain in meters. */
  totalElevationGainMeters: number;
  /** Total elevation loss in meters. */
  totalElevationLossMeters: number;
  /** Last accepted GPS sample (used as reference for next-point distance calc). */
  lastAcceptedPoint: RoutePoint | null;
  /** Whether tracking is currently paused (route still preserved). */
  isPaused: boolean;
  listeners: Set<TrackingListener>;
}

export interface TrackingSnapshot {
  totalDistanceMeters: number;
  totalElevationGainMeters: number;
  totalElevationLossMeters: number;
  currentPaceSecondsPerMeter: number | null;     // instantaneous, last few points
  averagePaceSecondsPerMeter: number | null;     // total time / total distance
  splits: Split[];
  routePointCount: number;
  lastPoint: RoutePoint | null;
  isPaused: boolean;
  /** Tracking source for this session — 'gps' is the default, 'treadmill' for indoor runs */
  source?: 'gps' | 'treadmill';
  /** Current treadmill speed in m/s (treadmill mode only) */
  treadmillSpeedMps?: number;
  /** Current treadmill incline percent (treadmill mode only) */
  treadmillInclinePct?: number;
}

export type TrackingListener = (snapshot: TrackingSnapshot) => void;

interface StartTrackingOptions {
  preserveState?: boolean;
  preserveBackgroundBuffer?: boolean;
}

class RunTrackingService {
  private state: TrackingState = this._freshState('imperial');
  /** Run start timestamp (ms). Used to calculate average pace. */
  private runStartMs: number = 0;
  /** Total time spent paused (ms). Subtracted from elapsed when computing avg pace. */
  private accumulatedPausedMs: number = 0;
  /** Timestamp when current pause started, or 0 if not paused. */
  private pauseStartedMs: number = 0;

  // ─── Treadmill mode (no GPS — distance computed from user-entered speed) ──
  /** Active source for the current session — null when nothing is running. */
  private trackingSource: 'gps' | 'treadmill' | null = null;
  /** Current treadmill speed in m/s. Distance accumulates by speed × dt. */
  private treadmillSpeedMps: number = 0;
  /** Treadmill incline percent (display-only metadata, no calc effect). */
  private treadmillInclinePct: number = 0;
  /** ms timestamp of last treadmill timer tick — used to compute dt accurately. */
  private treadmillLastTickMs: number = 0;
  /** 1-second interval handle for the treadmill simulator. */
  private treadmillTimer: ReturnType<typeof setInterval> | null = null;

  private _freshState(splitUnit: RunUnits): TrackingState {
    return {
      isWatching: false,
      watcher: null,
      route: [],
      splits: [],
      splitUnit,
      distanceSinceLastSplit: 0,
      durationSinceLastSplit: 0,
      elevationSinceLastSplit: 0,
      totalDistanceMeters: 0,
      totalElevationGainMeters: 0,
      totalElevationLossMeters: 0,
      lastAcceptedPoint: null,
      isPaused: false,
      listeners: new Set(),
    };
  }

  // ─── Permission Management ───────────────────────────────────────────────

  async requestForegroundPermission(): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (e) {
      __DEV__ && console.log('[RunTracking] Permission request error:', e);
      return false;
    }
  }

  async hasForegroundPermission(): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  }

  /**
   * Request background location permission. On iOS this is the "Always" level;
   * on Android it requires an already-granted foreground permission.
   * Safe to call with no permission — returns false if denied.
   */
  async requestBackgroundPermission(): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    try {
      // Must have foreground permission first
      const fg = await this.requestForegroundPermission();
      if (!fg) return false;
      const { status } = await Location.requestBackgroundPermissionsAsync();
      return status === 'granted';
    } catch (e) {
      __DEV__ && console.log('[RunTracking] Background permission error:', e);
      return false;
    }
  }

  async hasBackgroundPermission(): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    try {
      const { status } = await Location.getBackgroundPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  }

  async getCurrentLocation(): Promise<Location.LocationObject | null> {
    if (Platform.OS === 'web') return null;
    try {
      return await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
    } catch (e) {
      __DEV__ && console.log('[RunTracking] getCurrentLocation error:', e);
      return null;
    }
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  /**
   * Begin a new tracking session. Starts the GPS watcher (foreground) and,
   * if background permission is granted, also registers the background
   * location task so tracking continues when the app is backgrounded.
   *
   * Resets all route/split/counter state on each call.
   */
  async startTracking(
    splitUnit: RunUnits = 'imperial',
    options: StartTrackingOptions = {},
  ): Promise<boolean> {
    if (this.state.isWatching) {
      __DEV__ && console.log('[RunTracking] startTracking called while already watching — ignoring');
      return true;
    }

    const granted = await this.requestForegroundPermission();
    if (!granted) {
      __DEV__ && console.log('[RunTracking] Foreground permission denied');
      return false;
    }

    // Critical for lock-screen runs: request "Always" background permission so
    // the background task can actually run when the screen locks. Without this,
    // _startBackgroundTask() silently bails and the user gets a straight-line
    // interpolation through any time the phone was locked. Non-fatal if the
    // user denies — the run still works foreground-only.
    const hasBg = await this.hasBackgroundPermission();
    if (!hasBg) {
      const grantedBg = await this.requestBackgroundPermission();
      __DEV__ && console.log('[RunTracking] Background permission requested:', grantedBg ? 'granted' : 'denied');
    }

    if (options.preserveState) {
      this.state.splitUnit = splitUnit;
      this.state.watcher = null;
      this.state.isWatching = false;
    } else {
      // Preserve existing listeners across resets so an external subscriber doesn't
      // need to re-register between runs.
      const preservedListeners = this.state.listeners;
      this.state = this._freshState(splitUnit);
      this.state.listeners = preservedListeners;
      this.runStartMs = Date.now();
      this.accumulatedPausedMs = 0;
      this.pauseStartedMs = 0;
    }
    // Fresh runs abandon orphaned points. Recovery keeps the buffer so it can
    // merge samples captured while the app was suspended or relaunched.
    if (!options.preserveBackgroundBuffer) {
      await clearBackgroundBuffer();
    }
    await setBackgroundActive(true);

    try {
      this.state.watcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 0,
        },
        (loc) => this._onLocation(loc),
      );
      this.state.isWatching = true;
      __DEV__ && console.log('[RunTracking] Started foreground GPS watcher');
    } catch (e) {
      __DEV__ && console.log('[RunTracking] watchPositionAsync error:', e);
      await setBackgroundActive(false);
      return false;
    }

    // Fire-and-forget background task registration — only runs if the user
    // granted background permission. A run still works fine without it,
    // the runner just has to keep the app foregrounded.
    this._startBackgroundTask().catch(() => { /* non-fatal */ });

    this.trackingSource = 'gps';
    return true;
  }

  // ─── Treadmill mode ──────────────────────────────────────────────────────

  /**
   * Begin a treadmill (indoor) tracking session. No GPS, no permissions —
   * distance accrues from a user-entered speed via a 1-second simulator tick.
   * The runner adjusts speed mid-run with `setTreadmillSpeed(...)`.
   *
   * Splits, pause/resume, elapsed time, and snapshot subscriptions all work
   * identically to GPS mode. Elevation is treated as flat (incline is metadata).
   */
  startTreadmillTracking(splitUnit: RunUnits = 'imperial', initialSpeedMps: number = 0): boolean {
    if (this.state.isWatching) {
      __DEV__ && console.log('[RunTracking] startTreadmillTracking called while already tracking — ignoring');
      return true;
    }

    const preservedListeners = this.state.listeners;
    this.state = this._freshState(splitUnit);
    this.state.listeners = preservedListeners;
    this.runStartMs = Date.now();
    this.accumulatedPausedMs = 0;
    this.pauseStartedMs = 0;

    this.trackingSource = 'treadmill';
    this.treadmillSpeedMps = Math.max(0, initialSpeedMps);
    this.treadmillInclinePct = 0;
    this.treadmillLastTickMs = Date.now();
    this.state.isWatching = true;

    // Fire the simulator at 1 Hz — distance accumulates by current speed × dt.
    // Listeners get a snapshot every tick so the UI updates smoothly.
    this.treadmillTimer = setInterval(() => this._onTreadmillTick(), 1000);
    __DEV__ && console.log('[RunTracking] Treadmill mode started @', this.treadmillSpeedMps, 'm/s');

    // Emit an initial snapshot so the UI shows zeroes immediately
    this._notify();
    return true;
  }

  /** Update the current treadmill speed (m/s). Distance accrual switches on the next tick. */
  setTreadmillSpeed(speedMps: number): void {
    if (this.trackingSource !== 'treadmill') return;
    this.treadmillSpeedMps = Math.max(0, speedMps);
  }

  /** Update the current treadmill incline (percent). Display-only; no calorie/elevation impact for now. */
  setTreadmillIncline(percent: number): void {
    if (this.trackingSource !== 'treadmill') return;
    this.treadmillInclinePct = Math.max(0, percent);
  }

  getTreadmillSpeed(): number {
    return this.treadmillSpeedMps;
  }

  getTreadmillIncline(): number {
    return this.treadmillInclinePct;
  }

  /** Tracking source for the active session — null when idle. */
  getSource(): 'gps' | 'treadmill' | null {
    return this.trackingSource;
  }

  /**
   * Internal tick — accrues distance from `speedMps × dt`, advances splits,
   * and emits a snapshot. No-op when paused or stopped.
   */
  private _onTreadmillTick(): void {
    if (!this.state.isWatching || this.trackingSource !== 'treadmill') return;
    const now = Date.now();
    const dtSec = Math.max(0, (now - this.treadmillLastTickMs) / 1000);
    this.treadmillLastTickMs = now;

    // While paused we still update the tick anchor (so resume doesn't fast-forward),
    // but we don't accrue distance.
    if (this.state.isPaused) {
      this._notify();
      return;
    }

    const speed = this.treadmillSpeedMps;
    if (speed > 0 && dtSec > 0) {
      const segmentMeters = speed * dtSec;
      this.state.totalDistanceMeters += segmentMeters;
      this.state.distanceSinceLastSplit += segmentMeters;
      this.state.durationSinceLastSplit += dtSec;
      this._checkAndRecordSplit();
    }
    this._notify();
  }

  /**
   * Start the background location task. This is what keeps GPS samples
   * flowing when the app is backgrounded or the screen is locked.
   * Silently bails if the background permission was not granted.
   */
  private async _startBackgroundTask(): Promise<void> {
    const hasBg = await this.hasBackgroundPermission();
    if (!hasBg) {
      __DEV__ && console.log('[RunTracking] Background permission missing — skipping task registration');
      return;
    }
    try {
      const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(RUN_TRACKING_TASK_NAME);
      if (alreadyRunning) {
        // Rare — leftover from a prior unclean shutdown. Stop then restart.
        await Location.stopLocationUpdatesAsync(RUN_TRACKING_TASK_NAME);
      }
      await Location.startLocationUpdatesAsync(RUN_TRACKING_TASK_NAME, {
        accuracy: Location.Accuracy.BestForNavigation,
        // iOS will ignore these and use its own activity-based batching —
        // Android uses them literally.
        timeInterval: 5000,
        distanceInterval: 5,
        showsBackgroundLocationIndicator: true,
        pausesUpdatesAutomatically: false,
        activityType: Location.ActivityType.Fitness,
        foregroundService: Platform.OS === 'android' ? {
          notificationTitle: 'Zeal+ is tracking your run',
          notificationBody: 'Tap to return to your run',
          notificationColor: '#f87116',
        } : undefined,
      });
      __DEV__ && console.log('[RunTracking] Background task registered');
    } catch (e) {
      __DEV__ && console.log('[RunTracking] Background task start error:', e);
    }
  }

  /**
   * Stop tracking and tear down the GPS watcher + background task. State is
   * preserved in memory until `reset()` is called.
   */
  async stopTracking(): Promise<void> {
    // Stop the treadmill simulator if it's the active source
    if (this.treadmillTimer) {
      clearInterval(this.treadmillTimer);
      this.treadmillTimer = null;
    }

    if (this.state.watcher) {
      try {
        this.state.watcher.remove();
      } catch (e) {
        __DEV__ && console.log('[RunTracking] watcher.remove error:', e);
      }
      this.state.watcher = null;
    }
    this.state.isWatching = false;

    // Stop the background task only if GPS was the source (no-op for treadmill)
    if (this.trackingSource === 'gps') {
      try {
        const running = await Location.hasStartedLocationUpdatesAsync(RUN_TRACKING_TASK_NAME);
        if (running) {
          await Location.stopLocationUpdatesAsync(RUN_TRACKING_TASK_NAME);
          __DEV__ && console.log('[RunTracking] Background task stopped');
        }
      } catch (e) {
        __DEV__ && console.log('[RunTracking] Failed to stop background task:', e);
      }
      await setBackgroundActive(false);
    }

    // If currently paused, finalize the pause time so totals are accurate
    if (this.pauseStartedMs > 0) {
      this.accumulatedPausedMs += Date.now() - this.pauseStartedMs;
      this.pauseStartedMs = 0;
    }
    __DEV__ && console.log('[RunTracking] Stopped tracking (source =', this.trackingSource, ')');
  }

  /**
   * Drain any points captured by the background task while the app was
   * suspended and merge them into the live route. Call this when the app
   * returns to the foreground during an active run.
   *
   * Points are processed through the same filtering/split logic as live
   * points so distances and splits stay consistent.
   */
  async drainBackgroundBuffer(): Promise<number> {
    const points = await drainBackgroundPoints();
    if (points.length === 0) return 0;
    // Sort defensively by timestamp — the task may have batched points out
    // of order on some devices.
    points.sort((a, b) => a.timestamp - b.timestamp);

    // Determine if any buffered points predate the most recent foreground
    // point. If so, the foreground watcher already wrote a "post-unlock"
    // point to the route while we were suspended, and naively replaying the
    // older buffered points through _onLocation would compute distances
    // against the wrong reference (the post-unlock point), corrupting totals.
    //
    // Strategy: walk the buffered points and either insert each one in the
    // correct chronological position (rebuilding distance/elevation totals
    // around it) or, if it's strictly newer than every existing point, push
    // it through the normal _onLocation pipeline.
    const lastRouteTs = this.state.route.length > 0
      ? this.state.route[this.state.route.length - 1].timestamp
      : 0;

    let merged = 0;
    const newest = points.filter((p) => p.timestamp > lastRouteTs);
    const older = points.filter((p) => p.timestamp <= lastRouteTs);

    if (older.length > 0) {
      // Rebuild from scratch: combine existing route + older buffered points,
      // sort by timestamp, recompute totals. This is more expensive but
      // guarantees correctness when the foreground watcher beat the drain.
      const combined: RoutePoint[] = [
        ...this.state.route,
        ...older.map((p) => ({
          latitude: p.latitude,
          longitude: p.longitude,
          altitude: p.altitude,
          timestamp: p.timestamp,
          accuracy: p.accuracy,
          speed: p.speed,
          pace: null,
        })),
      ];
      combined.sort((a, b) => a.timestamp - b.timestamp);

      // Filter low-accuracy points to match the live filter
      const accepted = combined.filter(
        (p) => (p.accuracy ?? Infinity) <= GPS_ACCURACY_THRESHOLD_METERS,
      );

      // Reset accumulators and rebuild
      this.state.route = [];
      this.state.totalDistanceMeters = 0;
      this.state.totalElevationGainMeters = 0;
      this.state.totalElevationLossMeters = 0;
      this.state.distanceSinceLastSplit = 0;
      this.state.durationSinceLastSplit = 0;
      this.state.elevationSinceLastSplit = 0;
      this.state.splits = [];
      this.state.lastAcceptedPoint = null;

      for (const p of accepted) {
        this._onLocation({
          coords: {
            latitude: p.latitude,
            longitude: p.longitude,
            altitude: p.altitude,
            accuracy: p.accuracy,
            altitudeAccuracy: null,
            heading: null,
            speed: p.speed,
          },
          timestamp: p.timestamp,
        } as Location.LocationObject);
      }
      merged += older.length;
    }

    // Newest buffered points (those after the last route point) can flow
    // through _onLocation normally — their reference is correct.
    for (const p of newest) {
      this._onLocation({
        coords: {
          latitude: p.latitude,
          longitude: p.longitude,
          altitude: p.altitude,
          accuracy: p.accuracy,
          altitudeAccuracy: null,
          heading: null,
          speed: p.speed,
        },
        timestamp: p.timestamp,
      } as Location.LocationObject);
      merged++;
    }

    __DEV__ && console.log(`[RunTracking] Drained ${points.length} background point(s) (${older.length} merged in-order, ${newest.length} appended)`);
    return merged;
  }

  /**
   * Restore in-memory tracking state from a persisted ActiveRunState (crash
   * recovery). After calling this, the caller should also call
   * `startTracking()` to resume live GPS capture.
   *
   * Listeners are preserved; route/splits/counters are rebuilt from the
   * persisted data so accumulated distance is correct.
   */
  restoreState(active: ActiveRunState, startTimeMs: number): void {
    const preservedListeners = this.state.listeners;
    this.state = this._freshState(active.splitUnit);
    this.state.listeners = preservedListeners;
    this.state.route = [...active.route];
    this.state.splits = [...active.splits];
    this.state.isPaused = active.status === 'paused';

    // Recompute cumulative distance/elevation from the route
    for (let i = 1; i < this.state.route.length; i++) {
      const a = this.state.route[i - 1];
      const b = this.state.route[i];
      const d = haversineDistanceMeters(a.latitude, a.longitude, b.latitude, b.longitude);
      this.state.totalDistanceMeters += d;
      const elev = (a.altitude !== null && b.altitude !== null) ? b.altitude - a.altitude : 0;
      if (elev > 0) this.state.totalElevationGainMeters += elev;
      else if (elev < 0) this.state.totalElevationLossMeters += -elev;
    }
    // Work out how much distance sits past the last recorded split boundary
    const splitTarget = active.splitUnit === 'imperial' ? METERS_PER_MILE : METERS_PER_KM;
    const completedSplitDistance = this.state.splits.length * splitTarget;
    this.state.distanceSinceLastSplit = Math.max(0, this.state.totalDistanceMeters - completedSplitDistance);

    this.state.lastAcceptedPoint = this.state.route.length > 0
      ? this.state.route[this.state.route.length - 1]
      : null;

    this.runStartMs = startTimeMs;
    this.accumulatedPausedMs = active.pausedSeconds * 1000;
    this.pauseStartedMs = active.status === 'paused' && active.pauseStartedAt
      ? active.pauseStartedAt
      : 0;
    __DEV__ && console.log('[RunTracking] Restored state:', this.state.route.length, 'points,', this.state.splits.length, 'splits');
  }

  /**
   * Pause tracking — incoming GPS updates are ignored, but the route and
   * accumulated distance/splits are preserved. Distance accumulation resumes
   * on `resumeTracking()`.
   */
  pauseTracking(): void {
    if (this.state.isPaused) return;
    this.state.isPaused = true;
    this.pauseStartedMs = Date.now();
    __DEV__ && console.log('[RunTracking] Paused');
  }

  resumeTracking(): void {
    if (!this.state.isPaused) return;
    this.state.isPaused = false;
    if (this.pauseStartedMs > 0) {
      this.accumulatedPausedMs += Date.now() - this.pauseStartedMs;
      this.pauseStartedMs = 0;
    }
    // Reset lastAcceptedPoint so we don't compute a huge phantom distance from
    // wherever the runner was when they paused to wherever they restart.
    this.state.lastAcceptedPoint = null;
    // Treadmill: re-anchor the tick clock so the first post-resume tick doesn't
    // accrue distance for the entire pause window.
    if (this.trackingSource === 'treadmill') {
      this.treadmillLastTickMs = Date.now();
    }
    __DEV__ && console.log('[RunTracking] Resumed');
  }

  /**
   * Clear all tracking state. Call after a run is fully saved or discarded.
   */
  reset(): void {
    if (this.treadmillTimer) {
      clearInterval(this.treadmillTimer);
      this.treadmillTimer = null;
    }
    const preservedListeners = this.state.listeners;
    this.state = this._freshState(this.state.splitUnit);
    this.state.listeners = preservedListeners;
    this.runStartMs = 0;
    this.accumulatedPausedMs = 0;
    this.pauseStartedMs = 0;
    this.trackingSource = null;
    this.treadmillSpeedMps = 0;
    this.treadmillInclinePct = 0;
    this.treadmillLastTickMs = 0;
  }

  // ─── Location Handler ────────────────────────────────────────────────────

  private _onLocation(loc: Location.LocationObject) {
    if (this.state.isPaused) return;

    const accuracy = loc.coords.accuracy ?? Infinity;
    if (accuracy > GPS_ACCURACY_THRESHOLD_METERS) {
      // Discard low-accuracy points — common in tunnels, indoors, GPS warmup.
      return;
    }

    const point: RoutePoint = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      altitude: loc.coords.altitude ?? null,
      timestamp: loc.timestamp,
      accuracy: loc.coords.accuracy ?? null,
      speed: loc.coords.speed ?? null,
      pace: null,
    };

    const last = this.state.lastAcceptedPoint;
    if (last === null) {
      // First accepted point of the run/segment — establish baseline.
      this.state.lastAcceptedPoint = point;
      this.state.route.push(point);
      this._notify();
      return;
    }

    const segmentDistance = haversineDistanceMeters(
      last.latitude, last.longitude,
      point.latitude, point.longitude,
    );

    if (segmentDistance < GPS_MIN_DISTANCE_METERS) {
      // Too close — likely jitter, skip.
      return;
    }

    const segmentDurationSec = (point.timestamp - last.timestamp) / 1000;
    if (segmentDurationSec <= 0) return;

    const segmentPace = segmentDurationSec / segmentDistance; // sec/m
    point.pace = segmentPace;

    // Elevation delta
    const elevDelta = (point.altitude !== null && last.altitude !== null)
      ? point.altitude - last.altitude
      : 0;
    if (elevDelta > 0) {
      this.state.totalElevationGainMeters += elevDelta;
      this.state.elevationSinceLastSplit += elevDelta;
    } else if (elevDelta < 0) {
      this.state.totalElevationLossMeters += -elevDelta;
    }

    this.state.totalDistanceMeters += segmentDistance;
    this.state.distanceSinceLastSplit += segmentDistance;
    this.state.durationSinceLastSplit += segmentDurationSec;

    this.state.route.push(point);
    this.state.lastAcceptedPoint = point;

    // Check if we just crossed a split boundary
    this._checkAndRecordSplit();

    // ── Long-run safety: cap in-memory route size ─────────────────────
    // A typical run captures one point every ~5 seconds. A 6-hour ultra
    // would accumulate 4,300+ points; left unchecked, this slows down the
    // map polyline render and grows AsyncStorage on every persist tick.
    // Simplify in-place once we exceed the cap, preserving the most recent
    // 200 points exactly so live splits + current-pace math stay accurate.
    const ROUTE_SOFT_CAP = 2000;
    const PRESERVE_RECENT = 200;
    if (this.state.route.length > ROUTE_SOFT_CAP) {
      const headLength = this.state.route.length - PRESERVE_RECENT;
      const head = this.state.route.slice(0, headLength);
      const tail = this.state.route.slice(headLength);
      const simplifiedHead = simplifyRoute(head, 8);
      this.state.route = [...simplifiedHead, ...tail];
      __DEV__ && console.log(`[RunTracking] In-memory thinning: ${head.length} → ${simplifiedHead.length} head points (preserved ${tail.length} recent)`);
    }

    this._notify();
  }

  private _splitDistanceMeters(): number {
    return this.state.splitUnit === 'imperial' ? METERS_PER_MILE : METERS_PER_KM;
  }

  private _checkAndRecordSplit(): void {
    const splitTarget = this._splitDistanceMeters();
    while (this.state.distanceSinceLastSplit >= splitTarget) {
      const split: Split = {
        index: this.state.splits.length + 1,
        unit: this.state.splitUnit,
        distanceMeters: splitTarget,
        durationSeconds: this.state.durationSinceLastSplit * (splitTarget / this.state.distanceSinceLastSplit),
        paceSecondsPerMeter: this.state.durationSinceLastSplit / this.state.distanceSinceLastSplit,
        elevationChangeMeters: this.state.elevationSinceLastSplit,
        averageHeartRate: null,
      };
      this.state.splits.push(split);

      // Carry over leftover distance/duration to the next split bucket
      const overflowRatio = (this.state.distanceSinceLastSplit - splitTarget) / this.state.distanceSinceLastSplit;
      this.state.distanceSinceLastSplit = this.state.distanceSinceLastSplit - splitTarget;
      this.state.durationSinceLastSplit = this.state.durationSinceLastSplit * overflowRatio;
      this.state.elevationSinceLastSplit = 0;
    }
  }

  // ─── Snapshots & Subscriptions ───────────────────────────────────────────

  /**
   * Get the current tracking state as a snapshot. Safe to call frequently.
   */
  getSnapshot(): TrackingSnapshot {
    return {
      totalDistanceMeters: this.state.totalDistanceMeters,
      totalElevationGainMeters: this.state.totalElevationGainMeters,
      totalElevationLossMeters: this.state.totalElevationLossMeters,
      currentPaceSecondsPerMeter: this._currentPace(),
      averagePaceSecondsPerMeter: this._averagePace(),
      splits: [...this.state.splits],
      routePointCount: this.state.route.length,
      lastPoint: this.state.lastAcceptedPoint,
      isPaused: this.state.isPaused,
      source: this.trackingSource ?? undefined,
      treadmillSpeedMps: this.trackingSource === 'treadmill' ? this.treadmillSpeedMps : undefined,
      treadmillInclinePct: this.trackingSource === 'treadmill' ? this.treadmillInclinePct : undefined,
    };
  }

  /**
   * Get the accumulated route (array of GPS points). Returned as a copy.
   */
  getRoute(): RoutePoint[] {
    return [...this.state.route];
  }

  /**
   * Get the splits recorded so far.
   */
  getSplits(): Split[] {
    return [...this.state.splits];
  }

  /**
   * Total elapsed seconds excluding paused time.
   */
  getElapsedSeconds(): number {
    if (this.runStartMs === 0) return 0;
    const now = Date.now();
    let pausedMs = this.accumulatedPausedMs;
    if (this.state.isPaused && this.pauseStartedMs > 0) {
      pausedMs += now - this.pauseStartedMs;
    }
    return Math.max(0, (now - this.runStartMs - pausedMs) / 1000);
  }

  /**
   * Total paused seconds across the run.
   */
  getPausedSeconds(): number {
    let pausedMs = this.accumulatedPausedMs;
    if (this.state.isPaused && this.pauseStartedMs > 0) {
      pausedMs += Date.now() - this.pauseStartedMs;
    }
    return pausedMs / 1000;
  }

  /**
   * Calculate instantaneous pace from the last ~10 seconds of route data.
   * Returns null if not enough data. Treadmill mode derives pace directly
   * from the user-entered speed, since there's no GPS to sample.
   */
  private _currentPace(): number | null {
    if (this.trackingSource === 'treadmill') {
      // Pace = 1 / speed, in seconds per meter. Zero-speed → null pace.
      return this.treadmillSpeedMps > 0 ? 1 / this.treadmillSpeedMps : null;
    }
    const route = this.state.route;
    if (route.length < 2) return null;
    const last = route[route.length - 1];
    const cutoffMs = last.timestamp - 10000; // 10-second window
    let distSum = 0;
    let timeSum = 0;
    for (let i = route.length - 1; i > 0; i--) {
      const a = route[i - 1];
      const b = route[i];
      if (a.timestamp < cutoffMs) break;
      distSum += haversineDistanceMeters(a.latitude, a.longitude, b.latitude, b.longitude);
      timeSum += (b.timestamp - a.timestamp) / 1000;
    }
    if (distSum < 5 || timeSum <= 0) return null;
    return timeSum / distSum;
  }

  /**
   * Average pace across the entire run (excluding paused time).
   */
  private _averagePace(): number | null {
    if (this.state.totalDistanceMeters < 10) return null;
    const elapsedSec = this.getElapsedSeconds();
    if (elapsedSec <= 0) return null;
    return elapsedSec / this.state.totalDistanceMeters;
  }

  /**
   * Subscribe to tracking updates. Returns unsubscribe function.
   * The listener fires after every accepted GPS point.
   */
  subscribe(listener: TrackingListener): () => void {
    this.state.listeners.add(listener);
    return () => {
      this.state.listeners.delete(listener);
    };
  }

  private _notify() {
    if (this.state.listeners.size === 0) return;
    const snap = this.getSnapshot();
    for (const fn of this.state.listeners) {
      try {
        fn(snap);
      } catch (e) {
        __DEV__ && console.log('[RunTracking] listener error:', e);
      }
    }
  }

  // ─── Status ──────────────────────────────────────────────────────────────

  isTracking(): boolean {
    return this.state.isWatching || this.trackingSource === 'treadmill';
  }

  isPaused(): boolean {
    return this.state.isPaused;
  }
}

export const runTrackingService = new RunTrackingService();
