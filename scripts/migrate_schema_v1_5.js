#!/usr/bin/env node
/**
 * Migration script: exerciseSchema.json v1.4 → v1.5
 * Adds 6 new fields to all exercises:
 *   style_popularity, tracking_metric, execution_logic,
 *   default_rest_sec, standard_rx_weight, media_url
 */

const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'mocks', 'exerciseSchema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

// ── Old global popularity scores (from engineConstants.ts) ──────────────
const GLOBAL_SCORES = {
  barbell_back_squat: 50, conventional_deadlift: 50, barbell_bench_press: 50,
  pull_up: 50, standing_overhead_press: 50, romanian_deadlift: 50,
  barbell_bent_over_row: 50, dumbbell_bench_press: 50, lat_pulldown: 50,
  hip_thrust: 50, leg_press: 50, dumbbell_curl: 50, hammer_curl: 50,
  cable_tricep_pushdown: 50, dumbbell_lateral_raise: 50, face_pull: 50,
  skull_crusher: 50, dumbbell_row: 50, push_up: 50, plank: 50,
  walking_lunge: 50, farmers_carry: 50, treadmill_run: 50,
  rowing_machine_intervals: 50, assault_bike_intervals: 50,
  cable_chest_fly: 50, ez_bar_curl: 50, incline_dumbbell_bench: 50,
  seated_dumbbell_shoulder_press: 50, cable_seated_row: 50,
  preacher_curl: 50, incline_barbell_bench: 50, cable_lateral_raise: 50,
  leg_extension: 50, leg_curl: 50, hack_squat: 50, seated_calf_raise: 50,
  chest_press_machine: 50, shoulder_press_machine: 50, cable_crossover: 50,
  pec_deck_fly: 50,
  front_squat: 30, goblet_squat: 30, bulgarian_split_squat: 30,
  sumo_deadlift: 30, trap_bar_deadlift: 30, dip: 30,
  close_grip_bench_press: 30, arnold_press: 30, t_bar_row: 30,
  cable_curl: 30, glute_bridge: 30, back_extension: 30,
  bodyweight_squat: 30, reverse_lunge: 30, step_up: 30,
  hanging_leg_raise: 30, ab_wheel_rollout: 30, russian_twist: 30,
  bicycle_crunch: 30, mountain_climber: 30, burpee: 30, jump_squat: 30,
  jump_rope_intervals: 30, side_plank: 30, dumbbell_rdl: 30,
  barbell_curl: 30, inverted_row: 30, standing_calf_raise: 30,
  battle_rope_slams: 30, dumbbell_squat: 30, skater_jump: 30,
  seated_row_machine: 30, smith_machine_squat: 30, cable_row: 30,
  lat_pulldown_wide: 30, leg_press_calf_raise: 30,
  single_leg_rdl: -30, suitcase_carry: -30, overhead_carry: -30,
  superman_hold: -30, copenhagen_plank: -30, pistol_squat: -30,
  muscle_up: -30, hollow_body_hold: -30, broad_jump: -30,
  lunge_jump: -30, bear_crawl: -30, cable_woodchop: -30,
  power_clean: -50, hang_clean: -50, clean_and_jerk: -50,
  kettlebell_swing: -50, kettlebell_windmill: -50,
  dumbbell_power_clean: -50, dumbbell_clean_and_press: -50,
  sled_pull: -50, sled_push: -50, bird_dog: -50,
  handstand_push_up: -50, kegel_exercise: -50, tuck_jump: -50,
  box_jump: 0,
};

