import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AppProvider, useAppContext } from "@/context/AppContext";
import { SubscriptionProvider, useSubscription } from "@/context/SubscriptionContext";
import { WorkoutTrackingProvider, useWorkoutTracking } from "@/context/WorkoutTrackingContext";
import { SeventyFiveHardProvider } from "@/context/SeventyFiveHardContext";
import { NutritionProvider } from "@/context/NutritionContext";
import { RunProvider } from "@/context/RunContext";
import { TrainProvider } from "@/context/TrainContext";
// Register the background run-tracking task at module-scope before any call
// to Location.startLocationUpdatesAsync. This side-effect import is REQUIRED —
// TaskManager.defineTask must run before the OS tries to wake the JS runtime.
import "@/services/runBackgroundTask";
import {
  initNotificationService,
  ACTION_SKIP,
  ACTION_MINUS_15,
  ACTION_PLUS_15,
} from "@/services/notificationService";
import {
  useFonts,
  Outfit_300Light,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
} from "@expo-google-fonts/outfit";
import {
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
} from "@expo-google-fonts/playfair-display";

void SplashScreen.preventAutoHideAsync();

// Suppress specific React 19 / Reanimated warnings
const _originalConsoleError = console.error;
console.error = (...args: Parameters<typeof console.error>) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('Accessing element.ref was removed')
  ) {
    return;
  }
  _originalConsoleError(...args);
};

const queryClient = new QueryClient();
const isExpoGo = Constants.executionEnvironment === 'storeClient';

function NotificationHandler() {
  const { adjustRestTimer, cancelRestTimer } = useWorkoutTracking();
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web' || (Platform.OS === 'android' && isExpoGo)) return;
    if (hasInitialized.current) return;
    
    hasInitialized.current = true;
    void initNotificationService();

    let responseSub: { remove: () => void } | null = null;

    (async () => {
      try {
        const Notifications = await import('expo-notifications');
        responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
          const actionId = response.actionIdentifier;
          if (actionId === ACTION_SKIP) {
            cancelRestTimer();
          } else if (actionId === ACTION_MINUS_15) {
            adjustRestTimer(-15);
          } else if (actionId === ACTION_PLUS_15) {
            adjustRestTimer(15);
          }
        });
      } catch (e) {
        __DEV__ && console.log('[NotifHandler] Notification error:', e);
      }
    })();

    return () => {
      responseSub?.remove();
    };
  }, [adjustRestTimer, cancelRestTimer]);

  return null;
}

function RootLayoutNav() {
  const { loaded, isLoggedIn } = useAppContext();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!loaded) return;

    // Check if we are currently in the auth/onboarding screens
    const inAuthGroup = segments[0] === "login" || segments[0] === "onboarding" || segments[0] === "auth";

    if (!isLoggedIn && !inAuthGroup) {
      // Redirect to login if NOT logged in and NOT already in auth
      router.replace("/login");
    } else if (isLoggedIn && inAuthGroup) {
      // Redirect to home if logged in and trying to go to auth
      router.replace("/(tabs)");
    }
  }, [loaded, isLoggedIn, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" options={{ animation: "none" }} />
      <Stack.Screen name="auth/callback" options={{ animation: "none" }} />
      <Stack.Screen name="onboarding" options={{ animation: "fade" }} />
      <Stack.Screen
        name="walkthrough"
        options={{ presentation: 'modal', animation: 'slide_from_bottom', gestureEnabled: false }}
      />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

/**
 * After the user lands inside the app (post-login, post-onboarding), check
 * if the walkthrough prompt should fire. Shows a 3-option alert:
 *   - Take the tour    → opens /walkthrough, marks 'completed' on finish
 *   - Skip for now     → leaves state as 'pending', will re-prompt next login
 *   - Don't show again → marks 'never', won't auto-prompt again
 *
 * Manual replay from Settings always works regardless of state.
 */
function WalkthroughPromptHandler() {
  const { loaded, isLoggedIn, onboardingComplete } = useAppContext();
  const router = useRouter();
  const segments = useSegments();
  const promptedRef = useRef(false);

  useEffect(() => {
    if (!loaded || !isLoggedIn || !onboardingComplete) return;
    if (promptedRef.current) return;
    // Only prompt when we're actually inside the tabs (not still in auth/onboarding flow)
    const inAuthGroup = segments[0] === 'login' || segments[0] === 'onboarding';
    if (inAuthGroup) return;

    promptedRef.current = true;

    // Defer slightly so we don't fight the route transition animation
    const timer = setTimeout(async () => {
      const { shouldPromptWalkthrough, setWalkthroughPromptState } = await import(
        '@/services/walkthroughPrompt'
      );
      const should = await shouldPromptWalkthrough();
      if (!should) return;

      const { Alert } = await import('react-native');
      Alert.alert(
        'Want a quick tour?',
        'Take a 60-second walkthrough so you know exactly what Zeal+ can do.',
        [
          {
            text: 'Don\'t show again',
            style: 'destructive',
            onPress: () => { void setWalkthroughPromptState('never'); },
          },
          {
            text: 'Skip for now',
            style: 'cancel',
            // Leaves state as 'pending' — re-prompts on next login
          },
          {
            text: 'Take the tour',
            style: 'default',
            onPress: () => router.push('/walkthrough'),
          },
        ],
        { cancelable: false },
      );
    }, 800);

    return () => clearTimeout(timer);
  }, [loaded, isLoggedIn, onboardingComplete, segments, router]);

  return null;
}

function AutoGenerateTodayWorkout() {
  const { loaded, isLoggedIn } = useAppContext();
  const segments = useSegments();
  const tracking = useWorkoutTracking();
  const { proStatusReady } = useSubscription();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    if (!loaded) return;
    if (!isLoggedIn) return;
    if (!proStatusReady) return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'onboarding';
    if (inAuthGroup) return;

    startedRef.current = true;
    void tracking.ensureTodayWorkoutGenerated();
  }, [loaded, isLoggedIn, proStatusReady, segments, tracking]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Outfit_300Light,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    PlayfairDisplay_500Medium,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          <AppProvider>
            <SubscriptionProvider>
              <WorkoutTrackingProvider>
                <SeventyFiveHardProvider>
                  <NutritionProvider>
                    <RunProvider>
                      <TrainProvider>
                        <BottomSheetModalProvider>
                          <NotificationHandler />
                          <AutoGenerateTodayWorkout />
                          <WalkthroughPromptHandler />
                          <RootLayoutNav />
                        </BottomSheetModalProvider>
                      </TrainProvider>
                    </RunProvider>
                  </NutritionProvider>
                </SeventyFiveHardProvider>
              </WorkoutTrackingProvider>
            </SubscriptionProvider>
          </AppProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
