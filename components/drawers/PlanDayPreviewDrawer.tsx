import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import {
  Layers,
  Clock,
  Dumbbell,
  ArrowLeftRight,
  RotateCcw,
  Circle,
  ChevronRight,
} from 'lucide-react-native';
import BaseDrawer from '@/components/drawers/BaseDrawer';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme, useAppContext } from '@/context/AppContext';
import { WORKOUT_STYLE_COLORS } from '@/constants/colors';
import { PHASE_DISPLAY_NAMES } from '@/services/planConstants';
import type { PlanPhase } from '@/services/planConstants';
import type { DayPrescription } from '@/services/planEngine';
import { generateWorkoutAsync, enforceStyleGrouping } from '@/services/aiWorkoutGenerator';
import type { GeneratedWorkout, WorkoutExercise } from '@/services/workoutEngine';

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

interface Props {
  visible: boolean;
  onClose: () => void;
  onClosePlan: () => void;
  day: DayPrescription | null;
}

// ── Section header (label + horizontal divider) ───────────────────────────────

function SectionHeader({ label, color }: { label: string; color: string }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={[styles.sectionLabel, { color }]}>{label}</Text>
      <View style={[styles.sectionDivider, { backgroundColor: `${color}35` }]} />
    </View>
  );
}

// ── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow({ opacity, colors }: { opacity: number; colors: any }) {
  return (
    <View style={[skStyles.row, { borderBottomColor: `${colors.border}55` }]}>
      <View style={[skStyles.indexBar, { backgroundColor: 'rgba(255,255,255,0.14)', opacity: opacity * 0.5 }]} />
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
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, gap: 12,
  },
  indexBar: { width: 20, height: 13, borderRadius: 4 },
  left: { flex: 1, gap: 6 },
  titleBar: { height: 13, borderRadius: 6, width: '55%' },
  subBar: { height: 10, borderRadius: 5, width: '35%' },
  badge: { width: 48, height: 22, borderRadius: 8 },
});

// ── Main Component ────────────────────────────────────────────────────────────

