import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle, Line } from 'react-native-svg';
import GlassCard from '@/components/GlassCard';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme, useAppContext } from '@/context/AppContext';
import { useRun } from '@/context/RunContext';
import { RunLog, RunUnits, METERS_PER_MILE, METERS_PER_KM } from '@/types/run';
import { formatPace, paceToSecondsPerMile, paceToSecondsPerKm } from '@/services/runTrackingService';
import {
  getWeeklyTrend,
  getPaceByRunType,
  getPaceHistogram,
  getFastestSplits,
  getTrainingLoad,
  getAggregateStats,
  type WeeklyTrendBucket,
  type LoadStatus,
} from '@/services/runInsightsEngine';
import {
  getRacePredictions,
  describeRaceDistance,
  formatRaceTime,
} from '@/services/runRacePredictor';
import {
  buildZones,
  estimateMaxHR,
  getTimeInZoneAcrossHistory,
} from '@/services/runHRZones';
import { computeAllRunBadges, type RunBadge, type RunBadgeCategory } from '@/services/runBadges';
import AchievementModal, { getAchievementIcon, type Achievement } from '@/components/drawers/AchievementModal';
import MileageTracker from '@/components/run/MileageTracker';

interface Props {
  onOpenRun?: (runId: string) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function metersToUnit(meters: number, units: RunUnits): number {
  return units === 'metric' ? meters / METERS_PER_KM : meters / METERS_PER_MILE;
}

function formatDist(meters: number, units: RunUnits, decimals = 1): string {
  const v = metersToUnit(meters, units);
  return v.toFixed(decimals);
}

function formatPaceUnit(secPerMeter: number, units: RunUnits): string {
  if (!secPerMeter || secPerMeter <= 0) return '—:—';
  const perUnit = units === 'metric' ? paceToSecondsPerKm(secPerMeter) : paceToSecondsPerMile(secPerMeter);
  return formatPace(perUnit);
}

function formatHM(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '0m';
  const hrs = Math.floor(seconds / 3600);
  const min = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${min}m`;
  return `${min}m`;
}

function ageFromDOB(dob: string): number | null {
  if (!dob) return null;
  const [y, m, d] = dob.split('-').map(Number);
  if (!y || !m || !d) return null;
  const birth = new Date(y, m - 1, d);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const beforeBirthday = now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (beforeBirthday) age--;
  return age > 0 && age < 120 ? age : null;
}

// ─── Empty state ────────────────────────────────────────────────────────

function EmptyState({ minRuns }: { minRuns: number }) {
  const { colors } = useZealTheme();
  return (
    <View style={styles.empty}>
      <PlatformIcon name="figure-run" size={28} color={colors.textMuted} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>Not enough data yet</Text>
      <Text style={[styles.emptySub, { color: colors.textMuted }]}>
        Log at least {minRuns} run{minRuns > 1 ? 's' : ''} to see analytics here.
      </Text>
    </View>
  );
}

// ─── Weekly Mileage Bar Chart ───────────────────────────────────────────

function WeeklyMileageChart({ buckets, units }: { buckets: WeeklyTrendBucket[]; units: RunUnits }) {
  const { colors, accent, isDark } = useZealTheme();
  const max = Math.max(1, ...buckets.map(b => b.totalMeters));
  return (
    <View style={styles.barChart}>
      <View style={styles.barChartRow}>
        {buckets.map((b, i) => {
          const heightPct = (b.totalMeters / max) * 100;
          const isCurrent = i === buckets.length - 1;
          const barColor = isCurrent ? accent : (isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)');
          return (
            <View key={i} style={styles.barCol}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: `${Math.max(heightPct, b.totalMeters > 0 ? 4 : 0)}%`,
                      backgroundColor: barColor,
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.barLabel,
                  { color: isCurrent ? accent : colors.textMuted, fontFamily: isCurrent ? 'Outfit_700Bold' : 'Outfit_500Medium' },
                ]}
                numberOfLines={1}
              >
                {b.label}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={[styles.barChartFooter, { color: colors.textMuted }]}>
        max {formatDist(max, units, 0)} {units === 'metric' ? 'km' : 'mi'} per week
      </Text>
    </View>
  );
}

// ─── Pace Trend Line Chart (SVG) ────────────────────────────────────────

function PaceTrendChart({ buckets, units }: { buckets: WeeklyTrendBucket[]; units: RunUnits }) {
  const { colors, accent, isDark } = useZealTheme();
  const data = useMemo(() => {
    const valid: { idx: number; pace: number }[] = [];
    buckets.forEach((b, i) => {
      if (b.averagePaceSecondsPerMeter !== null && b.averagePaceSecondsPerMeter > 0) {
        valid.push({ idx: i, pace: b.averagePaceSecondsPerMeter });
      }
    });
    if (valid.length < 2) return null;
    const paces = valid.map(v => v.pace);
    const max = Math.max(...paces) * 1.05;
    const min = Math.min(...paces) * 0.95;
    return { valid, max, min };
  }, [buckets]);

  if (!data) {
    return (
      <View style={styles.chartEmpty}>
        <Text style={[styles.chartEmptyText, { color: colors.textMuted }]}>
          Need at least 2 weeks of running to plot pace.
        </Text>
      </View>
    );
  }

  const VIEW_W = 320;
  const VIEW_H = 100;
  const PADDING_X = 8;
  const PADDING_Y = 12;
  const CHART_W = VIEW_W - PADDING_X * 2;
  const CHART_H = VIEW_H - PADDING_Y * 2;
  const range = Math.max(1, data.max - data.min);

  const points = data.valid.map((v) => {
    const x = PADDING_X + (v.idx / Math.max(1, buckets.length - 1)) * CHART_W;
    // Slower paces (higher seconds) toward the top, faster toward the bottom — invert
    const normalized = (v.pace - data.min) / range;
    const y = PADDING_Y + normalized * CHART_H;
    return { x, y };
  });

  const linePath = points
    .map((pt, i) => (i === 0 ? `M ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}` : `L ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`))
    .join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${VIEW_H - PADDING_Y} L ${points[0].x.toFixed(2)} ${VIEW_H - PADDING_Y} Z`;

