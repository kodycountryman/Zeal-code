import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useZealTheme } from '@/context/AppContext';
import PanDownHandle from '@/components/PanDownHandle';
import { useWorkoutTracking } from '@/context/WorkoutTrackingContext';
import { WORKOUT_STYLE_COLORS } from '@/constants/colors';

const DAY_NAMES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export default function FullCalendarModal() {
  const { colors, isDark } = useZealTheme();
  const tracking = useWorkoutTracking();

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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
  let monthLabel = '';
  try {
    daysInMonth = getDaysInMonth(viewYear, viewMonth);
    firstDay = getFirstDayOfMonth(viewYear, viewMonth);
    monthLabel = new Date(viewYear, viewMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } catch (e) {
    console.log('[Calendar] Error computing month data:', e);
    monthLabel = `${viewYear}-${viewMonth + 1}`;
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
    setSelectedDate(dateStr);
  };

  const handleViewFull = (logId: string) => {
    tracking.setSelectedLogId(logId);
    tracking.setWorkoutLogDetailVisible(true);
  };

  const handleClose = () => {
    tracking.setCalendarModalVisible(false);
    setSelectedDate(null);
  };

  return (
    <Modal
      visible={tracking.calendarModalVisible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <PanDownHandle onDismiss={handleClose} indicatorColor={colors.border} />
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose} activeOpacity={0.7}>
            <X size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.monthNav}>
            <TouchableOpacity onPress={prevMonth} activeOpacity={0.7}>
              <ChevronLeft size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.monthLabel, { color: colors.text }]}>{monthLabel}</Text>
            <TouchableOpacity onPress={nextMonth} activeOpacity={0.7}>
              <ChevronRight size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.dayNamesRow}>
            {DAY_NAMES.map(d => (
              <Text key={d} style={[styles.dayNameCell, { color: colors.textMuted }]}>{d}</Text>
            ))}
          </View>

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

              return (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayCell,
                    isToday && styles.todayCell,
                    isSelected && { backgroundColor: `${colors.border}80` },
                  ]}
                  onPress={() => handleDayPress(day)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.dayText,
                    { color: isToday ? '#f87116' : colors.text },
                    isToday && { fontWeight: '700' as const },
                  ]}>
                    {day}
                  </Text>
                  {logsForDay.length > 0 && (
                    <View style={styles.dotsRow}>
                      {logsForDay.slice(0, 3).map((st, idx) => (
                        <View
                          key={idx}
                          style={[styles.dot, { backgroundColor: WORKOUT_STYLE_COLORS[st] ?? '#f87116' }]}
                        />
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {usedStyles.length > 0 && (
            <View style={styles.legendRow}>
              {usedStyles.map(st => (
                <View key={st} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: WORKOUT_STYLE_COLORS[st] ?? '#f87116' }]} />
                  <Text style={[styles.legendText, { color: colors.textSecondary }]}>{st}</Text>
                </View>
              ))}
            </View>
          )}

          {selectedDate && selectedLogs.length > 0 && (
            <ScrollView style={styles.previewSection} showsVerticalScrollIndicator={false}>
              {selectedLogs.map(log => {
                if (!log?.id) return null;
                try {
                  const styleColor = WORKOUT_STYLE_COLORS[log.workoutStyle ?? ''] ?? '#f87116';
                  let dateLabel = '';
                  try {
                    dateLabel = new Date(log.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                  } catch { dateLabel = log.date ?? ''; }
                  const exercises = log.exercises ?? [];
                  return (
                    <View key={log.id} style={[styles.previewCard, { backgroundColor: isDark ? '#1e1e1e' : '#f5f5f5' }]}>
                      <Text style={[styles.previewLabel, { color: colors.textMuted }]}>WORKOUT</Text>
                      <Text style={[styles.previewDate, { color: colors.text }]}>{dateLabel}</Text>
                      <View style={[styles.previewBadge, { backgroundColor: styleColor }]}>
                        <Text style={styles.previewBadgeText}>{log.workoutStyle ?? 'Workout'}</Text>
                      </View>
                      <Text style={[styles.previewDuration, { color: colors.textSecondary }]}>{log.duration ?? 0} min</Text>
                      <Text style={[styles.previewName, { color: colors.text }]}>{log.workoutName ?? 'Workout'}</Text>

                      {exercises.length > 0 && (
                        <View style={styles.previewExList}>
                          {exercises.slice(0, 5).map((ex, i) => (
                            <Text key={i} style={[styles.previewExItem, { color: colors.textSecondary }]}>
                              • {ex?.exerciseName ?? 'Exercise'} · {ex?.sets?.length ?? 0}×{ex?.sets?.[0]?.reps ?? ''}
                            </Text>
                          ))}
                          {exercises.length > 5 && (
                            <Text style={[styles.previewExItem, { color: colors.textMuted }]}>
                              + {exercises.length - 5} more
                            </Text>
                          )}
                        </View>
                      )}

                      <TouchableOpacity
                        style={styles.viewFullBtn}
                        onPress={() => handleViewFull(log.id)}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.viewFullText}>View Full Workout</Text>
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
              <Text style={[styles.noWorkoutText, { color: colors.textMuted }]}>No workouts logged this day</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 22,
    paddingBottom: 34,
    maxHeight: '90%',
  },
  closeBtn: {
    position: 'absolute',
    top: 18,
    right: 22,
    zIndex: 10,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 16,
    marginTop: 4,
  },
  monthLabel: {
    fontSize: 17,
    fontFamily: 'Outfit_600SemiBold',
  },
  dayNamesRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dayNameCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%' as any,
    alignItems: 'center',
    paddingVertical: 8,
    gap: 3,
    borderRadius: 8,
  },
  todayCell: {
    backgroundColor: 'rgba(248,113,22,0.1)',
    borderRadius: 8,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
    paddingBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
  previewSection: {
    maxHeight: 250,
    marginTop: 12,
  },
  previewCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    gap: 4,
  },
  previewLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
  },
  previewDate: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
    marginBottom: 6,
  },
  previewBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 4,
  },
  previewBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700' as const,
  },
  previewDuration: {
    fontSize: 12,
  },
  previewName: {
    fontSize: 16,
    fontFamily: 'Outfit_600SemiBold',
    marginBottom: 6,
  },
  previewExList: {
    gap: 2,
    marginBottom: 10,
  },
  previewExItem: {
    fontSize: 12,
  },
  viewFullBtn: {
    backgroundColor: '#f87116',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  viewFullText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
  },
  noWorkoutMsg: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noWorkoutText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
});
