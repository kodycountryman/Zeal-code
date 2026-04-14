import React, { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import BaseDrawer from '@/components/drawers/BaseDrawer';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme } from '@/context/AppContext';
import { getZealExerciseDatabase, type ZealExercise } from '@/mocks/exerciseDatabase';
import type { WorkoutExercise } from '@/services/workoutEngine';

export type AddMode = 'exercise' | 'superset' | 'circuit';

interface Props {
  visible: boolean;
  mode: AddMode;
  workoutStyle: string;
  muscleGroupFilter?: string;
  swapSourceExercise?: WorkoutExercise | null;
  onClose: () => void;
  onAdd: (exercises: WorkoutExercise[]) => void;
}

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getStyleDefaults(style: string): { sets: number; reps: string; rest: string } {
  switch (style) {
    case 'Strength': return { sets: 4, reps: '5', rest: '3 min' };
    case 'Bodybuilding': return { sets: 3, reps: '10–12', rest: '90 sec' };
    case 'CrossFit': return { sets: 3, reps: '10', rest: '60 sec' };
    case 'HIIT': return { sets: 3, reps: '40 sec', rest: '20 sec' };
    case 'Hyrox': return { sets: 3, reps: '10', rest: '60 sec' };
    case 'Mobility': return { sets: 2, reps: '30 sec', rest: '30 sec' };
    case 'Pilates': return { sets: 3, reps: '10', rest: '30 sec' };
    default: return { sets: 3, reps: '10', rest: '90 sec' };
  }
}

function zealExToWorkoutExercise(
  ex: ZealExercise,
  style: string,
  groupType: WorkoutExercise['groupType'],
  groupId: string | null,
): WorkoutExercise {
  const defaults = getStyleDefaults(style);
  const primaryMuscle = (ex.primary_muscles ?? [])[0] ?? 'Full Body';
  const muscleLabel = primaryMuscle
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  const equipLabel = (ex.equipment_required ?? [])[0]
    ? (ex.equipment_required[0]).split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : 'Bodyweight';

  return {
    id: generateId(),
    name: ex.name,
    sets: defaults.sets,
    reps: defaults.reps,
    rest: defaults.rest,
    muscleGroup: muscleLabel,
    equipment: equipLabel,
    notes: '',
    type: 'main',
    movementType: ex.is_compound ? 'moderateCompound' : 'isolation',
    groupType,
    groupId,
    suggestedWeight: '',
    lastSessionWeight: '',
    lastSessionReps: '',
    exerciseRef: ex,
  };
}

function scoreForSwap(candidate: ZealExercise, source: ZealExercise): number {
  if (candidate.id === source.id || candidate.name === source.name) return -1;
  let score = 0;

  if (source.substitutes.includes(candidate.id)) score += 12;
  if (candidate.substitutes.includes(source.id)) score += 10;

  if (source.variation_family && candidate.variation_family === source.variation_family) score += 7;

  const primaryOverlap = candidate.primary_muscles.filter(m => source.primary_muscles.includes(m)).length;
  score += primaryOverlap * 5;

  const primaryMatchesSrcSecondary = candidate.primary_muscles.filter(m => source.secondary_muscles.includes(m)).length;
  score += primaryMatchesSrcSecondary * 2;

  if (candidate.movement_pattern === source.movement_pattern) score += 4;

  const secondaryOverlap = candidate.secondary_muscles.filter(m => source.secondary_muscles.includes(m)).length;
  score += secondaryOverlap * 1;

  if (candidate.is_compound === source.is_compound) score += 1;

  return score;
}

const CARDIO_SWAP_POOL = [
  'Rowing Machine', 'Assault Bike', 'Treadmill Run', 'Jump Rope',
  'Battle Ropes', 'Ski Erg', 'Elliptical', 'Cycling', 'Sled Push',
  'Stairmaster', 'Fan Bike', 'Air Bike', 'Bear Crawl',
];

