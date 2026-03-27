import React, { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useDrawerSizing } from '@/components/drawers/useDrawerSizing';
import DrawerHeader from '@/components/drawers/DrawerHeader';
import {
  X,
  Search,
  ChevronDown,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  Dumbbell,
  Zap,
  Flame,
  Wind,
  Target,
  TrendingUp,
  Move,
  Layers,
  Circle,
  Info,
} from 'lucide-react-native';
import { useZealTheme, useAppContext } from '@/context/AppContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { showProGate } from '@/services/proGate';
import { getZealExerciseDatabase, type ZealExercise, type MuscleGroup, type EquipmentId } from '@/mocks/exerciseDatabase';
import ExerciseDetailDrawer from '@/components/drawers/ExerciseDetailDrawer';
import type { WorkoutExercise } from '@/services/workoutEngine';

interface Props {
  visible: boolean;
  onClose: () => void;
  onBack?: () => void;
}

interface MuscleGroupCategory {
  id: string;
  label: string;
  muscleGroups?: MuscleGroup[];
  isCardio?: boolean;
  isMobility?: boolean;
}

interface EquipmentBucket {
  id: string;
  label: string;
}

const MUSCLE_CATEGORIES: MuscleGroupCategory[] = [
  { id: 'chest', label: 'Chest', muscleGroups: ['chest', 'upper_chest', 'lower_chest'] },
  { id: 'back', label: 'Back', muscleGroups: ['lats', 'upper_back', 'lower_back', 'traps', 'rhomboids'] },
  { id: 'shoulders', label: 'Shoulders', muscleGroups: ['front_delt', 'side_delt', 'rear_delt'] },
  { id: 'arms', label: 'Arms', muscleGroups: ['biceps', 'triceps', 'forearms'] },
  { id: 'legs', label: 'Legs & Glutes', muscleGroups: ['quads', 'hamstrings', 'glutes', 'hip_flexors', 'adductors', 'abductors', 'calves'] },
  { id: 'core', label: 'Core', muscleGroups: ['core', 'obliques', 'transverse_abdominis', 'pelvic_floor'] },
  { id: 'cardio', label: 'Cardio & Conditioning', isCardio: true },
  { id: 'mobility', label: 'Mobility & Stretch', isMobility: true },
];

const EQUIP_BUCKETS: EquipmentBucket[] = [
  { id: 'barbell', label: 'Barbell' },
  { id: 'machine_cable', label: 'Machine & Cable' },
  { id: 'dumbbell_kb', label: 'Dumbbell & KB' },
  { id: 'bodyweight', label: 'Bodyweight' },
];

const BARBELL_EQUIP = new Set<EquipmentId>(['barbell', 'squat_rack', 'power_rack', 'ez_curl_bar', 'trap_bar', 'smith_machine']);
const MACHINE_CABLE_EQUIP = new Set<EquipmentId>(['cable_machine', 'lat_pulldown_machine', 'leg_press_machine', 'leg_curl_machine', 'leg_extension_machine', 'pec_deck_machine', 'chest_press_machine', 'shoulder_press_machine', 'seated_row_machine', 'hack_squat_machine', 'lateral_raise_machine', 'roman_chair']);
const DUMBBELL_KB_EQUIP = new Set<EquipmentId>(['dumbbell', 'kettlebell']);

function getEquipmentBucket(ex: ZealExercise): string {
  const equip = ex.equipment_required.filter(e => e !== 'bodyweight');
  if (equip.length === 0) return 'bodyweight';
  if (equip.some(e => BARBELL_EQUIP.has(e))) return 'barbell';
  if (equip.some(e => MACHINE_CABLE_EQUIP.has(e))) return 'machine_cable';
  if (equip.some(e => DUMBBELL_KB_EQUIP.has(e))) return 'dumbbell_kb';
  return 'bodyweight';
}

