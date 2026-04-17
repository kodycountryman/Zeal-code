/**
 * Run Audio Service
 *
 * Wraps `expo-speech` for run coaching cues — split summaries, pace alerts,
 * halfway cheers, heart rate warnings, interval signals.
 *
 * Design constraints:
 *   - All speech goes through a single `speak()` entry point so the audio
 *     mode can be configured once per utterance (music ducking on iOS).
 *   - `expo-av` Audio.setAudioModeAsync() puts the app in playback mode that
 *     duckss other audio (Spotify, Apple Music, Podcasts) during cues, then
 *     restores normal mode after.
 *   - Throttling: we never want cues to overlap or stack up. A `speakingRef`
 *     queues messages, and dedup tags suppress repeats within a window.
 *   - Preferences-driven: every cue type checks the user's RunPreferences
 *     before firing. The service is a no-op when audioCuesEnabled is false.
 */

import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { RunPreferences } from '@/types/run';

// ─── Internal State ────────────────────────────────────────────────────

interface QueueItem {
  text: string;
  /** Logical "kind" — used for throttle/dedup. */
  kind: string;
  /** When this item was enqueued (ms). */
  enqueuedAt: number;
}

class RunAudioService {
  private isSpeaking = false;
  private queue: QueueItem[] = [];
  /** Timestamps of the last cue per kind for throttling. */
  private lastSpokenAt = new Map<string, number>();
  private audioModeConfigured = false;
  private prefs: RunPreferences | null = null;
  private voiceIdentifier: string | null = null;
  private rate = 1.0;
  private pitch = 1.0;

  // ─── Configuration ────────────────────────────────────────────────────

  setPreferences(prefs: RunPreferences) {
    this.prefs = prefs;
  }

  setVoice(identifier: string | null) {
    this.voiceIdentifier = identifier;
  }

  setSpeechRate(rate: number) {
    this.rate = Math.max(0.5, Math.min(2.0, rate));
  }

