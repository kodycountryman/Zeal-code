import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useZealTheme } from '@/context/AppContext';
import GlassCard from '@/components/GlassCard';
import { PlatformIcon } from '@/components/PlatformIcon';

interface Props {
  currentMl: number;
  goalMl: number;
  onAdd: (ml: number) => void;
  onUndo: () => void;
}

export default function WaterTracker({ currentMl, goalMl, onAdd, onUndo }: Props) {
  const { colors, accent, isDark } = useZealTheme();

  const fillPct = Math.min((currentMl / Math.max(goalMl, 1)) * 100, 100);
  const barBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  return (
    <GlassCard style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <PlatformIcon name="droplets" size={18} color={accent} />
          <Text style={[styles.title, { color: colors.text }]}>Water</Text>
        </View>
        <Text style={[styles.amount, { color: colors.textSecondary }]}>
          {currentMl} / {goalMl} ml
        </Text>
      </View>

      {/* Progress Bar */}
      <View style={[styles.barTrack, { backgroundColor: barBg }]}>
        <View
          style={[
            styles.barFill,
            {
              backgroundColor: accent,
              width: `${fillPct}%`,
            },
          ]}
        />
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <View style={styles.quickButtons}>
          <Pressable
            style={({ pressed }) => [
              styles.addBtn,
              { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' },
              pressed && { opacity: 0.6 },
            ]}
            onPress={() => onAdd(250)}
          >
            <PlatformIcon name="plus" size={14} color={accent} />
            <Text style={[styles.addBtnText, { color: colors.text }]}>250ml</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.addBtn,
              { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' },
              pressed && { opacity: 0.6 },
            ]}
            onPress={() => onAdd(500)}
          >
            <PlatformIcon name="plus" size={14} color={accent} />
            <Text style={[styles.addBtnText, { color: colors.text }]}>500ml</Text>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [pressed && { opacity: 0.5 }]}
          onPress={onUndo}
          hitSlop={8}
        >
          <Text style={[styles.undoText, { color: colors.textMuted }]}>Undo</Text>
        </Pressable>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
    lineHeight: 20,
  },
  amount: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 14,
    lineHeight: 18,
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quickButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  addBtnText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
    lineHeight: 16,
  },
  undoText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
    lineHeight: 16,
  },
});
