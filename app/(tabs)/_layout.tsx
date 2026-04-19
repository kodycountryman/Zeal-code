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
        {/* Legacy routes — still mounted so router.push('/workout') etc. from */}
        {/* pre-Train-tab call sites continue to work. They redirect to /train. */}
        {/* Scheduled for deletion in Phase 6 of the Train unification. */}
        <Tabs.Screen name="workout" />
        <Tabs.Screen name="run" />
        {/* Hidden for v1 App Store submission — uncomment for v2 */}
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
