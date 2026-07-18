import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { PlatformIcon } from '@/components/PlatformIcon';
import WheelPicker from '@/components/WheelPicker';
import WorkoutTimerCard from '@/components/WorkoutTimerCard';
import { useZealTheme } from '@/context/AppContext';
import { useWorkoutTracking } from '@/context/WorkoutTrackingContext';
import type { GeneratedWorkout, WorkoutExercise } from '@/services/workoutEngine';

// Wheel ranges mirror the compact log panel in workout.tsx so both modes
// always present identical pickers.
const WEIGHT_VALUES = Array.from({ length: 201 }, (_, i) => i * 5);
const DUMBBELL_WEIGHT_VALUES = Array.from({ length: 401 }, (_, i) => i * 2.5);
const REPS_VALUES = Array.from({ length: 50 }, (_, i) => i + 1);
const TIME_VALUES_SECONDS = Array.from({ length: 121 }, (_, i) => i * 5);

export interface WalkthroughTrackingType {
  isRepsOnly: boolean;
  isHoldForTime: boolean;
  isCaloriesMovement: boolean;
  isDistanceOnly: boolean;
  isWeightDistance: boolean;
}

interface Props {
  visible: boolean;
  workout: GeneratedWorkout;
  accent: string;
  onClose: () => void;
  /** Reuses the compact mode's set-done handler (rest timer, Live Activity, superset rest skip). */
  onToggleSet: (exId: string, setIdx: number, exercise?: WorkoutExercise) => void;
  /** Reuses workout.tsx's tracking-type classifier (avoids a circular import). */
  getTrackingType: (ex: WorkoutExercise) => WalkthroughTrackingType;
}

interface Group {
  key: string;
  groupType: WorkoutExercise['groupType'];
  exercises: WorkoutExercise[];
}

function formatHoldTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `${sec}s`;
}

