import React, { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useDrawerSizing } from '@/components/drawers/useDrawerSizing';
import DrawerHeader from '@/components/drawers/DrawerHeader';
import { Target, Lightbulb, Settings2, ThumbsUp, ThumbsDown, TrendingUp, Zap } from 'lucide-react-native';
import ExerciseAnimationView from '@/components/ExerciseAnimationView';
import Svg, { Polyline, Circle as SvgCircle } from 'react-native-svg';
import { useZealTheme, useAppContext } from '@/context/AppContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { showProGate } from '@/services/proGate';
import { useWorkoutTracking, type WorkoutLog } from '@/context/WorkoutTrackingContext';
import { WORKOUT_STYLE_COLORS } from '@/constants/colors';
import type { WorkoutExercise } from '@/services/workoutEngine';
import { getZealExerciseDatabase, type ZealExercise } from '@/mocks/exerciseDatabase';

// ─── Helpers ────────────────────────────────────────────────────────────────

function estimate1RM(weightStr: string, repsStr: string): string {
  const wm = weightStr.match(/(\d+)/);
  const reps = parseInt(repsStr, 10);
  if (!wm || isNaN(reps) || reps <= 0 || reps > 30) return '';
  const w = parseInt(wm[1], 10);
  if (w <= 0) return '';
  return `~${Math.round(w * (1 + reps / 30))} lb`;
}

function fmt(s: string): string { return s.replace(/_/g, ' '); }

function generateSetup(ref: any): string {
  if (!ref) return 'Set up according to the exercise prescription.';
  if (typeof ref.setup === 'string' && ref.setup.trim().length > 0) return ref.setup.trim();
  const rawEquip: string[] = ref.equipment_required ?? ref.equipment ?? [];
  const equipment = rawEquip.filter((e: string) => e !== 'bodyweight');
  const equipStr = equipment.length > 0
    ? `Set up with ${equipment.map((e: string) => e.replace(/_/g, ' ')).join(' and ')}.`
    : 'No equipment required — bodyweight only.';
  const positionMap: Record<string, string> = {
    standing: 'Feet shoulder-width apart, spine tall.',
    seated: 'Sit upright, back supported, feet flat.',
    supine: 'Lie on your back, neutral spine.',
    prone: 'Lie face down, body fully extended.',
    incline: 'Set bench to target incline before loading.',
    decline: 'Set bench to decline, feet secured.',
    hanging: 'Grip bar shoulder-width, arms extended.',
    kneeling: 'Kneel, hips over knees, spine neutral.',
    quadruped: 'All fours — hands under shoulders, knees under hips.',
    side_lying: 'Lie on your side, body in a straight line.',
  };
  const posStr = positionMap[ref.position ?? ''] ?? '';
  const unilateral = (ref.is_unilateral ?? false) ? ' Unilateral — complete all reps before switching.' : '';
  return `${equipStr}${posStr ? ' ' + posStr : ''}${unilateral}`.trim();
}

