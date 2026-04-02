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
import { X, Footprints, Flame, Zap, Dumbbell, Trophy, Target, Medal, Shield, LucideIcon } from 'lucide-react-native';
import { useZealTheme } from '@/context/AppContext';

const ACHIEVEMENT_ICON_MAP: Record<string, LucideIcon> = {
  footprints: Footprints,
  flame: Flame,
  zap: Zap,
  dumbbell: Dumbbell,
  trophy: Trophy,
  target: Target,
  medal: Medal,
  shield: Shield,
};

export function getAchievementIcon(iconName: string, color: string, size: number) {
  const IconComponent = ACHIEVEMENT_ICON_MAP[iconName];
  if (!IconComponent) return null;
  return <IconComponent size={size} color={color} />;
}

export interface Achievement {
  id: string;
  iconName: string;
  label: string;
  description: string;
  unlocked: boolean;
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
                <X size={18} color={colors.textSecondary} />
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
});
