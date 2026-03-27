import React, { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDrawerSizing } from '@/components/drawers/useDrawerSizing';
import {
  X,
  Search,
  Plus,
  ArrowLeftRight,
  RotateCcw,
  Trash2,
  CheckCircle2,
  Sparkles,
  ChevronRight,
} from 'lucide-react-native';
import { useZealTheme } from '@/context/AppContext';
import { getExerciseDatabase, getZealExerciseDatabase, type ZealExercise } from '@/mocks/exerciseDatabase';
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

function getRecommendations(source: WorkoutExercise): ZealExercise[] {
  const sourceRef: ZealExercise | null = source.exerciseRef ?? null;

  if (sourceRef && typeof sourceRef === 'object' && 'primary_muscles' in sourceRef) {
    const db = getZealExerciseDatabase();
    return db
      .map(ex => ({ ex, score: scoreForSwap(ex, sourceRef) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(({ ex }) => ex);
  }

  const muscleQuery = source.muscleGroup.split(',')[0].trim().toLowerCase();
  const db = getZealExerciseDatabase();
  return db
    .filter(ex =>
      ex.name !== source.name &&
      ex.primary_muscles.some(m =>
        m.toLowerCase().replace(/_/g, ' ').includes(muscleQuery)
      )
    )
    .slice(0, 10);
}

export default function AddToWorkoutSheet({ visible, mode, workoutStyle, muscleGroupFilter, swapSourceExercise, onClose, onAdd }: Props) {
  const { colors, accent } = useZealTheme();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const { snapPoints, maxDynamicContentSize, topOffset, scrollEnabled, setContentH } = useDrawerSizing({ minHeight: 480 });
  const insets = useSafeAreaInsets();

  const isSwapMode = swapSourceExercise != null;

  const [activeMode, setActiveMode] = useState<AddMode>(mode);
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<ZealExercise[]>([]);

  useEffect(() => {
    if (visible) {
      setActiveMode(mode);
      setSearch(isSwapMode ? '' : (muscleGroupFilter ?? ''));
      setPending([]);
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible, mode, muscleGroupFilter, isSwapMode]);

  const handleDismiss = useCallback(() => {
    onClose();
  }, [onClose]);

  const renderBackdrop = useCallback((props: any) => (
    <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.6} pressBehavior="close" />
  ), []);

  const recommendations = useMemo<ZealExercise[]>(() => {
    if (!swapSourceExercise) return [];
    return getRecommendations(swapSourceExercise);
  }, [swapSourceExercise]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    const db = getExerciseDatabase();
    return db.filter(ex =>
      ex.name.toLowerCase().includes(q) ||
      (ex.primaryMuscles ?? []).some((m: string) => m.toLowerCase().replace(/_/g, ' ').includes(q))
    ).slice(0, 15);
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
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: colors.text }]}>
            {isSwapMode ? 'Swap Exercise' : 'Add to Workout'}
          </Text>
          {isSwapMode && (
            <View style={[styles.replacingBadge, { backgroundColor: `${accent}14`, borderColor: `${accent}28` }]}>
              <ArrowLeftRight size={10} color={accent} strokeWidth={2.5} />
              <Text style={[styles.replacingText, { color: accent }]} numberOfLines={1}>
                {swapSourceExercise?.name ?? ''}
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
          <X size={16} color="#888" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      {!isSwapMode && (
        <View style={styles.modePills}>
          {(['exercise', 'superset', 'circuit'] as AddMode[]).map(m => {
            const isActive = activeMode === m;
            const mColor = m === 'exercise' ? accent : m === 'superset' ? '#f87116' : '#8b5cf6';
            const label = m === 'exercise' ? 'Exercise' : m === 'superset' ? 'Superset' : 'Circuit';
            const Icon = m === 'exercise' ? Plus : m === 'superset' ? ArrowLeftRight : RotateCcw;
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
                <Icon size={13} color={isActive ? mColor : colors.textSecondary} />
                <Text style={[styles.modePillText, { color: isActive ? mColor : colors.textSecondary }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <BottomSheetScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        scrollEnabled={scrollEnabled}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, isSwapMode && styles.contentSwap]}
        onContentSizeChange={(_w: number, h: number) => setContentH(h)}
      >
        {!isSwapMode && activeMode !== 'exercise' && pending.length > 0 && (
          <View style={[styles.pendingGroup, { backgroundColor: `${modeColor}0C`, borderColor: `${modeColor}30` }]}>
            <View style={styles.pendingHeader}>
              <View style={[styles.pendingBadge, { backgroundColor: `${modeColor}18` }]}>
                {activeMode === 'superset'
                  ? <ArrowLeftRight size={12} color={modeColor} />
                  : <RotateCcw size={12} color={modeColor} />}
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
                  <Trash2 size={14} color={colors.textMuted} />
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
              <CheckCircle2 size={16} color="#fff" />
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

        {isSwapMode && recommendations.length > 0 && !search.trim() && (
          <View style={styles.recSection}>
            <View style={styles.recHeader}>
              <View style={styles.recHeaderLeft}>
                <Sparkles size={13} color={accent} strokeWidth={2.2} />
                <Text style={[styles.recTitle, { color: colors.text }]}>Recommended Swaps</Text>
              </View>
              <View style={[styles.musclePill, { backgroundColor: `${accent}14`, borderColor: `${accent}28` }]}>
                <Text style={[styles.musclePillText, { color: accent }]}>{sourceMuscleName}</Text>
              </View>
            </View>
            <View style={[styles.recList, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
              {recommendations.map((ex, idx) => {
                const isTopMatch = idx < 3;
                return (
                  <TouchableOpacity
                    key={ex.id}
                    style={[
                      styles.recRow,
                      idx < recommendations.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: colors.border },
                    ]}
                    onPress={() => handleSelectForSingle(ex)}
                    activeOpacity={0.65}
                  >
                    <View style={styles.recInfo}>
                      <View style={styles.recNameRow}>
                        <Text style={[styles.recName, { color: colors.text }]} numberOfLines={1}>
                          {ex.name}
                        </Text>
                        {isTopMatch && (
                          <View style={[styles.bestMatchBadge, { backgroundColor: `${accent}18` }]}>
                            <Text style={[styles.bestMatchText, { color: accent }]}>Best Match</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.recMeta}>
                        <Text style={[styles.recMuscle, { color: colors.textSecondary }]}>
                          {primaryMuscleLabel(ex)}
                        </Text>
                        <View style={[styles.recTypePill, { backgroundColor: ex.is_compound ? '#3b82f614' : '#8b5cf614' }]}>
                          <Text style={[styles.recTypeText, { color: ex.is_compound ? '#3b82f6' : '#8b5cf6' }]}>
                            {ex.is_compound ? 'Compound' : 'Isolation'}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <ChevronRight size={15} color={colors.textMuted} strokeWidth={2} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {isSwapMode && (
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textMuted }]}>or search</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>
        )}

        <View style={[styles.searchContainer, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
          <Search size={14} color={colors.textSecondary} />
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
              <X size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {search.trim().length > 0 && searchResults.length === 0 && (
          <View style={styles.noResults}>
            <Text style={[styles.noResultsText, { color: colors.textMuted }]}>No exercises found</Text>
          </View>
        )}

        {searchResults.length > 0 && (
          <View style={[styles.resultsContainer, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
            {searchResults.map((ex, idx) => {
              const isPending = pending.some(p => p.id === ex.id);
              return (
                <TouchableOpacity
                  key={ex.id}
                  style={[styles.resultRow, idx < searchResults.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: colors.border }]}
                  onPress={() => {
                    if (isSwapMode || activeMode === 'exercise') {
                      handleSelectForSingle(ex as unknown as ZealExercise);
                    } else {
                      handleAddToPending(ex as unknown as ZealExercise);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.resultInfo}>
                    <Text style={[styles.resultName, { color: isPending ? colors.textMuted : colors.text }]} numberOfLines={1}>
                      {ex.name}
                    </Text>
                    <View style={styles.resultMeta}>
                      <Text style={[styles.resultMuscle, { color: colors.textSecondary }]}>
                        {(ex.primaryMuscles ?? [])[0] ?? ''}
                      </Text>
                      <View style={[styles.defaultPill, { backgroundColor: `${accent}14` }]}>
                        <Text style={[styles.defaultPillText, { color: accent }]}>
                          {defaults.sets}×{defaults.reps}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {isPending ? (
                    <CheckCircle2 size={16} color={modeColor} />
                  ) : (
                    <View style={[styles.addCircle, { backgroundColor: `${modeColor}18`, borderColor: `${modeColor}40` }]}>
                      {isSwapMode
                        ? <ArrowLeftRight size={12} color={modeColor} />
                        : <Plus size={13} color={modeColor} />}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
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
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetBg: { borderTopLeftRadius: 28, borderTopRightRadius: 28 },
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
    borderRadius: 16,
    backgroundColor: 'rgba(128,128,128,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  modePills: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
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
  content: { paddingHorizontal: 16, gap: 12 },
  contentSwap: { paddingTop: 4 },
  recSection: {
    gap: 10,
  },
  recHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    letterSpacing: 0.1,
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
  recList: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  recRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  recInfo: {
    flex: 1,
    gap: 4,
  },
  recNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexWrap: 'nowrap' as const,
  },
  recName: {
    fontSize: 14,
    fontWeight: '600' as const,
    flexShrink: 1,
  },
  bestMatchBadge: {
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
    flexShrink: 0,
  },
  bestMatchText: {
    fontSize: 9,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
  recMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  recMuscle: {
    fontSize: 12,
  },
  recTypePill: {
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  recTypeText: {
    fontSize: 10,
    fontWeight: '600' as const,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
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
  noResults: { alignItems: 'center' as const, paddingVertical: 20 },
  noResultsText: { fontSize: 14 },
  resultsContainer: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  resultInfo: { flex: 1, gap: 3 },
  resultName: { fontSize: 14, fontWeight: '600' as const },
  resultMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultMuscle: { fontSize: 12 },
  defaultPill: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  defaultPillText: { fontSize: 10, fontWeight: '700' as const },
  addCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  emptyState: {
    alignItems: 'center' as const,
    paddingVertical: 32,
    gap: 8,
    paddingHorizontal: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700' as const },
  emptySubtitle: { fontSize: 13, textAlign: 'center' as const, lineHeight: 18 },
});
