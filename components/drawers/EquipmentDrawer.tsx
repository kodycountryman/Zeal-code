import React, { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { ChevronDown, ChevronUp, Bookmark, Building2, Check, User, X } from 'lucide-react-native';
import DrawerHeader from '@/components/drawers/DrawerHeader';
import { useZealTheme, useAppContext, SavedGym } from '@/context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EQUIPMENT_CATEGORIES, ALL_EQUIPMENT_IDS } from '@/mocks/equipmentData';

interface Props {
  visible: boolean;
  onClose: () => void;
  onBack?: () => void;
}

export default function EquipmentDrawer({ visible, onClose, onBack }: Props) {
  const { colors, accent } = useZealTheme();
  const { selectedEquipment, setSelectedEquipment, savedGyms, setSavedGyms, saveState, bumpSettingsSaveVersion } =
    useAppContext();

  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const topOffset = Math.max(insets.top, 0) + 16;
  const { height: windowH } = useWindowDimensions();
  const maxDynamicContentSize = useMemo(() => {
    return Math.max(560, Math.min(windowH - topOffset - 24, Math.round(windowH * 0.92)));
  }, [windowH, topOffset]);
  const [contentH, setContentH] = useState(0);
  // Compute a tight snap height so the sheet never opens past content.
  const snapPoints = useMemo(() => {
    const HEADER_AND_HANDLE_EST = 86;
    const FOOTER_EST = 16;
    const desired = contentH > 0 ? contentH + HEADER_AND_HANDLE_EST + FOOTER_EST : maxDynamicContentSize;
    const clamped = Math.min(maxDynamicContentSize, Math.max(420, Math.round(desired)));
    return [clamped];
  }, [contentH, maxDynamicContentSize]);

  const [localEquip, setLocalEquip] = useState<Record<string, number>>({});
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const [savedGymsOpen, setSavedGymsOpen] = useState(false);
  const [addGymMode, setAddGymMode] = useState(false);
  const [newGymName, setNewGymName] = useState('');
  const [activeGymId, setActiveGymId] = useState<string | null>(null);
  const [isNewGymMode, setIsNewGymMode] = useState(false);

  useEffect(() => {
    if (visible) {
      setLocalEquip({ ...selectedEquipment });
      setSavedGymsOpen(false);
      setAddGymMode(false);
      setNewGymName('');
      setActiveGymId(null);
      setIsNewGymMode(false);
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible, selectedEquipment]);

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

  const handleDone = () => {
    const count = Object.values(localEquip).filter(v => v > 0).length;
    console.log('[EquipmentDrawer] Saving equipment, items selected:', count);

    if (count === 0 && !isNoEquipActive) {
      Alert.alert(
        'No Equipment Selected',
        'Please select at least one piece of equipment, or choose "No Equipment" for bodyweight-only workouts.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    setSelectedEquipment(localEquip);

    if (activeGymId) {
      setSavedGyms((prev) =>
        prev.map((g) =>
          g.id === activeGymId ? { ...g, equipment: { ...localEquip } } : g
        )
      );
      console.log('[EquipmentDrawer] Saved equipment back to gym:', activeGymId);
    }

    requestAnimationFrame(() => {
      saveState();
      bumpSettingsSaveVersion();
      console.log('[EquipmentDrawer] Settings save version bumped, will trigger workout regeneration');
    });
    onClose();
  };

  const totalSelected = Object.values(localEquip).filter((v) => v > 0).length;
  const totalItems = ALL_EQUIPMENT_IDS.length;
  const allSelected = totalSelected === totalItems;
  const isNoEquipActive = !isNewGymMode && Object.keys(localEquip).length > 0 && totalSelected === 0;
  const newGymBtnLabel = isNewGymMode && totalSelected > 0 ? 'Save Current as New Gym' : 'Create New Gym';

  const handleSelectAll = () => {
    Alert.alert(
      'Select All Equipment',
      'This will mark all equipment as available.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Select All',
          onPress: () => {
            const all: Record<string, number> = {};
            ALL_EQUIPMENT_IDS.forEach((id) => { all[id] = 1; });
            setLocalEquip(all);
          },
        },
      ]
    );
  };

  const handleDeselectAll = () => {
    Alert.alert(
      'Deselect All Equipment',
      'This will remove all equipment from your selection.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deselect All',
          style: 'destructive',
          onPress: () => {
            const none: Record<string, number> = {};
            ALL_EQUIPMENT_IDS.forEach((id) => { none[id] = 0; });
            setLocalEquip(none);
          },
        },
      ]
    );
  };

  const handleNoEquipment = () => {
    const none: Record<string, number> = {};
    ALL_EQUIPMENT_IDS.forEach((id) => { none[id] = 0; });
    setLocalEquip(none);
    setSavedGymsOpen(false);
    setActiveGymId(null);
    setIsNewGymMode(false);
    console.log('[EquipmentDrawer] No equipment selected — bodyweight only');
  };

  const handleCommercialGym = () => {
    const all: Record<string, number> = {};
    ALL_EQUIPMENT_IDS.forEach((id) => { all[id] = 1; });
    setLocalEquip(all);
    setSavedGymsOpen(false);
    setActiveGymId(null);
    setIsNewGymMode(false);
  };

  const handleToggleItem = (id: string) => {
    setLocalEquip((prev) => ({
      ...prev,
      [id]: prev[id] && prev[id] > 0 ? 0 : 1,
    }));
  };

  const handleSelectAllCat = (catId: string, items: { id: string }[]) => {
    const allCatSelected = items.every((item) => (localEquip[item.id] ?? 0) > 0);
    setLocalEquip((prev) => {
      const next = { ...prev };
      items.forEach((item) => {
        next[item.id] = allCatSelected ? 0 : 1;
      });
      return next;
    });
  };

  const toggleCat = (catId: string) => {
    setExpandedCats((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  const handleLoadGym = useCallback(
    (gym: SavedGym) => {
      setLocalEquip({ ...gym.equipment });
      setActiveGymId(gym.id);
      setIsNewGymMode(false);
    },
    []
  );

  const handleCreateOrSaveNewGym = useCallback(() => {
    if (!isNewGymMode || totalSelected === 0) {
      const none: Record<string, number> = {};
      ALL_EQUIPMENT_IDS.forEach((id) => { none[id] = 0; });
      setLocalEquip(none);
      setActiveGymId(null);
      setIsNewGymMode(true);
      console.log('[EquipmentDrawer] Create New Gym mode — cleared selection');
    } else {
      setAddGymMode(true);
    }
  }, [isNewGymMode, totalSelected]);

  const handleAddGym = () => {
    if (!newGymName.trim()) {
      Alert.alert('Name required', 'Please enter a name for this gym setup.');
      return;
    }
    const newGym: SavedGym = {
      id: Date.now().toString(),
      name: newGymName.trim(),
      equipment: { ...localEquip },
    };
    const updated = [...savedGyms, newGym];
    setSavedGyms(updated);
    setActiveGymId(newGym.id);
    setIsNewGymMode(false);
    saveState();
    setAddGymMode(false);
    setNewGymName('');
  };

  const handleDeleteGym = (gymId: string) => {
    Alert.alert('Delete Gym', 'Remove this saved gym?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setSavedGyms((prev) => prev.filter((g) => g.id !== gymId));
          if (activeGymId === gymId) setActiveGymId(null);
          saveState();
        },
      },
    ]);
  };

  return (
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
      stackBehavior="push"
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      <DrawerHeader
        title={`Equipment · ${totalSelected}/${totalItems}`}
        onBack={onBack}
        onClose={onBack ? undefined : onClose}
        rightContent={
          <TouchableOpacity
            style={[styles.headerDoneBtn, { backgroundColor: accent }]}
            onPress={handleDone}
            activeOpacity={0.85}
          >
            <Text style={styles.headerDoneText}>Done</Text>
          </TouchableOpacity>
        }
      />

      <BottomSheetScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        scrollEnabled={contentH > maxDynamicContentSize - 120}
        onContentSizeChange={(_w: number, h: number) => setContentH(h)}
      >
        <Text style={[styles.presetsLabel, { color: colors.textSecondary }]}>QUICK PRESETS</Text>

        <View style={styles.presetsRow}>
          <TouchableOpacity
            style={[
              styles.presetCard,
              { backgroundColor: colors.card, borderColor: colors.border },
              isNoEquipActive && { borderColor: accent, backgroundColor: `${accent}10` },
            ]}
            onPress={handleNoEquipment}
            activeOpacity={0.7}
          >
            <User size={16} color={isNoEquipActive ? accent : colors.textSecondary} />
            <View style={styles.presetText}>
              <Text style={[styles.presetTitle, { color: isNoEquipActive ? accent : colors.text }]}>No Equipment</Text>
              <Text style={[styles.presetSub, { color: colors.textMuted }]}>Bodyweight</Text>
            </View>
            {isNoEquipActive && (
              <View style={[styles.presetCheck, { backgroundColor: accent }]}>
                <Check size={9} color="#fff" strokeWidth={3} />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.presetCard,
              { backgroundColor: colors.card, borderColor: colors.border },
              allSelected && { borderColor: accent, backgroundColor: `${accent}10` },
            ]}
            onPress={handleCommercialGym}
            activeOpacity={0.7}
          >
            <Building2 size={16} color={allSelected ? accent : colors.textSecondary} />
            <View style={styles.presetText}>
              <Text style={[styles.presetTitle, { color: allSelected ? accent : colors.text }]}>Commercial</Text>
              <Text style={[styles.presetSub, { color: colors.textMuted }]}>All equipment</Text>
            </View>
            {allSelected && (
              <View style={[styles.presetCheck, { backgroundColor: accent }]}>
                <Check size={9} color="#fff" strokeWidth={3} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.savedGymsBtn,
            { backgroundColor: colors.card, borderColor: savedGymsOpen ? accent : colors.border },
            savedGymsOpen && { backgroundColor: `${accent}08` },
          ]}
          onPress={() => setSavedGymsOpen((v) => !v)}
          activeOpacity={0.7}
        >
          <Bookmark size={15} color={savedGymsOpen ? accent : colors.textSecondary} />
          <Text style={[styles.savedGymsBtnLabel, { color: savedGymsOpen ? accent : colors.text }]}>Saved Gyms</Text>
          {savedGyms.length > 0 && (
            <View style={[styles.savedGymsBtnBadge, { backgroundColor: savedGymsOpen ? accent : `${accent}30` }]}>
              <Text style={[styles.savedGymsBtnBadgeText, { color: savedGymsOpen ? '#fff' : accent }]}>{savedGyms.length}</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          {savedGymsOpen ? (
            <ChevronUp size={14} color={savedGymsOpen ? accent : colors.textMuted} />
          ) : (
            <ChevronDown size={14} color={colors.textMuted} />
          )}
        </TouchableOpacity>

        {savedGymsOpen && (
          <View style={[styles.savedGymsPanel, { backgroundColor: colors.cardSecondary ?? colors.card, borderColor: colors.border }]}>
            {savedGyms.length === 0 && !addGymMode && (
              <Text style={[styles.noGymsText, { color: colors.textMuted }]}>
                No saved gyms yet. Create one below.
              </Text>
            )}
            {savedGyms.map((gym) => {
              const isActive = gym.id === activeGymId;
              const gymItemCount = Object.values(gym.equipment).filter(v => v > 0).length;
              return (
                <TouchableOpacity
                  key={gym.id}
                  style={[
                    styles.savedGymRow,
                    { borderColor: isActive ? accent : colors.border },
                    isActive && { backgroundColor: `${accent}12` },
                  ]}
                  onPress={() => handleLoadGym(gym)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.savedGymIconWrap, { backgroundColor: isActive ? `${accent}25` : `${colors.border}60` }]}>
                    <Bookmark size={13} color={isActive ? accent : colors.textSecondary} />
                  </View>
                  <View style={styles.savedGymInfo}>
                    <Text style={[styles.savedGymName, { color: isActive ? accent : colors.text }]}>
                      {gym.name}
                    </Text>
                    <Text style={[styles.savedGymCount, { color: colors.textMuted }]}>
                      {gymItemCount} item{gymItemCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  {isActive && (
                    <View style={[styles.activeIndicator, { backgroundColor: accent }]}>
                      <Check size={10} color="#fff" strokeWidth={3} />
                    </View>
                  )}
                  <TouchableOpacity
                    onPress={() => handleDeleteGym(gym.id)}
                    activeOpacity={0.7}
                    style={styles.deleteGymBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X size={13} color={colors.textMuted} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}

            {addGymMode ? (
              <View style={styles.addGymInputRow}>
                <TextInput
                  style={[
                    styles.addGymInput,
                    { color: colors.text, borderColor: colors.border, backgroundColor: colors.card },
                  ]}
                  value={newGymName}
                  onChangeText={setNewGymName}
                  placeholder="e.g. Home Gym"
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                />
                <TouchableOpacity
                  style={[styles.addGymConfirm, { backgroundColor: accent }]}
                  onPress={handleAddGym}
                  activeOpacity={0.8}
                >
                  <Text style={styles.addGymConfirmText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addGymCancel, { backgroundColor: 'rgba(128,128,128,0.15)' }]}
                  onPress={() => { setAddGymMode(false); setNewGymName(''); }}
                  activeOpacity={0.7}
                >
                  <X size={14} color="#888" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.addGymBtn,
                  {
                    borderColor: isNewGymMode && totalSelected > 0 ? `${accent}50` : 'rgba(128,128,128,0.25)',
                    backgroundColor: isNewGymMode && totalSelected > 0 ? `${accent}14` : 'rgba(128,128,128,0.1)',
                  },
                ]}
                onPress={handleCreateOrSaveNewGym}
                activeOpacity={0.7}
              >
                <Building2 size={13} color={isNewGymMode && totalSelected > 0 ? accent : colors.textSecondary} />
                <Text style={[styles.addGymBtnText, { color: isNewGymMode && totalSelected > 0 ? accent : colors.textSecondary }]}>
                  {newGymBtnLabel}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.selectAllRow}>
          <Text style={[styles.selectAllLabel, { color: colors.textSecondary }]}>
            ALL EQUIPMENT
          </Text>
          <TouchableOpacity
            style={[
              styles.selectAllPill,
              {
                backgroundColor: allSelected ? 'rgba(128,128,128,0.12)' : `${accent}18`,
                borderColor: allSelected ? 'rgba(128,128,128,0.3)' : `${accent}40`,
              },
            ]}
            onPress={allSelected ? handleDeselectAll : handleSelectAll}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.selectAllPillText,
                { color: allSelected ? colors.textSecondary : accent },
              ]}
            >
              {allSelected ? 'Deselect All' : 'Select All'}
            </Text>
          </TouchableOpacity>
        </View>

        {EQUIPMENT_CATEGORIES.map((cat) => {
          const selectedInCat = cat.items.filter((i) => (localEquip[i.id] ?? 0) > 0).length;
          const allCatSelected = selectedInCat === cat.items.length;
          const isExpanded = expandedCats[cat.id] ?? false;

          return (
            <View
              key={cat.id}
              style={[styles.catSection, { backgroundColor: colors.card }]}
            >
              <TouchableOpacity
                style={styles.catHeader}
                onPress={() => toggleCat(cat.id)}
                activeOpacity={0.7}
              >
                <View style={styles.catTitleRow}>
                  <Text style={[styles.catName, { color: colors.text }]}>{cat.name}</Text>
                  {selectedInCat > 0 && (
                    <View style={[styles.catBadge, { backgroundColor: accent }]}>
                      <Text style={styles.catBadgeText}>{selectedInCat}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.catHeaderRight}>
                  <TouchableOpacity
                    onPress={() => handleSelectAllCat(cat.id, cat.items)}
                    activeOpacity={0.7}
                    style={styles.catSelectAll}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <Text
                      style={[
                        styles.catSelectAllText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {allCatSelected ? 'Deselect all' : 'Select all'}
                    </Text>
                  </TouchableOpacity>
                  {isExpanded ? (
                    <ChevronUp size={16} color={colors.textMuted} />
                  ) : (
                    <ChevronDown size={16} color={colors.textMuted} />
                  )}
                </View>
              </TouchableOpacity>

              {isExpanded && (
                <View style={[styles.catItems, { borderTopColor: colors.border }]}>
                  {cat.items.map((item, i) => {
                    const isOn = (localEquip[item.id] ?? 0) > 0;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.itemRow,
                          i < cat.items.length - 1 && {
                            borderBottomWidth: 1,
                            borderBottomColor: colors.border,
                          },
                        ]}
                        onPress={() => handleToggleItem(item.id)}
                        activeOpacity={0.6}
                      >
                        <Text
                          style={[
                            styles.itemName,
                            { color: isOn ? colors.text : colors.textSecondary },
                          ]}
                        >
                          {item.name}
                        </Text>
                        <View
                          style={[
                            styles.checkbox,
                            {
                              borderColor: isOn ? accent : colors.border,
                              backgroundColor: isOn ? accent : 'transparent',
                            },
                          ]}
                        >
                          {isOn && <Check size={11} color="#fff" strokeWidth={3} />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        <View style={{ height: 24 }} />
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetBg: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 8,
  },
  headerCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(128,128,128,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' },
  headerIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  selectedCount: { fontSize: 12 },
  activeGymPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  activeGymPillText: { fontSize: 11, fontWeight: '600' },
  headerDoneBtn: {
    borderRadius: 19,
    width: 80,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerDoneText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600' as const,
  },
  content: { paddingHorizontal: 16, gap: 10, paddingBottom: 12 },
  presetsLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  presetsRow: { flexDirection: 'row', gap: 8 },
  savedGymsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 9,
  },
  savedGymsBtnLabel: { fontSize: 13, fontWeight: '600' as const },
  savedGymsBtnBadge: {
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  savedGymsBtnBadgeText: { fontSize: 11, fontWeight: '700' as const },
  presetCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 9,
    paddingVertical: 10,
    gap: 7,
  },
  presetText: { flex: 1 },
  presetTitle: { fontSize: 12, fontWeight: '600' },
  presetSub: { fontSize: 10 },
  presetCheck: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedGymsPanel: {
    borderRadius: 14,
    padding: 12,
    gap: 8,
    borderWidth: 1,
  },
  noGymsText: { fontSize: 13, textAlign: 'center', paddingVertical: 8 },
  savedGymRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  savedGymIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedGymInfo: { flex: 1 },
  savedGymName: { fontSize: 14, fontWeight: '600' },
  savedGymCount: { fontSize: 11 },
  activeIndicator: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteGymBtn: { padding: 4 },
  addGymInputRow: { flexDirection: 'row', gap: 8 },
  addGymInput: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  addGymConfirm: {
    borderRadius: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addGymConfirmText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  addGymCancel: {
    width: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addGymBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignSelf: 'stretch',
  },
  addGymBtnText: { fontSize: 12, fontWeight: '600' },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  selectAllLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  selectAllPill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  selectAllPillText: { fontSize: 12, fontWeight: '600' },
  catSection: { borderRadius: 14, overflow: 'hidden' },
  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  catTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catName: { fontSize: 15, fontWeight: '700' },
  catBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  catHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catSelectAll: { paddingHorizontal: 4 },
  catSelectAllText: { fontSize: 12, fontWeight: '600' },
  catItems: { borderTopWidth: 1 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  itemName: { flex: 1, fontSize: 14 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
