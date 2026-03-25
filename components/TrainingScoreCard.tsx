import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
  Pressable,
} from 'react-native';
import { ChevronRight, Zap, Target, Flame, Footprints, HeartPulse, Clock, X, Info } from 'lucide-react-native';
import { useZealTheme } from '@/context/AppContext';

interface Props {
  score: number;
  tier: string;
  readiness: number;
  targetDone?: number;
  targetTotal?: number;
  calories?: number | null;
  steps?: number | null;
  heartRate?: number | null;
  weeklyHoursMin?: number;
  onPress: () => void;
}

type MetricKey = 'calories' | 'steps' | 'heartRate' | 'weeklyHours';

interface MetricDetail {
  key: MetricKey;
  label: string;
  value: string;
  unit: string;
  description: string;
  tracking: string;
  tip: string;
}

function formatWeeklyHours(min: number): string {
  if (min === 0) return '0h';
  if (min >= 60) {
    const h = Math.round(min / 60 * 10) / 10;
    return `${h}h`;
  }
  return `${min}m`;
}

function formatSteps(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function TrainingScoreCard({
  score,
  tier,
  readiness,
  targetDone = 0,
  targetTotal = 12,
  calories = null,
  steps = null,
  heartRate = null,
  weeklyHoursMin = 0,
  onPress,
}: Props) {
  const { colors, accent, isDark } = useZealTheme();
  const progressPercent = Math.min((score / 100) * 100, 100);

  const [displayScore, setDisplayScore] = useState<number>(score);
  const prevScoreRef = useRef<number>(score);
  const animRef = useRef<number | null>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [activeMetric, setActiveMetric] = useState<MetricKey | null>(null);

  useEffect(() => {
    const prev = prevScoreRef.current;
    prevScoreRef.current = score;
    if (prev === score) return;

    const diff = score - prev;
    const steps = Math.min(Math.abs(diff), 30);
    const stepDuration = Math.max(20, Math.floor(600 / steps));
    let step = 0;

    if (animRef.current) cancelAnimationFrame(animRef.current);

    const tick = () => {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(prev + diff * eased));
      if (step < steps) {
        setTimeout(() => { animRef.current = requestAnimationFrame(tick); }, stepDuration);
      } else {
        setDisplayScore(score);
        Animated.sequence([
          Animated.spring(scaleAnim, { toValue: 1.08, useNativeDriver: true, speed: 50, bounciness: 12 }),
          Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 8 }),
        ]).start();
      }
    };
    animRef.current = requestAnimationFrame(tick);

    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [score, scaleAnim]);

  const cardShadow = !isDark ? {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  } : {};

  const cardBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const dividerColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const verticalDivider = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.09)';
  const iconColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)';

  const caloriesDisplay = calories !== null && calories > 0 ? String(calories) : '—';
  const stepsDisplay = steps !== null && steps > 0 ? formatSteps(steps) : '—';
  const hrDisplay = heartRate !== null ? `${heartRate}` : '—';
  const hoursDisplay = formatWeeklyHours(weeklyHoursMin);

  const targetCapped = Math.min(targetDone, targetTotal);

  const metricDetails: Record<MetricKey, MetricDetail> = {
    calories: {
      key: 'calories',
      label: 'Calories Burned',
      value: caloriesDisplay,
      unit: caloriesDisplay !== '—' ? 'kcal today' : '',
      description: 'Active calories burned throughout today, including all movement and exercise.',
      tracking: calories !== null && calories > 0
        ? 'Pulled from Apple Health or Google Fit — active energy data synced automatically.'
        : 'No health data connected. Connect Apple Health or Google Fit in settings to enable.',
      tip: 'Active calories exclude your basal metabolic rate. A typical workout burns 200–600 kcal depending on intensity.',
    },
    steps: {
      key: 'steps',
      label: 'Steps Today',
      value: stepsDisplay,
      unit: stepsDisplay !== '—' ? 'steps' : '',
      description: 'Total steps taken today tracked by your device accelerometer.',
      tracking: steps !== null && steps > 0
        ? 'Synced from Apple Health or Google Fit step count data.'
        : 'No health data connected. Connect Apple Health or Google Fit in settings to enable.',
      tip: '10,000 steps a day is a widely cited target, but research shows 7,000–8,000 provides most of the health benefit.',
    },
    heartRate: {
      key: 'heartRate',
      label: 'Resting Heart Rate',
      value: hrDisplay,
      unit: hrDisplay !== '—' ? 'bpm' : '',
      description: "Your resting heart rate — the number of times your heart beats per minute while at rest.",
      tracking: heartRate !== null
        ? 'Pulled from Apple Health or Google Fit — averaged from your most recent resting HR readings.'
        : 'No heart rate data available. A compatible wearable or Apple Watch is needed.',
      tip: 'A lower resting HR generally indicates better cardiovascular fitness. Elite athletes often sit between 40–60 bpm.',
    },
    weeklyHours: {
      key: 'weeklyHours',
      label: 'Hours Trained',
      value: hoursDisplay,
      unit: 'this week',
      description: 'Total training time logged across all workouts this week (Monday–Sunday).',
      tracking: 'Calculated from your workout logs in Zeal. Every logged session contributes to this total.',
      tip: 'Most training goals align with 3–6 hours of structured training per week depending on intensity and recovery.',
    },
  };

  const activeDetail = activeMetric ? metricDetails[activeMetric] : null;

  const modalBg = isDark ? '#1c1c1c' : '#ffffff';
  const modalBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  const MetricIcon = ({ metricKey, size }: { metricKey: MetricKey; size: number }) => {
    if (metricKey === 'calories') return <Flame size={size} color={iconColor} strokeWidth={2.5} />;
    if (metricKey === 'steps') return <Footprints size={size} color={iconColor} strokeWidth={2.5} />;
    if (metricKey === 'heartRate') return <HeartPulse size={size} color={iconColor} strokeWidth={2.5} />;
    return <Clock size={size} color={iconColor} strokeWidth={2.5} />;
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderWidth: 1, borderColor: cardBorder }, cardShadow]}
        onPress={onPress}
        testID="training-score-card"
        activeOpacity={0.85}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              TRAINING SCORE
            </Text>
            <Text style={[styles.tier, { color: accent }]}>{tier}</Text>
          </View>
          <ChevronRight size={16} color={colors.textSecondary} />
        </View>

        <Animated.Text style={[styles.scoreNumber, { color: colors.score, transform: [{ scale: scaleAnim }] }]}>{displayScore}</Animated.Text>

        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${progressPercent}%` as any, backgroundColor: colors.score },
            ]}
          />
        </View>

        <View style={styles.readinessRow}>
          <View style={styles.readinessLeft}>
            <Zap size={11} color={colors.readiness} fill={colors.readiness} />
            <Text style={[styles.readinessLabel, { color: colors.textSecondary }]}>
              READINESS{' '}
            </Text>
            <Text style={[styles.readinessValue, { color: colors.readiness }]}>
              {readiness}%
            </Text>
          </View>
          <View style={styles.targetRight}>
            <Target size={11} color={colors.textSecondary} />
            <Text style={[styles.readinessLabel, { color: colors.textSecondary }]}>
              {' '}TARGET{' '}
            </Text>
            <Text style={[styles.targetValue, { color: colors.text }]}>
              {targetCapped}
              <Text style={[styles.targetTotal, { color: colors.textSecondary }]}>/{targetTotal}</Text>
            </Text>
          </View>
        </View>

        <View style={[styles.metricsDivider, { backgroundColor: dividerColor }]} />

        <View style={styles.metricsRow}>
          {(['calories', 'steps', 'heartRate', 'weeklyHours'] as MetricKey[]).map((key, index) => {
            const detail = metricDetails[key];
            return (
              <React.Fragment key={key}>
                {index > 0 && <View style={[styles.verticalDivider, { backgroundColor: verticalDivider }]} />}
                <TouchableOpacity
                  style={styles.metricCol}
                  onPress={(e) => {
                    e.stopPropagation();
                    setActiveMetric(key);
                  }}
                  activeOpacity={0.6}
                  testID={`metric-${key}`}
                >
                  <MetricIcon metricKey={key} size={15} />
                  <Text style={[styles.metricValue, { color: colors.text }]}>{detail.value}</Text>
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </View>
      </TouchableOpacity>

      <Modal
        visible={activeMetric !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveMetric(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setActiveMetric(null)}>
          <Pressable
            style={[styles.modalSheet, { backgroundColor: modalBg, borderColor: modalBorder }]}
            onPress={(e) => e.stopPropagation()}
          >
            {activeDetail && (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.modalTitleRow}>
                    <MetricIcon metricKey={activeDetail.key} size={18} />
                    <Text style={[styles.modalTitle, { color: colors.text }]}>{activeDetail.label}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setActiveMetric(null)} hitSlop={12}>
                    <X size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <View style={[styles.modalValueRow, { borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }]}>
                  <Text style={[styles.modalBigValue, { color: colors.text }]}>
                    {activeDetail.value}
                  </Text>
                  {activeDetail.unit ? (
                    <Text style={[styles.modalUnit, { color: colors.textSecondary }]}>{activeDetail.unit}</Text>
                  ) : null}
                </View>

                <View style={styles.modalSection}>
                  <Text style={[styles.modalSectionLabel, { color: colors.textSecondary }]}>WHAT IT MEASURES</Text>
                  <Text style={[styles.modalBody, { color: colors.text }]}>{activeDetail.description}</Text>
                </View>

                <View style={[styles.modalDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]} />

                <View style={styles.modalSection}>
                  <Text style={[styles.modalSectionLabel, { color: colors.textSecondary }]}>HOW IT'S TRACKED</Text>
                  <Text style={[styles.modalBody, { color: colors.text }]}>{activeDetail.tracking}</Text>
                </View>

                <View style={[styles.modalDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]} />

                <View style={[styles.modalTipRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
                  <Info size={13} color={colors.textSecondary} strokeWidth={2} />
                  <Text style={[styles.modalTip, { color: colors.textSecondary }]}>{activeDetail.tip}</Text>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  tier: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  scoreNumber: {
    fontSize: 44,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -2,
    lineHeight: 48,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    minWidth: 8,
  },
  readinessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  readinessLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  targetRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  readinessLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  readinessValue: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  targetValue: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  targetTotal: {
    fontSize: 10,
    fontWeight: '500',
  },
  metricsDivider: {
    height: 1,
    marginHorizontal: -20,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricCol: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
    paddingVertical: 2,
  },
  verticalDivider: {
    width: 1,
    height: 34,
  },
  metricValue: {
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalSheet: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  modalValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  modalBigValue: {
    fontSize: 36,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -1.5,
  },
  modalUnit: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  modalSection: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 5,
  },
  modalSectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  modalBody: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  modalDivider: {
    height: 1,
    marginHorizontal: 20,
  },
  modalTipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 10,
  },
  modalTip: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '400',
  },
});
