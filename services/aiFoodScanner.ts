/**
 * AI Food Scanner — Uses Gemini Vision to estimate food nutrition from a photo.
 */
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

const gemini = google('gemini-2.0-flash');

// ─── Zod schema for AI response ──────────────────────────

export const FoodEstimateSchema = z.object({
  foods: z.array(
    z.object({
      name: z.string().describe('Name of the food item, e.g. "Grilled Chicken Breast"'),
      estimatedServingGrams: z.number().describe('Estimated serving size in grams'),
      nutrients: z.object({
        calories: z.number().describe('Estimated calories'),
        protein: z.number().describe('Estimated protein in grams'),
        fat: z.number().describe('Estimated fat in grams'),
        carbs: z.number().describe('Estimated carbs in grams'),
        fiber: z.number().optional().describe('Estimated fiber in grams'),
        sugar: z.number().optional().describe('Estimated sugar in grams'),
      }),
      confidence: z.enum(['high', 'medium', 'low']).describe('Confidence in the estimation'),
    }),
  ),
});

export type AIFoodResult = z.infer<typeof FoodEstimateSchema>;

// ─── Launch camera and capture food photo ─────────────────

export async function captureFood(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    __DEV__ && console.log('[AIFoodScanner] Camera permission denied');
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.7,
    base64: false,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0].uri;
}

// ─── Analyze food photo with Gemini ──────────────────────

export async function analyzeFood(imageUri: string): Promise<AIFoodResult> {
  // Read image as base64
  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

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
              type: 'image',
              image: `data:image/jpeg;base64,${base64}`,
            },
            {
              type: 'text',
              text: `Analyze this food photo and estimate the nutritional content of each food item visible.

For each food item, provide:
- A descriptive name
- Estimated serving size in grams (based on visual portion)
- Estimated macros: calories, protein, fat, carbs (and fiber/sugar if identifiable)
- Your confidence level (high/medium/low)

Be as accurate as possible with portion estimates. If multiple distinct food items are visible, list each separately.`,
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

// ─── Full capture + analyze flow ─────────────────────────

export async function scanFood(): Promise<AIFoodResult | null> {
  const uri = await captureFood();
  if (!uri) return null;

  try {
    return await analyzeFood(uri);
  } catch (e) {
    __DEV__ && console.error('[AIFoodScanner] Analysis error:', e);
    throw e;
  }
}
