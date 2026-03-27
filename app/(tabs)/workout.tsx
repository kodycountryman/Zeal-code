import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import ExpandingPanel from '@/components/ExpandingPanel';
import * as Haptics from 'expo-haptics';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Alert,
  Image,
  LayoutAnimation,
  Platform,
  UIManager,
  Modal,
  RefreshControl,
  useWindowDimensions,
  Animated as RNAnimated,
  PanResponder,
  InteractionManager,
  TextInput,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
  Play,
  ChevronRight,
  ChevronDown,
  Flame,
  Link2,
  RefreshCw,
  ArrowLeftRight,
  X,
  Plus,
  Heart,
  Zap,
  Snowflake,
  Activity,
  Check,
  User,
  RotateCcw,
  Circle,
  Timer,
  Dumbbell,
  Wind,
  CheckCircle2,
  Target,
  Footprints,
  Clipboard,
  Info,
  Minus,
  SlidersHorizontal,
} from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import { useZealTheme, useAppContext, type MuscleReadinessItem } from '@/context/AppContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { useWorkoutTracking } from '@/context/WorkoutTrackingContext';
import { WORKOUT_STYLE_COLORS, getContrastTextColor } from '@/constants/colors';
import {
  generateWorkoutFromSavedExercises,
  workoutExercisesFromSavedRefs,
  generateWorkout,
  calculateRest,
  type GeneratedWorkout,
  type WorkoutExercise,
  type SeventyFiveHardSession,
} from '@/services/workoutEngine';
import type { MovementType } from '@/mocks/exerciseDatabase';
import { generateWorkoutAsync, generateCoreFinisher, getAIStyles } from '@/services/aiWorkoutGenerator';
import { buildCreativeWorkoutTitle } from '@/services/workoutTitle';
import ModifyWorkoutDrawer from '@/components/drawers/ModifyWorkoutDrawer';
import AddToWorkoutSheet, { type AddMode } from '@/components/AddToWorkoutSheet';
import SwipeableExerciseRow from '@/components/SwipeableExerciseRow';
import SwipeableSetRow from '@/components/SwipeableSetRow';
import ExerciseDetailDrawer from '@/components/drawers/ExerciseDetailDrawer';
import AthleteProfileDrawer from '@/components/drawers/AthleteProfileDrawer';
import AboutMeDrawer from '@/components/drawers/AboutMeDrawer';
import InsightsDrawer from '@/components/drawers/InsightsDrawer';
import SettingsDrawer from '@/components/drawers/SettingsDrawer';
import ColorThemeDrawer from '@/components/drawers/ColorThemeDrawer';
import EquipmentDrawer from '@/components/drawers/EquipmentDrawer';
import AmbientGlow from '@/components/AmbientGlow';
import ZealBackground from '@/components/ZealBackground';
import WorkoutTimerCard from '@/components/WorkoutTimerCard';
import PostWorkoutFlow from '@/components/PostWorkoutFlow';
import LogPreviousWorkout from '@/components/LogPreviousWorkout';
import HealthImportBanner from '@/components/HealthImportBanner';
import HealthImportSheet from '@/components/HealthImportSheet';
import WorkoutLogDetail from '@/components/WorkoutLogDetail';
import FullCalendarModal from '@/components/FullCalendarModal';
import WheelPicker from '@/components/WheelPicker';
import WheelGuideModal from '@/components/WheelGuideModal';
import WorkoutWalkthrough from '@/components/WorkoutWalkthrough';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GlassCard from '@/components/GlassCard';

const WALKTHROUGH_KEY = '@zeal_workout_walkthrough_seen_v1';

const SPRING_BTN = { damping: 15, stiffness: 400, mass: 0.5 } as const;
const CHIP_H = 44;
const PICKER_H = 132;
const CHIP_SPRING = { damping: 22, stiffness: 280, mass: 0.8 } as const;

import { PRO_STYLES_SET } from '@/services/proGate';

const WEIGHT_VALUES = Array.from({ length: 201 }, (_, i) => i * 5);
const DUMBBELL_WEIGHT_VALUES = Array.from({ length: 401 }, (_, i) => i * 2.5);
const REPS_VALUES = Array.from({ length: 50 }, (_, i) => i + 1);
const DISTANCE_VALUES_METERS = Array.from({ length: 201 }, (_, i) => i * 10); // 0..2000m
const CALORIES_VALUES = Array.from({ length: 151 }, (_, i) => i); // 0..150 cal
const TIME_VALUES_SECONDS = Array.from({ length: 121 }, (_, i) => i * 5); // 0..600s

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const PRESET_DURATIONS = [30, 45, 60, 75, 90] as const;

function TabContentSpring({ children }: { children: React.ReactNode }) {
  const anim = useRef(new RNAnimated.Value(0)).current;
  useEffect(() => {
    RNAnimated.spring(anim, {
      toValue: 1,
      tension: 120,
      friction: 14,
      useNativeDriver: true,
    }).start();
  }, []);
  return (
    <RNAnimated.View style={{
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
    }}>
      {children}
    </RNAnimated.View>
  );
}
function resolvePushPullLegs(muscleReadiness: MuscleReadinessItem[]): 'Push' | 'Pull' | 'Legs' {
  const readinessMap: Record<string, number> = {};
  for (const m of muscleReadiness) {
    readinessMap[m.name] = m.value;
  }
  const avg = (muscles: string[]) => {
    const vals = muscles.map(m => readinessMap[m] ?? 80);
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };
  const pushScore = avg(['Chest', 'Shoulders', 'Triceps']);
  const pullScore = avg(['Back', 'Biceps']);
  const legsScore = avg(['Quads', 'Hamstrings', 'Glutes', 'Calves']);
  console.log(`[WorkoutScreen] PPL resolve: Push=${pushScore.toFixed(1)} Pull=${pullScore.toFixed(1)} Legs=${legsScore.toFixed(1)}`);
  if (pushScore >= pullScore && pushScore >= legsScore) return 'Push';
  if (pullScore > pushScore && pullScore >= legsScore) return 'Pull';
  return 'Legs';
}

function snapToPreset(d: number): number {
  return (PRESET_DURATIONS as readonly number[]).reduce((prev, curr) =>
    Math.abs(curr - d) < Math.abs(prev - d) ? curr : prev
  );
}