// ── Per-style popular exercise lists (from engineConstants.ts) ──────────
const POPULAR_BY_STYLE = {
  strength: ['barbell_back_squat','conventional_deadlift','barbell_bench_press','standing_overhead_press','pull_up','barbell_bent_over_row','romanian_deadlift','front_squat','trap_bar_deadlift','sumo_deadlift','hip_thrust','close_grip_bench_press','incline_barbell_bench','dumbbell_bench_press','lat_pulldown','seated_dumbbell_shoulder_press','incline_dumbbell_bench','cable_chest_fly','pec_deck_fly','cable_crossover','dumbbell_lateral_raise','cable_lateral_raise','face_pull','cable_tricep_pushdown','skull_crusher','dumbbell_curl','hammer_curl','ez_bar_curl','dumbbell_row','leg_press','cable_seated_row','preacher_curl'],
  bodybuilding: ['incline_dumbbell_bench','cable_chest_fly','pec_deck_fly','cable_crossover','dumbbell_lateral_raise','cable_lateral_raise','face_pull','cable_tricep_pushdown','skull_crusher','dumbbell_curl','hammer_curl','ez_bar_curl','dumbbell_row','lat_pulldown','hip_thrust','leg_press','romanian_deadlift','cable_seated_row','preacher_curl','incline_barbell_bench','barbell_back_squat','conventional_deadlift','barbell_bench_press','standing_overhead_press','pull_up','barbell_bent_over_row','front_squat','trap_bar_deadlift','sumo_deadlift','close_grip_bench_press','dumbbell_bench_press','seated_dumbbell_shoulder_press'],
  crossfit: ['barbell_back_squat','pull_up','push_up','burpee','kettlebell_swing','wall_ball','toes_to_bar','thruster','clean_and_jerk','box_jump','double_under','rowing_machine_intervals','power_clean','hang_clean','dumbbell_snatch','assault_bike_intervals','ring_dip','rope_climb'],
  hiit: ['burpee','mountain_climber','jump_squat','battle_rope_slams','high_knees','push_up','box_jump','skater_jump','plyo_push_up','bear_crawl','jump_rope_intervals','assault_bike_intervals','inchworm_to_push_up','broad_jump','lunge_jump','star_jump','speed_skater'],
  cardio: ['treadmill_run','rowing_machine_intervals','assault_bike_intervals','stationary_bike_intervals','jump_rope_intervals','stair_climber','elliptical_intervals','ski_erg_intervals'],
  pilates: ['pilates_hundred','pilates_roll_up','pilates_teaser','pilates_single_leg_stretch','pilates_swimming','pilates_bridge','pilates_criss_cross','pilates_double_leg_stretch','pilates_seal','pilates_saw','pilates_mermaid','pilates_side_leg_series','pilates_spine_stretch'],
  low_impact: ['leg_press','leg_extension','leg_curl','chest_press_machine','lat_pulldown','cable_seated_row','dumbbell_curl','cable_tricep_pushdown','dumbbell_lateral_raise','face_pull','hip_thrust','cable_chest_fly','seated_dumbbell_shoulder_press','dumbbell_row','hammer_curl','cable_lateral_raise','preacher_curl','incline_dumbbell_bench','pec_deck_fly','cable_crossover','push_up','plank','walking_lunge','dumbbell_bench_press','seated_calf_raise'],
  mobility: ['worlds_greatest_stretch','hip_90_90_stretch','downward_dog','pigeon_stretch','cat_cow','thoracic_spine_rotation','couch_stretch','childs_pose','seated_spinal_twist','hip_circles','leg_swings_forward','inchworm','foam_roll_quads','foam_roll_hamstrings','foam_roll_upper_back'],
};

