/**
 * Single source of truth for training goals.
 * Used in onboarding (with icons attached locally) and AboutMeDrawer.
 * Add or rename a goal here and both screens stay in sync.
 */
export const TRAINING_GOAL_KEYS = [
  'Build Muscle',
  'Get Stronger',
  'Lose Weight',
  'Better Conditioning',
  'Improve Flexibility',
  'Sport Performance',
] as const;

export type TrainingGoal = typeof TRAINING_GOAL_KEYS[number];
