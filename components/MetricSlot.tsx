import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { PlatformIcon } from '@/components/PlatformIcon';
import type { MetricSlotDefinition, ResolvedMetricValue } from '@/constants/metricSlots';

interface Props {
  slotIndex: number;
  def: MetricSlotDefinition | null;        // null = empty slot
  resolved: ResolvedMetricValue | null;    // null = empty slot
  onPress: (index: number) => void;
  onLongPress: (index: number) => void;
  isDark: boolean;
  textColor: string;
  mutedColor: string;
  borderColor: string;
  accent: string;
}

export default function MetricSlot({
  slotIndex,
  def,
  resolved,
  onPress,
  onLongPress,
  isDark,
  textColor,
  mutedColor,
  borderColor,
  accent,
}: Props) {
  const isEmpty = def === null || resolved === null;

  return (
    <TouchableOpacity
      style={styles.col}
      onPress={() => onPress(slotIndex)}
      onLongPress={() => onLongPress(slotIndex)}
      activeOpacity={0.65}
      delayLongPress={420}
      testID={`metric-slot-${slotIndex}`}
    >
      {isEmpty ? (
        // — Empty state —
        <View style={styles.emptyInner}>
          <View style={[styles.emptyCircle, { borderColor }]}>
            <PlatformIcon name="plus" size={12} color={mutedColor} strokeWidth={2.5} />
          </View>
          <Text style={[styles.emptyLabel, { color: mutedColor }]}>Add</Text>
        </View>
      ) : (
        // — Filled state —
        <View style={styles.filledInner}>
          <PlatformIcon
            name={def.icon as any}
            size={14}
            color={resolved.needsHealth ? mutedColor : mutedColor}
            strokeWidth={2}
          />
          <Text
            style={[
              styles.value,
              { color: resolved.needsHealth ? mutedColor : textColor },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {resolved.value}
          </Text>
          <Text style={[styles.unit, { color: mutedColor }]} numberOfLines={1}>
            {resolved.needsHealth ? 'Connect Health' : resolved.unit}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  col: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    minHeight: 52,
  },
  emptyInner: {
    alignItems: 'center',
    gap: 5,
  },
  emptyCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyLabel: {
    fontSize: 9,
    fontFamily: 'Outfit_400Regular',
    letterSpacing: 0.3,
  },
  filledInner: {
    alignItems: 'center',
    gap: 3,
  },
  value: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  unit: {
    fontSize: 9,
    fontFamily: 'Outfit_400Regular',
    letterSpacing: 0.1,
    textAlign: 'center',
  },
});
