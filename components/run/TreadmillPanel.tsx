import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useZealTheme } from '@/context/AppContext';
import { useRun } from '@/context/RunContext';
import { PlatformIcon } from '@/components/PlatformIcon';
import GlassCard from '@/components/GlassCard';

interface Props {
  variant?: 'solid' | 'glass';
}

const MPH_PER_MPS = 2.23694;
const KPH_PER_MPS = 3.6;
const SPEED_MIN = 0;
const SPEED_MAX_MPH = 14;
const SPEED_MAX_KPH = 22;
const SPEED_STEP = 0.1; // user-facing units (mph or km/h)
const INCLINE_MIN = 0;
const INCLINE_MAX = 15;
const INCLINE_STEP = 0.5;

function buzz() {
  if (Platform.OS === 'web') return;
  Haptics.selectionAsync().catch(() => {});
}

/**
 * Speed/incline quick-adjust panel for treadmill mode. Renders inside the
 * active-run screen in place of the GPS map.
 *
 * Speeds are entered in the runner's preferred units (mph for imperial,
 * km/h for metric) and converted to m/s before hitting the tracking service.
 */
export default function TreadmillPanel({ variant = 'glass' }: Props) {
  const { colors, isDark } = useZealTheme();
  const run = useRun();
  const isMetric = run.preferences.units === 'metric';

  // Convert internal m/s to display units
  const displayMultiplier = isMetric ? KPH_PER_MPS : MPH_PER_MPS;
  const speedDisplay = run.treadmillSpeedMps * displayMultiplier;
  const speedMax = isMetric ? SPEED_MAX_KPH : SPEED_MAX_MPH;
  const speedUnit = isMetric ? 'km/h' : 'mph';

  const adjustSpeed = useCallback((deltaDisplay: number) => {
    const nextDisplay = Math.max(SPEED_MIN, Math.min(speedMax, speedDisplay + deltaDisplay));
    const nextMps = nextDisplay / displayMultiplier;
    run.setTreadmillSpeed(nextMps);
    buzz();
  }, [run, speedDisplay, speedMax, displayMultiplier]);

  const adjustIncline = useCallback((delta: number) => {
    const next = Math.max(INCLINE_MIN, Math.min(INCLINE_MAX, run.treadmillInclinePct + delta));
    run.setTreadmillIncline(next);
    buzz();
  }, [run]);

  const tileBg = isDark ? 'rgba(38,38,38,0.55)' : 'rgba(255,255,255,0.55)';
  const tileBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const btnBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const btnBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';

  const Stepper = ({
    label,
    value,
    unit,
    onMinus,
    onPlus,
    onMinusBig,
    onPlusBig,
    bigLabel,
  }: {
    label: string;
    value: string;
    unit: string;
    onMinus: () => void;
    onPlus: () => void;
    onMinusBig?: () => void;
    onPlusBig?: () => void;
    bigLabel?: string;
  }) => (
    <View style={[styles.stepper, { backgroundColor: tileBg, borderColor: tileBorder }]}>
      <Text style={[styles.stepperLabel, { color: colors.textMuted }]}>{label}</Text>
      <View style={styles.stepperValueRow}>
        <Text style={[styles.stepperValue, { color: colors.text }]}>{value}</Text>
        <Text style={[styles.stepperUnit, { color: colors.textMuted }]}>{unit}</Text>
      </View>
      <View style={styles.stepperBtnRow}>
        {onMinusBig && (
          <TouchableOpacity
            onPress={onMinusBig}
            style={[styles.stepperBtnSmall, { backgroundColor: btnBg, borderColor: btnBorder }]}
            accessibilityRole="button"
            accessibilityLabel={`Decrease ${label} by ${bigLabel ?? '1'}`}
          >
            <Text style={[styles.stepperBtnSmallText, { color: colors.textSecondary }]}>−{bigLabel ?? '1'}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={onMinus}
          style={[styles.stepperBtnLarge, { backgroundColor: btnBg, borderColor: btnBorder }]}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
        >
          <PlatformIcon name="minus" size={18} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onPlus}
          style={[styles.stepperBtnLarge, { backgroundColor: btnBg, borderColor: btnBorder }]}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
        >
          <PlatformIcon name="plus" size={18} color={colors.text} />
        </TouchableOpacity>
        {onPlusBig && (
          <TouchableOpacity
            onPress={onPlusBig}
            style={[styles.stepperBtnSmall, { backgroundColor: btnBg, borderColor: btnBorder }]}
            accessibilityRole="button"
            accessibilityLabel={`Increase ${label} by ${bigLabel ?? '1'}`}
          >
            <Text style={[styles.stepperBtnSmallText, { color: colors.textSecondary }]}>+{bigLabel ?? '1'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <GlassCard variant={variant} style={styles.card}>
      <View style={styles.headerRow}>
        <PlatformIcon name="zap" size={14} color={colors.textSecondary} />
        <Text style={[styles.headerText, { color: colors.textSecondary }]}>TREADMILL</Text>
      </View>

      <View style={styles.row}>
        <Stepper
          label="SPEED"
          value={speedDisplay > 0 ? speedDisplay.toFixed(1) : '0.0'}
          unit={speedUnit}
          onMinus={() => adjustSpeed(-SPEED_STEP)}
          onPlus={() => adjustSpeed(SPEED_STEP)}
          onMinusBig={() => adjustSpeed(-1)}
          onPlusBig={() => adjustSpeed(1)}
          bigLabel="1.0"
        />
        <Stepper
          label="INCLINE"
          value={run.treadmillInclinePct.toFixed(1)}
          unit="%"
          onMinus={() => adjustIncline(-INCLINE_STEP)}
          onPlus={() => adjustIncline(INCLINE_STEP)}
        />
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 22,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerText: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 1.2,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  stepper: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 6,
  },
  stepperLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.8,
  },
  stepperValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  stepperValue: {
    fontSize: 30,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -1,
    lineHeight: 34,
  },
  stepperUnit: {
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
  },
  stepperBtnRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  stepperBtnLarge: {
    flex: 1,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnSmall: {
    paddingHorizontal: 8,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 38,
  },
  stepperBtnSmallText: {
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
  },
});
