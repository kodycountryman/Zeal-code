__DEV__ && console.log('[ExerciseDatabase] Module evaluated — exercise schema will load lazily on first access');

// ============================================================
// ENUM TYPES — match _enum_definitions in exerciseSchema.json
// ============================================================

export type MovementPatternV2 =
  | 'push' | 'pull' | 'hinge' | 'squat' | 'lunge' | 'carry'
  | 'rotation' | 'isolation' | 'plyometric' | 'cardio' | 'mobility' | 'pilates';

export type DifficultyTier = 'beginner' | 'intermediate' | 'advanced';

export type Position =
  | 'standing' | 'seated' | 'supine' | 'prone' | 'incline'
  | 'decline' | 'hanging' | 'kneeling' | 'quadruped' | 'side_lying';

export type RomRequirement = 'full' | 'moderate' | 'minimal';

export type SpinalLoad = 'none' | 'light' | 'moderate' | 'heavy';

export type EligibleStyle =
  | 'strength' | 'bodybuilding' | 'crossfit' | 'hyrox'
  | 'mobility' | 'hiit' | 'pilates' | 'low_impact'
  | 'hybrid';

export type MuscleGroup =
  | 'chest' | 'upper_chest' | 'lower_chest'
  | 'front_delt' | 'side_delt' | 'rear_delt'
  | 'lats' | 'upper_back' | 'lower_back' | 'traps' | 'rhomboids'
  | 'biceps' | 'triceps' | 'forearms'
  | 'quads' | 'hamstrings' | 'glutes' | 'hip_flexors'
  | 'adductors' | 'abductors' | 'calves'
  | 'core' | 'obliques' | 'transverse_abdominis' | 'pelvic_floor' | 'neck';

export type EquipmentId =
  | 'barbell' | 'dumbbell' | 'kettlebell' | 'ez_curl_bar'
  | 'flat_bench' | 'adjustable_bench' | 'squat_rack' | 'power_rack'
  | 'smith_machine' | 'cable_machine' | 'lat_pulldown_machine'
  | 'leg_press_machine' | 'leg_curl_machine' | 'leg_extension_machine'
  | 'pec_deck_machine' | 'chest_press_machine' | 'shoulder_press_machine'
  | 'seated_row_machine' | 'hack_squat_machine' | 'pull_up_bar'
  | 'dip_station' | 'roman_chair' | 'resistance_bands' | 'trx_suspension'
  | 'bosu_ball' | 'stability_ball' | 'ab_wheel' | 'foam_roller' | 'jump_rope'
  | 'battle_ropes' | 'sled' | 'rowing_machine' | 'assault_bike' | 'ski_erg'
  | 'treadmill' | 'stationary_bike' | 'elliptical' | 'plyo_box'
  | 'medicine_ball' | 'slam_ball' | 'pilates_mat' | 'pilates_ring'
  | 'pilates_reformer' | 'bodyweight' | 'lateral_raise_machine'
  | 'weight_plates' | 'trap_bar' | 'belt_squat' | 'landmine';

export type ContraindicationTag =
  | 'pregnancy_t1' | 'pregnancy_t2' | 'pregnancy_t3'
  | 'shoulder_injury' | 'shoulder_impingement' | 'overhead_restricted'
  | 'knee_injury' | 'acl_tear' | 'ankle_injury'
  | 'lower_back_injury' | 'herniated_disc'
  | 'wrist_injury' | 'carpal_tunnel'
  | 'hip_injury' | 'hip_replacement'
  | 'neck_injury' | 'high_blood_pressure'
  | 'diastasis_recti' | 'pelvic_floor_dysfunction' | 'elbow_injury';

// ============================================================
// NEW v1.5 TYPES — tracking, execution, Rx weights, popularity
// ============================================================

export type TrackingMetric = 'reps' | 'distance_meters' | 'calories' | 'time_seconds' | 'max_weight';
export type ExecutionLogic = 'bilateral' | 'alternating' | 'per_side';

export interface StandardRxWeight {
  male_rx_lbs: number;
  female_rx_lbs: number;
  male_scaled_lbs: number;
  female_scaled_lbs: number;
  male_pro_lbs: number;
  female_pro_lbs: number;
}

// ============================================================
// LOAD TABLE
// ============================================================