function generateSteps(ref: any, exerciseName?: string): string[] {
  if (!ref) {
    if (exerciseName) return [
      `Get into starting position for ${exerciseName}.`,
      'Move with full control and intentional muscle engagement.',
      'Complete all reps maintaining consistent form.',
    ];
    return ['Set up with appropriate equipment.', 'Perform the movement with control.', 'Complete all prescribed reps.'];
  }

  // If the database provides explicit steps, prefer them.
  if (Array.isArray(ref.steps) && ref.steps.length > 0) {
    return ref.steps
      .map((s: string) => String(s).trim())
      .filter(Boolean)
      .slice(0, 6);
  }

  if (ref.description && !ref.movement_pattern && !ref.movementPattern) {
    const desc: string = ref.description;
    const sentences = desc.split(/\.\s+/).map((s: string) => s.trim()).filter(Boolean);
    return sentences.slice(0, 4).map((s: string) => s.endsWith('.') ? s : `${s}.`);
  }

  const name = exerciseName || ref.name || 'this exercise';
  const pattern: string = ref.movement_pattern ?? ref.movementPattern ?? '';
  const position: string = ref.position ?? '';
  const rawEquip: string[] = ref.equipment_required ?? ref.equipment ?? [];
  const equip = rawEquip.filter((e: string) => e !== 'bodyweight');
  const primaryMuscles: string[] = ref.primary_muscles ?? ref.primaryMuscles ?? [];
  const isUnilateral: boolean = ref.is_unilateral ?? false;
  const isCompound: boolean = ref.is_compound ?? true;
  const difficulty: string = ref.difficulty_tier ?? 'intermediate';

  const mainEquip = equip.length > 0 ? fmt(equip[0]) : null;
  const primaryStr = primaryMuscles.slice(0, 2).map(fmt).join(' and ');

  const positionDesc: Record<string, string> = {
    standing: 'Stand hip-width, spine tall, core lightly braced.',
    seated: 'Sit upright, back flat against the pad, feet planted.',
    supine: 'Lie flat, neutral spine, head down, feet flat.',
    prone: 'Lie face down, body fully extended.',
    incline: 'Set bench to angle, sit back firmly against pad.',
    decline: 'Secure feet, lie back, spine neutral.',
    hanging: 'Hang full extension, shoulder-width grip.',
    kneeling: 'Kneel on mat, hips over knees, spine neutral.',
    quadruped: 'All fours — hands under shoulders, knees under hips.',
    side_lying: 'Lie on side, straight line head to heels.',
  };

  const steps: string[] = [];

  if (pattern === 'cardio') {
    if (mainEquip) steps.push(`Set up on the ${mainEquip} at target resistance.`);
    else steps.push('Establish pacing target before beginning.');
    steps.push('Warm up at easy pace for 60 seconds, then increase output.');
    steps.push('Hold target effort — steady breathing, consistent cadence.');
    steps.push('Ease off gradually in the final minute.');
    return steps;
  }

  if (pattern === 'mobility') {
    const posDesc = positionDesc[position];
    if (posDesc) steps.push(posDesc);
    steps.push(`Move into ${name} slowly — only to pain-free range.`);
    steps.push('Breathe deeply; exhale to soften and release each time.');
    if (isUnilateral) steps.push('Hold prescribed time, then mirror on the other side.');
    else steps.push('Hold end position with active muscular control.');
    return steps;
  }

  if (pattern === 'pilates') {
    steps.push('Find neutral spine, activate deep core (TVA) before moving.');
    steps.push(`Inhale to prepare, exhale to initiate ${name} — breath drives everything.`);
    steps.push('Precision over range: controlled always beats large and sloppy.');
    if (isUnilateral) steps.push('Complete reps one side, match quality before switching.');
    return steps;
  }

  if (pattern === 'plyometric') {
    steps.push('Athletic stance — knees soft, weight balanced, ready to explode.');
    steps.push(`Initiate ${name} generating maximal force in minimal time.`);
    steps.push('Land soft — absorb through ankles, knees, hips in sequence.');
    if (difficulty === 'advanced') steps.push('Minimize ground contact, reset explosively each rep.');
    else steps.push('Full reset between reps — quality first.');
    return steps;
  }

  if (pattern === 'carry') {
    if (mainEquip) steps.push(`Pick up the ${mainEquip} with firm neutral grip, brace before lifting.`);
    else steps.push('Firm grip on implement, core braced before moving.');
    steps.push('Shoulders packed, ribcage over hips — no lean.');
    steps.push('Deliberate pace, smooth steps, no lateral sway.');
    steps.push('Set down under control by hinging at the hips.');
    return steps;
  }

  const posDesc = positionDesc[position] ?? '';
  if (mainEquip && posDesc) {
    steps.push(`${mainEquip} in hand. ${posDesc}`);
  } else if (mainEquip) {
    steps.push(`Grip the ${mainEquip} and establish starting position.`);
  } else if (posDesc) {
    steps.push(posDesc);
  } else {
    steps.push(`Start position for ${name} — stable, balanced base.`);
  }

  if (isCompound) {
    steps.push('Belly breath in, brace core hard, stabilize before moving.');
  } else {
    steps.push(`Lock body still — only the target joint moves. ${primaryStr || 'Target muscle'} does all the work.`);
  }

  const movementCues: Record<string, string> = {
    push: `Press through full range — ${primaryStr || 'chest and shoulders'} drive it, not the joints.`,
    pull: `Lead with elbows toward body — ${primaryStr || 'lats and back'} pull, hands just hold.`,
    hinge: `Push hips back (not down) — load ${primaryStr || 'hamstrings and glutes'} through full stretch, back flat.`,
    squat: `Knees out in line with toes, load ${primaryStr || 'quads and glutes'} — reach parallel or full depth.`,
    lunge: `Drop back knee toward floor with control — ${primaryStr || 'glutes and quads'} drive every inch.`,
    rotation: `Core initiates the turn — ${primaryStr || 'obliques'} rotate, eyes and chest move together.`,
    isolation: `Full range at target joint, ${primaryStr || 'target muscle'} contracted deliberately — slow beats sloppy.`,
  };

  steps.push(movementCues[pattern] ?? `Full range of motion for ${name}, ${primaryStr || 'target muscles'} under tension.`);

  if (pattern === 'hinge') {
    steps.push('Drive hips forward to standing with hard glute squeeze — no lower back hyperextension.');
  } else if (isCompound) {
    steps.push(`Full extension at top — feel ${primaryStr || 'target muscles'} contract before reversing.`);
  } else {
    steps.push(`Pause at peak, squeeze hard, then return under full control.`);
  }

  if (isUnilateral) {
    steps.push('All reps on one side before switching — match quality on both.');
  } else if (difficulty === 'advanced') {
    steps.push('Slow negative — eccentric builds as much strength as the lift.');
  } else {
    steps.push('Control the negative — never let momentum or gravity take over.');
  }

  return steps.slice(0, 4);
}

