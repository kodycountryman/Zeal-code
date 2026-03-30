/**
 * Single source of truth for all workout styles.
 * Add or remove a style here and it propagates everywhere:
 * onboarding, ModifyWorkoutDrawer, SettingsDrawer, home tab, PlanWorkoutSheet,
 * LogPreviousWorkout, HealthImportSheet.
 */
export const WORKOUT_STYLE_LIST: { key: string; desc: string }[] = [
  { key: 'Strength',    desc: 'Heavy compound lifts, progressive overload' },
  { key: 'Bodybuilding', desc: 'Volume, isolation, muscle growth' },
  { key: 'Low-Impact',  desc: 'Joint-friendly, higher reps, sustainable' },
  { key: 'CrossFit',    desc: 'Varied functional movements at intensity' },
  { key: 'Hyrox',       desc: 'Race-specific functional fitness' },
  { key: 'Pilates',     desc: 'Core control, mobility, mind-body' },
  { key: 'Cardio',      desc: 'Endurance, zone training, conditioning' },
  { key: 'HIIT',        desc: 'High-intensity intervals, max effort' },
  { key: 'Mobility',    desc: 'Joint health, flexibility, recovery' },
];

/** Just the key strings — use wherever a plain string[] is needed. */
export const WORKOUT_STYLE_KEYS: string[] = WORKOUT_STYLE_LIST.map(s => s.key);
