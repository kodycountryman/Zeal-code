import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  LayoutAnimation,
  Platform,
  UIManager,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import WheelPicker from '@/components/WheelPicker';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme, useAppContext, SpecialLifeCase, FitnessLevel, Sex, ActivityLevel } from '@/context/AppContext';
import BaseDrawer from '@/components/drawers/BaseDrawer';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const CHIP_H = 38;
const PICKER_H = 132;
const CHIP_SPRING = { damping: 22, stiffness: 280, mass: 0.8 } as const;

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOB_YEARS = Array.from({ length: 88 }, (_, i) => new Date().getFullYear() - 100 + i);

const HEIGHT_FT_VALUES = [3, 4, 5, 6, 7, 8];
const HEIGHT_IN_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const WEIGHT_VALUES = Array.from({ length: 361 }, (_, i) => 40 + i);
const BODY_FAT_VALUES = Array.from({ length: 95 }, (_, i) => Math.round((3 + i * 0.5) * 10) / 10);

const SPECIAL_LIFE_CASES: { id: SpecialLifeCase; label: string; sub: string }[] = [
  { id: 'none',         label: 'None',         sub: 'No special considerations' },
  { id: 'pregnant',     label: 'Pregnant',     sub: 'Safe prenatal programming' },
  { id: 'postpartum',   label: 'Postpartum',   sub: 'Recovery-focused workouts' },
  { id: 'injury',       label: 'Injury',       sub: 'Work around limitations' },
  { id: 'disability',   label: 'Disability',   sub: 'Adaptive programming' },
  { id: 'chronic_pain', label: 'Chronic Pain', sub: 'Low-impact alternatives' },
];

const TRAINING_GOALS = [
  'Build Muscle',
  'Get Stronger',
  'Lose Weight',
  'Better Conditioning',
  'Improve Flexibility',
  'Sport Performance',
];

const ACTIVITY_LEVELS: { id: ActivityLevel; label: string; sub: string }[] = [
  { id: 'sedentary',        label: 'Sedentary',      sub: 'Little to no exercise' },
  { id: 'lightly_active',   label: 'Lightly Active', sub: '1–3 days/week' },
  { id: 'moderately_active',label: 'Moderate',       sub: '3–5 days/week' },
  { id: 'very_active',      label: 'Very Active',    sub: '6–7 days/week' },
];

function parseDOB(dob: string): { day: number; month: number; year: number } {
  if (!dob) return { day: 1, month: 1, year: 1990 };
  const parts = dob.split('-').map(Number);
  return { year: parts[0] || 1990, month: parts[1] || 1, day: parts[2] || 1 };
}

function calcBMI(weightLbs: number, heightFt: number, heightIn: number): number {
  const totalInches = heightFt * 12 + heightIn;
  if (totalInches === 0) return 0;
  return parseFloat(((703 * weightLbs) / (totalInches * totalInches)).toFixed(1));
}

function bmiCategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: 'Underweight', color: '#60a5fa' };
  if (bmi < 25)   return { label: 'Normal',      color: '#22c55e' };
  if (bmi < 30)   return { label: 'Overweight',  color: '#eab308' };
  return                   { label: 'Obese',      color: '#ef4444' };
}