function get1RMTip(pattern: string): string {
  const tips: Record<string, string> = {
    push: 'Train heavy triples weekly and use leg drive into the floor — the 1RM is a neural event, not just muscle size.',
    pull: 'Weighted pulls in the 3–5 rep range build your max fastest. Drive elbows to hips, not just chin over the bar.',
    hinge: 'Brace before the bar leaves the floor and lock your lats hard. Deficit pulls deepen your strength from the bottom.',
    squat: 'Work pause squats to kill the bounce and own the hole — that is where 1RMs are won or lost.',
    lunge: 'Heavy step-ups and split squats build single-leg power fast — bilateral max follows directly.',
    rotation: 'Anti-rotation loading and heavy landmine work build rotational ceiling strength quickly.',
    isolation: 'Add a 2-second pause at peak contraction and slow negatives — that is where isolation lifts grow their max.',
    plyometric: 'Increase power output with loaded jumps and depth drops at low volume — rate of force development is the ceiling.',
    cardio: 'Interval work near lactate threshold raises your aerobic ceiling and improves sustained output.',
    mobility: 'Gradually extend hold time and active range each session — mobility PRs come from daily consistency.',
  };
  return tips[pattern] ?? 'Work in the 1–3 rep range at 85–95% weekly to train your nervous system for max output.';
}

interface ExerciseHistoryPoint {
  date: string;
  orm: number;
}

function getExerciseHistory(
  exerciseName: string,
  workoutHistory: WorkoutLog[],
): ExerciseHistoryPoint[] {
  const results: ExerciseHistoryPoint[] = [];
  for (const log of workoutHistory) {
    const exerciseLog = log.exercises.find(
      e => e.exerciseName.toLowerCase() === exerciseName.toLowerCase()
    );
    if (!exerciseLog) continue;
    const doneSets = exerciseLog.sets.filter(s => s.done && s.weight > 0 && s.reps > 0);
    if (doneSets.length === 0) continue;
    let bestOrm = 0;
    for (const set of doneSets) {
      const orm = set.weight * (1 + set.reps / 30);
      if (orm > bestOrm) bestOrm = orm;
    }
    results.push({ date: log.date, orm: Math.round(bestOrm) });
    if (results.length >= 5) break;
  }
  return results.reverse();
}

function calcNextTarget(best1RM: number): number {
  const weight5 = best1RM / (1 + 5 / 30);
  return Math.round(weight5 / 5) * 5 + 5;
}

