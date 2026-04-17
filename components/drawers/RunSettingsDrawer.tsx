import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
} from 'react-native';
import BaseDrawer from '@/components/drawers/BaseDrawer';
import DrawerHeader from '@/components/drawers/DrawerHeader';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme, useAppContext } from '@/context/AppContext';
import { useRun } from '@/context/RunContext';
import RunAudioSettingsDrawer from '@/components/drawers/RunAudioSettingsDrawer';
import {
  DEFAULT_RUN_PREFERENCES,
  METERS_PER_MILE,
  METERS_PER_KM,
  type RunUnits,
} from '@/types/run';
import { runTrackingService } from '@/services/runTrackingService';

interface Props {
  visible: boolean;
  onClose: () => void;
}

/** Auto-pause sensitivity tiers in m/s. */
const AUTO_PAUSE_TIERS: { label: string; value: number; description: string }[] = [
  { label: 'Strict',     value: 0.45, description: 'Pause when slower than 1.0 mph' },
  { label: 'Balanced',   value: 0.67, description: 'Pause when slower than 1.5 mph (default)' },
  { label: 'Relaxed',    value: 1.10, description: 'Pause only when nearly stopped (~2.5 mph)' },
];

export default function RunSettingsDrawer({ visible, onClose }: Props) {
  const { colors, accent, isDark } = useZealTheme();
  const ctx = useAppContext();
  const run = useRun();
  const prefs = run.preferences;

  const [audioDrawerVisible, setAudioDrawerVisible] = useState(false);
  const [maxHRInput, setMaxHRInput] = useState(
    prefs.maxHeartRateOverride !== null ? String(prefs.maxHeartRateOverride) : ''
  );
  const [weeklyGoalInput, setWeeklyGoalInput] = useState(() => {
    if (!prefs.weeklyMileageGoalMeters) return '';
    const display = prefs.units === 'metric'
      ? prefs.weeklyMileageGoalMeters / METERS_PER_KM
      : prefs.weeklyMileageGoalMeters / METERS_PER_MILE;
    return display.toFixed(1);
  });

  // ─── Derived ─────────────────────────────────────────────────────────
  const ageEstimate = useMemo(() => {
    if (!ctx.dateOfBirth) return null;
    const [y, m, d] = ctx.dateOfBirth.split('-').map(Number);
    if (!y || !m || !d) return null;
    const birth = new Date(y, m - 1, d);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const before = now.getMonth() < birth.getMonth() ||
      (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
    if (before) age--;
    return age > 0 && age < 120 ? age : null;
  }, [ctx.dateOfBirth]);

  const estimatedMaxHR = ageEstimate ? 220 - ageEstimate : null;

  // ─── Handlers ─────────────────────────────────────────────────────────
  const handleSetUnits = useCallback((u: RunUnits) => {
    run.updatePreferences({ units: u });
  }, [run]);

  const handleSetAutoPause = useCallback((threshold: number) => {
    run.updatePreferences({ autoPauseSpeedThresholdMps: threshold });
  }, [run]);

  const handleSaveMaxHR = useCallback(() => {
    const trimmed = maxHRInput.trim();
    if (!trimmed) {
      run.updatePreferences({ maxHeartRateOverride: null });
      return;
    }
    const parsed = parseInt(trimmed, 10);
    if (isNaN(parsed) || parsed < 100 || parsed > 230) {
      Alert.alert('Invalid value', 'Max heart rate must be between 100 and 230 bpm.');
      return;
    }
    run.updatePreferences({ maxHeartRateOverride: parsed });
  }, [maxHRInput, run]);

  const handleSaveWeeklyGoal = useCallback(() => {
    const trimmed = weeklyGoalInput.trim();
    if (!trimmed) {
      run.updatePreferences({ weeklyMileageGoalMeters: null });
      return;
    }
    const parsed = parseFloat(trimmed);
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('Invalid value', 'Goal must be a positive number.');
      return;
    }
    const meters = parsed * (prefs.units === 'metric' ? METERS_PER_KM : METERS_PER_MILE);
    run.updatePreferences({ weeklyMileageGoalMeters: meters });
  }, [weeklyGoalInput, prefs.units, run]);

  const handleRequestPermissions = useCallback(async () => {
    const fg = await runTrackingService.requestForegroundPermission();
    if (!fg) {
      Alert.alert(
        'Location Required',
        'Location access is required for GPS tracking. Please enable it in your device Settings.',
      );
      return;
    }
    const bg = await runTrackingService.requestBackgroundPermission();
    if (!bg) {
      Alert.alert(
        'Background Tracking',
        'Tracking will work when Zeal+ is open. To continue tracking when the app is backgrounded or screen is locked, enable "Always Allow" location access in Settings.',
      );
    } else {
      Alert.alert('All set', 'Location permissions granted. You\'re ready to run.');
    }
  }, []);

  const handleResetDefaults = useCallback(() => {
    Alert.alert(
      'Reset run preferences?',
      'All run settings will be restored to defaults. Your run history is unaffected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            run.updatePreferences(DEFAULT_RUN_PREFERENCES);
            setMaxHRInput('');
            setWeeklyGoalInput('');
          },
        },
      ],
    );
  }, [run]);

  const header = <DrawerHeader title="Run Settings" onClose={onClose} />;

  return (
    <BaseDrawer visible={visible} onClose={onClose} header={header}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Units ────────────────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>UNITS</Text>
          <View style={styles.segmentControl}>
            {(['imperial', 'metric'] as RunUnits[]).map((u) => {
              const selected = prefs.units === u;
              return (
                <TouchableOpacity
                  key={u}
                  style={[
                    styles.segmentButton,
                    {
                      backgroundColor: selected ? accent : 'transparent',
                      borderColor: selected ? accent : colors.border,
                    },
                  ]}
                  onPress={() => handleSetUnits(u)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.segmentButtonText, { color: selected ? '#fff' : colors.text }]}>
                    {u === 'imperial' ? 'Miles' : 'Kilometers'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Auto-pause ───────────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
          <View style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: `${accent}20` }]}>
              <PlatformIcon name="pause" size={16} color={accent} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Auto-pause</Text>
              <Text style={[styles.rowSub, { color: colors.textMuted }]}>
                Automatically pause when you stop moving
              </Text>
            </View>
            <Switch
              value={prefs.autoPauseEnabled}
              onValueChange={(v) => run.updatePreferences({ autoPauseEnabled: v })}
              trackColor={{ false: colors.border, true: accent }}
              thumbColor="#fff"
            />
          </View>
          {prefs.autoPauseEnabled && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Text style={[styles.subLabel, { color: colors.textMuted }]}>SENSITIVITY</Text>
              <View style={{ gap: 6 }}>
                {AUTO_PAUSE_TIERS.map((tier) => {
                  const selected = Math.abs(prefs.autoPauseSpeedThresholdMps - tier.value) < 0.05;
                  return (
                    <TouchableOpacity
                      key={tier.label}
                      style={[
                        styles.tierRow,
                        {
                          backgroundColor: selected ? `${accent}10` : 'transparent',
                          borderColor: selected ? accent : colors.border,
                        },
                      ]}
                      onPress={() => handleSetAutoPause(tier.value)}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.tierLabel, { color: selected ? accent : colors.text }]}>{tier.label}</Text>
                        <Text style={[styles.tierDescription, { color: colors.textMuted }]}>{tier.description}</Text>
                      </View>
                      {selected && <PlatformIcon name="check" size={16} color={accent} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </View>

        {/* ── Audio coaching → opens existing drawer ───────────────── */}
        <TouchableOpacity
          style={[styles.linkRow, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
          onPress={() => setAudioDrawerVisible(true)}
          activeOpacity={0.75}
        >
          <View style={[styles.iconWrap, { backgroundColor: `${accent}20` }]}>
            <PlatformIcon name={prefs.audioCuesEnabled ? 'bell' : 'bell-off'} size={16} color={accent} />
          </View>
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>Audio Coaching</Text>
            <Text style={[styles.rowSub, { color: colors.textMuted }]}>
              {prefs.audioCuesEnabled ? 'On — splits, pace alerts, intervals' : 'Off'}
            </Text>
          </View>
          <PlatformIcon name="chevron-right" size={16} color={colors.textMuted} />
        </TouchableOpacity>

        {/* ── Display ──────────────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>DISPLAY</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Keep screen awake</Text>
              <Text style={[styles.rowSub, { color: colors.textMuted }]}>Prevents the screen from dimming during a run</Text>
            </View>
            <Switch
              value={prefs.keepScreenAwake}
              onValueChange={(v) => run.updatePreferences({ keepScreenAwake: v })}
              trackColor={{ false: colors.border, true: accent }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* ── Privacy ──────────────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>PRIVACY</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Mask route start/end</Text>
              <Text style={[styles.rowSub, { color: colors.textMuted }]}>
                Hide the first and last 200m of routes on shared maps
              </Text>
            </View>
            <Switch
              value={prefs.privacyMaskRouteEdges}
              onValueChange={(v) => run.updatePreferences({ privacyMaskRouteEdges: v })}
              trackColor={{ false: colors.border, true: accent }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* ── Heart rate ───────────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>HEART RATE</Text>
          <Text style={[styles.helperText, { color: colors.textMuted }]}>
            {estimatedMaxHR
              ? `From your age (${ageEstimate}), estimated max HR is ${estimatedMaxHR} bpm.`
              : 'Add your date of birth in your profile to auto-estimate your max HR.'}
          </Text>
          <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}>
            <TextInput
              value={maxHRInput}
              onChangeText={setMaxHRInput}
              onBlur={handleSaveMaxHR}
              onSubmitEditing={handleSaveMaxHR}
              placeholder={estimatedMaxHR ? String(estimatedMaxHR) : '180'}
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              style={[styles.input, { color: colors.text }]}
              maxLength={3}
            />
            <Text style={[styles.inputSuffix, { color: colors.textMuted }]}>bpm override</Text>
          </View>
        </View>

        {/* ── Weekly mileage goal ──────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>WEEKLY MILEAGE GOAL</Text>
          <Text style={[styles.helperText, { color: colors.textMuted }]}>
            Sets a target for the goal ring on the Mileage tracker.
          </Text>
          <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }]}>
            <TextInput
              value={weeklyGoalInput}
              onChangeText={setWeeklyGoalInput}
              onBlur={handleSaveWeeklyGoal}
              onSubmitEditing={handleSaveWeeklyGoal}
              placeholder="25"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              style={[styles.input, { color: colors.text }]}
            />
            <Text style={[styles.inputSuffix, { color: colors.textMuted }]}>{prefs.units === 'metric' ? 'km' : 'mi'} / week</Text>
          </View>
        </View>

        {/* ── Permissions ──────────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>PERMISSIONS</Text>
          <Text style={[styles.helperText, { color: colors.textMuted }]}>
            Run tracking requires location access. "Always Allow" lets tracking continue when the screen is locked.
          </Text>
          <TouchableOpacity
            style={[styles.permissionButton, { borderColor: accent, backgroundColor: `${accent}10` }]}
            onPress={handleRequestPermissions}
            activeOpacity={0.8}
          >
            <PlatformIcon name="compass" size={14} color={accent} />
            <Text style={[styles.permissionButtonText, { color: accent }]}>Request Location Access</Text>
          </TouchableOpacity>
        </View>

        {/* ── Reset ────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.resetButton, { borderColor: colors.border }]}
          onPress={handleResetDefaults}
          activeOpacity={0.7}
        >
          <PlatformIcon name="refresh" size={14} color={colors.textSecondary} />
          <Text style={[styles.resetButtonText, { color: colors.textSecondary }]}>Reset to defaults</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Audio settings nested drawer */}
      <RunAudioSettingsDrawer
        visible={audioDrawerVisible}
        onClose={() => setAudioDrawerVisible(false)}
      />
    </BaseDrawer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
  },
  card: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  cardLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.8,
  },
  subLabel: {
    fontSize: 9,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.8,
    marginTop: -2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
  },
  rowSub: {
    fontSize: 11,
    fontFamily: 'Outfit_400Regular',
    lineHeight: 15,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  segmentControl: {
    flexDirection: 'row',
    gap: 6,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonText: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.2,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  tierLabel: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
  },
  tierDescription: {
    fontSize: 11,
    fontFamily: 'Outfit_400Regular',
    marginTop: 1,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  helperText: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
    lineHeight: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.2,
  },
  inputSuffix: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
  },
  permissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  permissionButtonText: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  resetButtonText: {
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
  },
});