function bmiToPercent(bmi: number): number {
  return ((Math.min(Math.max(bmi, 13), 40) - 13) / 27) * 100;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function AboutMeDrawer({ visible, onClose }: Props) {
  const { colors, accent, isDark } = useZealTheme();
  const ctx = useAppContext();

  const parsedDOB = useMemo(() => parseDOB(ctx.dateOfBirth), [ctx.dateOfBirth]);

  const [localName, setLocalName] = useState(ctx.userName);
  const [localDOBDay, setLocalDOBDay] = useState(parsedDOB.day);
  const [localDOBMonth, setLocalDOBMonth] = useState(parsedDOB.month);
  const [localDOBYear, setLocalDOBYear] = useState(parsedDOB.year);
  const [localHFt, setLocalHFt] = useState(ctx.heightFt);
  const [localHIn, setLocalHIn] = useState(ctx.heightIn);
  const [localWeight, setLocalWeight] = useState(ctx.weight);
  const [localSex, setLocalSex] = useState<Sex>(ctx.sex);
  const [localBodyFat, setLocalBodyFat] = useState(ctx.bodyFat);
  const [localFitnessLevel, setLocalFitnessLevel] = useState<FitnessLevel>(ctx.fitnessLevel);
  const [localActivityLevel, setLocalActivityLevel] = useState<ActivityLevel>(ctx.activityLevel ?? 'moderately_active');
  const [localGoals, setLocalGoals] = useState<string[]>(ctx.trainingGoals);
  const [localSLC, setLocalSLC] = useState<SpecialLifeCase>(ctx.specialLifeCase);
  const [localSLCDetail, setLocalSLCDetail] = useState(ctx.specialLifeCaseDetail);

  const [dobPickerOpen, setDobPickerOpen] = useState(false);

  const dobDate = useMemo(
    () => new Date(localDOBYear, localDOBMonth - 1, localDOBDay),
    [localDOBYear, localDOBMonth, localDOBDay]
  );

  const handleDOBChange = useCallback((_: any, date?: Date) => {
    if (Platform.OS === 'android') setDobPickerOpen(false);
    if (date) {
      setLocalDOBYear(date.getFullYear());
      setLocalDOBMonth(date.getMonth() + 1);
      setLocalDOBDay(date.getDate());
    }
  }, []);

  const SEX_VALUES: Sex[] = ['male', 'female', 'prefer_not'];
  const sexFormatValue = useCallback((v: Sex) => {
    if (v === 'prefer_not') return 'Prefer not to say';
    return v.charAt(0).toUpperCase() + v.slice(1);
  }, []);

  // ── Expandable picker state (one open at a time) ─────────────────────────
  const [activePicker, setActivePicker] = useState<string | null>(null);
  const chipExpandHeight = useSharedValue(CHIP_H);
  const chipExpandStyle = useAnimatedStyle(() => ({
    height: chipExpandHeight.value,
    overflow: 'hidden' as const,
  }));

  const openPicker = useCallback((id: string) => {
    chipExpandHeight.value = CHIP_H;
    setActivePicker(id);
  }, [chipExpandHeight]);

  useEffect(() => {
    if (activePicker) {
      chipExpandHeight.value = withSpring(PICKER_H, CHIP_SPRING);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePicker]);

  const closePicker = useCallback(() => {
    chipExpandHeight.value = withSpring(CHIP_H, CHIP_SPRING, (finished) => {
      if (finished) runOnJS(setActivePicker)(null);
    });
  }, [chipExpandHeight]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const wheelBg   = isDark ? '#1c1c1c' : '#f0f0f0';
  const wheelText = isDark ? '#ffffff' : '#111111';
  const wheelMuted= isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
  const chipBg    = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)';
  const chipBorder= `${colors.textMuted}35`;
  const dividerColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';

  useEffect(() => {
    if (visible) {
      const dob = parseDOB(ctx.dateOfBirth);
      setLocalName(ctx.userName);
      setLocalDOBDay(dob.day);
      setLocalDOBMonth(dob.month);
      setLocalDOBYear(dob.year);
      setLocalHFt(ctx.heightFt);
      setLocalHIn(ctx.heightIn);
      setLocalWeight(ctx.weight);
      setLocalSex(ctx.sex);
      setLocalBodyFat(ctx.bodyFat);
      setLocalFitnessLevel(ctx.fitnessLevel);
      setLocalActivityLevel(ctx.activityLevel ?? 'moderately_active');
      setLocalGoals(ctx.trainingGoals);
      setLocalSLC(ctx.specialLifeCase);
      setLocalSLCDetail(ctx.specialLifeCaseDetail);
      setActivePicker(null);
      setDobPickerOpen(false);
      chipExpandHeight.value = CHIP_H;
    }
  }, [visible, ctx.userName, ctx.dateOfBirth, ctx.heightFt, ctx.heightIn, ctx.weight, ctx.sex, ctx.bodyFat, ctx.fitnessLevel, ctx.activityLevel, ctx.trainingGoals, ctx.specialLifeCase, ctx.specialLifeCaseDetail]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasChanges = useMemo(() => {
    const dob = parseDOB(ctx.dateOfBirth);
    return (
      localName.trim() !== ctx.userName ||
      localDOBDay !== dob.day || localDOBMonth !== dob.month || localDOBYear !== dob.year ||
      localHFt !== ctx.heightFt || localHIn !== ctx.heightIn ||
      localWeight !== ctx.weight || localSex !== ctx.sex ||
      localBodyFat !== ctx.bodyFat || localFitnessLevel !== ctx.fitnessLevel ||
      localActivityLevel !== (ctx.activityLevel ?? 'moderately_active') ||
      JSON.stringify(localGoals) !== JSON.stringify(ctx.trainingGoals) ||
      localSLC !== ctx.specialLifeCase || localSLCDetail !== ctx.specialLifeCaseDetail
    );
  }, [localName, localDOBDay, localDOBMonth, localDOBYear, localHFt, localHIn, localWeight, localSex, localBodyFat, localFitnessLevel, localActivityLevel, localGoals, localSLC, localSLCDetail, ctx]);

  const handleCancel = useCallback(() => {
    if (hasChanges) {
      Alert.alert('Discard changes?', 'You have unsaved changes that will be lost.', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onClose },
      ]);
    } else {
      onClose();
    }
  }, [hasChanges, onClose]);

  const handleDone = () => {
    const dob = `${localDOBYear}-${String(localDOBMonth).padStart(2, '0')}-${String(localDOBDay).padStart(2, '0')}`;
    ctx.setUserName(localName.trim() || ctx.userName);
    ctx.setDateOfBirth(dob);
    ctx.setHeightFt(localHFt);
    ctx.setHeightIn(localHIn);
    ctx.setWeight(localWeight);
    ctx.setSex(localSex);
    ctx.setBodyFat(localBodyFat);
    ctx.setFitnessLevel(localFitnessLevel);
    ctx.setActivityLevel(localActivityLevel);
    ctx.setTrainingGoals(localGoals);
    ctx.setSpecialLifeCase(localSLC);
    ctx.setSpecialLifeCaseDetail(localSLCDetail);
    ctx.saveState();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  };

  const toggleGoal = (goal: string) => {
    setLocalGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    );
  };

  const bmi = calcBMI(localWeight, localHFt, localHIn);
  const bmiCat = bmiCategory(bmi);
  const leanMass = Math.round(localWeight * (1 - localBodyFat / 100));
  const fatMass  = Math.round(localWeight * (localBodyFat / 100));
  const bmiMarkerPos = bmiToPercent(bmi);

  const bodyFatFormatValue = useCallback((v: number) => v === 0 ? '—' : `${v}%`, []);

  const computedAge = useMemo(() => {
    if (!localDOBYear || localDOBYear < 1900) return null;
    const today = new Date();
    const birthDate = new Date(localDOBYear, localDOBMonth - 1, localDOBDay);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
    return age > 0 ? age : null;
  }, [localDOBDay, localDOBMonth, localDOBYear]);

  // Tinted selection — border + light bg + accent text (not solid fill)
  const selBorder = (on: boolean) => ({ borderColor: on ? accent : chipBorder });
  const selBg     = (on: boolean) => ({ backgroundColor: on ? `${accent}15` : colors.cardSecondary });
  const selText   = (on: boolean) => ({ color: on ? accent : colors.text, fontFamily: on ? 'Outfit_600SemiBold' : 'Outfit_500Medium' });

  // ── ExpandablePicker ──────────────────────────────────────────────────────
  function ExpandablePicker({
    id, label, displayValue, children,
  }: {
    id: string; label: string; displayValue: string; children: React.ReactNode;
  }) {
    const isOpen = activePicker === id;
    return (
      <View style={styles.expandableWrap}>
        {label ? <Text style={[styles.pickerColLabel, { color: colors.textSecondary }]}>{label}</Text> : null}
        {isOpen ? (
          <TouchableOpacity onPress={closePicker} activeOpacity={0.9}>
            <Animated.View
              style={[styles.pickerChip, { borderColor: `${accent}88`, backgroundColor: chipBg }, chipExpandStyle]}
            >
              {children}
            </Animated.View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => openPicker(id)} activeOpacity={0.85}>
            <View style={[styles.pickerChip, { borderColor: chipBorder, backgroundColor: chipBg, height: CHIP_H, paddingHorizontal: 16 }]}>
              <Text style={[styles.pickerChipText, { color: wheelText }]}>{displayValue}</Text>
              <PlatformIcon name="chevron-down" size={14} color={colors.textMuted} style={{ marginLeft: 6 }} />
            </View>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const headerContent = (
    <View style={styles.header}>
      <TouchableOpacity onPress={handleCancel} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }} style={styles.headerCancelBtn}>
        <Text style={[styles.headerCancelText, { color: colors.textSecondary }]}>Cancel</Text>
      </TouchableOpacity>
      <Text style={[styles.title, { color: colors.text }]}>About Me</Text>
      <TouchableOpacity style={[styles.headerDoneBtn, { backgroundColor: accent }]} onPress={handleDone} activeOpacity={0.85}>
        <Text style={styles.headerDoneText}>Done</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <BaseDrawer visible={visible} onClose={handleCancel} header={headerContent} hasTextInput stackBehavior="push" backgroundColor={colors.background}>
      <View style={styles.content}>

        {/* ── IDENTITY ── */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>IDENTITY</Text>
        <View style={[styles.section, { backgroundColor: colors.card }]}>

          {/* Name */}
          <View style={styles.fieldPad}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Name</Text>
            <TextInput
              style={[styles.nameInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.cardSecondary }]}
              value={localName}
              onChangeText={setLocalName}
              placeholder="First name"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              autoCorrect={false}
              selectionColor={accent}
            />
          </View>

          <View style={[styles.sep, { backgroundColor: dividerColor }]} />

          {/* Birthday */}
          <TouchableOpacity
            style={[styles.fieldPad, styles.disclosureRow]}
            onPress={() => setDobPickerOpen(true)}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Birthday</Text>
              <Text style={[styles.disclosureValue, { color: colors.text }]}>
                {MONTH_NAMES[localDOBMonth - 1]} {localDOBDay}, {localDOBYear}
              </Text>
              {computedAge !== null && (
                <Text style={[styles.disclosureSub, { color: colors.textMuted }]}>{computedAge} years old</Text>
              )}
            </View>
            <PlatformIcon name="chevron-right" size={17} color={colors.textMuted} />
          </TouchableOpacity>

          {/* iOS calendar modal */}
          {Platform.OS === 'ios' && (
            <Modal transparent animationType="fade" visible={dobPickerOpen} onRequestClose={() => setDobPickerOpen(false)}>
              <Pressable style={styles.calBackdrop} onPress={() => setDobPickerOpen(false)}>
                <Pressable style={[styles.calSheet, { backgroundColor: colors.card }]} onPress={() => {}}>
                  <View style={styles.calHeader}>
                    <Text style={[styles.calTitle, { color: colors.text }]}>Birthday</Text>
                    <TouchableOpacity onPress={() => setDobPickerOpen(false)} activeOpacity={0.7}>
                      <Text style={[styles.calDone, { color: accent }]}>Done</Text>
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={dobDate}
                    mode="date"
                    display="inline"
                    onChange={handleDOBChange}
                    maximumDate={new Date()}
                    accentColor={accent}
                    themeVariant="dark"
                  />
                </Pressable>
              </Pressable>
            </Modal>
          )}
          {Platform.OS === 'android' && dobPickerOpen && (
            <DateTimePicker value={dobDate} mode="date" display="calendar" onChange={handleDOBChange} maximumDate={new Date()} />
          )}

          <View style={[styles.sep, { backgroundColor: dividerColor }]} />

          {/* Biological Sex */}
          <View style={styles.fieldPad}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Biological Sex</Text>
            <Text style={[styles.fieldCaption, { color: colors.textSecondary, marginTop: -4 }]}>Used for metabolism and BMI estimates</Text>
            <ExpandablePicker id="sex" label="" displayValue={sexFormatValue(localSex)}>
              <WheelPicker
                values={SEX_VALUES}
                selectedValue={localSex}
                onValueChange={setLocalSex}
                width={200}
                visibleItems={3}
                textColor={wheelText}
                mutedColor={wheelMuted}
                accentColor={accent}
                bgColor={wheelBg}
                formatValue={sexFormatValue}
              />
            </ExpandablePicker>
          </View>
        </View>

        {/* ── BODY METRICS ── */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>BODY METRICS</Text>
        <View style={[styles.section, { backgroundColor: colors.card }]}>

          {/* Height */}
          <View style={styles.fieldPad}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Height</Text>
            <View style={styles.dualPickerRow}>
              <ExpandablePicker id="height_ft" label="FT" displayValue={`${localHFt} ft`}>
                <WheelPicker values={HEIGHT_FT_VALUES} selectedValue={localHFt} onValueChange={setLocalHFt}
                  width={80} visibleItems={3} textColor={wheelText} mutedColor={wheelMuted} accentColor={accent} bgColor={wheelBg} />
              </ExpandablePicker>
              <View style={[styles.pickerSep, { backgroundColor: dividerColor }]} />
              <ExpandablePicker id="height_in" label="IN" displayValue={`${localHIn} in`}>
                <WheelPicker values={HEIGHT_IN_VALUES} selectedValue={localHIn} onValueChange={setLocalHIn}
                  width={80} visibleItems={3} textColor={wheelText} mutedColor={wheelMuted} accentColor={accent} bgColor={wheelBg} />
              </ExpandablePicker>
            </View>
          </View>

          <View style={[styles.sep, { backgroundColor: dividerColor }]} />

          {/* Body Weight */}
          <View style={styles.fieldPad}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Body Weight</Text>
            <ExpandablePicker id="weight" label="LBS" displayValue={`${localWeight} lbs`}>
              <WheelPicker values={WEIGHT_VALUES} selectedValue={localWeight} onValueChange={setLocalWeight}
                width={110} visibleItems={3} textColor={wheelText} mutedColor={wheelMuted} accentColor={accent} bgColor={wheelBg} />
            </ExpandablePicker>
          </View>

          <View style={[styles.sep, { backgroundColor: dividerColor }]} />

          {/* Body Fat % */}
          <View style={styles.fieldPad}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Body Fat %</Text>
            <View style={styles.bfPickerRow}>
              <ExpandablePicker id="body_fat" label="%" displayValue={localBodyFat === 0 ? 'Not set' : `${localBodyFat}%`}>
                <WheelPicker values={BODY_FAT_VALUES} selectedValue={localBodyFat || BODY_FAT_VALUES[0]} onValueChange={setLocalBodyFat}
                  width={100} visibleItems={3} textColor={wheelText} mutedColor={wheelMuted} accentColor={accent} bgColor={wheelBg}
                  formatValue={bodyFatFormatValue} />
              </ExpandablePicker>
              {localBodyFat > 0 && (
                <TouchableOpacity
                  style={[styles.bfResetBtn, { borderColor: chipBorder }]}
                  onPress={() => setLocalBodyFat(0)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.bfResetText, { color: colors.textMuted }]}>I'm not sure</Text>
                </TouchableOpacity>
              )}
            </View>
            {localBodyFat > 0 && (
              <Text style={[styles.bfInline, { color: colors.textSecondary }]}>
                Lean {leanMass} lbs · Fat {fatMass} lbs
              </Text>
            )}
            <Text style={[styles.fieldCaption, { color: colors.textSecondary }]}>An estimate is fine — used to calculate body composition</Text>
          </View>

          <View style={[styles.sep, { backgroundColor: dividerColor }]} />

          {/* BMI */}
          <View style={styles.fieldPad}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>BMI</Text>
            <View style={styles.bmiValueRow}>
              <Text style={[styles.bmiValue, { color: colors.text }]}>{bmi}</Text>
              <View style={[styles.bmiCatBadge, { backgroundColor: `${bmiCat.color}22` }]}>
                <Text style={[styles.bmiCatText, { color: bmiCat.color }]}>{bmiCat.label}</Text>
              </View>
            </View>
            <View style={styles.bmiBarWrap}>
              <View style={styles.bmiTrack}>
                <View style={[styles.bmiSegment, { backgroundColor: '#60a5fa', flex: 1 }]} />
                <View style={[styles.bmiSegment, { backgroundColor: '#22c55e', flex: 1.3 }]} />
                <View style={[styles.bmiSegment, { backgroundColor: '#eab308', flex: 1 }]} />
                <View style={[styles.bmiSegment, { backgroundColor: '#ef4444', flex: 1.2 }]} />
              </View>
              <View style={[styles.bmiMarker, { left: `${bmiMarkerPos}%` as any }]} />
            </View>
            <View style={styles.bmiLabels}>
              <Text style={[styles.bmiLabel, { color: colors.textMuted, flex: 1 }]}>Under</Text>
              <Text style={[styles.bmiLabel, { color: colors.textMuted, flex: 1.3 }]}>Normal</Text>
              <Text style={[styles.bmiLabel, { color: colors.textMuted, flex: 1 }]}>Over</Text>
              <Text style={[styles.bmiLabel, { color: colors.textMuted, flex: 1.2 }]}>Obese</Text>
            </View>
            <Text style={[styles.fieldCaption, { color: colors.textSecondary }]}>Estimated from your height & weight</Text>
          </View>
        </View>

        {/* ── FITNESS PROFILE ── */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>FITNESS PROFILE</Text>
        <View style={[styles.section, { backgroundColor: colors.card }]}>

          {/* Fitness Level */}
          <View style={styles.fieldPad}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Fitness Level</Text>
            <View style={styles.chipRow}>
              {(['beginner', 'intermediate', 'advanced'] as FitnessLevel[]).map((l) => {
                const on = localFitnessLevel === l;
                return (
                  <TouchableOpacity
                    key={l}
                    style={[styles.chip, selBorder(on), selBg(on)]}
                    onPress={() => setLocalFitnessLevel(l)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, selText(on)]}>
                      {l.charAt(0).toUpperCase() + l.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={[styles.sep, { backgroundColor: dividerColor }]} />

          {/* Activity Level */}
          <View style={styles.fieldPad}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Activity Level</Text>
            <Text style={[styles.fieldCaption, { color: colors.textSecondary, marginTop: 0 }]}>Outside of structured workouts</Text>
            <View style={styles.activityGrid}>
              {ACTIVITY_LEVELS.map((al) => {
                const on = localActivityLevel === al.id;
                return (
                  <TouchableOpacity
                    key={al.id}
                    style={[styles.activityBtn, selBorder(on), selBg(on)]}
                    onPress={() => setLocalActivityLevel(al.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.activityBtnLabel, selText(on)]}>{al.label}</Text>
                    <Text style={[styles.activityBtnSub, { color: on ? `${accent}99` : colors.textMuted }]}>{al.sub}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* ── TRAINING GOALS ── */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>TRAINING GOALS</Text>
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <View style={styles.fieldPad}>
            <Text style={[styles.fieldCaption, { color: colors.textSecondary, marginTop: 0 }]}>Select all that apply</Text>
            <View style={styles.goalsGrid}>
              {TRAINING_GOALS.map((g) => {
                const on = localGoals.includes(g);
                return (
                  <TouchableOpacity
                    key={g}
                    style={[styles.goalBtn, selBorder(on), selBg(on)]}
                    onPress={() => toggleGoal(g)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.goalBtnText, selText(on)]} numberOfLines={2}>{g}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* ── SPECIAL LIFE CASE ── */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>HEALTH CONSIDERATIONS</Text>
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          {SPECIAL_LIFE_CASES.map((slc, idx) => {
            const on = localSLC === slc.id;
            const isLast = idx === SPECIAL_LIFE_CASES.length - 1;
            return (
              <React.Fragment key={slc.id}>
                <TouchableOpacity
                  style={[styles.slcRow, on && { backgroundColor: `${accent}0d` }]}
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setLocalSLC(slc.id);
                    setLocalSLCDetail('');
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.slcRadio, { borderColor: on ? accent : colors.border, backgroundColor: on ? accent : 'transparent' }]}>
                    {on && <View style={styles.slcRadioDot} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.slcLabel, { color: on ? accent : colors.text }]}>{slc.label}</Text>
                    <Text style={[styles.slcSub, { color: colors.textMuted }]}>{slc.sub}</Text>
                  </View>
                  {on && slc.id !== 'none' && <PlatformIcon name="stethoscope" size={14} color={accent} />}
                </TouchableOpacity>
                {!isLast && <View style={[styles.sep, { backgroundColor: dividerColor }]} />}
              </React.Fragment>
            );
          })}

          {/* Detail input when selected */}
          {localSLC !== 'none' && (
            <View style={[styles.fieldPad, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: dividerColor }]}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                {localSLC === 'pregnant' ? 'Due Date' :
                 localSLC === 'postpartum' ? 'Notes (optional)' :
                 localSLC === 'injury' ? 'Injury Location' :
                 localSLC === 'disability' ? 'Description' : 'Affected Area'}
              </Text>
              <TextInput
                style={[styles.detailInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.cardSecondary }]}
                value={localSLCDetail}
                onChangeText={setLocalSLCDetail}
                placeholder={
                  localSLC === 'pregnant' ? 'mm/dd/yyyy' :
                  localSLC === 'postpartum' ? 'e.g. 3 months postpartum, cleared for exercise...' :
                  localSLC === 'injury' ? 'e.g. Left knee, lower back...' :
                  localSLC === 'disability' ? 'e.g. Partial paralysis, missing limb...' :
                  'e.g. Hip flexors, neck...'
                }
                placeholderTextColor={colors.textMuted}
                multiline={localSLC === 'postpartum' || localSLC === 'disability'}
                selectionColor={accent}
              />
            </View>
          )}
        </View>

        <View style={{ height: 48 }} />
      </View>
    </BaseDrawer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 12,
  },
  headerCancelBtn: {
    minWidth: 64,
  },
  headerCancelText: {
    fontSize: 15,
    fontFamily: 'Outfit_500Medium',
  },
  headerDoneBtn: {
    borderRadius: 19,
    paddingHorizontal: 20,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
  },
  headerDoneText: { fontSize: 15, fontFamily: 'Outfit_600SemiBold', color: '#ffffff' },
  title: { fontSize: 18, fontFamily: 'Outfit_800ExtraBold', letterSpacing: -0.3 },

  content: { paddingHorizontal: 16, paddingBottom: 12 },

  // ── Section structure ────────────────────────────────────────────────────
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: 16,
    paddingHorizontal: 4,
  },
  section: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  sep: {
    height: StyleSheet.hairlineWidth,
  },
  fieldPad: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.2,
  },
  fieldCaption: {
    fontSize: 11,
    fontFamily: 'Outfit_400Regular',
    marginTop: -2,
  },

  // ── Disclosure row (birthday) ────────────────────────────────────────────
  disclosureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  disclosureValue: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.2,
    marginTop: 4,
  },
  disclosureSub: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
    marginTop: 2,
  },

  // ── Calendar modal ───────────────────────────────────────────────────────
  calBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  calSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 34,
    overflow: 'hidden',
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  calTitle: { fontSize: 16, fontFamily: 'Outfit_700Bold' },
  calDone:  { fontSize: 16, fontFamily: 'Outfit_600SemiBold' },

  // ── Name input ───────────────────────────────────────────────────────────
  nameInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Outfit_500Medium',
  },

  // ── ExpandablePicker ─────────────────────────────────────────────────────
  dualPickerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  pickerSep: { width: 1, height: CHIP_H, marginHorizontal: 10, marginTop: 20, opacity: 0.4 },
  expandableWrap: { alignItems: 'flex-start', gap: 6 },
  pickerColLabel: { fontSize: 9, fontFamily: 'Outfit_700Bold', letterSpacing: 1.2 },
  pickerChip: {
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  pickerChipText: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.2,
    textAlign: 'center',
  },

  // ── Body fat ─────────────────────────────────────────────────────────────
  bfPickerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bfResetBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  bfResetText: { fontSize: 12, fontFamily: 'Outfit_500Medium' },
  bfInline: { fontSize: 13, fontFamily: 'Outfit_500Medium' },

  // ── BMI ──────────────────────────────────────────────────────────────────
  bmiValueRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bmiValue: { fontSize: 32, fontFamily: 'Outfit_800ExtraBold', letterSpacing: -1 },
  bmiCatBadge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  bmiCatText: { fontSize: 13, fontFamily: 'Outfit_700Bold' },
  bmiBarWrap: { position: 'relative', marginTop: 4, paddingBottom: 2 },
  bmiTrack: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2 },
  bmiSegment: { height: '100%' },
  bmiMarker: {
    position: 'absolute', top: -3, width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#ffffff', borderWidth: 2.5, borderColor: '#333', marginLeft: -7,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 2, elevation: 3,
  },
  bmiLabels: { flexDirection: 'row', marginTop: 6 },
  bmiLabel: { fontSize: 11, fontFamily: 'Outfit_500Medium', textAlign: 'center' },

  // ── Chips (fitness level) ─────────────────────────────────────────────────
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13 },

  // ── Activity level ────────────────────────────────────────────────────────
  activityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  activityBtn: { width: '47%', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, gap: 2 },
  activityBtnLabel: { fontSize: 13 },
  activityBtnSub: { fontSize: 10, fontFamily: 'Outfit_400Regular' },

  // ── Training Goals — 3-column uniform grid ────────────────────────────────
  goalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  goalBtn: {
    width: '30.5%',
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  goalBtnText: { fontSize: 12, textAlign: 'center', lineHeight: 16 },

  // ── Special Life Case — single-column list ────────────────────────────────
  slcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 14,
  },
  slcRadio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  slcRadioDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff',
  },
  slcLabel: { fontSize: 14, fontFamily: 'Outfit_600SemiBold' },
  slcSub: { fontSize: 11, fontFamily: 'Outfit_400Regular', marginTop: 1 },
  detailInput: {
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, fontFamily: 'Outfit_400Regular',
  },
});
