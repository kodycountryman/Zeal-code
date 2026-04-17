/**
 * Train tab — unified home for Workout + Run.
 *
 * This file is intentionally thin during Phase 1 of the Train tab unification.
 * It re-exports the existing WorkoutScreen so the /train route renders
 * something useful while the real merge work happens in Phases 2-5.
 *
 * Phase 3 will replace this with the actual composition (WorkoutScreenBody +
 * RunScreenBody inside a horizontal paging container, with a ModeToggleIcons
 * toggle in the header and a MiniSessionBar for cross-mode sessions).
 */
export { default } from './workout';
