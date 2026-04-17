import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { PlatformIcon } from '@/components/PlatformIcon';
import GlassCard from '@/components/GlassCard';
import ZealBackground from '@/components/ZealBackground';
import AmbientGlow from '@/components/AmbientGlow';
import { useZealTheme, useAppContext } from '@/context/AppContext';
import { useRun } from '@/context/RunContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { showProGate } from '@/services/proGate';
import RunMetrics from '@/components/run/RunMetrics';
import RunControls from '@/components/run/RunControls';
import SplitTable from '@/components/run/SplitTable';
import RunMap from '@/components/run/RunMap';
import TreadmillPanel from '@/components/run/TreadmillPanel';
import RunSummary from '@/components/run/RunSummary';
import RunPlanBuilderDrawer from '@/components/drawers/RunPlanBuilderDrawer';
import HybridPlanBuilderDrawer from '@/components/drawers/HybridPlanBuilderDrawer';
import RunHistoryDrawer from '@/components/drawers/RunHistoryDrawer';
import RunLogDrawer from '@/components/drawers/RunLogDrawer';
import MileageTracker from '@/components/run/MileageTracker';
import AchievementModal, { type Achievement } from '@/components/drawers/AchievementModal';
import { type RunBadge } from '@/services/runBadges';
import RunAudioSettingsDrawer from '@/components/drawers/RunAudioSettingsDrawer';
import RunSettingsDrawer from '@/components/drawers/RunSettingsDrawer';
import TabHeader from '@/components/TabHeader';
import IntervalRunner from '@/components/run/IntervalRunner';
import { useRouter } from 'expo-router';
import { healthService } from '@/services/healthService';
import { RunLog, RunType, METERS_PER_MILE, METERS_PER_KM } from '@/types/run';
import { formatPace, paceToSecondsPerMile, paceToSecondsPerKm } from '@/services/runTrackingService';
import { runTrackingService } from '@/services/runTrackingService';
import { prTypeLabel } from '@/services/runPRService';

const RUN_TYPE_OPTIONS: { value: RunType; label: string }[] = [
  { value: 'free', label: 'Free Run' },
  { value: 'easy', label: 'Easy Run' },
  { value: 'tempo', label: 'Tempo' },
  { value: 'long_run', label: 'Long Run' },
  { value: 'interval', label: 'Intervals' },
  { value: 'recovery', label: 'Recovery' },
];

function formatDistance(meters: number, units: 'imperial' | 'metric'): string {
  if (units === 'metric') {
    return `${(meters / METERS_PER_KM).toFixed(2)} km`;
  }
  return `${(meters / METERS_PER_MILE).toFixed(2)} mi`;
}

