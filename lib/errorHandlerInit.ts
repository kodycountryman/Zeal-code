/**
 * Global error handler patch — must be imported before any module that
 * lazy-loads expo-notifications or PushNotificationIOS.
 *
 * iOS 26 beta: The PushNotificationManager TurboModule is not properly
 * registered, so NativeEventEmitter throws a fatal invariant when
 * PushNotificationIOS initializes. We intercept that specific error so
 * the app keeps running. Push notifications may be unavailable on iOS 26
 * beta builds but the app won't crash.
 */

declare const ErrorUtils: {
  getGlobalHandler: () => (error: Error, isFatal: boolean) => void;
  setGlobalHandler: (handler: (error: Error, isFatal: boolean) => void) => void;
} | undefined;

if (typeof ErrorUtils !== 'undefined') {
  const _prev = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error: Error, isFatal: boolean) => {
    if (!isFatal) {
      _prev(error, isFatal);
      return;
    }

    const msg = typeof error?.message === 'string' ? error.message : String(error);

    // Known iOS 26 compat suppressions
    const isKnownCompat =
      (msg.includes('NativeEventEmitter') && msg.includes('non-null')) ||
      msg.includes('PushNotificationManager') ||
      msg.includes('TurboModuleRegistry');

    if (isKnownCompat) {
      __DEV__ && console.warn('[Zeal] Suppressed known iOS 26 compat crash:', msg);
      return;
    }

    // Store error globally so it can be displayed once UI is ready.
    // Do NOT call _prev here — that crashes the app before we can read the error.
    try {
      (global as any).__zealFatalError = { message: msg, stack: error?.stack ?? '' };
    } catch {}
    // Suppress crash — app may be in broken state but won't terminate.
    // The error will be shown by ErrorDisplay component once React mounts.
  });
}
