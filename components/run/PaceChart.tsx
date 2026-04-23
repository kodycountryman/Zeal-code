import React, { useMemo, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useZealTheme } from '@/context/AppContext';
import { RoutePoint, RunUnits } from '@/types/run';
import { paceToSecondsPerMile, paceToSecondsPerKm, formatPace } from '@/services/runTrackingService';

interface Props {
  route: RoutePoint[];
  units: RunUnits;
  /** Optional average pace line overlay (sec/meter). */
  averagePaceSecondsPerMeter?: number | null;
  height?: number;
}

interface CursorInfo {
  /** Screen-space X offset relative to chartBox left edge, clamped to chart range. */
  screenX: number;
  /** Formatted pace string e.g. "5:32/km" */
  paceStr: string;
  /** Formatted elapsed time e.g. "12:45" */
  elapsedStr: string;
}

/** Rolling average over pace values to reduce GPS-jitter spikes. */
function smoothPaces(paces: (number | null)[], window = 7): number[] {
  const cleaned = paces.map(p => (p === null || !isFinite(p) || p <= 0 ? NaN : p));
  const smoothed: number[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const start = Math.max(0, i - Math.floor(window / 2));
    const end = Math.min(cleaned.length, i + Math.ceil(window / 2));
    let sum = 0;
    let count = 0;
    for (let j = start; j < end; j++) {
      if (!isNaN(cleaned[j])) {
        sum += cleaned[j];
        count++;
      }
    }
    smoothed.push(count > 0 ? sum / count : NaN);
  }
  return smoothed;
}

