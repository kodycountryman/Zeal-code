import { Alert } from 'react-native';

export const PRO_GOLD = '#d4a93e';
export const PRO_GOLD_DIM = `${PRO_GOLD}40`;
export const PRO_LOCKED_OPACITY = 0.55;

export const PRO_STYLES = ['Bodybuilding', 'CrossFit', 'Hyrox', 'HIIT', 'Mobility', 'Pilates', 'Low-Impact', 'Hybrid'] as const;
export const PRO_STYLES_SET = new Set<string>(PRO_STYLES);

interface ProFeatureInfo {
  title: string;
  message: string;
}

export const PRO_FEATURE_INFO: Record<string, ProFeatureInfo> = {
  workoutStyle: {
    title: 'Pro Workout Styles',
    message: 'Unlock all 8 workout styles including Bodybuilding, CrossFit, HIIT, Hyrox, and more with Zeal Pro.',
  },
  planBuilder: {
    title: 'Plan Builder',
    message: 'Create long-term training plans with advanced periodization and auto-progression.',
  },
  insights: {
    title: 'Full Insights',
    message: 'Access your complete radar chart, detailed analytics, and unlimited training history.',
  },
  supersets: {
    title: 'Supersets & Circuits',
    message: 'Build advanced workout structures with supersets and circuit training.',
  },
  healthSync: {
    title: 'Health Sync',
    message: 'Connect your workouts to Apple Health or Health Connect to track calories, steps, and more.',
  },
  equipment: {
    title: 'Equipment Customization',
    message: 'Tailor every workout to the exact equipment you have available.',
  },
  savedWorkouts: {
    title: 'Unlimited Saved Workouts',
    message: 'Save and organize as many custom workouts as you want with Zeal Pro.',
  },
  achievements: {
    title: 'Achievements & Milestones',
    message: 'Track your long-term wins with badges, milestones, and training achievements.',
  },
  aboutMe: {
    title: 'Full About Me Profile',
    message: 'Set detailed goals, body data, and fitness level for smarter workout generation.',
  },
  exercisePrefs: {
    title: 'Exercise Preferences',
    message: 'Like or dislike exercises so future workouts are tailored to what you enjoy.',
  },
  subscription: {
    title: 'Zeal Pro',
    message: 'Unlock the full Zeal experience with advanced workouts, full analytics, and unlimited programming.',
  },
  history: {
    title: 'Full Workout History',
    message: 'Access your complete workout history beyond the last 7 days with Zeal Pro.',
  },
  '75hard': {
    title: '75 Hard Challenge',
    message: 'Take on the ultimate mental toughness challenge with daily tracking, AI workouts, and progress photos — available with Zeal Pro.',
  },
  nutrition: {
    title: 'Nutrition Tracker',
    message: 'Log meals, track macros, scan barcodes, and get AI-powered food estimates with Zeal Pro.',
  },
  runPlans: {
    title: 'Run Training Plans',
    message: 'Build periodized 5K, 10K, half marathon, marathon, and hybrid lift+run plans tuned to your goal pace.',
  },
  runAudioCoaching: {
    title: 'Audio Coaching',
    message: 'Spoken split summaries, pace alerts, halfway cheers, and interval cues during every run.',
  },
  runAdvancedAnalytics: {
    title: 'Advanced Run Analytics',
    message: 'Race-time predictions, heart-rate zones, training load, fastest-split leaderboards, and pace trends.',
  },
};

export function showProGate(
  featureKey: string,
  openPaywall: () => void,
): void {
  const info = PRO_FEATURE_INFO[featureKey] ?? {
    title: 'Zeal Pro Feature',
    message: 'This feature is available with Zeal Pro.',
  };

  __DEV__ && console.log('[proGate] Showing gate for:', featureKey);

  Alert.alert(
    info.title,
    info.message,
    [
      { text: 'Maybe Later', style: 'cancel' },
      { text: 'See Pro', onPress: openPaywall },
    ],
  );
}
