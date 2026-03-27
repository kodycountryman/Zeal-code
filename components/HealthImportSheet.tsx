import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import {
  X,
  Clock,
  Flame,
  Watch,
  ArrowDownToLine,
  AlertCircle,
  CheckCircle2,
  Copy,
  ChevronRight,
} from 'lucide-react-native';
import { useZealTheme } from '@/context/AppContext';
import PanDownHandle from '@/components/PanDownHandle';
import { useWorkoutTracking } from '@/context/WorkoutTrackingContext';
import type { HealthImportItem, DuplicateCandidate } from '@/context/WorkoutTrackingContext';

const WORKOUT_STYLES = ['Strength', 'Bodybuilding', 'CrossFit', 'Hyrox', 'Cardio', 'HIIT', 'Mobility', 'Pilates'];
const MUSCLE_GROUPS = [
  'Chest', 'Lats', 'Back', 'Traps', 'Shoulders', 'Rear Delts',
  'Biceps', 'Triceps', 'Forearms', 'Core', 'Quads', 'Hamstrings', 'Glutes', 'Calves',
];

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const yStr = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;
  if (dateStr === todayStr) return 'Today';
  if (dateStr === yStr) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

interface ImportReviewCardProps {
  item: HealthImportItem;
  index: number;
  total: number;
  colors: any;
  accent: string;
  isDark: boolean;
  onAccept: (style: string, muscles: string[]) => void;
  onSkip: () => void;
}

