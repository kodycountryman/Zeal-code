import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { useZealTheme } from '@/context/AppContext';
import WheelPicker from '@/components/WheelPicker';
import PanDownHandle from '@/components/PanDownHandle';

const { width: SCREEN_W } = Dimensions.get('window');

const DEMO_WEIGHT = [85, 90, 95, 100, 105, 110, 115];
const DEMO_REPS = [6, 8, 10, 12, 15];

interface Props {
  visible: boolean;
  onDismiss: () => void;
  accentColor?: string;
}

const STEPS = [
  {
    icon: '↕',
    label: 'Scroll to dial',
    text: 'Flick each wheel up or down to land on your target value',
  },
  {
    icon: '✓',
    label: 'Mark the set',
    text: 'Tap the small ✓ Done on a row once you finish that set',
  },
  {
    icon: '+',
    label: 'Add more sets',
    text: 'Use + Add Set if you want to do extra sets',
  },
  {
    icon: '●',
    label: 'Finish the exercise',
    text: 'Hit the orange Done button when all sets are complete',
  },
];

export default function WheelGuideModal({ visible, onDismiss, accentColor = '#f87116' }: Props) {
  const { colors, isDark } = useZealTheme();

  const slideAnim = useRef(new Animated.Value(700)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const bounceLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 20,
          stiffness: 220,
          mass: 0.9,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();

      bounceLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(bounceAnim, {
            toValue: 9,
            duration: 280,
            useNativeDriver: true,
          }),
          Animated.timing(bounceAnim, {
            toValue: -9,
            duration: 280,
            useNativeDriver: true,
          }),
        ])
      );
      bounceLoopRef.current.start();
    } else {
      bounceLoopRef.current?.stop();
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 700,
          duration: 230,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
    return () => {
      bounceLoopRef.current?.stop();
    };
  }, [visible, slideAnim, backdropAnim, bounceAnim]);

  const wheelBg = isDark ? '#1e1e1e' : '#e8e8e8';
  const wheelText = isDark ? '#ffffff' : '#111111';
  const wheelMuted = isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.25)';
  const cardBg = isDark ? '#1c1c1c' : '#f7f7f7';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <Animated.View
        style={[styles.backdrop, { opacity: backdropAnim }]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          onPress={onDismiss}
          activeOpacity={1}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: colors.card, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <PanDownHandle onDismiss={onDismiss} indicatorColor={colors.border} />

        <Text style={[styles.title, { color: colors.text }]}>How to log sets</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Scroll the rolodex wheels to dial in weight & reps for each set
        </Text>

        <View style={[styles.demoCard, { backgroundColor: cardBg }]}>
          <View style={styles.demoInner}>
            <View style={styles.demoWheelCol}>
              <Text style={[styles.demoWheelLabel, { color: colors.textMuted }]}>WEIGHT</Text>
              <WheelPicker
                values={DEMO_WEIGHT}
                selectedValue={100}
                onValueChange={() => {}}
                width={96}
                visibleItems={3}
                textColor={wheelText}
                mutedColor={wheelMuted}
                accentColor={accentColor}
                bgColor={wheelBg}
              />
              <Text style={[styles.demoWheelUnit, { color: colors.textMuted }]}>lb</Text>
            </View>

            <Animated.View
              style={[styles.scrollHint, { transform: [{ translateY: bounceAnim }] }]}
            >
              <Text style={[styles.scrollArrowText, { color: accentColor }]}>↕</Text>
              <Text style={[styles.scrollLabelText, { color: accentColor }]}>scroll</Text>
            </Animated.View>

            <View style={styles.demoWheelCol}>
              <Text style={[styles.demoWheelLabel, { color: colors.textMuted }]}>REPS</Text>
              <WheelPicker
                values={DEMO_REPS}
                selectedValue={10}
                onValueChange={() => {}}
                width={72}
                visibleItems={3}
                textColor={wheelText}
                mutedColor={wheelMuted}
                accentColor={accentColor}
                bgColor={wheelBg}
              />
              <Text style={[styles.demoWheelUnit, { color: colors.textMuted }]}>reps</Text>
            </View>
          </View>

          <View style={[styles.demoDivider, { backgroundColor: colors.border }]} />

          <View style={[styles.demoRow, { borderColor: `${colors.border}50` }]}>
            <View style={[styles.demoSetBadge, { backgroundColor: `${accentColor}20` }]}>
              <Text style={[styles.demoSetNum, { color: accentColor }]}>1</Text>
            </View>
            <Text style={[styles.demoSetText, { color: colors.textSecondary }]}>100 lb × 10 reps</Text>
            <View style={[styles.demoDoneBtn, { borderColor: `${accentColor}55`, backgroundColor: `${accentColor}15` }]}>
              <Text style={[styles.demoDoneBtnText, { color: accentColor }]}>✓ Done</Text>
            </View>
          </View>
        </View>

        <View style={styles.stepsWrap}>
          {STEPS.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={[styles.stepIconWrap, { backgroundColor: `${accentColor}18` }]}>
                <Text style={[styles.stepIconText, { color: accentColor }]}>{step.icon}</Text>
              </View>
              <View style={styles.stepTextWrap}>
                <Text style={[styles.stepLabel, { color: colors.text }]}>{step.label}</Text>
                <Text style={[styles.stepBody, { color: colors.textSecondary }]}>{step.text}</Text>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.ctaBtn, { backgroundColor: accentColor }]}
          onPress={onDismiss}
          activeOpacity={0.84}
        >
          <Text style={styles.ctaBtnText}>Got it, let&apos;s go!</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 44,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 22,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    letterSpacing: -0.1,
  },
  demoCard: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 20,
  },
  demoInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  demoWheelCol: {
    alignItems: 'center',
    gap: 6,
  },
  demoWheelLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    letterSpacing: 1,
  },
  demoWheelUnit: {
    fontSize: 10,
    fontWeight: '500' as const,
    letterSpacing: 0.3,
  },
  scrollHint: {
    alignItems: 'center',
    gap: 2,
  },
  scrollArrowText: {
    fontSize: 24,
    fontWeight: '700' as const,
  },
  scrollLabelText: {
    fontSize: 9,
    fontWeight: '600' as const,
    letterSpacing: 0.6,
  },
  demoDivider: {
    height: 1,
    marginHorizontal: 16,
    opacity: 0.4,
  },
  demoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  demoSetBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoSetNum: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  demoSetText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500' as const,
  },
  demoDoneBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  demoDoneBtnText: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
  stepsWrap: {
    gap: 12,
    marginBottom: 24,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepIconText: {
    fontSize: 15,
    fontWeight: '800' as const,
  },
  stepTextWrap: {
    flex: 1,
    gap: 1,
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: '700' as const,
    letterSpacing: -0.1,
  },
  stepBody: {
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: -0.1,
  },
  ctaBtn: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaBtnText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.2,
  },
});
