import { generateObject } from '@rork-ai/toolkit-sdk';
import { z } from 'zod';
import type {
  GeneratedWorkout,
  WorkoutExercise,
  WarmupItem,
  CooldownItem,
  RecoveryItem,
  GenerateWorkoutParams,
} from '@/services/workoutEngine';
import { generateWorkout } from '@/services/workoutEngine';
import type { DayPrescription } from '@/services/planEngine';

console.log('[AIWorkoutGenerator] AI workout generator loaded');

export const AI_POWERED_STYLES = new Set(['CrossFit', 'Mobility', 'HIIT', 'Pilates', 'Low-Impact']);
export const AI_PRO_STYLES = new Set(['Strength', 'Bodybuilding']);

const WarmupItemSchema = z.object({
  name: z.string().describe('Warm-up exercise name'),
  description: z.string().describe('Brief coaching cue or instruction'),
  swappable: z.boolean().describe('Whether this can be swapped'),
});

const CooldownItemSchema = z.object({
  name: z.string().describe('Cool-down movement or stretch name'),
  description: z.string().describe('Brief instruction'),
});

const RecoveryItemSchema = z.object({
  name: z.string().describe('Recovery technique'),
  description: z.string().describe('What to do'),
  benefit: z.string().describe('Why it helps recovery'),
});

const CardioItemSchema = z.object({
  name: z.string(),
  duration: z.string(),
  format: z.string(),
  rpe: z.string(),
  notes: z.string(),
});

const ExerciseSchema = z.object({
  name: z.string().describe('Exercise name'),
  sets: z.number().int().min(1).max(10).describe('Number of sets'),
  reps: z.string().describe("e.g. '10', '12-15', 'AMRAP', '45s', '30s'"),
  rest: z.string().describe("e.g. '60s', '90s', '2:00', ':30', 'None'"),
  muscleGroup: z.string().describe("Primary muscle group e.g. 'Core', 'Glutes', 'Full Body'"),
  equipment: z.string().describe("e.g. 'Bodyweight', 'Dumbbell', 'Kettlebell', 'Resistance Band'"),
  notes: z.string().describe('One brief coaching cue'),
  movementType: z
    .enum(['heavyCompound', 'moderateCompound', 'isolation', 'circuit'])
    .describe('Movement classification'),
  groupType: z
    .enum(['superset', 'circuit', 'rounds'])
    .nullable()
    .describe('Grouping type or null if standalone'),
  groupId: z
    .string()
    .nullable()
    .describe("Group ID like 'round_1', 'circuit_a' or null"),
  suggestedWeight: z.string().describe("e.g. 'Bodyweight', '15-25 lbs', 'Light resistance'"),
});

const AIWorkoutSchema = z.object({
  warmup: z.array(WarmupItemSchema).min(3).max(6),
  exercises: z.array(ExerciseSchema).min(3).max(20),
  cooldown: z.array(CooldownItemSchema).min(2).max(5),
  recovery: z.array(RecoveryItemSchema).min(2).max(4),
  cardio: z.array(CardioItemSchema),
  estimatedDuration: z.number().int().min(10).max(180).describe('Total duration in minutes'),
  metconFormat: z.string().nullable().describe("MetCon format e.g. 'AMRAP', 'EMOM', 'RFT' or null"),
  metconTimeCap: z.number().int().nullable().describe('Time cap in minutes or null'),
  metconRounds: z.number().int().nullable().describe('Number of rounds or null'),
});

export function getAIStyles(hasPro: boolean): Set<string> {
  if (hasPro) {
    return new Set([...AI_POWERED_STYLES, ...AI_PRO_STYLES]);
  }
  return AI_POWERED_STYLES;
}

