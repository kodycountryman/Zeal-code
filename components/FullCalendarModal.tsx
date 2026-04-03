import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Animated,
} from 'react-native';
import { useSheetAnimation } from '@/hooks/useSheetAnimation';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme } from '@/context/AppContext';
import PanDownHandle from '@/components/PanDownHandle';
import { useWorkoutTracking } from '@/context/WorkoutTrackingContext';
import { WORKOUT_STYLE_COLORS, getContrastTextColor } from '@/constants/colors';

const DAY_NAMES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export default function FullCalendarModal() {
  const { colors, isDark, accent } = useZealTheme();
  const tracking = useWorkoutTracking();

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { backdropStyle, sheetStyle, onClose: animClose } = useSheetAnimation(
    tracking.calendarModalVisible,
    () => {
      tracking.setCalendarModalVisible(false);
      setSelectedDate(null);
    }
  );

  const logsByDate = useMemo(() => {
    const map: Record<string, string[]> = {};
    try {
      for (const log of tracking.workoutHistory ?? []) {
        if (!log?.date) continue;
        if (!map[log.date]) map[log.date] = [];
        map[log.date].push(log.workoutStyle ?? 'Strength');
      }
    } catch (e) {
      console.log('[Calendar] Error building logsByDate:', e);
    }
    return map;
  }, [tracking.workoutHistory]);

  const usedStyles = useMemo(() => {
    const s = new Set<string>();
    try {
      for (const styleList of Object.values(logsByDate)) {
        for (const st of styleList) s.add(st);
      }
    } catch (e) {
      console.log('[Calendar] Error building usedStyles:', e);
    }
    return Array.from(s);
  }, [logsByDate]);

  if (!tracking.calendarModalVisible) return null;

  let daysInMonth = 30;
  let firstDay = 0;
  let monthName = '';
  let yearLabel = '';
  try {
    daysInMonth = getDaysInMonth(viewYear, viewMonth);
    firstDay = getFirstDayOfMonth(viewYear, viewMonth);
    const d = new Date(viewYear, viewMonth);
    monthName = d.toLocaleDateString('en-US', { month: 'long' });
    yearLabel = String(viewYear);
  } catch (e) {
    console.log('[Calendar] Error computing month data:', e);
    monthName = 'Month';
    yearLabel = String(viewYear);
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  let selectedLogs: typeof tracking.workoutHistory = [];
  try {
    selectedLogs = selectedDate ? (tracking.getLogsForDate(selectedDate) ?? []) : [];
  } catch (e) {
    console.log('[Calendar] Error getting logs for date:', e);
    selectedLogs = [];
  }

  const handleDayPress = (day: number) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(prev => prev === dateStr ? null : dateStr);
  };

  const handleViewFull = (logId: string) => {
    tracking.setSelectedLogId(logId);
    tracking.setWorkoutLogDetailVisible(true);
  };

  const handleClose = () => {
    animClose();
  };

  const contrastOnAccent = getContrastTextColor(accent);
  const dividerColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';

  return (
    <Modal
      visible={tracking.calendarModalVisible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={animClose} activeOpacity={1} />
      </Animated.View>
      <Animated.View style={[styles.sheetWrap, sheetStyle]}>
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <PanDownHandle onDismiss={handleClose} indicatorColor={colors.border} />

          {/* ── Header ── */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.monthName, { color: colors.text }]}>{monthName}</Text>
              <Text style={[styles.yearLabel, { color: colors.textMuted }]}>{yearLabel}</Text>
            </View>
            <View style={styles.navRow}>
              <TouchableOpacity
                style={[styles.navBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }]}
                onPress={prevMonth}
                activeOpacity={0.7}
              >
                <PlatformIcon name="chevron-left" size={18} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.navBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' }]}
                onPress={nextMonth}
                activeOpacity={0.7}
              >
                <PlatformIcon name="chevron-right" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Close button */}
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose} activeOpacity={0.7}>
            <PlatformIcon name="x" size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* ── Divider ── */}
          <View style={[styles.divider, { backgroundColor: dividerColor }]} />

          {/* ── Day name headers ── */}
          <View style={styles.dayNamesRow}>
            {DAY_NAMES.map(d => (
              <Text key={d} style={[styles.dayNameCell, { color: colors.textMuted }]}>{d}</Text>
            ))}
          </View>

          {/* ── Days grid ── */}
          <View style={styles.daysGrid}>
            {Array.from({ length: firstDay }).map((_, i) => (
              <View key={`empty-${i}`} style={styles.dayCell} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              let dateStr = '';
              let isToday = false;
              let logsForDay: string[] = [];
              let isSelected = false;
              try {
                dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                isToday = dateStr === todayStr;
                logsForDay = logsByDate[dateStr] ?? [];
                isSelected = dateStr === selectedDate;
              } catch (e) {
                console.log('[Calendar] Day cell error:', e);
              }

              const hasWorkout = logsForDay.length > 0;
              const dotColor = hasWorkout ? (WORKOUT_STYLE_COLORS[logsForDay[0]] ?? accent) : null;

              return (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayCell,
                    isToday && [styles.todayCell, { backgroundColor: accent }],
                    !isToday && isSelected && {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)',
                      borderRadius: 14,
                    },
                  ]}
                  onPress={() => handleDayPress(day)}
                  activeOpacity={0.65}
                >
                  <Text style={[
                    styles.dayText,
                    { color: isToday ? contrastOnAccent : isSelected ? colors.text : colors.text },
                    isToday && styles.dayTextToday,
                    !isToday && !hasWorkout && { color: colors.textSecondary },
                  ]}>
                    {day}
                  </Text>
                  {dotColor ? (
                    <View style={[styles.dot, { backgroundColor: isToday ? contrastOnAccent + '99' : dotColor }]} />
                  ) : (
                    <View style={styles.dotPlaceholder} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Legend ── */}
          {usedStyles.length > 0 && (
            <>
              <View style={[styles.divider, { backgroundColor: dividerColor, marginBottom: 12 }]} />
              <View style={styles.legendRow}>
                {usedStyles.map(st => (
                  <View key={st} style={[styles.legendPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }]}>
                    <View style={[styles.legendDot, { backgroundColor: WORKOUT_STYLE_COLORS[st] ?? accent }]} />
                    <Text style={[styles.legendText, { color: colors.textSecondary }]}>{st}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* ── Selected day preview ── */}
          {selectedDate && selectedLogs.length > 0 && (
            <ScrollView style={styles.previewSection} showsVerticalScrollIndicator={false}>
              {selectedLogs.map(log => {
                if (!log?.id) return null;
                try {
                  const styleColor = WORKOUT_STYLE_COLORS[log.workoutStyle ?? ''] ?? accent;
                  let dateLabel = '';
                  try {
                    dateLabel = new Date(log.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
                  } catch { dateLabel = log.date ?? ''; }
                  const exercises = log.exercises ?? [];
                  return (
                    <View
                      key={log.id}
                      style={[styles.previewCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderColor: dividerColor }]}
                    >
                      <View style={styles.previewCardHeader}>
                        <View>
                          <Text style={[styles.previewDate, { color: colors.text }]}>{dateLabel}</Text>
                          <Text style={[styles.previewName, { color: colors.textSecondary }]}>{log.workoutName ?? 'Workout'}</Text>
                        </View>
                        <View style={[styles.previewBadge, { backgroundColor: styleColor + '22', borderColor: styleColor + '55' }]}>
                          <Text style={[styles.previewBadgeText, { color: styleColor }]}>{log.workoutStyle ?? 'Workout'}</Text>
                        </View>
                      </View>

                      <View style={styles.previewMeta}>
                        <PlatformIcon name="clock" size={13} color={colors.textMuted} />
                        <Text style={[styles.previewMetaText, { color: colors.textMuted }]}>{log.duration ?? 0} min</Text>
                      </View>

                      {exercises.length > 0 && (
                        <View style={[styles.previewExList, { borderTopColor: dividerColor }]}>
                          {exercises.slice(0, 4).map((ex, i) => (
                            <Text key={i} style={[styles.previewExItem, { color: colors.textSecondary }]}>
                              {ex?.exerciseName ?? 'Exercise'}
                              <Text style={{ color: colors.textMuted }}>  {ex?.sets?.length ?? 0} sets</Text>
                            </Text>
                          ))}
                          {exercises.length > 4 && (
                            <Text style={[styles.previewExItem, { color: colors.textMuted }]}>
                              +{exercises.length - 4} more exercises
                            </Text>
                          )}
                        </View>
                      )}

                      <TouchableOpacity
                        style={[styles.viewFullBtn, { backgroundColor: accent }]}
                        onPress={() => handleViewFull(log.id)}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.viewFullText, { color: contrastOnAccent }]}>View Full Workout</Text>
                      </TouchableOpacity>
                    </View>
                  );
                } catch (e) {
                  console.log('[Calendar] Error rendering log preview:', e);
                  return null;
                }
              })}
            </ScrollView>
          )}

          {selectedDate && selectedLogs.length === 0 && (
            <View style={styles.noWorkoutMsg}>
              <PlatformIcon name="calendar" size={22} color={colors.textMuted} strokeWidth={1.5} />
              <Text style={[styles.noWorkoutText, { color: colors.textMuted }]}>No workouts logged this day</Text>
            </View>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheetWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 22,
    paddingBottom: 40,
    maxHeight: '92%',
  },
  closeBtn: {
    position: 'absolute',
    top: 22,
    right: 22,
    zIndex: 10,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 18,
  },
  monthName: {
    fontSize: 26,
    fontFamily: 'PlayfairDisplay_700Bold',
    lineHeight: 30,
  },
  yearLabel: {
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
    marginTop: 1,
  },
  navRow: {
    flexDirection: 'row',
    gap: 8,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  dayNamesRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  dayNameCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.8,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  dayCell: {
    width: '14.28%' as any,
    alignItems: 'center',
    paddingVertical: 7,
    gap: 4,
    borderRadius: 14,
  },
  todayCell: {
    borderRadius: 14,
  },
  dayText: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: -0.2,
  },
  dayTextToday: {
    fontFamily: 'Outfit_700Bold',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dotPlaceholder: {
    width: 5,
    height: 5,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  legendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendText: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
  },
  previewSection: {
    maxHeight: 280,
  },
  previewCard: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  previewCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  previewDate: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.3,
  },
  previewName: {
    fontSize: 13,
    fontFamily: 'Outfit_400Regular',
    marginTop: 2,
  },
  previewBadge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  previewBadgeText: {
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
  },
  previewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  previewMetaText: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
  },
  previewExList: {
    gap: 5,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  previewExItem: {
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
  },
  viewFullBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 2,
  },
  viewFullText: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
  },
  noWorkoutMsg: {
    paddingVertical: 28,
    alignItems: 'center',
    gap: 8,
  },
  noWorkoutText: {
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
  },
});
