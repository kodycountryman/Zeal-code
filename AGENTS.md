# Zeal+ — Codex Context

## Authorization
Full read/write access to all files in this project is authorized. Make edits directly without asking for permission on individual files.

## What This App Is
**Zeal+** is an AI-powered fitness training app for iOS and Android. It generates personalized workouts using AI, tracks training plans, syncs with Apple Health/Google Health Connect, and monetizes via RevenueCat subscriptions (Free and Pro tiers).

- **Platform**: Expo 54 / React Native 0.81 / React 19
- **Routing**: Expo Router (file-based, app/ directory)
- **AI**: Vercel AI SDK (`ai` + `@ai-sdk/google`) with Gemini 2.0 Flash + Zod schemas for structured workout output
- **State**: React Context (3 providers) + Zustand + AsyncStorage + React Query
- **Styling**: NativeWind + React Native StyleSheet + glass-morphism design language
- **Fonts**: Outfit (primary, 400–800) + Playfair Display (headings)
- **Subscriptions**: RevenueCat
- **Health**: react-native-health (iOS) + react-native-health-connect (Android)

## Key File Map

| Path | What it is |
|------|-----------|
| `app/(tabs)/index.tsx` | Home/Dashboard tab |
| `app/(tabs)/workout.tsx` | Workout execution tab — 6000+ lines, core experience |
| `app/(tabs)/_layout.tsx` | Tab layout with FloatingDock |
| `app/_layout.tsx` | Root layout with all providers |
| `app/onboarding.tsx` | Multi-step onboarding flow |
| `app/login.tsx` | Auth screen |
| `services/workoutEngine.ts` | Exercise DB, AI orchestration (102KB) |
| `services/aiWorkoutGenerator.ts` | Zod schemas + AI prompt generation |
| `services/styleRules.ts` | Training style definitions (36KB) |
| `services/styleFormats.ts` | Style-specific AI prompts (38KB) |
| `services/planEngine.ts` | Multi-week training plan generation |
| `services/healthService.ts` | Apple Health / Health Connect integration |
| `services/purchases.ts` | RevenueCat subscription logic |
| `services/proGate.ts` | Pro feature gating |
| `context/AppContext.tsx` | Theme, user prefs, muscle readiness |
| `context/WorkoutTrackingContext.tsx` | Real-time workout state |
| `context/SubscriptionContext.tsx` | RevenueCat + paywall state |
| `constants/colors.ts` | Theme definitions, muscle colors |
| `constants/animation.ts` | Animation timings |
| `components/drawers/` | 16 bottom-sheet drawer modals |
| `components/FloatingDock.tsx` | Custom bottom tab bar |
| `components/GlassCard.tsx` | Reusable glass-morphism card |
| `components/SwipeableExerciseRow.tsx` | Drag-to-delete exercise rows |

## Design System
- **Primary reference**: Apple Human Interface Guidelines (Lists & Tables)
- **Pattern**: Glass-morphism — semi-transparent cards with subtle borders
- **Theme system**: system / dark / light / zeal / neon (set in AppContext)
- **Accent colors**: mapped per training style
- App should feel native, clean, and intentional — consistent with iOS design language
- **→ Read `STYLE.md` before making any visual or structural change.** It contains border radius rules, color hierarchy, typography scale, component constraints, interaction patterns, and a pre-edit checklist.

## Training Styles
- **Free tier**: Strength only (workout plans)
- **Pro tier**: Bodybuilding, CrossFit, HIIT, Pilates, Mobility, Low-Impact, Hybrid, Hyrox + all Running plans

## Git Workflow
- Main branch: `main`
- Always `git push` before switching Macs; `git pull` on the other Mac before coding
- Repo: https://github.com/kodycountryman/Zeal-code (push target)

## Dev Server
```bash
npm install          # first time in a new folder location
npx expo start --tunnel   # start dev server (tunnel for physical device)
```
Scan QR code with Expo Go app on iPhone.

## Recent Fixes (from PLAN.md)
1. Fixed drag-and-drop drop position offset (measureInWindow, removed double scroll subtraction)
2. Fixed swipe-left accidentally triggering scroll (increased PanResponder thresholds)
3. Fixed time slider not affecting workout length (added getTargetExerciseCount, inject into AI prompt)
4. Added Core Finisher toggle in SettingsDrawer

## Active Notes
- `workout.tsx` is intentionally massive — avoid splitting unless necessary
- `DEV_FORCE_PRO = true` is currently set in `context/SubscriptionContext.tsx` — toggle to `false` before App Store submission
- 1 moderate npm vulnerability present (non-blocking, from `npm audit`)
