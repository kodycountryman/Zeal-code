import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import BaseDrawer from '@/components/drawers/BaseDrawer';
import PlanDayPreviewDrawer from '@/components/drawers/PlanDayPreviewDrawer';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme, useAppContext } from '@/context/AppContext';
import { WORKOUT_STYLE_COLORS } from '@/constants/colors';
import { PHASE_DISPLAY_NAMES, PHASE_COLORS } from '@/services/planConstants';
import type { PlanPhase } from '@/services/planConstants';
import type { DayPrescription } from '@/services/planEngine';
import { getEventMilestones } from '@/services/planEngine';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const PHASE_INITIALS: Record<string, string> = {
  foundation: 'F',
  build: 'B',
  intensify: 'I',
  peak: 'P',
  deload: 'D',
  taper: 'T',
  test: 'TS',
};

function formatDateShort(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return dateStr; }
}

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onClosePlan: () => void;
}

export default function PlanScheduleDrawer({ visible, onClose, onClosePlan }: Props) {
  const { colors, accent } = useZealTheme();
  const ctx = useAppContext();

  const plan = ctx.activePlan;
  const schedule = ctx.planSchedule;

  const styleColor = plan
    ? (WORKOUT_STYLE_COLORS[plan.style as keyof typeof WORKOUT_STYLE_COLORS] ?? accent)
    : accent;

  const today = getTodayStr();

  const currentWeekIdx = useMemo(() => {
    if (!plan || !schedule) return 0;
    const startDate = new Date(plan.startDate + 'T00:00:00');
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, Math.min(Math.floor(diffDays / 7), schedule.weeks.length - 1));
  }, [plan, schedule]);

  const [selectedWeekIdx, setSelectedWeekIdx] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const timelineScrollRef = useRef<ScrollView>(null);

  // Reset to current week when drawer opens
  React.useEffect(() => {
    if (visible && !initialized) {
      setSelectedWeekIdx(currentWeekIdx);
      setInitialized(true);
      // Scroll timeline to current week dot (36px dot + 6px gap = 42px per item)
      setTimeout(() => {
        timelineScrollRef.current?.scrollTo({ x: currentWeekIdx * 42, animated: true });
      }, 200);
    }
    if (!visible) setInitialized(false);
  }, [visible, currentWeekIdx, initialized]);

  const [previewDay, setPreviewDay] = useState<DayPrescription | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  const selectedWeek = schedule?.weeks[selectedWeekIdx] ?? null;

  const milestones = useMemo(() => {
    if (!plan || !schedule) return [];
    return getEventMilestones(plan.event ?? [], plan.planLength, plan.startDate);
  }, [plan, schedule]);

  const currentWeekMilestone = milestones.find(m => m.weekIdx === selectedWeekIdx);

  if (!plan || !schedule) return null;

  const handleSelectWeek = (idx: number) => {
    setSelectedWeekIdx(idx);
    timelineScrollRef.current?.scrollTo({ x: idx * 42, animated: true });
  };

  return (
    <BaseDrawer
      visible={visible}
      onClose={onClose}
      snapPoints={['92%']}
      header={
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Full Workout Plan</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <PlatformIcon name="x" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      }
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Plan name + style */}
        <View style={styles.planMeta}>
          <Text style={[styles.planName, { color: colors.text }]} numberOfLines={1}>
            {plan.name}
          </Text>
          <View style={[styles.styleBadge, { backgroundColor: `${styleColor}20` }]}>
            <Text style={[styles.styleBadgeText, { color: styleColor }]}>{plan.style}</Text>
          </View>
        </View>

        {/* ── Phase timeline ── */}
        <View style={styles.phaseTimeline}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>PHASE TIMELINE</Text>
          <ScrollView
            ref={timelineScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.phaseTimelineScroll}
          >
            {schedule.weeks.map((week, wIdx) => {
              const isSelected = wIdx === selectedWeekIdx;
              const isCurrent = wIdx === currentWeekIdx;
              const phaseColor = PHASE_COLORS[week.phase as PlanPhase] ?? styleColor;
              const dotBorder = isSelected
                ? styleColor
                : isCurrent
                  ? `${styleColor}60`
                  : `${phaseColor}50`;
              const dotBg = isSelected
                ? `${styleColor}25`
                : isCurrent
                  ? `${styleColor}10`
                  : `${phaseColor}12`;

              return (
                <TouchableOpacity
                  key={wIdx}
                  onPress={() => handleSelectWeek(wIdx)}
                  activeOpacity={0.7}
                  style={{ alignItems: 'center', gap: 3 }}
                >
                  <View style={[styles.phaseWeekDot, { backgroundColor: dotBg, borderColor: dotBorder }]}>
                    <Text style={[styles.phaseWeekPhase, { color: isSelected ? styleColor : phaseColor }]}>
                      {PHASE_INITIALS[week.phase] ?? week.phase.charAt(0).toUpperCase()}
                    </Text>
                    <Text style={[styles.phaseWeekNum, { color: isSelected ? styleColor : colors.textMuted }]}>
                      W{week.week_number}
                    </Text>
                    {week.is_deload && (
                      <View style={[styles.deloadDot, { backgroundColor: '#22c55e' }]} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Week navigation */}
        <View style={styles.weekNav}>
          <TouchableOpacity
            onPress={() => handleSelectWeek(Math.max(0, selectedWeekIdx - 1))}
            disabled={selectedWeekIdx === 0}
            activeOpacity={0.7}
            style={[styles.weekNavBtn, { opacity: selectedWeekIdx === 0 ? 0.3 : 1 }]}
          >
            <PlatformIcon name="chevron-left" size={18} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.weekNavCenter}>
            <Text style={[styles.weekNavTitle, { color: colors.text }]}>
              Week {selectedWeek?.week_number ?? selectedWeekIdx + 1}
            </Text>
            {selectedWeek && (
              <View style={[styles.phaseBadge, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                <Text style={[styles.phaseBadgeText, { color: colors.textSecondary }]}>
                  {PHASE_DISPLAY_NAMES[selectedWeek.phase as PlanPhase] ?? selectedWeek.phase}
                  {selectedWeek.is_deload ? ' · Deload' : ''}
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            onPress={() => handleSelectWeek(Math.min(schedule.weeks.length - 1, selectedWeekIdx + 1))}
            disabled={selectedWeekIdx >= schedule.weeks.length - 1}
            activeOpacity={0.7}
            style={[
              styles.weekNavBtn,
              { opacity: selectedWeekIdx >= schedule.weeks.length - 1 ? 0.3 : 1 },
            ]}
          >
            <PlatformIcon name="chevron-right" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Week notes */}
        {selectedWeek?.notes ? (
          <View style={[styles.infoRow, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
            <PlatformIcon name="trending-up" size={12} color={colors.textSecondary} />
            <Text style={[styles.infoRowText, { color: colors.textSecondary }]}>{selectedWeek.notes}</Text>
          </View>
        ) : null}

        {/* Milestone */}
        {currentWeekMilestone && (
          <View style={[styles.infoRow, { backgroundColor: '#f59e0b12', borderColor: '#f59e0b30' }]}>
            <PlatformIcon name="target" size={12} color="#f59e0b" />
            <Text style={[styles.infoRowText, { color: '#f59e0b' }]}>{currentWeekMilestone.label}</Text>
          </View>
        )}

        {/* Day grid */}
        <View style={styles.dayGrid}>
          {selectedWeek?.days.map((day, dIdx) => {
            const isToday = day.date === today;
            const isPast = day.date < today;
            const isMissed = plan.missedDays?.includes(day.date);
            const isCompleted = !day.is_rest && plan.completedDays?.includes(day.date);

            const cardBg = isCompleted
              ? '#22c55e0d'
              : day.is_rest
                ? colors.cardSecondary
                : `${accent}08`;
            const cardBorder = isCompleted
              ? '#22c55e40'
              : isToday
                ? styleColor
                : isMissed
                  ? '#ef444430'
                  : colors.border;

            const CardWrapper = day.is_rest ? View : TouchableOpacity;
            return (
              <CardWrapper
                key={dIdx}
                style={[
                  styles.dayCard,
                  {
                    backgroundColor: cardBg,
                    borderColor: cardBorder,
                    borderWidth: isToday || isCompleted ? 1.5 : 1,
                  },
                ]}
                {...(!day.is_rest && {
                  onPress: () => { setPreviewDay(day); setPreviewVisible(true); },
                  activeOpacity: 0.75,
                })}
              >
                <View style={styles.dayCardHeader}>
                  <Text style={[
                    styles.dayLabel,
                    { color: isCompleted ? '#22c55e' : isToday ? styleColor : colors.textSecondary },
                  ]}>
                    {DAY_LABELS[new Date(day.date + 'T00:00:00').getDay()] ?? `D${dIdx + 1}`}
                  </Text>
                  <View style={styles.dayCardHeaderRight}>
                    {isCompleted && (
                      <PlatformIcon name="check-circle" size={14} color="#22c55e" fill="#22c55e" />
                    )}
                    <Text style={[styles.dayDate, { color: colors.textMuted }]}>
                      {formatDateShort(day.date)}
                    </Text>
                  </View>
                </View>

                {day.is_rest ? (
                  <View style={styles.restContent}>
                    <PlatformIcon name="moon" size={14} color={colors.textMuted} />
                    <Text style={[styles.restLabel, { color: colors.textSecondary }]}>Rest</Text>
                  </View>
                ) : (
                  <View style={styles.trainingContent}>
                    <View style={styles.dayStyleRow}>
                      <PlatformIcon
                        name="dumbbell"
                        size={11}
                        color={isCompleted ? '#22c55e' : isToday ? accent : colors.text}
                      />
                      <Text
                        style={[styles.dayStyleText, { color: isCompleted ? '#22c55e' : isToday ? accent : colors.text }]}
                        numberOfLines={1}
                      >
                        {day.session_type || day.style}
                      </Text>
                    </View>
                    <View style={styles.dayMetaRow}>
                      <PlatformIcon name="clock" size={10} color={colors.textMuted} />
                      <Text style={[styles.dayMetaText, { color: colors.textMuted }]}>
                        {day.target_duration}min
                      </Text>
                    </View>
                    <View style={styles.dayTagRow}>
                      {day.is_deload_week && (
                        <View style={styles.deloadTag}>
                          <Text style={styles.deloadTagText}>Deload</Text>
                        </View>
                      )}
                      {isPast && !day.is_rest && isMissed && !isCompleted && (
                        <View style={styles.missedTag}>
                          <PlatformIcon name="alert-triangle" size={9} color="#ef4444" />
                          <Text style={styles.missedTagText}>Missed</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </CardWrapper>
            );
          })}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      <PlanDayPreviewDrawer
        visible={previewVisible}
        onClose={() => setPreviewVisible(false)}
        onClosePlan={() => { onClose(); onClosePlan(); }}
        day={previewDay}
      />
    </BaseDrawer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(128,128,128,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 16,
    gap: 14,
    paddingBottom: 8,
  },
  planMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  planName: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.3,
    flex: 1,
  },
  styleBadge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  styleBadgeText: {
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
  },
  // Phase timeline
  sectionLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  phaseTimeline: { gap: 0 },
  phaseTimelineScroll: { gap: 6, paddingRight: 16 },
  phaseWeekDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  phaseWeekPhase: {
    fontSize: 11,
    fontFamily: 'Outfit_800ExtraBold',
    lineHeight: 13,
  },
  phaseWeekNum: {
    fontSize: 9,
    fontFamily: 'Outfit_500Medium',
    lineHeight: 11,
  },
  deloadDot: {
    position: 'absolute',
    bottom: -1,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  // Week nav
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekNavBtn: { padding: 4 },
  weekNavCenter: { alignItems: 'center', gap: 4 },
  weekNavTitle: {
    fontSize: 18,
    fontFamily: 'Outfit_800ExtraBold',
  },
  phaseBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  phaseBadgeText: {
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  infoRowText: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
    flex: 1,
  },
  // Day grid
  dayGrid: { gap: 6 },
  dayCard: { borderRadius: 12, padding: 12, gap: 5 },
  dayCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayCardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dayLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.5,
  },
  dayDate: { fontSize: 10, fontFamily: 'Outfit_400Regular' },
  restContent: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  restLabel: { fontSize: 13, fontFamily: 'Outfit_500Medium' },
  trainingContent: { gap: 3 },
  dayStyleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dayStyleText: {
    fontSize: 13,
    fontFamily: 'Outfit_600SemiBold',
    flex: 1,
  },
  dayMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dayMetaText: { fontSize: 11, fontFamily: 'Outfit_400Regular' },
  dayTagRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  deloadTag: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#22c55e20',
  },
  deloadTagText: {
    fontSize: 10,
    fontFamily: 'Outfit_600SemiBold',
    color: '#22c55e',
  },
  missedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#ef444420',
  },
  missedTagText: {
    fontSize: 10,
    fontFamily: 'Outfit_600SemiBold',
    color: '#ef4444',
  },
});