export interface LoadEntry {
  multiplier: number;
  absolute_fallback_lbs: number;
}

export interface DefaultLoadTable {
  male_beginner: LoadEntry;
  male_intermediate: LoadEntry;
  male_advanced: LoadEntry;
  female_beginner: LoadEntry;
  female_intermediate: LoadEntry;
  female_advanced: LoadEntry;
}

// ============================================================
// ZEAL EXERCISE — canonical schema v1.5 (35 fields, all required)
// ============================================================

export interface ZealExercise {
  id: string;
  name: string;
  aliases: string[];
  movement_pattern: MovementPatternV2;
  difficulty_tier: DifficultyTier;
  eligible_styles: EligibleStyle[];
  primary_muscles: MuscleGroup[];
  secondary_muscles: MuscleGroup[];
  joints_loaded: string[];
  equipment_required: EquipmentId[];
  equipment_optional: EquipmentId[];
  is_unilateral: boolean;
  is_compound: boolean;
  default_tempo_seconds_per_rep: number;
  setup_time_seconds: number;
  contraindication_tags: ContraindicationTag[];
  rom_requirement: RomRequirement;
  spinal_load: SpinalLoad;
  position: Position;
  weight_increment: number;
  rep_range_floor: number;
  rep_range_ceiling: number;
  default_load_table: DefaultLoadTable;
  is_warmup_eligible: boolean;
  is_cooldown_eligible: boolean;
  warmup_for_muscles: MuscleGroup[];
  cooldown_for_muscles: MuscleGroup[];
  substitutes: string[];
  variation_family: string;
  // v1.5 fields
  style_popularity: Partial<Record<EligibleStyle, number>>;
  tracking_metric: { primary: TrackingMetric; alternates: TrackingMetric[] };
  execution_logic: ExecutionLogic;
  default_rest_sec: number;
  standard_rx_weight: StandardRxWeight | null;
  media_url: string;
}

// ============================================================
// LAZY DATABASE — schema is require()'d on first access only
// This prevents the 12k-line JSON from being parsed at app startup
// which caused "Maximum call stack size exceeded" in Hermes/Expo Go.
// ============================================================

let _zealDb: ZealExercise[] | null = null;
let _legacyDb: Exercise[] | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _enumDefs: any = null;

function _ensureDb() {
  if (_zealDb !== null) return;
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any
  const rawSchema = require('./exerciseSchema.json') as any;
  _zealDb = rawSchema.exercises as ZealExercise[];
  _enumDefs = rawSchema._enum_definitions;
  _legacyDb = _zealDb.map(zealToLegacy);
  __DEV__ && console.log(`[ExerciseDatabase] Lazy-loaded ${_zealDb.length} exercises from schema v1.5`);
  __DEV__ && console.log(`[ExerciseDatabase] Legacy EXERCISE_DATABASE mapped: ${_legacyDb.length} exercises`);
}

export function getZealExerciseDatabase(): ZealExercise[] {
  _ensureDb();
  return _zealDb!;
}

export function getExerciseDatabase(): Exercise[] {
  _ensureDb();
  return _legacyDb!;
}

export function getEnumMuscleGroups(): MuscleGroup[] { _ensureDb(); return _enumDefs.muscle_groups as MuscleGroup[]; }
export function getEnumEquipmentIds(): EquipmentId[] { _ensureDb(); return _enumDefs.equipment_ids as EquipmentId[]; }
export function getEnumEligibleStyles(): EligibleStyle[] { _ensureDb(); return _enumDefs.eligible_styles as EligibleStyle[]; }
export function getEnumContraindicationTags(): ContraindicationTag[] { _ensureDb(); return _enumDefs.contraindication_tags as ContraindicationTag[]; }
export function getEnumMovementPatterns(): MovementPatternV2[] { _ensureDb(); return _enumDefs.movement_pattern as MovementPatternV2[]; }
export function getEnumDifficultyTiers(): DifficultyTier[] { _ensureDb(); return _enumDefs.difficulty_tier as DifficultyTier[]; }

