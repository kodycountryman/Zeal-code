/**
 * ExercisePicker — bottom-sheet modal for adding exercises in Live Track.
 *
 * Three sources:
 *   Recents  — unique exercises from the last 30 days of workout history
 *   Search   — full ZealExercise DB, filtered by name as you type
 *   Custom   — free-text exercise (any name, Phase 2 auto-fill will back-fill DB lookup)
 */
import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useZealTheme } from '@/context/AppContext';
import { useWorkoutTracking } from '@/context/WorkoutTrackingContext';
import { PlatformIcon } from '@/components/PlatformIcon';
import type { WorkoutExercise } from '@/services/workoutEngine';
import { getZealExerciseDatabase, type ZealExercise } from '@/mocks/exerciseDatabase';
import {
  getTemplates,
  deleteTemplate,
  type WorkoutTemplate,
} from '@/services/workoutTemplateService';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: WorkoutExercise) => void;
  /** Load all exercises from a template at once */
  onLoadTemplate: (exercises: WorkoutExercise[]) => void;
}

type Tab = 'recents' | 'search' | 'templates';

// ─── Converters ──────────────────────────────────────────────────────────────

function zealToWorkoutExercise(ze: ZealExercise): WorkoutExercise {
  return {
    id: `lt_${ze.id}_${Date.now()}`,
    name: ze.name,
    sets: 3,
    reps: `${ze.rep_range_floor}–${ze.rep_range_ceiling}`,
    rest: `${ze.default_rest_sec}s`,
    muscleGroup: ze.primary_muscles[0] ?? 'Full Body',
    equipment: ze.equipment_required[0] ?? 'None',
    notes: '',
    type: ze.movement_pattern,
    movementType: ze.movement_pattern,
    groupType: null,
    groupId: null,
    suggestedWeight: '',
    lastSessionWeight: '',
    lastSessionReps: '',
    exerciseRef: {
      movement_pattern: ze.movement_pattern,
      equipment_required: ze.equipment_required as string[],
    },
    trackingMetric: ze.tracking_metric.primary,
    executionLogic: ze.execution_logic,
    mediaUrl: ze.media_url ?? '',
  };
}