const STYLE_GUIDES: Record<string, string> = {
  CrossFit: `Create a CrossFit-style workout featuring a MetCon (metabolic conditioning) component. 
Choose one primary format: AMRAP (As Many Rounds As Possible), EMOM (Every Minute On the Minute), RFT (Rounds For Time), or Chipper.
Use functional movements: box jumps, kettlebell swings, burpees, wall balls, pull-ups, push-ups, thrusters, power cleans, double-unders, rowing, air squats, toes-to-bar, handstand push-ups.
Group MetCon exercises with groupType 'rounds' and a shared groupId. Set metconFormat, metconTimeCap, and metconRounds appropriately.
Warm-up should prime the specific movements used in the workout.`,
  Mobility: `Create a mobility and flexibility session designed to improve joint range of motion and movement quality.
Use movements like: hip 90/90, pigeon pose, thoracic rotations, shoulder CARs, ankle circles, hip circles, world's greatest stretch, lizard pose, cat-cow, leg swings, banded distraction, couch stretch.
Organize by body region (hips, spine, shoulders, ankles). Sets should be 1-2, reps in time format ('30s', '45s', '60s'). 
Rest should be minimal (':15', ':20'). Group related movements with groupType 'circuit' and a shared groupId.
metconFormat, metconTimeCap, metconRounds should all be null.`,
  HIIT: `Create a HIIT (High Intensity Interval Training) workout with clearly defined work/rest intervals.
Use exercises: burpees, mountain climbers, jump squats, high knees, jumping jacks, push-ups, squat jumps, lateral shuffles, plank holds, sprint intervals, speed skaters, box step-ups.
Structure as interval blocks: group exercises with groupType 'circuit'. Work periods intense (20-40s), rest short (:10-:30).
Set metconFormat to 'Tabata' or 'Circuit' as appropriate. Keep rest periods explicit and short.
Scale difficulty based on fitness level.`,
  Pilates: `Create a Pilates session focused on core strength, pelvic stability, and controlled movement.
Use exercises: Hundred, Roll-Up, Single Leg Stretch, Double Leg Stretch, Crisscross, Leg Circles, Bridge, Clam Shell, Side-Lying Leg Lifts, Swimming, Bird-Dog, Plank, Side Plank, Roll Like a Ball, Spine Stretch Forward, Swan.
Reps moderate (8-12), rest minimal ('None' or ':15'). Group related exercises by body region using groupType 'circuit'.
Notes should emphasize breath and muscle connection. metconFormat, metconTimeCap, metconRounds all null.`,
  'Low-Impact': `Create a low-impact workout that is joint-friendly with no jumping or high-impact movements.
Use exercises: standing leg raises, wall push-ups, chair squats, step touches, modified lunges, resistance band rows, light dumbbell curls, seated marches, balance stands, side steps, gentle squats, floor bridges.
Keep intensity moderate. Reps in normal range (10-15). Rest generous ('60s', '90s').
Suitable for beginners, older adults, or those with joint concerns. metconFormat, metconTimeCap, metconRounds all null.`,
  Strength: `Create a strength-focused training session built around heavy compound movements and progressive overload.
Start with 1 primary lift (squat, deadlift, bench press, overhead press, or row) as the anchor — 3-5 sets, 3-6 reps, heavy weight, full rest (2:00-3:00). Mark as movementType 'heavyCompound'.
Follow with accessory compound movements (Romanian deadlift, Bulgarian split squat, incline press, weighted pull-ups) — 3-4 sets, 6-10 reps, moderate rest (90s). Mark as 'moderateCompound'.
Finish with isolation exercises targeting weaknesses or supporting muscles — 3 sets, 10-15 reps, shorter rest (60s). Mark as 'isolation'.
SuggestedWeight must be specific and percentage-based or RPE-based (e.g., 'RPE 8', '80% 1RM', '185-225 lbs'). Do NOT group as superset/circuit — all exercises standalone (groupType null, groupId null).
metconFormat, metconTimeCap, metconRounds all null.
IMPORTANT: Scale the total number of exercises strictly to the TARGET EXERCISE COUNT specified in REQUIREMENTS.`,
  Bodybuilding: `Create a hypertrophy-focused bodybuilding session targeting the specified muscle group(s) for maximum muscle growth stimulus.
Use moderate-to-heavy weights, 3-5 sets, 8-15 reps, with controlled tempo and mind-muscle connection.
Begin with compound movements as the primary exercises (movementType 'heavyCompound' or 'moderateCompound'). Follow with isolation exercises (movementType 'isolation') hitting the muscle from different angles.
Pair isolation exercises into supersets where it makes sense — use groupType 'superset' and a shared groupId (e.g., 'ss_a').
Rest: 90s-2:00 for compound, 45s-60s for isolation/supersets.
SuggestedWeight should reflect typical hypertrophy loads ('Moderate', '30-50 lbs', 'light-to-moderate resistance band').
Notes should cue the mind-muscle connection specifically (e.g., 'Squeeze at the top', 'Control the eccentric for 3 counts').
metconFormat, metconTimeCap, metconRounds all null.
IMPORTANT: Scale the total number of exercises strictly to the TARGET EXERCISE COUNT specified in REQUIREMENTS.`,
};

