import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { startActivity, updateActivity, endActivity } from '@/modules/zeal-live-activity/src';
import {
  RunLog,
  RunPR,
  RunPreferences,
  RunStatus,
  RunType,
  ActiveRunState,
  RUN_HISTORY_KEY,
  RUN_PR_HISTORY_KEY,
  RUN_PREFERENCES_KEY,
  ACTIVE_RUN_KEY,
  DEFAULT_RUN_PREFERENCES,
} from '@/types/run';
import { runTrackingService, TrackingSnapshot, simplifyRoute } from '@/services/runTrackingService';
import { healthService } from '@/services/healthService';
import { detectNewPRs, mergePRs, prTypeLabel } from '@/services/runPRService';
import { detectNewlyEarnedRunBadges, type RunBadge } from '@/services/runBadges';
import { runAudioService } from '@/services/runAudioService';
import { intervalEngine, type IntervalSnapshot, type IntervalSegment } from '@/services/intervalEngine';
import * as Haptics from 'expo-haptics';
import type { DayPrescription } from '@/services/planEngine';
import { useAppContext } from '@/context/AppContext';
import { clearBackgroundBuffer, setBackgroundActive } from '@/services/runBackgroundBuffer';
import {
  presentRunMilestoneNotification,
  scheduleRunReminder,
  scheduleRunPreReminder,
  cancelRunReminders,
  scheduleRunStreakReminder,
  cancelRunStreakReminder,
} from '@/services/notificationService';
import { computeRunTrainingScore } from '@/services/runScoreService';

// ─── Helpers ───────────────────────────────────────────────────────────────