// ── Explicit per-style overrides for exercises where global score is misleading ──
// These exercises had negative global scores ONLY because they were being penalized
// outside their home styles. In their home styles they should be popular.
const STYLE_POPULARITY_OVERRIDES = {
  // Olympic lifts: globally -50 but CrossFit staples
  power_clean:            { crossfit: 85, hybrid: 40 },
  hang_clean:             { crossfit: 80, hybrid: 35 },
  clean_and_jerk:         { crossfit: 90, hybrid: 50 },
  dumbbell_power_clean:   { crossfit: 60, hybrid: 30 },
  dumbbell_clean_and_press: { crossfit: 65, hybrid: 35 },
  // Kettlebell: globally -50 but popular in crossfit/hiit
  kettlebell_swing:       { crossfit: 80, hiit: 50, hyrox: 40, hybrid: 50 },
  kettlebell_windmill:    { crossfit: 20, mobility: 10 },
  // Sled: globally -50 but Hyrox/CrossFit staples
  sled_push:              { hyrox: 90, crossfit: 40, hybrid: 50 },
  sled_pull:              { hyrox: 85, crossfit: 35, hybrid: 45 },
  // Gymnastics: niche globally but CrossFit-specific
  muscle_up:              { crossfit: 60 },
  handstand_push_up:      { crossfit: 55 },
  pistol_squat:           { crossfit: 40 },
  // Bodyweight conditioning: globally -30 but popular in specific styles
  bear_crawl:             { hiit: 40, crossfit: 20 },
  hollow_body_hold:       { crossfit: 35, pilates: 30 },
  broad_jump:             { hiit: 45, crossfit: 30 },
  lunge_jump:             { hiit: 50, crossfit: 25 },
  tuck_jump:              { hiit: 30 },
  bird_dog:               { mobility: 40, pilates: 30, low_impact: 20 },
  superman_hold:          { mobility: 30, pilates: 20, low_impact: 15 },
  // Box jump: neutral globally but popular in crossfit/hiit
  box_jump:               { crossfit: 70, hiit: 65, hybrid: 40 },
  // Carries
  farmers_carry:          { strength: 50, crossfit: 50, hyrox: 60, hybrid: 55, low_impact: 20 },
  suitcase_carry:         { strength: 15, crossfit: 20, hybrid: 25 },
  overhead_carry:         { crossfit: 30, hybrid: 25 },
  // Core exercises with context-dependent popularity
  copenhagen_plank:       { strength: -10, crossfit: 5, hybrid: 10 },
  cable_woodchop:         { strength: 15, bodybuilding: 20, crossfit: 10, hybrid: 15 },
  kegel_exercise:         { pilates: 20, low_impact: 15 },
  // Single-leg RDL: niche globally but good for certain styles
  single_leg_rdl:         { strength: 10, bodybuilding: 15, hybrid: 20 },

  // ── Fine-tune staples that need per-style differentiation ──
  // Big barbell lifts: highest in strength, lower in others
  barbell_back_squat:     { strength: 95, bodybuilding: 75, crossfit: 65, hybrid: 80 },
  conventional_deadlift:  { strength: 95, bodybuilding: 70, crossfit: 50, hybrid: 80 },
  barbell_bench_press:    { strength: 90, bodybuilding: 80, crossfit: 30, hybrid: 60 },
  standing_overhead_press:{ strength: 85, bodybuilding: 65, crossfit: 45, hybrid: 65 },
  romanian_deadlift:      { strength: 80, bodybuilding: 85, crossfit: 30, hybrid: 65 },
  sumo_deadlift:          { strength: 70, bodybuilding: 50, hybrid: 55 },
  trap_bar_deadlift:      { strength: 75, bodybuilding: 55, hybrid: 65 },
  incline_barbell_bench:  { strength: 70, bodybuilding: 80, hybrid: 50 },
  close_grip_bench_press: { strength: 60, bodybuilding: 65, hybrid: 40 },
  front_squat:            { crossfit: 85, hybrid: 60 },
  // Dumbbells: more bodybuilding-focused
  incline_dumbbell_bench: { strength: 65, bodybuilding: 85, crossfit: 20, low_impact: 50, hybrid: 50 },
  dumbbell_bench_press:   { strength: 70, bodybuilding: 80, crossfit: 25, low_impact: 55, hybrid: 55 },
  dumbbell_lateral_raise: { strength: 50, bodybuilding: 90, low_impact: 60, hybrid: 40 },
  cable_lateral_raise:    { strength: 45, bodybuilding: 85, low_impact: 55, hybrid: 35 },
  dumbbell_curl:          { strength: 45, bodybuilding: 85, low_impact: 65, hybrid: 35 },
  hammer_curl:            { strength: 45, bodybuilding: 80, low_impact: 60, hybrid: 35 },
  ez_bar_curl:            { strength: 40, bodybuilding: 80, hybrid: 30 },
  preacher_curl:          { strength: 35, bodybuilding: 80, low_impact: 55, hybrid: 25 },
  skull_crusher:          { strength: 50, bodybuilding: 85, hybrid: 40 },
  cable_tricep_pushdown:  { strength: 45, bodybuilding: 85, low_impact: 65, hybrid: 35 },
  // Cable/machine: bodybuilding + low-impact focused
  cable_chest_fly:        { strength: 40, bodybuilding: 85, low_impact: 60, hybrid: 30 },
  cable_crossover:        { strength: 35, bodybuilding: 80, low_impact: 55, hybrid: 25 },
  pec_deck_fly:           { strength: 30, bodybuilding: 85, low_impact: 60, hybrid: 25 },
  cable_seated_row:       { strength: 55, bodybuilding: 75, low_impact: 65, hybrid: 45 },
  face_pull:              { strength: 60, bodybuilding: 75, low_impact: 60, hybrid: 50 },
  // Machines: low-impact + bodybuilding
  leg_press:              { strength: 55, bodybuilding: 75, low_impact: 85, hybrid: 45 },
  leg_extension:          { strength: 30, bodybuilding: 75, low_impact: 85, hybrid: 25 },
  leg_curl:               { strength: 30, bodybuilding: 75, low_impact: 85, hybrid: 25 },
  hack_squat:             { strength: 45, bodybuilding: 80, low_impact: 70, hybrid: 35 },
  chest_press_machine:    { strength: 25, bodybuilding: 65, low_impact: 85, hybrid: 20 },
  shoulder_press_machine: { strength: 30, bodybuilding: 65, low_impact: 80, hybrid: 25 },
  seated_calf_raise:      { strength: 30, bodybuilding: 70, low_impact: 75, hybrid: 20 },
  // Pull-up / rows: strength + crossfit
  pull_up:                { strength: 85, bodybuilding: 60, crossfit: 80, hiit: 30, hybrid: 70 },
  barbell_bent_over_row:  { strength: 80, bodybuilding: 70, crossfit: 30, hybrid: 60 },
  lat_pulldown:           { strength: 60, bodybuilding: 80, low_impact: 75, hybrid: 45 },
  dumbbell_row:           { strength: 65, bodybuilding: 80, low_impact: 60, hybrid: 50 },
  hip_thrust:             { strength: 70, bodybuilding: 80, low_impact: 65, hybrid: 55 },
  // Conditioning: HIIT + crossfit focused
  push_up:                { strength: 35, bodybuilding: 25, crossfit: 70, hiit: 75, hyrox: 55, pilates: 15, low_impact: 45, hybrid: 55 },
  plank:                  { strength: 20, bodybuilding: 15, crossfit: 25, hiit: 40, pilates: 55, mobility: 25, low_impact: 55, hyrox: 20, hybrid: 30 },
  burpee:                 { crossfit: 80, hiit: 90, hybrid: 50 },
  mountain_climber:       { hiit: 85, crossfit: 40, hybrid: 40 },
  jump_squat:             { hiit: 80, crossfit: 50, hybrid: 45 },
  // Cardio machines
  treadmill_run:          { cardio: 90, hiit: 50, hyrox: 75 },
  rowing_machine_intervals: { cardio: 85, hiit: 45, hyrox: 60, crossfit: 65 },
  assault_bike_intervals: { cardio: 80, hiit: 55, crossfit: 65, hyrox: 50 },
  jump_rope_intervals:    { cardio: 60, hiit: 65, crossfit: 55 },
  // Walking lunge: good everywhere but best in strength/hyrox
  walking_lunge:          { strength: 55, bodybuilding: 50, crossfit: 50, hyrox: 70, low_impact: 40, hybrid: 55 },
};