  /** Returns the platform's available voices (en-* only by default). */
  async getAvailableVoices(): Promise<Speech.Voice[]> {
    if (Platform.OS === 'web') return [];
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      return voices.filter(v => v.language?.startsWith('en'));
    } catch {
      return [];
    }
  }

  /**
   * Configure the iOS audio session to duck other audio during speech.
   * Idempotent — only runs once per app session.
   */
  private async ensureAudioMode() {
    if (this.audioModeConfigured) return;
    if (Platform.OS === 'web') return;
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        interruptionModeIOS: InterruptionModeIOS.DuckOthers,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
        shouldDuckAndroid: true,
      });
      this.audioModeConfigured = true;
    } catch (e) {
      __DEV__ && console.log('[RunAudio] Failed to configure audio mode:', e);
    }
  }

  // ─── Core Speech Pipeline ─────────────────────────────────────────────

  /**
   * Enqueue a TTS utterance. Throttles by `kind` to prevent the same cue
   * type firing more than once per `throttleMs` window.
   *
   * Use the higher-level `speak*()` methods unless you need a raw cue.
   */
  async speak(text: string, kind = 'generic', throttleMs = 0): Promise<void> {
    if (!this.prefs?.audioCuesEnabled) return;
    if (Platform.OS === 'web') return;
    if (!text || text.trim().length === 0) return;

    if (throttleMs > 0) {
      const last = this.lastSpokenAt.get(kind) ?? 0;
      if (Date.now() - last < throttleMs) return;
    }
    this.lastSpokenAt.set(kind, Date.now());

    this.queue.push({ text, kind, enqueuedAt: Date.now() });
    if (!this.isSpeaking) {
      void this.processQueue();
    }
  }

  private async processQueue() {
    if (this.queue.length === 0 || this.isSpeaking) return;
    const item = this.queue.shift()!;
    this.isSpeaking = true;
    await this.ensureAudioMode();

    try {
      await new Promise<void>((resolve) => {
        Speech.speak(item.text, {
          language: 'en-US',
          rate: this.rate,
          pitch: this.pitch,
          voice: this.voiceIdentifier ?? undefined,
          onDone: () => resolve(),
          onError: (e) => {
            __DEV__ && console.log('[RunAudio] Speech error:', e);
            resolve();
          },
          onStopped: () => resolve(),
        });
      });
    } catch (e) {
      __DEV__ && console.log('[RunAudio] speak threw:', e);
    } finally {
      this.isSpeaking = false;
      // Process the next item (if any)
      if (this.queue.length > 0) void this.processQueue();
    }
  }

  /**
   * Stop any in-flight or queued speech. Used when a run is paused/stopped
   * so leftover cues don't fire after the runner has ended the session.
   */
  async stopAll() {
    this.queue = [];
    if (Platform.OS === 'web') return;
    try {
      await Speech.stop();
    } catch {
      // ignore
    }
  }

  // ─── Cue Helpers (called by RunContext on tracking events) ────────────

  /**
   * Speak a split summary: "Mile 3 complete. Pace 8:15."
   */
  async speakSplit(splitNumber: number, paceSecondsPerUnit: number, units: 'imperial' | 'metric') {
    if (!this.prefs?.audioCueSplits) return;
    const unitWord = units === 'metric' ? 'kilometer' : 'mile';
    const min = Math.floor(paceSecondsPerUnit / 60);
    const sec = Math.round(paceSecondsPerUnit % 60);
    const paceText = `${min} ${sec === 0 ? 'flat' : sec === 1 ? '0 1' : sec < 10 ? `0 ${sec}` : sec}`;
    await this.speak(
      `${unitWord} ${splitNumber} complete. Pace ${paceText}.`,
      `split_${splitNumber}`,
    );
  }

  /**
   * Speak a halfway cue: "Halfway there! 2.5 miles done."
   */
  async speakHalfway(distanceMeters: number, units: 'imperial' | 'metric') {
    if (!this.prefs?.audioCuesEnabled) return;
    const distance = units === 'metric'
      ? `${(distanceMeters / 1000).toFixed(1)} kilometers`
      : `${(distanceMeters / 1609.344).toFixed(1)} miles`;
    await this.speak(`Halfway there. ${distance} done.`, 'halfway');
  }

  /**
   * Speak a pace alert when current pace deviates from the target by more
   * than `toleranceSecPerUnit`. Throttled to once every 60s by default.
   */
  async speakPaceAlert(
    currentSecPerMeter: number,
    targetSecPerMeter: number,
    units: 'imperial' | 'metric',
    toleranceSecPerUnit = 15,
    throttleMs = 60_000,
  ) {
    if (!this.prefs?.audioCuePace) return;
    if (!isFinite(currentSecPerMeter) || currentSecPerMeter <= 0) return;
    if (!isFinite(targetSecPerMeter) || targetSecPerMeter <= 0) return;

    const unitMultiplier = units === 'metric' ? 1000 : 1609.344;
    const currentSecPerUnit = currentSecPerMeter * unitMultiplier;
    const targetSecPerUnit = targetSecPerMeter * unitMultiplier;
    const diff = currentSecPerUnit - targetSecPerUnit;

    if (Math.abs(diff) < toleranceSecPerUnit) return;

    const absSec = Math.abs(Math.round(diff));
    const direction = diff > 0 ? 'behind' : 'ahead of';
    await this.speak(
      `You are ${absSec} seconds ${direction} target pace.`,
      'pace_alert',
      throttleMs,
    );
  }

  /**
   * Speak a heart rate alert when HR exceeds a threshold (typically the
   * top of the user's training zone). Throttled to once every 90s.
   */
  async speakHeartRateAlert(currentBpm: number, maxThresholdBpm: number, throttleMs = 90_000) {
    if (!this.prefs?.audioCueHeartRate) return;
    if (currentBpm <= 0 || currentBpm < maxThresholdBpm) return;
    await this.speak(
      `Heart rate is ${currentBpm}. Consider slowing down.`,
      'hr_alert',
      throttleMs,
    );
  }

  /**
   * Speak a generic interval signal — work segment start.
   */
  async speakIntervalStart(label: string) {
    if (!this.prefs?.audioCuesEnabled) return;
    await this.speak(`Begin interval. ${label}. Three. Two. One. Go!`, 'interval_start');
  }

  /**
   * Speak a recovery segment cue.
   */
  async speakIntervalRecovery() {
    if (!this.prefs?.audioCuesEnabled) return;
    await this.speak('Recovery. Walk or jog easy.', 'interval_recovery');
  }

  /**
   * Lifecycle cues — called by RunContext on start/pause/resume/stop.
   */
  async speakRunStart() {
    if (!this.prefs?.audioCuesEnabled) return;
    await this.speak('Run started. Have a great workout.', 'lifecycle_start');
  }

  async speakRunPaused() {
    if (!this.prefs?.audioCuesEnabled) return;
    await this.speak('Run paused.', 'lifecycle_pause');
  }

  async speakRunResumed() {
    if (!this.prefs?.audioCuesEnabled) return;
    await this.speak('Run resumed.', 'lifecycle_resume');
  }

  async speakRunComplete(distanceMeters: number, units: 'imperial' | 'metric', durationSeconds: number) {
    if (!this.prefs?.audioCuesEnabled) return;
    const distance = units === 'metric'
      ? `${(distanceMeters / 1000).toFixed(2)} kilometers`
      : `${(distanceMeters / 1609.344).toFixed(2)} miles`;
    const totalMin = Math.floor(durationSeconds / 60);
    await this.speak(
      `Run complete. You covered ${distance} in ${totalMin} minutes. Nice work.`,
      'lifecycle_complete',
    );
  }
}

export const runAudioService = new RunAudioService();
