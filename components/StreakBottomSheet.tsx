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
            Open Zeal+ each day to grow your streak. It counts up once per day you show up — training, checking your plan, or logging anything at all.
          </Text>
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.cardSecondary }]}>
          <Text style={[styles.infoCardTitle, { color: colors.textSecondary }]}>MISSED A DAY?</Text>
          <Text style={[styles.infoCardBody, { color: colors.textSecondary }]}>
            {'Miss a full day and the streak resets — the day you come back becomes '}
            <Text style={[styles.infoCardBody, { color: colors.text, fontWeight: '700' as const }]}>
              day 1
            </Text>
            {' of your next run. Rest days still count, as long as you open the app.'}
          </Text>
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.cardSecondary }]}>
          <Text style={[styles.infoCardTitle, { color: colors.textSecondary }]}>PROTECT YOUR STREAK</Text>
          <Text style={[styles.infoCardBody, { color: colors.textSecondary }]}>
            {'A ten-second check-in keeps the fire alive — open the app on rest days to review tomorrow\'s session or log your recovery.'}
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
