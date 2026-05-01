import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import BaseDrawer from '@/components/drawers/BaseDrawer';
import DrawerHeader from '@/components/drawers/DrawerHeader';
import { useZealTheme } from '@/context/AppContext';
import { useNutrition } from '@/context/NutritionContext';
import { PlatformIcon } from '@/components/PlatformIcon';
import type { AppIconName } from '@/constants/iconMap';
import { MEAL_LABELS } from '@/types/nutrition';

interface ActionRowProps {
  icon: AppIconName;
  iconColor: string;
  label: string;
  subtitle: string;
  onPress: () => void;
  colors: ReturnType<typeof useZealTheme>['colors'];
  isDark: boolean;
}

function ActionRow({ icon, iconColor, label, subtitle, onPress, colors, isDark }: ActionRowProps) {
  return (
    <TouchableOpacity
      style={[
        styles.row,
        { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.cardSecondary },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconWrap, { backgroundColor: iconColor + '18' }]}>
        <PlatformIcon name={icon} size={22} color={iconColor} />
      </View>
      <View style={styles.labelWrap}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
      </View>
      <PlatformIcon name="chevron-right" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

export default function AddFoodActionSheet() {
  const { colors, isDark } = useZealTheme();
  const {
    addFoodSheetVisible,
    setAddFoodSheetVisible,
    selectedMealType,
    setManualFoodEntryVisible,
    triggerScanFood,
    triggerScanBarcode,
    triggerVoiceFood,
  } = useNutrition();

  const mealLabel = selectedMealType ? MEAL_LABELS[selectedMealType] : 'Meal';

  const handleClose = useCallback(() => {
    setAddFoodSheetVisible(false);
  }, [setAddFoodSheetVisible]);

  const handleScanFood = useCallback(() => {
    setAddFoodSheetVisible(false);
    setTimeout(() => triggerScanFood(), 300);
  }, [setAddFoodSheetVisible, triggerScanFood]);

  const handleScanBarcode = useCallback(() => {
    setAddFoodSheetVisible(false);
    setTimeout(() => triggerScanBarcode(), 300);
  }, [setAddFoodSheetVisible, triggerScanBarcode]);

  const handleVoiceEntry = useCallback(() => {
    setAddFoodSheetVisible(false);
    setTimeout(() => triggerVoiceFood(), 300);
  }, [setAddFoodSheetVisible, triggerVoiceFood]);

  const handleManualEntry = useCallback(() => {
    setAddFoodSheetVisible(false);
    setTimeout(() => {
      setManualFoodEntryVisible(true);
    }, 300);
  }, [setAddFoodSheetVisible, setManualFoodEntryVisible]);

  return (
    <BaseDrawer
      visible={addFoodSheetVisible}
      onClose={handleClose}
      snapPoints={['50%']}
      header={
        <DrawerHeader title={`Add to ${mealLabel}`} onClose={handleClose} />
      }
    >
      <View style={styles.content}>
        <ActionRow
          icon="camera"
          iconColor="#f87116"
          label="Scan Food"
          subtitle="Take a photo and let AI estimate macros"
          onPress={handleScanFood}
          colors={colors}
          isDark={isDark}
        />
        <ActionRow
          icon="message-circle"
          iconColor="#f59e0b"
          label="Voice Log"
          subtitle="Describe your meal and AI estimates macros"
          onPress={handleVoiceEntry}
          colors={colors}
          isDark={isDark}
        />
        <ActionRow
          icon="search"
          iconColor="#6366f1"
          label="Scan Barcode"
          subtitle="Look up nutrition from a product barcode"
          onPress={handleScanBarcode}
          colors={colors}
          isDark={isDark}
        />
        <ActionRow
          icon="pencil"
          iconColor="#22c55e"
          label="Manual Entry"
          subtitle="Enter food details and macros by hand"
          onPress={handleManualEntry}
          colors={colors}
          isDark={isDark}
        />
      </View>
    </BaseDrawer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    gap: 14,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelWrap: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
    lineHeight: 20,
  },
  subtitle: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    lineHeight: 16,
  },
});
