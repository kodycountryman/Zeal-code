/**
 * Workout Template Service
 *
 * Persists a lightweight list of named workout templates so users can
 * replay a Live Track session without rebuilding it from scratch.
 *
 * Storage key: @zeal_workout_templates
 * Shape: WorkoutTemplate[] (newest first)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WorkoutExercise } from '@/services/workoutEngine';

const STORAGE_KEY = '@zeal_workout_templates';
const MAX_TEMPLATES = 20;

export interface WorkoutTemplate {
  id: string;
  name: string;
  /** Exercises stored WITHOUT session-specific IDs — IDs get re-generated on load. */
  exercises: WorkoutExercise[];
  /** ISO date string */
  createdAt: string;
  /** Derived stat cached for display */
  exerciseCount: number;
  muscleGroups: string[];
}

function generateId(): string {
  return `tmpl_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

export async function getTemplates(): Promise<WorkoutTemplate[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WorkoutTemplate[]) : [];
  } catch {
    return [];
  }
}

export async function saveTemplate(
  name: string,
  exercises: WorkoutExercise[],
): Promise<WorkoutTemplate> {
  const muscleGroups = [...new Set(exercises.map(e => e.muscleGroup).filter(Boolean))];
  const template: WorkoutTemplate = {
    id: generateId(),
    name: name.trim() || 'My Workout',
    exercises,
    createdAt: new Date().toISOString(),
    exerciseCount: exercises.length,
    muscleGroups,
  };

  try {
    const existing = await getTemplates();
    const updated = [template, ...existing].slice(0, MAX_TEMPLATES);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Non-fatal — template just won't persist
  }

  return template;
}

export async function deleteTemplate(id: string): Promise<void> {
  try {
    const existing = await getTemplates();
    const updated = existing.filter(t => t.id !== id);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch { /* ignore */ }
}
