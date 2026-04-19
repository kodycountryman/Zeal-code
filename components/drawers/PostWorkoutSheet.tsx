import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import BaseDrawer from '@/components/drawers/BaseDrawer';
import DrawerHeader from '@/components/drawers/DrawerHeader';
import GlassCard from '@/components/GlassCard';
import Chip from '@/components/Chip';
import Button from '@/components/Button';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme } from '@/context/AppContext';
import { useWorkoutTracking } from '@/context/WorkoutTrackingContext';
import { WORKOUT_STYLE_COLORS } from '@/constants/colors';
import { MUSCLE_GROUPS } from '@/constants/workoutStyles';
import { getWorkoutComparison } from '@/services/workoutComparison';
import { captureAndShareWorkout } from '@/services/workoutShareService';
import PostWorkoutShareCard from '@/components/PostWorkoutShareCard';
import type { View as RNView } from 'react-native';

type Mood = 'rough' | 'low' | 'neutral' | 'good' | 'great';

const MOOD_OPTIONS: { id: Mood; emoji: string; label: string }[] = [
  { id: 'rough',   emoji: '😖', label: 'Rough' },
  { id: 'low',     emoji: '🙁', label: 'Low' },
  { id: 'neutral', emoji: '😐', label: 'Neutral' },
  { id: 'good',    emoji: '😊', label: 'Good' },
  { id: 'great',   emoji: '😄', label: 'Great' },
];

const RPE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Same 8 chip strings the old PostWorkoutFlow used. Kept inline (not lifted
// to constants) until a second consumer needs them — premature abstraction
// otherwise.
const WHAT_WENT_WELL_CHIPS = [
  'Weight felt right', 'Good energy', 'Strong focus', 'Great pump',
  'Hit PRs', 'Good form', 'Fast recovery', 'Pushed hard',
];

function formatVolume(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(v);
}

function triggerHaptic(kind: 'select' | 'success' | 'light' | 'medium') {
  if (Platform.OS === 'web') return;
  switch (kind) {
    case 'select':  Haptics.selectionAsync().catch(() => {}); break;
    case 'success': Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); break;
    case 'light':   Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); break;
    case 'medium':  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); break;
  }
}

/**
 * Single-screen post-workout reflection sheet. Replaces the old multi-step
 * PostWorkoutFlow modal.
 *
 * Lifecycle assumption: by the time this renders, the WorkoutLog has already
 * been persisted (see beginPostWorkout in WorkoutTrackingContext). Tapping
 * Skip just dismisses. Tapping "Save Feedback" (after touching any input)
 * patches the saved log via applyFeedbackPatch.
 *
 * Two modes, same UI:
 *   - LIVE (default after Finish): seeds defaults, shows PR celebration
 *     when confirmedPRs.length > 0.
 *   - RETROACTIVE (opened via openFeedbackForLog from WorkoutLogDetail):
 *     seeds inputs from the existing log so the user sees what they
 *     previously saved.
 *
 * Phase 4 hooks (TODO):
 *   - Comparison line under the hero stats (workoutComparison helper).
 *   - Share Workout Card button (PostWorkoutShareCard).
 *   - Soreness selections feed AppContext.applySoreness on Save.
 */
