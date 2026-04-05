import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { X, ChevronDown, ChevronUp, Plus, Check, User, Building2, Trash2 } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useZealTheme, useAppContext, SavedGym } from '@/context/AppContext';
import { EQUIPMENT_CATEGORIES, ALL_EQUIPMENT_IDS } from '@/mocks/equipmentData';
import BaseDrawer from '@/components/drawers/BaseDrawer';

const ACTIVE_GYM_KEY = '@zeal_active_gym_id';

// Returns the best gym id: exact match first, then highest overlap, then first gym.
// Always returns a gym id when gyms exist — never leaves the user without a selection.
function findBestGym(equip: Record<string, number>, gyms: SavedGym[]): string | null {
  if (gyms.length === 0) return null;
  const selectedIds = new Set(
    Object.entries(equip).filter(([, v]) => v > 0).map(([k]) => k)
  );
  // 1. Exact match
  for (const gym of gyms) {
    const gymIds = new Set(Object.entries(gym.equipment).filter(([, v]) => v > 0).map(([k]) => k));
    if (selectedIds.size === gymIds.size && [...selectedIds].every(id => gymIds.has(id))) {
      return gym.id;
    }
  }
  // 2. Best overlap
  let bestId = gyms[0].id;
  let bestScore = -1;
  for (const gym of gyms) {
    const gymIds = new Set(Object.entries(gym.equipment).filter(([, v]) => v > 0).map(([k]) => k));
    const overlap = [...selectedIds].filter(id => gymIds.has(id)).length;
    if (overlap > bestScore) {
      bestScore = overlap;
      bestId = gym.id;
    }
  }
  return bestId;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function EquipmentDrawer({ visible, onClose }: Props) {
  const { colors, accent, isDark } = useZealTheme();
  const { selectedEquipment, setSelectedEquipment, savedGyms, setSavedGyms, saveState, bumpSettingsSaveVersion } =
    useAppContext();

  const [localEquip, setLocalEquip] = useState<Record<string, number>>({});
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const [activeGymId, setActiveGymId] = useState<string | null>(null);
  const [addGymMode, setAddGymMode] = useState(false);
  const [newGymName, setNewGymName] = useState('');

  // Refs so commitAndClose always reads fresh state without re-creating
  const localEquipRef = useRef(localEquip);
  useEffect(() => { localEquipRef.current = localEquip; }, [localEquip]);
  const activeGymIdRef = useRef(activeGymId);
  useEffect(() => { activeGymIdRef.current = activeGymId; }, [activeGymId]);

  // Read savedGyms without making it an effect dep (avoids reset mid-session)
  const savedGymsRef = useRef(savedGyms);
  useEffect(() => { savedGymsRef.current = savedGyms; }, [savedGyms]);

  useEffect(() => {
    if (!visible) return;

    const equip = { ...selectedEquipment };
    setLocalEquip(equip);
    setExpandedCats({});
    setAddGymMode(false);
    setNewGymName('');

    const gyms = savedGymsRef.current;

    // Synchronously pick best match so there's no flash of "nothing selected"
    const syncBest = findBestGym(equip, gyms);
    setActiveGymId(syncBest);

    // Then async: prefer the last-used gym if it still exists in the list
    if (gyms.length > 0) {
      AsyncStorage.getItem(ACTIVE_GYM_KEY).then(persistedId => {
        if (persistedId && savedGymsRef.current.find(g => g.id === persistedId)) {
          setActiveGymId(persistedId);
        }
      }).catch(() => {});
    }
  }, [visible, selectedEquipment]);

  // Save and close — called on every close path (Done, X, swipe down)
  const commitAndClose = useCallback(() => {
    const equip = localEquipRef.current;
    const gymId = activeGymIdRef.current;
    setSelectedEquipment(equip);
    if (gymId) {
      setSavedGyms(prev =>
        prev.map(g => g.id === gymId ? { ...g, equipment: { ...equip } } : g)
      );
      AsyncStorage.setItem(ACTIVE_GYM_KEY, gymId).catch(() => {});
    }
    requestAnimationFrame(() => {
      saveState();
      bumpSettingsSaveVersion();
    });
    onClose();
  }, [setSelectedEquipment, setSavedGyms, saveState, bumpSettingsSaveVersion, onClose]);

  const totalSelected = Object.values(localEquip).filter((v) => v > 0).length;
  const totalItems = ALL_EQUIPMENT_IDS.length;
  const allSelected = totalSelected === totalItems;
  const isNoEquipActive = Object.keys(localEquip).length > 0 && totalSelected === 0;

  const handleNoEquipment = () => {
    const none: Record<string, number> = {};
    ALL_EQUIPMENT_IDS.forEach((id) => { none[id] = 0; });
    setLocalEquip(none);
    setActiveGymId(null);
  };

  const handleCommercialGym = () => {
    const all: Record<string, number> = {};
    ALL_EQUIPMENT_IDS.forEach((id) => { all[id] = 1; });
    setLocalEquip(all);
    setActiveGymId(null);
  };

  const handleToggleItem = (id: string) => {
    setLocalEquip((prev) => ({
      ...prev,
      [id]: prev[id] && prev[id] > 0 ? 0 : 1,
    }));
  };

  const handleSelectAllCat = (items: { id: string }[]) => {
    const allCatSelected = items.every((item) => (localEquip[item.id] ?? 0) > 0);
    setLocalEquip((prev) => {
      const next = { ...prev };
      items.forEach((item) => { next[item.id] = allCatSelected ? 0 : 1; });
      return next;
    });
  };

  const toggleCat = (catId: string) => {
    setExpandedCats((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  const handleLoadGym = useCallback((gym: SavedGym) => {
    setLocalEquip({ ...gym.equipment });
    setActiveGymId(gym.id);
    setAddGymMode(false);
  }, []);

  const handleCreateGym = () => {
    if (!newGymName.trim()) {
      Alert.alert('Name required', 'Please enter a name for this gym preset.');
      return;
    }
    // Start with empty selection — user builds this gym from scratch
    const emptyEquip: Record<string, number> = {};
    ALL_EQUIPMENT_IDS.forEach((id) => { emptyEquip[id] = 0; });
    const newGym: SavedGym = {
      id: Date.now().toString(),
      name: newGymName.trim(),
      equipment: emptyEquip,
    };
    setSavedGyms(prev => [...prev, newGym]);
    setActiveGymId(newGym.id);
    setLocalEquip(emptyEquip);
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

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Equipment',
      'Remove all items from your selection?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
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

  const headerContent = (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={commitAndClose}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
      >
        <X size={18} color={colors.textSecondary} strokeWidth={2} />
      </TouchableOpacity>
      <View style={styles.headerCenter}>
        <Text style={[styles.title, { color: colors.text }]}>Equipment</Text>
        <Text style={[styles.headerCount, { color: colors.textMuted }]}>
          {totalSelected} / {totalItems}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.doneBtn, { backgroundColor: accent }]}
        onPress={commitAndClose}
        activeOpacity={0.85}
      >
        <Text style={styles.doneBtnText}>Done</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <BaseDrawer visible={visible} onClose={commitAndClose} header={headerContent} hasTextInput stackBehavior="push">
      <View style={styles.content}>

        {/* ── Quick Presets ──────────────────────────────────── */}
        <View style={styles.presetsRow}>
          <TouchableOpacity
            style={[
              styles.presetCard,
              { backgroundColor: colors.card, borderColor: isNoEquipActive ? accent : colors.border },
            ]}
            onPress={handleNoEquipment}
            activeOpacity={0.7}
          >
            <User size={18} color={isNoEquipActive ? accent : colors.textMuted} />
            <View>
              <Text style={[styles.presetTitle, { color: isNoEquipActive ? accent : colors.text }]}>No Equipment</Text>
              <Text style={[styles.presetSub, { color: colors.textMuted }]}>Bodyweight only</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.presetCard,
              { backgroundColor: colors.card, borderColor: allSelected ? accent : colors.border },
            ]}
            onPress={handleCommercialGym}
            activeOpacity={0.7}
          >
            <Building2 size={18} color={allSelected ? accent : colors.textMuted} />
            <View>
              <Text style={[styles.presetTitle, { color: allSelected ? accent : colors.text }]}>Commercial Gym</Text>
              <Text style={[styles.presetSub, { color: colors.textMuted }]}>All equipment</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── My Gyms ───────────────────────────────────────── */}
        <View style={[styles.gymsSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>MY GYMS</Text>

          {savedGyms.length === 0 && !addGymMode && (
            <Text style={[styles.emptyGymsText, { color: colors.textMuted }]}>
              Save your equipment setup to quickly switch between gym locations.
            </Text>
          )}

          {savedGyms.map((gym, idx) => {
            const isActive = gym.id === activeGymId;
            // Active gym count updates live with current selection; inactive shows saved count
            const displayCount = isActive
              ? totalSelected
              : Object.values(gym.equipment).filter(v => v > 0).length;
            return (
              <TouchableOpacity
                key={gym.id}
                style={[
                  styles.gymRow,
                  { borderTopColor: colors.border },
                  idx === 0 && { borderTopWidth: StyleSheet.hairlineWidth },
                  isActive && { backgroundColor: `${accent}08` },
                ]}
                onPress={() => handleLoadGym(gym)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.gymCheckCircle,
                  { borderColor: isActive ? accent : colors.border, backgroundColor: isActive ? accent : 'transparent' },
                ]}>
                  {isActive && <Check size={10} color="#fff" strokeWidth={3} />}
                </View>
                <View style={styles.gymInfo}>
                  <Text style={[styles.gymName, { color: colors.text }]}>{gym.name}</Text>
                  <Text style={[styles.gymCount, { color: colors.textMuted }]}>{displayCount} items</Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDeleteGym(gym.id)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Trash2 size={15} color={colors.textMuted} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}

          {addGymMode ? (
            <View style={[styles.gymInputRow, { borderTopColor: colors.border, borderTopWidth: savedGyms.length > 0 ? StyleSheet.hairlineWidth : 0 }]}>
              <TextInput
                style={[styles.gymInput, { color: colors.text, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}
                value={newGymName}
                onChangeText={setNewGymName}
                placeholder="e.g. Home Gym, Gold's..."
                placeholderTextColor={colors.textMuted}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleCreateGym}
              />
              <TouchableOpacity
                style={[styles.gymInputSaveBtn, { backgroundColor: accent }]}
                onPress={handleCreateGym}
                activeOpacity={0.85}
              >
                <Text style={styles.gymInputSaveBtnText}>Create</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setAddGymMode(false); setNewGymName(''); }}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={15} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.saveGymBtn,
                { borderTopColor: colors.border, borderTopWidth: savedGyms.length > 0 ? StyleSheet.hairlineWidth : 0 },
              ]}
              onPress={() => setAddGymMode(true)}
              activeOpacity={0.7}
            >
              <Plus size={14} color={colors.textSecondary} />
              <Text style={[styles.saveGymBtnText, { color: colors.textSecondary }]}>
                Add New Gym Preset
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Selection count + Clear ────────────────────────── */}
        <View style={styles.countRow}>
          <Text style={[styles.countText, { color: colors.textMuted }]}>
            {isNoEquipActive
              ? 'Bodyweight only — no equipment'
              : `${totalSelected} item${totalSelected !== 1 ? 's' : ''} selected`}
          </Text>
          {totalSelected > 0 && (
            <TouchableOpacity onPress={handleClearAll} activeOpacity={0.7}>
              <Text style={[styles.clearText, { color: colors.textSecondary }]}>Clear all</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Equipment Categories ───────────────────────────── */}
        {EQUIPMENT_CATEGORIES.map((cat) => {
          const selectedInCat = cat.items.filter((i) => (localEquip[i.id] ?? 0) > 0).length;
          const allCatSelected = selectedInCat === cat.items.length;
          const isExpanded = expandedCats[cat.id] ?? false;

          return (
            <View key={cat.id} style={[styles.catSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TouchableOpacity
                style={styles.catHeader}
                onPress={() => toggleCat(cat.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.catName, { color: colors.text }]}>{cat.name}</Text>
                <View style={styles.catHeaderRight}>
                  {selectedInCat > 0 && (
                    <Text style={[styles.catSelectedCount, { color: accent }]}>{selectedInCat}</Text>
                  )}
                  {isExpanded
                    ? <ChevronUp size={17} color={colors.textMuted} />
                    : <ChevronDown size={17} color={colors.textMuted} />
                  }
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
                          i < cat.items.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                        ]}
                        onPress={() => handleToggleItem(item.id)}
                        activeOpacity={0.6}
                      >
                        <Text style={[styles.itemName, { color: isOn ? colors.text : colors.textSecondary }]}>
                          {item.name}
                        </Text>
                        <View style={[
                          styles.checkbox,
                          { borderColor: isOn ? accent : colors.border, backgroundColor: isOn ? accent : 'transparent' },
                        ]}>
                          {isOn && <Check size={12} color="#fff" strokeWidth={3} />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}

                  <TouchableOpacity
                    style={[styles.catSelectAllRow, { borderTopColor: colors.border }]}
                    onPress={() => handleSelectAllCat(cat.items)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.catSelectAllText, { color: colors.textSecondary }]}>
                      {allCatSelected ? `Clear all ${cat.name}` : `Select all ${cat.name}`}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}

        <View style={{ height: 28 }} />
      </View>
    </BaseDrawer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 12,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 7,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.3,
  },
  headerCount: {
    fontSize: 13,
    fontFamily: 'Outfit_400Regular',
  },
  doneBtn: {
    borderRadius: 20,
    paddingHorizontal: 20,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
  },

  content: { paddingHorizontal: 16, gap: 10, paddingBottom: 12 },

  // ── Quick Presets ───────────────────────────────────────
  presetsRow: { flexDirection: 'row', gap: 8 },
  presetCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 13,
    gap: 10,
  },
  presetTitle: { fontSize: 13, fontFamily: 'Outfit_600SemiBold' },
  presetSub: { fontSize: 11, fontFamily: 'Outfit_400Regular', marginTop: 1 },

  // ── Gyms Section ────────────────────────────────────────
  gymsSection: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    paddingTop: 12,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.8,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  emptyGymsText: {
    fontSize: 13,
    fontFamily: 'Outfit_400Regular',
    lineHeight: 19,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  gymRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  gymCheckCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gymInfo: { flex: 1 },
  gymName: { fontSize: 15, fontFamily: 'Outfit_600SemiBold' },
  gymCount: { fontSize: 12, fontFamily: 'Outfit_400Regular', marginTop: 1 },
  gymInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  gymInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Outfit_400Regular',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  gymInputSaveBtn: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gymInputSaveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
  },
  saveGymBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  saveGymBtnText: {
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
  },

  // ── Count / Clear ────────────────────────────────────────
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  countText: { fontSize: 12, fontFamily: 'Outfit_400Regular' },
  clearText: { fontSize: 12, fontFamily: 'Outfit_500Medium' },

  // ── Equipment Categories ─────────────────────────────────
  catSection: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  catName: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    flex: 1,
  },
  catHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  catSelectedCount: {
    fontSize: 13,
    fontFamily: 'Outfit_600SemiBold',
  },
  catItems: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  itemName: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Outfit_400Regular',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catSelectAllRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  catSelectAllText: {
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
  },
});
