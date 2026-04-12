import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme } from '@/context/AppContext';
import BaseDrawer from '@/components/drawers/BaseDrawer';

interface Props {
  visible: boolean;
  streak: number;
  onClose: () => void;
}

export default function StreakBottomSheet({ visible, streak, onClose }: Props) {
  const { colors, accent } = useZealTheme();

  const header = (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <PlatformIcon name="flame" size={28} color={accent} fill={accent} />
        <View>
          <Text style={[styles.streakTitle, { color: colors.text }]}>
            {streak}-Day Streak
          </Text>
          <Text style={[styles.streakSubtitle, { color: colors.textSecondary }]}>
            Keep it going
          </Text>
        </View>
      </View>
      <TouchableOpacity onPress={onClose} testID="streak-close" style={styles.closeBtn}>
        <PlatformIcon name="x" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );

  return (
    <BaseDrawer visible={visible} onClose={onClose} header={header}>
      <View style={styles.cardsContainer}>
        <View style={[styles.infoCard, { backgroundColor: colors.cardSecondary }]}>
          <Text style={[styles.infoCardTitle, { color: accent }]}>HOW IT WORKS</Text>
          <Text style={[styles.infoCardBody, { color: colors.textSecondary }]}>
            Complete at least one workout each day to grow your streak. Your streak increases every time you mark a session as done.
          </Text>
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.cardSecondary }]}>
          <Text style={[styles.infoCardTitle, { color: colors.textSecondary }]}>GRACE PERIOD</Text>
          <Text style={[styles.infoCardBody, { color: colors.textSecondary }]}>
            {'Sometimes a 2-day rest is exactly what your body needs — and you shouldn\'t be penalized for smart recovery. Your streak stays intact until you\'ve missed '}
            <Text style={[styles.infoCardBody, { color: colors.text, fontWeight: '700' as const }]}>
              3 consecutive days
            </Text>
            .
          </Text>
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.cardSecondary }]}>
          <Text style={[styles.infoCardTitle, { color: colors.textSecondary }]}>PROTECT YOUR STREAK</Text>
          <Text style={[styles.infoCardBody, { color: colors.textSecondary }]}>
            {'Even a short custom workout counts — log a workout on any day to keep the fire alive.'}
          </Text>
        </View>
      </View>
      <View style={{ height: 40 }} />
    </BaseDrawer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  streakTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  streakSubtitle: {
    fontSize: 13,
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardsContainer: {
    paddingHorizontal: 16,
    gap: 10,
  },
  infoCard: {
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  infoCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  infoCardBody: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '400',
  },
});
