import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useZealTheme } from '@/context/AppContext';
import { useNutrition } from '@/context/NutritionContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { showProGate } from '@/services/proGate';
import { MEAL_TYPES } from '@/types/nutrition';
import { PlatformIcon } from '@/components/PlatformIcon';
import GlassCard from '@/components/GlassCard';
import ZealBackground from '@/components/ZealBackground';
import ComingSoon from '@/components/ComingSoon';
import TabHeader from '@/components/TabHeader';
import { Apple, Camera, Flame, Droplets } from 'lucide-react-native';

// Nutrition components
import MacroSummaryRow from '@/components/nutrition/MacroSummaryRow';
import MealSection from '@/components/nutrition/MealSection';
import WaterTracker from '@/components/nutrition/WaterTracker';
import DayNavigator from '@/components/nutrition/DayNavigator';
import BarcodeScanner from '@/components/nutrition/BarcodeScanner';

// Drawers
import ManualFoodEntrySheet from '@/components/drawers/ManualFoodEntrySheet';
import AddFoodActionSheet from '@/components/drawers/AddFoodActionSheet';
import AIFoodResultSheet from '@/components/drawers/AIFoodResultSheet';
import VoiceFoodSheet from '@/components/drawers/VoiceFoodSheet';
import NutritionGoalSheet from '@/components/drawers/NutritionGoalSheet';
import MealDetailSheet from '@/components/drawers/MealDetailSheet';

import type { MealType } from '@/types/nutrition';

// Utilities
import { addDays } from '@/services/nutritionUtils';

