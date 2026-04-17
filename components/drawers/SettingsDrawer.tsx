import React, { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
  Animated,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import CustomSlider from '@/components/CustomSlider';
import GlassCard from '@/components/GlassCard';
import BaseDrawer from '@/components/drawers/BaseDrawer';
import RunSettingsDrawer from '@/components/drawers/RunSettingsDrawer';
import { PlatformIcon } from '@/components/PlatformIcon';
import { showProGate, PRO_GOLD, PRO_LOCKED_OPACITY, PRO_STYLES, PRO_STYLES_SET } from '@/services/proGate';
import { useZealTheme, useAppContext, type NotifPrefs } from '@/context/AppContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { healthService } from '@/services/healthService';
import {
  WORKOUT_STYLE_COLORS,
  WORKOUT_STYLE_DESCRIPTIONS,
} from '@/constants/colors';
import {
  getStyleConfig,
  getDurationSteps,
  showRestSlider as shouldShowRestSlider,
} from '@/services/workoutConfig';
import {
  requestNotificationPermissions,
  getNotificationPermissionStatus,
  scheduleDailyReminder,
  cancelDailyReminder,
  scheduleStreakReminder,
  cancelStreakReminder,
  scheduleWeeklySummary,
  cancelWeeklySummary,
  type NotifPermissionStatus,
} from '@/services/notificationService';

const WORKOUT_STYLES = [
  'Strength', 'Bodybuilding', 'CrossFit', 'Hyrox',
  'HIIT', 'Mobility', 'Pilates', 'Low-Impact', 'Hybrid',
];



const SAVE_BTN_COLOR = '#f87116';

function buildDisplaySplitOptions(raw: string[]): string[] {
  const PPL = ['Push', 'Pull', 'Legs'];
  const hasPPL = PPL.some(p => raw.includes(p));
  const result: string[] = [];
  let pplInserted = false;
  for (const opt of raw) {
    if (PPL.includes(opt)) {
      if (!pplInserted) {
        result.push('Push, Pull, Legs');
        pplInserted = true;
      }
    } else {
      result.push(opt);
    }
  }
  return hasPPL ? result : raw;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onOpenColorTheme: () => void;
  onOpenEquipment: () => void;
  onOpenExerciseCatalog?: () => void;
  onOpenHelpFaq?: () => void;
  onReplayTour?: () => void;
}

const DANGER_ZONE_HEIGHT = 100;

export default function SettingsDrawer({ visible, onClose, onOpenColorTheme: _onOpenColorTheme, onOpenEquipment, onOpenExerciseCatalog, onOpenHelpFaq, onReplayTour }: Props) {
  const { colors, accent, isDark } = useZealTheme();
  const ctx = useAppContext();
  const router = useRouter();
  const { hasPro, openPaywall } = useSubscription();
  const scrollRef = useRef<any>(null);

  const [localStyle, setLocalStyle] = useState(ctx.workoutStyle);
  const [localSplit, setLocalSplit] = useState(ctx.trainingSplit);
  const [localDuration, setLocalDuration] = useState(ctx.targetDuration);
  const [localRest, setLocalRest] = useState(ctx.restBetweenSets);
  const [localWarmUp, setLocalWarmUp] = useState(ctx.warmUp);
  const [localCoolDown, setLocalCoolDown] = useState(ctx.coolDown);
  const [localRecovery, setLocalRecovery] = useState(ctx.recovery);
  const [localCardio, setLocalCardio] = useState(ctx.addCardio);
  const [localCoreFinisher, setLocalCoreFinisher] = useState(ctx.coreFinisher);
  const [descExpanded, setDescExpanded] = useState(false);
  const [healthConnecting, setHealthConnecting] = useState(false);
  const healthPulse = useRef(new Animated.Value(1)).current;
  const [dangerOpen, setDangerOpen] = useState(false);
  const dangerAnim = useRef(new Animated.Value(0)).current;
  const [runSettingsVisible, setRunSettingsVisible] = useState(false);

  const [notifPermStatus, setNotifPermStatus] = useState<NotifPermissionStatus>('undetermined');
  const [localNotif, setLocalNotif] = useState<NotifPrefs>(ctx.notifPrefs);

  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  const toggleDanger = useCallback(() => {
    const toValue = dangerOpen ? 0 : 1;
    setDangerOpen(!dangerOpen);
    Animated.spring(dangerAnim, {
      toValue,
      useNativeDriver: false,
      tension: 60,
      friction: 10,
    }).start();
  }, [dangerOpen, dangerAnim]);

  const dangerHeight = dangerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, DANGER_ZONE_HEIGHT],
  });

  const dangerOpacity = dangerAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  const chevronRotateDanger = dangerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  const handleSignOut = useCallback(() => {
    __DEV__ && console.log('[Settings] Signing out...');
    ctx.logout();
    onClose();
    setTimeout(() => {
      router.replace('/login');
    }, 350);
  }, [onClose, router, ctx]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete Account',
      'This will permanently erase all your workout history, settings, streaks, PRs, and data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              __DEV__ && console.log('[Settings] Deleting all account data...');
              await ctx.deleteAccount();
              __DEV__ && console.log('[Settings] Account fully deleted. Navigating to login.');
              onClose();
              setTimeout(() => {
                router.replace('/login');
              }, 350);
            } catch (e) {
              console.error('[Settings] Error deleting account:', e);
              Alert.alert('Error', 'Could not delete account data. Please try again.');
            }
          },
        },
      ]
    );
  }, [onClose, router, ctx]);

  useEffect(() => {
    if (ctx.healthConnected) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(healthPulse, { toValue: 1.4, duration: 1000, useNativeDriver: true }),
          Animated.timing(healthPulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    }
  }, [ctx.healthConnected, healthPulse]);

  const handleHealthToggle = useCallback(async () => {
    if (!hasPro) { showProGate('healthSync', openPaywall); return; }
    const c = ctxRef.current;
    if (c.healthConnected) {
      c.setHealthSyncEnabled(false);
      c.setHealthConnected(false);
      c.saveState();
      return;
    }
    if (!healthService.isAvailable()) {
      Alert.alert(
        'Native Build Required',
        Platform.OS === 'ios'
          ? 'Apple Health sync requires a native build. It will be fully active in the App Store version of Zeal.'
          : 'Health Connect sync requires a native build. It will be fully active in the Play Store version of Zeal.',
        [{ text: 'Got it' }]
      );
      return;
    }
    setHealthConnecting(true);
    try {
      const result = await healthService.requestPermissions();
      if (result.granted) {
        c.setHealthSyncEnabled(true);
        c.setHealthConnected(true);
        c.saveState();
        Alert.alert(
          'Connected!',
          Platform.OS === 'ios'
            ? 'Apple Health is now connected. Workouts will sync automatically.'
            : 'Health Connect is now connected. Workouts will sync automatically.',
          [{ text: 'Great!' }]
        );
      } else {
        Alert.alert(
          'Permission Denied',
          result.error ?? 'Health permissions were not granted. You can change this in device Settings.',
          [{ text: 'OK' }]
        );
      }
    } finally {
      setHealthConnecting(false);
    }
  }, [hasPro, openPaywall]);

  useEffect(() => {
    if (visible && Platform.OS !== 'web') {
      void getNotificationPermissionStatus().then(setNotifPermStatus);
      setLocalNotif(ctxRef.current.notifPrefs);
    }
  }, [visible]);

  const handleNotifToggle = useCallback(async (key: keyof NotifPrefs, value: boolean) => {
    if (Platform.OS === 'web') return;
    if (value) {
      const status = await requestNotificationPermissions();
      setNotifPermStatus(status);
      if (status !== 'granted') {
        Alert.alert(
          'Notifications Disabled',
          'Enable notifications in your device settings to use this feature.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => Platform.OS === 'ios' ? void Linking.openURL('app-settings:') : void Linking.openSettings(),
            },
          ]
        );
        return;
      }
    }
    setLocalNotif(prev => {
      const updated = { ...prev, [key]: value };
      ctxRef.current.saveNotifPrefs({ [key]: value });
      if (key === 'dailyEnabled') {
        if (value) void scheduleDailyReminder(updated.dailyHour, updated.dailyMinute);
        else void cancelDailyReminder();
      }
      if (key === 'streakEnabled') {
        if (value) void scheduleStreakReminder(updated.streakHour, updated.streakMinute);
        else void cancelStreakReminder();
      }
      if (key === 'weeklySummaryEnabled') {
        if (value) void scheduleWeeklySummary({ workouts: 0, hoursStr: '0h', sets: 0 });
        else void cancelWeeklySummary();
      }
      return updated;
    });
  }, []);

  const handleTimeChange = useCallback((type: 'daily' | 'streak', field: 'hour' | 'minute', delta: number) => {
    setLocalNotif(prev => {
      let newHour = prev[type === 'daily' ? 'dailyHour' : 'streakHour'];
      let newMin = prev[type === 'daily' ? 'dailyMinute' : 'streakMinute'];
      if (field === 'hour') {
        newHour = (newHour + delta + 24) % 24;
      } else {
        newMin = (newMin + delta + 60) % 60;
      }
      const updated = type === 'daily'
        ? { ...prev, dailyHour: newHour, dailyMinute: newMin }
        : { ...prev, streakHour: newHour, streakMinute: newMin };
      ctxRef.current.saveNotifPrefs(
        type === 'daily'
          ? { dailyHour: newHour, dailyMinute: newMin }
          : { streakHour: newHour, streakMinute: newMin }
      );
      if (type === 'daily' && updated.dailyEnabled) {
        void scheduleDailyReminder(newHour, newMin);
      }
      if (type === 'streak' && updated.streakEnabled) {
        void scheduleStreakReminder(newHour, newMin);
      }
      return updated;
    });
  }, []);

  useEffect(() => {
    if (visible) {
      const c = ctxRef.current;
      const cfg = getStyleConfig(c.workoutStyle);
      setLocalStyle(c.workoutStyle);
      const SPLIT_MIGRATION: Record<string, string> = {
        'Push Day': 'Push, Pull, Legs', 'Pull Day': 'Push, Pull, Legs', 'Leg Day': 'Push, Pull, Legs',
        'Push': 'Push, Pull, Legs', 'Pull': 'Push, Pull, Legs', 'Legs': 'Push, Pull, Legs',
        'Core + Cardio': 'Full Body',
        'Full Body HIIT': 'Full Body', 'Upper HIIT': 'Upper', 'Lower HIIT': 'Lower',
      };
      const rawSplit = c.trainingSplit;
      const migratedSplit = SPLIT_MIGRATION[rawSplit] ?? rawSplit;
      const displayOpts = buildDisplaySplitOptions(cfg.slot_options);
      setLocalSplit(displayOpts.includes(migratedSplit) ? migratedSplit : (displayOpts[0] ?? ''));
      setLocalDuration(c.targetDuration);
      setLocalRest(c.restBetweenSets);
      setLocalWarmUp(c.warmUp);
      setLocalCoolDown(c.coolDown);
      setLocalRecovery(c.recovery);
      setLocalCardio(c.addCardio);
      setLocalCoreFinisher(c.coreFinisher);
      setDescExpanded(false);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
      }, 80);
    }
  }, [visible]);

  const handleSave = useCallback(() => {
    const c = ctxRef.current;
    c.setWorkoutStyle(localStyle);
    c.setTrainingSplit(localSplit);
    c.setTargetDuration(localDuration);
    c.setRestBetweenSets(localRest);
    c.setWarmUp(localWarmUp);
    c.setCoolDown(localCoolDown);
    c.setRecovery(localRecovery);
    c.setAddCardio(localCardio);
    c.setCoreFinisher(localCoreFinisher);
    c.clearWorkoutOverride();
    c.clearLastModifyState();
    c.saveSettingsToStorage({
      workoutStyle: localStyle,
      trainingSplit: localSplit,
      targetDuration: localDuration,
      restBetweenSets: localRest,
      warmUp: localWarmUp,
      coolDown: localCoolDown,
      recovery: localRecovery,
      addCardio: localCardio,
      coreFinisher: localCoreFinisher,
    });
    __DEV__ && console.log('[SettingsDrawer] Saved settings permanently:', localStyle, localSplit);
    setTimeout(() => {
      c.bumpSettingsSaveVersion();
    }, 50);
    onClose();
  }, [localStyle, localSplit, localDuration, localRest, localWarmUp, localCoolDown, localRecovery, localCardio, localCoreFinisher, onClose]);

  const handleStyleSelect = useCallback((s: string) => {
    if (!hasPro && PRO_STYLES_SET.has(s)) {
      showProGate('workoutStyle', openPaywall);
      return;
    }
    const cfg = getStyleConfig(s);
    setLocalStyle(s);
    setDescExpanded(false);
    setLocalSplit(buildDisplaySplitOptions(cfg.slot_options)[0] ?? '');
  }, [hasPro, openPaywall]);

  const styleAccent = WORKOUT_STYLE_COLORS[localStyle] ?? accent;
  const config = useMemo(() => getStyleConfig(localStyle), [localStyle]);
  const displaySplitOptions = useMemo(() => buildDisplaySplitOptions(config.slot_options), [config.slot_options]);
  const durationSteps = useMemo(() => getDurationSteps(localStyle), [localStyle]);
  const restVisible = useMemo(() => shouldShowRestSlider(localStyle, localSplit), [localStyle, localSplit]);
  const styleDesc = WORKOUT_STYLE_DESCRIPTIONS[localStyle] ?? '';

  const selectedEquipCount = Object.values(ctx.selectedEquipment).filter((v) => v > 0).length;
  const appThemeLabel = ctx.appTheme.charAt(0).toUpperCase() + ctx.appTheme.slice(1);

  const headerContent = (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.headerCircleBtn}
        onPress={onClose}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <PlatformIcon name="x" size={16} color="#888" strokeWidth={2.5} />
      </TouchableOpacity>
      <View style={styles.headerTitleWrap}>
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
      </View>
      <TouchableOpacity
        style={styles.headerSaveBtn}
        onPress={handleSave}
        activeOpacity={0.85}
        testID="settings-save"
      >
        <Text style={styles.headerSaveText}>Save</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <>
    <BaseDrawer visible={visible} onClose={onClose} header={headerContent} stackBehavior="push">
      <View style={styles.content}>
        {/* ── Card 1: Training ── */}
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Training</Text>

        <GlassCard variant={isDark ? 'glass' : 'solid'} style={styles.section}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>WORKOUT STYLE</Text>
          <View style={styles.styleChips}>
            {WORKOUT_STYLES.map((s) => {
              const sc = WORKOUT_STYLE_COLORS[s] ?? '#f87116';
              const isSelected = localStyle === s;
              const isLocked = !hasPro && PRO_STYLES_SET.has(s);
              return (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.styleChip,
                    { borderColor: colors.border, backgroundColor: colors.cardSecondary },
                    isSelected && { backgroundColor: sc, borderColor: sc },
                    isLocked && { opacity: PRO_LOCKED_OPACITY },
                  ]}
                  onPress={() => handleStyleSelect(s)}
                  activeOpacity={0.7}
                >
                  <View style={styles.chipInner}>
                    <Text
                      style={[
                        styles.styleChipText,
                        { color: isSelected ? '#fff' : colors.text },
                      ]}
                    >
                      {s}
                    </Text>
                    {isLocked && <PlatformIcon name="crown" size={11} color={PRO_GOLD} strokeWidth={2} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {styleDesc ? (
            <TouchableOpacity
              onPress={() => setDescExpanded((v) => !v)}
              activeOpacity={0.7}
              style={styles.descRow}
            >
              <Text
                style={[styles.styleDesc, { color: colors.textSecondary, flex: 1 }]}
                numberOfLines={descExpanded ? undefined : 1}
                ellipsizeMode="tail"
              >
                {styleDesc}
              </Text>
              <PlatformIcon
                name="chevron-down"
                size={14}
                color={colors.textMuted}
                style={{ transform: [{ rotate: descExpanded ? '180deg' : '0deg' }], marginLeft: 6 }}
              />
            </TouchableOpacity>
          ) : null}

          {displaySplitOptions.length > 0 && (
            <>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{config.slot_label}</Text>
              <View style={styles.styleChips}>
                {displaySplitOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.splitChip,
                      { borderColor: colors.border, backgroundColor: colors.cardSecondary },
                      localSplit === opt && { backgroundColor: styleAccent, borderColor: styleAccent },
                    ]}
                    onPress={() => setLocalSplit(opt)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.styleChipText,
                        { color: localSplit === opt ? '#fff' : colors.text },
                      ]}
                    >
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <View style={styles.sliderHeaderRow}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>TARGET DURATION</Text>
            <Text style={[styles.sliderValue, { color: styleAccent }]}>
              {`${localDuration}m`}
            </Text>
          </View>
          <CustomSlider
            value={localDuration}
            minimumValue={config.duration_min}
            maximumValue={config.duration_max}
            step={1}
            onValueChange={(v: number) => {
              const closest = durationSteps.reduce((prev, curr) =>
                Math.abs(curr - v) < Math.abs(prev - v) ? curr : prev
              );
              setLocalDuration(closest);
            }}
            minimumTrackColor={styleAccent}
            maximumTrackColor={colors.border}
            thumbColor={styleAccent}
            style={styles.sliderStyle}
          />
          <View style={styles.durationLabels}>
            {durationSteps.map((s) => (
              <Text key={s} style={[styles.durationLabel, { color: colors.textMuted }]}>
                {s}m
              </Text>
            ))}
          </View>

          {/* Divider between training config and component toggles */}
          <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Components</Text>
          {[
            { label: 'Warm-Up', tag: '+5m', val: localWarmUp, set: setLocalWarmUp },
            { label: 'Cool-Down', tag: '+5m', val: localCoolDown, set: setLocalCoolDown },
            { label: 'Recovery', tag: '+10m', val: localRecovery, set: setLocalRecovery },
            { label: 'Add Cardio', tag: '+20m', val: localCardio, set: setLocalCardio },
            { label: 'Core Finisher', tag: 'AI abs', val: localCoreFinisher, set: setLocalCoreFinisher },
          ].map((item, i, arr) => (
            <TouchableOpacity
              key={item.label}
              style={[
                styles.toggleRow,
                i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
              ]}
              onPress={() => item.set(!item.val)}
              activeOpacity={0.7}
            >
              <Text style={[styles.toggleLabel, { color: colors.text }]}>
                {item.label}{' '}
                <Text style={[styles.toggleTag, { color: colors.textMuted }]}>{item.tag}</Text>
              </Text>
              <Switch
                value={item.val}
                onValueChange={item.set}
                trackColor={{ false: colors.border, true: `${colors.text}30` }}
                thumbColor={item.val ? colors.text : colors.textSecondary}
              />
            </TouchableOpacity>
          ))}
        </GlassCard>

        {/* ── Card 2: General ── */}
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>General</Text>
        <GlassCard variant={isDark ? 'glass' : 'solid'} style={[styles.section, { padding: 0, gap: 0 }]}>
          {[
            {
              iconComponent: hasPro
                ? <PlatformIcon name="sparkles" size={18} color="#f5c842" />
                : <PlatformIcon name="crown" size={18} color={PRO_GOLD} />,
              label: 'Subscription',
              sub: hasPro ? 'Zeal Pro' : 'Upgrade to Pro',
              onPress: () => showProGate('subscription', openPaywall),
              locked: !hasPro,
              testID: 'settings-subscription',
            },
            // COLOR THEME ROW — temporarily hidden (ColorThemeDrawer.tsx preserved, re-add this block to restore)
            // { iconComponent: <PlatformIcon name="palette" size={18} color={colors.textSecondary} />, label: 'Color Theme', sub: appThemeLabel, onPress: onOpenColorTheme, testID: 'settings-color-theme' },
            {
              iconComponent: hasPro
                ? <PlatformIcon name="dumbbell" size={18} color={colors.textSecondary} />
                : <PlatformIcon name="dumbbell" size={18} color={colors.textMuted} />,
              label: 'Available Equipment',
              sub: hasPro
                ? (selectedEquipCount > 0 ? `${selectedEquipCount} items selected` : 'No equipment selected')
                : 'Customize workouts to your gear',
              onPress: hasPro ? onOpenEquipment : () => showProGate('equipment', openPaywall),
              locked: !hasPro,
              testID: 'settings-equipment',
            },
            {
              iconComponent: <PlatformIcon name="figure-run" size={18} color={colors.textSecondary} />,
              label: 'Run Settings',
              sub: 'Units, auto-pause, audio coaching, HR zones',
              onPress: () => setRunSettingsVisible(true),
              testID: 'settings-run',
            },
            {
              iconComponent: <PlatformIcon name="book-open" size={18} color={colors.textSecondary} />,
              label: 'Exercise Catalog',
              sub: 'Browse exercises & favourites',
              onPress: () => onOpenExerciseCatalog?.(),
              testID: 'settings-catalog',
            },
            {
              iconComponent: <PlatformIcon name="help-circle" size={18} color={colors.textSecondary} />,
              label: 'Help & FAQ',
              sub: 'FAQ, reviews, workout science',
              onPress: () => onOpenHelpFaq?.(),
              testID: 'settings-faq',
            },
            {
              iconComponent: <PlatformIcon name="compass" size={18} color={colors.textSecondary} />,
              label: 'App Tour',
              sub: 'Replay the guided walkthrough',
              onPress: () => onReplayTour?.(),
              testID: 'settings-app-tour',
            },
          ].map((item, i, arr) => (
            <TouchableOpacity
              key={item.label}
              style={[
                styles.menuRow,
                i < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                (item as any).locked && { opacity: PRO_LOCKED_OPACITY },
              ]}
              onPress={item.onPress}
              activeOpacity={0.7}
              testID={item.testID}
            >
              {item.iconComponent}
              <View style={styles.menuText}>
                <Text style={[styles.menuLabel, { color: colors.text }]}>{item.label}</Text>
                <Text style={[styles.menuSub, { color: colors.textSecondary }]}>{item.sub}</Text>
              </View>
              {(item as any).locked
                ? <PlatformIcon name="crown" size={14} color={PRO_GOLD} strokeWidth={2} />
                : <PlatformIcon name="chevron-right" size={16} color={colors.textMuted} />}
            </TouchableOpacity>
          ))}

          {Platform.OS !== 'web' && (
            <TouchableOpacity
              style={styles.menuRow}
              onPress={handleHealthToggle}
              activeOpacity={0.7}
              testID="settings-health-sync"
            >
              {ctx.healthConnected
                ? <PlatformIcon name="heart-pulse" size={18} color="#ef4444" />
                : <PlatformIcon name="heart-pulse" size={18} color={hasPro ? colors.textSecondary : colors.textMuted} />}
              <View style={styles.menuText}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[styles.menuLabel, { color: colors.text }]}>
                    {Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect'}
                  </Text>
                  {ctx.healthConnected && (
                    <View style={styles.connectedBadge}>
                      <Animated.View
                        style={[
                          styles.connectedDot,
                          { transform: [{ scale: healthPulse }] },
                        ]}
                      />
                      <Text style={styles.connectedBadgeText}>Connected</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.menuSub, { color: colors.textSecondary }]}>
                  {!hasPro
                    ? 'Sync workouts to Health'
                    : ctx.healthConnected
                      ? 'Syncing steps, calories & workouts'
                      : healthConnecting
                        ? 'Requesting permissions...'
                        : 'Tap to connect & enable sync'}
                </Text>
              </View>
              {healthConnecting
                ? <ActivityIndicator size="small" color={colors.textSecondary} />
                : !hasPro
                  ? <PlatformIcon name="crown" size={14} color={PRO_GOLD} strokeWidth={2} />
                  : <PlatformIcon name="chevron-right" size={16} color={colors.textMuted} />}
            </TouchableOpacity>
          )}
        </GlassCard>

        {/* ── Card 3: Notifications ── */}
        {Platform.OS !== 'web' && (
          <>
            <View style={styles.notifSectionHeader}>
              <Text style={[styles.sectionHeader, { color: colors.textSecondary, flex: 1 }]}>Notifications</Text>
              {notifPermStatus === 'denied' && (
                <TouchableOpacity onPress={() => Platform.OS === 'ios' ? void Linking.openURL('app-settings:') : void Linking.openSettings()} activeOpacity={0.7}>
                  <Text style={[styles.notifPermDenied, { color: colors.textSecondary }]}>Enable in Settings</Text>
                </TouchableOpacity>
              )}
            </View>

            <GlassCard variant={isDark ? 'glass' : 'solid'} style={styles.section}>
              <TouchableOpacity
                style={[styles.toggleRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                onPress={() => void handleNotifToggle('dailyEnabled', !localNotif.dailyEnabled)}
                activeOpacity={0.7}
              >
                <View style={styles.notifToggleLabelWrap}>
                  <PlatformIcon name="clock" size={14} color={localNotif.dailyEnabled ? colors.text : colors.textMuted} strokeWidth={2} />
                  <Text style={[styles.toggleLabel, { color: colors.text }]}>Daily Workout Reminder</Text>
                </View>
                <Switch
                  value={localNotif.dailyEnabled}
                  onValueChange={(v) => void handleNotifToggle('dailyEnabled', v)}
                  trackColor={{ false: colors.border, true: `${colors.text}30` }}
                  thumbColor={localNotif.dailyEnabled ? colors.text : colors.textSecondary}
                />
              </TouchableOpacity>

              {localNotif.dailyEnabled && (
                <View style={[styles.timePicker, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                  <Text style={[styles.timePickerLabel, { color: colors.textSecondary }]}>Reminder time</Text>
                  <View style={styles.timePickerControls}>
                    <View style={styles.timeUnit}>
                      <TouchableOpacity onPress={() => handleTimeChange('daily', 'hour', 1)} style={styles.timeArrow} activeOpacity={0.7}>
                        <PlatformIcon name="chevron-up" size={16} color={colors.textSecondary} strokeWidth={2.5} />
                      </TouchableOpacity>
                      <Text style={[styles.timeValue, { color: colors.text }]}>
                        {String(localNotif.dailyHour % 12 || 12).padStart(2, '0')}
                      </Text>
                      <TouchableOpacity onPress={() => handleTimeChange('daily', 'hour', -1)} style={styles.timeArrow} activeOpacity={0.7}>
                        <PlatformIcon name="chevron-down" size={16} color={colors.textSecondary} strokeWidth={2.5} />
                      </TouchableOpacity>
                    </View>
                    <Text style={[styles.timeColon, { color: colors.textMuted }]}>:</Text>
                    <View style={styles.timeUnit}>
                      <TouchableOpacity onPress={() => handleTimeChange('daily', 'minute', 5)} style={styles.timeArrow} activeOpacity={0.7}>
                        <PlatformIcon name="chevron-up" size={16} color={colors.textSecondary} strokeWidth={2.5} />
                      </TouchableOpacity>
                      <Text style={[styles.timeValue, { color: colors.text }]}>
                        {String(localNotif.dailyMinute).padStart(2, '0')}
                      </Text>
                      <TouchableOpacity onPress={() => handleTimeChange('daily', 'minute', -5)} style={styles.timeArrow} activeOpacity={0.7}>
                        <PlatformIcon name="chevron-down" size={16} color={colors.textSecondary} strokeWidth={2.5} />
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        const h = localNotif.dailyHour;
                        setLocalNotif(prev => {
                          const updated = { ...prev, dailyHour: h >= 12 ? h - 12 : h + 12 };
                          ctxRef.current.saveNotifPrefs({ dailyHour: updated.dailyHour });
                          if (updated.dailyEnabled) void scheduleDailyReminder(updated.dailyHour, updated.dailyMinute);
                          return updated;
                        });
                      }}
                      style={[styles.ampmBtn, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.ampmText, { color: colors.text }]}>
                        {localNotif.dailyHour >= 12 ? 'PM' : 'AM'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[styles.toggleRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                onPress={() => void handleNotifToggle('streakEnabled', !localNotif.streakEnabled)}
                activeOpacity={0.7}
              >
                <View style={styles.notifToggleLabelWrap}>
                  <PlatformIcon name="bell" size={14} color={localNotif.streakEnabled ? colors.text : colors.textMuted} strokeWidth={2} />
                  <Text style={[styles.toggleLabel, { color: colors.text }]}>Streak Reminder</Text>
                </View>
                <Switch
                  value={localNotif.streakEnabled}
                  onValueChange={(v) => void handleNotifToggle('streakEnabled', v)}
                  trackColor={{ false: colors.border, true: `${colors.text}30` }}
                  thumbColor={localNotif.streakEnabled ? colors.text : colors.textSecondary}
                />
              </TouchableOpacity>

              {localNotif.streakEnabled && (
                <View style={[styles.timePicker, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                  <Text style={[styles.timePickerLabel, { color: colors.textSecondary }]}>Reminder time</Text>
                  <View style={styles.timePickerControls}>
                    <View style={styles.timeUnit}>
                      <TouchableOpacity onPress={() => handleTimeChange('streak', 'hour', 1)} style={styles.timeArrow} activeOpacity={0.7}>
                        <PlatformIcon name="chevron-up" size={16} color={colors.textSecondary} strokeWidth={2.5} />
                      </TouchableOpacity>
                      <Text style={[styles.timeValue, { color: colors.text }]}>
                        {String(localNotif.streakHour % 12 || 12).padStart(2, '0')}
                      </Text>
                      <TouchableOpacity onPress={() => handleTimeChange('streak', 'hour', -1)} style={styles.timeArrow} activeOpacity={0.7}>
                        <PlatformIcon name="chevron-down" size={16} color={colors.textSecondary} strokeWidth={2.5} />
                      </TouchableOpacity>
                    </View>
                    <Text style={[styles.timeColon, { color: colors.textMuted }]}>:</Text>
                    <View style={styles.timeUnit}>
                      <TouchableOpacity onPress={() => handleTimeChange('streak', 'minute', 5)} style={styles.timeArrow} activeOpacity={0.7}>
                        <PlatformIcon name="chevron-up" size={16} color={colors.textSecondary} strokeWidth={2.5} />
                      </TouchableOpacity>
                      <Text style={[styles.timeValue, { color: colors.text }]}>
                        {String(localNotif.streakMinute).padStart(2, '0')}
                      </Text>
                      <TouchableOpacity onPress={() => handleTimeChange('streak', 'minute', -5)} style={styles.timeArrow} activeOpacity={0.7}>
                        <PlatformIcon name="chevron-down" size={16} color={colors.textSecondary} strokeWidth={2.5} />
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        const h = localNotif.streakHour;
                        setLocalNotif(prev => {
                          const updated = { ...prev, streakHour: h >= 12 ? h - 12 : h + 12 };
                          ctxRef.current.saveNotifPrefs({ streakHour: updated.streakHour });
                          if (updated.streakEnabled) void scheduleStreakReminder(updated.streakHour, updated.streakMinute);
                          return updated;
                        });
                      }}
                      style={[styles.ampmBtn, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.ampmText, { color: colors.text }]}>
                        {localNotif.streakHour >= 12 ? 'PM' : 'AM'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[styles.toggleRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                onPress={() => void handleNotifToggle('weeklySummaryEnabled', !localNotif.weeklySummaryEnabled)}
                activeOpacity={0.7}
              >
                <View style={styles.notifToggleLabelWrap}>
                  <PlatformIcon name="bell-off" size={14} color={localNotif.weeklySummaryEnabled ? colors.text : colors.textMuted} strokeWidth={2} />
                  <View>
                    <Text style={[styles.toggleLabel, { color: colors.text }]}>Weekly Summary</Text>
                    <Text style={[styles.toggleTag, { color: colors.textMuted }]}>Every Sunday evening</Text>
                  </View>
                </View>
                <Switch
                  value={localNotif.weeklySummaryEnabled}
                  onValueChange={(v) => void handleNotifToggle('weeklySummaryEnabled', v)}
                  trackColor={{ false: colors.border, true: `${colors.text}30` }}
                  thumbColor={localNotif.weeklySummaryEnabled ? colors.text : colors.textSecondary}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => {
                  const v = !localNotif.zealTipsEnabled;
                  setLocalNotif(prev => ({ ...prev, zealTipsEnabled: v }));
                  ctxRef.current.saveNotifPrefs({ zealTipsEnabled: v });
                }}
                activeOpacity={0.7}
              >
                <View style={styles.notifToggleLabelWrap}>
                  <PlatformIcon name="lightbulb" size={14} color={localNotif.zealTipsEnabled ? colors.text : colors.textMuted} strokeWidth={2} />
                  <View>
                    <Text style={[styles.toggleLabel, { color: colors.text }]}>Zeal Tips</Text>
                    <Text style={[styles.toggleTag, { color: colors.textMuted }]}>In-app coaching hints on app open</Text>
                  </View>
                </View>
                <Switch
                  value={localNotif.zealTipsEnabled}
                  onValueChange={(v) => {
                    setLocalNotif(prev => ({ ...prev, zealTipsEnabled: v }));
                    ctxRef.current.saveNotifPrefs({ zealTipsEnabled: v });
                  }}
                  trackColor={{ false: colors.border, true: `${colors.text}30` }}
                  thumbColor={localNotif.zealTipsEnabled ? colors.text : colors.textSecondary}
                />
              </TouchableOpacity>
            </GlassCard>
          </>
        )}

        {/* ── Card 4: Account ── */}
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Account</Text>
        <GlassCard variant={isDark ? 'glass' : 'solid'} style={[styles.section, { padding: 0, gap: 0 }]}>
          <TouchableOpacity
            style={[styles.signOutRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
            onPress={handleSignOut}
            activeOpacity={0.7}
            testID="sign-out-btn"
          >
            <PlatformIcon name="log-out" size={18} color="#ef4444" strokeWidth={2} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>

          <View style={styles.dangerSection}>
            <TouchableOpacity
              style={styles.dangerHeader}
              onPress={toggleDanger}
              activeOpacity={0.75}
              testID="danger-zone-toggle"
            >
              <View style={styles.dangerHeaderLeft}>
                <PlatformIcon name="skull" size={18} color="#ef4444" strokeWidth={1.8} />
                <Text style={styles.dangerTitle}>Danger Zone</Text>
              </View>
              <Animated.View style={{ transform: [{ rotate: chevronRotateDanger }] }}>
                <PlatformIcon name="chevron-right" size={18} color="#ef4444" />
              </Animated.View>
            </TouchableOpacity>

            <Animated.View style={[styles.dangerBody, { height: dangerHeight, opacity: dangerOpacity }]}>
              <View style={[styles.dangerDivider, { backgroundColor: `rgba(239,68,68,${isDark ? '0.2' : '0.15'})` }]} />
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={handleDeleteAccount}
                activeOpacity={0.8}
                testID="delete-account-btn"
              >
                <PlatformIcon name="trash" size={16} color="#fff" strokeWidth={2} />
                <Text style={styles.deleteBtnText}>Delete Account & All Data</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </GlassCard>

        {/* ── Card 5: Legal ── */}
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Legal</Text>
        <GlassCard variant={isDark ? 'glass' : 'solid'} style={[styles.section, { padding: 0, gap: 0 }]}>
          <TouchableOpacity
            style={[styles.signOutRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
            onPress={() => void Linking.openURL('https://zealplus.app/privacy-policy.html')}
            activeOpacity={0.7}
            testID="legal-privacy-policy"
          >
            <PlatformIcon name="shield" size={18} color={colors.textSecondary} strokeWidth={2} />
            <Text style={[styles.signOutText, { color: colors.text }]}>Privacy Policy</Text>
            <PlatformIcon name="chevron-right" size={16} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.signOutRow, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
            onPress={() => void Linking.openURL('https://zealplus.app/terms-of-service.html')}
            activeOpacity={0.7}
            testID="legal-terms-of-service"
          >
            <PlatformIcon name="file-text" size={18} color={colors.textSecondary} strokeWidth={2} />
            <Text style={[styles.signOutText, { color: colors.text }]}>Terms of Service</Text>
            <PlatformIcon name="chevron-right" size={16} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signOutRow}
            onPress={() => Alert.alert('Data Export Requested', 'Your data export has been requested. You will receive an email within 48 hours.', [{ text: 'OK' }])}
            activeOpacity={0.7}
            testID="legal-export-data"
          >
            <PlatformIcon name="download" size={18} color={colors.textSecondary} strokeWidth={2} />
            <Text style={[styles.signOutText, { color: colors.text }]}>Export My Data</Text>
            <PlatformIcon name="chevron-right" size={16} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        </GlassCard>

        <View style={{ height: 24 }} />
      </View>
    </BaseDrawer>

    <RunSettingsDrawer
      visible={runSettingsVisible}
      onClose={() => setRunSettingsVisible(false)}
    />

    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    overflow: 'visible',
  },
  headerCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(128,128,128,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  headerSaveBtn: {
    borderRadius: 19,
    width: 96,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SAVE_BTN_COLOR,
  },
  headerSaveText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
    fontWeight: '600' as const,
  },
  title: { fontSize: 18, fontWeight: '800' as const, letterSpacing: -0.3 },
  content: { paddingHorizontal: 16, gap: 12, paddingBottom: 8 },
  sectionHeader: { fontSize: 13, fontWeight: '600' as const, letterSpacing: 0.2, fontFamily: 'Outfit_600SemiBold', textTransform: 'none' as const, marginLeft: 4 },
  section: { borderRadius: 20, padding: 16, gap: 14 },
  sectionDivider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  fieldLabel: { fontSize: 10, fontWeight: '700' as const, letterSpacing: 0.8 },
  styleChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  styleChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5,
  },
  chipInner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  splitChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5,
  },
  styleChipText: { fontSize: 13, fontWeight: '500' as const },
  descRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  styleDesc: { fontSize: 12, lineHeight: 18 },
  sliderHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sliderValue: { fontSize: 13, fontWeight: '700' as const },
  sliderStyle: { width: '100%' },
  durationLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  durationLabel: { fontSize: 10 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  toggleLabel: { fontSize: 14, fontWeight: '500' as const },
  toggleTag: { fontSize: 12, fontWeight: '400' as const },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, gap: 12 },
  menuText: { flex: 1, gap: 2 },
  menuLabel: { fontSize: 15, fontWeight: '600' as const },
  menuSub: { fontSize: 12 },
  moreRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
  },
  moreText: { fontSize: 14, fontWeight: '500' as const },
  morePlaceholder: { fontSize: 13, textAlign: 'center' as const, paddingVertical: 8 },
  notifSectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  notifPermDenied: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.3,
  },
  notifToggleLabelWrap: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    flex: 1,
  },
  timePicker: {
    paddingVertical: 10,
    paddingLeft: 4,
  },
  timePickerLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  timePickerControls: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  timeUnit: {
    alignItems: 'center' as const,
    width: 44,
  },
  timeArrow: {
    padding: 4,
  },
  timeValue: {
    fontSize: 22,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
    lineHeight: 28,
  },
  timeColon: {
    fontSize: 22,
    fontWeight: '700' as const,
    marginHorizontal: 2,
    marginBottom: 2,
  },
  ampmBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 8,
  },
  ampmText: {
    fontSize: 13,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
  fixedDuration: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center' as const,
  },
  fixedDurationText: { fontSize: 13, fontWeight: '500' as const },
  connectedBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  connectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  connectedBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#22c55e',
    letterSpacing: 0.4,
  },
  signOutRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#ef4444',
  },
  dangerSection: {
    overflow: 'hidden' as const,
  },
  dangerHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dangerHeaderLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  dangerTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#ef4444',
    letterSpacing: 0.2,
  },
  dangerBody: {
    overflow: 'hidden' as const,
    paddingHorizontal: 16,
  },
  dangerDivider: {
    height: 1,
    marginBottom: 16,
  },
  deleteBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: '#dc2626',
    borderRadius: 100,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#fff',
    letterSpacing: 0.2,
  },
});
