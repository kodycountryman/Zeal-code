import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Modal,
} from 'react-native';
import BaseDrawer from '@/components/drawers/BaseDrawer';
import GlassCard from '@/components/GlassCard';
import StyleTrackerDrawer from '@/components/drawers/StyleTrackerDrawer';
import MuscleReadinessDrawer from '@/components/drawers/MuscleReadinessDrawer';
import Svg, { Polygon, Line, Circle as SvgCircle, Polyline } from 'react-native-svg';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme, useAppContext } from '@/context/AppContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { showProGate, PRO_GOLD, PRO_LOCKED_OPACITY } from '@/services/proGate';
import { MILESTONES, computeMilestoneProgress } from '@/services/milestonesData';
import AchievementModal, { type Achievement } from '@/components/drawers/AchievementModal';
import RunInsights from '@/components/run/RunInsights';
import RunLogDrawer from '@/components/drawers/RunLogDrawer';
import { healthService } from '@/services/healthService';
import { useWorkoutTracking, type WorkoutLog, type PersonalRecord } from '@/context/WorkoutTrackingContext';
import { useRun } from '@/context/RunContext';
import { WORKOUT_STYLE_COLORS } from '@/constants/colors';
import {
  getRadarPercentiles,
  getTierForPercentile,
  getNextTierTarget,
  TIER_COLORS,
  RADAR_CATEGORY_LABELS,
  type RadarCategory,
  type RadarPercentileResult,
} from '@/constants/strengthStandards';
import {
  detectInsightPatterns,
  getTrainingLoadTrend,
  getWeekDayBars,
  getConsistencyData,
  getStyleInsights,
  getGroupedPRs,
  getLifetimeTotals,
  getStrengthRatios,
  getProgressiveOverload,
  getPatternAnalysis,
  getProjections,
  getSelfComparison,
  getMuscleReadinessSummary,
  getDurationTrend,
  getPeakPerformanceWindow,
  getSplitAdherence,
  getCalorieTrend,
  getRestDayPatterns,
  getExerciseFrequency,
  getEquipmentUsage,
  getMuscleBalanceScore,
  getSessionQualityTrend,
  getFavoriteExercises,
  getPRTimeline,
  getRecordsBoard,
  getWarmupCompliance,
  computeBadges,
  type InsightTip,
  type StyleInsightData,
  type PRCategory,
  type Badge,
} from '@/services/insightsEngine';

interface Props {
  visible: boolean;
  onClose: () => void;
}

// ─── Milestones — imported from services/milestonesData ─────

function getMilestoneIcon(iconName: string, color: string, size: number) {
  const nameMap: Record<string, string> = {
    zap: 'zap', trophy: 'trophy', flame: 'flame', award: 'award',
    medal: 'medal', crown: 'crown', shield: 'shield', dumbbell: 'dumbbell', target: 'target',
  };
  const name = nameMap[iconName] ?? 'zap';
  return <PlatformIcon name={name as any} size={size} color={color} />;
}

// ─── Helpers ────────────────────────────────────────────────

function getWeekStartDate(): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function getThisWeekLogs(history: WorkoutLog[]): WorkoutLog[] {
  const weekStart = getWeekStartDate();
  weekStart.setHours(0, 0, 0, 0);
  return history.filter(log => {
    const logDate = new Date(log.date);
    logDate.setHours(0, 0, 0, 0);
    return logDate >= weekStart;
  });
}

function est1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  return Math.round(weight * reps * 0.0333 + weight);
}

function getUniquePRs(prHistory: PersonalRecord[]): { exerciseName: string; weight: number; reps: number; e1rm: number; date: string }[] {
  const bestByExercise = new Map<string, { weight: number; reps: number; date: string }>();
  for (const pr of prHistory) {
    if (pr.type === 'weight') {
      const existing = bestByExercise.get(pr.exerciseName);
      if (!existing || pr.value > existing.weight) {
        bestByExercise.set(pr.exerciseName, { weight: pr.value, reps: existing?.reps ?? 1, date: pr.date });
      }
    }
    if (pr.type === 'reps') {
      const existing = bestByExercise.get(pr.exerciseName);
      if (existing) {
        if (pr.value > existing.reps) bestByExercise.set(pr.exerciseName, { ...existing, reps: pr.value });
      } else {
        bestByExercise.set(pr.exerciseName, { weight: 0, reps: pr.value, date: pr.date });
      }
    }
  }
  const results: { exerciseName: string; weight: number; reps: number; e1rm: number; date: string }[] = [];
  bestByExercise.forEach((val, name) => {
    if (val.weight > 0) results.push({ exerciseName: name, weight: val.weight, reps: val.reps, e1rm: est1RM(val.weight, val.reps), date: val.date });
  });
  results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return results;
}

// ─── Radar Chart (SVG) ─────────────────────────────────────

const RADAR_SIZE = 280;
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_RADIUS = 105;
const RADAR_AXES: RadarCategory[] = ['upper_push', 'upper_pull', 'lower_body', 'core', 'conditioning', 'cardio'];

function polarToCartesian(angleDeg: number, radius: number): { x: number; y: number } {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: RADAR_CENTER + radius * Math.cos(angleRad), y: RADAR_CENTER + radius * Math.sin(angleRad) };
}

function RadarChart({ data, colors: themeColors, accent }: { data: RadarPercentileResult[]; colors: any; accent: string }) {
  const gridLevels = [0.25, 0.5, 0.75, 1.0];
  const angleStep = 360 / 6;

  const axisPoints = data.map((d, i) => {
    const angle = i * angleStep;
    const val = d.percentile !== null ? d.percentile / 100 : 0;
    return {
      ...d,
      angle,
      value: val,
      outer: polarToCartesian(angle, RADAR_RADIUS),
      data: polarToCartesian(angle, RADAR_RADIUS * Math.max(val, 0.02)),
    };
  });

  const dataPolygon = axisPoints.map(p => `${p.data.x},${p.data.y}`).join(' ');

  return (
    <Svg width={RADAR_SIZE} height={RADAR_SIZE} viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}>
      {gridLevels.map((level) => {
        const pts = Array.from({ length: 6 }, (_, i) => {
          const p = polarToCartesian(i * angleStep, RADAR_RADIUS * level);
          return `${p.x},${p.y}`;
        }).join(' ');
        return <Polygon key={`grid-${level}`} points={pts} fill="none" stroke={themeColors.border} strokeWidth={0.8} opacity={0.5} />;
      })}
      {axisPoints.map((p) => (
        <Line key={`axis-${p.category}`} x1={RADAR_CENTER} y1={RADAR_CENTER} x2={p.outer.x} y2={p.outer.y} stroke={themeColors.border} strokeWidth={0.6} opacity={0.4} />
      ))}
      <Polygon points={dataPolygon} fill={accent} fillOpacity={0.25} stroke={accent} strokeWidth={2} />
      {axisPoints.map((p) => (
        <SvgCircle key={`dot-${p.category}`} cx={p.data.x} cy={p.data.y} r={3.5} fill={p.percentile !== null ? accent : themeColors.textMuted} />
      ))}
    </Svg>
  );
}

// ─── Insight Tip Icon ───────────────────────────────────────

function InsightIcon({ name, color, size = 18 }: { name: string; color: string; size?: number }) {
  const iconName = (['trophy', 'heart-pulse', 'footprints'].includes(name) ? name : 'sparkles') as any;
  return <PlatformIcon name={iconName} size={size} color={color} />;
}

// ─── Main Component ─────────────────────────────────────────

