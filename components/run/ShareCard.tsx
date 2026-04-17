import React, { forwardRef, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PlatformIcon } from '@/components/PlatformIcon';
import { RunLog, METERS_PER_MILE, METERS_PER_KM } from '@/types/run';
import { formatPace, paceToSecondsPerMile, paceToSecondsPerKm } from '@/services/runTrackingService';

export type ShareCardFormat = 'square' | 'story';

interface Props {
  log: RunLog;
  format: ShareCardFormat;
  /** Accent color driving the gradient + route line. */
  accent?: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function formatDistance(meters: number, units: 'imperial' | 'metric'): string {
  if (units === 'metric') return `${(meters / METERS_PER_KM).toFixed(2)}`;
  return `${(meters / METERS_PER_MILE).toFixed(2)}`;
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

/**
 * Build a normalized SVG path for the route polyline scaled to fit into the
 * card's route-preview area. Returns the path data plus the bounding box used
 * for sizing, or null if the route is too short.
 */
function buildNormalizedRoutePath(log: RunLog, targetW: number, targetH: number): string | null {
  if (log.route.length < 2) return null;
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const p of log.route) {
    if (p.latitude < minLat) minLat = p.latitude;
    if (p.latitude > maxLat) maxLat = p.latitude;
    if (p.longitude < minLon) minLon = p.longitude;
    if (p.longitude > maxLon) maxLon = p.longitude;
  }
  const latRange = maxLat - minLat;
  const lonRange = maxLon - minLon;
  if (latRange === 0 && lonRange === 0) return null;

  // Preserve aspect ratio via the larger of the two dimensions
  const scale = Math.min(
    targetW / Math.max(lonRange, 0.0001),
    targetH / Math.max(latRange, 0.0001),
  ) * 0.85;

  const offsetX = (targetW - lonRange * scale) / 2;
  const offsetY = (targetH - latRange * scale) / 2;

  return log.route
    .map((p, i) => {
      // Longitude → X, Latitude → Y (flipped because screen Y grows downward)
      const x = offsetX + (p.longitude - minLon) * scale;
      const y = offsetY + (maxLat - p.latitude) * scale;
      const cmd = i === 0 ? 'M' : 'L';
      return `${cmd} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

/**
 * Shareable run summary card. The ref is used by react-native-view-shot to
 * capture the rendered JSX as a PNG for the native share sheet.
 */
const ShareCard = forwardRef<View, Props>(({ log, format, accent = '#f87116' }, ref) => {
  const baseWidth = format === 'story' ? 360 : 360;
  const baseHeight = format === 'story' ? 640 : 360;

  const distance = useMemo(() => formatDistance(log.distanceMeters, log.splitUnit), [log]);
  const distanceUnit = log.splitUnit === 'metric' ? 'km' : 'mi';
  const time = useMemo(() => formatDuration(log.durationSeconds), [log]);
  const pace = useMemo(() => formatPaceForUnit(log.averagePaceSecondsPerMeter, log.splitUnit), [log]);
  const paceUnit = log.splitUnit === 'metric' ? '/km' : '/mi';

  const dateLabel = useMemo(() => {
    const d = new Date(log.startTime);
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }, [log]);

  // Route path sized for the card
  const routeAreaW = baseWidth - 48;
  const routeAreaH = format === 'story' ? 240 : 140;
  const routePath = useMemo(() => buildNormalizedRoutePath(log, routeAreaW, routeAreaH), [log, routeAreaW, routeAreaH]);

  return (
    <View
      ref={ref}
      collapsable={false}
      style={[
        styles.card,
        {
          width: baseWidth,
          height: baseHeight,
        },
      ]}
    >
      <LinearGradient
        colors={['#0f0f0f', '#1a1a1a', '#0a0a0a']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Accent glow */}
      <View
        style={[
          styles.glow,
          {
            backgroundColor: accent,
            width: baseWidth * 1.2,
            height: baseWidth * 1.2,
            top: -baseWidth * 0.55,
            left: -baseWidth * 0.1,
            borderRadius: baseWidth * 0.6,
          },
        ]}
      />

      <View style={[styles.cardInner, format === 'story' && styles.cardInnerStory]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerBadge}>
            <PlatformIcon name="figure-run" size={14} color={accent} />
            <Text style={[styles.headerBadgeText, { color: accent }]}>RUN</Text>
          </View>
          <Text style={styles.dateLabel}>{dateLabel}</Text>
        </View>

        {/* Hero distance */}
        <View style={[styles.hero, format === 'story' && { marginTop: 12 }]}>
          <Text style={styles.heroValue}>{distance}</Text>
          <Text style={styles.heroUnit}>{distanceUnit}</Text>
        </View>

        {/* Route */}
        {routePath && (
          <View style={[styles.routeWrap, { width: routeAreaW, height: routeAreaH }]}>
            <RoutePathRenderer path={routePath} width={routeAreaW} height={routeAreaH} color={accent} />
          </View>
        )}

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: accent }]}>{time}</Text>
            <Text style={styles.statLabel}>TIME</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: accent }]}>{pace}<Text style={styles.statValueSuffix}>{paceUnit}</Text></Text>
            <Text style={styles.statLabel}>PACE</Text>
          </View>
          {(log.calories ?? 0) > 0 && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: accent }]}>{log.calories}</Text>
                <Text style={styles.statLabel}>CAL</Text>
              </View>
            </>
          )}
        </View>

        {/* Branding footer */}
        <View style={styles.footer}>
          <Text style={styles.wordmark}>zeal</Text>
          <Text style={[styles.wordmarkPlus, { color: accent }]}>+</Text>
        </View>
      </View>
    </View>
  );
});

ShareCard.displayName = 'ShareCard';

export default ShareCard;

// ─── Inline SVG route renderer ──────────────────────────────────────────
// Kept in the same file to ensure view-shot captures it as part of the card.

import Svg, { Path } from 'react-native-svg';

function RoutePathRenderer({ path, width, height, color }: { path: string; width: number; height: number; color: string }) {
  return (
    <Svg width={width} height={height}>
      <Path
        d={path}
        stroke={color}
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#0a0a0a',
    position: 'relative',
  },
  glow: {
    position: 'absolute',
    opacity: 0.25,
  },
  cardInner: {
    flex: 1,
    padding: 24,
    gap: 16,
  },
  cardInnerStory: {
    paddingVertical: 40,
    gap: 24,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  headerBadgeText: {
    fontSize: 10,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: 1.2,
  },
  dateLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
    letterSpacing: 0.3,
    color: 'rgba(255,255,255,0.55)',
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  heroValue: {
    fontSize: 72,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -3,
    color: '#fff',
    lineHeight: 74,
  },
  heroUnit: {
    fontSize: 22,
    fontFamily: 'Outfit_600SemiBold',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: -0.3,
  },
  routeWrap: {
    alignSelf: 'center',
    marginVertical: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 14,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 22,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.5,
  },
  statValueSuffix: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
    color: 'rgba(255,255,255,0.55)',
  },
  statLabel: {
    fontSize: 9,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.5)',
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginTop: 'auto',
  },
  wordmark: {
    fontSize: 28,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -1,
    color: '#fff',
  },
  wordmarkPlus: {
    fontSize: 28,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -1,
  },
});
