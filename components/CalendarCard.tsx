import React, { useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme } from '@/context/AppContext';
import { getContrastTextColor, WORKOUT_STYLE_COLORS } from '@/constants/colors';
import type { PlannedWorkout } from '@/context/AppContext';
import GlassCard from '@/components/GlassCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CELL_WIDTH = 50;
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
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const days: CalendarDay[] = [];
  for (let i = -7; i <= 6; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    days.push({
      abbr: i === 0 ? 'Today' : dayNames[d.getDay()],
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
  /** Set of dates (YYYY-MM-DD) on which a run was completed. Renders a blue dot. */
  completedRunDates?: Set<string>;
  variant?: 'solid' | 'glass';
}

export default function CalendarCard({
  streak,
  onStreakPress,
  onCalendarPress,
  onDayPress,
  completedDates,
  plannedWorkouts,
  completedRunDates,
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
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  } : {};

  const cardBorder = colors.glass.borderSubtle;

  const CardContent = (
    <View style={styles.row}>
        <TouchableOpacity
          style={styles.calendarBtn}
          onPress={onCalendarPress}
          testID="calendar-all"
          activeOpacity={0.7}
        >
          <PlatformIcon name="calendar" size={26} color={colors.textSecondary} strokeWidth={1.8} />
        </TouchableOpacity>

        <View style={[styles.edgeDivider, { backgroundColor: colors.glass.controlStrong }]} pointerEvents="none" />

        <View style={styles.datesStripWrap}>
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
          >
            {days.map((day, idx) => {
              const isCompleted = completedDates?.has(day.fullDate) ?? false;
              const isRunCompleted = completedRunDates?.has(day.fullDate) ?? false;
              const planned = plannedMap[day.fullDate];
              const plannedColor = planned ? (WORKOUT_STYLE_COLORS[planned.style] ?? accent) : null;
              const RUN_DOT_COLOR = '#3b82f6';

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
                        !day.isToday && (isCompleted || isRunCompleted) && {
                          backgroundColor: colors.glass.chip,
                        },
                      ]}
                    >
                      {(isCompleted || isRunCompleted) && !day.isToday ? (
                        <PlatformIcon name="check" size={14} color={colors.textSecondary} strokeWidth={2.5} />
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
                      {/* Render run + planned-workout dots side by side; falls back to placeholder when neither */}
                      {isRunCompleted ? (
                        <View style={[styles.plannedDot, { backgroundColor: RUN_DOT_COLOR, marginRight: plannedColor ? 3 : 0 }]} />
                      ) : null}
                      {plannedColor ? (
                        <View style={[styles.plannedDot, { backgroundColor: plannedColor }]} />
                      ) : null}
                      {!isRunCompleted && !plannedColor ? (
                        <View style={styles.dotPlaceholder} />
                      ) : null}
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
          style={[styles.streakCell, { alignSelf: 'stretch' }]}
          onPress={onStreakPress}
          testID="calendar-streak"
          activeOpacity={0.7}
        >
          <View style={[styles.streakSquare, { flex: 1, backgroundColor: isDark ? 'rgba(0,0,0,0.30)' : 'rgba(0,0,0,0.10)' }]}>
            <PlatformIcon name="flame" size={19} color={accent} fill={accent} />
            <Text
              style={[styles.streakCount, { color: accent }]}
              adjustsFontSizeToFit
              numberOfLines={1}
              minimumFontScale={0.55}
            >{streak}</Text>
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
    borderRadius: 26,
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  datesStripWrap: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 0,
    paddingVertical: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: CELL_GAP,
    minHeight: 84,
  },
  calendarBtn: {
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    paddingVertical: 12,
  },
  edgeDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: 10,
  },
  scrollContent: {
    paddingRight: 4,
    flexGrow: 1,
    height: '100%',
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
    fontSize: 10,
    fontFamily: 'Outfit_500Medium',
    letterSpacing: 0.4,
  },
  dayNumContainer: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNum: {
    fontSize: 19,
    fontFamily: 'Outfit_600SemiBold',
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
    alignItems: 'stretch',
  },
  streakSquare: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 3,
  },
  streakCount: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.3,
  },
});
