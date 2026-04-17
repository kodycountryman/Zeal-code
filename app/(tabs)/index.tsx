import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PlatformIcon } from '@/components/PlatformIcon';
import { Platform } from 'react-native';
import { healthService } from '@/services/healthService';
import { useRouter } from 'expo-router';
import { useZealTheme, useAppContext, type WorkoutPlan } from '@/context/AppContext';
import { resolvePushPullLegs } from '@/utils/training';
import { useWorkoutTracking } from '@/context/WorkoutTrackingContext';
import { useSubscription } from '@/context/SubscriptionContext';
import CalendarCard from '@/components/CalendarCard';
import WorkoutOverviewCard from '@/components/WorkoutOverviewCard';
import TrainingScoreCard from '@/components/TrainingScoreCard';
import StreakBottomSheet from '@/components/StreakBottomSheet';
import ZealBackground from '@/components/ZealBackground';
import AmbientGlow from '@/components/AmbientGlow';
import Animated, { FadeInUp } from 'react-native-reanimated';
import GlassCard from '@/components/GlassCard';
import AthleteProfileDrawer from '@/components/drawers/AthleteProfileDrawer';
import AboutMeDrawer from '@/components/drawers/AboutMeDrawer';
import SettingsDrawer from '@/components/drawers/SettingsDrawer';
import ColorThemeDrawer from '@/components/drawers/ColorThemeDrawer';
import EquipmentDrawer from '@/components/drawers/EquipmentDrawer';
import FullCalendarModal from '@/components/FullCalendarModal';
import WorkoutLogDetail from '@/components/WorkoutLogDetail';
import LogPreviousWorkout from '@/components/LogPreviousWorkout';
import InsightsDrawer from '@/components/drawers/InsightsDrawer';
import BuildWorkoutDrawer from '@/components/drawers/BuildWorkoutDrawer';
import WorkoutPlanDrawer from '@/components/drawers/WorkoutPlanDrawer';
import PlanTypeChooserSheet from '@/components/drawers/PlanTypeChooserSheet';
import RunPlanBuilderDrawer from '@/components/drawers/RunPlanBuilderDrawer';
import HybridPlanBuilderDrawer from '@/components/drawers/HybridPlanBuilderDrawer';
import ExerciseCatalogDrawer from '@/components/drawers/ExerciseCatalogDrawer';
import ActivePlanDrawer from '@/components/drawers/ActivePlanDrawer';
import HelpFaqDrawer from '@/components/drawers/HelpFaqDrawer';
import WorkoutPreviewModal from '@/components/WorkoutPreviewModal';
import PlanWorkoutSheet from '@/components/PlanWorkoutSheet';
import PlanDayPreviewDrawer from '@/components/drawers/PlanDayPreviewDrawer';
import RunLogDrawer from '@/components/drawers/RunLogDrawer';
import type { DayPrescription } from '@/services/planEngine';
import * as Haptics from 'expo-haptics';
import { mockBibleVerse } from '@/mocks/homeData';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { PRO_GOLD } from '@/services/proGate';
import StartAnotherWorkoutSheet from '@/components/StartAnotherWorkoutSheet';
import { WORKOUT_STYLE_COLORS } from '@/constants/colors';
import { PRO_STYLES_SET } from '@/services/proGate';
import { useSeventyFiveHard } from '@/context/SeventyFiveHardContext';
import { useRun } from '@/context/RunContext';
import SeventyFiveHardBanner from '@/components/SeventyFiveHardBanner';
import OutdoorWorkoutCard from '@/components/OutdoorWorkoutCard';
import RunOverviewCard from '@/components/run/RunOverviewCard';
import TabHeader from '@/components/TabHeader';
import SeventyFiveHardChecklist from '@/components/SeventyFiveHardChecklist';
import { useTourTarget, useAppTour } from '@/context/AppTourContext';


function getMuscleGroupsFromSplit(split: string, style: string): string {
  const s = split.toLowerCase();
  if (s.includes('push')) return 'Chest • Shoulders • Triceps';
  if (s.includes('pull')) return 'Back • Biceps • Rear Delts';
  if (s.includes('legs')) return 'Quads • Hamstrings • Glutes';
  if (s.includes('upper')) return 'Chest • Back • Shoulders';
  if (s.includes('lower')) return 'Quads • Hamstrings • Glutes';
  if (s.includes('core') || s.includes('abs')) return 'Abs • Core • Obliques';
  if (s.includes('chest')) return 'Chest • Front Delts • Triceps';
  if (s.includes('back')) return 'Lats • Traps • Biceps';
  if (s.includes('shoulder')) return 'Shoulders • Traps • Delts';
  if (s.includes('arm')) return 'Biceps • Triceps • Forearms';
  const st = style.toLowerCase();
  if (st === 'hiit') return 'Full Body • Conditioning';
  if (st === 'mobility' || st === 'pilates') return 'Flexibility • Mobility';
  if (st === 'hyrox') return 'Functional • Conditioning';
  return 'Full Body';
}



