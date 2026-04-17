import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { PlatformIcon } from '@/components/PlatformIcon';
import GlassCard from '@/components/GlassCard';
import Button from '@/components/Button';
import { useZealTheme } from '@/context/AppContext';
import RouteReview from '@/components/run/RouteReview';
import ElevationChart from '@/components/run/ElevationChart';
import SplitTable from '@/components/run/SplitTable';
import PaceChart from '@/components/run/PaceChart';
import HeartRateChart from '@/components/run/HeartRateChart';
import ShareCard, { type ShareCardFormat } from '@/components/run/ShareCard';
import { captureAndShareRun } from '@/services/runShareService';
import { RunLog, METERS_PER_MILE, METERS_PER_KM } from '@/types/run';
import { formatPace, paceToSecondsPerMile, paceToSecondsPerKm } from '@/services/runTrackingService';

type Mode = 'post_run' | 'log_view';

interface Props {
  log: RunLog;
  mode: Mode;
  /** Current rating value — only used in post_run mode. */
  rating?: number | null;
  onRatingChange?: (rating: number) => void;
  /** Current notes value — only used in post_run mode. */
  notes?: string;
  onNotesChange?: (notes: string) => void;
  /** Save handler — only used in post_run mode. Receives the final log. */
  onSave?: () => void;
  /** Discard handler — only used in post_run mode. */
  onDiscard?: () => void;
  /** Whether a save is in flight (disables buttons, shows spinner). */
  isSaving?: boolean;
  /** Hide the action buttons entirely (e.g. when used in a drawer with its own actions). */
  hideActions?: boolean;
  /** Optional delete handler for log_view mode. */
  onDelete?: () => void;
  /** Optional edit handler for log_view mode — triggers inline edit of rating/notes. */
  editable?: boolean;
  /** Optional callback fired when user saves edits to rating/notes (log_view). */
  onSaveEdits?: (updates: { rating: number | null; notes: string }) => void;
}

function formatDistance(meters: number, units: 'imperial' | 'metric'): string {
  if (units === 'metric') return `${(meters / METERS_PER_KM).toFixed(2)} km`;
  return `${(meters / METERS_PER_MILE).toFixed(2)} mi`;
}

