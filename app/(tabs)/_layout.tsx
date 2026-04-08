import React, { useEffect, useRef } from 'react';
import { LogBox } from 'react-native';
import { Tabs } from 'expo-router';
import FloatingDock from '@/components/FloatingDock';
import { useSubscription } from '@/context/SubscriptionContext';
import { ConnectedPaywallModal } from '@/components/PaywallModal';
import ZealTipBanner from '@/components/ZealTipBanner';
import { AppTourProvider, useAppTour } from '@/context/AppTourContext';
import AppTour from '@/components/AppTour';

// WheelPicker uses FlatList inside the workout tab's ScrollView — known RN limitation, works correctly
LogBox.ignoreLogs(['VirtualizedLists should never be nested']);

function TabsWithPaywall() {
  const { loaded, triggerAppOpen } = useSubscription();
  const { tourCompleted, loaded: tourLoaded, startTour } = useAppTour();
  const triggered = useRef(false);
  const tourTriggered = useRef(false);

  useEffect(() => {
    if (loaded && !triggered.current) {
      triggered.current = true;
      __DEV__ && console.log('[tabs] Triggering app open for subscription check');
      triggerAppOpen();
    }
  }, [loaded]);

  // Auto-start tour for new users who haven't completed it
  useEffect(() => {
    if (tourLoaded && !tourCompleted && !tourTriggered.current) {
      tourTriggered.current = true;
      __DEV__ && console.log('[tabs] Auto-starting app tour for new user');
      setTimeout(() => startTour(), 1200);
    }
  }, [tourLoaded, tourCompleted]);

  return (
    <>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={() => <FloatingDock />}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="workout" />
      </Tabs>
      <ConnectedPaywallModal />
      <ZealTipBanner />
      <AppTour />
    </>
  );
}

export default function TabLayout() {
  return (
    <AppTourProvider>
      <TabsWithPaywall />
    </AppTourProvider>
  );
}
