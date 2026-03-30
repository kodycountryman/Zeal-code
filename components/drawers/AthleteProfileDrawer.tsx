import React, { useRef, useCallback, useEffect, useState } from 'react';
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
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Settings, X, ChevronRight, Camera, PersonStanding, BarChart3, Crown, Sparkles } from 'lucide-react-native';
import { showProGate, PRO_GOLD, PRO_LOCKED_OPACITY } from '@/services/proGate';
import * as ImagePicker from 'expo-image-picker';
import { useDrawerSizing } from '@/components/drawers/useDrawerSizing';
import { useZealTheme, useAppContext } from '@/context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AchievementModal, { ACHIEVEMENTS, Achievement, getAchievementIcon } from '@/components/drawers/AchievementModal';
import { useSubscription } from '@/context/SubscriptionContext';

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
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const topOffset = Math.max(insets.top, 0) + 16;
  const {
    snapPoints,
    maxDynamicContentSize,
    scrollEnabled,
    setContentH,
  } = useDrawerSizing({ minHeight: 320, headerEst: 74, footerEst: 16 });

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(userName);
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [achievementModalVisible, setAchievementModalVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      setNameInput(userName);
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible, userName]);

  const handleDismiss = useCallback(() => {
    onClose();
  }, [onClose]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.6}
        pressBehavior="close"
      />
    ),
    []
  );

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

  return (
    <>
      <BottomSheetModal
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        maxDynamicContentSize={maxDynamicContentSize}
        onDismiss={handleDismiss}
        backdropComponent={renderBackdrop}
        backgroundStyle={[styles.sheetBg, { backgroundColor: colors.card }]}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
        enablePanDownToClose
        enableOverDrag={false}
        topInset={topOffset}
      >
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

        <BottomSheetScrollView
          showsVerticalScrollIndicator={false}
          bounces={false}
          scrollEnabled={scrollEnabled}
          contentContainerStyle={styles.content}
          onContentSizeChange={(_w: number, h: number) => setContentH(h)}
        >
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
              <View style={[styles.cameraOverlay, { backgroundColor: accent }]}>
                <Camera size={12} color="#fff" />
              </View>
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
                <TouchableOpacity
                  onPress={() => setEditingName(true)}
                  activeOpacity={0.7}
                  testID="profile-name-edit"
                >
                  <Text style={[styles.nameText, { color: colors.text }]}>{userName}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.memberBadge,
                  hasPro
                    ? { borderColor: PRO_GOLD, backgroundColor: `${PRO_GOLD}15` }
                    : { borderColor: colors.border, backgroundColor: 'transparent' },
                ]}
                onPress={() => showProGate('subscription', openPaywall)}
                activeOpacity={0.7}
                testID="profile-member-badge"
              >
                <View style={styles.memberContent}>
                  {hasPro
                    ? <Sparkles size={13} color={PRO_GOLD} />
                    : <Crown size={13} color={PRO_GOLD} />}
                  <Text style={[
                    styles.memberText,
                    { color: hasPro ? PRO_GOLD : colors.textSecondary },
                  ]}>
                    {hasPro ? 'Zeal Pro' : 'Zeal Core'}
                  </Text>
                  {!hasPro && (
                    <Text style={[styles.upgradeHint, { color: PRO_GOLD }]}>Upgrade</Text>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            ACHIEVEMENTS
          </Text>

          <View style={styles.achievementsWrapper}>
            <View style={[styles.achievementsGrid, { backgroundColor: colors.card }, !hasPro && { opacity: PRO_LOCKED_OPACITY }]}>
              {ACHIEVEMENTS.map((ach, i) => (
                <TouchableOpacity
                  key={ach.id}
                  style={[
                    styles.achievementCell,
                    i % 4 !== 3 && { borderRightWidth: 1, borderRightColor: colors.border },
                    i < 4 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                  ]}
                  onPress={() => hasPro ? handleAchievementPress(ach) : showProGate('achievements', openPaywall)}
                  activeOpacity={0.7}
                  testID={`achievement-${ach.id}`}
                >
                  <View style={[styles.achIcon, { opacity: ach.unlocked ? 1 : 0.35 }]}>
                    {getAchievementIcon(ach.iconName, ach.unlocked ? accent : colors.textMuted, 24)}
                  </View>
                  <Text
                    style={[
                      styles.achLabel,
                      { color: ach.unlocked ? colors.text : colors.textMuted },
                    ]}
                    numberOfLines={2}
                  >
                    {ach.label}
                  </Text>
                </TouchableOpacity>
              ))}
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
              <View style={[styles.menuIconWrap, { backgroundColor: `${accent}22` }]}>
                <PersonStanding size={20} color={hasPro ? accent : colors.textMuted} />
              </View>
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
              <View style={[styles.menuIconWrap, { backgroundColor: `${accent}22` }]}>
                <BarChart3 size={20} color={hasPro ? accent : colors.textMuted} />
              </View>
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
              <View style={[styles.menuIconWrap, { backgroundColor: colors.cardSecondary ?? 'rgba(128,128,128,0.1)' }]}>
                <Settings size={20} color={colors.textSecondary} />
              </View>
              <View style={styles.menuText}>
                <Text style={[styles.menuTitle, { color: colors.text }]}>Settings</Text>
                <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
                  Notifications, theme, equipment
                </Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={{ height: 60 }} />
        </BottomSheetScrollView>
      </BottomSheetModal>

      <AchievementModal
        visible={achievementModalVisible}
        achievement={selectedAchievement}
        onClose={() => setAchievementModalVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  sheetBg: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
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
    borderRadius: 16,
    borderWidth: 2,
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
    bottom: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
    gap: 8,
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
  memberBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
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
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
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
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
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
