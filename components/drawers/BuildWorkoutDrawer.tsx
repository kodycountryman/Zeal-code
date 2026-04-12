import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import BaseDrawer from '@/components/drawers/BaseDrawer';
import { PlatformIcon } from '@/components/PlatformIcon';
import { showProGate, PRO_GOLD, PRO_LOCKED_OPACITY } from '@/services/proGate';

import { useZealTheme, useAppContext, type SavedWorkout } from '@/context/AppContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { getExerciseDatabase, type Exercise } from '@/mocks/exerciseDatabase';

interface Props {
  visible: boolean;
  onClose: () => void;
  onLoadWorkout: (workout: SavedWorkout) => void;
}

type TabKey = 'build' | 'saved';
type AddMode = 'exercise' | 'superset' | 'circuit' | null;
type FilterKey = 'recent' | 'all' | 'az';

interface BuildExercise {
  id: string;
  exerciseId: string;
  name: string;
  groupType: 'superset' | 'circuit' | null;
  groupLabel: string | null;
}

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

export default function BuildWorkoutDrawer({ visible, onClose, onLoadWorkout }: Props) {
  const { colors, accent } = useZealTheme();
  const ctx = useAppContext();
  const { hasPro, openPaywall } = useSubscription();
  const [tab, setTab] = useState<TabKey>('build');
  const [workoutName, setWorkoutName] = useState('Custom Workout');
  const [exercises, setExercises] = useState<BuildExercise[]>([]);
  const [addMode, setAddMode] = useState<AddMode>(null);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [groupLabel, setGroupLabel] = useState('');

  const [savedSearch, setSavedSearch] = useState('');
  const [savedFilter, setSavedFilter] = useState<FilterKey>('recent');
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setTab('build');
      setWorkoutName('Custom Workout');
      setExercises([]);
      setAddMode(null);
      setExerciseSearch('');
      setGroupLabel('');
      setSavedSearch('');
      setSavedFilter('recent');
      setEditingId(null);
    }
  }, [visible]);

  const searchResults = useMemo(() => {
    if (!exerciseSearch.trim()) return [];
    const q = exerciseSearch.toLowerCase();
    return getExerciseDatabase().filter(ex =>
      ex.name.toLowerCase().includes(q) ||
      ex.primaryMuscles.some(m => m.toLowerCase().includes(q))
    ).slice(0, 15);
  }, [exerciseSearch]);

  const handleAddExercise = useCallback((ex: Exercise) => {
    const newEx: BuildExercise = {
      id: generateId(),
      exerciseId: ex.id,
      name: ex.name,
      groupType: addMode === 'superset' ? 'superset' : addMode === 'circuit' ? 'circuit' : null,
      groupLabel: addMode === 'superset' || addMode === 'circuit' ? (groupLabel || (addMode === 'superset' ? 'SUPERSET' : 'CIRCUIT')) : null,
    };
    setExercises(prev => [...prev, newEx]);
    setExerciseSearch('');
  }, [addMode, groupLabel]);

  const handleRemoveExercise = useCallback((id: string) => {
    setExercises(prev => prev.filter(e => e.id !== id));
  }, []);

  const handleMoveUp = useCallback((index: number) => {
    if (index <= 0) return;
    setExercises(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }, []);

  const handleMoveDown = useCallback((index: number) => {
    setExercises(prev => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }, []);

  const handleSetAddMode = useCallback((mode: AddMode) => {
    if (addMode === mode) {
      setAddMode(null);
      setGroupLabel('');
    } else {
      setAddMode(mode);
      setGroupLabel(mode === 'superset' ? 'SUPERSET' : mode === 'circuit' ? 'CIRCUIT' : '');
    }
    setExerciseSearch('');
  }, [addMode]);

  const canSave = workoutName.trim().length > 0 && exercises.length > 0;

  const handleSave = useCallback(() => {
    if (!canSave) return;
    if (!hasPro && !editingId && ctx.savedWorkouts.length >= 1) {
      showProGate('savedWorkouts', openPaywall);
      return;
    }
    const newWorkout: SavedWorkout = {
      id: editingId ?? generateId(),
      name: workoutName.trim(),
      exercises: exercises.map(e => ({ exerciseId: e.exerciseId, name: e.name })),
      defaultFocus: 'Custom',
      createdAt: editingId ? (ctx.savedWorkouts.find(w => w.id === editingId)?.createdAt ?? new Date().toISOString()) : new Date().toISOString(),
      lastUsed: new Date().toISOString(),
    };
    let updated: SavedWorkout[];
    if (editingId) {
      updated = ctx.savedWorkouts.map(w => w.id === editingId ? newWorkout : w);
    } else {
      updated = [newWorkout, ...ctx.savedWorkouts];
    }
    ctx.saveSavedWorkouts(updated);
    setEditingId(null);
    setTab('saved');
  }, [canSave, workoutName, exercises, editingId, ctx]);

  const handleDeleteSaved = useCallback((id: string) => {
    const updated = ctx.savedWorkouts.filter(w => w.id !== id);
    ctx.saveSavedWorkouts(updated);
  }, [ctx]);

  const handleEditSaved = useCallback((workout: SavedWorkout) => {
    setEditingId(workout.id);
    setWorkoutName(workout.name);
    setExercises(workout.exercises.map(e => ({
      id: generateId(),
      exerciseId: e.exerciseId,
      name: e.name,
      groupType: null,
      groupLabel: null,
    })));
    setTab('build');
  }, []);

  const handleLoadForToday = useCallback((workout: SavedWorkout) => {
    const updated = ctx.savedWorkouts.map(w =>
      w.id === workout.id ? { ...w, lastUsed: new Date().toISOString() } : w
    );
    ctx.saveSavedWorkouts(updated);
    onLoadWorkout(workout);
    onClose();
  }, [ctx, onLoadWorkout, onClose]);

  const filteredSaved = useMemo(() => {
    let list = [...ctx.savedWorkouts];
    if (savedSearch.trim()) {
      const q = savedSearch.toLowerCase();
      list = list.filter(w => w.name.toLowerCase().includes(q));
    }
    if (savedFilter === 'recent') {
      list.sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime());
    } else if (savedFilter === 'az') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [ctx.savedWorkouts, savedSearch, savedFilter]);

  const hasSaved = ctx.savedWorkouts.length > 0;

  const headerContent = (
    <>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Workouts</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
          <PlatformIcon name="x" size={16} color="#888" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'build' && { borderBottomColor: accent, borderBottomWidth: 2 }]}
          onPress={() => setTab('build')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, { color: tab === 'build' ? accent : colors.textSecondary }]}>Build New</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'saved' && { borderBottomColor: accent, borderBottomWidth: 2 }]}
          onPress={() => setTab('saved')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, { color: tab === 'saved' ? accent : colors.textSecondary }]}>Saved</Text>
          {hasSaved && <View style={[styles.savedDot, { backgroundColor: accent }]} />}
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <BaseDrawer visible={visible} onClose={onClose} header={headerContent} hasTextInput>
      <View style={styles.content}>
        {tab === 'build' && (
          <View style={styles.buildContent}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>WORKOUT NAME</Text>
            <TextInput
              style={[styles.nameInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.cardSecondary }]}
              value={workoutName}
              onChangeText={setWorkoutName}
              placeholderTextColor={colors.textMuted}
            />

            <View style={styles.actionBtns}>
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: addMode === 'exercise' ? accent : colors.border }, addMode === 'exercise' && { backgroundColor: `${accent}18` }]}
                onPress={() => handleSetAddMode('exercise')}
                activeOpacity={0.7}
              >
                <PlatformIcon name="plus" size={14} color={accent} />
                <Text style={[styles.actionBtnText, { color: colors.text }]}>Exercise</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: addMode === 'superset' ? accent : colors.border }, addMode === 'superset' && { backgroundColor: `${accent}18` }, !hasPro && { opacity: PRO_LOCKED_OPACITY }]}
                onPress={() => hasPro ? handleSetAddMode('superset') : showProGate('supersets', openPaywall)}
                activeOpacity={0.7}
              >
                <PlatformIcon name="arrow-left-right" size={14} color={hasPro ? accent : colors.textMuted} />
                <Text style={[styles.actionBtnText, { color: colors.text }]}>Superset</Text>
                {!hasPro && <PlatformIcon name="crown" size={11} color={PRO_GOLD} strokeWidth={2} />}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: addMode === 'circuit' ? accent : colors.border }, addMode === 'circuit' && { backgroundColor: `${accent}18` }, !hasPro && { opacity: PRO_LOCKED_OPACITY }]}
                onPress={() => hasPro ? handleSetAddMode('circuit') : showProGate('supersets', openPaywall)}
                activeOpacity={0.7}
              >
                <PlatformIcon name="rotate-ccw" size={14} color={hasPro ? accent : colors.textMuted} />
                <Text style={[styles.actionBtnText, { color: colors.text }]}>Circuit</Text>
                {!hasPro && <PlatformIcon name="crown" size={11} color={PRO_GOLD} strokeWidth={2} />}
              </TouchableOpacity>
            </View>

            {addMode !== null && (
              <View style={styles.addModeSection}>
                {addMode !== 'exercise' && (
                  <View style={styles.groupHeader}>
                    <View style={[styles.groupBadge, { backgroundColor: `${accent}18` }]}>
                      {addMode === 'superset' ? <PlatformIcon name="arrow-left-right" size={12} color={accent} /> : <PlatformIcon name="rotate-ccw" size={12} color={accent} />}
                      <Text style={[styles.groupBadgeText, { color: accent }]}>{addMode === 'superset' ? 'Superset' : 'Circuit'}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.groupLabelBadge, { backgroundColor: `${accent}18` }]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.groupLabelText, { color: accent }]}>{addMode === 'superset' ? 'SUPERSET' : 'CIRCUIT'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setAddMode(null); setGroupLabel(''); }} activeOpacity={0.7}>
                      <PlatformIcon name="x" size={14} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                )}

                <View style={[styles.searchContainer, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
                  <PlatformIcon name="search" size={14} color={colors.textSecondary} />
                  <BottomSheetTextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder={addMode === 'exercise' ? 'Search exercises...' : `Add to ${addMode === 'superset' ? 'Superset' : 'Circuit'}...`}
                    placeholderTextColor={colors.textMuted}
                    value={exerciseSearch}
                    onChangeText={setExerciseSearch}
                    autoFocus
                  />
                  {exerciseSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setExerciseSearch('')} activeOpacity={0.7}>
                      <PlatformIcon name="x" size={14} color={colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>

                {searchResults.length > 0 && (
                  <View style={[styles.searchResults, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
                    {searchResults.map(ex => (
                      <TouchableOpacity
                        key={ex.id}
                        style={[styles.searchResultRow, { borderBottomColor: colors.border }]}
                        onPress={() => handleAddExercise(ex)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.searchResultName, { color: colors.text }]}>{ex.name}</Text>
                        <Text style={[styles.searchResultMuscle, { color: colors.textSecondary }]}>{ex.primaryMuscles[0]}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {addMode === 'exercise' && (
                  <TouchableOpacity onPress={() => setAddMode(null)} activeOpacity={0.7} style={styles.doneAddBtn}>
                    <Text style={[styles.doneAddText, { color: accent }]}>Done Adding</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {exercises.length > 0 ? (
              <View style={styles.exerciseList}>
                {exercises.map((ex, idx) => (
                  <View key={ex.id} style={[styles.exerciseItem, { borderBottomColor: colors.border }]}>
                    <View style={styles.exerciseItemLeft}>
                      <View style={styles.reorderBtns}>
                        <TouchableOpacity
                          onPress={() => handleMoveUp(idx)}
                          activeOpacity={0.6}
                          style={[styles.reorderBtn, idx === 0 && { opacity: 0.25 }]}
                          disabled={idx === 0}
                        >
                          <PlatformIcon name="chevron-up" size={14} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <PlatformIcon name="grip-vertical" size={14} color={colors.textMuted} />
                        <TouchableOpacity
                          onPress={() => handleMoveDown(idx)}
                          activeOpacity={0.6}
                          style={[styles.reorderBtn, idx === exercises.length - 1 && { opacity: 0.25 }]}
                          disabled={idx === exercises.length - 1}
                        >
                          <PlatformIcon name="chevron-down" size={14} color={colors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.exerciseItemName, { color: colors.text }]}>{ex.name}</Text>
                        {ex.groupType && (
                          <Text style={[styles.exerciseItemGroup, { color: accent }]}>{ex.groupLabel}</Text>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => handleRemoveExercise(ex.id)} activeOpacity={0.7}>
                      <PlatformIcon name="x" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              <View style={[styles.emptyState, { borderColor: colors.border }]}>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>Add exercises to save</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: canSave ? accent : colors.border, opacity: canSave ? 1 : 0.5 }]}
              onPress={handleSave}
              disabled={!canSave}
              activeOpacity={0.85}
            >
              <Text style={[styles.saveBtnText, { color: canSave ? '#fff' : colors.textMuted }]}>
                {editingId ? 'Update Workout' : 'Save Workout'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {tab === 'saved' && (
          <View style={styles.savedContent}>
            <View style={[styles.searchContainer, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
              <PlatformIcon name="search" size={14} color={colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search workouts..."
                placeholderTextColor={colors.textMuted}
                value={savedSearch}
                onChangeText={setSavedSearch}
              />
            </View>

            <View style={styles.filterRow}>
              {([['recent', 'Recent'], ['all', 'All'], ['az', 'A-Z']] as [FilterKey, string][]).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.filterChip,
                    { borderColor: savedFilter === key ? accent : colors.border },
                    savedFilter === key && { backgroundColor: `${accent}18` },
                  ]}
                  onPress={() => setSavedFilter(key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterText, { color: savedFilter === key ? accent : colors.text }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {!hasPro && ctx.savedWorkouts.length >= 1 && (
              <TouchableOpacity
                style={[styles.proNudgeRow, { backgroundColor: `${PRO_GOLD}10`, borderColor: `${PRO_GOLD}25` }]}
                onPress={() => showProGate('savedWorkouts', openPaywall)}
                activeOpacity={0.8}
              >
                <PlatformIcon name="crown" size={15} color={PRO_GOLD} />
                <Text style={styles.proNudgeText}>Upgrade to save unlimited workouts</Text>
                <Text style={styles.proNudgeArrow}>→</Text>
              </TouchableOpacity>
            )}

            {filteredSaved.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No saved workouts yet</Text>
              </View>
            ) : (
              filteredSaved.map((workout) => (
                <View key={workout.id} style={[styles.savedCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
                  <View style={styles.savedCardHeader}>
                    <View style={styles.savedCardInfo}>
                      <Text style={[styles.savedCardName, { color: colors.text }]}>{workout.name}</Text>
                      <View style={styles.savedCardMeta}>
                        <Text style={[styles.savedCardSub, { color: colors.textSecondary }]}>{workout.defaultFocus}</Text>
                        <Text style={[styles.savedCardSub, { color: colors.textSecondary }]}>·</Text>
                        <Text style={[styles.savedCardSub, { color: colors.textSecondary }]}>{workout.exercises.length} exercise{workout.exercises.length !== 1 ? 's' : ''}</Text>
                        <Text style={[styles.savedCardSub, { color: colors.textSecondary }]}>·</Text>
                        <PlatformIcon name="clock" size={10} color={colors.textSecondary} />
                        <Text style={[styles.savedCardSub, { color: colors.textSecondary }]}>
                          {new Date(workout.lastUsed).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.savedCardActions}>
                      <TouchableOpacity onPress={() => handleEditSaved(workout)} activeOpacity={0.7} style={styles.iconBtn}>
                        <PlatformIcon name="pencil" size={14} color={colors.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteSaved(workout.id)} activeOpacity={0.7} style={styles.iconBtn}>
                        <PlatformIcon name="trash" size={14} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.loadBtn}
                    onPress={() => handleLoadForToday(workout)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.loadBtnText, { color: accent }]}>Load for Today</Text>
                  </TouchableOpacity>
                </View>
              ))
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8,
  },
  title: { fontSize: 18, fontWeight: '800' as const, letterSpacing: -0.3 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(128,128,128,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 4, marginBottom: 8 },
  tabBtn: { flex: 1, alignItems: 'center', paddingBottom: 10, paddingTop: 4 },
  tabText: { fontSize: 14, fontWeight: '600' as const },
  savedDot: { width: 7, height: 7, borderRadius: 4, position: 'absolute', top: 2, right: '25%' },
  content: { paddingHorizontal: 16, gap: 12, paddingBottom: 8 },
  buildContent: { gap: 14 },
  fieldLabel: { fontSize: 10, fontWeight: '700' as const, letterSpacing: 0.8 },
  nameInput: {
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, fontWeight: '500' as const,
  },
  actionBtns: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  actionBtnText: { fontSize: 13, fontWeight: '600' as const },
  addModeSection: { gap: 10 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  groupBadgeText: { fontSize: 12, fontWeight: '600' as const },
  groupLabelBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  groupLabelText: { fontSize: 10, fontWeight: '700' as const, letterSpacing: 0.5 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  searchResults: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  searchResultRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 0.5,
  },
  searchResultName: { fontSize: 14, fontWeight: '500' as const },
  searchResultMuscle: { fontSize: 12 },
  doneAddBtn: { alignSelf: 'flex-start', paddingVertical: 6 },
  doneAddText: { fontSize: 13, fontWeight: '600' as const },
  exerciseList: { gap: 0 },
  exerciseItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 0.5,
  },
  exerciseItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  reorderBtns: { alignItems: 'center', gap: 0 },
  reorderBtn: { padding: 2 },
  exerciseItemName: { fontSize: 14, fontWeight: '500' as const },
  exerciseItemGroup: { fontSize: 10, fontWeight: '600' as const, marginTop: 2 },
  emptyState: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 40, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed',
  },
  emptyText: { fontSize: 14 },
  saveBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  saveBtnText: { fontSize: 16, fontWeight: '700' as const },
  proNudgeRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12,
  },
  proNudgeText: { flex: 1, fontSize: 13, fontWeight: '600' as const, color: '#f5c842' },
  proNudgeArrow: { fontSize: 14, color: '#f5c842', fontWeight: '700' as const },
  savedContent: { gap: 12 },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterChip: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  filterText: { fontSize: 12, fontWeight: '600' as const },
  savedCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 12 },
  savedCardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  savedCardInfo: { flex: 1, gap: 4 },
  savedCardName: { fontSize: 15, fontWeight: '700' as const },
  savedCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  savedCardSub: { fontSize: 11 },
  savedCardActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  loadBtn: { alignItems: 'center', paddingVertical: 8 },
  loadBtnText: { fontSize: 14, fontWeight: '700' as const },
});
