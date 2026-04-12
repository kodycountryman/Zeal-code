import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { PlatformIcon } from '@/components/PlatformIcon';
import type { AppIconName } from '@/constants/iconMap';
import { useZealTheme } from '@/context/AppContext';

const ACHIEVEMENT_ICON_NAMES: Record<string, AppIconName> = {
  footprints: 'footprints',
  flame: 'flame',
  zap: 'zap',
  dumbbell: 'dumbbell',
  trophy: 'trophy',
  target: 'target',
  medal: 'medal',
  shield: 'shield',
  award: 'award',
  crown: 'crown',
};

export function getAchievementIcon(iconName: string, color: string, size: number) {
  const name = ACHIEVEMENT_ICON_NAMES[iconName];
  if (!name) return null;
  return <PlatformIcon name={name} size={size} color={color} />;
}

export interface Achievement {
  id: string;
  iconName: string;
  label: string;
  description: string;
  unlocked: boolean;
  current?: number;
  target?: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_step',
    iconName: 'footprints',
    label: 'FIRST STEP',
    description: 'Complete your first workout.',
    unlocked: true,
  },
  {
    id: 'hot_streak',
    iconName: 'flame',
    label: 'HOT STREAK',
    description: 'Work out 7 days in a row.',
    unlocked: false,
  },
  {
    id: 'flex_warrior',
    iconName: 'zap',
    label: 'FLEX WARRIOR',
    description: 'Complete 10 Mobility or Pilates workouts.',
    unlocked: false,
  },
  {
    id: 'strong_month',
    iconName: 'dumbbell',
    label: 'STRONG MONTH',
    description: 'Work out 20 or more days in one month.',
    unlocked: false,
  },
  {
    id: 'pr_machine',
    iconName: 'trophy',
    label: 'PR MACHINE',
    description: 'Log 5 personal records in one week.',
    unlocked: false,
  },
  {
    id: 'variety_seeker',
    iconName: 'target',
    label: 'VARIETY SEEKER',
    description: 'Try every workout style in Zeal.',
    unlocked: false,
  },
  {
    id: 'century',
    iconName: 'medal',
    label: 'CENTURY',
    description: 'Complete 100 total workouts.',
    unlocked: false,
  },
  {
    id: 'iron_will',
    iconName: 'shield',
    label: 'IRON WILL',
    description: 'Train consistently for 75 days straight.',
    unlocked: false,
  },
];

interface Props {
  visible: boolean;
  achievement: Achievement | null;
  onClose: () => void;
}

export default function AchievementModal({ visible, achievement, onClose }: Props) {
  const { colors, accent } = useZealTheme();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
    }
  }, [visible, scaleAnim, opacityAnim]);

  if (!achievement) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.card,
                { backgroundColor: colors.card, transform: [{ scale: scaleAnim }] },
              ]}
            >
              <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
                <PlatformIcon name="x" size={18} color={colors.textSecondary} />
              </TouchableOpacity>

              <View
                style={[
                  styles.iconCircle,
                  {
                    backgroundColor: achievement.unlocked
                      ? `${accent}22`
                      : colors.cardSecondary,
                    borderColor: achievement.unlocked ? accent : colors.border,
                  },
                ]}
              >
                {getAchievementIcon(achievement.iconName, achievement.unlocked ? accent : colors.textMuted, 36)}
              </View>

              <Text style={[styles.label, { color: accent }]}>{achievement.label}</Text>

              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: achievement.unlocked
                      ? `${accent}22`
                      : colors.cardSecondary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    { color: achievement.unlocked ? accent : colors.textMuted },
                  ]}
                >
                  {achievement.unlocked ? '✓ UNLOCKED' : 'LOCKED'}
                </Text>
              </View>

              <Text style={[styles.description, { color: colors.textSecondary }]}>
                {achievement.description}
              </Text>

              {!achievement.unlocked && achievement.current !== undefined && achievement.target !== undefined && (
                <View style={styles.progressSection}>
                  <View style={[styles.progressTrack, { backgroundColor: colors.cardSecondary }]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          backgroundColor: accent,
                          width: `${Math.min((achievement.current / achievement.target) * 100, 100)}%` as any,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.progressLabel, { color: colors.textMuted }]}>
                    {achievement.current} / {achievement.target}
                  </Text>
                </View>
              )}
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    gap: 14,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 36,
  },
  label: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  progressSection: {
    width: '100%',
    gap: 6,
    alignItems: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
    letterSpacing: 0.3,
  },
});
