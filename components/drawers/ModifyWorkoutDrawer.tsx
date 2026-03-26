import React, { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { X, Dumbbell, Building2, Bookmark, Check, ChevronDown, ChevronUp, User, Crown } from 'lucide-react-native';
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

const WORKOUT_STYLES = [
  'Strength', 'Bodybuilding', 'CrossFit', 'Hyrox',
  'Cardio', 'HIIT', 'Mobility', 'Pilates', 'Low-Impact',
];



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
  const insets = useSafeAreaInsets();
  const topOffset = Math.max(insets.top, 0) + 16;
  const { height: windowH } = useWindowDimensions();
  const maxDynamicContentSize = useMemo(() => {
    return Math.max(520, Math.min(windowH - topOffset - 24, Math.round(windowH * 0.92)));
  }, [windowH, topOffset]);
  const [contentH, setContentH] = useState(0);
  // Compute a tight snap height so the sheet never opens past content.
  const snapPoints = useMemo(() => {
    const HEADER_AND_HANDLE_EST = 86; // header row + handle spacing
    const FOOTER_EST = 16;
    const desired = contentH > 0 ? contentH + HEADER_AND_HANDLE_EST + FOOTER_EST : maxDynamicContentSize;
    const clamped = Math.min(maxDynamicContentSize, Math.max(360, Math.round(desired)));
    return [clamped];
  }, [contentH, maxDynamicContentSize]);

  const [localStyle, setLocalStyle] = useState(ctx.workoutStyle);
  const [localSplit, setLocalSplit] = useState<string>('Auto');
  const [localDuration, setLocalDuration] = useState(ctx.targetDuration);
  const [localRest, setLocalRest] = useState(ctx.restBetweenSets);
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [gymPreset, setGymPreset] = useState<'commercial' | 'no_equipment' | string>('commercial');
  const [savedGymsOpen, setSavedGymsOpen] = useState(false);
  type SectionKey = 'duration' | 'style' | 'split' | 'muscles' | 'equipment';
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    duration: true,
    style: false,
    split: false,
    muscles: false,
    equipment: false,
  });

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
        console.log('[ModifyDrawer] Restoring from lastModifyState:', lm);
        setLocalStyle(lm.style);
        setLocalSplit(lm.split);
        setLocalDuration(lm.duration);
        setLocalRest(lm.rest);
        setSelectedMuscles(lm.muscles);
        setGymPreset(lm.gymPreset ?? detectGymPreset(c));
        setSavedGymsOpen(false);
        setOpenSections({ duration: true, style: false, split: false, muscles: false, equipment: false });
      } else {
        console.log('[ModifyDrawer] No lastModifyState, falling back to settings');
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
        setGymPreset(detectGymPreset(c));
        setSavedGymsOpen(false);
        setOpenSections({ duration: true, style: false, split: false, muscles: false, equipment: false });
      }
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible]);

  const toggleSection = useCallback((key: SectionKey) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Resize the drawer as content expands/collapses.
  const lastSnapHRef = useRef<number>(0);
  useEffect(() => {
    if (!visible) return;
    const target = snapPoints[0] ?? 0;
    if (Math.abs(target - lastSnapHRef.current) < 4) return;
    lastSnapHRef.current = target;
    requestAnimationFrame(() => {
      bottomSheetRef.current?.snapToIndex(0);
    });
  }, [snapPoints, visible]);

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

  const styleAccent = WORKOUT_STYLE_COLORS[localStyle] ?? '#f87116';
  const subtleSurface = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const subtleBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const divider = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  const handleStyleSelect = useCallback((s: string) => {
    if (!hasPro && PRO_STYLES_SET.has(s)) {
      showProGate('workoutStyle', openPaywall);
      return;
    }
    const cfg = getStyleConfig(s);
    setLocalStyle(s);
    setLocalSplit(cfg.slot_options[0] ?? 'Auto');
    setSelectedMuscles([]);
    setLocalDuration(clampDurationToStyle(ctxRef.current.targetDuration, s));
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
    console.log(`[ModifyDrawer] Apply: style=${localStyle} split=${effectiveSplit} duration=${localDuration} rest=${localRest} muscles=${selectedMuscles.join(',')} gymPreset=${gymPreset}`);

    const c = ctxRef.current;

    if (gymPreset === 'no_equipment') {
      const none: Record<string, number> = {};
      ALL_EQUIPMENT_IDS.forEach((id) => { none[id] = 0; });
      c.setSelectedEquipment(none);
      console.log('[ModifyDrawer] Applied no equipment — bodyweight only');
    } else if (gymPreset === 'commercial') {
      const all: Record<string, number> = {};
      ALL_EQUIPMENT_IDS.forEach((id) => { all[id] = 1; });
      c.setSelectedEquipment(all);
      console.log('[ModifyDrawer] Applied commercial gym equipment');
    } else {
      const gym = c.savedGyms.find((g) => g.id === gymPreset);
      if (gym) {
        c.setSelectedEquipment({ ...gym.equipment });
        console.log('[ModifyDrawer] Applied saved gym equipment:', gym.name);
      } else {
        const all: Record<string, number> = {};
        ALL_EQUIPMENT_IDS.forEach((id) => { all[id] = 1; });
        c.setSelectedEquipment(all);
        console.log('[ModifyDrawer] Gym preset not found, falling back to commercial');
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
      <View style={styles.modalInner}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerCircleBtn}
            onPress={onClose}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={16} color="#888" strokeWidth={2.5} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.title, { color: colors.text }]}>Change Workout</Text>
            <View style={styles.headerSummaryRow}>
              <View style={[styles.headerSummaryPill, { backgroundColor: `${styleAccent}20`, borderColor: `${styleAccent}40` }]}>
                <Text style={[styles.headerSummaryText, { color: styleAccent }]}>{localStyle}</Text>
              </View>
              {(localSplit && localSplit !== '') && (
                <View style={[styles.headerSummaryPill, { backgroundColor: `${colors.border}60`, borderColor: colors.border }]}>
                  <Text style={[styles.headerSummaryText, { color: colors.textSecondary }]}>
                    {musclesOverrideSplit ? selectedMuscles.slice(0, 2).join(', ') + (selectedMuscles.length > 2 ? '…' : '') : localSplit}
                  </Text>
                </View>
              )}
              <View style={[styles.headerSummaryPill, { backgroundColor: `${colors.border}60`, borderColor: colors.border }]}>
                <Text style={[styles.headerSummaryText, { color: colors.textSecondary }]}>
                  {`${localDuration}m`}
                </Text>
              </View>
            </View>
          </View>
          <TouchableOpacity
            style={styles.headerApplyBtn}
            onPress={handleApply}
            activeOpacity={0.85}
          >
            <Text style={styles.headerApplyText}>Apply</Text>
          </TouchableOpacity>
        </View>

        <BottomSheetScrollView
          showsVerticalScrollIndicator={false}
          bounces={false}
          scrollEnabled={contentH > maxDynamicContentSize - 120}
          contentContainerStyle={styles.content}
          onContentSizeChange={(_w: number, h: number) => setContentH(h)}
        >
          {/* Duration */}
          <TouchableOpacity
            style={[styles.sectionHeader, { backgroundColor: subtleSurface, borderColor: subtleBorder }]}
            onPress={() => toggleSection('duration')}
            activeOpacity={0.8}
          >
            <View style={styles.sectionHeaderLeft}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Target duration</Text>
              <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>Sets the session length</Text>
            </View>
            <Text style={[styles.sectionValue, { color: styleAccent }]}>{localDuration}m</Text>
            <ChevronDown
              size={16}
              color={colors.textMuted}
              style={{ transform: [{ rotate: openSections.duration ? '180deg' : '0deg' }] }}
            />
          </TouchableOpacity>
          {openSections.duration && (
            <View style={[styles.sectionBody, { borderColor: divider }]}>
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
          )}

          {/* Style */}
          <TouchableOpacity
            style={[styles.sectionHeader, { backgroundColor: subtleSurface, borderColor: subtleBorder }]}
            onPress={() => toggleSection('style')}
            activeOpacity={0.8}
          >
            <View style={styles.sectionHeaderLeft}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Workout style</Text>
              <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>Strength, cardio, mobility…</Text>
            </View>
            <Text style={[styles.sectionValue, { color: styleAccent }]}>{localStyle}</Text>
            <ChevronDown
              size={16}
              color={colors.textMuted}
              style={{ transform: [{ rotate: openSections.style ? '180deg' : '0deg' }] }}
            />
          </TouchableOpacity>
          {openSections.style && (
            <View style={[styles.sectionBody, { borderColor: divider }]}>
              <View style={styles.chipWrap}>
                {WORKOUT_STYLES.map((s) => {
                  const isSelected = localStyle === s;
                  const isLocked = !hasPro && PRO_STYLES_SET.has(s);
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[
                        styles.styleChip,
                        { backgroundColor: isDark ? '#222' : '#e8e8e8' },
                        isSelected && { backgroundColor: APPLY_BTN_COLOR },
                        isLocked && { opacity: PRO_LOCKED_OPACITY },
                      ]}
                      onPress={() => handleStyleSelect(s)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.chipInner}>
                        <Text
                          style={[
                            styles.chipText,
                            { color: isSelected ? '#fff' : isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' },
                          ]}
                        >
                          {s}
                        </Text>
                        {isLocked && <Crown size={11} color={PRO_GOLD} strokeWidth={2} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Split */}
          <TouchableOpacity
            style={[styles.sectionHeader, { backgroundColor: subtleSurface, borderColor: subtleBorder }]}
            onPress={() => toggleSection('split')}
            activeOpacity={0.8}
          >
            <View style={styles.sectionHeaderLeft}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{config.slot_label}</Text>
              <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>Choose a session focus</Text>
            </View>
            {musclesOverrideSplit ? (
              <View style={[styles.customBadge, { backgroundColor: `${styleAccent}18`, borderColor: `${styleAccent}70` }]}>
                <Text style={[styles.customBadgeText, { color: styleAccent }]}>CUSTOM</Text>
              </View>
            ) : (
              <Text style={[styles.sectionValue, { color: styleAccent }]}>{localSplit || 'Auto'}</Text>
            )}
            <ChevronDown
              size={16}
              color={colors.textMuted}
              style={{ transform: [{ rotate: openSections.split ? '180deg' : '0deg' }] }}
            />
          </TouchableOpacity>
          {openSections.split && (
            <View style={[styles.sectionBody, { borderColor: divider }]}>
              <View style={styles.splitGrid}>
                {config.slot_options.map((sp) => {
                  const isSelected = localSplit === sp && !musclesOverrideSplit;
                  return (
                    <TouchableOpacity
                      key={sp}
                      style={[
                        styles.splitBtn,
                        { backgroundColor: isDark ? '#222' : '#e8e8e8' },
                        isSelected && { backgroundColor: APPLY_BTN_COLOR },
                      ]}
                      onPress={() => handleSlotSelect(sp)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.splitBtnText,
                        { color: isSelected ? '#fff' : isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' },
                      ]}>
                        {sp}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {config.show_specific_muscles && (
            <>
              {/* Muscles */}
              <TouchableOpacity
                style={[styles.sectionHeader, { backgroundColor: subtleSurface, borderColor: subtleBorder }]}
                onPress={() => toggleSection('muscles')}
                activeOpacity={0.8}
              >
                <View style={styles.sectionHeaderLeft}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>{config.muscles_label}</Text>
                  <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
                    {selectedMuscles.length > 0 ? `${selectedMuscles.length} selected` : 'Optional override'}
                  </Text>
                </View>
                <Text style={[styles.sectionValue, { color: styleAccent }]}>
                  {selectedMuscles.length > 0 ? 'Custom' : 'Auto'}
                </Text>
                <ChevronDown
                  size={16}
                  color={colors.textMuted}
                  style={{ transform: [{ rotate: openSections.muscles ? '180deg' : '0deg' }] }}
                />
              </TouchableOpacity>
              {openSections.muscles && (
                <View style={[styles.sectionBody, { borderColor: divider }]}>
                  <View style={styles.muscleGrid}>
                    {MUSCLE_CHIPS.map(({ display }) => {
                      const isSelected = selectedMuscles.includes(display);
                      return (
                        <TouchableOpacity
                          key={display}
                          style={[
                            styles.muscleChip,
                            { backgroundColor: isDark ? '#222' : '#e8e8e8' },
                            isSelected && { backgroundColor: APPLY_BTN_COLOR },
                          ]}
                          onPress={() => handleMuscleToggle(display)}
                          activeOpacity={0.7}
                        >
                          <Text style={[
                            styles.muscleChipText,
                            { color: isSelected ? '#fff' : isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' },
                          ]}>
                            {display}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </>
          )}

          {/* Equipment */}
          <TouchableOpacity
            style={[styles.sectionHeader, { backgroundColor: subtleSurface, borderColor: subtleBorder }]}
            onPress={() => toggleSection('equipment')}
            activeOpacity={0.8}
          >
            <View style={styles.sectionHeaderLeft}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Gym equipment</Text>
              <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>Matches your available gear</Text>
            </View>
            <Text style={[styles.sectionValue, { color: styleAccent }]} numberOfLines={1}>
              {activeGymLabel}
            </Text>
            <ChevronDown
              size={16}
              color={colors.textMuted}
              style={{ transform: [{ rotate: openSections.equipment ? '180deg' : '0deg' }] }}
            />
          </TouchableOpacity>
          {openSections.equipment && (
            <View style={[styles.sectionBody, { borderColor: divider }]}>
              <View style={styles.gymPresetsTopRow}>
                <TouchableOpacity
                  style={[
                    styles.gymPresetBtn,
                    { backgroundColor: isDark ? '#222' : '#e8e8e8' },
                    gymPreset === 'no_equipment' && { backgroundColor: APPLY_BTN_COLOR },
                  ]}
                  onPress={handleSelectNoEquipment}
                  activeOpacity={0.7}
                >
                  <User size={14} color={gymPreset === 'no_equipment' ? '#fff' : isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'} />
                  <Text style={[
                    styles.gymPresetBtnText,
                    { color: gymPreset === 'no_equipment' ? '#fff' : isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' },
                  ]}>
                    No Equipment
                  </Text>
                  {gymPreset === 'no_equipment' && (
                    <View style={[styles.gymCheckDot, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                      <Check size={8} color="#fff" strokeWidth={3} />
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.gymPresetBtn,
                    { backgroundColor: isDark ? '#222' : '#e8e8e8' },
                    gymPreset === 'commercial' && { backgroundColor: APPLY_BTN_COLOR },
                  ]}
                  onPress={handleSelectCommercial}
                  activeOpacity={0.7}
                >
                  <Building2 size={14} color={gymPreset === 'commercial' ? '#fff' : isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'} />
                  <Text style={[
                    styles.gymPresetBtnText,
                    { color: gymPreset === 'commercial' ? '#fff' : isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' },
                  ]}>
                    Commercial
                  </Text>
                  {gymPreset === 'commercial' && (
                    <View style={[styles.gymCheckDot, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                      <Check size={8} color="#fff" strokeWidth={3} />
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[
                  styles.gymPresetBtnFull,
                  { backgroundColor: isDark ? '#222' : '#e8e8e8' },
                  (gymPreset !== 'commercial' && gymPreset !== 'no_equipment') && { backgroundColor: APPLY_BTN_COLOR },
                ]}
                onPress={handleToggleSavedGyms}
                activeOpacity={0.7}
              >
                <Bookmark
                  size={14}
                  color={(gymPreset !== 'commercial' && gymPreset !== 'no_equipment') ? '#fff' : isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                />
                <Text style={[
                  styles.gymPresetBtnText,
                  { color: (gymPreset !== 'commercial' && gymPreset !== 'no_equipment') ? '#fff' : isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' },
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
                <View style={[styles.savedGymsList, { backgroundColor: colors.cardSecondary, borderColor: subtleBorder }]}>
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
                            { borderBottomColor: divider },
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
          )}

          {false && restVisible && (
            <>
              <View style={styles.restSliderHeaderRow}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>REST BETWEEN SETS</Text>
                <Text style={[styles.sliderValue, { color: styleAccent }]}>{restLabel}</Text>
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
            </>
          )}

          <View style={{ height: 24 }} />
        </BottomSheetScrollView>
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetBg: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
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
  headerApplyBtn: {
    borderRadius: 12,
    width: 96,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APPLY_BTN_COLOR,
    shadowColor: APPLY_BTN_COLOR,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  headerApplyText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.2,
  },
  title: {
    fontSize: 17,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.3,
  },
  headerSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 4,
  },
  headerSummaryPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
    borderWidth: 1,
  },
  headerSummaryText: {
    fontSize: 10,
    fontWeight: '600' as const,
    letterSpacing: 0.2,
  },
  modalInner: {
    flex: 1,
    flexDirection: 'column' as const,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 4,
  },
  sectionHeaderLeft: {
    flex: 1,
    gap: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.2,
  },
  sectionHint: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
    letterSpacing: 0,
  },
  sectionValue: {
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.2,
  },
  sectionBody: {
    marginTop: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.8,
    marginTop: 4,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionLabelValue: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.2,
  },
  slotLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
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
  equipLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  activeGymBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  activeGymBadgeText: {
    fontSize: 10,
    fontWeight: '600' as const,
    letterSpacing: 0.2,
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
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  gymPresetBtnFull: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginTop: 10,
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
  },
  savedGymsList: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
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
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  styleChip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 12,
    justifyContent: 'center',
  },
  chipInner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  chipText: {
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
  },
  splitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  splitBtn: {
    width: '48%',
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitBtnText: {
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
  },
  sessionToggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sessionToggleBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  sessionToggleText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  muscleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  muscleChip: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 12,
    justifyContent: 'center',
  },
  muscleChipText: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
  },
  sliderHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 6,
  },
  restSliderHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 6,
  },
  sliderValue: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  slider: {
    width: '100%',
  },
  rangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rangeLabel: {
    fontSize: 10,
  },
  fixedDurationBar: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  fixedDurationText: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
});
