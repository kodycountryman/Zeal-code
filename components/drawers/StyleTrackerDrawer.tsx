import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BaseDrawer from '@/components/drawers/BaseDrawer';
import GlassCard from '@/components/GlassCard';
import Svg, { Polyline, Line, Circle as SvgCircle } from 'react-native-svg';
import { PlatformIcon } from '@/components/PlatformIcon';
import { TouchableOpacity } from 'react-native';
import { useZealTheme, useAppContext } from '@/context/AppContext';
import { useWorkoutTracking } from '@/context/WorkoutTrackingContext';
import { WORKOUT_STYLE_COLORS } from '@/constants/colors';
import {
  getStyleTrackerData,
  type StyleTrackerData,
  type StrengthTrackerData,
  type BodybuildingTrackerData,
  type CrossFitTrackerData,
  type HIITTrackerData,
  type HyroxTrackerData,
  type MobilityTrackerData,
  type LowImpactTrackerData,
} from '@/services/insightsEngine';

interface Props {
  visible: boolean;
  onClose: () => void;
}

// ─── Mini Sparkline ─────────────────────────────────────────

function Sparkline({ data, width = 120, height = 32, color }: { data: number[]; width?: number; height?: number; color: string }) {
  if (data.length < 2) return null;
  const maxVal = Math.max(...data, 1);
  const minVal = Math.min(...data, 0);
  const range = maxVal - minVal || 1;
  const padding = 4;
  const w = width - padding * 2;
  const h = height - padding * 2;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * w;
    const y = padding + h - ((v - minVal) / range) * h;
    return `${x},${y}`;
  }).join(' ');

  return (
    <Svg width={width} height={height}>
      <Polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {data.length > 0 && (() => {
        const lastX = padding + ((data.length - 1) / (data.length - 1)) * w;
        const lastY = padding + h - ((data[data.length - 1] - minVal) / range) * h;
        return <SvgCircle cx={lastX} cy={lastY} r={3} fill={color} />;
      })()}
    </Svg>
  );
}

// ─── Section helpers ────────────────────────────────────────

function SectionLabel({ text, color }: { text: string; color: string }) {
  return <Text style={[styles.sectionLabel, { color }]}>{text}</Text>;
}

