import React, { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Svg, { Polygon, Line, Circle as SvgCircle } from 'react-native-svg';
import {
  ChevronDown,
  ChevronUp,
  Check,
  Zap,
  Trophy,
  Flame,
  Dumbbell,
  Target,
  Medal,
  Shield,
  Award,
  Crown,
  Footprints,
  HeartPulse,
  Activity,
} from 'lucide-react-native';
import { useDrawerSizing } from '@/components/drawers/useDrawerSizing';
import DrawerHeader from '@/components/drawers/DrawerHeader';
import { useZealTheme, useAppContext } from '@/context/AppContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { showProGate, PRO_GOLD, PRO_LOCKED_OPACITY } from '@/services/proGate';
import { healthService } from '@/services/healthService';
import { Platform } from 'react-native';
import { useWorkoutTracking, type WorkoutLog, type PersonalRecord } from '@/context/WorkoutTrackingContext';
import { WORKOUT_STYLE_COLORS } from '@/constants/colors';

interface Props {
  visible: boolean;
  onClose: () => void;
  onBack?: () => void;
}

type TabKey = 'workouts' | 'time' | 'streak' | 'prs';

interface Milestone {
  id: string;
  name: string;
  description: string;
  target: number;
  type: 'workouts' | 'prs' | 'streak';
  icon: string;
}

const MILESTONES: Milestone[] = [
  { id: 'first5', name: 'First 5', description: 'Complete 5 workouts', target: 5, type: 'workouts', icon: 'zap' },
  { id: 'pr_machine', name: 'PR Machine', description: 'Set 5 personal records', target: 5, type: 'prs', icon: 'trophy' },
  { id: 'first10', name: 'First 10', description: 'Complete 10 workouts', target: 10, type: 'workouts', icon: 'flame' },
  { id: '7day_streak', name: '7-Day Streak', description: 'Keep a 7-day streak', target: 7, type: 'streak', icon: 'flame' },
  { id: 'record_breaker', name: 'Record Breaker', description: 'Set 15 personal records', target: 15, type: 'prs', icon: 'award' },
  { id: 'quarter_century', name: 'Quarter Century', description: 'Complete 25 workouts', target: 25, type: 'workouts', icon: 'medal' },
  { id: 'half_century', name: 'Half Century', description: 'Complete 50 workouts', target: 50, type: 'workouts', icon: 'crown' },
  { id: '30day_streak', name: '30-Day Streak', description: 'Keep a 30-day streak', target: 30, type: 'streak', icon: 'shield' },
  { id: 'century', name: 'Century', description: 'Complete 100 workouts', target: 100, type: 'workouts', icon: 'medal' },
  { id: 'iron_will', name: 'Iron Will', description: 'Train 365 total days', target: 365, type: 'workouts', icon: 'shield' },
];

const CATEGORY_TIPS: Record<string, string> = {
  'Peak Power': 'Improve with HIIT and CrossFit sessions. Explosive movements like cleans, snatches, and box jumps build peak power.',
  'Upper Strength': 'Increase with heavy compound lifts: bench press, overhead press, and weighted pull-ups in Strength sessions.',
  'Upper Endurance': 'Build through high-rep push/pull circuits, Cardio sessions with rowing, and CrossFit metcons.',
  'Lower Endurance': 'Develop with running, cycling, Hyrox training, and high-rep leg circuits.',
  'Aerobic Endurance': 'Improve through Cardio sessions, Hyrox race simulation, and steady-state Zone 2 training.',
  'Lower Strength': 'Grow with heavy squats, deadlifts, and leg press in Strength and Bodybuilding sessions.',
};

function getMilestoneIcon(iconName: string, color: string, size: number) {
  const map: Record<string, React.ReactNode> = {
    zap: <Zap size={size} color={color} />,
    trophy: <Trophy size={size} color={color} />,
    flame: <Flame size={size} color={color} />,
    award: <Award size={size} color={color} />,
    medal: <Medal size={size} color={color} />,
    crown: <Crown size={size} color={color} />,
    shield: <Shield size={size} color={color} />,
    dumbbell: <Dumbbell size={size} color={color} />,
    target: <Target size={size} color={color} />,
  };
  return map[iconName] ?? <Zap size={size} color={color} />;
}

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

function calcRadarValues(history: WorkoutLog[]): Record<string, number> {
  const values: Record<string, number> = {
    'Peak Power': 0,
    'Upper Strength': 0,
    'Upper Endurance': 0,
    'Lower Endurance': 0,
    'Aerobic Endurance': 0,
    'Lower Strength': 0,
  };

  const maxContribution = 100;

  for (const log of history) {
    const style = log.workoutStyle;
    const vol = Math.min(log.totalSets + log.duration / 10, 30);
    const contribution = (vol / 30) * 8;

    if (style === 'Strength' || style === 'Bodybuilding') {
      const split = (log.split || '').toLowerCase();
      if (split.includes('push') || split.includes('upper') || split.includes('full') || split.includes('bro') || split.includes('arnold')) {
        values['Upper Strength'] += contribution;
      }
      if (split.includes('pull') || split.includes('upper') || split.includes('full') || split.includes('bro') || split.includes('arnold')) {
        values['Upper Strength'] += contribution * 0.5;
      }
      if (split.includes('leg') || split.includes('lower') || split.includes('full')) {
        values['Lower Strength'] += contribution;
      }
      if (!split.includes('push') && !split.includes('pull') && !split.includes('leg') && !split.includes('upper') && !split.includes('lower')) {
        values['Upper Strength'] += contribution * 0.5;
        values['Lower Strength'] += contribution * 0.5;
      }
    }

    if (style === 'Cardio') {
      values['Aerobic Endurance'] += contribution * 1.2;
      values['Upper Endurance'] += contribution * 0.4;
      values['Lower Endurance'] += contribution * 0.8;
    }

    if (style === 'HIIT' || style === 'CrossFit') {
      values['Peak Power'] += contribution * 1.2;
      values['Upper Endurance'] += contribution * 0.6;
      values['Lower Endurance'] += contribution * 0.6;
      values['Upper Strength'] += contribution * 0.3;
      values['Lower Strength'] += contribution * 0.3;
    }

    if (style === 'Hyrox') {
      values['Aerobic Endurance'] += contribution;
      values['Upper Endurance'] += contribution * 0.8;
      values['Lower Endurance'] += contribution;
      values['Peak Power'] += contribution * 0.3;
    }

    if (style === 'Mobility' || style === 'Pilates') {
      values['Peak Power'] += contribution * 0.1;
      values['Upper Strength'] += contribution * 0.15;
      values['Upper Endurance'] += contribution * 0.2;
      values['Lower Endurance'] += contribution * 0.2;
      values['Aerobic Endurance'] += contribution * 0.15;
      values['Lower Strength'] += contribution * 0.15;
    }
  }

  for (const key of Object.keys(values)) {
    values[key] = Math.min(maxContribution, Math.round(values[key]));
  }

  return values;
}

function calcTimeBreakdown(weekLogs: WorkoutLog[]): { label: string; percent: number; color: string }[] {
  const groups: Record<string, number> = { Push: 0, Pull: 0, Legs: 0, Core: 0 };
  let total = 0;

  for (const log of weekLogs) {
    const split = (log.split || log.workoutName || '').toLowerCase();
    const dur = log.duration || 1;

    if (split.includes('push') || split.includes('chest') || split.includes('shoulder') || split.includes('tricep')) {
      groups['Push'] += dur;
    } else if (split.includes('pull') || split.includes('back') || split.includes('bicep') || split.includes('row')) {
      groups['Pull'] += dur;
    } else if (split.includes('leg') || split.includes('lower') || split.includes('squat') || split.includes('glute')) {
      groups['Legs'] += dur;
    } else if (split.includes('core') || split.includes('ab')) {
      groups['Core'] += dur;
    } else {
      groups['Push'] += dur * 0.25;
      groups['Pull'] += dur * 0.25;
      groups['Legs'] += dur * 0.35;
      groups['Core'] += dur * 0.15;
    }
    total += dur;
  }

  if (total === 0) return [
    { label: 'Push', percent: 0, color: '#f87116' },
    { label: 'Pull', percent: 0, color: '#3b82f6' },
    { label: 'Legs', percent: 0, color: '#22c55e' },
    { label: 'Core', percent: 0, color: '#a855f7' },
  ];

  return [
    { label: 'Push', percent: Math.round((groups['Push'] / total) * 100), color: '#f87116' },
    { label: 'Pull', percent: Math.round((groups['Pull'] / total) * 100), color: '#3b82f6' },
    { label: 'Legs', percent: Math.round((groups['Legs'] / total) * 100), color: '#22c55e' },
    { label: 'Core', percent: Math.round((groups['Core'] / total) * 100), color: '#a855f7' },
  ];
}

function getMonthCalendarDays(history: WorkoutLog[]): { day: number; hasWorkout: boolean }[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const workoutDates = new Set(history.map(l => l.date));

  const days: { day: number; hasWorkout: boolean }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({ day: d, hasWorkout: workoutDates.has(dateStr) });
  }
  return days;
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
        bestByExercise.set(pr.exerciseName, {
          weight: pr.value,
          reps: existing?.reps ?? 1,
          date: pr.date,
        });
      }
    }
    if (pr.type === 'reps') {
      const existing = bestByExercise.get(pr.exerciseName);
      if (existing) {
        if (pr.value > existing.reps) {
          bestByExercise.set(pr.exerciseName, { ...existing, reps: pr.value });
        }
      } else {
        bestByExercise.set(pr.exerciseName, { weight: 0, reps: pr.value, date: pr.date });
      }
    }
  }

  const results: { exerciseName: string; weight: number; reps: number; e1rm: number; date: string }[] = [];
  bestByExercise.forEach((val, name) => {
    if (val.weight > 0) {
      results.push({
        exerciseName: name,
        weight: val.weight,
        reps: val.reps,
        e1rm: est1RM(val.weight, val.reps),
        date: val.date,
      });
    }
  });

  results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return results;
}

