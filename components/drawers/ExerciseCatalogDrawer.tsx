import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import BaseDrawer from '@/components/drawers/BaseDrawer';
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
  Info,
  User,
} from 'lucide-react-native';
import { useZealTheme, useAppContext } from '@/context/AppContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { showProGate } from '@/services/proGate';
import { getZealExerciseDatabase, type ZealExercise, type MuscleGroup, type EquipmentId } from '@/mocks/exerciseDatabase';
import ExerciseDetailDrawer from '@/components/drawers/ExerciseDetailDrawer';
import type { WorkoutExercise } from '@/services/workoutEngine';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type TabId = 'muscle' | 'equipment';

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

interface EquipCategory {
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

const EQUIP_CATEGORIES: EquipCategory[] = [
  { id: 'barbell',      label: 'Barbells' },
  { id: 'dumbbell_kb',  label: 'Dumbbells & KB' },
  { id: 'bodyweight',   label: 'Body Weight' },
  { id: 'cardio_equip', label: 'Cardio' },
  { id: 'machine_cable', label: 'Machines & Cable' },
  { id: 'other',        label: 'Other' },
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

function getEquipTabBucket(ex: ZealExercise): string {
  // Cardio/plyometric movement → Cardio bucket
  if (ex.movement_pattern === 'cardio' || ex.movement_pattern === 'plyometric') return 'cardio_equip';
  const equip = ex.equipment_required.filter(e => e !== 'bodyweight');
  if (equip.length === 0) return 'bodyweight';
  if (equip.some(e => BARBELL_EQUIP.has(e))) return 'barbell';
  if (equip.some(e => MACHINE_CABLE_EQUIP.has(e))) return 'machine_cable';
  if (equip.some(e => DUMBBELL_KB_EQUIP.has(e))) return 'dumbbell_kb';
  return 'other';
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
  const size = 18;
  switch (catId) {
    case 'chest':    return <Target size={size} color={color} />;
    case 'back':     return <Layers size={size} color={color} />;
    case 'shoulders': return <Zap size={size} color={color} />;
    case 'arms':     return <Dumbbell size={size} color={color} />;
    case 'legs':     return <TrendingUp size={size} color={color} />;
    case 'core':     return <Move size={size} color={color} />;
    case 'cardio':   return <Flame size={size} color={color} />;
    case 'mobility': return <Wind size={size} color={color} />;
    default:         return <Target size={size} color={color} />;
  }
}

function getEquipCategoryIcon(catId: string, color: string) {
  const size = 18;
  switch (catId) {
    case 'barbell':       return <Target size={size} color={color} />;
    case 'dumbbell_kb':   return <Dumbbell size={size} color={color} />;
    case 'bodyweight':    return <User size={size} color={color} />;
    case 'cardio_equip':  return <Flame size={size} color={color} />;
    case 'machine_cable': return <Layers size={size} color={color} />;
    case 'other':         return <Zap size={size} color={color} />;
    default:              return <Target size={size} color={color} />;
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
    mediaUrl: ex.media_url || '',
    exerciseRef: ex,
  };
}

export default function ExerciseCatalogDrawer({ visible, onClose }: Props) {
  const { colors, accent, isDark } = useZealTheme();
  const ctx = useAppContext();
  const { hasPro, openPaywall } = useSubscription();

  const [activeTab, setActiveTab] = useState<TabId>('muscle');
  const [search, setSearch] = useState('');

  // Muscle tab state
  const [expandedMuscle, setExpandedMuscle] = useState<string | null>(null);
  const [expandedEquip, setExpandedEquip] = useState<string | null>(null);

  // Equipment tab state
  const [expandedEquipCat, setExpandedEquipCat] = useState<string | null>(null);

  const [detailExercise, setDetailExercise] = useState<WorkoutExercise | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      setSearch('');
      setExpandedMuscle(null);
      setExpandedEquip(null);
      setExpandedEquipCat(null);
      setActiveTab('muscle');
    }
  }, [visible]);

  const handleTabSwitch = useCallback((tab: TabId) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
    setSearch('');
    setExpandedMuscle(null);
    setExpandedEquip(null);
    setExpandedEquipCat(null);
  }, []);

  const allExercises = useMemo(() => getZealExerciseDatabase(), []);

  // ── Muscle tab catalog ─────────────────────────────────────────────────────
  const catalogMap = useMemo(() => {
    const map: Record<string, Record<string, ZealExercise[]>> = {};
    for (const cat of MUSCLE_CATEGORIES) {
      map[cat.id] = {};
      for (const bucket of EQUIP_BUCKETS) map[cat.id][bucket.id] = [];
    }
    for (const ex of allExercises) {
      const muscleId = getMuscleCategory(ex);
      const equipId = getEquipmentBucket(ex);
      if (map[muscleId]) map[muscleId][equipId].push(ex);
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
          (ex.aliases ?? []).some(a => a.toLowerCase().includes(q)) ||
          (ex.primary_muscles ?? []).some(m => m.toLowerCase().includes(q)) ||
          (ex.secondary_muscles ?? []).some(m => m.toLowerCase().includes(q))
        );
      }
    }
    return result;
  }, [catalogMap, search]);

  // ── Equipment tab catalog ──────────────────────────────────────────────────
  const equipCatalogMap = useMemo(() => {
    const map: Record<string, ZealExercise[]> = {
      barbell: [], dumbbell_kb: [], bodyweight: [],
      cardio_equip: [], machine_cable: [], other: [],
    };
    for (const ex of allExercises) {
      const bucket = getEquipTabBucket(ex);
      map[bucket]?.push(ex);
    }
    return map;
  }, [allExercises]);

  const filteredEquipCatalog = useMemo(() => {
    if (!search.trim()) return equipCatalogMap;
    const q = search.toLowerCase();
    const result: Record<string, ZealExercise[]> = {};
    for (const cat of EQUIP_CATEGORIES) {
      result[cat.id] = (equipCatalogMap[cat.id] ?? []).filter(ex =>
        ex.name.toLowerCase().includes(q) ||
        (ex.aliases ?? []).some(a => a.toLowerCase().includes(q)) ||
        (ex.primary_muscles ?? []).some(m => m.toLowerCase().includes(q)) ||
        (ex.secondary_muscles ?? []).some(m => m.toLowerCase().includes(q))
      );
    }
    return result;
  }, [equipCatalogMap, search]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleOpenDetail = useCallback((ex: ZealExercise) => {
    setDetailExercise(zealExToWorkoutEx(ex));
    setDetailVisible(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setDetailVisible(false);
    setDetailExercise(null);
  }, []);

  const handleTogglePref = useCallback((exerciseId: string, pref: 'liked' | 'disliked') => {
    if (!hasPro) { showProGate('exercisePrefs', openPaywall); return; }
    const current = ctx.exercisePreferences[exerciseId] ?? 'neutral';
    const next: 'liked' | 'disliked' | 'neutral' = current === pref ? 'neutral' : pref;
    ctx.saveExercisePreferences({ ...ctx.exercisePreferences, [exerciseId]: next });
  }, [ctx, hasPro, openPaywall]);

  const toggleMuscleGroup = useCallback((muscleId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedMuscle(prev => { if (prev === muscleId) { setExpandedEquip(null); return null; } setExpandedEquip(null); return muscleId; });
  }, []);

  const toggleEquipBucket = useCallback((muscleId: string, equipId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const key = `${muscleId}_${equipId}`;
    setExpandedEquip(prev => prev === key ? null : key);
  }, []);

  const toggleEquipCat = useCallback((catId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedEquipCat(prev => prev === catId ? null : catId);
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────
  const totalCount = allExercises.length;
  const dividerColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const iconBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const iconColor = colors.textSecondary;

  const hasAnyMuscleResults = useMemo(() => {
    if (!search.trim()) return true;
    return MUSCLE_CATEGORIES.some(cat => Object.values(filteredCatalog[cat.id] ?? {}).some(a => a.length > 0));
  }, [filteredCatalog, search]);

  const hasAnyEquipResults = useMemo(() => {
    if (!search.trim()) return true;
    return EQUIP_CATEGORIES.some(cat => (filteredEquipCatalog[cat.id] ?? []).length > 0);
  }, [filteredEquipCatalog, search]);

  // ── Shared exercise row renderer ───────────────────────────────────────────
  const renderExerciseRow = (ex: ZealExercise, idx: number, total: number, showMuscle = true) => {
    const pref = ctx.exercisePreferences[ex.id] ?? 'neutral';
    const isLiked = pref === 'liked';
    const isDisliked = pref === 'disliked';
    const movLabel = getMovementLabel(ex);
    const isLast = idx === total - 1;
    return (
      <TouchableOpacity
        key={ex.id}
        style={[
          styles.exRow,
          { borderBottomColor: dividerColor },
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
            {showMuscle && (
              <Text style={[styles.exMuscle, { color: colors.textSecondary }]}>
                {getPrimaryMuscleDisplay(ex)}
              </Text>
            )}
            <Text style={[styles.exMovLabel, { color: colors.textMuted }]}>
              {showMuscle ? ' · ' : ''}{movLabel}
            </Text>
          </View>
        </View>
        <View style={styles.prefRow}>
          <TouchableOpacity
            style={[styles.prefBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }, isLiked && styles.prefBtnLiked]}
            onPress={(e) => { e.stopPropagation?.(); handleTogglePref(ex.id, 'liked'); }}
            activeOpacity={0.7}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <ThumbsUp size={16} color={isLiked ? '#fff' : colors.textMuted} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.prefBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }, isDisliked && styles.prefBtnDisliked]}
            onPress={(e) => { e.stopPropagation?.(); handleTogglePref(ex.id, 'disliked'); }}
            activeOpacity={0.7}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <ThumbsDown size={16} color={isDisliked ? '#fff' : colors.textMuted} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Header ─────────────────────────────────────────────────────────────────
  const headerContent = (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.headerCircleBtn}
        onPress={onClose}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <X size={16} color="#888" strokeWidth={2.5} />
      </TouchableOpacity>
      <View style={styles.headerTitleWrap}>
        <Text style={[styles.title, { color: colors.text }]}>Exercise Catalog</Text>
        <View style={styles.subtitleRow}>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{totalCount} exercises · tap </Text>
          <ThumbsUp size={11} color="#22c55e" strokeWidth={2.5} />
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}> / </Text>
          <ThumbsDown size={11} color="#ef4444" strokeWidth={2.5} />
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}> to tune workouts</Text>
        </View>
      </View>
      <View style={styles.headerSpacer} />
    </View>
  );

  return (
    <>
      <BaseDrawer visible={visible} onClose={onClose} header={headerContent} hasTextInput>
        <View style={styles.content}>

          {/* ── Segmented tab bar ── */}
          <View style={[styles.tabBar, { backgroundColor: colors.cardSecondary }]}>
            {(['muscle', 'equipment'] as TabId[]).map((tab) => {
              const isActive = activeTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tabBtn, isActive && [styles.tabBtnActive, { backgroundColor: colors.card }]]}
                  onPress={() => handleTabSwitch(tab)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.tabBtnText, { color: isActive ? colors.text : colors.textMuted }]}>
                    {tab === 'muscle' ? 'Muscle Groups' : 'Equipment'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Search ── */}
          <View style={[styles.searchContainer, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
            <Search size={16} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder={activeTab === 'muscle' ? 'Search exercises, muscles...' : 'Search exercises, equipment...'}
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              selectionColor={accent}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={14} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* ── Legend ── */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <ThumbsUp size={11} color="#22c55e" strokeWidth={2.5} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>Liked — always included</Text>
            </View>
            <View style={styles.legendItem}>
              <ThumbsDown size={11} color="#ef4444" strokeWidth={2.5} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>Disliked — never included</Text>
            </View>
          </View>

          {/* ══════════════ MUSCLE GROUPS TAB ══════════════ */}
          {activeTab === 'muscle' && (
            <>
              {!hasAnyMuscleResults && (
                <View style={styles.emptyState}>
                  <Search size={32} color={colors.textMuted} strokeWidth={1.5} />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>No exercises found</Text>
                  <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                    Try a different muscle, name, or equipment type
                  </Text>
                </View>
              )}

              {MUSCLE_CATEGORIES.map(cat => {
                const catData = filteredCatalog[cat.id] ?? {};
                const totalInCat = Object.values(catData).reduce((sum, arr) => sum + arr.length, 0);
                if (totalInCat === 0) return null;
                const isExpanded = expandedMuscle === cat.id;
                const likedCount = Object.values(catData).flat().filter(ex => ctx.exercisePreferences[ex.id] === 'liked').length;
                const dislikedCount = Object.values(catData).flat().filter(ex => ctx.exercisePreferences[ex.id] === 'disliked').length;

                return (
                  <View key={cat.id} style={[styles.groupCard, { borderColor: isExpanded ? `${accent}50` : colors.border, backgroundColor: colors.card }]}>
                    <TouchableOpacity
                      style={[styles.groupRow, { backgroundColor: isExpanded ? `${accent}08` : 'transparent' }]}
                      onPress={() => toggleMuscleGroup(cat.id)}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.catIconWrap, { backgroundColor: iconBg }]}>
                        {getCategoryIcon(cat.id, iconColor)}
                      </View>
                      <View style={styles.catTextBlock}>
                        <Text style={[styles.catLabel, { color: colors.text }]}>{cat.label}</Text>
                        <View style={styles.catMetaRow}>
                          <Text style={[styles.catCount, { color: colors.textSecondary }]}>{totalInCat} exercises</Text>
                          {likedCount > 0 && (
                            <View style={[styles.miniPill, { backgroundColor: '#22c55e20' }]}>
                              <ThumbsUp size={9} color="#22c55e" strokeWidth={2.5} />
                              <Text style={[styles.miniPillText, { color: '#22c55e' }]}>{likedCount}</Text>
                            </View>
                          )}
                          {dislikedCount > 0 && (
                            <View style={[styles.miniPill, { backgroundColor: '#ef444420' }]}>
                              <ThumbsDown size={9} color="#ef4444" strokeWidth={2.5} />
                              <Text style={[styles.miniPillText, { color: '#ef4444' }]}>{dislikedCount}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <ChevronRight size={16} color={isExpanded ? accent : colors.textMuted} style={isExpanded ? styles.chevronRotated : undefined} />
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={[styles.bucketsWrapper, { borderTopColor: dividerColor }]}>
                        {EQUIP_BUCKETS.map((bucket, bucketIdx) => {
                          const exercises = catData[bucket.id] ?? [];
                          if (exercises.length === 0) return null;
                          const equipKey = `${cat.id}_${bucket.id}`;
                          const isEquipExpanded = expandedEquip === equipKey;
                          const isLastBucket = bucketIdx === EQUIP_BUCKETS.length - 1;
                          return (
                            <View key={bucket.id} style={[styles.bucketGroup, !isLastBucket && { borderBottomWidth: 0.5, borderBottomColor: dividerColor }]}>
                              <TouchableOpacity
                                style={[styles.bucketRow, { backgroundColor: isEquipExpanded ? `${accent}06` : 'transparent' }]}
                                onPress={() => toggleEquipBucket(cat.id, bucket.id)}
                                activeOpacity={0.7}
                              >
                                <View style={[styles.bucketIconWrap, { backgroundColor: isEquipExpanded ? `${accent}18` : iconBg }]}>
                                  {/* small neutral icon per bucket type */}
                                  {bucket.id === 'barbell' && <Target size={13} color={isEquipExpanded ? accent : colors.textMuted} />}
                                  {bucket.id === 'machine_cable' && <Layers size={13} color={isEquipExpanded ? accent : colors.textMuted} />}
                                  {bucket.id === 'dumbbell_kb' && <Dumbbell size={13} color={isEquipExpanded ? accent : colors.textMuted} />}
                                  {bucket.id === 'bodyweight' && <User size={13} color={isEquipExpanded ? accent : colors.textMuted} />}
                                </View>
                                <Text style={[styles.bucketLabel, { color: isEquipExpanded ? accent : colors.textSecondary }]}>{bucket.label}</Text>
                                <Text style={[styles.bucketCount, { color: colors.textMuted }]}>{exercises.length}</Text>
                                <ChevronDown size={13} color={isEquipExpanded ? accent : colors.textMuted} style={isEquipExpanded ? styles.chevronUp : undefined} />
                              </TouchableOpacity>
                              {isEquipExpanded && exercises.map((ex, idx) => renderExerciseRow(ex, idx, exercises.length))}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}
            </>
          )}

          {/* ══════════════ EQUIPMENT TAB ══════════════ */}
          {activeTab === 'equipment' && (
            <>
              {!hasAnyEquipResults && (
                <View style={styles.emptyState}>
                  <Search size={32} color={colors.textMuted} strokeWidth={1.5} />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>No exercises found</Text>
                  <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                    Try a different exercise name or muscle
                  </Text>
                </View>
              )}

              {EQUIP_CATEGORIES.map(cat => {
                const exercises = filteredEquipCatalog[cat.id] ?? [];
                if (exercises.length === 0) return null;
                const isExpanded = expandedEquipCat === cat.id;
                const likedCount = exercises.filter(ex => ctx.exercisePreferences[ex.id] === 'liked').length;
                const dislikedCount = exercises.filter(ex => ctx.exercisePreferences[ex.id] === 'disliked').length;

                return (
                  <View key={cat.id} style={[styles.groupCard, { borderColor: isExpanded ? `${accent}50` : colors.border, backgroundColor: colors.card }]}>
                    <TouchableOpacity
                      style={[styles.groupRow, { backgroundColor: isExpanded ? `${accent}08` : 'transparent' }]}
                      onPress={() => toggleEquipCat(cat.id)}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.catIconWrap, { backgroundColor: iconBg }]}>
                        {getEquipCategoryIcon(cat.id, iconColor)}
                      </View>
                      <View style={styles.catTextBlock}>
                        <Text style={[styles.catLabel, { color: colors.text }]}>{cat.label}</Text>
                        <View style={styles.catMetaRow}>
                          <Text style={[styles.catCount, { color: colors.textSecondary }]}>{exercises.length} exercises</Text>
                          {likedCount > 0 && (
                            <View style={[styles.miniPill, { backgroundColor: '#22c55e20' }]}>
                              <ThumbsUp size={9} color="#22c55e" strokeWidth={2.5} />
                              <Text style={[styles.miniPillText, { color: '#22c55e' }]}>{likedCount}</Text>
                            </View>
                          )}
                          {dislikedCount > 0 && (
                            <View style={[styles.miniPill, { backgroundColor: '#ef444420' }]}>
                              <ThumbsDown size={9} color="#ef4444" strokeWidth={2.5} />
                              <Text style={[styles.miniPillText, { color: '#ef4444' }]}>{dislikedCount}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <ChevronRight size={16} color={isExpanded ? accent : colors.textMuted} style={isExpanded ? styles.chevronRotated : undefined} />
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={[styles.bucketsWrapper, { borderTopColor: dividerColor }]}>
                        {exercises.map((ex, idx) => renderExerciseRow(ex, idx, exercises.length, true))}
                      </View>
                    )}
                  </View>
                );
              })}
            </>
          )}

          <View style={{ height: 48 }} />
        </View>
      </BaseDrawer>

      <ExerciseDetailDrawer
        visible={detailVisible}
        exercise={detailExercise}
        workoutStyle="strength"
        onClose={handleCloseDetail}
      />
    </>
  );
}

const styles = StyleSheet.create({
  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
  },
  headerCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(128,128,128,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerSpacer: { width: 32 },
  title: { fontSize: 18, fontFamily: 'Outfit_800ExtraBold', letterSpacing: -0.3 },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  subtitle: { fontSize: 12, fontFamily: 'Outfit_400Regular', lineHeight: 16 },

  // ── Content ──────────────────────────────────────────────────────────────────
  content: { paddingHorizontal: 14, gap: 12, paddingBottom: 8 },

  // ── Tab bar ───────────────────────────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: -0.1,
  },

  // ── Search ────────────────────────────────────────────────────────────────────
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Outfit_400Regular', padding: 0 },

  // ── Legend ────────────────────────────────────────────────────────────────────
  legendRow: { flexDirection: 'row', gap: 16, paddingHorizontal: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendText: { fontSize: 11, fontFamily: 'Outfit_400Regular' },

  // ── Empty state ───────────────────────────────────────────────────────────────
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyTitle: { fontSize: 17, fontFamily: 'Outfit_700Bold', letterSpacing: -0.2 },
  emptySubtitle: { fontSize: 13, fontFamily: 'Outfit_400Regular', textAlign: 'center', paddingHorizontal: 24, lineHeight: 18 },

  // ── Group card (shared by both tabs) ──────────────────────────────────────────
  groupCard: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  catIconWrap: {
    width: 42, height: 42, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  catTextBlock: { flex: 1 },
  catLabel: { fontSize: 16, fontFamily: 'Outfit_700Bold', letterSpacing: -0.2 },
  catMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  catCount: { fontSize: 12, fontFamily: 'Outfit_400Regular' },
  miniPill: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', gap: 3 },
  miniPillText: { fontSize: 10, fontFamily: 'Outfit_600SemiBold' },
  chevronRotated: { transform: [{ rotate: '90deg' }] },
  chevronUp: { transform: [{ rotate: '180deg' }] },

  // ── Equipment bucket sub-rows (inside muscle tab) ─────────────────────────────
  bucketsWrapper: { borderTopWidth: 1 },
  bucketGroup: {},
  bucketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bucketIconWrap: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bucketLabel: { flex: 1, fontSize: 13, fontFamily: 'Outfit_600SemiBold', letterSpacing: -0.1 },
  bucketCount: { fontSize: 12, fontFamily: 'Outfit_400Regular' },

  // ── Exercise rows ──────────────────────────────────────────────────────────────
  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingLeft: 36,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    gap: 8,
  },
  exRowLast: { borderBottomWidth: 0 },
  exRowLiked: { borderLeftWidth: 3, borderLeftColor: '#22c55e', paddingLeft: 33 },
  exRowDisliked: { borderLeftWidth: 3, borderLeftColor: '#ef4444', paddingLeft: 33, opacity: 0.6 },
  exInfo: { flex: 1, gap: 3 },
  exNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  exName: { flex: 1, fontSize: 15, fontFamily: 'Outfit_600SemiBold', letterSpacing: -0.1 },
  exMetaRow: { flexDirection: 'row', alignItems: 'center' },
  exMuscle: { fontSize: 12, fontFamily: 'Outfit_400Regular' },
  exMovLabel: { fontSize: 11, fontFamily: 'Outfit_400Regular' },
  prefRow: { flexDirection: 'row', gap: 6, flexShrink: 0 },
  prefBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  prefBtnLiked: { backgroundColor: '#22c55e' },
  prefBtnDisliked: { backgroundColor: '#ef4444' },
});
