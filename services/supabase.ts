import { createClient } from '@supabase/supabase-js';
import type { Session } from '@supabase/supabase-js';
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

function parseOAuthParams(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const [, queryAndHash = ''] = url.split('?');
  const [query = '', hash = ''] = queryAndHash.split('#');
  const hashOnly = url.includes('#') ? url.split('#')[1] ?? '' : hash;

  for (const chunk of [hashOnly, query]) {
    if (!chunk) continue;
    const searchParams = new URLSearchParams(chunk);
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
  }

  return params;
}

export async function completeOAuthSignIn(callbackUrl: string): Promise<Session> {
  const params = parseOAuthParams(callbackUrl);

  if (params.error || params.error_description) {
    throw new Error(params.error_description || params.error || 'OAuth sign in failed');
  }

  if (params.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
    if (!data.session) throw new Error('No session returned from OAuth code exchange');
    return data.session;
  }

  if (params.access_token && params.refresh_token) {
    const { data, error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) throw error;
    if (!data.session) throw new Error('No session returned from OAuth token callback');
    return data.session;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error('OAuth callback did not include a usable session');
  return data.session;
}

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