function getTargetExerciseCount(style: string, targetDuration: number): { count: number; min: number; max: number } {
  const overhead = 10;
  const net = Math.max(5, targetDuration - overhead);
  let avgMinPerExercise: number;
  switch (style) {
    case 'Strength':       avgMinPerExercise = 8; break;
    case 'Bodybuilding':   avgMinPerExercise = 6.5; break;
    case 'CrossFit':       avgMinPerExercise = 4; break;
    case 'HIIT':           avgMinPerExercise = 4; break;
    case 'Mobility':       avgMinPerExercise = 3.5; break;
    case 'Pilates':        avgMinPerExercise = 4; break;
    case 'Low-Impact':     avgMinPerExercise = 5; break;
    default:               avgMinPerExercise = 5.5;
  }
  const count = Math.min(18, Math.max(3, Math.round(net / avgMinPerExercise)));
  const min = Math.max(3, count - 1);
  const max = Math.min(20, count + 1);
  console.log(`[buildPrompt] style=${style} targetDuration=${targetDuration} → targetExerciseCount=${count} (min=${min} max=${max})`);
  return { count, min, max };
}

function buildPrompt(params: GenerateWorkoutParams): string {
  const {
    style,
    split,
    targetDuration,
    fitnessLevel,
    sex,
    specialLifeCase,
    specialLifeCaseDetail,
    warmUp,
    coolDown,
    recovery,
    addCardio,
    specificMuscles,
    availableEquipment,
  } = params;

  const equipmentList =
    Object.keys(availableEquipment)
      .filter((k) => availableEquipment[k] > 0)
      .join(', ') || 'bodyweight only';

  const musclesFocus =
    specificMuscles.length > 0 ? specificMuscles.join(', ') : split || 'Full Body';

  const injuryNote =
    specialLifeCase && specialLifeCase !== 'none'
      ? `\n- Special consideration: ${specialLifeCase}${specialLifeCaseDetail ? ` — ${specialLifeCaseDetail}` : ''}`
      : '';

  const styleGuide = STYLE_GUIDES[style] ?? `Generate an appropriate ${style} workout.`;
  const { count: targetExerciseCount, min: exMin, max: exMax } = getTargetExerciseCount(style, targetDuration);

  return `You are an expert personal trainer and ${style} coach. Generate a complete, ready-to-use ${style} session.

STYLE GUIDE:
${styleGuide}

USER PROFILE:
- Fitness level: ${fitnessLevel}
- Sex: ${sex}
- Target duration: ${targetDuration} minutes
- Muscle focus: ${musclesFocus}
- Available equipment: ${equipmentList}${injuryNote}

REQUIREMENTS:
- *** TARGET EXERCISE COUNT: ${targetExerciseCount} exercises (between ${exMin} and ${exMax}) — this is MANDATORY and directly derived from the ${targetDuration}-minute duration ***
- Total session must take approximately ${targetDuration} minutes — calibrate sets, reps, and rest accordingly
- For ${targetDuration} minutes: use ${targetExerciseCount} exercises. Do NOT add more or fewer without strong justification from the duration.
- Include warm-up (3-5 items) that specifically primes the muscle groups being trained today: ${musclesFocus}${warmUp ? ' — user has warm-up enabled' : ''}
- Include cool-down (2-4 items) with stretches and mobility work targeting exactly the muscles worked: ${musclesFocus}${coolDown ? ' — user has cool-down enabled' : ''}
- Include recovery recommendations (2-3 items) focused on recovering the muscles trained: ${musclesFocus}${recovery ? ' — user has recovery enabled' : ''}
${addCardio ? '- Add a cardio finisher in the cardio array' : '- Leave cardio array empty'}
- ONLY use equipment available: ${equipmentList}
- Adapt difficulty and volume to ${fitnessLevel} level
- Every exercise must have a specific, actionable coaching cue in the notes field
- Be precise: actual exercise names, exact sets/reps/rest, real weight suggestions`;
}

