import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Image, Modal, Pressable, Dimensions } from 'react-native';
import BaseDrawer from '@/components/drawers/BaseDrawer';
import DrawerHeader from '@/components/drawers/DrawerHeader';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme } from '@/context/AppContext';
import { useSeventyFiveHard } from '@/context/SeventyFiveHardContext';
import { isDayFullyComplete } from '@/services/seventyFiveHardTypes';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const GOLD = '#eab308';
const GREEN = '#22c55e';
const YELLOW = '#f59e0b';
const RED = '#ef4444';
const GRAY = 'rgba(128,128,128,0.3)';

interface AdherenceBar {
  label: string;
  icon: string;
  count: number;
  total: number;
  color: string;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function SeventyFiveHardProgressDrawer({ visible, onClose }: Props) {
  const { colors } = useZealTheme();
  const { state, currentDay, getAdherenceStats, endChallenge, resetChallenge } = useSeventyFiveHard();
  const [selectedPhoto, setSelectedPhoto] = useState<{ uri: string; date: string } | null>(null);

  const stats = useMemo(() => getAdherenceStats(), [getAdherenceStats, state]);

  const adherenceBars = useMemo((): AdherenceBar[] => {
    if (!stats) return [];
    return [
      { label: 'Workout 1', icon: 'dumbbell', count: stats.workout1, total: stats.total, color: '#f87116' },
      { label: 'Workout 2', icon: 'sun', count: stats.workout2, total: stats.total, color: '#06b6d4' },
      { label: 'Water', icon: 'droplets', count: stats.water, total: stats.total, color: '#60a5fa' },
      { label: 'Reading', icon: 'book-open', count: stats.reading, total: stats.total, color: '#a78bfa' },
      { label: 'Diet', icon: 'utensils', count: stats.diet, total: stats.total, color: '#22c55e' },
      { label: 'Photos', icon: 'camera', count: stats.photo, total: stats.total, color: '#ec4899' },
    ];
  }, [stats]);

  // Build 75-day heatmap grid
  const heatmapCells = useMemo(() => {
    if (!state) return [];
    const cells: { day: number; color: string }[] = [];
    const start = new Date(state.startDate + 'T00:00:00');

    for (let i = 0; i < 75; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      if (dateStr > todayStr) {
        cells.push({ day: i + 1, color: GRAY });
      } else {
        const dayData = state.days[dateStr];
        if (!dayData) {
          cells.push({ day: i + 1, color: dateStr < todayStr ? RED : GRAY });
        } else if (isDayFullyComplete(dayData)) {
          cells.push({ day: i + 1, color: GREEN });
        } else {
          const checked = [
            dayData.workout1Complete, dayData.workout2Complete,
            dayData.waterComplete, dayData.readingComplete,
            dayData.dietComplete, dayData.photoComplete,
          ].filter(Boolean).length;
          cells.push({ day: i + 1, color: checked > 0 ? YELLOW : RED });
        }
      }
    }
    return cells;
  }, [state]);

  // Photo timeline
  const photoTimeline = useMemo(() => {
    if (!state) return [];
    return Object.values(state.days)
      .filter(d => d.photoUri)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [state]);

  const handleEndChallenge = () => {
    Alert.alert(
      'End 75 Hard?',
      'This will clear all progress. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Challenge',
          style: 'destructive',
          onPress: () => { endChallenge(); onClose(); },
        },
      ],
    );
  };

