import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { AppProvider, useAppContext } from "@/context/AppContext";
import { SubscriptionProvider, useSubscription } from "@/context/SubscriptionContext";
import { WorkoutTrackingProvider, useWorkoutTracking } from "@/context/WorkoutTrackingContext";
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
        console.log('[NotifHandler] Notification error:', e);
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
    const inAuthGroup = segments[0] === "login" || segments[0] === "onboarding";

    if (!isLoggedIn && !inAuthGroup) {
      // Redirect to login if NOT logged in and NOT already in auth
      router.replace("/login");
    } else if (isLoggedIn && inAuthGroup) {
      // Redirect to home if logged in and trying to go to auth
      router.replace("/(tabs)");
    }
  }, [loaded, isLoggedIn, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" options={{ animation: "none" }} />
      <Stack.Screen name="onboarding" options={{ animation: "fade" }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <SubscriptionProvider>
            <WorkoutTrackingProvider>
              <BottomSheetModalProvider>
                <NotificationHandler />
                <AutoGenerateTodayWorkout />
                <RootLayoutNav />
              </BottomSheetModalProvider>
            </WorkoutTrackingProvider>
          </SubscriptionProvider>
        </AppProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}