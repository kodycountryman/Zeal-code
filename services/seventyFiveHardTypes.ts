/**
 * 75 Hard Challenge — Type Definitions & Storage Key
 */

export const SEVENTY_FIVE_HARD_STORAGE_KEY = '@zeal_75hard_v1';

export const OUTDOOR_ACTIVITIES = [
  'Walk',
  'Run',
  'Hike',
  'Bike',
  'Swim',
  'Sport',
  'Yoga',
  'Other',
] as const;

export type OutdoorActivity = typeof OUTDOOR_ACTIVITIES[number];

export const OUTDOOR_DURATION_OPTIONS = [45, 60, 75, 90] as const;

export interface SeventyFiveHardDay {
  date: string;               // YYYY-MM-DD
  workout1Complete: boolean;   // AI-generated indoor workout
  workout2Complete: boolean;   // Outdoor workout (manual)
  waterComplete: boolean;
  readingComplete: boolean;
  dietComplete: boolean;
  photoComplete: boolean;
  photoUri?: string;           // optional local image URI
}

export interface OutdoorWorkoutConfig {
  activity: OutdoorActivity;
  duration: number;            // minutes (45 minimum per 75 Hard rules)
}

export interface SeventyFiveHardState {
  active: boolean;
  startDate: string;           // YYYY-MM-DD — Day 1
  currentDay: number;          // 1-75 (computed from startDate + completed days)
  days: Record<string, SeventyFiveHardDay>; // keyed by YYYY-MM-DD
  resetHistory: string[];      // YYYY-MM-DD dates of past resets
  outdoor2Config?: OutdoorWorkoutConfig;    // today's outdoor workout choice
}

export type ChecklistItem = keyof Pick<
  SeventyFiveHardDay,
  'workout1Complete' | 'workout2Complete' | 'waterComplete' | 'readingComplete' | 'dietComplete' | 'photoComplete'
>;

export function createEmptyDay(date: string): SeventyFiveHardDay {
  return {
    date,
    workout1Complete: false,
    workout2Complete: false,
    waterComplete: false,
    readingComplete: false,
    dietComplete: false,
    photoComplete: false,
  };
}

export function isDayFullyComplete(day: SeventyFiveHardDay): boolean {
  return (
    day.workout1Complete &&
    day.workout2Complete &&
    day.waterComplete &&
    day.readingComplete &&
    day.dietComplete &&
    day.photoComplete
  );
}
