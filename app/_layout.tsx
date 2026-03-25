import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { AppProvider, useAppContext } from "@/context/AppContext";
import { SubscriptionProvider } from "@/context/SubscriptionContext";
import { WorkoutTrackingProvider, useWorkoutTracking } from "@/context/WorkoutTrackingContext";
import {
  initNotificationService,
  ACTION_SKIP,
  ACTION_MINUS_15,
  ACTION_PLUS_15,
} from "@/services/notificationService";
import {
  useFonts,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  Outfit_800ExtraBold,
} from "@expo-google-fonts/outfit";

void SplashScreen.preventAutoHideAsync();

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

  useEffect(() => {
    if (Platform.OS === 'web' || (Platform.OS === 'android' && isExpoGo)) return;
    void initNotificationService();

    let responseSub: { remove: () => void } | null = null;

    (async () => {
      try {
        const Notifications = await import('expo-notifications');
        responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
          const actionId = response.actionIdentifier;
          console.log('[NotifHandler] Action received:', actionId);
          if (actionId === ACTION_SKIP) {
            cancelRestTimer();
          } else if (actionId === ACTION_MINUS_15) {
            adjustRestTimer(-15);
          } else if (actionId === ACTION_PLUS_15) {
            adjustRestTimer(15);
          }
        });
      } catch (e) {
        console.log('[NotifHandler] Failed to load notifications module:', e);
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
    const inAuth = segments[0] === "login" || segments[0] === "onboarding";
    if (!isLoggedIn && !inAuth) {
      console.log("[RootLayoutNav] Not logged in — redirecting to /login");
      void router.replace("/login");
    } else if (isLoggedIn && inAuth) {
      console.log("[RootLayoutNav] Logged in — redirecting to /(tabs)");
      void router.replace("/(tabs)");
    }
  }, [loaded, isLoggedIn]);

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false, animation: "none" }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, animation: "fade" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <SubscriptionProvider>
        <WorkoutTrackingProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <BottomSheetModalProvider>
              <NotificationHandler />
              <RootLayoutNav />
            </BottomSheetModalProvider>
          </GestureHandlerRootView>
        </WorkoutTrackingProvider>
        </SubscriptionProvider>
      </AppProvider>
    </QueryClientProvider>
  );
}
