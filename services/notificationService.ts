import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === 'storeClient';
const isNotificationsDisabled = Platform.OS === 'web' || (Platform.OS === 'android' && isExpoGo);

export const NOTIF_ID_REST_TIMER = 'zeal_rest_timer';
export const NOTIF_ID_REST_COMPLETE = 'zeal_rest_complete';
export const NOTIF_ID_DAILY_REMINDER = 'zeal_daily_reminder';
export const NOTIF_ID_STREAK_REMINDER = 'zeal_streak_reminder';
export const NOTIF_ID_WEEKLY_SUMMARY = 'zeal_weekly_summary';
export const NOTIF_ID_RUN_REMINDER = 'zeal_run_reminder';
export const NOTIF_ID_RUN_PRE_REMINDER = 'zeal_run_pre_reminder';
export const NOTIF_ID_RUN_STREAK_REMINDER = 'zeal_run_streak_reminder';
export const NOTIF_ID_RUN_MILESTONE = 'zeal_run_milestone';

export const ACTION_SKIP = 'SKIP_REST';
export const ACTION_MINUS_15 = 'MINUS_15';
export const ACTION_PLUS_15 = 'PLUS_15';

const CATEGORY_REST_TIMER = 'rest_timer';

export type NotifPermissionStatus = 'granted' | 'denied' | 'undetermined';

async function getNotificationsModule() {
  if (isNotificationsDisabled) return null;
  try {
    const mod = await import('expo-notifications');
    return mod;
  } catch (e) {
    __DEV__ && console.log('[NotifService] Failed to load expo-notifications:', e);
    return null;
  }
}

function buildProgressBar(remaining: number, total: number): string {
  const ratio = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const filled = Math.round(ratio * 10);
  const empty = 10 - filled;
  const pct = Math.round(ratio * 100);
  return '█'.repeat(filled) + '░'.repeat(empty) + `  ${pct}%`;
}

function formatTime(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.max(0, seconds) % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

async function setupNotificationCategories(): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;
  try {
    await Notifications.setNotificationCategoryAsync(CATEGORY_REST_TIMER, [
      {
        identifier: ACTION_SKIP,
        buttonTitle: 'Skip Rest',
        options: { isDestructive: false, isAuthenticationRequired: false },
      },
      {
        identifier: ACTION_MINUS_15,
        buttonTitle: '−15s',
        options: { isDestructive: false, isAuthenticationRequired: false },
      },
      {
        identifier: ACTION_PLUS_15,
        buttonTitle: '+15s',
        options: { isDestructive: false, isAuthenticationRequired: false },
      },
    ]);
    __DEV__ && console.log('[NotifService] Categories registered');
  } catch (e) {
    __DEV__ && console.log('[NotifService] Category setup error:', e);
  }
}

export async function initNotificationService(): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    await setupNotificationCategories();
    __DEV__ && console.log('[NotifService] Initialized');
  } catch (e) {
    __DEV__ && console.log('[NotifService] Init error:', e);
  }
}

export async function requestNotificationPermissions(): Promise<NotifPermissionStatus> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return 'denied';
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return 'granted';
    if (existing === 'denied') return 'denied';
    const { status } = await Notifications.requestPermissionsAsync();
    __DEV__ && console.log('[NotifService] Permission result:', status);
    return status as NotifPermissionStatus;
  } catch (e) {
    __DEV__ && console.log('[NotifService] Permission error:', e);
    return 'denied';
  }
}

export async function getNotificationPermissionStatus(): Promise<NotifPermissionStatus> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return 'denied';
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status as NotifPermissionStatus;
  } catch (e) {
    return 'undetermined';
  }
}

export function openNotificationSettings(): void {
  if (Platform.OS === 'ios') {
    void Linking.openURL('app-settings:');
  } else {
    void Linking.openSettings();
  }
}

export async function showRestTimerNotification(remaining: number, total: number): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;
  try {
    const progress = buildProgressBar(remaining, total);
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_ID_REST_TIMER,
      content: {
        title: `🏋️  Rest — ${formatTime(remaining)}`,
        body: progress,
        categoryIdentifier: CATEGORY_REST_TIMER,
        sound: false,
        data: { type: 'rest_timer' },
      },
      trigger: null,
    });
  } catch (e) {
    __DEV__ && console.log('[NotifService] showRestTimerNotification error:', e);
  }
}

export async function dismissRestTimerNotification(): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;
  try {
    await Notifications.dismissNotificationAsync(NOTIF_ID_REST_TIMER);
  } catch (e) {
    __DEV__ && console.log('[NotifService] dismissRestTimerNotification error:', e);
  }
}

