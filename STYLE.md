# Zeal+ — Style & Constraints Guide

> Read this before making ANY visual or structural change to the app.
> Rules here are derived from what's shipping on the homescreen and reflect the current design language.
> When in doubt, match what already exists rather than introducing something new.

---

## 1. Design Language

**Glass-morphism** is the single visual language. Every card, panel, and surface follows it:

- Semi-transparent backgrounds with blur (dark mode) or solid light surface (light mode)
- Subtle 1px borders — see color tokens in Section 3
- No hard drop shadows on cards — borders carry depth
- BlurView only through the `GlassCard` component — never manually

**Feel**: Native iOS. Clean, purposeful. No decorative clutter. Every element earns its place.

---

## 1.5. The `TabHeader` Component

**Use `<TabHeader>` from `components/TabHeader.tsx` at the top of every tab screen.**

```tsx
<SafeAreaView edges={['top']}>
  <TabHeader
    title="Run"                       // dynamic page title
    onAvatarPress={() => openProfile()}
    rightSlot={<UnitsToggle />}       // optional right-side meta
    centerOverlay={<FloatingTimer />} // optional absolutely-positioned center
  />
</SafeAreaView>
```

Layout: `[avatar] [page title]                                      [rightSlot]`

- Avatar: 34×34, `borderRadius: 17`, `borderWidth: 1.5`
- Title: `fontSize: 20, Outfit_800ExtraBold, letterSpacing: -0.5`
- Padding: `paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10`

### The "zeal" wordmark

The orange "zeal" wordmark ONLY appears on:
- Splash screen
- Onboarding
- Paywall

It does NOT appear in tab headers. Page identity comes from the `title` prop.

### Active-run / post-run sub-headers

Inside the Run tab, the active-run and post-run states use their own
sub-header layout (live status indicators, "Run Complete" title) — NOT
`<TabHeader>`. Those are mode-specific chrome, not tab navigation.

---

## 2. The `GlassCard` Component

**All cards use `GlassCard`.** Never recreate card surfaces with raw `View`.

```tsx
<GlassCard variant={isDark ? 'glass' : 'solid'}>
  {/* content */}
</GlassCard>
```

**GlassCard internals (do not change):**
| Property | Value |
|----------|-------|
| `borderRadius` | 26 |
| `borderWidth` | 1 |
| `borderColor` dark | `rgba(255,255,255,0.09)` |
| `borderColor` light | `rgba(0,0,0,0.07)` |
| bg `glass` dark | `rgba(38,38,38,0.96)` + BlurView intensity 62 |
| bg `glass` light | `rgba(255,255,255,0.76)` + BlurView intensity 36 |
| bg `solid` | `colors.card` |

**Drawers** (Settings, AboutMe, AthleteProfile, etc.) use plain `View` with `backgroundColor: colors.card` — not GlassCard. GlassCard is for home screen cards only.

---

## 3. Color Tokens

Always use `colors.*` from `useZealTheme()`. Never hardcode grays, whites, or blacks for UI surfaces.

| Token | Use |
|-------|-----|
| `colors.background` | Screen background |
| `colors.card` | Card / drawer section background |
| `colors.cardSecondary` | Input fields, inactive chip fill, row backgrounds |
| `colors.text` | Primary text, selected chip fill |
| `colors.textSecondary` | Secondary labels, icons in drawers |
| `colors.textMuted` | Hints, placeholders, key labels |
| `colors.border` | Dividers, input borders, inactive chip borders |

### Border colors on GlassCard / home cards
```ts
isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'
```

### Dividers inside cards
```ts
isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'   // horizontal
isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.09)'   // vertical
```

### Accent Colors
`accent` comes from `useZealTheme()` and maps to the current training style. Use it for:
- Primary CTA buttons
- FAB (always `#f87116` — never changes with style)
- Active exercise state indicators

**Never** use `accent` on: section labels, chip selected states (outside Training section), input borders, icon colors in navigation rows, recovery buttons.

---

## 4. Border Radius System

Fixed values only. Pick the closest — do not introduce new ones.

| Component | `borderRadius` |
|-----------|---------------|
| GlassCard / home cards | 26 |
| Drawer sections / settings cards | 20 |
| Primary CTA buttons | 20 |
| Chips (drawer selection) | 20 |
| Drawer sub-cards, inputs | 12 |
| Meta chips (home cards, small pills) | 8 |
| Small badges, dots | 4–6 |

---

## 5. Typography

