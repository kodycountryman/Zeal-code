import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, ScrollView } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme } from '@/context/AppContext';
import GlassCard from '@/components/GlassCard';
import { useRun } from '@/context/RunContext';
import {
  type IntervalSegment,
  type SegmentType,
} from '@/services/intervalEngine';

const SEGMENT_COLORS: Record<SegmentType, string> = {
  warmup: '#60a5fa',
  work: '#ef4444',
  recovery: '#22c55e',
  cooldown: '#a78bfa',
};

const SEGMENT_LABELS: Record<SegmentType, string> = {
  warmup: 'Warmup',
  work: 'Work',
  recovery: 'Recovery',
  cooldown: 'Cooldown',
};

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${String(sec).padStart(2, '0')}`;
}

function formatMeters(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(meters % 1000 === 0 ? 0 : 1)} km`;
  return `${Math.round(meters)} m`;
}

interface SegmentProgressRingProps {
  size: number;
  stroke: number;
  /** Progress 0..1 */
  progress: number;
  color: string;
  trackColor: string;
}

function SegmentProgressRing({ size, stroke, progress, color, trackColor }: SegmentProgressRingProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - Math.min(1, Math.max(0, progress)));

  return (
    <Svg width={size} height={size}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={trackColor}
        strokeWidth={stroke}
        fill="none"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

export default function IntervalRunner() {
  const { colors, accent, isDark } = useZealTheme();
  const run = useRun();
  const snap = run.intervalSnapshot;
  const [listVisible, setListVisible] = useState(false);

  const segments = useMemo(() => run.getIntervalSegments(), [run, snap?.totalSegments]);

  if (!snap || !snap.hasIntervals) return null;

  // Workout finished
  if (snap.isComplete) {
    return (
      <GlassCard style={styles.card}>
        <View style={styles.completeRow}>
          <PlatformIcon name="check-circle" size={20} color="#22c55e" />
          <Text style={[styles.completeTitle, { color: colors.text }]}>Interval workout complete</Text>
        </View>
        <Text style={[styles.completeSub, { color: colors.textSecondary }]}>
          Keep cruising or stop the run when you're ready.
        </Text>
      </GlassCard>
    );
  }

  const seg = snap.currentSegment;
  if (!seg) return null;

  const color = SEGMENT_COLORS[seg.type];
  const trackColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  // Compute progress + countdown text based on segment mode
  let progress = 0;
  let countdownText = '';
  let countdownSubText = '';
  if (seg.mode === 'time' && seg.durationSeconds) {
    progress = snap.elapsedInCurrentSec / seg.durationSeconds;
    countdownText = formatTime(snap.remainingInCurrentSec);
    countdownSubText = 'remaining';
  } else if (seg.mode === 'distance' && seg.distanceMeters) {
    progress = snap.elapsedInCurrentMeters / seg.distanceMeters;
    countdownText = formatMeters(snap.remainingInCurrentMeters);
    countdownSubText = 'remaining';
  }

  const ringSize = 200;
  const ringStroke = 12;

  return (
    <>
      {/* Workout-wide progress bar */}
      <View style={[styles.workoutProgressTrack, { backgroundColor: trackColor }]}>
        <View
          style={[
            styles.workoutProgressFill,
            { width: `${snap.workoutProgress * 100}%`, backgroundColor: accent },
          ]}
        />
      </View>
      <View style={styles.workoutProgressLabelRow}>
        <Text style={[styles.workoutProgressLabel, { color: colors.textMuted }]}>
          Segment {snap.currentSegmentIndex + 1} of {snap.totalSegments}
        </Text>
        <TouchableOpacity onPress={() => setListVisible(true)} activeOpacity={0.7}>
          <Text style={[styles.workoutProgressLink, { color: accent }]}>View workout</Text>
        </TouchableOpacity>
      </View>

      <GlassCard style={styles.card}>
        {/* Segment label + type */}
        <View style={styles.headerRow}>
          <View style={[styles.typeChip, { backgroundColor: `${color}20`, borderColor: `${color}40` }]}>
            <Text style={[styles.typeChipText, { color }]}>{SEGMENT_LABELS[seg.type].toUpperCase()}</Text>
          </View>
          {seg.repNumber && seg.totalReps && (
            <Text style={[styles.repLabel, { color: colors.textMuted }]}>
              REP {seg.repNumber} / {seg.totalReps}
            </Text>
          )}
        </View>

        {/* Big progress ring with countdown inside */}
        <View style={styles.ringWrap}>
          <SegmentProgressRing
            size={ringSize}
            stroke={ringStroke}
            progress={progress}
            color={color}
            trackColor={trackColor}
          />
          <View style={styles.ringInner}>
            <Text style={[styles.countdownText, { color: colors.text }]}>{countdownText}</Text>
            <Text style={[styles.countdownSub, { color: colors.textMuted }]}>{countdownSubText}</Text>
          </View>
        </View>

        {/* Segment label */}
        <Text style={[styles.segmentLabel, { color: colors.text }]} numberOfLines={1}>
          {seg.label}
        </Text>
        {seg.targetPaceSecPerMile && (
          <Text style={[styles.targetPace, { color: colors.textSecondary }]}>
            target {formatPaceFromSec(seg.targetPaceSecPerMile)}/mi
          </Text>
        )}

        {/* Next-up preview */}
        {snap.nextSegment && (
          <View style={[styles.nextRow, { backgroundColor: trackColor }]}>
            <View style={styles.nextLeft}>
              <Text style={[styles.nextLabel, { color: colors.textMuted }]}>NEXT</Text>
              <Text style={[styles.nextSegmentLabel, { color: colors.text }]} numberOfLines={1}>
                {snap.nextSegment.label}
              </Text>
            </View>
            <View
              style={[
                styles.nextDot,
                { backgroundColor: SEGMENT_COLORS[snap.nextSegment.type] },
              ]}
            />
          </View>
        )}

        {/* Skip button */}
        <TouchableOpacity
          style={[styles.skipButton, { borderColor: colors.border }]}
          onPress={run.skipIntervalSegment}
          activeOpacity={0.7}
        >
          <PlatformIcon name="chevron-right" size={14} color={colors.textSecondary} />
          <Text style={[styles.skipButtonText, { color: colors.textSecondary }]}>Skip segment</Text>
        </TouchableOpacity>
      </GlassCard>

      {/* Workout list modal */}
      <Modal
        visible={listVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setListVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setListVisible(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: isDark ? '#1a1a1a' : '#fff', borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Workout segments</Text>
              <TouchableOpacity onPress={() => setListVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <PlatformIcon name="x" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              {segments.map((s) => {
                const isCurrent = s.index === snap.currentSegmentIndex;
                const isComplete = s.index < snap.currentSegmentIndex;
                const segColor = SEGMENT_COLORS[s.type];
                return (
                  <View
                    key={s.index}
                    style={[
                      styles.segmentListRow,
                      {
                        backgroundColor: isCurrent ? `${segColor}15` : 'transparent',
                        borderColor: isCurrent ? `${segColor}40` : colors.border,
                      },
                    ]}
                  >
                    <View style={[styles.segmentListDot, { backgroundColor: segColor, opacity: isComplete ? 0.3 : 1 }]} />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.segmentListLabel,
                          {
                            color: isCurrent ? segColor : isComplete ? colors.textMuted : colors.text,
                            textDecorationLine: isComplete ? 'line-through' : 'none',
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {s.label}
                      </Text>
                      <Text style={[styles.segmentListType, { color: colors.textMuted }]}>
                        {SEGMENT_LABELS[s.type]}
                      </Text>
                    </View>
                    {isComplete && <PlatformIcon name="check" size={14} color={colors.textMuted} />}
                  </View>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function formatPaceFromSec(secondsPerMile: number): string {
  const min = Math.floor(secondsPerMile / 60);
  const sec = Math.round(secondsPerMile % 60);
  return `${min}:${String(sec).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 12,
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  typeChipText: {
    fontSize: 10,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 1,
  },
  repLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.6,
  },
  ringWrap: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ringInner: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownText: {
    fontSize: 48,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -1.5,
    lineHeight: 52,
  },
  countdownSub: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  segmentLabel: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  targetPace: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
    marginTop: -6,
  },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    width: '100%',
  },
  nextLeft: {
    flex: 1,
    gap: 2,
  },
  nextLabel: {
    fontSize: 9,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.8,
  },
  nextSegmentLabel: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
  },
  nextDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  skipButtonText: {
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
  },
  // Workout-wide progress
  workoutProgressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  workoutProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  workoutProgressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  workoutProgressLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.8,
  },
  workoutProgressLink: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.3,
  },
  // Complete state
  completeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  completeTitle: {
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
  },
  completeSub: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
  },
  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.2,
  },
  segmentListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 3,
  },
  segmentListDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  segmentListLabel: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
  },
  segmentListType: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
    marginTop: 1,
  },
});
