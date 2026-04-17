import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme } from '@/context/AppContext';
import { RoutePoint, Split, RunUnits, METERS_PER_MILE, METERS_PER_KM } from '@/types/run';

function loadMaps(): any {
  try {
    return require('react-native-maps');
  } catch {
    return null;
  }
}

interface Props {
  route: RoutePoint[];
  splits: Split[];
  units: RunUnits;
  height?: number;
}

/**
 * Convert pace (sec/m) to a color along a green→yellow→red gradient.
 * Faster than median = green, ~median = yellow, slower than median = red.
 */
function paceToColor(paceSecondsPerMeter: number, medianPace: number): string {
  if (paceSecondsPerMeter <= 0 || !isFinite(paceSecondsPerMeter)) return '#888888';
  const ratio = paceSecondsPerMeter / medianPace;
  // ratio < 0.9 → green, 0.9–1.1 → yellow, > 1.1 → red
  if (ratio < 0.9) return '#22c55e';
  if (ratio < 1.05) return '#84cc16';
  if (ratio < 1.15) return '#eab308';
  if (ratio < 1.3) return '#f97316';
  return '#ef4444';
}

/**
 * Calculate the bounding region of the route for initial camera fit.
 */
function computeRegion(route: RoutePoint[]) {
  if (route.length === 0) return null;
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const p of route) {
    if (p.latitude < minLat) minLat = p.latitude;
    if (p.latitude > maxLat) maxLat = p.latitude;
    if (p.longitude < minLon) minLon = p.longitude;
    if (p.longitude > maxLon) maxLon = p.longitude;
  }
  const latPadding = Math.max(0.001, (maxLat - minLat) * 0.25);
  const lonPadding = Math.max(0.001, (maxLon - minLon) * 0.25);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: (maxLat - minLat) + latPadding * 2,
    longitudeDelta: (maxLon - minLon) + lonPadding * 2,
  };
}

/**
 * Find the route point indices closest to each mile/km marker.
 */
function findMileMarkers(route: RoutePoint[], units: RunUnits): { coordinate: { latitude: number; longitude: number }; label: string }[] {
  if (route.length < 2) return [];
  const target = units === 'metric' ? METERS_PER_KM : METERS_PER_MILE;
  const markers: { coordinate: { latitude: number; longitude: number }; label: string }[] = [];

  let cumDistance = 0;
  let nextMarkerAt = target;
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
    const segmentDist = 6371000 * c;
    cumDistance += segmentDist;

    while (cumDistance >= nextMarkerAt && segmentDist > 0) {
      // Interpolate the marker position within this segment
      const overshoot = cumDistance - nextMarkerAt;
      const t = 1 - overshoot / segmentDist;
      const lat = a.latitude + (b.latitude - a.latitude) * t;
      const lon = a.longitude + (b.longitude - a.longitude) * t;
      const markerNum = Math.round(nextMarkerAt / target);
      markers.push({
        coordinate: { latitude: lat, longitude: lon },
        label: String(markerNum),
      });
      nextMarkerAt += target;
    }
  }
  return markers;
}

