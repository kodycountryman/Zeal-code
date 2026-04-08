export interface ZealTip {
  id: number;
  tip: string;
}

export const ZEAL_TIPS: ZealTip[] = [
  // Onboarding & Setup
  { id: 1,  tip: 'Set your workout style to match how you actually train — it affects every exercise Zeal picks for you.' },
  { id: 2,  tip: 'Update your equipment list anytime in Settings → Your Gym. Zeal only programs what you actually have.' },
  { id: 3,  tip: 'Your weekly goal isn\'t a hard cap — it\'s a target. Training 4× when your goal is 3 still counts toward your streak.' },

  // Workout Generation
  { id: 4,  tip: 'Tap the style chip on the home screen to swap training styles without changing your full profile.' },
  { id: 5,  tip: 'The time slider affects exercise count, not rest periods. Shorter sessions use more compound movements.' },
  { id: 6,  tip: 'Not feeling today\'s workout? Regenerate — Zeal uses AI, so the next one will be different.' },
  { id: 7,  tip: 'Long press any exercise in the plan to see a demo and muscle group breakdown.' },
  { id: 8,  tip: 'The Core Finisher toggle (Settings) adds an abs circuit to the end of every session automatically.' },
  { id: 9,  tip: 'Zeal picks exercises based on your muscle readiness. If a muscle group is still sore, it gets a rest.' },

  // During a Workout
  { id: 10, tip: 'Swipe left on any set row to delete it mid-session. Swipe left on an exercise to remove it entirely.' },
  { id: 11, tip: 'Tap the rest timer to skip it or add 30 seconds. Hold the timer to reset.' },
  { id: 12, tip: 'Log your weights — even rough estimates. Zeal tracks personal records and surfaces them over time.' },
  { id: 13, tip: 'The exercise drawer (tap the exercise name) shows form cues, targeted muscles, and rep range guidance.' },
  { id: 14, tip: 'You can reorder exercises mid-workout by holding and dragging the grip icon.' },

  // Streaks & Consistency
  { id: 15, tip: 'Your streak doesn\'t reset until you miss a full calendar day. Logging anything — even 10 minutes — keeps it alive.' },
  { id: 16, tip: 'Streak color matches your training style. Switch styles and watch it change.' },
  { id: 17, tip: 'Check your streak calendar in the Insights tab. Missed days show in gray — no judgment.' },
  { id: 18, tip: 'Your longest streak is saved permanently. Even if the current one breaks, the record stays.' },

  // Progress & Insights
  { id: 19, tip: 'The Insights tab shows your most-trained muscle group. Use it to spot imbalances before they become injuries.' },
  { id: 20, tip: 'Workout time distribution tells you when you train best. Most Zeal users peak in the evening — but morning trainers show better consistency.' },
  { id: 21, tip: 'Volume trends over time are in Stats. If the line is flat, you\'re maintaining. If it climbs, you\'re progressing.' },
  { id: 22, tip: 'PRs are tracked automatically. You\'ll get a badge any time you hit a new best on a logged exercise.' },

  // Training Plans
  { id: 23, tip: 'A training plan gives you a structured 4–12 week path. Zeal generates the full program upfront — you just show up.' },
  { id: 24, tip: 'Mid-plan style changes are allowed but reset your program. Complete at least one full cycle before switching.' },
  { id: 25, tip: 'Rest days in your plan are real recommendations. Muscle synthesis peaks 24–48 hours post-session.' },

  // Health Integration
  { id: 26, tip: 'Connect health sync in Settings to automatically log workouts to your device\'s health app and keep your activity rings or stats up to date.' },
  { id: 27, tip: 'Resting heart rate trends from your health app can inform your recovery. A spike usually means your body needs a lighter day.' },
  { id: 28, tip: 'Zeal can import past workouts from your health app so your history doesn\'t start from zero.' },

  // Pro Features
  { id: 29, tip: 'Pro styles like Bodybuilding and Strength unlock periodization — progressive overload built into your plan automatically.' },
  { id: 30, tip: 'Hyrox mode programs race-specific stations. If you have a Hyrox event coming up, set a plan 8–12 weeks out.' },
  { id: 31, tip: 'Hybrid training alternates strength blocks with conditioning finishers — best for athletes who want both.' },

  // General
  { id: 32, tip: 'The floating dock hides during a workout so you can focus. Swipe down from the edge to exit.' },
  { id: 33, tip: 'Dark mode, Zeal theme, and Neon theme are in Settings → Appearance.' },
  { id: 34, tip: 'You can log a previous workout manually if you trained without your phone — it counts toward history and streaks.' },
  { id: 35, tip: 'Zeal is built for consistency over perfection. A 20-minute session beats skipping.' },
];
