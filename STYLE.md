# Zeal+ — Style & Constraints Guide

> Read this before making ANY visual or structural change to the app.
> The rules here are intentional and have been tuned through iteration.
> When in doubt, match what already exists rather than introducing something new.

---

## 1. Design Language

**Glass-morphism** is the single visual language of this app. Every card, panel, and surface follows it:

- Semi-transparent backgrounds (`rgba(...)`)
- Subtle 1px borders (`rgba(255,255,255,0.08–0.15)` on dark, `rgba(0,0,0,0.06–0.1)` on light)
- No hard opaque surfaces except where intentional (e.g., exercise row background)
- No drop shadows on cards — borders carry the depth
- Blur views (BlurView) for overlapping surfaces like modals and the floating dock

**Feel**: Native iOS. Clean, purposeful, no decorative clutter. Every element earns its place.

---

## 2. Border Radius System

These values are fixed. Do not introduce new radii — pick the closest existing one.

| Component | borderRadius |
|-----------|-------------|
| Outer tab panel card (Pre/Workout/Post container) | 36 |
| Workout section card, Core Finisher card, Cardio card | 26 |
| Warm-up / Cool-down / Recovery checklist cards | 26 |
| Primary CTA / Apply buttons | 26 |
| Bottom sheet (sheetBg) | 26 |
| Gym preset buttons | 26 |
| Tab bar pill (active indicator) | 22 |
| Style picker row (drawer selector card) | 20 |
| Chips (split, muscle, equipment) | 20 |
| Exercise tracking log panel | 16 |
| Small badges, pills, icon badges | 8–12 |

---

## 3. Color Rules

### White Hierarchy (structural UI)
All tab bars, navigation elements, and structural labels use white-only opacity levels. No accent colors in structural chrome.

| Use | Color |
|-----|-------|
| Active icon / label | `rgba(255,255,255,0.95)` |
| Primary text | `rgba(255,255,255,0.9)` |
| Secondary text | `rgba(255,255,255,0.5–0.6)` |
| Inactive icon / label | `rgba(255,255,255,0.3–0.32)` |
| Subtle borders | `rgba(255,255,255,0.08–0.15)` |
| Dividers | `rgba(255,255,255,0.06)` |

### Accent Colors (content-level only)
Accent colors come from `currentAccent` (mapped per training style). Used only for:
- Primary CTA buttons (`backgroundColor: currentAccent`)
- The FAB (floating action button, orange `#f87116`)
- Active exercise state indicators (checkmarks, progress)
- Inline accent highlights (e.g., set completion)

**Never** use accent on: tab bars, navigation pills, card backgrounds, borders, labels.

### Semantic Colors
| Purpose | Color |
|---------|-------|
| Core Finisher (green) | `rgba(34,197,94,0.06)` bg / `rgba(34,197,94,0.2)` border / `rgba(34,197,94,0.7)` icon |
| Cardio | matches `isDark ? 'rgba(34,34,34,0.98)' : 'rgba(235,235,235,0.98)'` |
| Warm-Up (orange tint) | `rgba(248,113,22,0.06)` bg / `rgba(248,113,22,0.18)` border |
| Cool-Down (cyan tint) | `rgba(6,182,212,0.06)` bg / `rgba(6,182,212,0.18)` border |
| Paywall background | Black — no color except orange CTA + gold crown |

### Dark / Light Theming
Always use `isDark` conditional rather than hardcoded colors for anything that needs to adapt. Use `colors.card`, `colors.text`, `colors.textSecondary`, `colors.border` from AppContext for generic surfaces.

---

## 4. Typography

**Font families in use:**
- `Outfit_400Regular` — body copy, descriptions
- `Outfit_500Medium` — inactive labels, secondary UI text
- `Outfit_600SemiBold` — active tab labels, button labels
- `Outfit_700Bold` — section headers, exercise names
- `Outfit_800ExtraBold` — large display values
- `PlayfairDisplay_700Bold` — premium headings only (paywall, onboarding)

**Never** introduce a new font weight or family. Map to the closest existing one above.

**Type scale (common sizes):**
| Use | Size |
|-----|------|
| Tab labels | 13 |
| Exercise name | 15 |
| Section label | 13–14 |
| Body / description | 12–13 |
| Large metric | 28–36 |