export async function scheduleRestCompleteNotification(secondsFromNow: number): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIF_ID_REST_COMPLETE).catch(() => {});
    if (secondsFromNow <= 0) return;
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_ID_REST_COMPLETE,
      content: {
        title: '✅  Rest Complete',
        body: "Time to crush the next set. Let's go!",
        sound: true,
        data: { type: 'rest_complete' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsFromNow,
      },
    });
    __DEV__ && console.log('[NotifService] Rest complete scheduled in', secondsFromNow, 's');
  } catch (e) {
    __DEV__ && console.log('[NotifService] scheduleRestCompleteNotification error:', e);
  }
}

export async function cancelRestCompleteNotification(): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIF_ID_REST_COMPLETE).catch(() => {});
    await Notifications.dismissNotificationAsync(NOTIF_ID_REST_COMPLETE).catch(() => {});
  } catch (e) {
    __DEV__ && console.log('[NotifService] cancelRestCompleteNotification error:', e);
  }
}

export async function scheduleDailyReminder(hour: number, minute: number): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIF_ID_DAILY_REMINDER).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_ID_DAILY_REMINDER,
      content: {
        title: '🔥  Time to Train',
        body: "Your workout is dialed in and ready. Let's get after it.",
        sound: true,
        data: { type: 'daily_reminder' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    __DEV__ && console.log('[NotifService] Daily reminder set for', hour, ':', minute);
  } catch (e) {
    __DEV__ && console.log('[NotifService] scheduleDailyReminder error:', e);
  }
}

export async function cancelDailyReminder(): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIF_ID_DAILY_REMINDER).catch(() => {});
  } catch (e) {
    __DEV__ && console.log('[NotifService] cancelDailyReminder error:', e);
  }
}

export async function scheduleStreakReminder(hour: number, minute: number): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIF_ID_STREAK_REMINDER).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_ID_STREAK_REMINDER,
      content: {
        title: "🔥  Don't Break the Streak",
        body: "You haven't trained yet today. Keep the streak alive.",
        sound: true,
        data: { type: 'streak_reminder' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    __DEV__ && console.log('[NotifService] Streak reminder set for', hour, ':', minute);
  } catch (e) {
    __DEV__ && console.log('[NotifService] scheduleStreakReminder error:', e);
  }
}

export async function cancelStreakReminder(): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIF_ID_STREAK_REMINDER).catch(() => {});
  } catch (e) {
    __DEV__ && console.log('[NotifService] cancelStreakReminder error:', e);
  }
}

export async function scheduleWeeklySummary(stats: {
  workouts: number;
  hoursStr: string;
  sets: number;
  /** Optional run stats — included in the summary body when present */
  runs?: number;
  /** Pre-formatted distance string, e.g. "12.4 mi" or "20.1 km" */
  runDistanceStr?: string;
  /** Pre-formatted average pace, e.g. "8:42/mi" — omit if no runs */
  avgPaceStr?: string;
}): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIF_ID_WEEKLY_SUMMARY).catch(() => {});

    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
    const nextSunday = new Date(now);
    nextSunday.setDate(now.getDate() + daysUntilSunday);
    nextSunday.setHours(19, 0, 0, 0);

    const secondsUntil = Math.floor((nextSunday.getTime() - now.getTime()) / 1000);
    if (secondsUntil <= 0) return;

    const hasStrength = stats.workouts > 0;
    const hasRuns = (stats.runs ?? 0) > 0;
    let body: string;
    if (hasStrength && hasRuns) {
      const runFragment = stats.avgPaceStr
        ? `${stats.runs} run${stats.runs !== 1 ? 's' : ''} · ${stats.runDistanceStr} · ${stats.avgPaceStr}`
        : `${stats.runs} run${stats.runs !== 1 ? 's' : ''} · ${stats.runDistanceStr}`;
      body = `${stats.workouts} workout${stats.workouts !== 1 ? 's' : ''} · ${stats.hoursStr} · ${stats.sets} sets\n${runFragment}`;
    } else if (hasStrength) {
      body = `${stats.workouts} workout${stats.workouts !== 1 ? 's' : ''} · ${stats.hoursStr} trained · ${stats.sets} sets logged. Keep it going.`;
    } else if (hasRuns) {
      body = stats.avgPaceStr
        ? `${stats.runs} run${stats.runs !== 1 ? 's' : ''} · ${stats.runDistanceStr} · avg ${stats.avgPaceStr}. Keep building.`
        : `${stats.runs} run${stats.runs !== 1 ? 's' : ''} · ${stats.runDistanceStr}. Keep building.`;
    } else {
      body = "A new week is a fresh start. Let's build something great.";
    }

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_ID_WEEKLY_SUMMARY,
      content: {
        title: '📊  Your Zeal Week',
        body,
        sound: true,
        data: { type: 'weekly_summary' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsUntil,
      },
    });
    __DEV__ && console.log('[NotifService] Weekly summary scheduled in', secondsUntil, 's');
  } catch (e) {
    __DEV__ && console.log('[NotifService] scheduleWeeklySummary error:', e);
  }
}