// ── Standard Rx weights for CrossFit / Hyrox competition standards ──────
const RX_WEIGHTS = {
  wall_ball:          { male_rx_lbs: 20, female_rx_lbs: 14, male_scaled_lbs: 14, female_scaled_lbs: 10, male_pro_lbs: 30, female_pro_lbs: 20 },
  thruster:           { male_rx_lbs: 95, female_rx_lbs: 65, male_scaled_lbs: 65, female_scaled_lbs: 45, male_pro_lbs: 135, female_pro_lbs: 95 },
  clean_and_jerk:     { male_rx_lbs: 135, female_rx_lbs: 95, male_scaled_lbs: 95, female_scaled_lbs: 65, male_pro_lbs: 185, female_pro_lbs: 135 },
  power_clean:        { male_rx_lbs: 135, female_rx_lbs: 95, male_scaled_lbs: 95, female_scaled_lbs: 65, male_pro_lbs: 185, female_pro_lbs: 135 },
  hang_clean:         { male_rx_lbs: 135, female_rx_lbs: 95, male_scaled_lbs: 95, female_scaled_lbs: 65, male_pro_lbs: 155, female_pro_lbs: 105 },
  push_up:            { male_rx_lbs: 0, female_rx_lbs: 0, male_scaled_lbs: 0, female_scaled_lbs: 0, male_pro_lbs: 0, female_pro_lbs: 0 },
  dumbbell_snatch:    { male_rx_lbs: 50, female_rx_lbs: 35, male_scaled_lbs: 35, female_scaled_lbs: 20, male_pro_lbs: 70, female_pro_lbs: 50 },
  kettlebell_swing:   { male_rx_lbs: 53, female_rx_lbs: 35, male_scaled_lbs: 35, female_scaled_lbs: 26, male_pro_lbs: 70, female_pro_lbs: 53 },
  sled_push:          { male_rx_lbs: 276, female_rx_lbs: 221, male_scaled_lbs: 221, female_scaled_lbs: 165, male_pro_lbs: 386, female_pro_lbs: 276 },
  sled_pull:          { male_rx_lbs: 276, female_rx_lbs: 221, male_scaled_lbs: 221, female_scaled_lbs: 165, male_pro_lbs: 386, female_pro_lbs: 276 },
  barbell_back_squat: { male_rx_lbs: 225, female_rx_lbs: 155, male_scaled_lbs: 155, female_scaled_lbs: 105, male_pro_lbs: 275, female_pro_lbs: 185 },
  conventional_deadlift: { male_rx_lbs: 225, female_rx_lbs: 155, male_scaled_lbs: 155, female_scaled_lbs: 105, male_pro_lbs: 315, female_pro_lbs: 225 },
  standing_overhead_press: { male_rx_lbs: 95, female_rx_lbs: 65, male_scaled_lbs: 65, female_scaled_lbs: 45, male_pro_lbs: 135, female_pro_lbs: 95 },
};
// push_up Rx = 0 means bodyweight standard, remove it
delete RX_WEIGHTS.push_up;

