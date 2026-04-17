import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useZealTheme } from '@/context/AppContext';
import { PlatformIcon } from '@/components/PlatformIcon';
import { formatPace, paceToSecondsPerMile, paceToSecondsPerKm } from '@/services/runTrackingService';
import { METERS_PER_MILE, METERS_PER_KM, RunUnits } from '@/types/run';

interface Props {
  units: RunUnits;
  elapsedSeconds: number;
  distanceMeters: number;
  currentPaceSecondsPerMeter: number | null;
  averagePaceSecondsPerMeter: number | null;
  elevationGainMeters: number;
  heartRate?: number | null;
  splitCount: number;
  /** Target pace (seconds per meter). When provided, current pace is color-coded green/yellow/red. */
  targetPaceSecondsPerMeter?: number | null;
  isPaused?: boolean;
  isCompact?: boolean;
}

function formatDuration(totalSeconds: number): string {
  if (!isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const hrs = Math.floor(totalSeconds / 3600);
  const min = Math.floor((totalSeconds % 3600) / 60);
  const sec = Math.floor(totalSeconds % 60);
  if (hrs > 0) {
    return `${hrs}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${min}:${String(sec).padStart(2, '0')}`;
}

function formatDistance(meters: number, units: RunUnits): { value: string; unit: string } {
  if (units === 'metric') {
    const km = meters / METERS_PER_KM;
    return { value: km.toFixed(2), unit: 'km' };
  }
  const mi = meters / METERS_PER_MILE;
  return { value: mi.toFixed(2), unit: 'mi' };
}

function formatPaceDisplay(secondsPerMeter: number | null, units: RunUnits): string {
  if (secondsPerMeter === null) return '—:—';
  const secondsPerUnit = units === 'metric'
    ? paceToSecondsPerKm(secondsPerMeter)
    : paceToSecondsPerMile(secondsPerMeter);
  return formatPace(secondsPerUnit);
}

function formatElevation(meters: number, units: RunUnits): { value: string; unit: string } {
  if (units === 'metric') {
    return { value: String(Math.round(meters)), unit: 'm' };
  }
  const ft = meters * 3.28084;
  return { value: String(Math.round(ft)), unit: 'ft' };
}

export default function RunMetrics({
  units,
  elapsedSeconds,
  distanceMeters,
  currentPaceSecondsPerMeter,
  averagePaceSecondsPerMeter,
  elevationGainMeters,
  heartRate,
  splitCount,
  targetPaceSecondsPerMeter,
  isPaused = false,
  isCompact = false,
}: Props) {
  const { colors, accent, isDark } = useZealTheme();

  const distance = useMemo(() => formatDistance(distanceMeters, units), [distanceMeters, units]);
  const elevation = useMemo(() => formatElevation(elevationGainMeters, units), [elevationGainMeters, units]);
  const currentPace = useMemo(() => formatPaceDisplay(currentPaceSecondsPerMeter, units), [currentPaceSecondsPerMeter, units]);
  const avgPace = useMemo(() => formatPaceDisplay(averagePaceSecondsPerMeter, units), [averagePaceSecondsPerMeter, units]);

  // Pace color coding vs target
  const paceColor = useMemo(() => {
    if (!targetPaceSecondsPerMeter || !currentPaceSecondsPerMeter) return colors.text;
    const diff = currentPaceSecondsPerMeter - targetPaceSecondsPerMeter;
    // Lower seconds/meter = faster. diff > 0 means slower than target.
    const percentDiff = (diff / targetPaceSecondsPerMeter) * 100;
    if (percentDiff < -3) return '#22c55e'; // ahead of pace
    if (percentDiff < 5) return '#eab308';  // on pace (within 5%)
    return '#ef4444';                        // behind pace
  }, [currentPaceSecondsPerMeter, targetPaceSecondsPerMeter, colors.text]);

  const tileBg = isDark ? 'rgba(38,38,38,0.55)' : 'rgba(255,255,255,0.55)';
  const tileBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';

  if (isCompact) {
    return (
      <View style={styles.compactRow}>
        <View style={styles.compactItem}>
          <Text style={[styles.compactValue, { color: colors.text }]}>{formatDuration(elapsedSeconds)}</Text>
          <Text style={[styles.compactLabel, { color: colors.textMuted }]}>TIME</Text>
        </View>
        <View style={styles.compactDivider} />
        <View style={styles.compactItem}>
          <Text style={[styles.compactValue, { color: colors.text }]}>
            {distance.value}
            <Text style={[styles.compactUnit, { color: colors.textMuted }]}> {distance.unit}</Text>
          </Text>
          <Text style={[styles.compactLabel, { color: colors.textMuted }]}>DISTANCE</Text>
        </View>
        <View style={styles.compactDivider} />
        <View style={styles.compactItem}>
          <Text style={[styles.compactValue, { color: paceColor }]}>{currentPace}</Text>
          <Text style={[styles.compactLabel, { color: colors.textMuted }]}>PACE</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Hero — total time */}
      <View
        style={[styles.heroTile, { backgroundColor: tileBg, borderColor: tileBorder, opacity: isPaused ? 0.55 : 1 }]}
        accessible
        accessibilityRole="text"
        accessibilityLabel={`${isPaused ? 'Paused' : 'Elapsed time'}: ${formatDuration(elapsedSeconds)}`}
      >
        <Text style={[styles.heroLabel, { color: colors.textMuted }]} accessibilityElementsHidden importantForAccessibility="no">{isPaused ? 'PAUSED' : 'TIME'}</Text>
        <Text style={[styles.heroValue, { color: isPaused ? colors.textSecondary : colors.text }]} numberOfLines={1} adjustsFontSizeToFit accessibilityElementsHidden importantForAccessibility="no">
          {formatDuration(elapsedSeconds)}
        </Text>
      </View>

      {/* Pace + Distance row */}
      <View style={styles.row}>
        <View
          style={[styles.tile, { backgroundColor: tileBg, borderColor: tileBorder }]}
          accessible
          accessibilityRole="text"
          accessibilityLabel={`Current pace ${currentPace} per ${units === 'metric' ? 'kilometer' : 'mile'}, average ${avgPace}`}
        >
          <Text style={[styles.tileLabel, { color: colors.textMuted }]}>PACE</Text>
          <View style={styles.tileValueRow}>
            <Text style={[styles.tileValue, { color: paceColor }]}>{currentPace}</Text>
          </View>
          <Text style={[styles.tileSubLabel, { color: colors.textMuted }]}>
            avg {avgPace} /{units === 'metric' ? 'km' : 'mi'}
          </Text>
        </View>
        <View
          style={[styles.tile, { backgroundColor: tileBg, borderColor: tileBorder }]}
          accessible
          accessibilityRole="text"
          accessibilityLabel={`Distance ${distance.value} ${distance.unit === 'km' ? 'kilometers' : 'miles'}, ${splitCount} ${splitCount === 1 ? 'split' : 'splits'}`}
        >
          <Text style={[styles.tileLabel, { color: colors.textMuted }]}>DISTANCE</Text>
          <View style={styles.tileValueRow}>
            <Text style={[styles.tileValue, { color: colors.text }]}>{distance.value}</Text>
            <Text style={[styles.tileUnit, { color: colors.textMuted }]}>{distance.unit}</Text>
          </View>
          <Text style={[styles.tileSubLabel, { color: colors.textMuted }]}>{splitCount} {splitCount === 1 ? 'split' : 'splits'}</Text>
        </View>
      </View>

      {/* HR + Elevation row */}
      <View style={styles.row}>
        <View
          style={[styles.tile, { backgroundColor: tileBg, borderColor: tileBorder }]}
          accessible
          accessibilityRole="text"
          accessibilityLabel={heartRate ? `Heart rate ${heartRate} beats per minute` : 'Heart rate unavailable'}
        >
          <View style={styles.tileLabelRow}>
            <PlatformIcon name="heart" size={11} color="#ef4444" />
            <Text style={[styles.tileLabel, { color: colors.textMuted }]}>HEART RATE</Text>
          </View>
          <View style={styles.tileValueRow}>
            <Text style={[styles.tileValue, { color: heartRate ? colors.text : colors.textMuted }]}>
              {heartRate ?? '—'}
            </Text>
            <Text style={[styles.tileUnit, { color: colors.textMuted }]}>bpm</Text>
          </View>
        </View>
        <View
          style={[styles.tile, { backgroundColor: tileBg, borderColor: tileBorder }]}
          accessible
          accessibilityRole="text"
          accessibilityLabel={`Elevation gain ${elevation.value} ${elevation.unit === 'm' ? 'meters' : 'feet'}`}
        >
          <View style={styles.tileLabelRow}>
            <PlatformIcon name="mountain" size={11} color={accent} />
            <Text style={[styles.tileLabel, { color: colors.textMuted }]}>ELEVATION</Text>
          </View>
          <View style={styles.tileValueRow}>
            <Text style={[styles.tileValue, { color: colors.text }]}>{elevation.value}</Text>
            <Text style={[styles.tileUnit, { color: colors.textMuted }]}>{elevation.unit}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  heroTile: {
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: 22,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 4,
  },
  heroLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 1.2,
  },
  heroValue: {
    fontSize: 64,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -2,
    lineHeight: 70,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  tile: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 4,
  },
  tileLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tileLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.8,
  },
  tileValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  tileValue: {
    fontSize: 28,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -1,
    lineHeight: 32,
  },
  tileUnit: {
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
  },
  tileSubLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_400Regular',
    marginTop: 2,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  compactItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  compactValue: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.5,
  },
  compactUnit: {
    fontSize: 11,
    fontFamily: 'Outfit_400Regular',
  },
  compactLabel: {
    fontSize: 9,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.5,
  },
  compactDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: 'rgba(128,128,128,0.25)',
  },
});
