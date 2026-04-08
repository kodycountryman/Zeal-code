import React, { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Keyboard,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme, useAppContext } from '@/context/AppContext';
import DrawerHeader from '@/components/drawers/DrawerHeader';
import {
  getMetricDef,
  resolveMetricValue,
  type MetricSlotKey,
  type MetricSlotInput,
} from '@/constants/metricSlots';

interface Props {
  visible: boolean;
  slotIndex: number | null;
  metricKey: MetricSlotKey | null;
  slotInput: MetricSlotInput;
  onClose: () => void;
  /** Opens the picker for this slot (Change button) */
  onChangeMetric: (slotIndex: number) => void;
}

// Per-metric "how it's calculated" copy
const METRIC_EXPLAINER: Partial<Record<MetricSlotKey, string>> = {
  streak: 'A streak counts the number of consecutive days you\'ve logged a workout. Missing a day resets it to zero.',
  weeklyHours: 'Total active training time logged this calendar week (Sun–Sat), displayed in hours once you\'ve exceeded 60 minutes.',
  sessionsThisWeek: 'The number of workouts you\'ve completed since the start of this calendar week (Sunday).',
  target: 'Your weekly session goal. The target number is set in your profile. Green when you hit it.',
  prsThisMonth: 'Any exercise where you logged a new best performance this calendar month. PRs are counted per exercise.',
  avgDuration: 'Mean workout length across all sessions you\'ve ever logged in Zeal.',
  volumeThisWeek: 'Total weight moved this week — sets × reps × weight across every logged exercise. Displayed in lbs.',
  caloriesToday: 'Active calories burned today, pulled directly from Apple Health or Health Connect. Requires permission.',
  stepsToday: 'Total step count for today from your device\'s motion sensor via Apple Health or Health Connect.',
  restingBpm: 'Your resting heart rate as reported by Apple Health or Health Connect. Typically averaged over the past night.',
  longestStreak: 'The longest unbroken chain of consecutive training days you\'ve ever achieved in Zeal. A personal record of consistency.',
  exercisesThisWeek: 'The number of unique exercises you\'ve performed across all workouts logged this calendar week (Sun–Sat).',
  consistencyPct: 'Sessions completed vs your weekly target over the last 28 days. 100% means you hit your target every single week.',
  restingHeartRate: 'Your resting heart rate as reported by Apple Health or Health Connect. Lower values typically indicate better cardiovascular fitness.',
  bodyWeight: 'Your current logged body weight in lbs. Tap "Update" to enter a new reading — this syncs to your profile.',
};

