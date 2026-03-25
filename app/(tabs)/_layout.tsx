import React, { useEffect, useRef } from 'react';
import { Tabs } from 'expo-router';
import FloatingDock from '@/components/FloatingDock';
import { useSubscription } from '@/context/SubscriptionContext';
import { ConnectedPaywallModal } from '@/components/PaywallModal';
import PlusSpotlight from '@/components/PlusSpotlight';
import { useAppContext } from '@/context/AppContext';
import { useWorkoutTracking } from '@/context/WorkoutTrackingContext';

function TabsWithPaywall() {
  const { loaded, triggerAppOpen } = useSubscription();
  const { showPlusSpotlight, setShowPlusSpotlight } = useAppContext();
  const tracking = useWorkoutTracking();
  const triggered = useRef(false);

  useEffect(() => {
    if (loaded && !triggered.current) {
      triggered.current = true;
      console.log('[tabs] Triggering app open for subscription check');
      triggerAppOpen();
    }
  }, [loaded]);

  const handleSpotlightStartPlan = () => {
    setShowPlusSpotlight(false);
    setTimeout(() => tracking.setWorkoutPlanVisible(true), 300);
  };

  return (
    <>
      <Tabs
        screenOptions={{ headerShown: false, swipeEnabled: false }}
        tabBar={() => <FloatingDock />}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="workout" />
      </Tabs>
      <ConnectedPaywallModal />
      <PlusSpotlight
        visible={showPlusSpotlight}
        onStartPlan={handleSpotlightStartPlan}
        onDismiss={() => setShowPlusSpotlight(false)}
      />
    </>
  );
}

export default function TabLayout() {
  return <TabsWithPaywall />;
}