// AI Scanner
import { scanFood, type AIFoodResult } from '@/services/aiFoodScanner';

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
    setAddFoodSheetVisible,
    setAiFoodResultVisible,
    addMealEntry,
    removeMealEntry,
    addWater,
    removeLastWater,
    setGoalSetupVisible,
    registerActionCallbacks,
    copyMealsFromDate,
    getDailyLog,
  } = useNutrition();

  const [barcodeVisible, setBarcodeVisible] = useState(false);
  const [voiceSheetVisible, setVoiceSheetVisible] = useState(false);
  const [mealDetailVisible, setMealDetailVisible] = useState(false);
  const [detailMealType, setDetailMealType] = useState<MealType | null>(null);
  const [aiResult, setAiResult] = useState<AIFoodResult | null>(null);
  const [aiScanning, setAiScanning] = useState(false);

  // ── Meal tile tap → detail if entries exist, else add food ──
  const handleMealPress = useCallback(
    (mealType: MealType) => {
      setSelectedMealType(mealType);
      const entries = todayLog.meals.filter((m) => m.mealType === mealType);
      if (entries.length > 0) {
        setDetailMealType(mealType);
        setMealDetailVisible(true);
      } else {
        setAddFoodSheetVisible(true);
      }
    },
    [setSelectedMealType, setAddFoodSheetVisible, todayLog],
  );

  // ── Open add food from meal detail ──
  const handleAddFoodFromDetail = useCallback(() => {
    setAddFoodSheetVisible(true);
  }, [setAddFoodSheetVisible]);

  // ── AI food scan flow ──
  const handleScanFood = useCallback(async () => {
    setAiScanning(true);
    try {
      const result = await scanFood();
      if (result) {
        setAiResult(result);
        setAiFoodResultVisible(true);
      }
    } catch (e) {
      Alert.alert('Scan Failed', 'Could not analyze the photo. Please try again.');
    } finally {
      setAiScanning(false);
    }
  }, [setAiFoodResultVisible]);

  // ── Barcode scan flow ──
  const handleScanBarcode = useCallback(() => {
    setBarcodeVisible(true);
  }, []);

  // ── Voice log flow ──
  const handleVoiceFood = useCallback(() => {
    setVoiceSheetVisible(true);
  }, []);

  const handleVoiceResult = useCallback((result: AIFoodResult) => {
    setAiResult(result);
    setAiFoodResultVisible(true);
  }, [setAiFoodResultVisible]);

  // Register action callbacks in context (replaces global variable pattern)
  useEffect(() => {
    registerActionCallbacks({
      onScanFood: handleScanFood,
      onScanBarcode: handleScanBarcode,
      onVoiceFood: handleVoiceFood,
    });
    return () => registerActionCallbacks({});
  }, [registerActionCallbacks, handleScanFood, handleScanBarcode, handleVoiceFood]);

  const handleGearPress = useCallback(() => {
    setGoalSetupVisible(true);
  }, [setGoalSetupVisible]);

  // ── Copy meals from yesterday ──
  const yesterdayStr = useMemo(() => addDays(selectedDate, -1), [selectedDate]);
  const yesterdayLog = getDailyLog(yesterdayStr);
  const showCopyYesterday = todayLog.meals.length === 0 && yesterdayLog.meals.length > 0;

  const handleCopyYesterday = useCallback(() => {
    copyMealsFromDate(yesterdayStr, selectedDate);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [copyMealsFromDate, yesterdayStr, selectedDate]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ZealBackground />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* ── Screen Header ── */}
        <TabHeader
          title="Nutrition"
          // TODO(profile): once AthleteProfileDrawer is wired into Nutrition, swap to setProfileVisible(true)
          onAvatarPress={handleGearPress}
          avatarTestID="nutrition-profile-avatar"
          rightSlot={
            <TouchableOpacity
              onPress={handleGearPress}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Nutrition settings"
            >
              <PlatformIcon name="settings" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          }
        />

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

          {/* ── Meal Grid (2x2) ── */}
          <View style={styles.mealGrid}>
            <View style={styles.mealRow}>
              <MealSection
                mealType="breakfast"
                entries={todayLog.meals.filter((m) => m.mealType === 'breakfast')}
                onPress={() => handleMealPress('breakfast')}
              />
              <MealSection
                mealType="lunch"
                entries={todayLog.meals.filter((m) => m.mealType === 'lunch')}
                onPress={() => handleMealPress('lunch')}
              />
            </View>
            <View style={styles.mealRow}>
              <MealSection
                mealType="dinner"
                entries={todayLog.meals.filter((m) => m.mealType === 'dinner')}
                onPress={() => handleMealPress('dinner')}
              />
              <MealSection
                mealType="snacks"
                entries={todayLog.meals.filter((m) => m.mealType === 'snacks')}
                onPress={() => handleMealPress('snacks')}
              />
            </View>
          </View>

          {/* ── Copy from yesterday ── */}
          {showCopyYesterday && (
            <TouchableOpacity
              style={[styles.copyBtn, { borderColor: colors.border }]}
              onPress={handleCopyYesterday}
              activeOpacity={0.7}
            >
              <PlatformIcon name="copy" size={16} color={colors.textMuted} />
              <Text style={[styles.copyBtnText, { color: colors.textSecondary }]}>
                Copy meals from yesterday ({yesterdayLog.meals.length} items)
              </Text>
            </TouchableOpacity>
          )}

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

        {/* ── AI Scanning overlay ── */}
        {aiScanning && (
          <View style={styles.scanOverlay}>
            <ActivityIndicator color={accent} size="large" />
            <Text style={[styles.scanText, { color: colors.text }]}>Analyzing food...</Text>
          </View>
        )}
      </SafeAreaView>

      {/* ── Drawers ── */}
      <AddFoodActionSheet />
      <ManualFoodEntrySheet />
      <NutritionGoalSheet />
      <MealDetailSheet
        visible={mealDetailVisible}
        mealType={detailMealType}
        entries={detailMealType ? todayLog.meals.filter((m) => m.mealType === detailMealType) : []}
        onClose={() => setMealDetailVisible(false)}
        onAddFood={handleAddFoodFromDetail}
      />
      <AIFoodResultSheet result={aiResult} onClose={() => setAiResult(null)} />
      <BarcodeScanner visible={barcodeVisible} onClose={() => setBarcodeVisible(false)} />
      <VoiceFoodSheet
        visible={voiceSheetVisible}
        onClose={() => setVoiceSheetVisible(false)}
        onResult={handleVoiceResult}
      />
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
  mealGrid: {
    gap: 12,
  },
  mealRow: {
    flexDirection: 'row',
    gap: 12,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 14,
    borderStyle: 'dashed',
  },
  copyBtnText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 14,
  },
  bottomSpacer: {
    height: 160,
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  scanText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
  },
});
