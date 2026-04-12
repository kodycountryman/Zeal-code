import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useZealTheme } from '@/context/AppContext';
import { PlatformIcon } from '@/components/PlatformIcon';
import { formatDateLabel, addDays, getTodayStr } from '@/services/nutritionUtils';

interface Props {
  date: string;
  onDateChange: (date: string) => void;
}

export default function DayNavigator({ date, onDateChange }: Props) {
  const { colors } = useZealTheme();

  const isToday = date === getTodayStr();
  const label = formatDateLabel(date);

  const goBack = useCallback(() => {
    onDateChange(addDays(date, -1));
  }, [date, onDateChange]);

  const goForward = useCallback(() => {
    if (!isToday) {
      onDateChange(addDays(date, 1));
    }
  }, [date, isToday, onDateChange]);

  return (
    <View style={styles.row}>
      <Pressable
        onPress={goBack}
        style={({ pressed }) => [styles.chevron, pressed && { opacity: 0.5 }]}
        hitSlop={12}
      >
        <PlatformIcon name="chevron-left" size={20} color={colors.text} />
      </Pressable>

      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>

      <Pressable
        onPress={goForward}
        style={({ pressed }) => [
          styles.chevron,
          pressed && { opacity: 0.5 },
          isToday && { opacity: 0.25 },
        ]}
        hitSlop={12}
        disabled={isToday}
      >
        <PlatformIcon
          name="chevron-right"
          size={20}
          color={colors.text}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 8,
  },
  chevron: {
    padding: 4,
  },
  label: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 17,
    lineHeight: 22,
    minWidth: 120,
    textAlign: 'center',
  },
});
