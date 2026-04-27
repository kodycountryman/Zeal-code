import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  Platform,
  Alert,
  Keyboard,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { PlatformIcon } from '@/components/PlatformIcon';
import type { AppIconName } from '@/constants/iconMap';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppContext } from '@/context/AppContext';
import { WORKOUT_STYLE_COLORS } from '@/constants/colors';
import WheelPicker from '@/components/WheelPicker';

import { healthService } from '@/services/healthService';
import type { Sex, FitnessLevel } from '@/context/AppContext';
import { COMMERCIAL_EQUIPMENT_PRESET, CROSSFIT_EQUIPMENT_PRESET, EQUIPMENT_CATEGORIES } from '@/mocks/equipmentData';
import { type TrainingGoal as Goal } from '@/constants/fitnessGoals';
import { requestNotificationPermissions } from '@/services/notificationService';
import { WORKOUT_STYLE_LIST as WORKOUT_STYLES_LIST } from '@/constants/workoutStyles';

const { width: SW } = Dimensions.get('window');
const ACCENT = '#f87116';
const BG = '#0e0e0e';
const CARD = '#1c1c1c';
const BORDER = '#2a2a2a';
const TEXT = '#ffffff';
const TEXT2 = 'rgba(255,255,255,0.55)';
const TOTAL_STEPS = 12;

const CURRENT_YEAR = new Date().getFullYear();


type EquipmentPreset = 'commercial' | 'home' | 'crossfit';

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const YEARS = Array.from({ length: 88 }, (_, i) => CURRENT_YEAR - 100 + i);
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const HEIGHTS_FT = [4, 5, 6, 7];
const HEIGHTS_IN = Array.from({ length: 12 }, (_, i) => i);
const WEIGHTS_LBS = Array.from({ length: 321 }, (_, i) => i + 80);
const WEIGHTS_KG = Array.from({ length: 181 }, (_, i) => Math.round((i + 36) * 0.453592 * 10) / 10).filter((v, i, a) => a.indexOf(v) === i);

const GOALS: { key: Goal; icon: AppIconName }[] = [
  { key: 'Build Muscle', icon: 'dumbbell' },
  { key: 'Get Stronger', icon: 'trending-up' },
  { key: 'Lose Weight', icon: 'flame' },
  { key: 'Better Conditioning', icon: 'activity' },
  { key: 'Improve Flexibility', icon: 'leaf' },
  { key: 'Sport Performance', icon: 'trophy' },
];


function kgToLbs(kg: number): number {
  return Math.round(kg / 0.453592);
}

