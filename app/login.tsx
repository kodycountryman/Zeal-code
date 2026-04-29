import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Linking,
  Dimensions,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { PlatformIcon } from '@/components/PlatformIcon';
import type { AppIconName } from '@/constants/iconMap';
import { useAppContext } from '@/context/AppContext';
// expo-apple-authentication is a native module — dynamic-imported inside
// handleAppleSignIn so the app still loads in Expo Go (which doesn't ship
// the native binary). expo-web-browser is fine to import statically.
import * as WebBrowser from 'expo-web-browser';
import { supabase, getOrCreateProfile } from '@/services/supabase';

WebBrowser.maybeCompleteAuthSession();

const { width } = Dimensions.get('window');
const ACCENT = '#f87116';
const BG = '#0e0e0e';

const BULLETS: { icon: AppIconName; text: string }[] = [
  { icon: 'zap', text: 'Sessions built from elite coaching science' },
  { icon: 'calendar', text: 'Streak tracking & style-colored calendar' },
  { icon: 'trending-up', text: 'Adapts to your feedback over time' },
];

export default function LoginScreen() {
  const router = useRouter();
  const { onboardingComplete, userName, login, setGooglePrefill } = useAppContext();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const btnScale = useRef(new Animated.Value(1)).current;
  const returnBtnScale = useRef(new Animated.Value(1)).current;
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  const hasExistingAccount = onboardingComplete;
  const displayName = userName && userName.trim().length > 0 ? userName.trim() : null;

  // ── Apple Sign In ────────────────────────────────────────────────
  const handleAppleSignIn = async () => {
    if (Platform.OS !== 'ios') return;
    setAppleLoading(true);
    try {
      // Dynamic import — expo-apple-authentication is a native module that
      // isn't bundled with Expo Go. Importing at module top would crash the
      // app on load in Expo Go even though no one tapped the button.
      const AppleAuthentication = await import('expo-apple-authentication');
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken!,
      });

      if (error) throw error;

      const profile = await getOrCreateProfile(data.user!.id);
      const name = credential.fullName?.givenName
        ? `${credential.fullName.givenName} ${credential.fullName.familyName ?? ''}`.trim()
        : profile?.name ?? '';

      if (name) setGooglePrefill({ name, photoUri: null });

      if (profile?.onboarding_complete) {
        login();
      } else {
        router.push('/onboarding');
      }
    } catch (err: any) {
      if (err?.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Sign In Failed', 'Could not sign in with Apple. Please try again.');
        __DEV__ && console.error('[Login] Apple sign in error:', err);
      }
    } finally {
      setAppleLoading(false);
    }
  };

  // ── Google Sign In ───────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'zeal-plus://auth/callback',
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('No OAuth URL returned');

      const result = await WebBrowser.openAuthSessionAsync(data.url, 'zeal-plus://');

      if (result.type === 'success') {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          const profile = await getOrCreateProfile(sessionData.session.user.id);
          const name = sessionData.session.user.user_metadata?.full_name ?? profile?.name ?? '';
          const photoUri = sessionData.session.user.user_metadata?.avatar_url ?? null;
          if (name) setGooglePrefill({ name, photoUri });

          if (profile?.onboarding_complete) {
            login();
          } else {
            router.push('/onboarding');
          }
        }
      }
    } catch (err: any) {
      Alert.alert('Sign In Failed', 'Could not sign in with Google. Please try again.');
      __DEV__ && console.error('[Login] Google sign in error:', err);
    } finally {
      setGoogleLoading(false);
    }
  };

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 18,
        stiffness: 120,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        damping: 14,
        stiffness: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const proceedToOnboarding = () => {
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(btnScale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start(() => {
      router.push('/onboarding');
    });
  };

  const handleGetStarted = () => {
    if (hasExistingAccount) {
      Alert.alert(
        'Start Over?',
        `You already have a profile${displayName ? ` as ${displayName}` : ''}. Going through setup again will overwrite your current settings and preferences.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue Anyway', style: 'destructive', onPress: proceedToOnboarding },
        ],
      );
      return;
    }
    proceedToOnboarding();
  };

  const handleContinue = () => {
    Animated.sequence([
      Animated.timing(returnBtnScale, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(returnBtnScale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start(() => {
      login();
    });
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#1a0a00', '#0e0e0e', '#0e0e0e']}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe}>
        <Animated.View
          style={[
            styles.container,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.logoBlock}>
            <Animated.View style={[styles.logoWrap, { transform: [{ scale: logoScale }] }]}>
              <Image
                source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/xstmi3v2rshzl2exxxh6k' }}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </Animated.View>

            <Text
              style={styles.headline}
              numberOfLines={3}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              What if every workout pushed you closer to your goal?
            </Text>
          </View>

          <View style={styles.bullets}>
            {BULLETS.map(({ icon, text }, i) => (
              <View key={i} style={styles.bulletRow}>
                <View style={styles.bulletIconWrap}>
                  <PlatformIcon name={icon} size={16} color={ACCENT} strokeWidth={2.5} />
                </View>
                <Text style={styles.bulletText} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>{text}</Text>
              </View>
            ))}
          </View>

          <View style={styles.taglineBlock}>
            <Text style={styles.taglineWord}>zeal</Text>
            <Text style={styles.tagline}>
              great energy or enthusiasm in pursuit of{'\n'}a cause or an objective.
            </Text>
          </View>

          <View style={styles.bottomBlock}>
            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <TouchableOpacity
                style={styles.ctaBtn}
                onPress={handleGetStarted}
                activeOpacity={0.88}
                testID="get-started-btn"
              >
                <LinearGradient
                  colors={['#ff8c35', '#f87116', '#d96010']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.ctaGradient}
                >
                  <Text style={styles.ctaText}>Get Started</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>OR</Text>
              <View style={styles.orLine} />
            </View>

            {/* Apple Sign In — iOS only */}
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[styles.socialBtn, appleLoading && styles.socialBtnDisabled]}
                onPress={handleAppleSignIn}
                activeOpacity={0.8}
                disabled={appleLoading}
                testID="apple-signin-btn"
              >
                {appleLoading ? (
                  <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" />
                ) : (
                  <>
                    <PlatformIcon name="apple" size={18} color="#ffffff" />
                    <Text style={styles.socialBtnText}>Continue with Apple</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Google Sign In */}
            <TouchableOpacity
              style={[styles.socialBtn, googleLoading && styles.socialBtnDisabled]}
              onPress={handleGoogleSignIn}
              activeOpacity={0.8}
              disabled={googleLoading}
              testID="google-signin-btn"
            >
              {googleLoading ? (
                <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" />
              ) : (
                <>
                  <View style={styles.googleIconWrap}>
                    <Text style={[styles.googleIconText, { fontSize: 18 }]}>G</Text>
                  </View>
                  <Text style={styles.socialBtnText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            {hasExistingAccount && (
              <Animated.View style={{ transform: [{ scale: returnBtnScale }] }}>
                <TouchableOpacity
                  style={styles.returnBtn}
                  onPress={handleContinue}
                  activeOpacity={0.82}
                  testID="continue-btn"
                >
                  <Text style={styles.returnBtnText}>
                    {displayName ? `Continue as ${displayName}` : 'Log In'}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            )}

            <View style={styles.legalRow}>
              <TouchableOpacity
                onPress={() => Linking.openURL('https://zealplus.app/privacy-policy.html')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.legalText}>Privacy Policy</Text>
              </TouchableOpacity>
              <Text style={styles.legalDot}>·</Text>
              <TouchableOpacity
                onPress={() => Linking.openURL('https://zealplus.app/terms-of-service.html')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.legalText}>Terms of Service</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  safe: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
    paddingTop: 32,
    paddingBottom: 16,
  },
  logoBlock: {
    alignItems: 'center',
    gap: 28,
  },
  logoWrap: {
    width: 140,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 140,
    height: 80,
  },
  headline: {
    fontSize: 30,
    fontFamily: 'Outfit_700Bold',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  bullets: {
    gap: 14,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  bulletIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(248,113,22,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Outfit_400Regular',
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 22,
  },
  taglineBlock: {
    alignItems: 'center',
    gap: 4,
  },
  taglineWord: {
    fontSize: 13,
    fontFamily: 'Outfit_800ExtraBold',
    color: ACCENT,
    textTransform: 'lowercase',
    letterSpacing: -1.2,
  },
  tagline: {
    fontSize: 13,
    fontFamily: 'Outfit_400Regular',
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  bottomBlock: {
    gap: 12,
  },
  ctaBtn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  ctaGradient: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: 17,
    fontFamily: 'Outfit_700Bold',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  returnBtn: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(248,113,22,0.4)',
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(248,113,22,0.07)',
  },
  returnBtnText: {
    fontSize: 16,
    fontFamily: 'Outfit_600SemiBold',
    color: 'rgba(248,113,22,0.9)',
    letterSpacing: 0.2,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  orText: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 1,
  },
  socialBtn: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  socialBtnDisabled: {
    opacity: 0.6,
  },
  googleIconWrap: {
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIconText: {
    fontFamily: 'Outfit_700Bold',
    color: '#ffffff',
    lineHeight: 22,
  },
  socialBtnText: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.2,
  },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingTop: 2,
  },
  legalText: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
    color: 'rgba(255,255,255,0.3)',
  },
  legalDot: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.2)',
  },
});
