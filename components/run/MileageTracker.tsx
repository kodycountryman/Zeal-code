import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, Pressable } from 'react-native';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme } from '@/context/AppContext';
import { RunLog, RunUnits, METERS_PER_MILE, METERS_PER_KM } from '@/types/run';

interface Props {
  runHistory: RunLog[];
  units: RunUnits;
  weeklyGoalMeters: number | null;
  onUpdateGoal?: (meters: number | null) => void;
}

const DAY_MS = 86400000;

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfYear(date: Date): Date {
  const d = new Date(date.getFullYear(), 0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function metersToUnit(meters: number, units: RunUnits): number {
  return units === 'metric' ? meters / METERS_PER_KM : meters / METERS_PER_MILE;
}

function unitSuffix(units: RunUnits): string {
  return units === 'metric' ? 'km' : 'mi';
}

function formatDist(meters: number, units: RunUnits, decimals = 1): string {
  return metersToUnit(meters, units).toFixed(decimals);
}

/**
 * Parse a "5.0" or "5" string into meters using the user's units. Returns null if invalid.
 */
function parseGoalInput(input: string, units: RunUnits): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parsed = parseFloat(trimmed);
  if (isNaN(parsed) || parsed <= 0) return null;
  return parsed * (units === 'metric' ? METERS_PER_KM : METERS_PER_MILE);
}

export default function MileageTracker({ runHistory, units, weeklyGoalMeters, onUpdateGoal }: Props) {
  const { colors, accent, isDark } = useZealTheme();
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [goalInput, setGoalInput] = useState(() => {
    if (!weeklyGoalMeters) return '';
    return metersToUnit(weeklyGoalMeters, units).toFixed(1);
  });

  // ── Compute weekly buckets (8 weeks ending this week) ─────────────────
  const weekBars = useMemo(() => {
    const now = new Date();
    const currentWeekStart = startOfWeek(now);
    const bars: { label: string; meters: number; isCurrent: boolean; weekStart: Date }[] = [];

    for (let w = 7; w >= 0; w--) {
      const weekStart = new Date(currentWeekStart);
      weekStart.setDate(weekStart.getDate() - w * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      let meters = 0;
      for (const r of runHistory) {
        const t = new Date(r.startTime).getTime();
        if (t >= weekStart.getTime() && t < weekEnd.getTime()) {
          meters += r.distanceMeters;
        }
      }
      bars.push({
        label: w === 0 ? 'This wk' : `${w}w ago`,
        meters,
        isCurrent: w === 0,
        weekStart,
      });
    }
    return bars;
  }, [runHistory]);

  // ── Monthly and yearly totals ──────────────────────────────────────────
  const monthlyMeters = useMemo(() => {
    const monthStart = startOfMonth(new Date()).getTime();
    return runHistory
      .filter(r => new Date(r.startTime).getTime() >= monthStart)
      .reduce((sum, r) => sum + r.distanceMeters, 0);
  }, [runHistory]);

  const yearlyMeters = useMemo(() => {
    const yearStart = startOfYear(new Date()).getTime();
    return runHistory
      .filter(r => new Date(r.startTime).getTime() >= yearStart)
      .reduce((sum, r) => sum + r.distanceMeters, 0);
  }, [runHistory]);

  const currentWeekMeters = weekBars[weekBars.length - 1]?.meters ?? 0;
  const chartMax = Math.max(
    weeklyGoalMeters ?? 0,
    ...weekBars.map(b => b.meters),
    1, // avoid div-by-zero
  );

  const goalPct = weeklyGoalMeters && weeklyGoalMeters > 0
    ? Math.min(1, currentWeekMeters / weeklyGoalMeters)
    : 0;
  const goalPercent = Math.round(goalPct * 100);

  const handleSaveGoal = () => {
    if (!onUpdateGoal) return;
    const parsed = parseGoalInput(goalInput, units);
    onUpdateGoal(parsed);
    setGoalModalVisible(false);
  };

  const handleClearGoal = () => {
    if (!onUpdateGoal) return;
    setGoalInput('');
    onUpdateGoal(null);
    setGoalModalVisible(false);
  };

  // ── Goal ring — simple dashed progress circle ─────────────────────────
  const ringSize = 72;
  const ringStrokeWidth = 7;
  const ringRadius = (ringSize - ringStrokeWidth) / 2;
  const ringCircumference = 2 * Math.PI * ringRadius;

  return (
    <View style={styles.container}>
      {/* ── Goal + current week ring ─────────────────────────────────── */}
      {weeklyGoalMeters ? (
        <View style={[styles.goalCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
          <View style={styles.ringWrap}>
            <View style={[styles.ringBackground, { width: ringSize, height: ringSize, borderRadius: ringSize / 2, borderColor: colors.border }]} />
            <View
              style={[
                styles.ringFill,
                {
                  width: ringSize,
                  height: ringSize,
                  borderRadius: ringSize / 2,
                  borderColor: accent,
                  // We can't do a true partial ring with borders — use a simple pct text overlay instead.
                  opacity: goalPct > 0 ? 1 : 0,
                  transform: [{ rotate: '-90deg' }],
                },
              ]}
            />
            <View style={styles.ringCenter}>
              <Text style={[styles.ringPct, { color: accent }]}>{goalPercent}%</Text>
            </View>
          </View>
          <View style={styles.goalBody}>
            <Text style={[styles.goalLabel, { color: colors.textMuted }]}>WEEKLY GOAL</Text>
            <Text style={[styles.goalProgress, { color: colors.text }]}>
              {formatDist(currentWeekMeters, units, 1)} / {formatDist(weeklyGoalMeters, units, 0)} {unitSuffix(units)}
            </Text>
            <TouchableOpacity onPress={() => setGoalModalVisible(true)} activeOpacity={0.7}>
              <Text style={[styles.goalEditLink, { color: accent }]}>Edit goal</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.setGoalCard, { borderColor: colors.border, backgroundColor: colors.cardSecondary }]}
          onPress={() => setGoalModalVisible(true)}
          activeOpacity={0.75}
        >
          <View style={[styles.setGoalIcon, { backgroundColor: `${accent}20` }]}>
            <PlatformIcon name="target" size={16} color={accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.setGoalTitle, { color: colors.text }]}>Set a weekly mileage goal</Text>
            <Text style={[styles.setGoalSub, { color: colors.textSecondary }]}>
              Track progress toward a target each week
            </Text>
          </View>
          <PlatformIcon name="chevron-right" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      )}

      {/* ── 8-week bar chart ─────────────────────────────────────────── */}
      <View style={[styles.chartCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
        <View style={styles.chartHeader}>
          <Text style={[styles.chartLabel, { color: colors.textMuted }]}>LAST 8 WEEKS</Text>
          <Text style={[styles.chartMax, { color: colors.textMuted }]}>
            max {formatDist(chartMax, units, 0)} {unitSuffix(units)}
          </Text>
        </View>
        <View style={styles.barsRow}>
          {weekBars.map((bar, i) => {
            const heightPct = (bar.meters / chartMax) * 100;
            const barColor = bar.isCurrent ? accent : (isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)');
            const showGoalLine = weeklyGoalMeters && weeklyGoalMeters <= chartMax;
            const goalHeightPct = showGoalLine ? (weeklyGoalMeters! / chartMax) * 100 : 0;
            return (
              <View key={i} style={styles.barColumn}>
                <View style={styles.barTrack}>
                  {showGoalLine && (
                    <View
                      style={[
                        styles.barGoalLine,
                        {
                          bottom: `${goalHeightPct}%`,
                          backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)',
                        },
                      ]}
                    />
                  )}
                  <View
                    style={[
                      styles.bar,
                      {
                        height: `${Math.max(heightPct, bar.meters > 0 ? 4 : 0)}%`,
                        backgroundColor: barColor,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.barLabel,
                    { color: bar.isCurrent ? accent : colors.textMuted, fontFamily: bar.isCurrent ? 'Outfit_700Bold' : 'Outfit_500Medium' },
                  ]}
                  numberOfLines={1}
                >
                  {bar.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* ── Monthly + yearly totals ──────────────────────────────────── */}
      <View style={[styles.totalsCard, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
        <View style={styles.totalBox}>
          <Text style={[styles.totalLabel, { color: colors.textMuted }]}>THIS MONTH</Text>
          <Text style={[styles.totalValue, { color: colors.text }]}>
            {formatDist(monthlyMeters, units, 1)} <Text style={[styles.totalUnit, { color: colors.textMuted }]}>{unitSuffix(units)}</Text>
          </Text>
        </View>
        <View style={[styles.totalDivider, { backgroundColor: colors.border }]} />
        <View style={styles.totalBox}>
          <Text style={[styles.totalLabel, { color: colors.textMuted }]}>THIS YEAR</Text>
          <Text style={[styles.totalValue, { color: colors.text }]}>
            {formatDist(yearlyMeters, units, 0)} <Text style={[styles.totalUnit, { color: colors.textMuted }]}>{unitSuffix(units)}</Text>
          </Text>
        </View>
      </View>

      {/* ── Goal edit modal ──────────────────────────────────────────── */}
      <Modal
        visible={goalModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGoalModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setGoalModalVisible(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: isDark ? '#1a1a1a' : '#fff', borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Weekly mileage goal</Text>
            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
              How far do you want to run each week?
            </Text>
            <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.cardSecondary }]}>
              <TextInput
                value={goalInput}
                onChangeText={setGoalInput}
                placeholder="25"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                style={[styles.input, { color: colors.text }]}
                autoFocus
              />
              <Text style={[styles.inputSuffix, { color: colors.textMuted }]}>{unitSuffix(units)} / week</Text>
            </View>
            <View style={styles.modalActions}>
              {weeklyGoalMeters && (
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonClear, { borderColor: colors.border }]}
                  onPress={handleClearGoal}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.modalButtonText, { color: colors.textSecondary }]}>Clear</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel, { borderColor: colors.border }]}
                onPress={() => setGoalModalVisible(false)}
                activeOpacity={0.75}
              >
                <Text style={[styles.modalButtonText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSave, { backgroundColor: accent }]}
                onPress={handleSaveGoal}
                activeOpacity={0.85}
              >
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  ringWrap: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringBackground: {
    position: 'absolute',
    borderWidth: 7,
  },
  ringFill: {
    position: 'absolute',
    borderWidth: 7,
    // A full ring of accent color, softly overlaid on the background. The % is
    // the source of truth; we use the background+text for visual feedback.
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPct: {
    fontSize: 15,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.3,
  },
  goalBody: {
    flex: 1,
    gap: 2,
  },
  goalLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.8,
  },
  goalProgress: {
    fontSize: 18,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.3,
  },
  goalEditLink: {
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
    marginTop: 2,
  },
  setGoalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  setGoalIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setGoalTitle: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
  },
  setGoalSub: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
    marginTop: 2,
  },
  chartCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chartLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.8,
  },
  chartMax: {
    fontSize: 10,
    fontFamily: 'Outfit_500Medium',
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 100,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    height: '100%',
  },
  barTrack: {
    width: '100%',
    flex: 1,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    position: 'relative',
  },
  bar: {
    width: '100%',
    borderRadius: 6,
    minHeight: 1,
  },
  barGoalLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    zIndex: 1,
  },
  barLabel: {
    fontSize: 9,
    letterSpacing: 0.3,
  },
  totalsCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  totalBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  totalDivider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
  totalLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.8,
  },
  totalValue: {
    fontSize: 22,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.5,
  },
  totalUnit: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
  },
  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.3,
  },
  modalSub: {
    fontSize: 13,
    fontFamily: 'Outfit_400Regular',
    lineHeight: 18,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 4,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.3,
  },
  inputSuffix: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonClear: {
    borderWidth: 1,
  },
  modalButtonCancel: {
    borderWidth: 1,
  },
  modalButtonSave: {
    flex: 1.3,
  },
  modalButtonText: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
  },
});
