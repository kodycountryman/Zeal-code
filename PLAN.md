# Fixes applied

1. **[x] Fix drag-and-drop drop position offset**
   - Root cause: scroll offset was subtracted twice — `measureInWindow` already accounts for scroll position, but `scrollOff` was subtracted again
   - Switched from `measure()` to `measureInWindow()` for accurate section positioning
   - Removed redundant `- scrollOff` from midPageY calculation in both `onPanResponderMove` and `onPanResponderRelease`

2. **[x] Fix swipe-left accidentally scrolling/closing drawer**
   - Increased PanResponder gesture thresholds: minimum 12-15px horizontal, must be 2x vertical
   - Added early rejection when vertical movement exceeds 60% of horizontal
   - Prevents vertical scroll from being captured as a horizontal swipe

3. **[x] Fix time slider not affecting generated workout lengths**
   - Root cause: Strength/Bodybuilding style guides hardcoded exercise counts ("2-3 isolation", etc.) so AI ignored duration
   - Added `getTargetExerciseCount(style, duration)` that computes target exercise count based on style-specific avg minutes-per-exercise
   - Injected explicit TARGET EXERCISE COUNT into prompt as a mandatory requirement
   - Removed hardcoded exercise count ranges from Strength/Bodybuilding style guides
   - Also loosened schema min from 5→3 exercises to allow short (30 min) workouts

4. **[x] Add core finisher component toggle in settings**
   - Added "Core Finisher" toggle (tagged "AI abs") to WORKOUT COMPONENTS section in SettingsDrawer
   - Wired up `localCoreFinisher` state, persistence via `saveSettingsToStorage`, and save logic
   - Triggers workout regeneration on save like other component toggles
1. The "First Launch" Experience
[ ] Installation: Scan the QR code from the terminal and ensure the app icon (Zeal+) appears on your home screen.

[ ] Health Permissions: When the app opens, does it immediately ask for Apple Health access (Steps, Calories, Heart Rate)?

Note: If it doesn't, check app/_layout.tsx to see where the permission trigger is.

[ ] Onboarding: Walk through the onboarding flow. Does it save your data correctly?

2. RevenueCat & Subscriptions
[ ] Paywall Trigger: Does the paywall appear on the first launch (since your state is never_seen)?

[ ] Package Loading: Are the "Monthly" or "Yearly" prices actually showing up, or is it a blank screen?

If blank: Double-check that your products are "Cleared for Sale" in App Store Connect.

[ ] Test Purchase: Try to "buy" the subscription.

Note: Since this is a Development Build, it will use the "Sandbox" environment. It won't charge your real card.

[ ] Pro Status: After the purchase, does the paywall disappear? Does the app now recognize you as "Pro"?

3. Core Features
[ ] Apple Health Sync: Go to a screen that shows your steps or calories. Do the numbers match what you see in the "Fitness" or "Health" app?

[ ] Navigation: Click through every tab in the bottom bar. Does anything cause a "Red Screen" error?

4. Developer Workflow
[ ] Hot Reloading: While the app is open on your phone, change a piece of text in Cursor (e.g., change a title in app/(tabs)/index.tsx).

[ ] Update Speed: Does the phone update within 1-2 seconds of hitting Cmd + S?