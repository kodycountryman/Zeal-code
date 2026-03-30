/**
 * Single source of truth for fitness/experience level.
 * Re-exported from AppContext (as FitnessLevel) and planConstants (as ExperienceLevel)
 * so existing consumers don't need to change their import paths.
 */
export const FITNESS_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type FitnessLevel = typeof FITNESS_LEVELS[number];