function customToWorkoutExercise(name: string): WorkoutExercise {
  return {
    id: `lt_custom_${Date.now()}`,
    name: name.trim(),
    sets: 3,
    reps: '8–12',
    rest: '60s',
    muscleGroup: 'Other',
    equipment: 'Other',
    notes: '',
    type: 'Custom',
    movementType: 'other',
    groupType: null,
    groupId: null,
    suggestedWeight: '',
    lastSessionWeight: '',
    lastSessionReps: '',
    exerciseRef: null,
    trackingMetric: 'reps',
    executionLogic: 'bilateral',
    mediaUrl: '',
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ExercisePicker({ visible, onClose, onSelect, onLoadTemplate }: Props) {
  const { colors, accent, isDark } = useZealTheme();
  const { workoutHistory } = useWorkoutTracking();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<Tab>('recents');
  const [query, setQuery] = useState('');
  const [customText, setCustomText] = useState('');
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const searchInputRef = useRef<TextInput>(null);

  // Load templates when the sheet opens
  React.useEffect(() => {
    if (visible) {
      getTemplates().then(setTemplates).catch(() => {});
    }
  }, [visible]);

  // ── Recents: unique exercises from the last 30 days ───────────────────────
  const recentExercises = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const seen = new Set<string>();
    const result: { name: string; muscleGroup: string }[] = [];
    for (const log of workoutHistory) {
      if (new Date(log.date).getTime() < cutoff) break; // history is newest-first
      for (const ex of log.exercises) {
        const key = ex.exerciseName.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          result.push({ name: ex.exerciseName, muscleGroup: ex.muscleGroup });
        }
      }
    }
    return result.slice(0, 25);
  }, [workoutHistory]);

  // ── DB search ─────────────────────────────────────────────────────────────
  const allExercises = useMemo(() => getZealExerciseDatabase(), []);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allExercises.slice(0, 40);
    return allExercises
      .filter(e =>
        e.name.toLowerCase().includes(q) ||
        (e.aliases ?? []).some(a => a.toLowerCase().includes(q)) ||
        (e.primary_muscles ?? []).some(m => m.toLowerCase().includes(q))
      )
      .slice(0, 40);
  }, [allExercises, query]);

  const handleSelectRecent = useCallback((name: string, muscleGroup: string) => {
    // Try to look up in DB for full data; fall back to minimal object
    const dbMatch = allExercises.find(e => e.name.toLowerCase() === name.toLowerCase());
    if (dbMatch) {
      onSelect(zealToWorkoutExercise(dbMatch));
    } else {
      onSelect({
        id: `lt_recent_${Date.now()}`,
        name,
        sets: 3,
        reps: '8–12',
        rest: '60s',
        muscleGroup,
        equipment: 'Other',
        notes: '',
        type: 'Custom',
        movementType: 'other',
        groupType: null,
        groupId: null,
        suggestedWeight: '',
        lastSessionWeight: '',
        lastSessionReps: '',
        exerciseRef: null,
        trackingMetric: 'reps',
        executionLogic: 'bilateral',
        mediaUrl: '',
      });
    }
    handleClose();
  }, [allExercises, onSelect]);

  const handleSelectDB = useCallback((ze: ZealExercise) => {
    onSelect(zealToWorkoutExercise(ze));
    handleClose();
  }, [onSelect]);

  const handleAddCustom = useCallback(() => {
    const name = customText.trim();
    if (!name) return;
    onSelect(customToWorkoutExercise(name));
    setCustomText('');
    handleClose();
  }, [customText, onSelect]);

  const handleLoadTemplate = useCallback((template: WorkoutTemplate) => {
    // Re-ID each exercise so multiple loads of the same template don't collide
    const reIded = template.exercises.map(ex => ({
      ...ex,
      id: `lt_tmpl_${ex.id}_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
    }));
    onLoadTemplate(reIded);
    handleClose();
  }, [onLoadTemplate]);

  const handleDeleteTemplate = useCallback((id: string) => {
    deleteTemplate(id).then(() =>
      getTemplates().then(setTemplates)
    ).catch(() => {});
  }, []);

  const handleClose = useCallback(() => {
    setQuery('');
    setCustomText('');
    setActiveTab('recents');
    onClose();
  }, [onClose]);

  // ── Render ────────────────────────────────────────────────────────────────
  const sheetBg = isDark ? '#1a1a1a' : '#fff';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={[styles.root, { backgroundColor: sheetBg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Handle + header */}
        <View style={styles.handleRow}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
        </View>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Add Exercise</Text>
          <TouchableOpacity onPress={handleClose} activeOpacity={0.7} hitSlop={12}>
            <PlatformIcon name="x" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Tab bar */}
        <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
          {([
            { key: 'recents', label: 'Recents' },
            { key: 'search', label: 'Search' },
            { key: 'templates', label: 'Templates' },
          ] as { key: Tab; label: string }[]).map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.tab, activeTab === key && { borderBottomColor: accent, borderBottomWidth: 2 }]}
              onPress={() => {
                setActiveTab(key);
                if (key === 'search') setTimeout(() => searchInputRef.current?.focus(), 100);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabLabel, { color: activeTab === key ? accent : colors.textSecondary }]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recents tab */}
        {activeTab === 'recents' && (
          <>
            {recentExercises.length === 0 ? (
              <View style={styles.emptyState}>
                <PlatformIcon name="clock" size={32} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  No recent exercises yet.{'\n'}Search or add a custom exercise below.
                </Text>
              </View>
            ) : (
              <FlatList
                data={recentExercises}
                keyExtractor={item => item.name}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.row, { borderBottomColor: colors.border }]}
                    onPress={() => handleSelectRecent(item.name, item.muscleGroup)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.rowLeft}>
                      <Text style={[styles.rowName, { color: colors.text }]}>{item.name}</Text>
                      <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{item.muscleGroup}</Text>
                    </View>
                    <PlatformIcon name="plus" size={18} color={accent} />
                  </TouchableOpacity>
                )}
                contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
              />
            )}
          </>
        )}

        {/* Search tab */}
        {activeTab === 'search' && (
          <>
            <View style={[styles.searchBar, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
              <PlatformIcon name="search" size={15} color={colors.textMuted} />
              <TextInput
                ref={searchInputRef}
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search exercises or muscle..."
                placeholderTextColor={colors.textMuted}
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
                returnKeyType="search"
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery('')} activeOpacity={0.7}>
                  <PlatformIcon name="x" size={14} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            <FlatList
              data={searchResults}
              keyExtractor={item => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.row, { borderBottomColor: colors.border }]}
                  onPress={() => handleSelectDB(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowLeft}>
                    <Text style={[styles.rowName, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
                      {item.primary_muscles[0]} · {item.equipment_required[0] ?? 'Bodyweight'}
                    </Text>
                  </View>
                  <PlatformIcon name="plus" size={18} color={accent} />
                </TouchableOpacity>
              )}
              contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
            />
          </>
        )}

        {/* Templates tab */}
        {activeTab === 'templates' && (
          <>
            {templates.length === 0 ? (
              <View style={styles.emptyState}>
                <PlatformIcon name="bookmark" size={32} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  No saved templates yet.{'\n'}Finish a Live Track session and save it as a template.
                </Text>
              </View>
            ) : (
              <FlatList
                data={templates}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <View style={[styles.templateCard, { borderBottomColor: colors.border }]}>
                    <View style={styles.rowLeft}>
                      <Text style={[styles.rowName, { color: colors.text }]}>{item.name}</Text>
                      <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
                        {item.exerciseCount} exercise{item.exerciseCount !== 1 ? 's' : ''}
                        {item.muscleGroups.length > 0 ? ` · ${item.muscleGroups.slice(0, 3).join(', ')}` : ''}
                      </Text>
                    </View>
                    <View style={styles.templateActions}>
                      <TouchableOpacity
                        onPress={() => handleDeleteTemplate(item.id)}
                        activeOpacity={0.7}
                        hitSlop={8}
                        style={[styles.templateDeleteBtn, { borderColor: colors.border }]}
                      >
                        <PlatformIcon name="trash" size={14} color={colors.textMuted} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleLoadTemplate(item)}
                        activeOpacity={0.7}
                        style={[styles.templateLoadBtn, { backgroundColor: accent }]}
                      >
                        <Text style={styles.templateLoadText}>Load</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
              />
            )}
          </>
        )}

        {/* Custom exercise input — always visible at bottom */}
        <View style={[styles.customRow, { borderTopColor: colors.border, backgroundColor: sheetBg, paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            style={[styles.customInput, { backgroundColor: colors.cardSecondary, borderColor: colors.border, color: colors.text }]}
            placeholder="Add custom exercise..."
            placeholderTextColor={colors.textMuted}
            value={customText}
            onChangeText={setCustomText}
            returnKeyType="done"
            onSubmitEditing={handleAddCustom}
          />
          <TouchableOpacity
            style={[styles.customAddBtn, { backgroundColor: customText.trim() ? accent : colors.cardSecondary }]}
            onPress={handleAddCustom}
            activeOpacity={0.8}
            disabled={!customText.trim()}
          >
            <PlatformIcon name="plus" size={18} color={customText.trim() ? '#fff' : colors.textMuted} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.2,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabLabel: {
    fontSize: 13,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Outfit_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLeft: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
  },
  rowMeta: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Outfit_400Regular',
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  customInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    fontFamily: 'Outfit_400Regular',
  },
  customAddBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  templateActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  templateDeleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateLoadBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateLoadText: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
    color: '#fff',
    letterSpacing: 0.2,
  },
});