function ImportReviewCard({ item, index, total, colors, accent, isDark, onAccept, onSkip }: ImportReviewCardProps) {
  const [style, setStyle] = useState<string>(item.suggestedStyle);
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);

  const toggleMuscle = useCallback((m: string) => {
    setSelectedMuscles(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  }, []);

  const inputBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
  const chipBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';

  return (
    <View style={styles.reviewCard}>
      {total > 1 && (
        <View style={styles.progressRow}>
          <Text style={[styles.progressText, { color: colors.textMuted }]}>{index + 1} of {total}</Text>
          <View style={styles.progressDots}>
            {Array.from({ length: total }, (_, i) => (
              <View
                key={i}
                style={[styles.dot, { backgroundColor: i === index ? accent : colors.border, width: i === index ? 16 : 6 }]}
              />
            ))}
          </View>
        </View>
      )}

      <View style={[styles.healthInfoCard, { backgroundColor: inputBg, borderColor: colors.border }]}>
        <View style={styles.healthInfoRow}>
          <View style={[styles.healthIconWrap, { backgroundColor: `${accent}18` }]}>
            <Watch size={18} color={accent} />
          </View>
          <View style={styles.healthInfoText}>
            <Text style={[styles.healthTitle, { color: colors.text }]}>
              {item.activityType.replace(/([A-Z])/g, ' $1').trim() || 'Workout'}
            </Text>
            <Text style={[styles.healthSource, { color: colors.textSecondary }]}>
              {item.sourceName ?? 'Apple Health'} · {formatDate(item.dateStr)}
            </Text>
          </View>
        </View>

        <View style={styles.healthStatsRow}>
          <View style={styles.healthStat}>
            <Clock size={13} color={colors.textSecondary} />
            <Text style={[styles.healthStatValue, { color: colors.text }]}>{formatTime(item.startDate)}</Text>
            <Text style={[styles.healthStatLabel, { color: colors.textMuted }]}>start</Text>
          </View>
          <View style={[styles.healthStatDivider, { backgroundColor: colors.border }]} />
          <View style={styles.healthStat}>
            <Clock size={13} color={colors.textSecondary} />
            <Text style={[styles.healthStatValue, { color: colors.text }]}>{formatDuration(item.duration)}</Text>
            <Text style={[styles.healthStatLabel, { color: colors.textMuted }]}>duration</Text>
          </View>
          {(item.calories ?? 0) > 0 && (
            <>
              <View style={[styles.healthStatDivider, { backgroundColor: colors.border }]} />
              <View style={styles.healthStat}>
                <Flame size={13} color="#f87116" />
                <Text style={[styles.healthStatValue, { color: colors.text }]}>{Math.round(item.calories!)}</Text>
                <Text style={[styles.healthStatLabel, { color: colors.textMuted }]}>kcal</Text>
              </View>
            </>
          )}
        </View>
      </View>

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>WORKOUT STYLE</Text>
      <View style={styles.chipsWrap}>
        {WORKOUT_STYLES.map(s => (
          <TouchableOpacity
            key={s}
            style={[
              styles.chip,
              { backgroundColor: style === s ? `${accent}18` : chipBg, borderColor: style === s ? accent : colors.border },
            ]}
            onPress={() => setStyle(s)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, { color: style === s ? accent : colors.text }]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
        MUSCLE GROUPS{' '}
        <Text style={{ fontWeight: '400' as const, opacity: 0.6 }}>(optional)</Text>
      </Text>
      <View style={styles.chipsWrap}>
        {MUSCLE_GROUPS.map(m => (
          <TouchableOpacity
            key={m}
            style={[
              styles.chip,
              { backgroundColor: selectedMuscles.includes(m) ? `${accent}18` : chipBg, borderColor: selectedMuscles.includes(m) ? accent : colors.border },
            ]}
            onPress={() => toggleMuscle(m)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, { color: selectedMuscles.includes(m) ? accent : colors.text }]}>{m}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={[styles.skipBtn, { borderColor: colors.border }]} onPress={onSkip} activeOpacity={0.7}>
          <Text style={[styles.skipBtnText, { color: colors.textSecondary }]}>Skip</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: accent }]} onPress={() => onAccept(style, selectedMuscles)} activeOpacity={0.85}>
          <CheckCircle2 size={16} color="#fff" />
          <Text style={styles.addBtnText}>Add to Log</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface DuplicateCardProps {
  dup: DuplicateCandidate;
  colors: any;
  isDark: boolean;
  onSame: () => void;
  onKeepBoth: () => void;
  onDismiss: () => void;
}

function DuplicateCard({ dup, colors, isDark, onSame, onKeepBoth, onDismiss }: DuplicateCardProps) {
  const warnBg = isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.06)';
  const infoBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';

  return (
    <View style={[styles.dupCard, { backgroundColor: warnBg, borderColor: 'rgba(245,158,11,0.28)' }]}>
      <View style={styles.dupHeader}>
        <View style={styles.dupHeaderLeft}>
          <AlertCircle size={16} color="#f59e0b" />
          <Text style={[styles.dupTitle, { color: colors.text }]}>Possible Duplicate</Text>
        </View>
        <TouchableOpacity onPress={onDismiss} activeOpacity={0.7} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <X size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <Text style={[styles.dupSub, { color: colors.textSecondary }]}>
        Your watch also recorded a workout around this time. Were they the same session?
      </Text>

      <View style={styles.dupCompareRow}>
        <View style={[styles.dupSession, { backgroundColor: infoBg, borderColor: colors.border }]}>
          <View style={[styles.dupBadge, { backgroundColor: 'rgba(248,113,22,0.15)', marginBottom: 6 }]}>
            <Text style={[styles.dupBadgeText, { color: '#f87116' }]}>ZEAL</Text>
          </View>
          <Text style={[styles.dupSessionName, { color: colors.text }]} numberOfLines={2}>
            {dup.zealLog.workoutName || dup.zealLog.workoutStyle}
          </Text>
          <Text style={[styles.dupSessionDetail, { color: colors.textSecondary }]}>
            {formatDate(dup.zealLog.date)} · {formatDuration(dup.zealLog.duration)}
          </Text>
          {dup.zealLog.startTime != null && (
            <Text style={[styles.dupSessionDetail, { color: colors.textMuted }]}>
              {formatTime(dup.zealLog.startTime)}
            </Text>
          )}
        </View>

        <ChevronRight size={16} color={colors.textMuted} />

        <View style={[styles.dupSession, { backgroundColor: infoBg, borderColor: colors.border }]}>
          <View style={[styles.dupBadge, { backgroundColor: 'rgba(34,197,94,0.12)', marginBottom: 6, flexDirection: 'row', gap: 4 }]}>
            <Watch size={9} color="#22c55e" />
            <Text style={[styles.dupBadgeText, { color: '#22c55e' }]}>
              {dup.healthImport.sourceName?.split(' ')[0]?.toUpperCase() ?? 'HEALTH'}
            </Text>
          </View>
          <Text style={[styles.dupSessionName, { color: colors.text }]} numberOfLines={2}>
            {dup.healthImport.activityType.replace(/([A-Z])/g, ' $1').trim() || 'Workout'}
          </Text>
          <Text style={[styles.dupSessionDetail, { color: colors.textSecondary }]}>
            {formatDate(dup.healthImport.dateStr)} · {formatDuration(dup.healthImport.duration)}
          </Text>
          <Text style={[styles.dupSessionDetail, { color: colors.textMuted }]}>
            {formatTime(dup.healthImport.startDate)}
          </Text>
        </View>
      </View>

      <View style={styles.dupActionRow}>
        <TouchableOpacity
          style={[styles.dupKeepBothBtn, { borderColor: colors.border }]}
          onPress={onKeepBoth}
          activeOpacity={0.7}
        >
          <Copy size={13} color={colors.textSecondary} />
          <Text style={[styles.dupKeepBothText, { color: colors.textSecondary }]}>Keep Both</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dupSameBtn} onPress={onSame} activeOpacity={0.85}>
          <CheckCircle2 size={14} color="#fff" />
          <Text style={styles.dupSameBtnText}>Same Workout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function HealthImportSheet() {
  const { colors, accent, isDark } = useZealTheme();
  const tracking = useWorkoutTracking();

  const pendingImports = tracking.pendingHealthImports;
  const duplicates = tracking.duplicateCandidates;
  const hasDups = duplicates.length > 0;
  const hasImports = pendingImports.length > 0;
  const hasAny = hasDups || hasImports;

  const activeDup = duplicates[0] ?? null;
  const activeImport = pendingImports[0] ?? null;

  if (!tracking.healthImportReviewVisible) return null;

  const handleClose = () => tracking.setHealthImportReviewVisible(false);

  const headerSubtitle = hasDups
    ? `${duplicates.length} possible duplicate${duplicates.length > 1 ? 's' : ''}`
    : hasImports
      ? `${pendingImports.length} workout${pendingImports.length > 1 ? 's' : ''} to review`
      : 'All caught up';

  return (
    <Modal
      visible={tracking.healthImportReviewVisible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <PanDownHandle onDismiss={handleClose} indicatorColor={colors.border} />

          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={[styles.headerIcon, { backgroundColor: `${accent}15` }]}>
                <ArrowDownToLine size={16} color={accent} />
              </View>
              <View>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>Health Sync</Text>
                <Text style={[styles.sheetSub, { color: colors.textSecondary }]}>{headerSubtitle}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleClose} activeOpacity={0.7}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
          >
            {hasDups && activeDup ? (
              <DuplicateCard
                key={activeDup.id}
                dup={activeDup}
                colors={colors}
                isDark={isDark}
                onSame={() => tracking.mergeDuplicate(activeDup.id)}
                onKeepBoth={() => tracking.keepBothDuplicate(activeDup.id)}
                onDismiss={() => tracking.dismissDuplicate(activeDup.id)}
              />
            ) : hasImports && activeImport ? (
              <ImportReviewCard
                key={activeImport.id}
                item={activeImport}
                index={0}
                total={pendingImports.length}
                colors={colors}
                accent={accent}
                isDark={isDark}
                onAccept={(style, muscles) => tracking.acceptHealthImport(activeImport, style, muscles)}
                onSkip={() => tracking.dismissHealthImport(activeImport.id)}
              />
            ) : (
              <View style={styles.allDoneWrap}>
                <View style={[styles.allDoneIcon, { backgroundColor: `${accent}15` }]}>
                  <CheckCircle2 size={32} color={accent} />
                </View>
                <Text style={[styles.allDoneTitle, { color: colors.text }]}>All caught up!</Text>
                <Text style={[styles.allDoneSub, { color: colors.textSecondary }]}>
                  All Health workouts have been reviewed.
                </Text>
                <TouchableOpacity style={[styles.doneBtn, { backgroundColor: accent }]} onPress={handleClose} activeOpacity={0.85}>
                  <Text style={styles.doneBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '92%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.3,
  },
  sheetSub: {
    fontSize: 12,
    fontWeight: '400' as const,
    marginTop: 1,
  },
  scroll: {
    flex: 1,
  },

  reviewCard: {
    gap: 14,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressText: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  progressDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  healthInfoCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  healthInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  healthIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  healthInfoText: {
    flex: 1,
    gap: 3,
  },
  healthTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
  },
  healthSource: {
    fontSize: 12,
    fontWeight: '400' as const,
  },
  healthStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  healthStat: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  healthStatValue: {
    fontSize: 15,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  healthStatLabel: {
    fontSize: 10,
    fontWeight: '400' as const,
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
  },
  healthStatDivider: {
    width: 1,
    height: 32,
    opacity: 0.4,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    letterSpacing: 0.8,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  skipBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  skipBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  addBtn: {
    flex: 2,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
  },

  dupCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  dupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dupTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  dupSub: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
  },
  dupCompareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dupSession: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 11,
    gap: 2,
  },
  dupBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    alignItems: 'center',
  },
  dupBadgeText: {
    fontSize: 9,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
  },
  dupSessionName: {
    fontSize: 12,
    fontWeight: '600' as const,
    letterSpacing: -0.1,
  },
  dupSessionDetail: {
    fontSize: 11,
    fontWeight: '400' as const,
  },
  dupActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dupKeepBothBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
  },
  dupKeepBothText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  dupSameBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 12,
  },
  dupSameBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700' as const,
    letterSpacing: -0.1,
  },

  allDoneWrap: {
    alignItems: 'center',
    paddingVertical: 36,
    gap: 10,
  },
  allDoneIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  allDoneTitle: {
    fontSize: 22,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.4,
  },
  allDoneSub: {
    fontSize: 14,
    fontWeight: '400' as const,
    textAlign: 'center',
    lineHeight: 20,
  },
  doneBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 48,
    alignItems: 'center',
    marginTop: 8,
  },
  doneBtnText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
});
