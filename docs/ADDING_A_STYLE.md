# Adding a New Workout Style to Zeal+

This guide walks through every file and structure that needs updating when adding a new training style (e.g., "Olympic Weightlifting", "Calisthenics", "Yoga").

## Architecture Overview

All workout generation flows through the **rule engine** (`workoutEngine.ts`). The engine uses data from these sources:

```
exerciseSchema.json    -- Exercise database (251+ exercises, 29 fields each)
styleRules.ts          -- Style rules (rep/set ranges, rest, supersets, progression)
styleFormats.ts        -- Session architectures (phases with muscle/movement filters)
styleTables.ts         -- Cross-style lookup tables
engineConstants.ts     -- Constants (splits, scoring, min/max counts, style configs)
```

AI is used only for enhancement (core finisher, CrossFit MetCon creativity) — never for exercise selection.

---

## Step-by-Step

### Step 1: Add the Style ID

**File:** `mocks/exerciseDatabase.ts`

Add your style to the `EligibleStyle` type union:

```typescript
export type EligibleStyle =
  | 'strength' | 'bodybuilding' | 'crossfit' | 'hyrox'
  | 'mobility' | 'hiit' | 'cardio' | 'pilates' | 'low_impact'
  | 'hybrid'
  | 'your_new_style';  // <-- add here
```

### Step 2: Tag Exercises

**File:** `mocks/exerciseSchema.json`

Add your style to the `eligible_styles` array of every exercise that should appear in this style's workouts. Each exercise has:

```json
{
  "id": "barbell_back_squat",
  "name": "Barbell Back Squat",
  "eligible_styles": ["strength", "bodybuilding", "crossfit", "your_new_style"],
  "primary_muscles": ["quads", "glutes"],
  "secondary_muscles": ["hamstrings", "core", "lower_back"],
  "movement_pattern": "squat",
  "difficulty_tier": "intermediate",
  "equipment_required": ["barbell", "squat_rack"],
  ...
}
```

**Target:** At least 30-40 exercises tagged for your style to ensure variety across splits.

**Tip:** Write a script to batch-tag exercises rather than editing each one manually:

```javascript
const data = JSON.parse(fs.readFileSync('mocks/exerciseSchema.json', 'utf8'));
data.exercises.forEach(e => {
  if (/* your criteria */) {
    e.eligible_styles.push('your_new_style');
  }
});
fs.writeFileSync('mocks/exerciseSchema.json', JSON.stringify(data, null, 2) + '\n');
```

### Step 3: Add Style Rules

**File:** `services/styleRules.ts`

Add a `YOUR_STYLE_RULES` constant and include it in `ALL_STYLE_RULES`. Key fields:

```typescript
export const YOUR_STYLE_RULES: StyleGenerationRules = {
  style_id: 'your_new_style',
  display_name: 'Your New Style',
  available_formats: ['straight_sets', 'circuit'],
  primary_format: 'straight_sets',
  format_selection: [
    { format: 'straight_sets', weight: 60 },
    { format: 'circuit', weight: 40, min_fitness_level: 'intermediate' },
  ],
  session_architecture_id: 'your_new_style',
  rest_overrides: { /* per-tier rest times */ },
  superset_rules: { enabled: false, /* ... */ },
  progression: { beginner: { /* ... */ }, intermediate: { /* ... */ }, advanced: { /* ... */ } },
  time_math: { /* transition buffers, warmup fraction */ },
  rep_range: { min: 8, max: 15 },
  set_range: { min: 3, max: 4 },
  compounds_first: true,
  pattern_priority: ['squat', 'push', 'pull', 'hinge', 'isolation'],
  exercise_count: { min: 5, max: 8 },
  special_rules: [],
};
```

### Step 4: Add Session Architecture

**File:** `services/styleFormats.ts`

Define a `YOUR_STYLE_ARCHITECTURE` that structures the workout into phases:

```typescript
export const YOUR_STYLE_ARCHITECTURE: SessionArchitecture = {
  phases: [
    {
      id: 'primary_compound',        // Must be a valid SessionPhaseId
      name: 'Primary Compound',
      exercise_count: { min: 1, max: 2 },
      role_filter: ['primary'],
      preferred_formats: ['straight_sets'],
      time_budget_fraction: 0.35,
      is_compound_only: true,
    },
    {
      id: 'accessories',
      name: 'Accessories',
      exercise_count: { min: 2, max: 4 },
      role_filter: ['secondary', 'accessory'],
      preferred_formats: ['straight_sets'],
      time_budget_fraction: 0.50,
    },
    {
      id: 'finisher',
      name: 'Finisher',
      exercise_count: { min: 1, max: 2 },
      role_filter: ['accessory'],
      preferred_formats: ['circuit'],
      time_budget_fraction: 0.15,
    },
  ],
  total_phase_fraction: 1.0,
};
```

