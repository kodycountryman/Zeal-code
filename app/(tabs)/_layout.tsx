import React, { useEffect, useRef } from 'react';
import { LogBox } from 'react-native';
import { Tabs } from 'expo-router';
import FloatingDock from '@/components/FloatingDock';
import { useSubscription } from '@/context/SubscriptionContext';
import { ConnectedPaywallModal } from '@/components/PaywallModal';
import ZealTipBanner from '@/components/ZealTipBanner';
import { AppTourProvider } from '@/context/AppTourContext';
import AppTour from '@/components/AppTour';

// WheelPicker uses FlatList inside the workout tab's ScrollView — known RN limitation, works correctly
LogBox.ignoreLogs(['VirtualizedLists should never be nested']);

function TabsWithPaywall() {
  const { loaded, triggerAppOpen } = useSubscription();
  const triggered = useRef(false);

  useEffect(() => {
    if (loaded && !triggered.current) {
      triggered.current = true;
      __DEV__ && console.log('[tabs] Triggering app open for subscription check');
      triggerAppOpen();
    }
  }, [loaded]);

  // Tour auto-start was moved to the Train tab (see app/(tabs)/train.tsx) so
  // new users see the Home tab first and only encounter the tour when they
  // actually land on the workout screen.

  return (
    <>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={() => <FloatingDock />}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="train" />
        {/* Legacy /workout and /run Tabs.Screen entries were removed —
            no remaining router.push('/workout' | '/run') call sites in the
            codebase, and keeping them registered surfaced a React
            static-flag assertion when TrainScreen also composed the same
            route components. /train is the sole entry point now. */}
        {/* <Tabs.Screen name="nutrition" /> */}
        {/* <Tabs.Screen name="coach" /> */}
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
