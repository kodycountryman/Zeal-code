import React, { forwardRef, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PlatformIcon } from '@/components/PlatformIcon';
import { RunLog, METERS_PER_MILE, METERS_PER_KM, RoutePoint } from '@/types/run';
import { formatPace, paceToSecondsPerMile, paceToSecondsPerKm } from '@/services/runTrackingService';

// Phase 9: real-map background. Lazy-load react-native-maps so the bundle
// still loads in Expo Go (where we fall back to the SVG-only renderer).
function loadMaps(): any {
  try { return require('react-native-maps'); }
  catch { return null; }
}

// Dark map style matching the share-card aesthetic. Used for Google Maps
// (Android). Apple Maps on iOS will follow the system dark mode.
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0f0f0f' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0f0f0f' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9aa0a6' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a2a' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0f0f0f' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3a3a3a' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a1a2a' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#445566' }] },
];

export type ShareCardFormat = 'square' | 'story';

interface Props {
  log: RunLog;
  format: ShareCardFormat;
  /** Accent color driving the gradient + route line. */
  accent?: string;
  /** Whether to render the SVG route path. Defaults to true. */
  showRoute?: boolean;
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
const ShareCard = forwardRef<View, Props>(({ log, format, accent = '#f87116', showRoute = true }, ref) => {
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

        {/* Route — Phase 9: real map tiles when available, SVG fallback otherwise */}
        {showRoute && log.route.length >= 2 && (
          <View style={[styles.routeWrap, { width: routeAreaW, height: routeAreaH }]}>
            <RouteMapBackground route={log.route} width={routeAreaW} height={routeAreaH} accent={accent} />
            {/* SVG fallback only used when MapView isn't available */}
            {!hasMapsModule() && routePath && (
              <RoutePathRenderer path={routePath} width={routeAreaW} height={routeAreaH} color={accent} />
            )}
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

// ─── Route renderers ────────────────────────────────────────────────────
// SVG fallback (Expo Go / no native maps): just the polyline on the gradient.
// MapView (dev build): real map tiles with the route overlaid as a Polyline.
// Both kept in the same file so view-shot captures them as part of the card.

import Svg, { Path } from 'react-native-svg';

function RoutePathRenderer({ path, width, height, color }: { path: string; width: number; height: number; color: string }) {
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
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

// Module-level cached load — avoids re-requiring on every render.
let _cachedMaps: any = undefined;
function getMapsModule(): any {
  if (_cachedMaps === undefined) _cachedMaps = loadMaps();
  return _cachedMaps;
}
function hasMapsModule(): boolean {
  return getMapsModule() !== null;
}

/**
 * Real-map background for the share card. Renders a MapView framed to the
 * route's bounding box with the route as a Polyline overlay. The map is
 * mounted alongside the rest of the card so view-shot captures it; the
 * off-screen ShareCard render in RunSummary keeps the map mounted from the
 * moment the summary opens, giving tiles plenty of time to load before
 * the user taps Share.
 */
function RouteMapBackground({
  route,
  width,
  height,
  accent,
}: {
  route: RoutePoint[];
  width: number;
  height: number;
  accent: string;
}) {
  const Maps = getMapsModule();
  if (!Maps || route.length < 2) return null;
  const { default: MapView, Polyline, PROVIDER_GOOGLE } = Maps;

  // Region computed to fit the entire route with a little padding
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const p of route) {
    if (p.latitude < minLat) minLat = p.latitude;
    if (p.latitude > maxLat) maxLat = p.latitude;
    if (p.longitude < minLon) minLon = p.longitude;
    if (p.longitude > maxLon) maxLon = p.longitude;
  }
  const latDelta = Math.max((maxLat - minLat) * 1.4, 0.002);
  const lonDelta = Math.max((maxLon - minLon) * 1.4, 0.002);
  const region = {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: latDelta,
    longitudeDelta: lonDelta,
  };

  const polylineCoords = route.map(p => ({ latitude: p.latitude, longitude: p.longitude }));

  return (
    <View style={[StyleSheet.absoluteFill, { width, height, overflow: 'hidden', borderRadius: 12 }]}>
      <MapView
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={region}
        // Snapshot-friendly: disable any UI chrome
        scrollEnabled={false}
        zoomEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        showsCompass={false}
        showsScale={false}
        showsMyLocationButton={false}
        showsUserLocation={false}
        showsTraffic={false}
        showsBuildings
        toolbarEnabled={false}
        loadingEnabled
        loadingBackgroundColor="#0f0f0f"
        customMapStyle={Platform.OS === 'android' ? DARK_MAP_STYLE : undefined}
        userInterfaceStyle="dark"
      >
        <Polyline
          coordinates={polylineCoords}
          strokeColor={accent}
          strokeWidth={4}
          lineCap="round"
          lineJoin="round"
        />
      </MapView>
      {/* Subtle overlay tint so the stats overlay stays legible */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: 'rgba(15,15,15,0.10)' },
        ]}
      />
    </View>
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