function StatRow({ label, value, valueColor, labelColor }: { label: string; value: string; valueColor: string; labelColor: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={[styles.statLabel, { color: labelColor }]}>{label}</Text>
      <Text style={[styles.statValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

function HorizontalBar({ label, value, maxValue, color, labelColor, valueLabel }: {
  label: string; value: number; maxValue: number; color: string; labelColor: string; valueLabel: string;
}) {
  const pct = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
  return (
    <View style={styles.hBarRow}>
      <Text style={[styles.hBarLabel, { color: labelColor }]}>{label}</Text>
      <View style={styles.hBarArea}>
        <View style={[styles.hBarTrack, { backgroundColor: `${color}15` }]}>
          <View style={[styles.hBarFill, { width: `${Math.max(pct, 2)}%` as any, backgroundColor: color }]} />
        </View>
        <Text style={[styles.hBarValue, { color: labelColor }]}>{valueLabel}</Text>
      </View>
    </View>
  );
}

function WeekChart({ data, accent, colors: themeColors }: { data: { week: string; count: number }[]; accent: string; colors: any }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);
  return (
    <View style={styles.weekChart}>
      {data.map((d, i) => {
        const h = d.count > 0 ? Math.max((d.count / maxCount) * 36, 4) : 2;
        const isLast = i === data.length - 1;
        return (
          <View key={d.week} style={styles.weekCol}>
            <View style={[styles.weekBar, { height: h, backgroundColor: isLast ? accent : `${accent}55` }]} />
            <Text style={[styles.weekLabel, { color: isLast ? accent : themeColors.textMuted }]} numberOfLines={1}>{d.week}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Style Renderers ────────────────────────────────────────

function StrengthContent({ data, accent, colors: c, mutedLabel }: { data: StrengthTrackerData; accent: string; colors: any; mutedLabel: string }) {
  return (
    <View style={styles.contentGap}>
      {/* Lift sparklines */}
      {data.liftHistory.length > 0 && (
        <GlassCard>
          <View style={styles.cardInner}>
            <SectionLabel text="1RM PROGRESSION" color={mutedLabel} />
            {data.liftHistory.map((lift) => (
              <View key={lift.name} style={styles.sparklineRow}>
                <View style={styles.sparklineInfo}>
                  <Text style={[styles.sparklineName, { color: c.text }]}>{lift.name}</Text>
                  <Text style={[styles.sparklineValue, { color: accent }]}>
                    {lift.dataPoints[lift.dataPoints.length - 1]?.e1rm ?? 0} lb
                  </Text>
                </View>
                <Sparkline data={lift.dataPoints.map(d => d.e1rm)} color={accent} />
              </View>
            ))}
          </View>
        </GlassCard>
      )}

      {/* DOTS */}
      {data.dotsScore !== null && (
        <GlassCard>
          <View style={styles.cardInner}>
            <SectionLabel text="DOTS SCORE" color={mutedLabel} />
            <View style={styles.dotsRow}>
              <Text style={[styles.dotsValue, { color: accent }]}>{data.dotsScore}</Text>
              <Text style={[styles.dotsDesc, { color: c.textSecondary }]}>Normalized powerlifting total</Text>
            </View>
          </View>
        </GlassCard>
      )}

      {/* Rep range */}
      {data.repRangeDistribution.length > 0 && (
        <GlassCard>
          <View style={styles.cardInner}>
            <SectionLabel text="REP RANGE DISTRIBUTION" color={mutedLabel} />
            {data.repRangeDistribution.map((r) => (
              <HorizontalBar key={r.range} label={r.range} value={r.pct} maxValue={100} color={accent} labelColor={c.textSecondary} valueLabel={`${r.pct}%`} />
            ))}
          </View>
        </GlassCard>
      )}

      {/* Split frequency */}
      {data.splitFrequency.length > 0 && (
        <GlassCard>
          <View style={styles.cardInner}>
            <SectionLabel text="SPLIT FREQUENCY" color={mutedLabel} />
            {data.splitFrequency.slice(0, 5).map((s) => (
              <StatRow key={s.split} label={s.split} value={`${s.count}x`} valueColor={c.text} labelColor={c.textSecondary} />
            ))}
          </View>
        </GlassCard>
      )}

      {/* Volume per session */}
      {data.volumePerSession.length > 0 && (
        <GlassCard>
          <View style={styles.cardInner}>
            <SectionLabel text="SESSION VOLUME TREND" color={mutedLabel} />
            <Sparkline data={data.volumePerSession.map(v => v.volume)} width={280} height={48} color={accent} />
          </View>
        </GlassCard>
      )}
    </View>
  );
}

function BodybuildingContent({ data, accent, colors: c, mutedLabel }: { data: BodybuildingTrackerData; accent: string; colors: any; mutedLabel: string }) {
  const maxSets = Math.max(...data.muscleVolumeWeekly.map(m => m.recommended[1]), 1);
  return (
    <View style={styles.contentGap}>
      <GlassCard>
        <View style={styles.cardInner}>
          <SectionLabel text="WEEKLY SETS PER MUSCLE" color={mutedLabel} />
          {data.muscleVolumeWeekly.filter(m => m.sets > 0 || m.recommended[0] > 0).map((m) => (
            <HorizontalBar
              key={m.muscle}
              label={m.muscle}
              value={m.sets}
              maxValue={maxSets}
              color={m.sets < m.recommended[0] ? '#ef4444' : accent}
              labelColor={c.textSecondary}
              valueLabel={`${m.sets}/${m.recommended[0]}-${m.recommended[1]}`}
            />
          ))}
        </View>
      </GlassCard>

      <GlassCard>
        <View style={styles.cardInner}>
          <SectionLabel text="HYPERTROPHY METRICS" color={mutedLabel} />
          <View style={styles.metricsRow}>
            <View style={styles.metricBox}>
              <Text style={[styles.metricBigValue, { color: accent }]}>{data.pumpScore}</Text>
              <Text style={[styles.metricBoxLabel, { color: c.textMuted }]}>Pump Sets (8-12 reps)</Text>
            </View>
          </View>
          {data.weakPoints.length > 0 && (
            <View style={{ marginTop: 4 }}>
              <Text style={[styles.weakPointsLabel, { color: '#ef4444' }]}>Weak points: {data.weakPoints.join(', ')}</Text>
            </View>
          )}
        </View>
      </GlassCard>

      {data.volumeTrend.some(v => v.volume > 0) && (
        <GlassCard>
          <View style={styles.cardInner}>
            <SectionLabel text="VOLUME TREND" color={mutedLabel} />
            <Sparkline data={data.volumeTrend.map(v => v.volume)} width={280} height={48} color={accent} />
          </View>
        </GlassCard>
      )}
    </View>
  );
}

function CrossFitContent({ data, accent, colors: c, mutedLabel }: { data: CrossFitTrackerData; accent: string; colors: any; mutedLabel: string }) {
  return (
    <View style={styles.contentGap}>
      <GlassCard>
        <View style={styles.cardInner}>
          <SectionLabel text="OVERVIEW" color={mutedLabel} />
          <View style={styles.metricsRow}>
            <View style={styles.metricBox}>
              <Text style={[styles.metricBigValue, { color: c.text }]}>{data.totalSessions}</Text>
              <Text style={[styles.metricBoxLabel, { color: c.textMuted }]}>Sessions (4 wk)</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={[styles.metricBigValue, { color: c.text }]}>{data.avgRPE ?? '-'}</Text>
              <Text style={[styles.metricBoxLabel, { color: c.textMuted }]}>Avg RPE</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={[styles.metricBigValue, { color: c.text }]}>{data.avgDuration}m</Text>
              <Text style={[styles.metricBoxLabel, { color: c.textMuted }]}>Avg Duration</Text>
            </View>
          </View>
        </View>
      </GlassCard>

      <GlassCard>
        <View style={styles.cardInner}>
          <SectionLabel text="SESSIONS PER WEEK" color={mutedLabel} />
          <WeekChart data={data.sessionsPerWeek} accent={accent} colors={c} />
        </View>
      </GlassCard>

      {data.movementCoverage.length > 0 && (
        <GlassCard>
          <View style={styles.cardInner}>
            <SectionLabel text="MOVEMENT COVERAGE" color={mutedLabel} />
            {data.movementCoverage.map((m) => (
              <HorizontalBar key={m.pattern} label={m.pattern} value={m.count} maxValue={Math.max(...data.movementCoverage.map(x => x.count), 1)} color={accent} labelColor={c.textSecondary} valueLabel={`${m.count}`} />
            ))}
          </View>
        </GlassCard>
      )}
    </View>
  );
}

function HIITContent({ data, accent, colors: c, mutedLabel }: { data: HIITTrackerData; accent: string; colors: any; mutedLabel: string }) {
  const avgGap = data.recoveryGaps.length > 0 ? Math.round(data.recoveryGaps.reduce((s, g) => s + g, 0) / data.recoveryGaps.length * 10) / 10 : null;
  return (
    <View style={styles.contentGap}>
      <GlassCard>
        <View style={styles.cardInner}>
          <SectionLabel text="OVERVIEW" color={mutedLabel} />
          <View style={styles.metricsRow}>
            <View style={styles.metricBox}>
              <Text style={[styles.metricBigValue, { color: c.text }]}>{data.avgDuration}m</Text>
              <Text style={[styles.metricBoxLabel, { color: c.textMuted }]}>Avg Duration</Text>
            </View>
            {data.avgCalories !== null && (
              <View style={styles.metricBox}>
                <Text style={[styles.metricBigValue, { color: c.text }]}>{data.avgCalories}</Text>
                <Text style={[styles.metricBoxLabel, { color: c.textMuted }]}>Avg Calories</Text>
              </View>
            )}
            {avgGap !== null && (
              <View style={styles.metricBox}>
                <Text style={[styles.metricBigValue, { color: c.text }]}>{avgGap}d</Text>
                <Text style={[styles.metricBoxLabel, { color: c.textMuted }]}>Avg Recovery</Text>
              </View>
            )}
          </View>
        </View>
      </GlassCard>

      <GlassCard>
        <View style={styles.cardInner}>
          <SectionLabel text="SESSIONS PER WEEK" color={mutedLabel} />
          <WeekChart data={data.sessionsPerWeek} accent={accent} colors={c} />
        </View>
      </GlassCard>

      {data.intensityCurve.length >= 2 && (
        <GlassCard>
          <View style={styles.cardInner}>
            <SectionLabel text="INTENSITY CURVE (RPE)" color={mutedLabel} />
            <Sparkline data={data.intensityCurve.map(d => d.rpe)} width={280} height={48} color={accent} />
          </View>
        </GlassCard>
      )}
    </View>
  );
}

function HyroxContent({ data, accent, colors: c, mutedLabel }: { data: HyroxTrackerData; accent: string; colors: any; mutedLabel: string }) {
  const maxDur = Math.max(...data.stationTimes.map(s => s.avgDuration), 1);
  return (
    <View style={styles.contentGap}>
      <GlassCard>
        <View style={styles.cardInner}>
          <SectionLabel text="OVERVIEW" color={mutedLabel} />
          <View style={styles.metricsRow}>
            <View style={styles.metricBox}>
              <Text style={[styles.metricBigValue, { color: c.text }]}>{data.totalSessions}</Text>
              <Text style={[styles.metricBoxLabel, { color: c.textMuted }]}>Total Sessions</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={[styles.metricBigValue, { color: c.text }]}>{data.avgSessionDuration}m</Text>
              <Text style={[styles.metricBoxLabel, { color: c.textMuted }]}>Avg Duration</Text>
            </View>
          </View>
        </View>
      </GlassCard>

      <GlassCard>
        <View style={styles.cardInner}>
          <SectionLabel text="STATION TIMES" color={mutedLabel} />
          {data.stationTimes.map((s) => (
            <HorizontalBar
              key={s.station}
              label={s.station}
              value={s.avgDuration}
              maxValue={maxDur}
              color={s.station === data.weakestStation ? '#ef4444' : accent}
              labelColor={c.textSecondary}
              valueLabel={s.avgDuration > 0 ? `${s.avgDuration}m` : '—'}
            />
          ))}
          {data.weakestStation && (
            <Text style={[styles.weakPointsLabel, { color: '#ef4444', marginTop: 6 }]}>
              Focus area: {data.weakestStation}
            </Text>
          )}
        </View>
      </GlassCard>
    </View>
  );
}

function MobilityContent({ data, accent, colors: c, mutedLabel }: { data: MobilityTrackerData; accent: string; colors: any; mutedLabel: string }) {
  return (
    <View style={styles.contentGap}>
      <GlassCard>
        <View style={styles.cardInner}>
          <SectionLabel text="OVERVIEW" color={mutedLabel} />
          <View style={styles.metricsRow}>
            <View style={styles.metricBox}>
              <Text style={[styles.metricBigValue, { color: c.text }]}>{data.totalSessions}</Text>
              <Text style={[styles.metricBoxLabel, { color: c.textMuted }]}>Total Sessions</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={[styles.metricBigValue, { color: c.text }]}>{data.consistencyStreak}w</Text>
              <Text style={[styles.metricBoxLabel, { color: c.textMuted }]}>Week Streak</Text>
            </View>
          </View>
        </View>
      </GlassCard>

      <GlassCard>
        <View style={styles.cardInner}>
          <SectionLabel text="SESSIONS PER WEEK" color={mutedLabel} />
          <WeekChart data={data.sessionsPerWeek} accent={accent} colors={c} />
        </View>
      </GlassCard>

      {data.areaCoverage.length > 0 && (
        <GlassCard>
          <View style={styles.cardInner}>
            <SectionLabel text="BODY AREA COVERAGE" color={mutedLabel} />
            {data.areaCoverage.slice(0, 8).map((a) => (
              <HorizontalBar key={a.area} label={a.area} value={a.minutes} maxValue={Math.max(...data.areaCoverage.map(x => x.minutes), 1)} color={accent} labelColor={c.textSecondary} valueLabel={`${a.minutes}m`} />
            ))}
          </View>
        </GlassCard>
      )}

      {data.rpeTrend.length >= 2 && (
        <GlassCard>
          <View style={styles.cardInner}>
            <SectionLabel text="RPE TREND" color={mutedLabel} />
            <Sparkline data={data.rpeTrend.map(d => d.rpe)} width={280} height={48} color={accent} />
          </View>
        </GlassCard>
      )}
    </View>
  );
}

function LowImpactContent({ data, accent, colors: c, mutedLabel }: { data: LowImpactTrackerData; accent: string; colors: any; mutedLabel: string }) {
  return (
    <View style={styles.contentGap}>
      <GlassCard>
        <View style={styles.cardInner}>
          <SectionLabel text="OVERVIEW" color={mutedLabel} />
          <View style={styles.metricsRow}>
            <View style={styles.metricBox}>
              <Text style={[styles.metricBigValue, { color: c.text }]}>{data.avgDuration}m</Text>
              <Text style={[styles.metricBoxLabel, { color: c.textMuted }]}>Avg Duration</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={[styles.metricBigValue, { color: c.text }]}>{data.exerciseVariety}</Text>
              <Text style={[styles.metricBoxLabel, { color: c.textMuted }]}>Exercise Variety</Text>
            </View>
          </View>
        </View>
      </GlassCard>

      <GlassCard>
        <View style={styles.cardInner}>
          <SectionLabel text="SESSIONS PER WEEK" color={mutedLabel} />
          <WeekChart data={data.sessionsPerWeek} accent={accent} colors={c} />
        </View>
      </GlassCard>

      {data.bodyFocus.length > 0 && (
        <GlassCard>
          <View style={styles.cardInner}>
            <SectionLabel text="BODY FOCUS" color={mutedLabel} />
            {data.bodyFocus.slice(0, 6).map((b) => (
              <HorizontalBar key={b.area} label={b.area} value={b.pct} maxValue={100} color={accent} labelColor={c.textSecondary} valueLabel={`${b.pct}%`} />
            ))}
          </View>
        </GlassCard>
      )}

      {data.rpeTrend.length >= 2 && (
        <GlassCard>
          <View style={styles.cardInner}>
            <SectionLabel text="RPE TREND" color={mutedLabel} />
            <Sparkline data={data.rpeTrend.map(d => d.rpe)} width={280} height={48} color={accent} />
          </View>
        </GlassCard>
      )}
    </View>
  );
}

// ─── Main Component ─────────────────────────────────────────

export default function StyleTrackerDrawer({ visible, onClose }: Props) {
  const { colors, isDark } = useZealTheme();
  const ctx = useAppContext();
  const tracking = useWorkoutTracking();

  const style = ctx.workoutStyle;
  const styleColor = WORKOUT_STYLE_COLORS[style] ?? '#f87116';
  const mutedLabel = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.40)';

  const trackerData = useMemo(() => {
    return getStyleTrackerData(
      style,
      tracking.workoutHistory,
      tracking.prHistory,
      { sex: ctx.sex === 'female' ? 'female' : 'male', weight: ctx.weight || 160 },
    );
  }, [style, tracking.workoutHistory, tracking.prHistory, ctx.sex, ctx.weight]);

  const headerContent = (
    <View style={styles.header}>
      <View>
        <Text style={[styles.headerLabel, { color: styleColor }]}>{style.toUpperCase()} TRACKER</Text>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Deep Dive</Text>
      </View>
      <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.closeBtn}>
        <PlatformIcon name="x" size={22} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );

  return (
    <BaseDrawer visible={visible} onClose={onClose} header={headerContent} stackBehavior="push">
      <View style={styles.scrollContent}>
        {trackerData.type === 'strength' && <StrengthContent data={trackerData} accent={styleColor} colors={colors} mutedLabel={mutedLabel} />}
        {trackerData.type === 'bodybuilding' && <BodybuildingContent data={trackerData} accent={styleColor} colors={colors} mutedLabel={mutedLabel} />}
        {trackerData.type === 'crossfit' && <CrossFitContent data={trackerData} accent={styleColor} colors={colors} mutedLabel={mutedLabel} />}
        {trackerData.type === 'hiit' && <HIITContent data={trackerData} accent={styleColor} colors={colors} mutedLabel={mutedLabel} />}
        {trackerData.type === 'hyrox' && <HyroxContent data={trackerData} accent={styleColor} colors={colors} mutedLabel={mutedLabel} />}
        {trackerData.type === 'mobility' && <MobilityContent data={trackerData} accent={styleColor} colors={colors} mutedLabel={mutedLabel} />}
        {trackerData.type === 'low_impact' && <LowImpactContent data={trackerData} accent={styleColor} colors={colors} mutedLabel={mutedLabel} />}

        <View style={{ height: 60 }} />
      </View>
    </BaseDrawer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: 2 },
  headerTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  closeBtn: { padding: 4, marginTop: 4 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 20 },
  contentGap: { gap: 12 },
  cardInner: { padding: 16, gap: 10 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 2 },

  // Sparkline rows
  sparklineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  sparklineInfo: { gap: 2 },
  sparklineName: { fontSize: 13, fontWeight: '700' },
  sparklineValue: { fontSize: 15, fontWeight: '800' },

  // Stat rows
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  statLabel: { fontSize: 12, fontWeight: '600' },
  statValue: { fontSize: 13, fontWeight: '700' },

  // Horizontal bars
  hBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  hBarLabel: { fontSize: 11, fontWeight: '600', width: 68 },
  hBarArea: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  hBarTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  hBarFill: { height: '100%', borderRadius: 3, minWidth: 2 },
  hBarValue: { fontSize: 10, fontWeight: '600', width: 56, textAlign: 'right' },

  // Metrics
  metricsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  metricBox: { alignItems: 'center', gap: 3 },
  metricBigValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  metricBoxLabel: { fontSize: 9, fontWeight: '600', letterSpacing: 0.3, textAlign: 'center' },

  // DOTS
  dotsRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  dotsValue: { fontSize: 32, fontWeight: '800', letterSpacing: -1 },
  dotsDesc: { fontSize: 12, fontWeight: '500' },

  // Weak points
  weakPointsLabel: { fontSize: 11, fontWeight: '700' },

  // Week chart
  weekChart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 48 },
  weekCol: { alignItems: 'center', flex: 1, gap: 3 },
  weekBar: { width: 14, borderRadius: 3 },
  weekLabel: { fontSize: 7, fontWeight: '600' },
});