// Legacy const aliases — kept for any direct references outside the main engine
/** @deprecated use getZealExerciseDatabase() */
export const ZEAL_EXERCISE_DATABASE: ZealExercise[] = [] as unknown as ZealExercise[] & { _lazy: true };
/** @deprecated use getExerciseDatabase() */
export const EXERCISE_DATABASE: Exercise[] = [] as unknown as Exercise[] & { _lazy: true };
export const ENUM_MUSCLE_GROUPS: MuscleGroup[] = [];
export const ENUM_EQUIPMENT_IDS: EquipmentId[] = [];
export const ENUM_ELIGIBLE_STYLES: EligibleStyle[] = [];
export const ENUM_CONTRAINDICATION_TAGS: ContraindicationTag[] = [];
export const ENUM_MOVEMENT_PATTERNS: MovementPatternV2[] = [];
export const ENUM_DIFFICULTY_TIERS: DifficultyTier[] = [];

// ============================================================
// LEGACY TYPES — backward-compat with workout engine (Phase 1)
// These will be retired in Phase 2 when the engine is updated.
// ============================================================

export type MovementType = 'heavyCompound' | 'moderateCompound' | 'isolation' | 'circuit';
export type MovementPattern = 'squat' | 'hinge' | 'push' | 'pull' | 'lunge' | 'carry' | 'core' | 'conditioning';

export interface Exercise {
  id: string;
  name: string;
  movementType: MovementType;
  movementPattern: MovementPattern;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string[];
  description: string;
  setup: string;
  steps: string[];
  styles: string[];
  contraindications?: string[];
  genderNote?: string;
}

// ============================================================
// MAPPING HELPERS (ZealExercise → legacy Exercise)
// ============================================================

const MUSCLE_DISPLAY_MAP: Record<string, string> = {
  chest: 'Chest',
  upper_chest: 'Chest',
  lower_chest: 'Chest',
  front_delt: 'Shoulders',
  side_delt: 'Shoulders',
  rear_delt: 'Rear Delts',
  lats: 'Lats',
  upper_back: 'Back',
  lower_back: 'Lower Back',
  traps: 'Traps',
  rhomboids: 'Back',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  hip_flexors: 'Hip Flexors',
  adductors: 'Adductors',
  abductors: 'Abductors',
  calves: 'Calves',
  core: 'Core',
  obliques: 'Obliques',
  transverse_abdominis: 'Core',
  pelvic_floor: 'Core',
  neck: 'Neck',
};

const STYLE_DISPLAY_MAP: Record<string, string> = {
  strength: 'Strength',
  bodybuilding: 'Bodybuilding',
  crossfit: 'CrossFit',
  hyrox: 'Hyrox',
  hiit: 'HIIT',
  mobility: 'Mobility',
  pilates: 'Pilates',
  low_impact: 'Low-Impact',
};

const EQUIPMENT_LEGACY_MAP: Record<string, string> = {
  barbell: 'olympic_bar_45',
  dumbbell: 'db_fixed_set',
  kettlebell: 'kb_16kg',
  ez_curl_bar: 'ez_bar',
  flat_bench: 'flat_bench',
  adjustable_bench: 'adjustable_bench',
  squat_rack: 'squat_rack',
  power_rack: 'power_rack',
  smith_machine: 'smith_machine',
  cable_machine: 'cable_crossover',
  lat_pulldown_machine: 'lat_pulldown',
  leg_press_machine: 'leg_press',
  leg_curl_machine: 'lying_leg_curl',
  leg_extension_machine: 'leg_extension',
  pec_deck_machine: 'pec_deck',
  chest_press_machine: 'chest_press_machine',
  shoulder_press_machine: 'shoulder_press_machine',
  seated_row_machine: 'seated_row',
  hack_squat_machine: 'hack_squat',
  pull_up_bar: 'pullup_bar',
  dip_station: 'dip_bar',
  roman_chair: 'back_extension',
  resistance_bands: 'resistance_bands',
  trx_suspension: 'trx',
  ab_wheel: 'ab_wheel',
  foam_roller: 'foam_roller',
  jump_rope: 'jump_rope',
  battle_ropes: 'battle_ropes',
  sled: 'sled_push',
  rowing_machine: 'rowing_machine',
  assault_bike: 'assault_bike',
  ski_erg: 'ski_erg',
  treadmill: 'treadmill',
  stationary_bike: 'stationary_bike',
  elliptical: 'stationary_bike',
  plyo_box: 'plyo_box',
  medicine_ball: 'med_ball_10',
  slam_ball: 'slam_ball_20',
  pilates_mat: 'yoga_mat',
  pilates_ring: 'resistance_bands',
  pilates_reformer: 'resistance_bands',
  bodyweight: '',
  lateral_raise_machine: 'shoulder_press_machine',
  weight_plates: 'plate_45',
  trap_bar: 'trap_bar',
};