function deriveMovementPattern(movementType: string): string {
  switch (movementType) {
    case 'heavyCompound':
      return 'squat';
    case 'moderateCompound':
      return 'push';
    case 'isolation':
      return 'core';
    case 'circuit':
      return 'conditioning';
    default:
      return 'core';
  }
}

function normalizeCrossfitRepsForAI(exerciseName: string, repsRaw: string, split: string): string {
  const name = (exerciseName ?? '').toLowerCase();
  const reps = (repsRaw ?? '').trim();
  if (!reps) return reps;

  // If AI already provided explicit units, respect them.
  if (/[a-z]/i.test(reps)) return reps;

  const n = Number.parseInt(reps, 10);
  if (!Number.isFinite(n) || n <= 0) return reps;

  const isPlankLike =
    name.includes('plank') ||
    name.includes('hollow hold') ||
    name.includes('superman hold') ||
    name.includes('l-sit');
  if (isPlankLike) {
    const seconds = Math.max(20, Math.min(120, Math.round(n * 5)));
    return `${seconds}s`;
  }

  const isCarryLike = name.includes('carry');
  if (isCarryLike) {
    const meters = Math.max(20, Math.min(400, Math.round(n * 10)));
    return `${meters}m`;
  }

  // Only convert true rowing-machine work to meters.
  const isRowingMachine =
    name.includes('rowing machine') ||
    name.includes('rower') ||
    name.includes('row erg') ||
    name.includes('rowerg') ||
    name.includes('concept2') ||
    name.includes('erg');
  if (isRowingMachine) {
    // Interpret bare numbers safely:
    // - If it's already a plausible meter number (e.g. 250), treat as meters.
    // - Otherwise treat as "hundreds of meters" like the engine normalization.
    const baseMeters = n >= 100 ? n : Math.round(n * 100);
    const isEmom = split.toLowerCase().trim() === 'emom';
    const meters = isEmom
      ? Math.max(200, Math.min(500, baseMeters))
      : Math.max(200, Math.min(2000, baseMeters));
    return `${meters}m`;
  }

  return reps;
}

export async function generateAIWorkout(params: GenerateWorkoutParams): Promise<GeneratedWorkout> {
  console.log('[AIWorkoutGenerator] Calling AI for style:', params.style, '| duration:', params.targetDuration, 'min | level:', params.fitnessLevel);

  const prompt = buildPrompt(params);

  const result = await generateObject({
    messages: [{ role: 'user', content: prompt }],
    schema: AIWorkoutSchema,
  });

  console.log('[AIWorkoutGenerator] AI returned', result.exercises.length, 'exercises for', params.style);

  const workoutExercises: WorkoutExercise[] = result.exercises.map((ex, i) => ({
    id: `ai_${params.style.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${i}_${Date.now()}`,
    name: ex.name,
    sets: ex.sets,
    reps: params.style === 'CrossFit' ? normalizeCrossfitRepsForAI(ex.name, ex.reps, params.split) : ex.reps,
    rest: ex.rest,
    muscleGroup: ex.muscleGroup,
    equipment: ex.equipment,
    notes: ex.notes,
    type: params.style,
    movementType: ex.movementType,
    groupType: ex.groupType,
    groupId: ex.groupId,
    suggestedWeight: ex.suggestedWeight,
    lastSessionWeight: '',
    lastSessionReps: '',
    exerciseRef: {
      id: `ai_${params.style.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${i}`,
      name: ex.name,
      movementType: ex.movementType,
      movementPattern: deriveMovementPattern(ex.movementType),
      primaryMuscles: [ex.muscleGroup],
      secondaryMuscles: [],
      equipment: ex.equipment.toLowerCase() !== 'bodyweight'
        ? [ex.equipment.toLowerCase().replace(/\s+/g, '_')]
        : [],
      description: ex.name,
      setup: '',
      steps: [],
      styles: [params.style],
      contraindications: [],
    },
  }));

  const warmupItems: WarmupItem[] = result.warmup.map((w) => ({
    name: w.name,
    description: w.description,
    swappable: w.swappable,
  }));

  const cooldownItems: CooldownItem[] = result.cooldown.map((c) => ({
    name: c.name,
    description: c.description,
  }));

  const recoveryItems: RecoveryItem[] = result.recovery.map((r) => ({
    name: r.name,
    description: r.description,
    benefit: r.benefit,
  }));

  return {
    warmup: warmupItems,
    workout: workoutExercises,
    cardio: result.cardio,
    cooldown: cooldownItems,
    recovery: recoveryItems,
    estimatedDuration: result.estimatedDuration,
    style: params.style,
    split: params.split || 'Full Body',
    metconFormat: result.metconFormat,
    metconTimeCap: result.metconTimeCap,
    metconRounds: result.metconRounds,
  };
}

