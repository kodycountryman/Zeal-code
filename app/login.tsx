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
import { Zap, Calendar, TrendingUp } from 'lucide-react-native';
import { useAppContext } from '@/context/AppContext';

const { width } = Dimensions.get('window');
const ACCENT = '#f87116';
const BG = '#0e0e0e';

const BULLETS = [
  { icon: Zap, text: 'Sessions built from elite coaching science' },
  { icon: Calendar, text: 'Streak tracking & style-colored calendar' },
  { icon: TrendingUp, text: 'Adapts to your feedback over time' },
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
  const [googleAuth, setGoogleAuth] = useState<{
    request: unknown;
    promptAsync: () => Promise<unknown>;
  } | null>(null);
  const [googleResponse, setGoogleResponse] = useState<unknown>(null);

  const hasExistingAccount = onboardingComplete;
  const displayName = userName && userName.trim().length > 0 ? userName.trim() : null;

  useEffect(() => {
    if (Platform.OS === 'web') {
      console.log('[Login] Google auth not supported on web preview');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const WebBrowser = await import('expo-web-browser');
        WebBrowser.maybeCompleteAuthSession();
        console.log('[Login] Google auth modules loaded');
      } catch (err) {
        console.log('[Login] Google auth module not available:', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const resp = googleResponse as { type?: string; authentication?: { accessToken?: string }; params?: Record<string, string> } | null;
    if (resp?.type === 'success') {
      const accessToken = resp.authentication?.accessToken ?? resp.params?.access_token;
      if (!accessToken) {
        console.log('[Login] Google success but no access token');
        setGoogleLoading(false);
        return;
      }
      console.log('[Login] Google auth success, fetching user info...');
      fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
        .then(res => res.json())
        .then((userInfo: { name?: string; given_name?: string; picture?: string }) => {
          const name = userInfo.name ?? userInfo.given_name ?? '';
          const photoUri = userInfo.picture ?? null;
          console.log('[Login] Google user:', name, photoUri ? 'has photo' : 'no photo');
          setGooglePrefill({ name, photoUri });
          setGoogleLoading(false);
          router.push('/onboarding');
        })
        .catch(err => {
          console.log('[Login] Failed to fetch Google user info:', err);
          setGoogleLoading(false);
        });
    } else if (resp?.type === 'error' || resp?.type === 'dismiss' || resp?.type === 'cancel') {
      setGoogleLoading(false);
    }
  }, [googleResponse]);

  const handleGoogleSignIn = () => {
    Alert.alert('Not Configured', 'Google Sign In credentials are not set up yet. Use "Get Started" to create your profile.');
  };

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
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

            <Text style={styles.headline}>
              What if every workout pushed you closer to your goal?
            </Text>
          </View>

          <View style={styles.bullets}>
            {BULLETS.map(({ icon: Icon, text }, i) => (
              <View key={i} style={styles.bulletRow}>
                <View style={styles.bulletIconWrap}>
                  <Icon size={16} color={ACCENT} strokeWidth={2.5} />
                </View>
                <Text style={styles.bulletText}>{text}</Text>
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

            <TouchableOpacity
              style={[styles.googleBtn, googleLoading && styles.googleBtnDisabled]}
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
                  <Text style={styles.googleBtnText}>Continue with Google</Text>
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
                onPress={() => Linking.openURL('https://rork.app/privacy')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.legalText}>Privacy Policy</Text>
              </TouchableOpacity>
              <Text style={styles.legalDot}>·</Text>
              <TouchableOpacity
                onPress={() => Linking.openURL('https://rork.app/terms')}
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
  googleBtn: {
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
  googleBtnDisabled: {
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
  googleBtnText: {
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