function mapMovementPattern(p: string): MovementPattern {
  switch (p) {
    case 'push': return 'push';
    case 'pull': return 'pull';
    case 'hinge': return 'hinge';
    case 'squat': return 'squat';
    case 'lunge': return 'lunge';
    case 'carry': return 'carry';
    case 'cardio':
    case 'plyometric': return 'conditioning';
    default: return 'core';
  }
}

function deriveMovementType(z: ZealExercise): MovementType {
  if (z.movement_pattern === 'cardio' || z.movement_pattern === 'plyometric') {
    return 'circuit';
  }
  if (z.is_compound && z.spinal_load === 'heavy') {
    return 'heavyCompound';
  }
  if (z.is_compound) {
    return 'moderateCompound';
  }
  return 'isolation';
}

function mapEquipmentToLegacy(equipmentRequired: string[]): string[] {
  const withoutBodyweight = equipmentRequired.filter(e => e !== 'bodyweight');
  if (withoutBodyweight.length === 0) {
    return [];
  }
  return withoutBodyweight
    .map(e => EQUIPMENT_LEGACY_MAP[e] ?? e)
    .filter(e => e !== '');
}

function mapMuscles(muscles: string[]): string[] {
  return [...new Set(muscles.map(m => MUSCLE_DISPLAY_MAP[m] ?? m))];
}

function zealToLegacy(z: ZealExercise): Exercise {
  const primaryDisplay = mapMuscles(z.primary_muscles);
  return {
    id: z.id,
    name: z.name,
    movementType: deriveMovementType(z),
    movementPattern: mapMovementPattern(z.movement_pattern),
    primaryMuscles: primaryDisplay,
    secondaryMuscles: mapMuscles(z.secondary_muscles),
    equipment: mapEquipmentToLegacy(z.equipment_required),
    description: z.name,
    setup: '',
    steps: [],
    styles: z.eligible_styles.map(s => STYLE_DISPLAY_MAP[s] ?? s),
    contraindications: z.contraindication_tags,
  };
}



// ============================================================
// LEGACY AUXILIARY EXPORTS (unchanged — not part of exercise data)
// ============================================================

export const WARMUP_EXERCISES = [
  { name: "World's Greatest Stretch", description: '5 reps each side, slow lunge with thoracic twist.', swappable: true },
  { name: 'Cat-Cow Stretch', description: 'On all fours, 10 slow reps alternating arch and round.', swappable: true },
  { name: 'Dynamic Leg Swing', description: '12 reps each leg — forward/back then side to side.', swappable: true },
  { name: 'Hip Circles', description: 'Hands on hips, draw large controlled circles. 10 each direction.', swappable: true },
  { name: 'Inchworm', description: '6-8 reps — walk hands to plank, walk feet to hands. Slow.', swappable: true },
  { name: 'Arm Circles', description: 'Small to large circles, 10 each direction, controlled.', swappable: true },
  { name: 'Thoracic Spine Rotation', description: '8-10 reps each side, seated or kneeling, controlled rotation.', swappable: true },
  { name: 'Ankle Circles', description: '10 slow circles each direction per foot.', swappable: true },
  { name: 'Downward Dog', description: 'Hold 30-45 seconds, pedal feet to open calves and hamstrings.', swappable: true },
  { name: '90/90 Hip Stretch', description: 'Hold 30-45 seconds each side, breathe into the stretch.', swappable: true },
  { name: 'Shoulder Pass-Through', description: 'Use a band or stick — 10-15 reps, slow controlled arc.', swappable: true },
  { name: 'Forward Leg Swings', description: '12-15 reps per leg, controlled arc through full hip range.', swappable: true },
];

