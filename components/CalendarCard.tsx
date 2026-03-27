import React, { useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Calendar, Flame, Check } from 'lucide-react-native';
import { useZealTheme } from '@/context/AppContext';
import { getContrastTextColor, WORKOUT_STYLE_COLORS } from '@/constants/colors';
import type { PlannedWorkout } from '@/context/AppContext';
import GlassCard from '@/components/GlassCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CELL_WIDTH = 56;
const CELL_GAP = 6;
const STREAK_WIDTH = 56;
const CAL_BTN_WIDTH = 48;
const SIDE_PADDING = 12;

interface CalendarDay {
  abbr: string;
  num: number;
  fullDate: string;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  dayOffset: number;
}

function buildDays(): CalendarDay[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const days: CalendarDay[] = [];
  for (let i = -7; i <= 6; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    days.push({
      abbr: i === 0 ? 'TODAY' : dayNames[d.getDay()],
      num: d.getDate(),
      fullDate: dateStr,
      isToday: i === 0,
      isPast: i < 0,
      isFuture: i > 0,
      dayOffset: i,
    });
  }
  return days;
}

interface Props {
  streak: number;
  onStreakPress: () => void;
  onCalendarPress?: () => void;
  onDayPress?: (dateStr: string, dayOffset: number) => void;
  completedDates?: Set<string>;
  plannedWorkouts?: PlannedWorkout[];
  variant?: 'solid' | 'glass';
}

export default function CalendarCard({
  streak,
  onStreakPress,
  onCalendarPress,
  onDayPress,
  completedDates,
  plannedWorkouts,
  variant = 'solid',
}: Props) {
  const { colors, accent, isDark } = useZealTheme();
  const scrollRef = useRef<ScrollView>(null);
  const days = useMemo(() => buildDays(), []);

  const plannedMap = useMemo(() => {
    const map: Record<string, PlannedWorkout> = {};
    if (plannedWorkouts) {
      for (const pw of plannedWorkouts) {
        map[pw.date] = pw;
      }
    }
    return map;
  }, [plannedWorkouts]);

  useEffect(() => {
    const todayIndex = days.findIndex(d => d.isToday);
    // Default open position: yesterday → today → two days ahead.
    // Each item = CELL_WIDTH + divider (hairlineWidth + CELL_GAP margins both sides).
    const itemStep = CELL_WIDTH + StyleSheet.hairlineWidth + CELL_GAP;
    const startIdx = Math.max(0, todayIndex - 1);
    const scrollTo = startIdx * itemStep;
    setTimeout(() => {
      scrollRef.current?.scrollTo({ x: Math.max(0, scrollTo), animated: false });
    }, 50);
  }, [days]);

  const cardShadow = !isDark ? {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  } : {};

  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';

  const CardContent = (
    <View style={styles.row}>
        <TouchableOpacity
          style={[styles.calendarBtn, { borderColor: colors.border }]}
          onPress={onCalendarPress}
          testID="calendar-all"
          activeOpacity={0.7}
        >
          <Calendar size={20} color={colors.textSecondary} strokeWidth={1.8} />
        </TouchableOpacity>

        <View style={styles.datesStripWrap}>
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            contentContainerStyle={styles.scrollContent}
          >
            {days.map((day, idx) => {
              const isCompleted = completedDates?.has(day.fullDate) ?? false;
              const planned = plannedMap[day.fullDate];
              const plannedColor = planned ? (WORKOUT_STYLE_COLORS[planned.style] ?? accent) : null;

              return (
                <View key={day.fullDate} style={styles.dayWithDivider}>
                  <TouchableOpacity
                    style={styles.dayCell}
                    activeOpacity={0.7}
                    testID={`calendar-day-${day.num}`}
                    onPress={() => onDayPress?.(day.fullDate, day.dayOffset)}
                  >
                    <Text
                      style={[
                        styles.dayAbbr,
                        {
                          color: day.isToday
                            ? accent
                            : day.isPast
                            ? colors.textMuted
                            : colors.textSecondary,
                        },
                        day.isToday && { fontFamily: 'Outfit_700Bold' },
                      ]}
                    >
                      {day.abbr}
                    </Text>

                    <View
                      style={[
                        styles.dayNumContainer,
                        day.isToday && { backgroundColor: accent },
                        !day.isToday && isCompleted && {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
                        },
                      ]}
                    >
                      {isCompleted && !day.isToday ? (
                        <Check size={14} color={colors.textSecondary} strokeWidth={2.5} />
                      ) : (
                        <Text
                          style={[
                            styles.dayNum,
                            {
                              color: day.isToday
                                ? getContrastTextColor(accent)
                                : day.isPast
                                ? colors.textMuted
                                : colors.text,
                            },
                          ]}
                        >
                          {day.num}
                        </Text>
                      )}
                    </View>

                    <View style={styles.dotRow}>
                      {plannedColor ? (
                        <View style={[styles.plannedDot, { backgroundColor: plannedColor }]} />
                      ) : (
                        <View style={styles.dotPlaceholder} />
                      )}
                    </View>
                  </TouchableOpacity>

                  {idx < days.length - 1 ? (
                    <View
                      style={[
                        styles.dayDivider,
                        { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
                      ]}
                      pointerEvents="none"
                    />
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        </View>

        <TouchableOpacity
          style={styles.streakCell}
          onPress={onStreakPress}
          testID="calendar-streak"
          activeOpacity={0.7}
        >
          <View style={[styles.streakSquare, { borderColor: accent, backgroundColor: isDark ? '#1e1e1e' : '#e8e8e8' }]}>
            <Flame size={13} color={accent} fill={accent} />
            <Text style={[styles.streakCount, { color: accent }]}>{streak}</Text>
          </View>
        </TouchableOpacity>
    </View>
  );

  return (
    <GlassCard style={[styles.card, { borderColor: cardBorder }, cardShadow]} variant={variant}>
      {CardContent}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  datesStripWrap: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: CELL_GAP,
  },
  calendarBtn: {
    borderWidth: 1,
    borderRadius: 11,
    width: CAL_BTN_WIDTH,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  scrollContent: {
    paddingRight: 4,
    alignItems: 'center',
  },
  dayWithDivider: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayCell: {
    width: CELL_WIDTH,
    alignItems: 'center',
    gap: 3,
  },
  dayDivider: {
    width: StyleSheet.hairlineWidth,
    height: 44,
    marginHorizontal: Math.round(CELL_GAP / 2),
    borderRadius: 999,
  },
  dayAbbr: {
    fontSize: 9,
    fontFamily: 'Outfit_500Medium',
    letterSpacing: 0.5,
  },
  dayNumContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNum: {
    fontSize: 17,
    fontFamily: 'Outfit_500Medium',
    letterSpacing: -0.3,
  },
  dotRow: {
    height: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plannedDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dotPlaceholder: {
    width: 5,
    height: 5,
  },
  streakCell: {
    flexShrink: 0,
    alignItems: 'center',
  },
  streakSquare: {
    width: STREAK_WIDTH,
    height: 48,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  streakCount: {
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.3,
  },
});
