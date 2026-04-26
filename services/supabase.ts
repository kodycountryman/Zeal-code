import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ── Types ──────────────────────────────────────────────────────────
export interface ZealProfile {
  id: string;
  name: string | null;
  photo_uri: string | null;
  training_style: string | null;
  fitness_level: string | null;
  age: number | null;
  goals: string[] | null;
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
}

// ── Profile helpers ────────────────────────────────────────────────
export async function getOrCreateProfile(userId: string): Promise<ZealProfile | null> {
  const { data, error } = await supabase
    .from('zeal_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error && error.code === 'PGRST116') {
    // No row found — create one
    const { data: newProfile, error: insertError } = await supabase
      .from('zeal_profiles')
      .insert({ id: userId })
      .select()
      .single();
    if (insertError) {
      __DEV__ && console.error('[Supabase] Failed to create profile:', insertError);
      return null;
    }
    return newProfile;
  }

  if (error) {
    __DEV__ && console.error('[Supabase] Failed to fetch profile:', error);
    return null;
  }

  return data;
}

export async function updateProfile(userId: string, updates: Partial<Omit<ZealProfile, 'id' | 'created_at' | 'updated_at'>>) {
  const { error } = await supabase
    .from('zeal_profiles')
    .update(updates)
    .eq('id', userId);

  if (error) {
    __DEV__ && console.error('[Supabase] Failed to update profile:', error);
  }
}
