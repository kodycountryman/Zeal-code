import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { X, Clock, CheckCircle2, Star, Trash2, Trophy } from 'lucide-react-native';
import { useZealTheme } from '@/context/AppContext';
import { useWorkoutTracking } from '@/context/WorkoutTrackingContext';
import { WORKOUT_STYLE_COLORS } from '@/constants/colors';

function StarDisplay({ count, size = 14 }: { count: number; size?: number }) {
  return (
    <View style={sdStyles.row}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={size}
          color={i <= count ? '#f87116' : '#444'}
          fill={i <= count ? '#f87116' : 'transparent'}
          strokeWidth={1.5}
        />
      ))}
    </View>
  );
}

const sdStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 3 },
});

export default function WorkoutLogDetail() {
  const { colors, isDark } = useZealTheme();
  const tracking = useWorkoutTracking();
  const log = tracking.selectedLog;

  if (!tracking.workoutLogDetailVisible || !log) return null;

  const styleColor = WORKOUT_STYLE_COLORS[log.workoutStyle] ?? '#f87116';
  const starRating = log.starRating ?? 3;

  const handleRemove = () => {
    Alert.alert('Remove This Log?', 'This will subtract the training score earned from this session. This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          tracking.removeWorkoutLog(log.id);
          tracking.setWorkoutLogDetailVisible(false);
          tracking.setSelectedLogId(null);
        },
      },
    ]);
  };

  const handleClose = () => {
    tracking.setWorkoutLogDetailVisible(false);
    tracking.setSelectedLogId(null);
  };

  return (
    <Modal
      visible={tracking.workoutLogDetailVisible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <TouchableOpacity style={styles.closeBtn} onPress={handleClose} activeOpacity={0.7}>
            <X size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={[styles.styleBadge, { backgroundColor: styleColor }]}>
              <Text style={styles.styleBadgeText}>{log.workoutStyle.toUpperCase()}</Text>
            </View>
            <Text style={[styles.workoutName, { color: colors.text }]}>
              {log.workoutName}
            </Text>
            <Text style={[styles.dateText, { color: colors.textSecondary }]}>
              {new Date(log.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </Text>

            <View style={styles.statsRow}>
              <View style={[styles.statPill, { backgroundColor: isDark ? '#1e1e1e' : '#f0f0f0' }]}>
                <Clock size={13} color={colors.textSecondary} />
                <Text style={[styles.statText, { color: colors.text }]}>{log.duration}m</Text>
              </View>
              <View style={[styles.statPill, { backgroundColor: isDark ? '#1e1e1e' : '#f0f0f0' }]}>
                <CheckCircle2 size={13} color={colors.textSecondary} />
                <Text style={[styles.statText, { color: colors.text }]}>{log.totalSets} sets</Text>
              </View>
              <View style={[styles.statPill, { backgroundColor: isDark ? '#1e1e1e' : '#f0f0f0' }]}>
                <StarDisplay count={starRating} size={11} />
              </View>
            </View>

            {log.trainingScore > 0 && (
              <View style={[styles.scoreRow, { backgroundColor: isDark ? '#1a1a2e' : '#f0f4ff' }]}>
                <Text style={[styles.scoreRowLabel, { color: colors.textSecondary }]}>TRAINING SCORE</Text>
                <Text style={styles.scoreRowValue}>{log.trainingScore}</Text>
              </View>
            )}

            {log.exercises.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>EXERCISE LOG</Text>
                {log.exercises.map((ex, idx) => {
                  if (!ex) return null;
                  return (
                    <View key={idx} style={[styles.exerciseBlock, { borderBottomColor: `${colors.border}40` }]}>
                      <View style={styles.exerciseHeader}>
                        <Text style={[styles.exerciseName, { color: colors.text }]}>{ex.exerciseName}</Text>
                        <Text style={[styles.exerciseSetsLabel, { color: styleColor }]}>
                          {ex.sets?.length ?? 0}×{ex.sets?.[0]?.reps ?? ''}
                        </Text>
                      </View>

                      {ex.sets && ex.sets.some(s => s.done && s.weight > 0) ? (
                        <View style={styles.setsTable}>
                          <View style={styles.setsHeaderRow}>
                            <Text style={[styles.setsHeaderCell, { color: colors.textMuted }]}>#</Text>
                            <Text style={[styles.setsHeaderCell, styles.setsHeaderWeight, { color: colors.textMuted }]}>WEIGHT</Text>
                            <Text style={[styles.setsHeaderCell, { color: colors.textMuted }]}>REPS</Text>
                          </View>
                          {ex.sets.filter(s => s.done).map((set, si) => (
                            <View key={si} style={styles.setsDataRow}>
                              <Text style={[styles.setsCell, { color: styleColor }]}>{set.setNumber}</Text>
                              <Text style={[styles.setsCell, styles.setsWeightCell, { color: colors.text }]}>{set.weight} lbs</Text>
                              <Text style={[styles.setsCell, { color: colors.text }]}>{set.reps}</Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={[styles.noData, { color: colors.textMuted }]}>No data logged</Text>
                      )}

                      {ex.prHit && (
                        <View style={styles.prBadge}>
                          <Trophy size={11} color="#f87116" />
                          <Text style={styles.prBadgeText}>PR</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </>
            )}

            {log.exercises.length === 0 && log.isManualLog && (
              <View style={styles.manualInfo}>
                <Text style={[styles.manualLabel, { color: colors.textSecondary }]}>Manual log — no exercise data</Text>
                {log.muscleGroups && log.muscleGroups.length > 0 && (
                  <Text style={[styles.manualMuscles, { color: colors.textSecondary }]}>
                    Muscles: {log.muscleGroups.join(', ')}
                  </Text>
                )}
              </View>
            )}

            {(log.rpe > 0 || log.whatWentWell.length > 0 || starRating > 0) && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>POST-WORKOUT FEEDBACK</Text>

                <View style={styles.feedbackGrid}>
                  <View style={styles.feedbackItem}>
                    <Text style={[styles.feedbackLabel, { color: colors.textSecondary }]}>RPE</Text>
                    <View style={[styles.rpeBadge, { borderColor: '#f87116' }]}>
                      <Text style={styles.rpeValue}>{log.rpe} / 10</Text>
                    </View>
                  </View>
                  <View style={styles.feedbackItem}>
                    <Text style={[styles.feedbackLabel, { color: colors.textSecondary }]}>Rating</Text>
                    <StarDisplay count={starRating} size={14} />
                  </View>
                </View>

                {log.whatWentWell.length > 0 && (
                  <>
                    <Text style={[styles.feedbackSubLabel, { color: colors.textSecondary }]}>WHAT WENT WELL</Text>
                    <View style={styles.wellChips}>
                      {log.whatWentWell.map((chip, i) => (
                        <View key={i} style={[styles.wellChipPill, { borderColor: '#f8711640' }]}>
                          <Text style={styles.wellChipText}>{chip}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </>
            )}

            <TouchableOpacity style={styles.removeBtn} onPress={handleRemove} activeOpacity={0.7}>
              <Trash2 size={14} color="#ef4444" />
              <Text style={styles.removeBtnText}>Remove This Log</Text>
            </TouchableOpacity>

            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 22,
    paddingBottom: 34,
    maxHeight: '90%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  closeBtn: {
    position: 'absolute',
    top: 22,
    right: 22,
    zIndex: 10,
  },
  styleBadge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  styleBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
  },
  workoutName: {
    fontSize: 22,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  dateText: {
    fontSize: 13,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  statText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  scoreRow: {
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  scoreRowLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    letterSpacing: 0.8,
  },
  scoreRowValue: {
    fontSize: 28,
    fontFamily: 'Outfit_800ExtraBold',
    color: '#3b82f6',
    letterSpacing: -1,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 4,
  },
  exerciseBlock: {
    borderBottomWidth: 1,
    paddingBottom: 12,
    marginBottom: 12,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  exerciseName: {
    fontSize: 16,
    fontFamily: 'Outfit_600SemiBold',
    flex: 1,
  },
  exerciseSetsLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  setsTable: {
    gap: 4,
  },
  setsHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  setsHeaderCell: {
    fontSize: 10,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
    width: 60,
  },
  setsHeaderWeight: {
    flex: 1,
  },
  setsDataRow: {
    flexDirection: 'row',
    paddingVertical: 3,
  },
  setsCell: {
    fontSize: 14,
    fontWeight: '500' as const,
    width: 60,
  },
  setsWeightCell: {
    flex: 1,
  },
  noData: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  prBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#f87116',
  },
  manualInfo: {
    paddingVertical: 16,
    gap: 4,
  },
  manualLabel: {
    fontSize: 13,
  },
  manualMuscles: {
    fontSize: 12,
  },
  feedbackGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 14,
    alignItems: 'center',
  },
  feedbackItem: {
    gap: 6,
  },
  feedbackLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
  },
  rpeBadge: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  rpeValue: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
    color: '#f87116',
  },
  feedbackSubLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  wellChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  wellChipPill: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  wellChipText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: '#f87116',
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    marginTop: 8,
  },
  removeBtnText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#ef4444',
  },
});