// ═══════════════════════════════════════════════════════════════════════
// DERIVATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

function deriveStylePopularity(ex) {
  // 1. Check for explicit overrides first (Olympic lifts, sleds, gymnastics, etc.)
  if (STYLE_POPULARITY_OVERRIDES[ex.id]) {
    const override = STYLE_POPULARITY_OVERRIDES[ex.id];
    const pop = {};
    for (const style of ex.eligible_styles) {
      if (override[style] !== undefined) {
        pop[style] = override[style];
      } else {
        // For styles not in the override, give a low default
        pop[style] = -10;
      }
    }
    return pop;
  }

  // 2. General algorithm
  const globalScore = GLOBAL_SCORES[ex.id] ?? 0;
  const pop = {};

  for (const style of ex.eligible_styles) {
    const isPopularInStyle = POPULAR_BY_STYLE[style]?.includes(ex.id);

    // Base from global score, scaled to -100..100
    let score;
    if (globalScore === 50) {
      // Most popular globally
      score = isPopularInStyle ? 85 : 55;
    } else if (globalScore === 30) {
      // Popular globally
      score = isPopularInStyle ? 70 : 40;
    } else if (globalScore === 0) {
      // Neutral
      score = isPopularInStyle ? 55 : 0;
    } else if (globalScore === -30) {
      // Unpopular globally
      score = isPopularInStyle ? 45 : -35;
    } else if (globalScore === -50) {
      // Really unpopular — shouldn't reach here (overrides catch most)
      score = isPopularInStyle ? 30 : -60;
    } else {
      // Any other score — linear scale
      score = Math.round(globalScore * 1.6);
      if (isPopularInStyle) score = Math.max(score + 30, 50);
    }

    pop[style] = Math.max(-100, Math.min(100, score));
  }
  return pop;
}

// IDs for exercises that are distance-based (running, walking, carrying)
const DISTANCE_EXERCISES = new Set([
  'treadmill_run', 'farmers_carry', 'suitcase_carry', 'overhead_carry',
  'bear_crawl', 'inchworm',
]);
// IDs for exercises that are calorie-based (erg machines)
const CALORIE_EXERCISES = new Set([
  'rowing_machine_intervals', 'assault_bike_intervals', 'ski_erg_intervals',
  'stationary_bike_intervals', 'elliptical_intervals',
]);

function deriveTrackingMetric(ex) {
  // Explicit distance-based exercises
  if (DISTANCE_EXERCISES.has(ex.id)) {
    return { primary: 'distance_meters', alternates: ['time_seconds', 'calories'] };
  }
  // Explicit calorie-based exercises (erg machines)
  if (CALORIE_EXERCISES.has(ex.id)) {
    return { primary: 'calories', alternates: ['distance_meters', 'time_seconds'] };
  }
  // Remaining cardio: default to calories
  if (ex.movement_pattern === 'cardio') {
    return { primary: 'calories', alternates: ['distance_meters', 'time_seconds'] };
  }
  // Time-based: mobility holds, foam rolling, stretches
  if (ex.movement_pattern === 'mobility') {
    return { primary: 'time_seconds', alternates: [] };
  }
  // Time-based: high tempo + low rep ceiling = hold/timed exercise
  if (ex.default_tempo_seconds_per_rep >= 30 && ex.rep_range_ceiling <= 3) {
    return { primary: 'time_seconds', alternates: [] };
  }
  // Carries that aren't in the explicit set — check by pattern
  if (ex.movement_pattern === 'carry') {
    return { primary: 'distance_meters', alternates: ['time_seconds'] };
  }
  return { primary: 'reps', alternates: [] };
}

