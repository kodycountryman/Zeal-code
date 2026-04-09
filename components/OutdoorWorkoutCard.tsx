import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { PlatformIcon } from '@/components/PlatformIcon';
import GlassCard from '@/components/GlassCard';
import { useZealTheme } from '@/context/AppContext';
import { useSeventyFiveHard } from '@/context/SeventyFiveHardContext';
import {
  OUTDOOR_ACTIVITIES,
  OUTDOOR_DURATION_OPTIONS,
  type OutdoorActivity,
} from '@/services/seventyFiveHardTypes';

interface Props {
  variant: 'glass' | 'solid';
}

const GOLD = '#f87116';
const LIGHT = '#d1d5db';
const GREEN = '#22c55e';

const ACTIVITY_ICONS: Record<string, string> = {
  Walk: 'footprints',
  Run: 'zap',
  Hike: 'mountain',
  Bike: 'bike',
  Swim: 'waves',
  Sport: 'trophy',
  Yoga: 'person-standing',
  Other: 'ellipsis',
};

type Mode = 'choice' | 'timer' | 'manual' | 'log';

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function OutdoorWorkoutCard({ variant }: Props) {
  const { colors } = useZealTheme();
  const { todayChecklist, state, setOutdoorConfig, markOutdoorComplete, unmarkOutdoorComplete } = useSeventyFiveHard();

  const [selectedActivity, setSelectedActivity] = useState<OutdoorActivity | null>(
    state?.outdoor2Config?.activity ?? null
  );
  const [selectedDuration, setSelectedDuration] = useState<number>(
    state?.outdoor2Config?.duration ?? 45
  );
  const [mode, setMode] = useState<Mode | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [logDistance, setLogDistance] = useState('');
  const [logHeartRate, setLogHeartRate] = useState('');
  const [logCalories, setLogCalories] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isComplete = todayChecklist.workout2Complete;
  const isConfigured = !!state?.outdoor2Config;

  // Clean up interval on unmount
  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const handleSelectActivity = (act: OutdoorActivity) => {
    setSelectedActivity(act);
    setMode('choice');
    Haptics.selectionAsync().catch(() => {});
  };

  const handleStartTimer = () => {
    setElapsed(0);
    setMode('timer');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    intervalRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
  };

  const handleStopTimer = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    const minutes = Math.max(1, Math.round(elapsed / 60));
    setSelectedDuration(minutes);
    setMode('log');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  const handleAlreadyDone = () => {
    setMode('manual');
    Haptics.selectionAsync().catch(() => {});
  };

  const handleConfirmActivity = () => {
    if (!selectedActivity) return;
    setMode('log');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const handleLogComplete = () => {
    if (!selectedActivity) return;
    setOutdoorConfig(selectedActivity, selectedDuration);
    markOutdoorComplete();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const handleMarkComplete = () => {
    markOutdoorComplete();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const handleUnlog = () => {
    Alert.alert(
      'Remove Outdoor Workout?',
      'This will unmark your second workout for today.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
            unmarkOutdoorComplete();
            setSelectedActivity(null);
            setSelectedDuration(45);
            setMode(null);
            setElapsed(0);
            setLogDistance('');
            setLogHeartRate('');
            setLogCalories('');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          },
        },
      ],
    );
  };

  // ── Completed state ──
  if (isComplete) {
    return (
      <GlassCard style={[styles.card, { borderColor: `${GREEN}30`, borderWidth: 1 }]} variant={variant}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={[styles.iconCircle, { backgroundColor: `${GREEN}25` }]}>
              <PlatformIcon name="check" size={16} color={GREEN} strokeWidth={3} />
            </View>
            <View>
              <Text style={[styles.title, { color: GREEN }]}>Outdoor Workout</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {state?.outdoor2Config?.activity ?? 'Activity'} · {state?.outdoor2Config?.duration ?? 45} min
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleUnlog} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.6}>
            <PlatformIcon name="rotate-ccw" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </GlassCard>
    );
  }

  // ── Configured — ready to mark complete ──
  if (isConfigured) {
    return (
      <GlassCard style={styles.card} variant={variant}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <PlatformIcon name="sun" size={32} color={GOLD} />
            <View>
              <Text style={[styles.title, { color: colors.text }]}>Outdoor Workout</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {state?.outdoor2Config?.activity} · {state?.outdoor2Config?.duration} min
              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: GOLD }]}
          onPress={handleMarkComplete}
          activeOpacity={0.85}
        >
          <PlatformIcon name="check" size={14} color="#fff" strokeWidth={3} />
          <Text style={styles.actionBtnText}>Mark Complete</Text>
        </TouchableOpacity>
      </GlassCard>
    );
  }

  // ── Not configured — show picker ──
  return (
    <GlassCard style={styles.card} variant={variant}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <PlatformIcon name="sun" size={32} color={GOLD} />
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Outdoor Workout</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Choose your activity (45 min+)</Text>
          </View>
        </View>
      </View>

      {/* Activity chips */}
      <View style={styles.chipWrap}>
        {OUTDOOR_ACTIVITIES.map((act) => {
          const isSelected = selectedActivity === act;
          return (
            <TouchableOpacity
              key={act}
              style={[
                styles.activityChip,
                { borderColor: isSelected ? LIGHT : colors.border },
                isSelected && { backgroundColor: `${LIGHT}20` },
              ]}
              onPress={() => handleSelectActivity(act)}
              activeOpacity={0.7}
            >
              <PlatformIcon
                name={ACTIVITY_ICONS[act] as any ?? 'activity'}
                size={14}
                color={isSelected ? LIGHT : colors.textSecondary}
              />
              <Text style={[styles.chipText, { color: isSelected ? LIGHT : colors.text }]}>{act}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Divider */}
      {!!selectedActivity && (
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
      )}

      {/* Choice buttons — Start Timer or Already Done */}
      {mode === 'choice' && (
        <View style={styles.choiceRow}>
          <TouchableOpacity
            style={[styles.choiceBtn, { borderColor: LIGHT, backgroundColor: `${LIGHT}15` }]}
            onPress={handleStartTimer}
            activeOpacity={0.8}
          >
            <PlatformIcon name="timer" size={15} color={LIGHT} />
            <Text style={[styles.choiceBtnText, { color: LIGHT }]}>Start Timer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.choiceBtn, { borderColor: colors.border }]}
            onPress={handleAlreadyDone}
            activeOpacity={0.8}
          >
            <PlatformIcon name="check-circle" size={15} color={colors.textSecondary} />
            <Text style={[styles.choiceBtnText, { color: colors.text }]}>Already Done</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Timer running */}
      {mode === 'timer' && (
        <View style={styles.timerSection}>
          <Text style={[styles.timerDisplay, { color: LIGHT }]}>{formatTime(elapsed)}</Text>
          <Text style={[styles.timerLabel, { color: colors.textSecondary }]}>
            {selectedActivity} in progress
          </Text>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: LIGHT, marginTop: 4 }]}
            onPress={handleStopTimer}
            activeOpacity={0.85}
          >
            <PlatformIcon name="check" size={14} color="#111" strokeWidth={3} />
            <Text style={[styles.actionBtnText, { color: '#111' }]}>Stop & Log</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Manual — duration chips + confirm */}
      {mode === 'manual' && (
        <>
          <View style={styles.durationRow}>
            {OUTDOOR_DURATION_OPTIONS.map((d) => {
              const isSelected = selectedDuration === d;
              return (
                <TouchableOpacity
                  key={d}
                  style={[
                    styles.durationChip,
                    { borderColor: isSelected ? LIGHT : colors.border },
                    isSelected && { backgroundColor: `${LIGHT}20` },
                  ]}
                  onPress={() => setSelectedDuration(d)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.durationText, { color: isSelected ? LIGHT : colors.text }]}>
                    {d}m
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: `${LIGHT}20`, borderWidth: 1, borderColor: LIGHT }]}
            onPress={handleConfirmActivity}
            activeOpacity={0.85}
          >
            <PlatformIcon name="arrow-right" size={14} color={LIGHT} strokeWidth={2.5} />
            <Text style={[styles.actionBtnText, { color: LIGHT }]}>Next</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Log data inputs */}
      {mode === 'log' && (
        <>
          <View style={styles.logSummary}>
            <Text style={[styles.logSummaryText, { color: colors.text }]}>
              {selectedActivity} · {selectedDuration} min
            </Text>
          </View>
          <View style={styles.logInputRow}>
            <View style={styles.logInputGroup}>
              <Text style={[styles.logInputLabel, { color: colors.textSecondary }]}>Distance</Text>
              <TextInput
                style={[styles.logInput, { color: colors.text, borderColor: colors.border, backgroundColor: `${colors.card}` }]}
                value={logDistance}
                onChangeText={setLogDistance}
                placeholder="mi"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
            </View>
            <View style={styles.logInputGroup}>
              <Text style={[styles.logInputLabel, { color: colors.textSecondary }]}>Avg HR</Text>
              <TextInput
                style={[styles.logInput, { color: colors.text, borderColor: colors.border, backgroundColor: `${colors.card}` }]}
                value={logHeartRate}
                onChangeText={setLogHeartRate}
                placeholder="bpm"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                returnKeyType="done"
              />
            </View>
            <View style={styles.logInputGroup}>
              <Text style={[styles.logInputLabel, { color: colors.textSecondary }]}>Calories</Text>
              <TextInput
                style={[styles.logInput, { color: colors.text, borderColor: colors.border, backgroundColor: `${colors.card}` }]}
                value={logCalories}
                onChangeText={setLogCalories}
                placeholder="cal"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                returnKeyType="done"
              />
            </View>
          </View>
          <Text style={[styles.logOptionalHint, { color: colors.textMuted }]}>All fields optional</Text>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: GREEN }]}
            onPress={handleLogComplete}
            activeOpacity={0.85}
          >
            <PlatformIcon name="check" size={14} color="#fff" strokeWidth={3} />
            <Text style={styles.actionBtnText}>Log Workout</Text>
          </TouchableOpacity>
        </>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
    marginTop: 2,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  activityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipText: {
    fontSize: 13,
    fontFamily: 'Outfit_600SemiBold',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: -2,
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 10,
  },
  choiceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 13,
  },
  choiceBtnText: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
  },
  timerSection: {
    alignItems: 'center',
    gap: 4,
  },
  timerDisplay: {
    fontSize: 48,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -1,
  },
  timerLabel: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
    marginBottom: 4,
  },
  durationRow: {
    flexDirection: 'row',
    gap: 8,
  },
  durationChip: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
  },
  durationText: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    width: '100%',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
  },
  logSummary: {
    alignItems: 'center',
  },
  logSummaryText: {
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
  },
  logInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  logInputGroup: {
    flex: 1,
    gap: 4,
  },
  logInputLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.5,
  },
  logInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
    textAlign: 'center',
  },
  logOptionalHint: {
    fontSize: 11,
    fontFamily: 'Outfit_400Regular',
    textAlign: 'center',
    marginTop: -6,
  },
});
