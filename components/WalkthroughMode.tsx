import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { PlatformIcon } from '@/components/PlatformIcon';
import WheelPicker from '@/components/WheelPicker';
import { useZealTheme } from '@/context/AppContext';
import { useWorkoutTracking, useWorkoutElapsed, useRestTimeRemaining } from '@/context/WorkoutTrackingContext';
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

function formatClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function WalkthroughMode({ visible, workout, accent, onClose, onToggleSet, getTrackingType }: Props) {
  const { colors, isDark } = useZealTheme();
  const tracking = useWorkoutTracking();
  const elapsed = useWorkoutElapsed();
  const restRemaining = useRestTimeRemaining();
  const restActive = tracking.isRestActive && restRemaining > 0;

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

  // ── Current set: round-robin scan so supersets alternate movements ─────
  const currentTarget = useMemo(() => {
    if (!group) return null;
    const maxSets = Math.max(0, ...group.exercises.map(ex => tracking.exerciseLogs[ex.id]?.sets.length ?? ex.sets));
    for (let r = 0; r < maxSets; r++) {
      for (const ex of group.exercises) {
        const sets = tracking.exerciseLogs[ex.id]?.sets ?? [];
        if (r < sets.length && !sets[r].done) return { ex, setIdx: r };
      }
    }
    return null; // whole group logged
  }, [group, tracking.exerciseLogs]);

  // ── Auto-advance: advance as soon as the last set is logged. The rest
  // timer keeps running in the top bar, so the user immediately sees the
  // next movement's weight and can set up equipment during the rest.
  const advancedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!visible || !group || !allDone || isLast) return;
    if (advancedForRef.current === group.key) return;
    advancedForRef.current = group.key;
    const t = setTimeout(() => {
      setGroupIndex(i => Math.min(i + 1, groups.length - 1));
      if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, 450);
    return () => { clearTimeout(t); };
  }, [visible, group, allDone, isLast, groups.length]);

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

  const curEx = currentTarget?.ex ?? group.exercises[0];
  const curLog = tracking.exerciseLogs[curEx.id];
  const curSets = curLog?.sets ?? [];
  const curSetIdx = currentTarget?.setIdx ?? Math.max(0, curSets.length - 1);
  const curSet = curSets[curSetIdx];
  const t = getTrackingType(curEx);
  const isDumbbell = (curEx.equipment ?? '').toLowerCase().includes('dumbbell');
  const showWeight = !t.isRepsOnly && !t.isHoldForTime && !t.isCaloriesMovement && !t.isDistanceOnly;
  const repsValues = t.isHoldForTime ? TIME_VALUES_SECONDS : REPS_VALUES;
  const metricLabel = t.isHoldForTime ? 'HOLD' : t.isCaloriesMovement ? 'CALS' : t.isDistanceOnly || t.isWeightDistance ? 'DIST' : 'REPS';

  // Weight/target metadata for an exercise: prefer the live log's first-set
  // weight (what the wheels hold), else the suggestion engine.
  const exerciseMeta = (ex: WorkoutExercise): string => {
    const tt = getTrackingType(ex);
    const parts: string[] = [`${ex.sets} × ${ex.reps}`];
    if (!tt.isRepsOnly && !tt.isHoldForTime && !tt.isCaloriesMovement && !tt.isDistanceOnly) {
      const logged = tracking.exerciseLogs[ex.id]?.sets[0]?.weight;
      const w = logged && logged > 0
        ? logged
        : Math.round(tracking.getExerciseSuggestion(ex).suggestedWeight / 5) * 5;
      if (w > 0) parts.push(`${w} lb`);
    }
    return parts.join(' · ');
  };

  // Up next: within a superset, the next alternating set; otherwise the next movement.
  const upNext = ((): { title: string; meta: string | null } | null => {
    if (currentTarget && group.exercises.length > 1) {
      const maxSets = Math.max(0, ...group.exercises.map(ex => tracking.exerciseLogs[ex.id]?.sets.length ?? ex.sets));
      let passedCurrent = false;
      for (let r = 0; r < maxSets; r++) {
        for (const ex of group.exercises) {
          const exSets = tracking.exerciseLogs[ex.id]?.sets ?? [];
          if (r < exSets.length && !exSets[r].done) {
            if (!passedCurrent && ex.id === curEx.id && r === curSetIdx) { passedCurrent = true; continue; }
            if (passedCurrent) {
              const tt = getTrackingType(ex);
              const showW = !tt.isRepsOnly && !tt.isHoldForTime && !tt.isCaloriesMovement && !tt.isDistanceOnly;
              const w = exSets[r].weight;
              return {
                title: ex.name,
                meta: `Set ${r + 1} of ${exSets.length}${showW && w > 0 ? ` · ${w} lb` : ''}`,
              };
            }
          }
        }
      }
    }
    if (!nextGroup) return null;
    return {
      title: nextGroup.exercises.map(e => e.name).join(' + '),
      meta: nextGroup.exercises.map(exerciseMeta).join('   +   '),
    };
  })();

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

        {/* ── Big timer — flips emphasis to the rest countdown when resting ── */}
        <View style={[styles.timerBar, {
          backgroundColor: restActive ? `${accent}14` : colors.card,
          borderColor: restActive ? `${accent}50` : colors.border,
        }]}>
          {restActive ? (
            <>
              <View style={styles.timerMain}>
                <Text style={[styles.timerLabel, { color: accent }]}>REST</Text>
                <Text style={[styles.timerValue, { color: accent }]}>{formatClock(restRemaining)}</Text>
              </View>
              <View style={styles.timerSide}>
                <Text style={[styles.timerSideLabel, { color: colors.textMuted }]}>ELAPSED</Text>
                <Text style={[styles.timerSideValue, { color: colors.textSecondary }]}>{formatClock(elapsed)}</Text>
              </View>
              <TouchableOpacity
                onPress={() => tracking.cancelRestTimer()}
                style={[styles.skipRestBtn, { borderColor: `${accent}60` }]}
                activeOpacity={0.7}
                testID="walkthrough-skip-rest"
              >
                <Text style={[styles.skipRestText, { color: accent }]}>Skip</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.timerMain}>
              <Text style={[styles.timerLabel, { color: colors.textMuted }]}>ELAPSED</Text>
              <Text style={[styles.timerValue, { color: colors.text }]}>{formatClock(elapsed)}</Text>
            </View>
          )}
        </View>

        {/* ── Current set focus ── */}
        <View style={styles.focusArea}>
          {groupLabel && (
            <View style={[styles.groupBadge, { backgroundColor: `${accent}18`, borderColor: `${accent}40` }]}>
              <Text style={[styles.groupBadgeText, { color: accent }]}>{groupLabel}</Text>
            </View>
          )}

          <Text style={[styles.exerciseName, { color: colors.text }]} numberOfLines={2} adjustsFontSizeToFit>
            {curEx.name}
          </Text>

          {currentTarget && curSet ? (
            <>
              <Text style={[styles.setCounter, { color: accent }]}>
                SET {curSetIdx + 1} <Text style={{ color: colors.textMuted }}>OF {curSets.length}</Text>
              </Text>

              {/* Per-set dots for this movement */}
              <View style={styles.setDots}>
                {curSets.map((s, i) => (
                  <View key={i} style={[styles.setDot, {
                    backgroundColor: s.done ? accent
                      : i === curSetIdx ? `${accent}60`
                      : isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)',
                  }]} />
                ))}
              </View>

              {/* Big wheels for just this set */}
              <View style={styles.wheelRow}>
                {showWeight && (
                  <View style={styles.wheelField}>
                    <Text style={[styles.wheelLabel, { color: colors.textMuted }]}>WEIGHT</Text>
                    <View style={[styles.wheelBox, { borderColor: colors.border, backgroundColor: colors.cardSecondary }]}>
                      <WheelPicker
                        values={isDumbbell ? DUMBBELL_WEIGHT_VALUES : WEIGHT_VALUES}
                        selectedValue={curSet.weight}
                        onValueChange={(v) => tracking.updateSetLog(curEx.id, curSetIdx, 'weight', v)}
                        textColor={colors.text}
                        visibleItems={3}
                        itemHeight={40}
                      />
                      <PlatformIcon name="chevron-down" size={12} color={`${colors.textMuted}50`} style={styles.wheelChevron} />
                    </View>
                  </View>
                )}
                <View style={styles.wheelField}>
                  <Text style={[styles.wheelLabel, { color: colors.textMuted }]}>{metricLabel}</Text>
                  <View style={[styles.wheelBox, { borderColor: colors.border, backgroundColor: colors.cardSecondary }]}>
                    <WheelPicker
                      values={repsValues}
                      selectedValue={curSet.reps}
                      onValueChange={(v) => tracking.updateSetLog(curEx.id, curSetIdx, 'reps', v)}
                      textColor={colors.text}
                      visibleItems={3}
                      itemHeight={40}
                      formatValue={t.isHoldForTime ? formatHoldTime : undefined}
                    />
                    <PlatformIcon name="chevron-down" size={12} color={`${colors.textMuted}50`} style={styles.wheelChevron} />
                  </View>
                </View>
              </View>

              {/* Giant log button */}
              <TouchableOpacity
                onPress={() => onToggleSet(curEx.id, curSetIdx, curEx)}
                style={[styles.logBtn, { backgroundColor: accent }]}
                activeOpacity={0.85}
                testID="walkthrough-log-set"
              >
                <PlatformIcon name="check" size={24} color="#fff" strokeWidth={3} />
                <Text style={styles.logBtnText}>Log Set</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.completeWrap}>
              <View style={[styles.completeCircle, { backgroundColor: `${accent}20` }]}>
                <PlatformIcon name="check" size={40} color={accent} strokeWidth={2.5} />
              </View>
              <Text style={[styles.completeText, { color: colors.text }]}>Movement complete</Text>
              {!isLast && (
                <Text style={[styles.completeSub, { color: colors.textSecondary }]}>Moving on…</Text>
              )}
            </View>
          )}

          {/* Up next */}
          {upNext && (
            <View style={[styles.upNext, { borderColor: colors.border }]}>
              <Text style={[styles.upNextLabel, { color: colors.textMuted }]}>UP NEXT</Text>
              <Text style={[styles.upNextText, { color: colors.textSecondary }]} numberOfLines={2}>
                {upNext.title}
              </Text>
              {upNext.meta && (
                <Text style={[styles.upNextMeta, { color: colors.textMuted }]} numberOfLines={2}>
                  {upNext.meta}
                </Text>
              )}
            </View>
          )}
        </View>

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
            style={[styles.nextBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}
            activeOpacity={0.8}
            testID="walkthrough-next"
          >
            <Text style={[styles.nextBtnText, { color: colors.text }]}>{isLast ? 'Done' : 'Next Movement'}</Text>
            {!isLast && <PlatformIcon name="chevron-right" size={18} color={colors.textSecondary} />}
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
  timerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 14,
  },
  timerMain: {
    flex: 1,
  },
  timerLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 1.2,
  },
  timerValue: {
    fontSize: 38,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  timerSide: {
    alignItems: 'flex-end',
  },
  timerSideLabel: {
    fontSize: 9,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.8,
  },
  timerSideValue: {
    fontSize: 17,
    fontFamily: 'Outfit_700Bold',
    fontVariant: ['tabular-nums'],
  },
  skipRestBtn: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  skipRestText: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
  },
  focusArea: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 18,
    alignItems: 'center',
  },
  groupBadge: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 10,
  },
  groupBadgeText: {
    fontSize: 11,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 1,
  },
  exerciseName: {
    fontSize: 30,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  setCounter: {
    fontSize: 17,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 0.6,
    marginTop: 8,
  },
  setDots: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 10,
    marginBottom: 18,
  },
  setDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  wheelRow: {
    flexDirection: 'row',
    gap: 14,
    alignSelf: 'stretch',
  },
  wheelField: {
    flex: 1,
    gap: 6,
    alignItems: 'center',
  },
  wheelLabel: {
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 1,
  },
  wheelBox: {
    alignSelf: 'stretch',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelChevron: {
    position: 'absolute',
    right: 8,
    bottom: 5,
  },
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    alignSelf: 'stretch',
    height: 62,
    borderRadius: 20,
    marginTop: 18,
  },
  logBtnText: {
    color: '#fff',
    fontSize: 19,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.3,
  },
  completeWrap: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 30,
  },
  completeCircle: {
    width: 84,
    height: 84,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeText: {
    fontSize: 22,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.5,
  },
  completeSub: {
    fontSize: 14,
    fontFamily: 'Outfit_400Regular',
  },
  upNext: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderRadius: 16,
    borderStyle: 'dashed',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 3,
    marginTop: 'auto',
    marginBottom: 12,
  },
  upNextLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.8,
  },
  upNextText: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
  },
  upNextMeta: {
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
    letterSpacing: 0.1,
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
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.2,
  },
});
