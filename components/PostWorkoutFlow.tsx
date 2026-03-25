import React, { useState, useRef, useCallback, useMemo } from 'react';

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  PanResponder,
  Dimensions,
} from 'react-native';
import { Trophy, Clock, Dumbbell, Zap, Star, X, Award, Save } from 'lucide-react-native';
import { useZealTheme } from '@/context/AppContext';
import { useWorkoutTracking } from '@/context/WorkoutTrackingContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SLIDER_WIDTH = SCREEN_WIDTH - 88;

const WELL_CHIPS = [
  'Weight felt right', 'Good energy', 'Strong focus', 'Great pump',
  'Hit PRs', 'Good form', 'Fast recovery', 'Pushed hard',
];

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}h ${rm}m`;
  }
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function StarRating({ value, onChange, size = 36 }: { value: number; onChange: (v: number) => void; size?: number }) {
  const handleStar = useCallback((i: number) => {
    onChange(i);
  }, [onChange]);
  return (
    <View style={starStyles.row}>
      {[1, 2, 3, 4, 5].map(i => (
        <TouchableOpacity key={i} onPress={() => handleStar(i)} activeOpacity={0.7} style={starStyles.touch}>
          <Star
            size={size}
            color={i <= value ? '#f87116' : '#444'}
            fill={i <= value ? '#f87116' : 'transparent'}
            strokeWidth={1.5}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const starStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  touch: { padding: 4 },
});

function RPESlider({ value, onChange, onSlideStart, onSlideEnd }: {
  value: number;
  onChange: (v: number) => void;
  onSlideStart?: () => void;
  onSlideEnd?: () => void;
}) {
  const { colors } = useZealTheme();
  const sliderRef = useRef<View>(null);
  const trackLayoutRef = useRef({ pageX: 0, width: SLIDER_WIDTH });
  const isSliding = useRef(false);

  const computeRpe = useCallback((pageX: number) => {
    const { pageX: trackX, width } = trackLayoutRef.current;
    const localX = pageX - trackX;
    const ratio = Math.max(0, Math.min(1, localX / width));
    return Math.max(1, Math.min(10, Math.round(1 + ratio * 9)));
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => isSliding.current,
      onPanResponderGrant: (evt) => {
        isSliding.current = true;
        onSlideStart?.();
        sliderRef.current?.measure((_x, _y, w, _h, px) => {
          if (w > 0) {
            trackLayoutRef.current = { pageX: px, width: w };
          }
          onChange(computeRpe(evt.nativeEvent.pageX));
        });
      },
      onPanResponderMove: (evt) => {
        onChange(computeRpe(evt.nativeEvent.pageX));
      },
      onPanResponderRelease: () => {
        isSliding.current = false;
        onSlideEnd?.();
      },
      onPanResponderTerminate: () => {
        isSliding.current = false;
        onSlideEnd?.();
      },
      onShouldBlockNativeResponder: () => true,
    })
  ).current;

  const fillPercent = ((value - 1) / 9) * 100;
  const rpeColor = value <= 3 ? '#22c55e' : value <= 6 ? '#eab308' : value <= 8 ? '#f87116' : '#ef4444';

  return (
    <View style={rpeStyles.container}>
      <Text style={[rpeStyles.bigNumber, { color: rpeColor }]}>{value}</Text>
      <View
        ref={sliderRef}
        style={rpeStyles.track}
        onLayout={(e) => {
          trackLayoutRef.current.width = e.nativeEvent.layout.width;
          sliderRef.current?.measure((_x, _y, w, _h, px) => {
            if (w > 0) {
              trackLayoutRef.current = { pageX: px, width: w };
            }
          });
        }}
        {...panResponder.panHandlers}
      >
        <View style={[rpeStyles.trackBg, { backgroundColor: `${colors.border}80` }]} />
        <View style={[rpeStyles.trackFill, { width: `${fillPercent}%` as any, backgroundColor: rpeColor }]} />
        <View style={[rpeStyles.thumb, { left: `${fillPercent}%` as any, backgroundColor: rpeColor }]} />
      </View>
      <View style={rpeStyles.labels}>
        <Text style={[rpeStyles.labelText, { color: colors.textSecondary }]}>Easy</Text>
        <Text style={[rpeStyles.labelText, { color: colors.textSecondary }]}>Max Effort</Text>
      </View>
    </View>
  );
}

const rpeStyles = StyleSheet.create({
  container: { alignItems: 'center', marginBottom: 24, gap: 8 },
  bigNumber: { fontSize: 48, fontFamily: 'Outfit_800ExtraBold', letterSpacing: -2, lineHeight: 52 },
  track: { width: '100%', height: 40, justifyContent: 'center', position: 'relative' },
  trackBg: { height: 6, borderRadius: 3, width: '100%' },
  trackFill: { height: 6, borderRadius: 3, position: 'absolute', top: 17 },
  thumb: { width: 24, height: 24, borderRadius: 12, position: 'absolute', top: 8, marginLeft: -12 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  labelText: { fontSize: 11, fontWeight: '500' as const },
});

export default function PostWorkoutFlow() {
  const { colors, isDark } = useZealTheme();
  const tracking = useWorkoutTracking();

  const [starRating, setStarRating] = useState<number>(3);
  const [rpe, setRpe] = useState<number>(6);
  const [chips, setChips] = useState<string[]>([]);
  const [scrollEnabled, setScrollEnabled] = useState<boolean>(true);

  const step = tracking.postWorkoutStep;

  const totalSets = useMemo(() => Object.values(tracking.exerciseLogs).reduce(
    (acc, log) => acc + log.sets.filter(s => s.done).length, 0
  ), [tracking.exerciseLogs]);

  const totalVolume = useMemo(() => Object.values(tracking.exerciseLogs).reduce(
    (acc, log) => acc + log.sets.filter(s => s.done).reduce((sum, s) => sum + s.weight * s.reps, 0), 0
  ), [tracking.exerciseLogs]);

  const handleChipToggle = useCallback((chip: string) => {
    setChips(prev => prev.includes(chip) ? prev.filter(c => c !== chip) : [...prev, chip]);
  }, []);

  const handleClose = useCallback(() => {
    tracking.setPostWorkoutStep(null);
  }, [tracking]);

  const handlePRsNext = useCallback(() => {
    tracking.setPostWorkoutStep('feedback');
  }, [tracking]);

  const handleFeedbackNext = useCallback(() => {
    tracking.prepareSaveStep(starRating, rpe, chips);
  }, [tracking, starRating, rpe, chips]);

  const handleSave = useCallback(() => {
    requestAnimationFrame(() => {
      tracking.saveWorkout();
    });
  }, [tracking]);

  const handleDiscard = useCallback(() => {
    tracking.discardWorkout();
  }, [tracking]);

  if (!step) return null;

  return (
    <Modal
      visible={!!step}
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

          {step === 'prs' && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.prSummaryHeader}>
                <View style={styles.prIconCircle}>
                  <Trophy size={32} color="#f87116" />
                </View>
                <Text style={[styles.stepTitle, { color: colors.text }]}>New Personal Records!</Text>
                <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
                  You beat your previous bests
                </Text>
              </View>

              {tracking.confirmedPRs.map((pr, idx) => (
                <View key={idx} style={[styles.prCard, { backgroundColor: isDark ? '#1a1a0a' : '#fffbeb' }]}>
                  <View style={styles.prCardLeft}>
                    <Award size={20} color="#f87116" />
                  </View>
                  <View style={styles.prCardContent}>
                    <Text style={[styles.prExName, { color: colors.text }]}>{pr.exerciseName}</Text>
                    <Text style={[styles.prRecordValue, { color: '#f87116' }]}>
                      {pr.type === 'weight' ? `${pr.value} lbs` : pr.type === 'reps' ? `${pr.value} reps` : `${pr.value} lbs volume`}
                    </Text>
                    <Text style={[styles.prRecordType, { color: colors.textSecondary }]}>
                      {pr.type === 'weight' ? 'Max Weight' : pr.type === 'reps' ? 'Max Reps' : 'Max Volume'}
                    </Text>
                  </View>
                </View>
              ))}

              <TouchableOpacity style={styles.nextBtn} onPress={handlePRsNext} activeOpacity={0.85}>
                <Text style={styles.nextBtnText}>Continue</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {step === 'feedback' && (
            <ScrollView showsVerticalScrollIndicator={false} scrollEnabled={scrollEnabled}>
              <Text style={[styles.stepTitle, { color: colors.text }]}>How did it feel?</Text>
              <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
                Rate your workout
              </Text>

              <View style={styles.starSection}>
                <StarRating value={starRating} onChange={setStarRating} />
              </View>

              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>RPE (Rate of Perceived Exertion)</Text>
              <RPESlider
                value={rpe}
                onChange={setRpe}
                onSlideStart={() => setScrollEnabled(false)}
                onSlideEnd={() => setScrollEnabled(true)}
              />

              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>What went well?</Text>
              <View style={styles.chipsWrap}>
                {WELL_CHIPS.map(chip => (
                  <TouchableOpacity
                    key={chip}
                    style={[
                      styles.chip,
                      { borderColor: chips.includes(chip) ? '#f87116' : colors.border },
                      chips.includes(chip) && { backgroundColor: '#f8711618' },
                    ]}
                    onPress={() => handleChipToggle(chip)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, { color: chips.includes(chip) ? '#f87116' : colors.text }]}>
                      {chip}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.nextBtn} onPress={handleFeedbackNext} activeOpacity={0.85}>
                <Text style={styles.nextBtnText}>Continue</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {step === 'save' && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.saveHeader}>
                <Save size={24} color="#f87116" />
                <Text style={[styles.stepTitle, { color: colors.text }]}>Save Workout</Text>
              </View>

              <Text style={[styles.saveName, { color: colors.text }]}>
                {tracking.activeWorkout?.split ?? 'Workout'}
              </Text>

              <View style={styles.saveStatsGrid}>
                <View style={[styles.saveStat, { backgroundColor: isDark ? '#1e1e1e' : '#f5f5f5' }]}>
                  <Clock size={14} color={colors.textSecondary} />
                  <Text style={[styles.saveStatValue, { color: colors.text }]}>
                    {formatDuration(tracking.workoutElapsed)}
                  </Text>
                  <Text style={[styles.saveStatLabel, { color: colors.textSecondary }]}>Duration</Text>
                </View>
                <View style={[styles.saveStat, { backgroundColor: isDark ? '#1e1e1e' : '#f5f5f5' }]}>
                  <Dumbbell size={14} color={colors.textSecondary} />
                  <Text style={[styles.saveStatValue, { color: colors.text }]}>{totalSets}</Text>
                  <Text style={[styles.saveStatLabel, { color: colors.textSecondary }]}>Sets</Text>
                </View>
                <View style={[styles.saveStat, { backgroundColor: isDark ? '#1e1e1e' : '#f5f5f5' }]}>
                  <Zap size={14} color={colors.textSecondary} />
                  <Text style={[styles.saveStatValue, { color: colors.text }]}>
                    {totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}k` : totalVolume}
                  </Text>
                  <Text style={[styles.saveStatLabel, { color: colors.textSecondary }]}>Volume</Text>
                </View>
                <View style={[styles.saveStat, { backgroundColor: isDark ? '#1e1e1e' : '#f5f5f5' }]}>
                  <Trophy size={14} color={colors.textSecondary} />
                  <Text style={[styles.saveStatValue, { color: colors.text }]}>{tracking.confirmedPRs.length}</Text>
                  <Text style={[styles.saveStatLabel, { color: colors.textSecondary }]}>PRs</Text>
                </View>
              </View>

              {tracking.sessionScoreBreakdown && (
                <View style={[styles.scoreCard, { backgroundColor: isDark ? '#1a1a2e' : '#f0f4ff' }]}>
                  <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>TRAINING SCORE</Text>
                  <Text style={styles.scoreValue}>{tracking.sessionScoreBreakdown.finalScore}</Text>
                  <View style={styles.scoreBreakdown}>
                    <Text style={[styles.breakdownItem, { color: colors.textSecondary }]}>
                      Base: +{tracking.sessionScoreBreakdown.basePoints}
                    </Text>
                    <Text style={[styles.breakdownItem, { color: colors.textSecondary }]}>
                      Volume: +{tracking.sessionScoreBreakdown.volumePoints}
                    </Text>
                    <Text style={[styles.breakdownItem, { color: colors.textSecondary }]}>
                      Intensity: +{tracking.sessionScoreBreakdown.intensityPoints}
                    </Text>
                    {tracking.sessionScoreBreakdown.prBonus > 0 && (
                      <Text style={[styles.breakdownItem, { color: '#f87116' }]}>
                        PR Bonus: +{tracking.sessionScoreBreakdown.prBonus}
                      </Text>
                    )}
                  </View>
                </View>
              )}

              <View style={styles.saveRatingRow}>
                <StarRating value={tracking.selectedStarRating} onChange={() => {}} size={20} />
              </View>

              {tracking.confirmedPRs.length > 0 && (
                <View style={styles.savePrList}>
                  {tracking.confirmedPRs.map((pr, idx) => (
                    <View key={idx} style={styles.savePrRow}>
                      <Trophy size={12} color="#f87116" />
                      <Text style={[styles.savePrText, { color: colors.text }]}>
                        {pr.exerciseName}: {pr.type === 'weight' ? `${pr.value} lbs` : pr.type === 'reps' ? `${pr.value} reps` : `${pr.value} lbs vol`}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
                <Text style={styles.saveBtnText}>Save Workout</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.discardBtn} onPress={handleDiscard} activeOpacity={0.7}>
                <Text style={[styles.discardBtnText, { color: colors.textMuted }]}>Discard</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
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
    paddingBottom: 44,
    maxHeight: '90%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  closeBtn: {
    position: 'absolute',
    top: 22,
    right: 22,
    zIndex: 10,
  },
  stepTitle: {
    fontSize: 24,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 13,
    marginBottom: 20,
  },
  starSection: {
    marginBottom: 28,
    paddingTop: 4,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 28,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  nextBtn: {
    backgroundColor: '#f87116',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  nextBtnText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
  prSummaryHeader: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
    paddingTop: 8,
  },
  prIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(248,113,22,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  prCard: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    gap: 14,
    alignItems: 'center',
  },
  prCardLeft: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(248,113,22,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prCardContent: {
    flex: 1,
    gap: 2,
  },
  prExName: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
  },
  prRecordValue: {
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.5,
  },
  prRecordType: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
  saveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  saveName: {
    fontSize: 20,
    fontFamily: 'Outfit_600SemiBold',
    marginBottom: 16,
  },
  saveStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  saveStat: {
    width: '47%' as any,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  saveStatValue: {
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
  },
  saveStatLabel: {
    fontSize: 10,
    fontWeight: '500' as const,
  },
  scoreCard: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  scoreLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    letterSpacing: 0.8,
  },
  scoreValue: {
    fontSize: 48,
    fontFamily: 'Outfit_800ExtraBold',
    color: '#3b82f6',
    letterSpacing: -2,
    lineHeight: 52,
  },
  scoreBreakdown: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  breakdownItem: {
    fontSize: 11,
  },
  saveRatingRow: {
    marginBottom: 12,
  },
  savePrList: {
    gap: 6,
    marginBottom: 16,
  },
  savePrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  savePrText: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  saveBtn: {
    backgroundColor: '#f87116',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
  discardBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 10,
  },
  discardBtnText: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
});
