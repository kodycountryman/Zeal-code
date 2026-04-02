console.log('[WorkoutConfig] Loading Phase 4 shared workout configuration');

export interface StyleControlConfig {
  slot_label: string;
  slot_options: string[];
  show_specific_muscles: boolean;
  muscles_label: string;
  show_rest_slider: boolean;
  rest_slider_conditional_slots?: string[];
  duration_min: number;
  duration_max: number;
  show_session_toggle: boolean;
}

export const WORKOUT_SESSION_CONFIG: Record<string, StyleControlConfig> = {
  Strength: {
    slot_label: 'TRAINING SPLIT',
    slot_options: ['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full Body'],
    show_specific_muscles: true,
    muscles_label: 'SPECIFIC MUSCLES',
    show_rest_slider: false,
    duration_min: 30,
    duration_max: 90,
    show_session_toggle: false,
  },
  Bodybuilding: {
    slot_label: 'TRAINING SPLIT',
    slot_options: ['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full Body', 'Bro Split', 'Arnold Split'],
    show_specific_muscles: true,
    muscles_label: 'SPECIFIC MUSCLES',
    show_rest_slider: false,
    duration_min: 30,
    duration_max: 90,
    show_session_toggle: false,
  },
  CrossFit: {
    slot_label: 'WOD STYLE',
    slot_options: ['Auto', 'AMRAP', 'EMOM', 'RFT', 'Chipper', 'Ladder'],
    show_specific_muscles: true,
    muscles_label: 'TARGET',
    show_rest_slider: false,
    duration_min: 30,
    duration_max: 90,
    show_session_toggle: false,
  },
  Hyrox: {
    slot_label: 'TRAINING FORMAT',
    slot_options: ['Auto', 'Station Practice', 'Compromised Run', 'Strength Circuit', 'Half Simulation', 'Full Simulation'],
    show_specific_muscles: true,
    muscles_label: 'TARGET',
    show_rest_slider: false,
    rest_slider_conditional_slots: ['Station Practice'],
    duration_min: 30,
    duration_max: 90,
    show_session_toggle: false,
  },
  HIIT: {
    slot_label: 'TRAINING SPLIT',
    slot_options: ['Full Body', 'Upper', 'Lower', 'Core Blast'],
    show_specific_muscles: true,
    muscles_label: 'SPECIFIC MUSCLES',
    show_rest_slider: false,
    duration_min: 15,
    duration_max: 45,
    show_session_toggle: false,
  },
  Mobility: {
    slot_label: 'SESSION TYPE',
    slot_options: ['Auto', 'Full-Body Flow', 'Targeted', 'Foam Rolling + Stretch', 'Recovery Day'],
    show_specific_muscles: true,
    muscles_label: 'SPECIFIC MUSCLES',
    show_rest_slider: false,
    duration_min: 15,
    duration_max: 45,
    show_session_toggle: false,
  },
  Pilates: {
    slot_label: 'CLASS TYPE',
    slot_options: ['Auto', 'Classical Mat Flow', 'Themed Flow', 'Pilates Circuit', 'Reformer Flow'],
    show_specific_muscles: true,
    muscles_label: 'EMPHASIS AREAS',
    show_rest_slider: false,
    duration_min: 20,
    duration_max: 60,
    show_session_toggle: false,
  },
  'Low-Impact': {
    slot_label: 'TRAINING SPLIT',
    slot_options: ['Full Body', 'Upper', 'Lower', 'Push Day', 'Pull Day', 'Seated Circuit'],
    show_specific_muscles: true,
    muscles_label: 'SPECIFIC MUSCLES',
    show_rest_slider: false,
    duration_min: 30,
    duration_max: 75,
    show_session_toggle: false,
  },
  Hybrid: {
    slot_label: 'TRAINING SPLIT',
    slot_options: ['Full Body', 'Upper', 'Lower', 'Push', 'Pull', 'Legs'],
    show_specific_muscles: true,
    muscles_label: 'SPECIFIC MUSCLES',
    show_rest_slider: false,
    duration_min: 30,
    duration_max: 90,
    show_session_toggle: false,
  },
};

export function getStyleConfig(style: string): StyleControlConfig {
  return WORKOUT_SESSION_CONFIG[style] ?? WORKOUT_SESSION_CONFIG['Strength'];
}

export function getDurationSteps(style: string): number[] {
  switch (style) {
    case 'HIIT':
    case 'Mobility':
      return [15, 20, 30, 45];
    case 'Pilates':
      return [20, 30, 45, 60];
    default:
      return [30, 45, 60, 75, 90];
  }
}

export function clampDurationToStyle(duration: number, style: string): number {
  const config = getStyleConfig(style);
  const steps = getDurationSteps(style);
  const clamped = Math.max(config.duration_min, Math.min(config.duration_max, duration));
  return steps.reduce((prev, curr) =>
    Math.abs(curr - clamped) < Math.abs(prev - clamped) ? curr : prev
  );
}

export function showRestSlider(style: string, selectedSlot: string): boolean {
  const config = getStyleConfig(style);
  if (!config.show_rest_slider) return false;
  if (config.rest_slider_conditional_slots && config.rest_slider_conditional_slots.length > 0) {
    return config.rest_slider_conditional_slots.includes(selectedSlot);
  }
  return true;
}

export interface MuscleChip {
  display: string;
  enums: string[];
}

export const MUSCLE_CHIPS: MuscleChip[] = [
  { display: 'Chest', enums: ['chest', 'upper_chest', 'lower_chest'] },
  { display: 'Lats', enums: ['lats'] },
  { display: 'Back', enums: ['upper_back'] },
  { display: 'Traps', enums: ['traps'] },
  { display: 'Shoulders', enums: ['front_delt', 'side_delt'] },
  { display: 'Rear Delts', enums: ['rear_delt'] },
  { display: 'Biceps', enums: ['biceps'] },
  { display: 'Triceps', enums: ['triceps'] },
  { display: 'Forearms', enums: ['forearms'] },
  { display: 'Core', enums: ['core'] },
  { display: 'Obliques', enums: ['obliques'] },
  { display: 'Hip Flexors', enums: ['hip_flexors'] },
  { display: 'Quads', enums: ['quads'] },
  { display: 'Hamstrings', enums: ['hamstrings'] },
  { display: 'Glutes', enums: ['glutes'] },
  { display: 'Calves', enums: ['calves'] },
];

export const MUSCLE_DISPLAY_NAMES: string[] = MUSCLE_CHIPS.map(c => c.display);

export function expandMuscleDisplayToEnums(displayNames: string[]): string[] {
  const enums: string[] = [];
  for (const name of displayNames) {
    const chip = MUSCLE_CHIPS.find(c => c.display === name);
    if (chip) enums.push(...chip.enums);
  }
  return [...new Set(enums)];
}