function getRecommendations(source: WorkoutExercise): ZealExercise[] {
  const sourceRef: ZealExercise | null = source.exerciseRef ?? null;
  const db = getZealExerciseDatabase();

  // Cardio-specific swap: find cardio exercises by movement pattern + hardcoded pool
  if (source.type === 'cardio' || source.muscleGroup === 'Cardio') {
    const sourceName = source.name.toLowerCase();
    const cardioResults = db.filter(ex =>
      ex.name.toLowerCase() !== sourceName &&
      (ex.movement_pattern === 'cardio' ||
       CARDIO_SWAP_POOL.some(name => ex.name.toLowerCase().includes(name.toLowerCase())))
    );
    if (cardioResults.length > 0) return cardioResults.slice(0, 12);
    // Fallback: return synthetic entries from the hardcoded pool
    return CARDIO_SWAP_POOL
      .filter(name => !sourceName.includes(name.toLowerCase()))
      .slice(0, 10)
      .map((name, i) => ({
        id: `cardio_swap_${i}`,
        name,
        primary_muscles: ['cardio'] as any,
        secondary_muscles: [] as any,
        movement_pattern: 'cardio' as any,
        equipment_required: [] as any,
        is_compound: false,
        difficulty_tier: 'intermediate' as any,
        rep_range_floor: 1,
        rep_range_ceiling: 1,
        substitutes: [] as any,
        variation_family: '' as any,
      } as ZealExercise));
  }

  if (sourceRef && typeof sourceRef === 'object' && 'primary_muscles' in sourceRef) {
    return db
      .map(ex => ({ ex, score: scoreForSwap(ex, sourceRef) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(({ ex }) => ex);
  }

  const muscleQuery = source.muscleGroup.split(',')[0].trim().toLowerCase();
  return db
    .filter(ex =>
      ex.name !== source.name &&
      ex.primary_muscles.some(m =>
        m.toLowerCase().replace(/_/g, ' ').includes(muscleQuery)
      )
    )
    .slice(0, 10);
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = a[i - 1] === b[j - 1] ? dp[j - 1] : Math.min(dp[j - 1], dp[j], prev) + 1;
      dp[j - 1] = prev;
      prev = cur;
    }
    dp[b.length] = prev;
  }
  return dp[b.length];
}

function fuzzyScore(query: string, ex: ZealExercise): number {
  const q = normalize(query);
  const name = normalize(ex.name);
  const aliases = (ex.aliases ?? []).map(normalize);
  const muscles = (ex.primary_muscles ?? []).map(m => normalize(m));

  // Exact substring match on name or any alias
  if (name.includes(q) || aliases.some(a => a.includes(q))) return 5;

  const qWords = q.split(' ').filter(w => w.length > 1);
  const nameWords = name.split(' ');

  // All query words appear exactly in name
  if (qWords.every(qw => nameWords.some(nw => nw.includes(qw) || qw.includes(nw)))) return 4;

  // All query words match within 1 edit (typo tolerance)
  const typoMatch = qWords.every(qw =>
    nameWords.some(nw =>
      nw.includes(qw) || qw.includes(nw) ||
      (qw.length >= 4 && editDistance(qw, nw) <= 1)
    ) ||
    aliases.some(alias =>
      alias.split(' ').some(aw =>
        aw.includes(qw) || (qw.length >= 4 && editDistance(qw, aw) <= 1)
      )
    )
  );
  if (typoMatch && qWords.length > 0) return 3;

  // Majority of words match (handles missing/extra words)
  const matchCount = qWords.filter(qw =>
    nameWords.some(nw =>
      nw.includes(qw) || qw.includes(nw) ||
      (qw.length >= 4 && editDistance(qw, nw) <= 2)
    )
  ).length;
  if (matchCount > 0 && matchCount >= qWords.length * 0.6) return 2;

  // Muscle group name match
  const muscleStr = muscles.join(' ');
  if (qWords.some(qw => muscleStr.includes(qw))) return 1;

  return 0;
}

function formatEquipment(ex: ZealExercise): string {
  const first = (ex.equipment_required ?? [])[0];
  if (!first || first === 'bodyweight') return '';
  return first.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export default function AddToWorkoutSheet({ visible, mode, workoutStyle, muscleGroupFilter, swapSourceExercise, onClose, onAdd }: Props) {
  const { colors, accent } = useZealTheme();

  const isSwapMode = swapSourceExercise != null;

  const [activeMode, setActiveMode] = useState<AddMode>(mode);
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<ZealExercise[]>([]);

  useEffect(() => {
    if (visible) {
      setActiveMode(mode);
      setSearch(isSwapMode ? '' : (muscleGroupFilter ?? ''));
      setPending([]);
    }
  }, [visible, mode, muscleGroupFilter, isSwapMode]);

  const recommendations = useMemo<ZealExercise[]>(() => {
    if (!swapSourceExercise) return [];
    return getRecommendations(swapSourceExercise);
  }, [swapSourceExercise]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const db = getZealExerciseDatabase();
    return db
      .map(ex => ({ ex, score: fuzzyScore(search, ex) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 15)
      .map(({ ex }) => ex);
  }, [search]);

  const defaults = useMemo(() => getStyleDefaults(workoutStyle), [workoutStyle]);

  const handleSelectForSingle = useCallback((ex: ZealExercise) => {
    const we = zealExToWorkoutExercise(ex, workoutStyle, null, null);
    onAdd([we]);
    onClose();
  }, [workoutStyle, onAdd, onClose]);

  const handleAddToPending = useCallback((ex: ZealExercise) => {
    setPending(prev => {
      if (prev.some(p => p.id === ex.id)) return prev;
      return [...prev, ex];
    });
    setSearch('');
  }, []);

  const handleRemovePending = useCallback((id: string) => {
    setPending(prev => prev.filter(p => p.id !== id));
  }, []);

  const handleConfirmGroup = useCallback(() => {
    if (pending.length < 2) return;
    const groupId = generateId();
    const groupType: WorkoutExercise['groupType'] = activeMode === 'superset' ? 'superset' : 'circuit';
    const exercises = pending.map(ex => zealExToWorkoutExercise(ex, workoutStyle, groupType, groupId));
    onAdd(exercises);
    onClose();
  }, [pending, activeMode, workoutStyle, onAdd, onClose]);

  const handleSwitchMode = useCallback((m: AddMode) => {
    setActiveMode(m);
    setSearch('');
    setPending([]);
  }, []);

  const modeLabel = activeMode === 'exercise' ? 'Exercise' : activeMode === 'superset' ? 'Superset' : 'Circuit';
  const modeColor = activeMode === 'exercise' ? accent : activeMode === 'superset' ? '#f87116' : '#8b5cf6';

  const primaryMuscleLabel = (ex: ZealExercise) => {
    const m = (ex.primary_muscles ?? [])[0] ?? '';
    return m.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const sourceMuscleName = swapSourceExercise
    ? swapSourceExercise.muscleGroup.split(',')[0].trim()
    : '';

  // Search bar — rendered in header so it stays fixed and never scrolls away
  const searchBar = (
    <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <PlatformIcon name="search" size={14} color={colors.textSecondary} />
      <BottomSheetTextInput
        style={[styles.searchInput, { color: colors.text }]}
        placeholder={
          isSwapMode
            ? 'Search any exercise...'
            : activeMode === 'exercise'
              ? 'Search exercises...'
              : `Search to add to ${activeMode === 'superset' ? 'superset' : 'circuit'}...`
        }
        placeholderTextColor={colors.textMuted}
        value={search}
        onChangeText={setSearch}
        autoFocus={!isSwapMode}
      />
      {search.length > 0 && (
        <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
          <PlatformIcon name="x" size={14} color={colors.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );

  const headerContent = (
    <>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: colors.text }]}>
            {isSwapMode ? 'Swap Exercise' : 'Add to Workout'}
          </Text>
          {isSwapMode && (
            <View style={[styles.replacingBadge, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
              <PlatformIcon name="arrow-left-right" size={10} color={colors.textSecondary} strokeWidth={2.5} />
              <Text style={[styles.replacingText, { color: colors.text }]} numberOfLines={1}>
                {swapSourceExercise?.name ?? ''}
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
          <PlatformIcon name="x" size={18} color={colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {!isSwapMode && (
        <View style={styles.modePills}>
          {(['exercise', 'superset', 'circuit'] as AddMode[]).map(m => {
            const isActive = activeMode === m;
            const mColor = m === 'exercise' ? accent : m === 'superset' ? '#f87116' : '#8b5cf6';
            const label = m === 'exercise' ? 'Exercise' : m === 'superset' ? 'Superset' : 'Circuit';
            const iconName = m === 'exercise' ? 'plus' as const : m === 'superset' ? 'arrow-left-right' as const : 'rotate-ccw' as const;
            return (
              <TouchableOpacity
                key={m}
                style={[
                  styles.modePill,
                  { borderColor: isActive ? mColor : colors.border },
                  isActive && { backgroundColor: `${mColor}18` },
                ]}
                onPress={() => handleSwitchMode(m)}
                activeOpacity={0.7}
              >
                <PlatformIcon name={iconName} size={13} color={isActive ? mColor : colors.textSecondary} />
                <Text style={[styles.modePillText, { color: isActive ? mColor : colors.textSecondary }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={styles.headerSearch}>
        {searchBar}
      </View>
    </>
  );

  return (
    <BaseDrawer
      visible={visible}
      onClose={onClose}
      header={headerContent}
      hasTextInput
      snapPoints={['75%']}
      backgroundColor={colors.card}
    >
      <View style={[styles.content, isSwapMode && styles.contentSwap]}>
        {/* Pending group (superset/circuit builder) */}
        {!isSwapMode && activeMode !== 'exercise' && pending.length > 0 && (
          <View style={[styles.pendingGroup, { backgroundColor: `${modeColor}0C`, borderColor: `${modeColor}30` }]}>
            <View style={styles.pendingHeader}>
              <View style={[styles.pendingBadge, { backgroundColor: `${modeColor}18` }]}>
                {activeMode === 'superset'
                  ? <PlatformIcon name="arrow-left-right" size={12} color={modeColor} />
                  : <PlatformIcon name="rotate-ccw" size={12} color={modeColor} />}
                <Text style={[styles.pendingBadgeText, { color: modeColor }]}>
                  {activeMode === 'superset' ? 'SUPERSET' : 'CIRCUIT'} — {pending.length} exercises
                </Text>
              </View>
            </View>
            {pending.map((ex, i) => (
              <View key={ex.id} style={[styles.pendingItem, { borderBottomColor: `${modeColor}20` }]}>
                <View style={[styles.pendingNum, { backgroundColor: `${modeColor}18` }]}>
                  <Text style={[styles.pendingNumText, { color: modeColor }]}>{i + 1}</Text>
                </View>
                <Text style={[styles.pendingName, { color: colors.text }]} numberOfLines={1}>{ex.name}</Text>
                <Text style={[styles.pendingMuscle, { color: colors.textSecondary }]}>{primaryMuscleLabel(ex)}</Text>
                <TouchableOpacity onPress={() => handleRemovePending(ex.id)} activeOpacity={0.7}>
                  <PlatformIcon name="trash" size={14} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={[
                styles.confirmBtn,
                { backgroundColor: pending.length >= 2 ? modeColor : colors.border },
                pending.length < 2 && { opacity: 0.5 },
              ]}
              onPress={handleConfirmGroup}
              disabled={pending.length < 2}
              activeOpacity={0.85}
            >
              <PlatformIcon name="check-circle" size={16} color="#fff" />
              <Text style={styles.confirmBtnText}>
                Add {activeMode === 'superset' ? 'Superset' : 'Circuit'} to Workout
              </Text>
            </TouchableOpacity>
            {pending.length < 2 && (
              <Text style={[styles.pendingHint, { color: colors.textMuted }]}>
                Search for at least 2 exercises below to create a {activeMode}
              </Text>
            )}
          </View>
        )}

        {/* Recommendations — shown in swap mode when no search query */}
        {isSwapMode && recommendations.length > 0 && !search.trim() && (() => {
          const topMatches = recommendations.slice(0, 3);
          const otherMatches = recommendations.slice(3);
          return (
            <View style={styles.recSection}>
              {/* Best Matches card */}
              <View style={styles.recGroup}>
                <View style={styles.recHeader}>
                  <Text style={[styles.recTitle, { color: colors.textMuted }]}>BEST MATCHES</Text>
                  {sourceMuscleName ? (
                    <View style={[styles.musclePill, { backgroundColor: `${accent}14`, borderColor: `${accent}28` }]}>
                      <Text style={[styles.musclePillText, { color: accent }]}>{sourceMuscleName}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={[styles.recCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
                  {topMatches.map((ex, idx) => {
                    const equipLabel = formatEquipment(ex);
                    return (
                      <TouchableOpacity
                        key={ex.id}
                        style={[
                          styles.recRow,
                          idx < topMatches.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                        ]}
                        onPress={() => handleSelectForSingle(ex)}
                        activeOpacity={0.65}
                      >
                        <View style={styles.recInfo}>
                          <Text style={[styles.recName, { color: colors.text }]} numberOfLines={1}>{ex.name}</Text>
                          <Text style={[styles.recMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                            {primaryMuscleLabel(ex)}{equipLabel ? ` · ${equipLabel}` : ''}
                          </Text>
                        </View>
                        <PlatformIcon name="chevron-right" size={14} color={colors.textMuted} strokeWidth={2} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* More Options card */}
              {otherMatches.length > 0 && (
                <View style={styles.recGroup}>
                  <Text style={[styles.recTitle, { color: colors.textMuted }]}>MORE OPTIONS</Text>
                  <View style={[styles.recCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
                    {otherMatches.map((ex, idx) => {
                      const equipLabel = formatEquipment(ex);
                      return (
                        <TouchableOpacity
                          key={ex.id}
                          style={[
                            styles.recRow,
                            idx < otherMatches.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                          ]}
                          onPress={() => handleSelectForSingle(ex)}
                          activeOpacity={0.65}
                        >
                          <View style={styles.recInfo}>
                            <Text style={[styles.recName, { color: colors.text }]} numberOfLines={1}>{ex.name}</Text>
                            <Text style={[styles.recMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                              {primaryMuscleLabel(ex)}{equipLabel ? ` · ${equipLabel}` : ''}
                            </Text>
                          </View>
                          <PlatformIcon name="chevron-right" size={14} color={colors.textMuted} strokeWidth={2} />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          );
        })()}

        {/* Search results */}
        {searchResults.length > 0 && (
          <View style={styles.resultsContainer}>
            {searchResults.map((ex, idx) => {
              const isPending = pending.some(p => p.id === ex.id);
              const equipLabel = formatEquipment(ex);
              const muscleName = primaryMuscleLabel(ex);
              return (
                <TouchableOpacity
                  key={ex.id}
                  style={styles.resultRow}
                  onPress={() => {
                    if (isSwapMode || activeMode === 'exercise') {
                      handleSelectForSingle(ex);
                    } else {
                      handleAddToPending(ex);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.resultInfo}>
                    <Text style={[styles.resultName, { color: isPending ? colors.textMuted : colors.text }]} numberOfLines={1}>
                      {ex.name}
                    </Text>
                    <Text style={[styles.resultMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                      {muscleName}{equipLabel ? ` · ${equipLabel}` : ''}
                    </Text>
                  </View>
                  {isPending ? (
                    <PlatformIcon name="check-circle" size={16} color={modeColor} />
                  ) : (
                    <PlatformIcon name="chevron-right" size={14} color={colors.textMuted} strokeWidth={2} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {search.trim().length > 0 && searchResults.length === 0 && (
          <View style={styles.noResults}>
            <Text style={[styles.noResultsText, { color: colors.textMuted }]}>No exercises found</Text>
          </View>
        )}

        {!search.trim() && !isSwapMode && (
          <View style={styles.emptyState}>
            {activeMode === 'exercise' ? (
              <>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>Search for an exercise</Text>
                <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                  Type a name or muscle group above — exercises will be added with {workoutStyle} defaults ({defaults.sets}×{defaults.reps})
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  Build a {activeMode === 'superset' ? 'Superset' : 'Circuit'}
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                  {pending.length === 0
                    ? `Search and add 2 or more exercises. They'll be grouped as a ${activeMode}.`
                    : `${pending.length} exercise${pending.length !== 1 ? 's' : ''} selected. Add at least ${Math.max(0, 2 - pending.length)} more.`}
                </Text>
              </>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </View>
    </BaseDrawer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 12,
  },
  headerLeft: {
    flex: 1,
    gap: 6,
  },
  title: { fontSize: 18, fontWeight: '800' as const, letterSpacing: -0.3 },
  replacingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start' as const,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  replacingText: {
    fontSize: 11,
    fontWeight: '600' as const,
    maxWidth: 200,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  modePills: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  modePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 9,
  },
  modePillText: { fontSize: 12, fontWeight: '600' as const },
  headerSearch: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  content: { paddingHorizontal: 16, gap: 10 },
  contentSwap: { paddingTop: 4 },

  // Recommended section
  recSection: {
    gap: 8,
  },
  recGroup: {
    gap: 6,
  },
  recHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  recTitle: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.8,
  },
  musclePill: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  musclePillText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  recRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  recInfo: {
    flex: 1,
    gap: 3,
  },
  recNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexWrap: 'nowrap' as const,
  },
  recName: {
    fontSize: 15,
    fontWeight: '600' as const,
    flexShrink: 1,
  },
  bestMatchBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexShrink: 0,
  },
  bestMatchText: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
  recMeta: {
    fontSize: 13,
  },

  // Search results
  resultsContainer: {
    gap: 0,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingVertical: 11,
    gap: 12,
  },
  resultInfo: { flex: 1, gap: 3 },
  resultName: { fontSize: 15, fontWeight: '600' as const },
  resultMeta: { fontSize: 13 },

  // Pending group
  pendingGroup: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  pendingHeader: { flexDirection: 'row', alignItems: 'center' },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pendingBadgeText: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.4 },
  pendingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
  },
  pendingNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingNumText: { fontSize: 11, fontWeight: '700' as const },
  pendingName: { flex: 1, fontSize: 13, fontWeight: '600' as const },
  pendingMuscle: { fontSize: 11 },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 4,
  },
  confirmBtnText: { fontSize: 14, fontWeight: '700' as const, color: '#fff' },
  pendingHint: { fontSize: 11, textAlign: 'center' as const, marginTop: -4 },

  // Search bar
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },

  // Empty / no results
  noResults: { alignItems: 'center' as const, paddingVertical: 20 },
  noResultsText: { fontSize: 14 },
  emptyState: {
    alignItems: 'center' as const,
    paddingVertical: 32,
    gap: 8,
    paddingHorizontal: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700' as const },
  emptySubtitle: { fontSize: 13, textAlign: 'center' as const, lineHeight: 18 },
});