function formatDuration(totalSeconds: number): string {
  if (!isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const hrs = Math.floor(totalSeconds / 3600);
  const min = Math.floor((totalSeconds % 3600) / 60);
  const sec = Math.floor(totalSeconds % 60);
  if (hrs > 0) return `${hrs}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

function formatPaceForUnit(secondsPerMeter: number | null | undefined, units: 'imperial' | 'metric'): string {
  if (secondsPerMeter === null || secondsPerMeter === undefined) return '—:—';
  return formatPace(units === 'metric' ? paceToSecondsPerKm(secondsPerMeter) : paceToSecondsPerMile(secondsPerMeter));
}

function relativeDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function RunScreen() {
  const { colors, accent, isDark } = useZealTheme();
  const ctx = useAppContext();
  const run = useRun();
  const { hasPro, openPaywall } = useSubscription();

  const [selectedRunType, setSelectedRunType] = useState<RunType>('free');
  /** 'outdoor' uses GPS; 'treadmill' uses speed-driven distance simulator. */
  const [selectedSourceMode, setSelectedSourceMode] = useState<'outdoor' | 'treadmill'>('outdoor');
  /** Treadmill starting speed in m/s — defaults to ~6 mph (jogging) */
  const TREADMILL_DEFAULT_SPEED_MPS = 2.7; // ~6.04 mph / 9.7 km/h
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [pendingRunLog, setPendingRunLog] = useState<RunLog | null>(null);
  const [postRunRating, setPostRunRating] = useState<number | null>(null);
  const [postRunNotes, setPostRunNotes] = useState('');
  const [prModalVisible, setPRModalVisible] = useState(false);
  const [planBuilderVisible, setPlanBuilderVisible] = useState(false);
  const [hybridBuilderVisible, setHybridBuilderVisible] = useState(false);
  const [isSavingRun, setIsSavingRun] = useState(false);
  const [healthSavedToastVisible, setHealthSavedToastVisible] = useState(false);
  const [historyDrawerVisible, setHistoryDrawerVisible] = useState(false);
  const [lastRunLogVisible, setLastRunLogVisible] = useState(false);
  /** FIFO queue of newly-earned badges; one is shown in the modal at a time. */
  const [badgeQueue, setBadgeQueue] = useState<RunBadge[]>([]);
  const [audioSettingsVisible, setAudioSettingsVisible] = useState(false);
  const [runSettingsVisible, setRunSettingsVisible] = useState(false);
  const router = useRouter();

  // Check permission status on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const granted = await runTrackingService.hasForegroundPermission();
      if (!cancelled) setPermissionStatus(granted ? 'granted' : 'unknown');
    })();
    return () => { cancelled = true; };
  }, []);

  // Keep screen awake while run is active (per user preference)
  useEffect(() => {
    const isActive = run.status === 'running' || run.status === 'paused';
    if (isActive && run.preferences.keepScreenAwake) {
      void activateKeepAwakeAsync('zeal-run-active');
      return () => {
        deactivateKeepAwake('zeal-run-active');
      };
    }
  }, [run.status, run.preferences.keepScreenAwake]);

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleStart = useCallback(async () => {
    const isTreadmill = selectedSourceMode === 'treadmill';

    // GPS-only: best-effort upgrade to "Always" location so tracking continues
    // if the runner backgrounds the app or locks their screen. Treadmill mode
    // skips this entirely — no GPS needed indoors.
    if (!isTreadmill) {
      const hasBg = await runTrackingService.hasBackgroundPermission();
      if (!hasBg) {
        await runTrackingService.requestBackgroundPermission();
      }
    }

    // If there's an active run (or hybrid) plan with a run prescribed today,
    // link this run to the plan day so completion is tracked automatically.
    const hasLinkablePlan = ctx.activePlan?.mode === 'run' || ctx.activePlan?.mode === 'hybrid';
    const todayPrescription = hasLinkablePlan ? ctx.getTodayPrescription() : null;
    const isTodayRunDay = !!(todayPrescription && !todayPrescription.is_rest && todayPrescription.activity_type === 'run');
    const planLinkedRunType = (isTodayRunDay && todayPrescription!.run_type)
      ? (todayPrescription!.run_type as RunType)
      : selectedRunType;
    const planDayId = isTodayRunDay
      ? `${ctx.activePlan!.id}_${todayPrescription!.date}`
      : undefined;
    const planId = isTodayRunDay
      ? ctx.activePlan!.id
      : undefined;

    // Pull target distance + pace from the prescription so audio cues
    // (halfway, pace alerts) can fire against real targets
    let targetDistanceMeters: number | undefined;
    let targetPaceSecondsPerMeter: number | undefined;
    if (isTodayRunDay && todayPrescription) {
      if (todayPrescription.target_distance_miles && todayPrescription.target_distance_miles > 0) {
        targetDistanceMeters = todayPrescription.target_distance_miles * METERS_PER_MILE;
      }
      const paceMin = todayPrescription.target_pace_min_sec_per_mile;
      const paceMax = todayPrescription.target_pace_max_sec_per_mile;
      if (paceMin && paceMax && paceMin > 0 && paceMax > 0) {
        const middlePaceSecPerMile = (paceMin + paceMax) / 2;
        targetPaceSecondsPerMeter = middlePaceSecPerMile / METERS_PER_MILE;
      }
    }

    const ok = await run.startRun({
      runType: planLinkedRunType,
      planDayId,
      planId,
      targetDistanceMeters,
      targetPaceSecondsPerMeter,
      prescription: isTodayRunDay ? todayPrescription ?? undefined : undefined,
      source: isTreadmill ? 'treadmill' : 'gps',
      treadmillInitialSpeedMps: isTreadmill ? TREADMILL_DEFAULT_SPEED_MPS : undefined,
    });
    if (!ok) {
      // Treadmill failures are extremely rare (no permissions in play); only
      // show the location alert when we actually needed GPS.
      if (!isTreadmill) {
        setPermissionStatus('denied');
        Alert.alert(
          'Location Required',
          'Zeal+ needs location access to track your run. Please enable it in Settings.',
          [{ text: 'OK' }],
        );
      } else {
        Alert.alert('Couldn\'t Start', 'Could not start treadmill tracking. Please try again.');
      }
    } else if (!isTreadmill) {
      setPermissionStatus('granted');
    }
  }, [run, selectedRunType, ctx, selectedSourceMode]);

  const handleStop = useCallback(async () => {
    Alert.alert(
      'End Run?',
      'Are you sure you want to end this run?',
      [
        { text: 'Keep Running', style: 'cancel' },
        {
          text: 'End Run',
          style: 'destructive',
          onPress: async () => {
            const log = await run.stopRun({ bodyweightLbs: ctx.weight ?? undefined });
            if (log) setPendingRunLog(log);
          },
        },
      ],
    );
  }, [run, ctx.weight]);

  const handleSaveRun = useCallback(async () => {
    if (!pendingRunLog || isSavingRun) return;
    setIsSavingRun(true);
    try {
      const finalLog: RunLog = {
        ...pendingRunLog,
        rating: postRunRating,
        notes: postRunNotes,
      };
      const healthConnected = healthService.isConnected();
      const result = await run.saveRun(finalLog);

      // If this run was linked to an active run plan, mark today's plan day complete.
      if (finalLog.planId && ctx.activePlan?.id === finalLog.planId) {
        ctx.markDayCompleted(finalLog.date);
      }

      setPendingRunLog(null);
      setPostRunRating(null);
      setPostRunNotes('');

      // Health sync toast — only when the service actually attempted a write
      if (healthConnected) {
        setHealthSavedToastVisible(true);
        setTimeout(() => setHealthSavedToastVisible(false), 2400);
      }

      // Queue newly-earned badges (will fire one-by-one after the PR modal closes,
      // or directly if no PRs were earned)
      if (result.newBadges.length > 0) {
        setBadgeQueue(result.newBadges);
      }

      if (result.newPRs.length > 0) {
        // Stagger the PR modal slightly so the toast has a moment to be seen
        setTimeout(() => setPRModalVisible(true), healthConnected ? 600 : 0);
      } else if (result.newBadges.length > 0) {
        // Skip straight to the first badge if no PRs to celebrate first
        setTimeout(() => {/* badgeQueue effect picks it up */}, healthConnected ? 600 : 100);
      }
    } finally {
      setIsSavingRun(false);
    }
  }, [pendingRunLog, postRunRating, postRunNotes, run, ctx, isSavingRun]);

  const handleDiscardSummary = useCallback(() => {
    Alert.alert(
      'Discard Run?',
      'This run will not be saved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            await run.discardRun();
            setPendingRunLog(null);
            setPostRunRating(null);
            setPostRunNotes('');
          },
        },
      ],
    );
  }, [run]);

  const handleResumePending = useCallback(async () => {
    Alert.alert(
      'Previous Run Found',
      'A run was in progress when the app closed. Would you like to resume it or discard?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => run.discardPendingRun(),
        },
        {
          text: 'Resume',
          onPress: async () => {
            const ok = await run.recoverPendingRun();
            if (!ok) {
              Alert.alert(
                'Resume Failed',
                'Could not resume the previous run. Please discard and start a new run.',
              );
            }
          },
        },
      ],
    );
  }, [run]);

  // ─── Derived ────────────────────────────────────────────────────────────

  const isActive = run.status === 'running' || run.status === 'paused';
  const isPaused = run.status === 'paused';
  const showPostRun = pendingRunLog !== null;
  const lastRun = run.runHistory[0] ?? null;

  // GPS acquired when we have at least one route point. Treadmill mode never
  // needs GPS, so treat it as always-acquired so the controls don't disable.
  const gpsAcquired = run.isTreadmillMode || run.liveMetrics.routePointCount > 0;

  const recentStats = useMemo(() => {
    const distFmt = formatDistance(run.stats.weeklyDistanceMeters, run.preferences.units);
    return {
      thisWeek: distFmt,
      totalRuns: run.stats.totalRuns,
    };
  }, [run.stats, run.preferences.units]);

  // ─── Render: post-run summary ──────────────────────────────────────────

  if (showPostRun && pendingRunLog) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <AmbientGlow color={accent} />
        <ZealBackground />
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={styles.topBar}>
            <Text style={[styles.summaryTitle, { color: colors.text }]}>Run Complete</Text>
          </View>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <RunSummary
              log={pendingRunLog}
              mode="post_run"
              rating={postRunRating}
              onRatingChange={setPostRunRating}
              notes={postRunNotes}
              onNotesChange={setPostRunNotes}
              onSave={handleSaveRun}
              onDiscard={handleDiscardSummary}
              isSaving={isSavingRun}
            />
            <View style={{ height: 120 }} />
          </ScrollView>

          {/* Saved-to-Health toast */}
          {healthSavedToastVisible && (
            <View style={[styles.healthToast, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
              <PlatformIcon name="check-circle" size={16} color="#22c55e" />
              <Text style={[styles.healthToastText, { color: colors.text }]}>Saved to Apple Health</Text>
            </View>
          )}
        </SafeAreaView>
      </View>
    );
  }

  // ─── Render: active run ─────────────────────────────────────────────────

  if (isActive) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <AmbientGlow color={accent} />
        <ZealBackground />
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={styles.topBar}>
            <View style={styles.activeTopBarLeft}>
              <View style={[styles.liveDot, { backgroundColor: isPaused ? colors.textMuted : '#22c55e' }]} />
              <Text style={[styles.activeStatusLabel, { color: isPaused ? colors.textMuted : colors.text }]}>
                {isPaused ? 'PAUSED' : 'TRACKING'}
              </Text>
            </View>
            <Text style={[styles.runTypeLabel, { color: colors.textMuted }]}>
              {RUN_TYPE_OPTIONS.find(o => o.value === run.activeRunType)?.label.toUpperCase()}
            </Text>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Interval workout runner (only renders when prescription has intervals) */}
            <IntervalRunner />

            <RunMetrics
              units={run.preferences.units}
              elapsedSeconds={run.liveMetrics.elapsedSeconds}
              distanceMeters={run.liveMetrics.distanceMeters}
              currentPaceSecondsPerMeter={run.liveMetrics.currentPaceSecondsPerMeter}
              averagePaceSecondsPerMeter={run.liveMetrics.averagePaceSecondsPerMeter}
              elevationGainMeters={run.liveMetrics.elevationGainMeters}
              splitCount={run.liveMetrics.splits.length}
              isPaused={isPaused}
            />

            {/* Treadmill mode: show speed/incline controls in place of the map. */}
            {run.isTreadmillMode ? (
              <TreadmillPanel />
            ) : (
              <>
                {!gpsAcquired && (
                  <View style={styles.gpsBanner}>
                    <PlatformIcon name="compass" size={14} color={accent} />
                    <Text style={[styles.gpsBannerText, { color: colors.textSecondary }]}>
                      Acquiring GPS signal — start moving to begin tracking
                    </Text>
                  </View>
                )}

                {gpsAcquired && (
                  <RunMap
                    route={runTrackingService.getRoute()}
                    followRunner={!isPaused}
                  />
                )}
              </>
            )}

            {run.liveMetrics.splits.length > 0 && (
              <GlassCard style={styles.sectionCard}>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>SPLITS</Text>
                <SplitTable splits={run.liveMetrics.splits} units={run.preferences.units} />
              </GlassCard>
            )}

            <View style={{ height: 200 }} />
          </ScrollView>

          {/* Fixed bottom controls */}
          <View style={[styles.controlsContainer, { backgroundColor: isDark ? 'rgba(20,20,20,0.92)' : 'rgba(255,255,255,0.92)', borderTopColor: colors.border }]}>
            <RunControls
              status={run.status}
              onStart={handleStart}
              onPause={run.pauseRun}
              onResume={run.resumeRun}
              onStop={handleStop}
              gpsAcquired={gpsAcquired}
            />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ─── Render: pre-run idle ───────────────────────────────────────────────

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AmbientGlow color={accent} />
      <ZealBackground />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <TabHeader
          title="Run"
          // TODO(profile): once AthleteProfileDrawer is wired into Run, swap this to setProfileVisible(true)
          onAvatarPress={() => setRunSettingsVisible(true)}
          avatarTestID="run-profile-avatar"
          rightSlot={
            <>
              <TouchableOpacity
                style={[styles.audioBtn, { borderColor: colors.border }]}
                onPress={() => setRunSettingsVisible(true)}
                activeOpacity={0.7}
                testID="run-settings-button"
                accessibilityRole="button"
                accessibilityLabel="Run settings"
              >
                <PlatformIcon name="settings" size={15} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={styles.unitsToggle}>
                <TouchableOpacity
                  onPress={() => run.updatePreferences({ units: 'imperial' })}
                  style={[
                    styles.unitsButton,
                    run.preferences.units === 'imperial' && { backgroundColor: `${accent}20` },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.unitsButtonText, { color: run.preferences.units === 'imperial' ? accent : colors.textMuted }]}>mi</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => run.updatePreferences({ units: 'metric' })}
                  style={[
                    styles.unitsButton,
                    run.preferences.units === 'metric' && { backgroundColor: `${accent}20` },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.unitsButtonText, { color: run.preferences.units === 'metric' ? accent : colors.textMuted }]}>km</Text>
                </TouchableOpacity>
              </View>
            </>
          }
        />

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Recovery hint if there's an orphaned run */}
          {run.status === 'paused' && !run.snapshot && run.activeRunId && (
            <TouchableOpacity onPress={handleResumePending} activeOpacity={0.7}>
              <GlassCard style={styles.recoveryCard}>
                <PlatformIcon name="alert-triangle" size={14} color="#eab308" />
                <Text style={[styles.recoveryText, { color: colors.text }]}>Previous run found — tap to resolve</Text>
              </GlassCard>
            </TouchableOpacity>
          )}

          {/* Stats overview */}
          <GlassCard style={styles.statsCard}>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>THIS WEEK</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{recentStats.thisWeek}</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statBox}>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>TOTAL RUNS</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{recentStats.totalRuns}</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.statBox}>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>BEST PACE</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {run.runPRs.find(p => p.type === 'fastest_mile')
                    ? formatPace(run.runPRs.find(p => p.type === 'fastest_mile')!.value)
                    : '—:—'}
                </Text>
              </View>
            </View>
          </GlassCard>

          {/* Active run or hybrid plan */}
          {ctx.activePlan && (ctx.activePlan.mode === 'run' || ctx.activePlan.mode === 'hybrid') ? (() => {
            const isHybrid = ctx.activePlan.mode === 'hybrid';
            const todayPrescription = ctx.getTodayPrescription();
            const isRunToday = todayPrescription && !todayPrescription.is_rest && todayPrescription.activity_type === 'run';
            const isStrengthToday = todayPrescription && !todayPrescription.is_rest && todayPrescription.activity_type === 'strength';
            const planLabel = isHybrid ? 'ACTIVE HYBRID PLAN' : 'ACTIVE RUN PLAN';
            return (
              <GlassCard style={styles.sectionCard}>
                <View style={styles.planCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sectionLabel, { color: accent }]}>{planLabel}</Text>
                    <Text style={[styles.planCardTitle, { color: colors.text }]}>{ctx.activePlan.name}</Text>
                  </View>
                  <View style={[styles.planBadge, { backgroundColor: `${accent}15`, borderColor: `${accent}30` }]}>
                    <Text style={[styles.planBadgeText, { color: accent }]}>
                      {ctx.activePlan.planLength}wk · {
                        isHybrid
                          ? `${ctx.activePlan.strengthDays ?? 0}L+${ctx.activePlan.runDays ?? 0}R`
                          : `${ctx.activePlan.daysPerWeek}/wk`
                      }
                    </Text>
                  </View>
                </View>
                {isRunToday && todayPrescription ? (
                  <View style={[styles.todayRunRow, { backgroundColor: `${accent}10`, borderColor: `${accent}25` }]}>
                    <PlatformIcon name="figure-run" size={18} color={accent} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.todayRunLabel, { color: accent }]}>TODAY'S RUN</Text>
                      <Text style={[styles.todayRunDescription, { color: colors.text }]} numberOfLines={2}>
                        {todayPrescription.run_description ?? todayPrescription.session_type}
                      </Text>
                      {todayPrescription.target_duration > 0 && (
                        <Text style={[styles.todayRunMeta, { color: colors.textMuted }]}>
                          ~{todayPrescription.target_duration} min
                        </Text>
                      )}
                    </View>
                  </View>
                ) : isStrengthToday && todayPrescription ? (
                  <TouchableOpacity
                    style={[styles.todayRunRow, { backgroundColor: '#3b82f610', borderColor: '#3b82f625' }]}
                    onPress={() => router.push('/workout')}
                    activeOpacity={0.8}
                  >
                    <PlatformIcon name="dumbbell" size={18} color="#3b82f6" />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.todayRunLabel, { color: '#3b82f6' }]}>TODAY'S LIFT</Text>
                      <Text style={[styles.todayRunDescription, { color: colors.text }]} numberOfLines={2}>
                        {todayPrescription.session_type} — {todayPrescription.target_duration} min
                      </Text>
                      <Text style={[styles.todayRunMeta, { color: colors.textMuted }]}>
                        Tap to open Workout tab
                      </Text>
                    </View>
                    <PlatformIcon name="chevron-right" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                ) : todayPrescription?.is_rest ? (
                  <View style={[styles.todayRunRow, { backgroundColor: 'rgba(128,128,128,0.08)', borderColor: colors.border }]}>
                    <PlatformIcon name="moon" size={18} color={colors.textSecondary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.todayRunLabel, { color: colors.textSecondary }]}>REST DAY</Text>
                      <Text style={[styles.todayRunDescription, { color: colors.text }]}>
                        {todayPrescription.rest_suggestion || 'Take it easy today'}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </GlassCard>
            );
          })() : (
            <View style={{ gap: 10 }}>
              <TouchableOpacity
                style={[styles.newPlanCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
                onPress={() => setPlanBuilderVisible(true)}
                activeOpacity={0.8}
              >
                <View style={[styles.newPlanIconWrap, { backgroundColor: `${accent}20` }]}>
                  <PlatformIcon name="sparkles" size={18} color={accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.newPlanTitle, { color: colors.text }]}>Start a Run Plan</Text>
                  <Text style={[styles.newPlanSub, { color: colors.textSecondary }]}>
                    5K, 10K, Half Marathon, Marathon, or general training
                  </Text>
                </View>
                <PlatformIcon name="chevron-right" size={18} color={colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.newPlanCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
                onPress={() => {
                  if (!hasPro) {
                    showProGate('runPlans', openPaywall);
                    return;
                  }
                  setHybridBuilderVisible(true);
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.newPlanIconWrap, { backgroundColor: '#3b82f620' }]}>
                  <PlatformIcon name="dumbbell" size={18} color="#3b82f6" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.newPlanTitleRow}>
                    <Text style={[styles.newPlanTitle, { color: colors.text }]}>Start a Hybrid Plan</Text>
                    {!hasPro && <PlatformIcon name="crown" size={12} color="#d4a93e" />}
                  </View>
                  <Text style={[styles.newPlanSub, { color: colors.textSecondary }]}>
                    Combine strength training with run programming
                  </Text>
                </View>
                <PlatformIcon name="chevron-right" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          )}

          {/* Outdoor / Treadmill mode toggle */}
          <GlassCard style={styles.sectionCard}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>WHERE</Text>
            <View style={styles.modeToggleRow}>
              {(['outdoor', 'treadmill'] as const).map((mode) => {
                const selected = selectedSourceMode === mode;
                const label = mode === 'outdoor' ? 'Outdoor' : 'Treadmill';
                const icon = mode === 'outdoor' ? 'compass' : 'zap';
                return (
                  <TouchableOpacity
                    key={mode}
                    onPress={() => setSelectedSourceMode(mode)}
                    style={[
                      styles.modeToggleBtn,
                      {
                        backgroundColor: selected ? `${accent}20` : 'transparent',
                        borderColor: selected ? accent : colors.border,
                      },
                    ]}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`${label} mode${selected ? ', selected' : ''}`}
                  >
                    <PlatformIcon name={icon} size={14} color={selected ? accent : colors.textSecondary} />
                    <Text style={[styles.modeToggleText, { color: selected ? accent : colors.text }]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {selectedSourceMode === 'treadmill' && (
              <Text style={[styles.modeHint, { color: colors.textMuted }]}>
                Indoor mode — no GPS. Adjust speed during your run.
              </Text>
            )}
          </GlassCard>

          {/* Run type selector */}
          <GlassCard style={styles.sectionCard}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>RUN TYPE</Text>
            <View style={styles.runTypeGrid}>
              {RUN_TYPE_OPTIONS.map((opt) => {
                const selected = selectedRunType === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => setSelectedRunType(opt.value)}
                    style={[
                      styles.runTypePill,
                      {
                        backgroundColor: selected ? `${accent}20` : 'transparent',
                        borderColor: selected ? accent : colors.border,
                      },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.runTypePillText, { color: selected ? accent : colors.text }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </GlassCard>

          {/* Last run summary — tappable to open log drawer */}
          {lastRun && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setLastRunLogVisible(true)}
            >
              <GlassCard style={styles.sectionCard}>
                <View style={styles.cardHeaderRow}>
                  <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>LAST RUN</Text>
                  <PlatformIcon name="chevron-right" size={14} color={colors.textMuted} />
                </View>
                <View style={styles.lastRunRow}>
                  <View style={styles.lastRunMain}>
                    <Text style={[styles.lastRunDate, { color: colors.textSecondary }]}>{relativeDate(lastRun.startTime)}</Text>
                    <Text style={[styles.lastRunDistance, { color: colors.text }]}>
                      {formatDistance(lastRun.distanceMeters, lastRun.splitUnit)}
                    </Text>
                  </View>
                  <View style={styles.lastRunMeta}>
                    <View style={styles.lastRunMetaItem}>
                      <Text style={[styles.lastRunMetaLabel, { color: colors.textMuted }]}>TIME</Text>
                      <Text style={[styles.lastRunMetaValue, { color: colors.text }]}>{formatDuration(lastRun.durationSeconds)}</Text>
                    </View>
                    <View style={styles.lastRunMetaItem}>
                      <Text style={[styles.lastRunMetaLabel, { color: colors.textMuted }]}>PACE</Text>
                      <Text style={[styles.lastRunMetaValue, { color: colors.text }]}>
                        {formatPaceForUnit(lastRun.averagePaceSecondsPerMeter, lastRun.splitUnit)}
                      </Text>
                    </View>
                  </View>
                </View>
              </GlassCard>
            </TouchableOpacity>
          )}

          {/* Mileage tracker — only shows once user has at least 1 run */}
          {run.runHistory.length > 0 && (
            <GlassCard style={styles.sectionCard}>
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>MILEAGE</Text>
                <TouchableOpacity onPress={() => setHistoryDrawerVisible(true)} activeOpacity={0.7}>
                  <Text style={[styles.viewAllLink, { color: accent }]}>View all runs</Text>
                </TouchableOpacity>
              </View>
              <MileageTracker
                runHistory={run.runHistory}
                units={run.preferences.units}
                weeklyGoalMeters={run.preferences.weeklyMileageGoalMeters}
                onUpdateGoal={(meters) => run.updatePreferences({ weeklyMileageGoalMeters: meters })}
              />
            </GlassCard>
          )}

          {/* Permission hint */}
          {permissionStatus === 'denied' && (
            <GlassCard style={[styles.sectionCard, styles.permissionCard]}>
              <PlatformIcon name="alert-triangle" size={16} color="#eab308" />
              <Text style={[styles.permissionText, { color: colors.text }]}>
                Location access is required for GPS tracking. Please enable it in your device Settings.
              </Text>
            </GlassCard>
          )}

          <View style={{ height: 240 }} />
        </ScrollView>

        {/* Fixed bottom controls */}
        <View style={[styles.controlsContainer, { backgroundColor: isDark ? 'rgba(20,20,20,0.92)' : 'rgba(255,255,255,0.92)', borderTopColor: colors.border }]}>
          <RunControls
            status={run.status}
            onStart={handleStart}
            onPause={run.pauseRun}
            onResume={run.resumeRun}
            onStop={handleStop}
            gpsAcquired={gpsAcquired}
          />
        </View>
      </SafeAreaView>

      {/* Run plan builder */}
      <RunPlanBuilderDrawer
        visible={planBuilderVisible}
        onClose={() => setPlanBuilderVisible(false)}
      />

      {/* Hybrid plan builder */}
      <HybridPlanBuilderDrawer
        visible={hybridBuilderVisible}
        onClose={() => setHybridBuilderVisible(false)}
      />

      {/* Run settings — units, auto-pause, audio (nested), HR, mileage goal */}
      <RunSettingsDrawer
        visible={runSettingsVisible}
        onClose={() => setRunSettingsVisible(false)}
      />

      {/* Audio coaching settings (legacy entry — also reachable from RunSettingsDrawer) */}
      <RunAudioSettingsDrawer
        visible={audioSettingsVisible}
        onClose={() => setAudioSettingsVisible(false)}
      />

      {/* Full run history (list + calendar) */}
      <RunHistoryDrawer
        visible={historyDrawerVisible}
        onClose={() => setHistoryDrawerVisible(false)}
      />

      {/* Last run quick-view */}
      <RunLogDrawer
        visible={lastRunLogVisible}
        runId={lastRun?.id ?? null}
        onClose={() => setLastRunLogVisible(false)}
      />

      {/* PR celebration modal */}
      <Modal
        visible={prModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPRModalVisible(false)}
      >
        <Pressable style={styles.prOverlay} onPress={() => setPRModalVisible(false)}>
          <View style={[styles.prCard, { backgroundColor: isDark ? '#1a1a1a' : '#fff', borderColor: accent }]}>
            <PlatformIcon name="trophy" size={36} color={accent} />
            <Text style={[styles.prTitle, { color: colors.text }]}>New Personal Record!</Text>
            <View style={styles.prList}>
              {run.lastNewPRs.map((pr) => (
                <View key={pr.type} style={styles.prRow}>
                  <PlatformIcon name="award" size={14} color={accent} />
                  <Text style={[styles.prRowText, { color: colors.text }]}>{prTypeLabel(pr.type)}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.prCloseButton, { backgroundColor: accent }]}
              onPress={() => setPRModalVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.prCloseText}>Awesome</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Newly-earned badge celebration — pops the queue one at a time */}
      <AchievementModal
        visible={!prModalVisible && badgeQueue.length > 0}
        achievement={badgeQueue.length > 0 ? runBadgeToAchievement(badgeQueue[0]) : null}
        onClose={() => setBadgeQueue((q) => q.slice(1))}
      />
    </View>
  );
}

/** Convert a RunBadge to the Achievement shape expected by AchievementModal. */
function runBadgeToAchievement(b: RunBadge): Achievement {
  return {
    id: b.id,
    iconName: b.iconName,
    label: b.label,
    description: b.description,
    unlocked: true,
    current: b.current,
    target: b.target,
  };
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    position: 'relative',
  },
  summaryTitle: {
    fontSize: 24,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.5,
  },
  // Layout used by the active-run + post-run sub-headers (NOT the tab header — that's <TabHeader />).
  // Active run shows live status indicators here; post-run shows the "Run Complete" title.
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
  },
  audioBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitsToggle: {
    flexDirection: 'row',
    gap: 4,
    padding: 3,
    borderRadius: 18,
    backgroundColor: 'rgba(128,128,128,0.1)',
  },
  unitsButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  unitsButtonText: {
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.5,
  },
  activeTopBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeStatusLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 1.2,
  },
  runTypeLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.8,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 12,
  },
  recoveryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
  },
  recoveryText: {
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
    flex: 1,
  },
  statsCard: {
    padding: 14,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: 2,
  },
  statLabel: {
    fontSize: 9,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.8,
  },
  statValue: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.3,
  },
  sectionCard: {
    padding: 14,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.8,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  viewAllLink: {
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.2,
  },
  runTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  runTypePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  runTypePillText: {
    fontSize: 13,
    fontFamily: 'Outfit_600SemiBold',
  },
  modeToggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  modeToggleText: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
  },
  modeHint: {
    fontSize: 11,
    fontFamily: 'Outfit_400Regular',
    marginTop: 8,
    textAlign: 'center',
  },
  planCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  planCardTitle: {
    fontSize: 17,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.2,
    marginTop: 3,
  },
  planBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  planBadgeText: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.3,
  },
  todayRunRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 4,
  },
  todayRunLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.8,
  },
  todayRunDescription: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
    marginTop: 2,
  },
  todayRunMeta: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
    marginTop: 2,
  },
  newPlanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  newPlanIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newPlanTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  newPlanTitle: {
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
  },
  newPlanSub: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
    marginTop: 2,
  },
  lastRunRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  lastRunMain: {
    flex: 1,
    gap: 2,
  },
  lastRunDate: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
    letterSpacing: 0.3,
  },
  lastRunDistance: {
    fontSize: 22,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.5,
  },
  lastRunMeta: {
    flexDirection: 'row',
    gap: 14,
  },
  lastRunMetaItem: {
    alignItems: 'center',
    gap: 2,
  },
  lastRunMetaLabel: {
    fontSize: 9,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.6,
  },
  lastRunMetaValue: {
    fontSize: 13,
    fontFamily: 'Outfit_600SemiBold',
  },
  permissionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  permissionText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
    lineHeight: 17,
  },
  gpsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(248,113,22,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,22,0.2)',
  },
  gpsBannerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  // Post-run summary
  healthToast: {
    position: 'absolute',
    bottom: 48,
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  healthToastText: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
  },
  heroSummary: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 22,
    borderWidth: 1,
    backgroundColor: 'transparent',
    gap: 6,
  },
  heroSummaryLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 1.2,
  },
  heroSummaryValue: {
    fontSize: 48,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -1.5,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  ratingButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingValue: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
  },
  ratingLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  ratingLegendText: {
    fontSize: 10,
    fontFamily: 'Outfit_500Medium',
    letterSpacing: 0.3,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
    fontSize: 14,
    fontFamily: 'Outfit_400Regular',
    textAlignVertical: 'top',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  actionButton: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionDiscard: {
    flex: 1,
    borderWidth: 1,
  },
  actionSave: {
    flex: 2,
  },
  actionButtonText: {
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
  },
  // PR modal
  prOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  prCard: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 2,
    padding: 28,
    alignItems: 'center',
    gap: 14,
  },
  prTitle: {
    fontSize: 22,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  prList: {
    width: '100%',
    gap: 8,
    marginVertical: 8,
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(128,128,128,0.08)',
  },
  prRowText: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
  },
  prCloseButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  prCloseText: {
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
    color: '#fff',
  },
});
