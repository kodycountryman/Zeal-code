/**
 * Voice Food Scanner — Record audio and use Gemini to estimate food nutrition.
 */
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { FoodEstimateSchema, type AIFoodResult } from '@/services/aiFoodScanner';

const gemini = google('gemini-2.0-flash');

// ─── Recording state ─────────────────────────────────────

let _recording: Audio.Recording | null = null;

// ─── Start recording ─────────────────────────────────────

export async function startRecording(): Promise<void> {
  // Request permissions
  const { status } = await Audio.requestPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Microphone permission not granted');
  }

  // Configure audio mode for recording
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  // Start recording with high quality preset
  const { recording } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY,
  );

  _recording = recording;
}

// ─── Stop recording ──────────────────────────────────────

export async function stopRecording(): Promise<string | null> {
  if (!_recording) return null;

  try {
    await _recording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
    });

    const uri = _recording.getURI();
    _recording = null;
    return uri;
  } catch (e) {
    __DEV__ && console.error('[VoiceFoodScanner] Stop recording error:', e);
    _recording = null;
    return null;
  }
}

// ─── Analyze voice recording with Gemini ─────────────────

export async function analyzeVoiceFood(audioUri: string): Promise<AIFoodResult> {
  const base64 = await FileSystem.readAsStringAsync(audioUri, {
    encoding: 'base64',
  });

  // Determine mime type from file extension
  const ext = audioUri.split('.').pop()?.toLowerCase();
  const mimeType = ext === 'wav' ? 'audio/wav'
    : ext === 'mp4' || ext === 'm4a' ? 'audio/mp4'
    : ext === 'webm' ? 'audio/webm'
    : 'audio/mp4'; // default for iOS recordings

  // 30-second timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const { object } = await generateObject({
      model: gemini,
      abortSignal: controller.signal,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              data: base64,
              mediaType: mimeType,
            },
            {
              type: 'text',
              text: `This is a voice recording of someone describing the food they ate.

Listen carefully and extract EACH food item mentioned. For each food item, estimate:
- A descriptive name for the food
- The estimated serving size in grams based on any quantities mentioned (e.g. "two eggs" = ~100g, "a slice of toast" = ~30g)
- Estimated macros: calories, protein, fat, carbs
- Your confidence level (high/medium/low)

If the person mentions quantities (like "two", "a cup of", "a large"), use those to estimate serving sizes.
If no quantity is mentioned, assume a standard single serving.
Be practical and accurate with your estimates.`,
            },
          ],
        },
      ],
      schema: FoodEstimateSchema,
    });

    return object;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Check if currently recording ────────────────────────

export function isRecording(): boolean {
  return _recording !== null;
}
