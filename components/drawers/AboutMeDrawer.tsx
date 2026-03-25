import React, { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import WheelPicker from '@/components/WheelPicker';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { X, RefreshCw, Stethoscope } from 'lucide-react-native';
import { useZealTheme, useAppContext, MuscleStatus, SpecialLifeCase, FitnessLevel, Sex } from '@/context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOB_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const DOB_MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const DOB_YEARS = Array.from({ length: 88 }, (_, i) => new Date().getFullYear() - 100 + i);

function parseDOB(dob: string): { day: number; month: number; year: number } {
  if (!dob) return { day: 1, month: 1, year: 1990 };
  const parts = dob.split('-').map(Number);
  return { year: parts[0] || 1990, month: parts[1] || 1, day: parts[2] || 1 };
}

const HEIGHT_FT_VALUES = [3, 4, 5, 6, 7, 8];
const HEIGHT_IN_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const WEIGHT_VALUES = Array.from({ length: 361 }, (_, i) => 40 + i);
const BODY_FAT_VALUES = Array.from({ length: 95 }, (_, i) => Math.round((3 + i * 0.5) * 10) / 10);

const MUSCLE_STATUS_COLORS: Record<MuscleStatus, string> = {
  recovering: '#ef4444',
  building: '#eab308',
  ready: '#22c55e',
};

const SPECIAL_LIFE_CASES: { id: SpecialLifeCase; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'pregnant', label: 'Pregnant' },
  { id: 'postpartum', label: 'Postpartum' },
  { id: 'injury', label: 'Injury' },
  { id: 'disability', label: 'Disability' },
  { id: 'chronic_pain', label: 'Chronic Pain' },
];

const TRAINING_GOALS = [
  'Build Muscle',
  'Get Stronger',
  'Lose Weight',
  'Better Conditioning',
  'Improve Flexibility',
  'Sport Performance',
];

function calcBMI(weightLbs: number, heightFt: number, heightIn: number): number {
  const totalInches = heightFt * 12 + heightIn;
  if (totalInches === 0) return 0;
  return parseFloat(((703 * weightLbs) / (totalInches * totalInches)).toFixed(1));
}

function bmiCategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: 'Underweight', color: '#60a5fa' };
  if (bmi < 25) return { label: 'Normal', color: '#22c55e' };
  if (bmi < 30) return { label: 'Overweight', color: '#eab308' };
  return { label: 'Obese', color: '#ef4444' };
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function AboutMeDrawer({ visible, onClose }: Props) {
  const { colors, accent, isDark } = useZealTheme();
  const ctx = useAppContext();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['92%'], []);
  const insets = useSafeAreaInsets();
  const topOffset = Math.max(insets.top, 0) + 16;

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
  const [localGoals, setLocalGoals] = useState<string[]>(ctx.trainingGoals);
  const [localSLC, setLocalSLC] = useState<SpecialLifeCase>(ctx.specialLifeCase);
  const [localSLCDetail, setLocalSLCDetail] = useState(ctx.specialLifeCaseDetail);
  const [localMuscles, setLocalMuscles] = useState(ctx.muscleReadiness);
  const [showAllMuscles, setShowAllMuscles] = useState(false);

  const wheelBg = isDark ? '#1e1e1e' : '#ebebeb';
  const wheelText = isDark ? '#ffffff' : '#111111';
  const wheelMuted = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';

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
      setLocalGoals(ctx.trainingGoals);
      setLocalSLC(ctx.specialLifeCase);
      setLocalSLCDetail(ctx.specialLifeCaseDetail);
      setLocalMuscles(ctx.muscleReadiness);
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible, ctx.userName, ctx.dateOfBirth, ctx.heightFt, ctx.heightIn, ctx.weight, ctx.sex, ctx.bodyFat, ctx.fitnessLevel, ctx.trainingGoals, ctx.specialLifeCase, ctx.specialLifeCaseDetail, ctx.muscleReadiness]);

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

  const handleDiscard = () => {
    onClose();
  };

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
    ctx.setTrainingGoals(localGoals);
    ctx.setSpecialLifeCase(localSLC);
    ctx.setSpecialLifeCaseDetail(localSLCDetail);
    ctx.setMuscleReadiness(localMuscles);
    ctx.saveState();
    onClose();
  };

  const handleRecovery = () => {
    setLocalMuscles((prev) =>
      prev.map((m) => ({ ...m, status: 'ready' as MuscleStatus, value: 95 }))
    );
  };

  const toggleGoal = (goal: string) => {
    setLocalGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    );
  };

  const cycleMuscleStatus = useCallback((idx: number) => {
    setLocalMuscles((prev) => {
      const copy = [...prev];
      const order: MuscleStatus[] = ['ready', 'building', 'recovering'];
      const cur = order.indexOf(copy[idx].status);
      copy[idx] = { ...copy[idx], status: order[(cur + 1) % order.length] };
      return copy;
    });
  }, []);

  const bmi = calcBMI(localWeight, localHFt, localHIn);
  const bmiCat = bmiCategory(bmi);
  const leanMass = Math.round(localWeight * (1 - localBodyFat / 100));
  const fatMass = Math.round(localWeight * (localBodyFat / 100));

  const visibleMuscles = showAllMuscles ? localMuscles : localMuscles.slice(0, 4);
  const readyCount = localMuscles.filter((m) => m.status === 'ready').length;

  const bodyFatFormatValue = useCallback((v: number) => {
    return v % 1 === 0 ? `${v}%` : `${v}%`;
  }, []);

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      backgroundStyle={[styles.sheetBg, { backgroundColor: colors.card }]}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
      enablePanDownToClose
      enableOverDrag={false}
      topInset={topOffset}
      stackBehavior="push"
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
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
          <Text style={[styles.title, { color: colors.text }]}>About Me</Text>
        </View>
        <TouchableOpacity
          style={[styles.headerDoneBtn, { backgroundColor: accent }]}
          onPress={handleDone}
          activeOpacity={0.85}
        >
          <Text style={styles.headerDoneText}>Done</Text>
        </TouchableOpacity>
      </View>

      <BottomSheetScrollView showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>

        {/* NAME */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>NAME</Text>
          <TextInput
            style={[
              styles.nameInput,
              { color: colors.text, borderColor: colors.border, backgroundColor: colors.cardSecondary },
            ]}
            value={localName}
            onChangeText={setLocalName}
            placeholder="First name"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
            autoCorrect={false}
            selectionColor={accent}
          />
        </View>

        {/* BIRTHDAY / AGE */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>AGE</Text>
          <View style={styles.ageRow}>
            <Text style={[styles.ageNumber, { color: accent }]}>
              {(() => {
                if (!localDOBYear || localDOBYear < 1900) return '—';
                const today = new Date();
                const birthDate = new Date(localDOBYear, localDOBMonth - 1, localDOBDay);
                let age = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
                return age > 0 ? age : '—';
              })()}
            </Text>
            <Text style={[styles.ageUnit, { color: colors.textSecondary }]}>years old</Text>
            <View style={styles.ageDobHint}>
              <Text style={[styles.ageDobText, { color: colors.textMuted }]}>
                {MONTH_NAMES[localDOBMonth - 1]} {String(localDOBDay).padStart(2, '0')}, {localDOBYear}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>MUSCLE READINESS</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.text }]}>
                {readyCount} of {localMuscles.length} muscle groups ready
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.recoveryBtn, { borderColor: accent }]}
              onPress={handleRecovery}
              activeOpacity={0.7}
            >
              <RefreshCw size={12} color={accent} />
              <Text style={[styles.recoveryBtnText, { color: accent }]}>Recovery</Text>
            </TouchableOpacity>
          </View>

          {visibleMuscles.map((muscle, idx) => (
            <TouchableOpacity
              key={muscle.name}
              style={styles.muscleRow}
              onPress={() => cycleMuscleStatus(idx)}
              activeOpacity={0.7}
            >
              <Text style={[styles.muscleName, { color: colors.text }]}>{muscle.name}</Text>
              <View style={[styles.muscleBarBg, { backgroundColor: colors.cardSecondary }]}>
                <View
                  style={[
                    styles.muscleBarFill,
                    {
                      width: `${muscle.value}%` as any,
                      backgroundColor: MUSCLE_STATUS_COLORS[muscle.status],
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.muscleStatus,
                  { color: MUSCLE_STATUS_COLORS[muscle.status], width: 70 },
                ]}
              >
                {muscle.lastWorked} · {muscle.status.charAt(0).toUpperCase() + muscle.status.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={styles.viewAllBtn}
            onPress={() => setShowAllMuscles((v) => !v)}
            activeOpacity={0.7}
          >
            <Text style={[styles.viewAllText, { color: colors.textSecondary }]}>
              {showAllMuscles ? '▲ Show less' : `▼ View all (${localMuscles.length} more)`}
            </Text>
          </TouchableOpacity>

          <View style={styles.muscleKey}>
            <View style={styles.keyItem}>
              <View style={[styles.keyDot, { backgroundColor: MUSCLE_STATUS_COLORS.recovering }]} />
              <Text style={[styles.keyText, { color: colors.textMuted }]}>1–30% = Recovering</Text>
            </View>
            <View style={styles.keyItem}>
              <View style={[styles.keyDot, { backgroundColor: MUSCLE_STATUS_COLORS.building }]} />
              <Text style={[styles.keyText, { color: colors.textMuted }]}>31–80% = Building</Text>
            </View>
            <View style={styles.keyItem}>
              <View style={[styles.keyDot, { backgroundColor: MUSCLE_STATUS_COLORS.ready }]} />
              <Text style={[styles.keyText, { color: colors.textMuted }]}>81%+ = Ready</Text>
            </View>
          </View>
        </View>

        {/* HEIGHT — rolodex wheels */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>HEIGHT</Text>
          <View style={styles.pickerRow}>
            <View style={styles.pickerBlock}>
              <View style={[styles.pickerCard, { backgroundColor: wheelBg, borderColor: colors.border }]}>
                <WheelPicker
                  values={HEIGHT_FT_VALUES}
                  selectedValue={localHFt}
                  onValueChange={setLocalHFt}
                  width={90}
                  visibleItems={1}
                  textColor={wheelText}
                  mutedColor={wheelMuted}
                  accentColor={accent}
                  bgColor={wheelBg}
                />
              </View>
              <Text style={[styles.pickerUnit, { color: colors.textSecondary }]}>ft</Text>
            </View>
            <View style={[styles.pickerSep, { backgroundColor: colors.border }]} />
            <View style={styles.pickerBlock}>
              <View style={[styles.pickerCard, { backgroundColor: wheelBg, borderColor: colors.border }]}>
                <WheelPicker
                  values={HEIGHT_IN_VALUES}
                  selectedValue={localHIn}
                  onValueChange={setLocalHIn}
                  width={90}
                  visibleItems={1}
                  textColor={wheelText}
                  mutedColor={wheelMuted}
                  accentColor={accent}
                  bgColor={wheelBg}
                />
              </View>
              <Text style={[styles.pickerUnit, { color: colors.textSecondary }]}>in</Text>
            </View>
          </View>
          <Text style={[styles.pickerHint, { color: colors.textMuted }]}>
            Current: {localHFt}'{localHIn}"
          </Text>
        </View>

        {/* BODY WEIGHT — rolodex wheel */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>BODY WEIGHT</Text>
          <View style={styles.singlePickerRow}>
            <View style={[styles.pickerCard, { backgroundColor: wheelBg, borderColor: colors.border }]}>
              <WheelPicker
                values={WEIGHT_VALUES}
                selectedValue={localWeight}
                onValueChange={setLocalWeight}
                width={120}
                visibleItems={1}
                textColor={wheelText}
                mutedColor={wheelMuted}
                accentColor={accent}
                bgColor={wheelBg}
              />
            </View>
            <View style={styles.unitBadge}>
              <Text style={[styles.unitBadgeText, { color: accent }]}>lbs</Text>
            </View>
          </View>
          <Text style={[styles.pickerHint, { color: colors.textMuted }]}>
            Range: 40 – 400 lbs · 1 lb increments
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>BIOLOGICAL SEX</Text>
          <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
            Used to calculate weight recommendations and programming.
          </Text>
          <View style={styles.chipRow}>
            {(['male', 'female', 'prefer_not'] as Sex[]).map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.chip,
                  { borderColor: colors.border, backgroundColor: colors.cardSecondary },
                  localSex === s && { backgroundColor: accent, borderColor: accent },
                ]}
                onPress={() => setLocalSex(s)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: colors.text },
                    localSex === s && { color: '#fff', fontWeight: '700' as const },
                  ]}
                >
                  {s === 'prefer_not' ? 'Prefer not to say' : s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* BODY FAT % — rolodex wheel */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>BODY FAT %</Text>
          <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
            From DEXA scan, calipers, or body pod.
          </Text>
          <View style={styles.singlePickerRow}>
            <View style={[styles.pickerCard, { backgroundColor: wheelBg, borderColor: colors.border }]}>
              <WheelPicker
                values={BODY_FAT_VALUES}
                selectedValue={localBodyFat}
                onValueChange={setLocalBodyFat}
                width={110}
                visibleItems={1}
                textColor={wheelText}
                mutedColor={wheelMuted}
                accentColor={accent}
                bgColor={wheelBg}
                formatValue={bodyFatFormatValue}
              />
            </View>
            <View style={styles.bfStatsCol}>
              <View style={[styles.bfStatBox, { backgroundColor: colors.cardSecondary }]}>
                <Text style={[styles.bfStatLabel, { color: colors.textMuted }]}>Lean</Text>
                <Text style={[styles.bfStatValue, { color: colors.text }]}>{leanMass} lbs</Text>
              </View>
              <View style={[styles.bfStatBox, { backgroundColor: colors.cardSecondary }]}>
                <Text style={[styles.bfStatLabel, { color: colors.textMuted }]}>Fat</Text>
                <Text style={[styles.bfStatValue, { color: colors.text }]}>{fatMass} lbs</Text>
              </View>
            </View>
          </View>
          <Text style={[styles.pickerHint, { color: colors.textMuted }]}>
            Range: 3 – 50% · 0.5% increments
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>FITNESS LEVEL</Text>
          <View style={styles.chipRow}>
            {(['beginner', 'intermediate', 'advanced'] as FitnessLevel[]).map((l) => (
              <TouchableOpacity
                key={l}
                style={[
                  styles.chip,
                  { borderColor: colors.border, backgroundColor: colors.cardSecondary },
                  localFitnessLevel === l && { backgroundColor: accent, borderColor: accent },
                ]}
                onPress={() => setLocalFitnessLevel(l)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: colors.text },
                    localFitnessLevel === l && { color: '#fff', fontWeight: '700' as const },
                  ]}
                >
                  {l.charAt(0).toUpperCase() + l.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>WHAT ARE YOU TRAINING FOR?</Text>
          <View style={styles.chipRowWrap}>
            {TRAINING_GOALS.map((g) => (
              <TouchableOpacity
                key={g}
                style={[
                  styles.chip,
                  { borderColor: colors.border, backgroundColor: colors.cardSecondary },
                  localGoals.includes(g) && { backgroundColor: accent, borderColor: accent },
                ]}
                onPress={() => toggleGoal(g)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: colors.text },
                    localGoals.includes(g) && { color: '#fff', fontWeight: '700' as const },
                  ]}
                >
                  {g}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>BMI</Text>
          <View style={styles.bmiRow}>
            <Text style={[styles.bmiValue, { color: colors.text }]}>{bmi}</Text>
            <Text style={[styles.bmiCat, { color: bmiCat.color }]}>{bmiCat.label}</Text>
          </View>
          <View style={[styles.bmiTrack, { backgroundColor: colors.border }]}>
            <View style={[styles.bmiSegment, { backgroundColor: '#60a5fa', flex: 1 }]} />
            <View style={[styles.bmiSegment, { backgroundColor: '#22c55e', flex: 1.3 }]} />
            <View style={[styles.bmiSegment, { backgroundColor: '#eab308', flex: 1 }]} />
            <View style={[styles.bmiSegment, { backgroundColor: '#ef4444', flex: 1.2 }]} />
          </View>
          <View style={styles.bmiLabels}>
            <Text style={[styles.bmiLabel, { color: colors.textMuted }]}>Underweight</Text>
            <Text style={[styles.bmiLabel, { color: colors.textMuted }]}>Normal</Text>
            <Text style={[styles.bmiLabel, { color: colors.textMuted }]}>Over</Text>
            <Text style={[styles.bmiLabel, { color: colors.textMuted }]}>Obese</Text>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <View style={styles.slcHeader}>
            <Stethoscope size={22} color="#e84057" />
            <View>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>SPECIAL LIFE CASE</Text>
              <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
                Adjusts Advanced workouts to your situation
              </Text>
            </View>
          </View>
          <View style={styles.slcGrid}>
            {SPECIAL_LIFE_CASES.map((slc) => (
              <TouchableOpacity
                key={slc.id}
                style={[
                  styles.slcBtn,
                  { borderColor: colors.border, backgroundColor: colors.cardSecondary },
                  localSLC === slc.id && {
                    backgroundColor: '#7f1d1d',
                    borderColor: '#ef4444',
                  },
                ]}
                onPress={() => {
                  setLocalSLC(slc.id);
                  setLocalSLCDetail('');
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.slcBtnText,
                    { color: colors.text },
                    localSLC === slc.id && { color: '#fca5a5', fontWeight: '700' as const },
                  ]}
                >
                  {slc.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {localSLC === 'pregnant' && (
            <View style={styles.slcDetail}>
              <Text style={[styles.slcDetailLabel, { color: colors.textSecondary }]}>DUE DATE</Text>
              <TextInput
                style={[styles.slcDetailInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.cardSecondary }]}
                value={localSLCDetail}
                onChangeText={setLocalSLCDetail}
                placeholder="mm/dd/yyyy"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          )}
          {localSLC === 'postpartum' && (
            <View style={styles.slcDetail}>
              <Text style={[styles.slcDetailLabel, { color: colors.textSecondary }]}>NOTES (OPTIONAL)</Text>
              <TextInput
                style={[styles.slcDetailInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.cardSecondary }]}
                value={localSLCDetail}
                onChangeText={setLocalSLCDetail}
                placeholder="e.g. 3 months postpartum, cleared for exercise..."
                placeholderTextColor={colors.textMuted}
                multiline
              />
            </View>
          )}
          {localSLC === 'injury' && (
            <View style={styles.slcDetail}>
              <Text style={[styles.slcDetailLabel, { color: colors.textSecondary }]}>INJURY LOCATION</Text>
              <TextInput
                style={[styles.slcDetailInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.cardSecondary }]}
                value={localSLCDetail}
                onChangeText={setLocalSLCDetail}
                placeholder="e.g. Left knee, lower back..."
                placeholderTextColor={colors.textMuted}
              />
            </View>
          )}
          {localSLC === 'disability' && (
            <View style={styles.slcDetail}>
              <Text style={[styles.slcDetailLabel, { color: colors.textSecondary }]}>DESCRIPTION</Text>
              <TextInput
                style={[styles.slcDetailInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.cardSecondary }]}
                value={localSLCDetail}
                onChangeText={setLocalSLCDetail}
                placeholder="e.g. Partial paralysis, missing limb..."
                placeholderTextColor={colors.textMuted}
                multiline
              />
            </View>
          )}
          {localSLC === 'chronic_pain' && (
            <View style={styles.slcDetail}>
              <Text style={[styles.slcDetailLabel, { color: colors.textSecondary }]}>AFFECTED AREA</Text>
              <TextInput
                style={[styles.slcDetailInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.cardSecondary }]}
                value={localSLCDetail}
                onChangeText={setLocalSLCDetail}
                placeholder="e.g. Hip flexors, neck..."
                placeholderTextColor={colors.textMuted}
              />
            </View>
          )}
        </View>



        <View style={{ height: 24 }} />
      </BottomSheetScrollView>
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
  headerDoneBtn: {
    borderRadius: 19,
    width: 80,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerDoneText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600' as const,
  },
  title: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  content: { paddingHorizontal: 16, gap: 12, paddingBottom: 12 },
  nameInput: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '500' as const,
  },
  dobRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  dobCol: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  dobColLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  section: { borderRadius: 16, padding: 16, gap: 12 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  sectionSubtitle: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  recoveryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  recoveryBtnText: { fontSize: 11, fontWeight: '600' },
  muscleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  muscleName: { fontSize: 13, fontWeight: '500', width: 90 },
  muscleBarBg: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  muscleBarFill: { height: '100%', borderRadius: 3 },
  muscleStatus: { fontSize: 10, textAlign: 'right' },
  viewAllBtn: { alignItems: 'center', paddingVertical: 4 },
  viewAllText: { fontSize: 12 },
  muscleKey: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  keyItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  keyDot: { width: 8, height: 8, borderRadius: 4 },
  keyText: { fontSize: 10 },
  fieldLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  fieldHint: { fontSize: 11, marginTop: -4 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldValue: { fontSize: 14, fontWeight: '700' },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },
  pickerBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  pickerSep: {
    width: 1,
    height: 60,
    marginHorizontal: 8,
    opacity: 0.3,
  },
  pickerCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pickerUnit: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  pickerHint: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: -4,
  },
  singlePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  unitBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  unitBadgeText: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  bfStatsCol: {
    gap: 8,
  },
  bfStatBox: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 80,
  },
  bfStatLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  bfStatValue: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  chipRow: { flexDirection: 'row', gap: 8 },
  chipRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipText: { fontSize: 13 },
  bmiRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  bmiValue: { fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  bmiCat: { fontSize: 14, fontWeight: '700' },
  bmiTrack: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2 },
  bmiSegment: { height: '100%' },
  bmiLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  bmiLabel: { fontSize: 9, flex: 1, textAlign: 'center' },
  slcHeader: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  slcGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slcBtn: {
    width: '47%',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slcBtnText: { fontSize: 14 },
  slcDetail: { gap: 8 },
  slcDetailLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  slcDetailInput: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  discardBtn: { flex: 1, borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  discardText: { fontSize: 14, fontWeight: '600' },
  doneBtn: { flex: 2, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  doneBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  ageRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  ageNumber: { fontSize: 48, fontWeight: '800', letterSpacing: -2 },
  ageUnit: { fontSize: 16, fontWeight: '500' },
  ageDobHint: { marginLeft: 'auto' as any },
  ageDobText: { fontSize: 12 },
});
