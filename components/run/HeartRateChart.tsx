import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle } from 'react-native-svg';
import { useZealTheme } from '@/context/AppContext';
import { Split } from '@/types/run';

interface Props {
  splits: Split[];
  averageHeartRate?: number | null;
  maxHeartRate?: number | null;
  height?: number;
}

/**
 * Heart rate chart — plots average HR per split.
 *
 * We don't currently capture per-point HR samples during a run (Apple Watch
 * live HR streaming would be a future native integration), so this chart is
 * split-granularity. Still useful for spotting trends across a race.
 */
export default function HeartRateChart({
  splits,
  averageHeartRate,
  maxHeartRate,
  height = 110,
}: Props) {
  const { colors, isDark } = useZealTheme();

  const data = useMemo(() => {
    if (!splits || splits.length === 0) return null;
    const points: { splitIdx: number; hr: number }[] = [];
    for (const split of splits) {
      if (typeof split.averageHeartRate === 'number' && split.averageHeartRate > 0) {
        points.push({ splitIdx: split.index, hr: split.averageHeartRate });
      }
    }
    if (points.length < 2) return null;
    const hrs = points.map(p => p.hr);
    const min = Math.max(80, Math.min(...hrs) - 5);
    const max = Math.min(220, Math.max(...hrs) + 5);
    return { points, min, max };
  }, [splits]);

  if (!data) {
    return (
      <View style={[styles.empty, { height, borderColor: colors.border }]}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          {!averageHeartRate
            ? 'No heart rate data for this run'
            : `Average ${averageHeartRate} bpm${maxHeartRate ? ` · Max ${maxHeartRate}` : ''}`}
        </Text>
      </View>
    );
  }

  const PADDING_X = 10;
  const PADDING_Y = 10;
  const VIEW_W = 320;
  const VIEW_H = height;
  const CHART_W = VIEW_W - PADDING_X * 2;
  const CHART_H = VIEW_H - PADDING_Y * 2;

  const { points, min, max } = data;
  const range = Math.max(1, max - min);
  const totalSplits = splits.length;

  const coords = points.map((p) => {
    const x = PADDING_X + ((p.splitIdx - 1) / Math.max(1, totalSplits - 1)) * CHART_W;
    const normalizedY = (p.hr - min) / range;
    const y = PADDING_Y + (1 - normalizedY) * CHART_H;
    return { x, y, hr: p.hr };
  });

  const linePath = coords
    .map((c, i) => (i === 0 ? `M ${c.x.toFixed(2)} ${c.y.toFixed(2)}` : `L ${c.x.toFixed(2)} ${c.y.toFixed(2)}`))
    .join(' ');
  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(2)} ${VIEW_H - PADDING_Y} L ${coords[0].x.toFixed(2)} ${VIEW_H - PADDING_Y} Z`;

  // Average HR reference line
  let avgLineY: number | null = null;
  if (averageHeartRate && averageHeartRate >= min && averageHeartRate <= max) {
    const normalized = (averageHeartRate - min) / range;
    avgLineY = PADDING_Y + (1 - normalized) * CHART_H;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.chartBox, { borderColor: colors.border, height: VIEW_H }]}>
        <Svg width="100%" height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="hrGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#ef4444" stopOpacity={0.35} />
              <Stop offset="1" stopColor="#ef4444" stopOpacity={0.02} />
            </LinearGradient>
          </Defs>
          <Path d={areaPath} fill="url(#hrGradient)" />
          <Path d={linePath} stroke="#ef4444" strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          {avgLineY !== null && (
            <Line
              x1={PADDING_X}
              x2={VIEW_W - PADDING_X}
              y1={avgLineY}
              y2={avgLineY}
              stroke={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          )}
          {coords.map((c, i) => (
            <Circle key={i} cx={c.x} cy={c.y} r={2.5} fill="#ef4444" />
          ))}
        </Svg>

        <Text style={[styles.axisLabel, styles.axisLabelTop, { color: colors.textMuted }]}>{max} bpm</Text>
        <Text style={[styles.axisLabel, styles.axisLabelBottom, { color: colors.textMuted }]}>{min} bpm</Text>
      </View>

      {(averageHeartRate || maxHeartRate) && (
        <View style={styles.statsRow}>
          {averageHeartRate ? (
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>AVG</Text>
              <Text style={[styles.statValue, { color: '#ef4444' }]}>{averageHeartRate}</Text>
            </View>
          ) : null}
          {averageHeartRate && maxHeartRate ? (
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          ) : null}
          {maxHeartRate ? (
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>MAX</Text>
              <Text style={[styles.statValue, { color: '#ef4444' }]}>{maxHeartRate}</Text>
            </View>
          ) : null}
        </View>
      )}
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
    padding: 12,
  },
  emptyText: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
    textAlign: 'center',
  },
  axisLabel: {
    position: 'absolute',
    fontSize: 9,
    fontFamily: 'Outfit_600SemiBold',
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
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
  },
});