  const handleReset = () => {
    Alert.alert(
      'Reset to Day 1?',
      'Your progress will be cleared and you\'ll start fresh. Reset history will be preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: resetChallenge,
        },
      ],
    );
  };

  const fullyComplete = stats?.fullyComplete ?? 0;
  const daysRemaining = 75 - currentDay + 1;

  const headerContent = (
    <DrawerHeader title="75 Hard Progress" onClose={onClose} />
  );

  return (
    <>
    <BaseDrawer visible={visible} onClose={onClose} header={headerContent}>
      <View style={styles.content}>

        {/* ─── Overview ──────────────────────────────────────── */}
        <View style={styles.overviewRow}>
          <View style={[styles.statBox, { backgroundColor: colors.cardSecondary }]}>
            <Text style={[styles.statValue, { color: GOLD }]}>{currentDay}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Current Day</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.cardSecondary }]}>
            <Text style={[styles.statValue, { color: GREEN }]}>{fullyComplete}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Perfect Days</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.cardSecondary }]}>
            <Text style={[styles.statValue, { color: colors.text }]}>{daysRemaining}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Remaining</Text>
          </View>
        </View>

        {/* ─── Overall progress bar ──────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>overall progress</Text>
          <View style={[styles.progressTrack, { backgroundColor: `${GOLD}15` }]}>
            <View style={[styles.progressFill, { width: `${Math.round((fullyComplete / 75) * 100)}%` as any, backgroundColor: GOLD }]} />
          </View>
          <Text style={[styles.progressText, { color: colors.textMuted }]}>{fullyComplete}/75 days fully completed</Text>
        </View>

        {/* ─── Adherence bars ────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>category adherence</Text>
          {adherenceBars.map((bar) => {
            const pct = bar.total > 0 ? Math.round((bar.count / bar.total) * 100) : 0;
            return (
              <View key={bar.label} style={styles.barRow}>
                <View style={styles.barLabelRow}>
                  <PlatformIcon name={bar.icon as any} size={13} color={bar.color} />
                  <Text style={[styles.barLabel, { color: colors.text }]}>{bar.label}</Text>
                  <Text style={[styles.barPct, { color: colors.textMuted }]}>{pct}%</Text>
                </View>
                <View style={[styles.barTrack, { backgroundColor: `${bar.color}15` }]}>
                  <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: bar.color }]} />
                </View>
              </View>
            );
          })}
        </View>

        {/* ─── Heatmap ───────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>75-day heatmap</Text>
          <View style={styles.heatmapGrid}>
            {heatmapCells.map((cell) => (
              <View
                key={cell.day}
                style={[styles.heatmapCell, { backgroundColor: cell.color }]}
              />
            ))}
          </View>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: GREEN }]} />
              <Text style={[styles.legendText, { color: colors.textMuted }]}>Complete</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: YELLOW }]} />
              <Text style={[styles.legendText, { color: colors.textMuted }]}>Partial</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: RED }]} />
              <Text style={[styles.legendText, { color: colors.textMuted }]}>Missed</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: GRAY }]} />
              <Text style={[styles.legendText, { color: colors.textMuted }]}>Future</Text>
            </View>
          </View>
        </View>

        {/* ─── Photo timeline ────────────────────────────────── */}
        {photoTimeline.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>photo timeline</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
              {photoTimeline.map((day) => (
                <TouchableOpacity
                  key={day.date}
                  style={styles.photoThumbWrap}
                  onPress={() => setSelectedPhoto({ uri: day.photoUri!, date: day.date })}
                  activeOpacity={0.8}
                >
                  <Image
                    source={{ uri: day.photoUri }}
                    style={[styles.photoThumb, { borderColor: colors.border }]}
                    resizeMode="cover"
                  />
                  <Text style={[styles.photoDate, { color: colors.textMuted }]}>
                    {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ─── Reset history ─────────────────────────────────── */}
        {state && state.resetHistory.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>reset history</Text>
            <Text style={[styles.resetText, { color: colors.textMuted }]}>
              Restarted {state.resetHistory.length} time{state.resetHistory.length > 1 ? 's' : ''}
              {' — '}
              {state.resetHistory.map(d =>
                new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              ).join(', ')}
            </Text>
          </View>
        )}

        {/* ─── Actions ───────────────────────────────────────── */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={[styles.resetBtn, { borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.05)' }]}
            onPress={handleReset}
            activeOpacity={0.7}
          >
            <PlatformIcon name="refresh" size={12} color={colors.textMuted} />
            <Text style={[styles.resetBtnText, { color: colors.textMuted }]}>Reset to Day 1</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.endBtn, { borderColor: 'rgba(239,68,68,0.25)', backgroundColor: 'rgba(239,68,68,0.07)' }]}
            onPress={handleEndChallenge}
            activeOpacity={0.7}
          >
            <PlatformIcon name="x" size={12} color={'rgba(239,68,68,0.6)'} />
            <Text style={[styles.endBtnText, { color: 'rgba(239,68,68,0.6)' }]}>End Challenge</Text>
          </TouchableOpacity>
        </View>

      </View>
    </BaseDrawer>

    {/* ─── Full-screen photo overlay ─────────────────────── */}
    <Modal
      visible={!!selectedPhoto}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => setSelectedPhoto(null)}
    >
      <Pressable style={styles.overlayBackdrop} onPress={() => setSelectedPhoto(null)}>
        <View style={styles.overlayContent}>
          {selectedPhoto && (
            <>
              <Image
                source={{ uri: selectedPhoto.uri }}
                style={styles.overlayImage}
                resizeMode="contain"
              />
              <Text style={styles.overlayDate}>
                {new Date(selectedPhoto.date + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'short', month: 'long', day: 'numeric',
                })}
              </Text>
            </>
          )}
          <TouchableOpacity style={styles.overlayClose} onPress={() => setSelectedPhoto(null)}>
            <PlatformIcon name="x" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 20,
  },
  overviewRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 2,
  },
  statValue: {
    fontSize: 24,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: 10,
    borderRadius: 999,
  },
  progressText: {
    fontSize: 11,
    fontFamily: 'Outfit_400Regular',
  },
  barRow: {
    gap: 4,
  },
  barLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  barLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
  },
  barPct: {
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
  },
  barTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    borderRadius: 999,
  },
  heatmapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  heatmapCell: {
    width: 18,
    height: 18,
    borderRadius: 4,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 10,
    fontFamily: 'Outfit_400Regular',
  },
  photoScroll: {
    flexDirection: 'row',
  },
  photoThumbWrap: {
    alignItems: 'center',
    gap: 5,
    marginRight: 10,
  },
  photoThumb: {
    width: 80,
    height: 106,
    borderRadius: 12,
    borderWidth: 1,
  },
  photoDate: {
    fontSize: 10,
    fontFamily: 'Outfit_500Medium',
  },
  resetText: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
  },
  actionsSection: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  resetBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
  },
  resetBtnText: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
  },
  endBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
  },
  endBtnText: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
  },
  overlayBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayContent: {
    width: SCREEN_W,
    alignItems: 'center',
    gap: 14,
  },
  overlayImage: {
    width: SCREEN_W,
    height: SCREEN_H * 0.72,
  },
  overlayDate: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontFamily: 'Outfit_500Medium',
  },
  overlayClose: {
    position: 'absolute',
    top: -SCREEN_H * 0.38,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
