console.log('[EngineBridge] re-exporting from workoutEngine (V2 consolidated)');

export {
  generateWorkout,
  generateWorkout as generateWorkoutV2,
  generateWorkoutFromSavedExercises,
  calculateRest,
  type PlanAwareParams,
  type GeneratedWorkout,
  type GenerateWorkoutParams,
  type WorkoutExercise,
  type WarmupItem,
  type CooldownItem,
  type RecoveryItem,
  type CardioItem,
  type SeventyFiveHardSession,
} from '@/services/workoutEngine';