export default function PaceChart({ route, units, averagePaceSecondsPerMeter, height = 120 }: Props) {
  const { colors, accent, isDark } = useZealTheme();

  const [cursorInfo, setCursorInfo] = useState<CursorInfo | null>(null);
  const chartWidthRef = useRef(0);

  const data = useMemo(() => {
    if (route.length < 3) return null;

    const paces = route.map(p => p.pace);
    const smoothed = smoothPaces(paces, 7);
    const validIndices: number[] = [];
    const validPaces: number[] = [];
    for (let i = 0; i < smoothed.length; i++) {
      if (!isNaN(smoothed[i])) {
        validIndices.push(i);
        validPaces.push(smoothed[i]);
      }
    }
    if (validPaces.length < 3) return null;

    // Clamp outliers — anything slower than 2x median gets pulled in
    const sorted = [...validPaces].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const max = Math.min(median * 2, sorted[sorted.length - 1]);
    const min = Math.max(median * 0.5, sorted[0]);

    return { smoothed, validIndices, validPaces, min, max, median };
  }, [route]);

  const emptyBorderColor = colors.border;

  if (!data) {
    return (
      <View style={[styles.empty, { height, borderColor: emptyBorderColor }]}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>Pace data unavailable</Text>
      </View>
    );
  }

  const PADDING_X = 8;
  const PADDING_Y = 8;
  const VIEW_W = 320;
  const VIEW_H = height;
  const CHART_W = VIEW_W - PADDING_X * 2;
  const CHART_H = VIEW_H - PADDING_Y * 2;

  const totalPoints = route.length;
  const { min, max, validIndices, validPaces } = data;
  const range = Math.max(1, max - min);

  // Note: lower seconds-per-meter = faster; Y so slower is at top, faster at bottom
  const points = validPaces.map((p, idx) => {
    const x = PADDING_X + (validIndices[idx] / Math.max(1, totalPoints - 1)) * CHART_W;
    const clamped = Math.min(max, Math.max(min, p));
    const normalizedY = (clamped - min) / range;
    const y = PADDING_Y + normalizedY * CHART_H;
    return { x, y };
  });

  const linePath = points
    .map((pt, i) => (i === 0 ? `M ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}` : `L ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`))
    .join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${VIEW_H - PADDING_Y} L ${points[0].x.toFixed(2)} ${VIEW_H - PADDING_Y} Z`;

  // Average pace reference line
  let avgLineY: number | null = null;
  if (averagePaceSecondsPerMeter && averagePaceSecondsPerMeter >= min && averagePaceSecondsPerMeter <= max) {
    const normalized = (averagePaceSecondsPerMeter - min) / range;
    avgLineY = PADDING_Y + normalized * CHART_H;
  }

  const paceToDisplay = (secPerMeter: number) => {
    const perUnit = units === 'metric' ? paceToSecondsPerKm(secPerMeter) : paceToSecondsPerMile(secPerMeter);
    return formatPace(perUnit);
  };

  const unitSuffix = units === 'metric' ? '/km' : '/mi';

  // ─── Cursor logic ─────────────────────────────────────────────────────
  const computeCursor = useCallback((gestureX: number) => {
    const actualWidth = chartWidthRef.current;
    if (actualWidth <= 0) return;

    // Map screen X → SVG X → data progress
    const svgX = (gestureX / actualWidth) * VIEW_W;
    const progress = Math.min(1, Math.max(0, (svgX - PADDING_X) / CHART_W));
    const routeIdx = Math.round(progress * (totalPoints - 1));
    const clampedRouteIdx = Math.min(routeIdx, route.length - 1);

    // Find closest valid index in smoothed data
    let closestDataIdx = 0;
    let bestDist = Math.abs(validIndices[0] - clampedRouteIdx);
    for (let i = 1; i < validIndices.length; i++) {
      const d = Math.abs(validIndices[i] - clampedRouteIdx);
      if (d < bestDist) { bestDist = d; closestDataIdx = i; }
    }

    const pace = validPaces[closestDataIdx];
    const perUnit = units === 'metric' ? paceToSecondsPerKm(pace) : paceToSecondsPerMile(pace);
    const paceStr = formatPace(perUnit) + unitSuffix;

    // Elapsed time from start of run to this route point
    const elapsedMs = route[clampedRouteIdx].timestamp - route[0].timestamp;
    const elapsedSec = Math.max(0, Math.floor(elapsedMs / 1000));
    const mins = Math.floor(elapsedSec / 60);
    const secs = elapsedSec % 60;
    const elapsedStr = `${mins}:${String(secs).padStart(2, '0')}`;

    // Clamp screen X to chart area
    const paddingScreen = (PADDING_X / VIEW_W) * actualWidth;
    const clampedX = Math.min(actualWidth - paddingScreen, Math.max(paddingScreen, gestureX));

    setCursorInfo({ screenX: clampedX, paceStr, elapsedStr });
  }, [route, totalPoints, validIndices, validPaces, units, unitSuffix, VIEW_W, CHART_W, PADDING_X]);

  const clearCursor = useCallback(() => setCursorInfo(null), []);

  const pan = Gesture.Pan()
    .minDistance(0)
    .activeOffsetX([-4, 4])
    .onStart((e) => { runOnJS(computeCursor)(e.x); })
    .onUpdate((e) => { runOnJS(computeCursor)(e.x); })
    .onEnd(() => { runOnJS(clearCursor)(); })
    .onFinalize(() => { runOnJS(clearCursor)(); });

  const tap = Gesture.Tap()
    .onStart((e) => { runOnJS(computeCursor)(e.x); })
    .onEnd(() => { runOnJS(clearCursor)(); });

  const composed = Gesture.Race(pan, tap);

  // Cursor SVG X (for the SVG line + circle)
  const cursorSvgX = cursorInfo
    ? (cursorInfo.screenX / Math.max(1, chartWidthRef.current)) * VIEW_W
    : null;

  return (
    <View style={styles.container}>
      <GestureDetector gesture={composed}>
        <View
          style={[styles.chartBox, { borderColor: colors.border, height: VIEW_H }]}
          onLayout={(e) => { chartWidthRef.current = e.nativeEvent.layout.width; }}
        >
          <Svg width="100%" height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="paceGradient" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#ef4444" stopOpacity={0.35} />
                <Stop offset="0.5" stopColor={accent} stopOpacity={0.25} />
                <Stop offset="1" stopColor="#22c55e" stopOpacity={0.35} />
              </LinearGradient>
            </Defs>
            <Path d={areaPath} fill="url(#paceGradient)" />
            <Path d={linePath} stroke={accent} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {avgLineY !== null && !cursorInfo && (
              <Line
                x1={PADDING_X}
                x2={VIEW_W - PADDING_X}
                y1={avgLineY}
                y2={avgLineY}
                stroke={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            )}
            {/* Cursor line */}
            {cursorSvgX !== null && (
              <>
                <Line
                  x1={cursorSvgX}
                  x2={cursorSvgX}
                  y1={PADDING_Y}
                  y2={VIEW_H - PADDING_Y}
                  stroke="rgba(255,255,255,0.6)"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                />
                <Circle
                  cx={cursorSvgX}
                  cy={VIEW_H / 2}
                  r={4}
                  fill="#fff"
                  opacity={0.8}
                />
              </>
            )}
          </Svg>

          {/* Axis labels — hide when cursor active */}
          {!cursorInfo && (
            <>
              <Text style={[styles.axisLabel, styles.axisLabelTop, { color: colors.textMuted }]}>
                {paceToDisplay(max)}{unitSuffix}
              </Text>
              <Text style={[styles.axisLabel, styles.axisLabelBottom, { color: colors.textMuted }]}>
                {paceToDisplay(min)}{unitSuffix}
              </Text>
              {averagePaceSecondsPerMeter && avgLineY !== null && (
                <Text style={[styles.axisLabel, { color: accent, top: avgLineY - 14, right: 6 }]}>
                  avg {paceToDisplay(averagePaceSecondsPerMeter)}
                </Text>
              )}
            </>
          )}

          {/* Cursor tooltip */}
          {cursorInfo && (
            <View
              style={[
                styles.tooltip,
                {
                  left: Math.min(
                    (chartWidthRef.current || 320) - 110,
                    Math.max(0, cursorInfo.screenX - 48),
                  ),
                  backgroundColor: isDark ? 'rgba(28,28,30,0.92)' : 'rgba(255,255,255,0.92)',
                  borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)',
                },
              ]}
            >
              <Text style={[styles.tooltipPace, { color: accent }]}>{cursorInfo.paceStr}</Text>
              <Text style={[styles.tooltipTime, { color: colors.textMuted }]}>{cursorInfo.elapsedStr}</Text>
            </View>
          )}
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
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
  tooltip: {
    position: 'absolute',
    top: 6,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 1,
    minWidth: 96,
    alignItems: 'center',
  },
  tooltipPace: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.2,
  },
  tooltipTime: {
    fontSize: 10,
    fontFamily: 'Outfit_500Medium',
  },
});
