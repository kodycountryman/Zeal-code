import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PlatformIcon } from '@/components/PlatformIcon';
import { Platform } from 'react-native';
import { healthService } from '@/services/healthService';
import { useRouter } from 'expo-router';
import { useZealTheme, useAppContext, type MuscleReadinessItem } from '@/context/AppContext';
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
import ExerciseCatalogDrawer from '@/components/drawers/ExerciseCatalogDrawer';
import ActivePlanDrawer from '@/components/drawers/ActivePlanDrawer';
import HelpFaqDrawer from '@/components/drawers/HelpFaqDrawer';
import WorkoutPreviewModal from '@/components/WorkoutPreviewModal';
import PlanWorkoutSheet from '@/components/PlanWorkoutSheet';
import { mockBibleVerse } from '@/mocks/homeData';
import StartAnotherWorkoutSheet from '@/components/StartAnotherWorkoutSheet';
import { WORKOUT_STYLE_COLORS } from '@/constants/colors';
import { PRO_STYLES_SET } from '@/services/proGate';


function getSmartCoachMessage({
  muscleReadiness,
  workoutTitle,
  workoutStyle,
  numericDuration,
  streak,
  readiness,
  hasTodayWorkout,
}: {
  muscleReadiness: MuscleReadinessItem[];
  workoutTitle: string;
  workoutStyle: string;
  numericDuration: number;
  streak: number;
  readiness: number;
  hasTodayWorkout: boolean;
}): string {
  if (hasTodayWorkout) {
    return 'Great work today. Recovery starts now — stay hydrated and sleep well.';
  }
  const isRestDay = workoutTitle === 'Rest Day';
  if (isRestDay) {
    return readiness < 60
      ? "Your body is asking for recovery. Today's rest is part of the plan."
      : 'Rest day locked in. Light movement or a walk can keep momentum going.';
  }
  if (streak === 0) {
    return 'Every elite athlete started with day one. Today is yours.';
  }
  if (streak === 1) {
    return 'Day one is already done. Show up again today — that’s how momentum starts.';
  }
  if (streak >= 7) {
    return `${streak}-day streak. You're building something real — don't break the chain.`;
  }
  if (readiness >= 88) {
    const t = workoutTitle.toLowerCase();
    if (t.includes('push') || t.includes('chest') || t.includes('shoulder')) {
      return 'Chest and shoulders are primed. Good day to push heavy.';
    }
    if (t.includes('pull') || t.includes('back') || t.includes('bicep')) {
      return 'Your pull muscles are fresh. Time to move some weight.';
    }
    if (t.includes('leg') || t.includes('squat') || t.includes('glute')) {
      return 'Legs are fully recovered. Squat strong today.';
    }
    return `Readiness is high. ${workoutTitle} is going to feel good today.`;
  }
  const sorted = [...muscleReadiness].sort((a, b) => b.value - a.value);
  if (sorted.length >= 2) {
    const a = sorted[0].name;
    const b = sorted[1].name;
    return `You're freshest in ${a} and ${b} today — right on time for ${workoutTitle}.`;
  }
  if (numericDuration <= 30) {
    return 'Short and sharp. A focused 30-minute session beats skipping any day.';
  }
  if (numericDuration >= 75) {
    return `A ${numericDuration}-minute ${workoutStyle} session — make every set count.`;
  }
  return `A ${numericDuration}-minute ${workoutStyle} session lines up perfectly with your goal today.`;
}

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
  if (st === 'cardio') return 'Cardio • Endurance';
  if (st === 'hiit') return 'Full Body • Conditioning';
  if (st === 'mobility' || st === 'pilates') return 'Flexibility • Mobility';
  if (st === 'hyrox') return 'Functional • Conditioning';
  return 'Full Body';
}



