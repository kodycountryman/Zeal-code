import React, { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { X, Dumbbell, Building2, Bookmark, Check, ChevronDown, ChevronUp, User, Crown } from 'lucide-react-native';
import { showProGate, PRO_GOLD, PRO_LOCKED_OPACITY, PRO_STYLES_SET } from '@/services/proGate';
import { useZealTheme, useAppContext, type WorkoutOverride, type LastModifyState } from '@/context/AppContext';
import { useSubscription } from '@/context/SubscriptionContext';
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
import BaseDrawer from '@/components/drawers/BaseDrawer';

const WORKOUT_STYLES = [
  'Strength', 'Bodybuilding', 'CrossFit', 'Hyrox',
  'Cardio', 'HIIT', 'Mobility', 'Pilates', 'Low-Impact', 'Hybrid',
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
  const [localStyle, setLocalStyle] = useState(ctx.workoutStyle);
  const [localSplit, setLocalSplit] = useState<string>('Auto');
  const [localDuration, setLocalDuration] = useState(ctx.targetDuration);
  const [localRest, setLocalRest] = useState(ctx.restBetweenSets);
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
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
        console.log('[ModifyDrawer] Restoring from lastModifyState:', lm);
        setLocalStyle(lm.style);
        setLocalSplit(lm.split);
        setLocalDuration(lm.duration);
        setLocalRest(lm.rest);
        setSelectedMuscles(lm.muscles);
        setGymPreset(lm.gymPreset ?? detectGymPreset(c));
        setSavedGymsOpen(false);
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
      }
    }
  }, [visible]);

  const styleAccent = WORKOUT_STYLE_COLORS[localStyle] ?? '#f87116';

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

  const headerContent = (
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
  );

  return (
    <BaseDrawer visible={visible} onClose={onClose} header={headerContent} stackBehavior="push">
      <View style={styles.content}>
          <View style={styles.sliderHeaderRow}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>TARGET DURATION</Text>
            <Text style={[styles.sliderValue, { color: styleAccent }]}>
              {`${localDuration}m`}
            </Text>
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

          <View style={styles.sectionLabelRow}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>WORKOUT STYLE</Text>
            <Text style={[styles.sectionLabelValue, { color: styleAccent }]}>{localStyle}</Text>
          </View>
          <View style={styles.chipWrap}>
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
                        styles.chipText,
                        { color: isSelected ? '#fff' : colors.text },
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

          <>
              <View style={styles.slotLabelRow}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{config.slot_label}</Text>
                {musclesOverrideSplit ? (
                  <View style={[styles.customBadge, { backgroundColor: `${styleAccent}22`, borderColor: styleAccent }]}>
                    <Text style={[styles.customBadgeText, { color: styleAccent }]}>CUSTOM</Text>
                  </View>
                ) : (
                  localSplit ? (
                    <Text style={[styles.sectionLabelValue, { color: styleAccent }]}>{localSplit}</Text>
                  ) : null
                )}
              </View>
              <View style={styles.splitGrid}>
                {config.slot_options.map((sp) => {
                  const isSelected = localSplit === sp && !musclesOverrideSplit;
                  return (
                    <TouchableOpacity
                      key={sp}
                      style={[
                        styles.splitBtn,
                        {
                          backgroundColor: isSelected ? styleAccent : colors.cardSecondary,
                          borderColor: isSelected ? styleAccent : colors.border,
                        },
                      ]}
                      onPress={() => handleSlotSelect(sp)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.splitBtnText, { color: isSelected ? '#fff' : colors.text }]}>
                        {sp}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
          </>

          {config.show_specific_muscles && (
            <>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{config.muscles_label}</Text>
              <View style={styles.muscleGrid}>
                {MUSCLE_CHIPS.map(({ display }) => {
                  const isSelected = selectedMuscles.includes(display);
                  return (
                    <TouchableOpacity
                      key={display}
                      style={[
                        styles.muscleChip,
                        { borderColor: colors.border, backgroundColor: colors.cardSecondary },
                        isSelected && {
                          backgroundColor: `${styleAccent}4D`,
                          borderColor: styleAccent,
                        },
                      ]}
                      onPress={() => handleMuscleToggle(display)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.muscleChipText,
                        { color: isSelected ? styleAccent : colors.text },
                      ]}>
                        {display}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          <View style={styles.equipLabelRow}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>GYM EQUIPMENT</Text>
            {activeGymLabel && (
              <View style={[styles.activeGymBadge, { backgroundColor: `${styleAccent}20`, borderColor: `${styleAccent}50` }]}>
                <Dumbbell size={9} color={styleAccent} />
                <Text style={[styles.activeGymBadgeText, { color: styleAccent }]}>{activeGymLabel}</Text>
              </View>
            )}
          </View>

          <View style={styles.gymPresetsTopRow}>
            <TouchableOpacity
              style={[
                styles.gymPresetBtn,
                { backgroundColor: colors.cardSecondary, borderColor: colors.border },
                gymPreset === 'no_equipment' && { backgroundColor: `${styleAccent}18`, borderColor: styleAccent },
              ]}
              onPress={handleSelectNoEquipment}
              activeOpacity={0.7}
            >
              <User size={14} color={gymPreset === 'no_equipment' ? styleAccent : colors.textSecondary} />
              <Text style={[
                styles.gymPresetBtnText,
                { color: gymPreset === 'no_equipment' ? styleAccent : colors.text },
              ]}>
                No Equipment
              </Text>
              {gymPreset === 'no_equipment' && (
                <View style={[styles.gymCheckDot, { backgroundColor: styleAccent }]}>
                  <Check size={8} color="#fff" strokeWidth={3} />
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.gymPresetBtn,
                { backgroundColor: colors.cardSecondary, borderColor: colors.border },
                gymPreset === 'commercial' && { backgroundColor: `${styleAccent}18`, borderColor: styleAccent },
              ]}
              onPress={handleSelectCommercial}
              activeOpacity={0.7}
            >
              <Building2 size={14} color={gymPreset === 'commercial' ? styleAccent : colors.textSecondary} />
              <Text style={[
                styles.gymPresetBtnText,
                { color: gymPreset === 'commercial' ? styleAccent : colors.text },
              ]}>
                Commercial
              </Text>
              {gymPreset === 'commercial' && (
                <View style={[styles.gymCheckDot, { backgroundColor: styleAccent }]}>
                  <Check size={8} color="#fff" strokeWidth={3} />
                </View>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.gymPresetBtnFull,
              { backgroundColor: colors.cardSecondary, borderColor: colors.border },
              (gymPreset !== 'commercial' && gymPreset !== 'no_equipment') && { backgroundColor: `${styleAccent}18`, borderColor: styleAccent },
              savedGymsOpen && { borderColor: styleAccent },
            ]}
            onPress={handleToggleSavedGyms}
            activeOpacity={0.7}
          >
            <Bookmark
              size={14}
              color={(gymPreset !== 'commercial' && gymPreset !== 'no_equipment') || savedGymsOpen ? styleAccent : colors.textSecondary}
            />
            <Text style={[
              styles.gymPresetBtnText,
              { color: (gymPreset !== 'commercial' && gymPreset !== 'no_equipment') || savedGymsOpen ? styleAccent : colors.text },
              { flex: 1 },
            ]}
              numberOfLines={1}
            >
              {savedGymsBtnLabel}
            </Text>
            {savedGymsOpen ? (
              <ChevronUp size={12} color={colors.textMuted} />
            ) : (
              <ChevronDown size={12} color={colors.textMuted} />
            )}
          </TouchableOpacity>

          {savedGymsOpen && (
            <View style={[styles.savedGymsList, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
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
                        { borderBottomColor: colors.border },
                        isActive && { backgroundColor: `${styleAccent}12` },
                      ]}
                      onPress={() => handleSelectGym(gym.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[
                        styles.savedGymIconWrap,
                        { backgroundColor: isActive ? `${styleAccent}25` : `${colors.border}60` },
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
      </View>
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
    borderRadius: 19,
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
    fontFamily: 'Outfit_600SemiBold',
    fontWeight: '600' as const,
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
    gap: 8,
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
    gap: 8,
  },
  gymPresetBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  gymPresetBtnFull: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  gymPresetBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
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
    gap: 7,
  },
  styleChip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipInner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  splitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  splitBtn: {
    width: '48.5%',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  splitBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
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
    gap: 6,
  },
  muscleChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  muscleChipText: {
    fontSize: 12,
    fontWeight: '500' as const,
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