export default function RouteReview({ route, splits, units, height = 240 }: Props) {
  const { colors, accent, isDark } = useZealTheme();
  const Maps = useMemo(() => loadMaps(), []);
  const mapRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);

  const region = useMemo(() => computeRegion(route), [route]);

  // Build pace-colored polyline segments. We chunk the route into ~25 segments
  // and color each by its average pace.
  const polylineSegments = useMemo(() => {
    if (route.length < 4) {
      return route.length >= 2
        ? [{ coords: route.map(p => ({ latitude: p.latitude, longitude: p.longitude })), color: accent }]
        : [];
    }
    const SEGMENT_COUNT = Math.min(25, Math.floor(route.length / 4));
    const chunkSize = Math.floor(route.length / SEGMENT_COUNT);
    if (chunkSize < 2) {
      return [{ coords: route.map(p => ({ latitude: p.latitude, longitude: p.longitude })), color: accent }];
    }
    // Compute median pace from route segments
    const allPaces: number[] = [];
    for (let i = 1; i < route.length; i++) {
      const p = route[i].pace;
      if (p !== null && p > 0 && isFinite(p)) allPaces.push(p);
    }
    if (allPaces.length === 0) {
      return [{ coords: route.map(p => ({ latitude: p.latitude, longitude: p.longitude })), color: accent }];
    }
    const sortedPaces = [...allPaces].sort((a, b) => a - b);
    const medianPace = sortedPaces[Math.floor(sortedPaces.length / 2)];

    const segments: { coords: { latitude: number; longitude: number }[]; color: string }[] = [];
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const start = i * chunkSize;
      const end = i === SEGMENT_COUNT - 1 ? route.length : (i + 1) * chunkSize + 1;
      const chunk = route.slice(start, end);
      if (chunk.length < 2) continue;
      // Average pace within this chunk
      let sum = 0;
      let count = 0;
      for (const p of chunk) {
        if (p.pace !== null && p.pace > 0 && isFinite(p.pace)) {
          sum += p.pace;
          count++;
        }
      }
      const avgPace = count > 0 ? sum / count : medianPace;
      const color = paceToColor(avgPace, medianPace);
      segments.push({
        coords: chunk.map(p => ({ latitude: p.latitude, longitude: p.longitude })),
        color,
      });
    }
    return segments;
  }, [route, accent]);

  const mileMarkers = useMemo(() => findMileMarkers(route, units), [route, units]);

  const firstPoint = route[0] ?? null;
  const lastPoint = route.length > 1 ? route[route.length - 1] : null;

  // Fit map to route bounds when ready
  useEffect(() => {
    if (!Maps || !mapReady || !mapRef.current || route.length < 2) return;
    try {
      const coords = route.map(p => ({ latitude: p.latitude, longitude: p.longitude }));
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
        animated: true,
      });
    } catch {
      // ignore
    }
  }, [Maps, mapReady, route]);

  // ─── Fallback ──────────────────────────────────────────────────────────
  if (!Maps) {
    return (
      <View style={[
        styles.container,
        styles.fallback,
        { height, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', borderColor: colors.border },
      ]}>
        <PlatformIcon name="compass" size={28} color={colors.textMuted} />
        <Text style={[styles.fallbackText, { color: colors.textMuted }]}>
          Route map requires a development build
        </Text>
        {route.length > 0 && (
          <Text style={[styles.fallbackSub, { color: colors.textMuted }]}>
            {route.length} GPS points · {splits.length} {splits.length === 1 ? 'split' : 'splits'}
          </Text>
        )}
      </View>
    );
  }

  if (route.length < 2 || !region) {
    return (
      <View style={[styles.container, styles.fallback, { height, borderColor: colors.border }]}>
        <Text style={[styles.fallbackText, { color: colors.textMuted }]}>No route data</Text>
      </View>
    );
  }

  const { default: MapView, Polyline, Marker, PROVIDER_GOOGLE } = Maps;

  return (
    <View style={[styles.container, { height, borderColor: colors.border }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={region}
        showsCompass={false}
        showsScale={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        loadingEnabled
        loadingBackgroundColor={isDark ? '#1a1a1a' : '#f5f5f5'}
        scrollEnabled
        zoomEnabled
        pitchEnabled={false}
        rotateEnabled={false}
        onMapReady={() => setMapReady(true)}
      >
        {polylineSegments.map((seg, i) => (
          <Polyline
            key={i}
            coordinates={seg.coords}
            strokeColor={seg.color}
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        ))}

        {firstPoint && (
          <Marker
            coordinate={{ latitude: firstPoint.latitude, longitude: firstPoint.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={[styles.endpointMarker, { backgroundColor: '#22c55e' }]} />
          </Marker>
        )}

        {lastPoint && (
          <Marker
            coordinate={{ latitude: lastPoint.latitude, longitude: lastPoint.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={[styles.endpointMarker, { backgroundColor: '#ef4444' }]} />
          </Marker>
        )}

        {mileMarkers.map((m, i) => (
          <Marker
            key={`mile-${i}`}
            coordinate={m.coordinate}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={[styles.mileMarker, { backgroundColor: isDark ? '#1a1a1a' : '#fff', borderColor: accent }]}>
              <Text style={[styles.mileMarkerText, { color: accent }]}>{m.label}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Pace gradient legend */}
      <View style={[styles.legend, { backgroundColor: isDark ? 'rgba(20,20,20,0.85)' : 'rgba(255,255,255,0.85)', borderColor: colors.border }]}>
        <View style={[styles.legendDot, { backgroundColor: '#22c55e' }]} />
        <Text style={[styles.legendText, { color: colors.textSecondary }]}>fast</Text>
        <View style={[styles.legendDot, { backgroundColor: '#eab308' }]} />
        <Text style={[styles.legendText, { color: colors.textSecondary }]}>avg</Text>
        <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
        <Text style={[styles.legendText, { color: colors.textSecondary }]}>slow</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 14,
  },
  fallbackText: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
    textAlign: 'center',
  },
  fallbackSub: {
    fontSize: 11,
    fontFamily: 'Outfit_400Regular',
  },
  endpointMarker: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
  },
  mileMarker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mileMarkerText: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
  },
  legend: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendText: {
    fontSize: 9,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.3,
    marginRight: 4,
  },
});