export default function OnboardingScreen() {
  const router = useRouter();
  const ctx = useAppContext();

  const [step, setStep] = useState(1);
  const progressAnim = useRef(new Animated.Value(1 / TOTAL_STEPS)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const slideDir = useRef(1);

  const googlePrefill = ctx.googlePrefill;
  const [name, setName] = useState(googlePrefill?.name ?? '');
  const [birthDay, setBirthDay] = useState(1);
  const [birthMonth, setBirthMonth] = useState(6);
  const [birthYear, setBirthYear] = useState(1995);
  const [sex, setSex] = useState<Sex | null>(null);
  const [heightFt, setHeightFt] = useState(5);
  const [heightIn, setHeightIn] = useState(10);
  const [weightLbs, setWeightLbs] = useState(160);
  const [weightUnit, setWeightUnit] = useState<'lbs' | 'kg'>('lbs');
  const [fitnessLevel, setFitnessLevel] = useState<FitnessLevel | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [workoutStyle, setWorkoutStyle] = useState<string | null>('Strength');
  const [equipPreset, setEquipPreset] = useState<EquipmentPreset | null>(null);
  const [localHomeEquip, setLocalHomeEquip] = useState<Record<string, number>>({});
  const [warmUpEnabled, setWarmUpEnabled] = useState(true);
  const [coolDownEnabled, setCoolDownEnabled] = useState(true);
  const [recoveryEnabled, setRecoveryEnabled] = useState(false);
  const [addCardioEnabled, setAddCardioEnabled] = useState(false);
  const [coreFinisherEnabled, setCoreFinisherEnabled] = useState(false);

  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: step / TOTAL_STEPS,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [step]);

  useEffect(() => {
    contentAnim.setValue(slideDir.current * 40);
    Animated.timing(contentAnim, {
      toValue: 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [step]);

  const canContinue = useMemo(() => {
    switch (step) {
      case 1: return name.trim().length > 0;
      case 2: return true;
      case 3: return sex !== null;
      case 4: return true;
      case 5: return true;
      case 6: return fitnessLevel !== null;
      case 7: return goal !== null;
      case 8: return equipPreset !== null;
      case 9: return true;
      case 10: return true;
      case 11: return true;
      default: return false;
    }
  }, [step, name, sex, fitnessLevel, goal, equipPreset]);

  const goNext = useCallback(() => {
    if (step === 11) {
      handleWalkthroughDone();
      return;
    }
    if (step === 8 && equipPreset !== 'home') {
      slideDir.current = 1;
      setStep(10);
      return;
    }
    slideDir.current = 1;
    setStep((s) => s + 1);
  }, [step, equipPreset]);

  const goBack = useCallback(() => {
    if (step <= 1) return;
    slideDir.current = -1;
    if (step === 10 && equipPreset !== 'home') {
      setStep(8);
      return;
    }
    setStep((s) => s - 1);
  }, [step, equipPreset]);

  const handleWalkthroughDone = useCallback(async () => {
    setGenerating(true);

    try {
      const finalWeight = weightUnit === 'kg' ? kgToLbs(weightLbs) : weightLbs;
      const finalEquip =
        equipPreset === 'commercial' ? COMMERCIAL_EQUIPMENT_PRESET
          : equipPreset === 'crossfit' ? CROSSFIT_EQUIPMENT_PRESET
          : localHomeEquip;

      const dob = `${birthYear}-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`;

      const googlePhotoUri = ctx.googlePrefill?.photoUri ?? null;

      // Reset ALL previous user data before applying the new user's profile
      await ctx.resetForNewUser();

      // Use saveOnboardingProfile to atomically set all values and persist to storage
      // (avoids stale-closure issues with calling saveState() after individual setters)
      ctx.saveOnboardingProfile({
        userName: name.trim(),
        userPhotoUri: googlePhotoUri,
        dateOfBirth: dob,
        heightFt,
        heightIn,
        weight: finalWeight,
        sex: sex ?? 'male',
        fitnessLevel: fitnessLevel ?? 'beginner',
        trainingGoals: [goal ?? 'Build Muscle'],
        workoutStyle: workoutStyle ?? 'Strength',
        selectedEquipment: finalEquip,
        gymType: equipPreset ?? 'commercial',
        warmUp: warmUpEnabled,
        coolDown: coolDownEnabled,
        recovery: recoveryEnabled,
        addCardio: addCardioEnabled,
        coreFinisher: coreFinisherEnabled,
      });

      // Finalize onboarding + unmount the "Building your first workout…"
      // screen before navigating, so the loading UI has a frame to disappear
      // and we never leave the user staring at a frozen screen.
      ctx.completeOnboarding();
      setGenerating(false);

      // Safety net: if something stalls RN's navigation stack, force a
      // replace after 4s so the user always lands on the Home tab.
      const safetyTimer = setTimeout(() => {
        __DEV__ && console.warn('[Onboarding] Safety timeout fired — forcing router.replace');
        router.replace('/(tabs)');
      }, 4000);

      // Defer the navigation one frame so the loading overlay actually
      // unmounts before the new tab layout mounts on top of it.
      requestAnimationFrame(() => {
        clearTimeout(safetyTimer);
        router.replace('/(tabs)');
      });
    } catch (e) {
      console.error('[Onboarding] Failed to save profile:', e);
      setGenerating(false);
      Alert.alert(
        'Something went wrong',
        'We couldn\'t save your profile. Please try again.',
        [{ text: 'OK' }]
      );
    }
  }, [name, birthDay, birthMonth, birthYear, heightFt, heightIn, weightLbs, weightUnit, sex, fitnessLevel, goal, workoutStyle, equipPreset, localHomeEquip, warmUpEnabled, coolDownEnabled, recoveryEnabled, addCardioEnabled, coreFinisherEnabled, ctx]);

  const handleRequestNotifications = useCallback(async () => {
    if (Platform.OS !== 'web') {
      try {
        const status = await requestNotificationPermissions();
        if (status === 'granted') {
          ctx.saveNotifPrefs({ dailyEnabled: true, dailyHour: 8, dailyMinute: 0 });
          __DEV__ && console.log('[Onboarding] Notification permission granted, daily reminder enabled');
        } else {
          __DEV__ && console.log('[Onboarding] Notification permission not granted:', status);
        }
      } catch (e) {
        __DEV__ && console.log('[Onboarding] Error requesting notification permissions:', e);
      }
    }
    slideDir.current = 1;
    // Skip health step on iPad — HealthKit not available there
    if ((Platform as any).isPad) {
      handleWalkthroughDone();
    } else {
      setStep(12);
    }
  }, [ctx, handleWalkthroughDone]);

  const handleConnectHealth = useCallback(async () => {
    try {
      if (healthService.isAvailable()) {
        // Wrap in a 10s timeout — if the native HealthKit callback never fires
        // (e.g. unsupported device), we fall through gracefully instead of hanging.
        const result = await Promise.race([
          healthService.requestPermissions(),
          new Promise<{ granted: false; error: string }>((resolve) =>
            setTimeout(() => resolve({ granted: false, error: 'timeout' }), 10000)
          ),
        ]);
        __DEV__ && console.log('[Onboarding] Health permission:', result);
        if (result.granted) {
          ctx.setHealthSyncEnabled(true);
          ctx.setHealthConnected(true);
          __DEV__ && console.log('[Onboarding] Health connected and saved to context');
        }
      } else {
        __DEV__ && console.log('[Onboarding] Health not available in this build, skipping');
      }
    } catch (e) {
      __DEV__ && console.log('[Onboarding] Health error:', e);
    }
    handleWalkthroughDone();
  }, [ctx, handleWalkthroughDone]);

  const effectiveWeight = weightUnit === 'lbs' ? weightLbs : Math.round(weightLbs * 0.453592);
  const weightValues = weightUnit === 'lbs' ? WEIGHTS_LBS : WEIGHTS_KG.map((v) => Math.round(v));

  if (generating) {
    return (
      <View style={styles.generatingContainer}>
        <LinearGradient colors={['#1a0a00', '#0e0e0e']} style={StyleSheet.absoluteFill} />
        <View style={styles.generatingContent}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={styles.generatingTitle}>
            Building your first workout, {name.trim()}...
          </Text>
          <Text style={styles.generatingSubtext}>
            Calibrating your personalized training engine
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#141414', '#0e0e0e']} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.safe}>
        <View style={styles.progressBarBg}>
          <Animated.View
            style={[
              styles.progressBarFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>

        <View style={styles.navRow}>
          {step > 1 ? (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={goBack}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              testID="onboarding-back"
            >
              <PlatformIcon name="arrow-left" size={20} color={TEXT} strokeWidth={2} />
            </TouchableOpacity>
          ) : (
            <View style={styles.backBtn} />
          )}
          <Text style={styles.stepIndicator}>{step} / {TOTAL_STEPS}</Text>
          <View style={styles.backBtn} />
        </View>

        <Animated.View
          style={[
            styles.stepContent,
            {
              opacity: contentAnim.interpolate({
                inputRange: [-40, 0, 40],
                outputRange: [0, 1, 0],
              }),
              transform: [{ translateX: contentAnim }],
            },
          ]}
        >
          {step === 1 && <StepName name={name} onChange={setName} onSubmit={goNext} />}
          {step === 2 && (
            <StepBirthday
              day={birthDay}
              month={birthMonth}
              year={birthYear}
              onDayChange={setBirthDay}
              onMonthChange={setBirthMonth}
              onYearChange={setBirthYear}
            />
          )}
          {step === 3 && <StepSex value={sex} onChange={setSex} />}
          {step === 4 && (
            <StepHeight ft={heightFt} inches={heightIn} onFtChange={setHeightFt} onInChange={setHeightIn} />
          )}
          {step === 5 && (
            <StepWeight
              weight={effectiveWeight}
              unit={weightUnit}
              onWeightChange={(v) => {
                if (weightUnit === 'lbs') setWeightLbs(v);
                else setWeightLbs(kgToLbs(v));
              }}
              onUnitChange={(u) => setWeightUnit(u)}
              values={weightValues}
            />
          )}
          {step === 6 && <StepFitnessLevel value={fitnessLevel} onChange={setFitnessLevel} />}
          {step === 7 && <StepGoal value={goal} onChange={setGoal} />}
          {step === 8 && (
            <StepGymType
              value={equipPreset}
              onChange={setEquipPreset}
            />
          )}
          {step === 9 && (
            <StepHomeEquipment
              value={localHomeEquip}
              onChange={setLocalHomeEquip}
            />
          )}
          {step === 10 && (
            <StepWorkoutComponents
              warmUp={warmUpEnabled}
              coolDown={coolDownEnabled}
              recovery={recoveryEnabled}
              cardio={addCardioEnabled}
              coreFinisher={coreFinisherEnabled}
              onToggleWarmUp={() => setWarmUpEnabled(v => !v)}
              onToggleCoolDown={() => setCoolDownEnabled(v => !v)}
              onToggleRecovery={() => setRecoveryEnabled(v => !v)}
              onToggleCardio={() => setAddCardioEnabled(v => !v)}
              onToggleCoreFinisher={() => setCoreFinisherEnabled(v => !v)}
            />
          )}
          {step === 11 && (
            <StepNotifications
              onAllow={handleRequestNotifications}
              onSkip={() => {
                slideDir.current = 1;
                // Skip health step entirely on iPad — HealthKit not available
                if ((Platform as any).isPad) {
                  handleWalkthroughDone();
                } else {
                  setStep(12);
                }
              }}
            />
          )}
          {step === 12 && (
            <StepHealthData
              onConnect={handleConnectHealth}
            />
          )}
        </Animated.View>

        {step !== 11 && step !== 12 && (
          <View style={styles.bottomBar}>
            {step === 9 ? (
              <View style={styles.homeEquipFooter}>
                <TouchableOpacity
                  style={styles.skipEquipBtn}
                  onPress={() => { setLocalHomeEquip({}); slideDir.current = 1; setStep(10); }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.skipLink}>Skip</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.continueBtn, { flex: 2 }]}
                  onPress={goNext}
                  activeOpacity={0.85}
                  testID="onboarding-continue"
                >
                  <LinearGradient
                    colors={['#ff8c35', '#f87116', '#d96010']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.continueGradient}
                  >
                    <Text style={styles.continueText}>Done</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.continueBtn, !canContinue && styles.continueBtnDisabled]}
                onPress={canContinue ? goNext : undefined}
                activeOpacity={canContinue ? 0.85 : 1}
                testID="onboarding-continue"
              >
                {canContinue ? (
                  <LinearGradient
                    colors={['#ff8c35', '#f87116', '#d96010']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.continueGradient}
                  >
                    <Text style={styles.continueText}>Continue</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.continueGradient}>
                    <Text style={[styles.continueText, { color: 'rgba(255,255,255,0.3)' }]}>Continue</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </SafeAreaView>

    </View>
  );
}

function StepName({ name, onChange, onSubmit }: { name: string; onChange: (v: string) => void; onSubmit: () => void }) {
  return (
    <View style={styles.stepInner}>
      <View style={styles.headingBlock}>
        <Text style={styles.stepHeadline}>What should we call you?</Text>
        <Text style={styles.stepSubtext}>We&apos;ll use this to personalize your experience.</Text>
      </View>
      <TextInput
        style={styles.nameInput}
        placeholder="First name"
        placeholderTextColor="rgba(255,255,255,0.25)"
        value={name}
        onChangeText={onChange}
        returnKeyType="done"
        onSubmitEditing={onSubmit}
        autoFocus
        autoCapitalize="words"
        autoCorrect={false}
        selectionColor={ACCENT}
      />
    </View>
  );
}

function StepBirthday({
  day, month, year,
  onDayChange, onMonthChange, onYearChange,
}: {
  day: number; month: number; year: number;
  onDayChange: (v: number) => void;
  onMonthChange: (v: number) => void;
  onYearChange: (v: number) => void;
}) {
  const monthFormatValue = useCallback((v: number) => MONTH_NAMES[v - 1] ?? String(v), []);

  return (
    <View style={styles.stepInner}>
      <View style={styles.headingBlock}>
        <Text style={styles.stepHeadline}>When&apos;s your birthday?</Text>
        <Text style={styles.stepSubtext}>Used to calculate age-appropriate programming.</Text>
      </View>
      <View style={styles.birthdayPickerArea}>
        <View style={styles.birthdayRow}>
          <View style={styles.birthdayCol}>
            <Text style={styles.birthdayColLabel}>DAY</Text>
            <View style={[styles.pickerContainer]}>
              <WheelPicker
                values={DAYS}
                selectedValue={day}
                onValueChange={onDayChange}
                width={72}
                textColor={TEXT}
                accentColor={ACCENT}
                bgColor="transparent"
                visibleItems={3}
              />
            </View>
          </View>
          <View style={styles.birthdayCol}>
            <Text style={styles.birthdayColLabel}>MONTH</Text>
            <View style={[styles.pickerContainer]}>
              <WheelPicker
                values={MONTHS}
                selectedValue={month}
                onValueChange={onMonthChange}
                formatValue={monthFormatValue}
                width={80}
                textColor={TEXT}
                accentColor={ACCENT}
                bgColor="transparent"
                visibleItems={3}
              />
            </View>
          </View>
          <View style={styles.birthdayCol}>
            <Text style={styles.birthdayColLabel}>YEAR</Text>
            <View style={[styles.pickerContainer]}>
              <WheelPicker
                values={YEARS}
                selectedValue={year}
                onValueChange={onYearChange}
                width={88}
                textColor={TEXT}
                accentColor={ACCENT}
                bgColor="transparent"
                visibleItems={3}
              />
            </View>
          </View>
        </View>
        <Text style={styles.birthdayPreview}>
          {MONTH_NAMES[month - 1]} {String(day).padStart(2, '0')}, {year}
        </Text>
      </View>
    </View>
  );
}

function StepSex({ value, onChange }: { value: Sex | null; onChange: (v: Sex) => void }) {
  const OPTIONS: { key: Sex; label: string }[] = [
    { key: 'male', label: 'Male' },
    { key: 'female', label: 'Female' },
  ];
  return (
    <View style={styles.stepInner}>
      <View style={styles.headingBlock}>
        <Text style={styles.stepHeadline}>Biological sex</Text>
        <Text style={styles.stepSubtext}>Used for accurate fitness calculations.</Text>
      </View>
      <View style={styles.cardList}>
        {OPTIONS.map((o) => {
          const sel = value === o.key;
          return (
            <TouchableOpacity
              key={o.key}
              style={[styles.selectCard, sel && styles.selectCardActive]}
              onPress={() => onChange(o.key)}
              activeOpacity={0.75}
            >
              {sel && <View style={styles.selectCardDot} />}
              <Text style={[styles.selectCardLabel, sel && styles.selectCardLabelActive]}>
                {o.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function StepHeight({
  ft, inches, onFtChange, onInChange,
}: {
  ft: number; inches: number; onFtChange: (v: number) => void; onInChange: (v: number) => void;
}) {
  return (
    <View style={styles.stepInner}>
      <View style={styles.headingBlock}>
        <Text style={styles.stepHeadline}>How tall are you?</Text>
      </View>
      <View style={styles.dualPickerRow}>
        <View style={styles.pickerCol}>
          <WheelPicker
            values={HEIGHTS_FT}
            selectedValue={ft}
            onValueChange={onFtChange}
            width={100}
            textColor={TEXT}
            accentColor={ACCENT}
            bgColor="transparent"
            visibleItems={3}
            suffix="'"
          />
          <Text style={styles.pickerColLabel}>Feet</Text>
        </View>
        <Text style={styles.pickerSep}> </Text>
        <View style={styles.pickerCol}>
          <WheelPicker
            values={HEIGHTS_IN}
            selectedValue={inches}
            onValueChange={onInChange}
            width={100}
            textColor={TEXT}
            accentColor={ACCENT}
            bgColor="transparent"
            visibleItems={3}
            suffix='"'
          />
          <Text style={styles.pickerColLabel}>Inches</Text>
        </View>
      </View>
      <Text style={styles.pickerLabel}>{ft}&apos;{inches}&quot;</Text>
    </View>
  );
}

function StepWeight({
  weight, unit, onWeightChange, onUnitChange, values,
}: {
  weight: number; unit: 'lbs' | 'kg';
  onWeightChange: (v: number) => void;
  onUnitChange: (u: 'lbs' | 'kg') => void;
  values: number[];
}) {
  return (
    <View style={styles.stepInner}>
      <View style={styles.headingBlock}>
        <Text style={styles.stepHeadline}>What&apos;s your current weight?</Text>
      </View>
      <View style={styles.pickerCenteredWrap}>
        <View style={styles.pickerContainer}>
          <WheelPicker
            values={values}
            selectedValue={weight}
            onValueChange={onWeightChange}
            width={140}
            textColor={TEXT}
            accentColor={ACCENT}
            bgColor="transparent"
            visibleItems={3}
            suffix={` ${unit}`}
          />
        </View>
        <Text style={styles.pickerLabel}>{weight} {unit}</Text>
      </View>
      <View style={styles.unitToggle}>
        {(['lbs', 'kg'] as const).map((u) => (
          <TouchableOpacity
            key={u}
            style={[styles.unitBtn, unit === u && styles.unitBtnActive]}
            onPress={() => onUnitChange(u)}
            activeOpacity={0.7}
          >
            <Text style={[styles.unitBtnText, unit === u && styles.unitBtnTextActive]}>
              {u}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function StepFitnessLevel({ value, onChange }: { value: FitnessLevel | null; onChange: (v: FitnessLevel) => void }) {
  const OPTIONS: { key: FitnessLevel; label: string; desc: string }[] = [
    { key: 'beginner', label: 'Beginner', desc: 'Less than 6 months of consistent training' },
    { key: 'intermediate', label: 'Intermediate', desc: '6 months to 2 years of consistent training' },
    { key: 'advanced', label: 'Advanced', desc: '2+ years of serious, consistent training' },
  ];
  return (
    <View style={styles.stepInner}>
      <View style={styles.headingBlock}>
        <Text style={styles.stepHeadline}>What&apos;s your fitness level?</Text>
      </View>
      <View style={styles.cardList}>
        {OPTIONS.map((o) => {
          const sel = value === o.key;
          return (
            <TouchableOpacity
              key={o.key}
              style={[styles.selectCard, styles.selectCardTall, sel && styles.selectCardActive]}
              onPress={() => onChange(o.key)}
              activeOpacity={0.75}
            >
              {sel && <View style={styles.selectCardDot} />}
              <View style={styles.selectCardTextCol}>
                <Text style={[styles.selectCardLabel, sel && styles.selectCardLabelActive]}>
                  {o.label}
                </Text>
                <Text style={[styles.selectCardDesc, sel && { color: 'rgba(255,255,255,0.7)' }]}>
                  {o.desc}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function StepGoal({ value, onChange }: { value: Goal | null; onChange: (v: Goal) => void }) {
  return (
    <View style={styles.stepInner}>
      <View style={styles.headingBlock}>
        <Text style={styles.stepHeadline}>What&apos;s your main goal?</Text>
      </View>
      <View style={styles.goalGrid}>
        {GOALS.map((g) => {
          const sel = value === g.key;
          return (
            <TouchableOpacity
              key={g.key}
              style={[styles.goalCard, sel && styles.goalCardActive]}
              onPress={() => onChange(g.key)}
              activeOpacity={0.75}
            >
              <View style={[styles.goalIconWrap, sel && styles.goalIconWrapActive]}>
                <PlatformIcon name={g.icon} size={22} color={sel ? ACCENT : 'rgba(255,255,255,0.5)'} strokeWidth={2} />
              </View>
              <Text style={[styles.goalLabel, sel && styles.goalLabelActive]}>{g.key}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function StepWorkoutStyle({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  return (
    <View style={styles.stepInner}>
      <View style={styles.headingBlock}>
        <Text style={styles.stepHeadline}>How do you like to train?</Text>
      </View>
      <ScrollView
        style={styles.styleScrollView}
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.styleList}>
          {WORKOUT_STYLES_LIST.map((s) => {
            const sel = value === s.key;
            const color = WORKOUT_STYLE_COLORS[s.key] ?? ACCENT;
            return (
              <TouchableOpacity
                key={s.key}
                style={[styles.styleRow, sel && { borderColor: color, backgroundColor: color + '15' }]}
                onPress={() => onChange(s.key)}
                activeOpacity={0.75}
              >
                <View style={[styles.styleColorDot, { backgroundColor: color }]} />
                <View style={styles.styleTextCol}>
                  <Text style={[styles.styleLabel, sel && { color: color }]}>{s.key}</Text>
                  <Text style={styles.styleDesc}>{s.desc}</Text>
                </View>
                {sel && <View style={[styles.styleCheck, { backgroundColor: color }]} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function StepGymType({
  value, onChange,
}: {
  value: EquipmentPreset | null;
  onChange: (v: EquipmentPreset) => void;
}) {
  const OPTIONS = [
    { key: 'commercial' as const, label: 'Commercial Gym', desc: 'Full machines, cables, barbells', icon: 'building' as AppIconName },
    { key: 'home' as const, label: 'Home Gym', desc: 'Select your equipment in the next step', icon: 'home' as AppIconName },
    { key: 'crossfit' as const, label: 'CrossFit Gym', desc: 'Barbells, conditioning, functional movements', icon: 'zap' as AppIconName },
  ];
  return (
    <View style={styles.stepInner}>
      <View style={styles.headingBlock}>
        <Text style={styles.stepHeadline}>Where do you train?</Text>
        <Text style={styles.stepSubtext}>We&apos;ll tailor workouts to what you actually have.</Text>
      </View>
      <View style={styles.cardList}>
        {OPTIONS.map((o) => {
          const sel = value === o.key;
          return (
            <TouchableOpacity
              key={o.key}
              style={[styles.selectCard, styles.selectCardRow, sel && styles.selectCardActive]}
              onPress={() => onChange(o.key)}
              activeOpacity={0.75}
            >
              <View style={[styles.equipIconWrap, sel && { backgroundColor: ACCENT + '22' }]}>
                <PlatformIcon name={o.icon} size={18} color={sel ? ACCENT : 'rgba(255,255,255,0.5)'} strokeWidth={2} />
              </View>
              <View style={styles.selectCardTextCol}>
                <Text style={[styles.selectCardLabel, sel && styles.selectCardLabelActive]}>
                  {o.label}
                </Text>
                <Text style={[styles.selectCardDesc, sel && { color: 'rgba(255,255,255,0.7)' }]}>
                  {o.desc}
                </Text>
              </View>
              {sel && <View style={styles.selectCardDotRight} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function StepHomeEquipment({
  value, onChange,
}: {
  value: Record<string, number>;
  onChange: (v: Record<string, number>) => void;
}) {
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const totalSelected = Object.values(value).filter((v) => v > 0).length;

  const toggleItem = (id: string) => {
    onChange({ ...value, [id]: (value[id] ?? 0) > 0 ? 0 : 1 });
  };

  const toggleCat = (catId: string) => {
    setExpandedCats((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  return (
    <View style={styles.stepInner}>
      <View style={styles.headingBlock}>
        <Text style={styles.stepHeadline}>What equipment do you have?</Text>
        <Text style={styles.stepSubtext}>Tap to add items — or skip if you&apos;re not sure yet.</Text>
      </View>
      <Text style={[styles.stepSubtext, { color: ACCENT, marginBottom: 10 }]}>
        {totalSelected > 0 ? `${totalSelected} item${totalSelected !== 1 ? 's' : ''} selected` : 'Nothing selected yet'}
      </Text>
      <ScrollView
        style={styles.styleScrollView}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {EQUIPMENT_CATEGORIES.map((cat) => {
          const selectedInCat = cat.items.filter((i) => (value[i.id] ?? 0) > 0).length;
          const isExpanded = expandedCats[cat.id] ?? false;
          return (
            <View key={cat.id} style={styles.homeEquipCat}>
              <TouchableOpacity
                style={styles.homeEquipCatHeader}
                onPress={() => toggleCat(cat.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.homeEquipCatName}>{cat.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {selectedInCat > 0 && (
                    <Text style={{ color: ACCENT, fontSize: 13, fontFamily: 'Outfit_600SemiBold' }}>
                      {selectedInCat}
                    </Text>
                  )}
                  {isExpanded
                    ? <PlatformIcon name="chevron-up" size={17} color={TEXT2} />
                    : <PlatformIcon name="chevron-down" size={17} color={TEXT2} />
                  }
                </View>
              </TouchableOpacity>
              {isExpanded && cat.items.map((item) => {
                const isOn = (value[item.id] ?? 0) > 0;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.homeEquipItemRow}
                    onPress={() => toggleItem(item.id)}
                    activeOpacity={0.6}
                  >
                    <Text style={[styles.homeEquipItemName, isOn && { color: TEXT }]}>
                      {item.name}
                    </Text>
                    <View style={[
                      styles.homeEquipCheckbox,
                      { borderColor: isOn ? ACCENT : BORDER, backgroundColor: isOn ? ACCENT : 'transparent' },
                    ]}>
                      {isOn && <PlatformIcon name="check" size={12} color="#fff" strokeWidth={3} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

function StepWorkoutComponents({
  warmUp, coolDown, recovery, cardio, coreFinisher,
  onToggleWarmUp, onToggleCoolDown, onToggleRecovery, onToggleCardio, onToggleCoreFinisher,
}: {
  warmUp: boolean;
  coolDown: boolean;
  recovery: boolean;
  cardio: boolean;
  coreFinisher: boolean;
  onToggleWarmUp: () => void;
  onToggleCoolDown: () => void;
  onToggleRecovery: () => void;
  onToggleCardio: () => void;
  onToggleCoreFinisher: () => void;
}) {
  const COMPONENTS: {
    label: string;
    desc: string;
    time: string;
    icon: AppIconName;
    iconColor: string;
    enabled: boolean;
    onToggle: () => void;
  }[] = [
    {
      label: 'Warm-Up',
      desc: 'Dynamic stretches and activation priming',
      time: '+5 min',
      icon: 'flame',
      iconColor: '#f87116',
      enabled: warmUp,
      onToggle: onToggleWarmUp,
    },
    {
      label: 'Cool-Down',
      desc: 'Static stretching to ease post-workout',
      time: '+5 min',
      icon: 'wind',
      iconColor: '#60a5fa',
      enabled: coolDown,
      onToggle: onToggleCoolDown,
    },
    {
      label: 'Recovery',
      desc: 'Foam rolling and soft tissue work',
      time: '+5 min',
      icon: 'zap',
      iconColor: '#a78bfa',
      enabled: recovery,
      onToggle: onToggleRecovery,
    },
    {
      label: 'Cardio Finisher',
      desc: 'High-intensity intervals at the end',
      time: '+10 min',
      icon: 'activity',
      iconColor: '#34d399',
      enabled: cardio,
      onToggle: onToggleCardio,
    },
    {
      label: 'Core Finisher',
      desc: 'Targeted core movement to close each session',
      time: '+5 min',
      icon: 'target',
      iconColor: '#fb923c',
      enabled: coreFinisher,
      onToggle: onToggleCoreFinisher,
    },
  ];

  return (
    <View style={styles.stepInner}>
      <View style={styles.headingBlock}>
        <Text style={styles.stepHeadline}>Build your workout.</Text>
        <Text style={styles.stepSubtext}>
          Choose the components you want added to each session.
        </Text>
      </View>
      <ScrollView
        style={styles.styleScrollView}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.componentList}>
          {COMPONENTS.map((c) => (
            <TouchableOpacity
              key={c.label}
              style={[
                styles.componentCard,
                c.enabled && { borderColor: c.iconColor, backgroundColor: c.iconColor + '10' },
              ]}
              onPress={c.onToggle}
              activeOpacity={0.75}
            >
              <View style={[
                styles.componentIconWrap,
                { backgroundColor: c.iconColor + '18' },
                c.enabled && { backgroundColor: c.iconColor + '28' },
              ]}>
                <PlatformIcon name={c.icon} size={20} color={c.iconColor} strokeWidth={2} />
              </View>
              <View style={styles.componentTextCol}>
                <Text style={[
                  styles.componentLabel,
                  c.enabled && { color: '#fff' },
                ]}>
                  {c.label}
                </Text>
                <Text style={styles.componentDesc}>{c.desc}</Text>
              </View>
              <View style={styles.componentRight}>
                <Text style={[
                  styles.componentTime,
                  { color: c.enabled ? c.iconColor : 'rgba(255,255,255,0.2)' },
                ]}>
                  {c.time}
                </Text>
                <View style={[
                  styles.componentCheckCircle,
                  c.enabled
                    ? { backgroundColor: c.iconColor, borderColor: c.iconColor }
                    : {},
                ]}>
                  {c.enabled && <PlatformIcon name="check" size={11} color="#fff" strokeWidth={3} />}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function StepNotifications({
  onAllow, onSkip,
}: {
  onAllow: () => void;
  onSkip: () => void;
}) {
  return (
    <View style={styles.stepInner}>
      <View style={styles.headingBlock}>
        <Text style={styles.stepHeadline}>Never miss a workout.</Text>
        <Text style={styles.stepSubtext}>
          Get reminders, streak alerts, and rest timer notifications. You control what you receive in Settings.
        </Text>
      </View>
      <View style={styles.permissionIconWrap}>
        <View style={styles.permissionIconCircle}>
          <PlatformIcon name="bell" size={52} color={ACCENT} strokeWidth={1.5} />
        </View>
      </View>
      <View style={styles.permissionBtnBlock}>
        <TouchableOpacity
          style={styles.permissionBtn}
          onPress={onAllow}
          activeOpacity={0.85}
          testID="allow-notifications"
        >
          <LinearGradient
            colors={['#ff8c35', '#f87116', '#d96010']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.permissionBtnGradient}
          >
            <Text style={styles.permissionBtnText}>Allow Notifications</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity onPress={onSkip} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.skipLink}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function StepHealthData({
  onConnect,
}: {
  onConnect: () => void;
}) {
  const healthName = Platform.OS === 'ios' ? 'Apple Health' : Platform.OS === 'android' ? 'Health Connect' : 'Health Data';
  return (
    <View style={styles.stepInner}>
      <View style={styles.headingBlock}>
        <Text style={styles.stepHeadline}>Connect your health data.</Text>
        <Text style={styles.stepSubtext}>
          Zeal reads your activity data to calculate your readiness score and improve your workouts. Your completed workouts can be written back to keep your health records in sync.
        </Text>
      </View>
      <View style={styles.permissionIconWrap}>
        <View style={[styles.permissionIconCircle, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
          <PlatformIcon name="heart" size={52} color="#ef4444" strokeWidth={1.5} />
        </View>
      </View>
      <View style={styles.permissionBtnBlock}>
        <TouchableOpacity
          style={styles.permissionBtn}
          onPress={onConnect}
          activeOpacity={0.85}
          testID="connect-health"
        >
          <LinearGradient
            colors={['#ff8c35', '#f87116', '#d96010']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.permissionBtnGradient}
          >
            <Text style={styles.permissionBtnText}>Continue</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  safe: { flex: 1 },
  progressBarBg: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  progressBarFill: {
    height: 3,
    backgroundColor: ACCENT,
    borderRadius: 2,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIndicator: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 1,
  },
  stepContent: {
    flex: 1,
  },
  stepInner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 28,
  },
  headingBlock: {
    gap: 8,
  },
  stepHeadline: {
    fontSize: 28,
    fontFamily: 'Outfit_700Bold',
    color: TEXT,
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  stepSubtext: {
    fontSize: 14,
    fontFamily: 'Outfit_400Regular',
    color: TEXT2,
    lineHeight: 22,
  },
  nameInput: {
    height: 56,
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: BORDER,
    paddingHorizontal: 18,
    fontSize: 18,
    fontFamily: 'Outfit_500Medium',
    color: TEXT,
  },
  birthdayPickerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  birthdayRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  birthdayCol: {
    alignItems: 'center',
    gap: 8,
  },
  birthdayColLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_600SemiBold',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1.5,
  },
  birthdayPreview: {
    fontSize: 17,
    fontFamily: 'Outfit_600SemiBold',
    color: ACCENT,
    letterSpacing: 0.3,
  },
  pickerCenteredWrap: {
    alignItems: 'center',
    gap: 16,
    flex: 1,
    justifyContent: 'center',
  },
  pickerContainer: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  pickerLabel: {
    fontSize: 16,
    fontFamily: 'Outfit_600SemiBold',
    color: ACCENT,
  },
  dualPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    flex: 1,
  },
  pickerCol: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  pickerColLabel: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
    color: TEXT2,
    letterSpacing: 0.5,
  },
  pickerSep: {
    fontSize: 24,
    color: TEXT2,
  },
  unitToggle: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  unitBtn: {
    paddingHorizontal: 28,
    paddingVertical: 10,
  },
  unitBtnActive: {
    backgroundColor: ACCENT,
  },
  unitBtnText: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
    color: TEXT2,
  },
  unitBtnTextActive: {
    color: '#fff',
  },
  cardList: {
    gap: 10,
  },
  selectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: BORDER,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 12,
  },
  selectCardTall: {
    paddingVertical: 18,
  },
  selectCardRow: {
    paddingVertical: 14,
  },
  selectCardActive: {
    borderColor: ACCENT,
    backgroundColor: ACCENT + '12',
  },
  selectCardDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ACCENT,
  },
  selectCardDotRight: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ACCENT,
    marginLeft: 'auto',
  },
  selectCardLabel: {
    fontSize: 16,
    fontFamily: 'Outfit_600SemiBold',
    color: TEXT,
  },
  selectCardLabelActive: {
    color: ACCENT,
  },
  selectCardDesc: {
    fontSize: 13,
    fontFamily: 'Outfit_400Regular',
    color: TEXT2,
    marginTop: 2,
  },
  selectCardTextCol: {
    flex: 1,
    gap: 2,
  },
  goalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  goalCard: {
    width: (SW - 48 - 10) / 2,
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: BORDER,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 10,
  },
  goalCardActive: {
    borderColor: ACCENT,
    backgroundColor: ACCENT + '12',
  },
  goalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalIconWrapActive: {
    backgroundColor: ACCENT + '20',
  },
  goalLabel: {
    fontSize: 13,
    fontFamily: 'Outfit_600SemiBold',
    color: TEXT,
    textAlign: 'center',
  },
  goalLabelActive: {
    color: ACCENT,
  },
  styleScrollView: {
    flex: 1,
  },
  styleList: {
    gap: 8,
    paddingBottom: 16,
  },
  styleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  styleColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  styleTextCol: {
    flex: 1,
    gap: 2,
  },
  styleLabel: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
    color: TEXT,
  },
  styleDesc: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
    color: TEXT2,
  },
  styleCheck: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  equipIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  permissionIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  permissionIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: ACCENT + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionBtnBlock: {
    gap: 16,
    alignItems: 'center',
    paddingBottom: 8,
  },
  permissionBtn: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  permissionBtnGradient: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionBtnText: {
    fontSize: 17,
    fontFamily: 'Outfit_700Bold',
    color: '#fff',
  },
  skipLink: {
    fontSize: 16,
    fontFamily: 'Outfit_600SemiBold',
    color: 'rgba(255,255,255,0.5)',
  },
  homeEquipFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  skipEquipBtn: {
    flex: 1,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  homeEquipCat: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 8,
    overflow: 'hidden',
  },
  homeEquipCatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  homeEquipCatName: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
    color: TEXT,
  },
  homeEquipItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  homeEquipItemName: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Outfit_400Regular',
    color: TEXT2,
  },
  homeEquipCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    paddingTop: 12,
  },
  continueBtn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  continueBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  continueGradient: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueText: {
    fontSize: 17,
    fontFamily: 'Outfit_700Bold',
    color: '#fff',
    letterSpacing: 0.3,
  },
  generatingContainer: {
    flex: 1,
    backgroundColor: BG,
  },
  generatingContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingHorizontal: 32,
  },
  generatingTitle: {
    fontSize: 22,
    fontFamily: 'Outfit_700Bold',
    color: TEXT,
    textAlign: 'center',
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  generatingSubtext: {
    fontSize: 14,
    fontFamily: 'Outfit_400Regular',
    color: TEXT2,
    textAlign: 'center',
  },
  componentList: {
    gap: 10,
    paddingBottom: 16,
  },
  componentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  componentIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  componentTextCol: {
    flex: 1,
    gap: 3,
  },
  componentLabel: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
    color: 'rgba(255,255,255,0.7)',
  },
  componentDesc: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
    color: TEXT2,
    lineHeight: 17,
  },
  componentRight: {
    alignItems: 'flex-end',
    gap: 6,
    flexShrink: 0,
  },
  componentTime: {
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.3,
  },
  componentCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