export default function HomeScreen() {
  const { colors, accent, isZeal, isDark } = useZealTheme();
  const ctx = useAppContext();
  const tracking = useWorkoutTracking();
  const { hasPro } = useSubscription();
  const router = useRouter();
  const glowColor: string = WORKOUT_STYLE_COLORS[ctx.workoutStyle] ?? accent;
  const enterCard = useCallback((delayMs: number) => {
    return FadeInUp
      .delay(delayMs)
      .springify()
      .damping(18)
      .stiffness(160);
  }, []);

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
      console.log('[Home] Health metrics loaded:', data);
    }).catch((e) => {
      if (!cancelled) console.log('[Home] Health metrics error:', e);
    });
    return () => { cancelled = true; };
  }, [ctx.healthConnected, ctx.healthSyncEnabled]);

  const [streakSheetVisible, setStreakSheetVisible] = useState(false);
  const [planSheetVisible, setPlanSheetVisible] = useState(false);
  const [planSheetDate, setPlanSheetDate] = useState<string | null>(null);
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

  const cardBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const ZEAL_ORANGE = '#f87116';

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

  const handleDayPress = useCallback((dateStr: string, dayOffset: number) => {
    if (dayOffset > 0 && dayOffset <= 5) {
      setPlanSheetDate(dateStr);
      setPlanSheetVisible(true);
      return;
    }
    const logs = tracking.getLogsForDate(dateStr);
    if (logs.length > 0) {
      tracking.setSelectedLogId(logs[0].id);
      tracking.setWorkoutLogDetailVisible(true);
    }
  }, [tracking]);

  const handleViewTodayLog = useCallback(() => {
    if (latestTodayLog) {
      tracking.setSelectedLogId(latestTodayLog.id);
      tracking.setWorkoutLogDetailVisible(true);
    }
    router.push('/workout');
  }, [tracking, latestTodayLog, router]);



  const handleLoadSavedWorkout = useCallback((workout: { id: string; name: string; exercises: { exerciseId: string; name: string }[]; defaultFocus: string; createdAt: string; lastUsed: string }) => {
    console.log('[Home] Loading saved workout:', workout.name, 'with', workout.exercises.length, 'exercises');
    ctx.setLoadedWorkout(workout);
    ctx.setCurrentWorkoutTitle(workout.name);
    ctx.saveState();
    router.push('/workout');
  }, [ctx, router]);


  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AmbientGlow color={glowColor} opacity={0.06} />
      {isZeal && <ZealBackground />}

      <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
        <View style={styles.topBar}>
          <View style={styles.topBarLeft}>
            <TouchableOpacity
              style={[
                styles.avatarBtn,
                { borderColor: ctx.userPhotoUri ? 'transparent' : colors.border },
              ]}
              onPress={() => setProfileVisible(true)}
              testID="profile-avatar"
              activeOpacity={0.7}
            >
              {ctx.userPhotoUri ? (
                <Image source={{ uri: ctx.userPhotoUri }} style={styles.avatarImage} />
              ) : (
                <PlatformIcon name="user" size={17} color={colors.textSecondary} />
              )}
            </TouchableOpacity>

            {firstName ? (
              <Text style={[styles.headerName, { color: colors.text }]}>{firstName}</Text>
            ) : null}
          </View>

          <Text style={[styles.wordmark, { color: ZEAL_ORANGE }]}>zeal</Text>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        testID="home-scroll"
      >
        <Animated.View entering={enterCard(90)}>
          <CalendarCard
            streak={ctx.streak}
            onStreakPress={() => setStreakSheetVisible(true)}
            onCalendarPress={handleCalendarPress}
            onDayPress={handleDayPress}
            completedDates={completedDates}
            plannedWorkouts={ctx.plannedWorkouts}
            variant={isDark ? 'glass' : 'solid'}
          />
        </Animated.View>

        {/* Push card animates slightly before Training Score */}
        <Animated.View entering={enterCard(150)}>
          <WorkoutOverviewCard
            title={workoutTitle}
            style={tracking.currentGeneratedWorkout?.style ?? effectiveWorkout.style}
            duration={workoutDuration}
            muscleGroups={muscleGroups}
            exerciseCount={exerciseCount}
            onPress={hasTodayWorkout ? handleViewTodayLog : handlePreviewPress}
            activePlan={ctx.activePlan}
            onViewPlan={() => tracking.setActivePlanVisible(true)}
            variant={isDark ? 'glass' : 'solid'}
            completedLog={hasTodayWorkout ? latestTodayLog : null}
          />
        </Animated.View>

        {tracking.workoutHistory.length > 0 && (
          <Animated.View entering={enterCard(210)}>
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
              lastWorkout={{
                split: tracking.workoutHistory[0].split,
                duration: tracking.workoutHistory[0].duration,
              }}
              onPress={() => setInsightsVisible(true)}
              variant={isDark ? 'glass' : 'solid'}
            />
          </Animated.View>
        )}


        {tracking.workoutHistory.length === 0 ? (
          <>
            {/* C — Coach welcome */}
            <Animated.View entering={enterCard(270)}>
              <GlassCard
                style={[styles.coachCard, { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)', borderWidth: 1 }]}
                variant={isDark ? 'glass' : 'solid'}
              >
                <PlatformIcon name="brain" size={14} color={accent} />
                <Text style={[styles.coachText, { color: colors.textSecondary }]}>
                  {firstName ? `Hey ${firstName} — ` : ''}Your {effectiveWorkout.style} workout is loaded and ready. Complete it to start unlocking your training insights.
                </Text>
              </GlassCard>
            </Animated.View>

            {/* B — Day 1 streak challenge */}
            <Animated.View entering={enterCard(330)}>
              {(() => {
                const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                const todayDow = new Date().getDay();
                return (
                  <GlassCard
                    style={[styles.day1Card, { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)', borderWidth: 1 }]}
                    onPress={() => router.push('/workout')}
                    activeOpacity={0.8}
                    variant={isDark ? 'glass' : 'solid'}
                  >
                    <View style={styles.day1Top}>
                      <View>
                        <Text style={[styles.day1Heading, { color: accent }]}>Day 1.</Text>
                        <Text style={[styles.day1Sub, { color: colors.textSecondary }]}>Start your streak today</Text>
                      </View>
                      <PlatformIcon name="flame" size={22} color={accent} strokeWidth={1.8} />
                    </View>

                    <View style={styles.streakRow}>
                      {DAY_LABELS.map((d, i) => {
                        const isToday = i === todayDow;
                        return (
                          <View key={d} style={styles.streakDayCol}>
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

            {/* Locked Training Score — shown at bottom before first workout */}
            <Animated.View entering={enterCard(390)}>
              <GlassCard
                style={[styles.lockedScoreCard, { borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]}
                variant={isDark ? 'glass' : 'solid'}
                testID="locked-score-card"
              >
                <View style={styles.lockedScoreInner}>
                  <PlatformIcon name="lock" size={18} color={isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)'} strokeWidth={1.8} />
                  <Text style={[styles.lockedScoreLabel, { color: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.2)' }]}>
                    Training Score
                  </Text>
                  <Text style={[styles.lockedScoreHint, { color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)' }]}>
                    Log your first workout to unlock score insights
                  </Text>
                </View>
              </GlassCard>
            </Animated.View>
          </>
        ) : (
          <Animated.View entering={enterCard(270)}>
            <GlassCard style={styles.coachCard} variant={isDark ? 'glass' : 'solid'}>
              <PlatformIcon name="brain" size={14} color={accent} />
              <Text style={[styles.coachText, { color: colors.textSecondary }]} numberOfLines={2}>
                {getSmartCoachMessage({
                  muscleReadiness: ctx.muscleReadiness,
                  workoutTitle,
                  workoutStyle: ctx.workoutStyle,
                  numericDuration,
                  streak: ctx.streak,
                  readiness,
                  hasTodayWorkout,
                })}
              </Text>
            </GlassCard>
          </Animated.View>
        )}


        <View style={styles.bibleContainer} testID="bible-verse">
          <Text style={[styles.bibleText, { color: colors.textSecondary }]}>
            {mockBibleVerse.text}
          </Text>
          <Text style={[styles.bibleRef, { color: colors.textSecondary }]}>
            {mockBibleVerse.reference}
          </Text>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <StartAnotherWorkoutSheet
        visible={anotherWorkoutVisible}
        onClose={() => setAnotherWorkoutVisible(false)}
        onComplete={() => router.push('/workout')}
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
        onClose={() => tracking.setWorkoutPlanVisible(false)}
        onBack={() => tracking.setWorkoutPlanVisible(false)}
      />

      <ExerciseCatalogDrawer
        visible={tracking.exerciseCatalogVisible}
        onClose={() => tracking.setExerciseCatalogVisible(false)}
        onBack={() => tracking.setExerciseCatalogVisible(false)}
      />

      <ActivePlanDrawer
        visible={tracking.activePlanVisible}
        onClose={() => tracking.setActivePlanVisible(false)}
        onStartNewPlan={() => tracking.setWorkoutPlanVisible(true)}
      />

      <HelpFaqDrawer
        visible={helpFaqVisible}
        onClose={() => setHelpFaqVisible(false)}
        onBack={() => setHelpFaqVisible(false)}
      />

      <WorkoutPreviewModal
        visible={previewVisible}
        onClose={() => setPreviewVisible(false)}
        onGoToWorkout={() => router.push('/workout')}
      />

      <PlanWorkoutSheet
        visible={planSheetVisible}
        targetDate={planSheetDate}
        onClose={() => {
          setPlanSheetVisible(false);
          setPlanSheetDate(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  headerName: {
    fontSize: 22,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.5,
  },
  wordmark: {
    fontSize: 17,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.8,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 12,
    flexGrow: 1,
  },
  coachCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 26,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    overflow: 'hidden',
  },
  coachText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Outfit_300Light',
    lineHeight: 18,
    letterSpacing: 0.1,
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
  lockedScoreCard: {
    borderRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 28,
    overflow: 'hidden',
  },
  lockedScoreInner: {
    alignItems: 'center',
    gap: 8,
  },
  lockedScoreLabel: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
    letterSpacing: 0,
    marginTop: 2,
  },
  lockedScoreHint: {
    fontSize: 13,
    fontFamily: 'Outfit_400Regular',
    textAlign: 'center',
    lineHeight: 18,
    letterSpacing: 0.1,
    marginTop: 2,
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
});
