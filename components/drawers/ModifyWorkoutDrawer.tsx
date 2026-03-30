import React, { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Dumbbell, Building2, Bookmark, Check, ChevronDown, ChevronUp, User, Crown } from 'lucide-react-native';
import DrawerHeader from '@/components/drawers/DrawerHeader';
import { useDrawerSizing } from '@/components/drawers/useDrawerSizing';
import { showProGate, PRO_GOLD, PRO_LOCKED_OPACITY, PRO_STYLES_SET } from '@/services/proGate';
import { useZealTheme, useAppContext, type WorkoutOverride, type LastModifyState } from '@/context/AppContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WORKOUT_STYLE_COLORS } from '@/constants/colors';
import {
  getStyleConfig,
  getDurationSteps,
  clampDurationToStyle,
  showRestSlider,
  MUSCLE_CHIPS,
} from '@/services/workoutConfig';
import { SPLIT_TO_MUSCLES } from '@/services/engineConstants';
import CustomSlider from '@/components/CustomSlider';
import { ALL_EQUIPMENT_IDS } from '@/mocks/equipmentData';

const WORKOUT_STYLES_LIST = [
  { key: 'Auto', desc: 'Engine picks the best style for today' },
  { key: 'Strength', desc: 'Heavy compound lifts, progressive overload' },
  { key: 'Bodybuilding', desc: 'Volume, isolation, muscle growth' },
  { key: 'Low-Impact', desc: 'Joint-friendly, higher reps, sustainable' },
  { key: 'CrossFit', desc: 'Varied functional movements at intensity' },
  { key: 'Hyrox', desc: 'Race-specific functional fitness' },
  { key: 'Pilates', desc: 'Core control, mobility, mind-body' },
  { key: 'Cardio', desc: 'Endurance, zone training, conditioning' },
  { key: 'HIIT', desc: 'High-intensity intervals, max effort' },
  { key: 'Mobility', desc: 'Joint health, flexibility, recovery' },
];

const AUTO_COLOR = '#888888';

const APPLY_BTN_COLOR = '#f87116';

interface Props {
  visible: boolean;
  onClose: () => void;
  onWorkoutChanged: (style: string, split: string, duration: number, muscles: string[], rest: number) => void;
}