// Per-metric "context" tip shown below the big value
const METRIC_CONTEXT: Partial<Record<MetricSlotKey, (input: MetricSlotInput) => string | null>> = {
  streak: (d) => {
    if (d.streak === 0) return 'Log your first workout to start a streak.';
    if (d.streak < 3) return 'You\'re building momentum — keep it going.';
    if (d.streak < 7) return 'A great habit is forming. Don\'t break the chain.';
    return `${d.streak} days in a row. That\'s elite consistency.`;
  },
  weeklyHours: (d) => {
    const hrs = d.weeklyHoursMin / 60;
    if (hrs < 1) return 'Even short sessions add up — aim for 3–5 hrs weekly.';
    if (hrs < 3) return 'On track. Most goals are met with 3–5 hrs per week.';
    return 'Strong training volume. Make sure recovery keeps pace.';
  },
  sessionsThisWeek: (d) => {
    const sessions = d.workoutHistory.filter((l) => {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      return new Date(l.date) >= weekStart;
    }).length;
    if (sessions === 0) return 'No sessions yet this week. Start today.';
    if (sessions === 1) return 'One session down. Consistency is the goal.';
    return `${sessions} sessions this week. Strong work.`;
  },
  target: (d) => {
    const done = Math.min(d.targetDone, d.targetTotal);
    const remaining = d.targetTotal - done;
    if (remaining <= 0) return '🎯 Weekly target hit! Great consistency.';
    if (remaining === 1) return 'One session away from your weekly target.';
    return `${remaining} more session${remaining > 1 ? 's' : ''} to reach your goal this week.`;
  },
  prsThisMonth: (d) => {
    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const count = d.workoutHistory
      .filter((l) => l.date.startsWith(prefix))
      .reduce((s, l) => s + (l.prsHit ?? 0), 0);
    if (count === 0) return 'No PRs yet this month. Push the limits on your next session.';
    if (count === 1) return 'One PR this month — the first one is always the hardest.';
    return `${count} PRs this month. You\'re getting stronger.`;
  },
  avgDuration: (d) => {
    if (d.workoutHistory.length === 0) return null;
    const avg = Math.round(d.workoutHistory.reduce((s, l) => s + l.duration, 0) / d.workoutHistory.length);
    if (avg < 20) return 'Short and sharp — great for HIIT and minimalist training.';
    if (avg < 45) return 'Solid session length for most training goals.';
    return 'Long sessions — make sure intensity matches duration.';
  },
  volumeThisWeek: () => 'Progressive overload over time is the primary driver of muscle and strength gains.',
  caloriesToday: (d) => {
    if (!d.healthConnected) return null;
    if (d.calories === null || d.calories === 0) return 'No activity recorded yet today.';
    if (d.calories < 300) return 'Light activity day — great for active recovery.';
    if (d.calories < 600) return 'Solid burn. You\'re staying active.';
    return 'High output day. Fuel well and recover.';
  },
  stepsToday: (d) => {
    if (!d.healthConnected) return null;
    if (d.steps === null || d.steps === 0) return 'Start moving — every step counts.';
    if (d.steps < 5000) return 'Below average — aim for 7,500–10,000 steps for general health.';
    if (d.steps < 10000) return 'Good daily movement. Close to the 10k mark.';
    return '10k+ steps. Excellent non-exercise activity.';
  },
  restingBpm: (d) => {
    if (!d.healthConnected) return null;
    if (d.heartRate === null) return 'No heart rate data available yet.';
    if (d.heartRate < 50) return 'Athletic resting HR. Your cardiovascular fitness is excellent.';
    if (d.heartRate < 60) return 'Very good resting HR. Well-conditioned cardiovascular system.';
    if (d.heartRate < 70) return 'Normal resting HR. Consistent training can lower this over time.';
    return 'Slightly elevated. Sleep, hydration, and stress can all affect resting HR.';
  },
  longestStreak: (d) => {
    if (d.longestStreakDays === 0) return 'Log your first workout to start building your all-time streak record.';
    if (d.longestStreakDays < 7) return 'Keep going — a 7-day streak is your next milestone.';
    if (d.longestStreakDays < 30) return `${d.longestStreakDays} days is solid. Can you break a 30-day record?`;
    return `${d.longestStreakDays} days is elite-level consistency. Impressive.`;
  },
  exercisesThisWeek: (d) => {
    if (d.exercisesThisWeekCount === 0) return 'No movements logged yet this week. Start your first session.';
    if (d.exercisesThisWeekCount < 10) return 'Building variety. More exercises means broader muscle stimulus.';
    if (d.exercisesThisWeekCount < 20) return 'Good movement variety this week.';
    return `${d.exercisesThisWeekCount} unique movements. High-volume training week.`;
  },
  consistencyPct: (d) => {
    if (d.consistencyPct === 0) return 'No sessions logged in the last 4 weeks. Your journey starts now.';
    if (d.consistencyPct < 50) return 'Below target. Small improvements in consistency compound fast.';
    if (d.consistencyPct < 80) return 'Making progress. Aim to hit your target every week.';
    if (d.consistencyPct < 100) return 'Strong consistency. You\'re close to a perfect run.';
    return '100% — you\'ve hit your target every week for a month. Elite.';
  },
  restingHeartRate: (d) => {
    if (!d.healthConnected) return null;
    if (d.heartRate === null) return 'No heart rate data available yet.';
    if (d.heartRate < 50) return 'Athletic resting HR. Your cardiovascular fitness is excellent.';
    if (d.heartRate < 60) return 'Very good resting HR. Well-conditioned cardiovascular system.';
    if (d.heartRate < 70) return 'Normal resting HR. Consistent training can lower this over time.';
    return 'Slightly elevated. Sleep, hydration, and stress can all affect resting HR.';
  },
  bodyWeight: (d) => {
    if (d.bodyWeight === null) return 'No weight logged yet. Tap "Update Weight" to add your current weight.';
    return 'Tracking body weight over time helps measure progress toward your physique goals.';
  },
};