export default function WalkthroughMode({ visible, workout, accent, onClose, onToggleSet, getTrackingType }: Props) {
  const { colors, isDark } = useZealTheme();
  const tracking = useWorkoutTracking();

  // ── Group consecutive exercises that share a groupId ───────────────────
  const groups = useMemo<Group[]>(() => {
    const list: Group[] = [];
    const src = [...workout.workout, ...(workout.coreFinisher ?? [])];
    for (const ex of src) {
      const last = list[list.length - 1];
      if (ex.groupId && last && last.key === `g-${ex.groupId}`) {
        last.exercises.push(ex);
      } else if (ex.groupId) {
        list.push({ key: `g-${ex.groupId}`, groupType: ex.groupType, exercises: [ex] });
      } else {
        list.push({ key: ex.id, groupType: null, exercises: [ex] });
      }
    }
    return list;
  }, [workout]);

  const isGroupDone = useCallback((g: Group) => {
    return g.exercises.every(ex => {
      const log = tracking.exerciseLogs[ex.id];
      return !!log && log.sets.length > 0 && log.sets.every(s => s.done);
    });
  }, [tracking.exerciseLogs]);

  const [groupIndex, setGroupIndex] = useState(0);

  // On open: jump to the first movement that still has work left.
  useEffect(() => {
    if (!visible) return;
    const firstIncomplete = groups.findIndex(g => !isGroupDone(g));
    setGroupIndex(firstIncomplete === -1 ? Math.max(0, groups.length - 1) : firstIncomplete);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const clampedIndex = Math.min(groupIndex, Math.max(0, groups.length - 1));
  const group = groups[clampedIndex];
  const nextGroup = groups[clampedIndex + 1] ?? null;
  const isLast = clampedIndex >= groups.length - 1;

  // Ensure logs exist (and stay reconciled) for the on-screen movements.
  useEffect(() => {
    if (!visible || !group) return;
    group.exercises.forEach(ex => tracking.initExerciseLog(ex));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, group?.key]);

  const allDone = group ? isGroupDone(group) : false;

  // ── Auto-advance: all sets done + rest finished → next movement ────────
  const advancedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!visible || !group || !allDone || tracking.isRestActive || isLast) return;
    if (advancedForRef.current === group.key) return;
    advancedForRef.current = group.key;
    const t = setTimeout(() => {
      setGroupIndex(i => Math.min(i + 1, groups.length - 1));
      if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, 700);
    return () => { clearTimeout(t); };
  }, [visible, group, allDone, tracking.isRestActive, isLast, groups.length]);

  const goPrev = useCallback(() => setGroupIndex(i => Math.max(0, i - 1)), []);
  const goNext = useCallback(() => {
    if (isLast) { onClose(); return; }
    setGroupIndex(i => Math.min(i + 1, groups.length - 1));
  }, [isLast, onClose, groups.length]);

  if (!group) return null;

  const groupLabel = group.groupType === 'superset' ? 'SUPERSET'
    : group.groupType === 'circuit' ? 'CIRCUIT'
    : group.groupType === 'rounds' ? 'ROUNDS'
    : null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={[styles.headerBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} activeOpacity={0.7} testID="walkthrough-close">
            <PlatformIcon name="x" size={16} color={colors.textSecondary} />
            <Text style={[styles.headerBtnText, { color: colors.textSecondary }]}>List</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.progressText, { color: colors.textSecondary }]}>
              Movement {clampedIndex + 1} of {groups.length}
            </Text>
            <View style={styles.progressDots}>
              {groups.map((g, i) => (
                <View
                  key={g.key}
                  style={[styles.progressDot, {
                    backgroundColor: i === clampedIndex ? accent
                      : isGroupDone(g) ? `${accent}70`
                      : isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
                  }]}
                />
              ))}
            </View>
          </View>
          <View style={styles.headerBtnGhost} />
        </View>

        {/* ── Same floating timer card as compact mode ── */}
        <View style={styles.timerWrap}>
          <WorkoutTimerCard accent={accent} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {groupLabel && (
            <View style={[styles.groupBadge, { backgroundColor: `${accent}18`, borderColor: `${accent}40` }]}>
              <Text style={[styles.groupBadgeText, { color: accent }]}>{groupLabel}</Text>
            </View>
          )}

          {group.exercises.map(ex => {
            const log = tracking.exerciseLogs[ex.id];
            const t = getTrackingType(ex);
            const isDumbbell = (ex.equipment ?? '').toLowerCase().includes('dumbbell');
            const showWeight = !t.isRepsOnly && !t.isHoldForTime && !t.isCaloriesMovement && !t.isDistanceOnly;
            const repsValues = t.isHoldForTime ? TIME_VALUES_SECONDS : REPS_VALUES;
            const metricLabel = t.isHoldForTime ? 'HOLD' : t.isCaloriesMovement ? 'CALS' : t.isDistanceOnly || t.isWeightDistance ? 'DIST' : 'REPS';
            return (
              <View key={ex.id} style={[styles.exerciseCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.exerciseName, { color: colors.text }]}>{ex.name}</Text>
                <Text style={[styles.exerciseMeta, { color: colors.textSecondary }]}>
                  {ex.sets} × {ex.reps}{ex.muscleGroup ? `  ·  ${ex.muscleGroup}` : ''}
                </Text>

                {/* Column labels */}
                <View style={styles.setHeaderRow}>
                  <Text style={[styles.setHeaderCell, styles.setNumCol, { color: colors.textMuted }]}>SET</Text>
                  {showWeight && <Text style={[styles.setHeaderCell, styles.wheelCol, { color: colors.textMuted }]}>WEIGHT</Text>}
                  <Text style={[styles.setHeaderCell, styles.wheelCol, { color: colors.textMuted }]}>{metricLabel}</Text>
                  <Text style={[styles.setHeaderCell, styles.doneCol, { color: colors.textMuted }]}>DONE</Text>
                </View>

                {(log?.sets ?? []).map((set, setIdx) => (
                  <View key={setIdx} style={[styles.setRow, { borderTopColor: `${colors.border}50` }]}>
                    <Text style={[styles.setNum, styles.setNumCol, { color: set.done ? accent : colors.textSecondary }]}>
                      {set.setNumber}
                    </Text>
                    {showWeight && (
                      <View style={[styles.wheelBox, styles.wheelCol, { borderColor: colors.border, backgroundColor: colors.cardSecondary }]}>
                        <WheelPicker
                          values={isDumbbell ? DUMBBELL_WEIGHT_VALUES : WEIGHT_VALUES}
                          selectedValue={set.weight}
                          onValueChange={(v) => tracking.updateSetLog(ex.id, setIdx, 'weight', v)}
                          textColor={set.done ? colors.textMuted : colors.text}
                          visibleItems={1}
                        />
                        <PlatformIcon name="chevron-down" size={12} color={`${colors.textMuted}50`} style={styles.wheelChevron} />
                      </View>
                    )}
                    <View style={[styles.wheelBox, styles.wheelCol, { borderColor: colors.border, backgroundColor: colors.cardSecondary }]}>
                      <WheelPicker
                        values={repsValues}
                        selectedValue={set.reps}
                        onValueChange={(v) => tracking.updateSetLog(ex.id, setIdx, 'reps', v)}
                        textColor={set.done ? colors.textMuted : colors.text}
                        visibleItems={1}
                        formatValue={t.isHoldForTime ? formatHoldTime : undefined}
                      />
                      <PlatformIcon name="chevron-down" size={12} color={`${colors.textMuted}50`} style={styles.wheelChevron} />
                    </View>
                    <View style={styles.doneCol}>
                      <TouchableOpacity
                        onPress={() => onToggleSet(ex.id, setIdx, ex)}
                        style={[styles.doneBtn, {
                          backgroundColor: set.done ? accent : 'transparent',
                          borderColor: set.done ? accent : colors.border,
                        }]}
                        activeOpacity={0.7}
                        testID={`walkthrough-done-${ex.id}-${setIdx}`}
                      >
                        <PlatformIcon name="check" size={18} color={set.done ? '#fff' : colors.textMuted} strokeWidth={3} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                <TouchableOpacity
                  onPress={() => tracking.addSet(ex.id)}
                  style={styles.addSetBtn}
                  activeOpacity={0.7}
                >
                  <PlatformIcon name="plus" size={13} color={colors.textSecondary} />
                  <Text style={[styles.addSetText, { color: colors.textSecondary }]}>Add Set</Text>
                </TouchableOpacity>
              </View>
            );
          })}

          {/* Up next preview */}
          {nextGroup && (
            <View style={[styles.upNext, { borderColor: colors.border }]}>
              <Text style={[styles.upNextLabel, { color: colors.textMuted }]}>UP NEXT</Text>
              <Text style={[styles.upNextText, { color: colors.textSecondary }]} numberOfLines={2}>
                {nextGroup.exercises.map(e => e.name).join('  +  ')}
              </Text>
            </View>
          )}

          <View style={{ height: 20 }} />
        </ScrollView>

        {/* ── Footer nav ── */}
        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <TouchableOpacity
            onPress={goPrev}
            disabled={clampedIndex === 0}
            style={[styles.backBtn, { borderColor: colors.border, opacity: clampedIndex === 0 ? 0.35 : 1 }]}
            activeOpacity={0.7}
          >
            <PlatformIcon name="chevron-left" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={goNext}
            style={[styles.nextBtn, { backgroundColor: accent }]}
            activeOpacity={0.85}
            testID="walkthrough-next"
          >
            <Text style={styles.nextBtnText}>{isLast ? 'Done' : 'Next Movement'}</Text>
            {!isLast && <PlatformIcon name="chevron-right" size={18} color="#fff" />}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 10,
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  headerBtnText: {
    fontSize: 13,
    fontFamily: 'Outfit_600SemiBold',
  },
  headerBtnGhost: { width: 64 },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  progressText: {
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.2,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: 220,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  timerWrap: {
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 14,
  },
  groupBadge: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  groupBadgeText: {
    fontSize: 11,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 1,
  },
  exerciseCard: {
    borderRadius: 26,
    borderWidth: 1,
    padding: 18,
  },
  exerciseName: {
    fontSize: 22,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.5,
  },
  exerciseMeta: {
    fontSize: 13,
    fontFamily: 'Outfit_400Regular',
    marginTop: 2,
    marginBottom: 12,
  },
  setHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 6,
  },
  setHeaderCell: {
    fontSize: 10,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  setNumCol: { width: 30 },
  wheelCol: { flex: 1 },
  doneCol: { width: 52, alignItems: 'center' },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  setNum: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    textAlign: 'center',
  },
  wheelBox: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelChevron: {
    position: 'absolute',
    right: 5,
    bottom: 3,
  },
  doneBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    marginTop: 4,
  },
  addSetText: {
    fontSize: 13,
    fontFamily: 'Outfit_600SemiBold',
  },
  upNext: {
    borderWidth: 1,
    borderRadius: 16,
    borderStyle: 'dashed',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 3,
  },
  upNextLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.8,
  },
  upNextText: {
    fontSize: 14,
    fontFamily: 'Outfit_500Medium',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 52,
    height: 52,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 52,
    borderRadius: 18,
  },
  nextBtnText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.2,
  },
});
