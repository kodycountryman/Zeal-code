import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme } from '@/context/AppContext';
import { RoutePoint } from '@/types/run';

// Lazy-load react-native-maps so the screen doesn't crash in Expo Go
function loadMaps(): any {
  try {
    return require('react-native-maps');
  } catch {
    __DEV__ && console.log('[RunMap] react-native-maps not available (Expo Go)');
    return null;
  }
}

// Dark map style matching the app theme
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a1a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#888888' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#aaaaaa' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a2a' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1a1a1a' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#666666' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3a3a3a' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a1a2a' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#445566' }] },
];

interface Props {
  route: RoutePoint[];
  /** Show in compact "minimap" mode with smaller height. */
  compact?: boolean;
  /** When true, the map auto-centers on the latest GPS point as the runner moves. */
  followRunner?: boolean;
  /** Tap handler to expand the map to fullscreen. */
  onExpand?: () => void;
}

export default function RunMap({ route, compact = false, followRunner = true, onExpand }: Props) {
  const { colors, accent, isDark } = useZealTheme();
  const Maps = useMemo(() => loadMaps(), []);
  const mapRef = useRef<any>(null);
  const [userOverrodeFollow, setUserOverrodeFollow] = useState(false);

  const lastPoint = route.length > 0 ? route[route.length - 1] : null;
  const firstPoint = route.length > 0 ? route[0] : null;

  // Auto-follow the runner: animate camera to keep latest point centered
  useEffect(() => {
    if (!Maps || !mapRef.current || !lastPoint) return;
    if (!followRunner || userOverrodeFollow) return;
    try {
      mapRef.current.animateCamera(
        {
          center: { latitude: lastPoint.latitude, longitude: lastPoint.longitude },
        },
        { duration: 600 },
      );
    } catch {
      // animateCamera not always supported on all map providers
    }
  }, [lastPoint, followRunner, userOverrodeFollow, Maps]);

  // ─── Fallback when react-native-maps isn't available (Expo Go) ─────────
  if (!Maps) {
    return (
      <View style={[
        compact ? styles.compactContainer : styles.container,
        styles.fallback,
        { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', borderColor: colors.border },
      ]}>
        <PlatformIcon name="compass" size={compact ? 18 : 28} color={colors.textMuted} />
        <Text style={[styles.fallbackText, { color: colors.textMuted, fontSize: compact ? 10 : 12 }]}>
          {compact ? 'Map unavailable' : 'Map preview requires a development build (not Expo Go)'}
        </Text>
        {route.length > 0 && (
          <Text style={[styles.fallbackPointCount, { color: colors.textMuted, fontSize: compact ? 9 : 11 }]}>
            {route.length} GPS points captured
          </Text>
        )}
      </View>
    );
  }

  const { default: MapView, Polyline, Marker, PROVIDER_GOOGLE } = Maps;

  const initialRegion = firstPoint
    ? {
        latitude: firstPoint.latitude,
        longitude: firstPoint.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }
    : undefined;

  const polylineCoords = route.map(p => ({ latitude: p.latitude, longitude: p.longitude }));

  return (
    <View style={[compact ? styles.compactContainer : styles.container, { borderColor: colors.border }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        // Use Apple Maps on iOS (no API key), Google Maps on Android
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        showsUserLocation={!firstPoint}
        showsCompass={!compact}
        showsScale={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        loadingEnabled
        loadingBackgroundColor={isDark ? '#1a1a1a' : '#f5f5f5'}
        customMapStyle={isDark && Platform.OS === 'android' ? DARK_MAP_STYLE : undefined}
        onPanDrag={() => setUserOverrodeFollow(true)}
        scrollEnabled={!compact}
        zoomEnabled={!compact}
        pitchEnabled={!compact}
        rotateEnabled={!compact}
      >
        {polylineCoords.length >= 2 && (
          <Polyline
            coordinates={polylineCoords}
            strokeColor={accent}
            strokeWidth={compact ? 3 : 5}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {firstPoint && (
          <Marker
            coordinate={{ latitude: firstPoint.latitude, longitude: firstPoint.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={[styles.startMarker, { backgroundColor: '#22c55e' }]} />
          </Marker>
        )}

        {lastPoint && route.length > 1 && (
          <Marker
            coordinate={{ latitude: lastPoint.latitude, longitude: lastPoint.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={[styles.currentMarkerWrap]}>
              <View style={[styles.currentMarkerPulse, { backgroundColor: accent }]} />
              <View style={[styles.currentMarker, { backgroundColor: accent, borderColor: '#fff' }]} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Recenter button when user has dragged */}
      {userOverrodeFollow && !compact && lastPoint && (
        <TouchableOpacity
          style={[styles.recenterButton, { backgroundColor: isDark ? 'rgba(20,20,20,0.92)' : 'rgba(255,255,255,0.92)', borderColor: colors.border }]}
          onPress={() => {
            setUserOverrodeFollow(false);
            if (mapRef.current && lastPoint) {
              mapRef.current.animateCamera(
                { center: { latitude: lastPoint.latitude, longitude: lastPoint.longitude }, zoom: 16 },
                { duration: 500 },
              );
            }
          }}
          activeOpacity={0.7}
        >
          <PlatformIcon name="target" size={16} color={accent} />
        </TouchableOpacity>
      )}

      {/* Tap-to-expand for compact mode */}
      {compact && onExpand && (
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={onExpand}
          activeOpacity={0.85}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 280,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  compactContainer: {
    height: 110,
    borderRadius: 14,
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
    fontFamily: 'Outfit_500Medium',
    textAlign: 'center',
  },
  fallbackPointCount: {
    fontFamily: 'Outfit_400Regular',
  },
  startMarker: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
  },
  currentMarkerWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentMarkerPulse: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    opacity: 0.25,
  },
  currentMarker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  recenterButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