function fmtDate(d: string): string {
  const parts = d.split('-');
  if (parts.length < 3) return d;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(parts[1], 10) - 1]} ${parseInt(parts[2], 10)}`;
}

// ─── Sparkline ───────────────────────────────────────────────────────────────

interface SparklineProps {
  data: ExerciseHistoryPoint[];
  accent: string;
  textMuted: string;
}

function Sparkline({ data, accent, textMuted }: SparklineProps) {
  const [containerWidth, setContainerWidth] = useState<number>(280);
  const graphHeight = 60;
  const padX = 10;
  const padY = 8;

  const minVal = Math.min(...data.map(d => d.orm));
  const maxVal = Math.max(...data.map(d => d.orm));
  const range = maxVal - minVal || 1;

  const pts = useMemo(() => data.map((d, i) => {
    const x = padX + (data.length > 1 ? (i / (data.length - 1)) : 0.5) * (containerWidth - padX * 2);
    const y = padY + (1 - (d.orm - minVal) / range) * (graphHeight - padY * 2);
    return { x, y, date: d.date, orm: d.orm };
  }), [data, containerWidth, minVal, range]);

  const polyPoints = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <View onLayout={e => setContainerWidth(e.nativeEvent.layout.width)} style={sparkStyles.container}>
      <Svg width={containerWidth} height={graphHeight} style={sparkStyles.svg}>
        {pts.length > 1 && (
          <Polyline
            points={polyPoints}
            fill="none"
            stroke={accent}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.9}
          />
        )}
        {pts.map((p, i) => (
          <SvgCircle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3.5}
            fill={accent}
          />
        ))}
      </Svg>
      <View style={sparkStyles.labelRow}>
        {pts.map((p, i) => (
          <Text key={i} style={[sparkStyles.label, { color: textMuted }]}>
            {fmtDate(p.date)}
          </Text>
        ))}
      </View>
      <View style={sparkStyles.ormRow}>
        {pts.map((p, i) => (
          <Text key={i} style={[sparkStyles.ormLabel, { color: textMuted }]}>
            {p.orm}
          </Text>
        ))}
      </View>
    </View>
  );
}

const sparkStyles = StyleSheet.create({
  container: { width: '100%' },
  svg: { display: 'flex' },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  label: {
    fontSize: 9,
    fontWeight: '500' as const,
    textAlign: 'center' as const,
    flex: 1,
  },
  ormRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 1,
  },
  ormLabel: {
    fontSize: 9,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
    flex: 1,
  },
});

// ─── Main Component ──────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  exercise: WorkoutExercise | null;
  workoutStyle: string;
  onClose: () => void;
  onBack?: () => void;
}

export default function ExerciseDetailDrawer({ visible, exercise, workoutStyle, onClose, onBack }: Props) {
  const { colors, accent } = useZealTheme();
  const ctx = useAppContext();
  const { hasPro, openPaywall } = useSubscription();
  const { workoutHistory } = useWorkoutTracking();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const { snapPoints, maxDynamicContentSize, topOffset, scrollEnabled, setContentH } = useDrawerSizing({ minHeight: 480 });
  const styleAccent = WORKOUT_STYLE_COLORS[workoutStyle] ?? accent;

  useEffect(() => {
    if (visible && exercise) {
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible, exercise]);

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

  const canonical = useMemo<ZealExercise | null>(() => {
    if (!exercise) return null;
    try {
      const db = getZealExerciseDatabase();
      const id = (exercise.exerciseRef?.id ?? '').trim();
      const name = (exercise.name ?? '').trim().toLowerCase();
      if (id) {
        const byId = db.find((e) => e.id === id) ?? null;
        if (byId) return byId;
      }
      // Exact name or alias match
      const byName =
        db.find((e) => e.name.trim().toLowerCase() === name) ??
        db.find((e) => (e.aliases ?? []).some((a) => a.trim().toLowerCase() === name)) ??
        null;
      if (byName) return byName;
      // Fallback: strip parentheticals and equipment qualifiers then retry
      // e.g. "Standing Overhead Press (Barbell)" → "standing overhead press"
      const nameNoParens = name.replace(/\s*\([^)]*\)/g, '').trim();
      if (nameNoParens && nameNoParens !== name) {
        const byStripped =
          db.find((e) => e.name.trim().toLowerCase() === nameNoParens) ??
          db.find((e) => (e.aliases ?? []).some((a) => a.trim().toLowerCase() === nameNoParens)) ??
          null;
        if (byStripped) return byStripped;
      }
      // Final fallback: substring contains match (e.g. "Cable Tricep Rope Pushdown" ⊃ "Cable Tricep Pushdown")
      const byContains =
        db.find((e) => name.includes(e.name.trim().toLowerCase())) ??
        db.find((e) => (e.aliases ?? []).some((a) => name.includes(a.trim().toLowerCase()))) ??
        null;
      return byContains;
    } catch {
      return null;
    }
  }, [exercise?.exerciseRef?.id, exercise?.name]);

  if (!exercise) return null;

  const ref = exercise.exerciseRef;
  const pref = ctx.exercisePreferences[exercise.id] ?? 'neutral';
  const isLiked = pref === 'liked';
  const isDisliked = pref === 'disliked';

  function handlePrefToggle(p: 'liked' | 'disliked') {
    if (!hasPro) {
      showProGate('exercisePrefs', openPaywall);
      return;
    }
    const current = ctx.exercisePreferences[exercise!.id] ?? 'neutral';
    const next: 'liked' | 'disliked' | 'neutral' = current === p ? 'neutral' : p;
    ctx.saveExercisePreferences({ ...ctx.exercisePreferences, [exercise!.id]: next });
  }

  const primaryMuscles: string[] = (ref?.primary_muscles ?? ref?.primaryMuscles ?? []);
  const secondaryMuscles: string[] = (ref?.secondary_muscles ?? ref?.secondaryMuscles ?? []);
  const movementPattern: string = ref?.movement_pattern ?? ref?.movementPattern ?? '';
  const setupText = generateSetup(ref);
  const steps = generateSteps(ref, exercise.name);
  const equipDisplay = exercise.equipment === 'Bodyweight'
    ? 'Bodyweight'
    : exercise.equipment.replace(/_/g, ' ');

  const exerciseHistory = getExerciseHistory(exercise.name, workoutHistory);
  const hasHistory = exerciseHistory.length >= 2;
  const bestOrm = exerciseHistory.length > 0
    ? Math.max(...exerciseHistory.map(h => h.orm))
    : null;
  const nextTarget = bestOrm ? calcNextTarget(bestOrm) : null;
  const tip = get1RMTip(movementPattern);

  const currentOrmStr = estimate1RM(exercise.suggestedWeight, exercise.reps);

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      maxDynamicContentSize={maxDynamicContentSize}
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      backgroundStyle={[styles.sheetBg, { backgroundColor: colors.card }]}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
      enablePanDownToClose
      enableOverDrag={false}
      topInset={topOffset}
      stackBehavior="push"
    >
      <DrawerHeader
        title={exercise?.name ?? ''}
        onBack={onBack}
        onClose={onBack ? undefined : onClose}
      />
      <BottomSheetScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        scrollEnabled={scrollEnabled}
        contentContainerStyle={styles.content}
        onContentSizeChange={(_w: number, h: number) => setContentH(h)}
      >
        {/* ── Animation ── */}
        <ExerciseAnimationView
          exerciseName={canonical?.name ?? exercise.name}
          exerciseId={canonical?.id ?? exercise.exerciseRef?.id}
          aliases={canonical?.aliases}
          cardBg={colors.card}
        />

        {/* ── Header: name + like/dislike ── */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={[styles.exerciseName, { color: colors.text }]}>{exercise.name}</Text>
            {currentOrmStr ? (
              <Text style={[styles.ormLine, { color: styleAccent }]}>{currentOrmStr} est. 1RM</Text>
            ) : null}
          </View>
          <View style={styles.prefButtons}>
            <TouchableOpacity
              style={[
                styles.prefBtn,
                { borderColor: isLiked ? '#22c55e' : colors.border },
                isLiked && { backgroundColor: '#22c55e' },
              ]}
              onPress={() => handlePrefToggle('liked')}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ThumbsUp size={15} color={isLiked ? '#fff' : colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.prefBtn,
                { borderColor: isDisliked ? '#ef4444' : colors.border },
                isDisliked && { backgroundColor: '#ef4444' },
              ]}
              onPress={() => handlePrefToggle('disliked')}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ThumbsDown size={15} color={isDisliked ? '#fff' : colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 1RM Trend ── */}
        <View style={styles.sectionRow}>
          <TrendingUp size={13} color={styleAccent} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>1RM TREND</Text>
        </View>
        <View style={[styles.trendCard, { backgroundColor: colors.cardSecondary }]}>
          {hasHistory ? (
            <>
              <Sparkline
                data={exerciseHistory}
                accent={styleAccent}
                textMuted={colors.textMuted}
              />
              {nextTarget !== null && (
                <View style={[styles.nextTargetRow, { borderTopColor: colors.border }]}>
                  <Text style={[styles.nextTargetLabel, { color: colors.textMuted }]}>NEXT TARGET</Text>
                  <Text style={[styles.nextTargetValue, { color: styleAccent }]}>
                    {nextTarget} lb × 5 reps
                  </Text>
                  <Text style={[styles.nextTargetSub, { color: colors.textMuted }]}>to beat your PR</Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.noHistoryRow}>
              <Text style={[styles.noHistoryText, { color: colors.textMuted }]}>
                Complete this exercise to start tracking your 1RM trend.
              </Text>
              {currentOrmStr ? (
                <Text style={[styles.noHistorySub, { color: styleAccent }]}>
                  Today&apos;s estimate: {currentOrmStr}
                </Text>
              ) : null}
            </View>
          )}
        </View>

        {/* ── Muscles Worked ── */}
        {primaryMuscles.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <Target size={13} color={styleAccent} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>MUSCLES WORKED</Text>
            </View>
            <View style={[styles.muscleCard, { backgroundColor: colors.cardSecondary }]}>
              <View style={styles.muscleCardSection}>
                <Text style={[styles.muscleGroupLabel, { color: colors.textMuted }]}>PRIMARY</Text>
                <View style={styles.tagRow}>
                  {primaryMuscles.map((m: string) => (
                    <View key={m} style={[styles.muscleTag, { borderColor: styleAccent, backgroundColor: `${styleAccent}15` }]}>
                      <Text style={[styles.muscleTagText, { color: styleAccent }]}>{m.replace(/_/g, ' ')}</Text>
                    </View>
                  ))}
                </View>
              </View>
              {secondaryMuscles.length > 0 && (
                <>
                  <View style={[styles.muscleDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.muscleCardSection}>
                    <Text style={[styles.muscleGroupLabel, { color: colors.textMuted }]}>SECONDARY</Text>
                    <View style={styles.tagRow}>
                      {secondaryMuscles.map((m: string) => (
                        <View key={m} style={[styles.muscleTag, { borderColor: colors.border }]}>
                          <Text style={[styles.muscleTagText, { color: colors.textSecondary }]}>{m.replace(/_/g, ' ')}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </>
              )}
            </View>
          </>
        )}

        {/* ── How to Perform ── */}
        <View style={styles.sectionRow}>
          <Lightbulb size={13} color={styleAccent} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>HOW TO PERFORM</Text>
        </View>
        <View style={[styles.infoBox, { backgroundColor: colors.cardSecondary }]}>
          <Text style={[styles.equipmentLabel, { color: colors.textMuted }]}>
            {equipDisplay}
          </Text>
          <View style={styles.stepRow}>
            <View style={[styles.stepNum, { backgroundColor: styleAccent }]}>
              <Text style={styles.stepNumText}>S</Text>
            </View>
            <Text style={[styles.stepText, { color: colors.text }]}>
              {setupText}
            </Text>
          </View>
          {steps.map((step: string, idx: number) => (
            <View key={idx} style={styles.stepRow}>
              <View style={[styles.stepNum, { backgroundColor: styleAccent }]}>
                <Text style={styles.stepNumText}>{idx + 1}</Text>
              </View>
              <Text style={[styles.stepText, { color: colors.text }]}>{step}</Text>
            </View>
          ))}
        </View>

        {/* ── 1RM Tip ── */}
        <View style={[styles.tipRow, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
          <Zap size={13} color={styleAccent} strokeWidth={2.5} />
          <Text style={[styles.tipText, { color: colors.textSecondary }]}>{tip}</Text>
        </View>

        <View style={{ height: 36 }} />
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetBg: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  content: {
    paddingHorizontal: 20,
    gap: 10,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 2,
  },
  headerLeft: {
    flex: 1,
    gap: 3,
  },
  exerciseName: {
    fontSize: 22,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.5,
  },
  ormLine: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  prefButtons: {
    flexDirection: 'row',
    gap: 7,
    paddingTop: 4,
  },
  prefBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 1,
  },
  muscleCard: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  muscleCardSection: {
    padding: 12,
    gap: 8,
  },
  muscleGroupLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    letterSpacing: 0.8,
  },
  muscleDivider: {
    height: 1,
    marginHorizontal: 12,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 5,
    flexWrap: 'wrap',
    marginTop: -2,
  },
  muscleTag: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1.5,
  },
  muscleTagText: {
    fontSize: 11,
    fontWeight: '600' as const,
    textTransform: 'capitalize' as const,
  },
  trendCard: {
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  nextTargetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    paddingTop: 10,
    flexWrap: 'wrap',
  },
  nextTargetLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    letterSpacing: 0.8,
  },
  nextTargetValue: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  nextTargetSub: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
  noHistoryRow: {
    gap: 4,
    paddingVertical: 4,
  },
  noHistoryText: {
    fontSize: 12,
    lineHeight: 17,
  },
  noHistorySub: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  infoBox: {
    borderRadius: 12,
    padding: 12,
    gap: 9,
  },
  equipmentLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    letterSpacing: 0.4,
    textTransform: 'capitalize' as const,
  },
  infoText: {
    fontSize: 12,
    lineHeight: 18,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  stepNum: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  stepNumText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700' as const,
  },
  stepText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontStyle: 'italic' as const,
  },
});
