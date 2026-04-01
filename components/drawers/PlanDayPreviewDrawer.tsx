import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import BaseDrawer from '@/components/drawers/BaseDrawer';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme, useAppContext } from '@/context/AppContext';
import { WORKOUT_STYLE_COLORS } from '@/constants/colors';
import { PHASE_DISPLAY_NAMES } from '@/services/planConstants';
import type { PlanPhase } from '@/services/planConstants';
import type { DayPrescription } from '@/services/planEngine';
import { generateWorkoutAsync } from '@/services/aiWorkoutGenerator';
import type { GeneratedWorkout, WorkoutExercise } from '@/services/workoutEngine';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDateMed(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return dateStr; }
}

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onClosePlan: () => void;
  day: DayPrescription | null;
}

// ── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow({ opacity, colors }: { opacity: number; colors: any }) {
  return (
    <View style={[skStyles.row, { borderColor: colors.border }]}>
      <View style={skStyles.left}>
        <View style={[skStyles.titleBar, { backgroundColor: colors.border, opacity }]} />
        <View style={[skStyles.subBar, { backgroundColor: colors.border, opacity: opacity * 0.6 }]} />
      </View>
      <View style={[skStyles.badge, { backgroundColor: colors.border, opacity: opacity * 0.5 }]} />
    </View>
  );
}

const skStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 13,
    borderTopWidth: 0.5,
  },
  left: { flex: 1, gap: 6 },
  titleBar: { height: 13, borderRadius: 6, width: '55%' },
  subBar: { height: 10, borderRadius: 5, width: '35%' },
  badge: { width: 38, height: 22, borderRadius: 8, marginLeft: 12 },
});

// ── Main Component ────────────────────────────────────────────────────────────

