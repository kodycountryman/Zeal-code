// ─────────────────────────────────────────────────────────────────────────────
// AI Enhancement Layer for Workout Generation
// ─────────────────────────────────────────────────────────────────────────────
// The rule engine (workoutEngine.ts) is the sole exercise selection path.
// AI is used ONLY for:
//   1. Core finisher generation
//   2. CrossFit MetCon format creativity
//   3. Style grouping enforcement (for cached workouts)
// AI never selects, substitutes, or reorders main workout exercises.
// ─────────────────────────────────────────────────────────────────────────────

import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

const gemini = google('gemini-2.0-flash');

import type {
  GeneratedWorkout,
  WorkoutExercise,
  GenerateWorkoutParams,
} from '@/services/workoutEngine';
import { generateWorkout } from '@/services/workoutEngine';
import type { DayPrescription } from '@/services/planEngine';

// ─── Main Generation Entry Point ─────────────────────────────────────────────

export function generateWorkoutAsync(
  params: GenerateWorkoutParams,
  prescription?: DayPrescription | null,
  _hasPro?: boolean,
): GeneratedWorkout {
  // All workout generation goes through the rule engine.
  // The exercise database is the single source of truth — exercises are filtered
  // by style, split (via SPLIT_TO_MUSCLES), equipment, and contraindications.
  // Split enforcement is structural: an exercise physically cannot appear in the
  // wrong split because its primary_muscles don't match the target muscle list.
  return generateWorkout(params, prescription);
}

// ─── Style Grouping Enforcement ──────────────────────────────────────────────
// Applied to cached workouts to ensure grouping rules match the style.

export function enforceStyleGrouping<T extends { groupType: string | null; groupId: string | null }>(exercises: T[], style: string): T[] {
  switch (style) {
    case 'Strength': {
      return exercises.map(ex => ({ ...ex, groupType: null, groupId: null }));
    }
    case 'Bodybuilding': {
      const allowedGroups = new Set<string>();
      return exercises.map(ex => {
        if (ex.groupType === 'superset' && ex.groupId) {
          if (!allowedGroups.has(ex.groupId)) {
            if (allowedGroups.size >= 2) {
              return { ...ex, groupType: null, groupId: null };
            }
            allowedGroups.add(ex.groupId);
          }
        }
        return ex;
      });
    }
    case 'CrossFit': {
      return exercises.map(ex =>
        ex.groupType === 'rounds' ? ex : { ...ex, groupType: null, groupId: null },
      );
    }
    case 'HIIT':
    case 'Mobility':
    case 'Pilates': {
      return exercises.map(ex =>
        ex.groupType === 'circuit' ? ex : { ...ex, groupType: null, groupId: null },
      );
    }
    case 'Hybrid': {
      return exercises.map(ex =>
        ex.groupType === 'circuit' ? ex : { ...ex, groupType: null, groupId: null },
      );
    }
    case 'Low-Impact': {
      return exercises.map(ex => ({ ...ex, groupType: null, groupId: null }));
    }
    default:
      return exercises;
  }
}

// ─── Core Finisher (AI-generated) ────────────────────────────────────────────

const CoreExerciseSchema = z.object({
  name: z.string().describe('Exercise name'),
  sets: z.number().int().min(1).max(10).describe('Number of sets'),
  reps: z.string().describe("e.g. '10', '12-15', 'AMRAP', '45s', '30s'"),
  rest: z.string().describe("e.g. '60s', '90s', '2:00', ':30', 'None'"),
  muscleGroup: z.string().describe("Primary muscle group e.g. 'Core', 'Obliques'"),
  equipment: z.string().describe("e.g. 'Bodyweight', 'Ab Wheel'"),
  notes: z.string().describe('One brief coaching cue'),
  movementType: z
    .enum(['heavyCompound', 'moderateCompound', 'isolation', 'circuit'])
    .describe('Movement classification'),
  suggestedWeight: z.string().describe("e.g. 'Bodyweight', '10 lbs'"),
});

const CoreFinisherSchema = z.object({
  exercises: z.array(CoreExerciseSchema).min(3).max(5),
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

  const { object: result } = await generateObject({
    model: gemini,
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
      movement_pattern: 'isolation',
      equipment_required: [],
    },
  }));
}

// ─── CrossFit MetCon AI Enhancement ──────────────────────────────────────────
// After the rule engine generates a CrossFit workout, this optional AI call
// adds creative MetCon format selection. The AI receives exercise names only
// and returns format metadata — it NEVER substitutes or reorders exercises.

const MetConEnhancementSchema = z.object({
  format: z.enum(['AMRAP', 'EMOM', 'For Time', 'Chipper', 'Ladder', 'Tabata']).describe('MetCon format'),
  timeCap: z.number().int().min(4).max(30).nullable().describe('Time cap in minutes (null if no cap)'),
  rounds: z.number().int().min(1).max(10).nullable().describe('Number of rounds (null for AMRAP/Chipper)'),
  theme: z.string().describe('One-line creative theme for this WOD, e.g. "The Grinder", "Death by Pull-Ups"'),
});

export async function enhanceCrossFitMetCon(
  workout: GeneratedWorkout,
): Promise<{ format: string; timeCap: number | null; rounds: number | null; theme: string }> {
  const exerciseNames = workout.workout
    .filter(e => e.groupType === 'rounds' || e.groupType === 'circuit')
    .map(e => e.name);

  if (exerciseNames.length === 0) {
    exerciseNames.push(...workout.workout.map(e => e.name));
  }

  const prompt = `You are a CrossFit programming coach. Given these MetCon exercises, choose the best format and create a creative WOD theme.

EXERCISES: ${exerciseNames.join(', ')}
DURATION TARGET: ${workout.estimatedDuration} minutes

Pick the format that best fits these movements. AMRAP for mixed-modal, EMOM for alternating skill work, For Time for sprint efforts, Chipper for long 6+ exercise lists, Ladder for progressive loading, Tabata for short intense bursts.

Be creative with the theme name — make it memorable like benchmark WODs (e.g., "Fran", "Murph", "The Filthy Fifty").`;

  const { object: result } = await generateObject({
    model: gemini,
    messages: [{ role: 'user', content: prompt }],
    schema: MetConEnhancementSchema,
  });

  return {
    format: result.format,
    timeCap: result.timeCap,
    rounds: result.rounds,
    theme: result.theme,
  };
}
