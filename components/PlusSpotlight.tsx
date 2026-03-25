import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Modal,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sparkles, Plus, ArrowRight, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useZealTheme } from '@/context/AppContext';
import { getContrastTextColor } from '@/constants/colors';

interface Props {
  visible: boolean;
  onStartPlan: () => void;
  onDismiss: () => void;
}

const { width } = Dimensions.get('window');

export default function PlusSpotlight({ visible, onStartPlan, onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  const { accent, isDark } = useZealTheme();

  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(30)).current;
  const cardFade = useRef(new Animated.Value(0)).current;
  const overlayFade = useRef(new Animated.Value(0)).current;
  const plusPulse = useRef(new Animated.Value(1)).current;

  const dockBottom = insets.bottom > 0 ? insets.bottom : 16;
  const plusBtnBottom = dockBottom + 8;
  const buttonSize = 80;

  const pulseRing = (anim: Animated.Value, delay: number) => {
    return Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
  };

  useEffect(() => {
    if (!visible) {
      ring1.setValue(0);
      ring2.setValue(0);
      ring3.setValue(0);
      cardSlide.setValue(30);
      cardFade.setValue(0);
      overlayFade.setValue(0);
      plusPulse.setValue(1);
      return;
    }

    Animated.timing(overlayFade, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();

    Animated.parallel([
      Animated.spring(cardSlide, {
        toValue: 0,
        tension: 60,
        friction: 10,
        delay: 300,
        useNativeDriver: true,
      }),
      Animated.timing(cardFade, {
        toValue: 1,
        duration: 350,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(plusPulse, { toValue: 1.08, duration: 700, useNativeDriver: true }),
        Animated.timing(plusPulse, { toValue: 0.97, duration: 700, useNativeDriver: true }),
      ])
    ).start();

    const r1 = pulseRing(ring1, 0);
    const r2 = pulseRing(ring2, 500);
    const r3 = pulseRing(ring3, 1000);
    r1.start();
    r2.start();
    r3.start();

    return () => {
      r1.stop();
      r2.stop();
      r3.stop();
    };
  }, [visible]);

  const ringStyle = (anim: Animated.Value) => ({
    position: 'absolute' as const,
    width: buttonSize + 20,
    height: buttonSize + 20,
    borderRadius: (buttonSize + 20) / 2,
    borderWidth: 2,
    borderColor: accent,
    opacity: anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.6, 0] }),
    transform: [
      {
        scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }),
      },
    ],
  });

  const tooltipBottom = plusBtnBottom + buttonSize + 24;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <Animated.View style={[styles.overlay, { opacity: overlayFade }]}>
        <View style={styles.overlayDark} />

        <View
          style={[
            styles.spotlightCircle,
            {
              bottom: plusBtnBottom,
              width: buttonSize + 40,
              height: buttonSize + 40,
              borderRadius: (buttonSize + 40) / 2,
              backgroundColor: `${accent}10`,
            },
          ]}
        >
          <Animated.View style={ringStyle(ring1)} />
          <Animated.View style={ringStyle(ring2)} />
          <Animated.View style={ringStyle(ring3)} />

          <Animated.View style={{ transform: [{ scale: plusPulse }] }}>
            <View
              style={[
                styles.plusBtn,
                {
                  backgroundColor: accent,
                  shadowColor: accent,
                  width: buttonSize,
                  height: buttonSize,
                  borderRadius: buttonSize / 2,
                },
              ]}
            >
              <Plus size={40} color={getContrastTextColor(accent)} strokeWidth={2.5} />
            </View>
          </Animated.View>
        </View>

        <View style={[styles.arrowContainer, { bottom: plusBtnBottom + buttonSize + 4 }]}>
          <Text style={[styles.arrow, { color: `${accent}80` }]}>▼</Text>
        </View>

        <Animated.View
          style={[
            styles.tooltip,
            {
              bottom: tooltipBottom,
              opacity: cardFade,
              transform: [{ translateY: cardSlide }],
            },
          ]}
        >
          <LinearGradient
            colors={isDark ? ['#1e1e1e', '#161616'] : ['#ffffff', '#f5f5f5']}
            style={styles.tooltipGradient}
          >
            <TouchableOpacity
              style={styles.dismissBtn}
              onPress={onDismiss}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={16} color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)'} />
            </TouchableOpacity>

            <View style={styles.tooltipIconRow}>
              <View style={[styles.tooltipIconBg, { backgroundColor: `${accent}18` }]}>
                <Sparkles size={22} color={accent} strokeWidth={1.8} />
              </View>
            </View>

            <Text style={[styles.tooltipTitle, { color: isDark ? '#fff' : '#111' }]}>
              Ready for a workout plan?
            </Text>
            <Text style={[styles.tooltipBody, { color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)' }]}>
              Tap the{' '}
              <Text style={{ color: accent, fontFamily: 'Outfit_700Bold' }}>+</Text>
              {' '}button anytime to build a structured plan around your goals.
            </Text>

            <View style={styles.tooltipActions}>
              <TouchableOpacity
                style={[styles.startBtn, { backgroundColor: accent, shadowColor: accent }]}
                onPress={onStartPlan}
                activeOpacity={0.85}
              >
                <Text style={[styles.startBtnText, { color: getContrastTextColor(accent) }]}>
                  Start a Plan
                </Text>
                <ArrowRight size={16} color={getContrastTextColor(accent)} strokeWidth={2.5} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.laterBtn, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}
                onPress={onDismiss}
                activeOpacity={0.7}
              >
                <Text style={[styles.laterBtnText, { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)' }]}>
                  Maybe Later
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
  },
  overlayDark: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  spotlightCircle: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 20,
    elevation: 16,
  },
  arrowContainer: {
    position: 'absolute',
    alignSelf: 'center',
  },
  arrow: {
    fontSize: 18,
  },
  tooltip: {
    position: 'absolute',
    left: 24,
    right: 24,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 20,
  },
  tooltipGradient: {
    padding: 24,
    paddingTop: 22,
    gap: 12,
  },
  dismissBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tooltipIconRow: {
    alignItems: 'flex-start',
  },
  tooltipIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tooltipTitle: {
    fontSize: 22,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.4,
  },
  tooltipBody: {
    fontSize: 15,
    fontFamily: 'Outfit_400Regular',
    lineHeight: 22,
  },
  tooltipActions: {
    gap: 10,
    marginTop: 4,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  startBtnText: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.2,
  },
  laterBtn: {
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
  },
  laterBtnText: {
    fontSize: 14,
    fontFamily: 'Outfit_500Medium',
  },
});