const CoreFinisherSchema = z.object({
  exercises: z.array(ExerciseSchema).min(3).max(5),
});

export async function generateCoreFinisher(params: {
  fitnessLevel: string;
  sex: string;
  availableEquipment: Record<string, number>;
}): Promise<WorkoutExercise[]> {
  const equipmentList =
    Object.keys(params.availableEquipment)
      .filter((k) => params.availableEquipment[k] > 0)
      .join(', ') || 'bodyweight only';

  const prompt = `You are an expert personal trainer. Generate a short core finisher circuit of 3-5 exercises targeting the abdominals and core muscles.

USER PROFILE:
- Fitness level: ${params.fitnessLevel}
- Sex: ${params.sex}
- Available equipment: ${equipmentList}

REQUIREMENTS:
- 3-5 exercises total
- Target muscles: abs, core, obliques
- This is added AFTER a full workout — keep it short and focused
- Prioritize bodyweight movements (planks, hollow holds, leg raises, crunches, ab wheel, etc.)
- Sets: 2-3 per exercise
- Reps: 10-20 or time-based ("30s", "45s") where appropriate
- Rest: short ("30s" between exercises)
- Scale difficulty to ${params.fitnessLevel} level
- Every exercise must have a specific, actionable coaching cue in notes
- All groupType should be null (standalone exercises)
- All groupId should be null`;

  console.log('[generateCoreFinisher] Generating AI core finisher for level:', params.fitnessLevel);

  const result = await generateObject({
    messages: [{ role: 'user', content: prompt }],
    schema: CoreFinisherSchema,
  });

  console.log('[generateCoreFinisher] AI returned', result.exercises.length, 'core exercises');

  return result.exercises.map((ex, i) => ({
    id: `core_finisher_${i}_${Date.now()}`,
    name: ex.name,
    sets: ex.sets,
    reps: ex.reps,
    rest: ex.rest,
    muscleGroup: ex.muscleGroup,
    equipment: ex.equipment,
    notes: ex.notes,
    type: 'Core',
    movementType: ex.movementType,
    groupType: null as null,
    groupId: null as null,
    suggestedWeight: ex.suggestedWeight,
    lastSessionWeight: '',
    lastSessionReps: '',
    exerciseRef: {
      id: `core_finisher_ref_${i}`,
      name: ex.name,
      movementType: ex.movementType,
      movementPattern: 'core',
      primaryMuscles: ['Core'],
      secondaryMuscles: [],
      equipment: [],
      description: ex.name,
      setup: '',
      steps: [],
      styles: ['Core'],
      contraindications: [],
    },
  }));
}

export async function generateWorkoutAsync(
  params: GenerateWorkoutParams,
  prescription?: DayPrescription | null,
  hasPro?: boolean,
): Promise<GeneratedWorkout> {
  const aiStyles = getAIStyles(hasPro ?? false);
  if (aiStyles.has(params.style)) {
    try {
      return await generateAIWorkout(params);
    } catch (err) {
      console.log('[generateWorkoutAsync] AI generation failed, falling back to rule engine. Error:', err);
    }
  }
  return generateWorkout(params, prescription);
}
