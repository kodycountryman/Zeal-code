/**
 * Walkthrough prompt state.
 *
 * Tracks whether to surface the "take the walkthrough?" prompt on login.
 * Three states:
 *   - 'pending'   : user hasn't decided yet — show prompt on every login
 *   - 'completed' : user finished the walkthrough — never auto-prompt again
 *   - 'never'     : user explicitly declined forever — never auto-prompt again
 *
 * In all three states the user can manually replay the walkthrough from the
 * Settings drawer. The prompt is for the LOGIN screen only.
 *
 * Migration: on first read after upgrade, if the legacy
 * `@zeal_app_tour_completed_v1` flag is true, set our state to 'completed'
 * and delete the old key.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export type WalkthroughPromptState = 'pending' | 'completed' | 'never';

const KEY = '@zeal_walkthrough_prompt_v1';
const LEGACY_TOUR_KEY = '@zeal_app_tour_completed_v1';

let _migrationDone = false;

async function migrateLegacyIfNeeded(): Promise<void> {
  if (_migrationDone) return;
  _migrationDone = true;
  try {
    const ours = await AsyncStorage.getItem(KEY);
    if (ours !== null) return; // already initialised — no migration needed
    const legacy = await AsyncStorage.getItem(LEGACY_TOUR_KEY);
    if (legacy === 'true') {
      await AsyncStorage.setItem(KEY, 'completed');
      __DEV__ && console.log('[Walkthrough] Migrated legacy tour-completed flag → completed');
    }
    // Always clear the legacy key so it doesn't linger
    await AsyncStorage.removeItem(LEGACY_TOUR_KEY);
  } catch (e) {
    __DEV__ && console.log('[Walkthrough] Legacy migration failed:', e);
  }
}

export async function getWalkthroughPromptState(): Promise<WalkthroughPromptState> {
  await migrateLegacyIfNeeded();
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw === 'completed' || raw === 'never') return raw;
    return 'pending';
  } catch {
    return 'pending';
  }
}

export async function setWalkthroughPromptState(state: WalkthroughPromptState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, state);
  } catch (e) {
    __DEV__ && console.log('[Walkthrough] Failed to persist prompt state:', e);
  }
}

/**
 * Should we show the "take the walkthrough?" prompt right now?
 * Returns true only when state === 'pending'. Always false for 'completed' or 'never'.
 */
export async function shouldPromptWalkthrough(): Promise<boolean> {
  const state = await getWalkthroughPromptState();
  return state === 'pending';
}
