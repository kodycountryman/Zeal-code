import React, { memo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Pressable,
  ActivityIndicator,
  PanResponder,
  Animated,
  Platform,
} from 'react-native';
import {
  X,
  Dumbbell,
  ArrowLeftRight,
  RotateCcw,
  Circle,
  Clock,
  Layers,
  ChevronRight,
} from 'lucide-react-native';
import { useZealTheme } from '@/context/AppContext';
import { useWorkoutTracking } from '@/context/WorkoutTrackingContext';
import type { WorkoutExercise } from '@/services/workoutEngine';

interface Props {
  visible: boolean;
  onClose: () => void;
  onGoToWorkout: () => void;
}

function groupExercises(exercises: WorkoutExercise[]): (WorkoutExercise | WorkoutExercise[])[] {
  const result: (WorkoutExercise | WorkoutExercise[])[] = [];
  const visited = new Set<string>();

  for (const ex of exercises) {
    if (visited.has(ex.id)) continue;
    if (ex.groupId) {
      const group = exercises.filter((item) => item.groupId === ex.groupId);
      group.forEach((item) => visited.add(item.id));
      result.push(group);
    } else {
      visited.add(ex.id);
      result.push(ex);
    }
  }

  return result;
}

function SectionHeader({ label, color }: { label: string; color: string }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={[styles.sectionLabel, { color }]}>{label}</Text>
      <View style={[styles.sectionDivider, { backgroundColor: `${color}35` }]} />
    </View>
  );
}