export default function MetricDetailSheet({
  visible,
  slotIndex,
  metricKey,
  slotInput,
  onClose,
  onChangeMetric,
}: Props) {
  const { colors, accent, isDark } = useZealTheme();
  const { setWeight } = useAppContext();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const topOffset = Math.max(insets.top, 0) + 16;
  const { height: windowH } = useWindowDimensions();

  // Body weight editing state
  const [editingWeight, setEditingWeight] = useState(false);
  const [weightInput, setWeightInput] = useState('');

  const snapPoints = useMemo(() => {
    return [Math.min(Math.round(windowH * 0.6), 520)];
  }, [windowH]);

  useEffect(() => {
    if (visible && slotIndex !== null && metricKey !== null) {
      // Reset weight editing when opening
      setEditingWeight(false);
      setWeightInput(slotInput.bodyWeight !== null ? String(slotInput.bodyWeight) : '');
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible, slotIndex, metricKey]);

  const handleDismiss = useCallback(() => {
    setEditingWeight(false);
    onClose();
  }, [onClose]);

  const handleSaveWeight = useCallback(() => {
    const parsed = parseFloat(weightInput);
    if (!isNaN(parsed) && parsed > 0) {
      setWeight(Math.round(parsed));
    }
    Keyboard.dismiss();
    setEditingWeight(false);
  }, [weightInput, setWeight]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.55}
        pressBehavior="close"
      />
    ),
    [],
  );

  const def = metricKey ? (getMetricDef(metricKey) ?? null) : null;
  const resolved = metricKey ? resolveMetricValue(metricKey, slotInput) : null;
  const explainer = metricKey ? (METRIC_EXPLAINER[metricKey] ?? null) : null;
  const contextFn = metricKey ? (METRIC_CONTEXT[metricKey] ?? null) : null;
  const contextText = contextFn ? contextFn(slotInput) : null;

  const dividerColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const surfaceBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';

  if (!def || !resolved) return null;

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      backgroundStyle={[styles.sheetBg, { backgroundColor: colors.card }]}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
      enablePanDownToClose
      enableOverDrag={false}
      topInset={topOffset}
      stackBehavior="push"
    >
      <BottomSheetView style={[styles.container, { paddingBottom: insets.bottom + 20 }]}>
        <DrawerHeader
          title={def.label}
          onClose={onClose}
          rightContent={
            slotIndex !== null ? (
              <TouchableOpacity
                style={[styles.changeBtn, { borderColor: dividerColor }]}
                onPress={() => {
                  onClose();
                  // Small delay so the detail sheet closes before picker opens
                  setTimeout(() => onChangeMetric(slotIndex), 200);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.changeBtnText, { color: colors.textSecondary }]}>Change</Text>
              </TouchableOpacity>
            ) : undefined
          }
        />

        {/* Big value display */}
        <View style={[styles.valueCard, { backgroundColor: surfaceBg }]}>
          <View style={[styles.iconCircle, { backgroundColor: `${accent}20` }]}>
            <PlatformIcon
              name={def.icon as any}
              size={22}
              color={resolved.needsHealth ? colors.textSecondary : accent}
              strokeWidth={1.8}
            />
          </View>

          {resolved.needsHealth ? (
            <View style={styles.needsHealthBlock}>
              <Text style={[styles.bigValue, { color: colors.textSecondary }]}>—</Text>
              <TouchableOpacity
                style={[styles.connectBtn, { backgroundColor: accent }]}
                activeOpacity={0.8}
              >
                <PlatformIcon name="heart-pulse" size={12} color="#fff" />
                <Text style={styles.connectBtnText}>Connect Health</Text>
              </TouchableOpacity>
            </View>
          ) : metricKey === 'bodyWeight' ? (
            <View style={styles.weightBlock}>
              {editingWeight ? (
                <View style={styles.weightEditRow}>
                  <TextInput
                    style={[styles.weightInput, {
                      color: colors.text,
                      borderColor: accent,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    }]}
                    value={weightInput}
                    onChangeText={setWeightInput}
                    keyboardType="decimal-pad"
                    placeholder="lbs"
                    placeholderTextColor={colors.textSecondary}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={handleSaveWeight}
                  />
                  <TouchableOpacity
                    style={[styles.saveWeightBtn, { backgroundColor: accent }]}
                    onPress={handleSaveWeight}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.saveWeightBtnText}>Save</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={styles.valueBlock}>
                    <Text style={[styles.bigValue, { color: colors.text }]}>{resolved.value}</Text>
                    <Text style={[styles.bigUnit, { color: colors.textSecondary }]}>{resolved.unit}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.updateWeightBtn, { borderColor: accent }]}
                    onPress={() => {
                      setWeightInput(slotInput.bodyWeight !== null ? String(slotInput.bodyWeight) : '');
                      setEditingWeight(true);
                    }}
                    activeOpacity={0.75}
                  >
                    <PlatformIcon name="pencil" size={11} color={accent} strokeWidth={2} />
                    <Text style={[styles.updateWeightBtnText, { color: accent }]}>Update Weight</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : (
            <View style={styles.valueBlock}>
              <Text style={[styles.bigValue, { color: colors.text }]}>{resolved.value}</Text>
              <Text style={[styles.bigUnit, { color: colors.textSecondary }]}>{resolved.unit}</Text>
            </View>
          )}
        </View>

        {/* Context tip */}
        {contextText && (
          <View style={[styles.contextRow, { backgroundColor: `${accent}14`, borderColor: `${accent}28` }]}>
            <PlatformIcon name="zap" size={12} color={accent} fill={accent} />
            <Text style={[styles.contextText, { color: colors.text }]}>{contextText}</Text>
          </View>
        )}

        {/* How it's calculated */}
        {explainer && (
          <View style={[styles.explainerBlock, { borderColor: dividerColor }]}>
            <View style={styles.explainerHeader}>
              <PlatformIcon name="info" size={12} color={colors.textSecondary} />
              <Text style={[styles.explainerLabel, { color: colors.textSecondary }]}>HOW THIS IS CALCULATED</Text>
            </View>
            <Text style={[styles.explainerBody, { color: colors.textSecondary }]}>{explainer}</Text>
          </View>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetBg: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  container: {
    paddingHorizontal: 20,
    gap: 14,
  },
  changeBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  changeBtnText: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
    letterSpacing: 0,
  },
  valueCard: {
    borderRadius: 18,
    paddingVertical: 22,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueBlock: {
    gap: 2,
  },
  needsHealthBlock: {
    gap: 10,
  },
  bigValue: {
    fontSize: 38,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -2,
    lineHeight: 42,
  },
  bigUnit: {
    fontSize: 13,
    fontFamily: 'Outfit_400Regular',
    letterSpacing: 0.1,
  },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  connectBtnText: {
    fontSize: 13,
    fontFamily: 'Outfit_600SemiBold',
    color: '#fff',
    letterSpacing: 0,
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  contextText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Outfit_400Regular',
    lineHeight: 19,
    letterSpacing: 0.1,
  },
  explainerBlock: {
    borderTopWidth: 1,
    paddingTop: 14,
    gap: 8,
  },
  explainerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  explainerLabel: {
    fontSize: 9,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.9,
  },
  explainerBody: {
    fontSize: 13,
    fontFamily: 'Outfit_400Regular',
    lineHeight: 19,
    letterSpacing: 0.1,
  },
  weightBlock: {
    flex: 1,
    gap: 10,
  },
  weightEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  weightInput: {
    flex: 1,
    fontSize: 32,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -1,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  saveWeightBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveWeightBtnText: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
    color: '#fff',
    letterSpacing: 0,
  },
  updateWeightBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  updateWeightBtnText: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
    letterSpacing: 0,
  },
});
