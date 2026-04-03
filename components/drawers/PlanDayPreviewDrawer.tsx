import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import BaseDrawer from '@/components/drawers/BaseDrawer';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme, useAppContext } from '@/context/AppContext';
import { WORKOUT_STYLE_COLORS } from '@/constants/colors';
import { PHASE_DISPLAY_NAMES } from '@/services/planConstants';
import type { PlanPhase } from '@/services/planConstants';
import type { DayPrescription } from '@/services/planEngine';
import { generateWorkoutAsync, enforceStyleGrouping } from '@/services/aiWorkoutGenerator';
import type { GeneratedWorkout, WorkoutExercise } from '@/services/workoutEngine';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PLAN_DAY_CACHE_PREFIX = '@zeal_plan_day_workout_';

// Maps session type keywords → muscle group names (matching MuscleReadinessItem.name)
const SESSION_MUSCLES: Array<{ keys: string[]; muscles: string[] }> = [
  { keys: ['push'],         muscles: ['Chest', 'Shoulders', 'Triceps'] },
  { keys: ['pull'],         muscles: ['Back', 'Biceps'] },
  { keys: ['leg', 'lower'], muscles: ['Quads', 'Hamstrings', 'Glutes', 'Calves'] },
  { keys: ['upper'],        muscles: ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'] },
  { keys: ['chest'],        muscles: ['Chest', 'Triceps'] },
  { keys: ['back'],         muscles: ['Back', 'Biceps'] },
  { keys: ['shoulder'],     muscles: ['Shoulders'] },
  { keys: ['arm'],          muscles: ['Biceps', 'Triceps'] },
  { keys: ['core', 'ab'],   muscles: ['Core'] },
  { keys: ['glute', 'hip'], muscles: ['Glutes'] },
  { keys: ['full body', 'total body'], muscles: ['Chest', 'Back', 'Shoulders', 'Quads', 'Hamstrings', 'Glutes'] },
];

function getPrimaryMuscles(sessionType: string): string[] {
  const lower = sessionType.toLowerCase();
  for (const entry of SESSION_MUSCLES) {
    if (entry.keys.some(k => lower.includes(k))) return entry.muscles;
  }
  return [];
}

function formatDateMed(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return dateStr; }
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
        <View style={[skStyles.titleBar, { backgroundColor: 'rgba(255,255,255,0.14)', opacity }]} />
        <View style={[skStyles.subBar, { backgroundColor: 'rgba(255,255,255,0.14)', opacity: opacity * 0.6 }]} />
      </View>
      <View style={[skStyles.badge, { backgroundColor: 'rgba(255,255,255,0.14)', opacity: opacity * 0.5 }]} />
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

  // Muscle readiness warning — check if primary muscles for this session are recovering
  const fatigued = day && !day.is_rest
    ? getPrimaryMuscles(day.session_type || day.style).filter(muscle => {
        const item = ctx.muscleReadiness.find(r => r.name === muscle);
        return item && item.status === 'recovering';
      })
    : [];

  const isGeneratingInBackground = !!(ctx.planGenProgress && (ctx.planGenProgress.phase === 'week1' || ctx.planGenProgress.phase === 'background'));

  // Generate workout when drawer opens (with per-day cache)
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

    const cacheKey = `${PLAN_DAY_CACHE_PREFIX}${ctx.activePlan?.id}_${day.date}`;

    // First check cache — if already generated, show it
    AsyncStorage.getItem(cacheKey)
      .then(cached => {
        if (cancelled) return;
        if (cached) {
          try {
            const parsed: GeneratedWorkout = JSON.parse(cached);
            parsed.workout = enforceStyleGrouping(parsed.workout, parsed.style);
            setWorkout(parsed);
            setLoading(false);
            return;
          } catch {
            // Cache corrupt — fall through
          }
        }

        // Not in cache — if background generation is running, don't trigger a new generation
        if (isGeneratingInBackground) {
          setLoading(false);
          setError('still_generating');
          return;
        }

        // Generate on-demand
        const params = {
          style: day.style,
          split: day.session_type,
          targetDuration: day.target_duration,
          restSlider: ctx.restBetweenSets,
          availableEquipment: ctx.activePlan?.equipment ?? ctx.selectedEquipment,
          fitnessLevel: ctx.fitnessLevel,
          sex: ctx.sex,
          specialLifeCase: ctx.specialLifeCase,
          specialLifeCaseDetail: ctx.specialLifeCaseDetail,
          warmUp: ctx.warmUp,
          coolDown: ctx.coolDown,
          recovery: false,
          addCardio: false,
          specificMuscles: [],
          planPhase: day.phase,
          volumeModifier: day.volume_modifier,
        };

        try {
          const result = generateWorkoutAsync(params, day);
          if (!cancelled) {
            setWorkout(result);
            setLoading(false);
            AsyncStorage.setItem(cacheKey, JSON.stringify(result)).catch(() => {});
          }
        } catch {
          if (!cancelled) {
            setError('Could not preview this workout. You can still start it.');
              setLoading(false);
            }
          }
      })
      .catch(() => {
        if (cancelled) return;
        if (isGeneratingInBackground) {
          setLoading(false);
          setError('still_generating');
          return;
        }
        setError('Could not preview this workout. You can still start it.');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [visible, day?.date, isGeneratingInBackground]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStart = useCallback(() => {
    if (!day) return;
    onClose();
    onClosePlan();
    setTimeout(() => router.push('/(tabs)/workout' as any), 400);
  }, [day, onClose, onClosePlan, router]);

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

        {/* ── Muscle readiness warning ────────────────────── */}
        {fatigued.length > 0 && (
          <View style={[styles.readinessWarn, { backgroundColor: '#f59e0b0d', borderColor: '#f59e0b35' }]}>
            <PlatformIcon name="alert-triangle" size={13} color="#f59e0b" />
            <Text style={[styles.readinessWarnText, { color: colors.textSecondary }]}>
              <Text style={{ fontWeight: '700', color: '#f59e0b' }}>
                {fatigued.join(', ')}
              </Text>
              {fatigued.length === 1
                ? ' is still recovering. Consider lighter loads or extra warm-up.'
                : ' are still recovering. Consider lighter loads or extra warm-up.'}
            </Text>
          </View>
        )}

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

        {/* ── Still generating in background ───────────────── */}
        {error === 'still_generating' && !loading && (
          <View style={[styles.errorCard, { backgroundColor: `${styleColor}0d`, borderColor: `${styleColor}30` }]}>
            <PlatformIcon name="sparkles" size={13} color={styleColor} />
            <Text style={[styles.errorText, { color: styleColor }]}>
              Still building this workout — check back in a moment.
              {ctx.planGenProgress ? ` (${ctx.planGenProgress.current}/${ctx.planGenProgress.total})` : ''}
            </Text>
          </View>
        )}

        {/* ── Error state ─────────────────────────────────── */}
        {error && error !== 'still_generating' && !loading && (
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
          <Text style={styles.startBtnText}>Start This Workout</Text>
          <PlatformIcon name="chevron-right" size={15} color="rgba(255,255,255,0.7)" style={{ marginRight: 4 }} />
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
      seen.add(ex.groupId);
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

  readinessWarn: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10,
  },
  readinessWarnText: { fontSize: 12, fontFamily: 'Outfit_400Regular', flex: 1, lineHeight: 17 },

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
