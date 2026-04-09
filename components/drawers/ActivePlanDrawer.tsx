import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated as RNAnimated,
  Image,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import BaseDrawer from '@/components/drawers/BaseDrawer';
import { PlatformIcon } from '@/components/PlatformIcon';
import PlanDayPreviewDrawer from '@/components/drawers/PlanDayPreviewDrawer';
import PlanScheduleDrawer from '@/components/drawers/PlanScheduleDrawer';
import type { DayPrescription } from '@/services/planEngine';

import { useZealTheme, useAppContext } from '@/context/AppContext';
import { useWorkoutTracking } from '@/context/WorkoutTrackingContext';
import { WORKOUT_STYLE_COLORS } from '@/constants/colors';
import { PHASE_DISPLAY_NAMES, PHASE_COLORS } from '@/services/planConstants';
import type { WeekSchedule } from '@/services/planEngine';
import { generatePlanSchedule, getEventMilestones, handleMissedDays } from '@/services/planEngine';
import type { PlanPhase } from '@/services/planConstants';
import type { PlanGenerationInput } from '@/services/planEngine';
import type { GenerateWorkoutParams } from '@/services/workoutEngine';
import { useSeventyFiveHard } from '@/context/SeventyFiveHardContext';
import { isDayFullyComplete } from '@/services/seventyFiveHardTypes';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const PHASE_INITIALS: Record<string, string> = {
  foundation: 'F',
  build: 'B',
  intensify: 'I',
  peak: 'P',
  deload: 'D',
  taper: 'T',
  test: 'TS',
};

const EDITABLE_STYLES = ['Strength', 'Bodybuilding', 'CrossFit', 'HIIT', 'Mobility', 'Pilates', 'Low-Impact'];
const EDITABLE_LEVELS = ['beginner', 'intermediate', 'advanced'];
const EDITABLE_DAYS = [2, 3, 4, 5, 6, 7];
const EDITABLE_DURATIONS = [30, 45, 60, 75, 90];

type EditableField = 'style' | 'level' | 'daysPerWeek' | 'duration';