**Font families in use:**
| Family | Use |
|--------|-----|
| `Outfit_400Regular` | Body copy, hints, descriptions |
| `Outfit_500Medium` | Home card labels, secondary nav text |
| `Outfit_600SemiBold` | Drawer section headers, button labels |
| `Outfit_700Bold` | Exercise names, strong labels |
| `Outfit_800ExtraBold` | Large display values, screen titles |
| `PlayfairDisplay_700Bold` | Paywall / onboarding premium headings only |

Never introduce a new font weight or family.

**Type scale:**
| Context | Size | Family |
|---------|------|--------|
| Home card label (above title) | 12 | Outfit_500Medium |
| Drawer section header | 13 | Outfit_600SemiBold |
| Exercise name / body | 15 | Outfit_700Bold |
| Body copy / hints | 12–13 | Outfit_400Regular |
| Small meta label | 10–11 | Outfit_400Regular or 500Medium |
| Large metric / score | 28–44 | Outfit_800ExtraBold |
| Screen / drawer title | 18–20 | Outfit_800ExtraBold |

---

## 6. Section Labels

**One canonical style. Title Case. No dot prefix. No ALL CAPS. No sentence case.**

```ts
fontSize: 12,
fontFamily: 'Outfit_600SemiBold',
letterSpacing: 0,
color: colors.textSecondary,  // or colors.textMuted for softer context
// Title Case: "Where", "Run Type", "Last Run", "This Week", "Next Up"
```

The ALL CAPS convention that appeared in newer screens (Run tab, drawers) was
deliberately retired during the design-unification pass — it read as "spec
sheet" against the app's native-iOS tone. Sentence case was also retired to
eliminate the three-way split between ALL CAPS, Title Case, and lowercase.

Acronyms retain their casing: WOD, BMI, HR, PR, etc. Anything a user would
read as an initialism stays uppercase regardless of the Title Case rule.

### Contexts (all use the same style above)
- Card labels above a big metric ("Today's Workout", "Next Up", "Training Score")
- Stat labels above a number ("This Week", "Total Runs", "Best Pace")
- Section headers in drawers ("Identity", "Body Metrics", "Privacy")

### Pulse-dot label prefix
The orange `pulseDot` used by `WorkoutOverviewCard` / `RunOverviewCard` is a
rendered `<View>` — NOT a text prefix. Do not fake it with bullet characters.

### The "section label" style key
Any local stylesheet can define `sectionLabel` with the spec above. No shared
component is needed. When you see an existing key like `cardLabel`, `subLabel`,
`statLabel`, `todayRunLabel` — they all converge on the same canonical values.

---

## 7. Chips

**Use `<Chip>` from `components/Chip.tsx` for all display/single-select chips.**
Never recreate chip surfaces inline.

```tsx
<Chip variant="neutral" icon="clock" label="60 min" />
<Chip variant="selectable" label="Easy Run" selected={...} onPress={...} />
```

### Two canonical variants (both in `Chip.tsx`)

**`neutral`** — display-only pills (home card meta, overview card chips)
```ts
paddingHorizontal: 10,
paddingVertical: 5,
borderRadius: 8,
backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
// no border
// text: fontSize 12, Outfit_500Medium, colors.textSecondary
```

**`selectable`** — interactive single-select (run type, mode toggle, drawer single-select)
```ts
paddingHorizontal: 14,
paddingVertical: 8,
borderRadius: 20,
borderWidth: 1,
// unselected: backgroundColor 'transparent', borderColor colors.border, text colors.text
// selected:   backgroundColor `${accent}20`, borderColor accent,    text accent
// text: fontSize 13, Outfit_600SemiBold
```

### Multi-select tinted-border chips (muscles, equipment) — bespoke, stays inline

Multi-select chips do NOT go through `<Chip>`. They're a semantically distinct
pattern (multiple simultaneously-active selections) that needs a quieter selected
state than the single-select fill:

```ts
// Selected:
backgroundColor: `${accent}18`,
borderColor: accent,
borderWidth: 1.5,
color: accent,
```
Solid fill on multi-select creates visual noise when multiple are active at once.

### Compact micro-pills (header-sized toggles)

The mi/km toggle in the Run tab header is too small for `<Chip variant="selectable">`
(which has `paddingVertical: 8`). Use an inline micro-pill that matches the
32-px header height:

```ts
paddingHorizontal: 12,
paddingVertical: 6,
borderRadius: 14,
// selected: backgroundColor `${accent}20`, text accent
// unselected: no background, text colors.textMuted
// text: fontSize 12, Outfit_700Bold, letterSpacing 0.5
```
Wrap two of these in a rounded container (`borderRadius: 18`, bg `rgba(128,128,128,0.1)`)
so they read as a segmented control.