export default function InsightsDrawer({ visible, onClose }: Props) {
  const { colors, accent, isDark } = useZealTheme();
  const ctx = useAppContext();
  const tracking = useWorkoutTracking();
  const run = useRun();
  const { hasPro, openPaywall } = useSubscription();

  const [tipAxis, setTipAxis] = useState<RadarCategory | null>(null);
  const tipAnim = useRef(new Animated.Value(0)).current;
  const [prShowAll, setPrShowAll] = useState(false);
  const [prTimelineShowAll, setPrTimelineShowAll] = useState(false);
  const [trackerVisible, setTrackerVisible] = useState(false);
  const [readinessDrawerVisible, setReadinessDrawerVisible] = useState(false);
  const [infoToast, setInfoToast] = useState<{ title: string; body: string } | null>(null);
  const infoToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showInfo = useCallback((title: string, body: string) => {
    if (infoToastTimer.current) clearTimeout(infoToastTimer.current);
    setInfoToast({ title, body });
    infoToastTimer.current = setTimeout(() => setInfoToast(null), 4500);
  }, []);
  const [detailItem, setDetailItem] = useState<Achievement | null>(null);

  // ─── Tab bar state ──────────────────────────────────────
  type InsightsTab = 'insights' | 'achievements' | 'stats' | 'running';
  const [activeInsightsTab, setActiveInsightsTab] = useState<InsightsTab>('insights');
  const [runLogId, setRunLogId] = useState<string | null>(null);
  const [runLogVisible, setRunLogVisible] = useState(false);
  const pillAnim = useRef(new Animated.Value(0)).current;
  const [tabItemWidth, setTabItemWidth] = useState(0);
  const [tabXOffsets, setTabXOffsets] = useState<[number, number, number, number]>([0, 0, 0, 0]);

  const switchTab = useCallback((tab: InsightsTab) => {
    setActiveInsightsTab(tab);
    const idx = tab === 'insights' ? 0 : tab === 'achievements' ? 1 : tab === 'stats' ? 2 : 3;
    Animated.spring(pillAnim, { toValue: idx, useNativeDriver: true, friction: 20, tension: 200 }).start();
  }, [pillAnim]);

  // Reset tab when drawer opens
  useEffect(() => {
    if (visible) {
      setActiveInsightsTab('insights');
      pillAnim.setValue(0);
    }
  }, [visible, pillAnim]);

  const [healthSteps, setHealthSteps] = useState(0);
  const [healthCalories, setHealthCalories] = useState(0);
  const [healthHeartRate, setHealthHeartRate] = useState<number | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  // ─── Health data fetch ──────────────────────────────────
  useEffect(() => {
    if (visible && ctx.healthConnected && ctx.healthSyncEnabled && Platform.OS !== 'web') {
      setHealthLoading(true);
      healthService.getAllHealthData().then((data) => {
        setHealthSteps(data.steps);
        setHealthCalories(data.activeCalories);
        setHealthHeartRate(data.restingHeartRate);
      }).catch(() => {}).finally(() => setHealthLoading(false));
    }
  }, [visible, ctx.healthConnected, ctx.healthSyncEnabled]);

  useEffect(() => {
    Animated.timing(tipAnim, { toValue: tipAxis ? 1 : 0, duration: 250, useNativeDriver: true }).start();
  }, [tipAxis, tipAnim]);

  // ─── Data ───────────────────────────────────────────────
  const displayHistory = useMemo(() => {
    if (hasPro) return tracking.workoutHistory;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    cutoff.setHours(0, 0, 0, 0);
    return tracking.workoutHistory.filter(l => new Date(l.date + 'T00:00:00') >= cutoff);
  }, [hasPro, tracking.workoutHistory]);

  const weekLogs = useMemo(() => getThisWeekLogs(displayHistory), [displayHistory]);

  const weeklyTime = useMemo(() => {
    const totalMin = weekLogs.reduce((sum, l) => sum + l.duration, 0);
    if (totalMin >= 60) { const h = Math.floor(totalMin / 60); const m = totalMin % 60; return m > 0 ? `${h}h ${m}m` : `${h}h`; }
    return `${totalMin}m`;
  }, [weekLogs]);

  const currentStreak = useMemo(() => {
    const dates = new Set(displayHistory.map(l => l.date));
    if (dates.size === 0) return 0;
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (dates.has(ds)) { streak++; } else { if (i === 0) continue; break; }
    }
    return streak;
  }, [displayHistory]);

  const weeklyPRCount = useMemo(() => weekLogs.reduce((sum, l) => sum + l.prsHit, 0), [weekLogs]);
  const uniquePRs = useMemo(() => getUniquePRs(tracking.prHistory), [tracking.prHistory]);

  // S1: Radar percentiles
  const radarData = useMemo(() => {
    const sex = ctx.sex === 'female' ? 'female' : 'male';
    return getRadarPercentiles(sex, ctx.weight || 160, tracking.prHistory, tracking.workoutHistory, run.runHistory);
  }, [ctx.sex, ctx.weight, tracking.prHistory, tracking.workoutHistory, run.runHistory]);

  // S2: AI Coach
  const coachTips = useMemo(() => {
    return detectInsightPatterns(
      tracking.workoutHistory,
      tracking.prHistory,
      ctx.muscleReadiness || [],
      { sex: ctx.sex, weight: ctx.weight || 160, workoutStyle: ctx.workoutStyle },
    );
  }, [tracking.workoutHistory, tracking.prHistory, ctx.muscleReadiness, ctx.sex, ctx.weight, ctx.workoutStyle]);

  // S3: Week bars
  const dayBars = useMemo(() => getWeekDayBars(tracking.workoutHistory), [tracking.workoutHistory]);

  // S4: Training load
  const trainingLoad = useMemo(() => getTrainingLoadTrend(tracking.workoutHistory, hasPro ? 8 : 2), [tracking.workoutHistory, hasPro]);

  // S5: Style insights
  const styleInsight = useMemo(() => {
    return getStyleInsights(
      ctx.workoutStyle,
      tracking.workoutHistory,
      tracking.prHistory,
      { sex: ctx.sex, weight: ctx.weight || 160 },
    );
  }, [ctx.workoutStyle, tracking.workoutHistory, tracking.prHistory, ctx.sex, ctx.weight]);

  // S7: Consistency heatmap
  const consistency = useMemo(() => getConsistencyData(tracking.workoutHistory, hasPro ? 17 : 8), [tracking.workoutHistory, hasPro]);

  // S8: Grouped PRs
  const groupedPRs = useMemo(() => getGroupedPRs(tracking.prHistory, tracking.workoutHistory), [tracking.prHistory, tracking.workoutHistory]);

  // S9: Milestones
  const milestoneProgress = useMemo(() => {
    return computeMilestoneProgress(displayHistory.length, tracking.prHistory.length, currentStreak);
  }, [displayHistory.length, tracking.prHistory.length, currentStreak]);

  // Stats for Nerds
  const lifetimeTotals = useMemo(() => getLifetimeTotals(tracking.workoutHistory), [tracking.workoutHistory]);
  const strengthRatios = useMemo(() => getStrengthRatios(
    tracking.workoutHistory, tracking.prHistory, ctx.sex === 'female' ? 'female' : 'male', ctx.weight || 160,
  ), [tracking.workoutHistory, tracking.prHistory, ctx.sex, ctx.weight]);
  const overload = useMemo(() => getProgressiveOverload(tracking.workoutHistory), [tracking.workoutHistory]);
  const patterns = useMemo(() => getPatternAnalysis(tracking.workoutHistory, tracking.prHistory), [tracking.workoutHistory, tracking.prHistory]);
  const projections = useMemo(() => getProjections(tracking.workoutHistory, tracking.prHistory, ctx.weight || 160), [tracking.workoutHistory, tracking.prHistory, ctx.weight]);
  const selfComparison = useMemo(() => getSelfComparison(tracking.workoutHistory, tracking.prHistory), [tracking.workoutHistory, tracking.prHistory]);

  // New insights
  const muscleReadiness = useMemo(() => getMuscleReadinessSummary(ctx.muscleReadiness || []), [ctx.muscleReadiness]);
  const durationTrend = useMemo(() => getDurationTrend(tracking.workoutHistory), [tracking.workoutHistory]);
  const peakWindow = useMemo(() => getPeakPerformanceWindow(tracking.workoutHistory), [tracking.workoutHistory]);
  const splitAdherence = useMemo(() => getSplitAdherence(tracking.workoutHistory), [tracking.workoutHistory]);
  const calorieTrend = useMemo(() => getCalorieTrend(tracking.workoutHistory), [tracking.workoutHistory]);

  // New stats
  const restDays = useMemo(() => getRestDayPatterns(tracking.workoutHistory), [tracking.workoutHistory]);
  const exerciseFreq = useMemo(() => getExerciseFrequency(tracking.workoutHistory), [tracking.workoutHistory]);
  const equipmentUsage = useMemo(() => getEquipmentUsage(tracking.workoutHistory), [tracking.workoutHistory]);
  const muscleBalance = useMemo(() => getMuscleBalanceScore(tracking.workoutHistory), [tracking.workoutHistory]);
  const sessionQuality = useMemo(() => getSessionQualityTrend(tracking.workoutHistory), [tracking.workoutHistory]);
  const favoriteExercises = useMemo(() => getFavoriteExercises(ctx.exercisePreferences || {}), [ctx.exercisePreferences]);
  const prTimeline = useMemo(() => getPRTimeline(tracking.prHistory), [tracking.prHistory]);
  const recordsBoard = useMemo(() => getRecordsBoard(tracking.workoutHistory), [tracking.workoutHistory]);
  const warmupCompliance = useMemo(() => getWarmupCompliance(tracking.workoutHistory), [tracking.workoutHistory]);
  const styleDistribution = useMemo(() => {
    if (tracking.workoutHistory.length === 0) return [];
    const counts: Record<string, number> = {};
    for (const log of tracking.workoutHistory) {
      const s = (log as any).workoutStyle ?? 'Other';
      counts[s] = (counts[s] ?? 0) + 1;
    }
    const total = tracking.workoutHistory.length;
    return Object.entries(counts)
      .map(([style, count]) => ({ style, count, pct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count);
  }, [tracking.workoutHistory]);

  const todDistribution = useMemo(() => {
    const withTime = tracking.workoutHistory.filter(l => l.startTime);
    if (withTime.length === 0) return { buckets: [] as { label: string; icon: string; count: number }[], total: 0 };
    let morning = 0, afternoon = 0, evening = 0, night = 0;
    for (const log of withTime) {
      const h = new Date(log.startTime!).getHours();
      if (h >= 5 && h < 12) morning++;
      else if (h >= 12 && h < 17) afternoon++;
      else if (h >= 17 && h < 21) evening++;
      else night++;
    }
    return {
      total: withTime.length,
      buckets: [
        { label: 'Morning', icon: 'sunrise', count: morning },
        { label: 'Afternoon', icon: 'sun', count: afternoon },
        { label: 'Evening', icon: 'sunset', count: evening },
        { label: 'Night', icon: 'moon', count: night },
      ],
    };
  }, [tracking.workoutHistory]);

  // Badges
  const badges = useMemo(() => computeBadges(tracking.workoutHistory, tracking.prHistory, ctx.weight || 160), [tracking.workoutHistory, tracking.prHistory, ctx.weight]);

  const handleAxisTap = useCallback((cat: RadarCategory) => {
    setTipAxis(prev => (prev === cat ? null : cat));
  }, []);

  const formatDate = useCallback((dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch { return dateStr; }
  }, []);

  const sectionBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const mutedLabel = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.40)';

  // ─── Info toast helpers ─────────────────────────────────
  const CARD_INFO: Record<string, string> = {
    'FITNESS PROFILE': 'Your estimated fitness percentile across 6 categories — strength, conditioning, and cardio — vs. others of the same sex & bodyweight. Tap a spoke for details.',
    'MUSCLE READINESS': 'How recovered each muscle group is based on recent training volume and difficulty. Green = ready, yellow = building, red = recovering.',
    'THIS WEEK': 'A snapshot of your training this 7-day window — workouts, total time, streak, and new PRs.',
    'TRAINING LOAD': 'Your weekly training volume trend. Rising bars = increasing load. Spikes may mean overreaching; flat lines may signal time for a deload.',
    'INSIGHTS': 'Style-specific metrics tailored to your training approach. Updates as you log workouts.',
    'APPLE HEALTH — TODAY': 'Live data pulled from Apple Health — steps, estimated calories burned, and resting heart rate for today.',
    'HEALTH CONNECT — TODAY': 'Live data pulled from Health Connect — steps, estimated calories burned, and resting heart rate for today.',
    'AVG SESSION DURATION': 'Average workout length across recent sessions. Trending up means you\'re investing more time per session.',
    'PEAK PERFORMANCE': 'The time of day when your workouts tend to be longest or highest quality, based on your history.',
    'WORKOUT TIME OF DAY': 'How your sessions are distributed across morning, afternoon, evening, and night — based on when you actually started each workout.',
    'TRAINING SPLIT (THIS MONTH)': 'Which muscle groups you\'ve hit most this month. Useful for spotting imbalances in your weekly split.',
    'WEEKLY CALORIES BURNED': 'Estimated calories burned per week from logged workouts, trended over recent weeks.',
    'CONSISTENCY': 'A heatmap of your workout frequency over the past 12 weeks. Darker squares = more active weeks.',
    'PERSONAL RECORDS': 'Your all-time bests on individual exercises, tracked automatically across every session.',
    'MILESTONES': 'Long-term goals tied to total workouts, PRs, and streak length. Progress reflects your full Zeal+ history.',
    'BADGES': 'Special achievements unlocked by hitting specific training milestones or maintaining consistent habits.',
    'LIFETIME TOTALS': 'Cumulative stats across every workout you\'ve ever logged — total time, sets, reps, and estimated calories.',
    'ALL-TIME RECORDS': 'Your personal bests: heaviest lift, longest session, and highest volume day ever recorded.',
    'MOST POPULAR': 'The exercises you\'ve done most often and the training styles you rely on most.',
    'PR TIMELINE': 'A chronological view of when each personal record was set, so you can see your progress arc.',
    'EQUIPMENT USAGE': 'Which equipment types appear most frequently across your logged workouts.',
    'WARM-UP COMPLIANCE': 'How consistently you complete a warm-up before your main workout.',
    'STRENGTH RATIOS': 'How your major lifts compare to each other — useful for spotting muscle imbalances or weak links.',
    'PROGRESSIVE OVERLOAD': 'Week-over-week changes in weight, volume, or reps on key exercises to track adaptation.',
    'TRAINING PATTERNS': 'Your training habits over time — preferred days, session timing, and rest frequency.',
    'PROJECTIONS': 'Estimated future performance based on your current rate of improvement.',
    'COMPARE TO YOURSELF': 'How your last 4 weeks stack up against the 4 weeks before — your own personal benchmark.',
    'REST PATTERNS (4 WK)': 'How much rest you typically take between sessions and how that relates to performance.',
    'MUSCLE BALANCE SCORE': 'A 0–100 score reflecting how evenly you train all major muscle groups. Higher = more balanced.',
    'SESSION QUALITY': 'A trend of your self-rated workout quality over time, based on your post-workout feedback.',
    'EXERCISE PREFERENCES': 'A summary of exercises you\'ve liked or disliked, directly influencing future workout suggestions.',
  };

  const InfoHeader = ({ title, desc, noMargin }: { title: string; desc: string; noMargin?: boolean }) => (
    <TouchableOpacity
      style={[styles.infoHeaderRow, noMargin && { marginBottom: 0 }]}
      onPress={() => showInfo(title, desc)}
      activeOpacity={0.65}
      hitSlop={{ top: 8, bottom: 8, left: 0, right: 16 }}
    >
      <Text style={[styles.sectionLabel, { color: mutedLabel, marginBottom: 0 }]}>{title}</Text>
    </TouchableOpacity>
  );

  // ─── Render ─────────────────────────────────────────────
  const insightsTabs: { key: InsightsTab; label: string; icon: React.ReactNode }[] = [
    { key: 'insights', label: 'Insights', icon: <PlatformIcon name="sparkles" size={13} /> },
    { key: 'achievements', label: 'Awards', icon: <PlatformIcon name="trophy" size={13} /> },
    { key: 'stats', label: 'Stats', icon: <PlatformIcon name="bar-chart-3" size={13} /> },
    { key: 'running', label: 'Running', icon: <PlatformIcon name="figure-run" size={13} /> },
  ];

  const headerContent = (
    <View>
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerLabel, { color: mutedLabel }]}>YOUR PROGRESS</Text>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {activeInsightsTab === 'insights' ? 'Insights'
              : activeInsightsTab === 'achievements' ? 'Achievements'
              : activeInsightsTab === 'stats' ? 'Stats for Nerds'
              : 'Running'}
          </Text>
        </View>
        <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.closeBtn}>
          <PlatformIcon name="x" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ── Tab Bar ── */}
      <View style={styles.insightsTabBar}>
        {tabItemWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[styles.insightsTabPill, {
              width: tabItemWidth,
              transform: [{
                translateX: pillAnim.interpolate({
                  inputRange: [0, 1, 2, 3],
                  outputRange: tabXOffsets,
                }),
              }],
            }]}
          />
        )}
        {insightsTabs.map((tab, i) => {
          const isActive = activeInsightsTab === tab.key;
          return (
            <View
              key={tab.key}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
              onLayout={(e) => {
                const { x, width } = e.nativeEvent.layout;
                setTabXOffsets(prev => {
                  const next = [...prev] as [number, number, number, number];
                  next[i] = x;
                  return next;
                });
                if (i === 0) setTabItemWidth(width);
              }}
            >
              <TouchableOpacity
                style={styles.insightsTabBtn}
                onPress={() => switchTab(tab.key)}
                activeOpacity={0.7}
              >
                {React.cloneElement(tab.icon as React.ReactElement<any>, {
                  color: isActive ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.3)',
                })}
                <Text style={[styles.insightsTabLabel, {
                  color: isActive ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.3)',
                  fontFamily: isActive ? 'Outfit_600SemiBold' : 'Outfit_500Medium',
                }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </View>
  );

  return (<>
    <BaseDrawer visible={visible} onClose={onClose} header={headerContent} snapPoints={['88%']}>
      <View style={styles.scrollContent}>
        {/* ═══════════════════════════════════════════════ */}
        {/* ═══ TAB: INSIGHTS ═══                        */}
        {/* ═══════════════════════════════════════════════ */}
        {activeInsightsTab === 'insights' && <>

        {/* Pro history banner */}
        {!hasPro && (
          <TouchableOpacity
            style={[styles.historyBanner, { backgroundColor: `${PRO_GOLD}10`, borderColor: `${PRO_GOLD}25` }]}
            onPress={() => showProGate('history', openPaywall)}
            activeOpacity={0.8}
          >
            <PlatformIcon name="crown" size={14} color={PRO_GOLD} strokeWidth={1.8} />
            <Text style={styles.historyBannerText}>Showing last 7 days — upgrade for full history</Text>
            <Text style={styles.historyBannerArrow}>→</Text>
          </TouchableOpacity>
        )}

        {/* ═══ S1: Strength Percentile Radar ═══ */}
        <GlassCard>
          <View style={styles.sectionInner}>
            <InfoHeader title="FITNESS PROFILE" desc={CARD_INFO['FITNESS PROFILE'] ?? ''} />

            <View style={styles.radarWrapper}>
              <View style={[styles.radarContainer, !hasPro && { opacity: PRO_LOCKED_OPACITY }]}>
                <RadarChart data={radarData} colors={colors} accent={accent} />

                {radarData.map((d, i) => {
                  const angle = i * 60;
                  const labelRadius = RADAR_RADIUS + 30;
                  const pos = polarToCartesian(angle, labelRadius);
                  return (
                    <TouchableOpacity
                      key={d.category}
                      style={[styles.axisLabel, { left: pos.x - 44, top: pos.y - 18 }]}
                      onPress={() => hasPro ? handleAxisTap(d.category) : showProGate('insights', openPaywall)}
                      activeOpacity={0.6}
                    >
                      <Text style={[styles.axisLabelText, { color: colors.text }]} numberOfLines={2}>
                        {d.label}
                      </Text>
                      {d.percentile !== null ? (
                        <View style={styles.axisBadgeRow}>
                          <Text style={[styles.axisValueText, { color: accent }]}>{d.percentile}%</Text>
                          <View style={[styles.tierBadge, { backgroundColor: `${TIER_COLORS[d.tier!]}20` }]}>
                            <Text style={[styles.tierBadgeText, { color: TIER_COLORS[d.tier!] }]}>{d.tier}</Text>
                          </View>
                        </View>
                      ) : (
                        <Text style={[styles.axisValueText, { color: colors.textMuted }]}>?</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {!hasPro && (
                <TouchableOpacity style={styles.radarOverlay} onPress={() => showProGate('insights', openPaywall)} activeOpacity={0.9}>
                  <View style={styles.radarLockBadge}>
                    <PlatformIcon name="crown" size={20} color={PRO_GOLD} strokeWidth={1.5} />
                    <Text style={styles.radarLockSub}>Strength Profile</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>

            {hasPro && <Text style={[styles.tipHint, { color: colors.textMuted }]}>Tap a category for details</Text>}

            {hasPro && tipAxis && (() => {
              const axisData = radarData.find(d => d.category === tipAxis);
              if (!axisData) return null;
              const next = axisData.drivingExercise
                ? getNextTierTarget(ctx.sex === 'female' ? 'female' : 'male', axisData.drivingExercise, ctx.weight || 160, axisData.percentile ?? 0)
                : null;

              // Per-axis no-data messages (each axis has its own prompt)
              const noDataMessage: Partial<Record<typeof tipAxis, string>> = {
                cardio: 'Log runs to see your cardio ranking here.',
                conditioning: 'Do HIIT, CrossFit, or Hyrox sessions to build your conditioning score.',
                core: 'Log core exercises (planks, crunches, leg raises) to build your core score.',
                upper_push: 'Bench press or overhead press gives the most accurate ranking — accessory volume still counts.',
                upper_pull: 'Rows or pull-ups give the most accurate ranking — all back/bicep work still counts.',
                lower_body: 'Log squats or deadlifts for a precise ranking — all leg work already contributes.',
              };

              return (
                <Animated.View style={[styles.tipCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', opacity: tipAnim }]}>
                  <Text style={[styles.tipTitle, { color: accent }]}>{RADAR_CATEGORY_LABELS[tipAxis]}</Text>
                  {axisData.drivingExercise && (
                    <Text style={[styles.tipText, { color: colors.textSecondary }]}>
                      Based on: {axisData.drivingExercise} (est. 1RM: {axisData.drivingE1RM} lb)
                    </Text>
                  )}
                  {next && (
                    <Text style={[styles.tipText, { color: colors.textSecondary, marginTop: 4 }]}>
                      Hit {next.target1RM} lb to reach {next.tier}
                    </Text>
                  )}
                  {axisData.percentile === null && tipAxis && noDataMessage[tipAxis] && (
                    <Text style={[styles.tipText, { color: colors.textSecondary }]}>
                      {noDataMessage[tipAxis]}
                    </Text>
                  )}
                  {axisData.percentile !== null && !axisData.drivingExercise && (
                    tipAxis === 'cardio' ? (
                      <Text style={[styles.tipText, { color: colors.textSecondary }]}>
                        Score from recent runs — volume, frequency, and pace combined.
                      </Text>
                    ) : tipAxis === 'conditioning' ? (
                      <Text style={[styles.tipText, { color: colors.textSecondary }]}>
                        Score from conditioning-style sessions and metcon exercises.
                      </Text>
                    ) : tipAxis === 'core' ? (
                      <Text style={[styles.tipText, { color: colors.textSecondary }]}>
                        Score from core exercise volume over the last 4 weeks.
                      </Text>
                    ) : (
                      <Text style={[styles.tipText, { color: colors.textSecondary }]}>
                        Volume-based estimate — log compound lifts for a more precise ranking.
                      </Text>
                    )
                  )}
                </Animated.View>
              );
            })()}
          </View>
        </GlassCard>

        {/* ═══ S2: Muscle Readiness Card ═══ */}
        {(() => {
          const muscles = ctx.muscleReadiness;
          if (!muscles || muscles.length === 0) return null;

          // Interpolate red→yellow→green
          const rc = (value: number): string => {
            const t = Math.max(0, Math.min(100, value)) / 100;
            let r: number, g: number, b: number;
            if (t <= 0.5) {
              const s = t / 0.5;
              r = Math.round(239 + (234 - 239) * s);
              g = Math.round(68  + (179 - 68)  * s);
              b = Math.round(68  + (8   - 68)  * s);
            } else {
              const s = (t - 0.5) / 0.5;
              r = Math.round(234 + (34  - 234) * s);
              g = Math.round(179 + (197 - 179) * s);
              b = Math.round(8   + (94  - 8)   * s);
            }
            return `rgb(${r},${g},${b})`;
          };

          // 4 summary groups
          const avg = (names: string[]) => {
            const vals = names.map(n => muscles.find(m => m.name === n)?.value ?? 100);
            return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
          };
          const groups = [
            { label: 'Chest', names: ['Chest'] },
            { label: 'Back',  names: ['Back'] },
            { label: 'Legs',  names: ['Quads', 'Hamstrings', 'Glutes', 'Calves'] },
            { label: 'Core',  names: ['Core'] },
          ];

          const overallScore = Math.round(muscles.reduce((s, m) => s + m.value, 0) / muscles.length);
          const overallColor = rc(overallScore);

          return (
            <>
              <TouchableOpacity activeOpacity={0.75} onPress={() => setReadinessDrawerVisible(true)}>
                <GlassCard>
                  <View style={styles.sectionInner}>
                    {/* Header */}
                    <View style={styles.readinessHeaderRow}>
                      <InfoHeader title="MUSCLE READINESS" desc={CARD_INFO['MUSCLE READINESS'] ?? ''} noMargin />
                      <Text style={[styles.readinessOverallPct, { color: overallColor }]}>{overallScore}%</Text>
                    </View>

                    {/* Overall bar */}
                    <View style={styles.readinessOverallTrack}>
                      <View style={[styles.readinessOverallFill, { width: `${overallScore}%` as any, backgroundColor: overallColor }]} />
                    </View>

                    {/* 4 group bars */}
                    <View style={styles.readinessMuscleRow}>
                      {groups.map(g => {
                        const val = avg(g.names);
                        const color = rc(val);
                        return (
                          <View key={g.label} style={styles.readinessMuscleCell}>
                            <Text style={[styles.readinessMuscleName, { color: colors.textMuted }]} numberOfLines={1}>{g.label}</Text>
                            <View style={styles.readinessMicroTrack}>
                              <View style={[styles.readinessMicroFill, { width: `${val}%` as any, backgroundColor: color }]} />
                            </View>
                            <Text style={[styles.readinessMuscleVal, { color }]}>{val}%</Text>
                          </View>
                        );
                      })}
                    </View>

                    {/* Tap hint */}
                    <Text style={[styles.readinessTapHint, { color: colors.textMuted }]}>Tap to view all muscles</Text>
                  </View>
                </GlassCard>
              </TouchableOpacity>

              <MuscleReadinessDrawer
                visible={readinessDrawerVisible}
                onClose={() => setReadinessDrawerVisible(false)}
              />
            </>
          );
        })()}

        {/* ═══ S3: This Week Stats ═══ */}
        <GlassCard>
          <View style={styles.sectionInner}>
            <InfoHeader title="THIS WEEK" desc={CARD_INFO['THIS WEEK'] ?? ''} />

            {/* 2x2 metric grid */}
            <View style={styles.metricGrid}>
              {[
                { label: 'WORKOUTS', value: `${weekLogs.length}` },
                { label: 'TIME', value: weeklyTime },
                { label: 'STREAK', value: `${currentStreak}d` },
                { label: 'PRs', value: weeklyPRCount > 0 ? `+${weeklyPRCount}` : '-' },
              ].map((m) => (
                <View key={m.label} style={styles.metricCell}>
                  <Text style={[styles.metricValue, { color: colors.text }]}>{m.value}</Text>
                  <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{m.label}</Text>
                </View>
              ))}
            </View>

            {/* 7-day bar chart */}
            {dayBars.some(b => b.duration > 0) && (
              <View style={styles.barChart}>
                {dayBars.map((bar) => {
                  const maxDur = Math.max(...dayBars.map(b => b.duration), 1);
                  const height = bar.duration > 0 ? Math.max((bar.duration / maxDur) * 32, 4) : 2;
                  return (
                    <View key={bar.date} style={styles.barCol}>
                      <View style={[
                        styles.bar,
                        {
                          height,
                          backgroundColor: bar.duration > 0 ? accent : colors.border,
                          opacity: bar.isToday ? 1 : 0.6,
                        },
                        bar.isToday && { shadowColor: accent, shadowOpacity: 0.4, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
                      ]} />
                      <Text style={[styles.barLabel, { color: bar.isToday ? accent : colors.textMuted }]}>{bar.dayLabel}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </GlassCard>

        {/* ═══ S4: Training Load Trend ═══ */}
        <GlassCard>
          <View style={styles.sectionInner}>
            <View style={styles.sectionHeaderRow}>
              <InfoHeader title="TRAINING LOAD" desc={CARD_INFO['TRAINING LOAD'] ?? ''} noMargin />
              {!hasPro && (
                <TouchableOpacity onPress={() => showProGate('training_load', openPaywall)} activeOpacity={0.7}>
                  <PlatformIcon name="crown" size={12} color={PRO_GOLD} />
                </TouchableOpacity>
              )}
            </View>

            <View style={[!hasPro && { opacity: PRO_LOCKED_OPACITY }]}>
              {trainingLoad.weeks.some(w => w.totalVolume > 0) ? (
                <>
                  <View style={styles.loadChart}>
                    {trainingLoad.weeks.map((w, i) => {
                      const maxVol = Math.max(...trainingLoad.weeks.map(wk => wk.totalVolume), 1);
                      const height = w.totalVolume > 0 ? Math.max((w.totalVolume / maxVol) * 48, 4) : 2;
                      const isLast = i === trainingLoad.weeks.length - 1;
                      return (
                        <View key={w.weekStart} style={styles.loadBarCol}>
                          <View style={[styles.loadBar, { height, backgroundColor: isLast ? accent : `${accent}55` }]} />
                          <Text style={[styles.loadBarLabel, { color: isLast ? accent : colors.textMuted }]} numberOfLines={1}>
                            {w.weekLabel}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                  <View style={[styles.loadStatus, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
                    <PlatformIcon name="bar-chart-3" size={14} color={accent} />
                    <Text style={[styles.loadStatusText, { color: colors.text }]}>{trainingLoad.statusLabel}</Text>
                  </View>
                </>
              ) : (
                /* ── Example preview state ── */
                <View>
                  <View style={styles.exampleBadgeRow}>
                    <View style={[styles.exampleBadge, { backgroundColor: `${accent}22`, borderColor: `${accent}44` }]}>
                      <Text style={[styles.exampleBadgeText, { color: accent }]}>EXAMPLE</Text>
                    </View>
                  </View>
                  <View style={{ opacity: 0.35 }}>
                    <View style={styles.loadChart}>
                      {[28, 45, 38, 60, 52, 70, 65, 80].map((vol, i) => {
                        const maxVol = 80;
                        const height = Math.max((vol / maxVol) * 48, 4);
                        const isLast = i === 7;
                        return (
                          <View key={i} style={styles.loadBarCol}>
                            <View style={[styles.loadBar, { height, backgroundColor: isLast ? accent : `${accent}55` }]} />
                            <Text style={[styles.loadBarLabel, { color: isLast ? accent : colors.textMuted }]} numberOfLines={1}>
                              {['Sep 2', 'Sep 9', 'Sep 16', 'Sep 23', 'Sep 30', 'Oct 7', 'Oct 14', 'This wk'][i]}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                    <View style={[styles.loadStatus, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
                      <PlatformIcon name="bar-chart-3" size={14} color={accent} />
                      <Text style={[styles.loadStatusText, { color: colors.text }]}>Building</Text>
                    </View>
                  </View>
                  <View style={styles.exampleUnlockRow}>
                    <PlatformIcon name="bar-chart-3" size={14} color={colors.textMuted} strokeWidth={1.5} />
                    <Text style={[styles.exampleUnlockText, { color: colors.textMuted }]}>Complete workouts to track training load</Text>
                  </View>
                </View>
              )}
            </View>

            {!hasPro && (
              <TouchableOpacity style={styles.proOverlaySmall} onPress={() => showProGate('training_load', openPaywall)} activeOpacity={0.9}>
                <PlatformIcon name="crown" size={14} color={PRO_GOLD} />
                <Text style={styles.proOverlayText}>Full trends with Pro</Text>
              </TouchableOpacity>
            )}
          </View>
        </GlassCard>

        {/* ═══ S5: Style-Specific Insights ═══ */}
        <GlassCard>
          <View style={styles.sectionInner}>
            <InfoHeader title={`${ctx.workoutStyle.toUpperCase()} INSIGHTS`} desc={CARD_INFO['INSIGHTS'] ?? ''} />

            {(() => {
              const hasData =
                (styleInsight.type === 'strength' && styleInsight.topLifts.length > 0) ||
                (styleInsight.type === 'bodybuilding' && styleInsight.muscleVolume.some(m => m.sets > 0)) ||
                (styleInsight.type === 'conditioning' && styleInsight.sessionsThisWeek > 0) ||
                (styleInsight.type === 'recovery' && styleInsight.sessionsThisWeek > 0);
              return !hasData ? (
              /* ── Example preview state ── */
              <View>
                {/* EXAMPLE badge */}
                <View style={styles.exampleBadgeRow}>
                  <View style={[styles.exampleBadge, { backgroundColor: `${accent}22`, borderColor: `${accent}44` }]}>
                    <Text style={[styles.exampleBadgeText, { color: accent }]}>EXAMPLE</Text>
                  </View>
                </View>

                {/* Dimmed mock data */}
                <View style={{ opacity: 0.35 }}>
                  {(['Bench Press', 'Squat', 'Deadlift'] as const).map((name, i) => (
                    <View key={name} style={[styles.liftRow, { borderBottomColor: colors.border }]}>
                      <View style={styles.liftInfo}>
                        <Text style={[styles.liftName, { color: colors.text }]}>{name}</Text>
                        <Text style={[styles.liftSub, { color: colors.textSecondary }]}>est. 1RM</Text>
                      </View>
                      <View style={styles.liftRight}>
                        <Text style={[styles.liftE1rm, { color: accent }]}>{[185, 225, 275][i]} lb</Text>
                        <PlatformIcon name="trending-up" size={14} color="#22c55e" />
                      </View>
                    </View>
                  ))}
                </View>

                {/* Unlock prompt */}
                <View style={styles.exampleUnlockRow}>
                  <PlatformIcon name="bar-chart-3" size={14} color={colors.textMuted} strokeWidth={1.5} />
                  <Text style={[styles.exampleUnlockText, { color: colors.textMuted }]}>Complete a workout to see your real insights</Text>
                </View>
              </View>
            ) : (
              <>
                {styleInsight.type === 'bodybuilding' && (
                  <View style={styles.styleInsightContent}>
                    {styleInsight.muscleVolume.filter(m => m.sets > 0 || m.recommended[0] > 0).slice(0, 8).map((m) => (
                      <View key={m.muscle} style={styles.volumeRow}>
                        <Text style={[styles.volumeLabel, { color: colors.text }]}>{m.muscle}</Text>
                        <View style={styles.volumeBarArea}>
                          <View style={[styles.volumeBarTrack, { backgroundColor: colors.border }]}>
                            <View style={[
                              styles.volumeBarFill,
                              {
                                width: `${Math.min((m.sets / m.recommended[1]) * 100, 100)}%` as any,
                                backgroundColor: m.sets < m.recommended[0] ? '#ef4444' : accent,
                              },
                            ]} />
                          </View>
                          <Text style={[styles.volumeSets, { color: colors.textSecondary }]}>
                            {m.sets}/{m.recommended[0]}-{m.recommended[1]}
                          </Text>
                        </View>
                      </View>
                    ))}
                    {styleInsight.underworked.length > 0 && (
                      <Text style={[styles.underworkedText, { color: '#ef4444' }]}>
                        Underworked: {styleInsight.underworked.join(', ')}
                      </Text>
                    )}
                  </View>
                )}

                {styleInsight.type === 'strength' && (
                  <View style={styles.styleInsightContent}>
                    {styleInsight.topLifts.map((lift) => (
                      <View key={lift.name} style={[styles.liftRow, { borderBottomColor: colors.border }]}>
                        <View style={styles.liftInfo}>
                          <Text style={[styles.liftName, { color: colors.text }]}>{lift.name}</Text>
                          <Text style={[styles.liftSub, { color: colors.textSecondary }]}>est. 1RM</Text>
                        </View>
                        <View style={styles.liftRight}>
                          <Text style={[styles.liftE1rm, { color: accent }]}>{lift.e1rm} lb</Text>
                          {lift.trend === 'up' && <PlatformIcon name="trending-up" size={14} color="#22c55e" />}
                          {lift.trend === 'down' && <PlatformIcon name="trending-down" size={14} color="#ef4444" />}
                          {lift.trend === 'flat' && <PlatformIcon name="minus" size={14} color={colors.textMuted} />}
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {styleInsight.type === 'conditioning' && (
                  <View style={styles.styleInsightContent}>
                    <View style={styles.conditioningRow}>
                      <View style={styles.conditioningMetric}>
                        <Text style={[styles.conditioningValue, { color: colors.text }]}>{styleInsight.sessionsThisWeek}</Text>
                        <Text style={[styles.conditioningLabel, { color: colors.textMuted }]}>Sessions</Text>
                      </View>
                      <View style={styles.conditioningMetric}>
                        <Text style={[styles.conditioningValue, { color: colors.text }]}>{styleInsight.avgRPE ?? '-'}</Text>
                        <Text style={[styles.conditioningLabel, { color: colors.textMuted }]}>Avg RPE</Text>
                      </View>
                      <View style={styles.conditioningMetric}>
                        <Text style={[styles.conditioningValue, { color: colors.text }]}>{styleInsight.avgDuration}m</Text>
                        <Text style={[styles.conditioningLabel, { color: colors.textMuted }]}>Avg Time</Text>
                      </View>
                    </View>
                  </View>
                )}

                {styleInsight.type === 'recovery' && (
                  <View style={styles.styleInsightContent}>
                    <View style={styles.conditioningRow}>
                      <View style={styles.conditioningMetric}>
                        <Text style={[styles.conditioningValue, { color: colors.text }]}>{styleInsight.sessionsThisWeek}</Text>
                        <Text style={[styles.conditioningLabel, { color: colors.textMuted }]}>Sessions</Text>
                      </View>
                      <View style={styles.conditioningMetric}>
                        <Text style={[styles.conditioningValue, { color: colors.text }]}>{styleInsight.coveragePercent}%</Text>
                        <Text style={[styles.conditioningLabel, { color: colors.textMuted }]}>Coverage</Text>
                      </View>
                    </View>
                    {styleInsight.areasTargeted.length > 0 && (
                      <Text style={[styles.areasText, { color: colors.textSecondary }]}>
                        Areas: {styleInsight.areasTargeted.join(', ')}
                      </Text>
                    )}
                  </View>
                )}
              </>
            )
            })()}
          </View>
        </GlassCard>

        {/* ═══ S6: Health Integration ═══ */}
        {ctx.healthConnected && ctx.healthSyncEnabled && Platform.OS !== 'web' && (
          <GlassCard>
            <View style={styles.sectionInner}>
              <View style={styles.healthHeader}>
                <PlatformIcon name="heart-pulse" size={12} color="#ef4444" strokeWidth={2} />
                <InfoHeader title={Platform.OS === 'ios' ? 'APPLE HEALTH — TODAY' : 'HEALTH CONNECT — TODAY'} desc={Platform.OS === 'ios' ? (CARD_INFO['APPLE HEALTH — TODAY'] ?? '') : (CARD_INFO['HEALTH CONNECT — TODAY'] ?? '')} noMargin />
              </View>
              <View style={styles.healthCards}>
                <View style={[styles.healthCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
                  <PlatformIcon name="footprints" size={18} color="#3b82f6" strokeWidth={1.8} />
                  <Text style={[styles.healthValue, { color: colors.text }]}>{healthLoading ? '—' : healthSteps.toLocaleString()}</Text>
                  <Text style={[styles.healthLabel, { color: colors.textSecondary }]}>Steps</Text>
                </View>
                <View style={[styles.healthCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
                  <PlatformIcon name="activity" size={18} color="#f87116" strokeWidth={1.8} />
                  <Text style={[styles.healthValue, { color: colors.text }]}>{healthLoading ? '—' : `${healthCalories}`}</Text>
                  <Text style={[styles.healthLabel, { color: colors.textSecondary }]}>Cal Burned</Text>
                </View>
                <View style={[styles.healthCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
                  <PlatformIcon name="heart-pulse" size={18} color="#ef4444" strokeWidth={1.8} />
                  <Text style={[styles.healthValue, { color: colors.text }]}>{healthLoading ? '—' : healthHeartRate !== null ? `${healthHeartRate}` : '—'}</Text>
                  <Text style={[styles.healthLabel, { color: colors.textSecondary }]}>Resting BPM</Text>
                </View>
              </View>
            </View>
          </GlassCard>
        )}


        {/* ═══ Average Duration Trend ═══ */}
        {durationTrend.dataPoints.length >= 3 && (
          <GlassCard>
            <View style={styles.sectionInner}>
              <View style={styles.sectionHeaderRow}>
                <InfoHeader title="AVG SESSION DURATION" desc={CARD_INFO['AVG SESSION DURATION'] ?? ''} noMargin />
                <Text style={[styles.trendIndicator, { color: durationTrend.trend === 'up' ? '#22c55e' : durationTrend.trend === 'down' ? '#ef4444' : colors.textMuted }]}>
                  {durationTrend.avgRecent}m {durationTrend.trend === 'up' ? '↑' : durationTrend.trend === 'down' ? '↓' : '→'}
                </Text>
              </View>
              <Svg width={280} height={36} viewBox="0 0 280 36">
                {(() => {
                  const data = durationTrend.dataPoints;
                  const max = Math.max(...data, 1);
                  const min = Math.min(...data, 0);
                  const range = max - min || 1;
                  const pts = data.map((v, i) => `${4 + (i / (data.length - 1)) * 272},${4 + 28 - ((v - min) / range) * 28}`).join(' ');
                  return <Polyline points={pts} fill="none" stroke={accent} strokeWidth={2} strokeLinecap="round" />;
                })()}
              </Svg>
            </View>
          </GlassCard>
        )}

        {/* ═══ Peak Performance Window ═══ */}
        {peakWindow.bestWindow && (
          <GlassCard>
            <View style={styles.sectionInner}>
              <InfoHeader title="PEAK PERFORMANCE" desc={CARD_INFO['PEAK PERFORMANCE'] ?? ''} />
              <Text style={[styles.peakWindowText, { color: colors.text }]}>
                Your best sessions happen <Text style={{ color: accent, fontWeight: '800' }}>{peakWindow.bestWindow}</Text>
              </Text>
            </View>
          </GlassCard>
        )}

        {/* ═══ Training Split Adherence ═══ */}
        {splitAdherence.splits.some(s => s.sets > 0) && (
          <GlassCard>
            <View style={styles.sectionInner}>
              <InfoHeader title="TRAINING SPLIT (THIS MONTH)" desc={CARD_INFO['TRAINING SPLIT (THIS MONTH)'] ?? ''} />
              <View style={styles.splitBar}>
                {splitAdherence.splits.filter(s => s.pct > 0).map((s) => (
                  <View key={s.name} style={[styles.splitSegment, {
                    flex: s.pct,
                    backgroundColor: s.name === 'Push' ? '#f87116' : s.name === 'Pull' ? '#3b82f6' : s.name === 'Legs' ? '#22c55e' : '#a855f7',
                  }]} />
                ))}
              </View>
              <View style={styles.splitLegend}>
                {splitAdherence.splits.map((s) => (
                  <View key={s.name} style={styles.splitLegendItem}>
                    <View style={[styles.splitLegendDot, {
                      backgroundColor: s.name === 'Push' ? '#f87116' : s.name === 'Pull' ? '#3b82f6' : s.name === 'Legs' ? '#22c55e' : '#a855f7',
                    }]} />
                    <Text style={[styles.splitLegendText, { color: colors.textSecondary }]}>{s.name} {s.pct}%</Text>
                  </View>
                ))}
              </View>
            </View>
          </GlassCard>
        )}

        {/* ═══ Calorie Burn Trend ═══ */}
        {ctx.healthConnected && ctx.healthSyncEnabled && calorieTrend.weeklyTotals.some(w => w.calories > 0) && (
          <GlassCard>
            <View style={styles.sectionInner}>
              <InfoHeader title="WEEKLY CALORIES BURNED" desc={CARD_INFO['WEEKLY CALORIES BURNED'] ?? ''} />
              <Svg width={280} height={36} viewBox="0 0 280 36">
                {(() => {
                  const data = calorieTrend.weeklyTotals.map(w => w.calories);
                  const max = Math.max(...data, 1);
                  const pts = data.map((v, i) => `${4 + (i / (data.length - 1)) * 272},${4 + 28 - (v / max) * 28}`).join(' ');
                  return <Polyline points={pts} fill="none" stroke="#f87116" strokeWidth={2} strokeLinecap="round" />;
                })()}
              </Svg>
            </View>
          </GlassCard>
        )}

        </>}

        {/* ═══════════════════════════════════════════════ */}
        {/* ═══ TAB: ACHIEVEMENTS ═══                      */}
        {/* ═══════════════════════════════════════════════ */}
        {activeInsightsTab === 'achievements' && <>

        {/* ═══ S7: Consistency Heatmap ═══ */}
        <GlassCard>
          <View style={styles.sectionInner}>
            <InfoHeader title="CONSISTENCY" desc={CARD_INFO['CONSISTENCY'] ?? ''} />

            <View style={styles.heatmapGrid}>
              {Array.from({ length: 7 }, (_, dayOfWeek) => (
                <View key={dayOfWeek} style={styles.heatmapRow}>
                  <Text style={[styles.heatmapDayLabel, { color: colors.textMuted }]}>
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'][dayOfWeek]}
                  </Text>
                  <View style={styles.heatmapCells}>
                    {consistency.cells
                      .filter(c => c.dayOfWeek === dayOfWeek)
                      .map((cell) => (
                        <View
                          key={cell.date}
                          style={[
                            styles.heatmapCell,
                            cell.workoutCount === 0
                              ? { borderWidth: 1, borderColor: colors.border, backgroundColor: 'transparent' }
                              : cell.workoutCount >= 2
                                ? { backgroundColor: accent, opacity: 0.8 }
                                : { backgroundColor: accent, opacity: 0.4 },
                          ]}
                        />
                      ))
                    }
                  </View>
                </View>
              ))}
            </View>

            <Text style={[styles.heatmapSummary, { color: colors.textSecondary }]}>
              {consistency.activeDays} of {consistency.totalDays} days active
            </Text>
          </View>
        </GlassCard>

        {/* ═══ Badges + Milestones ═══ */}
        {(badges.length > 0 || milestoneProgress.length > 0) && (
          <GlassCard>
            <View style={styles.sectionInner}>
              <InfoHeader title="BADGES" desc={CARD_INFO['BADGES'] ?? ''} />

              {/* ── Milestones section ── */}
              {milestoneProgress.length > 0 && (
                <>
                  <Text style={[styles.badgeCatLabel, { color: colors.textMuted }]}>Milestones</Text>
                  <View style={styles.milestoneGrid}>
                    {milestoneProgress.map((m) => {
                      const progress = m.target > 0 ? m.current / m.target : 0;
                      const circumference = 2 * Math.PI * 22;
                      const strokeDashoffset = circumference * (1 - Math.min(progress, 1));
                      const ringColor = m.completed ? '#eab308' : `${accent}88`;
                      return (
                        <TouchableOpacity
                          key={m.id}
                          style={styles.milestoneBadge}
                          onPress={() => setDetailItem({ id: m.id, iconName: m.icon, label: m.name, description: m.description, unlocked: m.completed, current: m.current, target: m.target })}
                          activeOpacity={0.7}
                        >
                          <View style={styles.milestoneRingContainer}>
                            <Svg width={56} height={56} viewBox="0 0 56 56">
                              <SvgCircle cx={28} cy={28} r={22} fill="none" stroke={colors.border} strokeWidth={3} />
                              <SvgCircle
                                cx={28} cy={28} r={22}
                                fill="none"
                                stroke={ringColor}
                                strokeWidth={3}
                                strokeDasharray={`${circumference}`}
                                strokeDashoffset={strokeDashoffset}
                                strokeLinecap="round"
                                transform="rotate(-90 28 28)"
                              />
                            </Svg>
                            <View style={styles.milestoneIconCenter}>
                              {m.completed ? (
                                <PlatformIcon name="check" size={16} color="#eab308" />
                              ) : (
                                getMilestoneIcon(m.icon, colors.textMuted, 16)
                              )}
                            </View>
                          </View>
                          <Text style={[styles.milestoneName, { color: m.completed ? '#eab308' : colors.text }]} numberOfLines={1}>{m.name}</Text>
                          <Text style={[styles.milestoneCount, { color: m.completed ? '#eab308' : colors.textMuted }]}>
                            {m.current}/{m.target}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
              {(['volume', 'duration', 'style', 'strength', 'consistency', 'pattern', 'progression', 'endurance'] as const).map((cat) => {
                const catBadges = badges.filter(b => b.category === cat);
                if (catBadges.length === 0) return null;
                const catLabels: Record<string, string> = {
                  volume: 'Volume', duration: 'Duration', style: 'Style Explorer',
                  strength: 'Strength', consistency: 'Consistency', pattern: 'Pattern',
                  progression: 'Progression', endurance: 'Endurance',
                };
                return (
                  <View key={cat} style={styles.badgeCatGroup}>
                    <Text style={[styles.badgeCatLabel, { color: colors.textMuted }]}>{catLabels[cat]}</Text>
                    <View style={styles.badgeRow}>
                      {catBadges.map((b) => {
                        const progress = b.target > 0 ? b.current / b.target : 0;
                        const circumference = 2 * Math.PI * 18;
                        const offset = circumference * (1 - Math.min(progress, 1));
                        return (
                          <TouchableOpacity
                            key={b.id}
                            style={styles.badgeItem}
                            onPress={() => setDetailItem({ id: b.id, iconName: b.icon, label: b.name, description: b.description, unlocked: b.earned, current: b.current, target: b.target })}
                            activeOpacity={0.7}
                          >
                            <View style={styles.badgeRing}>
                              <Svg width={44} height={44} viewBox="0 0 44 44">
                                <SvgCircle cx={22} cy={22} r={18} fill="none" stroke={colors.border} strokeWidth={2.5} />
                                <SvgCircle cx={22} cy={22} r={18} fill="none" stroke={b.earned ? '#eab308' : `${accent}66`} strokeWidth={2.5} strokeDasharray={`${circumference}`} strokeDashoffset={offset} strokeLinecap="round" transform="rotate(-90 22 22)" />
                              </Svg>
                              <View style={styles.badgeIconCenter}>
                                {b.earned ? <PlatformIcon name="check" size={14} color="#eab308" /> : getMilestoneIcon(b.icon, colors.textMuted, 14)}
                              </View>
                            </View>
                            <Text style={[styles.badgeName, { color: b.earned ? '#eab308' : colors.text }]} numberOfLines={1}>{b.name}</Text>
                            <Text style={[styles.badgeProgress, { color: b.earned ? '#eab308' : colors.textMuted }]}>
                              {b.earned ? 'Earned' : `${b.current}/${b.target}`}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
          </GlassCard>
        )}

        </>}

        {/* ═══════════════════════════════════════════════ */}
        {/* ═══ TAB: STATS ═══                             */}
        {/* ═══════════════════════════════════════════════ */}
        {activeInsightsTab === 'stats' && <>

        {/* ═══ 1: Lifetime Totals ═══ */}
        <GlassCard>
          <View style={styles.sectionInner}>
            <InfoHeader title="LIFETIME TOTALS" desc={CARD_INFO['LIFETIME TOTALS'] ?? ''} />
            <View style={styles.nerdsStatGrid}>
              <View style={styles.nerdsStat}>
                <Text style={[styles.nerdsStatValue, { color: colors.text }]}>{lifetimeTotals.totalVolumeLbs.toLocaleString()}</Text>
                <Text style={[styles.nerdsStatLabel, { color: colors.textMuted }]}>lbs moved</Text>
              </View>
              <View style={[styles.nerdsStatDivider, { backgroundColor: colors.border }]} />
              <View style={styles.nerdsStat}>
                <Text style={[styles.nerdsStatValue, { color: colors.text }]}>{lifetimeTotals.totalHours}h</Text>
                <Text style={[styles.nerdsStatLabel, { color: colors.textMuted }]}>training time</Text>
              </View>
              <View style={[styles.nerdsStatDivider, { backgroundColor: colors.border }]} />
              <View style={styles.nerdsStat}>
                <Text style={[styles.nerdsStatValue, { color: colors.text }]}>{lifetimeTotals.totalSets.toLocaleString()}</Text>
                <Text style={[styles.nerdsStatLabel, { color: colors.textMuted }]}>total sets</Text>
              </View>
              <View style={[styles.nerdsStatDivider, { backgroundColor: colors.border }]} />
              <View style={styles.nerdsStat}>
                <Text style={[styles.nerdsStatValue, { color: colors.text }]}>{lifetimeTotals.trainingAgeDays}d</Text>
                <Text style={[styles.nerdsStatLabel, { color: colors.textMuted }]}>training age</Text>
              </View>
            </View>
            {lifetimeTotals.totalVolumeLbs > 0 && (
              <Text style={[styles.funEquivalent, { color: accent }]}>
                That's {lifetimeTotals.funEquivalent}
              </Text>
            )}
          </View>
        </GlassCard>

        {/* ═══ 2: More Stats ═══ */}
        <GlassCard>
          <View style={styles.nerdsContent}>

            {/* ── Strength Ratios ── */}
            {strengthRatios.lifts.length > 0 && (
              <View style={styles.nerdsGroup}>
                <Text style={[styles.nerdsGroupLabel, { color: mutedLabel }]}>STRENGTH RATIOS</Text>
                {strengthRatios.lifts.map((lift) => (
                  <View key={lift.name} style={[styles.ratioRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.ratioName, { color: colors.text }]}>{lift.name}</Text>
                    <View style={styles.ratioRight}>
                      <Text style={[styles.ratioE1rm, { color: colors.textSecondary }]}>{lift.e1rm} lb</Text>
                      <Text style={[styles.ratioBW, { color: accent }]}>{lift.bwMultiplier}x BW</Text>
                    </View>
                  </View>
                ))}
                {strengthRatios.dotsScore !== null && (
                  <View style={[styles.dotsRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
                    <Text style={[styles.dotsLabel, { color: colors.textSecondary }]}>DOTS Score (SBD Total)</Text>
                    <Text style={[styles.dotsValue, { color: accent }]}>{strengthRatios.dotsScore}</Text>
                  </View>
                )}
              </View>
            )}

            {/* ── Progressive Overload ── */}
            {overload.weeklyVolumeChange !== null && (
              <View style={styles.nerdsGroup}>
                <Text style={[styles.nerdsGroupLabel, { color: mutedLabel }]}>PROGRESSIVE OVERLOAD</Text>
                <View style={styles.overloadRow}>
                  <Text style={[styles.overloadValue, { color: overload.isProgressing ? '#22c55e' : '#ef4444' }]}>
                    {overload.weeklyVolumeChange > 0 ? '+' : ''}{overload.weeklyVolumeChange}%
                  </Text>
                  <Text style={[styles.overloadDesc, { color: colors.textSecondary }]}>
                    volume vs 4 weeks ago
                  </Text>
                </View>
              </View>
            )}

            {/* ── Patterns ── */}
            <View style={styles.nerdsGroup}>
              <Text style={[styles.nerdsGroupLabel, { color: mutedLabel }]}>TRAINING PATTERNS</Text>
              {patterns.bestDay && (
                <View style={[styles.patternRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.patternLabel, { color: colors.textSecondary }]}>Best day</Text>
                  <Text style={[styles.patternValue, { color: colors.text }]}>{patterns.bestDay.day} (avg score {patterns.bestDay.avgScore})</Text>
                </View>
              )}
              {patterns.preferredTime && (
                <View style={[styles.patternRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.patternLabel, { color: colors.textSecondary }]}>Preferred time</Text>
                  <View style={styles.timeBreakdown}>
                    {patterns.preferredTime.filter(t => t.pct > 0).map((t) => (
                      <Text key={t.label} style={[styles.timeBreakdownItem, { color: colors.text }]}>{t.label} {t.pct}%</Text>
                    ))}
                  </View>
                </View>
              )}
              <View style={[styles.patternRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.patternLabel, { color: colors.textSecondary }]}>Exercise variety (4 wk)</Text>
                <Text style={[styles.patternValue, { color: colors.text }]}>{patterns.exerciseVariety} unique</Text>
              </View>
              {patterns.mostTrainedExercise && (
                <View style={[styles.patternRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.patternLabel, { color: colors.textSecondary }]}>Most trained</Text>
                  <Text style={[styles.patternValue, { color: colors.text }]} numberOfLines={1}>{patterns.mostTrainedExercise.name} ({patterns.mostTrainedExercise.count}x)</Text>
                </View>
              )}
              {patterns.mostTrainedMuscle && (
                <View style={[styles.patternRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.patternLabel, { color: colors.textSecondary }]}>Top muscle</Text>
                  <Text style={[styles.patternValue, { color: colors.text }]}>{patterns.mostTrainedMuscle.name} ({patterns.mostTrainedMuscle.sets} sets)</Text>
                </View>
              )}
              {patterns.leastTrainedMuscle && (
                <View style={[styles.patternRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.patternLabel, { color: colors.textSecondary }]}>Neglected muscle</Text>
                  <Text style={[styles.patternValue, { color: colors.text }]}>{patterns.leastTrainedMuscle.name} ({patterns.leastTrainedMuscle.sets} sets)</Text>
                </View>
              )}
              {patterns.mostImprovedExercise && (
                <View style={[styles.patternRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.patternLabel, { color: colors.textSecondary }]}>Most improved</Text>
                  <Text style={[styles.patternValue, { color: '#22c55e' }]}>{patterns.mostImprovedExercise.name} (+{patterns.mostImprovedExercise.pctGain}%)</Text>
                </View>
              )}
              {patterns.avgRPETrend && (
                <View style={[styles.patternRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.patternLabel, { color: colors.textSecondary }]}>Avg RPE trend</Text>
                  <Text style={[styles.patternValue, { color: colors.text }]}>
                    {patterns.avgRPETrend.current} {patterns.avgRPETrend.current < patterns.avgRPETrend.previous ? '↓' : patterns.avgRPETrend.current > patterns.avgRPETrend.previous ? '↑' : '→'} (was {patterns.avgRPETrend.previous})
                  </Text>
                </View>
              )}
              {(patterns.difficultyDistribution.easy + patterns.difficultyDistribution.moderate + patterns.difficultyDistribution.hard + patterns.difficultyDistribution.brutal) > 0 && (
                <View style={styles.difficultyRow}>
                  <Text style={[styles.patternLabel, { color: colors.textSecondary, marginBottom: 6 }]}>Difficulty spread (4 wk)</Text>
                  <View style={styles.difficultyBars}>
                    {([
                      { key: 'easy', label: 'Easy', color: '#22c55e', count: patterns.difficultyDistribution.easy },
                      { key: 'moderate', label: 'Mod', color: '#f59e0b', count: patterns.difficultyDistribution.moderate },
                      { key: 'hard', label: 'Hard', color: '#f87116', count: patterns.difficultyDistribution.hard },
                      { key: 'brutal', label: 'Brutal', color: '#ef4444', count: patterns.difficultyDistribution.brutal },
                    ] as const).filter(d => d.count > 0).map((d) => (
                      <View key={d.key} style={styles.difficultyItem}>
                        <View style={[styles.difficultyDot, { backgroundColor: d.color }]} />
                        <Text style={[styles.difficultyText, { color: colors.textSecondary }]}>{d.label} {d.count}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
              {patterns.topWentWellTags.length > 0 && (
                <View style={styles.tagsRow}>
                  <Text style={[styles.patternLabel, { color: colors.textSecondary, marginBottom: 6 }]}>Top vibes</Text>
                  <View style={styles.tagsWrap}>
                    {patterns.topWentWellTags.map((t) => (
                      <View key={t.tag} style={[styles.tagChip, { backgroundColor: `${accent}15`, borderColor: `${accent}30` }]}>
                        <Text style={[styles.tagText, { color: accent }]}>{t.tag} ({t.count})</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* ── Projections ── */}
            {(projections.monthPace || projections.strengthProjection) && (
              <View style={styles.nerdsGroup}>
                <Text style={[styles.nerdsGroupLabel, { color: mutedLabel }]}>Projections</Text>
                {projections.monthPace && (
                  <View style={[styles.projectionCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
                    <Text style={[styles.projectionText, { color: colors.text }]}>
                      On pace for <Text style={{ color: accent, fontWeight: '800' }}>{projections.monthPace.projected}</Text> workouts this month
                    </Text>
                    <Text style={[styles.projectionSub, { color: colors.textMuted }]}>
                      {projections.monthPace.current} so far · last month: {projections.monthPace.lastMonth}
                    </Text>
                  </View>
                )}
                {projections.strengthProjection && (
                  <View style={[styles.projectionCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
                    <Text style={[styles.projectionText, { color: colors.text }]}>
                      {projections.strengthProjection.exercise}: {projections.strengthProjection.target} in ~<Text style={{ color: accent, fontWeight: '800' }}>{projections.strengthProjection.weeksAway}</Text> weeks
                    </Text>
                    <Text style={[styles.projectionSub, { color: colors.textMuted }]}>Based on your current rate of progression</Text>
                  </View>
                )}
              </View>
            )}

            {/* ── Self Comparison ── */}
            <View style={styles.nerdsGroup}>
              <Text style={[styles.nerdsGroupLabel, { color: mutedLabel }]}>COMPARE TO YOURSELF</Text>
              {selfComparison.thisWeekVsFirst && (
                <View style={[styles.comparisonCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
                  <Text style={[styles.comparisonTitle, { color: colors.text }]}>This week vs your first week</Text>
                  <View style={styles.comparisonRow}>
                    <View style={styles.comparisonItem}>
                      <Text style={[styles.comparisonItemValue, { color: colors.text }]}>{selfComparison.thisWeekVsFirst.thisWeekVolume.toLocaleString()}</Text>
                      <Text style={[styles.comparisonItemLabel, { color: colors.textMuted }]}>Volume now</Text>
                    </View>
                    <Text style={[styles.comparisonVs, { color: colors.textMuted }]}>vs</Text>
                    <View style={styles.comparisonItem}>
                      <Text style={[styles.comparisonItemValue, { color: colors.textMuted }]}>{selfComparison.thisWeekVsFirst.firstWeekVolume.toLocaleString()}</Text>
                      <Text style={[styles.comparisonItemLabel, { color: colors.textMuted }]}>Week 1</Text>
                    </View>
                  </View>
                  {selfComparison.thisWeekVsFirst.volumeChange !== null && (
                    <Text style={[styles.comparisonDelta, { color: selfComparison.thisWeekVsFirst.volumeChange >= 0 ? '#22c55e' : '#ef4444' }]}>
                      {selfComparison.thisWeekVsFirst.volumeChange >= 0 ? '+' : ''}{selfComparison.thisWeekVsFirst.volumeChange}% volume
                    </Text>
                  )}
                </View>
              )}
              {selfComparison.thisMonthVsLast && (
                <View style={[styles.comparisonCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', marginTop: 8 }]}>
                  <Text style={[styles.comparisonTitle, { color: colors.text }]}>This month vs last month</Text>
                  <View style={styles.comparisonGrid}>
                    {[
                      { label: 'Workouts', now: selfComparison.thisMonthVsLast.thisMonthWorkouts, prev: selfComparison.thisMonthVsLast.lastMonthWorkouts },
                      { label: 'Volume', now: selfComparison.thisMonthVsLast.thisMonthVolume, prev: selfComparison.thisMonthVsLast.lastMonthVolume },
                      { label: 'PRs', now: selfComparison.thisMonthVsLast.thisMonthPRs, prev: selfComparison.thisMonthVsLast.lastMonthPRs },
                    ].map((item) => {
                      const delta = item.prev > 0 ? Math.round(((item.now - item.prev) / item.prev) * 100) : null;
                      return (
                        <View key={item.label} style={styles.comparisonGridItem}>
                          <Text style={[styles.comparisonGridValue, { color: colors.text }]}>
                            {typeof item.now === 'number' && item.now > 999 ? `${(item.now / 1000).toFixed(1)}k` : item.now}
                          </Text>
                          <Text style={[styles.comparisonGridLabel, { color: colors.textMuted }]}>{item.label}</Text>
                          {delta !== null && (
                            <Text style={[styles.comparisonGridDelta, { color: delta >= 0 ? '#22c55e' : '#ef4444' }]}>
                              {delta >= 0 ? '+' : ''}{delta}%
                            </Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>

          </View>
        </GlassCard>

        {/* ═══ 3: All-Time Records ═══ */}
        {recordsBoard.bestSession && (
          <GlassCard>
            <View style={styles.sectionInner}>
              <InfoHeader title="ALL-TIME RECORDS" desc={CARD_INFO['ALL-TIME RECORDS'] ?? ''} />
              {recordsBoard.bestSession && <View style={[styles.recordRow, { borderBottomColor: colors.border }]}><Text style={[styles.recordLabel, { color: colors.textSecondary }]}>Best session</Text><Text style={[styles.recordValue, { color: colors.text }]}>{recordsBoard.bestSession.score} pts</Text></View>}
              {recordsBoard.longestSession && <View style={[styles.recordRow, { borderBottomColor: colors.border }]}><Text style={[styles.recordLabel, { color: colors.textSecondary }]}>Longest session</Text><Text style={[styles.recordValue, { color: colors.text }]}>{recordsBoard.longestSession.duration} min</Text></View>}
              {recordsBoard.heaviestLift && <View style={[styles.recordRow, { borderBottomColor: colors.border }]}><Text style={[styles.recordLabel, { color: colors.textSecondary }]}>Heaviest lift</Text><Text style={[styles.recordValue, { color: colors.text }]}>{recordsBoard.heaviestLift.weight} lb ({recordsBoard.heaviestLift.exercise})</Text></View>}
              {recordsBoard.mostVolume && <View style={[styles.recordRow, { borderBottomColor: colors.border }]}><Text style={[styles.recordLabel, { color: colors.textSecondary }]}>Most volume</Text><Text style={[styles.recordValue, { color: colors.text }]}>{recordsBoard.mostVolume.volume.toLocaleString()} lb</Text></View>}
              {recordsBoard.mostPRs && recordsBoard.mostPRs.count > 0 && <View style={[styles.recordRow, { borderBottomColor: colors.border }]}><Text style={[styles.recordLabel, { color: colors.textSecondary }]}>Most PRs (one session)</Text><Text style={[styles.recordValue, { color: colors.text }]}>{recordsBoard.mostPRs.count}</Text></View>}
              {recordsBoard.mostExercises && <View style={[styles.recordRow, { borderBottomColor: colors.border }]}><Text style={[styles.recordLabel, { color: colors.textSecondary }]}>Most exercises</Text><Text style={[styles.recordValue, { color: colors.text }]}>{recordsBoard.mostExercises.count}</Text></View>}
            </View>
          </GlassCard>
        )}

        {/* ═══ 2b: Personal Records ═══ */}
        <GlassCard>
          <View style={styles.sectionInner}>
            <InfoHeader title={`PERSONAL RECORDS (${uniquePRs.length})`} desc={CARD_INFO['PERSONAL RECORDS'] ?? ''} />

            {groupedPRs.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No personal records yet.</Text>
            ) : (
              <>
                {(['Upper Push', 'Upper Pull', 'Lower', 'Core', 'Other'] as PRCategory[]).map((cat) => {
                  const catPRs = groupedPRs.filter(p => p.category === cat);
                  if (catPRs.length === 0) return null;
                  const displayPRs = prShowAll ? catPRs : catPRs.slice(0, 2);
                  return (
                    <View key={cat}>
                      <Text style={[styles.prCategoryLabel, { color: colors.textMuted }]}>{cat}</Text>
                      {displayPRs.map((pr, i) => (
                        <View key={`${pr.exerciseName}-${i}`} style={[styles.prRow, { borderBottomColor: colors.border }]}>
                          <View style={styles.prRowLeft}>
                            <Text style={[styles.prName, { color: colors.text }]}>{pr.exerciseName}</Text>
                            <Text style={[styles.prDetail, { color: colors.textSecondary }]}>
                              {pr.reps} reps · {pr.weight} lb · {formatDate(pr.date)}
                            </Text>
                          </View>
                          <View style={styles.prRowRight}>
                            <Text style={[styles.prE1rm, { color: accent }]}>~{pr.e1rm} lb</Text>
                            <View style={styles.prTrend}>
                              {pr.trend === 'up' && <PlatformIcon name="trending-up" size={10} color="#22c55e" />}
                              {pr.trend === 'down' && <PlatformIcon name="trending-down" size={10} color="#ef4444" />}
                              {pr.trend === 'flat' && <PlatformIcon name="minus" size={10} color={colors.textMuted} />}
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  );
                })}
                {!prShowAll && groupedPRs.length > 6 && (
                  <TouchableOpacity onPress={() => setPrShowAll(true)} activeOpacity={0.7} style={styles.showAllBtn}>
                    <Text style={[styles.showAllText, { color: accent }]}>Show all {groupedPRs.length} records</Text>
                    <PlatformIcon name="chevron-down" size={14} color={accent} />
                  </TouchableOpacity>
                )}
                {prShowAll && (
                  <TouchableOpacity onPress={() => setPrShowAll(false)} activeOpacity={0.7} style={styles.showAllBtn}>
                    <Text style={[styles.showAllText, { color: accent }]}>Show less</Text>
                    <PlatformIcon name="chevron-up" size={14} color={accent} />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </GlassCard>

        {/* ═══ Duration Trend ═══ */}
        {durationTrend.dataPoints.length >= 3 && (
          <GlassCard>
            <View style={styles.sectionInner}>
              <View style={styles.sectionHeaderRow}>
                <InfoHeader title="AVG SESSION DURATION" desc={CARD_INFO['AVG SESSION DURATION'] ?? ''} noMargin />
                <Text style={[styles.trendIndicator, { color: durationTrend.trend === 'up' ? '#22c55e' : durationTrend.trend === 'down' ? '#ef4444' : colors.textMuted }]}>
                  {durationTrend.avgRecent}m {durationTrend.trend === 'up' ? '↑' : durationTrend.trend === 'down' ? '↓' : '→'}
                </Text>
              </View>
              <Svg width={280} height={36} viewBox="0 0 280 36">
                {(() => {
                  const data = durationTrend.dataPoints;
                  const max = Math.max(...data, 1);
                  const min = Math.min(...data, 0);
                  const range = max - min || 1;
                  const pts = data.map((v, i) => `${4 + (i / (data.length - 1)) * 272},${4 + 28 - ((v - min) / range) * 28}`).join(' ');
                  return <Polyline points={pts} fill="none" stroke={accent} strokeWidth={2} strokeLinecap="round" />;
                })()}
              </Svg>
            </View>
          </GlassCard>
        )}

        {/* ═══ Peak Performance Window ═══ */}
        {peakWindow.bestWindow && (
          <GlassCard>
            <View style={styles.sectionInner}>
              <InfoHeader title="PEAK PERFORMANCE" desc={CARD_INFO['PEAK PERFORMANCE'] ?? ''} />
              <Text style={[styles.peakWindowText, { color: colors.text }]}>
                Your best sessions happen <Text style={{ color: accent, fontWeight: '800' }}>{peakWindow.bestWindow}</Text>
              </Text>
            </View>
          </GlassCard>
        )}

        {/* ═══ Time of Day Distribution ═══ */}
        {todDistribution.total >= 3 && (
          <GlassCard>
            <View style={styles.sectionInner}>
              <InfoHeader title="WORKOUT TIME OF DAY" desc={CARD_INFO['WORKOUT TIME OF DAY'] ?? ''} />
              <View style={styles.todHistogram}>
                {(() => {
                  const maxCount = Math.max(...todDistribution.buckets.map(b => b.count), 1);
                  return todDistribution.buckets.map(({ label, icon, count }) => {
                    const barH = Math.max(4, Math.round((count / maxCount) * 56));
                    return (
                      <View key={label} style={styles.todColumn}>
                        <Text style={[styles.todCount, { color: count > 0 ? colors.text : colors.textMuted }]}>{count}</Text>
                        <View style={styles.todBarWrap}>
                          <View style={[styles.todBar, { height: barH, backgroundColor: count > 0 ? accent : colors.border }]} />
                        </View>
                        <PlatformIcon name={icon as any} size={14} color={count > 0 ? colors.textSecondary : colors.textMuted} strokeWidth={1.8} />
                        <Text style={[styles.todLabel, { color: colors.textMuted }]}>{label}</Text>
                      </View>
                    );
                  });
                })()}
              </View>
            </View>
          </GlassCard>
        )}

        {/* ═══ Training Style Distribution ═══ */}
        {styleDistribution.length > 0 && (
          <GlassCard>
            <View style={styles.sectionInner}>
              <InfoHeader title="TRAINING STYLE BREAKDOWN" desc="All-time distribution of your workout styles" />
              <View style={styles.splitBar}>
                {styleDistribution.map(({ style, pct }) => (
                  <View key={style} style={[styles.splitSegment, {
                    flex: pct,
                    backgroundColor: WORKOUT_STYLE_COLORS[style] ?? accent,
                  }]} />
                ))}
              </View>
              <View style={styles.splitLegend}>
                {styleDistribution.map(({ style, pct }) => (
                  <View key={style} style={styles.splitLegendItem}>
                    <View style={[styles.splitLegendDot, { backgroundColor: WORKOUT_STYLE_COLORS[style] ?? accent }]} />
                    <Text style={[styles.splitLegendText, { color: colors.textSecondary }]}>{style} {pct}%</Text>
                  </View>
                ))}
              </View>
            </View>
          </GlassCard>
        )}

        {/* ═══ 3: Most Popular Exercises ═══ */}
        {exerciseFreq.top.length > 0 && (
          <GlassCard>
            <View style={styles.sectionInner}>
              <InfoHeader title="MOST POPULAR" desc={CARD_INFO['MOST POPULAR'] ?? ''} />
              {exerciseFreq.top.slice(0, 7).map((ex, i) => (
                <View key={ex.name} style={[styles.freqRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.freqRank, { color: colors.textMuted }]}>{i + 1}</Text>
                  <Text style={[styles.freqName, { color: colors.text }]} numberOfLines={1}>{ex.name}</Text>
                  <Text style={[styles.freqCount, { color: accent }]}>{ex.count}x</Text>
                </View>
              ))}
            </View>
          </GlassCard>
        )}

        {/* ═══ 4: PR Timeline (5 shown, expandable) ═══ */}
        {prTimeline.entries.length > 0 && (
          <GlassCard>
            <View style={styles.sectionInner}>
              <InfoHeader title="PR TIMELINE" desc={CARD_INFO['PR TIMELINE'] ?? ''} />
              {prTimeline.entries.slice(0, prTimelineShowAll ? prTimeline.entries.length : 5).map((pr, i) => (
                <View key={`${pr.exerciseName}-${pr.date}-${i}`} style={[styles.timelineRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.timelineDate, { color: colors.textMuted }]}>{formatDate(pr.date)}</Text>
                  <Text style={[styles.timelineName, { color: colors.text }]} numberOfLines={1}>{pr.exerciseName}</Text>
                  <Text style={[styles.timelineValue, { color: accent }]}>{pr.value} lb</Text>
                </View>
              ))}
              {prTimeline.entries.length > 5 && (
                <TouchableOpacity
                  onPress={() => setPrTimelineShowAll(v => !v)}
                  activeOpacity={0.7}
                  style={styles.showAllBtn}
                >
                  <Text style={[styles.showAllText, { color: accent }]}>
                    {prTimelineShowAll ? 'Show less' : `Show all ${prTimeline.entries.length}`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </GlassCard>
        )}

        {/* ═══ 5: Equipment Usage ═══ */}
        {equipmentUsage.items.length > 0 && (
          <GlassCard>
            <View style={styles.sectionInner}>
              <InfoHeader title="EQUIPMENT USAGE" desc={CARD_INFO['EQUIPMENT USAGE'] ?? ''} />
              {equipmentUsage.items.map((item) => (
                <View key={item.name} style={[styles.freqRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.freqName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.freqCount, { color: accent }]}>{item.count}x</Text>
                </View>
              ))}
            </View>
          </GlassCard>
        )}

        {/* ═══ 6: Warmup Compliance ═══ */}
        {warmupCompliance.totalSessions > 0 && (
          <GlassCard>
            <View style={styles.sectionInner}>
              <InfoHeader title="WARM-UP COMPLIANCE" desc={CARD_INFO['WARM-UP COMPLIANCE'] ?? ''} />
              <View style={styles.complianceRow}>
                <Text style={[styles.compliancePct, { color: warmupCompliance.pct >= 50 ? '#22c55e' : '#ef4444' }]}>{warmupCompliance.pct}%</Text>
                <Text style={[styles.complianceDesc, { color: colors.textSecondary }]}>of sessions this month included warm-up ({warmupCompliance.withWarmup}/{warmupCompliance.totalSessions})</Text>
              </View>
            </View>
          </GlassCard>
        )}

        {/* ═══ Rest / Misc ═══ */}
        {restDays.avgRestDays > 0 && (
          <GlassCard>
            <View style={styles.sectionInner}>
              <InfoHeader title="REST PATTERNS (4 WK)" desc={CARD_INFO['REST PATTERNS (4 WK)'] ?? ''} />
              <View style={styles.restRow}>
                <View style={styles.restItem}><Text style={[styles.restValue, { color: colors.text }]}>{restDays.avgRestDays}</Text><Text style={[styles.restLabel, { color: colors.textMuted }]}>Avg rest days</Text></View>
                <View style={styles.restItem}><Text style={[styles.restValue, { color: colors.text }]}>{restDays.longestGap}</Text><Text style={[styles.restLabel, { color: colors.textMuted }]}>Longest gap</Text></View>
              </View>
            </View>
          </GlassCard>
        )}
        {muscleBalance.score > 0 && (
          <GlassCard>
            <View style={styles.sectionInner}>
              <InfoHeader title="MUSCLE BALANCE SCORE" desc={CARD_INFO['MUSCLE BALANCE SCORE'] ?? ''} />
              <View style={styles.balanceRow}>
                <Text style={[styles.balanceScore, { color: muscleBalance.score >= 70 ? '#22c55e' : muscleBalance.score >= 40 ? '#f59e0b' : '#ef4444' }]}>{muscleBalance.score}</Text>
                <Text style={[styles.balanceMax, { color: colors.textMuted }]}>/100</Text>
                {muscleBalance.worstMuscle && <Text style={[styles.balanceWorst, { color: colors.textSecondary }]}> — {muscleBalance.worstMuscle} is undertrained</Text>}
              </View>
            </View>
          </GlassCard>
        )}
        {sessionQuality.dataPoints.length >= 3 && (
          <GlassCard>
            <View style={styles.sectionInner}>
              <View style={styles.sectionHeaderRow}>
                <InfoHeader title="SESSION QUALITY" desc={CARD_INFO['SESSION QUALITY'] ?? ''} noMargin />
                <Text style={[styles.trendIndicator, { color: sessionQuality.trend === 'up' ? '#22c55e' : sessionQuality.trend === 'down' ? '#ef4444' : colors.textMuted }]}>
                  {sessionQuality.trend === 'up' ? '↑' : sessionQuality.trend === 'down' ? '↓' : '→'}
                </Text>
              </View>
              <Svg width={280} height={36} viewBox="0 0 280 36">
                {(() => {
                  const data = sessionQuality.dataPoints.map(d => d.score);
                  const max = Math.max(...data, 1);
                  const min = Math.min(...data, 0);
                  const range = max - min || 1;
                  const pts = data.map((v, i) => `${4 + (i / (data.length - 1)) * 272},${4 + 28 - ((v - min) / range) * 28}`).join(' ');
                  return <Polyline points={pts} fill="none" stroke={accent} strokeWidth={2} strokeLinecap="round" />;
                })()}
              </Svg>
            </View>
          </GlassCard>
        )}
        {(favoriteExercises.likedCount > 0 || favoriteExercises.dislikedCount > 0) && (
          <GlassCard>
            <View style={styles.sectionInner}>
              <InfoHeader title="EXERCISE PREFERENCES" desc={CARD_INFO['EXERCISE PREFERENCES'] ?? ''} />
              <View style={styles.favRow}>
                <Text style={[styles.favStat, { color: '#22c55e' }]}>{favoriteExercises.likedCount} liked</Text>
                <Text style={[styles.favStat, { color: '#ef4444' }]}>{favoriteExercises.dislikedCount} disliked</Text>
              </View>
            </View>
          </GlassCard>
        )}

        </>}

        {activeInsightsTab === 'running' && (
          <View style={{ marginHorizontal: -16 }}>
            <RunInsights
              onOpenRun={(id) => {
                setRunLogId(id);
                setRunLogVisible(true);
              }}
            />
          </View>
        )}

        <View style={{ height: 60 }} />
      </View>
    </BaseDrawer>

    <RunLogDrawer
      visible={runLogVisible}
      runId={runLogId}
      onClose={() => {
        setRunLogVisible(false);
        setRunLogId(null);
      }}
    />

    <StyleTrackerDrawer
      visible={trackerVisible}
      onClose={() => setTrackerVisible(false)}
    />

    <AchievementModal
      visible={!!detailItem}
      achievement={detailItem}
      onClose={() => setDetailItem(null)}
    />

    {/* ── Info Popup ── */}
    <Modal visible={!!infoToast} transparent animationType="fade" statusBarTranslucent>
      <TouchableOpacity
        style={styles.popupBackdrop}
        activeOpacity={1}
        onPress={() => { if (infoToastTimer.current) clearTimeout(infoToastTimer.current); setInfoToast(null); }}
      >
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={[styles.popupCard, { backgroundColor: isDark ? 'rgba(28,28,30,0.98)' : 'rgba(255,255,255,0.98)' }]}>
            <View style={[styles.popupAccentBar, { backgroundColor: accent }]} />
            <View style={styles.popupInner}>
              <Text style={[styles.popupTitle, { color: isDark ? '#fff' : '#000' }]}>{infoToast?.title}</Text>
              <Text style={[styles.popupBody, { color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.55)' }]}>{infoToast?.body}</Text>
              <TouchableOpacity
                style={[styles.popupDismiss, { backgroundColor: `${accent}22`, borderColor: `${accent}44` }]}
                onPress={() => { if (infoToastTimer.current) clearTimeout(infoToastTimer.current); setInfoToast(null); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.popupDismissText, { color: accent }]}>Got it</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  </>
  );
}

// ─── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  closeBtn: { padding: 4, marginTop: 4 },

  // Tab bar
  insightsTabBar: {
    flexDirection: 'row' as const,
    alignItems: 'stretch' as const,
    height: 46,
    paddingVertical: 5,
    paddingHorizontal: 5,
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 4,
    position: 'relative' as const,
    overflow: 'hidden' as const,
    backgroundColor: 'rgba(20,20,20,0.98)',
    borderRadius: 23,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  insightsTabPill: {
    position: 'absolute' as const,
    top: 5,
    bottom: 5,
    left: 0,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  insightsTabBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 5,
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
    zIndex: 1,
  },
  insightsTabLabel: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
    letterSpacing: 0.1,
  },

  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 20,
  },

  // Section shared
  sectionInner: { padding: 16, gap: 8 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  infoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  popupBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  popupCard: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 20,
  },
  popupAccentBar: {
    height: 3,
    width: '100%',
  },
  popupInner: {
    padding: 22,
    gap: 10,
  },
  popupTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  popupBody: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '400',
  },
  popupDismiss: {
    marginTop: 6,
    alignSelf: 'flex-end',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  popupDismissText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // Pro banner
  historyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  historyBannerText: { flex: 1, fontSize: 13, fontWeight: '500', color: '#f5c842' },
  historyBannerArrow: { fontSize: 14, color: '#f5c842', fontWeight: '700' },

  // Radar
  radarWrapper: { position: 'relative', alignSelf: 'center' },
  radarContainer: { width: RADAR_SIZE, height: RADAR_SIZE, alignSelf: 'center', position: 'relative' },
  radarOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  radarLockBadge: { alignItems: 'center', gap: 6, backgroundColor: 'rgba(12,12,15,0.85)', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  radarLockSub: { fontSize: 12, color: '#aaa', textAlign: 'center', fontWeight: '600' },
  axisLabel: { position: 'absolute', width: 88, alignItems: 'center' },
  axisLabelText: { fontSize: 10, fontWeight: '700', textAlign: 'center', lineHeight: 13 },
  axisValueText: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  axisBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  tierBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  tierBadgeText: { fontSize: 7, fontWeight: '800', letterSpacing: 0.3, textTransform: 'uppercase' },
  tipHint: { fontSize: 11, textAlign: 'center', marginTop: 2 },
  tipCard: { borderRadius: 12, padding: 14 },
  tipTitle: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  tipText: { fontSize: 12, lineHeight: 18 },

  // AI Coach
  coachHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  coachCard: { flexDirection: 'row', gap: 12, borderLeftWidth: 3, paddingLeft: 12, paddingVertical: 4 },
  coachContent: { flex: 1, gap: 4 },
  coachTitle: { fontSize: 15, fontWeight: '700' },
  coachBody: { fontSize: 13, lineHeight: 19 },
  coachAttribution: { fontSize: 10, fontWeight: '500' },

  // This Week metrics
  metricGrid: { flexDirection: 'row' },
  metricCell: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  metricValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  metricLabel: { fontSize: 8, fontWeight: '700', letterSpacing: 0.8, marginTop: 1 },

  // Bar chart
  barChart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 48, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 8, marginTop: 4 },
  barCol: { alignItems: 'center', flex: 1, gap: 3 },
  bar: { width: 12, borderRadius: 3 },
  barLabel: { fontSize: 8, fontWeight: '600' },

  // Training load
  loadChart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 60 },
  loadBarCol: { alignItems: 'center', flex: 1, gap: 3 },
  loadBar: { width: 14, borderRadius: 3 },
  loadBarLabel: { fontSize: 7, fontWeight: '600' },
  loadStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginTop: 2 },
  loadStatusText: { fontSize: 13, fontWeight: '700' },
  proOverlaySmall: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 },
  proOverlayText: { fontSize: 11, fontWeight: '600', color: PRO_GOLD },

  // Style insights
  styleInsightContent: { gap: 8 },
  exampleBadgeRow: { flexDirection: 'row', marginBottom: 10 },
  exampleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  exampleBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  exampleUnlockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: 10 },
  exampleUnlockText: { fontSize: 12, fontWeight: '500' },
  volumeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  volumeLabel: { fontSize: 12, fontWeight: '600', width: 72 },
  volumeBarArea: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  volumeBarTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  volumeBarFill: { height: '100%', borderRadius: 3, minWidth: 2 },
  volumeSets: { fontSize: 10, fontWeight: '600', width: 52, textAlign: 'right' },
  underworkedText: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  liftRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  liftInfo: { gap: 2 },
  liftName: { fontSize: 14, fontWeight: '700' },
  liftSub: { fontSize: 10 },
  liftRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liftE1rm: { fontSize: 16, fontWeight: '800' },
  conditioningRow: { flexDirection: 'row', justifyContent: 'space-around' },
  conditioningMetric: { alignItems: 'center', gap: 4 },
  conditioningValue: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  conditioningLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  areasText: { fontSize: 12, marginTop: 4 },

  // Health
  healthHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  healthCards: { flexDirection: 'row', gap: 8 },
  healthCard: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center', gap: 4 },
  healthValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  healthLabel: { fontSize: 9, fontWeight: '600', letterSpacing: 0.3, textAlign: 'center' },

  // Consistency heatmap
  heatmapGrid: { gap: 3 },
  heatmapRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heatmapDayLabel: { width: 10, fontSize: 9, fontWeight: '600', textAlign: 'center' },
  heatmapCells: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heatmapCell: { width: 15, height: 15, borderRadius: 3 },
  heatmapSummary: { fontSize: 11, fontWeight: '600', textAlign: 'center', marginTop: 4 },

  // PRs
  prCategoryLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 8, marginBottom: 2 },
  prRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  prRowLeft: { flex: 1, gap: 2 },
  prName: { fontSize: 13, fontWeight: '700' },
  prDetail: { fontSize: 11 },
  prRowRight: { alignItems: 'flex-end', flexDirection: 'row', gap: 6 },
  prE1rm: { fontSize: 15, fontWeight: '800' },
  prTrend: { marginTop: 1 },
  showAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10 },
  showAllText: { fontSize: 13, fontWeight: '600' },

  // Milestones
  milestoneGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  milestoneBadge: { width: '48%', alignItems: 'center', paddingVertical: 12, gap: 6 },
  milestoneRingContainer: { position: 'relative', width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  milestoneIconCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  milestoneName: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  milestoneCount: { fontSize: 10, fontWeight: '600' },

  // Empty
  emptyText: { fontSize: 13, textAlign: 'center', paddingVertical: 20 },
  emptyTextSmall: { fontSize: 11, textAlign: 'center', paddingVertical: 12 },

  // Style tracker button
  trackerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  trackerBtnDot: { width: 8, height: 8, borderRadius: 4 },
  trackerBtnText: { flex: 1, fontSize: 14, fontWeight: '700' },
  trackerBtnArrow: { fontSize: 16, fontWeight: '600' },

  // Stats for Nerds
  nerdsContent: { padding: 16, gap: 20 },
  nerdsGroup: { gap: 8 },
  nerdsGroupLabel: { fontSize: 12, fontFamily: 'Outfit_600SemiBold', letterSpacing: 0 },
  nerdsStatGrid: { flexDirection: 'row', alignItems: 'center' },
  nerdsStat: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  nerdsStatDivider: { width: 1, height: 32, opacity: 0.5 },
  nerdsStatValue: { fontSize: 17, fontFamily: 'Outfit_800ExtraBold', letterSpacing: -0.5, textAlign: 'center' },
  nerdsStatLabel: { fontSize: 10, fontFamily: 'Outfit_500Medium', textAlign: 'center', marginTop: 2 },
  funEquivalent: { fontSize: 12, fontWeight: '700', marginTop: 4 },

  // Strength ratios
  ratioRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
  ratioName: { fontSize: 13, fontWeight: '700' },
  ratioRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ratioE1rm: { fontSize: 12, fontWeight: '600' },
  ratioBW: { fontSize: 14, fontWeight: '800' },
  dotsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginTop: 4 },
  dotsLabel: { fontSize: 11, fontWeight: '600' },
  dotsValue: { fontSize: 18, fontWeight: '800' },

  // Overload
  overloadRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  overloadValue: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  overloadDesc: { fontSize: 12, fontWeight: '500' },

  // Patterns
  patternRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
  patternLabel: { fontSize: 12, fontWeight: '600', flex: 1 },
  patternValue: { fontSize: 12, fontWeight: '700', textAlign: 'right', flex: 1 },
  timeBreakdown: { flexDirection: 'row', gap: 8, flex: 1, justifyContent: 'flex-end' },
  timeBreakdownItem: { fontSize: 11, fontWeight: '600' },
  difficultyRow: { paddingVertical: 6 },
  difficultyBars: { flexDirection: 'row', gap: 12 },
  difficultyItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  difficultyDot: { width: 8, height: 8, borderRadius: 4 },
  difficultyText: { fontSize: 11, fontWeight: '600' },
  tagsRow: { paddingVertical: 6 },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  tagText: { fontSize: 11, fontWeight: '600' },

  // Projections
  projectionCard: { borderRadius: 10, padding: 12, gap: 4 },
  projectionText: { fontSize: 13, fontWeight: '600', lineHeight: 19 },
  projectionSub: { fontSize: 10, fontWeight: '500' },

  // Self comparison
  comparisonCard: { borderRadius: 10, padding: 12, gap: 8 },
  comparisonTitle: { fontSize: 12, fontWeight: '700' },
  comparisonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  comparisonItem: { alignItems: 'center' },
  comparisonItemValue: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  comparisonItemLabel: { fontSize: 9, fontWeight: '600' },
  comparisonVs: { fontSize: 11, fontWeight: '600' },
  comparisonDelta: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
  comparisonGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  comparisonGridItem: { alignItems: 'center', gap: 2 },
  comparisonGridValue: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  comparisonGridLabel: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  comparisonGridDelta: { fontSize: 10, fontWeight: '700' },

  // Muscle readiness
  readinessSummary: { flexDirection: 'row', gap: 12, justifyContent: 'center' },
  readinessPill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  readinessDot: { width: 8, height: 8, borderRadius: 4 },
  readinessPillText: { fontSize: 12, fontWeight: '600' },
  readinessHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  readinessOverallPct: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  readinessOverallTrack: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 14 },
  readinessOverallFill: { height: '100%', borderRadius: 3 },
  readinessMuscleRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  readinessMuscleCell: { flex: 1, gap: 3 },
  readinessTapHint: { fontSize: 10, fontWeight: '500', textAlign: 'center', marginTop: 4 },
  readinessMuscleName: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  readinessMicroTrack: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  readinessMicroFill: { height: '100%', borderRadius: 2 },
  readinessMuscleVal: { fontSize: 9, fontWeight: '700' },

  // Duration / quality trends
  trendIndicator: { fontSize: 13, fontWeight: '700' },

  // Peak performance
  peakWindowText: { fontSize: 14, fontWeight: '600', lineHeight: 20 },

  // Split adherence
  splitBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2 },
  splitSegment: { borderRadius: 4 },
  splitLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  splitLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  splitLegendDot: { width: 6, height: 6, borderRadius: 3 },
  splitLegendText: { fontSize: 11, fontWeight: '600' },
  todHistogram: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', paddingTop: 4, gap: 6 },
  todColumn: { flex: 1, alignItems: 'center', gap: 3 },
  todBarWrap: { height: 60, justifyContent: 'flex-end', width: '100%', alignItems: 'center' },
  todBar: { width: '55%', borderRadius: 4 },
  todCount: { fontSize: 12, fontWeight: '700' },
  todEmoji: { fontSize: 14 },
  todLabel: { fontSize: 10, fontWeight: '600', textAlign: 'center' },

  // Badges
  badgeCatGroup: { gap: 6, marginTop: 8 },
  badgeCatLabel: { fontSize: 12, fontFamily: 'Outfit_600SemiBold', letterSpacing: 0 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap' },
  badgeItem: { width: '33.33%', alignItems: 'center', paddingVertical: 8, gap: 3 },
  badgeRing: { position: 'relative', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  badgeIconCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  badgeName: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  badgeProgress: { fontSize: 8, fontWeight: '600' },

  // Warmup compliance
  complianceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  compliancePct: { fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  complianceDesc: { fontSize: 12, fontWeight: '500', flex: 1 },

  // Rest patterns
  restRow: { flexDirection: 'row', justifyContent: 'space-around' },
  restItem: { alignItems: 'center', gap: 3 },
  restValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  restLabel: { fontSize: 9, fontWeight: '600' },

  // Exercise frequency
  freqRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, gap: 8 },
  freqRank: { fontSize: 11, fontWeight: '700', width: 16, textAlign: 'center' },
  freqName: { flex: 1, fontSize: 13, fontWeight: '600' },
  freqCount: { fontSize: 13, fontWeight: '800' },

  // Balance score
  balanceRow: { flexDirection: 'row', alignItems: 'baseline' },
  balanceScore: { fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  balanceMax: { fontSize: 16, fontWeight: '600' },
  balanceWorst: { fontSize: 12, fontWeight: '500', marginLeft: 4 },

  // Favorites
  favRow: { flexDirection: 'row', gap: 16 },
  favStat: { fontSize: 14, fontWeight: '700' },

  // Records
  recordRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1 },
  recordLabel: { fontSize: 12, fontWeight: '600' },
  recordValue: { fontSize: 13, fontWeight: '700', textAlign: 'right', flex: 1, marginLeft: 8 },

  // PR timeline
  timelineRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, gap: 8 },
  timelineDate: { fontSize: 10, fontWeight: '600', width: 44 },
  timelineName: { flex: 1, fontSize: 12, fontWeight: '600' },
  timelineValue: { fontSize: 13, fontWeight: '800' },
});