function formatDate(): string {
  const today = new Date();
  return today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function isRepsOnlyMovement(ex: WorkoutExercise): boolean {
  const name = (ex.name ?? '').toLowerCase();
  const equipment = (ex.equipment ?? '').toLowerCase();
  const ref = ex.exerciseRef as { movement_pattern?: string; equipment_required?: string[] } | null;
  const pattern = (ref?.movement_pattern ?? '').toLowerCase();
  const req = (ref?.equipment_required ?? []).map(r => r.toLowerCase());

  const bodyweightByName =
    name.includes('push up') ||
    name.includes('push-up') ||
    name.includes('pull up') ||
    name.includes('pull-up') ||
    name.includes('box jump') ||
    name.includes('burpee') ||
    name.includes('sit-up') ||
    name.includes('sit up') ||
    name.includes('air squat');

  const bodyweightByPattern = pattern === 'plyometric' || pattern === 'calisthenics';
  const explicitlyBodyweight =
    equipment === 'bodyweight' ||
    equipment.includes('bodyweight') ||
    equipment === 'body weight' ||
    req.length === 0 ||
    (req.length === 1 && req[0] === 'bodyweight');

  // If an exercise clearly uses an external load implement, it's not reps-only.
  const externalLoad =
    equipment.includes('barbell') ||
    equipment.includes('dumbbell') ||
    equipment.includes('kettlebell') ||
    req.includes('barbell') ||
    req.includes('dumbbell') ||
    req.includes('kettlebell');

  return (bodyweightByName || bodyweightByPattern || explicitlyBodyweight) && !externalLoad;
}

function isWeightDistanceMovement(ex: WorkoutExercise): boolean {
  const name = (ex.name ?? '').toLowerCase();
  const ref = ex.exerciseRef as { equipment_required?: string[] } | null;
  const req = (ref?.equipment_required ?? []).map(r => r.toLowerCase());
  return name.includes('sled push') || name.includes('sled pull') || req.includes('sled');
}

function parseNumberPrefix(raw: string): number | null {
  const m = raw.trim().match(/^(\d+(?:\.\d+)?)/);
  if (!m) return null;
  return Math.round(Number(m[1]));
}

function parseSecondsFromRepsLabel(reps: string): number {
  const v = parseNumberPrefix(reps);
  if (v == null) return 30;
  const lower = reps.toLowerCase();
  if (lower.includes('min')) return Math.max(5, v * 60);
  return Math.max(5, v);
}

function getBreathCue(name: string): string {
  const l = name.toLowerCase();
  if (l.includes('roll') || l.includes('curl')) return 'Exhale on the curl, inhale to return';
  if (l.includes('plank')) return 'Maintain steady breath, engage core on exhale';
  if (l.includes('bridge')) return 'Inhale to prepare, exhale to lift';
  if (l.includes('leg') || l.includes('kick')) return 'Exhale on the lift, inhale to lower';
  if (l.includes('twist') || l.includes('rotation')) return 'Exhale as you rotate, inhale to center';
  if (l.includes('stretch') || l.includes('extend')) return 'Inhale to lengthen, exhale to deepen';
  if (l.includes('squat') || l.includes('lunge')) return 'Inhale down, exhale to rise';
  if (l.includes('push') || l.includes('press')) return 'Exhale on the push, inhale on the return';
  if (l.includes('dead') || l.includes('pull')) return 'Brace core, exhale at the top';
  return 'Maintain controlled breathing throughout';
}

function getMobilityPhase(idx: number, total: number): string | null {
  if (total <= 0) return null;
  const t = total / 3;
  if (idx === 0) return 'JOINT PREP';
  if (idx === Math.floor(t)) return 'DYNAMIC FLOW';
  if (idx === Math.floor(t * 2)) return 'END RANGE CONTROL';
  return null;
}

function getPilatesPhase(idx: number, total: number): string | null {
  if (total <= 0) return null;
  const q = total / 4;
  if (idx === 0) return 'ACTIVATION';
  if (idx === Math.floor(q)) return 'CORE SERIES';
  if (idx === Math.floor(q * 2)) return 'HIP SERIES';
  if (idx === Math.floor(q * 3) && Math.floor(q * 3) !== 0) return 'FULL BODY';
  return null;
}

function getInfoContent(label: string): { title: string; body: string } {
  const l = label.toUpperCase();
  if (l.includes('AMRAP')) return {
    title: 'AMRAP',
    body: 'As Many Rounds/Reps As Possible. Complete the movements back-to-back for the full time cap without stopping. Track your rounds — try to beat it next time.',
  };
  if (l.includes('EMOM')) return {
    title: 'EMOM',
    body: 'Every Minute On the Minute. Start each movement at the top of the minute and rest for whatever time remains. The faster you move, the more rest you earn.',
  };
  if (l.includes('FOR TIME')) return {
    title: 'For Time',
    body: 'Complete the prescribed work as fast as possible. Move with intensity but maintain safe form. Your finishing time is your score — chase it.',
  };
  if (l.includes('CHIPPER')) return {
    title: 'Chipper',
    body: 'Work through a long list of movements one at a time, "chipping away" at the reps. You only do each movement once — pace yourself for the full effort.',
  };
  if (l.includes('LADDER')) return {
    title: 'Ladder',
    body: 'Work through a sequence of ascending or descending rep counts across movements. In an ascending ladder the reps increase each round; descending starts high and drops. Pace your transitions — the total volume adds up fast.',
  };
  if (l.includes('WOD')) return {
    title: 'WOD — Workout of the Day',
    body: 'The signature CrossFit conditioning block. Performed after the strength segment, the WOD is where intensity peaks. Push hard, move efficiently, and record your score.',
  };
  if (l.includes('CROSSFIT')) return {
    title: 'CrossFit WOD',
    body: 'A two-part session: strength first, then a timed metcon. The strength block builds capacity, the WOD tests it. Approach each part with its own strategy.',
  };
  if (l === 'STRENGTH' || l.includes('STRENGTH BLOCK')) return {
    title: 'Strength Block',
    body: 'The foundational strength segment. Focus on heavy, controlled lifts with full rest between sets. Quality of movement matters more than speed here.',
  };
  if (l.includes('SUPERSET')) return {
    title: 'Superset',
    body: 'Two exercises performed back-to-back with no rest between them. Rest only after both are complete. Supersets increase volume and metabolic stress efficiently.',
  };
  if (l.includes('CIRCUIT')) return {
    title: 'Circuit',
    body: 'Move through all exercises in sequence with minimal rest between movements. Rest only after completing the full round. Great for conditioning and time efficiency.',
  };
  if (l.includes('ROUNDS')) return {
    title: 'Rounds',
    body: 'Complete each exercise block for the prescribed number of rounds. Rest between rounds as noted. Focus on consistent effort and form across all rounds.',
  };
  if (l.includes('RUN')) return {
    title: 'Run Segment',
    body: 'A mandatory running segment between Hyrox stations. Maintain a sustainable pace — you have more stations ahead. Most athletes target 5:00–6:00/km pace between efforts.',
  };
  if (l.includes('WARM')) return {
    title: 'Warm-Up',
    body: 'Prepares your joints, muscles, and nervous system for the work ahead. Never skip it — a proper warm-up improves performance and significantly reduces injury risk.',
  };
  if (l.includes('COOL')) return {
    title: 'Cool-Down',
    body: 'Gradually lowers your heart rate and begins the recovery process. Holds and light movement here accelerate muscle repair and reduce next-day soreness.',
  };
  if (l.includes('RECOVERY')) return {
    title: 'Recovery Protocol',
    body: "Evidence-based recovery recommendations to maximize adaptation from today's session. Follow these in the hours after your workout for best results.",
  };
  if (l.includes('CARDIO')) return {
    title: 'Cardio Block',
    body: 'An additional cardio component to complement your strength work. Focus on the prescribed intensity zone — not too easy, not all-out. Keep RPE consistent.',
  };
  if (l.includes('CORE FINISHER')) return {
    title: 'Core Finisher',
    body: "An AI-generated core and ab circuit added at the end of your workout. These exercises are designed to challenge your midsection after the main session. They don't count toward your main workout time — they're a bonus add-on for extra core development.",
  };
  if (l.includes('HIIT') || l.includes('HIIT SESSION')) return {
    title: 'HIIT Session',
    body: 'High-Intensity Interval Training. Alternate between maximal effort work intervals and brief rest. The goal is to push hard during work and recover just enough to repeat.',
  };
  if (l.includes('HYROX')) return {
    title: 'Hyrox Race Format',
    body: 'Alternating 1km runs and functional fitness stations, modeled on the official HYROX race format. Pace the runs — the stations demand power and endurance.',
  };
  if (l.includes('JOINT PREP')) return {
    title: 'Joint Prep',
    body: 'Mobilize key joints through their full range of motion before loading them. Especially important for hips, shoulders, and ankles before any strength or mobility work.',
  };
  if (l.includes('DYNAMIC FLOW')) return {
    title: 'Dynamic Flow',
    body: 'Controlled movement through ranges of motion with tempo. This phase builds coordination between mobility and strength, preparing end ranges for the work ahead.',
  };
  if (l.includes('END RANGE')) return {
    title: 'End Range Control',
    body: 'Training stability and strength at the limits of your flexibility. This is where injury prevention happens — control every position you can reach.',
  };
  if (l.includes('ACTIVATION')) return {
    title: 'Activation',
    body: 'Wake up the deep stabilizers and postural muscles before the main work. Focus on feeling the right muscles engage before loading or moving into bigger patterns.',
  };
  if (l.includes('CORE SERIES')) return {
    title: 'Core Series',
    body: 'The central block of Pilates practice. Breathe intentionally through every rep — exhale on exertion, inhale to prepare. Quality of contraction over speed.',
  };
  if (l.includes('HIP SERIES')) return {
    title: 'Hip Series',
    body: 'Targets hip stability, glute activation, and pelvic control. These movements carry over directly to running, lifting, and daily movement quality.',
  };
  if (l.includes('FULL BODY')) return {
    title: 'Full Body',
    body: 'Integrates everything — core, hips, spine, and limbs working together. Focus on coordination and breath as you connect the movement patterns from the session.',
  };
  if (l.includes('MAIN BLOCK')) return {
    title: 'Main Block',
    body: 'The primary training stimulus of this session. Follow the prescribed pace, RPE, or intervals as written. This is where today\'s fitness gains are earned.',
  };
  if (l.includes('MOBILITY FLOW')) return {
    title: 'Mobility Flow',
    body: 'A structured sequence of mobility work targeting joint prep, dynamic movement, and end range control. Move with intention — feel each position before progressing.',
  };
  if (l.includes('PILATES')) return {
    title: 'Pilates Sequence',
    body: 'A continuous flow of controlled movements emphasizing core stability, breath, and body awareness. Each movement builds on the last — there are no breaks, only transitions.',
  };
  return {
    title: label,
    body: 'This section is part of your structured workout. Follow the prescribed reps, rest, and intensity. Quality movement and consistent effort are always the goal.',
  };
}

function generateItemDetail(name: string, type: 'warmup' | 'cooldown' | 'recovery'): { setup: string; steps: string[] } {
  const l = name.toLowerCase();

  if (type === 'warmup') {
    if (l.includes('high knee')) return {
      setup: 'Stand tall with feet hip-width apart, core lightly braced.',
      steps: ['Drive your right knee up toward your chest while pushing off your left foot.', 'Quickly alternate legs in a running-in-place motion.', 'Pump your arms in sync — opposite arm to opposite knee.', 'Land softly on the balls of your feet to reduce impact.', 'Maintain an upright torso; keep shoulders relaxed throughout.'],
    };
    if (l.includes('arm circle') || l.includes('shoulder circle')) return {
      setup: 'Stand with feet shoulder-width apart, arms fully extended to your sides at shoulder height.',
      steps: ['Begin making small circles forward with both arms simultaneously.', 'Gradually increase the diameter of the circles over 10 reps.', 'Reverse direction after 10 large circles — backward for another 10.', 'Keep your shoulders down and away from your ears throughout.', 'Feel the shoulder joint warming through its full range of motion.'],
    };
    if (l.includes('hip circle') || l.includes('hip rotation')) return {
      setup: 'Stand with feet shoulder-width apart, hands on hips, knees slightly soft.',
      steps: ['Begin rotating your hips in a large, controlled circle clockwise.', 'Move through the full range — forward, side, back, other side.', 'Keep your upper body relatively still; isolate the hip movement.', 'Complete 10 rotations, then reverse counterclockwise for 10 more.', 'Gradually increase range with each rotation as the joint loosens.'],
    };
    if (l.includes('butt kick')) return {
      setup: 'Stand tall with feet hip-width apart, arms relaxed at your sides.',
      steps: ['Begin jogging in place, actively kicking your heels toward your glutes.', 'Alternate legs rapidly, keeping the motion controlled.', 'Keep your torso upright and core lightly engaged.', 'Let your arms swing naturally in rhythm with your legs.', 'Focus on the hamstring contraction as each heel comes up.'],
    };
    if (l.includes('leg swing')) return {
      setup: 'Stand beside a wall or support, holding lightly with one hand for balance.',
      steps: ['Swing your outer leg forward and back like a pendulum.', 'Start with a small range and gradually increase the arc.', 'Keep the motion controlled — don\'t force range with momentum.', 'Perform 10–12 swings per side in the sagittal (forward-back) plane.', 'Optionally add lateral swings for hip abductor prep.'],
    };
    if (l.includes('jumping jack') || l.includes('jump')) return {
      setup: 'Stand with feet together, arms relaxed at your sides.',
      steps: ['Jump your feet out to shoulder-width while raising your arms overhead.', 'Immediately reverse — feet together, arms return to sides.', 'Land softly with knees slightly bent to absorb impact.', 'Maintain a steady rhythm; coordinate arms and legs together.', 'Keep your core lightly braced to protect the lower back.'],
    };
    if (l.includes('inchworm')) return {
      setup: 'Stand tall with feet hip-width apart, arms at your sides.',
      steps: ['Hinge at the hips and place hands on the floor in front of your feet.', 'Walk your hands out in small steps until you\'re in a high plank.', 'Hold the plank for 1–2 seconds, then walk hands back to your feet.', 'Stand tall, squeezing glutes at the top.', 'Keep legs as straight as possible throughout the movement.'],
    };
    if (l.includes('lunge') || l.includes('world greatest')) return {
      setup: 'Begin standing tall. You\'ll need space to step forward.',
      steps: ['Step into a deep forward lunge with your right leg.', 'Place both hands on the floor inside your right foot.', 'Rotate your right arm up toward the ceiling, opening the chest.', 'Hold briefly, then return the hand to the floor and step back.', 'Alternate sides for the prescribed reps — this is full-body prep.'],
    };
    return {
      setup: 'Find an open space. Stand tall with feet hip-width apart, shoulders relaxed.',
      steps: ['Begin the movement slowly — allow joints to lubricate and muscles to warm.', 'Focus on controlled range of motion; don\'t force any position.', 'Breathe steadily — exhale on the exertion portion.', 'Gradually increase your range of motion over the first few reps.', 'Complete all prescribed reps before moving to the next exercise.'],
    };
  }

  if (type === 'cooldown') {
    if (l.includes('quad')) return {
      setup: 'Stand near a wall for balance. Shift your weight to one leg.',
      steps: ['Bend the non-standing knee, bringing your heel toward your glutes.', 'Grasp the ankle with the same-side hand.', 'Keep knees together and stand tall — don\'t lean forward.', 'Feel the stretch along the front of the thigh (quadricep).', 'Hold 30–45 seconds, then switch legs. Breathe slowly throughout.'],
    };
    if (l.includes('hamstring')) return {
      setup: 'Sit on a mat with both legs extended straight in front of you.',
      steps: ['Sit tall with your spine long and neutral, not rounded.', 'Hinge at the hips and reach toward your toes — keep the back flat.', 'Go only as far as you can while maintaining a neutral spine.', 'Hold the furthest comfortable position and breathe steadily.', 'On each exhale, allow yourself to sink slightly deeper. Hold 45–60 sec.'],
    };
    if (l.includes('child')) return {
      setup: 'Begin on all fours on a mat with knees hip-width or slightly wider.',
      steps: ['Sink your hips back toward your heels, extending arms forward.', 'Rest your forehead on the mat and let your spine lengthen.', 'Take slow, deep breaths — feel the back expand on each inhale.', 'Walk hands further forward to deepen the side-body stretch.', 'Hold 45–90 seconds, focusing on breathing and releasing tension.'],
    };
    if (l.includes('pigeon')) return {
      setup: 'From a downward dog or hands-and-knees position on a mat.',
      steps: ['Bring one shin forward, roughly parallel to the front of your mat.', 'Extend the back leg straight behind you with the foot flat.', 'Square your hips toward the front of the mat as much as possible.', 'Either stay upright on hands or lower torso over the front leg.', 'Hold 60–90 seconds per side, breathing deeply into the hip.'],
    };
    if (l.includes('hip flexor') || l.includes('kneeling')) return {
      setup: 'Begin in a kneeling position on a mat, one knee on the floor.',
      steps: ['Step one foot forward into a lunge — front knee at 90 degrees.', 'Shift your hips forward while keeping your torso upright.', 'Feel the stretch along the front of the back hip and thigh.', 'For a deeper stretch, reach the same-side arm overhead.', 'Hold 30–45 seconds per side. Breathe steadily throughout.'],
    };
    if (l.includes('cat') || l.includes('cow')) return {
      setup: 'Begin on all fours — hands under shoulders, knees under hips on a mat.',
      steps: ['Inhale: drop the belly toward the floor, lift the head and tailbone (Cow).', 'Exhale: round the spine toward the ceiling, tuck chin and pelvis (Cat).', 'Move slowly with full breath coordination.', 'Let the movement originate from the spine, not the hips or neck.', 'Complete 8–10 full breath cycles to mobilize the entire spine.'],
    };
    if (l.includes('shoulder') || l.includes('chest')) return {
      setup: 'Stand tall or sit upright with a neutral spine.',
      steps: ['Bring one arm across your body at shoulder height.', 'Use the opposite hand to gently press the arm toward the chest.', 'Keep your shoulder down and away from your ear.', 'Feel the stretch through the posterior shoulder and rear delt.', 'Hold 30 seconds each side, breathing slowly throughout.'],
    };
    return {
      setup: 'Find a comfortable position on a mat or open floor space.',
      steps: ['Move into the stretch slowly — never force range of motion.', 'Breathe deeply — inhale to lengthen, exhale to deepen.', 'Never push through pain; work at the edge of comfortable tension.', 'Hold the position for the prescribed duration without bouncing.', 'Focus on the muscle being stretched — mind-muscle connection matters.'],
    };
  }

  // Recovery
  if (l.includes('sleep') || l.includes('bed')) return {
    setup: 'Create a cool, dark environment. Avoid screens 30–60 minutes before bed.',
    steps: ['Aim for 7–9 hours of uninterrupted sleep after a hard training day.', 'Keep your room between 60–67°F (15–19°C) for optimal sleep quality.', 'Avoid caffeine after 2pm on heavy training days.', 'Use a consistent sleep and wake schedule — your body adapts to rhythm.', 'The majority of muscle repair and growth hormone release occurs during deep sleep.'],
  };
  if (l.includes('foam') || l.includes('roll') || l.includes('massage')) return {
    setup: 'Grab a foam roller or lacrosse ball. Find a clear area on the floor.',
    steps: ['Position the roller under the target muscle group.', 'Apply moderate pressure by supporting some weight through your hands.', 'Slowly roll 1–2 inches per second along the length of the muscle.', 'When you find a tender spot, pause and hold 5–10 seconds.', 'Spend 60–90 seconds per muscle group. Never roll directly on a joint.'],
  };
  if (l.includes('cold') || l.includes('ice') || l.includes('shower')) return {
    setup: 'Access cold water (10–15°C / 50–59°F). Do this within an hour of finishing.',
    steps: ['Begin with 30 seconds of cold exposure to allow the body to adapt.', 'Focus on slow, controlled breathing — resist the urge to tense up.', 'Gradually work toward 2–3 minutes of cold water exposure.', 'Immerse the trained muscle groups for maximum vasoconstriction benefit.', 'Upon finishing, allow natural rewarming rather than immediately switching to hot.'],
  };
  if (l.includes('protein') || l.includes('nutrition') || l.includes('meal')) return {
    setup: 'Within the post-workout anabolic window — ideally 30–60 minutes after your session.',
    steps: ['Consume 25–40g of high-quality protein within 60 minutes of finishing.', 'Include fast-digesting carbs to replenish glycogen (0.5g per kg bodyweight).', 'Prioritize whole food sources — chicken, rice, eggs, sweet potato are ideal.', 'Hydrate with at least 500ml of water alongside your post-workout meal.', 'Avoid high-fat meals immediately post-workout as they slow nutrient absorption.'],
  };
  if (l.includes('water') || l.includes('hydrat')) return {
    setup: 'Have a 500ml+ bottle of water ready immediately after your session.',
    steps: ['Begin rehydrating immediately — don\'t wait until you feel thirsty.', 'Target at least 500ml within the first 30 minutes post-workout.', 'Add electrolytes if your session was longer than 60 minutes or very intense.', 'Monitor urine color — pale yellow is the target (dark = dehydrated).', 'Continue hydrating all day; aim for 3+ litres total on training days.'],
  };
  if (l.includes('stretch') || l.includes('static')) return {
    setup: 'Find a quiet, open space. Allow at least 10 minutes for a full session.',
    steps: ['Begin with the largest muscle groups used in today\'s session.', 'Hold each stretch for a minimum of 30 seconds — 60 seconds is optimal.', 'Never bounce or force range of motion; work at mild tension.', 'Breathe into each stretch — oxygen helps the tissue relax and lengthen.', 'Finish with full-body deep breathing to bring the nervous system down.'],
  };
  if (l.includes('walk')) return {
    setup: 'Step outside or onto a treadmill at a comfortable, conversational pace.',
    steps: ['Begin at a slow, easy pace — the goal is active recovery, not exertion.', 'Maintain a pace where you can speak full sentences comfortably.', 'Walk for 10–20 minutes to bring your heart rate back to baseline.', 'Focus on deep, relaxed breathing throughout.', 'Light movement improves circulation and accelerates metabolic waste clearance.'],
  };
  return {
    setup: 'Schedule this recovery protocol within 2 hours of completing your training session.',
    steps: ['Commit to this protocol — recovery is where actual adaptation happens.', 'Approach it with the same intentionality as the workout itself.', 'Consistency in recovery compounds significantly over weeks and months.', 'Listen to your body — soreness indicates the stimulus worked.', 'Track how you feel after each recovery session to refine what works best.'],
  };
}

export default function WorkoutScreen() {
  const { colors, accent, isZeal, isDark } = useZealTheme();
  const ZEAL_ORANGE = '#f87116';
  const ctx = useAppContext();
  const currentWorkoutTitleRef = useRef(ctx.currentWorkoutTitle);
  currentWorkoutTitleRef.current = ctx.currentWorkoutTitle;
  const tracking = useWorkoutTracking();
  const { hasPro } = useSubscription();

  const [workout, setWorkout] = useState<GeneratedWorkout | null>(null);
  const [warmupHidden, setWarmupHidden] = useState(false);
  const [warmupModalVisible, setWarmupModalVisible] = useState(false);
  const [warmupChecked, setWarmupChecked] = useState<Set<number>>(new Set());
  const [warmupComplete, setWarmupComplete] = useState(false);
  const [cooldownModalVisible, setCooldownModalVisible] = useState(false);
  const [cooldownChecked, setCooldownChecked] = useState<Set<number>>(new Set());
  const [cooldownComplete, setCooldownComplete] = useState(false);
  const [recoveryModalVisible, setRecoveryModalVisible] = useState(false);
  const [recoveryChecked, setRecoveryChecked] = useState<Set<number>>(new Set());

  const [modifyVisible, setModifyVisible] = useState(false);
  const [detailExercise, setDetailExercise] = useState<WorkoutExercise | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [addMenuVisible, setAddMenuVisible] = useState(false);
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [addSheetMode, setAddSheetMode] = useState<AddMode>('exercise');
  const [trackedExercises, setTrackedExercises] = useState<Set<string>>(new Set());
  const [doneExercises, setDoneExercises] = useState<Set<string>>(new Set());
  const [expandedTrack, setExpandedTrack] = useState<string | null>(null);
  const [activeEditCell, setActiveEditCell] = useState<{ exId: string; setIdx: number; field: 'weight' | 'reps' } | null>(null);
  const [completedSets, setCompletedSets] = useState<Record<string, Set<number>>>({});
  const [profileVisible, setProfileVisible] = useState(false);
  const [aboutMeVisible, setAboutMeVisible] = useState(false);
  const [insightsVisible, setInsightsVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [colorThemeVisible, setColorThemeVisible] = useState(false);
  const [equipmentVisible, setEquipmentVisible] = useState(false);
  const [infoLabel, setInfoLabel] = useState<string | null>(null);
  const [regenCounter, setRegenCounter] = useState<number>(() => Math.floor(Math.random() * 9999) + 1);
  const [coreStyleBannerDismissed, setCoreStyleBannerDismissed] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null);
  const [logEditMode, setLogEditMode] = useState(false);
  const [swipeOpenSetKey, setSwipeOpenSetKey] = useState<string | null>(null);
  const [swapTargetExercise, setSwapTargetExercise] = useState<WorkoutExercise | null>(null);
  const [addSheetMuscleFilter, setAddSheetMuscleFilter] = useState<string>('');
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [scrollEnabled, setScrollEnabled] = useState<boolean>(true);
  const [activePanel, setActivePanel] = useState<0 | 1 | 2>(1);
  const activePanelRef = useRef<0 | 1 | 2>(1);
  const tab0Anim = useRef(new RNAnimated.Value(0)).current;
  const tab1Anim = useRef(new RNAnimated.Value(1)).current;
  const tab2Anim = useRef(new RNAnimated.Value(0)).current;
  const pillAnim = useRef(new RNAnimated.Value(1)).current;

  // Dynamic flex ratios: [pre, workout, post]
  const TAB_FLEX: Record<number, [number, number, number]> = {
    0: [2, 1.5, 1.5],   // Pre active: 40% / 30% / 30%
    1: [1, 3, 1],        // Workout active: 20% / 60% / 20%
    2: [1.5, 1.5, 2],   // Post active: 30% / 30% / 40%
  };

  const labelFadeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const switchPanelTab = useCallback((tab: 0 | 1 | 2) => {
    const prev = activePanelRef.current;
    if (prev === tab) return;
    activePanelRef.current = tab;

    // Cancel any pending label fade-in from a previous quick tap
    if (labelFadeTimeout.current) clearTimeout(labelFadeTimeout.current);

    // Smoothly fade out the outgoing label
    const prevAnim = prev === 0 ? tab0Anim : prev === 1 ? tab1Anim : tab2Anim;
    RNAnimated.timing(prevAnim, {
      toValue: 0,
      duration: 90,
      useNativeDriver: true,
    }).start();

    // Springy flex expansion — icons push with a natural bounce
    LayoutAnimation.configureNext({
      duration: 340,
      create: { type: 'easeInEaseOut', property: 'scaleXY' },
      update: { type: 'spring', springDamping: 0.62 },
    });
    setActivePanel(tab);

    // Pill slides smoothly — gentle tension so it never catches or overshoots hard
    RNAnimated.spring(pillAnim, {
      toValue: tab,
      useNativeDriver: false,
      tension: 72,
      friction: 11,
    }).start();

    // Fade in the new label midway through the slide (overlapping feel)
    const targetAnim = tab === 0 ? tab0Anim : tab === 1 ? tab1Anim : tab2Anim;
    labelFadeTimeout.current = setTimeout(() => {
      RNAnimated.spring(targetAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 18,
        bounciness: 3,
      }).start();
    }, 150);

    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
  }, [pillAnim, tab0Anim, tab1Anim, tab2Anim]);

  const [tabBarWidth, setTabBarWidth] = useState(0); // kept for walkthrough refs
  const activeDragIdRef = useRef<string | null>(null);
  const [dragInsertIdx, setDragInsertIdx] = useState<number | null>(null);
  const [dragGhostItems, setDragGhostItems] = useState<WorkoutExercise[]>([]);
  const [itemDetail, setItemDetail] = useState<{ name: string; description: string; color: string; benefit?: string; type?: 'warmup' | 'cooldown' | 'recovery' } | null>(null);
  const [showWheelGuide, setShowWheelGuide] = useState(false);
  const wheelGuideSeen = useRef(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGeneratingOverlay, setShowGeneratingOverlay] = useState(false);
  const [generatingIsAI, setGeneratingIsAI] = useState(false);
  const [generatingElapsed, setGeneratingElapsed] = useState(0);
  const generatingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const generateReqIdRef = useRef(0);
  const overlayFadeAnim = useRef(new RNAnimated.Value(1)).current;
  const dumbbellRotateAnim = useRef(new RNAnimated.Value(0)).current;
  const dumbbellPulseAnim = useRef(new RNAnimated.Value(1)).current;
  const workoutRef = useRef<GeneratedWorkout | null>(null);
  const dragMovingIds = useRef<string[]>([]);
  const dragGhostAnim = useRef(new RNAnimated.Value(0)).current;
  const sectionPageY = useRef(0);
  const scrollOffsetRef = useRef(0);
  const rowLayoutsRef = useRef<Map<string, { y: number; height: number }>>(new Map());
  const exercisesSectionRef = useRef<View | null>(null);
  const gripPanResponderMap = useRef<Map<string, ReturnType<typeof PanResponder.create>>>(new Map());
  const groupGripPanResponderMap = useRef<Map<string, ReturnType<typeof PanResponder.create>>>(new Map());
  const dragStartPageY = useRef(0);
  const handleDropToIndexRef = useRef<(ids: string[], insertIdx: number) => void>(() => {});

  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const walkthroughChecked = useRef(false);
  const lastResetToken = useRef(ctx.newUserResetToken);
  const preTabRef = useRef<View | null>(null);
  const postTabRef = useRef<View | null>(null);
  const workoutTabRef = useRef<View | null>(null);
  const firstExRowRef = useRef<View | null>(null);
  const trackPanelRef = useRef<View | null>(null);
  const modifyBtnRef = useRef<View | null>(null);
  const addBtnRef = useRef<View | null>(null);
  const finishBtnRef = useRef<View | null>(null);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const scrollGesture = useMemo(() => Gesture.Native(), []);
  const [walkthroughRects, setWalkthroughRects] = useState<({
    x: number; y: number; width: number; height: number;
  } | null)[]>(Array(8).fill(null));

  useEffect(() => {
    AsyncStorage.getItem('@zeal_wheel_guide_seen_v1').then((val) => {
      if (val === 'true') {
        wheelGuideSeen.current = true;
      }
    });
  }, []);

  const measureWalkthroughRefs = useCallback(() => {
    const refs: (React.RefObject<View | null>)[] = [
      preTabRef, postTabRef, workoutTabRef,
      firstExRowRef, trackPanelRef, modifyBtnRef,
      addBtnRef, finishBtnRef,
    ];
    const newRects: ({ x: number; y: number; width: number; height: number } | null)[] = [];
    let pending = refs.length;
    refs.forEach((ref, idx) => {
      if (ref.current) {
        ref.current.measureInWindow((x, y, w, h) => {
          newRects[idx] = { x, y, width: w, height: h };
          pending--;
          if (pending === 0) {
            setWalkthroughRects([...newRects]);
          }
        });
      } else {
        newRects[idx] = null;
        pending--;
        if (pending === 0) {
          setWalkthroughRects([...newRects]);
        }
      }
    });
  }, []);

  const remeasureSingleRef = useCallback((idx: number, ref: React.RefObject<View | null>) => {
    if (ref.current) {
      ref.current.measureInWindow((x, y, w, h) => {
        setWalkthroughRects(prev => {
          const next = [...prev];
          next[idx] = { x, y, width: w, height: h };
          return next;
        });
      });
    }
  }, []);

  useEffect(() => {
    if (showWalkthrough && workout) {
      setTimeout(() => measureWalkthroughRefs(), 500);
    }
  }, [showWalkthrough, workout, activePanel, expandedTrack, measureWalkthroughRefs]);

  useEffect(() => {
    workoutRef.current = workout;
  }, [workout]);

  useEffect(() => {
    gripPanResponderMap.current.clear();
    groupGripPanResponderMap.current.clear();
    rowLayoutsRef.current.clear();
  }, [workout]);

  useEffect(() => {
    if (activeDragId !== null) {
      setSwipeOpenId(null);
    }
  }, [activeDragId]);

  const startWorkoutScale = useSharedValue(1);
  const completeWorkoutScale = useSharedValue(1);
  const startWorkoutAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: startWorkoutScale.value }] }));
  const completeWorkoutAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: completeWorkoutScale.value }] }));

  const chipExpandHeight = useSharedValue(CHIP_H);
  const chipExpandStyle = useAnimatedStyle(() => ({
    height: chipExpandHeight.value,
    overflow: 'hidden' as const,
  }));

  const { width: screenWidth } = useWindowDimensions();
  const wheelWeightW = screenWidth < 400 ? 80 : 96;
  const wheelRepsW = screenWidth < 400 ? 50 : 60;
  /** Shorter wheels in log sets; must match WheelPicker default width for single-column headers. */
  const logWheelItemH = 38;
  const logWheelSingleColW = 80;

  const cardBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  const rotateLoopRef = useRef<RNAnimated.CompositeAnimation | null>(null);
  const pulseLoopRef = useRef<RNAnimated.CompositeAnimation | null>(null);

  const startDumbbellAnim = useCallback(() => {
    dumbbellRotateAnim.setValue(0);
    rotateLoopRef.current = RNAnimated.loop(
      RNAnimated.timing(dumbbellRotateAnim, {
        toValue: 1,
        duration: 1400,
        useNativeDriver: true,
      })
    );
    pulseLoopRef.current = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.spring(dumbbellPulseAnim, { toValue: 1.18, useNativeDriver: true, speed: 20, bounciness: 4 }),
        RNAnimated.spring(dumbbellPulseAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 4 }),
      ])
    );
    rotateLoopRef.current.start();
    pulseLoopRef.current.start();
  }, [dumbbellRotateAnim, dumbbellPulseAnim]);

  const stopDumbbellAnim = useCallback(() => {
    rotateLoopRef.current?.stop();
    pulseLoopRef.current?.stop();
    rotateLoopRef.current = null;
    pulseLoopRef.current = null;
  }, []);

  useEffect(() => {
    if (!isGenerating) {
      if (elapsedIntervalRef.current) {
        clearInterval(elapsedIntervalRef.current);
        elapsedIntervalRef.current = null;
      }
      RNAnimated.timing(overlayFadeAnim, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }).start(() => {
        stopDumbbellAnim();
        setShowGeneratingOverlay(false);
      });
    } else {
      overlayFadeAnim.setValue(1);
      setShowGeneratingOverlay(true);
      setGeneratingElapsed(0);
      startDumbbellAnim();
      elapsedIntervalRef.current = setInterval(() => {
        setGeneratingElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (elapsedIntervalRef.current) {
        clearInterval(elapsedIntervalRef.current);
        elapsedIntervalRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGenerating]);

  const doGenerate = useCallback((
    style?: string,
    split?: string,
    duration?: number,
    muscles?: string[],
    rest?: number,
    seedOffset?: number,
  ) => {
    const ov = ctx.workoutOverride;
    const todayPrescription = ctx.getTodayPrescription();
    const lm = ctx.lastModifyState;
    const hasPlan = !!ctx.activePlan;

    let effectiveStyle = style ?? ov?.style ?? (
      hasPlan && todayPrescription?.style
        ? todayPrescription.style
        : (lm?.style ?? ctx.workoutStyle)
    );
    const rawSplit = split ?? ov?.split ?? (
      hasPlan && todayPrescription?.session_type
        ? todayPrescription.session_type
        : (lm?.split ?? ctx.trainingSplit)
    );
    const effectiveSplit = rawSplit === 'Push, Pull, Legs'
      ? resolvePushPullLegs(ctx.muscleReadiness)
      : rawSplit;
    const effectiveDuration = duration ?? ov?.duration ?? (
      hasPlan && todayPrescription?.target_duration
        ? todayPrescription.target_duration
        : (lm?.duration ?? ctx.targetDuration)
    );
    const effectiveRest = rest ?? ov?.rest ?? (lm?.rest ?? ctx.restBetweenSets);
    const effectiveMuscles = muscles ?? ov?.muscles ?? (hasPlan ? [] : (lm?.muscles ?? []));

    if (!hasPro && PRO_STYLES_SET.has(effectiveStyle)) {
      console.log(`[WorkoutScreen] Core user has Pro style "${effectiveStyle}", falling back to Strength`);
      effectiveStyle = 'Strength';
    }

    if (hasPlan && todayPrescription && !ov && !style) {
      console.log(`[WorkoutScreen] Plan prescription active: phase=${todayPrescription.phase} style=${todayPrescription.style} session=${todayPrescription.session_type} vol=${todayPrescription.volume_modifier} int=${todayPrescription.intensity_modifier}`);
    }

    console.log(`[WorkoutScreen] doGenerate: style=${effectiveStyle} split=${effectiveSplit} duration=${effectiveDuration} rest=${effectiveRest} muscles=${effectiveMuscles.join(',')} override=${!!ov} hasPlan=${hasPlan} usedModify=${!hasPlan && !!lm} seedOffset=${seedOffset ?? 0}`);

    const prescription = (!ov && !style && hasPlan) ? todayPrescription : null;

    const isAI = getAIStyles(hasPro).has(effectiveStyle);
    setGeneratingIsAI(isAI);
    setGeneratingElapsed(0);
    setIsGenerating(true);
    const genStart = Date.now();

    const reqId = ++generateReqIdRef.current;
    let finished = false;

    const params = {
      style: effectiveStyle,
      split: effectiveSplit,
      targetDuration: effectiveDuration,
      restSlider: effectiveRest,
      availableEquipment: ctx.selectedEquipment,
      fitnessLevel: ctx.fitnessLevel,
      sex: ctx.sex,
      specialLifeCase: ctx.specialLifeCase,
      specialLifeCaseDetail: ctx.specialLifeCaseDetail,
      warmUp: ctx.warmUp,
      coolDown: ctx.coolDown,
      recovery: ctx.recovery,
      addCardio: ctx.addCardio,
      specificMuscles: effectiveMuscles,
      seedOffset: seedOffset ?? 0,
    } as const;

    const applyGeneratedWorkout = (finalWorkout: GeneratedWorkout, minDelayMs: number) => {
      if (finished) return;
      finished = true;

      const elapsed = Date.now() - genStart;
      const remaining = Math.max(0, minDelayMs - elapsed);
      if (generatingTimerRef.current) clearTimeout(generatingTimerRef.current);
      generatingTimerRef.current = setTimeout(() => {
        if (generateReqIdRef.current !== reqId) return;
        setWorkout(finalWorkout);
        tracking.setCurrentGeneratedWorkout(finalWorkout);
        ctx.setCurrentWorkoutTitle(
          buildCreativeWorkoutTitle({
            style: finalWorkout.style,
            split: finalWorkout.split,
            metconFormat: finalWorkout.metconFormat,
            duration: finalWorkout.estimatedDuration,
            previousTitle: currentWorkoutTitleRef.current,
          })
        );
        setWarmupHidden(false);
        setTrackedExercises(new Set());
        setDoneExercises(new Set());
        setExpandedTrack(null);
        setCompletedSets({});
        setIsGenerating(false);
      }, remaining);
    };

    // Hard cap: never block longer than 20 seconds.
    const hardTimeout = setTimeout(() => {
      if (generateReqIdRef.current !== reqId) return;
      console.log('[WorkoutScreen] Generation exceeded 20s — falling back to rule engine');
      setGeneratingIsAI(false);
      const fallback = generateWorkout(params as any, prescription);
      applyGeneratedWorkout(fallback, 0);
    }, 20000);

    generateWorkoutAsync(params as any, prescription, hasPro).then(async (w) => {
      if (generateReqIdRef.current !== reqId) return;
      let finalWorkout = w;
      if (ctx.coreFinisher) {
        try {
          console.log('[WorkoutScreen] Core finisher enabled, generating AI core exercises...');
          const coreExercises = await Promise.race([
            generateCoreFinisher({
              fitnessLevel: ctx.fitnessLevel,
              sex: ctx.sex,
              availableEquipment: ctx.selectedEquipment,
            }),
            new Promise<WorkoutExercise[]>((_, reject) => {
              setTimeout(() => reject(new Error('core finisher timeout')), 5000);
            }),
          ]);
          finalWorkout = { ...w, coreFinisher: coreExercises };
          console.log('[WorkoutScreen] Core finisher appended:', coreExercises.length, 'exercises');
        } catch (err) {
          console.log('[WorkoutScreen] Core finisher generation failed, skipping:', err);
        }
      }
      clearTimeout(hardTimeout);
      applyGeneratedWorkout(finalWorkout, 1500);
    }).catch((err) => {
      clearTimeout(hardTimeout);
      if (generateReqIdRef.current !== reqId) return;
      console.log('[WorkoutScreen] Generation failed, falling back to rule engine:', err);
      setGeneratingIsAI(false);
      const fallback = generateWorkout(params as any, prescription);
      applyGeneratedWorkout(fallback, 0);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, hasPro]);

  useFocusEffect(
    useCallback(() => {
      if (!workout && !tracking.isWorkoutActive) {
        if (tracking.currentGeneratedWorkout) {
          console.log('[WorkoutScreen] Using pre-generated workout (from preview trigger)');
          setIsGenerating(false);
          setGeneratingIsAI(false);
          setGeneratingElapsed(0);
          setWorkout(tracking.currentGeneratedWorkout);
          ctx.setCurrentWorkoutTitle(
            buildCreativeWorkoutTitle({
              style: tracking.currentGeneratedWorkout.style,
              split: tracking.currentGeneratedWorkout.split,
              metconFormat: tracking.currentGeneratedWorkout.metconFormat,
              duration: tracking.currentGeneratedWorkout.estimatedDuration,
              previousTitle: currentWorkoutTitleRef.current,
            })
          );
          setWarmupHidden(false);
          setTrackedExercises(new Set());
          setDoneExercises(new Set());
          setExpandedTrack(null);
          setCompletedSets({});
        } else if (tracking.isGeneratingWorkout) {
          // Background generation is already running; show the animation while we wait.
          setGeneratingIsAI(false);
          setGeneratingElapsed(0);
          setIsGenerating(true);
        } else {
          doGenerate();
        }
      }
    }, [workout, tracking.isWorkoutActive, tracking.currentGeneratedWorkout, tracking.isGeneratingWorkout, doGenerate, ctx])
  );

  useEffect(() => {
    if (ctx.newUserResetToken !== 0 && ctx.newUserResetToken !== lastResetToken.current) {
      lastResetToken.current = ctx.newUserResetToken;
      walkthroughChecked.current = false;
      console.log('[WorkoutScreen] New user reset detected — will re-check walkthrough');
    }
  }, [ctx.newUserResetToken]);

  useEffect(() => {
    if (workout && !walkthroughChecked.current) {
      walkthroughChecked.current = true;
      console.log('[WorkoutScreen] Workout ready, checking walkthrough status...');
      AsyncStorage.getItem(WALKTHROUGH_KEY).then((val) => {
        if (val !== 'true') {
          console.log('[WorkoutScreen] First visit — launching workout walkthrough');
          setTimeout(() => {
            setShowWalkthrough(true);
          }, 1200);
        } else {
          console.log('[WorkoutScreen] Walkthrough already seen');
        }
      });
    }
  }, [workout]);

  const handleWalkthroughDismiss = useCallback(() => {
    console.log('[WorkoutScreen] Walkthrough dismissed');
    setShowWalkthrough(false);
    AsyncStorage.setItem(WALKTHROUGH_KEY, 'true').catch(() => {});
  }, []);

  const handleWalkthroughRequestTab = useCallback((tab: 0 | 1 | 2) => {
    switchPanelTab(tab);
    setTimeout(() => measureWalkthroughRefs(), 400);
  }, [switchPanelTab, measureWalkthroughRefs]);

  const handleWalkthroughExpandFirst = useCallback(() => {
    if (workout && workout.workout.length > 0) {
      const firstEx = workout.workout[0];
      if (expandedTrack !== firstEx.id) {
        setExpandedTrack(firstEx.id);
        if (!tracking.exerciseLogs[firstEx.id]) {
          tracking.initExerciseLog(firstEx);
        }
      }
      setTimeout(() => measureWalkthroughRefs(), 500);
    }
  }, [workout, expandedTrack, tracking, measureWalkthroughRefs]);

  const handleWalkthroughCollapse = useCallback(() => {
    if (expandedTrack) {
      setExpandedTrack(null);
    }
  }, [expandedTrack]);

  const handleWalkthroughScrollTop = useCallback(() => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  const handleWalkthroughScrollBottom = useCallback(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, []);

  useEffect(() => {
    if (ctx.workoutOverride) {
      console.log('[WorkoutScreen] Workout override detected, regenerating with override params:', ctx.workoutOverride);
      doGenerate(
        ctx.workoutOverride.style,
        ctx.workoutOverride.split,
        ctx.workoutOverride.duration,
        ctx.workoutOverride.muscles,
        ctx.workoutOverride.rest,
      );
      ctx.clearWorkoutOverride();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.workoutOverride]);

  useEffect(() => {
    if (ctx.settingsSaveVersion > 0 && workout) {
      console.log('[WorkoutScreen] Settings saved (version', ctx.settingsSaveVersion, '), regenerating workout with new settings');
      doGenerate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.settingsSaveVersion]);

  useEffect(() => {
    if (ctx.loadedWorkout) {
      console.log('[WorkoutScreen] Loaded saved workout detected:', ctx.loadedWorkout.name, 'with', ctx.loadedWorkout.exercises.length, 'exercises');
      setGeneratingIsAI(false);
      setGeneratingElapsed(0);
      setIsGenerating(true);
      const genStart = Date.now();
      const loadedName = ctx.loadedWorkout.name;
      const mappedExercises = workoutExercisesFromSavedRefs(
        ctx.loadedWorkout.exercises,
        ctx.workoutStyle,
      );
      const w = generateWorkoutFromSavedExercises(
        mappedExercises,
        ctx.restBetweenSets,
        ctx.sex,
        ctx.fitnessLevel,
        ctx.warmUp,
        ctx.coolDown,
        ctx.recovery,
      );
      ctx.setLoadedWorkout(null);
      const elapsed = Date.now() - genStart;
      const remaining = Math.max(0, 1500 - elapsed);
      if (generatingTimerRef.current) clearTimeout(generatingTimerRef.current);
      generatingTimerRef.current = setTimeout(() => {
        setWorkout(w);
        tracking.setCurrentGeneratedWorkout(w);
        ctx.setCurrentWorkoutTitle(loadedName);
        setWarmupHidden(false);
        setTrackedExercises(new Set());
        setDoneExercises(new Set());
        setExpandedTrack(null);
        setCompletedSets({});
        setIsGenerating(false);
      }, remaining);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.loadedWorkout]);

  const handleModifyChanged = useCallback((style: string, split: string, duration: number, muscles: string[], rest: number) => {
    doGenerate(style, split, duration, muscles, rest);
  }, [doGenerate]);

  const handleRegenerate = useCallback(() => {
    Alert.alert(
      'Generate New Workout?',
      'This will replace your current workout plan.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          style: 'destructive',
          onPress: () => {
            const next = regenCounter + 1;
            setRegenCounter(next);
            console.log(`[WorkoutScreen] Regenerate pressed, seedOffset=${next}`);
            doGenerate(undefined, undefined, undefined, undefined, undefined, next);
          },
        },
      ]
    );
  }, [doGenerate, regenCounter]);

  const handlePullRefresh = useCallback(() => {
    if (tracking.isWorkoutActive) {
      setIsRefreshing(false);
      return;
    }
    Alert.alert(
      'Generate New Workout?',
      'This will replace your current workout plan.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => { setIsRefreshing(false); } },
        {
          text: 'Generate',
          style: 'destructive',
          onPress: () => {
            setIsRefreshing(true);
            const next = regenCounter + 1;
            setRegenCounter(next);
            console.log(`[WorkoutScreen] Pull-to-refresh, seedOffset=${next}`);
            doGenerate(undefined, undefined, undefined, undefined, undefined, next);
            setTimeout(() => setIsRefreshing(false), 600);
          },
        },
      ]
    );
  }, [doGenerate, regenCounter, tracking.isWorkoutActive]);

  const handleWarmupDone = useCallback(() => {
    setWarmupComplete(true);
    setWarmupModalVisible(false);
  }, []);

  const handleToggleWarmupItem = useCallback((idx: number) => {
    setWarmupChecked(prev => {
      const n = new Set(prev);
      if (n.has(idx)) n.delete(idx);
      else n.add(idx);
      return n;
    });
  }, []);

  const handleExerciseTap = useCallback((ex: WorkoutExercise) => {
    setDetailExercise(ex);
    setDetailVisible(true);
  }, []);

  const handleExerciseLongPress = useCallback((ex: WorkoutExercise) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDetailExercise(ex);
    setDetailVisible(true);
  }, []);

  const expandedTrackRef = useRef<string | null>(null);
  expandedTrackRef.current = expandedTrack;

  const handleToggleTrackPanel = useCallback((exId: string, exercise?: WorkoutExercise) => {
    const isCompleted = tracking.exerciseLogs[exId]?.completed === true;
    if (isCompleted) {
      tracking.unmarkExerciseComplete(exId);
      setTrackedExercises(prev => {
        const n = new Set(prev);
        n.delete(exId);
        return n;
      });
      setExpandedTrack(exId);
      return;
    }
    // Use the ref to read the current value without adding it to deps,
    // avoiding stale-callback recreation on every panel toggle.
    const isOpening = expandedTrackRef.current !== exId;
    if (!wheelGuideSeen.current && isOpening) {
      wheelGuideSeen.current = true;
      setTimeout(() => setShowWheelGuide(true), 320);
    }
    setSwipeOpenId(null);
    if (isOpening) {
      if (exercise && !tracking.exerciseLogs[exId]) {
        InteractionManager.runAfterInteractions(() => {
          tracking.initExerciseLog(exercise);
        });
      }
    } else {
      setActiveEditCell(null);
      chipExpandHeight.value = CHIP_H;
    }
    setExpandedTrack((prev) => prev === exId ? null : exId);
    setLogEditMode(false);
    setSwipeOpenSetKey(null);
  }, [tracking]);

  const openChip = useCallback((cell: { exId: string; setIdx: number; field: 'weight' | 'reps' }) => {
    chipExpandHeight.value = CHIP_H;
    setActiveEditCell(cell);
    // expand animation deferred to useEffect so React commits first —
    // prevents the old chip (still using chipExpandStyle) from expanding too
  }, [chipExpandHeight]);

  useEffect(() => {
    if (activeEditCell) {
      chipExpandHeight.value = withSpring(PICKER_H, CHIP_SPRING);
    }
  }, [activeEditCell]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeChip = useCallback(() => {
    chipExpandHeight.value = withSpring(CHIP_H, CHIP_SPRING, (finished) => {
      if (finished) runOnJS(setActiveEditCell)(null);
    });
  }, [chipExpandHeight]);

  const handleToggleSet = useCallback((exId: string, setIdx: number, exercise?: WorkoutExercise) => {
    closeChip();
    if (!tracking.isWorkoutActive && workout) {
      tracking.startWorkout(workout, true);
    }
    setCompletedSets((prev) => {
      const s = new Set(prev[exId] ?? []);
      if (s.has(setIdx)) s.delete(setIdx);
      else s.add(setIdx);
      return { ...prev, [exId]: s };
    });
    if (exercise) {
      const restSec = calculateRest(exercise.movementType as MovementType, Math.round(ctx.restBetweenSets * 100));
      let effectiveRestSec = restSec;
      if (exercise.groupType === 'superset' && exercise.groupId && workout) {
        const groupExercises = workout.workout.filter(ex => ex.groupId === exercise.groupId);
        const isLastInGroup = groupExercises[groupExercises.length - 1]?.id === exId;
        if (!isLastInGroup) {
          effectiveRestSec = 0;
          console.log('[WorkoutScreen] Superset mid-exercise, skipping rest timer for:', exercise.name);
        } else {
          console.log('[WorkoutScreen] Superset final exercise, rest timer will start for:', exercise.name);
        }
      }
      requestAnimationFrame(() => {
        tracking.markSetDone(exId, setIdx, effectiveRestSec);
      });
    }
  }, [tracking, ctx.restBetweenSets, workout, closeChip]);

  const handleMarkExerciseDone = useCallback((exId: string, exercise?: WorkoutExercise) => {
    if (!tracking.isWorkoutActive && workout) {
      tracking.startWorkout(workout, true);
    }
    const newTracked = new Set(trackedExercises);
    newTracked.add(exId);
    const exerciseCount = workout?.workout.length ?? 0;
    const isLastExercise = newTracked.size >= exerciseCount && exerciseCount > 0;
    setTrackedExercises(newTracked);
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setExpandedTrack(null);
    const restSec = exercise
      ? calculateRest(exercise.movementType as MovementType, Math.round(ctx.restBetweenSets * 100))
      : 90;
    requestAnimationFrame(() => {
      tracking.markExerciseComplete(exId, isLastExercise ? 0 : restSec);
    });
  }, [tracking, ctx.restBetweenSets, workout, trackedExercises]);

  const handleToggleMobilityDone = useCallback((exId: string) => {
    setDoneExercises((prev) => {
      const n = new Set(prev);
      if (n.has(exId)) n.delete(exId);
      else n.add(exId);
      return n;
    });
    setTrackedExercises((prev) => {
      const n = new Set(prev);
      if (n.has(exId)) n.delete(exId);
      else n.add(exId);
      return n;
    });
  }, []);

  const handleAddExercises = useCallback((exercises: WorkoutExercise[]) => {
    if (!workout) return;
    if (swapTargetExercise !== null && exercises.length === 1) {
      console.log('[WorkoutScreen] Swapping exercise:', swapTargetExercise.name, '->', exercises[0].name);
      const inCoreFinisher = workout.coreFinisher?.some(ex => ex.id === swapTargetExercise.id);
      let updated: GeneratedWorkout;
      if (inCoreFinisher) {
        updated = {
          ...workout,
          coreFinisher: workout.coreFinisher!.map(ex =>
            ex.id === swapTargetExercise.id ? { ...exercises[0], id: swapTargetExercise.id } : ex
          ),
        };
      } else {
        updated = {
          ...workout,
          workout: workout.workout.map(ex =>
            ex.id === swapTargetExercise.id ? { ...exercises[0], id: swapTargetExercise.id } : ex
          ),
        };
      }
      setWorkout(updated);
      tracking.setCurrentGeneratedWorkout(updated);
      setSwapTargetExercise(null);
    } else {
      console.log('[WorkoutScreen] Adding', exercises.length, 'exercise(s) to workout');
      const updated = { ...workout, workout: [...workout.workout, ...exercises] };
      setWorkout(updated);
      tracking.setCurrentGeneratedWorkout(updated);
      setSwapTargetExercise(null);
    }
  }, [workout, swapTargetExercise, tracking]);

  const handleOpenAddSheet = useCallback((mode: AddMode) => {
    setSwapTargetExercise(null);
    setAddSheetMuscleFilter('');
    setAddMenuVisible(false);
    setAddSheetMode(mode);
    setTimeout(() => setAddSheetVisible(true), 100);
  }, []);

  const handleDeleteExercise = useCallback((exId: string) => {
    if (!workout) return;
    const inMain = workout.workout.some(ex => ex.id === exId);
    const inCoreFinisher = workout.coreFinisher?.some(ex => ex.id === exId);
    let updated: GeneratedWorkout;
    if (inMain) {
      updated = { ...workout, workout: workout.workout.filter(ex => ex.id !== exId) };
    } else if (inCoreFinisher) {
      updated = { ...workout, coreFinisher: workout.coreFinisher!.filter(ex => ex.id !== exId) };
    } else {
      const sessions75 = (workout as any).sessions75Hard;
      if (sessions75) {
        const updatedSessions = sessions75.map((s: any) => ({
          ...s,
          exercises: s.exercises.filter((ex: any) => ex.id !== exId),
        }));
        updated = { ...workout, sessions75Hard: updatedSessions } as GeneratedWorkout;
      } else {
        return;
      }
    }
    setWorkout(updated);
    tracking.setCurrentGeneratedWorkout(updated);
    setSwipeOpenId(null);
    console.log('[WorkoutScreen] Deleted exercise:', exId);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [workout, tracking]);

  const handleSwapExercise = useCallback((ex: WorkoutExercise) => {
    console.log('[WorkoutScreen] Initiating swap for:', ex.name);
    setSwapTargetExercise(ex);
    const firstMuscle = ex.muscleGroup.split(',')[0].trim().toLowerCase();
    setAddSheetMuscleFilter(firstMuscle);
    setAddSheetMode('exercise');
    setSwipeOpenId(null);
    setTimeout(() => setAddSheetVisible(true), 100);
  }, []);

  const handleDropToIndex = useCallback((movingIds: string[], insertIdx: number) => {
    const w = workoutRef.current;
    if (!w) return;
    const exercises = [...w.workout];
    const movingExercises = exercises.filter(e => movingIds.includes(e.id));
    const remaining = exercises.filter(e => !movingIds.includes(e.id));
    let targetId: string | null = null;
    for (let i = insertIdx; i < exercises.length; i++) {
      if (!movingIds.includes(exercises[i].id)) {
        targetId = exercises[i].id;
        break;
      }
    }
    if (targetId) {
      const targetNewIdx = remaining.findIndex(e => e.id === targetId);
      remaining.splice(targetNewIdx, 0, ...movingExercises);
    } else {
      remaining.push(...movingExercises);
    }
    const updated = { ...w, workout: remaining };
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setWorkout(updated);
    tracking.setCurrentGeneratedWorkout(updated);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [tracking]);
  handleDropToIndexRef.current = handleDropToIndex;

  const handleMoveExercise = useCallback((exId: string, direction: 'up' | 'down') => {
    if (!workout) return;
    const exercises = [...workout.workout];
    const idx = exercises.findIndex(e => e.id === exId);
    if (idx === -1) return;
    const ex = exercises[idx];

    if (ex.groupId) {
      const groupIndices: number[] = [];
      exercises.forEach((e, i) => { if (e.groupId === ex.groupId) groupIndices.push(i); });
      const first = groupIndices[0];
      const last = groupIndices[groupIndices.length - 1];
      const groupLen = groupIndices.length;

      if (direction === 'up' && first > 0) {
        const prevEx = exercises[first - 1];
        if (prevEx.groupId && prevEx.groupId !== ex.groupId) {
          const prevStart = exercises.findIndex(e => e.groupId === prevEx.groupId);
          const items = exercises.splice(first, groupLen);
          exercises.splice(prevStart, 0, ...items);
        } else {
          const items = exercises.splice(first, groupLen);
          exercises.splice(first - 1, 0, ...items);
        }
      } else if (direction === 'down' && last < exercises.length - 1) {
        const nextEx = exercises[last + 1];
        if (nextEx.groupId && nextEx.groupId !== ex.groupId) {
          const nextGroupIndices: number[] = [];
          exercises.forEach((e, i) => { if (e.groupId === nextEx.groupId) nextGroupIndices.push(i); });
          const nextLast = nextGroupIndices[nextGroupIndices.length - 1];
          const items = exercises.splice(first, groupLen);
          exercises.splice(nextLast - groupLen + 1, 0, ...items);
        } else {
          const items = exercises.splice(first, groupLen);
          exercises.splice(first + 1, 0, ...items);
        }
      }
    } else {
      if (direction === 'up' && idx > 0) {
        const prevEx = exercises[idx - 1];
        if (prevEx.groupId) {
          const prevStart = exercises.findIndex(e => e.groupId === prevEx.groupId);
          exercises.splice(idx, 1);
          exercises.splice(prevStart, 0, ex);
        } else {
          [exercises[idx - 1], exercises[idx]] = [exercises[idx], exercises[idx - 1]];
        }
      } else if (direction === 'down' && idx < exercises.length - 1) {
        const nextEx = exercises[idx + 1];
        if (nextEx.groupId) {
          const nextGroupIndices: number[] = [];
          exercises.forEach((e, i) => { if (e.groupId === nextEx.groupId) nextGroupIndices.push(i); });
          const nextLast = nextGroupIndices[nextGroupIndices.length - 1];
          exercises.splice(idx, 1);
          exercises.splice(nextLast, 0, ex);
        } else {
          [exercises[idx], exercises[idx + 1]] = [exercises[idx + 1], exercises[idx]];
        }
      }
    }

    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setWorkout({ ...workout, workout: exercises });
  }, [workout]);

  const _handleSwapWarmup = useCallback((idx: number) => {
    if (!workout) return;
    const newWarmup = [...workout.warmup];
    const alternatives = [
      { name: 'High Knees', description: '30 seconds of high knees to elevate heart rate.', swappable: true },
      { name: 'Butt Kicks', description: '30 seconds of butt kicks for hamstring activation.', swappable: true },
      { name: 'Shoulder Circles', description: 'Large arm circles, 10 each direction.', swappable: true },
    ];
    newWarmup[idx] = alternatives[idx % alternatives.length];
    setWorkout({ ...workout, warmup: newWarmup });
  }, [workout]);

  const _handleRemoveWarmup = useCallback((idx: number) => {
    if (!workout) return;
    setWorkout({ ...workout, warmup: workout.warmup.filter((_, i) => i !== idx) });
  }, [workout]);

  const handleStartWorkout = useCallback(() => {
    if (!workout) return;
    tracking.startWorkout(workout);
  }, [workout, tracking]);

  const handleCompleteWorkout = useCallback(() => {
    tracking.beginPostWorkout();
  }, [tracking]);

  const trackedCount = trackedExercises.size;
  const totalExercises = workout?.workout.length ?? 0;
  const currentStyle = workout?.style ?? ctx.workoutStyle;
  const currentAccent = WORKOUT_STYLE_COLORS[currentStyle] ?? accent;

  const hasCardio = (workout?.cardio.length ?? 0) > 0;

  const playCircleBg = currentAccent;
  const playIconColor = '#fff';

  const sessions75Hard = workout?.sessions75Hard ?? null;

  const createDragPanResponder = useCallback((exId: string, moveGroup: boolean) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (evt) => {
        const allExNow = workoutRef.current?.workout ?? [];
        const ex = allExNow.find(e => e.id === exId);
        const ids = (moveGroup && ex?.groupId)
          ? allExNow.filter(e => e.groupId === ex.groupId).map(e => e.id)
          : [exId];
        dragMovingIds.current = ids;
        const items = ids.map(id => allExNow.find(e => e.id === id)).filter(Boolean) as WorkoutExercise[];
        setDragGhostItems(items);
        dragStartPageY.current = evt.nativeEvent.pageY;
        exercisesSectionRef.current?.measureInWindow((x, y) => {
          sectionPageY.current = y ?? 0;
          console.log('[Drag] Section measureInWindow pageY:', y, 'scrollOff:', scrollOffsetRef.current);
        });
        dragGhostAnim.setValue(evt.nativeEvent.pageY - 28);
        setActiveDragId(exId);
        activeDragIdRef.current = exId;
        setScrollEnabled(false);
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      },
      onPanResponderMove: (evt) => {
        const pageY = evt.nativeEvent.pageY;
        dragGhostAnim.setValue(pageY - 28);
        const allExNow = workoutRef.current?.workout ?? [];
        const rowPageYPositions: { id: string; midPageY: number }[] = [];
        const sectionPgY = sectionPageY.current;
        for (let i = 0; i < allExNow.length; i++) {
          if (dragMovingIds.current.includes(allExNow[i].id)) continue;
          const layout = rowLayoutsRef.current.get(allExNow[i].id);
          if (!layout) continue;
          const midPageY = sectionPgY + layout.y + layout.height / 2;
          rowPageYPositions.push({ id: allExNow[i].id, midPageY });
        }
        let insertIdx = allExNow.length;
        for (let i = 0; i < rowPageYPositions.length; i++) {
          if (pageY < rowPageYPositions[i].midPageY) {
            insertIdx = allExNow.findIndex(e => e.id === rowPageYPositions[i].id);
            break;
          }
        }
        setDragInsertIdx(insertIdx);
      },
      onPanResponderRelease: (evt) => {
        const pageY = evt.nativeEvent.pageY;
        const allExNow = workoutRef.current?.workout ?? [];
        const sectionPgY = sectionPageY.current;
        const rowPageYPositions: { id: string; midPageY: number }[] = [];
        for (let i = 0; i < allExNow.length; i++) {
          if (dragMovingIds.current.includes(allExNow[i].id)) continue;
          const layout = rowLayoutsRef.current.get(allExNow[i].id);
          if (!layout) continue;
          const midPageY = sectionPgY + layout.y + layout.height / 2;
          rowPageYPositions.push({ id: allExNow[i].id, midPageY });
        }
        let insertIdx = allExNow.length;
        for (let i = 0; i < rowPageYPositions.length; i++) {
          if (pageY < rowPageYPositions[i].midPageY) {
            insertIdx = allExNow.findIndex(e => e.id === rowPageYPositions[i].id);
            break;
          }
        }
        if (dragMovingIds.current.length > 0) {
          handleDropToIndexRef.current(dragMovingIds.current, insertIdx);
        }
        dragMovingIds.current = [];
        setActiveDragId(null);
        activeDragIdRef.current = null;
        setScrollEnabled(true);
        setDragInsertIdx(null);
        setDragGhostItems([]);
      },
      onPanResponderTerminate: () => {
        dragMovingIds.current = [];
        setActiveDragId(null);
        activeDragIdRef.current = null;
        setScrollEnabled(true);
        setDragInsertIdx(null);
        setDragGhostItems([]);
      },
    });
  }, [dragGhostAnim]);

  const renderGripDots = useCallback((ex: WorkoutExercise) => {
    if (!gripPanResponderMap.current.has(ex.id)) {
      gripPanResponderMap.current.set(ex.id, createDragPanResponder(ex.id, false));
    }
    const pr = gripPanResponderMap.current.get(ex.id)!;
    const isMoving = activeDragIdRef.current !== null && dragMovingIds.current.includes(ex.id);
    return (
      <View
        {...pr.panHandlers}
        style={[styles.gripDots, isMoving && { opacity: 0.25 }]}
      >
        <View style={{ gap: 3 }}>
          <View style={{ width: 14, height: 1.5, borderRadius: 1, backgroundColor: colors.textMuted }} />
          <View style={{ width: 14, height: 1.5, borderRadius: 1, backgroundColor: colors.textMuted }} />
          <View style={{ width: 14, height: 1.5, borderRadius: 1, backgroundColor: colors.textMuted }} />
        </View>
      </View>
    );
  }, [colors.textMuted, createDragPanResponder]);

  const renderGroupGripDots = useCallback((ex: WorkoutExercise) => {
    if (!groupGripPanResponderMap.current.has(ex.id)) {
      groupGripPanResponderMap.current.set(ex.id, createDragPanResponder(ex.id, true));
    }
    const pr = groupGripPanResponderMap.current.get(ex.id)!;
    const isMoving = activeDragIdRef.current !== null && dragMovingIds.current.includes(ex.id);
    return (
      <View
        {...pr.panHandlers}
        style={[styles.gripDots, isMoving && { opacity: 0.25 }]}
      >
        <View style={{ gap: 3 }}>
          <View style={{ width: 14, height: 1.5, borderRadius: 1, backgroundColor: colors.textMuted }} />
          <View style={{ width: 14, height: 1.5, borderRadius: 1, backgroundColor: colors.textMuted }} />
          <View style={{ width: 14, height: 1.5, borderRadius: 1, backgroundColor: colors.textMuted }} />
        </View>
      </View>
    );
  }, [currentAccent, createDragPanResponder]);

  const cfData = useMemo(() => {
    if (!workout || currentStyle !== 'CrossFit') return null;
    const strength = workout.workout.filter((ex) => ex.groupType !== 'circuit');
    const metcon = workout.workout.filter((ex) => ex.groupType === 'circuit');
    return { strength, metcon };
  }, [workout, currentStyle]);

  const hiitRounds = useMemo(() => {
    if (!workout || currentStyle !== 'HIIT') return 3;
    const first = workout.workout[0];
    return first ? first.sets : 3;
  }, [workout, currentStyle]);

  const hiitTotalTime = useMemo(() => {
    if (!workout || currentStyle !== 'HIIT') return 0;
    let total = 0;
    for (const ex of workout.workout) {
      const workSec = parseInt(ex.reps, 10) || 40;
      const restMatch = ex.rest.match(/(\d+)/);
      const restSec = restMatch ? parseInt(restMatch[1], 10) : 20;
      total += workSec + restSec;
    }
    return Math.round((total * hiitRounds) / 60);
  }, [workout, currentStyle, hiitRounds]);

  const renderTrackButton = useCallback((ex: WorkoutExercise) => {
    const isExpanded = expandedTrack === ex.id;
    const isCompleted = tracking.exerciseLogs[ex.id]?.completed === true;
    return (
      <Pressable
        onPress={() => handleToggleTrackPanel(ex.id, ex)}
        hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}
        style={({ pressed }) => [{ paddingLeft: 8, paddingVertical: 8 }, pressed && { opacity: 0.8 }]}
      >
        <ChevronDown
          size={22}
          color={isCompleted ? colors.textMuted : '#ffffff'}
          strokeWidth={2.8}
          style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
        />
      </Pressable>
    );
  }, [expandedTrack, tracking.exerciseLogs, colors.textMuted, handleToggleTrackPanel]);

  const renderTrackingPanel = useCallback((ex: WorkoutExercise) => {
    if (expandedTrack !== ex.id) return null;
    const trackStyle = currentStyle;
    const isStrengthStyle = ['Strength', 'Bodybuilding'].includes(trackStyle);
    const isCrossFit = trackStyle === 'CrossFit';
    const isCFStrengthEx = isCrossFit && (cfData?.strength.some(s => s.id === ex.id) ?? false);
    const isCFMetconEx = isCrossFit && !isCFStrengthEx;
    const isHIIT = trackStyle === 'HIIT';
    const isCardioStyle = trackStyle === 'Cardio';
    const isHyrox = trackStyle === 'Hyrox';
    const isMobility = ['Mobility', 'Pilates'].includes(trackStyle);

    const log = tracking.exerciseLogs[ex.id];
    const suggestion = tracking.getExerciseSuggestion(ex);
    const isCompleted = tracking.exerciseLogs[ex.id]?.completed === true;
    const isInSuperset = ex.groupType === 'superset';
    const mutedWheelColor = isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.22)';
    const wheelBg = isDark ? 'rgba(0,0,0,0.32)' : 'rgba(255,255,255,0.30)';

    if (!isHyrox) {
      const targetReps = parseInt(ex.reps, 10) || 8;
      const isDumbbell = ex.equipment.toLowerCase().includes('dumbbell');
      const exName = (ex.name ?? '').toLowerCase();
      const isRepsOnly = isRepsOnlyMovement(ex);
      const isHoldForTime =
        !isRepsOnly &&
        (/s$|sec|min/i.test(ex.reps ?? '') ||
          exName.includes('plank') ||
          exName.includes('hold') ||
          exName.includes('hollow'));
      const isCaloriesMovement =
        !isHoldForTime &&
        (/\bcal\b/i.test(ex.reps ?? '') || exName.includes('assault bike') || exName.includes('echo bike'));
      const isCarryLike = exName.includes('carry');
      const isWeightDistance = isWeightDistanceMovement(ex) || isCarryLike;
      const isDistanceOnly =
        !isWeightDistance &&
        !isCaloriesMovement &&
        !isHoldForTime &&
        /\bm$/.test((ex.reps ?? '').toLowerCase());

      const metricDefault = isHoldForTime
        ? parseSecondsFromRepsLabel(ex.reps ?? '')
        : isCaloriesMovement
          ? (parseNumberPrefix(ex.reps ?? '') ?? 10)
          : isDistanceOnly || isWeightDistance
            ? (parseNumberPrefix(ex.reps ?? '') ?? 100)
            : (suggestion.lastReps > 0 ? suggestion.lastReps : targetReps);

      const setsData = log?.sets ?? Array.from({ length: ex.sets }, (_, i) => ({
        setNumber: i + 1,
        weight: isRepsOnly ? 0 : isDumbbell
          ? Math.round(suggestion.suggestedWeight / 2.5) * 2.5
          : Math.round(suggestion.suggestedWeight / 5) * 5,
        reps: metricDefault,
        done: false,
      }));
      const lastSets = tracking.getLastSetsForExercise(ex.name);
      const panelTitle = isCaloriesMovement ? 'Log calories'
        : isHoldForTime ? 'Log holds'
        : isDistanceOnly ? 'Log distance'
        : isWeightDistance ? 'Log carries'
        : isRepsOnly ? 'Log reps'
        : 'Log sets';
      const formatHoldTime = (s: number): string => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `${sec}s`;
      };
      return (
        <View style={[
          styles.trackPanel,
          { backgroundColor: 'transparent', borderTopColor: `${colors.border}30` },
        ]}>
          <View style={[
            styles.logSetsCard,
            {
              backgroundColor: isDark ? 'rgba(20,20,20,0.98)' : 'rgba(0,0,0,0.04)',
              borderColor: isDark ? `${colors.border}55` : `${colors.border}40`,
            },
          ]}>
            <View style={styles.trackPanelHeader}>
              <View style={styles.trackPanelTitleRow}>
                <Text style={[styles.trackPanelLabel, { color: colors.textSecondary }]}>{panelTitle}</Text>
                {isRepsOnly && (
                  <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '500' as const }}>Bodyweight</Text>
                  </View>
                )}
                {setsData.length > 0 && (
                  <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '500' as const }}>
                    {setsData.filter(s => s.done).length}/{setsData.length}
                  </Text>
                )}
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  onPress={() => handleExerciseTap(ex)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ marginRight: 12 }}
                >
                  <Clipboard size={13} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setLogEditMode(e => !e); setSwipeOpenSetKey(null); }}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={{ fontSize: 12, color: logEditMode ? currentAccent : colors.textSecondary, fontWeight: '500' as const }}>
                    {logEditMode ? 'Done' : 'Edit'}
                  </Text>
                </TouchableOpacity>
              </View>
              {!isRepsOnly && !isWeightDistance && !isHoldForTime && !isCaloriesMovement && !isDistanceOnly && suggestion.lastWeight > 0 && (
                <Text style={[styles.trackLastLabel, { color: colors.textSecondary }]}>
                  Last: {suggestion.lastWeight} lb × {suggestion.lastReps}
                </Text>
              )}
              {isRepsOnly && suggestion.lastReps > 0 && (
                <Text style={[styles.trackLastLabel, { color: colors.textSecondary }]}>
                  Last: {suggestion.lastReps} reps
                </Text>
              )}
              {isHoldForTime && (
                <Text style={[styles.trackLastLabel, { color: colors.textSecondary }]}>
                  Log hold time
                </Text>
              )}
              {isCaloriesMovement && (
                <Text style={[styles.trackLastLabel, { color: colors.textSecondary }]}>
                  Log calories
                </Text>
              )}
              {isDistanceOnly && (
                <Text style={[styles.trackLastLabel, { color: colors.textSecondary }]}>
                  Log distance (meters)
                </Text>
              )}
              {isWeightDistance && (
                <Text style={[styles.trackLastLabel, { color: colors.textSecondary }]}>
                  Log load + distance
                </Text>
              )}
            </View>

            <View style={styles.trackTableHeader}>
              <Text style={[styles.trackTableCol, styles.trackSetNumCol, { color: colors.textSecondary }]}>set</Text>
              {!isRepsOnly && !isHoldForTime && !isCaloriesMovement && !isDistanceOnly && (
                <Text style={[styles.trackTableCol, { color: colors.textSecondary, flex: 2, textAlign: 'center' as const }]}>
                  {`weight${isDumbbell ? ' ea.' : ''}`}
                </Text>
              )}
              <Text style={[styles.trackTableCol, { color: colors.textSecondary, flex: 1, textAlign: 'center' as const }]}>
                {isHoldForTime ? 'time (mm:ss)' : isCaloriesMovement ? 'cals' : (isDistanceOnly || isWeightDistance) ? 'dist (m)' : 'reps'}
              </Text>
              <View style={{ flex: 1 }} />
            </View>

            {setsData.map((set, setIdx) => {
              const hasWeight = !isRepsOnly && !isHoldForTime && !isCaloriesMovement && !isDistanceOnly;
              const isWeightActive = activeEditCell?.exId === ex.id && activeEditCell?.setIdx === setIdx && activeEditCell?.field === 'weight';
              const isRepsActive = activeEditCell?.exId === ex.id && activeEditCell?.setIdx === setIdx && activeEditCell?.field === 'reps';
              const isRowActive = activeEditCell?.exId === ex.id && activeEditCell?.setIdx === setIdx;
              const activeField = isRowActive ? activeEditCell!.field : null;
              const repsPickerValues = isHoldForTime ? TIME_VALUES_SECONDS
                : isCaloriesMovement ? CALORIES_VALUES
                : (isDistanceOnly || isWeightDistance) ? DISTANCE_VALUES_METERS
                : REPS_VALUES;
              const setKey = `${ex.id}_${setIdx}`;
              const chipBg = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)';
              return (
                <SwipeableSetRow
                  key={setIdx}
                  id={setKey}
                  isOpen={swipeOpenSetKey === setKey}
                  onOpen={setSwipeOpenSetKey}
                  onDelete={() => tracking.removeSet(ex.id, setIdx)}
                  waitForGesture={scrollGesture}
                >
                  <View style={styles.trackSetRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8, opacity: set.done ? 0.4 : 1 }}>
                      <Text style={[styles.trackSetNumCol, { color: colors.textMuted, fontSize: 16, fontWeight: '700' as const, textAlign: 'center' as const }]}>
                        {set.setNumber}
                      </Text>
                      {hasWeight && (
                        <TouchableOpacity
                          onPress={() => isWeightActive ? closeChip() : openChip({ exId: ex.id, setIdx, field: 'weight' })}
                          activeOpacity={0.85}
                          style={{ flex: 2 }}
                        >
                          <Animated.View
                            style={[
                              {
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: isWeightActive ? `${currentAccent}88` : `${colors.textMuted}35`,
                                backgroundColor: isWeightActive ? chipBg : chipBg,
                                alignItems: 'center' as const,
                                justifyContent: 'center' as const,
                              },
                              isWeightActive ? chipExpandStyle : { height: CHIP_H },
                            ]}
                          >
                            {isWeightActive ? (
                              <WheelPicker
                                values={isDumbbell ? DUMBBELL_WEIGHT_VALUES : WEIGHT_VALUES}
                                selectedValue={set.weight}
                                onValueChange={(v) => tracking.updateSetLog(ex.id, setIdx, 'weight', v)}
                                textColor={colors.text}
                                mutedColor={mutedWheelColor}
                                accentColor={currentAccent}
                                bgColor={isDark ? '#1c1c1c' : '#f0f0f0'}
                                visibleItems={3}
                              />
                            ) : (
                              <Text style={[styles.trackValueChipText, { color: colors.text }]}>
                                {set.weight}
                              </Text>
                            )}
                          </Animated.View>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={() => isRepsActive ? closeChip() : openChip({ exId: ex.id, setIdx, field: 'reps' })}
                        activeOpacity={0.85}
                        style={{ flex: 1 }}
                      >
                        <Animated.View
                          style={[
                            {
                              borderRadius: 12,
                              borderWidth: 1,
                              borderColor: isRepsActive ? `${currentAccent}88` : `${colors.textMuted}35`,
                              backgroundColor: chipBg,
                              alignItems: 'center' as const,
                              justifyContent: 'center' as const,
                            },
                            isRepsActive ? chipExpandStyle : { height: CHIP_H },
                          ]}
                        >
                          {isRepsActive ? (
                            <WheelPicker
                              values={repsPickerValues}
                              selectedValue={set.reps}
                              onValueChange={(v) => tracking.updateSetLog(ex.id, setIdx, 'reps', v)}
                              textColor={colors.text}
                              mutedColor={mutedWheelColor}
                              accentColor={currentAccent}
                              bgColor={isDark ? '#1c1c1c' : '#f0f0f0'}
                              visibleItems={3}
                              formatValue={isHoldForTime ? formatHoldTime : undefined}
                            />
                          ) : (
                            <Text style={[styles.trackValueChipText, { color: colors.text }]}>
                              {isHoldForTime ? formatHoldTime(set.reps) : set.reps}
                            </Text>
                          )}
                        </Animated.View>
                      </TouchableOpacity>
                      {(() => {
                        const prev = lastSets[setIdx];
                        if (!prev || !prev.done) return <View style={{ flex: 1 }} />;
                        const label = hasWeight
                          ? `${prev.weight} × ${prev.reps}`
                          : isHoldForTime
                          ? formatHoldTime(prev.reps)
                          : `${prev.reps}`;
                        return (
                          <Text style={{ flex: 1, fontSize: 11, color: colors.textMuted, opacity: 0.55, textAlign: 'right', paddingRight: 4, fontFamily: 'Outfit_400Regular' }} numberOfLines={1}>
                            {label}
                          </Text>
                        );
                      })()}
                    </View>
                    {logEditMode ? (
                      setsData.length > 1 ? (
                        <TouchableOpacity
                          onPress={() => tracking.removeSet(ex.id, setIdx)}
                          style={styles.trackSetDoneBtn}
                          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                          activeOpacity={0.6}
                        >
                          <Minus size={15} color="#ef4444" />
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.trackSetDoneBtn} />
                      )
                    ) : (
                      <TouchableOpacity
                        onPress={() => handleToggleSet(ex.id, setIdx, ex)}
                        activeOpacity={0.7}
                        style={[styles.trackSetDoneBtn, {
                          borderColor: set.done ? '#22c55e' : `${colors.textMuted}40`,
                          backgroundColor: set.done
                            ? 'rgba(34,197,94,0.15)'
                            : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'),
                        }]}
                      >
                        <Check size={15} color={set.done ? '#22c55e' : colors.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>
                </SwipeableSetRow>
              );
            })}

            <View style={styles.trackActions}>
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                onPress={() => tracking.addSet(ex.id)}
                activeOpacity={0.7}
                style={[styles.trackBtn, { borderColor: colors.border, marginRight: 8 }]}
              >
                <Plus size={11} color={colors.textSecondary} />
                <Text style={[styles.trackBtnText, { color: colors.textSecondary }]}>Add Set</Text>
              </TouchableOpacity>
              {isCompleted ? (
                <TouchableOpacity
                  style={[styles.trackDoneBtn, { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)' }]}
                  onPress={() => tracking.unmarkExerciseComplete(ex.id)}
                  activeOpacity={0.8}
                >
                  <RotateCcw size={10} color={colors.textMuted} />
                  <Text style={[styles.trackDoneBtnText, { color: colors.textMuted }]}>Undo</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.trackDoneBtn, { backgroundColor: accent, borderColor: accent }]}
                  onPress={() => {
                    closeChip();
                    setsData.forEach((set, idx) => {
                      if (!set.done) tracking.markSetDone(ex.id, idx, 0);
                    });
                    handleMarkExerciseDone(ex.id, ex);
                  }}
                  activeOpacity={0.8}
                >
                  <Check size={10} color="#fff" />
                  <Text style={[styles.trackDoneBtnText, { color: '#fff' }]}>Complete</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      );
    }

    if (isCFMetconEx || isHIIT) {
      return (
        <View style={[styles.trackPanel, { backgroundColor: 'transparent', borderTopColor: `${colors.border}30` }]}>
          <View style={[styles.logSetsCard, { backgroundColor: isDark ? 'rgba(20,20,20,0.98)' : 'rgba(0,0,0,0.04)', borderColor: isDark ? `${colors.border}55` : `${colors.border}40` }]}>
            <Text style={[styles.trackPanelLabel, { color: colors.textSecondary }]}>LOG RESULT</Text>
            <View style={styles.trackResultRow}>
              <View style={styles.trackResultField}>
                <Text style={[styles.trackFieldLabel, { color: colors.textMuted }]}>TIME / CAP</Text>
                <TextInput
                  style={[styles.trackInputWrapLarge, styles.trackInputTextLg, { backgroundColor: isDark ? '#1e1e1e' : '#f0f0f0', color: colors.text }]}
                  value={log?.timeCap ?? ''}
                  placeholder="12:30"
                  placeholderTextColor={colors.textMuted}
                  onChangeText={(v) => tracking.updateExerciseResult(ex.id, 'timeCap', v)}
                  keyboardType="numbers-and-punctuation"
                  returnKeyType="done"
                />
              </View>
              <View style={styles.trackResultField}>
                <Text style={[styles.trackFieldLabel, { color: colors.textMuted }]}>SCORE / ROUNDS</Text>
                <TextInput
                  style={[styles.trackInputWrapLarge, styles.trackInputTextLg, { backgroundColor: isDark ? '#1e1e1e' : '#f0f0f0', color: colors.text }]}
                  value={log?.scoreRounds ?? ''}
                  placeholder="e.g. 5+2"
                  placeholderTextColor={colors.textMuted}
                  onChangeText={(v) => tracking.updateExerciseResult(ex.id, 'scoreRounds', v)}
                  returnKeyType="done"
                />
              </View>
            </View>
            <Text style={[styles.trackFieldLabel, { color: colors.textMuted, marginTop: 8 }]}>NOTES (OPTIONAL)</Text>
            <TextInput
              style={[styles.trackInputWrapLarge, styles.trackInputTextLg, { backgroundColor: isDark ? '#1e1e1e' : '#f0f0f0', color: colors.text }]}
              value={log?.notes ?? ''}
              placeholder="Rx / Scaled, notes..."
              placeholderTextColor={colors.textMuted}
              onChangeText={(v) => tracking.updateExerciseResult(ex.id, 'notes', v)}
              multiline
              returnKeyType="default"
            />
            <TouchableOpacity
              style={[styles.trackSaveBtn, { backgroundColor: isCrossFit ? '#06b6d4' : '#60a5fa' }]}
              onPress={() => handleMarkExerciseDone(ex.id, ex)}
              activeOpacity={0.8}
            >
              <Check size={12} color={getContrastTextColor(isCrossFit ? '#06b6d4' : '#60a5fa')} />
              <Text style={[styles.trackDoneBtnText, { color: getContrastTextColor(isCrossFit ? '#06b6d4' : '#60a5fa') }]}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    const _logSetsCardStyle: ViewStyle[] = [styles.logSetsCard, { backgroundColor: isDark ? 'rgba(20,20,20,0.98)' : 'rgba(0,0,0,0.04)', borderColor: isDark ? `${colors.border}55` : `${colors.border}40` }];
    const _trackPanelStyle: ViewStyle[] = [styles.trackPanel, { backgroundColor: 'transparent', borderTopColor: `${colors.border}30` }];

    if (isCardioStyle) {
      return (
        <View style={_trackPanelStyle}>
          <View style={_logSetsCardStyle}>
            <Text style={[styles.trackPanelLabel, { color: colors.textSecondary }]}>LOG SESSION</Text>
            <View style={styles.trackResultRow}>
              <View style={styles.trackResultField}>
                <Text style={[styles.trackFieldLabel, { color: colors.textMuted }]}>DURATION (MM:SS)</Text>
                <TextInput
                  style={[styles.trackInputWrapLarge, styles.trackInputTextLg, { backgroundColor: isDark ? '#1e1e1e' : '#f0f0f0', color: colors.text }]}
                  value={log?.duration ?? ''}
                  placeholder="30:00"
                  placeholderTextColor={colors.textMuted}
                  onChangeText={(v) => tracking.updateExerciseResult(ex.id, 'duration', v)}
                  keyboardType="numbers-and-punctuation"
                  returnKeyType="done"
                />
              </View>
              <View style={styles.trackResultField}>
                <Text style={[styles.trackFieldLabel, { color: colors.textMuted }]}>DISTANCE (KM)</Text>
                <TextInput
                  style={[styles.trackInputWrapLarge, styles.trackInputTextLg, { backgroundColor: isDark ? '#1e1e1e' : '#f0f0f0', color: colors.text }]}
                  value={log?.distance ?? ''}
                  placeholder="5.0"
                  placeholderTextColor={colors.textMuted}
                  onChangeText={(v) => tracking.updateExerciseResult(ex.id, 'distance', v)}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                />
              </View>
            </View>
            <TouchableOpacity
              style={[styles.trackSaveBtn, { backgroundColor: '#8b5cf6' }]}
              onPress={() => handleMarkExerciseDone(ex.id, ex)}
              activeOpacity={0.8}
            >
              <Check size={12} color={getContrastTextColor('#8b5cf6')} />
              <Text style={[styles.trackDoneBtnText, { color: getContrastTextColor('#8b5cf6') }]}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (isHyrox) {
      return (
        <View style={_trackPanelStyle}>
          <View style={_logSetsCardStyle}>
            <Text style={[styles.trackPanelLabel, { color: colors.textSecondary }]}>LOG TIME</Text>
            <View style={styles.trackResultField}>
              <Text style={[styles.trackFieldLabel, { color: colors.textMuted }]}>TIME (MM:SS)</Text>
              <TextInput
                style={[styles.trackInputWrapLarge, styles.trackInputTextLg, { backgroundColor: isDark ? '#1e1e1e' : '#f0f0f0', color: colors.text }]}
                value={log?.timeCap ?? ''}
                placeholder="2:45"
                placeholderTextColor={colors.textMuted}
                onChangeText={(v) => tracking.updateExerciseResult(ex.id, 'timeCap', v)}
                keyboardType="numbers-and-punctuation"
                returnKeyType="done"
              />
            </View>
            <TouchableOpacity
              style={[styles.trackSaveBtn, { backgroundColor: '#eab308' }]}
              onPress={() => handleMarkExerciseDone(ex.id, ex)}
              activeOpacity={0.8}
            >
              <Check size={12} color={getContrastTextColor('#eab308')} />
              <Text style={[styles.trackDoneBtnText, { color: getContrastTextColor('#eab308') }]}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    const setsArr = Array.from({ length: ex.sets }, (_, i) => i);
    const done = completedSets[ex.id] ?? new Set<number>();
    return (
      <View style={_trackPanelStyle}>
      <View style={_logSetsCardStyle}>
        {setsArr.map((setIdx) => {
          const isDone = done.has(setIdx);
          return (
            <TouchableOpacity
              key={setIdx}
              style={styles.trackSetRow}
              onPress={() => handleToggleSet(ex.id, setIdx, ex)}
              activeOpacity={0.7}
            >
              {isDone ? (
                <CheckCircle2 size={16} color={currentAccent} />
              ) : (
                <Circle size={16} color={colors.text} />
              )}
              <Text style={[styles.trackSetLabel, { color: colors.text }]}>
                Set {setIdx + 1}
              </Text>
              <Text style={[styles.trackSetValue, { color: colors.text }]}>
                {ex.suggestedWeight} × {ex.reps}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={[styles.trackDoneBtn, { backgroundColor: currentAccent }]}
          onPress={() => handleMarkExerciseDone(ex.id, ex)}
          activeOpacity={0.8}
        >
          <Check size={12} color="#fff" />
          <Text style={styles.trackDoneBtnText}>Complete</Text>
        </TouchableOpacity>
      </View>
      </View>
    );
  }, [expandedTrack, completedSets, currentAccent, colors, isDark, currentStyle, cfData, tracking, handleToggleSet, handleMarkExerciseDone, wheelRepsW, wheelWeightW, logWheelItemH, logWheelSingleColW, accent, handleExerciseTap, activeEditCell, setActiveEditCell, openChip, closeChip, chipExpandStyle, logEditMode, swipeOpenSetKey, scrollGesture]);

  const renderGroupSeparator = useCallback((ex: WorkoutExercise, prevEx: WorkoutExercise | null) => {
    const isGroupStart = ex.groupType && (!prevEx || prevEx.groupId !== ex.groupId);
    const isGroupLink = ex.groupType && prevEx && prevEx.groupId === ex.groupId;

    if (isGroupStart) {
      let icon: React.ReactNode;
      let label: string;
      if (ex.groupType === 'superset') {
        icon = <Link2 size={13} color={colors.textSecondary} />;
        label = 'Superset';
      } else if (ex.groupType === 'circuit') {
        icon = <RotateCcw size={13} color={colors.textSecondary} />;
        label = 'Circuit';
      } else {
        icon = <Circle size={13} color={colors.textSecondary} />;
        label = 'Rounds';
      }
      return (
        <View style={styles.groupHeader}>
          {renderGroupGripDots(ex)}
          {icon}
          <TouchableOpacity onPress={() => setInfoLabel(label)} activeOpacity={0.7}>
            <Text style={[styles.groupLabel, { color: colors.textSecondary }]}>{label}</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <Text style={[styles.groupRest, { color: colors.textSecondary }]}>{ex.rest}</Text>
        </View>
      );
    }

    if (isGroupLink) {
      const isSuperset = ex.groupType === 'superset';
      return (
        <View
          style={[
            styles.groupLinkRow,
            isSuperset && { borderLeftWidth: 2, borderLeftColor: `${currentAccent}66` },
          ]}
        >
          <Link2
            size={14}
            color={`${currentAccent}66`}
            style={{ transform: [{ rotate: '90deg' }] }}
          />
        </View>
      );
    }

    return null;
  }, [currentAccent, renderGroupGripDots]);

  const renderStrengthRow = useCallback((ex: WorkoutExercise, idx: number, isExpanded: boolean, hideRest?: boolean) => {
    const isCompleted = tracking.exerciseLogs[ex.id]?.completed === true;
    const reps = ex.reps && ex.reps !== 'NaN' ? ex.reps : '—';
    const weight = ex.suggestedWeight && !ex.suggestedWeight.includes('NaN') && ex.suggestedWeight !== 'BW' && ex.suggestedWeight !== '0 lb' ? ex.suggestedWeight : null;
    return (
      <>
        <Text style={[styles.exerciseNum, { color: colors.textMuted }]}>{idx + 1}</Text>
        <View style={styles.exerciseInfo}>
          <Text style={[styles.exerciseName, { color: isCompleted ? colors.textMuted : colors.text, fontFamily: isExpanded ? 'Outfit_600SemiBold' : 'Outfit_500Medium' }]}>{ex.name}</Text>
          {!isCompleted && (
            <Text style={[styles.exerciseMeta, { color: colors.textSecondary }]}>
              {ex.sets}×{reps}{!hideRest && ex.rest && ex.rest.toLowerCase() !== 'none' ? ` · Rest ${ex.rest}` : ''}{weight ? ` · ${weight}` : ''}
            </Text>
          )}
        </View>
      </>
    );
  }, [colors, tracking.exerciseLogs]);

  const renderBodybuildingRow = useCallback((ex: WorkoutExercise, idx: number, isExpanded: boolean, hideRest?: boolean) => {
    const isCompleted = tracking.exerciseLogs[ex.id]?.completed === true;
    const repsNum = parseInt(ex.reps, 10);
    const repRange = !isNaN(repsNum) ? `${repsNum}–${repsNum + 2}` : (ex.reps && ex.reps !== 'NaN' ? ex.reps : '—');
    const weight = ex.suggestedWeight && !ex.suggestedWeight.includes('NaN') && ex.suggestedWeight !== 'BW' && ex.suggestedWeight !== '0 lb' ? ex.suggestedWeight : null;
    return (
      <>
        <Text style={[styles.exerciseNum, { color: colors.textMuted }]}>{idx + 1}</Text>
        <View style={styles.exerciseInfo}>
          <Text style={[styles.exerciseName, { color: isCompleted ? colors.textMuted : colors.text, fontFamily: isExpanded ? 'Outfit_600SemiBold' : 'Outfit_500Medium' }]}>{ex.name}</Text>
          {!isCompleted && (
            <Text style={[styles.exerciseMeta, { color: colors.textSecondary }]}>
              {ex.sets}×{repRange}{!hideRest && ex.rest && ex.rest.toLowerCase() !== 'none' ? ` · Rest ${ex.rest}` : ''}{weight ? ` · ${weight}` : ''}
            </Text>
          )}
        </View>
      </>
    );
  }, [colors, tracking.exerciseLogs]);

  const renderDefaultRow = useCallback((ex: WorkoutExercise, idx: number, isExpanded: boolean, hideRest?: boolean) => {
    const isCompleted = tracking.exerciseLogs[ex.id]?.completed === true;
    const reps = ex.reps && ex.reps !== 'NaN' ? ex.reps : '—';
    const weight = ex.suggestedWeight && !ex.suggestedWeight.includes('NaN') && ex.suggestedWeight !== 'BW' && ex.suggestedWeight !== '0 lb' ? ex.suggestedWeight : null;
    return (
      <>
        <Text style={[styles.exerciseNum, { color: colors.textMuted }]}>{idx + 1}</Text>
        <View style={styles.exerciseInfo}>
          <Text style={[styles.exerciseName, { color: isCompleted ? colors.textMuted : colors.text, fontFamily: isExpanded ? 'Outfit_600SemiBold' : 'Outfit_500Medium' }]}>{ex.name}</Text>
          {!isCompleted && (
            <Text style={[styles.exerciseMeta, { color: colors.textSecondary }]}>
              {ex.sets}×{reps}{!hideRest && ex.rest && ex.rest.toLowerCase() !== 'none' ? ` · Rest ${ex.rest}` : ''}{weight ? ` · ${weight}` : ''}
            </Text>
          )}
        </View>
      </>
    );
  }, [colors, tracking.exerciseLogs]);

  const renderExerciseRow = useCallback((ex: WorkoutExercise, idx: number, allExercises: WorkoutExercise[]) => {
    const prevEx = idx > 0 ? allExercises[idx - 1] : null;
    const nextEx = idx < allExercises.length - 1 ? allExercises[idx + 1] : null;
    const groupSep = renderGroupSeparator(ex, prevEx);

    const isInSuperset = ex.groupType === 'superset';
    const isFollowedBySameGroup = nextEx && nextEx.groupId === ex.groupId && !!ex.groupId;

    const isExpanded = expandedTrack === ex.id;
    let infoContent: React.ReactNode;
    switch (currentStyle) {
      case 'Strength':
        infoContent = renderStrengthRow(ex, idx, isExpanded, !!isFollowedBySameGroup);
        break;
      case 'Bodybuilding':
        infoContent = renderBodybuildingRow(ex, idx, isExpanded, !!isFollowedBySameGroup);
        break;
      default:
        infoContent = renderDefaultRow(ex, idx, isExpanded, !!isFollowedBySameGroup);
        break;
    }

    const isDropTarget = dragInsertIdx === idx && activeDragId !== null;
    const isDropTargetAfterLast = dragInsertIdx === allExercises.length && idx === allExercises.length - 1 && activeDragId !== null;
    const isRowBeingDragged = activeDragId !== null && dragMovingIds.current.includes(ex.id);
    const isFirstExercise = idx === 0;
    return (
      <View
        key={ex.id}
        ref={isFirstExercise ? firstExRowRef : undefined}
        collapsable={false}
        onLayout={(e) => {
          rowLayoutsRef.current.set(ex.id, {
            y: e.nativeEvent.layout.y,
            height: e.nativeEvent.layout.height,
          });
        }}
      >
        {isDropTarget && <View style={[styles.dropIndicator, { backgroundColor: currentAccent }]} />}
        {groupSep}
        <SwipeableExerciseRow
          id={ex.id}
          isOpen={swipeOpenId === ex.id}
          onOpen={setSwipeOpenId}
          onInfo={() => handleExerciseTap(ex)}
          onSwap={() => handleSwapExercise(ex)}
          onDelete={() => handleDeleteExercise(ex.id)}
          rowBg={'transparent'}
          waitForGesture={scrollGesture}
          enabled={activeDragId === null}
        >
          <Pressable
            style={({ pressed }) => [
              styles.exerciseRow,
              isInSuperset && { borderLeftWidth: 2, borderLeftColor: `${currentAccent}66` },
              isRowBeingDragged && { opacity: 0.3 },
              pressed && { backgroundColor: `${colors.border}22` },
            ]}
            onPress={() => handleToggleTrackPanel(ex.id, ex)}
            onLongPress={() => handleExerciseLongPress(ex)}
            delayLongPress={350}
          >
            {infoContent}
            {renderTrackButton(ex)}
            {renderGripDots(ex)}
          </Pressable>
        </SwipeableExerciseRow>
        {!isFollowedBySameGroup && <View style={[styles.exerciseRowSeparator, { backgroundColor: `${colors.border}40` }]} />}
        <View ref={isFirstExercise && isExpanded ? trackPanelRef : undefined} collapsable={false}>
          <ExpandingPanel visible={isExpanded}>
            {renderTrackingPanel(ex)}
          </ExpandingPanel>
        </View>
        {isDropTargetAfterLast && <View style={[styles.dropIndicator, { backgroundColor: currentAccent }]} />}
      </View>
    );
  }, [currentStyle, colors, currentAccent, renderGroupSeparator, renderStrengthRow, renderBodybuildingRow, renderDefaultRow, renderTrackButton, renderTrackingPanel, renderGripDots, handleToggleTrackPanel, dragInsertIdx, activeDragId, swipeOpenId, handleDeleteExercise, handleSwapExercise, handleExerciseTap, handleExerciseLongPress, expandedTrack]);

  const renderCrossFitContent = useCallback(() => {
    if (!cfData || !workout) return null;
    return (
      <>
        {cfData.strength.length > 0 && (
          <>
            <TouchableOpacity
              style={styles.cfSectionHeader}
              onPress={() => setInfoLabel('STRENGTH')}
              activeOpacity={0.7}
            >
              <Dumbbell size={15} color={colors.textSecondary} />
              <Text style={[styles.cfSectionLabel, { color: colors.textSecondary }]}>Strength</Text>
            </TouchableOpacity>
            {cfData.strength.map((ex, exIdx) => {
              const isCFExpanded = expandedTrack === ex.id;
              return (
                <View key={ex.id} onLayout={(e) => { rowLayoutsRef.current.set(ex.id, { y: e.nativeEvent.layout.y, height: e.nativeEvent.layout.height }); }}>
                  <SwipeableExerciseRow
                    id={ex.id}
                    isOpen={swipeOpenId === ex.id}
                    onOpen={setSwipeOpenId}
                    onInfo={() => handleExerciseTap(ex)}
                    onSwap={() => handleSwapExercise(ex)}
                    onDelete={() => handleDeleteExercise(ex.id)}
                    rowBg={'transparent'}
                    waitForGesture={scrollGesture}
                    enabled={activeDragId === null}
                  >
                    <TouchableOpacity
                      style={styles.exerciseRow}
                      onPress={() => handleToggleTrackPanel(ex.id, ex)}
                      onLongPress={() => handleExerciseLongPress(ex)}
                      delayLongPress={350}
                      activeOpacity={1}
                    >
                      <Text style={[styles.exerciseNum, { color: colors.textMuted }]}>{exIdx + 1}</Text>
                      <View style={styles.exerciseInfo}>
                        <Text style={[styles.exerciseName, { color: colors.text, fontFamily: isCFExpanded ? 'Outfit_600SemiBold' : 'Outfit_500Medium' }]}>{ex.name}</Text>
                        <Text style={[styles.exerciseMeta, { color: colors.textSecondary }]}>
                          {ex.sets}×{ex.reps && ex.reps !== 'NaN' ? ex.reps : '—'}{ex.rest && ex.rest.toLowerCase() !== 'none' ? ` · Rest ${ex.rest}` : ''}{ex.suggestedWeight && !ex.suggestedWeight.includes('NaN') && ex.suggestedWeight !== 'BW' && ex.suggestedWeight !== '0 lb' ? ` · ${ex.suggestedWeight}` : ''}
                        </Text>
                      </View>
                      {renderTrackButton(ex)}
                      {renderGripDots(ex)}
                    </TouchableOpacity>
                  </SwipeableExerciseRow>
                  <View style={[styles.exerciseRowSeparator, { backgroundColor: `${colors.border}40` }]} />
                  <ExpandingPanel visible={isCFExpanded}>
                    {renderTrackingPanel(ex)}
                  </ExpandingPanel>
                </View>
              );
            })}
          </>
        )}
        {cfData.metcon.length > 0 && (
          <>
            <TouchableOpacity
              style={[styles.cfSectionHeader, { marginTop: 4, flexDirection: 'column', alignItems: 'flex-start', gap: 5 }]}
              onPress={() => setInfoLabel(`WOD — ${workout.metconFormat?.toUpperCase() ?? 'AMRAP'}`)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Zap size={15} color={colors.textSecondary} />
                <Text style={[styles.cfSectionLabel, { color: colors.textSecondary }]}>WOD</Text>
              </View>
              {(() => {
                const fmt = workout.metconFormat ?? 'AMRAP';
                const cap = workout.metconTimeCap;
                const rds = workout.metconRounds;
                const chips: string[] = [fmt];
                if (cap) chips.push(`${cap} min`);
                if (fmt === 'For Time' && rds && rds > 1) chips.push(`${rds} rds`);
                if (fmt === 'EMOM' && rds) chips.push(`${rds} min`);
                if (fmt === 'Chipper' && cfData.metcon.length > 0) chips.push(`${cfData.metcon.length} ex`);
                if (fmt === 'Ladder' && rds) chips.push(`+${rds}/rd`);
                return (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, paddingLeft: 21 }}>
                    {chips.map((chip) => (
                      <View key={chip} style={[styles.wodChip, { backgroundColor: `${colors.textSecondary}18` }]}>
                        <Text style={[styles.wodChipText, { color: colors.textSecondary }]}>{chip}</Text>
                      </View>
                    ))}
                  </View>
                );
              })()}
            </TouchableOpacity>
            {cfData.metcon.map((ex, exIdx) => {
              const isCFMetconExpanded = expandedTrack === ex.id;
              const fmt = workout.metconFormat ?? 'AMRAP';
              const rds = workout.metconRounds;
              const repsStr = ex.reps ?? '';
              const isTimeBased = /sec|s$|min/i.test(repsStr);
              const isDistanceOrCals = /\bm$|\bcal\b/i.test(repsStr);
              // Per-format exercise subtitle so the rep scheme is unambiguous
              let repsMeta: string;
              if (isTimeBased || isDistanceOrCals) {
                repsMeta = `${repsStr} · ${ex.muscleGroup}`;
              } else if (fmt === 'For Time' && rds && rds > 1) {
                repsMeta = `${repsStr} reps × ${rds} rds · ${ex.muscleGroup}`;
              } else if (fmt === 'EMOM') {
                repsMeta = `${repsStr} reps/min · ${ex.muscleGroup}`;
              } else if (fmt === 'Chipper') {
                repsMeta = `${repsStr} reps total · ${ex.muscleGroup}`;
              } else if (fmt === 'Ladder') {
                repsMeta = rds
                  ? `start ${repsStr} · +${rds}/rd · ${ex.muscleGroup}`
                  : `start ${repsStr} · ${ex.muscleGroup}`;
              } else {
                repsMeta = `${repsStr} reps · ${ex.muscleGroup}`;
              }
              return (
                <View key={ex.id} onLayout={(e) => { rowLayoutsRef.current.set(ex.id, { y: e.nativeEvent.layout.y, height: e.nativeEvent.layout.height }); }}>
                  <SwipeableExerciseRow
                    id={ex.id}
                    isOpen={swipeOpenId === ex.id}
                    onOpen={setSwipeOpenId}
                    onInfo={() => handleExerciseTap(ex)}
                    onSwap={() => handleSwapExercise(ex)}
                    onDelete={() => handleDeleteExercise(ex.id)}
                    rowBg={'transparent'}
                    waitForGesture={scrollGesture}
                    enabled={activeDragId === null}
                  >
                    <TouchableOpacity
                      style={styles.exerciseRow}
                      onPress={() => handleToggleTrackPanel(ex.id, ex)}
                      onLongPress={() => handleExerciseLongPress(ex)}
                      delayLongPress={350}
                      activeOpacity={1}
                    >
                      <Text style={[styles.exerciseNum, { color: colors.textMuted }]}>{exIdx + 1}</Text>
                      <View style={styles.exerciseInfo}>
                        <Text style={[styles.exerciseName, { color: colors.text, fontFamily: isCFMetconExpanded ? 'Outfit_600SemiBold' : 'Outfit_500Medium' }]}>{ex.name}</Text>
                        <Text style={[styles.exerciseMeta, { color: colors.textSecondary }]}>{repsMeta}</Text>
                      </View>
                      {renderTrackButton(ex)}
                      {renderGripDots(ex)}
                    </TouchableOpacity>
                  </SwipeableExerciseRow>
                  <View style={[styles.exerciseRowSeparator, { backgroundColor: `${colors.border}40` }]} />
                  <ExpandingPanel visible={isCFMetconExpanded}>
                    {renderTrackingPanel(ex)}
                  </ExpandingPanel>
                </View>
              );
            })}
          </>
        )}
      </>
    );
  }, [cfData, workout, currentAccent, colors, handleExerciseTap, handleExerciseLongPress, handleToggleTrackPanel, renderTrackButton, renderTrackingPanel, renderGripDots, swipeOpenId, activeDragId, handleDeleteExercise, handleSwapExercise, expandedTrack]);

  const renderHyroxContent = useCallback(() => {
    if (!workout) return null;
    const exercises = workout.workout;
    const isSimulation = workout.metconFormat?.toLowerCase().includes('simulation') ?? false;
    let stationIdx = 0;
    return (
      <>
        {exercises.map((ex) => {
          const isRun = ex.type === 'hyroxRun';
          if (isRun) {
            // Extract "Leg N" from name "Run — Leg N"
            const legMatch = ex.name.match(/Leg\s+(\d+)/i);
            const legLabel = legMatch ? `Leg ${legMatch[1]}` : '';
            return (
              <TouchableOpacity
                key={ex.id}
                style={[styles.hyroxRunDivider, { borderBottomColor: `${colors.border}40` }]}
                onPress={() => setInfoLabel(`RUN — ${ex.reps}`)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[`${colors.border}30`, 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
                <Footprints size={16} color={colors.textSecondary} />
                <Text style={[styles.hyroxRunText, { color: colors.textSecondary }]}>
                  RUN — {ex.reps}
                </Text>
                {legLabel !== '' && (
                  <Text style={[styles.hyroxRunLeg, { color: colors.textMuted }]}>{legLabel}</Text>
                )}
                <View style={{ flex: 1 }} />
                <Text style={[styles.hyroxRunTarget, { color: colors.textSecondary }]}>
                  Moderate pace
                </Text>
              </TouchableOpacity>
            );
          }
          const currentStationIdx = stationIdx++;
          const isHyroxExpanded = expandedTrack === ex.id;
          // For simulation, reps field contains the work volume (e.g. "1000m", "100 reps").
          // For training splits, reps is a numeric count.
          const metaLine = isSimulation
            ? ex.reps
            : `${ex.reps} reps · ${ex.muscleGroup}`;
          return (
            <View key={ex.id} onLayout={(e) => { rowLayoutsRef.current.set(ex.id, { y: e.nativeEvent.layout.y, height: e.nativeEvent.layout.height }); }}>
              <SwipeableExerciseRow
                id={ex.id}
                isOpen={swipeOpenId === ex.id}
                onOpen={setSwipeOpenId}
                onInfo={() => handleExerciseTap(ex)}
                onSwap={() => handleSwapExercise(ex)}
                onDelete={() => handleDeleteExercise(ex.id)}
                rowBg={'transparent'}
                waitForGesture={scrollGesture}
                enabled={activeDragId === null}
              >
                <TouchableOpacity
                  style={[styles.exerciseRow, { borderBottomColor: `${colors.border}40` }]}
                  onPress={() => handleToggleTrackPanel(ex.id, ex)}
                  onLongPress={() => handleExerciseLongPress(ex)}
                  delayLongPress={350}
                  activeOpacity={1}
                >
                  <Text style={[styles.exerciseNum, { color: colors.textMuted }]}>{currentStationIdx + 1}</Text>
                  <View style={styles.exerciseInfo}>
                    <Text style={[styles.exerciseName, { color: colors.text, fontFamily: isHyroxExpanded ? 'Outfit_600SemiBold' : 'Outfit_500Medium' }]}>{ex.name}</Text>
                    <Text style={[styles.exerciseMeta, { color: colors.textSecondary }]}>{metaLine}</Text>
                  </View>
                  {renderTrackButton(ex)}
                  {renderGripDots(ex)}
                </TouchableOpacity>
              </SwipeableExerciseRow>
              <View style={[styles.exerciseRowSeparator, { backgroundColor: `${colors.border}40` }]} />
              <ExpandingPanel visible={isHyroxExpanded}>
                {renderTrackingPanel(ex)}
              </ExpandingPanel>
            </View>
          );
        })}
      </>
    );
  }, [workout, currentAccent, colors, handleToggleTrackPanel, renderTrackButton, renderTrackingPanel, renderGripDots, handleExerciseTap, swipeOpenId, activeDragId, handleDeleteExercise, handleSwapExercise, expandedTrack]);

  const renderHIITContent = useCallback(() => {
    if (!workout) return null;
    return (
      <>
        <TouchableOpacity
          style={styles.hiitCircuitHeader}
          onPress={() => setInfoLabel(`CIRCUIT — ${hiitRounds} ROUNDS`)}
          activeOpacity={0.7}
        >
          <RotateCcw size={15} color={colors.textSecondary} />
          <Text style={[styles.hiitCircuitLabel, { color: colors.textSecondary }]}>
            CIRCUIT — {hiitRounds} ROUNDS
          </Text>
          <View style={{ flex: 1 }} />
          <Text style={[styles.hiitTimeEst, { color: colors.textSecondary }]}>
            ~{hiitTotalTime} min
          </Text>
        </TouchableOpacity>
        {workout.workout.map((ex) => (
          <View key={ex.id} onLayout={(e) => { rowLayoutsRef.current.set(ex.id, { y: e.nativeEvent.layout.y, height: e.nativeEvent.layout.height }); }}>
            <SwipeableExerciseRow
              id={ex.id}
              isOpen={swipeOpenId === ex.id}
              onOpen={setSwipeOpenId}
              onInfo={() => handleExerciseTap(ex)}
              onSwap={() => handleSwapExercise(ex)}
              onDelete={() => handleDeleteExercise(ex.id)}
              rowBg={'transparent'}
              waitForGesture={scrollGesture}
              enabled={activeDragId === null}
            >
              <View style={[styles.compactMovementRow, { borderBottomColor: `${colors.border}40` }]}>
                <TouchableOpacity onPress={() => handleExerciseTap(ex)} activeOpacity={0.7} style={{ flex: 1 }}>
                  <Text style={[styles.compactMovementText, { color: colors.text }]}>
                    {ex.reps} {ex.name}
                  </Text>
                </TouchableOpacity>
                {renderGripDots(ex)}
              </View>
            </SwipeableExerciseRow>
          </View>
        ))}
      </>
    );
  }, [workout, currentAccent, colors, hiitRounds, hiitTotalTime, renderGripDots, handleExerciseTap, swipeOpenId, activeDragId, handleDeleteExercise, handleSwapExercise]);

  const renderCardioContent = useCallback(() => {
    if (!workout) return null;
    const exercises = workout.workout;
    const cardio = workout.cardio;
    return (
      <>
        {exercises.length > 0 && (
          <>
            <TouchableOpacity
              style={styles.cardioBlockHeader}
              onPress={() => setInfoLabel('MAIN BLOCK')}
              activeOpacity={0.7}
            >
              <Text style={[styles.cardioBlockLabel, { color: colors.textSecondary }]}>MAIN BLOCK</Text>
              {cardio.length > 0 && (
                <Text style={[styles.cardioFormatBadge, { color: colors.textSecondary }]}>
                  {cardio[0]?.format}
                </Text>
              )}
            </TouchableOpacity>
            {exercises.map((ex, exIdx) => {
              const isCardioExpanded = expandedTrack === ex.id;
              return (
                <View key={ex.id} onLayout={(e) => { rowLayoutsRef.current.set(ex.id, { y: e.nativeEvent.layout.y, height: e.nativeEvent.layout.height }); }}>
                  <SwipeableExerciseRow
                    id={ex.id}
                    isOpen={swipeOpenId === ex.id}
                    onOpen={setSwipeOpenId}
                    onInfo={() => handleExerciseTap(ex)}
                    onSwap={() => handleSwapExercise(ex)}
                    onDelete={() => handleDeleteExercise(ex.id)}
                    rowBg={'transparent'}
                    waitForGesture={scrollGesture}
                    enabled={activeDragId === null}
                  >
                    <TouchableOpacity
                      style={styles.exerciseRow}
                      onPress={() => handleToggleTrackPanel(ex.id, ex)}
                      onLongPress={() => handleExerciseLongPress(ex)}
                      delayLongPress={350}
                      activeOpacity={1}
                    >
                      <Text style={[styles.exerciseNum, { color: colors.textMuted }]}>{exIdx + 1}</Text>
                      <View style={styles.exerciseInfo}>
                        <Text style={[styles.exerciseName, { color: colors.text, fontFamily: isCardioExpanded ? 'Outfit_600SemiBold' : 'Outfit_500Medium' }]}>{ex.name}</Text>
                        <Text style={[styles.exerciseMeta, { color: colors.textSecondary }]}>
                          {ex.reps} · {ex.muscleGroup}
                        </Text>
                        <Text style={[styles.rpeText, { color: colors.textMuted }]}>RPE 6–7</Text>
                      </View>
                      {renderTrackButton(ex)}
                      {renderGripDots(ex)}
                    </TouchableOpacity>
                  </SwipeableExerciseRow>
                  <View style={[styles.exerciseRowSeparator, { backgroundColor: `${colors.border}40` }]} />
                  <ExpandingPanel visible={isCardioExpanded}>
                    {renderTrackingPanel(ex)}
                  </ExpandingPanel>
                </View>
              );
            })}
          </>
        )}
      </>
    );
  }, [workout, currentAccent, colors, handleToggleTrackPanel, renderTrackButton, renderTrackingPanel, renderGripDots, handleExerciseTap, swipeOpenId, activeDragId, handleDeleteExercise, handleSwapExercise, expandedTrack]);

  const renderMobilityContent = useCallback(() => {
    if (!workout) return null;
    const exercises = workout.workout;
    const total = exercises.length;
    return (
      <>
        {exercises.map((ex, idx) => {
          const phase = getMobilityPhase(idx, total);
          const isDone = doneExercises.has(ex.id);
          const holdDuration = ex.movementType === 'isolation' ? '45 sec each side' : '30 sec hold';
          return (
            <View key={ex.id}>
              {phase && (
                <TouchableOpacity
                  style={styles.phaseHeader}
                  onPress={() => setInfoLabel(phase)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.phaseLabel, { color: colors.textSecondary }]}>{phase}</Text>
                </TouchableOpacity>
              )}
              <SwipeableExerciseRow
                id={ex.id}
                isOpen={swipeOpenId === ex.id}
                onOpen={setSwipeOpenId}
                onInfo={() => handleExerciseTap(ex)}
                onSwap={() => handleSwapExercise(ex)}
                onDelete={() => handleDeleteExercise(ex.id)}
                rowBg={'transparent'}
                waitForGesture={scrollGesture}
                enabled={activeDragId === null}
              >
                <View style={styles.exerciseRow}>
                  <Text style={[styles.exerciseNum, { color: colors.textMuted }]}>{idx + 1}</Text>
                  <View style={styles.exerciseInfo}>
                    <Text style={[styles.exerciseName, { color: isDone ? colors.textMuted : colors.text, fontFamily: 'Outfit_500Medium' }]}>
                      {ex.name}
                    </Text>
                    <Text style={[styles.exerciseMeta, { color: colors.textSecondary }]}>
                      {holdDuration}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.doneCheckbox, { borderColor: isDone ? currentAccent : colors.border }]}
                    onPress={() => handleToggleMobilityDone(ex.id)}
                    activeOpacity={0.7}
                  >
                    {isDone ? (
                      <Check size={15} color={currentAccent} />
                    ) : null}
                  </TouchableOpacity>
                </View>
              </SwipeableExerciseRow>
              <View style={[styles.exerciseRowSeparator, { backgroundColor: `${colors.border}40` }]} />
            </View>
          );
        })}
      </>
    );
  }, [workout, currentAccent, colors, doneExercises, handleExerciseTap, handleToggleMobilityDone, swipeOpenId, activeDragId, handleDeleteExercise, handleSwapExercise]);

  const renderPilatesContent = useCallback(() => {
    if (!workout) return null;
    const exercises = workout.workout;
    const total = exercises.length;
    return (
      <>
        {exercises.map((ex, idx) => {
          const phase = getPilatesPhase(idx, total);
          const breathCue = getBreathCue(ex.name);
          const repsNum = parseInt(ex.reps, 10);
          const repsDisplay = !isNaN(repsNum) ? `${repsNum} reps` : ex.reps;
          return (
            <View key={ex.id}>
              {phase && (
                <TouchableOpacity
                  style={styles.phaseHeader}
                  onPress={() => setInfoLabel(phase)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.phaseLabel, { color: colors.textSecondary }]}>{phase}</Text>
                </TouchableOpacity>
              )}
              <SwipeableExerciseRow
                id={ex.id}
                isOpen={swipeOpenId === ex.id}
                onOpen={setSwipeOpenId}
                onInfo={() => handleExerciseTap(ex)}
                onSwap={() => handleSwapExercise(ex)}
                onDelete={() => handleDeleteExercise(ex.id)}
                rowBg={'transparent'}
                waitForGesture={scrollGesture}
                enabled={activeDragId === null}
              >
                <TouchableOpacity
                  style={[styles.exerciseRow, { borderBottomColor: `${colors.border}40` }]}
                  onPress={() => handleToggleTrackPanel(ex.id, ex)}
                  onLongPress={() => handleExerciseLongPress(ex)}
                  delayLongPress={350}
                  activeOpacity={1}
                >
                  <Text style={[styles.exerciseNum, { color: colors.textMuted }]}>{idx + 1}</Text>
                  <View style={styles.exerciseInfo}>
                    <Text style={[styles.exerciseName, { color: colors.text, fontFamily: expandedTrack === ex.id ? 'Outfit_600SemiBold' : 'Outfit_500Medium' }]}>{ex.name}</Text>
                    <Text style={[styles.exerciseMeta, { color: colors.textSecondary }]}>
                      {repsDisplay}
                    </Text>
                    <Text style={[styles.breathCue, { color: colors.textMuted }]}>
                      {breathCue}
                    </Text>
                  </View>
                  {renderTrackButton(ex)}
                  {renderGripDots(ex)}
                </TouchableOpacity>
              </SwipeableExerciseRow>
              <View style={[styles.exerciseRowSeparator, { backgroundColor: `${colors.border}40` }]} />
              <ExpandingPanel visible={expandedTrack === ex.id}>
                {renderTrackingPanel(ex)}
              </ExpandingPanel>
            </View>
          );
        })}
      </>
    );
  }, [workout, currentAccent, colors, handleToggleTrackPanel, renderTrackButton, renderTrackingPanel, renderGripDots, handleExerciseTap, swipeOpenId, activeDragId, handleDeleteExercise, handleSwapExercise, expandedTrack]);

  const render75HardContent = useCallback(() => {
    if (!workout || !sessions75Hard) return null;
    const monoColor = isDark ? '#ffffff' : '#111111';
    return (
      <>
        <View style={[hardStyles.mentalHeader, { borderBottomColor: `${colors.border}40` }]}>
          <Text style={[hardStyles.mentalText, { color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }]}>
            MENTAL TOUGHNESS REQUIRED
          </Text>
        </View>
        {sessions75Hard.map((session: SeventyFiveHardSession, sIdx: number) => (
          <View key={sIdx}>
            <View style={hardStyles.sessionHeader as any}>
              <Text style={[hardStyles.sessionLabel, { color: monoColor }]}>
                {session.label}
              </Text>
              <Text style={[hardStyles.sessionMeta, { color: colors.textSecondary }]}>
                {session.modality.toUpperCase()} · {session.estimatedDuration}min
              </Text>
            </View>
            {session.exercises.map((ex: WorkoutExercise, exIdx: number) => {
              const isCompleted = tracking.exerciseLogs[ex.id]?.completed === true;
              const is75HardExpanded = expandedTrack === ex.id;
              return (
                <View key={ex.id} onLayout={(e) => { rowLayoutsRef.current.set(ex.id, { y: e.nativeEvent.layout.y, height: e.nativeEvent.layout.height }); }}>
                  <SwipeableExerciseRow
                    id={ex.id}
                    isOpen={swipeOpenId === ex.id}
                    onOpen={setSwipeOpenId}
                    onInfo={() => handleExerciseTap(ex)}
                    onSwap={() => handleSwapExercise(ex)}
                    onDelete={() => handleDeleteExercise(ex.id)}
                    rowBg={'transparent'}
                    waitForGesture={scrollGesture}
                    enabled={activeDragId === null}
                  >
                    <TouchableOpacity
                      style={styles.exerciseRow}
                      onPress={() => handleToggleTrackPanel(ex.id, ex)}
                      onLongPress={() => handleExerciseLongPress(ex)}
                      delayLongPress={350}
                      activeOpacity={1}
                    >
                      <Text style={[styles.exerciseNum, { color: colors.textMuted }]}>{exIdx + 1}</Text>
                      <View style={styles.exerciseInfo}>
                        <Text style={[styles.exerciseName, { color: isCompleted ? colors.textMuted : colors.text, fontFamily: is75HardExpanded ? 'Outfit_600SemiBold' : 'Outfit_500Medium' }]}>
                          {ex.name}
                        </Text>
                        {!isCompleted && (
                          <Text style={[styles.exerciseMeta, { color: colors.textSecondary }]}>
                            {ex.sets}×{ex.reps && ex.reps !== 'NaN' ? ex.reps : '—'}{ex.rest && ex.rest.toLowerCase() !== 'none' ? ` · Rest ${ex.rest}` : ''}{ex.suggestedWeight && !ex.suggestedWeight.includes('NaN') && ex.suggestedWeight !== 'BW' && ex.suggestedWeight !== '0 lb' ? ` · ${ex.suggestedWeight}` : ''}
                          </Text>
                        )}
                      </View>
                      {renderTrackButton(ex)}
                      {renderGripDots(ex)}
                    </TouchableOpacity>
                  </SwipeableExerciseRow>
                  <View style={[styles.exerciseRowSeparator, { backgroundColor: `${colors.border}40` }]} />
                  <ExpandingPanel visible={is75HardExpanded}>
                    {renderTrackingPanel(ex)}
                  </ExpandingPanel>
                </View>
              );
            })}
          </View>
        ))}
      </>
    );
  }, [workout, sessions75Hard, isDark, colors, tracking.exerciseLogs, handleToggleTrackPanel, renderTrackButton, renderGripDots, renderTrackingPanel, handleExerciseTap, swipeOpenId, activeDragId, handleDeleteExercise, handleSwapExercise, expandedTrack]);

  const renderWorkoutExercises = useCallback(() => {
    if (!workout) return null;
    switch (currentStyle) {
      case 'CrossFit': return renderCrossFitContent();
      case 'Hyrox': return renderHyroxContent();
      case 'HIIT': return renderHIITContent();
      case 'Cardio': return renderCardioContent();
      case 'Mobility': return renderMobilityContent();
      case 'Pilates': return renderPilatesContent();
      default:
        return workout.workout.map((ex, idx) => renderExerciseRow(ex, idx, workout.workout));
    }
  }, [workout, currentStyle, renderCrossFitContent, renderHyroxContent, renderHIITContent, renderCardioContent, renderMobilityContent, renderPilatesContent, renderExerciseRow]);

  const displayDuration = snapToPreset(ctx.workoutOverride?.duration ?? ctx.lastModifyState?.duration ?? ctx.targetDuration);
  const displaySplit = workout?.split ?? ctx.workoutOverride?.split ?? ctx.trainingSplit;

  const targetedMuscles = useMemo(() => {
    if (!workout) return [];
    const groups = new Set<string>();
    for (const ex of workout.workout) {
      const parts = ex.muscleGroup.split(',').map(s => s.trim());
      for (const p of parts) {
        if (p) groups.add(p.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
      }
    }
    return Array.from(groups).slice(0, 5);
  }, [workout]);

  const totalSets = useMemo(() => {
    if (!workout) return 0;
    return workout.workout.reduce((sum, ex) => sum + (ex.sets ?? 0), 0);
  }, [workout]);

  const displayRest = useMemo(() => {
    const r = ctx.lastModifyState?.rest ?? ctx.restBetweenSets;
    if (r >= 60) return `${Math.round(r / 60)}m`;
    return `${r}s`;
  }, [ctx.lastModifyState?.rest, ctx.restBetweenSets]);

  const hasPostContent = useMemo(() => {
    return (ctx.coolDown && (workout?.cooldown?.length ?? 0) > 0) ||
           (ctx.recovery && (workout?.recovery?.length ?? 0) > 0);
  }, [ctx.coolDown, ctx.recovery, workout?.cooldown?.length, workout?.recovery?.length]);

  const handleCancelGenerate = useCallback(() => {
    if (!workout) return;
    if (generatingTimerRef.current) {
      clearTimeout(generatingTimerRef.current);
      generatingTimerRef.current = null;
    }
    setIsGenerating(false);
  }, [workout]);

  const dumbbellSpin = dumbbellRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AmbientGlow color={currentAccent} opacity={0.06} />
      {isZeal && <ZealBackground />}

      <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent', zIndex: 10 }}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={[styles.avatarBtn, { borderColor: ctx.userPhotoUri ? 'transparent' : colors.border }]}
            onPress={() => setProfileVisible(true)}
            testID="workout-profile-avatar"
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {ctx.userPhotoUri ? (
              <Image source={{ uri: ctx.userPhotoUri }} style={styles.avatarImage} />
            ) : (
              <User size={17} color={colors.textSecondary} strokeWidth={1.8} />
            )}
          </TouchableOpacity>
          <View style={styles.wordmarkRow}>
            <Text style={[styles.wordmark, { color: ZEAL_ORANGE }]}>zeal</Text>
          </View>
          <Text style={[styles.dateText, { color: colors.textSecondary }]}>{formatDate()}</Text>
        </View>
      </SafeAreaView>

      <GestureDetector gesture={scrollGesture}>
      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        testID="workout-scroll"
        scrollEventThrottle={16}
        scrollEnabled={scrollEnabled}
        onScroll={(e) => { scrollOffsetRef.current = e.nativeEvent.contentOffset.y; }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={tracking.isWorkoutActive ? undefined : handlePullRefresh}
            tintColor={currentAccent}
            colors={[currentAccent]}
          />
        }
      >
        <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
        {!hasPro && !coreStyleBannerDismissed && PRO_STYLES_SET.has(ctx.workoutStyle) && !tracking.isWorkoutActive && (
          <View style={[styles.coreStyleBanner, { backgroundColor: colors.card, borderColor: cardBorder }]}>
            <View style={styles.coreStyleBannerContent}>
              <Info size={14} color={colors.textSecondary} />
              <Text style={[styles.coreStyleBannerText, { color: colors.text }]}>
                You selected{' '}
                <Text style={{ fontWeight: '700' as const, color: colors.text }}>{ctx.workoutStyle}</Text>
                {' '}during setup. As a{' '}
                <Text style={{ fontWeight: '700' as const }}>Zeal Core</Text>
                {' '}member, you have access to{' '}
                <Text style={{ fontWeight: '700' as const }}>Strength</Text>
                {' '}and{' '}
                <Text style={{ fontWeight: '700' as const }}>Cardio</Text>.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setCoreStyleBannerDismissed(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <X size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {tracking.isWorkoutActive ? (
          <WorkoutTimerCard />
        ) : (
          <>
            <HealthImportBanner />

            <GlassCard
              style={[styles.workoutInfoCard, { borderWidth: 1 }]}
              variant={isDark ? 'glass' : 'solid'}
              testID="workout-info-card"
            >
              <View style={styles.workoutInfoTop}>
                <View style={styles.workoutInfoLabelRow}>
                  <View style={styles.workoutInfoLabelLeft}>
                    <Text style={[styles.workoutInfoLabel, { color: colors.textSecondary }]}>Today's Workout</Text>
                    <View style={[styles.workoutStyleChip, { backgroundColor: `${colors.textMuted}18`, borderWidth: 1, borderColor: `${colors.textMuted}30` }]}>
                      <Text style={[styles.workoutStyleChipText, { color: colors.textSecondary }]}>{currentStyle}</Text>
                    </View>
                  </View>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity
                    style={[styles.shuffleBtn, { borderColor: currentAccent, backgroundColor: `${currentAccent}12` }]}
                    onPress={handleRegenerate}
                    activeOpacity={0.7}
                    testID="shuffle-workout"
                  >
                    <RefreshCw size={11} color={currentAccent} strokeWidth={2.5} />
                    <Text style={[styles.shuffleBtnText, { color: currentAccent }]}>Shuffle</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.workoutInfoTitleRow}>
                  <Text style={styles.workoutInfoTitle} numberOfLines={1}>
                    {displaySplit || 'Auto'}
                  </Text>
                </View>

                <Text style={[styles.workoutInfoSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                  {`${displayDuration} min`}
                  {targetedMuscles.length > 0 && <Text style={{ color: colors.text, opacity: 0.45 }}>{' · '}</Text>}
                  {targetedMuscles.length > 0 && targetedMuscles.slice(0, 2).join(', ')}
                  {totalExercises > 0 && <Text style={{ color: colors.text, opacity: 0.45 }}>{' · '}</Text>}
                  {totalExercises > 0 && `${totalExercises} exercises`}
                </Text>
              </View>

              <View style={styles.workoutInfoActions}>
                <View ref={modifyBtnRef} collapsable={false} style={{ flex: 1 }}>
                  <TouchableOpacity
                    style={[styles.workoutModifyBtn, { borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)' }]}
                    onPress={() => setModifyVisible(true)}
                    activeOpacity={0.7}
                    testID="modify-workout-card"
                  >
                    <SlidersHorizontal size={14} color={colors.textMuted} />
                    <Text style={[styles.workoutModifyBtnText, { color: colors.textSecondary }]}>Modify</Text>
                  </TouchableOpacity>
                </View>

                <Animated.View style={[startWorkoutAnimStyle, { flex: 2 }]}>
                  <TouchableOpacity
                    style={[styles.workoutStartBtn, { backgroundColor: currentAccent, shadowColor: currentAccent }]}
                    onPress={handleStartWorkout}
                    onPressIn={() => { startWorkoutScale.value = withSpring(0.97, SPRING_BTN); }}
                    onPressOut={() => { startWorkoutScale.value = withSpring(1, SPRING_BTN); }}
                    activeOpacity={1}
                    testID="start-workout-card"
                  >
                    <Play size={15} color="#fff" fill="#fff" />
                    <Text style={styles.workoutStartBtnText}>Start Workout</Text>
                  </TouchableOpacity>
                </Animated.View>
              </View>
            </GlassCard>
          </>
        )}

        </View>

        {/* Unified tab card — tab bar header + content */}
        <View style={[styles.tabPanel, {
          marginHorizontal: 16,
          marginTop: 14,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: cardBorder,
        }]}>
          {/* Tab Bar — Apple-inspired dynamic pill */}
          <View
            style={styles.tabBarOuter}
            onLayout={(e) => setTabBarWidth(e.nativeEvent.layout.width)}
          >
            {tabBarWidth > 0 && (() => {
              const innerWidth = tabBarWidth - 8; // account for padding: 4 each side
              const pillLeftInterp = pillAnim.interpolate({
                inputRange: [0, 1, 2],
                outputRange: [0, innerWidth * 0.20, innerWidth * 0.60],
              });
              const pillWidthInterp = pillAnim.interpolate({
                inputRange: [0, 1, 2],
                outputRange: [innerWidth * 0.40, innerWidth * 0.60, innerWidth * 0.40],
              });
              // Convert currentAccent hex → rgba for glass morphism
              const hexToRgba = (hex: string, a: number) => {
                const r = parseInt(hex.slice(1, 3), 16) || 0;
                const g = parseInt(hex.slice(3, 5), 16) || 0;
                const b = parseInt(hex.slice(5, 7), 16) || 0;
                return `rgba(${r},${g},${b},${a})`;
              };
              return (
                <RNAnimated.View
                  pointerEvents="none"
                  style={[styles.tabIndicator, {
                    backgroundColor: pillAnim.interpolate({
                      inputRange: [0, 1, 2],
                      outputRange: [
                        'rgba(248,113,22,0.22)',
                        hexToRgba(currentAccent, 0.22),
                        'rgba(239,68,68,0.22)',
                      ],
                    }),
                    borderColor: pillAnim.interpolate({
                      inputRange: [0, 1, 2],
                      outputRange: [
                        'rgba(248,113,22,0.65)',
                        hexToRgba(currentAccent, 0.65),
                        'rgba(239,68,68,0.65)',
                      ],
                    }),
                    width: pillWidthInterp,
                    transform: [{ translateX: pillLeftInterp }],
                  }]}
                />
              );
            })()}
            <View ref={preTabRef} collapsable={false} style={{ flex: TAB_FLEX[activePanel][0] }}>
              <TouchableOpacity
                style={[styles.tabBtn, { justifyContent: activePanel === 0 ? 'center' : 'flex-start', paddingLeft: activePanel === 0 ? 0 : 12 }]}
                onPress={() => switchPanelTab(0)}
                activeOpacity={0.7}
                testID="tab-pre-workout"
              >
                <Flame size={14} color={activePanel === 0 ? '#f87116' : 'rgba(255,255,255,0.4)'} />
                {activePanel === 0 && (
                  <RNAnimated.Text style={[styles.tabLabel, { color: '#fff', opacity: tab0Anim }]}>
                    Pre-Workout
                  </RNAnimated.Text>
                )}
              </TouchableOpacity>
            </View>
            <View ref={workoutTabRef} collapsable={false} style={{ flex: TAB_FLEX[activePanel][1] }}>
              <TouchableOpacity
                style={[styles.tabBtn, { justifyContent: 'center' }]}
                onPress={() => switchPanelTab(1)}
                activeOpacity={0.7}
                testID="tab-workout"
              >
                <Dumbbell size={14} color={activePanel === 1 ? currentAccent : 'rgba(255,255,255,0.4)'} />
                {activePanel === 1 && (
                  <RNAnimated.Text style={[styles.tabLabel, { color: '#fff', opacity: tab1Anim }]}>
                    Workout
                  </RNAnimated.Text>
                )}
              </TouchableOpacity>
            </View>
            <View ref={postTabRef} collapsable={false} style={{ flex: TAB_FLEX[activePanel][2] }}>
              <TouchableOpacity
                style={[styles.tabBtn, { justifyContent: activePanel === 2 ? 'center' : 'flex-end', paddingRight: activePanel === 2 ? 0 : 12 }]}
                onPress={() => switchPanelTab(2)}
                activeOpacity={0.7}
                testID="tab-post-workout"
              >
                <Heart size={14} color={activePanel === 2 ? '#ef4444' : 'rgba(255,255,255,0.4)'} />
                {activePanel === 2 && (
                  <RNAnimated.Text style={[styles.tabLabel, { color: '#fff', opacity: tab2Anim }]}>
                    Post-Workout
                  </RNAnimated.Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View
            style={{ paddingTop: 4, gap: 12, paddingBottom: 12, opacity: (tracking.isRestActive && tracking.restTimeRemaining > 0 && !tracking.isTimerMinimized) ? 0.6 : 1 }}
          >
          {/* Pre-Workout Panel */}
          {activePanel === 0 && (
          <TabContentSpring>
          <View style={styles.tabContentOuter}>
            <View style={styles.tabContent}>
              {ctx.warmUp && !warmupHidden && (workout?.warmup?.length ?? 0) > 0 ? (
                <View style={[styles.checklistCard, {
                  backgroundColor: isDark ? 'rgba(248,113,22,0.06)' : 'rgba(248,113,22,0.05)',
                  borderColor: isDark ? 'rgba(248,113,22,0.18)' : 'rgba(248,113,22,0.15)',
                }]}>
                  <View style={styles.checklistSectionHeader}>
                    <View style={[styles.checklistSectionIconBadge, { backgroundColor: 'rgba(248,113,22,0.15)' }]}>
                      <Flame size={13} color="#f87116" />
                    </View>
                    <Text style={[styles.checklistSectionLabel, { color: colors.text }]}>Warm-Up</Text>
                    <View style={{ flex: 1 }} />
                    {warmupChecked.size === (workout?.warmup?.length ?? 0) && warmupChecked.size > 0 ? (
                      <View style={styles.checklistProgressPillDone}>
                        <Check size={11} color="#fff" />
                      </View>
                    ) : (
                      <View style={[styles.checklistProgressPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
                        <Text style={[styles.checklistProgressText, { color: colors.textSecondary }]}>
                          {warmupChecked.size}/{workout?.warmup?.length ?? 0}
                        </Text>
                      </View>
                    )}
                  </View>
                  {workout?.warmup.map((item, idx) => {
                    const isChecked = warmupChecked.has(idx);
                    const isLast = idx === (workout?.warmup?.length ?? 1) - 1;
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[styles.checklistRow, !isLast && { borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}
                        onPress={() => {
                          handleToggleWarmupItem(idx);
                          if (Platform.OS !== 'web') Haptics.selectionAsync();
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={[
                          styles.checklistCheckbox,
                          { borderColor: isChecked ? '#22c55e' : isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' },
                          isChecked && { backgroundColor: 'rgba(34,197,94,0.15)' },
                        ]}>
                          {isChecked && <Check size={11} color="#22c55e" strokeWidth={3} />}
                        </View>
                        <View style={styles.checklistRowInfo}>
                          <Text style={[
                            styles.checklistRowName,
                            { color: isChecked ? colors.textMuted : colors.text },
                            isChecked && { textDecorationLine: 'line-through' as const },
                          ]}>{item.name}</Text>
                          <Text style={[styles.checklistRowDesc, { color: colors.textSecondary }]} numberOfLines={1}>
                            {item.description}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => setItemDetail({ name: item.name, description: item.description, color: '#f87116', type: 'warmup' })}
                          activeOpacity={0.7}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Info size={15} color={colors.textMuted} />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyPanelCard}>
                  <View style={[styles.emptyPanelIconWrap, { backgroundColor: 'rgba(248,113,22,0.1)' }]}>
                    <Flame size={30} color="#f87116" strokeWidth={1.5} />
                  </View>
                  <Text style={[styles.emptyPanelTitle, { color: colors.text }]}>No warm-up added</Text>
                  <Text style={[styles.emptyPanelSub, { color: colors.textSecondary }]}>Enable warm-up in settings to add a pre-workout routine</Text>
                </View>
              )}
            </View>
          </View>
          </TabContentSpring>
        )}

        {activePanel === 1 && (
          <TabContentSpring>
          <View style={styles.tabContentOuter}>
            <View style={styles.tabContent}>
              <View style={[styles.workoutSection, {
                backgroundColor: isDark ? 'rgba(34,34,34,0.98)' : 'rgba(235,235,235,0.98)',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              }]}>
                <View
                  ref={(ref) => { exercisesSectionRef.current = ref; }}
                  collapsable={false}
                >
                  {renderWorkoutExercises()}
                </View>
              </View>

              {workout?.coreFinisher && workout.coreFinisher.length > 0 && (
                <View style={[
                  styles.coreFinisherCard,
                  {
                    backgroundColor: isDark ? 'rgba(34,197,94,0.05)' : 'rgba(34,197,94,0.04)',
                    borderColor: isDark ? 'rgba(34,197,94,0.20)' : 'rgba(34,197,94,0.18)',
                  },
                ]}>
                  <TouchableOpacity
                    style={styles.coreFinisherHeader}
                    onPress={() => setInfoLabel('CORE FINISHER')}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.coreFinisherIconBadge, { backgroundColor: 'rgba(34,197,94,0.15)' }]}>
                      <Target size={13} color="#22c55e" />
                    </View>
                    <Text style={[styles.coreFinisherLabel, { color: colors.text }]}>Core Finisher</Text>
                    <View style={{ flex: 1 }} />
                    <View style={styles.coreFinisherAIBadge}>
                      <Zap size={10} color="#22c55e" />
                      <Text style={styles.coreFinisherAIBadgeText}>AI</Text>
                    </View>
                  </TouchableOpacity>
                  {workout.coreFinisher.map((ex, idx) => {
                    const isCompleted = tracking.exerciseLogs[ex.id]?.completed === true;
                    const isExpanded = expandedTrack === ex.id;
                    const isLast = idx === workout.coreFinisher!.length - 1;
                    return (
                      <View
                        key={ex.id}
                        onLayout={(e) => {
                          rowLayoutsRef.current.set(ex.id, {
                            y: e.nativeEvent.layout.y,
                            height: e.nativeEvent.layout.height,
                          });
                        }}
                      >
                        <SwipeableExerciseRow
                          id={ex.id}
                          isOpen={swipeOpenId === ex.id}
                          onOpen={setSwipeOpenId}
                          onInfo={() => handleExerciseTap(ex)}
                          onSwap={() => handleSwapExercise(ex)}
                          onDelete={() => handleDeleteExercise(ex.id)}
                          rowBg={'transparent'}
                          waitForGesture={scrollGesture}
                          enabled={activeDragId === null}
                        >
                          <TouchableOpacity
                            style={[styles.exerciseRow, { borderBottomColor: isLast ? 'transparent' : `${colors.border}40` }]}
                            onPress={() => handleToggleTrackPanel(ex.id, ex)}
                            onLongPress={() => handleExerciseLongPress(ex)}
                            delayLongPress={350}
                            activeOpacity={1}
                          >
                            <Text style={[styles.exerciseNum, { color: colors.textMuted }]}>{idx + 1}</Text>
                            <View style={styles.exerciseInfo}>
                              <Text style={[styles.exerciseName, { color: isCompleted ? colors.textMuted : colors.text, fontFamily: isExpanded ? 'Outfit_600SemiBold' : 'Outfit_500Medium' }]}>
                                {ex.name}
                              </Text>
                              {!isCompleted && (
                                <Text style={[styles.exerciseMeta, { color: colors.textSecondary }]}>
                                  {ex.sets}×{ex.reps && ex.reps !== 'NaN' ? ex.reps : '—'}{ex.rest && ex.rest.toLowerCase() !== 'none' ? ` · Rest ${ex.rest}` : ''}{ex.suggestedWeight && !ex.suggestedWeight.includes('NaN') && ex.suggestedWeight !== 'BW' && ex.suggestedWeight !== '0 lb' ? ` · ${ex.suggestedWeight}` : ''}
                                </Text>
                              )}
                            </View>
                            {renderTrackButton(ex)}
                            {renderGripDots(ex)}
                          </TouchableOpacity>
                        </SwipeableExerciseRow>
                        {!isLast && <View style={[styles.exerciseRowSeparator, { backgroundColor: `${colors.border}40` }]} />}
                        <ExpandingPanel visible={isExpanded}>
                          {renderTrackingPanel(ex)}
                        </ExpandingPanel>
                      </View>
                    );
                  })}
                </View>
              )}

              {hasCardio && (
                <View style={[
                  styles.cardioStandaloneCard,
                  {
                    backgroundColor: isDark ? 'rgba(14,14,14,0.99)' : 'rgba(232,232,232,0.99)',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    marginHorizontal: -12,
                  },
                ]}>
                  <View style={styles.cardioStandaloneHeader}>
                    <View style={[styles.cardioStandaloneIconBadge, { backgroundColor: 'rgba(139,92,246,0.15)' }]}>
                      <Activity size={13} color="#8b5cf6" />
                    </View>
                    <TouchableOpacity onPress={() => setInfoLabel('Cardio')} activeOpacity={0.7}>
                      <Text style={[styles.cardioStandaloneLabel, { color: colors.text }]}>Cardio</Text>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }} />
                    {workout!.cardio[0]?.format ? (
                      <Text style={[styles.cardioFormat, { color: colors.textSecondary }]}>
                        {workout!.cardio[0].format}
                      </Text>
                    ) : null}
                    <TouchableOpacity onPress={() => setInfoLabel('Cardio')} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Info size={14} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                  {workout!.cardio.map((c, idx) => {
                    const isLast = idx === workout!.cardio.length - 1;
                    return (
                      <View key={idx} style={[
                        styles.cardioItem,
                        { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', borderBottomWidth: isLast ? 0 : 1 },
                      ]}>
                        <View style={styles.cardioInfo}>
                          <TouchableOpacity onPress={() => setItemDetail({ name: c.name, description: c.duration + ' · RPE ' + c.rpe, color: '#8b5cf6' })} activeOpacity={0.7}>
                            <Text style={[styles.cardioName, { color: colors.text }]}>{c.name}</Text>
                          </TouchableOpacity>
                          <Text style={[styles.cardioMeta, { color: colors.textSecondary }]}>
                            {c.duration} · RPE {c.rpe}
                          </Text>
                          {c.notes ? (
                            <Text style={[styles.cardioNotes, { color: colors.textMuted }]}>&quot;{c.notes}&quot;</Text>
                          ) : null}
                        </View>
                        <TouchableOpacity activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Clipboard size={17} color={colors.textMuted} />
                        </TouchableOpacity>
                        <TouchableOpacity activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <ArrowLeftRight size={15} color={colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
          </TabContentSpring>
        )}

        {activePanel === 2 && (
          <TabContentSpring>
          <View style={styles.tabContentOuter}>
            <View style={styles.tabContent}>
              {hasPostContent ? (
                <View style={{ gap: 10 }}>
                  {ctx.coolDown && workout && workout.cooldown.length > 0 && (
                    <View style={[styles.checklistCard, {
                      backgroundColor: isDark ? 'rgba(6,182,212,0.06)' : 'rgba(6,182,212,0.05)',
                      borderColor: isDark ? 'rgba(6,182,212,0.18)' : 'rgba(6,182,212,0.15)',
                    }]}>
                      <View style={styles.checklistSectionHeader}>
                        <View style={[styles.checklistSectionIconBadge, { backgroundColor: 'rgba(6,182,212,0.15)' }]}>
                          <Snowflake size={13} color="#06b6d4" />
                        </View>
                        <Text style={[styles.checklistSectionLabel, { color: colors.text }]}>Cool-Down</Text>
                        <View style={{ flex: 1 }} />
                        {cooldownChecked.size === workout.cooldown.length && cooldownChecked.size > 0 ? (
                          <View style={styles.checklistProgressPillDone}>
                            <Check size={11} color="#fff" />
                          </View>
                        ) : (
                          <View style={[styles.checklistProgressPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
                            <Text style={[styles.checklistProgressText, { color: colors.textSecondary }]}>
                              {cooldownChecked.size}/{workout.cooldown.length}
                            </Text>
                          </View>
                        )}
                      </View>
                      {workout.cooldown.map((item, idx) => {
                        const isChecked = cooldownChecked.has(idx);
                        const isLast = idx === workout.cooldown.length - 1;
                        return (
                          <TouchableOpacity
                            key={idx}
                            style={[styles.checklistRow, !isLast && { borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}
                            onPress={() => {
                              const next = new Set(cooldownChecked);
                              if (next.has(idx)) next.delete(idx); else next.add(idx);
                              setCooldownChecked(next);
                              if (next.size === workout.cooldown.length) setCooldownComplete(true);
                              if (Platform.OS !== 'web') Haptics.selectionAsync();
                            }}
                            activeOpacity={0.7}
                          >
                            <View style={[
                              styles.checklistCheckbox,
                              { borderColor: isChecked ? '#22c55e' : isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' },
                              isChecked && { backgroundColor: 'rgba(34,197,94,0.15)' },
                            ]}>
                              {isChecked && <Check size={11} color="#22c55e" strokeWidth={3} />}
                            </View>
                            <View style={styles.checklistRowInfo}>
                              <Text style={[
                                styles.checklistRowName,
                                { color: isChecked ? colors.textMuted : colors.text },
                                isChecked && { textDecorationLine: 'line-through' as const },
                              ]}>{item.name}</Text>
                              <Text style={[styles.checklistRowDesc, { color: colors.textSecondary }]} numberOfLines={1}>
                                {item.description}
                              </Text>
                            </View>
                            <TouchableOpacity
                              onPress={() => setItemDetail({ name: item.name, description: item.description, color: '#06b6d4', type: 'cooldown' })}
                              activeOpacity={0.7}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Info size={15} color={colors.textMuted} />
                            </TouchableOpacity>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                  {ctx.recovery && workout && workout.recovery.length > 0 && (
                    <View style={[styles.checklistCard, {
                      backgroundColor: isDark ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.05)',
                      borderColor: isDark ? 'rgba(239,68,68,0.18)' : 'rgba(239,68,68,0.15)',
                    }]}>
                      <View style={styles.checklistSectionHeader}>
                        <View style={[styles.checklistSectionIconBadge, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
                          <Heart size={13} color="#ef4444" />
                        </View>
                        <Text style={[styles.checklistSectionLabel, { color: colors.text }]}>Recovery</Text>
                        <View style={{ flex: 1 }} />
                        {recoveryChecked.size === workout.recovery.length && recoveryChecked.size > 0 ? (
                          <View style={styles.checklistProgressPillDone}>
                            <Check size={11} color="#fff" />
                          </View>
                        ) : (
                          <View style={[styles.checklistProgressPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
                            <Text style={[styles.checklistProgressText, { color: colors.textSecondary }]}>
                              {recoveryChecked.size}/{workout.recovery.length}
                            </Text>
                          </View>
                        )}
                      </View>
                      {workout.recovery.map((item, idx) => {
                        const isChecked = recoveryChecked.has(idx);
                        const isLast = idx === workout.recovery.length - 1;
                        return (
                          <TouchableOpacity
                            key={idx}
                            style={[styles.checklistRow, !isLast && { borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}
                            onPress={() => {
                              const next = new Set(recoveryChecked);
                              if (next.has(idx)) next.delete(idx); else next.add(idx);
                              setRecoveryChecked(next);
                              if (Platform.OS !== 'web') Haptics.selectionAsync();
                            }}
                            activeOpacity={0.7}
                          >
                            <View style={[
                              styles.checklistCheckbox,
                              { borderColor: isChecked ? '#22c55e' : isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' },
                              isChecked && { backgroundColor: 'rgba(34,197,94,0.15)' },
                            ]}>
                              {isChecked && <Check size={11} color="#22c55e" strokeWidth={3} />}
                            </View>
                            <View style={styles.checklistRowInfo}>
                              <Text style={[
                                styles.checklistRowName,
                                { color: isChecked ? colors.textMuted : colors.text },
                                isChecked && { textDecorationLine: 'line-through' as const },
                              ]}>{item.name}</Text>
                              <Text style={[styles.checklistRowDesc, { color: colors.textSecondary }]} numberOfLines={1}>
                                {item.description}
                              </Text>
                            </View>
                            <TouchableOpacity
                              onPress={() => setItemDetail({ name: item.name, description: item.description, color: '#ef4444', benefit: item.benefit, type: 'recovery' })}
                              activeOpacity={0.7}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Info size={15} color={colors.textMuted} />
                            </TouchableOpacity>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.emptyPanelCard}>
                  <View style={[styles.emptyPanelIconWrap, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                    <Heart size={30} color="#ef4444" strokeWidth={1.5} />
                  </View>
                  <Text style={[styles.emptyPanelTitle, { color: colors.text }]}>No recovery added</Text>
                  <Text style={[styles.emptyPanelSub, { color: colors.textSecondary }]}>Enable cool-down or recovery in settings to add post-workout content</Text>
                </View>
              )}
              {tracking.isWorkoutActive && (
                <View style={styles.tabCompleteWrap}>
                  <Animated.View style={completeWorkoutAnimStyle}>
                    <TouchableOpacity
                      style={[styles.completeBtn, { backgroundColor: currentAccent }]}
                      onPress={handleCompleteWorkout}
                      onPressIn={() => { completeWorkoutScale.value = withSpring(0.97, SPRING_BTN); }}
                      onPressOut={() => { completeWorkoutScale.value = withSpring(1, SPRING_BTN); }}
                      activeOpacity={1}
                      testID="complete-workout-post"
                    >
                      <Check size={18} color={getContrastTextColor(currentAccent)} />
                      <Text style={[styles.completeBtnText, { color: getContrastTextColor(currentAccent) }]}>Finish Workout</Text>
                    </TouchableOpacity>
                  </Animated.View>
                </View>
              )}
            </View>
          </View>
          </TabContentSpring>
        )}

        {/* Add / Finish button — outside the card, workout tab only */}
        {activePanel === 1 && (
          <View style={{ marginHorizontal: 16, marginTop: 8 }}>
            <View style={styles.tabCompleteWrap}>
              {tracking.isWorkoutActive ? (
                <View style={styles.completeRow}>
                  <View style={styles.addBtnWrap}>
                    <View ref={addBtnRef} collapsable={false}>
                      <TouchableOpacity
                        style={[styles.addBtnSquare, { borderColor: `${currentAccent}50`, backgroundColor: 'transparent', borderWidth: 1.5 }]}
                        onPress={() => setAddMenuVisible(!addMenuVisible)}
                        activeOpacity={0.7}
                      >
                        <Plus size={20} color={currentAccent} />
                      </TouchableOpacity>
                    </View>
                    {addMenuVisible && (
                      <View style={[styles.addMenuUp, { borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)' }]}>
                        {Platform.OS !== 'web' ? (
                          <BlurView intensity={65} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                        ) : null}
                        <View style={[styles.addMenuSurface, { backgroundColor: isDark ? 'rgba(20,20,20,0.70)' : 'rgba(255,255,255,0.92)' }]} />
                        {([
                          { label: 'Add Exercise', icon: <Plus size={14} color={colors.textMuted} />, mode: 'exercise' as AddMode },
                          { label: 'Create Superset', icon: <Link2 size={14} color={colors.textMuted} />, mode: 'superset' as AddMode },
                          { label: 'Create Circuit', icon: <RefreshCw size={14} color={colors.textMuted} />, mode: 'circuit' as AddMode },
                        ]).map((item, idx) => (
                          <TouchableOpacity
                            key={idx}
                            style={[styles.addMenuItem, idx < 2 && { borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]}
                            onPress={() => handleOpenAddSheet(item.mode)}
                            activeOpacity={0.7}
                          >
                            {item.icon}
                            <Text style={[styles.addMenuText, { color: colors.text }]}>{item.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                  <View ref={finishBtnRef} collapsable={false} style={{ flex: 1 }}>
                    <Animated.View style={completeWorkoutAnimStyle}>
                      <TouchableOpacity
                        style={[styles.completeBtn, { backgroundColor: currentAccent }]}
                        onPress={handleCompleteWorkout}
                        onPressIn={() => { completeWorkoutScale.value = withSpring(0.97, SPRING_BTN); }}
                        onPressOut={() => { completeWorkoutScale.value = withSpring(1, SPRING_BTN); }}
                        activeOpacity={1}
                        testID="complete-workout"
                      >
                        <Check size={18} color={getContrastTextColor(currentAccent)} />
                        <Text style={[styles.completeBtnText, { color: getContrastTextColor(currentAccent) }]}>Finish Workout</Text>
                      </TouchableOpacity>
                    </Animated.View>
                  </View>
                </View>
              ) : (
                <View style={styles.addBtnWrap}>
                  <View ref={addBtnRef} collapsable={false}>
                    <TouchableOpacity
                      style={[styles.addBtnFull, { borderColor: `${currentAccent}30`, backgroundColor: 'transparent' }]}
                      onPress={() => setAddMenuVisible(!addMenuVisible)}
                      activeOpacity={0.7}
                    >
                      <Plus size={15} color={currentAccent} />
                      <Text style={[styles.addBtnFullText, { color: currentAccent }]}>Add Exercise</Text>
                    </TouchableOpacity>
                  </View>
                  {addMenuVisible && (
                    <View style={[styles.addMenuUp, { borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)' }]}>
                      {Platform.OS !== 'web' ? (
                        <BlurView intensity={65} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                      ) : null}
                      <View style={[styles.addMenuSurface, { backgroundColor: isDark ? 'rgba(20,20,20,0.70)' : 'rgba(255,255,255,0.92)' }]} />
                      {([
                        { label: 'Add Exercise', icon: <Plus size={14} color={colors.textMuted} />, mode: 'exercise' as AddMode },
                        { label: 'Create Superset', icon: <Link2 size={14} color={colors.textMuted} />, mode: 'superset' as AddMode },
                        { label: 'Create Circuit', icon: <RefreshCw size={14} color={colors.textMuted} />, mode: 'circuit' as AddMode },
                      ]).map((item, idx) => (
                        <TouchableOpacity
                          key={idx}
                          style={[styles.addMenuItem, idx < 2 && { borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]}
                          onPress={() => handleOpenAddSheet(item.mode)}
                          activeOpacity={0.7}
                        >
                          {item.icon}
                          <Text style={[styles.addMenuText, { color: colors.text }]}>{item.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        )}

          </View>
        </View>
      </ScrollView>
      </GestureDetector>

      <ModifyWorkoutDrawer
        visible={modifyVisible}
        onClose={() => setModifyVisible(false)}
        onWorkoutChanged={handleModifyChanged}
      />

      <AddToWorkoutSheet
        visible={addSheetVisible}
        mode={addSheetMode}
        workoutStyle={currentStyle}
        muscleGroupFilter={addSheetMuscleFilter}
        swapSourceExercise={swapTargetExercise}
        onClose={() => { setAddSheetVisible(false); setSwapTargetExercise(null); }}
        onAdd={handleAddExercises}
      />

      <ExerciseDetailDrawer
        visible={detailVisible}
        exercise={detailExercise}
        workoutStyle={currentStyle}
        onClose={() => setDetailVisible(false)}
      />

      <AthleteProfileDrawer
        visible={profileVisible}
        onClose={() => setProfileVisible(false)}
        onOpenAboutMe={() => setAboutMeVisible(true)}
        onOpenInsights={() => setInsightsVisible(true)}
        onOpenSettings={() => setSettingsVisible(true)}
      />

      <AboutMeDrawer
        visible={aboutMeVisible}
        onClose={() => setAboutMeVisible(false)}
        onBack={() => setAboutMeVisible(false)}
      />

      <InsightsDrawer
        visible={insightsVisible}
        onClose={() => setInsightsVisible(false)}
        onBack={() => setInsightsVisible(false)}
      />

      <SettingsDrawer
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        onBack={() => setSettingsVisible(false)}
        onOpenColorTheme={() => setColorThemeVisible(true)}
        onOpenEquipment={() => setEquipmentVisible(true)}
      />

      <ColorThemeDrawer
        visible={colorThemeVisible}
        onClose={() => setColorThemeVisible(false)}
        onBack={() => setColorThemeVisible(false)}
      />

      <EquipmentDrawer
        visible={equipmentVisible}
        onClose={() => setEquipmentVisible(false)}
        onBack={() => setEquipmentVisible(false)}
      />

      <PostWorkoutFlow />
      <LogPreviousWorkout />
      <WorkoutLogDetail />
      <FullCalendarModal />
      <HealthImportSheet />

      <WheelGuideModal
        visible={showWheelGuide}
        onDismiss={async () => {
          setShowWheelGuide(false);
          await AsyncStorage.setItem('@zeal_wheel_guide_seen_v1', 'true');
        }}
        accentColor={currentAccent}
      />

      <WorkoutWalkthrough
        visible={showWalkthrough}
        onDismiss={handleWalkthroughDismiss}
        stepRects={walkthroughRects}
        onRequestTab={handleWalkthroughRequestTab}
        onRequestExpandFirstExercise={handleWalkthroughExpandFirst}
        onRequestCollapseExercise={handleWalkthroughCollapse}
        onRequestScrollToTop={handleWalkthroughScrollTop}
        onRequestScrollToBottom={handleWalkthroughScrollBottom}
        onStepPress={(stepIndex) => {
          // Execute the real action the user is being guided to do.
          if (stepIndex === 0) handleWalkthroughRequestTab(0);
          else if (stepIndex === 1) handleWalkthroughRequestTab(2);
          else if (stepIndex === 2) handleWalkthroughRequestTab(1);
          else if (stepIndex === 3) handleWalkthroughExpandFirst();
          else if (stepIndex === 4) {
            // Logging step: tapping the highlighted track panel is enough to proceed.
          }
          else if (stepIndex === 5) {
            setModifyVisible(true);
            // Don't let the drawer block the next spotlight (+ button) step.
            setTimeout(() => setModifyVisible(false), 650);
          }
          else if (stepIndex === 6) {
            setModifyVisible(false);
            setAddMenuVisible(true);
          }
          else if (stepIndex === 7) handleCompleteWorkout();
        }}
      />

      <Modal
        transparent
        animationType="slide"
        visible={warmupModalVisible}
        onRequestClose={() => setWarmupModalVisible(false)}
        statusBarTranslucent
      >
        <TouchableOpacity
          style={styles.infoBackdrop}
          onPress={() => setWarmupModalVisible(false)}
          activeOpacity={1}
        >
          <View style={[styles.warmupModalSheet, { backgroundColor: colors.card }]}>
            <View style={[styles.infoHandle, { backgroundColor: colors.border }]} />
            <View style={styles.warmupModalHeader}>
              <Flame size={18} color="#f87116" />
              <Text style={[styles.infoTitle, { color: colors.text }]}>Warm-Up</Text>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={() => setInfoLabel('Warm-Up')} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Info size={16} color="#f87116" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.warmupModalScroll} showsVerticalScrollIndicator={false}>
              {workout?.warmup.map((item, idx) => {
                const isChecked = warmupChecked.has(idx);
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.warmupModalItem, { borderBottomColor: `${colors.border}40` }]}
                    onPress={() => handleToggleWarmupItem(idx)}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.warmupModalCheckbox,
                      { borderColor: isChecked ? '#22c55e' : colors.border },
                      isChecked && { backgroundColor: 'rgba(34,197,94,0.15)' },
                    ]}>
                      {isChecked && <Check size={14} color="#22c55e" />}
                    </View>
                    <View style={styles.warmupModalItemInfo}>
                      <Text style={[
                        styles.warmupModalItemName,
                        { color: isChecked ? colors.textMuted : colors.text },
                        isChecked && { textDecorationLine: 'line-through' as const },
                      ]}>{item.name}</Text>
                      <Text style={[styles.warmupModalItemDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                        {item.description}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setItemDetail({ name: item.name, description: item.description, color: '#f87116', type: 'warmup' })}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Info size={17} color={colors.textMuted} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={[styles.warmupModalDoneBtn, { backgroundColor: warmupChecked.size === (workout?.warmup.length ?? 0) ? '#22c55e' : '#f87116' }]}
              onPress={handleWarmupDone}
              activeOpacity={0.85}
            >
              <Check size={16} color="#fff" />
              <Text style={styles.warmupModalDoneBtnText}>Done with Warm-Up</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        transparent
        animationType="slide"
        visible={cooldownModalVisible}
        onRequestClose={() => setCooldownModalVisible(false)}
        statusBarTranslucent
      >
        <TouchableOpacity
          style={styles.infoBackdrop}
          onPress={() => setCooldownModalVisible(false)}
          activeOpacity={1}
        >
          <View style={[styles.warmupModalSheet, { backgroundColor: colors.card }]}>
            <View style={[styles.infoHandle, { backgroundColor: colors.border }]} />
            <View style={styles.warmupModalHeader}>
              <Snowflake size={18} color="#06b6d4" />
              <Text style={[styles.infoTitle, { color: colors.text }]}>Cool-Down</Text>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={() => { setCooldownModalVisible(false); setInfoLabel('Cool-Down'); }} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Info size={16} color="#06b6d4" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.warmupModalScroll} showsVerticalScrollIndicator={false}>
              {workout?.cooldown.map((item, idx) => {
                const isChecked = cooldownChecked.has(idx);
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.warmupModalItem, { borderBottomColor: `${colors.border}40` }]}
                    onPress={() => {
                      const next = new Set(cooldownChecked);
                      if (next.has(idx)) next.delete(idx); else next.add(idx);
                      setCooldownChecked(next);
                      if (next.size === (workout?.cooldown.length ?? 0)) setCooldownComplete(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.warmupModalCheckbox,
                      { borderColor: isChecked ? '#22c55e' : colors.border },
                      isChecked && { backgroundColor: 'rgba(34,197,94,0.15)' },
                    ]}>
                      {isChecked && <Check size={14} color="#22c55e" />}
                    </View>
                    <View style={styles.warmupModalItemInfo}>
                      <Text style={[
                        styles.warmupModalItemName,
                        { color: isChecked ? colors.textMuted : colors.text },
                        isChecked && { textDecorationLine: 'line-through' as const },
                      ]}>{item.name}</Text>
                      <Text style={[styles.warmupModalItemDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                        {item.description}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setItemDetail({ name: item.name, description: item.description, color: '#06b6d4', type: 'cooldown' })}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Info size={17} color={colors.textMuted} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={[styles.warmupModalDoneBtn, { backgroundColor: cooldownChecked.size === (workout?.cooldown.length ?? 0) ? '#22c55e' : '#06b6d4' }]}
              onPress={() => { setCooldownComplete(cooldownChecked.size === (workout?.cooldown.length ?? 0)); setCooldownModalVisible(false); }}
              activeOpacity={0.85}
            >
              <Check size={16} color="#fff" />
              <Text style={styles.warmupModalDoneBtnText}>Done with Cool-Down</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        transparent
        animationType="slide"
        visible={recoveryModalVisible}
        onRequestClose={() => setRecoveryModalVisible(false)}
        statusBarTranslucent
      >
        <TouchableOpacity
          style={styles.infoBackdrop}
          onPress={() => setRecoveryModalVisible(false)}
          activeOpacity={1}
        >
          <View style={[styles.warmupModalSheet, { backgroundColor: colors.card }]}>
            <View style={[styles.infoHandle, { backgroundColor: colors.border }]} />
            <View style={styles.warmupModalHeader}>
              <Heart size={18} color="#ef4444" />
              <Text style={[styles.infoTitle, { color: colors.text }]}>Recovery</Text>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={() => { setRecoveryModalVisible(false); setInfoLabel('Recovery'); }} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Info size={16} color="#ef4444" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.warmupModalScroll} showsVerticalScrollIndicator={false}>
              {workout?.recovery.map((item, idx) => (
                <View
                  key={idx}
                  style={[styles.warmupModalItem, { borderBottomColor: `${colors.border}40` }]}
                >
                  <View style={styles.warmupModalItemInfo}>
                    <Text style={[styles.warmupModalItemName, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[styles.warmupModalItemDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                      {item.description}
                    </Text>
                    {item.benefit ? (
                      <Text style={styles.recoveryBenefit}>{item.benefit}</Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    onPress={() => setItemDetail({ name: item.name, description: item.description, color: '#ef4444', benefit: item.benefit, type: 'recovery' })}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Info size={17} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.warmupModalDoneBtn, { backgroundColor: '#ef4444' }]}
              onPress={() => setRecoveryModalVisible(false)}
              activeOpacity={0.85}
            >
              <Check size={16} color="#fff" />
              <Text style={styles.warmupModalDoneBtnText}>Done with Recovery</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        transparent
        animationType="slide"
        visible={!!itemDetail}
        onRequestClose={() => setItemDetail(null)}
        statusBarTranslucent
      >
        <View style={styles.infoBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setItemDetail(null)} activeOpacity={1} />
          {itemDetail && (() => {
            const itemType = itemDetail.type ?? 'cooldown';
            const detail = generateItemDetail(itemDetail.name, itemType);
            return (
              <View style={[styles.richDetailSheet, { backgroundColor: colors.card }]}>
                <View style={[styles.infoHandle, { backgroundColor: colors.border }]} />
                <View style={styles.richDetailHeader}>
                  <View style={[styles.richDetailIconWrap, { backgroundColor: `${itemDetail.color}20` }]}>
                    {itemType === 'warmup' ? (
                      <Flame size={18} color={itemDetail.color} />
                    ) : itemType === 'cooldown' ? (
                      <Snowflake size={18} color={itemDetail.color} />
                    ) : (
                      <Heart size={18} color={itemDetail.color} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.richDetailTypeLabel, { color: itemDetail.color }]}>
                      {itemType === 'warmup' ? 'WARM-UP' : itemType === 'cooldown' ? 'COOL-DOWN' : 'RECOVERY'}
                    </Text>
                    <Text style={[styles.richDetailTitleText, { color: colors.text }]}>{itemDetail.name}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setItemDetail(null)}
                    style={[styles.richDetailXBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    <X size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.richDetailScrollContent}
                  bounces={false}
                >
                  <Text style={[styles.richDetailDesc, { color: colors.textSecondary }]}>
                    {itemDetail.description}
                  </Text>

                  <View style={styles.richDetailSectionRow}>
                    <Target size={13} color={itemDetail.color} />
                    <Text style={[styles.richDetailSectionLabel, { color: colors.text }]}>SETUP</Text>
                  </View>
                  <View style={[styles.richDetailBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }]}>
                    <Text style={[styles.richDetailBoxText, { color: colors.textSecondary }]}>{detail.setup}</Text>
                  </View>

                  <View style={styles.richDetailSectionRow}>
                    <Info size={13} color={itemDetail.color} />
                    <Text style={[styles.richDetailSectionLabel, { color: colors.text }]}>
                      {itemType === 'recovery' ? 'HOW TO DO IT' : 'HOW TO PERFORM'}
                    </Text>
                  </View>
                  <View style={[styles.richDetailBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }]}>
                    {detail.steps.map((step, sIdx) => (
                      <View key={sIdx} style={styles.richDetailStepRow}>
                        <View style={[styles.richDetailStepNum, { backgroundColor: itemDetail.color }]}>
                          <Text style={styles.richDetailStepNumText}>{sIdx + 1}</Text>
                        </View>
                        <Text style={[styles.richDetailStepText, { color: colors.text }]}>{step}</Text>
                      </View>
                    ))}
                  </View>

                  {itemDetail.benefit ? (
                    <>
                      <View style={styles.richDetailSectionRow}>
                        <Zap size={13} color={itemDetail.color} />
                        <Text style={[styles.richDetailSectionLabel, { color: colors.text }]}>WHY IT MATTERS</Text>
                      </View>
                      <View style={[styles.richDetailBox, { backgroundColor: `${itemDetail.color}12` }]}>
                        <Text style={[styles.richDetailBoxText, { color: colors.textSecondary }]}>{itemDetail.benefit}</Text>
                      </View>
                    </>
                  ) : null}
                </ScrollView>
              </View>
            );
          })()}
        </View>
      </Modal>

      <Modal
        transparent
        animationType="slide"
        visible={!!infoLabel}
        onRequestClose={() => setInfoLabel(null)}
        statusBarTranslucent
      >
        <TouchableOpacity
          style={styles.infoBackdrop}
          onPress={() => setInfoLabel(null)}
          activeOpacity={1}
        >
          <View style={[styles.infoSheet, { backgroundColor: colors.card }]}>
            <View style={[styles.infoHandle, { backgroundColor: colors.border }]} />
            {infoLabel && (() => {
              const info = getInfoContent(infoLabel);
              return (
                <>
                  <View style={styles.infoTitleRow}>
                    <Info size={16} color={colors.textSecondary} />
                    <Text style={[styles.infoTitle, { color: colors.text }]}>{info.title}</Text>
                  </View>
                  <Text style={[styles.infoBody, { color: colors.textSecondary }]}>{info.body}</Text>
                  <TouchableOpacity
                    style={[styles.infoDismiss, { backgroundColor: currentAccent }]}
                    onPress={() => setInfoLabel(null)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.infoDismissText}>Got it</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        </TouchableOpacity>
      </Modal>
      {activeDragId !== null && (
        <RNAnimated.View
          pointerEvents="none"
          style={[
            styles.dragGhost,
            {
              top: dragGhostAnim,
              backgroundColor: colors.card,
              borderColor: `${currentAccent}50`,
              shadowColor: currentAccent,
            },
          ]}
        >
          {dragGhostItems.map((item) => (
            <View key={item.id} style={styles.dragGhostRow}>
              <View style={{ gap: 2.5 }}>
                <View style={{ width: 12, height: 1.5, borderRadius: 1, backgroundColor: colors.textMuted }} />
                <View style={{ width: 12, height: 1.5, borderRadius: 1, backgroundColor: colors.textMuted }} />
                <View style={{ width: 12, height: 1.5, borderRadius: 1, backgroundColor: colors.textMuted }} />
              </View>
              <Text style={[styles.dragGhostName, { color: colors.text }]} numberOfLines={1}>
                {item.name}
              </Text>
            </View>
          ))}
        </RNAnimated.View>
      )}

      {showGeneratingOverlay && (
        <RNAnimated.View
          style={[
            generatingStyles.overlay,
            { opacity: overlayFadeAnim, backgroundColor: isDark ? 'rgba(8,8,10,0.93)' : 'rgba(255,255,255,0.94)' },
          ]}
          pointerEvents={isGenerating ? 'auto' : 'none'}
        >
          <SafeAreaView edges={['top', 'bottom']} style={generatingStyles.safeArea}>
            <View style={generatingStyles.content}>
              <RNAnimated.View style={[
                generatingStyles.iconWrap,
                { backgroundColor: `${currentAccent}18`, borderColor: `${currentAccent}30` },
                { transform: [{ scale: dumbbellPulseAnim }] },
              ]}>
                <RNAnimated.View style={{ transform: [{ rotate: dumbbellSpin }] }}>
                  <Dumbbell size={42} color={currentAccent} strokeWidth={1.8} />
                </RNAnimated.View>
              </RNAnimated.View>
              <Text style={[generatingStyles.title, { color: isDark ? '#fff' : '#111' }]}>
                Building your workout...
              </Text>
              <Text style={[generatingStyles.subtitle, { color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }]}>
                Tailoring to your goals & equipment
              </Text>
              <View style={generatingStyles.etaRow}>
                {generatingIsAI ? (
                  <>
                    <View style={[generatingStyles.aiDot, { backgroundColor: currentAccent }]} />
                    <Text style={[generatingStyles.etaText, { color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)' }]}>
                      est. 15s{generatingElapsed > 0 ? `  ·  ${generatingElapsed}s` : ''}
                    </Text>
                  </>
                ) : (
                  <Text style={[generatingStyles.etaText, { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.38)' }]}>
                    Ready in just a moment
                  </Text>
                )}
              </View>
              {workout !== null && (
                <TouchableOpacity
                  onPress={handleCancelGenerate}
                  activeOpacity={0.7}
                  style={generatingStyles.cancelBtn}
                >
                  <Text style={[generatingStyles.cancelText, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)' }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </SafeAreaView>
        </RNAnimated.View>
      )}
    </View>
  );
}

const generatingStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  content: {
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 40,
  },
  iconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: -8,
  },
  cancelBtn: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  cancelText: {
    fontSize: 16,
    fontFamily: 'Outfit_500Medium',
    letterSpacing: 0.1,
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -4,
  },
  aiDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  etaText: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
    letterSpacing: 0.2,
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  wordmark: {
    fontSize: 22,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -1.2,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500' as const,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 8,
  },
  modifyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  modifyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modifyTitle: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
  },
  modifyRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modifyDuration: {
    fontSize: 13,
  },
  styleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  styleBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  styleBadgeText: {
    fontSize: 10,
    fontWeight: '800' as const,
    letterSpacing: 0.7,
  },
  startCard: {
    borderRadius: 14,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 8,
  },
  playCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
    marginBottom: 4,
  },
  startTitle: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
  },
  startSub: {
    fontSize: 13,
  },
  workoutInfoCard: {
    borderRadius: 26,
    overflow: 'hidden',
  },
  workoutInfoTop: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 8,
  },
  workoutInfoLabelRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  workoutInfoLabelLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  styleChipInline: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  workoutInfoLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_400Regular',
    letterSpacing: 0,
  },
  workoutInfoTitleRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    gap: 10,
  },
  workoutInfoTitle: {
    flex: 1,
    fontSize: 30,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.2,
    lineHeight: 38,
    color: '#ffffff',
  },
  workoutInfoSubtitle: {
    fontSize: 13,
    fontFamily: 'Outfit_400Regular',
    letterSpacing: 0.1,
    marginTop: -2,
  },
  workoutInfoChips: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 6,
  },
  workoutStyleChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  workoutStyleChipText: {
    fontSize: 10,
    fontFamily: 'Outfit_500Medium',
    letterSpacing: 0.2,
  },
  workoutInfoChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  workoutInfoChipText: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
  },
  workoutInfoDivider: {
    height: 1,
  },
  workoutInfoActions: {
    flexDirection: 'row' as const,
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
  },
  muscleGroupsRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  muscleTag: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  muscleTagText: {
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.2,
  },
  workoutStatsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 16,
  },
  workoutStatBlock: {
    flex: 1,
    alignItems: 'center' as const,
    gap: 3,
  },
  workoutStatValue: {
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.5,
  },
  workoutStatLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
    letterSpacing: 0.2,
  },
  workoutStatDivider: {
    width: 1,
    height: 28,
  },
  workoutModifyBtn: {
    alignSelf: 'stretch' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 12,
  },
  workoutModifyBtnText: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
  },
  workoutStartBtn: {
    alignSelf: 'stretch' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 7,
    borderRadius: 16,
    paddingVertical: 13,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  workoutStartBtnText: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
    color: '#fff',
  },
  warmupSection: {
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  sectionGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 15,
    paddingBottom: 9,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sectionLabel: {
    fontSize: 15,
    fontFamily: 'PlayfairDisplay_700Bold',
  },
  optionalBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  optionalText: {
    fontSize: 10,
    fontWeight: '600' as const,
  },
  warmupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: 1,
    gap: 12,
  },
  warmupInfo: {
    flex: 1,
    gap: 2,
  },
  warmupName: {
    fontSize: 18,
    fontFamily: 'Outfit_600SemiBold',
  },
  warmupDesc: {
    fontSize: 11,
    opacity: 0.55,
  },
  doneWarmupBtn: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 12,
    marginHorizontal: 14,
    marginVertical: 10,
    alignItems: 'center',
  },
  doneWarmupText: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  workoutCardioWrap: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  workoutSection: {
    borderRadius: 26,
    overflow: 'hidden',
    marginHorizontal: -12,
  },
  workoutSectionNoBottomRadius: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 6,
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
    letterSpacing: 0.5,
  },
  groupRest: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
  groupLinkRow: {
    alignItems: 'center',
    paddingVertical: 0,
    paddingLeft: 8,
  },
  groupLinkLine: {
    width: 2,
    height: 16,
    borderRadius: 1,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 11,
    gap: 6,
  },
  exerciseRowSeparator: {
    height: 1,
    marginLeft: 38,
  },
  exerciseInfo: {
    flex: 1,
    gap: 3,
  },
  exerciseName: {
    fontSize: 15,
    fontFamily: 'Outfit_500Medium',
  },
  exerciseNum: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
    minWidth: 16,
    textAlign: 'right' as const,
  },
  exerciseMeta: {
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
  },
  exerciseLast: {
    fontSize: 10,
    flex: 1,
    opacity: 0.55,
  },
  exerciseLastRestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  exerciseRestLabel: {
    fontSize: 10,
    opacity: 0.55,
  },
  rpeText: {
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 1,
    opacity: 0.55,
  },
  breathCue: {
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 2,
    opacity: 0.55,
  },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  trackBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  gripDots: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  dragGhost: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 1000,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
    opacity: 0.95,
    transform: [{ scale: 1.03 as number }],
  },
  dragGhostRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingVertical: 3,
  },
  dragGhostName: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
    flex: 1,
  },
  dropIndicator: {
    height: 2,
    borderRadius: 1,
    marginHorizontal: 10,
    marginVertical: 1,
  },
  trackPanel: {
    paddingHorizontal: 0,
    paddingVertical: 8,
    borderTopWidth: 0,
    gap: 6,
  },
  trackSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 3,
  },
  trackSetLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    width: 42,
  },
  trackSetValue: {
    fontSize: 12,
  },
  trackDoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  trackDoneBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  doneCheckbox: {
    width: 31,
    height: 31,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cfSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 6,
  },
  cfSectionLabel: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
    letterSpacing: 0,
    flexShrink: 1,
  },
  wodChip: {
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  wodChipText: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
  },
  hyroxRunDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    gap: 9,
    overflow: 'hidden',
  },
  hyroxRunText: {
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.5,
  },
  hyroxRunTarget: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
  },
  hyroxRunLeg: {
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.3,
    opacity: 0.55,
  },
  hiitCircuitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 6,
  },
  hiitCircuitLabel: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.3,
  },
  hiitTimeEst: {
    fontSize: 12,
  },
  cardioBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 8,
  },
  cardioBlockLabel: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.5,
  },
  cardioFormatBadge: {
    fontSize: 12,
  },
  phaseHeader: {
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 4,
  },
  phaseLabel: {
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.8,
  },
  addMenu: {
    position: 'absolute',
    top: 28,
    right: 0,
    width: 170,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 100,
  },
  addMenuUp: {
    position: 'absolute',
    bottom: 54,
    left: 0,
    width: 178,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.30,
    shadowRadius: 14,
    elevation: 12,
    zIndex: 100,
    overflow: 'hidden',
  },
  addMenuSurface: {
    ...StyleSheet.absoluteFillObject,
  },
  addBtnWrap: {
    position: 'relative',
  },
  addBtnSquare: {
    width: 50,
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  completeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  addMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  addMenuText: {
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
    letterSpacing: 0.1,
  },
  cardioSection: {
    overflow: 'hidden',
    position: 'relative',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  cardioStandaloneCard: {
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
  },
  cardioStandaloneHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  cardioStandaloneIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  cardioStandaloneLabel: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
  },
  cardioFormat: {
    fontSize: 12,
  },
  cardioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: 1,
    gap: 12,
  },
  cardioInfo: {
    flex: 1,
    gap: 3,
  },
  cardioName: {
    fontSize: 18,
    fontFamily: 'Outfit_600SemiBold',
  },
  cardioMeta: {
    fontSize: 11,
    opacity: 0.55,
  },
  cardioNotes: {
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 1,
    opacity: 0.55,
  },
  cooldownSection: {
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  recoverySection: {
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  recoveryItem: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: 1,
    gap: 2,
  },
  recoveryName: {
    fontSize: 18,
    fontFamily: 'Outfit_600SemiBold',
  },
  recoveryDesc: {
    fontSize: 11,
    opacity: 0.55,
  },
  tabPanel: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  tabHeaderCard: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  tabContentOuter: {
    marginTop: 2,
  },
  tabBarOuter: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    height: 50,
    padding: 4,
    marginHorizontal: 10,
    marginTop: 10,
    marginBottom: 6,
    position: 'relative' as const,
    overflow: 'hidden' as const,
    backgroundColor: 'rgba(20,20,20,0.98)',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tabIndicator: {
    position: 'absolute' as const,
    top: 6,
    bottom: 6,
    left: 4,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  tabBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 5,
    height: 48,
    zIndex: 1,
  },
  tabLabel: {
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.1,
    includeFontPadding: false,
  },
  tabContent: {
    paddingHorizontal: 12,
    paddingBottom: 0,
    paddingTop: 2,
    gap: 8,
  },
  tabCompleteWrap: {
    marginTop: 4,
  },
  emptyPanelCard: {
    alignItems: 'center' as const,
    paddingVertical: 36,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyPanelIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 4,
  },
  emptyPanelTitle: {
    fontSize: 16,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: -0.2,
  },
  emptyPanelSub: {
    fontSize: 13,
    textAlign: 'center' as const,
    lineHeight: 19,
    opacity: 0.7,
  },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 4,
    flex: 1,
  },
  completeBtnText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
  regenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 14,
  },
  regenBtnText: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  shuffleBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: 'transparent',
  },
  shuffleBtnText: {
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.2,
  },
  addBtnFull: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 9,
    width: '100%' as const,
  },
  addBtnFullText: {
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
  },
  checklistCard: {
    borderRadius: 14,
    overflow: 'hidden' as const,
    borderWidth: 1,
    // Tab content uses inner horizontal padding; this cancels it so cards
    // line up with the tab header width.
    marginHorizontal: -12,
  },
  checklistSectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.1)',
  },
  checklistSectionIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  checklistSectionLabel: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.1,
  },
  checklistProgressPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  checklistProgressText: {
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
  },
  checklistProgressPillDone: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#22c55e',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  checklistRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 11,
  },
  checklistCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  checklistRowInfo: {
    flex: 1,
    gap: 2,
  },
  checklistRowName: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
  },
  checklistRowDesc: {
    fontSize: 12,
  },
  avatarBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  wordmarkRow: {
    flex: 1,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '400' as const,
  },
  recoverySubCard: {
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  recoverySubCardInner: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 12,
    gap: 6,
  },
  recoverySubCardRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  recoveryBenefit: {
    fontSize: 13,
    color: '#ef4444',
    fontWeight: '500' as const,
  },
  infoBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  infoSheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 22,
    paddingBottom: 44,
    gap: 14,
  },
  infoHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 2,
  },
  infoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoTitle: {
    fontSize: 19,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.3,
  },
  infoBody: {
    fontSize: 15,
    lineHeight: 23,
  },
  infoDismiss: {
    borderRadius: 13,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  infoDismissText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
  },
  trackPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 12,
  },
  trackPanelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trackPanelDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  trackPanelLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.9,
  },
  trackLastLabel: {
    fontSize: 11,
  },
  trackTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 4,
    marginBottom: 2,
  },
  trackTableCol: {
    fontSize: 13,
    fontWeight: '700' as const,
    letterSpacing: 0.4,
    textAlign: 'center' as const,
  },
  trackSetNumCol: {
    width: 32,
    textAlign: 'center',
  },
  trackWeightCol: {
    flex: 1,
    marginLeft: 8,
  },
  trackRepsCol: {
    width: 60,
    marginLeft: 8,
  },
  trackDoneCol: {
    width: 70,
  },
  trackInputWrap: {
    flex: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginLeft: 8,
  },
  trackRepsInput: {
    flex: 0,
    width: 60,
  },
  trackInputText: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
  trackDoneLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  trackDoneLinkText: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  trackActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 0,
  },
  logSetsCard: {
    borderRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 0,
  },
  logSetsGuideBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    flex: 1,
  },
  logSetsGuideBtnText: {
    fontSize: 11,
    fontWeight: '500' as const,
    letterSpacing: 0.2,
  },
  trackAddSet: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  trackResultRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  trackResultField: {
    flex: 1,
    gap: 4,
  },
  trackFieldLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
  },
  trackInputWrapLarge: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  trackInputTextLg: {
    fontSize: 16,
    fontFamily: 'Outfit_600SemiBold',
  },
  trackSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
    alignSelf: 'flex-end',
    paddingHorizontal: 20,
  },
  trackRemoveSpacer: {
    width: 32,
  },
  trackRemoveBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  trackWheelLabelW: {
    width: 96,
    textAlign: 'center' as const,
  },
  trackWheelLabelR: {
    width: 60,
    textAlign: 'center' as const,
  },
  trackDoneColSpacer: {
    width: 38,
  },
  trackValueChip: {
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  trackValueChipText: {
    fontSize: 24,
    fontFamily: 'Outfit_700Bold',
  },
  trackSetDoneBtn: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderRadius: 16,
    width: 32,
    height: 32,
  },
  exerciseInfoBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start' as const,
    marginBottom: 2,
  },
  exerciseInfoBtnText: {
    fontSize: 11,
    fontWeight: '500' as const,
    letterSpacing: 0.2,
  },
  exInfoIconBtn: {
    paddingTop: 3,
    paddingRight: 2,
  },
  trackPanelDivider: {
    width: 1,
    height: 11,
    marginHorizontal: 2,
  },
  exerciseGuideBtnInline: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  exerciseGuideBtnInlineText: {
    fontSize: 11,
    fontWeight: '500' as const,
    letterSpacing: 0.2,
  },
  gripReorderCol: {
    alignItems: 'center',
    gap: 2,
    paddingLeft: 2,
  },
  gripArrowBtn: {
    padding: 2,
  },
  sectionInfoBtn: {
    padding: 4,
  },
  warmupPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 8,
    overflow: 'hidden',
  },
  warmupPillText: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
  },
  warmupPillCount: {
    fontSize: 12,
  },
  warmupPillCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(34,197,94,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  warmupModalSheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 22,
    paddingBottom: 44,
    maxHeight: '80%',
  },
  warmupModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  warmupModalScroll: {
    maxHeight: 400,
  },
  warmupModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  warmupModalCheckbox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warmupModalItemInfo: {
    flex: 1,
    gap: 2,
  },
  warmupModalItemName: {
    fontSize: 16,
    fontFamily: 'Outfit_600SemiBold',
  },
  warmupModalItemDesc: {
    fontSize: 12,
  },
  warmupModalDoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 13,
    paddingVertical: 15,
    marginTop: 16,
  },
  warmupModalDoneBtnText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
  },
  compactMovementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomWidth: 1,
    gap: 8,
  },
  compactMovementText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
  },
  richDetailSheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: '88%' as any,
  },
  richDetailHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.1)' as any,
  },
  richDetailIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  richDetailTypeLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 1,
    marginBottom: 1,
  },
  richDetailTitleText: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.3,
  },
  richDetailXBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  richDetailScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 48,
    gap: 10,
  },
  richDetailDesc: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 4,
  },
  richDetailSectionRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginTop: 6,
  },
  richDetailSectionLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1,
  },
  richDetailBox: {
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  richDetailBoxText: {
    fontSize: 13,
    lineHeight: 20,
  },
  richDetailStepRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 10,
  },
  richDetailStepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: 1,
    flexShrink: 0,
  },
  richDetailStepNumText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700' as const,
  },
  richDetailStepText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
  coreFinisherCard: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden' as const,
  },
  coreFinisherHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(34,197,94,0.12)',
  },
  coreFinisherIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  coreFinisherLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 1,
    fontFamily: 'Outfit_700Bold',
    textTransform: 'uppercase' as const,
  },
  coreFinisherAIBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.28)',
  },
  coreFinisherAIBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.6,
    color: '#22c55e',
    fontFamily: 'Outfit_700Bold',
  },
  coreStyleBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  coreStyleBannerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  coreStyleBannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
});

const hardStyles = StyleSheet.create({
  mentalHeader: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    alignItems: 'center' as const,
  },
  mentalText: {
    fontSize: 10,
    fontWeight: '800' as const,
    letterSpacing: 2.5,
  },
  sessionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 4,
    borderRadius: 8,
    marginHorizontal: 10,
  },
  sessionLabel: {
    fontSize: 14,
    fontWeight: '800' as const,
    letterSpacing: 1.2,
  },
  sessionMeta: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
});
