import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  Platform,
  Animated,
} from 'react-native';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import BaseDrawer from '@/components/drawers/BaseDrawer';
import { Settings, X, ChevronRight, Camera, PersonStanding, BarChart3, Crown, Sparkles } from 'lucide-react-native';
import { showProGate, PRO_GOLD, PRO_LOCKED_OPACITY } from '@/services/proGate';
import * as ImagePicker from 'expo-image-picker';

import { useZealTheme, useAppContext } from '@/context/AppContext';
import AchievementModal, { Achievement, getAchievementIcon } from '@/components/drawers/AchievementModal';
import { MILESTONES, computeMilestoneProgress, calcCurrentStreak } from '@/services/milestonesData';
import { useSubscription } from '@/context/SubscriptionContext';
import { useWorkoutTracking } from '@/context/WorkoutTrackingContext';

interface Props {
  visible: boolean;
  onClose: () => void;
  onOpenAboutMe: () => void;
  onOpenInsights: () => void;
  onOpenSettings: () => void;
}

export default function AthleteProfileDrawer({
  visible,
  onClose,
  onOpenAboutMe,
  onOpenInsights,
  onOpenSettings,
}: Props) {
  const { colors, accent, isDark } = useZealTheme();
  const { userName, setUserName, userPhotoUri, setUserPhotoUri, saveState } = useAppContext();
  const { hasPro, subscriptionState, openPaywall } = useSubscription();
  const { workoutHistory, prHistory } = useWorkoutTracking();

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(userName);
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [achievementModalVisible, setAchievementModalVisible] = useState(false);

  const top8Milestones = useMemo(() => {
    const streak = calcCurrentStreak(workoutHistory.map(l => l.date));
    const all = computeMilestoneProgress(workoutHistory.length, prHistory.length, streak);
    // Sort: completed first, then by progress ratio desc
    const sorted = [...all].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? -1 : 1;
      return (b.current / b.target) - (a.current / a.target);
    });
    return sorted.slice(0, 8);
  }, [workoutHistory, prHistory]);

  useEffect(() => {
    if (visible) {
      setNameInput(userName);
    }
  }, [visible, userName]);

  const handleSaveName = () => {
    if (nameInput.trim()) {
      setUserName(nameInput.trim());
      saveState();
    }
    setEditingName(false);
  };

  const handlePickPhoto = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Photo Upload', 'Photo upload is not supported on web preview.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow photo access to set a profile photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setUserPhotoUri(result.assets[0].uri);
      saveState();
    }
  };

  const handleAchievementPress = (achievement: Achievement) => {
    setSelectedAchievement(achievement);
    setAchievementModalVisible(true);
  };

  const headerContent = (
    <View style={styles.header}>
      <Text style={[styles.title, { color: colors.text }]}>Athlete Profile</Text>
      <TouchableOpacity
        onPress={onClose}
        activeOpacity={0.7}
        style={styles.closeIconBtn}
      >
        <X size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );

  return (
    <>
      <BaseDrawer visible={visible} onClose={onClose} header={headerContent}>
        <View style={styles.content}>
          <View style={styles.profileRow}>
            <TouchableOpacity
              style={[styles.avatarWrap, { borderColor: colors.border }]}
              onPress={handlePickPhoto}
              activeOpacity={0.8}
              testID="profile-avatar-picker"
            >
              {userPhotoUri ? (
                <Image source={{ uri: userPhotoUri }} style={styles.avatarImage} />
              ) : (
                <View
                  style={[styles.avatarPlaceholder, { backgroundColor: colors.cardSecondary }]}
                >
                  <Camera size={28} color={colors.textSecondary} />
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.profileInfo}>
              {editingName ? (
                <View style={styles.nameEditRow}>
                  <TextInput
                    style={[
                      styles.nameInput,
                      { color: colors.text, borderColor: accent, backgroundColor: colors.cardSecondary },
                    ]}
                    value={nameInput}
                    onChangeText={setNameInput}
                    autoFocus
                    onSubmitEditing={handleSaveName}
                    returnKeyType="done"
                  />
                  <TouchableOpacity
                    onPress={handleSaveName}
                    style={[styles.saveNameBtn, { backgroundColor: accent }]}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.saveNameText}>Save</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.nameRow}>
                  <TouchableOpacity
                    onPress={() => setEditingName(true)}
                    activeOpacity={0.7}
                    testID="profile-name-edit"
                  >
                    <Text style={[styles.nameText, { color: colors.text }]}>{userName}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.memberBadge,
                      { borderColor: accent, backgroundColor: `${accent}18` },
                    ]}
                    onPress={() => showProGate('subscription', openPaywall)}
                    activeOpacity={0.7}
                    testID="profile-member-badge"
                  >
                    <View style={styles.memberContent}>
                      {hasPro
                        ? <Sparkles size={12} color={accent} />
                        : <Crown size={12} color={accent} />}
                      <Text style={[styles.memberText, { color: accent }]}>
                        {hasPro ? 'Zeal Pro' : 'Zeal Core'}
                      </Text>
                      {!hasPro && (
                        <Text style={[styles.upgradeHint, { color: accent }]}>Upgrade</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            Achievements
          </Text>

          <View style={styles.achievementsWrapper}>
            <View style={[styles.achievementsGrid, { backgroundColor: colors.card }, !hasPro && { opacity: PRO_LOCKED_OPACITY }]}>
              {top8Milestones.map((m, i) => {
                const circumference = 2 * Math.PI * 18;
                const progress = m.target > 0 ? m.current / m.target : 0;
                const strokeDashoffset = circumference * (1 - Math.min(progress, 1));
                const ringColor = m.completed ? accent : `${accent}55`;
                const ach: Achievement = { id: m.id, iconName: m.icon, label: m.name, description: m.description, unlocked: m.completed, current: m.current, target: m.target };
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[
                      styles.achievementCell,
                      i % 4 !== 3 && { borderRightWidth: 1, borderRightColor: colors.border },
                      i < 4 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                    ]}
                    onPress={() => hasPro ? handleAchievementPress(ach) : showProGate('achievements', openPaywall)}
                    activeOpacity={0.7}
                    testID={`achievement-${m.id}`}
                  >
                    <View style={styles.achRingWrap}>
                      <Svg width={44} height={44} viewBox="0 0 44 44">
                        <SvgCircle cx={22} cy={22} r={18} fill="none" stroke={colors.border} strokeWidth={2.5} />
                        <SvgCircle
                          cx={22} cy={22} r={18} fill="none"
                          stroke={ringColor} strokeWidth={2.5}
                          strokeDasharray={`${circumference}`}
                          strokeDashoffset={strokeDashoffset}
                          strokeLinecap="round"
                          transform="rotate(-90 22 22)"
                        />
                      </Svg>
                      <View style={styles.achIconCenter}>
                        {getAchievementIcon(m.icon, m.completed ? accent : colors.textMuted, 16)}
                      </View>
                    </View>
                    <Text
                      style={[styles.achLabel, { color: m.completed ? accent : colors.textMuted }]}
                      numberOfLines={2}
                    >
                      {m.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {!hasPro && (
              <TouchableOpacity
                style={styles.achievementsOverlay}
                onPress={() => showProGate('achievements', openPaywall)}
                activeOpacity={0.9}
                testID="achievements-lock-overlay"
              >
                <View style={styles.achievementsLockBadge}>
                  <Crown size={20} color={PRO_GOLD} strokeWidth={1.5} />
                  <Text style={styles.achievementsLockSub}>Achievements & Milestones</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          <View style={[styles.menuCard, { backgroundColor: colors.card }]}>
            <TouchableOpacity
              style={[styles.menuRow, { borderBottomWidth: 1, borderBottomColor: colors.border }, !hasPro && { opacity: PRO_LOCKED_OPACITY }]}
              onPress={hasPro ? onOpenAboutMe : () => showProGate('aboutMe', openPaywall)}
              activeOpacity={0.7}
              testID="profile-about-me"
            >
              <PersonStanding size={20} color={hasPro ? colors.textSecondary : colors.textMuted} />
              <View style={styles.menuText}>
                <Text style={[styles.menuTitle, { color: colors.text }]}>About Me</Text>
                <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
                  Goals, body data, fitness level
                </Text>
              </View>
              {hasPro ? (
                <ChevronRight size={18} color={colors.textMuted} />
              ) : (
                <Crown size={14} color={PRO_GOLD} strokeWidth={2} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuRow, { borderBottomWidth: 1, borderBottomColor: colors.border }, !hasPro && { opacity: PRO_LOCKED_OPACITY }]}
              onPress={hasPro ? onOpenInsights : () => showProGate('insights', openPaywall)}
              activeOpacity={0.7}
              testID="profile-insights"
            >
              <BarChart3 size={20} color={hasPro ? colors.textSecondary : colors.textMuted} />
              <View style={styles.menuText}>
                <Text style={[styles.menuTitle, { color: colors.text }]}>My Fitness Insights</Text>
                <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
                  Radar chart, training breakdown
                </Text>
              </View>
              {hasPro ? (
                <ChevronRight size={18} color={colors.textMuted} />
              ) : (
                <Crown size={14} color={PRO_GOLD} strokeWidth={2} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuRow}
              onPress={onOpenSettings}
              activeOpacity={0.7}
              testID="profile-settings-btn"
            >
              <Settings size={20} color={colors.textSecondary} />
              <View style={styles.menuText}>
                <Text style={[styles.menuTitle, { color: colors.text }]}>Settings</Text>
                <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
                  Notifications, theme, equipment
                </Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={{ height: 24 }} />
        </View>
      </BaseDrawer>

      <AchievementModal
        visible={achievementModalVisible}
        achievement={selectedAchievement}
        onClose={() => setAchievementModalVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  closeIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(128,128,128,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    gap: 14,
    paddingBottom: 16,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(128,128,128,0.7)',
  },
  profileInfo: {
    flex: 1,
    gap: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  saveNameBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  saveNameText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  nameText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  statsSubtitle: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
  },
  memberBadge: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  memberContent: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
  },
  memberText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  upgradeHint: {
    fontSize: 11,
    fontWeight: '700' as const,
    marginLeft: 2,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
    fontFamily: 'Outfit_600SemiBold',
    marginLeft: 4,
  },
  achievementsWrapper: {
    position: 'relative' as const,
  },
  achievementsGrid: {
    borderRadius: 16,
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    overflow: 'hidden',
  },

  achievementsOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: 'rgba(12,12,15,0.55)',
  },
  achievementsLockBadge: {
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: 'rgba(20,20,24,0.85)',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  achievementsLockSub: {
    fontSize: 12,
    color: '#aaa',
    textAlign: 'center' as const,
    fontWeight: '600' as const,
  },
  achievementCell: {
    width: '25%',
    paddingVertical: 14,
    alignItems: 'center',
    gap: 6,
  },
  achIcon: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  achRingWrap: {
    width: 44,
    height: 44,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  achIconCenter: {
    position: 'absolute' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  achLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  menuCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  menuText: {
    flex: 1,
    gap: 2,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  menuSub: {
    fontSize: 12,
  },

});