export default function HomeScreen() {
  const { colors, accent, isZeal, isDark } = useZealTheme();
  const ctx = useAppContext();
  const tracking = useWorkoutTracking();
  const { hasPro, openPaywall } = useSubscription();
  const seventyFiveHard = useSeventyFiveHard();
  const run = useRun();
  const completedRunDates = useMemo(() => {
    const set = new Set<string>();
    for (const r of run.runHistory) set.add(r.date);
    return set;
  }, [run.runHistory]);
  const router = useRouter();
  const tourProfileRef = useTourTarget('profile-avatar');
  const tourScoreRef = useTourTarget('training-score-card');
  const { resetTour, startTour, tourActive } = useAppTour();
  const [activePlanInitialTab, setActivePlanInitialTab] = useState<0 | 1 | 2 | undefined>(undefined);
  const glowColor: string = WORKOUT_STYLE_COLORS[ctx.workoutStyle] ?? accent;

  // Pro style modal — shown once on mount if user selected a Pro style during onboarding
  const [proStyleModalVisible, setProStyleModalVisible] = useState(false);
  const proStyleModalShown = useRef(false);

  useEffect(() => {
    if (proStyleModalShown.current) return;
    if (!hasPro && PRO_STYLES_SET.has(ctx.workoutStyle)) {
      proStyleModalShown.current = true;
      setProStyleModalVisible(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-dismiss if user purchases while modal is open
  useEffect(() => {
    if (hasPro && proStyleModalVisible) {
      setProStyleModalVisible(false);
    }
  }, [hasPro, proStyleModalVisible]);

  const handleProStyleDismiss = useCallback(() => {
    setProStyleModalVisible(false);
    ctx.setWorkoutStyle('Strength');
    // Patch storage directly — ctx.saveState() captures stale workoutStyle closure
    AsyncStorage.getItem('@zeal_app_state_v4').then(raw => {
      if (raw) {
        try {
          const d = JSON.parse(raw);
          d.workoutStyle = 'Strength';
          AsyncStorage.setItem('@zeal_app_state_v4', JSON.stringify(d)).catch(console.warn);
        } catch { /* ignore */ }
      }
    }).catch(console.warn);
  }, [ctx]);
  const cardAnims = useMemo(() => ({
    d90:  FadeInUp.delay(90).springify().damping(18).stiffness(160),
    d150: FadeInUp.delay(150).springify().damping(18).stiffness(160),
    d210: FadeInUp.delay(210).springify().damping(18).stiffness(160),
    d240: FadeInUp.delay(240).springify().damping(18).stiffness(160),
    d270: FadeInUp.delay(270).springify().damping(18).stiffness(160),
    d300: FadeInUp.delay(300).springify().damping(18).stiffness(160),
    d330: FadeInUp.delay(330).springify().damping(18).stiffness(160),
    d390: FadeInUp.delay(390).springify().damping(18).stiffness(160),
  }), []);

  const firstName = ctx.userName ? ctx.userName.split(' ')[0] : '';
  const todayPrescription = ctx.getTodayPrescription();
  const todayPlannedWorkout = useMemo(() => {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return ctx.getPlannedWorkoutForDate(dateStr);
  }, [ctx.getPlannedWorkoutForDate, ctx.plannedWorkouts]);

  const effectiveWorkout = useMemo(() => {
    const ov = ctx.workoutOverride;
    const lm = ctx.lastModifyState;
    const hasPlan = !!ctx.activePlan;

    let effectiveStyle = ov?.style ?? (
      hasPlan && todayPrescription?.style
        ? todayPrescription.style
        : (lm?.style ?? ctx.workoutStyle)
    );

    if (!hasPro && PRO_STYLES_SET.has(effectiveStyle)) {
      effectiveStyle = 'Strength';
    }

    const rawSplit = ov?.split ?? (
      hasPlan && todayPrescription?.session_type
        ? todayPrescription.session_type
        : (lm?.split ?? ctx.trainingSplit)
    );
    const effectiveSplit = rawSplit === 'Push, Pull, Legs'
      ? resolvePushPullLegs(ctx.muscleReadiness)
      : rawSplit;

    const effectiveDuration = ov?.duration ?? (
      hasPlan && todayPrescription?.target_duration
        ? todayPrescription.target_duration
        : (lm?.duration ?? ctx.targetDuration)
    );

    return { style: effectiveStyle, split: effectiveSplit, duration: effectiveDuration };
  }, [
    ctx.workoutOverride,
    ctx.lastModifyState,
    ctx.activePlan,
    ctx.workoutStyle,
    ctx.trainingSplit,
    ctx.targetDuration,
    ctx.muscleReadiness,
    todayPrescription?.style,
    todayPrescription?.session_type,
    todayPrescription?.target_duration,
    hasPro,
  ]);

  const workoutTitle = todayPrescription?.is_rest
    ? 'Rest Day'
    : ctx.currentWorkoutTitle
      || (todayPlannedWorkout ? todayPlannedWorkout.split : null)
      || (todayPrescription?.session_type || effectiveWorkout.split);
  const workoutDuration = todayPrescription?.is_rest
    ? todayPrescription.rest_suggestion || 'Recovery'
    : `${todayPlannedWorkout?.duration ?? todayPrescription?.target_duration ?? effectiveWorkout.duration} min`;

  const numericDuration = parseInt(workoutDuration) || effectiveWorkout.duration || 60;
  const exerciseCount = Math.round(numericDuration / 8);
  const titleSourceSplit = todayPlannedWorkout?.split ?? todayPrescription?.session_type ?? effectiveWorkout.split;
  const muscleGroups = !todayPrescription?.is_rest && workoutTitle !== 'Rest Day'
    ? getMuscleGroupsFromSplit(titleSourceSplit, effectiveWorkout.style)
    : undefined;

  const [healthCalories, setHealthCalories] = useState<number | null>(null);
  const [healthSteps, setHealthSteps] = useState<number | null>(null);
  const [healthHeartRate, setHealthHeartRate] = useState<number | null>(null);

  useEffect(() => {
    if (!ctx.healthConnected || !ctx.healthSyncEnabled || Platform.OS === 'web') return;
    let cancelled = false;
    healthService.getAllHealthData().then((data) => {
      if (cancelled) return;
      setHealthCalories(data.activeCalories);
      setHealthSteps(data.steps);
      setHealthHeartRate(data.restingHeartRate);
      __DEV__ && console.log('[Home] Health metrics loaded:', data);
    }).catch((e) => {
      if (!cancelled) __DEV__ && console.log('[Home] Health metrics error:', e);
    });
    return () => { cancelled = true; };
  }, [ctx.healthConnected, ctx.healthSyncEnabled]);

  // Auto-open plan drawer when background generation completes
  useEffect(() => {
    if (ctx.planGenProgress?.phase === 'done') {
      ctx.clearPlanGenProgress();
      setTimeout(() => {
        tracking.setActivePlanVisible(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }, 400);
    }
  }, [ctx.planGenProgress?.phase]);

  const [streakSheetVisible, setStreakSheetVisible] = useState(false);
  const [planSheetVisible, setPlanSheetVisible] = useState(false);
  const [planSheetDate, setPlanSheetDate] = useState<string | null>(null);
  const [planDayPreviewVisible, setPlanDayPreviewVisible] = useState(false);
  const [planDayPreviewDay, setPlanDayPreviewDay] = useState<DayPrescription | null>(null);
  const [runLogVisible, setRunLogVisible] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [profileVisible, setProfileVisible] = useState(false);
  const [aboutMeVisible, setAboutMeVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [colorThemeVisible, setColorThemeVisible] = useState(false);
  const [equipmentVisible, setEquipmentVisible] = useState(false);
  const [insightsVisible, setInsightsVisible] = useState(false);
  const [helpFaqVisible, setHelpFaqVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);

  const handlePreviewPress = useCallback(() => {
    // Open immediately; modal will show either the populated preview or the generating animation.
    void tracking.ensureTodayWorkoutGenerated();
    setPreviewVisible(true);
  }, [tracking]);

  const [anotherWorkoutVisible, setAnotherWorkoutVisible] = useState(false);
  const [editingPlan, setEditingPlan] = useState<WorkoutPlan | undefined>(undefined);
  // Local visibility for the Run + Hybrid builders routed through the new
  // PlanTypeChooserSheet. Strength builder keeps its existing global
  // tracking.workoutPlanVisible flag so the FAB and ActivePlanDrawer
  // edit-flow keep working unchanged.
  const [runPlanBuilderVisible, setRunPlanBuilderVisible] = useState(false);
  const [hybridPlanBuilderVisible, setHybridPlanBuilderVisible] = useState(false);

  const cardBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  const miniCardShadow = !isDark ? {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  } : {};

  const liveScore = useMemo(() => {
    if (tracking.isWorkoutActive) {
      return ctx.trainingScore + tracking.liveTrainingScore;
    }
    return ctx.trainingScore;
  }, [ctx.trainingScore, tracking.isWorkoutActive, tracking.liveTrainingScore]);

  const liveDailyTarget = useMemo(() => {
    if (tracking.isWorkoutActive) {
      return ctx.targetDone + tracking.liveTrainingScore;
    }
    return ctx.targetDone;
  }, [ctx.targetDone, tracking.isWorkoutActive, tracking.liveTrainingScore]);

  const tier = useMemo(() => {
    if (liveScore === 0) return 'Getting Started';
    if (liveScore < 30) return 'Building Momentum';
    if (liveScore < 60) return 'On Fire';
    return 'Elite';
  }, [liveScore]);

  const readiness = useMemo(() => {
    if (tracking.isWorkoutActive && tracking.readinessPercent > 0) {
      return tracking.readinessPercent;
    }
    // No workout history = all muscles are fresh, always 100
    if (tracking.workoutHistory.length === 0) return 100;
    const avg = ctx.muscleReadiness.reduce((sum, m) => sum + m.value, 0) / (ctx.muscleReadiness.length || 1);
    return Math.round(avg);
  }, [tracking.isWorkoutActive, tracking.readinessPercent, tracking.workoutHistory.length, ctx.muscleReadiness]);

  const weeklyHours = useMemo(() => {
    const min = tracking.weeklyHoursMin;
    if (min === 0) return '0h';
    if (min >= 60) return `${Math.round(min / 60 * 10) / 10}h`;
    return `${min}m`;
  }, [tracking.weeklyHoursMin]);

  const todayLogs = tracking.todayLogs;
  const hasTodayWorkout = todayLogs.length > 0;
  const latestTodayLog = todayLogs[0] ?? null;

  const handleCalendarPress = useCallback(() => {
    tracking.setCalendarModalVisible(true);
  }, [tracking]);

  const completedDates = useMemo(() => {
    const set = new Set<string>();
    for (const log of tracking.workoutHistory) {
      set.add(log.date);
    }
    return set;
  }, [tracking.workoutHistory]);

  // Merge manually planned workouts + active plan schedule days for calendar dots
  const allPlannedWorkouts = useMemo(() => {
    const merged = [...(ctx.plannedWorkouts ?? [])];
    const existingDates = new Set(merged.map(p => p.date));
    if (ctx.planSchedule && ctx.activePlan) {
      for (const week of (ctx.planSchedule as any).weeks ?? []) {
        for (const day of week.days ?? []) {
          if (!day.is_rest && !existingDates.has(day.date)) {
            merged.push({
              id: `plan_${day.date}`,
              date: day.date,
              style: day.style ?? ctx.activePlan.style,
              split: day.session_type ?? '',
              muscles: [],
              duration: day.target_duration ?? 0,
              createdAt: '',
            });
          }
        }
      }
    }
    return merged;
  }, [ctx.plannedWorkouts, ctx.planSchedule, ctx.activePlan]);

  const handleDayPress = useCallback((dateStr: string, dayOffset: number) => {
    // Check for completed workout logs first
    const logs = tracking.getLogsForDate(dateStr);
    if (logs.length > 0) {
      tracking.setSelectedLogId(logs[0].id);
      tracking.setWorkoutLogDetailVisible(true);
      return;
    }
    // No workout — check for completed runs on this date. Most-recent first
    // since runHistory is stored in reverse-chronological order.
    const runOnDay = run.runHistory.find(r => r.date === dateStr);
    if (runOnDay) {
      setSelectedRunId(runOnDay.id);
      setRunLogVisible(true);
      return;
    }
    // If active plan, find the prescription for this date and show preview
    if (ctx.activePlan && ctx.planSchedule) {
      for (const week of (ctx.planSchedule as any).weeks ?? []) {
        for (const day of week.days ?? []) {
          if (day.date === dateStr && !day.is_rest) {
            setPlanDayPreviewDay(day);
            setPlanDayPreviewVisible(true);
            return;
          }
        }
      }
    }
    // Future days without active plan → manual plan sheet
    if (dayOffset > 0) {
      setPlanSheetDate(dateStr);
      setPlanSheetVisible(true);
      return;
    }
  }, [tracking, ctx.activePlan, ctx.planSchedule, run.runHistory]);

  const handleViewTodayLog = useCallback(() => {
    if (latestTodayLog) {
      tracking.setSelectedLogId(latestTodayLog.id);
      tracking.setWorkoutLogDetailVisible(true);
    }
    router.push('/train?mode=workout');
  }, [tracking, latestTodayLog, router]);



  const handleLoadSavedWorkout = useCallback((workout: { id: string; name: string; exercises: { exerciseId: string; name: string }[]; defaultFocus: string; createdAt: string; lastUsed: string }) => {
    __DEV__ && console.log('[Home] Loading saved workout:', workout.name, 'with', workout.exercises.length, 'exercises');
    ctx.setLoadedWorkout(workout);
    ctx.setCurrentWorkoutTitle(workout.name);
    ctx.saveState();
    router.push('/train?mode=workout');
  }, [ctx, router]);


  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AmbientGlow color={glowColor} opacity={0.06} />
      {isZeal && <ZealBackground />}

      <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
        <TabHeader
          ref={tourProfileRef as any}
          title={firstName || 'Home'}
          onAvatarPress={() => setProfileVisible(true)}
          avatarTestID="profile-avatar"
        />
      </SafeAreaView>

      {/* Background plan generation progress */}
      {ctx.planGenProgress && ctx.planGenProgress.phase === 'background' && (
        <TouchableOpacity
          style={[styles.genProgressBanner, { borderBottomColor: colors.border }]}
          onPress={() => tracking.setActivePlanVisible(true)}
          activeOpacity={0.7}
        >
          <View style={styles.genProgressRow}>
            <PlatformIcon name="sparkles" size={12} color={accent} />
            <Text style={[styles.genProgressText, { color: colors.textSecondary }]}>
              Building plan... {ctx.planGenProgress.current}/{ctx.planGenProgress.total}
            </Text>
          </View>
          <View style={[styles.genProgressTrack, { backgroundColor: colors.border }]}>
            <View style={[styles.genProgressFill, {
              width: `${Math.round((ctx.planGenProgress.current / ctx.planGenProgress.total) * 100)}%` as any,
              backgroundColor: accent,
            }]} />
          </View>
        </TouchableOpacity>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        testID="home-scroll"
      >
        {/* ─── 75 Hard card stack ─────────────────────────────────────── */}
        {seventyFiveHard.isActive && !!ctx.activePlan?.is75Hard ? (<>
          <Animated.View key="75h-calendar" entering={cardAnims.d90}>
            <CalendarCard
              streak={ctx.streak}
              onStreakPress={() => setStreakSheetVisible(true)}
              onCalendarPress={handleCalendarPress}
              onDayPress={handleDayPress}
              completedDates={completedDates}
              plannedWorkouts={allPlannedWorkouts}
              completedRunDates={completedRunDates}
              variant={isDark ? 'glass' : 'solid'}
            />
          </Animated.View>

          <Animated.View key="75h-banner" entering={cardAnims.d150}>
            <SeventyFiveHardBanner
              onPress={() => { setActivePlanInitialTab(2); tracking.setActivePlanVisible(true); }}
              variant={isDark ? 'glass' : 'solid'}
            />
          </Animated.View>

          {/* Workout 1 — AI-generated indoor workout */}
          {tracking.workoutHistory.length > 0 && (
            <Animated.View key="75h-workout1" entering={cardAnims.d210}>
              <WorkoutOverviewCard
                title={workoutTitle}
                style={tracking.currentGeneratedWorkout?.style ?? effectiveWorkout.style}
                duration={workoutDuration}
                muscleGroups={muscleGroups}
                exerciseCount={exerciseCount}
                onPress={hasTodayWorkout ? handleViewTodayLog : (ctx.activePlan ? () => tracking.setActivePlanVisible(true) : handlePreviewPress)}
                onOpenActivePlan={ctx.activePlan ? () => tracking.setActivePlanVisible(true) : undefined}
                activePlan={ctx.activePlan}
                variant={isDark ? 'glass' : 'solid'}
                completedLog={hasTodayWorkout ? latestTodayLog : null}
              />
            </Animated.View>
          )}

          {/* Workout 2 — Outdoor workout */}
          <Animated.View key="75h-outdoor" entering={cardAnims.d270}>
            <OutdoorWorkoutCard variant={isDark ? 'glass' : 'solid'} />
          </Animated.View>

          {/* Run overview (only renders when there's a planned run today or run history) */}
          <Animated.View key="75h-run" entering={cardAnims.d300}>
            <RunOverviewCard
              todayPrescription={todayPrescription}
              variant={isDark ? 'glass' : 'solid'}
            />
          </Animated.View>

          {/* Daily checklist */}
          <Animated.View key="75h-checklist" entering={cardAnims.d330}>
            <SeventyFiveHardChecklist variant={isDark ? 'glass' : 'solid'} />
          </Animated.View>

          <Animated.View entering={cardAnims.d390}>
            {tracking.workoutHistory.length > 0 ? (
              <TrainingScoreCard
                score={liveScore}
                tier={tier}
                readiness={readiness}
                targetDone={liveDailyTarget}
                targetTotal={12}
                calories={healthCalories}
                steps={healthSteps}
                heartRate={healthHeartRate}
                weeklyHoursMin={tracking.weeklyHoursMin}
                lastWorkout={{ split: tracking.workoutHistory[0].split, duration: tracking.workoutHistory[0].duration }}
                onPress={() => setInsightsVisible(true)}
                variant={isDark ? 'glass' : 'solid'}
              />
            ) : (
              <GlassCard
                onPress={() => setInsightsVisible(true)}
                variant={isDark ? 'glass' : 'solid'}
                style={{ padding: 22, alignItems: 'center' as const, opacity: 0.65 }}
              >
                <PlatformIcon name="bar-chart-3" size={28} color={colors.textMuted} />
                <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 16, color: colors.text, marginTop: 10 }}>No insights yet</Text>
                <Text style={{ fontFamily: 'Outfit_400Regular', fontSize: 13, color: colors.textSecondary, marginTop: 4, textAlign: 'center' as const, lineHeight: 18 }}>
                  Log a workout to see your training score, analytics, and more.
                </Text>
              </GlassCard>
            )}
          </Animated.View>

          <View style={styles.bibleContainer} testID="bible-verse">
            <Text style={[styles.bibleText, { color: colors.textSecondary }]}>
              {mockBibleVerse.text}
            </Text>
            <Text style={[styles.bibleRef, { color: colors.textSecondary }]}>
              {mockBibleVerse.reference}
            </Text>
          </View>
        </>) : (<>
          {/* ─── Normal card stack ──────────────────────────────────────── */}
          <Animated.View entering={cardAnims.d90}>
            <CalendarCard
              streak={ctx.streak}
              onStreakPress={() => setStreakSheetVisible(true)}
              onCalendarPress={handleCalendarPress}
              onDayPress={handleDayPress}
              completedDates={completedDates}
              plannedWorkouts={allPlannedWorkouts}
              completedRunDates={completedRunDates}
              variant={isDark ? 'glass' : 'solid'}
            />
          </Animated.View>

          {tracking.workoutHistory.length === 0 && (
            <Animated.View entering={cardAnims.d150}>
              {(() => {
                const ALL_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                const todayDow = new Date().getDay();
                // Build 7-day window starting from today
                const DAY_LABELS = Array.from({ length: 7 }, (_, i) => ALL_LABELS[(todayDow + i) % 7]);
                return (
                  <GlassCard
                    style={[styles.day1Card, { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)', borderWidth: 1 }]}
                    onPress={() => router.push('/train?mode=workout')}
                    activeOpacity={0.8}
                    variant={isDark ? 'glass' : 'solid'}
                  >
                    <View style={styles.day1Top}>
                      <View>
                        <Text style={[styles.day1Heading, { color: accent }]}>Day 1.</Text>
                        <Text style={[styles.day1Sub, { color: colors.textSecondary }]}>
                          {firstName ? `${firstName}, your` : 'Your'} {effectiveWorkout.style} workout is ready. Let's go.
                        </Text>
                      </View>
                      <PlatformIcon name="flame" size={22} color={accent} strokeWidth={1.8} />
                    </View>
                    <View style={styles.streakRow}>
                      {DAY_LABELS.map((d, i) => {
                        const isToday = i === 0;
                        return (
                          <View key={i} style={styles.streakDayCol}>
                            <View style={[
                              styles.streakCircle,
                              isToday
                                ? { backgroundColor: accent, borderColor: accent }
                                : { backgroundColor: 'transparent', borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' },
                            ]}>
                              {isToday && <PlatformIcon name="zap" size={10} color="#fff" fill="#fff" />}
                            </View>
                            <Text style={[styles.streakDayLabel, { color: isToday ? accent : colors.textSecondary }]}>{d}</Text>
                          </View>
                        );
                      })}
                    </View>
                    <Text style={[styles.day1Cta, { color: accent }]}>Go to workout →</Text>
                  </GlassCard>
                );
              })()}
            </Animated.View>
          )}

          {tracking.workoutHistory.length > 0 && (
            <Animated.View entering={cardAnims.d210}>
              <WorkoutOverviewCard
                title={workoutTitle}
                style={tracking.currentGeneratedWorkout?.style ?? effectiveWorkout.style}
                duration={workoutDuration}
                muscleGroups={muscleGroups}
                exerciseCount={exerciseCount}
                onPress={hasTodayWorkout ? handleViewTodayLog : (ctx.activePlan ? () => tracking.setActivePlanVisible(true) : handlePreviewPress)}
                onOpenActivePlan={ctx.activePlan ? () => tracking.setActivePlanVisible(true) : undefined}
                activePlan={ctx.activePlan}
                variant={isDark ? 'glass' : 'solid'}
                completedLog={hasTodayWorkout ? latestTodayLog : null}
              />
            </Animated.View>
          )}

          <Animated.View entering={cardAnims.d240}>
            <RunOverviewCard
              todayPrescription={todayPrescription}
              variant={isDark ? 'glass' : 'solid'}
            />
          </Animated.View>

          <Animated.View entering={cardAnims.d270}>
            <View ref={tourScoreRef} collapsable={false}>
            {tracking.workoutHistory.length > 0 ? (
              <TrainingScoreCard
                score={liveScore}
                tier={tier}
                readiness={readiness}
                targetDone={liveDailyTarget}
                targetTotal={12}
                calories={healthCalories}
                steps={healthSteps}
                heartRate={healthHeartRate}
                weeklyHoursMin={tracking.weeklyHoursMin}
                lastWorkout={{ split: tracking.workoutHistory[0].split, duration: tracking.workoutHistory[0].duration }}
                onPress={() => setInsightsVisible(true)}
                variant={isDark ? 'glass' : 'solid'}
              />
            ) : (
              <GlassCard
                onPress={() => setInsightsVisible(true)}
                variant={isDark ? 'glass' : 'solid'}
                style={{ padding: 22, alignItems: 'center' as const, opacity: 0.65 }}
              >
                <PlatformIcon name="bar-chart-3" size={28} color={colors.textMuted} />
                <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 16, color: colors.text, marginTop: 10 }}>No insights yet</Text>
                <Text style={{ fontFamily: 'Outfit_400Regular', fontSize: 13, color: colors.textSecondary, marginTop: 4, textAlign: 'center' as const, lineHeight: 18 }}>
                  Log a workout to see your training score, analytics, and more.
                </Text>
              </GlassCard>
            )}
            </View>
          </Animated.View>


          <View style={styles.bibleContainer} testID="bible-verse">
            <Text style={[styles.bibleText, { color: colors.textSecondary }]}>
              {mockBibleVerse.text}
            </Text>
            <Text style={[styles.bibleRef, { color: colors.textSecondary }]}>
              {mockBibleVerse.reference}
            </Text>
          </View>
        </>)}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <StartAnotherWorkoutSheet
        visible={anotherWorkoutVisible}
        onClose={() => setAnotherWorkoutVisible(false)}
        onComplete={() => router.push('/train?mode=workout')}
      />

      <StreakBottomSheet
        visible={streakSheetVisible}
        streak={ctx.streak}
        onClose={() => setStreakSheetVisible(false)}
      />

      <AthleteProfileDrawer
        visible={profileVisible}
        onClose={() => setProfileVisible(false)}
        onOpenAboutMe={() => setAboutMeVisible(true)}
        onOpenInsights={() => setInsightsVisible(true)}
        onOpenSettings={() => setSettingsVisible(true)}
      />

      <AboutMeDrawer
        visible={aboutMeVisible}
        onClose={() => setAboutMeVisible(false)}
        onBack={() => setAboutMeVisible(false)}
      />

      <SettingsDrawer
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        onBack={() => setSettingsVisible(false)}
        onOpenColorTheme={() => setColorThemeVisible(true)}
        onOpenEquipment={() => setEquipmentVisible(true)}
        onOpenExerciseCatalog={() => tracking.setExerciseCatalogVisible(true)}
        onOpenHelpFaq={() => setHelpFaqVisible(true)}
        onReplayTour={() => {
          // Close ALL open drawers before starting tour
          setSettingsVisible(false);
          setProfileVisible(false);
          setAboutMeVisible(false);
          setInsightsVisible(false);
          setColorThemeVisible(false);
          setEquipmentVisible(false);
          setHelpFaqVisible(false);
          resetTour();
          // Wait for bottom sheets to fully dismiss, then navigate + start
          setTimeout(() => {
            router.push('/train?mode=workout');
            setTimeout(() => startTour(), 600);
          }, 500);
        }}
      />

      <ColorThemeDrawer
        visible={colorThemeVisible}
        onClose={() => setColorThemeVisible(false)}
        onBack={() => setColorThemeVisible(false)}
      />

      <EquipmentDrawer
        visible={equipmentVisible}
        onClose={() => setEquipmentVisible(false)}
        onBack={() => setEquipmentVisible(false)}
      />

      <FullCalendarModal />
      <WorkoutLogDetail />
      <LogPreviousWorkout />

      <InsightsDrawer
        visible={insightsVisible}
        onClose={() => setInsightsVisible(false)}
        onBack={() => setInsightsVisible(false)}
      />

      <BuildWorkoutDrawer
        visible={tracking.buildWorkoutVisible}
        onClose={() => tracking.setBuildWorkoutVisible(false)}
        onLoadWorkout={handleLoadSavedWorkout}
      />

      <WorkoutPlanDrawer
        visible={tracking.workoutPlanVisible}
        onClose={() => { tracking.setWorkoutPlanVisible(false); setEditingPlan(undefined); }}
        editPlan={editingPlan}
      />

      <PlanTypeChooserSheet
        visible={tracking.planChooserVisible}
        onClose={() => tracking.setPlanChooserVisible(false)}
        onSelectStrength={() => {
          tracking.setPlanChooserVisible(false);
          setTimeout(() => tracking.setWorkoutPlanVisible(true), 250);
        }}
        onSelectRun={() => {
          tracking.setPlanChooserVisible(false);
          setTimeout(() => setRunPlanBuilderVisible(true), 250);
        }}
        onSelectHybrid={() => {
          tracking.setPlanChooserVisible(false);
          setTimeout(() => setHybridPlanBuilderVisible(true), 250);
        }}
      />

      <RunPlanBuilderDrawer
        visible={runPlanBuilderVisible}
        onClose={() => setRunPlanBuilderVisible(false)}
      />

      <HybridPlanBuilderDrawer
        visible={hybridPlanBuilderVisible}
        onClose={() => setHybridPlanBuilderVisible(false)}
      />

      <ExerciseCatalogDrawer
        visible={tracking.exerciseCatalogVisible}
        onClose={() => tracking.setExerciseCatalogVisible(false)}
        onBack={() => tracking.setExerciseCatalogVisible(false)}
      />

      <ActivePlanDrawer
        visible={tracking.activePlanVisible}
        initialTab={activePlanInitialTab}
        onClose={() => { tracking.setActivePlanVisible(false); setActivePlanInitialTab(undefined); }}
        onStartNewPlan={() => tracking.setPlanChooserVisible(true)}
        onEditPlan={() => {
          setEditingPlan(ctx.activePlan ?? undefined);
          tracking.setWorkoutPlanVisible(true);
        }}
      />

      <HelpFaqDrawer
        visible={helpFaqVisible}
        onClose={() => setHelpFaqVisible(false)}
        onBack={() => setHelpFaqVisible(false)}
      />

      <WorkoutPreviewModal
        visible={previewVisible}
        onClose={() => setPreviewVisible(false)}
        onGoToWorkout={() => router.push('/train?mode=workout')}
      />

      <PlanWorkoutSheet
        visible={planSheetVisible}
        targetDate={planSheetDate}
        onClose={() => {
          setPlanSheetVisible(false);
          setPlanSheetDate(null);
        }}
      />

      <PlanDayPreviewDrawer
        visible={planDayPreviewVisible}
        onClose={() => {
          setPlanDayPreviewVisible(false);
          setPlanDayPreviewDay(null);
        }}
        onClosePlan={() => {
          setPlanDayPreviewVisible(false);
          setPlanDayPreviewDay(null);
        }}
        day={planDayPreviewDay}
      />

      <RunLogDrawer
        visible={runLogVisible}
        onClose={() => {
          setRunLogVisible(false);
          setSelectedRunId(null);
        }}
        runId={selectedRunId}
      />

      {/* Pro style onboarding modal */}
      <Modal
        visible={proStyleModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.proModalOverlay}>
          <View style={[styles.proModalCard, { backgroundColor: isDark ? '#1a1a1a' : '#fff' }]}>
            <View style={styles.proModalIconWrap}>
              <PlatformIcon name="crown" size={28} color={PRO_GOLD} />
            </View>
            <View style={styles.proModalTitleRow}>
              <Text style={[styles.proModalTitle, { color: colors.text }]}>Pro Training Style</Text>
            </View>
            <Text style={[styles.proModalBody, { color: colors.textSecondary }]}>
              You selected{' '}
              <Text style={{ color: accent, fontFamily: 'Outfit_800ExtraBold' }}>{ctx.workoutStyle}</Text>
              {' '}— a Zeal Pro training style.{'\n\n'}
              Start a free trial to train in this style. If you close without upgrading, we'll automatically switch you to{' '}
              <Text style={{ color: colors.text, fontFamily: 'Outfit_700Bold' }}>Strength</Text>.
            </Text>
            <TouchableOpacity
              style={styles.proModalTrialBtn}
              onPress={() => { setProStyleModalVisible(false); openPaywall(); }}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#ff8c35', '#f87116', '#d96010']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.proModalTrialGradient}
              >
                <Text style={styles.proModalTrialText}>Start Free Trial</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleProStyleDismiss} activeOpacity={0.7} style={styles.proModalDismiss}>
              <Text style={[styles.proModalDismissText, { color: colors.textMuted }]}>Switch me to Strength</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  genProgressBanner: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
  },
  genProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  genProgressText: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
  },
  genProgressTrack: {
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  genProgressFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 12,
    flexGrow: 1,
  },
  bibleContainer: {
    marginTop: 8,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 4,
  },
  bibleText: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 18,
  },
  day1Card: {
    borderRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
    gap: 16,
    overflow: 'hidden',
  },
  day1Top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  day1Heading: {
    fontSize: 28,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  day1Sub: {
    fontSize: 13,
    fontFamily: 'Outfit_400Regular',
    letterSpacing: 0.1,
    marginTop: 2,
  },
  streakRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  streakDayCol: {
    alignItems: 'center',
    gap: 5,
  },
  streakCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakDayLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_400Regular',
    letterSpacing: 0.2,
  },
  day1Cta: {
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.2,
    marginTop: -4,
  },
  bibleRef: {
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  bottomSpacer: {
    height: 130,
  },
  miniCardsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  miniCard: {
    flex: 1,
    borderRadius: 26,
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
  },
  miniLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  miniValue: {
    fontSize: 22,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  todayCardsSection: {
    gap: 8,
  },
  todayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 26,
    padding: 14,
    overflow: 'hidden',
  },
  todayCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  todayCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayCardText: {
    flex: 1,
    gap: 2,
  },
  todayCardTitle: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: -0.2,
  },
  todayCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  todayCardSub: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  drawerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  drawerSheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 22,
    paddingBottom: 44,
  },
  drawerHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  drawerClose: {
    position: 'absolute',
    top: 22,
    right: 22,
    zIndex: 10,
  },
  drawerContent: {
    gap: 16,
  },
  drawerTitle: {
    fontSize: 22,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.5,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  durationChip: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: 'center',
  },
  durationChipText: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
  },
  styleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  styleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  styleChipDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  styleChipText: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
  },
  splitChip: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  splitChipText: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
  },
  drawerNextBtn: {
    backgroundColor: '#f87116',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  drawerNextBtnText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
  letsGoBtn: {
    backgroundColor: '#f87116',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  letsGoBtnText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
  proModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  proModalCard: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 28,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  proModalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${PRO_GOLD}18`,
    borderWidth: 1,
    borderColor: `${PRO_GOLD}40`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proModalTitleRow: {
    alignItems: 'center',
  },
  proModalTitle: {
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
    textAlign: 'center',
  },
  proModalBody: {
    fontSize: 14,
    fontFamily: 'Outfit_400Regular',
    textAlign: 'center',
    lineHeight: 22,
  },
  proModalTrialBtn: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 4,
  },
  proModalTrialGradient: {
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proModalTrialText: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    color: '#fff',
  },
  proModalDismiss: {
    paddingVertical: 8,
  },
  proModalDismissText: {
    fontSize: 14,
    fontFamily: 'Outfit_500Medium',
  },
});