function JiggleCard({
  children,
  index,
  isEditMode,
  isEditable,
  onPress,
  style,
}: {
  children: React.ReactNode;
  index: number;
  isEditMode: boolean;
  isEditable: boolean;
  onPress?: () => void;
  style?: any;
}) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (isEditMode && isEditable) {
      const dir = index % 2 === 0 ? 1 : -1;
      rotation.value = withRepeat(
        withSequence(
          withTiming(-1.5 * dir, { duration: 120 }),
          withTiming(1.5 * dir, { duration: 120 }),
          withTiming(-1 * dir, { duration: 120 }),
          withTiming(1 * dir, { duration: 120 }),
          withTiming(0, { duration: 200 }),
        ),
        -1,
      );
    } else {
      cancelAnimation(rotation);
      rotation.value = withTiming(0, { duration: 150 });
    }
  }, [isEditMode, isEditable, index, rotation]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${rotation.value}deg` }],
  }));

  if (isEditMode && isEditable) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={style}>
        <Reanimated.View style={animStyle}>
          {children}
        </Reanimated.View>
      </TouchableOpacity>
    );
  }

  return <View style={style}>{children}</View>;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onStartNewPlan: () => void;
  onEditPlan: () => void;
  initialTab?: 0 | 1 | 2;
}

function formatDateShort(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return dateStr; }
}

function formatDateFull(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return dateStr; }
}

function getWeeksLeft(endDate: string): number {
  const now = new Date();
  const end = new Date(endDate + 'T00:00:00');
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (7 * 24 * 60 * 60 * 1000)));
}

function getCurrentWeek(startDate: string): number {
  const now = new Date();
  const start = new Date(startDate + 'T00:00:00');
  const diff = now.getTime() - start.getTime();
  return Math.max(1, Math.ceil(diff / (7 * 24 * 60 * 60 * 1000)));
}

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const SFHARD_GREEN = '#22c55e';
const SFHARD_YELLOW = '#f59e0b';
const SFHARD_RED = '#ef4444';
const SFHARD_GRAY = 'rgba(128,128,128,0.3)';
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function ActivePlanDrawer({ visible, onClose, onStartNewPlan, onEditPlan, initialTab }: Props) {
  const { colors, accent } = useZealTheme();
  const ctx = useAppContext();
  const tracking = useWorkoutTracking();
  const router = useRouter();
  const sfHard = useSeventyFiveHard();

  const plan = ctx.activePlan;
  const schedule = ctx.planSchedule;

  const [selectedWeekIdx, setSelectedWeekIdx] = useState<number>(0);
  const [previewDay, setPreviewDay] = useState<DayPrescription | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [fullPlanVisible, setFullPlanVisible] = useState(false);
  const [recoveryDismissed, setRecoveryDismissed] = useState(false);
  const phaseScrollRef = useRef<ScrollView>(null);

  // ── Edit mode state ──
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [editStyle, setEditStyle] = useState<string | null>(null);
  const [editLevel, setEditLevel] = useState<string | null>(null);
  const [editDaysPerWeek, setEditDaysPerWeek] = useState<number | null>(null);
  const [editDuration, setEditDuration] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges = useMemo(() => {
    if (!plan) return false;
    return (
      (editStyle !== null && editStyle !== plan.style) ||
      (editLevel !== null && editLevel !== plan.experienceLevel) ||
      (editDaysPerWeek !== null && editDaysPerWeek !== plan.daysPerWeek) ||
      (editDuration !== null && editDuration !== plan.sessionDuration)
    );
  }, [plan, editStyle, editLevel, editDaysPerWeek, editDuration]);

  const enterEditMode = useCallback(() => {
    if (!plan) return;
    setEditStyle(plan.style);
    setEditLevel(plan.experienceLevel);
    setEditDaysPerWeek(plan.daysPerWeek);
    setEditDuration(plan.sessionDuration);
    setEditingField(null);
    setIsEditMode(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, [plan]);

  const exitEditMode = useCallback(() => {
    setIsEditMode(false);
    setEditingField(null);
    setEditStyle(null);
    setEditLevel(null);
    setEditDaysPerWeek(null);
    setEditDuration(null);
  }, []);

  const handleSaveEdits = useCallback(async () => {
    if (!plan || !schedule || !hasChanges) return;
    setIsSaving(true);
    try {
      const updatedStyle = editStyle ?? plan.style;
      const updatedLevel = editLevel ?? plan.experienceLevel;
      const updatedDays = editDaysPerWeek ?? plan.daysPerWeek;
      const updatedDuration = editDuration ?? plan.sessionDuration;

      const genInput: PlanGenerationInput = {
        goal: plan.goalId as any,
        style: updatedStyle,
        event: plan.event ?? [],
        daysPerWeek: updatedDays,
        sessionDuration: updatedDuration,
        experienceLevel: updatedLevel as any,
        planLength: plan.planLength as any,
        startDate: plan.startDate,
        trainingSplit: plan.trainingSplit,
        is75Hard: plan.is75Hard,
      };

      const newSchedule = generatePlanSchedule(genInput);

      // Clear only future cached workouts
      const todayStr = getTodayStr();
      const allKeys = await AsyncStorage.getAllKeys();
      const prefix = `@zeal_plan_day_workout_${plan.id}_`;
      const futureKeys = allKeys.filter(k => k.startsWith(prefix) && k.slice(prefix.length) >= todayStr);
      if (futureKeys.length > 0) await AsyncStorage.multiRemove(futureKeys);

      const updatedPlan = {
        ...plan,
        style: updatedStyle,
        experienceLevel: updatedLevel,
        daysPerWeek: updatedDays,
        sessionDuration: updatedDuration,
        name: plan.name,
      };

      const genParamsFactory = (d: DayPrescription): GenerateWorkoutParams => ({
        style: d.style,
        split: d.session_type,
        targetDuration: d.target_duration,
        restSlider: ctx.restBetweenSets,
        availableEquipment: updatedPlan.equipment ?? {},
        fitnessLevel: updatedLevel as any,
        sex: ctx.sex,
        specialLifeCase: ctx.specialLifeCase,
        specialLifeCaseDetail: ctx.specialLifeCaseDetail,
        warmUp: true,
        coolDown: true,
        recovery: true,
        addCardio: true,
        specificMuscles: [],
        planPhase: d.phase,
        volumeModifier: d.volume_modifier,
        bodyweightLbs: ctx.weight,
        cacheVariantKey: `${updatedPlan.id}_${d.date}`,
      });

      ctx.saveActivePlan(updatedPlan, newSchedule);
      await ctx.startPlanGeneration(updatedPlan, newSchedule, genParamsFactory);
      await tracking.ensureTodayWorkoutGenerated();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      exitEditMode();
    } catch (e) {
      Alert.alert('Error', 'Failed to save changes. Please try again.');
      __DEV__ && console.error('[ActivePlanDrawer] Save edits error:', e);
    } finally {
      setIsSaving(false);
    }
  }, [plan, schedule, hasChanges, editStyle, editLevel, editDaysPerWeek, editDuration, ctx, tracking, exitEditMode]);

  // ── Tab state (Upcoming / Details / Progress) ──
  const [activeTab, setActiveTab] = useState<0 | 1 | 2>(0);
  const pillAnim = useRef(new RNAnimated.Value(0)).current;
  const [tabItemWidth, setTabItemWidth] = useState(0);
  const [tabXOffsets, setTabXOffsets] = useState<[number, number, number]>([0, 0, 0]);

  const switchTab = useCallback((tab: 0 | 1 | 2) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    RNAnimated.spring(pillAnim, {
      toValue: tab,
      tension: 120,
      friction: 20,
      useNativeDriver: false,
    }).start();
  }, [activeTab, pillAnim]);

  useEffect(() => {
    if (visible) {
      if (initialTab !== undefined) {
        setActiveTab(initialTab);
        pillAnim.setValue(initialTab);
      }
      if (plan && schedule) {
        const cw = getCurrentWeek(plan.startDate);
        const idx = Math.max(0, Math.min(cw - 1, schedule.weeks.length - 1));
        setSelectedWeekIdx(idx);
        setTimeout(() => {
          phaseScrollRef.current?.scrollTo({ x: idx * 42, animated: true });
        }, 150);
      }
    } else {
      // Reset edit mode when drawer closes
      if (isEditMode) exitEditMode();
    }
  }, [visible, plan, schedule]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePausePlan = useCallback(() => {
    if (!plan) return;
    const today = getTodayStr();
    ctx.saveActivePlan({ ...plan, pausedAt: today }, schedule ?? null);
  }, [ctx, plan, schedule]);

  const handleResumePlan = useCallback(() => {
    if (!plan) return;
    const { pausedAt: _, ...rest } = plan;
    ctx.saveActivePlan({ ...rest }, schedule ?? null);
  }, [ctx, plan, schedule]);

  const handleCancelPlan = useCallback(() => {
    Alert.alert(
      'Cancel Plan',
      'Are you sure you want to cancel your current workout plan? This cannot be undone.',
      [
        { text: 'Keep Plan', style: 'cancel' },
        {
          text: 'Cancel Plan',
          style: 'destructive',
          onPress: () => {
            onClose();
            setTimeout(() => {
              ctx.saveActivePlan(null, null);
              if (plan?.is75Hard) sfHard.endChallenge();
            }, 400);
          },
        },
      ]
    );
  }, [ctx, onClose]);

  const handleStartNew = useCallback(() => {
    onClose();
    setTimeout(() => onStartNewPlan(), 350);
  }, [onClose, onStartNewPlan]);

  const handlePrevWeek = useCallback(() => {
    setSelectedWeekIdx(prev => Math.max(0, prev - 1));
  }, []);

  const handleNextWeek = useCallback(() => {
    if (!schedule) return;
    setSelectedWeekIdx(prev => Math.min(schedule.weeks.length - 1, prev + 1));
  }, [schedule]);

  const selectedWeek: WeekSchedule | null = useMemo(() => {
    if (!schedule || selectedWeekIdx >= schedule.weeks.length) return null;
    return schedule.weeks[selectedWeekIdx];
  }, [schedule, selectedWeekIdx]);

  const milestones = useMemo(() => {
    if (!plan) return [];
    return getEventMilestones(plan.event, plan.planLength, plan.startDate);
  }, [plan]);

  const currentWeekMilestone = useMemo(() => {
    if (!selectedWeek || milestones.length === 0) return null;
    return milestones.find(m => m.week === selectedWeek.week_number) ?? null;
  }, [selectedWeek, milestones]);

  // Today's prescription from plan schedule
  const todayPrescription = useMemo(() => {
    return ctx.getTodayPrescription();
  }, [ctx, visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Missed day recovery recommendation
  const missedRecovery = useMemo(() => {
    if (!plan?.missedDays?.length) return null;
    const total = plan.missedDays.length;
    // Count consecutive days missed backwards from yesterday
    const today = getTodayStr();
    let consecutive = 0;
    for (let i = 1; i <= total; i++) {
      const d = new Date(today + 'T00:00:00');
      d.setDate(d.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (plan.missedDays.includes(ds)) {
        consecutive++;
      } else {
        break;
      }
    }
    return handleMissedDays(total, consecutive);
  }, [plan?.missedDays]);

  // ── 75 Hard progress data (only used when plan.is75Hard) ──
  const [selectedPhoto, setSelectedPhoto] = useState<{ uri: string; date: string } | null>(null);

  const sfStats = useMemo(() => {
    if (!plan?.is75Hard) return null;
    return sfHard.getAdherenceStats();
  }, [plan?.is75Hard, sfHard.getAdherenceStats, sfHard.state]); // eslint-disable-line react-hooks/exhaustive-deps

  const sfAdherenceBars = useMemo(() => {
    if (!sfStats) return [];
    return [
      { label: 'Workout 1', icon: 'dumbbell', count: sfStats.workout1, total: sfStats.total, color: '#f87116' },
      { label: 'Workout 2', icon: 'sun', count: sfStats.workout2, total: sfStats.total, color: '#06b6d4' },
      { label: 'Water', icon: 'droplets', count: sfStats.water, total: sfStats.total, color: '#60a5fa' },
      { label: 'Reading', icon: 'book-open', count: sfStats.reading, total: sfStats.total, color: '#a78bfa' },
      { label: 'Diet', icon: 'utensils', count: sfStats.diet, total: sfStats.total, color: '#22c55e' },
      { label: 'Photos', icon: 'camera', count: sfStats.photo, total: sfStats.total, color: '#ec4899' },
    ];
  }, [sfStats]);

  const sfHeatmapCells = useMemo(() => {
    if (!sfHard.state || !plan?.is75Hard) return [];
    const cells: { day: number; color: string }[] = [];
    const start = new Date(sfHard.state.startDate + 'T00:00:00');
    for (let i = 0; i < 75; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      if (dateStr > todayStr) {
        cells.push({ day: i + 1, color: SFHARD_GRAY });
      } else {
        const dayData = sfHard.state.days[dateStr];
        if (!dayData) {
          cells.push({ day: i + 1, color: dateStr < todayStr ? SFHARD_RED : SFHARD_GRAY });
        } else if (isDayFullyComplete(dayData)) {
          cells.push({ day: i + 1, color: SFHARD_GREEN });
        } else {
          const checked = [dayData.workout1Complete, dayData.workout2Complete, dayData.waterComplete, dayData.readingComplete, dayData.dietComplete, dayData.photoComplete].filter(Boolean).length;
          cells.push({ day: i + 1, color: checked > 0 ? SFHARD_YELLOW : SFHARD_RED });
        }
      }
    }
    return cells;
  }, [sfHard.state, plan?.is75Hard]);

  const sfPhotoTimeline = useMemo(() => {
    if (!sfHard.state || !plan?.is75Hard) return [];
    return Object.values(sfHard.state.days)
      .filter(d => d.photoUri)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [sfHard.state, plan?.is75Hard]);

  const handleSfEndChallenge = useCallback(() => {
    Alert.alert('End 75 Hard?', 'This will clear all progress. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'End Challenge', style: 'destructive', onPress: () => { sfHard.endChallenge(); onClose(); } },
    ]);
  }, [sfHard, onClose]);

  const handleSfReset = useCallback(() => {
    Alert.alert('Reset to Day 1?', "Your progress will be cleared and you'll start fresh. Reset history will be preserved.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: sfHard.resetChallenge },
    ]);
  }, [sfHard]);

  if (!plan) return null;

  const today = getTodayStr();
  const styleColor = WORKOUT_STYLE_COLORS[plan.style] ?? accent;
  const currentWeek = getCurrentWeek(plan.startDate);
  const weeksLeft = getWeeksLeft(plan.endDate);
  const isPlanComplete = plan.endDate < today;
  const isPlanPaused = !!plan.pausedAt;

  // Adherence stats
  const totalTrainingDays = schedule
    ? schedule.weeks.reduce((sum, w) => sum + w.days.filter(d => !d.is_rest).length, 0)
    : plan.daysPerWeek * plan.planLength;
  const completedCount = plan.completedDays?.length ?? 0;
  const completedPct = totalTrainingDays > 0
    ? Math.min(100, Math.round((completedCount / totalTrainingDays) * 100))
    : 0;
  // Time-elapsed progress: always reflects how far through the plan calendar we are
  const planTotalCalendarDays = plan.is75Hard ? 75 : plan.planLength * 7;
  const elapsedCalendarDays = Math.max(0, Math.min(
    planTotalCalendarDays,
    Math.floor((new Date().getTime() - new Date(plan.startDate + 'T00:00:00').getTime()) / (24 * 60 * 60 * 1000)) + 1,
  ));
  const elapsedPct = Math.round((elapsedCalendarDays / planTotalCalendarDays) * 100);
  // Show whichever is higher: workouts done or time elapsed
  const progressPct = Math.max(completedPct, elapsedPct);
  // Rate = completed / training days elapsed so far (days up to and including today)
  const daysElapsedTraining = schedule
    ? schedule.weeks.reduce((sum, w) => sum + w.days.filter(d => !d.is_rest && d.date <= today).length, 0)
    : 0;
  const adherencePct = daysElapsedTraining > 0 ? Math.round((completedCount / daysElapsedTraining) * 100) : 0;

  const headerContent = (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <PlatformIcon name="sparkles" size={15} color={accent} />
        <Text style={[styles.headerLabel, { color: accent }]}>ACTIVE PLAN</Text>
      </View>
      <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
        <PlatformIcon name="x" size={14} color="#888" />
      </TouchableOpacity>
    </View>
  );

  return (
    <>
    <BaseDrawer visible={visible} onClose={onClose} header={headerContent}>
      <View style={styles.content}>

        {/* ── Plan name ─────────────────────────────── */}
        <Text style={[styles.planName, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{plan.name}</Text>

        {/* ── Tab bar (Upcoming / Details) ──────────── */}
        <View style={styles.planTabBar}>
          {tabItemWidth > 0 && (
            <RNAnimated.View
              pointerEvents="none"
              style={[
                styles.planTabPill,
                {
                  width: tabItemWidth,
                  transform: [{
                    translateX: pillAnim.interpolate({
                      inputRange: [0, 1, 2],
                      outputRange: tabXOffsets,
                    }),
                  }],
                },
              ]}
            />
          )}
          <View
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            onLayout={(e) => {
              const { x, width } = e.nativeEvent.layout;
              setTabXOffsets(prev => [x, prev[1], prev[2]]);
              setTabItemWidth(width);
            }}
          >
            <TouchableOpacity style={styles.planTabBtn} onPress={() => switchTab(0)} activeOpacity={0.7}>
              <PlatformIcon
                name="calendar"
                size={14}
                color={activeTab === 0 ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.3)'}
              />
              <Text style={[
                styles.planTabLabel,
                {
                  color: activeTab === 0 ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.3)',
                  fontFamily: activeTab === 0 ? 'Outfit_600SemiBold' : 'Outfit_500Medium',
                },
              ]}>
                Upcoming
              </Text>
            </TouchableOpacity>
          </View>
          <View
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            onLayout={(e) => {
              const { x } = e.nativeEvent.layout;
              setTabXOffsets(prev => [prev[0], x, prev[2]]);
            }}
          >
            <TouchableOpacity style={styles.planTabBtn} onPress={() => switchTab(1)} activeOpacity={0.7}>
              <PlatformIcon
                name="info"
                size={14}
                color={activeTab === 1 ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.3)'}
              />
              <Text style={[
                styles.planTabLabel,
                {
                  color: activeTab === 1 ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.3)',
                  fontFamily: activeTab === 1 ? 'Outfit_600SemiBold' : 'Outfit_500Medium',
                },
              ]}>
                Details
              </Text>
            </TouchableOpacity>
          </View>
          {plan.is75Hard && (
            <View
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
              onLayout={(e) => {
                const { x } = e.nativeEvent.layout;
                setTabXOffsets(prev => [prev[0], prev[1], x]);
              }}
            >
              <TouchableOpacity style={styles.planTabBtn} onPress={() => switchTab(2)} activeOpacity={0.7}>
                <PlatformIcon
                  name="trophy"
                  size={14}
                  color={activeTab === 2 ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.3)'}
                />
                <Text style={[
                  styles.planTabLabel,
                  {
                    color: activeTab === 2 ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.3)',
                    fontFamily: activeTab === 2 ? 'Outfit_600SemiBold' : 'Outfit_500Medium',
                  },
                ]}>
                  Progress
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ═══════════════════════════════════════════════ */}
        {/*  UPCOMING TAB                                  */}
        {/* ═══════════════════════════════════════════════ */}
        {activeTab === 0 && (<>

          {isPlanComplete ? (
            <View style={[styles.completionCard, { backgroundColor: '#22c55e0d', borderColor: '#22c55e35' }]}>
              <View style={styles.completionTop}>
                <View style={[styles.completionIconWrap, { backgroundColor: '#22c55e20' }]}>
                  <PlatformIcon name="trophy" size={26} color="#22c55e" />
                </View>
                <View style={styles.completionTextBlock}>
                  <Text style={[styles.completionTitle, { color: colors.text }]}>Plan Complete</Text>
                  <Text style={[styles.completionSub, { color: colors.textSecondary }]}>
                    {formatDateShort(plan.startDate)} → {formatDateShort(plan.endDate)}
                  </Text>
                </View>
              </View>
              <View style={[styles.completionDivider, { backgroundColor: '#22c55e20' }]} />
              <View style={styles.completionStats}>
                <View style={styles.completionStat}>
                  <Text style={[styles.completionStatNum, { color: '#22c55e' }]}>{completedCount}</Text>
                  <Text style={[styles.completionStatLabel, { color: colors.textSecondary }]}>days done</Text>
                </View>
                <View style={[styles.completionStatDivider, { backgroundColor: '#22c55e20' }]} />
                <View style={styles.completionStat}>
                  <Text style={[styles.completionStatNum, { color: '#22c55e' }]}>{adherencePct}%</Text>
                  <Text style={[styles.completionStatLabel, { color: colors.textSecondary }]}>adherence</Text>
                </View>
                <View style={[styles.completionStatDivider, { backgroundColor: '#22c55e20' }]} />
                <View style={styles.completionStat}>
                  <Text style={[styles.completionStatNum, { color: '#22c55e' }]}>{plan.planLength}</Text>
                  <Text style={[styles.completionStatLabel, { color: colors.textSecondary }]}>weeks</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>PROGRESS</Text>
                <Text style={[styles.progressWeek, { color: colors.textSecondary }]}>
                  Week {currentWeek} of {plan.planLength}
                </Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                <View style={[styles.progressFill, { width: `${progressPct}%`, backgroundColor: styleColor }]} />
              </View>
              <View style={styles.progressFooter}>
                <Text style={[styles.progressPct, { color: styleColor }]}>{progressPct}% complete</Text>
                <Text style={[styles.progressLeft, { color: colors.textMuted }]}>{weeksLeft}w left</Text>
              </View>
            </View>
          )}

          {/* ── Paused banner ───────────────────────────── */}
          {isPlanPaused && !isPlanComplete && (
            <View style={[styles.pausedBanner, { backgroundColor: '#60a5fa0d', borderColor: '#60a5fa30' }]}>
              <PlatformIcon name="pause" size={14} color="#60a5fa" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.pausedBannerTitle, { color: '#60a5fa' }]}>Plan Paused</Text>
                <Text style={[styles.pausedBannerSub, { color: colors.textSecondary }]}>
                  Paused {plan.pausedAt ? `on ${formatDateShort(plan.pausedAt)}` : ''}. Tap Resume below to continue.
                </Text>
              </View>
            </View>
          )}

          {/* ── Missed day recovery ───────────────────────── */}
          {!isPlanComplete && missedRecovery && !recoveryDismissed && (
            <View style={styles.recoveryInlineRow}>
              <PlatformIcon name="alert-triangle" size={12} color="#f87116" />
              <Text style={[styles.recoveryInlineText, { color: colors.textMuted }]}>
                {plan.missedDays!.length === 1 ? '1 missed day' : `${plan.missedDays!.length} missed days`}
                {'  ·  '}{missedRecovery.message}
              </Text>
              <TouchableOpacity onPress={() => setRecoveryDismissed(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <PlatformIcon name="x" size={11} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          )}

          {/* ── Today's session ───────── */}
          {!isPlanComplete && todayPrescription ? (
            <TouchableOpacity
              style={[
                styles.todayCard,
                { backgroundColor: colors.cardSecondary, borderColor: colors.border },
              ]}
              onPress={() => { setPreviewDay(todayPrescription); setPreviewVisible(true); }}
              activeOpacity={todayPrescription.is_rest ? 1 : 0.75}
              disabled={todayPrescription.is_rest}
            >
              <View style={[styles.todayAccentBar, { backgroundColor: `${styleColor}60` }]} />
              <View style={styles.todayBody}>
                <Text style={[styles.todayLabel, { color: styleColor }]}>TODAY</Text>
                {todayPrescription.is_rest ? (
                  <View style={styles.todayMain}>
                    <PlatformIcon name="moon" size={18} color={colors.textSecondary} />
                    <View style={styles.todayTextBlock}>
                      <Text style={[styles.todaySession, { color: colors.text }]}>Recovery Day</Text>
                      {todayPrescription.rest_suggestion ? (
                        <Text style={[styles.todaySub, { color: colors.textSecondary }]} numberOfLines={2}>
                          {todayPrescription.rest_suggestion}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ) : (
                  <View style={styles.todayMain}>
                    <PlatformIcon name="dumbbell" size={18} color={styleColor} />
                    <View style={[styles.todayTextBlock, { flex: 1 }]}>
                      <Text style={[styles.todaySession, { color: colors.text }]} numberOfLines={1}>
                        {todayPrescription.session_type || todayPrescription.style}
                      </Text>
                      <View style={styles.todayMetaRow}>
                        <PlatformIcon name="clock" size={11} color={colors.textMuted} />
                        <Text style={[styles.todayMetaText, { color: colors.textMuted }]}>
                          {todayPrescription.target_duration} min
                        </Text>
                        <Text style={[styles.todayMetaDot, { color: colors.textMuted }]}>·</Text>
                        <Text style={[styles.todayMetaText, { color: colors.textMuted }]}>
                          {PHASE_DISPLAY_NAMES[todayPrescription.phase as PlanPhase] ?? todayPrescription.phase}
                        </Text>
                      </View>
                    </View>
                    <PlatformIcon name="chevron-right" size={16} color={colors.textMuted} />
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ) : null}

          {/* ── Start today CTA ──────── */}
          {!isPlanComplete && todayPrescription && !todayPrescription.is_rest && (
            <TouchableOpacity
              style={[styles.startTodayBtn, { backgroundColor: styleColor }]}
              onPress={() => {
                tracking.ensureTodayWorkoutGenerated();
                onClose();
                setTimeout(() => router.push('/(tabs)/workout' as any), 350);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.startTodayBtnText}>Start Today's Workout</Text>
              <PlatformIcon name="chevron-right" size={15} color="rgba(255,255,255,0.7)" style={{ marginRight: 14 }} />
            </TouchableOpacity>
          )}

          {/* ── Divider ── */}
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 10 }} />

          {/* ── Upcoming section header ── */}
          <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>UPCOMING</Text>

          {/* ── Current phase info row ── */}
          {selectedWeek?.notes ? (
            <View style={[styles.infoRow, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
              <PlatformIcon name="trending-up" size={12} color={colors.textSecondary} />
              <Text style={[styles.infoRowText, { color: colors.textSecondary }]}>{selectedWeek.notes}</Text>
            </View>
          ) : null}

          {/* ── This week's day cards ── */}
          {selectedWeek && (
            <View style={styles.weekDetailSection}>
              <View style={styles.dayGrid}>
                {selectedWeek.days.map((day, dIdx) => {
                  const isToday = day.date === today;
                  const isPast = day.date < today;
                  const isMissed = plan.missedDays?.includes(day.date);
                  const isCompleted = !day.is_rest && plan.completedDays?.includes(day.date);
                  const isFaded = (isMissed || isCompleted) && !isToday;
                  const cardBg = isToday ? colors.cardSecondary : isFaded ? 'rgba(255,255,255,0.02)' : colors.cardSecondary;
                  const cardBorder = isToday ? styleColor : isFaded ? colors.border : colors.border;
                  const textColor = isFaded ? colors.textMuted : colors.text;
                  const subColor = colors.textMuted;
                  const CardWrapper = day.is_rest ? View : TouchableOpacity;
                  return (
                    <CardWrapper
                      key={dIdx}
                      style={[styles.dayCard, { backgroundColor: cardBg, borderColor: cardBorder, borderWidth: isToday ? 1.5 : 1, opacity: isFaded ? 0.55 : 1 }]}
                      {...(!day.is_rest && {
                        onPress: () => { setPreviewDay(day); setPreviewVisible(true); },
                        activeOpacity: 0.75,
                      })}
                    >
                      <View style={styles.dayCardHeader}>
                        <Text style={[styles.dayLabel, { color: isToday ? styleColor : textColor }]}>
                          {DAY_LABELS[new Date(day.date + 'T00:00:00').getDay()] ?? `D${dIdx + 1}`}
                        </Text>
                        <View style={styles.dayCardHeaderRight}>
                          {isCompleted && (
                            <View style={styles.completedBadge}>
                              <PlatformIcon name="check" size={9} color="#22c55e" />
                            </View>
                          )}
                          {isMissed && !isCompleted && (
                            <View style={styles.missedBadge}>
                              <PlatformIcon name="x" size={9} color="#ef4444" />
                            </View>
                          )}
                          <Text style={[styles.dayDate, { color: subColor }]}>{formatDateShort(day.date)}</Text>
                        </View>
                      </View>
                      {day.is_rest ? (
                        <View style={styles.restContent}>
                          <PlatformIcon name="moon" size={14} color={subColor} />
                          <Text style={[styles.restLabel, { color: subColor }]}>Rest</Text>
                        </View>
                      ) : (
                        <View style={styles.trainingContent}>
                          <View style={styles.dayStyleRow}>
                            <PlatformIcon name="dumbbell" size={11} color={isToday ? accent : textColor} />
                            <Text style={[styles.dayStyleText, { color: isToday ? accent : textColor }]} numberOfLines={1}>
                              {day.session_type || day.style}
                            </Text>
                          </View>
                          <View style={styles.dayMetaRow}>
                            <PlatformIcon name="clock" size={10} color={subColor} />
                            <Text style={[styles.dayMetaText, { color: subColor }]}>{day.target_duration}min</Text>
                          </View>
                          {!isFaded && (
                            <View style={styles.dayTagRow}>
                              {day.is_deload_week && <View style={styles.deloadTag}><Text style={styles.deloadTagText}>Deload</Text></View>}
                              {!day.is_deload_week && day.intensity_modifier > 0 && day.intensity_modifier < 0.9 && (
                                <View style={styles.effortTag}><Text style={styles.effortTagText}>~{Math.round(day.intensity_modifier * 100)}% effort</Text></View>
                              )}
                            </View>
                          )}
                        </View>
                      )}
                    </CardWrapper>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── View full plan button ── */}
          <TouchableOpacity
            style={[styles.ghostBtn, { borderColor: colors.border }]}
            onPress={() => setFullPlanVisible(true)}
            activeOpacity={0.7}
          >
            <PlatformIcon name="list-checks" size={14} color={colors.textSecondary} />
            <Text style={[styles.ghostBtnText, { color: colors.textSecondary }]}>View Full Workout Plan</Text>
          </TouchableOpacity>

        </>)}

        {/* ═══════════════════════════════════════════════ */}
        {/*  DETAILS TAB                                   */}
        {/* ═══════════════════════════════════════════════ */}
        {activeTab === 1 && (<>

          {/* ── Adherence analytics ──────────────────────── */}
          {!isPlanComplete && completedCount > 0 && (
            <View style={[styles.adherenceCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginBottom: 10 }]}>ADHERENCE</Text>
              <View style={styles.adherenceRow}>
                <View style={styles.adherenceStat}>
                  <Text style={[styles.adherenceNum, { color: '#22c55e' }]}>{completedCount}</Text>
                  <Text style={[styles.adherenceLabel, { color: colors.textSecondary }]}>done</Text>
                </View>
                <View style={[styles.adherenceDivider, { backgroundColor: colors.border }]} />
                <View style={styles.adherenceStat}>
                  <Text style={[styles.adherenceNum, { color: plan.missedDays?.length ? '#ef4444' : colors.textMuted }]}>
                    {plan.missedDays?.length ?? 0}
                  </Text>
                  <Text style={[styles.adherenceLabel, { color: colors.textSecondary }]}>missed</Text>
                </View>
                <View style={[styles.adherenceDivider, { backgroundColor: colors.border }]} />
                <View style={styles.adherenceStat}>
                  <Text style={[styles.adherenceNum, { color: colors.text }]}>{totalTrainingDays}</Text>
                  <Text style={[styles.adherenceLabel, { color: colors.textSecondary }]}>total</Text>
                </View>
                <View style={[styles.adherenceDivider, { backgroundColor: colors.border }]} />
                <View style={styles.adherenceStat}>
                  <Text style={[styles.adherenceNum, { color: styleColor }]}>{adherencePct}%</Text>
                  <Text style={[styles.adherenceLabel, { color: colors.textSecondary }]}>rate</Text>
                </View>
              </View>
            </View>
          )}

          {/* ── Plan detail cards ────────────────────── */}
          <View style={styles.statsGrid}>
            {/* STYLE — editable */}
            <JiggleCard index={0} isEditMode={isEditMode} isEditable onPress={() => setEditingField(editingField === 'style' ? null : 'style')} style={styles.statCellWrap}>
              <View style={[styles.statCell, { backgroundColor: colors.cardSecondary, borderColor: isEditMode ? `${styleColor}50` : colors.border }]}>
                <View style={styles.statHeader}>
                  <PlatformIcon name="dumbbell" size={12} color={accent} />
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>STYLE</Text>
                </View>
                <Text style={[styles.statValue, { color: editStyle && editStyle !== plan.style ? styleColor : colors.text }]}>
                  {editStyle ?? plan.style}
                </Text>
                {isEditMode && <View style={[styles.editBadge, { backgroundColor: styleColor }]}><PlatformIcon name="pencil" size={10} color="#fff" /></View>}
              </View>
            </JiggleCard>

            {/* GOAL — not editable */}
            <View style={styles.statCellWrap}>
              <View style={[styles.statCell, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
                <View style={styles.statHeader}>
                  <PlatformIcon name="target" size={12} color={accent} />
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>GOAL</Text>
                </View>
                <Text style={[styles.statValue, { color: colors.text }]}>{plan.goal}</Text>
              </View>
            </View>

            {/* LEVEL — editable */}
            <JiggleCard index={1} isEditMode={isEditMode} isEditable onPress={() => setEditingField(editingField === 'level' ? null : 'level')} style={styles.statCellWrap}>
              <View style={[styles.statCell, { backgroundColor: colors.cardSecondary, borderColor: isEditMode ? `${styleColor}50` : colors.border }]}>
                <View style={styles.statHeader}>
                  <PlatformIcon name="star" size={12} color={accent} />
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>LEVEL</Text>
                </View>
                <Text style={[styles.statValue, { color: editLevel && editLevel !== plan.experienceLevel ? styleColor : colors.text }]}>
                  {(editLevel ?? plan.experienceLevel).charAt(0).toUpperCase() + (editLevel ?? plan.experienceLevel).slice(1)}
                </Text>
                {isEditMode && <View style={[styles.editBadge, { backgroundColor: styleColor }]}><PlatformIcon name="pencil" size={10} color="#fff" /></View>}
              </View>
            </JiggleCard>

            {/* EQUIPMENT — not editable */}
            {plan.equipment !== undefined && (
              <View style={styles.statCellWrap}>
                <View style={[styles.statCell, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
                  <View style={styles.statHeader}>
                    <PlatformIcon name="layers" size={12} color={accent} />
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>EQUIPMENT</Text>
                  </View>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {Object.values(plan.equipment).filter(v => v > 0).length === 0
                      ? 'Bodyweight'
                      : `${Object.values(plan.equipment).filter(v => v > 0).length} items`}
                  </Text>
                </View>
              </View>
            )}

            {/* START — not editable */}
            <View style={styles.statCellWrap}>
              <View style={[styles.statCell, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
                <View style={styles.statHeader}>
                  <PlatformIcon name="calendar" size={12} color={accent} />
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>START</Text>
                </View>
                <Text style={[styles.statValue, { color: colors.text }]}>{formatDateShort(plan.startDate)}</Text>
              </View>
            </View>

            {/* END — not editable */}
            <View style={styles.statCellWrap}>
              <View style={[styles.statCell, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
                <View style={styles.statHeader}>
                  <PlatformIcon name="calendar" size={12} color={accent} />
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>END</Text>
                </View>
                <Text style={[styles.statValue, { color: colors.text }]}>{formatDateFull(plan.endDate)}</Text>
              </View>
            </View>

            {/* DAYS/WEEK — editable */}
            <JiggleCard index={2} isEditMode={isEditMode} isEditable onPress={() => setEditingField(editingField === 'daysPerWeek' ? null : 'daysPerWeek')} style={styles.statCellWrap}>
              <View style={[styles.statCell, { backgroundColor: colors.cardSecondary, borderColor: isEditMode ? `${styleColor}50` : colors.border }]}>
                <View style={styles.statHeader}>
                  <PlatformIcon name="dumbbell" size={12} color={accent} />
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>DAYS/WEEK</Text>
                </View>
                <Text style={[styles.statValue, { color: editDaysPerWeek && editDaysPerWeek !== plan.daysPerWeek ? styleColor : colors.text }]}>
                  {editDaysPerWeek ?? plan.daysPerWeek} days
                </Text>
                {isEditMode && <View style={[styles.editBadge, { backgroundColor: styleColor }]}><PlatformIcon name="pencil" size={10} color="#fff" /></View>}
              </View>
            </JiggleCard>

            {/* DURATION — editable */}
            <JiggleCard index={3} isEditMode={isEditMode} isEditable onPress={() => setEditingField(editingField === 'duration' ? null : 'duration')} style={styles.statCellWrap}>
              <View style={[styles.statCell, { backgroundColor: colors.cardSecondary, borderColor: isEditMode ? `${styleColor}50` : colors.border }]}>
                <View style={styles.statHeader}>
                  <PlatformIcon name="clock" size={12} color={accent} />
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>DURATION</Text>
                </View>
                <Text style={[styles.statValue, { color: editDuration && editDuration !== plan.sessionDuration ? styleColor : colors.text }]}>
                  {editDuration ?? plan.sessionDuration} min
                </Text>
                {isEditMode && <View style={[styles.editBadge, { backgroundColor: styleColor }]}><PlatformIcon name="pencil" size={10} color="#fff" /></View>}
              </View>
            </JiggleCard>

            {/* WEEKS LEFT — not editable */}
            <View style={styles.statCellWrap}>
              <View style={[styles.statCell, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
                <View style={styles.statHeader}>
                  <PlatformIcon name="bar-chart-3" size={12} color={accent} />
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>WEEKS LEFT</Text>
                </View>
                <Text style={[styles.statValue, { color: colors.text }]}>{weeksLeft} weeks</Text>
              </View>
            </View>
          </View>

          {/* ── Inline picker (when editing a field) ── */}
          {isEditMode && editingField && (
            <View style={styles.pickerContainer}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                {editingField === 'style' ? 'SELECT STYLE' : editingField === 'level' ? 'SELECT LEVEL' : editingField === 'daysPerWeek' ? 'DAYS PER WEEK' : 'SESSION DURATION'}
              </Text>
              <View style={styles.pickerRow}>
                {(editingField === 'style' ? EDITABLE_STYLES :
                  editingField === 'level' ? EDITABLE_LEVELS :
                  editingField === 'daysPerWeek' ? EDITABLE_DAYS :
                  EDITABLE_DURATIONS
                ).map((opt) => {
                  const val = editingField === 'style' ? editStyle : editingField === 'level' ? editLevel : editingField === 'daysPerWeek' ? editDaysPerWeek : editDuration;
                  const isSelected = val === opt;
                  const label = editingField === 'level'
                    ? (opt as string).charAt(0).toUpperCase() + (opt as string).slice(1)
                    : editingField === 'daysPerWeek'
                      ? `${opt}`
                      : editingField === 'duration'
                        ? `${opt}m`
                        : String(opt);
                  return (
                    <TouchableOpacity
                      key={String(opt)}
                      style={[
                        styles.pickerPill,
                        { borderColor: isSelected ? styleColor : colors.border },
                        isSelected && { backgroundColor: `${styleColor}20` },
                      ]}
                      onPress={() => {
                        if (editingField === 'style') setEditStyle(opt as string);
                        else if (editingField === 'level') setEditLevel(opt as string);
                        else if (editingField === 'daysPerWeek') setEditDaysPerWeek(opt as number);
                        else setEditDuration(opt as number);
                        Haptics.selectionAsync().catch(() => {});
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.pickerPillText, { color: isSelected ? styleColor : colors.text }]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

        {/* ── Schedule overview ─────────────────────────── */}
        {schedule && (
          <View style={[styles.scheduleStats, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
            <View style={styles.scheduleRow}>
              <Text style={[styles.scheduleRowLabel, { color: colors.textSecondary }]}>Total training days</Text>
              <Text style={[styles.scheduleRowValue, { color: colors.text }]}>{schedule.total_training_days}</Text>
            </View>
            <View style={[styles.scheduleRow, { borderTopWidth: 0.5, borderTopColor: colors.border }]}>
              <Text style={[styles.scheduleRowLabel, { color: colors.textSecondary }]}>Total rest days</Text>
              <Text style={[styles.scheduleRowValue, { color: colors.text }]}>{schedule.total_rest_days}</Text>
            </View>
          </View>
        )}

        {/* ── Actions ───────────────────────────────────── */}
        {isEditMode ? (
          <>
            <View style={styles.editActions}>
              <TouchableOpacity
                style={[styles.ghostBtn, { borderColor: colors.border, flex: 1 }]}
                onPress={exitEditMode}
                activeOpacity={0.7}
              >
                <Text style={[styles.ghostBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.ghostBtn,
                  {
                    flex: 1,
                    borderColor: hasChanges ? styleColor : colors.border,
                    backgroundColor: hasChanges ? `${styleColor}15` : 'transparent',
                    opacity: hasChanges && !isSaving ? 1 : 0.5,
                  },
                ]}
                onPress={handleSaveEdits}
                activeOpacity={0.7}
                disabled={!hasChanges || isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={styleColor} />
                ) : (
                  <>
                    <PlatformIcon name="check" size={14} color={hasChanges ? styleColor : colors.textMuted} />
                    <Text style={[styles.ghostBtnText, { color: hasChanges ? styleColor : colors.textMuted }]}>Save Changes</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            {!isPlanComplete && (
              <TouchableOpacity
                style={[styles.ghostBtn, { borderColor: styleColor + '40' }]}
                onPress={enterEditMode}
                activeOpacity={0.7}
              >
                <PlatformIcon name="pencil" size={14} color={styleColor} />
                <Text style={[styles.ghostBtnText, { color: styleColor }]}>Edit Plan</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.ghostBtn, { borderColor: colors.border }]}
              onPress={handleStartNew}
              activeOpacity={0.7}
            >
              <PlatformIcon name="refresh" size={14} color={colors.textSecondary} />
              <Text style={[styles.ghostBtnText, { color: colors.textSecondary }]}>Start New Plan</Text>
            </TouchableOpacity>

            {!isPlanComplete && (
              plan.pausedAt ? (
                <TouchableOpacity
                  style={[styles.ghostBtn, { borderColor: '#22c55e40' }]}
                  onPress={handleResumePlan}
                  activeOpacity={0.7}
                >
                  <PlatformIcon name="play" size={14} color="#22c55e" />
                  <Text style={[styles.ghostBtnText, { color: '#22c55e' }]}>Resume Plan</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.ghostBtn, { borderColor: colors.border }]}
                  onPress={handlePausePlan}
                  activeOpacity={0.7}
                >
                  <PlatformIcon name="pause" size={14} color={colors.textSecondary} />
                  <Text style={[styles.ghostBtnText, { color: colors.textSecondary }]}>Pause Plan</Text>
                </TouchableOpacity>
              )
            )}

            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: '#ef444430' }]}
              onPress={handleCancelPlan}
              activeOpacity={0.7}
            >
              <PlatformIcon name="trash" size={14} color="#ef4444" />
              <Text style={styles.cancelBtnText}>Cancel Plan</Text>
            </TouchableOpacity>
          </>
        )}

        </>)}

        {/* ═══════════════════════════════════════════════ */}
        {/*  PROGRESS TAB (75 Hard only)                   */}
        {/* ═══════════════════════════════════════════════ */}
        {activeTab === 2 && plan.is75Hard && (<>

          {/* ─── Overview stats ─── */}
          <View style={styles.sfOverviewRow}>
            <View style={[styles.sfStatBox, { backgroundColor: colors.cardSecondary }]}>
              <Text style={[styles.sfStatValue, { color: '#f87116' }]}>{sfHard.currentDay}</Text>
              <Text style={[styles.sfStatLabel, { color: colors.textSecondary }]}>Current Day</Text>
            </View>
            <View style={[styles.sfStatBox, { backgroundColor: colors.cardSecondary }]}>
              <Text style={[styles.sfStatValue, { color: SFHARD_GREEN }]}>{sfStats?.fullyComplete ?? 0}</Text>
              <Text style={[styles.sfStatLabel, { color: colors.textSecondary }]}>Perfect Days</Text>
            </View>
            <View style={[styles.sfStatBox, { backgroundColor: colors.cardSecondary }]}>
              <Text style={[styles.sfStatValue, { color: colors.text }]}>{75 - sfHard.currentDay + 1}</Text>
              <Text style={[styles.sfStatLabel, { color: colors.textSecondary }]}>Remaining</Text>
            </View>
          </View>

          {/* ─── Overall progress bar ─── */}
          <View style={styles.sfSection}>
            <Text style={[styles.sfSectionLabel, { color: colors.textSecondary }]}>overall progress</Text>
            <View style={[styles.sfProgressTrack, { backgroundColor: 'rgba(248,113,22,0.12)' }]}>
              <View style={[styles.sfProgressFill, { width: `${Math.round(((sfStats?.fullyComplete ?? 0) / 75) * 100)}%` as any, backgroundColor: '#f87116' }]} />
            </View>
            <Text style={[styles.sfProgressText, { color: colors.textMuted }]}>{sfStats?.fullyComplete ?? 0}/75 days fully completed</Text>
          </View>

          {/* ─── Category adherence bars ─── */}
          <View style={styles.sfSection}>
            <Text style={[styles.sfSectionLabel, { color: colors.textSecondary }]}>category adherence</Text>
            {sfAdherenceBars.map((bar) => {
              const pct = bar.total > 0 ? Math.round((bar.count / bar.total) * 100) : 0;
              return (
                <View key={bar.label} style={styles.sfBarRow}>
                  <View style={styles.sfBarLabelRow}>
                    <PlatformIcon name={bar.icon as any} size={13} color={bar.color} />
                    <Text style={[styles.sfBarLabel, { color: colors.text }]}>{bar.label}</Text>
                    <Text style={[styles.sfBarPct, { color: colors.textMuted }]}>{pct}%</Text>
                  </View>
                  <View style={[styles.sfBarTrack, { backgroundColor: `${bar.color}15` }]}>
                    <View style={[styles.sfBarFill, { width: `${pct}%` as any, backgroundColor: bar.color }]} />
                  </View>
                </View>
              );
            })}
          </View>

          {/* ─── Heatmap ─── */}
          <View style={styles.sfSection}>
            <Text style={[styles.sfSectionLabel, { color: colors.textSecondary }]}>75-day heatmap</Text>
            <View style={styles.sfHeatmapGrid}>
              {sfHeatmapCells.map((cell) => (
                <View key={cell.day} style={[styles.sfHeatmapCell, { backgroundColor: cell.color }]} />
              ))}
            </View>
            <View style={styles.sfLegendRow}>
              {[{ color: SFHARD_GREEN, label: 'Complete' }, { color: SFHARD_YELLOW, label: 'Partial' }, { color: SFHARD_RED, label: 'Missed' }, { color: SFHARD_GRAY, label: 'Future' }].map(({ color, label }) => (
                <View key={label} style={styles.sfLegendItem}>
                  <View style={[styles.sfLegendDot, { backgroundColor: color }]} />
                  <Text style={[styles.sfLegendText, { color: colors.textMuted }]}>{label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ─── Photo timeline ─── */}
          {sfPhotoTimeline.length > 0 && (
            <View style={styles.sfSection}>
              <Text style={[styles.sfSectionLabel, { color: colors.textSecondary }]}>photo timeline</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {sfPhotoTimeline.map((day) => (
                  <TouchableOpacity
                    key={day.date}
                    style={styles.sfPhotoThumbWrap}
                    onPress={() => setSelectedPhoto({ uri: day.photoUri!, date: day.date })}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{ uri: day.photoUri }}
                      style={[styles.sfPhotoThumb, { borderColor: colors.border }]}
                      resizeMode="cover"
                    />
                    <Text style={[styles.sfPhotoDate, { color: colors.textMuted }]}>
                      {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ─── Reset history ─── */}
          {sfHard.state && sfHard.state.resetHistory.length > 0 && (
            <View style={styles.sfSection}>
              <Text style={[styles.sfSectionLabel, { color: colors.textSecondary }]}>reset history</Text>
              <Text style={[styles.sfResetText, { color: colors.textMuted }]}>
                Restarted {sfHard.state.resetHistory.length} time{sfHard.state.resetHistory.length > 1 ? 's' : ''}
                {' — '}
                {sfHard.state.resetHistory.map(d =>
                  new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                ).join(', ')}
              </Text>
            </View>
          )}

          {/* ─── Actions ─── */}
          <View style={styles.sfActionsSection}>
            <TouchableOpacity
              style={[styles.sfResetBtn, { borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.05)' }]}
              onPress={handleSfReset}
              activeOpacity={0.7}
            >
              <PlatformIcon name="refresh" size={12} color={colors.textMuted} />
              <Text style={[styles.sfResetBtnText, { color: colors.textMuted }]}>Reset to Day 1</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sfEndBtn, { borderColor: 'rgba(239,68,68,0.25)', backgroundColor: 'rgba(239,68,68,0.07)' }]}
              onPress={handleSfEndChallenge}
              activeOpacity={0.7}
            >
              <PlatformIcon name="x" size={12} color="rgba(239,68,68,0.6)" />
              <Text style={[styles.sfEndBtnText, { color: 'rgba(239,68,68,0.6)' }]}>End Challenge</Text>
            </TouchableOpacity>
          </View>

        </>)}

        <View style={{ height: 24 }} />
      </View>

      <PlanDayPreviewDrawer
        visible={previewVisible}
        onClose={() => setPreviewVisible(false)}
        onClosePlan={onClose}
        day={previewDay}
      />

      <PlanScheduleDrawer
        visible={fullPlanVisible}
        onClose={() => setFullPlanVisible(false)}
        onClosePlan={onClose}
      />
    </BaseDrawer>

    {/* ─── Full-screen photo overlay (75 Hard) ─── */}
    <Modal
      visible={!!selectedPhoto}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => setSelectedPhoto(null)}
    >
      <Pressable style={styles.sfOverlayBackdrop} onPress={() => setSelectedPhoto(null)}>
        <View style={styles.sfOverlayContent}>
          {selectedPhoto && (
            <>
              <Image
                source={{ uri: selectedPhoto.uri }}
                style={styles.sfOverlayImage}
                resizeMode="contain"
              />
              <Text style={styles.sfOverlayDate}>
                {new Date(selectedPhoto.date + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'short', month: 'long', day: 'numeric',
                })}
              </Text>
            </>
          )}
          <TouchableOpacity style={styles.sfOverlayClose} onPress={() => setSelectedPhoto(null)}>
            <PlatformIcon name="x" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerLabel: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(128,128,128,0.15)', alignItems: 'center', justifyContent: 'center',
  },

  content: { paddingHorizontal: 16, gap: 10, paddingBottom: 8 },
  planName: { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.5 },

  planTabBar: {
    flexDirection: 'row' as const,
    height: 46,
    paddingVertical: 5,
    paddingHorizontal: 5,
    position: 'relative' as const,
    overflow: 'hidden' as const,
    backgroundColor: 'rgba(20,20,20,0.98)',
    borderRadius: 23,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  planTabPill: {
    position: 'absolute' as const,
    top: 5,
    bottom: 5,
    left: 0,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  planTabBtn: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 8,
    zIndex: 1,
  },
  planTabLabel: {
    fontSize: 13,
    letterSpacing: 0.1,
    includeFontPadding: false,
  },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  tagText: { fontSize: 12, fontWeight: '600' as const },

  // Plan completion card
  completionCard: {
    borderRadius: 16, borderWidth: 1, padding: 16, gap: 12,
  },
  completionTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  completionIconWrap: {
    width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
  },
  completionTextBlock: { flex: 1, gap: 3 },
  completionTitle: { fontSize: 20, fontWeight: '800' as const, letterSpacing: -0.3 },
  completionSub: { fontSize: 12 },
  completionDivider: { height: 1 },
  completionStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  completionStat: { alignItems: 'center', gap: 3, flex: 1 },
  completionStatNum: { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.5 },
  completionStatLabel: { fontSize: 11 },
  completionStatDivider: { width: 1, height: 32 },

  // Progress
  progressSection: { gap: 6 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { fontSize: 10, fontWeight: '700' as const, letterSpacing: 0.8 },
  progressWeek: { fontSize: 12, fontWeight: '500' as const },
  progressTrack: { height: 10, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: 10, borderRadius: 999 },
  progressFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  progressPct: { fontSize: 11, fontWeight: '600' as const },
  progressLeft: { fontSize: 11 },

  // Today card
  todayCard: {
    flexDirection: 'row', borderRadius: 16, borderWidth: 1, overflow: 'hidden',
  },
  todayAccentBar: { width: 4, borderRadius: 0 },
  todayBody: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, gap: 6 },
  todayLabel: { fontSize: 10, fontWeight: '700' as const, letterSpacing: 1 },
  todayMain: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  todayTextBlock: { flex: 1, gap: 3 },
  todaySession: { fontSize: 17, fontWeight: '700' as const, letterSpacing: -0.2 },
  todaySub: { fontSize: 12, fontWeight: '400' as const },
  todayMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  todayMetaText: { fontSize: 12 },
  todayMetaDot: { fontSize: 12 },

  // Start today CTA
  startTodayBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 16, paddingVertical: 14,
  },
  startTodayBtnText: {
    fontSize: 15, fontWeight: '700' as const, color: '#fff', letterSpacing: -0.2, flex: 1, textAlign: 'center' as const,
  },

  // Recovery inline row
  recoveryInlineRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  recoveryInlineText: {
    flex: 1, fontSize: 11, fontFamily: 'Outfit_400Regular', lineHeight: 15,
  },

  // Phase timeline
  sectionLabel: { fontSize: 10, fontWeight: '700' as const, letterSpacing: 0.8, marginBottom: 8 },
  phaseTimeline: { gap: 0 },
  phaseTimelineScroll: { gap: 6, paddingRight: 16 },
  phaseWeekDot: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5,
  },
  phaseWeekPhase: { fontSize: 11, fontWeight: '800' as const, lineHeight: 13 },
  phaseWeekNum: { fontSize: 9, fontWeight: '500' as const, lineHeight: 11 },
  deloadDot: { position: 'absolute', bottom: -1, width: 6, height: 6, borderRadius: 3 },

  // Week detail
  weekDetailSection: { gap: 10 },
  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekNavBtn: { padding: 4 },
  weekNavCenter: { alignItems: 'center', gap: 4 },
  weekNavTitle: { fontSize: 18, fontWeight: '800' as const },
  phaseBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  phaseBadgeText: { fontSize: 11, fontWeight: '600' as const },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8,
  },
  infoRowText: { fontSize: 12, fontWeight: '500' as const, flex: 1 },

  // Day grid
  dayGrid: { gap: 6 },
  dayCard: { borderRadius: 12, padding: 12, gap: 5 },
  dayCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayCardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dayLabel: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.5 },
  dayDate: { fontSize: 10 },
  completedBadge: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: 'rgba(34,197,94,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  missedBadge: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: 'rgba(239,68,68,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  restContent: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  restLabel: { fontSize: 13, fontWeight: '500' as const },
  trainingContent: { gap: 3 },
  dayStyleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dayStyleText: { fontSize: 13, fontWeight: '600' as const, flex: 1 },
  dayMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dayMetaText: { fontSize: 11 },
  dayTagRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  deloadTag: {
    alignSelf: 'flex-start', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2, backgroundColor: '#22c55e20',
  },
  deloadTagText: { fontSize: 10, fontWeight: '600' as const, color: '#22c55e' },
  missedTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2, backgroundColor: '#ef444420',
  },
  missedTagText: { fontSize: 10, fontWeight: '600' as const, color: '#ef4444' },
  effortTag: {
    alignSelf: 'flex-start', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2, backgroundColor: 'rgba(255,255,255,0.07)',
  },
  effortTagText: { fontSize: 10, fontWeight: '600' as const, color: '#9a9a9a' },

  // Stats grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCellWrap: { flexGrow: 1, flexBasis: '45%' },
  statCell: {
    borderRadius: 12, borderWidth: 1,
    padding: 14, gap: 6,
  },
  statHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statLabel: { fontSize: 9, fontWeight: '700' as const, letterSpacing: 0.6 },
  statValue: { fontSize: 16, fontWeight: '700' as const },

  // Schedule overview
  scheduleStats: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  scheduleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  scheduleRowLabel: { fontSize: 12, fontWeight: '500' as const },
  scheduleRowValue: { fontSize: 14, fontWeight: '600' as const, maxWidth: '60%' as any, textAlign: 'right' as const },

  // Actions
  ghostBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderRadius: 14, paddingVertical: 14,
  },
  ghostBtnText: { fontSize: 14, fontWeight: '600' as const },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14, borderWidth: 1,
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600' as const, color: '#ef4444' },

  // Edit mode
  editBadge: {
    position: 'absolute', top: -4, right: -4, width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', zIndex: 2,
  },
  editActions: { flexDirection: 'row', gap: 10 },
  pickerContainer: { gap: 8 },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pickerPill: {
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9, borderWidth: 1,
  },
  pickerPillText: { fontSize: 13, fontWeight: '600' as const },

  // Paused banner
  pausedBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: 12, borderWidth: 1, padding: 12,
  },
  pausedBannerTitle: { fontSize: 13, fontWeight: '700' as const },
  pausedBannerSub: { fontSize: 12, marginTop: 2, lineHeight: 17 },

  // Recovery dismiss
  recoveryDismissBtn: {
    alignSelf: 'flex-end', marginTop: 4,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, backgroundColor: '#f8711620',
  },
  recoveryDismissText: { fontSize: 12, fontWeight: '600' as const, color: '#f87116' },

  // Adherence card
  adherenceCard: {
    borderRadius: 14, borderWidth: 1, padding: 14, gap: 10,
  },
  adherenceRow: {
    flexDirection: 'row', alignItems: 'stretch',
  },
  adherenceStat: { alignItems: 'center', justifyContent: 'center', gap: 3, flex: 1, paddingVertical: 4 },
  adherenceDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: 2 },
  adherenceNum: { fontSize: 20, fontWeight: '800' as const, letterSpacing: -0.5 },
  adherenceLabel: { fontSize: 10, fontWeight: '600' as const, letterSpacing: 0.4 },
  adherenceTrack: {
    height: 4, borderRadius: 2, overflow: 'hidden', flexDirection: 'row',
  },
  adherenceFill: { height: 4 },
  adherenceMissedFill: { height: 4, position: 'absolute', top: 0, backgroundColor: '#ef4444' },

  // 75 Hard Progress tab
  sfOverviewRow: { flexDirection: 'row', gap: 8 },
  sfStatBox: { flex: 1, alignItems: 'center', borderRadius: 14, paddingVertical: 14, gap: 2 },
  sfStatValue: { fontSize: 24, fontFamily: 'Outfit_800ExtraBold', letterSpacing: -1 },
  sfStatLabel: { fontSize: 11, fontFamily: 'Outfit_500Medium' },
  sfSection: { gap: 8 },
  sfSectionLabel: { fontSize: 11, fontFamily: 'Outfit_600SemiBold', letterSpacing: 0.5, textTransform: 'uppercase' },
  sfProgressTrack: { height: 10, borderRadius: 999, overflow: 'hidden' },
  sfProgressFill: { height: 10, borderRadius: 999 },
  sfProgressText: { fontSize: 11, fontFamily: 'Outfit_400Regular' },
  sfBarRow: { gap: 4 },
  sfBarLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sfBarLabel: { flex: 1, fontSize: 13, fontFamily: 'Outfit_500Medium' },
  sfBarPct: { fontSize: 12, fontFamily: 'Outfit_600SemiBold' },
  sfBarTrack: { height: 8, borderRadius: 999, overflow: 'hidden' },
  sfBarFill: { height: 8, borderRadius: 999 },
  sfHeatmapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  sfHeatmapCell: { width: 18, height: 18, borderRadius: 4 },
  sfLegendRow: { flexDirection: 'row', gap: 14, marginTop: 4 },
  sfLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sfLegendDot: { width: 8, height: 8, borderRadius: 2 },
  sfLegendText: { fontSize: 10, fontFamily: 'Outfit_400Regular' },
  sfPhotoThumbWrap: { alignItems: 'center', gap: 5, marginRight: 10 },
  sfPhotoThumb: { width: 80, height: 106, borderRadius: 12, borderWidth: 1 },
  sfPhotoDate: { fontSize: 10, fontFamily: 'Outfit_500Medium' },
  sfResetText: { fontSize: 12, fontFamily: 'Outfit_400Regular' },
  sfActionsSection: { flexDirection: 'row', gap: 8, marginTop: 4 },
  sfResetBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderWidth: 1, borderRadius: 12, paddingVertical: 10,
  },
  sfResetBtnText: { fontSize: 12, fontFamily: 'Outfit_500Medium' },
  sfEndBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderWidth: 1, borderRadius: 12, paddingVertical: 10,
  },
  sfEndBtnText: { fontSize: 12, fontFamily: 'Outfit_500Medium' },
  sfOverlayBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  sfOverlayContent: { width: SCREEN_W, alignItems: 'center', gap: 14 },
  sfOverlayImage: { width: SCREEN_W, height: SCREEN_H * 0.72 },
  sfOverlayDate: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: 'Outfit_500Medium' },
  sfOverlayClose: {
    position: 'absolute', top: -SCREEN_H * 0.38, right: 20,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },

});