export default function ModifyWorkoutDrawer({ visible, onClose, onWorkoutChanged }: Props) {
  const { colors, isDark } = useZealTheme();
  const ctx = useAppContext();
  const { hasPro, openPaywall } = useSubscription();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const styleSheetRef = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const topOffset = Math.max(insets.top, 0) + 16;
  const {
    snapPoints,
    maxDynamicContentSize,
    scrollEnabled,
    setContentH,
  } = useDrawerSizing({ minHeight: 440, headerEst: 72, footerEst: 40 });

  const [localStyle, setLocalStyle] = useState(ctx.workoutStyle);
  const [localSplit, setLocalSplit] = useState<string>('Auto');
  const [localDuration, setLocalDuration] = useState(ctx.targetDuration);
  const [localRest, setLocalRest] = useState(ctx.restBetweenSets);
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [cfHyroxTarget, setCfHyroxTarget] = useState<string | null>(null);
  const [gymPreset, setGymPreset] = useState<'commercial' | 'no_equipment' | string>('commercial');
  const [savedGymsOpen, setSavedGymsOpen] = useState(false);

  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  const detectGymPreset = useCallback((c: typeof ctx): 'commercial' | 'no_equipment' | string => {
    const equip = c.selectedEquipment;
    const selectedCount = Object.values(equip).filter(v => v > 0).length;
    const totalCount = ALL_EQUIPMENT_IDS.length;

    if (selectedCount === 0) return 'no_equipment';
    if (selectedCount === totalCount) return 'commercial';

    for (const gym of c.savedGyms) {
      const gymKeys = Object.keys(gym.equipment).filter(k => gym.equipment[k] > 0);
      const equipKeys = Object.keys(equip).filter(k => equip[k] > 0);
      if (gymKeys.length === equipKeys.length && gymKeys.every(k => equip[k] > 0)) {
        return gym.id;
      }
    }

    return 'commercial';
  }, []);

  const config = useMemo(() => getStyleConfig(localStyle), [localStyle]);
  const durationSteps = useMemo(() => getDurationSteps(localStyle), [localStyle]);
  const restVisible = useMemo(() => showRestSlider(localStyle, localSplit), [localStyle, localSplit]);
  const musclesOverrideSplit = selectedMuscles.length > 0 && localSplit === '';

  useEffect(() => {
    if (visible) {
      const c = ctxRef.current;
      const lm = c.lastModifyState;

      if (lm) {
        setLocalStyle(lm.style);
        setLocalSplit(lm.split);
        setLocalDuration(lm.duration);
        setLocalRest(lm.rest);
        setSelectedMuscles(lm.muscles);
        setCfHyroxTarget((lm.style === 'CrossFit' || lm.style === 'Hyrox') ? detectTargetPreset(lm.muscles) : null);
        setGymPreset(lm.gymPreset ?? detectGymPreset(c));
        setSavedGymsOpen(false);
      } else {
        setLocalStyle(c.workoutStyle);
        setLocalDuration(c.targetDuration);
        setLocalRest(c.restBetweenSets);
        const cfg = getStyleConfig(c.workoutStyle);
        const validSplit = cfg.slot_options.includes(c.trainingSplit)
          ? c.trainingSplit
          : (cfg.slot_options[0] ?? 'Auto');
        setLocalSplit(validSplit);
        const autoMuscles = SPLIT_TO_MUSCLES[validSplit] ?? [];
        if (autoMuscles.length > 0) {
          const displayNames = MUSCLE_CHIPS
            .filter(chip => chip.enums.some(e => autoMuscles.includes(e)))
            .map(chip => chip.display);
          setSelectedMuscles(displayNames);
        } else {
          setSelectedMuscles([]);
        }
        setCfHyroxTarget(null);
        setGymPreset(detectGymPreset(c));
        setSavedGymsOpen(false);
      }
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible]);

  const handleDismiss = useCallback(() => {
    onClose();
  }, [onClose]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.6}
        pressBehavior="close"
      />
    ),
    []
  );

  const renderStyleBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    []
  );

  const styleAccent = localStyle === 'Auto' ? AUTO_COLOR : (WORKOUT_STYLE_COLORS[localStyle] ?? '#f87116');
  const subtleSurface = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';

  const isCFOrHyrox = localStyle === 'CrossFit' || localStyle === 'Hyrox';
  const CORE_KEYS = ['core', 'obliques', 'transverse_abdominis'];
  const uniq = (arr: string[]) => Array.from(new Set(arr));
  const withCore = (keys: string[]) => uniq([...keys, ...CORE_KEYS]);
  const TARGET_PRESETS = useMemo((): Array<{ label: string; muscles: string[] }> => ([
    { label: 'Upper', muscles: withCore(SPLIT_TO_MUSCLES['Upper'] ?? []) },
    { label: 'Lower', muscles: withCore(SPLIT_TO_MUSCLES['Lower'] ?? []) },
    { label: 'Full Body', muscles: withCore(SPLIT_TO_MUSCLES['Full Body'] ?? []) },
    { label: 'Push', muscles: withCore(SPLIT_TO_MUSCLES['Push'] ?? []) },
    { label: 'Pull', muscles: withCore(SPLIT_TO_MUSCLES['Pull'] ?? []) },
    { label: 'Legs', muscles: withCore(SPLIT_TO_MUSCLES['Legs'] ?? []) },
  ]), []);

  const detectTargetPreset = (muscles: string[]): string | null => {
    if (muscles.length === 0) return null;
    const set = new Set(muscles);
    for (const p of TARGET_PRESETS) {
      if (p.muscles.length !== muscles.length) continue;
      if (p.muscles.every(m => set.has(m))) return p.label;
    }
    return null;
  };

  const handleStyleSelect = useCallback((s: string) => {
    if (s !== 'Auto' && !hasPro && PRO_STYLES_SET.has(s)) {
      showProGate('workoutStyle', openPaywall);
      return;
    }
    setLocalStyle(s);
    if (s === 'Auto') {
      setLocalSplit('Auto');
    } else {
      const cfg = getStyleConfig(s);
      setLocalSplit(cfg.slot_options[0] ?? 'Auto');
      setLocalDuration(clampDurationToStyle(ctxRef.current.targetDuration, s));
    }
    setSelectedMuscles([]);
    setCfHyroxTarget(null);
    styleSheetRef.current?.dismiss();
  }, [hasPro, openPaywall]);

  const handleSlotSelect = useCallback((sp: string) => {
    setLocalSplit(sp);
    const muscles = SPLIT_TO_MUSCLES[sp] ?? [];
    if (muscles.length > 0) {
      const displayNames = MUSCLE_CHIPS
        .filter(chip => chip.enums.some(e => muscles.includes(e)))
        .map(chip => chip.display);
      setSelectedMuscles(displayNames);
    } else {
      setSelectedMuscles([]);
    }
  }, []);

  const handleMuscleToggle = useCallback((muscle: string) => {
    setLocalSplit('');
    setSelectedMuscles((prev) =>
      prev.includes(muscle) ? prev.filter((m) => m !== muscle) : [...prev, muscle]
    );
  }, []);

  const handleTargetPresetSelect = useCallback((label: string) => {
    const preset = TARGET_PRESETS.find(p => p.label === label);
    if (!preset) return;
    setCfHyroxTarget(label);
    setSelectedMuscles(preset.muscles);
  }, [TARGET_PRESETS]);

  const handleDurationChange = useCallback((v: number) => {
    const closest = durationSteps.reduce((prev, curr) =>
      Math.abs(curr - v) < Math.abs(prev - v) ? curr : prev
    );
    setLocalDuration(closest);
  }, [durationSteps]);

  const handleSelectNoEquipment = useCallback(() => {
    setGymPreset('no_equipment');
    setSavedGymsOpen(false);
  }, []);

  const handleSelectCommercial = useCallback(() => {
    setGymPreset('commercial');
    setSavedGymsOpen(false);
  }, []);

  const handleToggleSavedGyms = useCallback(() => {
    setSavedGymsOpen((v) => !v);
  }, []);

  const handleSelectGym = useCallback((gymId: string) => {
    setGymPreset(gymId);
    setSavedGymsOpen(false);
  }, []);

  const handleApply = useCallback(() => {
    const effectiveSplit =
      localSplit === '' ? (config.slot_options[0] ?? 'Full Body') : localSplit;

    const c = ctxRef.current;

    if (gymPreset === 'no_equipment') {
      const none: Record<string, number> = {};
      ALL_EQUIPMENT_IDS.forEach((id) => { none[id] = 0; });
      c.setSelectedEquipment(none);
    } else if (gymPreset === 'commercial') {
      const all: Record<string, number> = {};
      ALL_EQUIPMENT_IDS.forEach((id) => { all[id] = 1; });
      c.setSelectedEquipment(all);
    } else {
      const gym = c.savedGyms.find((g) => g.id === gymPreset);
      if (gym) {
        c.setSelectedEquipment({ ...gym.equipment });
      } else {
        const all: Record<string, number> = {};
        ALL_EQUIPMENT_IDS.forEach((id) => { all[id] = 1; });
        c.setSelectedEquipment(all);
      }
    }

    const lmState: LastModifyState = {
      style: localStyle,
      split: effectiveSplit,
      duration: localDuration,
      rest: localRest,
      muscles: selectedMuscles,
      gymPreset,
    };
    c.saveLastModifyState(lmState);

    const override: WorkoutOverride = {
      style: localStyle,
      split: effectiveSplit,
      duration: localDuration,
      rest: localRest,
      muscles: selectedMuscles,
      setDate: '',
    };
    c.applyWorkoutOverride(override);
    onWorkoutChanged(localStyle, effectiveSplit, localDuration, selectedMuscles, localRest);
    onClose();
  }, [localStyle, localSplit, localDuration, localRest, selectedMuscles, gymPreset, config, onWorkoutChanged, onClose]);

  const restLabel = localRest < 0.33 ? 'Less' : localRest < 0.67 ? 'Standard' : 'Longer';
  const durationMin = config.duration_min;
  const durationMax = config.duration_max;

  const activeGymLabel = useMemo(() => {
    if (gymPreset === 'no_equipment') return 'No Equipment';
    if (gymPreset === 'commercial') return 'Commercial Gym';
    const gym = ctx.savedGyms.find((g) => g.id === gymPreset);
    return gym?.name ?? 'Commercial Gym';
  }, [gymPreset, ctx.savedGyms]);

  const savedGymsBtnLabel = useMemo(() => {
    if (gymPreset && gymPreset !== 'commercial' && gymPreset !== 'no_equipment') {
      const gym = ctx.savedGyms.find((g) => g.id === gymPreset);
      return gym?.name ?? 'Saved Gyms';
    }
    return 'Saved Gyms';
  }, [gymPreset, ctx.savedGyms]);

  return (
    <>
      <BottomSheetModal
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        maxDynamicContentSize={maxDynamicContentSize}
        onDismiss={handleDismiss}
        backdropComponent={renderBackdrop}
        backgroundStyle={[styles.sheetBg, { backgroundColor: colors.card }]}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
        enablePanDownToClose
        enableOverDrag={false}
        topInset={topOffset}
        stackBehavior="push"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Modify Workout</Text>
          <TouchableOpacity
            style={styles.applyBtn}
            onPress={handleApply}
            activeOpacity={0.85}
          >
            <Text style={styles.applyBtnText}>Apply</Text>
          </TouchableOpacity>
        </View>

        <BottomSheetScrollView
          showsVerticalScrollIndicator={false}
          bounces={false}
          scrollEnabled={scrollEnabled}
          contentContainerStyle={styles.content}
          onContentSizeChange={(_w: number, h: number) => setContentH(h)}
        >
          {/* Target Duration */}
          <View style={styles.section}>
            <View style={styles.sectionLabelRow}>
              <Text style={[styles.sectionLabel, { color: colors.text }]}>Target Duration</Text>
              <Text style={[styles.sectionValueBadge, { color: styleAccent }]}>{localDuration}m</Text>
            </View>
            <CustomSlider
              value={localDuration}
              minimumValue={durationMin}
              maximumValue={durationMax}
              step={1}
              onValueChange={handleDurationChange}
              minimumTrackColor={styleAccent}
              maximumTrackColor={colors.border}
              thumbColor={styleAccent}
              style={styles.slider}
            />
            <View style={styles.rangeLabels}>
              {durationSteps.map((s) => (
                <Text key={s} style={[styles.rangeLabel, { color: colors.textMuted }]}>{s}m</Text>
              ))}
            </View>
          </View>

          {/* Workout Style */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.text }]}>Workout Style</Text>
            <TouchableOpacity
              style={[styles.stylePickerRow, { backgroundColor: subtleSurface, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' }]}
              onPress={() => styleSheetRef.current?.present()}
              activeOpacity={0.75}
            >
              <View style={[styles.styleDot, { backgroundColor: styleAccent }]} />
              <View style={styles.stylePickerTextCol}>
                <Text style={[styles.stylePickerLabel, { color: colors.text }]}>{localStyle}</Text>
                <Text style={[styles.stylePickerDesc, { color: colors.textSecondary }]}>
                  {WORKOUT_STYLES_LIST.find(s => s.key === localStyle)?.desc ?? 'Select a training style'}
                </Text>
              </View>
              <Text style={[styles.stylePickerChange, { color: styleAccent }]}>Change</Text>
            </TouchableOpacity>
          </View>

          {/* Split / Format */}
          {localStyle !== 'Auto' && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.text }]}>{config.slot_label}</Text>
              <View style={styles.chipGrid}>
                {/* Auto chip — always first */}
                {(() => {
                  const isAutoSelected = localSplit === 'Auto' && !musclesOverrideSplit;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.chip,
                        { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' },
                        isAutoSelected && { backgroundColor: AUTO_COLOR },
                      ]}
                      onPress={() => handleSlotSelect('Auto')}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.chipText,
                        { color: isAutoSelected ? '#fff' : isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)' },
                      ]}>
                        Auto
                      </Text>
                    </TouchableOpacity>
                  );
                })()}
                {/* Style-specific options (skip if already listed as 'Auto') */}
                {config.slot_options.filter(sp => sp !== 'Auto').map((sp) => {
                  const isSelected = localSplit === sp && !musclesOverrideSplit;
                  return (
                    <TouchableOpacity
                      key={sp}
                      style={[
                        styles.chip,
                        { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' },
                        isSelected && { backgroundColor: styleAccent },
                      ]}
                      onPress={() => handleSlotSelect(sp)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.chipText,
                        { color: isSelected ? '#fff' : isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)' },
                      ]}>
                        {sp}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Muscles / Target */}
          {config.show_specific_muscles && localStyle !== 'Auto' && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.text }]}>{config.muscles_label}</Text>
              <View style={styles.chipGrid}>
                {/* Auto chip — always first, clears muscle selection */}
                {(() => {
                  const isAutoMuscles = selectedMuscles.length === 0 && !cfHyroxTarget;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.chip,
                        { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' },
                        isAutoMuscles && { backgroundColor: AUTO_COLOR },
                      ]}
                      onPress={() => {
                        setSelectedMuscles([]);
                        setCfHyroxTarget(null);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.chipText,
                        { color: isAutoMuscles ? '#fff' : isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)' },
                      ]}>
                        Auto
                      </Text>
                    </TouchableOpacity>
                  );
                })()}
                {isCFOrHyrox ? (
                  TARGET_PRESETS.map((p) => {
                    const isSelected = cfHyroxTarget === p.label;
                    return (
                      <TouchableOpacity
                        key={p.label}
                        style={[
                          styles.chip,
                          { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' },
                          isSelected && { backgroundColor: styleAccent },
                        ]}
                        onPress={() => handleTargetPresetSelect(p.label)}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.chipText,
                          { color: isSelected ? '#fff' : isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)' },
                        ]}>
                          {p.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  MUSCLE_CHIPS.map(({ display }) => {
                    const isSelected = selectedMuscles.includes(display);
                    return (
                      <TouchableOpacity
                        key={display}
                        style={[
                          styles.chip,
                          { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' },
                          isSelected && { backgroundColor: styleAccent },
                        ]}
                        onPress={() => handleMuscleToggle(display)}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.chipText,
                          { color: isSelected ? '#fff' : isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)' },
                        ]}>
                          {display}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </View>
          )}

          {/* Equipment */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.text }]}>Gym Equipment</Text>
            <View style={styles.gymPresetsTopRow}>
              <TouchableOpacity
                style={[
                  styles.gymPresetBtn,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' },
                  gymPreset === 'no_equipment' && { backgroundColor: styleAccent },
                ]}
                onPress={handleSelectNoEquipment}
                activeOpacity={0.7}
              >
                <User size={14} color={gymPreset === 'no_equipment' ? '#fff' : isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'} />
                <Text style={[
                  styles.gymPresetBtnText,
                  { color: gymPreset === 'no_equipment' ? '#fff' : isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)' },
                ]}>
                  No Equipment
                </Text>
                {gymPreset === 'no_equipment' && (
                  <View style={styles.gymCheckDot}>
                    <Check size={8} color="#fff" strokeWidth={3} />
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.gymPresetBtn,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' },
                  gymPreset === 'commercial' && { backgroundColor: styleAccent },
                ]}
                onPress={handleSelectCommercial}
                activeOpacity={0.7}
              >
                <Building2 size={14} color={gymPreset === 'commercial' ? '#fff' : isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'} />
                <Text style={[
                  styles.gymPresetBtnText,
                  { color: gymPreset === 'commercial' ? '#fff' : isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)' },
                ]}>
                  Commercial
                </Text>
                {gymPreset === 'commercial' && (
                  <View style={styles.gymCheckDot}>
                    <Check size={8} color="#fff" strokeWidth={3} />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.gymPresetBtnFull,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' },
                (gymPreset !== 'commercial' && gymPreset !== 'no_equipment') && { backgroundColor: styleAccent },
              ]}
              onPress={handleToggleSavedGyms}
              activeOpacity={0.7}
            >
              <Bookmark
                size={14}
                color={(gymPreset !== 'commercial' && gymPreset !== 'no_equipment') ? '#fff' : isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
              />
              <Text
                style={[
                  styles.gymPresetBtnText,
                  { color: (gymPreset !== 'commercial' && gymPreset !== 'no_equipment') ? '#fff' : isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)' },
                  { flex: 1 },
                ]}
                numberOfLines={1}
              >
                {savedGymsBtnLabel}
              </Text>
              {savedGymsOpen ? (
                <ChevronUp size={12} color={(gymPreset !== 'commercial' && gymPreset !== 'no_equipment') ? 'rgba(255,255,255,0.7)' : isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'} />
              ) : (
                <ChevronDown size={12} color={(gymPreset !== 'commercial' && gymPreset !== 'no_equipment') ? 'rgba(255,255,255,0.7)' : isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'} />
              )}
            </TouchableOpacity>

            {savedGymsOpen && (
              <View style={[styles.savedGymsList, { backgroundColor: colors.cardSecondary, borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' }]}>
                {ctx.savedGyms.length === 0 ? (
                  <Text style={[styles.noGymsText, { color: colors.textMuted }]}>
                    No saved gyms. Add gyms in the Equipment settings.
                  </Text>
                ) : (
                  ctx.savedGyms.map((gym) => {
                    const isActive = gymPreset === gym.id;
                    const itemCount = Object.values(gym.equipment).filter(v => v > 0).length;
                    return (
                      <TouchableOpacity
                        key={gym.id}
                        style={[
                          styles.savedGymRow,
                          { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
                          isActive && { backgroundColor: `${styleAccent}12` },
                        ]}
                        onPress={() => handleSelectGym(gym.id)}
                        activeOpacity={0.7}
                      >
                        <View style={[
                          styles.savedGymIconWrap,
                          { backgroundColor: isActive ? `${styleAccent}22` : `${colors.border}50` },
                        ]}>
                          <Bookmark size={11} color={isActive ? styleAccent : colors.textSecondary} />
                        </View>
                        <View style={styles.savedGymInfo}>
                          <Text style={[styles.savedGymName, { color: isActive ? styleAccent : colors.text }]}>
                            {gym.name}
                          </Text>
                          <Text style={[styles.savedGymCount, { color: colors.textMuted }]}>
                            {itemCount} item{itemCount !== 1 ? 's' : ''}
                          </Text>
                        </View>
                        {isActive && (
                          <View style={[styles.activeIndicator, { backgroundColor: styleAccent }]}>
                            <Check size={9} color="#fff" strokeWidth={3} />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            )}
          </View>

          {/* Rest Between Sets */}
          {restVisible && (
            <View style={styles.section}>
              <View style={styles.sectionLabelRow}>
                <Text style={[styles.sectionLabel, { color: colors.text }]}>Rest Between Sets</Text>
                <Text style={[styles.sectionValueBadge, { color: styleAccent }]}>{restLabel}</Text>
              </View>
              <CustomSlider
                value={localRest}
                minimumValue={0}
                maximumValue={1}
                step={0.01}
                onValueChange={setLocalRest}
                minimumTrackColor={styleAccent}
                maximumTrackColor={colors.border}
                thumbColor={styleAccent}
                style={styles.slider}
              />
              <View style={styles.rangeLabels}>
                <Text style={[styles.rangeLabel, { color: colors.textMuted }]}>Less</Text>
                <Text style={[styles.rangeLabel, { color: colors.textMuted }]}>More</Text>
              </View>
            </View>
          )}

          <View style={{ height: 32 }} />
        </BottomSheetScrollView>
      </BottomSheetModal>

      {/* Secondary Style Picker Drawer */}
      <BottomSheetModal
        ref={styleSheetRef}
        snapPoints={['72%']}
        backdropComponent={renderStyleBackdrop}
        backgroundStyle={[styles.sheetBg, { backgroundColor: colors.card }]}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
        enablePanDownToClose
        enableOverDrag={false}
        topInset={topOffset}
        stackBehavior="push"
      >
        <DrawerHeader
          title="Workout Style"
          onBack={() => styleSheetRef.current?.dismiss()}
        />
        <BottomSheetScrollView
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={styles.styleSheetContent}
        >
          {WORKOUT_STYLES_LIST.map((s) => {
            const isSelected = localStyle === s.key;
            const isLocked = s.key !== 'Auto' && !hasPro && PRO_STYLES_SET.has(s.key);
            const color = s.key === 'Auto' ? AUTO_COLOR : (WORKOUT_STYLE_COLORS[s.key] ?? APPLY_BTN_COLOR);
            return (
              <TouchableOpacity
                key={s.key}
                style={[
                  styles.styleListRow,
                  { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)', backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' },
                  isSelected && { borderColor: color, backgroundColor: `${color}15` },
                  isLocked && { opacity: PRO_LOCKED_OPACITY },
                ]}
                onPress={() => handleStyleSelect(s.key)}
                activeOpacity={0.75}
              >
                <View style={[styles.styleListDot, { backgroundColor: color }]} />
                <View style={styles.styleListTextCol}>
                  <Text style={[styles.styleListLabel, { color: isSelected ? color : colors.text }]}>{s.key}</Text>
                  <Text style={[styles.styleListDesc, { color: colors.textSecondary }]}>{s.desc}</Text>
                </View>
                {isLocked && <Crown size={13} color={PRO_GOLD} strokeWidth={2} />}
                {isSelected && !isLocked && <View style={[styles.styleListCheck, { backgroundColor: color }]} />}
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 24 }} />
        </BottomSheetScrollView>
      </BottomSheetModal>
    </>
  );
}

const styles = StyleSheet.create({
  sheetBg: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 14,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.5,
    flex: 1,
  },
  applyBtn: {
    borderRadius: 14,
    paddingHorizontal: 22,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APPLY_BTN_COLOR,
  },
  applyBtnText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.2,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 28,
  },
  section: {
    gap: 12,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.3,
  },
  sectionValueBadge: {
    fontSize: 13,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.1,
  },
  slider: {
    width: '100%',
  },
  rangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4,
  },
  rangeLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_400Regular',
  },
  stylePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  styleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  stylePickerTextCol: {
    flex: 1,
    gap: 2,
  },
  stylePickerLabel: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: -0.2,
  },
  stylePickerDesc: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
  },
  stylePickerChange: {
    fontSize: 13,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: -0.1,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipText: {
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
  },
  gymPresetsTopRow: {
    flexDirection: 'row',
    gap: 10,
  },
  gymPresetBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 26,
    paddingHorizontal: 12,
    height: 48,
  },
  gymPresetBtnFull: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 26,
    paddingHorizontal: 12,
    height: 48,
  },
  gymPresetBtnText: {
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
  },
  gymCheckDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  savedGymsList: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 4,
  },
  noGymsText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  savedGymRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  savedGymIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedGymInfo: {
    flex: 1,
  },
  savedGymName: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  savedGymCount: {
    fontSize: 11,
    marginTop: 1,
  },
  activeIndicator: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  styleSheetHeader: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 16,
  },
  styleSheetTitle: {
    fontSize: 22,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.4,
  },
  styleSheetContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  styleListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  styleListDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  styleListTextCol: {
    flex: 1,
    gap: 2,
  },
  styleListLabel: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
  },
  styleListDesc: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
  },
  styleListCheck: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  customBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  customBadgeText: {
    fontSize: 9,
    fontWeight: '700' as const,
    letterSpacing: 0.6,
  },
});