function getMuscleCategory(ex: ZealExercise): string {
  if (ex.movement_pattern === 'mobility' || ex.movement_pattern === 'pilates') return 'mobility';
  if (ex.movement_pattern === 'cardio' || ex.movement_pattern === 'plyometric') return 'cardio';
  for (const cat of MUSCLE_CATEGORIES) {
    if (cat.muscleGroups && ex.primary_muscles.some(m => (cat.muscleGroups as MuscleGroup[]).includes(m))) {
      return cat.id;
    }
  }
  if (ex.eligible_styles.some(s => s === 'cardio' || s === 'hiit' || s === 'hyrox')) return 'cardio';
  if (ex.eligible_styles.some(s => s === 'mobility' || s === 'pilates')) return 'mobility';
  return 'core';
}

function getMovementLabel(ex: ZealExercise): string {
  if (ex.is_compound) return ex.spinal_load === 'heavy' ? 'Heavy Compound' : 'Compound';
  return 'Isolation';
}

const MUSCLE_DISPLAY_MAP: Partial<Record<MuscleGroup, string>> = {
  chest: 'Chest', upper_chest: 'Chest', lower_chest: 'Chest',
  front_delt: 'Shoulders', side_delt: 'Shoulders', rear_delt: 'Rear Delts',
  lats: 'Lats', upper_back: 'Upper Back', lower_back: 'Lower Back',
  traps: 'Traps', rhomboids: 'Back',
  biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms',
  quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes',
  hip_flexors: 'Hip Flexors', adductors: 'Adductors', abductors: 'Abductors', calves: 'Calves',
  core: 'Core', obliques: 'Obliques', transverse_abdominis: 'Core', pelvic_floor: 'Core', neck: 'Neck',
};

function getPrimaryMuscleDisplay(ex: ZealExercise): string {
  return [...new Set(ex.primary_muscles.map(m => MUSCLE_DISPLAY_MAP[m] ?? m))].join(', ');
}

function getCategoryIcon(catId: string, color: string) {
  const size = 17;
  switch (catId) {
    case 'chest': return <Target size={size} color={color} />;
    case 'back': return <Layers size={size} color={color} />;
    case 'shoulders': return <Zap size={size} color={color} />;
    case 'arms': return <Dumbbell size={size} color={color} />;
    case 'legs': return <TrendingUp size={size} color={color} />;
    case 'core': return <Move size={size} color={color} />;
    case 'cardio': return <Flame size={size} color={color} />;
    case 'mobility': return <Wind size={size} color={color} />;
    default: return <Circle size={size} color={color} />;
  }
}

function zealExToWorkoutEx(ex: ZealExercise): WorkoutExercise {
  const primaryMuscle = (ex.primary_muscles ?? [])[0] ?? 'Full Body';
  const muscleLabel = primaryMuscle.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const equipRaw = (ex.equipment_required ?? []).filter((e: string) => e !== 'bodyweight')[0];
  const equipLabel = equipRaw
    ? equipRaw.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : 'Bodyweight';
  return {
    id: ex.id,
    name: ex.name,
    sets: 3,
    reps: '8-12',
    rest: '60s',
    muscleGroup: muscleLabel,
    equipment: equipLabel,
    notes: '',
    type: 'main',
    movementType: ex.is_compound ? 'moderateCompound' : 'isolation',
    groupType: null,
    groupId: null,
    suggestedWeight: '',
    lastSessionWeight: '',
    lastSessionReps: '',
    exerciseRef: ex,
  };
}