const RADAR_SIZE = 260;
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_RADIUS = 100;
const AXIS_LABELS = ['Peak Power', 'Upper Strength', 'Upper Endurance', 'Lower Endurance', 'Aerobic Endurance', 'Lower Strength'];

function polarToCartesian(angleDeg: number, radius: number): { x: number; y: number } {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: RADAR_CENTER + radius * Math.cos(angleRad),
    y: RADAR_CENTER + radius * Math.sin(angleRad),
  };
}

function RadarChart({ values, colors: themeColors, accent }: { values: Record<string, number>; colors: any; accent: string }) {
  const gridLevels = [0.25, 0.5, 0.75, 1.0];
  const angleStep = 360 / 6;

  const axisPoints = AXIS_LABELS.map((label, i) => {
    const angle = i * angleStep;
    const val = (values[label] ?? 0) / 100;
    return {
      label,
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
        return (
          <Polygon
            key={`grid-${level}`}
            points={pts}
            fill="none"
            stroke={themeColors.border}
            strokeWidth={0.8}
            opacity={0.5}
          />
        );
      })}

      {axisPoints.map((p) => (
        <Line
          key={`axis-${p.label}`}
          x1={RADAR_CENTER}
          y1={RADAR_CENTER}
          x2={p.outer.x}
          y2={p.outer.y}
          stroke={themeColors.border}
          strokeWidth={0.6}
          opacity={0.4}
        />
      ))}

      <Polygon
        points={dataPolygon}
        fill={accent}
        fillOpacity={0.35}
        stroke={accent}
        strokeWidth={2}
      />

      {axisPoints.map((p) => (
        <SvgCircle
          key={`dot-${p.label}`}
          cx={p.data.x}
          cy={p.data.y}
          r={3.5}
          fill={accent}
        />
      ))}
    </Svg>
  );
}