export async function cancelWeeklySummary(): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIF_ID_WEEKLY_SUMMARY).catch(() => {});
  } catch (e) {
    __DEV__ && console.log('[NotifService] cancelWeeklySummary error:', e);
  }
}

// ─── Run-Mode Notifications ───────────────────────────────────────────────

/**
 * Schedule a one-shot reminder for a planned run. Used by the run plan engine
 * to fire "Time for your run!" at the runner's preferred time on a plan day.
 *
 * `dateTime` should be the target moment in the future. Idempotent — replaces
 * any previously-scheduled run reminder.
 */
export async function scheduleRunReminder(dateTime: Date, runDescription: string): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;
  try {
    const secondsUntil = Math.floor((dateTime.getTime() - Date.now()) / 1000);
    if (secondsUntil <= 0) return;

    await Notifications.cancelScheduledNotificationAsync(NOTIF_ID_RUN_REMINDER).catch(() => {});

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_ID_RUN_REMINDER,
      content: {
        title: '🏃  Time for your run',
        body: runDescription || 'Your run is ready when you are. Tap to start.',
        sound: true,
        data: { type: 'run_reminder' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsUntil,
      },
    });
    __DEV__ && console.log('[NotifService] Run reminder scheduled in', secondsUntil, 's');
  } catch (e) {
    __DEV__ && console.log('[NotifService] scheduleRunReminder error:', e);
  }
}

/**
 * Schedule the "30 minutes out" pre-run reminder, separate from the main one
 * so the user gets two pings: one well in advance, one as the time approaches.
 */
export async function scheduleRunPreReminder(runDateTime: Date, runDescription: string): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;
  try {
    const PRE_OFFSET_SEC = 30 * 60;
    const secondsUntilPre = Math.floor((runDateTime.getTime() - Date.now()) / 1000) - PRE_OFFSET_SEC;
    if (secondsUntilPre <= 0) return;

    await Notifications.cancelScheduledNotificationAsync(NOTIF_ID_RUN_PRE_REMINDER).catch(() => {});

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_ID_RUN_PRE_REMINDER,
      content: {
        title: '⏱  Run in 30 min',
        body: `Heads up — ${runDescription || 'your run'} is coming up in half an hour.`,
        sound: true,
        data: { type: 'run_pre_reminder' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsUntilPre,
      },
    });
  } catch (e) {
    __DEV__ && console.log('[NotifService] scheduleRunPreReminder error:', e);
  }
}

export async function cancelRunReminders(): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIF_ID_RUN_REMINDER).catch(() => {});
    await Notifications.cancelScheduledNotificationAsync(NOTIF_ID_RUN_PRE_REMINDER).catch(() => {});
  } catch (e) {
    __DEV__ && console.log('[NotifService] cancelRunReminders error:', e);
  }
}

/**
 * Schedule a recurring daily run-streak reminder. Fires at the given local
 * time every day; the body is generic so it can be re-used regardless of
 * whether the streak is intact or not. The handler should silently skip
 * displaying it if the user has already run today (or use streakActive=false
 * to convey that to the user).
 */
export async function scheduleRunStreakReminder(hour: number, minute: number): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIF_ID_RUN_STREAK_REMINDER).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_ID_RUN_STREAK_REMINDER,
      content: {
        title: '🔥  Don\'t break your run streak',
        body: 'You haven\'t run yet today. Lace up — even a short one keeps the streak alive.',
        sound: true,
        data: { type: 'run_streak_reminder' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    __DEV__ && console.log('[NotifService] Run streak reminder set for', hour, ':', minute);
  } catch (e) {
    __DEV__ && console.log('[NotifService] scheduleRunStreakReminder error:', e);
  }
}

export async function cancelRunStreakReminder(): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIF_ID_RUN_STREAK_REMINDER).catch(() => {});
  } catch (e) {
    __DEV__ && console.log('[NotifService] cancelRunStreakReminder error:', e);
  }
}

/**
 * Fire an immediate milestone notification for a newly-earned PR or badge.
 * Body is the celebration message; this is non-scheduled — it appears right
 * after a run save when the user closes the app or switches away.
 *
 * Use a unique trailing key in the identifier so multiple milestones in the
 * same run don't overwrite each other.
 */
export async function presentRunMilestoneNotification(
  title: string,
  body: string,
  uniqueKey: string,
): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: `${NOTIF_ID_RUN_MILESTONE}_${uniqueKey}`,
      content: {
        title,
        body,
        sound: true,
        data: { type: 'run_milestone', key: uniqueKey },
      },
      // 1-second trigger so the notification fires even when the app is foregrounded
      // (foreground notifications still respect iOS's display rules; the small
      // delay also lets the post-run summary modal show first if open).
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
      },
    });
    __DEV__ && console.log('[NotifService] Milestone notification queued:', title);
  } catch (e) {
    __DEV__ && console.log('[NotifService] presentRunMilestoneNotification error:', e);
  }
}