function WorkoutPreviewModal({ visible, onClose, onGoToWorkout }: Props) {
  const { colors, accent, isDark } = useZealTheme();
  const tracking = useWorkoutTracking();

  const workout = tracking.currentGeneratedWorkout;
  const isGenerating = tracking.isGeneratingWorkout && !workout;
  const grouped = workout ? groupExercises(workout.workout) : [];
  const warmupCount = workout?.warmup?.length ?? 0;
  const exerciseCount = workout?.workout?.length ?? 0;

  const handleGoToWorkout = useCallback(() => {
    onClose();
    onGoToWorkout();
  }, [onClose, onGoToWorkout]);

  // Full-sheet pan-down-to-dismiss ─────────────────────────────────────────
  const sheetY = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!visible) return;
    scrollY.current = 0;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    });
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      // Only capture when at the top of the scroll AND moving downward
      onMoveShouldSetPanResponder: (_e, gs) =>
        scrollY.current <= 2 && gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderMove: (_e, gs) => {
        if (gs.dy > 0) sheetY.setValue(gs.dy);
      },
      onPanResponderRelease: (_e, gs) => {
        if (gs.dy > 80 || gs.vy > 0.5) {
          // Fast dismiss: slide out then close
          Animated.timing(sheetY, {
            toValue: 800,
            duration: 220,
            useNativeDriver: true,
          }).start(() => {
            sheetY.setValue(0);
            onClose();
          });
        } else {
          // Snap back
          Animated.spring(sheetY, {
            toValue: 0,
            useNativeDriver: true,
            stiffness: 320,
            damping: 32,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(sheetY, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  const renderGroupBadge = (type: 'superset' | 'circuit' | 'rounds' | null) => {
    if (!type) return null;
    const Icon = type === 'superset' ? ArrowLeftRight : type === 'circuit' ? RotateCcw : Circle;
    const label = type === 'superset' ? 'SUPERSET' : type === 'circuit' ? 'CIRCUIT' : 'ROUNDS';
    return (
      <View style={[styles.groupTag, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}>
        <Icon size={10} color={colors.textMuted} />
        <Text style={[styles.groupTagText, { color: colors.textSecondary }]}>{label}</Text>
      </View>
    );
  };

  const renderExercise = (ex: WorkoutExercise, idx: number, inGroup = false) => {
    const meta = [ex.muscleGroup, ex.rest ? `${ex.rest} rest` : null].filter(Boolean).join(' · ');
    return (
      <View
        key={ex.id}
        style={[
          styles.exerciseBlock,
          { borderBottomColor: `${colors.border}55` },
          inGroup && styles.exerciseBlockGrouped,
        ]}
      >
        <View style={styles.exerciseHeader}>
          <Text style={[styles.exerciseIndex, { color: colors.textMuted }]}>{String(idx + 1).padStart(2, '0')}</Text>
          <View style={styles.exerciseTitleWrap}>
            <Text style={[styles.exerciseName, { color: colors.text }]} numberOfLines={1}>
              {ex.name}
            </Text>
            <Text style={[styles.exerciseMetaText, { color: colors.textSecondary }]} numberOfLines={1}>
              {meta}
            </Text>
          </View>
          <Text style={[styles.exerciseSetsLabel, { color: colors.textSecondary }]}> {ex.sets} × {ex.reps}</Text>
        </View>
      </View>
    );
  };

  const renderGroup = (group: WorkoutExercise[], startIdx: number) => {
    const type = group[0]?.groupType ?? null;
    return (
      <View
        key={group[0]?.id}
        style={[
          styles.groupBlock,
          {
            borderColor: `${colors.border}75`,
            backgroundColor: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.015)',
          },
        ]}
      >
        <View style={styles.groupBlockHeader}>
          {renderGroupBadge(type)}
          <Text style={[styles.groupBlockCount, { color: colors.textMuted }]}>{group.length} exercises</Text>
        </View>
        {group.map((ex, i) => renderExercise(ex, startIdx + i, true))}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View
        style={[styles.sheet, { backgroundColor: colors.card, transform: [{ translateY: sheetY }] }]}
        {...panResponder.panHandlers}
      >
        {/* Visual pill handle */}
        <View style={styles.handleWrap}>
          <View style={[styles.pill, { backgroundColor: colors.border }]} />
        </View>

        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7} testID="preview-close-button">
          <X size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        {!workout ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: `${accent}14` }]}>
              <Dumbbell size={28} color={accent} />
            </View>

            {isGenerating ? (
              <>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>Building your workout...</Text>
                <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                  Tailoring to your goals & equipment
                </Text>
                <ActivityIndicator style={{ marginTop: 10 }} color={accent} />
              </>
            ) : (
              <>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>Workout not generated yet</Text>
                <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                  Head to the Workout tab to generate today&apos;s session
                </Text>
                <TouchableOpacity
                  style={[styles.goBtn, { backgroundColor: accent }]}
                  onPress={handleGoToWorkout}
                  activeOpacity={0.85}
                  testID="preview-go-to-workout-empty"
                >
                  <Text style={styles.goBtnText}>Go to Workout</Text>
                  <ChevronRight size={16} color="#fff" />
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : (
          <>
            <ScrollView
              ref={scrollRef}
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={16}
              bounces={false}
              alwaysBounceVertical={false}
              {...(Platform.OS === 'android' ? { overScrollMode: 'never' as const } : {})}
              onScroll={(e) => {
                scrollY.current = Math.max(0, e.nativeEvent.contentOffset.y);
              }}
            >
              <View style={styles.eyebrowRow}>
                <View style={[styles.styleDot, { backgroundColor: accent }]} />
                <Text style={[styles.eyebrowText, { color: colors.textSecondary }]}>{workout.style.toUpperCase()}</Text>
              </View>

              <Text style={[styles.workoutName, { color: colors.text }]}>{workout.split}</Text>
              <Text style={[styles.dateText, { color: colors.textSecondary }]}>Today&apos;s Workout Preview</Text>

              <View style={styles.statsRow}>
                <View style={[styles.statPill, { backgroundColor: isDark ? '#1a1a1a' : '#f4f4f4', borderColor: `${colors.border}90` }]}>
                  <Layers size={13} color={colors.textMuted} />
                  <Text style={[styles.statText, { color: colors.text }]}>{exerciseCount} exercises</Text>
                </View>
                {warmupCount > 0 && (
                  <View style={[styles.statPill, { backgroundColor: isDark ? '#1a1a1a' : '#f4f4f4', borderColor: `${colors.border}90` }]}>
                    <Dumbbell size={13} color={colors.textMuted} />
                    <Text style={[styles.statText, { color: colors.text }]}>{warmupCount} warm-up</Text>
                  </View>
                )}
                <View style={[styles.statPill, { backgroundColor: isDark ? '#1a1a1a' : '#f4f4f4', borderColor: `${colors.border}90` }]}>
                  <Clock size={13} color={colors.textMuted} />
                  <Text style={[styles.statText, { color: colors.text }]}>{workout.estimatedDuration ?? '~45'} min</Text>
                </View>
              </View>

              {exerciseCount > 0 && (
                <>
                  <SectionHeader label="EXERCISE LIST" color={colors.textSecondary} />
                  {(() => {
                    let globalIdx = 0;
                    return grouped.map((item) => {
                      if (Array.isArray(item)) {
                        const startIdx = globalIdx;
                        globalIdx += item.length;
                        return renderGroup(item, startIdx);
                      }
                      const idx = globalIdx;
                      globalIdx += 1;
                      return renderExercise(item, idx);
                    });
                  })()}
                </>
              )}

              <View style={{ height: 16 }} />
            </ScrollView>

            <View style={[styles.footer, { borderTopColor: `${colors.border}60` }]}> 
              <TouchableOpacity
                style={[styles.goBtn, { backgroundColor: accent }]}
                onPress={handleGoToWorkout}
                activeOpacity={0.85}
                testID="preview-go-to-workout"
              >
                <Text style={styles.goBtnText}>Go to Workout</Text>
                <ChevronRight size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </>
        )}
      </Animated.View>
    </Modal>
  );
}

export default memo(WorkoutPreviewModal);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 22,
    paddingTop: 0,
    paddingBottom: 34,
    maxHeight: '90%',
  },
  handleWrap: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 12,
  },
  pill: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  closeBtn: {
    position: 'absolute',
    top: 22,
    right: 22,
    zIndex: 10,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  styleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  eyebrowText: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1,
  },
  workoutName: {
    fontSize: 24,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.6,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 13,
    marginBottom: 18,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
    flexWrap: 'wrap',
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  statText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1,
  },
  sectionDivider: {
    flex: 1,
    height: 1,
  },
  exerciseBlock: {
    borderBottomWidth: 1,
    paddingBottom: 14,
    marginBottom: 14,
  },
  exerciseBlockGrouped: {
    paddingBottom: 10,
    marginBottom: 10,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  exerciseIndex: {
    width: 20,
    fontSize: 12,
    fontWeight: '600' as const,
    lineHeight: 20,
  },
  exerciseTitleWrap: {
    flex: 1,
    gap: 4,
  },
  exerciseName: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
  exerciseMetaText: {
    fontSize: 12,
    lineHeight: 18,
  },
  exerciseSetsLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    flexShrink: 0,
    paddingTop: 2,
  },
  groupBlock: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 2,
  },
  groupBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  groupTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  groupTagText: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.8,
  },
  groupBlockCount: {
    fontSize: 11,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
    paddingVertical: 40,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    paddingTop: 12,
    borderTopWidth: 0.5,
    marginTop: 4,
  },
  goBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 16,
  },
  goBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