  return (
    <View style={[styles.paceChartBox, { borderColor: colors.border }]}>
      <Svg width="100%" height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="paceTrendGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#ef4444" stopOpacity={0.25} />
            <Stop offset="1" stopColor="#22c55e" stopOpacity={0.25} />
          </LinearGradient>
        </Defs>
        <Path d={areaPath} fill="url(#paceTrendGradient)" />
        <Path d={linePath} stroke={accent} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={2.5} fill={accent} />
        ))}
      </Svg>
      <Text style={[styles.paceAxisLabel, styles.paceAxisLabelTop, { color: colors.textMuted }]}>
        {formatPaceUnit(data.max, units)}{units === 'metric' ? '/km' : '/mi'}
      </Text>
      <Text style={[styles.paceAxisLabel, styles.paceAxisLabelBottom, { color: colors.textMuted }]}>
        {formatPaceUnit(data.min, units)}{units === 'metric' ? '/km' : '/mi'}
      </Text>
    </View>
  );
}

// ─── Pace by Run Type Bars ──────────────────────────────────────────────

function PaceByTypeList({ units, history }: { units: RunUnits; history: RunLog[] }) {
  const { colors, accent } = useZealTheme();
  const buckets = useMemo(() => getPaceByRunType(history), [history]);

  if (buckets.length === 0) {
    return <Text style={[styles.chartEmptyText, { color: colors.textMuted }]}>No run-type data yet.</Text>;
  }

  // Find slowest bucket for relative bar width
  const maxPace = Math.max(...buckets.map(b => b.averagePaceSecondsPerMeter));
  const minPace = Math.min(...buckets.map(b => b.averagePaceSecondsPerMeter));
  const range = Math.max(1, maxPace - minPace);

  return (
    <View style={{ gap: 10 }}>
      {buckets.map((b) => {
        // Visual bar — faster types fill less of the bar, slower fill more
        const fillPct = ((b.averagePaceSecondsPerMeter - minPace) / range) * 80 + 20;
        return (
          <View key={b.runType} style={styles.paceTypeRow}>
            <Text style={[styles.paceTypeLabel, { color: colors.text }]}>{b.label}</Text>
            <View style={[styles.paceTypeBarTrack, { backgroundColor: 'rgba(128,128,128,0.12)' }]}>
              <View style={[styles.paceTypeBarFill, { width: `${fillPct}%`, backgroundColor: accent }]} />
            </View>
            <Text style={[styles.paceTypeValue, { color: colors.text }]}>
              {formatPaceUnit(b.averagePaceSecondsPerMeter, units)}
            </Text>
            <Text style={[styles.paceTypeCount, { color: colors.textMuted }]}>
              ({b.count})
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Pace Distribution Histogram ────────────────────────────────────────

function PaceHistogramBars({ history, units }: { history: RunLog[]; units: RunUnits }) {
  const { colors, accent } = useZealTheme();
  const buckets = useMemo(() => getPaceHistogram(history), [history]);
  if (buckets.length === 0) {
    return <Text style={[styles.chartEmptyText, { color: colors.textMuted }]}>Need a few more runs to plot.</Text>;
  }
  const max = Math.max(1, ...buckets.map(b => b.count));

  return (
    <View style={{ gap: 4 }}>
      {buckets.map((b, i) => {
        const widthPct = (b.count / max) * 100;
        const lowMin = Math.floor(b.paceLowSecPerMile / 60);
        const lowSec = b.paceLowSecPerMile % 60;
        const label = `${lowMin}:${String(lowSec).padStart(2, '0')}`;
        return (
          <View key={i} style={styles.histRow}>
            <Text style={[styles.histLabel, { color: colors.textMuted }]}>{label}</Text>
            <View style={[styles.histBarTrack, { backgroundColor: 'rgba(128,128,128,0.10)' }]}>
              <View style={[styles.histBarFill, { width: `${Math.max(widthPct, 4)}%`, backgroundColor: accent }]} />
            </View>
            <Text style={[styles.histCount, { color: colors.text }]}>{b.count}</Text>
          </View>
        );
      })}
      <Text style={[styles.histFooter, { color: colors.textMuted }]}>
        Buckets in 30s/{units === 'metric' ? 'km' : 'mi'} windows.
      </Text>
    </View>
  );
}

// ─── Training Load Card ─────────────────────────────────────────────────

const LOAD_STATUS_COLOR: Record<LoadStatus, string> = {
  insufficient_data: '#888888',
  undertraining: '#60a5fa',
  optimal: '#22c55e',
  overreaching: '#eab308',
  high_risk: '#ef4444',
};
const LOAD_STATUS_LABEL: Record<LoadStatus, string> = {
  insufficient_data: 'Building data',
  undertraining: 'Light load',
  optimal: 'Optimal',
  overreaching: 'Overreaching',
  high_risk: 'High risk',
};

function TrainingLoadCard({ history, units }: { history: RunLog[]; units: RunUnits }) {
  const { colors } = useZealTheme();
  const load = useMemo(() => getTrainingLoad(history), [history]);
  const color = LOAD_STATUS_COLOR[load.status];

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.loadStatusRow}>
        <View style={[styles.loadDot, { backgroundColor: color }]} />
        <Text style={[styles.loadStatusLabel, { color }]}>{LOAD_STATUS_LABEL[load.status]}</Text>
        {load.ratio > 0 && (
          <Text style={[styles.loadRatio, { color: colors.textMuted }]}>
            ratio {load.ratio.toFixed(2)}
          </Text>
        )}
      </View>
      <Text style={[styles.loadMessage, { color: colors.textSecondary }]}>{load.message}</Text>
      <View style={styles.loadStatsRow}>
        <View style={styles.loadStatBox}>
          <Text style={[styles.loadStatValue, { color: colors.text }]}>{formatDist(load.acuteMeters, units, 1)}</Text>
          <Text style={[styles.loadStatLabel, { color: colors.textMuted }]}>last 7 days</Text>
        </View>
        <View style={styles.loadStatBox}>
          <Text style={[styles.loadStatValue, { color: colors.text }]}>{formatDist(load.chronicMeters / 4, units, 1)}</Text>
          <Text style={[styles.loadStatLabel, { color: colors.textMuted }]}>4-wk avg</Text>
        </View>
        {load.weekOverWeekChangePct !== null && (
          <View style={styles.loadStatBox}>
            <Text
              style={[
                styles.loadStatValue,
                { color: load.weekOverWeekIsRisky ? '#ef4444' : colors.text },
              ]}
            >
              {load.weekOverWeekChangePct > 0 ? '+' : ''}
              {load.weekOverWeekChangePct.toFixed(0)}%
            </Text>
            <Text style={[styles.loadStatLabel, { color: colors.textMuted }]}>vs prior wk</Text>
          </View>
        )}
      </View>
      {load.weekOverWeekIsRisky && (
        <View style={[styles.loadWarning, { borderColor: 'rgba(239,68,68,0.35)' }]}>
          <PlatformIcon name="alert-triangle" size={14} color="#ef4444" />
          <Text style={[styles.loadWarningText, { color: colors.text }]}>
            Mileage jumped &gt;10% week-over-week — injury risk increases. Hold steady or pull back.
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Race Predictions Card ──────────────────────────────────────────────

function RacePredictionsCard({ history }: { history: RunLog[] }) {
  const { colors, accent } = useZealTheme();
  const predictions = useMemo(() => getRacePredictions(history), [history]);

  if (predictions.length === 0) {
    return <EmptyState minRuns={1} />;
  }

  return (
    <View style={{ gap: 8 }}>
      {predictions.map((p) => {
        const dotColor = p.confidenceLabel === 'high' ? '#22c55e' : p.confidenceLabel === 'medium' ? '#eab308' : '#888888';
        return (
          <View key={p.distance} style={styles.raceRow}>
            <View style={styles.raceLeft}>
              <Text style={[styles.raceDistance, { color: colors.text }]}>{describeRaceDistance(p.distance)}</Text>
              <View style={styles.raceConfidenceRow}>
                <View style={[styles.raceDot, { backgroundColor: dotColor }]} />
                <Text style={[styles.raceConfidenceText, { color: colors.textMuted }]}>
                  {p.confidenceLabel} confidence
                </Text>
              </View>
            </View>
            <Text style={[styles.raceTime, { color: accent }]}>{formatRaceTime(p.predictedTimeSeconds)}</Text>
          </View>
        );
      })}
      <Text style={[styles.raceFooter, { color: colors.textMuted }]}>
        Based on: {predictions[0]?.sourceDescription}
      </Text>
    </View>
  );
}

// ─── HR Zones Card ──────────────────────────────────────────────────────

function HRZonesCard({ history, age }: { history: RunLog[]; age: number | null }) {
  const { colors } = useZealTheme();
  const maxHR = useMemo(() => {
    const customMaxHR = (history[0] as any)?.maxHRPreference; // future: read from prefs
    return customMaxHR ?? estimateMaxHR(age);
  }, [history, age]);

  if (!maxHR) {
    return (
      <View style={styles.empty}>
        <PlatformIcon name="heart-pulse" size={20} color={colors.textMuted} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Enter your age</Text>
        <Text style={[styles.emptySub, { color: colors.textMuted }]}>
          Add your date of birth in your profile so we can compute training zones.
        </Text>
      </View>
    );
  }

  const zones = buildZones(maxHR);
  const timeInZone = useMemo(() => getTimeInZoneAcrossHistory(history, maxHR), [history, maxHR]);
  const grandTotal = timeInZone.reduce((sum, z) => sum + z.totalSeconds, 0);
  const hasData = grandTotal > 0;

  return (
    <View style={{ gap: 10 }}>
      <Text style={[styles.zonesSubtitle, { color: colors.textMuted }]}>
        Max HR estimate: <Text style={{ color: colors.text, fontFamily: 'Outfit_700Bold' }}>{maxHR} bpm</Text>
      </Text>
      {zones.map((z, i) => {
        const tiz = timeInZone[i];
        return (
          <View key={z.zone} style={styles.zoneRow}>
            <View style={[styles.zoneBadge, { backgroundColor: `${z.color}25`, borderColor: z.color }]}>
              <Text style={[styles.zoneBadgeText, { color: z.color }]}>Z{z.zone}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.zoneName, { color: colors.text }]}>{z.name}</Text>
              <Text style={[styles.zoneDescription, { color: colors.textMuted }]}>
                {z.bpmLow}–{z.bpmHigh} bpm
              </Text>
            </View>
            {hasData ? (
              <View style={styles.zoneTimeBlock}>
                <Text style={[styles.zoneTime, { color: colors.text }]}>{formatHM(tiz.totalSeconds)}</Text>
                <Text style={[styles.zonePct, { color: colors.textMuted }]}>{tiz.pctOfTotal.toFixed(0)}%</Text>
              </View>
            ) : null}
          </View>
        );
      })}
      {!hasData && (
        <Text style={[styles.zonesFooter, { color: colors.textMuted }]}>
          Time-in-zone will appear once your runs include heart-rate data.
        </Text>
      )}
    </View>
  );
}

// ─── Aggregate Stats Strip ──────────────────────────────────────────────

function AggregateStatsStrip({ history, units }: { history: RunLog[]; units: RunUnits }) {
  const { colors, accent } = useZealTheme();
  const stats = useMemo(() => getAggregateStats(history), [history]);

  return (
    <View style={styles.aggregateRow}>
      <View style={styles.aggregateBox}>
        <Text style={[styles.aggregateValue, { color: accent }]}>{stats.totalRuns}</Text>
        <Text style={[styles.aggregateLabel, { color: colors.textMuted }]}>RUNS</Text>
      </View>
      <View style={[styles.aggregateDivider, { backgroundColor: colors.border }]} />
      <View style={styles.aggregateBox}>
        <Text style={[styles.aggregateValue, { color: accent }]}>
          {formatDist(stats.totalDistanceMeters, units, 0)}
        </Text>
        <Text style={[styles.aggregateLabel, { color: colors.textMuted }]}>
          {units === 'metric' ? 'KM' : 'MI'}
        </Text>
      </View>
      <View style={[styles.aggregateDivider, { backgroundColor: colors.border }]} />
      <View style={styles.aggregateBox}>
        <Text style={[styles.aggregateValue, { color: accent }]}>{formatHM(stats.totalDurationSeconds)}</Text>
        <Text style={[styles.aggregateLabel, { color: colors.textMuted }]}>TIME</Text>
      </View>
    </View>
  );
}

// ─── Fastest Splits Leaderboard ─────────────────────────────────────────

function FastestSplitsTable({ history, units, onOpenRun }: { history: RunLog[]; units: RunUnits; onOpenRun?: (id: string) => void }) {
  const { colors, accent } = useZealTheme();
  const splits = useMemo(() => getFastestSplits(history, 10), [history]);
  if (splits.length === 0) {
    return <Text style={[styles.chartEmptyText, { color: colors.textMuted }]}>No splits recorded yet.</Text>;
  }
  return (
    <View style={{ gap: 4 }}>
      {splits.map((s, i) => {
        const distLabel = s.unit === 'metric' ? '1 km' : '1 mi';
        return (
          <TouchableOpacity
            key={`${s.runId}-${s.splitIndex}`}
            style={styles.fastestRow}
            onPress={() => onOpenRun?.(s.runId)}
            activeOpacity={0.7}
          >
            <Text style={[styles.fastestRank, { color: i < 3 ? accent : colors.textMuted }]}>{i + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fastestPace, { color: colors.text }]}>
                {formatPaceUnit(s.paceSecondsPerMeter, s.unit)}
                <Text style={[styles.fastestUnit, { color: colors.textMuted }]}> /{s.unit === 'metric' ? 'km' : 'mi'}</Text>
              </Text>
              <Text style={[styles.fastestMeta, { color: colors.textMuted }]}>
                {distLabel} split · {new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
            </View>
            <PlatformIcon name="chevron-right" size={14} color={colors.textMuted} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Badges Card ────────────────────────────────────────────────────────

const BADGE_CATEGORY_LABELS: Record<RunBadgeCategory, string> = {
  distance: 'Distance',
  pace: 'Pace',
  consistency: 'Consistency',
  variety: 'Variety',
  special: 'Special',
};

function BadgesCard({ history }: { history: RunLog[] }) {
  const { colors, accent, isDark } = useZealTheme();
  const [previewBadge, setPreviewBadge] = useState<RunBadge | null>(null);

  const badges = useMemo(() => computeAllRunBadges(history), [history]);
  const unlockedCount = badges.filter(b => b.unlocked).length;
  const totalCount = badges.length;

  // Group by category for the grid
  const grouped = useMemo(() => {
    const map: Record<RunBadgeCategory, RunBadge[]> = {
      distance: [], pace: [], consistency: [], variety: [], special: [],
    };
    for (const b of badges) map[b.category].push(b);
    return map;
  }, [badges]);

  return (
    <View style={{ gap: 14 }}>
      <View style={styles.badgeProgressRow}>
        <Text style={[styles.badgeProgressValue, { color: accent }]}>
          {unlockedCount}<Text style={[styles.badgeProgressTotal, { color: colors.textMuted }]}> / {totalCount}</Text>
        </Text>
        <Text style={[styles.badgeProgressLabel, { color: colors.textMuted }]}>BADGES EARNED</Text>
      </View>

      {(Object.keys(grouped) as RunBadgeCategory[]).map((cat) => (
        <View key={cat}>
          <Text style={[styles.badgeCategoryLabel, { color: colors.textSecondary }]}>
            {BADGE_CATEGORY_LABELS[cat].toUpperCase()}
          </Text>
          <View style={styles.badgeGrid}>
            {grouped[cat].map((b) => (
              <TouchableOpacity
                key={b.id}
                style={[
                  styles.badgeTile,
                  {
                    backgroundColor: b.unlocked
                      ? `${accent}15`
                      : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'),
                    borderColor: b.unlocked ? `${accent}40` : colors.border,
                  },
                ]}
                onPress={() => setPreviewBadge(b)}
                activeOpacity={0.75}
              >
                <View
                  style={[
                    styles.badgeIconWrap,
                    {
                      backgroundColor: b.unlocked
                        ? `${accent}20`
                        : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                    },
                  ]}
                >
                  {getAchievementIcon(b.iconName, b.unlocked ? accent : colors.textMuted, 18)}
                </View>
                <Text
                  numberOfLines={2}
                  style={[
                    styles.badgeLabel,
                    {
                      color: b.unlocked ? colors.text : colors.textMuted,
                      fontFamily: b.unlocked ? 'Outfit_700Bold' : 'Outfit_500Medium',
                    },
                  ]}
                >
                  {b.label}
                </Text>
                {b.target !== undefined && b.current !== undefined && !b.unlocked && (
                  <Text style={[styles.badgeProgress, { color: colors.textMuted }]}>
                    {Math.round(b.current)}/{b.target}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      <AchievementModal
        visible={previewBadge !== null}
        achievement={previewBadge ? badgeToAchievementShape(previewBadge) : null}
        onClose={() => setPreviewBadge(null)}
      />
    </View>
  );
}

function badgeToAchievementShape(b: RunBadge): Achievement {
  return {
    id: b.id,
    iconName: b.iconName,
    label: b.label,
    description: b.description,
    unlocked: b.unlocked,
    current: b.current,
    target: b.target,
  };
}

// ─── Main Component ─────────────────────────────────────────────────────

export default function RunInsights({ onOpenRun }: Props) {
  const { colors, accent } = useZealTheme();
  const ctx = useAppContext();
  const run = useRun();

  const history = run.runHistory;
  const units = run.preferences.units;
  const age = useMemo(() => ageFromDOB(ctx.dateOfBirth ?? ''), [ctx.dateOfBirth]);

  const weeklyTrend = useMemo(() => getWeeklyTrend(history, 12), [history]);

  if (history.length === 0) {
    return (
      <View style={styles.rootEmpty}>
        <PlatformIcon name="figure-run" size={36} color={colors.textMuted} />
        <Text style={[styles.rootEmptyTitle, { color: colors.text }]}>No runs to analyze yet</Text>
        <Text style={[styles.rootEmptySub, { color: colors.textMuted }]}>
          Save your first run from the Run tab and your insights will appear here.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* ── Aggregate stats strip ─────────────────────────────────── */}
      <GlassCard style={styles.card}>
        <AggregateStatsStrip history={history} units={units} />
      </GlassCard>

      {/* ── Mileage tracker (goal + Last 8 weeks + month/year) ────────
          Moved here from the pre-run idle screen; carries the goal-setting
          UI + monthly/yearly totals in one place. Replaces the old 12-week
          mileage-only chart since this view is a superset. */}
      <GlassCard style={styles.card}>
        <View style={styles.cardHeader}>
          <PlatformIcon name="bar-chart-3" size={14} color={accent} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>Mileage</Text>
        </View>
        <MileageTracker
          runHistory={history}
          units={units}
          weeklyGoalMeters={run.preferences.weeklyMileageGoalMeters}
          onUpdateGoal={(meters) => run.updatePreferences({ weeklyMileageGoalMeters: meters })}
        />
      </GlassCard>

      {/* ── Pace trend ────────────────────────────────────────────── */}
      <GlassCard style={styles.card}>
        <View style={styles.cardHeader}>
          <PlatformIcon name="trending-up" size={14} color={accent} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>Pace trend</Text>
        </View>
        <Text style={[styles.cardSub, { color: colors.textMuted }]}>Average pace per week</Text>
        <PaceTrendChart buckets={weeklyTrend} units={units} />
      </GlassCard>

      {/* ── Pace by run type ──────────────────────────────────────── */}
      <GlassCard style={styles.card}>
        <View style={styles.cardHeader}>
          <PlatformIcon name="activity" size={14} color={accent} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>Pace by run type</Text>
        </View>
        <PaceByTypeList units={units} history={history} />
      </GlassCard>

      {/* ── Race predictions ──────────────────────────────────────── */}
      <GlassCard style={styles.card}>
        <View style={styles.cardHeader}>
          <PlatformIcon name="trophy" size={14} color={accent} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>Race predictions</Text>
        </View>
        <Text style={[styles.cardSub, { color: colors.textMuted }]}>Estimated finish times based on recent efforts</Text>
        <RacePredictionsCard history={history} />
      </GlassCard>

      {/* ── Training load ─────────────────────────────────────────── */}
      <GlassCard style={styles.card}>
        <View style={styles.cardHeader}>
          <PlatformIcon name="zap" size={14} color={accent} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>Training load</Text>
        </View>
        <Text style={[styles.cardSub, { color: colors.textMuted }]}>7-day vs 28-day workload</Text>
        <TrainingLoadCard history={history} units={units} />
      </GlassCard>

      {/* ── Pace distribution ─────────────────────────────────────── */}
      <GlassCard style={styles.card}>
        <View style={styles.cardHeader}>
          <PlatformIcon name="bar-chart" size={14} color={accent} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>Pace distribution</Text>
        </View>
        <Text style={[styles.cardSub, { color: colors.textMuted }]}>How your runs cluster by pace</Text>
        <PaceHistogramBars history={history} units={units} />
      </GlassCard>

      {/* ── Fastest splits ────────────────────────────────────────── */}
      <GlassCard style={styles.card}>
        <View style={styles.cardHeader}>
          <PlatformIcon name="award" size={14} color={accent} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>Fastest splits</Text>
        </View>
        <Text style={[styles.cardSub, { color: colors.textMuted }]}>Top 10 single-mile/km splits</Text>
        <FastestSplitsTable history={history} units={units} onOpenRun={onOpenRun} />
      </GlassCard>

      {/* ── Run badges ────────────────────────────────────────────── */}
      <GlassCard style={styles.card}>
        <View style={styles.cardHeader}>
          <PlatformIcon name="medal" size={14} color={accent} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>Run badges</Text>
        </View>
        <Text style={[styles.cardSub, { color: colors.textMuted }]}>
          Tap any badge for details and progress
        </Text>
        <BadgesCard history={history} />
      </GlassCard>

      {/* ── HR zones ──────────────────────────────────────────────── */}
      <GlassCard style={styles.card}>
        <View style={styles.cardHeader}>
          <PlatformIcon name="heart-pulse" size={14} color={accent} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>Heart rate zones</Text>
        </View>
        <HRZonesCard history={history} age={age} />
      </GlassCard>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
  },
  card: {
    padding: 14,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.2,
  },
  cardSub: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
    marginTop: -2,
    marginBottom: 4,
  },
  // Empty states
  rootEmpty: {
    alignItems: 'center',
    gap: 12,
    padding: 48,
  },
  rootEmptyTitle: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
  rootEmptySub: {
    fontSize: 13,
    fontFamily: 'Outfit_400Regular',
    textAlign: 'center',
    lineHeight: 19,
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  emptyTitle: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
  },
  emptySub: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
    textAlign: 'center',
  },
  chartEmpty: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  chartEmptyText: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
    textAlign: 'center',
  },
  // Aggregate strip
  aggregateRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  aggregateBox: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  aggregateValue: {
    fontSize: 22,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.5,
  },
  aggregateLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.8,
  },
  aggregateDivider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: 3,
  },
  // Bar chart
  barChart: {
    gap: 8,
  },
  barChartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    height: 80,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    height: '100%',
  },
  barTrack: {
    width: '100%',
    flex: 1,
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 5,
    minHeight: 1,
  },
  barLabel: {
    fontSize: 8,
    letterSpacing: 0.2,
  },
  barChartFooter: {
    fontSize: 10,
    fontFamily: 'Outfit_500Medium',
    textAlign: 'right',
  },
  // Pace chart
  paceChartBox: {
    height: 100,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  paceAxisLabel: {
    position: 'absolute',
    fontSize: 9,
    fontFamily: 'Outfit_600SemiBold',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  paceAxisLabelTop: {
    top: 4,
    left: 6,
  },
  paceAxisLabelBottom: {
    bottom: 4,
    left: 6,
  },
  // Pace by type
  paceTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paceTypeLabel: {
    width: 80,
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
  },
  paceTypeBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  paceTypeBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  paceTypeValue: {
    width: 50,
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
    textAlign: 'right',
  },
  paceTypeCount: {
    width: 24,
    fontSize: 10,
    fontFamily: 'Outfit_500Medium',
    textAlign: 'right',
  },
  // Histogram
  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  histLabel: {
    width: 40,
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
  },
  histBarTrack: {
    flex: 1,
    height: 14,
    borderRadius: 4,
    overflow: 'hidden',
  },
  histBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  histCount: {
    width: 24,
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    textAlign: 'right',
  },
  histFooter: {
    marginTop: 4,
    fontSize: 10,
    fontFamily: 'Outfit_500Medium',
  },
  // Training load
  loadStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  loadStatusLabel: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
  },
  loadRatio: {
    marginLeft: 'auto',
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
  },
  loadMessage: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
    lineHeight: 17,
  },
  loadStatsRow: {
    flexDirection: 'row',
    gap: 14,
  },
  loadStatBox: {
    gap: 2,
  },
  loadStatValue: {
    fontSize: 16,
    fontFamily: 'Outfit_800ExtraBold',
  },
  loadStatLabel: {
    fontSize: 9,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.5,
  },
  loadWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: 'rgba(239,68,68,0.06)',
  },
  loadWarningText: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
    lineHeight: 16,
  },
  // Race predictions
  raceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  raceLeft: {
    flex: 1,
    gap: 2,
  },
  raceDistance: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
  },
  raceConfidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  raceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  raceConfidenceText: {
    fontSize: 10,
    fontFamily: 'Outfit_500Medium',
  },
  raceTime: {
    fontSize: 18,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.3,
  },
  raceFooter: {
    marginTop: 6,
    fontSize: 10,
    fontFamily: 'Outfit_500Medium',
  },
  // HR Zones
  zonesSubtitle: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
  },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  zoneBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneBadgeText: {
    fontSize: 13,
    fontFamily: 'Outfit_800ExtraBold',
  },
  zoneName: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
  },
  zoneDescription: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
  },
  zoneTimeBlock: {
    alignItems: 'flex-end',
    gap: 1,
  },
  zoneTime: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
  },
  zonePct: {
    fontSize: 10,
    fontFamily: 'Outfit_500Medium',
  },
  zonesFooter: {
    marginTop: 4,
    fontSize: 10,
    fontFamily: 'Outfit_500Medium',
    fontStyle: 'italic',
  },
  // Fastest splits
  fastestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  fastestRank: {
    width: 18,
    fontSize: 14,
    fontFamily: 'Outfit_800ExtraBold',
    textAlign: 'center',
  },
  fastestPace: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
  },
  fastestUnit: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
  },
  fastestMeta: {
    fontSize: 11,
    fontFamily: 'Outfit_400Regular',
    marginTop: 1,
  },
  // Badges
  badgeProgressRow: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  badgeProgressValue: {
    fontSize: 28,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.5,
  },
  badgeProgressTotal: {
    fontSize: 18,
    fontFamily: 'Outfit_500Medium',
  },
  badgeProgressLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  badgeCategoryLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgeTile: {
    width: '31%',
    minHeight: 88,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  badgeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLabel: {
    fontSize: 9,
    letterSpacing: 0.4,
    textAlign: 'center',
    lineHeight: 12,
  },
  badgeProgress: {
    fontSize: 9,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.3,
  },
});