---

## 7.5. Buttons

**Use `<Button>` from `components/Button.tsx` for all CTAs. Never recreate inline.**

```tsx
<Button variant="primary" icon="play" label="Start Workout" onPress={...} />
<Button variant="secondary" label="Plan" fullWidth onPress={...} />
<Button variant="tertiary" size="sm" icon="refresh" label="Shuffle" onPress={...} />
<Button variant="secondary" destructive label="Delete Run" onPress={...} />
```

### Three canonical variants

| Variant | Use for | Background | Border | Text | Radius |
|---|---|---|---|---|---|
| `primary` | Main CTA (Start Workout, Save Run) | `accent` | — | `#fff` | 16 |
| `secondary` | Alternate paired with primary (Plan, Modify, Cancel) | transparent | `colors.border` 1px | `colors.text` | 16 |
| `tertiary` | Small inline accent action (Shuffle, Add Exercise) | `${accent}12` | `accent` 1px | `accent` | 10 |

### Sizes
| Size | paddingVertical | paddingHorizontal | fontSize | iconSize | gap |
|---|---|---|---|---|---|
| `sm` | 5  | 9  | 11 | 11 | 4 |
| `md` (default) | 13 | 16 | 14 | 15 | 7 |
| `lg` | 16 | 20 | 16 | 17 | 8 |