export default function PlanDayPreviewDrawer({ visible, onClose, onClosePlan, day }: Props) {
  const { colors, accent, isDark } = useZealTheme();
  const ctx = useAppContext();
  const router = useRouter();

  const [workout, setWorkout] = useState<GeneratedWorkout | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styleColor = day ? (WORKOUT_STYLE_COLORS[day.style] ?? accent) : accent;

  // Muscle readiness warning
  const fatigued = day && !day.is_rest
    ? getPrimaryMuscles(day.session_type || day.style).filter(muscle => {
        const item = ctx.muscleReadiness.find(r => r.name === muscle);
        return item && item.status === 'recovering';
      })
    : [];

  const isGeneratingInBackground = !!(ctx.planGenProgress && (ctx.planGenProgress.phase === 'week1' || ctx.planGenProgress.phase === 'background'));

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

        if (isGeneratingInBackground) {
          setLoading(false);
          setError('still_generating');
          return;
        }

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

  const phaseLabel = PHASE_DISPLAY_NAMES[day.phase as PlanPhase] ?? day.phase;
  const exerciseCount = workout?.workout?.length ?? 0;
  const warmupCount = workout?.warmup?.length ?? 0;
  const groupedExercises = workout ? buildExerciseGroups(workout.workout) : [];

  const renderGroupBadge = (type: 'superset' | 'circuit' | 'rounds' | null) => {
    if (!type) return null;
    const Icon = type === 'superset' ? ArrowLeftRight : type === 'circuit' ? RotateCcw : Circle;
    const label = type === 'superset' ? 'SUPERSET' : type === 'circuit' ? 'CIRCUIT' : 'ROUNDS';
    return (
      <View style={[styles.groupTag, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}>
        <Icon size={10} color={colors.textMuted} />
        <Text style={[styles.groupTagText, { color: colors.textSecondary }]}>{label}</Text>
      </View>
    );
  };

  const renderExercise = (ex: WorkoutExercise, idx: number, inGroup = false) => {
    const meta = [ex.muscleGroup, ex.rest ? `${ex.rest} rest` : null].filter(Boolean).join(' · ');
    return (
      <View
        key={ex.id}
        style={[
          styles.exerciseBlock,
          { borderBottomColor: `${colors.border}55` },
          inGroup && styles.exerciseBlockGrouped,
        ]}
      >
        <View style={styles.exerciseHeader}>
          <Text style={[styles.exerciseIndex, { color: colors.textMuted }]}>{String(idx + 1).padStart(2, '0')}</Text>
          <View style={styles.exerciseTitleWrap}>
            <Text style={[styles.exerciseName, { color: colors.text }]} numberOfLines={1}>{ex.name}</Text>
            {meta ? (
              <Text style={[styles.exerciseMetaText, { color: colors.textSecondary }]} numberOfLines={1}>{meta}</Text>
            ) : null}
          </View>
          <Text style={[styles.exerciseSetsLabel, { color: colors.textSecondary }]}>{ex.sets} × {ex.reps}</Text>
        </View>
      </View>
    );
  };

  const renderGroup = (group: WorkoutExercise[], startIdx: number) => {
    const type = (group[0]?.groupType ?? null) as 'superset' | 'circuit' | 'rounds' | null;
    return (
      <View
        key={group[0]?.id}
        style={[
          styles.groupBlock,
          {
            borderColor: `${colors.border}75`,
            backgroundColor: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.015)',
          },
        ]}
      >
        <View style={styles.groupBlockHeader}>
          {renderGroupBadge(type)}
          <Text style={[styles.groupBlockCount, { color: colors.textMuted }]}>{group.length} exercises</Text>
        </View>
        {group.map((ex, i) => renderExercise(ex, startIdx + i, true))}
      </View>
    );
  };

  const headerContent = (
    <View style={styles.header}>
      <View style={{ flex: 1 }} />
      <TouchableOpacity onPress={onClose} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <PlatformIcon name="x" size={16} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );

  return (
    <BaseDrawer visible={visible} onClose={onClose} header={headerContent} stackBehavior="push">
      <View style={styles.content}>

        {/* ── Eyebrow ─────────────────────────────────────── */}
        <View style={styles.eyebrowRow}>
          <View style={[styles.styleDot, { backgroundColor: styleColor }]} />
          <Text style={[styles.eyebrowText, { color: colors.textSecondary }]}>{day.style.toUpperCase()}</Text>
          {day.is_deload_week && (
            <>
              <Text style={[styles.eyebrowSep, { color: colors.textMuted }]}>·</Text>
              <Text style={[styles.eyebrowText, { color: '#22c55e' }]}>DELOAD</Text>
            </>
          )}
        </View>

        {/* ── Session title ────────────────────────────────── */}
        <Text style={[styles.sessionTitle, { color: colors.text }]} numberOfLines={2}>
          {day.session_type || day.style}
        </Text>
        <Text style={[styles.sessionSubtitle, { color: colors.textSecondary }]}>{phaseLabel}</Text>

        {/* ── Stat chips ──────────────────────────────────── */}
        <View style={styles.statsRow}>
          {exerciseCount > 0 && (
            <View style={[styles.statPill, { backgroundColor: isDark ? '#1a1a1a' : '#f4f4f4', borderColor: `${colors.border}90` }]}>
              <Layers size={13} color={colors.textMuted} />
              <Text style={[styles.statText, { color: colors.text }]}>{exerciseCount} exercises</Text>
            </View>
          )}
          {warmupCount > 0 && (
            <View style={[styles.statPill, { backgroundColor: isDark ? '#1a1a1a' : '#f4f4f4', borderColor: `${colors.border}90` }]}>
              <Dumbbell size={13} color={colors.textMuted} />
              <Text style={[styles.statText, { color: colors.text }]}>{warmupCount} warm-up</Text>
            </View>
          )}
          <View style={[styles.statPill, { backgroundColor: isDark ? '#1a1a1a' : '#f4f4f4', borderColor: `${colors.border}90` }]}>
            <Clock size={13} color={colors.textMuted} />
            <Text style={[styles.statText, { color: colors.text }]}>{day.target_duration} min</Text>
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
          <>
            <SectionHeader label="EXERCISE LIST" color={colors.textSecondary} />
            {[0.9, 0.75, 0.6, 0.48, 0.36].map((op, i) => (
              <SkeletonRow key={i} opacity={op} colors={colors} />
            ))}
          </>
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
          <>
            <SectionHeader label="EXERCISE LIST" color={colors.textSecondary} />
            {(() => {
              let globalIdx = 0;
              return groupedExercises.map((item) => {
                if (item.type === 'group') {
                  const startIdx = globalIdx;
                  globalIdx += item.exercises.length;
                  return renderGroup(item.exercises, startIdx);
                }
                const idx = globalIdx;
                globalIdx += 1;
                return renderExercise(item.exercise, idx);
              });
            })()}
          </>
        )}

        {/* ── Start CTA ───────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.startBtn, { backgroundColor: styleColor }]}
          onPress={handleStart}
          activeOpacity={0.85}
        >
          <Text style={styles.startBtnText}>Start This Workout</Text>
          <ChevronRight size={16} color="#fff" />
        </TouchableOpacity>

        <View style={{ height: 20 }} />
      </View>
    </BaseDrawer>
  );
}

// ── Group builder ─────────────────────────────────────────────────────────────

type ExerciseGroupItem =
  | { type: 'solo'; exercise: WorkoutExercise }
  | { type: 'group'; exercises: WorkoutExercise[] };

function buildExerciseGroups(exercises: WorkoutExercise[]): ExerciseGroupItem[] {
  const result: ExerciseGroupItem[] = [];
  const seen = new Set<string>();

  for (const ex of exercises) {
    if (seen.has(ex.id)) continue;
    if (ex.groupId) {
      seen.add(ex.groupId);
      const members = exercises.filter(e => e.groupId === ex.groupId);
      members.forEach(e => seen.add(e.id));
      result.push({ type: 'group', exercises: members });
    } else {
      seen.add(ex.id);
      result.push({ type: 'solo', exercise: ex });
    }
  }
  return result;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8,
  },

  content: { paddingHorizontal: 22, gap: 14, paddingBottom: 8 },

  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  styleDot: { width: 6, height: 6, borderRadius: 3 },
  eyebrowText: { fontSize: 11, fontFamily: 'Outfit_700Bold', letterSpacing: 1 },
  eyebrowSep: { fontSize: 11 },

  sessionTitle: {
    fontSize: 26, fontFamily: 'Outfit_800ExtraBold', letterSpacing: -0.5,
    marginTop: 2,
  },
  sessionSubtitle: { fontSize: 13, fontFamily: 'Outfit_400Regular', marginTop: -6 },

  statsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 9,
  },
  statText: { fontSize: 12, fontFamily: 'Outfit_600SemiBold' },

  notesCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10,
  },
  notesText: { fontSize: 12, fontFamily: 'Outfit_400Regular', flex: 1, lineHeight: 17 },

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

  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginBottom: 4, marginTop: 2,
  },
  sectionLabel: { fontSize: 11, fontFamily: 'Outfit_700Bold', letterSpacing: 1 },
  sectionDivider: { flex: 1, height: 1 },

  exerciseBlock: {
    borderBottomWidth: 1, paddingBottom: 14, marginBottom: 14,
  },
  exerciseBlockGrouped: { paddingBottom: 10, marginBottom: 10 },
  exerciseHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  exerciseIndex: { width: 20, fontSize: 12, fontFamily: 'Outfit_600SemiBold', lineHeight: 20 },
  exerciseTitleWrap: { flex: 1, gap: 4 },
  exerciseName: { fontSize: 15, fontFamily: 'Outfit_700Bold' },
  exerciseMetaText: { fontSize: 12, fontFamily: 'Outfit_400Regular', lineHeight: 18 },
  exerciseSetsLabel: {
    fontSize: 13, fontFamily: 'Outfit_600SemiBold', flexShrink: 0, paddingTop: 2,
  },

  groupBlock: {
    borderRadius: 16, borderWidth: 1, marginBottom: 12,
    overflow: 'hidden', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 2,
  },
  groupBlockHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10,
  },
  groupTag: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5,
  },
  groupTagText: { fontSize: 10, fontFamily: 'Outfit_700Bold', letterSpacing: 0.8 },
  groupBlockCount: { fontSize: 11, fontFamily: 'Outfit_400Regular' },

  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 16, paddingVertical: 16, marginTop: 4,
  },
  startBtnText: {
    fontSize: 16, fontFamily: 'Outfit_700Bold', color: '#fff',
  },
});
