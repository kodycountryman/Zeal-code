import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useAppContext } from '@/context/AppContext';
import { completeOAuthSignIn, getOrCreateProfile } from '@/services/supabase';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { login, setGooglePrefill } = useAppContext();
  const callbackUrl = Linking.useURL();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;

    void (async () => {
      try {
        const url = callbackUrl ?? await Linking.getInitialURL();
        if (!url) return;
        handledRef.current = true;

        const session = await completeOAuthSignIn(url);
        const profile = await getOrCreateProfile(session.user.id);
        const name = session.user.user_metadata?.full_name ?? profile?.name ?? '';
        const photoUri = session.user.user_metadata?.avatar_url ?? profile?.photo_uri ?? null;
        if (name) setGooglePrefill({ name, photoUri });

        if (profile?.onboarding_complete) {
          login();
          router.replace('/(tabs)');
        } else {
          router.replace('/onboarding');
        }
      } catch (error) {
        __DEV__ && console.error('[AuthCallback] OAuth callback failed:', error);
        router.replace('/login');
      }
    })();
  }, [callbackUrl, login, router, setGooglePrefill]);

  return (
    <View style={styles.root}>
      <ActivityIndicator color="#f87116" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0e0e0e',
  },
});