export const COOLDOWN_EXERCISES = [
  { name: 'Standing Quad Stretch', description: 'Hold each leg for 30 seconds. Deep breath each hold.' },
  { name: 'Seated Forward Fold', description: 'Sit with legs straight, reach for toes. Hold 45 seconds.' },
  { name: "Child's Pose", description: 'Kneel and reach arms forward on the floor. Hold 60 seconds.' },
  { name: 'Pigeon Stretch', description: 'Deep hip opener. Hold 45 seconds each side.' },
  { name: '90/90 Hip Stretch', description: 'Sit in 90/90 position, lean forward gently. 30 seconds each side.' },
  { name: 'Cross-Body Shoulder Stretch', description: 'Pull arm across chest. Hold 30 seconds each side.' },
  { name: 'Lying Spinal Twist', description: 'Lie on back, drop knees to each side. 30 seconds each.' },
  { name: 'Doorway Chest Stretch', description: 'Place forearm on door frame, lean through. 30 seconds each side.' },
];

export const RECOVERY_ITEMS = [
  // High-intensity recovery (CrossFit, HIIT, Hybrid, Hyrox)
  { name: 'Contrast Shower', description: 'Alternate between 1 minute cold and 2 minutes hot water for 10 minutes total.', benefit: 'Improves circulation and reduces muscle soreness.', intensity: 'high' as const },
  { name: 'Cold Water Immersion', description: 'Submerge legs in cold water (50–60°F) for 10–15 minutes post-session.', benefit: 'Rapidly reduces exercise-induced inflammation and muscle soreness.', intensity: 'high' as const },
  { name: 'Foam Rolling', description: 'Spend 2–3 minutes per muscle group rolling slowly over tight areas.', benefit: 'Breaks up adhesions and improves tissue quality.', intensity: 'high' as const },
  { name: 'BCAA or Protein Shake', description: 'Consume 25–40g protein or a BCAA drink immediately after training.', benefit: 'Supports muscle protein synthesis and reduces muscle breakdown.', intensity: 'high' as const },
  // Medium-intensity recovery (Strength, Bodybuilding, Cardio)
  { name: 'Protein Within 30min', description: 'Consume 30–50g protein within 30 minutes of finishing training.', benefit: 'Maximizes the muscle protein synthesis window.', intensity: 'medium' as const },
  { name: 'Foam Rolling', description: 'Spend 2–3 minutes per muscle group rolling slowly over tight areas.', benefit: 'Breaks up adhesions and improves tissue quality.', intensity: 'medium' as const },
  { name: 'Epsom Salt Bath', description: 'Soak for 15–20 minutes in warm water with 2 cups of Epsom salt.', benefit: 'Reduces inflammation and muscle soreness via magnesium absorption.', intensity: 'medium' as const },
  { name: 'Hydration', description: 'Drink 16–32oz of water within 30 minutes of finishing your workout.', benefit: 'Restores fluid balance and accelerates metabolic waste clearance.', intensity: 'medium' as const },
  // Low-intensity recovery (Mobility, Pilates, Low-Impact)
  { name: 'Sleep 7–9 Hours', description: 'Prioritize a consistent sleep schedule for optimal recovery.', benefit: 'Growth hormone peaks during deep sleep cycles.', intensity: 'low' as const },
  { name: 'Magnesium Supplement', description: 'Take 400–800mg magnesium glycinate before bed.', benefit: 'Supports muscle relaxation, recovery, and sleep quality.', intensity: 'low' as const },
  { name: 'Walk 10 Minutes', description: 'Light walking post-session to aid active recovery.', benefit: 'Promotes gentle blood flow and helps clear lactate.', intensity: 'low' as const },
  // Any intensity
  { name: 'Stretching Session', description: 'Spend 10 minutes on static stretches targeting the muscles worked today.', benefit: 'Improves flexibility and promotes blood flow to recovering tissue.', intensity: 'any' as const },
  { name: 'Sleep 7–9 Hours', description: 'Prioritize a consistent sleep schedule for optimal recovery.', benefit: 'Growth hormone peaks during deep sleep cycles.', intensity: 'any' as const },
  { name: 'Hydration', description: 'Drink 16–32oz of water within 30 minutes of finishing your workout.', benefit: 'Restores fluid balance and accelerates metabolic waste clearance.', intensity: 'any' as const },
];


