import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppContext } from '@/context/AppContext';

// ─── Storage keys ──────────────────────────────────────────────────────────

const LAST_MODE_KEY = '@zeal_train_last_mode_v1';
const COACHMARK_SEEN_KEY = '@zeal_train_tab_coachmark_seen_v1';

// ─── Types ────────────────────────────────────────────────────────────────

export type TrainMode = 'workout' | 'run';

interface TrainContextValue {
  /** Current mode shown by the Train tab. Flips on toggle tap / swipe. */
  mode: TrainMode;
  /** True when today's plan prescribes BOTH a workout AND a run (hybrid plan). */
  isHybridToday: boolean;
  /** True on first mount until AsyncStorage has returned the last-used mode. */
  loaded: boolean;
  /** Has the one-time swipe-coachmark been dismissed already? */
  coachmarkSeen: boolean;
  /** Manually set the mode. Persists as the new last-used mode. */
  setMode: (next: TrainMode) => void;
  /** Apply a legacy `?mode=run` query param exactly once (on route entry). */
  syncFromQueryParam: (param?: string | string[]) => void;
  /** Mark the swipe-coachmark as seen so it never re-appears. */
  dismissCoachmark: () => void;
}

// ─── Default resolution ────────────────────────────────────────────────────

/**
 * Resolve the initial mode when the Train tab first mounts.
 *
 * Priority order:
 *   1. Today's plan prescription (run day → run, strength day → workout)
 *   2. Last-used mode from AsyncStorage
 *   3. Fallback: 'workout' (the primary modality)
 *
 * Hybrid days return the prescribed activity type for today — the
 * hybrid-layout decision is made separately via `isHybridToday`.
 */
function resolveDefaultMode(
  prescription: { activity_type?: string; is_rest?: boolean } | null | undefined,
  lastUsed: TrainMode | null,
): TrainMode {
  if (prescription && !prescription.is_rest) {
    if (prescription.activity_type === 'run') return 'run';
    if (prescription.activity_type === 'strength') return 'workout';
    // activity_type === 'cross_train' or undefined → fall through to last-used
  }
  return lastUsed ?? 'workout';
}

// ─── Context ───────────────────────────────────────────────────────────────

export const [TrainProvider, useTrain] = createContextHook<TrainContextValue>(() => {
  const { activePlan, getTodayPrescription } = useAppContext();

  const [mode, setModeState] = useState<TrainMode>('workout');
  const [lastUsed, setLastUsed] = useState<TrainMode | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [coachmarkSeen, setCoachmarkSeen] = useState(true); // default true = don't show

  // Track whether we've already resolved the initial mode this mount so the
  // plan-prescription effect doesn't fight the user every time they flip modes.
  const [initialResolved, setInitialResolved] = useState(false);

  // ── Initial load: pull last-used mode + coachmark flag from storage ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rawMode, rawCoachmark] = await Promise.all([
          AsyncStorage.getItem(LAST_MODE_KEY),
          AsyncStorage.getItem(COACHMARK_SEEN_KEY),
        ]);
        if (cancelled) return;

        const parsedMode: TrainMode | null =
          rawMode === 'run' || rawMode === 'workout' ? rawMode : null;
        setLastUsed(parsedMode);
        // Coachmark: show ONLY if we've never seen the flag before (first launch)
        setCoachmarkSeen(rawCoachmark === 'true');
      } catch (e) {
        __DEV__ && console.log('[TrainContext] Load error:', e);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Hybrid day detection ──
  // A plan is "hybrid" if it has mode:'hybrid' set at the plan level. The
  // activePlan interface guarantees this field exists for hybrid plans.
  const isHybridToday = useMemo(() => {
    if (!activePlan || (activePlan as { mode?: string }).mode !== 'hybrid') {
      return false;
    }
    const p = getTodayPrescription?.();
    if (!p || p.is_rest) return false;
    // On hybrid plans, only SOME days are hybrid — some are strength-only,
    // some run-only, some rest. True hybrid day = activity_type present AND
    // the plan itself is hybrid. For now we treat every non-rest day on a
    // hybrid plan as a hybrid day so the split layout fires whenever the
    // user benefits from it. Phase 3 may refine this if needed.
    return p.activity_type === 'strength' || p.activity_type === 'run';
  }, [activePlan, getTodayPrescription]);

  // ── Once loaded, resolve the initial mode from plan + last-used ──
  useEffect(() => {
    if (!loaded) return;
    if (initialResolved) return;
    const prescription = getTodayPrescription?.() ?? null;
    const next = resolveDefaultMode(prescription, lastUsed);
    setModeState(next);
    setInitialResolved(true);
  }, [loaded, initialResolved, lastUsed, getTodayPrescription]);

  // ── Actions ──

  const setMode = useCallback((next: TrainMode) => {
    setModeState(next);
    setLastUsed(next);
    // Fire-and-forget persist
    AsyncStorage.setItem(LAST_MODE_KEY, next).catch((e) => {
      __DEV__ && console.log('[TrainContext] Persist last-mode error:', e);
    });
  }, []);

  /**
   * Exactly-once URL-param application. Legacy redirects from /workout and
   * /run append `?mode=workout` or `?mode=run`. We call this on Train-screen
   * mount with the raw param value; it only takes effect if we haven't
   * already locked in the mode from that param.
   */
  const [queryParamApplied, setQueryParamApplied] = useState<string | null>(null);

  const syncFromQueryParam = useCallback((param?: string | string[]) => {
    if (param === undefined) return;
    const value = Array.isArray(param) ? param[0] : param;
    if (value !== 'run' && value !== 'workout') return;
    if (queryParamApplied === value) return; // already applied
    setQueryParamApplied(value);
    setMode(value);
  }, [queryParamApplied, setMode]);

  const dismissCoachmark = useCallback(() => {
    setCoachmarkSeen(true);
    AsyncStorage.setItem(COACHMARK_SEEN_KEY, 'true').catch((e) => {
      __DEV__ && console.log('[TrainContext] Persist coachmark error:', e);
    });
  }, []);

  return useMemo(
    () => ({
      mode,
      isHybridToday,
      loaded,
      coachmarkSeen,
      setMode,
      syncFromQueryParam,
      dismissCoachmark,
    }),
    [mode, isHybridToday, loaded, coachmarkSeen, setMode, syncFromQueryParam, dismissCoachmark],
  );
});