Always set `includeFontPadding: false` on Text elements where vertical centering matters.

---

## 5. Spacing & Layout Patterns

### The `-12` Bleed Pattern
Cards inside `tabContent` (which has `paddingHorizontal: 12`) that need to reach the full card edge use:
```
marginHorizontal: -12
```
This is intentional — it makes the workoutSection, coreFinisherCard, and cardioSection bleed edge-to-edge within their parent card. Do not remove it.

### Tab Content Structure
```
tabPanel (borderRadius 36, colors.card bg)
  └── tabBarOuter (pill row)
  └── content wrapper (paddingTop: 4, gap: 12, paddingBottom: 12)
        └── tabContent (paddingHorizontal: 12, gap: 8)
              └── workoutSection (marginHorizontal: -12, borderRadius: 26)
              └── coreFinisherCard (marginHorizontal: -12, borderRadius: 26)
              └── cardioSection (marginHorizontal: -12, borderRadius: 26)
```

### Card Sizing
- Cards should `alignSelf: 'flex-start'` or shrink-wrap content — never stretch to fill vertical space
- No `flex: 1` on card containers unless explicitly needed for a row layout inside the card
- No fixed `minHeight` on cards

---

## 6. Interaction Patterns

### Exercise Name → Detail Drawer
Any tappable exercise name (in workout list, core finisher, cardio, superset) must call:
```ts
handleExerciseTap(ex: WorkoutExercise)
```
This opens the `ExerciseDetailDrawer`. Do not wire exercise names to any other handler.

### Chevron → Log Panel
The expand/collapse chevron on an exercise row must call:
```ts
handleToggleTrackPanel(exId: string, exercise?: WorkoutExercise)
```
This manages the `expandedTrack` state and opens the tracking log panel.

### Swipe Left → Actions
Any exercise row that supports swipe-left actions uses `SwipeableExerciseRow`. Key props that must not be changed:
```ts
activeOffsetX={[-8, 8]}   // tuned — do not increase
failOffsetY={[-5, 5]}      // tuned — prevents scroll conflict
```
The row background must match the card it sits in (`rowBg` prop = card background color).

### Cardio Items as WorkoutExercise
`CardioItem` is not a `WorkoutExercise`. When rendering cardio in swipeable rows or log panels, create a stub:
```ts
const cardioEx: WorkoutExercise = {
  id: `cardio-${idx}`,
  name: c.name,
  sets: 1,
  reps: c.duration,
  rest: c.rpe ? `RPE ${c.rpe}` : 'None',
  muscleGroup: 'Cardio',
  equipment: 'None',
  notes: c.notes ?? '',
  type: 'cardio',
  movementType: 'cardio',
  groupType: null,
  groupId: null,
  suggestedWeight: 'BW',
  lastSessionWeight: '',
  lastSessionReps: '',
  exerciseRef: null as any,
};
```

---

## 7. Component Rules

### SwipeableExerciseRow
- Row front background = card background (never transparent, never default gray)
- No opacity animation on swipe (removed intentionally)
- Action buttons: no backgroundColor/borderColor — transparent, icon only
- `actionsContainer`: transparent background
- Icon size: 22

### FloatingDock (Bottom Tab Bar)
- Tab indicator: no background color — icon + label color change only
- Active: `rgba(255,255,255,0.95)` icon + label
- Inactive: `rgba(255,255,255,0.32)` icon + label
- Dock `paddingVertical: 6` (compact — do not increase)
- FAB `shadowOpacity: 0.25`, `shadowRadius: 8` (no neon bloom)
- FAB stays orange (`#f87116`) — never changes with training style accent

### Pre/Workout/Post Tab Bar
- Three equal-width tabs (`flex: 1` each)
- Active pill: `rgba(255,255,255,0.1)` bg, `rgba(255,255,255,0.15)` border, `borderRadius: 22`
- Pill position driven by `tabXOffsets` (measured via `onLayout`) — not manual arithmetic
- No accent color on the active pill — white glass only
- Icon + label always visible (both active and inactive states)
- Layout: `flexDirection: 'row'`, icon + label horizontal, `alignItems: 'center'`

