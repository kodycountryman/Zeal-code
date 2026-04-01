import React, { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme, useAppContext } from '@/context/AppContext';
import DrawerHeader from '@/components/drawers/DrawerHeader';
import {
  METRIC_REGISTRY,
  type MetricSlotKey,
  type MetricGroup,
} from '@/constants/metricSlots';

interface Props {
  visible: boolean;
  /** Which slot (0–3) is being configured */
  slotIndex: number | null;
  /** The key currently assigned to this slot, if any */
  currentKey: MetricSlotKey | null;
  onSelect: (slotIndex: number, key: MetricSlotKey | null) => void;
  onClose: () => void;
}

const GROUP_LABELS: Record<MetricGroup, string> = {
  workout: 'WORKOUT DATA',
  health: 'HEALTH DATA',
};

const GROUPS: MetricGroup[] = ['workout', 'health'];

export default function MetricPickerSheet({
  visible,
  slotIndex,
  currentKey,
  onSelect,
  onClose,
}: Props) {
  const { colors, accent, isDark } = useZealTheme();
  const { healthConnected } = useAppContext();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const topOffset = Math.max(insets.top, 0) + 16;
  const { height: windowH } = useWindowDimensions();

  const snapPoints = useMemo(() => {
    const maxH = Math.round(windowH * 0.72);
    return [Math.max(480, Math.min(maxH, 600))];
  }, [windowH]);

  useEffect(() => {
    if (visible && slotIndex !== null) {
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible, slotIndex]);

  const handleDismiss = useCallback(() => {
    onClose();
  }, [onClose]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.55}
        pressBehavior="close"
      />
    ),
    [],
  );

  const handleSelect = useCallback(
    (key: MetricSlotKey) => {
      if (slotIndex === null) return;
      // Tapping the active metric clears the slot
      if (key === currentKey) {
        onSelect(slotIndex, null);
      } else {
        onSelect(slotIndex, key);
      }
      onClose();
    },
    [slotIndex, currentKey, onSelect, onClose],
  );

  const dividerColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const rowBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const activeBg = isDark ? `${accent}22` : `${accent}18`;

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      backgroundStyle={[styles.sheetBg, { backgroundColor: colors.card }]}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
      enablePanDownToClose
      enableOverDrag={false}
      topInset={topOffset}
      stackBehavior="push"
    >
      <DrawerHeader
        title={slotIndex !== null ? `Slot ${slotIndex + 1}` : 'Metrics'}
        onClose={onClose}
      />

      <BottomSheetScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {GROUPS.map((group) => {
          const metrics = METRIC_REGISTRY.filter((m) => m.group === group);
          return (
            <View key={group} style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                {GROUP_LABELS[group]}
              </Text>

              <View style={[styles.groupCard, { backgroundColor: rowBg, borderColor: dividerColor }]}>
                {metrics.map((metric, idx) => {
                  const isActive = metric.key === currentKey;
                  const needsHealth = metric.requiresHealth && !healthConnected;

                  return (
                    <React.Fragment key={metric.key}>
                      {idx > 0 && (
                        <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />
                      )}
                      <TouchableOpacity
                        style={[
                          styles.metricRow,
                          isActive && { backgroundColor: activeBg },
                        ]}
                        onPress={() => handleSelect(metric.key)}
                        activeOpacity={0.65}
                      >
                        {/* Icon */}
                        <View
                          style={[
                            styles.iconWrap,
                            {
                              backgroundColor: isActive
                                ? `${accent}28`
                                : isDark
                                ? 'rgba(255,255,255,0.08)'
                                : 'rgba(0,0,0,0.06)',
                            },
                          ]}
                        >
                          <PlatformIcon
                            name={metric.icon as any}
                            size={15}
                            color={isActive ? accent : colors.textSecondary}
                            strokeWidth={2}
                          />
                        </View>

                        {/* Text */}
                        <View style={styles.metricText}>
                          <View style={styles.metricLabelRow}>
                            <Text
                              style={[
                                styles.metricLabel,
                                { color: isActive ? accent : colors.text },
                              ]}
                            >
                              {metric.label}
                            </Text>
                            {needsHealth && (
                              <View
                                style={[
                                  styles.healthBadge,
                                  {
                                    backgroundColor: isDark
                                      ? 'rgba(255,255,255,0.08)'
                                      : 'rgba(0,0,0,0.06)',
                                  },
                                ]}
                              >
                                <PlatformIcon name="heart-pulse" size={9} color={colors.textSecondary} />
                                <Text style={[styles.healthBadgeText, { color: colors.textSecondary }]}>
                                  Connect Health
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text
                            style={[styles.metricDesc, { color: colors.textSecondary }]}
                            numberOfLines={1}
                          >
                            {metric.description}
                          </Text>
                        </View>

                        {/* Checkmark */}
                        {isActive ? (
                          <PlatformIcon name="check" size={16} color={accent} strokeWidth={2.5} />
                        ) : (
                          <PlatformIcon name="chevron-right" size={14} color={colors.border} strokeWidth={2} />
                        )}
                      </TouchableOpacity>
                    </React.Fragment>
                  );
                })}
              </View>

              {group === 'health' && !healthConnected && (
                <Text style={[styles.healthNote, { color: colors.textSecondary }]}>
                  Connect Apple Health or Health Connect in Settings to unlock health metrics.
                </Text>
              )}
            </View>
          );
        })}

        {/* Clear slot option — only shown when a metric is selected */}
        {currentKey && slotIndex !== null && (
          <TouchableOpacity
            style={[styles.clearRow, { borderColor: dividerColor }]}
            onPress={() => {
              onSelect(slotIndex, null);
              onClose();
            }}
            activeOpacity={0.65}
          >
            <PlatformIcon name="x" size={14} color={colors.textSecondary} strokeWidth={2.5} />
            <Text style={[styles.clearText, { color: colors.textSecondary }]}>Remove from slot</Text>
          </TouchableOpacity>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetBg: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 20,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.9,
  },
  groupCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  rowDivider: {
    height: 1,
    marginLeft: 56,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    minHeight: 60,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricText: {
    flex: 1,
    gap: 2,
  },
  metricLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexWrap: 'wrap',
  },
  metricLabel: {
    fontSize: 14,
    fontFamily: 'Outfit_500Medium',
    letterSpacing: -0.1,
  },
  metricDesc: {
    fontSize: 11,
    fontFamily: 'Outfit_400Regular',
    letterSpacing: 0.1,
  },
  healthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  healthBadgeText: {
    fontSize: 9,
    fontFamily: 'Outfit_500Medium',
    letterSpacing: 0.2,
  },
  healthNote: {
    fontSize: 11,
    fontFamily: 'Outfit_400Regular',
    letterSpacing: 0.1,
    lineHeight: 16,
    paddingHorizontal: 4,
  },
  clearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 4,
  },
  clearText: {
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
    letterSpacing: 0,
  },
});
