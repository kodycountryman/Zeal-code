import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PlatformIcon } from '@/components/PlatformIcon';
import GlassCard from '@/components/GlassCard';
import { useZealTheme } from '@/context/AppContext';
import { useSeventyFiveHard } from '@/context/SeventyFiveHardContext';

interface Props {
  onPress: () => void;
  variant: 'glass' | 'solid';
}

const GOLD = '#f87116';

export default function SeventyFiveHardBanner({ onPress, variant }: Props) {
  const { colors } = useZealTheme();
  const { currentDay } = useSeventyFiveHard();

  const progress = Math.min(currentDay / 75, 1);

  return (
    <GlassCard style={styles.card} onPress={onPress} activeOpacity={0.8} variant={variant}>
      <View style={styles.topRow}>
        <View style={styles.left}>
          <PlatformIcon name="trophy" size={20} color={GOLD} />
          <Text style={[styles.dayLabel, { color: GOLD }]}>
            DAY {currentDay} OF 75
          </Text>
        </View>
        <PlatformIcon name="chevron-right" size={16} color={colors.textMuted} />
      </View>

      <View style={[styles.progressTrack, { backgroundColor: `${GOLD}15` }]}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` as any, backgroundColor: GOLD }]} />
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    padding: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dayLabel: {
    fontSize: 20,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.5,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
});