export default function InsightsDrawer({ visible, onClose, onBack }: Props) {
  const { colors, accent, isDark } = useZealTheme();
  const ctx = useAppContext();
  const tracking = useWorkoutTracking();
  const { hasPro, openPaywall } = useSubscription();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const { snapPoints, maxDynamicContentSize, topOffset, scrollEnabled, setContentH } = useDrawerSizing({ minHeight: 480 });

  const [activeTab, setActiveTab] = useState<TabKey>('workouts');
  const [prSectionOpen, setPrSectionOpen] = useState<boolean>(false);
  const [tipAxis, setTipAxis] = useState<string | null>(null);
  const tipAnim = useRef(new Animated.Value(0)).current;

  const [healthSteps, setHealthSteps] = useState<number>(0);
  const [healthCalories, setHealthCalories] = useState<number>(0);
  const [healthHeartRate, setHealthHeartRate] = useState<number | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(false);

  useEffect(() => {
    if (visible) {
      bottomSheetRef.current?.present();
      if (ctx.healthConnected && ctx.healthSyncEnabled && Platform.OS !== 'web') {
        setHealthLoading(true);
        healthService.getAllHealthData().then((data) => {
          setHealthSteps(data.steps);
          setHealthCalories(data.activeCalories);
          setHealthHeartRate(data.restingHeartRate);
          console.log('[InsightsDrawer] Health data:', data);
        }).catch((e) => {
          console.log('[InsightsDrawer] Health data error:', e);
        }).finally(() => {
          setHealthLoading(false);
        });
      }
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible, ctx.healthConnected, ctx.healthSyncEnabled]);

  useEffect(() => {
    Animated.timing(tipAnim, {
      toValue: tipAxis ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [tipAxis, tipAnim]);

  const handleDismiss = useCallback(() => {
    onClose();
  }, [onClose]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.6}
        pressBehavior="close"
      />
    ),
    []
  );

  const displayHistory = useMemo(() => {
    if (hasPro) return tracking.workoutHistory;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    cutoff.setHours(0, 0, 0, 0);
    return tracking.workoutHistory.filter(l => new Date(l.date + 'T00:00:00') >= cutoff);
  }, [hasPro, tracking.workoutHistory]);

  const radarValues = useMemo(() => calcRadarValues(displayHistory), [displayHistory]);

  const weekLogs = useMemo(() => getThisWeekLogs(displayHistory), [displayHistory]);

  const weeklyTime = useMemo(() => {
    const totalMin = weekLogs.reduce((sum, l) => sum + l.duration, 0);
    if (totalMin >= 60) {
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    return `${totalMin}m`;
  }, [weekLogs]);

  const weeklyPRCount = useMemo(() => {
    return weekLogs.reduce((sum, l) => sum + l.prsHit, 0);
  }, [weekLogs]);

  const currentStreak = useMemo(() => {
    const dates = new Set(displayHistory.map(l => l.date));
    if (dates.size === 0) return 0;
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (dates.has(dateStr)) {
        streak++;
      } else {
        if (i === 0) continue;
        break;
      }
    }
    return streak;
  }, [tracking.workoutHistory]);

  const timeBreakdown = useMemo(() => calcTimeBreakdown(weekLogs), [weekLogs]);

  const monthDays = useMemo(() => getMonthCalendarDays(displayHistory), [displayHistory]);

  const uniquePRs = useMemo(() => getUniquePRs(tracking.prHistory), [tracking.prHistory]);

  const milestoneProgress = useMemo(() => {
    const totalWorkouts = displayHistory.length;
    const totalPRs = tracking.prHistory.length;
    const maxStreak = currentStreak;

    return MILESTONES.map(m => {
      let current = 0;
      if (m.type === 'workouts') current = totalWorkouts;
      else if (m.type === 'prs') current = totalPRs;
      else if (m.type === 'streak') current = maxStreak;
      const clamped = Math.min(current, m.target);
      return { ...m, current: clamped, completed: clamped >= m.target };
    });
  }, [tracking.workoutHistory.length, tracking.prHistory.length, currentStreak]);

  const handleAxisTap = useCallback((label: string) => {
    setTipAxis(prev => (prev === label ? null : label));
  }, []);

  const handleTabPress = useCallback((tab: TabKey) => {
    setActiveTab(tab);
  }, []);

  const togglePrSection = useCallback(() => {
    setPrSectionOpen(prev => !prev);
  }, []);

  const formatDate = useCallback((dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  }, []);

  const formatDayName = useCallback((dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  }, []);

  const tabData: { key: TabKey; label: string; value: string }[] = useMemo(() => [
    { key: 'workouts', label: 'WORKOUTS', value: `${weekLogs.length}` },
    { key: 'time', label: 'TIME', value: weeklyTime },
    { key: 'streak', label: 'STREAK', value: `${currentStreak}d` },
    { key: 'prs', label: 'PRs', value: weeklyPRCount > 0 ? `+${weeklyPRCount}` : '-' },
  ], [weekLogs.length, weeklyTime, currentStreak, weeklyPRCount]);

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      maxDynamicContentSize={maxDynamicContentSize}
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      backgroundStyle={[styles.sheetBg, { backgroundColor: colors.background }]}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
      enablePanDownToClose
      enableOverDrag={false}
      topInset={topOffset}
      stackBehavior="push"
    >
      <DrawerHeader
        title="Insights"
        onBack={onBack}
        onClose={onBack ? undefined : onClose}
      />

      <BottomSheetScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        scrollEnabled={scrollEnabled}
        contentContainerStyle={styles.scrollContent}
        onContentSizeChange={(_w: number, h: number) => setContentH(h)}
      >
        {!hasPro && (
          <TouchableOpacity
            style={[styles.historyBanner, { backgroundColor: `${PRO_GOLD}10`, borderColor: `${PRO_GOLD}25` }]}
            onPress={() => showProGate('history', openPaywall)}
            activeOpacity={0.8}
            testID="insights-history-banner"
          >
            <Crown size={14} color={PRO_GOLD} strokeWidth={1.8} />
            <Text style={styles.historyBannerText}>Showing last 7 days — upgrade for full history</Text>
            <Text style={styles.historyBannerArrow}>→</Text>
          </TouchableOpacity>
        )}

        <View style={[styles.radarSection, { backgroundColor: colors.card, borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>PERFORMANCE PROFILE</Text>

          <View style={styles.radarWrapper}>
            <View style={[styles.radarContainer, !hasPro && { opacity: PRO_LOCKED_OPACITY }]}>
              <RadarChart values={radarValues} colors={colors} accent={accent} />

              {AXIS_LABELS.map((label, i) => {
                const angle = i * 60;
                const labelRadius = RADAR_RADIUS + 28;
                const pos = polarToCartesian(angle, labelRadius);
                const val = radarValues[label] ?? 0;
                return (
                  <TouchableOpacity
                    key={label}
                    style={[
                      styles.axisLabel,
                      {
                        left: pos.x - 40,
                        top: pos.y - 14,
                      },
                    ]}
                    onPress={() => hasPro ? handleAxisTap(label) : showProGate('insights', openPaywall)}
                    activeOpacity={0.6}
                    testID={`radar-axis-${i}`}
                  >
                    <Text style={[styles.axisLabelText, { color: colors.text }]} numberOfLines={2}>
                      {label}
                    </Text>
                    <Text style={[styles.axisValueText, { color: colors.textSecondary }]}>
                      {val}%
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {!hasPro && (
              <TouchableOpacity
                style={styles.radarOverlay}
                onPress={() => showProGate('insights', openPaywall)}
                activeOpacity={0.9}
                testID="radar-pro-overlay"
              >
                <View style={styles.radarLockBadge}>
                  <Crown size={20} color={PRO_GOLD} strokeWidth={1.5} />
                  <Text style={styles.radarLockSub}>Performance Profile</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {hasPro && (
            <Text style={[styles.tipHint, { color: colors.textMuted }]}>Tap a category for tips</Text>
          )}

          {hasPro && tipAxis && (
            <Animated.View style={[styles.tipCard, { backgroundColor: colors.cardSecondary, opacity: tipAnim }]}>
              <Text style={[styles.tipTitle, { color: accent }]}>{tipAxis}</Text>
              <Text style={[styles.tipText, { color: colors.textSecondary }]}>
                {CATEGORY_TIPS[tipAxis] ?? ''}
              </Text>
            </Animated.View>
          )}
        </View>

        <View style={[styles.tabsSection, { backgroundColor: colors.card, borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary, paddingHorizontal: 16, paddingTop: 16 }]}>THIS WEEK</Text>

          <View style={styles.tabRow}>
            {tabData.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.tabItem,
                    isActive && { borderBottomWidth: 2, borderBottomColor: '#3b82f6' },
                  ]}
                  onPress={() => handleTabPress(tab.key)}
                  activeOpacity={0.7}
                  testID={`tab-${tab.key}`}
                >
                  <Text style={[styles.tabValue, { color: isActive ? colors.text : colors.textMuted }]}>
                    {tab.value}
                  </Text>
                  <Text style={[styles.tabLabel, { color: isActive ? '#3b82f6' : colors.textMuted }]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.tabContent}>
            {activeTab === 'workouts' && (
              <View style={styles.workoutsList}>
                {weekLogs.length === 0 ? (
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>No workouts logged this week.</Text>
                ) : (
                  weekLogs.map((log) => {
                    const styleColor = WORKOUT_STYLE_COLORS[log.workoutStyle] ?? '#f87116';
                    return (
                      <View key={log.id} style={[styles.workoutRow, { borderBottomColor: colors.border }]}>
                        <View style={styles.workoutRowLeft}>
                          <Text style={[styles.workoutDate, { color: colors.text }]}>
                            {formatDayName(log.date)}
                          </Text>
                          <View style={styles.workoutMeta}>
                            <View style={[styles.styleBadge, { backgroundColor: `${styleColor}22` }]}>
                              <View style={[styles.styleDot, { backgroundColor: styleColor }]} />
                              <Text style={[styles.styleBadgeText, { color: styleColor }]}>{log.workoutStyle}</Text>
                            </View>
                            <Text style={[styles.workoutExCount, { color: colors.textSecondary }]}>
                              {log.exercises.length} exercises
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.workoutDuration, { color: colors.textSecondary }]}>{log.duration} min</Text>
                      </View>
                    );
                  })
                )}
              </View>
            )}

            {activeTab === 'time' && (
              <View style={styles.timeBreakdown}>
                {timeBreakdown.map((item) => (
                  <View key={item.label} style={styles.timeRow}>
                    <View style={styles.timeRowHeader}>
                      <Text style={[styles.timeLabel, { color: colors.text }]}>{item.label}</Text>
                      <Text style={[styles.timePercent, { color: colors.textSecondary }]}>{item.percent}%</Text>
                    </View>
                    <View style={[styles.timeBarTrack, { backgroundColor: colors.border }]}>
                      <View style={[styles.timeBarFill, { width: `${Math.max(item.percent, 1)}%` as any, backgroundColor: item.color }]} />
                    </View>
                  </View>
                ))}
              </View>
            )}

            {activeTab === 'streak' && (
              <View style={styles.streakContent}>
                <Text style={[styles.streakNumber, { color: colors.text }]}>{currentStreak}</Text>
                <Text style={[styles.streakLabel, { color: colors.textSecondary }]}>day streak</Text>

                <View style={styles.monthGrid}>
                  {monthDays.map((day) => (
                    <View key={day.day} style={styles.monthDayCell}>
                      <View
                        style={[
                          styles.monthDayDot,
                          day.hasWorkout
                            ? { backgroundColor: accent }
                            : { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
                        ]}
                      />
                      <Text style={[styles.monthDayText, { color: colors.textMuted }]}>{day.day}</Text>
                    </View>
                  ))}
                </View>

                <Text style={[styles.streakRule, { color: colors.textMuted }]}>
                  Miss 3 consecutive days to break streak.
                </Text>
              </View>
            )}

            {activeTab === 'prs' && (
              <View style={styles.prsList}>
                {uniquePRs.length === 0 ? (
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>No personal records yet.</Text>
                ) : (
                  uniquePRs.slice(0, 10).map((pr, i) => (
                    <View key={`${pr.exerciseName}-${i}`} style={[styles.prRow, { borderBottomColor: colors.border }]}>
                      <View style={styles.prRowLeft}>
                        <Text style={[styles.prName, { color: colors.text }]}>{pr.exerciseName}</Text>
                        <Text style={[styles.prDetail, { color: colors.textSecondary }]}>
                          {pr.reps} reps {'\u00B7'} {pr.weight} lb
                        </Text>
                      </View>
                      <View style={styles.prRowRight}>
                        <Text style={[styles.prE1rm, { color: accent }]}>~{pr.e1rm} lb</Text>
                        <Text style={[styles.prE1rmLabel, { color: colors.textMuted }]}>est. 1 rep max</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.prSectionHeader, { backgroundColor: colors.card, borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}
          onPress={togglePrSection}
          activeOpacity={0.7}
          testID="pr-section-toggle"
        >
          <Text style={[styles.prSectionTitle, { color: colors.textSecondary }]}>
            PERSONAL RECORDS ({uniquePRs.length})
          </Text>
          {prSectionOpen ? (
            <ChevronUp size={18} color={colors.textSecondary} />
          ) : (
            <ChevronDown size={18} color={colors.textSecondary} />
          )}
        </TouchableOpacity>

        {prSectionOpen && (
          <View style={[styles.prSectionBody, { backgroundColor: colors.card, borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
            {uniquePRs.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textMuted, padding: 20 }]}>No personal records yet.</Text>
            ) : (
              uniquePRs.map((pr, i) => (
                <View key={`all-pr-${pr.exerciseName}-${i}`} style={[styles.prRow, { borderBottomColor: colors.border }]}>
                  <View style={styles.prRowLeft}>
                    <Text style={[styles.prName, { color: colors.text }]}>{pr.exerciseName}</Text>
                    <Text style={[styles.prDetail, { color: colors.textSecondary }]}>
                      {pr.reps} reps {'\u00B7'} {pr.weight} lb {'\u00B7'} {formatDate(pr.date)}
                    </Text>
                  </View>
                  <View style={styles.prRowRight}>
                    <Text style={[styles.prE1rm, { color: accent }]}>~{pr.e1rm} lb</Text>
                    <Text style={[styles.prE1rmLabel, { color: colors.textMuted }]}>est. 1 rep max</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        <View style={[styles.milestonesSection, { backgroundColor: colors.card, borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary, paddingHorizontal: 16, paddingTop: 16 }]}>MILESTONES</Text>

          {milestoneProgress.map((m) => {
            const progress = m.target > 0 ? m.current / m.target : 0;
            return (
              <View key={m.id} style={[styles.milestoneRow, { borderBottomColor: colors.border }]}>
                <View style={[styles.milestoneIcon, { backgroundColor: m.completed ? `${accent}22` : colors.cardSecondary }]}>
                  {m.completed ? (
                    <Check size={18} color={accent} />
                  ) : (
                    getMilestoneIcon(m.icon, m.completed ? accent : colors.textMuted, 18)
                  )}
                </View>
                <View style={styles.milestoneInfo}>
                  <View style={styles.milestoneTop}>
                    <View style={styles.milestoneTextGroup}>
                      <Text style={[styles.milestoneName, { color: m.completed ? accent : colors.text }]}>{m.name}</Text>
                      <Text style={[styles.milestoneDesc, { color: colors.textSecondary }]}>{m.description}</Text>
                    </View>
                    <Text style={[styles.milestoneCount, { color: m.completed ? accent : colors.textMuted }]}>
                      {m.current}/{m.target}
                    </Text>
                  </View>
                  <View style={[styles.milestoneBarTrack, { backgroundColor: colors.border }]}>
                    <View
                      style={[
                        styles.milestoneBarFill,
                        {
                          width: `${Math.min(progress * 100, 100)}%` as any,
                          backgroundColor: m.completed ? accent : `${accent}88`,
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {ctx.healthConnected && ctx.healthSyncEnabled && Platform.OS !== 'web' && (
          <View style={[styles.healthSection, { backgroundColor: colors.card, borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
            <View style={styles.healthHeader}>
              <HeartPulse size={14} color="#ef4444" strokeWidth={2} />
              <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginBottom: 0 }]}>
                {Platform.OS === 'ios' ? 'APPLE HEALTH — TODAY' : 'HEALTH CONNECT — TODAY'}
              </Text>
            </View>
            <View style={styles.healthCards}>
              <View style={[styles.healthCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
                <Footprints size={20} color="#3b82f6" strokeWidth={1.8} />
                <Text style={[styles.healthValue, { color: colors.text }]}>
                  {healthLoading ? '—' : healthSteps.toLocaleString()}
                </Text>
                <Text style={[styles.healthLabel, { color: colors.textSecondary }]}>Steps</Text>
              </View>
              <View style={[styles.healthCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
                <Activity size={20} color="#f87116" strokeWidth={1.8} />
                <Text style={[styles.healthValue, { color: colors.text }]}>
                  {healthLoading ? '—' : `${healthCalories}`}
                </Text>
                <Text style={[styles.healthLabel, { color: colors.textSecondary }]}>Cal Burned</Text>
              </View>
              <View style={[styles.healthCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
                <HeartPulse size={20} color="#ef4444" strokeWidth={1.8} />
                <Text style={[styles.healthValue, { color: colors.text }]}>
                  {healthLoading ? '—' : healthHeartRate !== null ? `${healthHeartRate}` : '—'}
                </Text>
                <Text style={[styles.healthLabel, { color: colors.textSecondary }]}>Resting BPM</Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 60 }} />
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetBg: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
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
  closeBtn: {
    padding: 4,
    marginTop: 4,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 20,
  },
  radarSection: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  historyBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  historyBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#f5c842',
  },
  historyBannerArrow: {
    fontSize: 14,
    color: '#f5c842',
    fontWeight: '700' as const,
  },
  radarWrapper: {
    position: 'relative' as const,
    alignSelf: 'center' as const,
  },
  radarContainer: {
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    alignSelf: 'center',
    position: 'relative',
  },
  radarBlurred: {
    opacity: 0.18,
  },
  radarOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  radarLockBadge: {
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: 'rgba(12,12,15,0.85)',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  radarLockSub: {
    fontSize: 12,
    color: '#aaa',
    textAlign: 'center' as const,
    fontWeight: '600' as const,
  },
  axisLabel: {
    position: 'absolute',
    width: 80,
    alignItems: 'center',
  },
  axisLabelText: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 13,
  },
  axisValueText: {
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  tipHint: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
  tipCard: {
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    width: '100%',
  },
  tipTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  tipText: {
    fontSize: 12,
    lineHeight: 18,
  },
  tabsSection: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.15)',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    gap: 2,
  },
  tabValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  tabContent: {
    minHeight: 100,
  },
  workoutsList: {
    paddingVertical: 4,
  },
  workoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  workoutRowLeft: {
    flex: 1,
    gap: 4,
  },
  workoutDate: {
    fontSize: 14,
    fontWeight: '700',
  },
  workoutMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  styleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  styleDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  styleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  workoutExCount: {
    fontSize: 11,
  },
  workoutDuration: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 30,
  },
  timeBreakdown: {
    padding: 16,
    gap: 14,
  },
  timeRow: {
    gap: 6,
  },
  timeRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  timePercent: {
    fontSize: 13,
    fontWeight: '600',
  },
  timeBarTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  timeBarFill: {
    height: '100%',
    borderRadius: 4,
    minWidth: 4,
  },
  streakContent: {
    alignItems: 'center',
    padding: 20,
    gap: 8,
  },
  streakNumber: {
    fontSize: 56,
    fontWeight: '800',
    letterSpacing: -2,
    lineHeight: 60,
  },
  streakLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  monthDayCell: {
    alignItems: 'center',
    width: 30,
    gap: 3,
  },
  monthDayDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  monthDayText: {
    fontSize: 8,
    fontWeight: '600',
  },
  streakRule: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 10,
  },
  prsList: {
    paddingVertical: 4,
  },
  prRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  prRowLeft: {
    flex: 1,
    gap: 2,
  },
  prName: {
    fontSize: 14,
    fontWeight: '700',
  },
  prDetail: {
    fontSize: 11,
  },
  prRowRight: {
    alignItems: 'flex-end',
    gap: 1,
  },
  prE1rm: {
    fontSize: 16,
    fontWeight: '800',
  },
  prE1rmLabel: {
    fontSize: 9,
    fontWeight: '600',
  },
  prSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  prSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  prSectionBody: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: -4,
  },
  milestonesSection: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    paddingBottom: 4,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  milestoneIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneInfo: {
    flex: 1,
    gap: 8,
  },
  milestoneTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  milestoneTextGroup: {
    flex: 1,
    gap: 1,
  },
  milestoneName: {
    fontSize: 14,
    fontWeight: '700',
  },
  milestoneDesc: {
    fontSize: 11,
  },
  milestoneCount: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
  },
  milestoneBarTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  milestoneBarFill: {
    height: '100%',
    borderRadius: 3,
    minWidth: 2,
  },
  healthSection: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  healthHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  healthCards: {
    flexDirection: 'row' as const,
    gap: 10,
  },
  healthCard: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center' as const,
    gap: 6,
  },
  healthValue: {
    fontSize: 22,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  healthLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    letterSpacing: 0.4,
    textAlign: 'center' as const,
  },
});