// Format distance for Live Activity label
function fmtDistance(meters: number, units: string): string {
  if (units === 'metric') {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${(meters / 1609.344).toFixed(2)} mi`;
}

// Format pace (sec/meter) for Live Activity label
function fmtPace(secPerMeter: number, units: string): string {
  if (!secPerMeter || !isFinite(secPerMeter)) return '--:--';
  const secPerUnit = units === 'metric' ? secPerMeter * 1000 : secPerMeter * 1609.344;
  const mins = Math.floor(secPerUnit / 60);
  const secs = Math.round(secPerUnit % 60);
  const suffix = units === 'metric' ? '/km' : '/mi';
  return `${mins}:${String(secs).padStart(2, '0')}${suffix}`;
}

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Format the local date for an ISO timestamp. Used to anchor RunLog.date to
 * the day the run STARTED, not when it was saved — important for runs that
 * cross midnight (e.g., late-night marathon training, ultra runs).
 */
function dateStrFromISO(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Format seconds as H:MM:SS or MM:SS for milestone notification bodies. */
function formatDurationForNotification(totalSeconds: number): string {
  if (!isFinite(totalSeconds) || totalSeconds <= 0) return '—';
  const hrs = Math.floor(totalSeconds / 3600);
  const min = Math.floor((totalSeconds % 3600) / 60);
  const sec = Math.round(totalSeconds % 60);
  if (hrs > 0) return `${hrs}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

/**
 * Compute the current daily run streak from history (descending by date).
 * A streak is consecutive days ending today (or yesterday — today counts as
 * "streak-active") with at least one run logged.
 */
function computeRunStreak(history: RunLog[]): number {
  if (history.length === 0) return 0;
  const dates = new Set(history.map(r => r.date));
  const today = getTodayStr();
  const [y, m, d] = today.split('-').map(Number);
  // Walk backwards from today until we find a gap. If today has no run,
  // start from yesterday (so the streak is still "alive" until 11:59 pm).
  let cursor = new Date(y, m - 1, d);
  if (!dates.has(today)) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (true) {
    const str = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    if (!dates.has(str)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function generateRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Minimal calorie estimate for a run.
 * Formula: MET × bodyweight_kg × hours
 * Running MET varies with pace; we use a coarse mapping.
 */
function estimateRunCalories(distanceMeters: number, durationSeconds: number, bodyweightKg: number): number {
  if (durationSeconds <= 0 || bodyweightKg <= 0) return 0;
  const hours = durationSeconds / 3600;
  const speedMps = distanceMeters / durationSeconds;
  const speedMph = speedMps * 2.23694;
  // Rough METs by speed: <4mph walk(3.5), 4-5mph jog(6), 5-6mph(8), 6-7mph(10), 7-8mph(11.5), 8+mph(12.8)
  let met = 8; // default jog
  if (speedMph < 4) met = 3.5;
  else if (speedMph < 5) met = 6;
  else if (speedMph < 6) met = 8;
  else if (speedMph < 7) met = 10;
  else if (speedMph < 8) met = 11.5;
  else met = 12.8;
  return Math.round(met * bodyweightKg * hours);
}

// ─── Persistence ───────────────────────────────────────────────────────────

async function persistRunHistory(history: RunLog[]) {
  try {
    await AsyncStorage.setItem(RUN_HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    __DEV__ && console.warn('[RunContext] Failed to persist history:', e);
  }
}

async function persistPRs(prs: RunPR[]) {
  try {
    await AsyncStorage.setItem(RUN_PR_HISTORY_KEY, JSON.stringify(prs));
  } catch (e) {
    __DEV__ && console.warn('[RunContext] Failed to persist PRs:', e);
  }
}

async function persistPreferences(prefs: RunPreferences) {
  try {
    await AsyncStorage.setItem(RUN_PREFERENCES_KEY, JSON.stringify(prefs));
  } catch (e) {
    __DEV__ && console.warn('[RunContext] Failed to persist preferences:', e);
  }
}

async function persistActiveRun(active: ActiveRunState | null) {
  try {
    if (active) {
      await AsyncStorage.setItem(ACTIVE_RUN_KEY, JSON.stringify(active));
    } else {
      await AsyncStorage.removeItem(ACTIVE_RUN_KEY);
    }
  } catch (e) {
    __DEV__ && console.warn('[RunContext] Failed to persist active run:', e);
  }
}

// ─── Auto-Pause Detection ──────────────────────────────────────────────────

/**
 * Tracks consecutive low-speed samples. If speed stays below threshold for
 * `requiredSeconds`, returns true (caller should auto-pause).
 */
class AutoPauseDetector {
  private lowSpeedStartedAt: number | null = null;
  private requiredMs = 10000; // 10 seconds below threshold to trigger
  private thresholdMps: number;

  constructor(thresholdMps: number) {
    this.thresholdMps = thresholdMps;
  }

  setThreshold(thresholdMps: number) {
    this.thresholdMps = thresholdMps;
  }

  /** Returns true if auto-pause should fire on this sample. */
  evaluate(snapshot: TrackingSnapshot): boolean {
    const last = snapshot.lastPoint;
    if (!last) return false;
    const speed = last.speed ?? (snapshot.currentPaceSecondsPerMeter
      ? 1 / snapshot.currentPaceSecondsPerMeter
      : null);
    if (speed === null) return false;

    const now = Date.now();
    if (speed < this.thresholdMps) {
      if (this.lowSpeedStartedAt === null) {
        this.lowSpeedStartedAt = now;
        return false;
      }
      return now - this.lowSpeedStartedAt >= this.requiredMs;
    } else {
      this.lowSpeedStartedAt = null;
      return false;
    }
  }

  reset() {
    this.lowSpeedStartedAt = null;
  }
}

// ─── Context ───────────────────────────────────────────────────────────────

export const [RunProvider, useRun] = createContextHook(() => {
  const app = useAppContext();

  // ─── Loaded state ──────────────────────────────────────────────────────
  const [loaded, setLoaded] = useState(false);

  // ─── Persistent state ──────────────────────────────────────────────────
  const [runHistory, setRunHistory] = useState<RunLog[]>([]);
  const [runPRs, setRunPRs] = useState<RunPR[]>([]);
  const [preferences, setPreferences] = useState<RunPreferences>(DEFAULT_RUN_PREFERENCES);

  // ─── Active run state ──────────────────────────────────────────────────
  const [status, setStatus] = useState<RunStatus>('idle');
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [activeRunStartTime, setActiveRunStartTime] = useState<string | null>(null);
  const [activeRunType, setActiveRunType] = useState<RunType>('free');
  const [activePlanDayId, setActivePlanDayId] = useState<string | undefined>(undefined);
  const [activePlanId, setActivePlanId] = useState<string | undefined>(undefined);

  // ─── Live metrics (from runTrackingService snapshots) ──────────────────
  const [snapshot, setSnapshot] = useState<TrackingSnapshot | null>(null);
  /** Refresh tick — bumped every second while running so duration UI updates. */
  const [tick, setTick] = useState(0);

  // ─── Last-saved run (for post-run summary) ─────────────────────────────
  const [lastSavedRun, setLastSavedRun] = useState<RunLog | null>(null);
  const [lastNewPRs, setLastNewPRs] = useState<RunPR[]>([]);
  const [lastNewBadges, setLastNewBadges] = useState<RunBadge[]>([]);
  const [intervalSnapshot, setIntervalSnapshot] = useState<IntervalSnapshot | null>(null);

  // ─── Refs for stable references ────────────────────────────────────────
  const autoPauseDetectorRef = useRef(new AutoPauseDetector(DEFAULT_RUN_PREFERENCES.autoPauseSpeedThresholdMps));
  const persistTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoPauseTriggeredRef = useRef(false);
  /** Last split index we spoke aloud — prevents re-speaking the same split. */
  const lastSpokenSplitRef = useRef<number>(0);
  /** Whether we've spoken the halfway cue this run (only fires once). */
  const halfwayAnnouncedRef = useRef<boolean>(false);
  /** Target distance in meters when set via plan day (drives halfway cue). */
  const targetDistanceMetersRef = useRef<number | null>(null);
  /** Target pace in seconds-per-meter (drives pace alerts). */
  const targetPaceSecPerMeterRef = useRef<number | null>(null);
  const prevResetTokenRef = useRef<number>(app.newUserResetToken);

  const resetRunData = useCallback(() => {
    if (persistTimerRef.current) {
      clearInterval(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    if (tickTimerRef.current) {
      clearInterval(tickTimerRef.current);
      tickTimerRef.current = null;
    }

    void runTrackingService.stopTracking();
    runTrackingService.reset();
    intervalEngine.reset();
    void runAudioService.stopAll();
    void endActivity('run');
    void clearBackgroundBuffer();
    void setBackgroundActive(false);
    void cancelRunReminders();
    void cancelRunStreakReminder();
    void AsyncStorage.multiRemove([
      RUN_HISTORY_KEY,
      RUN_PR_HISTORY_KEY,
      RUN_PREFERENCES_KEY,
      ACTIVE_RUN_KEY,
    ]).catch((e) => __DEV__ && console.warn('[RunContext] Reset error:', e));

    setRunHistory([]);
    setRunPRs([]);
    setPreferences(DEFAULT_RUN_PREFERENCES);
    setStatus('idle');
    setActiveRunId(null);
    setActiveRunStartTime(null);
    setActiveRunType('free');
    setActivePlanDayId(undefined);
    setActivePlanId(undefined);
    setSnapshot(null);
    setTick((t) => t + 1);
    setLastSavedRun(null);
    setLastNewPRs([]);
    setLastNewBadges([]);
    setIntervalSnapshot(null);
    autoPauseTriggeredRef.current = false;
    autoPauseDetectorRef.current.setThreshold(DEFAULT_RUN_PREFERENCES.autoPauseSpeedThresholdMps);
    autoPauseDetectorRef.current.reset();
    lastSpokenSplitRef.current = 0;
    halfwayAnnouncedRef.current = false;
    targetDistanceMetersRef.current = null;
    targetPaceSecPerMeterRef.current = null;
  }, []);

  useEffect(() => {
    if (app.newUserResetToken !== 0 && app.newUserResetToken !== prevResetTokenRef.current) {
      prevResetTokenRef.current = app.newUserResetToken;
      resetRunData();
    }
  }, [app.newUserResetToken, resetRunData]);

  // ─── Initial load ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [historyRaw, prRaw, prefRaw, activeRaw] = await Promise.all([
          AsyncStorage.getItem(RUN_HISTORY_KEY),
          AsyncStorage.getItem(RUN_PR_HISTORY_KEY),
          AsyncStorage.getItem(RUN_PREFERENCES_KEY),
          AsyncStorage.getItem(ACTIVE_RUN_KEY),
        ]);
        if (cancelled) return;

        if (historyRaw) {
          try { setRunHistory(JSON.parse(historyRaw)); }
          catch { __DEV__ && console.warn('[RunContext] Failed to parse history'); }
        }
        if (prRaw) {
          try { setRunPRs(JSON.parse(prRaw)); }
          catch { __DEV__ && console.warn('[RunContext] Failed to parse PRs'); }
        }
        if (prefRaw) {
          try {
            const parsed = JSON.parse(prefRaw);
            setPreferences({ ...DEFAULT_RUN_PREFERENCES, ...parsed });
            autoPauseDetectorRef.current.setThreshold(
              parsed.autoPauseSpeedThresholdMps ?? DEFAULT_RUN_PREFERENCES.autoPauseSpeedThresholdMps,
            );
          } catch { __DEV__ && console.warn('[RunContext] Failed to parse preferences'); }
        }

        // Detect orphaned active run state — if we have a saved active run but
        // tracking service is no longer running (e.g. app was killed), surface
        // it so the user can choose to recover or discard.
        if (activeRaw) {
          try {
            const parsed: ActiveRunState = JSON.parse(activeRaw);
            __DEV__ && console.log('[RunContext] Found stale active run state:', parsed.id);
            // We don't auto-restore tracking — instead expose recoverPendingRun()
            setActiveRunId(parsed.id);
            setActiveRunStartTime(parsed.startTime);
            setActiveRunType(parsed.runType);
            setActivePlanDayId(parsed.planDayId);
            setActivePlanId(parsed.planId);
            setStatus('paused');
          } catch { __DEV__ && console.warn('[RunContext] Failed to parse active run state'); }
        }
      } catch (e) {
        __DEV__ && console.warn('[RunContext] Initial load error:', e);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ─── Subscribe to tracking service snapshots ───────────────────────────
  useEffect(() => {
    const unsub = runTrackingService.subscribe((snap) => {
      setSnapshot(snap);
      // Auto-pause check
      if (
        preferences.autoPauseEnabled &&
        status === 'running' &&
        !autoPauseTriggeredRef.current
      ) {
        if (autoPauseDetectorRef.current.evaluate(snap)) {
          autoPauseTriggeredRef.current = true;
          runTrackingService.pauseTracking();
          setStatus('paused');
          __DEV__ && console.log('[RunContext] Auto-paused');
        }
      }

      // ── Audio cues (only while actively running) ──────────────────────
      if (status !== 'running') return;

      // Split cue — fires when split count increments
      const newSplitCount = snap.splits.length;
      if (newSplitCount > lastSpokenSplitRef.current) {
        const newest = snap.splits[newSplitCount - 1];
        // Convert pace from sec/m to sec per chosen unit for the speech text
        const unitMultiplier = preferences.units === 'metric' ? 1000 : 1609.344;
        const paceSecPerUnit = newest.paceSecondsPerMeter * unitMultiplier;
        void runAudioService.speakSplit(newest.index, paceSecPerUnit, preferences.units);
        lastSpokenSplitRef.current = newSplitCount;

        // Update Live Activity on every split with fresh distance + pace
        void updateActivity('run', {
          subtitle: fmtDistance(snap.totalDistanceMeters, preferences.units),
          detail: fmtPace(newest.paceSecondsPerMeter, preferences.units),
        });
      }

      // Halfway cue — fires once when distance crosses 50% of target
      const target = targetDistanceMetersRef.current;
      if (
        target !== null &&
        target > 0 &&
        !halfwayAnnouncedRef.current &&
        snap.totalDistanceMeters >= target / 2
      ) {
        halfwayAnnouncedRef.current = true;
        void runAudioService.speakHalfway(snap.totalDistanceMeters, preferences.units);
      }

      // Pace alert — compares current instantaneous pace vs target
      const targetPace = targetPaceSecPerMeterRef.current;
      const currentPace = snap.currentPaceSecondsPerMeter;
      if (targetPace !== null && currentPace !== null) {
        void runAudioService.speakPaceAlert(currentPace, targetPace, preferences.units);
      }

      // Interval engine tick — advance segments based on elapsed/distance.
      // The engine is loaded only when the prescription has intervals,
      // so this is a no-op for free runs.
      if (intervalEngine.hasIntervals()) {
        const elapsed = runTrackingService.getElapsedSeconds();
        intervalEngine.tick(elapsed, snap.totalDistanceMeters);
      }
    });
    return unsub;
  }, [preferences.autoPauseEnabled, preferences.units, status]);

  // ─── Tick interval engine on every 1s tick too (for time-based segments
  //     when the runner is stationary and no GPS snapshots fire) ───────
  useEffect(() => {
    if (status !== 'running') return;
    if (!intervalEngine.hasIntervals()) return;
    const interval = setInterval(() => {
      const elapsed = runTrackingService.getElapsedSeconds();
      const dist = snapshot?.totalDistanceMeters ?? 0;
      intervalEngine.tick(elapsed, dist);
    }, 1000);
    return () => clearInterval(interval);
  }, [status, snapshot?.totalDistanceMeters]);

  // ─── Live Activity periodic update every 30s ──────────────────────────
  // Keeps distance + pace fresh between mile splits on the Dynamic Island.
  useEffect(() => {
    if (status !== 'running') return;
    const interval = setInterval(() => {
      const snap = runTrackingService.getSnapshot();
      void updateActivity('run', {
        subtitle: fmtDistance(snap.totalDistanceMeters, preferences.units),
        detail: fmtPace(snap.currentPaceSecondsPerMeter ?? 0, preferences.units),
      });
    }, 30_000);
    return () => clearInterval(interval);
  }, [status, preferences.units]);

  // ─── AppState: drain background buffer on foreground ──────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next: AppStateStatus) => {
      if (next === 'active' && (status === 'running' || status === 'paused')) {
        // App returned to foreground during an active run — merge any GPS
        // samples captured by the background task while we were suspended.
        const added = await runTrackingService.drainBackgroundBuffer();
        if (added > 0) {
          __DEV__ && console.log(`[RunContext] Merged ${added} background points on foreground`);
        }
      }
    });
    return () => sub.remove();
  }, [status]);

  // ─── Push preferences into the audio service ──────────────────────────
  useEffect(() => {
    runAudioService.setPreferences(preferences);
  }, [preferences]);

  // ─── Subscribe to interval engine for UI snapshot + advance haptics ───
  useEffect(() => {
    const unsub = intervalEngine.subscribe((snap, advanced) => {
      setIntervalSnapshot(snap);
      if (advanced) {
        const newSeg = snap.currentSegment;
        if (newSeg) {
          // Heavy haptic on segment change
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(
              newSeg.type === 'work'
                ? Haptics.NotificationFeedbackType.Success
                : Haptics.NotificationFeedbackType.Warning,
            ).catch(() => {});
          }
          // Audio cue
          if (newSeg.type === 'work') {
            void runAudioService.speakIntervalStart(newSeg.label);
          } else if (newSeg.type === 'recovery') {
            void runAudioService.speakIntervalRecovery();
          } else if (newSeg.type === 'cooldown') {
            void runAudioService.speak('Cooldown. Ease up and bring it home.', 'interval_cooldown');
          }
        } else if (snap.isComplete) {
          // Workout finished — short cue
          void runAudioService.speak('Interval workout complete. Nice work.', 'interval_complete');
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          }
        }
      }
    });
    return unsub;
  }, []);

  // ─── 1-second tick while running (drives duration UI) ──────────────────
  useEffect(() => {
    if (status === 'running' || status === 'paused') {
      tickTimerRef.current = setInterval(() => setTick(t => t + 1), 1000);
      return () => {
        if (tickTimerRef.current) {
          clearInterval(tickTimerRef.current);
          tickTimerRef.current = null;
        }
      };
    }
  }, [status]);

  // ─── Periodic active-run persistence (crash recovery) ──────────────────
  useEffect(() => {
    if (status !== 'running' && status !== 'paused') return;
    persistTimerRef.current = setInterval(() => {
      if (!activeRunId || !activeRunStartTime) return;
      const route = runTrackingService.getRoute();
      const splits = runTrackingService.getSplits();
      const active: ActiveRunState = {
        id: activeRunId,
        startTime: activeRunStartTime,
        status,
        route,
        splits,
        splitUnit: preferences.units,
        pausedSeconds: runTrackingService.getPausedSeconds(),
        pauseStartedAt: status === 'paused' ? Date.now() : null,
        runType: activeRunType,
        source: 'gps',
        planDayId: activePlanDayId,
        planId: activePlanId,
      };
      void persistActiveRun(active);
    }, 30000);
    return () => {
      if (persistTimerRef.current) {
        clearInterval(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, [status, activeRunId, activeRunStartTime, activeRunType, activePlanDayId, activePlanId, preferences.units]);

  // ─── Actions ───────────────────────────────────────────────────────────

  const startRun = useCallback(async (options?: {
    runType?: RunType;
    planDayId?: string;
    planId?: string;
    /** Optional target distance in meters for halfway-cue and plan-linked runs. */
    targetDistanceMeters?: number;
    /** Optional target pace in seconds per meter for pace alerts. */
    targetPaceSecondsPerMeter?: number;
    /** Optional plan-day prescription — if it has `intervals`, the engine loads. */
    prescription?: DayPrescription;
    /** Source mode: 'gps' (default, outdoor) or 'treadmill' (indoor, no GPS) */
    source?: 'gps' | 'treadmill';
    /** Initial treadmill speed in m/s — only used when source='treadmill' */
    treadmillInitialSpeedMps?: number;
  }): Promise<boolean> => {
    if (status === 'running' || status === 'paused') {
      __DEV__ && console.log('[RunContext] startRun called while a run is active — ignoring');
      return false;
    }
    const useTreadmill = options?.source === 'treadmill';
    const ok = useTreadmill
      ? runTrackingService.startTreadmillTracking(preferences.units, options?.treadmillInitialSpeedMps ?? 0)
      : await runTrackingService.startTracking(preferences.units);
    if (!ok) return false;

    const id = generateRunId();
    const startISO = new Date().toISOString();
    setActiveRunId(id);
    setActiveRunStartTime(startISO);
    setActiveRunType(options?.runType ?? 'free');
    setActivePlanDayId(options?.planDayId);
    setActivePlanId(options?.planId);
    setStatus('running');
    autoPauseTriggeredRef.current = false;
    autoPauseDetectorRef.current.reset();

    // Reset audio cue state for the new run
    lastSpokenSplitRef.current = 0;
    halfwayAnnouncedRef.current = false;
    targetDistanceMetersRef.current = options?.targetDistanceMeters ?? null;
    targetPaceSecPerMeterRef.current = options?.targetPaceSecondsPerMeter ?? null;

    // Load interval workout if the prescription includes one
    intervalEngine.loadFromPrescription(options?.prescription);

    void runAudioService.speakRunStart();

    // Start Live Activity on Dynamic Island / Lock Screen
    void startActivity({
      type: 'run',
      title: 'Active Run',
      subtitle: '0.0 mi',
      detail: '--:-- / mi',
    });

    return true;
  }, [status, preferences.units]);

  const pauseRun = useCallback(() => {
    if (status !== 'running') return;
    runTrackingService.pauseTracking();
    setStatus('paused');
    autoPauseTriggeredRef.current = false;
    void runAudioService.speakRunPaused();
  }, [status]);

  const resumeRun = useCallback(() => {
    if (status !== 'paused') return;
    runTrackingService.resumeTracking();
    setStatus('running');
    autoPauseTriggeredRef.current = false;
    autoPauseDetectorRef.current.reset();
    void runAudioService.speakRunResumed();
  }, [status]);

  /**
   * Stop tracking and finalize the run. Returns the assembled RunLog (not yet
   * persisted) — caller should then call saveRun(log) or discardRun().
   */
  const stopRun = useCallback(async (opts?: {
    bodyweightLbs?: number;
    rating?: number | null;
    feelingLevel?: number | null;
    notes?: string;
    averageHeartRate?: number | null;
    maxHeartRate?: number | null;
  }): Promise<RunLog | null> => {
    if (status !== 'running' && status !== 'paused') return null;
    if (!activeRunId || !activeRunStartTime) return null;

    await runTrackingService.stopTracking();

    const route = runTrackingService.getRoute();
    const splits = runTrackingService.getSplits();
    const snap = runTrackingService.getSnapshot();
    const elapsedSeconds = runTrackingService.getElapsedSeconds();
    const pausedSeconds = runTrackingService.getPausedSeconds();
    const endISO = new Date().toISOString();

    const distanceMeters = snap.totalDistanceMeters;
    const avgPace = distanceMeters > 0 ? elapsedSeconds / distanceMeters : 0;
    const bestPace = splits.length > 0
      ? Math.min(...splits.map(s => s.paceSecondsPerMeter))
      : avgPace;

    const bodyweightKg = opts?.bodyweightLbs ? opts.bodyweightLbs * 0.453592 : 70;
    const calories = estimateRunCalories(distanceMeters, elapsedSeconds, bodyweightKg);

    const log: RunLog = {
      id: activeRunId,
      // Anchor to the START date so midnight-crossing runs stay on the right day
      date: dateStrFromISO(activeRunStartTime),
      startTime: activeRunStartTime,
      endTime: endISO,
      durationSeconds: elapsedSeconds,
      pausedSeconds,
      distanceMeters,
      averagePaceSecondsPerMeter: avgPace,
      bestPaceSecondsPerMeter: bestPace,
      elevationGainMeters: snap.totalElevationGainMeters,
      elevationLossMeters: snap.totalElevationLossMeters,
      route,
      splits,
      splitUnit: preferences.units,
      calories,
      averageHeartRate: opts?.averageHeartRate ?? null,
      maxHeartRate: opts?.maxHeartRate ?? null,
      runType: activeRunType,
      source: snap.source ?? 'gps',
      rating: opts?.rating ?? null,
      feelingLevel: opts?.feelingLevel ?? null,
      notes: opts?.notes ?? '',
      planDayId: activePlanDayId,
      planId: activePlanId,
    };

    setStatus('completed');

    // Dismiss Live Activity
    void endActivity('run');

    // Final cue + clear targets so leftover speech doesn't fire
    void runAudioService.speakRunComplete(log.distanceMeters, preferences.units, log.durationSeconds);
    targetDistanceMetersRef.current = null;
    targetPaceSecPerMeterRef.current = null;
    intervalEngine.reset();

    return log;
  }, [status, activeRunId, activeRunStartTime, activeRunType, activePlanDayId, activePlanId, preferences.units]);

  /**
   * Persist a finalized run, run PR detection, and optionally sync to Health.
   */
  const saveRun = useCallback(async (run: RunLog): Promise<{ newPRs: RunPR[]; newBadges: RunBadge[]; trainingScore: number }> => {
    // Thin the GPS route before persisting. A typical 1-hour run captures
    // ~720 points at our 5s tracking interval; Douglas-Peucker with a 5m
    // tolerance reduces that to ~150-300 while preserving the visible shape,
    // shrinking AsyncStorage size and downstream chart-render work.
    const thinnedRoute = run.route.length > 50 ? simplifyRoute(run.route, 5) : run.route;
    if (__DEV__ && thinnedRoute.length < run.route.length) {
      const ratio = ((thinnedRoute.length / run.route.length) * 100).toFixed(0);
      console.log(`[RunContext] Thinned route from ${run.route.length} → ${thinnedRoute.length} points (${ratio}%)`);
    }

    // Phase 8: populate steps for the run. Prefers iOS Pedometer (CMPedometer
    // via expo-sensors) for accuracy; falls back to a 170-spm cadence estimate
    // when the native module isn't available (Expo Go, missing permission, etc).
    let stepsForLog = run.steps;
    if (stepsForLog === undefined || stepsForLog === null) {
      try {
        const { estimateRunSteps } = await import('@/services/runStepCounter');
        const startMs = new Date(run.startTime).getTime();
        const endMs = new Date(run.endTime).getTime();
        stepsForLog = await estimateRunSteps(startMs, endMs, run.durationSeconds);
        __DEV__ && console.log('[RunContext] Resolved step count:', stepsForLog);
      } catch (e) {
        __DEV__ && console.log('[RunContext] Step counter import failed:', e);
      }
    }

    const thinned: RunLog = (thinnedRoute === run.route && stepsForLog === run.steps)
      ? run
      : { ...run, route: thinnedRoute, steps: stepsForLog };

    // Detect new PRs (uses original full-resolution route for accurate fastest-segment detection)
    const newPRs = detectNewPRs(run, runPRs);
    const updatedPRs = mergePRs(runPRs, newPRs);

    // Update history with the thinned version
    const updatedHistory = [thinned, ...runHistory];

    // Detect newly-earned badges by comparing pre/post history
    const newBadges = detectNewlyEarnedRunBadges(runHistory, updatedHistory);

    setRunHistory(updatedHistory);
    setRunPRs(updatedPRs);
    setLastSavedRun(thinned);
    setLastNewPRs(newPRs);
    setLastNewBadges(newBadges);

    // Phase 13: compute run training score — returned to caller so it can
    // update ctx.trainingScore without RunContext needing to import AppContext.
    const runTrainingScore = computeRunTrainingScore(thinned);
    __DEV__ && console.log('[RunContext] Run training score:', runTrainingScore);

    await Promise.all([
      persistRunHistory(updatedHistory),
      persistPRs(updatedPRs),
      persistActiveRun(null),
    ]);

    // Sync to Health (fire-and-forget)
    if (Platform.OS !== 'web' && healthService.isConnected()) {
      const startDate = new Date(run.startTime);
      const endDate = new Date(run.endTime);
      const durationMin = Math.round(run.durationSeconds / 60);
      void healthService.writeRunWorkout({
        startDate,
        endDate,
        distanceMeters: run.distanceMeters,
        duration: durationMin,
        calories: run.calories ?? undefined,
        runType: 'running',
      });
    }

    // Reset run state
    setActiveRunId(null);
    setActiveRunStartTime(null);
    setActivePlanDayId(undefined);
    setActivePlanId(undefined);
    runTrackingService.reset();
    setSnapshot(null);
    setStatus('idle');

    // ── Milestone notifications (PRs + badges) ─────────────────────────
    // Fire once-per-event push notifications so the achievement is visible
    // even after the user backgrounds the app post-save. The in-app modal
    // (run.tsx) handles the foreground celebration.
    for (const pr of newPRs) {
      const formattedValue = pr.unit === 'seconds'
        ? formatDurationForNotification(pr.value)
        : pr.unit === 'meters'
          ? `${(pr.value / 1609.344).toFixed(2)} mi`
          : String(pr.value);
      void presentRunMilestoneNotification(
        '🏆  New Personal Record',
        `${prTypeLabel(pr.type)}: ${formattedValue}`,
        `pr_${pr.type}_${run.id}`,
      );
    }
    for (const badge of newBadges) {
      void presentRunMilestoneNotification(
        '🥇  Badge Unlocked',
        `${badge.label} — ${badge.description}`,
        `badge_${badge.id}`,
      );
    }

    return { newPRs, newBadges, trainingScore: runTrainingScore };
  }, [runHistory, runPRs]);

  /** Immediately persists the run to history with isTentative=true. Call when RunSummary mounts. */
  const saveRunTentative = useCallback(async (run: RunLog): Promise<void> => {
    const tentative: RunLog = { ...run, isTentative: true };
    setRunHistory(prev => {
      // Don't duplicate if already saved
      if (prev.some(l => l.id === run.id)) return prev;
      const updated = [tentative, ...prev];
      persistRunHistory(updated).catch(() => {});
      return updated;
    });
  }, []);

  /** Removes isTentative flag from a previously tentative-saved run. */
  const completeTentativeSave = useCallback(async (runId: string, updates: Partial<RunLog>): Promise<void> => {
    setRunHistory(prev => {
      const updated = prev.map(l => l.id === runId ? { ...l, ...updates, isTentative: undefined } : l);
      persistRunHistory(updated).catch(() => {});
      return updated;
    });
  }, []);

  /** Deletes a run from history (used when user explicitly discards from summary). */
  const deleteTentativeRun = useCallback(async (runId: string): Promise<void> => {
    setRunHistory(prev => {
      const updated = prev.filter(l => l.id !== runId);
      persistRunHistory(updated).catch(() => {});
      return updated;
    });
  }, []);

  /**
   * Discard a run without persisting. Resets tracking state.
   */
  const discardRun = useCallback(async () => {
    await runTrackingService.stopTracking();
    runTrackingService.reset();
    intervalEngine.reset();
    await persistActiveRun(null);
    void runAudioService.stopAll();
    targetDistanceMetersRef.current = null;
    targetPaceSecPerMeterRef.current = null;
    setActiveRunId(null);
    setActiveRunStartTime(null);
    setActivePlanDayId(undefined);
    setActivePlanId(undefined);
    setSnapshot(null);
    setStatus('idle');
  }, []);

  /**
   * Discard a recovered (orphaned) run from a prior crash.
   */
  const discardPendingRun = useCallback(async () => {
    await persistActiveRun(null);
    await runTrackingService.stopTracking();
    runTrackingService.reset();
    setActiveRunId(null);
    setActiveRunStartTime(null);
    setActivePlanDayId(undefined);
    setActivePlanId(undefined);
    setSnapshot(null);
    setStatus('idle');
  }, []);

  /**
   * Recover an orphaned run from a prior crash.
   * Rehydrates the tracking service state from AsyncStorage and resumes GPS
   * capture. Any points captured by the background task while the app was
   * dead are merged in.
   */
  const recoverPendingRun = useCallback(async (): Promise<boolean> => {
    try {
      const activeRaw = await AsyncStorage.getItem(ACTIVE_RUN_KEY);
      if (!activeRaw) return false;
      const active: ActiveRunState = JSON.parse(activeRaw);
      const startMs = new Date(active.startTime).getTime();

      // Rebuild the tracking service state from persisted route + splits
      runTrackingService.restoreState(active, startMs);

      // Resume live GPS — this also re-registers the background task if
      // permission is still granted
      const ok = await runTrackingService.startTracking(active.splitUnit, {
        preserveState: true,
        preserveBackgroundBuffer: true,
      });
      if (!ok) {
        __DEV__ && console.log('[RunContext] recoverPendingRun: failed to restart tracking');
        return false;
      }

      // Drain any points the background task buffered while we were dead
      await runTrackingService.drainBackgroundBuffer();

      // Restore context state
      setActiveRunId(active.id);
      setActiveRunStartTime(active.startTime);
      setActiveRunType(active.runType);
      setActivePlanDayId(active.planDayId);
      setActivePlanId(active.planId);
      setStatus(active.status === 'paused' ? 'paused' : 'running');
      autoPauseTriggeredRef.current = false;
      autoPauseDetectorRef.current.reset();
      return true;
    } catch (e) {
      __DEV__ && console.log('[RunContext] recoverPendingRun error:', e);
      return false;
    }
  }, []);

  // ─── Treadmill controls ─────────────────────────────────────────────
  const setTreadmillSpeed = useCallback((speedMps: number) => {
    runTrackingService.setTreadmillSpeed(speedMps);
  }, []);

  const setTreadmillIncline = useCallback((percent: number) => {
    runTrackingService.setTreadmillIncline(percent);
  }, []);

  const skipIntervalSegment = useCallback(() => {
    if (!intervalEngine.hasIntervals()) return;
    intervalEngine.skipToNext();
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }, []);

  const getIntervalSegments = useCallback((): IntervalSegment[] => {
    return intervalEngine.getSegments();
  }, []);

  // ─── Streak Protection: refresh the daily streak reminder ─────────────
  // Runs whenever history changes or the user toggles the preference. If
  // the user has a live streak (≥ 2 days) AND hasn't run today, schedule
  // the daily nudge. Otherwise cancel it so we don't spam users without
  // streaks to defend.
  useEffect(() => {
    if (!loaded) return;
    if (!preferences.streakReminderEnabled) {
      void cancelRunStreakReminder();
      return;
    }
    const streak = computeRunStreak(runHistory);
    const ranToday = runHistory.some(r => r.date === getTodayStr());
    // Only nudge if there's actually a streak worth protecting and the user
    // hasn't already saved today's run. A 1-day "streak" isn't worth nudging.
    if (streak >= 2 && !ranToday) {
      void scheduleRunStreakReminder(
        preferences.streakReminderHour,
        preferences.streakReminderMinute,
      );
    } else {
      void cancelRunStreakReminder();
    }
  }, [
    loaded,
    runHistory,
    preferences.streakReminderEnabled,
    preferences.streakReminderHour,
    preferences.streakReminderMinute,
  ]);

  /**
   * Schedule a one-shot reminder for an upcoming planned run + a 30-min
   * heads-up. Callers (e.g. ActivePlanDrawer when the user opts in to
   * reminders, or AppContext when a new plan is generated) provide the
   * exact moment the run should start. Idempotent — replaces any
   * previously-scheduled run reminder.
   */
  const scheduleRunReminderForDay = useCallback(async (
    runDateTime: Date,
    runDescription: string,
  ): Promise<void> => {
    await scheduleRunReminder(runDateTime, runDescription);
    await scheduleRunPreReminder(runDateTime, runDescription);
  }, []);

  const clearRunReminder = useCallback(async (): Promise<void> => {
    await cancelRunReminders();
  }, []);

  const updatePreferences = useCallback((updates: Partial<RunPreferences>) => {
    setPreferences(prev => {
      const next = { ...prev, ...updates };
      void persistPreferences(next);
      if (updates.autoPauseSpeedThresholdMps !== undefined) {
        autoPauseDetectorRef.current.setThreshold(updates.autoPauseSpeedThresholdMps);
      }
      return next;
    });
  }, []);

  const deleteRun = useCallback(async (runId: string) => {
    const run = runHistory.find(r => r.id === runId);
    if (!run) return;
    const updatedHistory = runHistory.filter(r => r.id !== runId);
    setRunHistory(updatedHistory);
    await persistRunHistory(updatedHistory);
    // Note: we deliberately don't recalculate PRs here. If the deleted run held
    // a PR, the badge stays — we'd need to scan all history to demote, which is
    // heavier and rarely matters. Could add later if desired.
  }, [runHistory]);

  const updateRun = useCallback(async (runId: string, updates: Partial<Pick<RunLog, 'rating' | 'feelingLevel' | 'notes' | 'runType'>>) => {
    const updatedHistory = runHistory.map(r =>
      r.id === runId ? { ...r, ...updates } : r,
    );
    setRunHistory(updatedHistory);
    await persistRunHistory(updatedHistory);
  }, [runHistory]);

  // ─── Derived live metrics ──────────────────────────────────────────────

  const liveMetrics = useMemo(() => {
    const elapsedSeconds = (status === 'running' || status === 'paused')
      ? runTrackingService.getElapsedSeconds()
      : 0;
    return {
      elapsedSeconds,
      distanceMeters: snapshot?.totalDistanceMeters ?? 0,
      currentPaceSecondsPerMeter: snapshot?.currentPaceSecondsPerMeter ?? null,
      averagePaceSecondsPerMeter: snapshot?.averagePaceSecondsPerMeter ?? null,
      elevationGainMeters: snapshot?.totalElevationGainMeters ?? 0,
      elevationLossMeters: snapshot?.totalElevationLossMeters ?? 0,
      splits: snapshot?.splits ?? [],
      routePointCount: snapshot?.routePointCount ?? 0,
    };
  // tick is intentionally a dep so elapsed seconds updates every second
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, status, tick]);

  // ─── Stats ─────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    if (runHistory.length === 0) {
      return {
        totalRuns: 0,
        totalDistanceMeters: 0,
        totalDurationSeconds: 0,
        totalElevationMeters: 0,
        weeklyDistanceMeters: 0,
        monthlyDistanceMeters: 0,
      };
    }
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

    let totalDistance = 0;
    let totalDuration = 0;
    let totalElevation = 0;
    let weeklyDistance = 0;
    let monthlyDistance = 0;

    for (const r of runHistory) {
      totalDistance += r.distanceMeters;
      totalDuration += r.durationSeconds;
      totalElevation += r.elevationGainMeters;
      const t = new Date(r.startTime).getTime();
      if (t >= oneWeekAgo) weeklyDistance += r.distanceMeters;
      if (t >= oneMonthAgo) monthlyDistance += r.distanceMeters;
    }

    return {
      totalRuns: runHistory.length,
      totalDistanceMeters: totalDistance,
      totalDurationSeconds: totalDuration,
      totalElevationMeters: totalElevation,
      weeklyDistanceMeters: weeklyDistance,
      monthlyDistanceMeters: monthlyDistance,
    };
  }, [runHistory]);

  // ─── Public API ────────────────────────────────────────────────────────

  return useMemo(() => ({
    // Loaded state
    loaded,

    // Persistent data
    runHistory,
    runPRs,
    preferences,
    stats,

    // Active run
    status,
    activeRunId,
    activeRunStartTime,
    activeRunType,
    activePlanDayId,
    activePlanId,
    liveMetrics,
    snapshot,
    isTracking: status === 'running' || status === 'paused',
    isPaused: status === 'paused',

    // Last completed
    lastSavedRun,
    lastNewPRs,
    lastNewBadges,

    // Interval workout
    intervalSnapshot,
    skipIntervalSegment,
    getIntervalSegments,

    // Treadmill controls
    treadmillSpeedMps: snapshot?.treadmillSpeedMps ?? 0,
    treadmillInclinePct: snapshot?.treadmillInclinePct ?? 0,
    isTreadmillMode: snapshot?.source === 'treadmill',
    setTreadmillSpeed,
    setTreadmillIncline,

    // Actions — lifecycle
    startRun,
    pauseRun,
    resumeRun,
    stopRun,
    saveRun,
    discardRun,

    // Actions — recovery
    discardPendingRun,
    recoverPendingRun,

    // Actions — preferences & history
    updatePreferences,
    deleteRun,
    updateRun,

    // Actions — tentative save (crash protection)
    saveRunTentative,
    completeTentativeSave,
    deleteTentativeRun,

    // Actions — notifications
    scheduleRunReminderForDay,
    clearRunReminder,
  }), [
    loaded,
    runHistory, runPRs, preferences, stats,
    status, activeRunId, activeRunStartTime, activeRunType, activePlanDayId, activePlanId,
    liveMetrics, snapshot,
    lastSavedRun, lastNewPRs, lastNewBadges,
    intervalSnapshot, skipIntervalSegment, getIntervalSegments,
    setTreadmillSpeed, setTreadmillIncline,
    startRun, pauseRun, resumeRun, stopRun, saveRun, discardRun, discardPendingRun, recoverPendingRun,
    updatePreferences, deleteRun, updateRun,
    saveRunTentative, completeTentativeSave, deleteTentativeRun,
    scheduleRunReminderForDay, clearRunReminder,
  ]);
});