export default function PlanDayPreviewDrawer({ visible, onClose, onClosePlan, day }: Props) {
  const { colors, accent } = useZealTheme();
  const ctx = useAppContext();
  const router = useRouter();

  const [workout, setWorkout] = useState<GeneratedWorkout | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styleColor = day ? (WORKOUT_STYLE_COLORS[day.style] ?? accent) : accent;

  // Generate workout when drawer opens
  useEffect(() => {
    if (!visible || !day || day.is_rest) {
      setWorkout(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setWorkout(null);
    setError(null);

    generateWorkoutAsync(
      {
        style: day.style,
        split: day.session_type,
        targetDuration: day.target_duration,
        restSlider: ctx.restBetweenSets,
        availableEquipment: ctx.selectedEquipment,
        fitnessLevel: ctx.fitnessLevel,
        sex: ctx.sex,
        specialLifeCase: ctx.specialLifeCase,
        specialLifeCaseDetail: ctx.specialLifeCaseDetail,
        warmUp: ctx.warmUp,
        coolDown: ctx.coolDown,
        recovery: false,
        addCardio: false,
        specificMuscles: [],
      },
      day
    )
      .then(result => {
        if (!cancelled) {
          setWorkout(result);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not preview this workout. You can still start it.');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [visible, day?.date]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStart = useCallback(() => {
    if (!day) return;
    ctx.applyWorkoutOverride({
      style: day.style,
      split: day.session_type,
      duration: day.target_duration,
      rest: ctx.restBetweenSets,
      muscles: [],
      setDate: getTodayStr(),
    });
    onClose();
    onClosePlan();
    setTimeout(() => router.push('/(tabs)/workout' as any), 400);
  }, [day, ctx, onClose, onClosePlan, router]);

  if (!day) return null;

  const dayOfWeek = DAY_NAMES[new Date(day.date + 'T00:00:00').getDay()] ?? '';
  const phaseLabel = PHASE_DISPLAY_NAMES[day.phase as PlanPhase] ?? day.phase;

  // Group exercises by superset/circuit groupId
  const groupedExercises = workout ? buildExerciseGroups(workout.workout) : [];

  const headerContent = (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <PlatformIcon name="dumbbell" size={14} color={styleColor} />
        <Text style={[styles.headerLabel, { color: styleColor }]}>
          {dayOfWeek.toUpperCase()}  ·  {formatDateMed(day.date).toUpperCase()}
        </Text>
      </View>
      <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
        <PlatformIcon name="x" size={14} color="#888" />
      </TouchableOpacity>
    </View>
  );

  return (
    <BaseDrawer visible={visible} onClose={onClose} header={headerContent} stackBehavior="push">
      <View style={styles.content}>

        {/* ── Session identity ────────────────────────────── */}
        <View style={styles.sessionTop}>
          <Text style={[styles.sessionTitle, { color: colors.text }]} numberOfLines={1}>
            {day.session_type || day.style}
          </Text>
          <View style={styles.metaRow}>
            <View style={[styles.metaChip, { backgroundColor: `${styleColor}15`, borderColor: `${styleColor}30` }]}>
              <PlatformIcon name="clock" size={10} color={styleColor} />
              <Text style={[styles.metaChipText, { color: styleColor }]}>{day.target_duration} min</Text>
            </View>
            <View style={[styles.metaChip, { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)' }]}>
              <Text style={[styles.metaChipText, { color: colors.textSecondary }]}>{phaseLabel}</Text>
            </View>
            {day.is_deload_week && (
              <View style={[styles.metaChip, { backgroundColor: '#22c55e0d', borderColor: '#22c55e30' }]}>
                <Text style={[styles.metaChipText, { color: '#22c55e' }]}>Deload</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Day notes ───────────────────────────────────── */}
        {day.notes ? (
          <View style={[styles.notesCard, { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.09)' }]}>
            <PlatformIcon name="info" size={11} color={colors.textSecondary} />
            <Text style={[styles.notesText, { color: colors.textSecondary }]}>{day.notes}</Text>
          </View>
        ) : null}

        {/* ── Loading skeleton ────────────────────────────── */}
        {loading && (
          <View style={[styles.exerciseCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
            <View style={styles.cardLabelRow}>
              <View style={[styles.cardLabelSkeleton, { backgroundColor: colors.border }]} />
            </View>
            {[0.9, 0.75, 0.6, 0.48, 0.36].map((op, i) => (
              <SkeletonRow key={i} opacity={op} colors={colors} />
            ))}
          </View>
        )}

        {/* ── Error state ─────────────────────────────────── */}
        {error && !loading && (
          <View style={[styles.errorCard, { backgroundColor: '#ef44440d', borderColor: '#ef444430' }]}>
            <PlatformIcon name="alert-triangle" size={13} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* ── Exercise list ───────────────────────────────── */}
        {!loading && workout && workout.workout.length > 0 && (
          <View style={[styles.exerciseCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
            <View style={styles.cardLabelRow}>
              <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>
                {workout.workout.length} EXERCISES
              </Text>
            </View>
            {groupedExercises.map((item, i) => {
              if (item.type === 'group') {
                return (
                  <View key={i}>
                    {/* Group header */}
                    <View style={[styles.groupHeader, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
                      <PlatformIcon name="link" size={10} color={colors.textMuted} />
                      <Text style={[styles.groupHeaderText, { color: colors.textMuted }]}>
                        {item.groupType === 'circuit' ? 'Circuit' : 'Superset'}
                      </Text>
                      {item.rest ? (
                        <Text style={[styles.groupRest, { color: colors.textMuted }]}>{item.rest}</Text>
                      ) : null}
                    </View>
                    {item.exercises.map((ex, j) => (
                      <ExerciseRow
                        key={ex.id}
                        ex={ex}
                        isFirst={i === 0 && j === 0}
                        isGrouped
                        colors={colors}
                        styleColor={styleColor}
                      />
                    ))}
                  </View>
                );
              }
              return (
                <ExerciseRow
                  key={item.exercise.id}
                  ex={item.exercise}
                  isFirst={i === 0}
                  isGrouped={false}
                  colors={colors}
                  styleColor={styleColor}
                />
              );
            })}
          </View>
        )}

        {/* ── Start CTA ───────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.startBtn, { backgroundColor: styleColor }]}
          onPress={handleStart}
          activeOpacity={0.85}
        >
          <PlatformIcon name="play" size={15} color="#fff" fill="#fff" />
          <Text style={styles.startBtnText}>
            {loading ? 'Start This Workout' : 'Start This Workout'}
          </Text>
          <PlatformIcon name="chevron-right" size={15} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>

        <View style={{ height: 20 }} />
      </View>
    </BaseDrawer>
  );
}

// ── Exercise row sub-component ────────────────────────────────────────────────

function ExerciseRow({
  ex, isFirst, isGrouped, colors, styleColor,
}: {
  ex: WorkoutExercise;
  isFirst: boolean;
  isGrouped: boolean;
  colors: any;
  styleColor: string;
}) {
  return (
    <View style={[
      styles.exerciseRow,
      !isFirst && { borderTopWidth: 0.5, borderTopColor: colors.border },
      isGrouped && styles.exerciseRowGrouped,
    ]}>
      <View style={styles.exerciseLeft}>
        <Text style={[styles.exerciseName, { color: colors.text }]} numberOfLines={1}>
          {ex.name}
        </Text>
        <Text style={[styles.exerciseMeta, { color: colors.textSecondary }]}>
          {ex.sets}×{ex.reps}
          {ex.rest ? `  ·  ${ex.rest}` : ''}
          {ex.muscleGroup ? `  ·  ${ex.muscleGroup}` : ''}
        </Text>
      </View>
      {ex.suggestedWeight && ex.suggestedWeight !== 'BW' && ex.suggestedWeight !== '' && (
        <Text style={[styles.exerciseWeight, { color: colors.textMuted }]}>
          {ex.suggestedWeight}
        </Text>
      )}
    </View>
  );
}

// ── Group builder ─────────────────────────────────────────────────────────────

type ExerciseGroupItem =
  | { type: 'solo'; exercise: WorkoutExercise }
  | { type: 'group'; groupType: string; rest: string; exercises: WorkoutExercise[] };

function buildExerciseGroups(exercises: WorkoutExercise[]): ExerciseGroupItem[] {
  const result: ExerciseGroupItem[] = [];
  const seen = new Set<string>();

  for (const ex of exercises) {
    if (ex.groupId && !seen.has(ex.groupId)) {
      const members = exercises.filter(e => e.groupId === ex.groupId);
      members.forEach(e => seen.add(e.id));
      result.push({
        type: 'group',
        groupType: ex.groupType ?? 'superset',
        rest: members[members.length - 1]?.rest ?? '',
        exercises: members,
      });
    } else if (!ex.groupId && !seen.has(ex.id)) {
      seen.add(ex.id);
      result.push({ type: 'solo', exercise: ex });
    }
  }
  return result;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  headerLabel: { fontSize: 11, fontFamily: 'Outfit_700Bold', letterSpacing: 1 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(128,128,128,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },

  content: { paddingHorizontal: 16, gap: 14, paddingBottom: 8 },

  sessionTop: { gap: 10 },
  sessionTitle: { fontSize: 26, fontFamily: 'Outfit_800ExtraBold', letterSpacing: -0.5 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5,
  },
  metaChipText: { fontSize: 11, fontFamily: 'Outfit_600SemiBold' },

  notesCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10,
  },
  notesText: { fontSize: 12, fontFamily: 'Outfit_400Regular', flex: 1, lineHeight: 17 },

  exerciseCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  cardLabelRow: { paddingHorizontal: 14, paddingVertical: 10 },
  cardLabel: { fontSize: 10, fontFamily: 'Outfit_700Bold', letterSpacing: 0.8 },
  cardLabelSkeleton: { height: 10, width: 80, borderRadius: 5 },

  exerciseRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 13,
  },
  exerciseRowGrouped: { paddingLeft: 20 },
  exerciseLeft: { flex: 1, gap: 4 },
  exerciseName: { fontSize: 14, fontFamily: 'Outfit_700Bold' },
  exerciseMeta: { fontSize: 12, fontFamily: 'Outfit_400Regular' },
  exerciseWeight: { fontSize: 12, fontFamily: 'Outfit_500Medium', marginLeft: 12 },

  groupHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 7,
    borderTopWidth: 0.5,
  },
  groupHeaderText: { fontSize: 11, fontFamily: 'Outfit_600SemiBold', flex: 1 },
  groupRest: { fontSize: 11, fontFamily: 'Outfit_400Regular' },

  errorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, borderWidth: 1, padding: 12,
  },
  errorText: { fontSize: 12, fontFamily: 'Outfit_400Regular', color: '#ef4444', flex: 1 },

  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 16, paddingVertical: 15, marginTop: 4,
  },
  startBtnText: {
    fontSize: 15, fontFamily: 'Outfit_700Bold', color: '#fff',
    flex: 1, textAlign: 'center', letterSpacing: -0.2,
  },
});
