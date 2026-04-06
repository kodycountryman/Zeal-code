import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActionSheetIOS, Platform, Alert, Modal, Image, SafeAreaView } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { PlatformIcon } from '@/components/PlatformIcon';
import GlassCard from '@/components/GlassCard';
import { useZealTheme } from '@/context/AppContext';
import { useSeventyFiveHard } from '@/context/SeventyFiveHardContext';
import type { ChecklistItem } from '@/services/seventyFiveHardTypes';

interface Props {
  variant: 'glass' | 'solid';
}

const GREEN = '#22c55e';

const CHECKLIST_ROWS: {
  key: ChecklistItem;
  icon: string;
  label: string;
}[] = [
  { key: 'waterComplete',   icon: 'droplets',  label: 'Drink 1 gallon of water' },
  { key: 'readingComplete', icon: 'book-open', label: 'Read 10 pages' },
  { key: 'dietComplete',    icon: 'utensils',  label: 'No cheats, no alcohol' },
  { key: 'photoComplete',   icon: 'camera',    label: 'Progress photo' },
];

export default function SeventyFiveHardChecklist({ variant }: Props) {
  const { colors } = useZealTheme();
  const { todayChecklist, toggleItem, savePhoto } = useSeventyFiveHard();
  const [collapsed, setCollapsed] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState(false);

  const completedCount = CHECKLIST_ROWS.filter((r) => todayChecklist[r.key]).length;
  const allDone = completedCount === CHECKLIST_ROWS.length;
  const prevAllDone = useRef(allDone);

  // Auto-collapse when all items become complete
  useEffect(() => {
    if (allDone && !prevAllDone.current) {
      setTimeout(() => setCollapsed(true), 600);
    }
    prevAllDone.current = allDone;
  }, [allDone]);

  const handleToggle = (key: ChecklistItem) => {
    if (key === 'photoComplete') {
      if (todayChecklist.photoComplete) {
        handlePhotoOptions();
      } else {
        handleTakePhoto();
      }
      return;
    }
    toggleItem(key);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const handlePhotoOptions = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Retake Photo', 'View Photo', 'Remove Photo'],
          destructiveButtonIndex: 3,
          cancelButtonIndex: 0,
        },
        (idx) => {
          if (idx === 1) handleTakePhoto();
          else if (idx === 2) setViewingPhoto(true);
          else if (idx === 3) {
            toggleItem('photoComplete');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          }
        },
      );
    } else {
      Alert.alert('Progress Photo', undefined, [
        { text: 'Retake Photo', onPress: handleTakePhoto },
        { text: 'View Photo', onPress: () => setViewingPhoto(true) },
        { text: 'Remove Photo', style: 'destructive', onPress: () => { toggleItem('photoComplete'); } },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      toggleItem('photoComplete');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      savePhoto(result.assets[0].uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  };

  const handleHeaderPress = () => {
    if (allDone) {
      setCollapsed((c) => !c);
      Haptics.selectionAsync().catch(() => {});
    }
  };

  const cardStyle = allDone && collapsed
    ? [styles.card, { borderColor: `${GREEN}30`, borderWidth: 1 }]
    : styles.card;

  return (
    <GlassCard style={cardStyle} variant={variant}>
      {/* Header */}
      <TouchableOpacity
        style={styles.headerRow}
        onPress={handleHeaderPress}
        activeOpacity={allDone ? 0.7 : 1}
      >
        <View style={styles.headerLeft}>
          {allDone && collapsed && (
            <View style={[styles.allDoneCircle, { backgroundColor: `${GREEN}20` }]}>
              <PlatformIcon name="check" size={13} color={GREEN} strokeWidth={3} />
            </View>
          )}
          <Text style={[styles.title, { color: allDone && collapsed ? GREEN : colors.text }]}>
            Daily Checklist
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={[styles.counter, { color: allDone ? GREEN : colors.textSecondary }]}>
            {completedCount}/{CHECKLIST_ROWS.length}
          </Text>
          {allDone && (
            <PlatformIcon
              name={collapsed ? 'chevron-down' : 'chevron-up'}
              size={14}
              color={GREEN}
            />
          )}
        </View>
      </TouchableOpacity>

      {/* Rows — hidden when all done and collapsed */}
      {(!allDone || !collapsed) && CHECKLIST_ROWS.map((row, i) => {
        const isChecked = todayChecklist[row.key];
        const isPhoto = row.key === 'photoComplete';

        return (
          <TouchableOpacity
            key={row.key}
            style={[
              styles.row,
              i > 0 && { borderTopWidth: 0.5, borderTopColor: colors.border },
              isChecked && { backgroundColor: `${GREEN}06` },
            ]}
            onPress={() => handleToggle(row.key)}
            activeOpacity={0.7}
          >
            <View style={styles.rowLeft}>
              <View
                style={[
                  styles.checkCircle,
                  isChecked
                    ? { backgroundColor: GREEN, borderColor: GREEN }
                    : { borderColor: colors.border, backgroundColor: 'transparent' },
                ]}
              >
                {isChecked && (
                  <PlatformIcon name="check" size={10} color="#fff" strokeWidth={3} />
                )}
              </View>
              <PlatformIcon
                name={row.icon as any}
                size={15}
                color={isChecked ? GREEN : colors.textSecondary}
              />
              <Text
                style={[
                  styles.rowLabel,
                  { color: isChecked ? GREEN : colors.text },
                  isChecked && styles.rowLabelDone,
                ]}
              >
                {row.label}
              </Text>
            </View>

            {isPhoto && !isChecked && (
              <TouchableOpacity
                style={[styles.cameraBadge, { backgroundColor: `${colors.border}60` }]}
                onPress={handleTakePhoto}
                activeOpacity={0.7}
              >
                <PlatformIcon name="camera" size={12} color={colors.textSecondary} />
              </TouchableOpacity>
            )}

            {isPhoto && isChecked && todayChecklist.photoUri && (
              <View style={[styles.thumbWrap, { borderColor: `${GREEN}30` }]}>
                <PlatformIcon name="image" size={12} color={GREEN} />
              </View>
            )}
          </TouchableOpacity>
        );
      })}
      {/* Photo viewer modal */}
      <Modal visible={viewingPhoto} animationType="fade" statusBarTranslucent>
        <SafeAreaView style={styles.photoModal}>
          <TouchableOpacity
            style={styles.photoCloseBtn}
            onPress={() => setViewingPhoto(false)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <PlatformIcon name="x" size={20} color="#fff" />
          </TouchableOpacity>
          {todayChecklist.photoUri ? (
            <Image
              source={{ uri: todayChecklist.photoUri }}
              style={styles.photoFull}
              resizeMode="contain"
            />
          ) : null}
        </SafeAreaView>
      </Modal>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 0,
    paddingVertical: 0,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  allDoneCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
  },
  counter: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    fontSize: 14,
    fontFamily: 'Outfit_500Medium',
  },
  rowLabelDone: {
    textDecorationLine: 'line-through',
    opacity: 0.7,
  },
  cameraBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoModal: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
  },
  photoCloseBtn: {
    position: 'absolute',
    top: 56,
    right: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoFull: {
    width: '100%',
    height: '100%',
  },
});
