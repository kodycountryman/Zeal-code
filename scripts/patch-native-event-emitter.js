#!/usr/bin/env node
/**
 * Patches react-native NativeEventEmitter to allow null native modules on iOS.
 *
 * React Native 0.81 + iOS 26 beta: PushNotificationManager TurboModule returns
 * null, but NativeEventEmitter has an iOS-specific invariant that throws for null.
 * This patch removes that invariant so the module loads without crashing.
 */

const fs = require('fs');
const path = require('path');

const file = path.join(
  __dirname,
  '..',
  'node_modules/react-native/Libraries/EventEmitter/NativeEventEmitter.js',
);

if (!fs.existsSync(file)) {
  console.log('[patch-nem] NativeEventEmitter.js not found, skipping');
  process.exit(0);
}

const original = fs.readFileSync(file, 'utf8');

// Already patched
if (original.includes('// iOS 26 compat')) {
  console.log('[patch-nem] Already patched, skipping');
  process.exit(0);
}

const patched = original.replace(
  /if \(Platform\.OS === ['"]ios['"]\) \{\s*invariant\(\s*nativeModule != null,\s*['"`]`new NativeEventEmitter\(\)` requires a non-null argument\.[`'"]\s*,?\s*\);\s*\}/s,
  '// iOS 26 compat: allow null modules (PushNotificationManager may not register)',
);

if (patched === original) {
  console.log('[patch-nem] Pattern not matched — may already be patched or changed');
  process.exit(0);
}

fs.writeFileSync(file, patched, 'utf8');
console.log('[patch-nem] NativeEventEmitter.js patched successfully');
