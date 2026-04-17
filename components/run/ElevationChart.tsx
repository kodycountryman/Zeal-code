import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useZealTheme } from '@/context/AppContext';
import { RoutePoint, RunUnits, METERS_PER_MILE, METERS_PER_KM } from '@/types/run';

interface Props {
  route: RoutePoint[];
  units: RunUnits;
  height?: number;
}

/**
 * Apply a rolling-average smoothing window to noisy GPS altitude readings.
 */
function smoothAltitudes(altitudes: number[], window = 5): number[] {
  if (altitudes.length === 0) return [];
  const smoothed: number[] = [];
  for (let i = 0; i < altitudes.length; i++) {
    const start = Math.max(0, i - Math.floor(window / 2));
    const end = Math.min(altitudes.length, i + Math.ceil(window / 2));
    let sum = 0;
    let count = 0;
    for (let j = start; j < end; j++) {
      sum += altitudes[j];
      count++;
    }
    smoothed.push(count > 0 ? sum / count : altitudes[i]);
  }
  return smoothed;
}

/**
 * Compute cumulative distance (meters) at each route point.
 */
function cumulativeDistances(route: RoutePoint[]): number[] {
  if (route.length === 0) return [];
  const distances = [0];
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1];
    const b = route[i];
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const φ1 = toRad(a.latitude);
    const φ2 = toRad(b.latitude);
    const Δφ = toRad(b.latitude - a.latitude);
    const Δλ = toRad(b.longitude - a.longitude);
    const ha = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(ha), Math.sqrt(1 - ha));
    distances.push(distances[i - 1] + 6371000 * c);
  }
  return distances;
}

export default function ElevationChart({ route, units, height = 100 }: Props) {
  const { colors, accent, isDark } = useZealTheme();

  const data = useMemo(() => {
    if (route.length < 2) return null;
    const altitudes: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i < route.length; i++) {
      const alt = route[i].altitude;
      if (alt !== null) {
        altitudes.push(alt);
        indices.push(i);
      }
    }
    if (altitudes.length < 2) return null;

    const smoothed = smoothAltitudes(altitudes, 5);
    const distances = cumulativeDistances(route);
    const subDistances = indices.map(i => distances[i]);
    const totalDistance = subDistances[subDistances.length - 1];
    if (totalDistance < 100) return null; // need at least 100m to draw

    const minAlt = Math.min(...smoothed);
    const maxAlt = Math.max(...smoothed);
    const range = Math.max(1, maxAlt - minAlt);

    return { smoothed, subDistances, totalDistance, minAlt, maxAlt, range };
  }, [route]);

  if (!data) {
    return (
      <View style={[styles.empty, { height, borderColor: colors.border }]}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          Elevation data unavailable
        </Text>
      </View>
    );
  }

  const PADDING_X = 8;
  const PADDING_Y = 6;
  const VIEW_W = 320;
  const VIEW_H = height;
  const CHART_W = VIEW_W - PADDING_X * 2;
  const CHART_H = VIEW_H - PADDING_Y * 2;

  // Generate the SVG path for the elevation line
  const pathPoints = data.smoothed.map((alt, i) => {
    const x = PADDING_X + (data.subDistances[i] / data.totalDistance) * CHART_W;
    const normalizedY = (alt - data.minAlt) / data.range;
    const y = PADDING_Y + (1 - normalizedY) * CHART_H;
    return { x, y };
  });

  // Smooth the path with simple line segments (could upgrade to bezier later)
  const linePath = pathPoints
    .map((p, i) => (i === 0 ? `M ${p.x.toFixed(2)} ${p.y.toFixed(2)}` : `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`))
    .join(' ');

  // Closed area path for gradient fill
  const areaPath = `${linePath} L ${pathPoints[pathPoints.length - 1].x.toFixed(2)} ${VIEW_H - PADDING_Y} L ${pathPoints[0].x.toFixed(2)} ${VIEW_H - PADDING_Y} Z`;

  // Display gain/loss
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < data.smoothed.length; i++) {
    const delta = data.smoothed[i] - data.smoothed[i - 1];
    if (delta > 0) gain += delta;
    else loss += -delta;
  }

  const gainDisplay = units === 'metric' ? `${Math.round(gain)} m` : `${Math.round(gain * 3.28084)} ft`;
  const lossDisplay = units === 'metric' ? `${Math.round(loss)} m` : `${Math.round(loss * 3.28084)} ft`;
  const minAltDisplay = units === 'metric' ? `${Math.round(data.minAlt)} m` : `${Math.round(data.minAlt * 3.28084)} ft`;
  const maxAltDisplay = units === 'metric' ? `${Math.round(data.maxAlt)} m` : `${Math.round(data.maxAlt * 3.28084)} ft`;

  return (
    <View style={styles.container}>
      <View style={[styles.chartBox, { borderColor: colors.border, height: VIEW_H }]}>
        <Svg width="100%" height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="elevGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={accent} stopOpacity={0.45} />
              <Stop offset="1" stopColor={accent} stopOpacity={0.02} />
            </LinearGradient>
          </Defs>
          <Path d={areaPath} fill="url(#elevGradient)" />
          <Path d={linePath} stroke={accent} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        </Svg>

        {/* Min/max axis labels */}
        <Text style={[styles.axisLabel, styles.axisLabelTop, { color: colors.textMuted }]}>{maxAltDisplay}</Text>
        <Text style={[styles.axisLabel, styles.axisLabelBottom, { color: colors.textMuted }]}>{minAltDisplay}</Text>
      </View>

      {/* Gain / Loss summary */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>GAIN</Text>
          <Text style={[styles.statValue, { color: '#22c55e' }]}>+{gainDisplay}</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>LOSS</Text>
          <Text style={[styles.statValue, { color: '#ef4444' }]}>−{lossDisplay}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  chartBox: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  empty: {
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
  },
  axisLabel: {
    position: 'absolute',
    fontSize: 9,
    fontFamily: 'Outfit_500Medium',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  axisLabelTop: {
    top: 4,
    left: 6,
  },
  axisLabelBottom: {
    bottom: 4,
    left: 6,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statLabel: {
    fontSize: 9,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.6,
  },
  statValue: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
  },
});