export default function PostWorkoutSheet() {
  const { colors, accent, isDark } = useZealTheme();
  const tracking = useWorkoutTracking();

  const visible = tracking.postWorkoutStep === 'feedback';
  const log = useMemo(
    () => tracking.workoutHistory.find(l => l.id === tracking.lastSavedLogId) ?? null,
    [tracking.workoutHistory, tracking.lastSavedLogId],
  );

  // One-line context: how today stacks up vs the last comparable session.
  // Null when no comparable history exists yet (first-of-its-kind workout).
  const comparison = useMemo(
    () => log ? getWorkoutComparison(log, tracking.workoutHistory) : null,
    [log, tracking.workoutHistory],
  );

  // Local form state — seeded from the log on open.
  const [mood, setMood] = useState<Mood | null>(null);
  const [stars, setStars] = useState<number>(3);
  const [rpe, setRpe] = useState<number>(6);
  const [chips, setChips] = useState<string[]>([]);
  const [sore, setSore] = useState<string[]>([]);
  const [touched, setTouched] = useState<boolean>(false);

  // Re-seed each time the sheet opens for a (potentially different) log.
  useEffect(() => {
    if (!visible || !log) return;
    setMood(log.mood ?? null);
    setStars(log.starRating ?? 3);
    setRpe(log.rpe ?? 6);
    setChips(log.whatWentWell ?? []);
    setSore(log.soreMuscles ?? []);
    setTouched(false);
  }, [visible, log?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // One-shot success haptic when a PR celebration appears (live mode only).
  const prHapticFiredRef = useRef<string | null>(null);
  useEffect(() => {
    if (!visible) {
      prHapticFiredRef.current = null;
      return;
    }
    if (tracking.confirmedPRs.length > 0 && prHapticFiredRef.current !== log?.id) {
      triggerHaptic('success');
      prHapticFiredRef.current = log?.id ?? null;
    }
  }, [visible, tracking.confirmedPRs.length, log?.id]);

  const markTouched = useCallback(() => setTouched(true), []);

  const handleMoodPress = useCallback((m: Mood) => {
    triggerHaptic('select');
    setMood(prev => (prev === m ? null : m));
    markTouched();
  }, [markTouched]);

  const handleStarPress = useCallback((n: number) => {
    triggerHaptic('select');
    setStars(n);
    markTouched();
  }, [markTouched]);

  const handleRpePress = useCallback((n: number) => {
    triggerHaptic('select');
    setRpe(n);
    markTouched();
  }, [markTouched]);

  const handleChipToggle = useCallback((chip: string) => {
    triggerHaptic('select');
    setChips(prev => prev.includes(chip) ? prev.filter(c => c !== chip) : [...prev, chip]);
    markTouched();
  }, [markTouched]);

  const handleSoreToggle = useCallback((muscle: string) => {
    triggerHaptic('select');
    setSore(prev => prev.includes(muscle) ? prev.filter(m => m !== muscle) : [...prev, muscle]);
    markTouched();
  }, [markTouched]);

  const handleClose = useCallback(() => {
    if (touched) {
      triggerHaptic('success');
      tracking.applyFeedbackPatch({
        starRating: stars,
        rpe,
        whatWentWell: chips,
        mood: mood ?? undefined,
        soreMuscles: sore,
      });
      // TODO Phase 4: ctx.applySoreness(sore) to feed muscle readiness.
    } else {
      triggerHaptic('light');
    }
    tracking.dismissPostWorkout();
  }, [touched, stars, rpe, chips, mood, sore, tracking]);

  const shareCardRef = useRef<RNView | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const handleShareTap = useCallback(async () => {
    if (!log || isSharing) return;
    triggerHaptic('medium');
    setIsSharing(true);
    try {
      // Card is mounted in the off-screen overlay below. Give layout one
      // frame to settle before capture, especially on first share.
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      await captureAndShareWorkout({ viewRef: shareCardRef });
    } finally {
      setIsSharing(false);
    }
  }, [log, isSharing]);

  if (!visible || !log) return null;

  const styleColor = WORKOUT_STYLE_COLORS[log.workoutStyle] ?? accent;

  // ─── Render ─────────────────────────────────────────────────────────────

  const header = <DrawerHeader title="Workout Complete" onClose={handleClose} />;

  const footer = (
    <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
      <Button
        label={touched ? 'Save Feedback' : 'Skip'}
        variant="primary"
        size="lg"
        fullWidth
        onPress={handleClose}
        testID="post-workout-footer-button"
      />
    </View>
  );

  return (
    <BaseDrawer visible={visible} onClose={handleClose} header={header} footer={footer}>
      <View style={styles.content}>
        {/* ── Hero card: style badge, name, 4-stat strip ── */}
        <GlassCard style={styles.heroCard}>
          <View style={[styles.styleBadge, { backgroundColor: styleColor }]}>
            <Text style={styles.styleBadgeText}>{log.workoutStyle.toUpperCase()}</Text>
          </View>
          <Text style={[styles.workoutName, { color: colors.text }]}>{log.workoutName}</Text>

          <View style={styles.statRow}>
            <View style={styles.statCell}>
              <PlatformIcon name="clock" size={14} color={colors.textSecondary} />
              <Text style={[styles.statValue, { color: colors.text }]}>{log.duration}m</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Time</Text>
            </View>
            <View style={styles.statCell}>
              <PlatformIcon name="dumbbell" size={14} color={colors.textSecondary} />
              <Text style={[styles.statValue, { color: colors.text }]}>{log.totalSets}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Sets</Text>
            </View>
            <View style={styles.statCell}>
              <PlatformIcon name="zap" size={14} color={colors.textSecondary} />
              <Text style={[styles.statValue, { color: colors.text }]}>{formatVolume(log.totalVolume)}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Volume</Text>
            </View>
            <View style={styles.statCell}>
              <PlatformIcon name="trophy" size={14} color={accent} />
              <Text style={[styles.statValue, { color: accent }]}>{log.trainingScore}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Score</Text>
            </View>
          </View>

          {comparison && (
            <View style={styles.comparisonRow}>
              <PlatformIcon name="trending-up" size={13} color={accent} />
              <Text style={[styles.comparisonText, { color: colors.textSecondary }]}>
                {comparison}
              </Text>
            </View>
          )}
        </GlassCard>

        {/* ── PR celebration (only when fresh PRs from this session) ── */}
        {tracking.confirmedPRs.length > 0 && (
          <GlassCard style={[styles.prCard, { borderColor: `${accent}55` }]}>
            <View style={styles.prHeader}>
              <PlatformIcon name="trophy" size={20} color={accent} />
              <Text style={[styles.prTitle, { color: accent }]}>
                {tracking.confirmedPRs.length === 1 ? 'New Personal Record!' : `${tracking.confirmedPRs.length} New Personal Records!`}
              </Text>
            </View>
            {tracking.confirmedPRs.map((pr, i) => (
              <View key={`${pr.exerciseName}-${pr.type}-${i}`} style={styles.prRow}>
                <Text style={[styles.prExerciseName, { color: colors.text }]} numberOfLines={1}>
                  {pr.exerciseName}
                </Text>
                <Text style={[styles.prValue, { color: accent }]}>
                  {pr.type === 'weight' && `${pr.value} lbs`}
                  {pr.type === 'reps' && `${pr.value} reps`}
                  {pr.type === 'volume' && `${pr.value} lbs vol`}
                </Text>
              </View>
            ))}
          </GlassCard>
        )}

        {/* ── Mood emoji ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>How did it feel mentally?</Text>
          <View style={styles.moodRow}>
            {MOOD_OPTIONS.map(opt => {
              const selected = mood === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => handleMoodPress(opt.id)}
                  activeOpacity={0.7}
                  style={[
                    styles.moodCell,
                    {
                      backgroundColor: selected ? `${accent}20` : colors.cardSecondary,
                      borderColor: selected ? accent : colors.border,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={opt.label}
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.moodEmoji, selected && styles.moodEmojiSelected]}>{opt.emoji}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Star rating ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Rate the workout</Text>
          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map(n => (
              <TouchableOpacity
                key={n}
                onPress={() => handleStarPress(n)}
                activeOpacity={0.7}
                style={styles.starButton}
                accessibilityRole="button"
                accessibilityLabel={`${n} star${n === 1 ? '' : 's'}`}
                accessibilityState={{ selected: stars === n }}
              >
                <PlatformIcon
                  name="star"
                  size={32}
                  color={n <= stars ? accent : (isDark ? '#444' : '#d1d5db')}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── RPE chips ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Effort (RPE)</Text>
          <View style={styles.chipGrid}>
            {RPE_VALUES.map(v => (
              <Chip
                key={v}
                label={String(v)}
                variant="selectable"
                selected={rpe === v}
                onPress={() => handleRpePress(v)}
              />
            ))}
          </View>
        </View>

        {/* ── What went well ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>What went well?</Text>
          <View style={styles.chipGrid}>
            {WHAT_WENT_WELL_CHIPS.map(c => (
              <Chip
                key={c}
                label={c}
                variant="selectable"
                selected={chips.includes(c)}
                onPress={() => handleChipToggle(c)}
              />
            ))}
          </View>
        </View>

        {/* ── Body soreness ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Anything sore? (helps us plan tomorrow)</Text>
          <View style={styles.chipGrid}>
            {MUSCLE_GROUPS.map(m => (
              <Chip
                key={m}
                label={m}
                variant="selectable"
                selected={sore.includes(m)}
                onPress={() => handleSoreToggle(m)}
              />
            ))}
          </View>
        </View>

        {/* ── Share button (Phase 4 wires up the actual share) ── */}
        <TouchableOpacity
          style={[styles.shareButton, { borderColor: colors.border, backgroundColor: colors.cardSecondary }]}
          onPress={handleShareTap}
          activeOpacity={0.85}
          testID="post-workout-share-button"
          accessibilityRole="button"
          accessibilityLabel="Share workout card"
        >
          <PlatformIcon name="image" size={16} color={accent} />
          <Text style={[styles.shareButtonText, { color: accent }]}>Share Workout Card</Text>
        </TouchableOpacity>

        <View style={{ height: 16 }} />
      </View>

      {/* Off-screen render target for the share card. Positioned outside the
          visible viewport so it doesn't interfere with the sheet UI but is
          mounted (collapsable={false}) so view-shot can capture it. */}
      <View style={styles.shareCardHost} pointerEvents="none">
        <PostWorkoutShareCard ref={shareCardRef} log={log} accent={accent} />
      </View>
    </BaseDrawer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 4,
    gap: 18,
  },
  heroCard: {
    padding: 18,
    gap: 12,
  },
  styleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  styleBadgeText: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 1.0,
    color: '#fff',
  },
  workoutName: {
    fontSize: 22,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.4,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  statCell: {
    alignItems: 'center',
    gap: 3,
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
    letterSpacing: 0.2,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  comparisonText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
  },
  prCard: {
    padding: 16,
    gap: 10,
    borderWidth: 1.5,
  },
  prHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  prTitle: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.2,
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  prExerciseName: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
  },
  prValue: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0,
  },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  moodCell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodEmoji: {
    fontSize: 28,
  },
  moodEmojiSelected: {
    transform: [{ scale: 1.1 }],
  },
  starRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 4,
  },
  starButton: {
    padding: 4,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  shareButtonText: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.2,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  // Off-screen render container — far enough off the viewport that it never
  // shows. Stays mounted only while the sheet is visible.
  shareCardHost: {
    position: 'absolute',
    top: -10000,
    left: -10000,
    width: 1080,
    height: 1920,
  },
});