Then add it to `getArchitectureForStyle()`:

```typescript
case 'your_new_style': return YOUR_STYLE_ARCHITECTURE;
```

If your style needs split-specific architectures (like Strength has Push/Pull/Legs variants), add them and handle the split lookup in `getArchitectureForStyle()`.

**Note:** If you need a new phase ID, add it to the `SessionPhaseId` type union.

### Step 5: Add to Cross-Style Tables

**File:** `services/styleTables.ts`

Add your style to each lookup table:

- `FORMAT_AVAILABILITY` — which workout formats this style uses
- `REST_PERIOD_MATRIX` — rest times per exercise tier
- `SUPERSET_ELIGIBILITY` — superset rules
- `PROGRESSION_SPEED` — per-level progression rates
- `EXERCISE_COUNT_RANGES` — min/max exercise count
- `REP_RANGE_BY_STYLE` — rep ranges
- `SET_RANGE_BY_STYLE` — set ranges
- `COMPOUNDS_FIRST_BY_STYLE` — whether compounds go first
- `PATTERN_PRIORITY_BY_STYLE` — movement pattern priority order

### Step 6: Add to Engine Constants

**File:** `services/engineConstants.ts`

Update these records:

```typescript
// Style name mapping (display name → engine ID)
LEGACY_STYLE_MAP['Your New Style'] = 'your_new_style';
STYLE_DISPLAY_FROM_ENGINE['your_new_style'] = 'Your New Style';

// Exercise count limits
MIN_EXERCISES_PER_STYLE['your_new_style'] = 5;
MAX_EXERCISES_PER_STYLE['your_new_style'] = 8;

// Engine config (rep/set overrides, supersets, pattern priority)
STYLE_ENGINE_CONFIGS['your_new_style'] = {
  rep_range_override: { min: 8, max: 15 },
  set_range_override: { min: 3, max: 4 },
  allow_supersets: false,
  superset_min: 0,
  superset_max: 0,
  compounds_first: true,
  pattern_priority: ['squat', 'push', 'pull', 'hinge', 'isolation'],
};
```

If your style has specific split-to-muscle mappings (unusual), add to `SPLIT_TO_MUSCLES`.

### Step 7: Add Style Color

**File:** `constants/colors.ts`

Add an accent color for the style in `WORKOUT_STYLE_COLORS`:

```typescript
'Your New Style': '#hex_color',
```

### Step 8: Add to UI Style List

**File:** `constants/workoutStyles.ts` (or equivalent)

Add the style to the selectable list so users can pick it.

### Step 9: Test

Run the rule engine for your style across all splits to verify:

```javascript
const data = JSON.parse(fs.readFileSync('mocks/exerciseSchema.json', 'utf8'));
const splits = ['Pull', 'Push', 'Legs', 'Full Body'];
splits.forEach(split => {
  const muscles = SPLIT_TO_MUSCLES[split];
  let pool = data.exercises.filter(e => e.eligible_styles.includes('your_new_style'));
  pool = pool.filter(e => e.primary_muscles.some(m => muscles.includes(m)));
  console.log(`${split}: ${pool.length} exercises`);
});
```

Ensure each split has 8+ exercises. If any split is below 4, tag more exercises in Step 2.

---

## Methodology References

When designing style rules, reference established training science:

| Style | Key References |
|-------|---------------|
| Strength | Rippetoe "Starting Strength", Wendler 5/3/1, Prilepin's Chart |
| Bodybuilding | Schoenfeld hypertrophy research, Renaissance Periodization (Dr. Mike Israetel), volume landmarks (MEV/MRV/MAV) |
| CrossFit | CrossFit Level 1 Training Guide, Bergeron programming |
| HIIT | Tabata et al. 1996, Gibala et al. 2012 sprint interval research |
| Pilates | Joseph Pilates "Return to Life Through Contrology" |
| Mobility | FRC (Functional Range Conditioning), Kelly Starrett "Becoming a Supple Leopard" |
| Low-Impact | ACSM guidelines for older adults, joint-loading research |

---

## Checklist

- [ ] `EligibleStyle` type updated
- [ ] 30+ exercises tagged in `exerciseSchema.json`
- [ ] Style rules added to `styleRules.ts` + `ALL_STYLE_RULES`
- [ ] Session architecture added to `styleFormats.ts` + `getArchitectureForStyle()`
- [ ] Cross-style tables updated in `styleTables.ts`
- [ ] Constants updated in `engineConstants.ts` (maps, min/max, config)
- [ ] Style color added to `constants/colors.ts`
- [ ] Style added to UI selection list
- [ ] Rule engine tested across all splits (8+ exercises each)
