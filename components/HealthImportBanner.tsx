import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { ArrowDownToLine, AlertCircle, ChevronRight } from 'lucide-react-native';
import { useZealTheme } from '@/context/AppContext';
import { useWorkoutTracking } from '@/context/WorkoutTrackingContext';

export default function HealthImportBanner() {
  const { colors, accent, isDark } = useZealTheme();
  const tracking = useWorkoutTracking();

  const pendingCount = tracking.pendingHealthImports.length;
  const dupCount = tracking.duplicateCandidates.length;
  const totalCount = pendingCount + dupCount;

  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (totalCount > 0) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 1,
          useNativeDriver: true,
          damping: 18,
          stiffness: 280,
          mass: 0.8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [totalCount]);

  if (totalCount === 0) return null;

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-12, 0],
  });

  const hasDups = dupCount > 0;
  const bannerColor = hasDups ? '#f59e0b' : '#22c55e';
  const bannerBg = isDark
    ? hasDups ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.10)'
    : hasDups ? 'rgba(245,158,11,0.10)' : 'rgba(34,197,94,0.08)';
  const borderColor = hasDups ? 'rgba(245,158,11,0.35)' : 'rgba(34,197,94,0.30)';

  const label = hasDups
    ? dupCount === 1
      ? '1 possible duplicate from Health'
      : `${dupCount} possible duplicates from Health`
    : pendingCount === 1
      ? '1 workout imported from Health'
      : `${pendingCount} workouts imported from Health`;

  const subLabel = hasDups
    ? 'Your watch may have logged this too'
    : 'Tap to review and add to your log';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: opacityAnim,
          transform: [{ translateY }],
        },
      ]}
      testID="health-import-banner"
    >
      <TouchableOpacity
        style={[
          styles.banner,
          {
            backgroundColor: bannerBg,
            borderColor,
          },
        ]}
        onPress={() => tracking.setHealthImportReviewVisible(true)}
        activeOpacity={0.82}
      >
        <View style={[styles.iconWrap, { backgroundColor: `${bannerColor}20` }]}>
          {hasDups
            ? <AlertCircle size={16} color={bannerColor} />
            : <ArrowDownToLine size={16} color={bannerColor} />
          }
        </View>

        <View style={styles.textWrap}>
          <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
            {label}
          </Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]} numberOfLines={1}>
            {subLabel}
          </Text>
        </View>

        <View style={[styles.reviewChip, { backgroundColor: `${bannerColor}20` }]}>
          <Text style={[styles.reviewText, { color: bannerColor }]}>Review</Text>
          <ChevronRight size={12} color={bannerColor} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textWrap: {
    flex: 1,
    gap: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '600' as const,
    letterSpacing: -0.1,
  },
  sub: {
    fontSize: 11,
    fontWeight: '400' as const,
  },
  reviewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 2,
    flexShrink: 0,
  },
  reviewText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
});