### Options
- `icon` — any `AppIconName` shown as the leading glyph
- `fullWidth` — stretches to parent width
- `destructive` — primary turns red-filled; secondary/tertiary get red text + red-tinted border
- `loading` — shows a spinner in place of the icon
- `onPressIn` / `onPressOut` — for parent-driven scale animations (e.g. Start Workout's spring)

### Bespoke exception: `components/run/RunControls.tsx`

The Start/Pause/Stop circles (124/88/56 px) are a bespoke run-controls component,
NOT generic buttons. They have a pulse animation, a locked-run gesture, and
status-aware colors. Do not migrate them to `<Button>`.

---

## 8. Cards (Home Screen)

All home cards use `GlassCard` with these inner padding conventions:

```ts
paddingHorizontal: 20,
paddingTop: 18,
paddingBottom: 18,
gap: 10,       // between sections inside the card
```

Card label (above title): `fontSize: 12, Outfit_500Medium`
Card title: `fontSize: 24–28, Outfit_800ExtraBold`

---

## 9. Drawer Sections

Sections inside bottom sheet drawers use raw `View`:

```ts
backgroundColor: colors.card,
borderRadius: 20,
padding: 16,
gap: 12,
```

Content padding for the scroll area: `paddingHorizontal: 20, gap: 14`

---

## 10. Inputs

```ts
borderWidth: 1,
borderRadius: 12,
paddingHorizontal: 14,
paddingVertical: 12,
fontSize: 15,
fontWeight: '500',
backgroundColor: colors.cardSecondary,
borderColor: colors.border,
color: colors.text,
selectionColor: colors.text,   // never accent
```

### Workout set-input chips

The weight/reps chips in `app/(tabs)/workout.tsx` follow this convention. They
had a heavier treatment in earlier builds (35%-muted border + distinct translucent
bg) — these were normalized during the design-unification pass. When editing
them, preserve:
- `borderColor: colors.border` (unselected) / `${currentAccent}88` (expanded)
- `backgroundColor: colors.cardSecondary`
- `CHIP_H: 44` collapsed, `PICKER_H: 132` expanded (these are tuned for WheelPicker)
- Orange left-bar accent on the next-up row (strong "your next set" affordance)

---

## 11. Drawer & Bottom Sheet Conventions

- `GlassCard borderRadius: 26` — home cards
- `sheetBg borderRadius: 26` — BottomSheetModal background
- Handle indicator: `colors.border`
- Backdrop opacity: 0.6 (main drawer), 0.5 (stacked/child)
- `enableOverDrag: false` — always
- `stackBehavior: "push"` for nested sheets

**Drawer header:**
```ts
paddingHorizontal: 20,
paddingVertical: 14,
// Title:
fontSize: 20,
fontWeight: '800',
fontFamily: 'Outfit_800ExtraBold',
letterSpacing: -0.3,
color: colors.text,
```

---

## 12. Spacing & Layout Patterns

### The `-12` Bleed Pattern
Cards inside `tabContent` (which has `paddingHorizontal: 12`) that need full-width edge use:
```ts
marginHorizontal: -12
```
This makes workoutSection, coreFinisherCard, and cardioSection bleed edge-to-edge. Do not remove.

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

---

## 13. Interaction Patterns

### Exercise Name → Detail Drawer
Any tappable exercise name calls:
```ts
handleExerciseTap(ex: WorkoutExercise)
```

### Chevron → Log Panel
```ts
handleToggleTrackPanel(exId: string, exercise?: WorkoutExercise)
```

### Swipe Left → Actions
Uses `SwipeableExerciseRow`. Key props — do not change:
```ts
activeOffsetX={[-8, 8]}
failOffsetY={[-5, 5]}
```

---

## 14. Component Rules

### SwipeableExerciseRow
- Row front background = card background (never transparent, never default gray)
- No opacity animation on swipe
- Action buttons: transparent bg, icon only
- Icon size: 22

### FloatingDock (Bottom Tab Bar)
- Active: `rgba(255,255,255,0.95)` icon + label
- Inactive: `rgba(255,255,255,0.32)` icon + label
- FAB stays orange (`#f87116`) — never changes with training style accent
- FAB `shadowOpacity: 0.25`, `shadowRadius: 8` (no neon bloom)
- Dock `paddingVertical: 6` (compact — do not increase)

### Pre/Workout/Post Tab Bar
- Active pill: `rgba(255,255,255,0.1)` bg, `rgba(255,255,255,0.15)` border, `borderRadius: 22`
- No accent color on the active pill — white glass only

### Core Finisher Card
- Max 1 exercise rendered
- Green treatment: bg `rgba(34,197,94,0.06)`, border `rgba(34,197,94,0.2)`

---

## 15. Semantic Color Treatments

| Surface | Background | Border |
|---------|-----------|--------|
| Core Finisher | `rgba(34,197,94,0.06)` | `rgba(34,197,94,0.2)` |
| Warm-Up | `rgba(248,113,22,0.06)` | `rgba(248,113,22,0.18)` |
| Cool-Down | `rgba(6,182,212,0.06)` | `rgba(6,182,212,0.18)` |
| Completed workout | — | `rgba(34,197,94,0.22)` dark / `rgba(34,197,94,0.18)` light |

---

## 16. PaywallModal Rules

Strict luxury monochrome:
- **Only two colored elements**: orange CTA + gold crown icon
- Everything else: white at varying opacity
- No green checkmarks — use `rgba(255,255,255,0.45)`
- No colored feature icons
- Background: pure black — no gradients

---

## 17. Animation Principles

- `useNativeDriver: true` wherever possible
- Spring animations for interactive feedback (`SPRING_BTN` constant)
- `TabContentSpring` wraps panel content for entry — do not remove
- No `LayoutAnimation.configureNext` on tab switches

---

## 18. What NOT to Change Without Discussion

| Thing | Why it's locked |
|-------|----------------|
| `workout.tsx` is one giant file | Splitting breaks shared state and callbacks |
| SwipeableExerciseRow gesture thresholds | Tuned — scroll/swipe conflict prevention |
| `DEV_FORCE_PRO` in SubscriptionContext | Toggle OFF before App Store submission |
| `paddingBottom: 120` on ScrollView contentContainer | Accounts for floating tab bar height |
| Core Finisher max 1 exercise | More = visual noise |
| Paywall 7-second delay | Prevents immediate hard sell |
| Multi-select chip = tinted border (not solid fill) | Multiple active selections with solid fill = noise |

---

## 19. Before Every Edit Checklist

1. Does this card belong on the home screen? Use `GlassCard`. In a drawer? Use plain `View + colors.card`.
2. Adding a tab header? Use `<TabHeader>`. Never recreate the avatar/title row inline.
3. Adding a section label? `fontSize: 12, Outfit_600SemiBold`, Title Case. Never ALL CAPS, sentence case, or lowercase.
4. Adding a chip? Use `<Chip variant="neutral" />` or `<Chip variant="selectable" />`. Multi-select stays bespoke (tinted border).
5. Adding a button? Use `<Button variant="primary|secondary|tertiary" />`. Never an inline `TouchableOpacity` with custom background + padding + font for a CTA.
6. Am I using `accent`? Only allowed on CTAs and Training-section-specific indicators.
7. Does my border radius match Section 4?
8. Does my font size/family match Section 5?
9. Am I adding a tappable exercise name? Wire to `handleExerciseTap`.
10. Am I adding a chevron? Wire to `handleToggleTrackPanel`.
11. Does this change affect Pre/Workout/Post tabs? Apply to all three.
