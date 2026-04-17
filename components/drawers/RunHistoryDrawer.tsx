import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList, Animated as RNAnimated } from 'react-native';
import BaseDrawer from '@/components/drawers/BaseDrawer';
import DrawerHeader from '@/components/drawers/DrawerHeader';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme } from '@/context/AppContext';
import { useRun } from '@/context/RunContext';
import RunLogDrawer from '@/components/drawers/RunLogDrawer';
import {
  RunLog,
  RunType,
  METERS_PER_MILE,
  METERS_PER_KM,
} from '@/types/run';
import { formatPace, paceToSecondsPerMile, paceToSecondsPerKm } from '@/services/runTrackingService';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type TabKey = 'list' | 'calendar';

type FilterRange = 'all' | 'this_week' | 'this_month' | 'last_30' | 'last_90';

const FILTER_OPTIONS: { value: FilterRange; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'this_week', label: 'Week' },
  { value: 'this_month', label: 'Month' },
  { value: 'last_30', label: '30d' },
  { value: 'last_90', label: '90d' },
];

function filterStartMs(filter: FilterRange): number {
  const now = Date.now();
  if (filter === 'all') return 0;
  if (filter === 'this_week') {
    const d = new Date();
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  if (filter === 'this_month') {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  if (filter === 'last_30') return now - 30 * 86400000;
  if (filter === 'last_90') return now - 90 * 86400000;
  return 0;
}

function formatDist(meters: number, units: 'imperial' | 'metric'): string {
  if (units === 'metric') return `${(meters / METERS_PER_KM).toFixed(2)} km`;
  return `${(meters / METERS_PER_MILE).toFixed(2)} mi`;
}

function formatDuration(totalSeconds: number): string {
  if (!isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const hrs = Math.floor(totalSeconds / 3600);
  const min = Math.floor((totalSeconds % 3600) / 60);
  const sec = Math.floor(totalSeconds % 60);
  if (hrs > 0) return `${hrs}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

function formatPaceForUnit(secPerMeter: number, units: 'imperial' | 'metric'): string {
  return formatPace(units === 'metric' ? paceToSecondsPerKm(secPerMeter) : paceToSecondsPerMile(secPerMeter));
}

function relativeDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function runTypeLabel(t: RunType | undefined): string {
  if (!t || t === 'free') return 'Run';
  if (t === 'long_run') return 'Long Run';
  if (t === 'hill_repeats') return 'Hills';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// ─── Calendar month grid ──────────────────────────────────────────────────
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface CalendarDay {
  day: number;
  dateStr: string;
  inCurrentMonth: boolean;
  runs: RunLog[];
  isToday: boolean;
}

function buildMonthGrid(year: number, month: number, runsByDate: Record<string, RunLog[]>): CalendarDay[] {
  const firstOfMonth = new Date(year, month, 1);
  const firstDay = firstOfMonth.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const cells: CalendarDay[] = [];
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  // Leading days from previous month
  for (let i = firstDay - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({ day, dateStr, inCurrentMonth: false, runs: runsByDate[dateStr] ?? [], isToday: dateStr === todayStr });
  }

  // Current month
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({ day, dateStr, inCurrentMonth: true, runs: runsByDate[dateStr] ?? [], isToday: dateStr === todayStr });
  }

  // Trailing days to fill to a multiple of 7 (or 42 for stable height)
  const targetLength = Math.ceil(cells.length / 7) * 7;
  let trailingDay = 1;
  while (cells.length < targetLength) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(trailingDay).padStart(2, '0')}`;
    cells.push({ day: trailingDay, dateStr, inCurrentMonth: false, runs: runsByDate[dateStr] ?? [], isToday: dateStr === todayStr });
    trailingDay++;
  }
  return cells;
}

export default function RunHistoryDrawer({ visible, onClose }: Props) {
  const { colors, accent, isDark } = useZealTheme();
  const run = useRun();

  const [tab, setTab] = useState<TabKey>('list');
  const [filter, setFilter] = useState<FilterRange>('all');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [logDrawerVisible, setLogDrawerVisible] = useState(false);

  const today = new Date();
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear, setCalYear] = useState(today.getFullYear());

  const filteredRuns = useMemo(() => {
    const cutoff = filterStartMs(filter);
    const filtered = run.runHistory.filter(r => {
      const t = new Date(r.startTime).getTime();
      return cutoff === 0 || t >= cutoff;
    });
    // Most recent first
    return filtered.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [run.runHistory, filter]);

  const filterTotals = useMemo(() => {
    let totalMeters = 0;
    let totalSeconds = 0;
    for (const r of filteredRuns) {
      totalMeters += r.distanceMeters;
      totalSeconds += r.durationSeconds;
    }
    return { count: filteredRuns.length, totalMeters, totalSeconds };
  }, [filteredRuns]);

  // Group runs by date for calendar lookup
  const runsByDate = useMemo(() => {
    const map: Record<string, RunLog[]> = {};
    for (const r of run.runHistory) {
      if (!map[r.date]) map[r.date] = [];
      map[r.date].push(r);
    }
    return map;
  }, [run.runHistory]);

  const monthGrid = useMemo(() => buildMonthGrid(calYear, calMonth, runsByDate), [calYear, calMonth, runsByDate]);

  const monthMeters = useMemo(() => {
    let total = 0;
    for (const cell of monthGrid) {
      if (!cell.inCurrentMonth) continue;
      for (const r of cell.runs) total += r.distanceMeters;
    }
    return total;
  }, [monthGrid]);

  const handlePrevMonth = useCallback(() => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear(y => y - 1);
    } else {
      setCalMonth(m => m - 1);
    }
  }, [calMonth]);

  const handleNextMonth = useCallback(() => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear(y => y + 1);
    } else {
      setCalMonth(m => m + 1);
    }
  }, [calMonth]);

  const handleOpenRun = useCallback((runId: string) => {
    setSelectedRunId(runId);
    setLogDrawerVisible(true);
  }, []);

  const header = <DrawerHeader title="Run History" onClose={onClose} />;

  const units = run.preferences.units;

  return (
    <>
      <BaseDrawer visible={visible} onClose={onClose} header={header}>
        {/* Tab bar */}
        <View style={styles.tabBarWrap}>
          <View style={[styles.tabBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
            <TouchableOpacity
              style={[styles.tabButton, tab === 'list' && { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#fff' }]}
              onPress={() => setTab('list')}
              activeOpacity={0.8}
            >
              <PlatformIcon name="list-checks" size={14} color={tab === 'list' ? accent : colors.textMuted} />
              <Text style={[styles.tabButtonText, { color: tab === 'list' ? accent : colors.textMuted }]}>List</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, tab === 'calendar' && { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#fff' }]}
              onPress={() => setTab('calendar')}
              activeOpacity={0.8}
            >
              <PlatformIcon name="calendar" size={14} color={tab === 'calendar' ? accent : colors.textMuted} />
              <Text style={[styles.tabButtonText, { color: tab === 'calendar' ? accent : colors.textMuted }]}>Calendar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── LIST VIEW ─────────────────────────────────────────────── */}
        {tab === 'list' && (
          <View style={{ flex: 1 }}>
            {/* Filter pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {FILTER_OPTIONS.map((opt) => {
                const selected = filter === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.filterPill,
                      {
                        backgroundColor: selected ? accent : colors.cardSecondary,
                        borderColor: selected ? accent : colors.border,
                      },
                    ]}
                    onPress={() => setFilter(opt.value)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.filterPillText, { color: selected ? '#fff' : colors.text }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Summary totals */}
            <View style={[styles.totalsRow, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
              <View style={styles.totalBox}>
                <Text style={[styles.totalValue, { color: accent }]}>{filterTotals.count}</Text>
                <Text style={[styles.totalLabel, { color: colors.textMuted }]}>RUNS</Text>
              </View>
              <View style={[styles.totalsDivider, { backgroundColor: colors.border }]} />
              <View style={styles.totalBox}>
                <Text style={[styles.totalValue, { color: accent }]}>
                  {formatDist(filterTotals.totalMeters, units).split(' ')[0]}
                </Text>
                <Text style={[styles.totalLabel, { color: colors.textMuted }]}>
                  {units === 'metric' ? 'KM' : 'MI'}
                </Text>
              </View>
              <View style={[styles.totalsDivider, { backgroundColor: colors.border }]} />
              <View style={styles.totalBox}>
                <Text style={[styles.totalValue, { color: accent }]}>{formatDuration(filterTotals.totalSeconds)}</Text>
                <Text style={[styles.totalLabel, { color: colors.textMuted }]}>TIME</Text>
              </View>
            </View>

            {/* Run list — FlatList virtualizes off-screen rows so 100+ runs stay smooth */}
            {filteredRuns.length === 0 ? (
              <View style={styles.emptyState}>
                <PlatformIcon name="figure-run" size={32} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No runs in this range</Text>
                <Text style={[styles.emptySub, { color: colors.textMuted }]}>
                  Your runs will show up here after you save them.
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredRuns}
                style={{ flex: 1 }}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                initialNumToRender={12}
                maxToRenderPerBatch={10}
                windowSize={10}
                removeClippedSubviews
                ListFooterComponent={<View style={{ height: 32 }} />}
                renderItem={({ item: r }) => (
                  <TouchableOpacity
                    style={[styles.runRow, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
                    onPress={() => handleOpenRun(r.id)}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel={`Run on ${relativeDate(r.startTime)}, ${formatDist(r.distanceMeters, r.splitUnit)}, ${formatDuration(r.durationSeconds)}`}
                  >
                    <View style={styles.runRowLeft}>
                      <Text style={[styles.runDate, { color: colors.textSecondary }]}>{relativeDate(r.startTime)}</Text>
                      <Text style={[styles.runDistance, { color: colors.text }]}>
                        {formatDist(r.distanceMeters, r.splitUnit)}
                      </Text>
                      <View style={styles.runTypeRow}>
                        <View style={[styles.runTypeDot, { backgroundColor: r.runType === 'race' ? '#eab308' : r.runType === 'long_run' ? '#8b5cf6' : accent }]} />
                        <Text style={[styles.runTypeText, { color: colors.textMuted }]}>{runTypeLabel(r.runType)}</Text>
                      </View>
                    </View>
                    <View style={styles.runRowRight}>
                      <View style={styles.runMiniStat}>
                        <Text style={[styles.runMiniStatValue, { color: colors.text }]}>{formatDuration(r.durationSeconds)}</Text>
                        <Text style={[styles.runMiniStatLabel, { color: colors.textMuted }]}>time</Text>
                      </View>
                      <View style={styles.runMiniStat}>
                        <Text style={[styles.runMiniStatValue, { color: colors.text }]}>
                          {formatPaceForUnit(r.averagePaceSecondsPerMeter, r.splitUnit)}
                        </Text>
                        <Text style={[styles.runMiniStatLabel, { color: colors.textMuted }]}>pace</Text>
                      </View>
                      <PlatformIcon name="chevron-right" size={14} color={colors.textMuted} />
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        )}

        {/* ── CALENDAR VIEW ─────────────────────────────────────────── */}
        {tab === 'calendar' && (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Month header with navigation */}
            <View style={styles.monthHeader}>
              <TouchableOpacity style={styles.monthNavButton} onPress={handlePrevMonth} activeOpacity={0.7}>
                <PlatformIcon name="chevron-left" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={styles.monthHeaderCenter}>
                <Text style={[styles.monthTitle, { color: colors.text }]}>
                  {MONTH_NAMES[calMonth]} {calYear}
                </Text>
                <Text style={[styles.monthSub, { color: colors.textMuted }]}>
                  {formatDist(monthMeters, units)} this month
                </Text>
              </View>
              <TouchableOpacity style={styles.monthNavButton} onPress={handleNextMonth} activeOpacity={0.7}>
                <PlatformIcon name="chevron-right" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Weekday headers */}
            <View style={styles.weekdayHeaderRow}>
              {WEEKDAY_HEADERS.map((wd, i) => (
                <Text key={i} style={[styles.weekdayHeader, { color: colors.textMuted }]}>
                  {wd}
                </Text>
              ))}
            </View>

            {/* Calendar grid */}
            <View style={styles.calendarGrid}>
              {monthGrid.map((cell, i) => {
                const hasRun = cell.runs.length > 0 && cell.inCurrentMonth;
                return (
                  <TouchableOpacity
                    key={`${cell.dateStr}-${i}`}
                    style={styles.calendarCell}
                    onPress={() => {
                      if (hasRun) handleOpenRun(cell.runs[0].id);
                    }}
                    disabled={!hasRun}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.calendarCellInner,
                        cell.isToday && cell.inCurrentMonth && { borderColor: accent, borderWidth: 1.5 },
                        hasRun && { backgroundColor: `${accent}15` },
                      ]}
                    >
                      <Text
                        style={[
                          styles.calendarDay,
                          {
                            color: cell.inCurrentMonth
                              ? cell.isToday
                                ? accent
                                : colors.text
                              : colors.textMuted,
                            opacity: cell.inCurrentMonth ? 1 : 0.35,
                            fontFamily: cell.isToday ? 'Outfit_800ExtraBold' : 'Outfit_500Medium',
                          },
                        ]}
                      >
                        {cell.day}
                      </Text>
                      {hasRun && (
                        <View style={[styles.calendarDot, { backgroundColor: accent }]} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Legend */}
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: accent }]} />
                <Text style={[styles.legendText, { color: colors.textMuted }]}>Run day</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendRing, { borderColor: accent }]} />
                <Text style={[styles.legendText, { color: colors.textMuted }]}>Today</Text>
              </View>
            </View>
          </ScrollView>
        )}
      </BaseDrawer>

      {/* Nested run log drawer */}
      <RunLogDrawer
        visible={logDrawerVisible}
        runId={selectedRunId}
        onClose={() => {
          setLogDrawerVisible(false);
          setSelectedRunId(null);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  tabBarWrap: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
  },
  tabBar: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 11,
  },
  tabButtonText: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.2,
  },
  filterRow: {
    paddingHorizontal: 16,
    gap: 8,
    paddingVertical: 6,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.3,
  },
  totalsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginHorizontal: 16,
    marginTop: 8,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  totalBox: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  totalValue: {
    fontSize: 20,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.4,
  },
  totalLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.8,
  },
  totalsDivider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: 3,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 8,
  },
  emptyState: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
  },
  emptySub: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
    textAlign: 'center',
  },
  runRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  runRowLeft: {
    flex: 1,
    gap: 2,
  },
  runDate: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
    letterSpacing: 0.3,
  },
  runDistance: {
    fontSize: 18,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.4,
  },
  runTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  runTypeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  runTypeText: {
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.2,
  },
  runRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  runMiniStat: {
    alignItems: 'flex-end',
    gap: 1,
  },
  runMiniStatValue: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
  },
  runMiniStatLabel: {
    fontSize: 9,
    fontFamily: 'Outfit_500Medium',
    letterSpacing: 0.3,
  },
  // Calendar
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  monthNavButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthHeaderCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  monthTitle: {
    fontSize: 16,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.3,
  },
  monthSub: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
  },
  weekdayHeaderRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  weekdayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.8,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
  },
  calendarCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 4,
  },
  calendarCellInner: {
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  calendarDay: {
    fontSize: 13,
  },
  calendarDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendRing: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
  },
  legendText: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
  },
});
