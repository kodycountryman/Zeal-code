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