### Superset / Circuit Connector Rows
- `groupHeader` and `groupLinkRow` backgrounds must match `colors.card`
- These rows are not transparent — they share the card surface color

### Core Finisher Card
- Max 1 exercise rendered (`workout.coreFinisher.slice(0, 1)`)
- No grab bars (DraggableFlatList handle removed)
- No AI badge
- Green color treatment: bg `rgba(34,197,94,0.06)`, border `rgba(34,197,94,0.2)`
- Exercise name is tappable → `handleExerciseTap`

---

## 8. PaywallModal Rules

The paywall is luxury monochrome. Strict rules:

- **Only two colored elements**: orange CTA button + gold crown icon
- Everything else: white at varying opacity levels
- No green checkmarks — use `rgba(255,255,255,0.45)`
- No colored feature icons — white/gray only
- No teal, purple, or brand-colored accents anywhere in the paywall
- Background: pure black or very dark — no gradients with color

---

## 9. Animation Principles

- Use `useNativeDriver: true` wherever possible
- Spring animations for interactive feedback (`SPRING_BTN` constant)
- Timing for tab transitions: reference `constants/animation.ts`
- `TabContentSpring` component wraps panel content for entry animation — do not remove
- No layout animations that shift other elements (no `LayoutAnimation.configureNext` on tab switches)

---

## 10. What NOT to Change Without Discussion

These are intentionally the way they are:

| Thing | Why it's locked |
|-------|----------------|
| `workout.tsx` is one giant file | Splitting would break shared state and callbacks |
| `SwipeableExerciseRow` gesture thresholds | Tuned to prevent scroll/swipe conflicts |
| `workout.tsx` line count growing | Expected — monolith pattern is intentional |
| `DEV_FORCE_PRO` in SubscriptionContext | Toggle OFF before App Store submission |
| `paddingBottom: 120` on ScrollView contentContainer | Accounts for floating tab bar height |
| Core Finisher max 1 exercise | Design decision — more exercises = visual noise |
| Paywall 7-second delay | Prevents immediate hard sell on first open |
| Muscle chip active state = tinted border, not solid fill | Multiple simultaneous selections with solid fill creates visual noise |

---

## 11. Drawer & Bottom Sheet Conventions

- `sheetBg borderRadius: 26` — all BottomSheetModal backgrounds
- Handle indicator: `colors.border`
- Backdrop opacity: 0.6 (main drawer), 0.5 (stacked/child drawer)
- `enableOverDrag: false` — always
- `stackBehavior: "push"` for nested sheets
- Drawer header: `paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14`
- Header title: `Outfit_800ExtraBold, fontSize: 20, letterSpacing: -0.5`
- Scroll content: `paddingHorizontal: 20, gap: 28` between sections

### Section Labels (inside drawers)
- `fontSize: 12, Outfit_600SemiBold`
- `textTransform: 'uppercase', letterSpacing: 1`
- Color: `rgba(255,255,255,0.45)` dark / `rgba(0,0,0,0.40)` light
- **Never** use `colors.text` for section labels — they are intentionally muted

### Chips
- Height: 38, `paddingHorizontal: 16, borderRadius: 20`
- Inactive: `rgba(255,255,255,0.07)` bg, 1px transparent border
- Active (single-select, e.g. split/format): solid `styleAccent` bg, white text
- Active (multi-select, e.g. muscles): `${styleAccent}18` bg, 1.5px `styleAccent` border, `styleAccent` text — never solid fill when multiple can be selected simultaneously
- Text: `Outfit_500Medium, fontSize: 13`

---

## 12. Before Every Edit Checklist

1. Does this change affect more than one tab? Apply it to all three (Pre/Workout/Post) consistently.
2. Does this card need a background? Match `colors.card` or the established rgba for that surface.
3. Am I introducing a new color? Use the existing hierarchy — don't add new rgba values unless necessary.
4. Am I adding a new tappable element with an exercise name? Wire it to `handleExerciseTap`.
5. Am I adding a new chevron? Wire it to `handleToggleTrackPanel`.
6. Does my border radius match the table in Section 2?
7. Am I using the right font weight for this context (Section 4)?
