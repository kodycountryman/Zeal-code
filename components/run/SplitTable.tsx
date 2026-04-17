import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useZealTheme } from '@/context/AppContext';
import { PlatformIcon } from '@/components/PlatformIcon';
import { Split, RunUnits } from '@/types/run';
import { formatPace, paceToSecondsPerMile, paceToSecondsPerKm } from '@/services/runTrackingService';

interface Props {
  splits: Split[];
  units: RunUnits;
  emptyMessage?: string;
}

function formatPaceForUnit(secondsPerMeter: number, units: RunUnits): string {
  return formatPace(units === 'metric' ? paceToSecondsPerKm(secondsPerMeter) : paceToSecondsPerMile(secondsPerMeter));
}

function formatElevDelta(meters: number, units: RunUnits): string {
  if (Math.abs(meters) < 0.5) return '—';
  const value = units === 'metric' ? Math.round(meters) : Math.round(meters * 3.28084);
  const unit = units === 'metric' ? 'm' : 'ft';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}${unit}`;
}

export default function SplitTable({ splits, units, emptyMessage = 'Splits will appear after your first mile.' }: Props) {
  const { colors, isDark } = useZealTheme();

  const { fastestIdx, slowestIdx } = useMemo(() => {
    if (splits.length < 2) return { fastestIdx: -1, slowestIdx: -1 };
    let fastest = 0;
    let slowest = 0;
    for (let i = 1; i < splits.length; i++) {
      if (splits[i].paceSecondsPerMeter < splits[fastest].paceSecondsPerMeter) fastest = i;
      if (splits[i].paceSecondsPerMeter > splits[slowest].paceSecondsPerMeter) slowest = i;
    }
    return { fastestIdx: fastest, slowestIdx: slowest };
  }, [splits]);

  if (splits.length === 0) {
    return (
      <View style={styles.emptyState}>
        <PlatformIcon name="footprints" size={20} color={colors.textMuted} />
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>{emptyMessage}</Text>
      </View>
    );
  }

  const dividerColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const unitLabel = units === 'metric' ? 'KM' : 'MI';

  return (
    <View style={styles.container}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, styles.cellSplit, { color: colors.textMuted }]}>{unitLabel}</Text>
        <Text style={[styles.headerCell, styles.cellPace, { color: colors.textMuted }]}>PACE</Text>
        <Text style={[styles.headerCell, styles.cellElev, { color: colors.textMuted }]}>ELEV</Text>
      </View>

      {splits.map((split, idx) => {
        const isFastest = idx === fastestIdx && splits.length > 1;
        const isSlowest = idx === slowestIdx && splits.length > 1;
        const paceColor = isFastest ? '#22c55e' : isSlowest ? '#ef4444' : colors.text;
        const paceFont = isFastest || isSlowest ? 'Outfit_700Bold' : 'Outfit_500Medium';
        return (
          <View key={split.index} style={[styles.row, { borderTopColor: idx > 0 ? dividerColor : 'transparent' }]}>
            <View style={[styles.cellSplit, styles.splitNumberCell]}>
              <Text style={[styles.splitNumber, { color: colors.text }]}>{split.index}</Text>
              {isFastest && (
                <View style={styles.badge}>
                  <PlatformIcon name="zap" size={9} color="#22c55e" />
                </View>
              )}
            </View>
            <Text style={[styles.dataCell, styles.cellPace, { color: paceColor, fontFamily: paceFont }]}>
              {formatPaceForUnit(split.paceSecondsPerMeter, units)}
            </Text>
            <Text style={[styles.dataCell, styles.cellElev, { color: colors.textMuted }]}>
              {formatElevDelta(split.elevationChangeMeters, units)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  emptyState: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: 'Outfit_400Regular',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  headerCell: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  splitNumberCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  splitNumber: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
  },
  dataCell: {
    fontSize: 14,
    fontFamily: 'Outfit_500Medium',
  },
  cellSplit: {
    width: 60,
  },
  cellPace: {
    flex: 1,
  },
  cellElev: {
    width: 70,
    textAlign: 'right',
  },
  badge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(34,197,94,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