export default function ExerciseCatalogDrawer({ visible, onClose, onBack }: Props) {
  const { colors, accent } = useZealTheme();
  const ctx = useAppContext();
  const { hasPro, openPaywall } = useSubscription();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const { snapPoints, maxDynamicContentSize, topOffset, scrollEnabled, setContentH } = useDrawerSizing({ minHeight: 480 });

  const [search, setSearch] = useState('');
  const [expandedMuscle, setExpandedMuscle] = useState<string | null>(null);
  const [expandedEquip, setExpandedEquip] = useState<string | null>(null);
  const [detailExercise, setDetailExercise] = useState<WorkoutExercise | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      setSearch('');
      setExpandedMuscle(null);
      setExpandedEquip(null);
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible]);

  const handleDismiss = useCallback(() => { onClose(); }, [onClose]);

  const renderBackdrop = useCallback((props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
    <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.6} pressBehavior="close" />
  ), []);

  const allExercises = useMemo(() => getZealExerciseDatabase(), []);

  const catalogMap = useMemo(() => {
    const map: Record<string, Record<string, ZealExercise[]>> = {};
    for (const cat of MUSCLE_CATEGORIES) {
      map[cat.id] = {};
      for (const bucket of EQUIP_BUCKETS) {
        map[cat.id][bucket.id] = [];
      }
    }
    for (const ex of allExercises) {
      const muscleId = getMuscleCategory(ex);
      const equipId = getEquipmentBucket(ex);
      if (map[muscleId]) {
        map[muscleId][equipId].push(ex);
      }
    }
    return map;
  }, [allExercises]);

  const filteredCatalog = useMemo(() => {
    if (!search.trim()) return catalogMap;
    const q = search.toLowerCase();
    const result: Record<string, Record<string, ZealExercise[]>> = {};
    for (const cat of MUSCLE_CATEGORIES) {
      result[cat.id] = {};
      for (const bucket of EQUIP_BUCKETS) {
        result[cat.id][bucket.id] = (catalogMap[cat.id]?.[bucket.id] ?? []).filter(ex =>
          ex.name.toLowerCase().includes(q) ||
          ex.aliases.some(a => a.toLowerCase().includes(q)) ||
          ex.primary_muscles.some(m => m.toLowerCase().includes(q)) ||
          ex.secondary_muscles.some(m => m.toLowerCase().includes(q))
        );
      }
    }
    return result;
  }, [catalogMap, search]);

  const handleOpenDetail = useCallback((ex: ZealExercise) => {
    setDetailExercise(zealExToWorkoutEx(ex));
    setDetailVisible(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setDetailVisible(false);
    setDetailExercise(null);
  }, []);

  const handleTogglePref = useCallback((exerciseId: string, pref: 'liked' | 'disliked') => {
    if (!hasPro) {
      showProGate('exercisePrefs', openPaywall);
      return;
    }
    const current = ctx.exercisePreferences[exerciseId] ?? 'neutral';
    const next: 'liked' | 'disliked' | 'neutral' = current === pref ? 'neutral' : pref;
    const updated: Record<string, 'liked' | 'disliked' | 'neutral'> = { ...ctx.exercisePreferences, [exerciseId]: next };
    ctx.saveExercisePreferences(updated);
  }, [ctx, hasPro, openPaywall]);

  const toggleMuscleGroup = useCallback((muscleId: string) => {
    setExpandedMuscle(prev => {
      if (prev === muscleId) {
        setExpandedEquip(null);
        return null;
      }
      setExpandedEquip(null);
      return muscleId;
    });
  }, []);

  const toggleEquipBucket = useCallback((muscleId: string, equipId: string) => {
    const key = `${muscleId}_${equipId}`;
    setExpandedEquip(prev => prev === key ? null : key);
  }, []);

  const totalCount = allExercises.length;

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
      stackBehavior="push"
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      <DrawerHeader
        title={`Exercise Catalog · ${totalCount}`}
        onBack={onBack}
        onClose={onBack ? undefined : onClose}
      />

      <BottomSheetScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        scrollEnabled={scrollEnabled}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        onContentSizeChange={(_w: number, h: number) => setContentH(h)}
      >
        <View style={[styles.searchContainer, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
          <Search size={16} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search exercises, muscles..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
              <X size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.legendRow]}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#22c55e' }]} />
            <Text style={[styles.legendText, { color: colors.textSecondary }]}>Liked — always included</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
            <Text style={[styles.legendText, { color: colors.textSecondary }]}>Disliked — never included</Text>
          </View>
        </View>

        {MUSCLE_CATEGORIES.map(cat => {
          const catData = filteredCatalog[cat.id] ?? {};
          const totalInCat = Object.values(catData).reduce((sum, arr) => sum + arr.length, 0);
          if (totalInCat === 0) return null;

          const isExpanded = expandedMuscle === cat.id;

          const likedCount = Object.values(catData).flat().filter(ex => ctx.exercisePreferences[ex.id] === 'liked').length;
          const dislikedCount = Object.values(catData).flat().filter(ex => ctx.exercisePreferences[ex.id] === 'disliked').length;

          return (
            <View key={cat.id} style={[styles.muscleGroupCard, { borderColor: isExpanded ? `${accent}40` : colors.border, backgroundColor: colors.card }]}>
              <TouchableOpacity
                style={[styles.muscleGroupRow, { backgroundColor: isExpanded ? `${accent}08` : 'transparent' }]}
                onPress={() => toggleMuscleGroup(cat.id)}
                activeOpacity={0.75}
              >
                <View style={[styles.catIconWrap, { backgroundColor: `${accent}18` }]}>
                  {getCategoryIcon(cat.id, accent)}
                </View>
                <View style={styles.catTextBlock}>
                  <Text style={[styles.catLabel, { color: colors.text }]}>{cat.label}</Text>
                  <View style={styles.catMetaRow}>
                    <Text style={[styles.catCount, { color: colors.textSecondary }]}>{totalInCat} exercises</Text>
                    {likedCount > 0 && (
                      <View style={[styles.miniPill, { backgroundColor: '#22c55e20' }]}>
                        <ThumbsUp size={9} color='#22c55e' strokeWidth={2.5} />
                        <Text style={[styles.miniPillText, { color: '#22c55e' }]}>{likedCount}</Text>
                      </View>
                    )}
                    {dislikedCount > 0 && (
                      <View style={[styles.miniPill, { backgroundColor: '#ef444420' }]}>
                        <ThumbsDown size={9} color='#ef4444' strokeWidth={2.5} />
                        <Text style={[styles.miniPillText, { color: '#ef4444' }]}>{dislikedCount}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <ChevronRight
                  size={16}
                  color={isExpanded ? accent : colors.textMuted}
                  style={isExpanded ? styles.chevronRotated : styles.chevronDefault}
                />
              </TouchableOpacity>

              {isExpanded && (
                <View style={[styles.bucketsWrapper, { borderTopColor: colors.border }]}>
                  {EQUIP_BUCKETS.map(bucket => {
                    const exercises = catData[bucket.id] ?? [];
                    if (exercises.length === 0) return null;
                    const equipKey = `${cat.id}_${bucket.id}`;
                    const isEquipExpanded = expandedEquip === equipKey;

                    return (
                      <View key={bucket.id} style={[styles.bucketGroup, { borderBottomColor: colors.border }]}>
                        <TouchableOpacity
                          style={[styles.bucketRow, { backgroundColor: isEquipExpanded ? `${accent}06` : 'transparent' }]}
                          onPress={() => toggleEquipBucket(cat.id, bucket.id)}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.bucketDot, { backgroundColor: isEquipExpanded ? accent : colors.border }]} />
                          <Text style={[styles.bucketLabel, { color: isEquipExpanded ? accent : colors.textSecondary }]}>
                            {bucket.label}
                          </Text>
                          <Text style={[styles.bucketCount, { color: colors.textMuted }]}>{exercises.length}</Text>
                          <ChevronDown
                            size={13}
                            color={isEquipExpanded ? accent : colors.textMuted}
                            style={isEquipExpanded ? styles.chevronUp : styles.chevronDefault}
                          />
                        </TouchableOpacity>

                        {isEquipExpanded && exercises.map((ex, idx) => {
                          const pref = ctx.exercisePreferences[ex.id] ?? 'neutral';
                          const isLiked = pref === 'liked';
                          const isDisliked = pref === 'disliked';
                          const movLabel = getMovementLabel(ex);
                          const isLast = idx === exercises.length - 1;

                          return (
                            <TouchableOpacity
                              key={ex.id}
                              style={[
                                styles.exRow,
                                { borderBottomColor: colors.border },
                                isLast && styles.exRowLast,
                                isLiked && styles.exRowLiked,
                                isDisliked && styles.exRowDisliked,
                              ]}
                              onPress={() => handleOpenDetail(ex)}
                              activeOpacity={0.75}
                            >
                              <View style={styles.exInfo}>
                                <View style={styles.exNameRow}>
                                  <Text style={[styles.exName, { color: isDisliked ? colors.textMuted : colors.text }]} numberOfLines={1}>
                                    {ex.name}
                                  </Text>
                                  <Info size={13} color={colors.textMuted} strokeWidth={2} />
                                </View>
                                <View style={styles.exMetaRow}>
                                  <Text style={[styles.exMuscle, { color: colors.textSecondary }]}>
                                    {getPrimaryMuscleDisplay(ex)}
                                  </Text>
                                  <Text style={[styles.exMovLabel, { color: colors.textMuted }]}>
                                    {' · '}{movLabel}
                                  </Text>
                                </View>
                              </View>
                              <View style={styles.prefRow}>
                                <TouchableOpacity
                                  style={[styles.prefBtn, isLiked && styles.prefBtnLiked]}
                                  onPress={(e) => { e.stopPropagation?.(); handleTogglePref(ex.id, 'liked'); }}
                                  activeOpacity={0.7}
                                  testID={`like-${ex.id}`}
                                >
                                  <ThumbsUp
                                    size={17}
                                    color={isLiked ? '#fff' : colors.textMuted}
                                    strokeWidth={2}
                                  />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.prefBtn, isDisliked && styles.prefBtnDisliked]}
                                  onPress={(e) => { e.stopPropagation?.(); handleTogglePref(ex.id, 'disliked'); }}
                                  activeOpacity={0.7}
                                  testID={`dislike-${ex.id}`}
                                >
                                  <ThumbsDown
                                    size={17}
                                    color={isDisliked ? '#fff' : colors.textMuted}
                                    strokeWidth={2}
                                  />
                                </TouchableOpacity>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </BottomSheetScrollView>
    </BottomSheetModal>

    <ExerciseDetailDrawer
      visible={detailVisible}
      exercise={detailExercise}
      workoutStyle="strength"
      onClose={handleCloseDetail}
      onBack={handleCloseDetail}
    />
    </>
  );
}

const styles = StyleSheet.create({
  sheetBg: { borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
  },
  headerTextBlock: { flex: 1, marginRight: 10 },
  title: { fontSize: 20, fontWeight: '800' as const, letterSpacing: -0.5 },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  subtitle: { fontSize: 12, lineHeight: 16 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(128,128,128,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  content: { paddingHorizontal: 14, gap: 8, paddingBottom: 8 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 11,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  legendRow: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 4,
    paddingBottom: 2,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 3.5 },
  legendText: { fontSize: 11 },
  muscleGroupCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  muscleGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  catIconWrap: {
    width: 38, height: 38, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  catTextBlock: { flex: 1 },
  catLabel: { fontSize: 16, fontWeight: '700' as const, letterSpacing: -0.2 },
  catMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  catCount: { fontSize: 12 },
  miniPill: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', gap: 3 },
  miniPillText: { fontSize: 10, fontWeight: '600' as const },
  chevronDefault: {},
  chevronRotated: { transform: [{ rotate: '90deg' }] },
  chevronUp: { transform: [{ rotate: '180deg' }] },
  bucketsWrapper: { borderTopWidth: 1 },
  bucketGroup: { borderBottomWidth: 0.5 },
  bucketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  bucketDot: { width: 7, height: 7, borderRadius: 3.5, flexShrink: 0 },
  bucketLabel: { flex: 1, fontSize: 13, fontWeight: '600' as const, letterSpacing: -0.1 },
  bucketCount: { fontSize: 12 },
  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingLeft: 34,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    gap: 8,
  },
  exRowLast: { borderBottomWidth: 0 },
  exRowLiked: { borderLeftWidth: 3, borderLeftColor: '#22c55e', paddingLeft: 31 },
  exRowDisliked: { borderLeftWidth: 3, borderLeftColor: '#ef4444', paddingLeft: 31, opacity: 0.6 },
  exInfo: { flex: 1, gap: 3 },
  exNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  exName: { flex: 1, fontSize: 15, fontWeight: '600' as const, letterSpacing: -0.1 },
  exMetaRow: { flexDirection: 'row', alignItems: 'center' },
  exMuscle: { fontSize: 12 },
  exMovLabel: { fontSize: 11 },
  prefRow: { flexDirection: 'row', gap: 6, flexShrink: 0 },
  prefBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(128,128,128,0.1)',
  },
  prefBtnLiked: { backgroundColor: '#22c55e' },
  prefBtnDisliked: { backgroundColor: '#ef4444' },
});
