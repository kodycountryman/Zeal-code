export function getContrastTextColor(bgColor: string): string {
  const hex = bgColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#111111' : '#ffffff';
}

export const Colors = {
  accent: '#f87116',
  accentDark: '#d96010',

  dark: {
    background: '#141414',
    card: '#262626',
    cardSecondary: '#323232',
    text: '#ffffff',
    textSecondary: '#9a9a9a',
    textMuted: '#555555',
    border: '#333333',
    score: '#3b82f6',
    readiness: '#22c55e',
    dock: '#1e1e1e',
    dockBorder: '#383838',
  },

  light: {
    background: '#f5f5f5',
    card: '#ffffff',
    cardSecondary: '#f0f0f0',
    text: '#111111',
    textSecondary: '#666666',
    textMuted: '#aaaaaa',
    border: '#e5e5e5',
    score: '#3b82f6',
    readiness: '#22c55e',
    dock: '#ffffff',
    dockBorder: '#e0e0e0',
  },

  neon: {
    background: '#06060f',
    card: '#0d0d1e',
    cardSecondary: '#141428',
    text: '#e8e8ff',
    textSecondary: '#8888cc',
    textMuted: '#444466',
    border: '#1e1e3c',
    score: '#00e5ff',
    readiness: '#00ff88',
    dock: '#0a0a1a',
    dockBorder: '#202040',
  },
};

export const WORKOUT_STYLE_COLORS: Record<string, string> = {
  Strength: '#f87116',
  Bodybuilding: '#ef4444',
  CrossFit: '#06b6d4',
  Hyrox: '#eab308',
  Cardio: '#8b5cf6',
  HIIT: '#60a5fa',
  Mobility: '#22c55e',
  Pilates: '#ec4899',
  'Low-Impact': '#86efac',
};

export const ZEAL_ACCENT_COLORS = [
  '#f87116',
  '#06b6d4',
  '#ec4899',
  '#22c55e',
  '#8b5cf6',
  '#eab308',
  '#ef4444',
];

export const WORKOUT_STYLE_DESCRIPTIONS: Record<string, string> = {
  Strength:
    'Build raw strength through progressive overload with compound lifts like squat, bench, and deadlift.',
  Bodybuilding:
    'Sculpt your physique with targeted hypertrophy training. High volume, isolation exercises, and mind-muscle connection.',
  CrossFit:
    'High-intensity functional fitness combining weightlifting, gymnastics, and metabolic conditioning. Workouts are varied and time-capped for maximum output.',
  Hyrox:
    'Competitive functional fitness race format. Combines 8km of running with 8 functional workout stations.',
  Cardio:
    'Improve cardiovascular endurance and burn calories. Steady-state and interval training for heart health.',
  HIIT: 'High-intensity interval training that alternates between intense bursts and recovery periods for maximum calorie burn.',
  Mobility:
    'Improve flexibility, joint health, and movement quality. Perfect for recovery or as a daily practice.',
  Pilates:
    'Low-impact, high-focus training for core strength, posture, and body awareness.',
  'Low-Impact':
    'Gentle, joint-friendly training. Higher reps, lower loads, and controlled movements for sustainable fitness.',
};

export const TRAINING_SPLITS: Record<string, string[]> = {
  Strength:     ['Push Day', 'Pull Day', 'Leg Day', 'Upper', 'Lower', 'Full Body', 'Core + Cardio'],
  Bodybuilding: ['Push Day', 'Pull Day', 'Leg Day', 'Upper', 'Lower', 'Full Body', 'Bro Split', 'Arnold Split'],
  CrossFit:     ['Auto', 'AMRAP', 'EMOM', 'RFT', 'Chipper', 'Ladder'],
  Hyrox:        ['Auto', 'Station Practice', 'Compromised Run', 'Strength Circuit', 'Half Simulation', 'Full Simulation'],
  HIIT:         ['Full Body HIIT', 'Upper HIIT', 'Lower HIIT', 'Core Blast'],
  Cardio:       ['Auto', 'Steady-State (Zone 2)', 'Tempo', 'Intervals', 'Fartlek', 'Machine Rotation', 'Bodyweight Circuit'],
  Mobility:     ['Auto', 'Full-Body Flow', 'Targeted', 'Foam Rolling + Stretch', 'Recovery Day'],
  Pilates:      ['Auto', 'Classical Mat Flow', 'Themed Flow', 'Pilates Circuit', 'Reformer Flow'],
  'Low-Impact': ['Full Body', 'Upper', 'Lower', 'Push Day', 'Pull Day', 'Seated Circuit'],
};