function deriveExecutionLogic(ex) {
  if (!ex.is_unilateral) return 'bilateral';
  const name = ex.name.toLowerCase();
  const id = ex.id.toLowerCase();
  // Walking/alternating movements
  if (name.includes('alternating') || name.includes('walking') ||
      id.includes('walking') || id.includes('alternating') ||
      name.includes('lunge jump') || name.includes('skater')) {
    return 'alternating';
  }
  return 'per_side';
}

function deriveDefaultRestSec(ex) {
  // Mobility / pilates: minimal rest, flow-based
  if (ex.movement_pattern === 'mobility') return 15;
  if (ex.movement_pattern === 'pilates') return 20;
  // Cardio: moderate rest between intervals
  if (ex.movement_pattern === 'cardio') return 60;
  // Core-focused isolation
  if (ex.primary_muscles.includes('core') && !ex.is_compound) return 45;
  // Plyometric / bodyweight conditioning
  if (ex.movement_pattern === 'plyometric') return 30;
  // Heavy compound (barbell squat, deadlift, bench, etc.)
  if (ex.is_compound && ex.spinal_load === 'heavy') return 150;
  // Moderate compound
  if (ex.is_compound && (ex.spinal_load === 'moderate' || ex.spinal_load === 'light')) return 90;
  // Compound with no spinal load (pull-ups, dips)
  if (ex.is_compound) return 90;
  // Isolation
  return 60;
}

// ═══════════════════════════════════════════════════════════════════════
// MIGRATE
// ═══════════════════════════════════════════════════════════════════════

let count = 0;
for (const ex of schema.exercises) {
  ex.style_popularity = deriveStylePopularity(ex);
  ex.tracking_metric = deriveTrackingMetric(ex);
  ex.execution_logic = deriveExecutionLogic(ex);
  ex.default_rest_sec = deriveDefaultRestSec(ex);
  ex.standard_rx_weight = RX_WEIGHTS[ex.id] ?? null;
  ex.media_url = '';
  count++;
}

// Write back
fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2) + '\n');

// ── Summary ─────────────────────────────────────────────────────────────
const metrics = { reps: 0, time_seconds: 0, calories: 0, distance_meters: 0 };
const logics = { bilateral: 0, alternating: 0, per_side: 0 };
let rxCount = 0;
for (const ex of schema.exercises) {
  metrics[ex.tracking_metric.primary]++;
  logics[ex.execution_logic]++;
  if (ex.standard_rx_weight) rxCount++;
}

console.log(`\n✅ Migrated ${count} exercises to schema v1.5`);
console.log(`\n📊 Tracking metrics:`, metrics);
console.log(`🔄 Execution logic:`, logics);
console.log(`🏆 Rx weights: ${rxCount} exercises have competitive standards`);
console.log(`📈 Style popularity: all ${count} exercises have per-style scores`);
console.log(`🎬 Media URL: all set to empty placeholder`);

// Spot-check a few key exercises
const spotChecks = ['barbell_back_squat', 'power_clean', 'plank', 'treadmill_run', 'walking_lunge', 'pilates_hundred'];
console.log('\n🔍 Spot checks:');
for (const id of spotChecks) {
  const ex = schema.exercises.find(e => e.id === id);
  if (!ex) { console.log(`  ${id}: NOT FOUND`); continue; }
  console.log(`  ${ex.name}:`);
  console.log(`    popularity: ${JSON.stringify(ex.style_popularity)}`);
  console.log(`    metric: ${ex.tracking_metric.primary}, logic: ${ex.execution_logic}, rest: ${ex.default_rest_sec}s`);
  if (ex.standard_rx_weight) console.log(`    rx: M${ex.standard_rx_weight.male_rx_lbs}/F${ex.standard_rx_weight.female_rx_lbs}`);
}