function formatDuration(totalSeconds: number): string {
  if (!isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const hrs = Math.floor(totalSeconds / 3600);
  const min = Math.floor((totalSeconds % 3600) / 60);
  const sec = Math.floor(totalSeconds % 60);
  if (hrs > 0) return `${hrs}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

function formatPaceForUnit(secondsPerMeter: number, units: 'imperial' | 'metric'): string {
  const perUnit = units === 'metric' ? paceToSecondsPerKm(secondsPerMeter) : paceToSecondsPerMile(secondsPerMeter);
  return formatPace(perUnit);
}

export default function RunSummary({
  log,
  mode,
  rating,
  onRatingChange,
  notes,
  onNotesChange,
  onSave,
  onDiscard,
  isSaving = false,
  hideActions = false,
  onDelete,
  editable = false,
  onSaveEdits,
}: Props) {
  const { colors, accent, isDark } = useZealTheme();

  // ─── Edit-mode state (log_view only) ─────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [editRating, setEditRating] = useState<number | null>(log.rating);
  const [editNotes, setEditNotes] = useState(log.notes ?? '');

  // ─── Share card refs (off-screen render targets) ─────────────────────
  const squareCardRef = useRef<View>(null);
  const storyCardRef = useRef<View>(null);
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async (format: ShareCardFormat = 'square') => {
    if (isSharing) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setIsSharing(true);
    const ref = format === 'story' ? storyCardRef : squareCardRef;
    const ok = await captureAndShareRun({
      viewRef: ref,
      filename: `zeal-run-${log.id}.png`,
    });
    setIsSharing(false);
    if (!ok && Platform.OS !== 'web') {
      Alert.alert('Share unavailable', 'Could not open the share sheet. Please try again.');
    }
  };

  const handleStartEdit = () => {
    setEditRating(log.rating);
    setEditNotes(log.notes ?? '');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditRating(log.rating);
    setEditNotes(log.notes ?? '');
  };

  const handleConfirmEdits = () => {
    if (onSaveEdits) {
      onSaveEdits({ rating: editRating, notes: editNotes });
    }
    setIsEditing(false);
  };

  // ─── Derived values ──────────────────────────────────────────────────
  const distanceDisplay = useMemo(() => formatDistance(log.distanceMeters, log.splitUnit), [log]);
  const timeDisplay = useMemo(() => formatDuration(log.durationSeconds), [log]);
  const paceDisplay = useMemo(() => formatPaceForUnit(log.averagePaceSecondsPerMeter, log.splitUnit), [log]);

  // Effective values for rating/notes based on mode
  const effectiveRating = mode === 'log_view' ? (isEditing ? editRating : log.rating) : rating;
  const effectiveNotes = mode === 'log_view' ? (isEditing ? editNotes : (log.notes ?? '')) : (notes ?? '');
  const ratingIsInteractive = mode === 'post_run' || (mode === 'log_view' && isEditing);
  const notesAreInteractive = mode === 'post_run' || (mode === 'log_view' && isEditing);

  const onRatingTap = (value: number) => {
    if (mode === 'post_run' && onRatingChange) {
      onRatingChange(value);
    } else if (mode === 'log_view' && isEditing) {
      setEditRating(value);
    }
  };

  const onNotesUpdate = (value: string) => {
    if (mode === 'post_run' && onNotesChange) {
      onNotesChange(value);
    } else if (mode === 'log_view' && isEditing) {
      setEditNotes(value);
    }
  };

  return (
    <View style={styles.container}>
      {/* ─── Hero distance ────────────────────────────────────────────── */}
      <View style={[styles.hero, { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
        <Text style={[styles.heroLabel, { color: colors.textMuted }]}>DISTANCE</Text>
        <Text style={[styles.heroValue, { color: colors.text }]}>{distanceDisplay}</Text>
      </View>

      {/* ─── Route map ────────────────────────────────────────────────── */}
      {log.route.length >= 2 && (
        <RouteReview route={log.route} splits={log.splits} units={log.splitUnit} />
      )}

      {/* ─── Elevation ───────────────────────────────────────────────── */}
      {log.route.length >= 4 && log.elevationGainMeters > 0 && (
        <GlassCard style={styles.sectionCard}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>ELEVATION</Text>
          <ElevationChart route={log.route} units={log.splitUnit} />
        </GlassCard>
      )}

      {/* ─── Pace over time ──────────────────────────────────────────── */}
      {log.route.length >= 10 && (
        <GlassCard style={styles.sectionCard}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>PACE</Text>
          <PaceChart
            route={log.route}
            units={log.splitUnit}
            averagePaceSecondsPerMeter={log.averagePaceSecondsPerMeter}
          />
        </GlassCard>
      )}

      {/* ─── Heart rate ──────────────────────────────────────────────── */}
      {(log.averageHeartRate || log.splits.some(s => s.averageHeartRate)) && (
        <GlassCard style={styles.sectionCard}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>HEART RATE</Text>
          <HeartRateChart
            splits={log.splits}
            averageHeartRate={log.averageHeartRate}
            maxHeartRate={log.maxHeartRate}
          />
        </GlassCard>
      )}

      {/* ─── Stats grid ──────────────────────────────────────────────── */}
      <GlassCard style={styles.statsCard}>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>TIME</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{timeDisplay}</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statBox}>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>AVG PACE</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{paceDisplay}</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statBox}>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>CAL</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{log.calories ?? '—'}</Text>
          </View>
        </View>
      </GlassCard>

      {/* ─── Splits ──────────────────────────────────────────────────── */}
      {log.splits.length > 0 && (
        <GlassCard style={styles.sectionCard}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>SPLITS</Text>
          <SplitTable splits={log.splits} units={log.splitUnit} />
        </GlassCard>
      )}

      {/* ─── Rating ──────────────────────────────────────────────────── */}
      <GlassCard style={styles.sectionCard}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>HOW DID IT FEEL?</Text>
          {mode === 'log_view' && editable && !isEditing && (
            <TouchableOpacity onPress={handleStartEdit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <PlatformIcon name="pencil" size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.ratingRow}>
          {[1, 2, 3, 4, 5].map((value) => {
            const selected = effectiveRating === value;
            return (
              <TouchableOpacity
                key={value}
                style={[
                  styles.ratingButton,
                  {
                    backgroundColor: selected ? `${accent}25` : 'transparent',
                    borderColor: selected ? accent : colors.border,
                    opacity: ratingIsInteractive ? 1 : 0.95,
                  },
                ]}
                onPress={() => onRatingTap(value)}
                activeOpacity={0.7}
                disabled={!ratingIsInteractive}
              >
                <Text style={[styles.ratingValue, { color: selected ? accent : colors.text }]}>{value}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.ratingLegendRow}>
          <Text style={[styles.ratingLegendText, { color: colors.textMuted }]}>Easy</Text>
          <Text style={[styles.ratingLegendText, { color: colors.textMuted }]}>Brutal</Text>
        </View>
      </GlassCard>

      {/* ─── Notes ───────────────────────────────────────────────────── */}
      <GlassCard style={styles.sectionCard}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>NOTES</Text>
          {mode === 'log_view' && editable && !isEditing && log.notes && (
            <TouchableOpacity onPress={handleStartEdit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <PlatformIcon name="pencil" size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        {notesAreInteractive ? (
          <TextInput
            value={effectiveNotes}
            onChangeText={onNotesUpdate}
            placeholder="How was the run?"
            placeholderTextColor={colors.textMuted}
            multiline
            style={[styles.notesInput, { color: colors.text, borderColor: colors.border }]}
          />
        ) : (
          <Text style={[styles.notesReadOnly, { color: effectiveNotes ? colors.text : colors.textMuted }]}>
            {effectiveNotes || 'No notes for this run.'}
          </Text>
        )}
      </GlassCard>

      {/* ─── Share buttons (both modes) ──────────────────────────────── */}
      <View style={styles.shareRow}>
        <View style={{ flex: 1 }}>
          <Button
            variant="secondary"
            icon="image"
            label="Share Post"
            fullWidth
            disabled={isSharing}
            onPress={() => handleShare('square')}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            variant="secondary"
            icon="image"
            label="Share Story"
            fullWidth
            disabled={isSharing}
            onPress={() => handleShare('story')}
          />
        </View>
        {isSharing && <ActivityIndicator size="small" color={accent} style={{ marginLeft: 8 }} />}
      </View>

      {/* ─── Action buttons ──────────────────────────────────────────── */}
      {!hideActions && mode === 'post_run' && (
        <View style={styles.actionRow}>
          <View style={{ flex: 1 }}>
            <Button
              variant="secondary"
              label="Discard"
              fullWidth
              disabled={isSaving}
              onPress={() => onDiscard?.()}
            />
          </View>
          <View style={{ flex: 2 }}>
            <Button
              variant="primary"
              label="Save Run"
              fullWidth
              loading={isSaving}
              onPress={() => onSave?.()}
            />
          </View>
        </View>
      )}

      {!hideActions && mode === 'log_view' && isEditing && (
        <View style={styles.actionRow}>
          <View style={{ flex: 1 }}>
            <Button
              variant="secondary"
              label="Cancel"
              fullWidth
              onPress={handleCancelEdit}
            />
          </View>
          <View style={{ flex: 2 }}>
            <Button
              variant="primary"
              label="Save Changes"
              fullWidth
              onPress={handleConfirmEdits}
            />
          </View>
        </View>
      )}

      {!hideActions && mode === 'log_view' && !isEditing && onDelete && (
        <Button
          variant="secondary"
          icon="trash"
          label="Delete Run"
          fullWidth
          destructive
          onPress={() => {
            Alert.alert(
              'Delete Run?',
              'This run will be permanently removed from your history.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: onDelete },
              ],
            );
          }}
        />
      )}

      {/* ─── Off-screen share card render targets ────────────────────── */}
      {/* Rendered at left:-9999 so they snapshot correctly but are invisible */}
      <View pointerEvents="none" style={styles.offscreen} collapsable={false}>
        <ShareCard ref={squareCardRef} log={log} format="square" accent={accent} />
      </View>
      <View pointerEvents="none" style={styles.offscreen} collapsable={false}>
        <ShareCard ref={storyCardRef} log={log} format="story" accent={accent} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  hero: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 22,
    borderWidth: 1,
    backgroundColor: 'transparent',
    gap: 6,
  },
  heroLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 1.2,
  },
  heroValue: {
    fontSize: 48,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -1.5,
  },
  sectionCard: {
    padding: 14,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.8,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statsCard: {
    padding: 14,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: 2,
  },
  statLabel: {
    fontSize: 9,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.8,
  },
  statValue: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.3,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  ratingButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingValue: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
  },
  ratingLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  ratingLegendText: {
    fontSize: 10,
    fontFamily: 'Outfit_500Medium',
    letterSpacing: 0.3,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
    fontSize: 14,
    fontFamily: 'Outfit_400Regular',
    textAlignVertical: 'top',
  },
  notesReadOnly: {
    fontSize: 14,
    fontFamily: 'Outfit_400Regular',
    lineHeight: 20,
    paddingVertical: 6,
  },
  shareRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  offscreen: {
    position: 'absolute',
    left: -9999,
    top: -9999,
    opacity: 0,
  },
});
