import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useZealTheme } from '@/context/AppContext';
import { useNutrition } from '@/context/NutritionContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { showProGate } from '@/services/proGate';
import { MEAL_TYPES } from '@/types/nutrition';
import { PlatformIcon } from '@/components/PlatformIcon';
import GlassCard from '@/components/GlassCard';
import ZealBackground from '@/components/ZealBackground';
import ComingSoon from '@/components/ComingSoon';
import { Apple, Camera, Flame, Droplets } from 'lucide-react-native';

// Nutrition components (created in parallel)
import MacroSummaryRow from '@/components/nutrition/MacroSummaryRow';
import MealSection from '@/components/nutrition/MealSection';
import WaterTracker from '@/components/nutrition/WaterTracker';
import DayNavigator from '@/components/nutrition/DayNavigator';

// Drawers
import ManualFoodEntrySheet from '@/components/drawers/ManualFoodEntrySheet';

// ═══════════════════════════════════════════════════════
// NutritionScreen — Daily nutrition tracking view
// ═══════════════════════════════════════════════════════

export default function NutritionScreen() {
  const { hasPro, openPaywall } = useSubscription();

  if (!hasPro) {
    return <FreeFallback openPaywall={openPaywall} />;
  }

  return <NutritionDailyView />;
}

// ─── Free-tier fallback ────────────────────────────────

function FreeFallback({ openPaywall }: { openPaywall: () => void }) {
  // Show the pro gate alert once when the free user lands on this tab
  useEffect(() => {
    showProGate('nutrition', openPaywall);
  }, [openPaywall]);

  return (
    <ComingSoon
      MainIcon={Apple}
      title="Nutrition"
      tagline="Fuel that matches your training"
      description="Log meals in seconds, hit your macros, and see exactly how your nutrition drives your performance."
      features={[
        {
          Icon: Camera,
          title: 'Snap to Log',
          description: 'Photograph any meal and let the app identify it and log the macros instantly.',
        },
        {
          Icon: Flame,
          title: 'Macro Targets',
          description: 'Daily protein, carb, and fat goals that adapt to your training load and body goals.',
        },
        {
          Icon: Droplets,
          title: 'Hydration Tracking',
          description: 'Water reminders and intake logs synced with your workout intensity.',
        },
      ]}
    />
  );
}

// ─── Full daily view (Pro) ─────────────────────────────

function NutritionDailyView() {
  const { colors, accent } = useZealTheme();
  const {
    goals,
    todayLog,
    selectedDate,
    setSelectedDate,
    setSelectedMealType,
    setManualFoodEntryVisible,
    addMealEntry,
    removeMealEntry,
    addWater,
    removeLastWater,
    goalSetupVisible,
    setGoalSetupVisible,
  } = useNutrition();

  const handleAddFood = useCallback(
    (mealType: typeof MEAL_TYPES[number]) => {
      setSelectedMealType(mealType);
      setManualFoodEntryVisible(true);
    },
    [setSelectedMealType, setManualFoodEntryVisible],
  );

  const handleGearPress = useCallback(() => {
    // Future: open goal setup drawer
    setGoalSetupVisible(true);
    __DEV__ && console.log('[Nutrition] Goal setup tapped');
  }, [setGoalSetupVisible]);

  return (
    <View style={styles.root}>
      <ZealBackground />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* ── Screen Header ── */}
        <View style={styles.header}>
          <Text style={[styles.screenTitle, { color: colors.text }]}>Nutrition</Text>
          <TouchableOpacity
            onPress={handleGearPress}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <PlatformIcon name="settings" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Day Navigator ── */}
          <DayNavigator date={selectedDate} onDateChange={setSelectedDate} />

          {/* ── Macro Summary ── */}
          <GlassCard style={styles.macroCard}>
            <MacroSummaryRow totals={todayLog.totals} goals={goals.macros} />
          </GlassCard>

          {/* ── Meal Sections ── */}
          {MEAL_TYPES.map((mealType) => (
            <MealSection
              key={mealType}
              mealType={mealType}
              entries={todayLog.meals.filter((m) => m.mealType === mealType)}
              onAddFood={() => handleAddFood(mealType)}
              onTapEntry={() => {
                /* future: open food detail */
              }}
              onDeleteEntry={(id) => removeMealEntry(id)}
            />
          ))}

          {/* ── Water Tracker ── */}
          <WaterTracker
            currentMl={todayLog.totalWaterMl}
            goalMl={goals.waterMl}
            onAdd={addWater}
            onUndo={removeLastWater}
          />

          {/* ── Dock clearance ── */}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

      {/* ── Drawers ── */}
      <ManualFoodEntrySheet />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  screenTitle: {
    fontSize: 24,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.5,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 16,
  },
  macroCard: {
    padding: 16,
  },
  bottomSpacer: {
    height: 160,
  },
});
