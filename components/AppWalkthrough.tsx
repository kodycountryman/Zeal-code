import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, X, Home, Zap, BarChart2, TrendingUp } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { LucideIcon } from 'lucide-react-native';

const { width } = Dimensions.get('window');
const ACCENT = '#f87116';

interface SlideIcon {
  Icon: LucideIcon;
  color: string;
}

const SLIDES: {
  step: number;
  title: string;
  body: string;
  accentColor: string;
  iconInfo: SlideIcon;
  bgColors: [string, string];
}[] = [
  {
    step: 1,
    title: 'Your Home',
    body: 'Your daily training score, streak, and generated workout — all in one place.',
    accentColor: '#f87116',
    iconInfo: { Icon: Home, color: '#f87116' },
    bgColors: ['#1a0a00', '#141414'],
  },
  {
    step: 2,
    title: 'Generate Workouts',
    body: 'Tap generate for a session built around your goals, equipment, and time.',
    accentColor: '#22c55e',
    iconInfo: { Icon: Zap, color: '#22c55e' },
    bgColors: ['#001a08', '#141414'],
  },
  {
    step: 3,
    title: 'Track in Real Time',
    body: 'Log sets, rest between them, and watch your training score build.',
    accentColor: '#3b82f6',
    iconInfo: { Icon: BarChart2, color: '#3b82f6' },
    bgColors: ['#000a1a', '#141414'],
  },
  {
    step: 4,
    title: 'See Your Progress',
    body: 'Your radar chart and insights update after every session.',
    accentColor: '#a855f7',
    iconInfo: { Icon: TrendingUp, color: '#a855f7' },
    bgColors: ['#10001a', '#141414'],
  },
];

interface Props {
  visible: boolean;
  onDone: () => void;
  showCloseButton?: boolean;
}

export default function AppWalkthrough({ visible, onDone, showCloseButton = false }: Props) {
  const [slide, setSlide] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const goToSlide = (next: number) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setSlide(next);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleNext = () => {
    if (slide < SLIDES.length - 1) {
      goToSlide(slide + 1);
    } else {
      setSlide(0);
      onDone();
    }
  };

  const handleClose = () => {
    setSlide(0);
    onDone();
  };

  const current = SLIDES[slide];
  const isLast = slide === SLIDES.length - 1;
  const { Icon, color: iconColor } = current.iconInfo;

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <View style={styles.root}>
        <LinearGradient
          colors={current.bgColors}
          style={StyleSheet.absoluteFill}
        />

        <SafeAreaView style={styles.safe}>
          <View style={styles.header}>
            <View style={styles.dots}>
              {SLIDES.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i === slide
                      ? { backgroundColor: current.accentColor, width: 20 }
                      : { backgroundColor: 'rgba(255,255,255,0.2)', width: 6 },
                  ]}
                />
              ))}
            </View>
            {showCloseButton && (
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={handleClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            )}
          </View>

          <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
            <View style={[styles.iconBlock, { backgroundColor: `${iconColor}14`, borderColor: `${iconColor}28` }]}>
              <Icon size={52} color={iconColor} strokeWidth={1.8} />
            </View>

            <View style={styles.textBlock}>
              <Text style={[styles.stepLabel, { color: current.accentColor }]}>
                {slide + 1} of {SLIDES.length}
              </Text>
              <Text style={styles.title}>{current.title}</Text>
              <Text style={styles.body}>{current.body}</Text>
            </View>
          </Animated.View>

          <View style={styles.footer}>
            {!isLast && (
              <TouchableOpacity
                style={styles.skipBtn}
                onPress={handleClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.skipText}>Skip</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.nextBtn, isLast && styles.nextBtnFull]}
              onPress={handleNext}
              activeOpacity={0.85}
              testID="walkthrough-next"
            >
              <LinearGradient
                colors={[`${current.accentColor}cc`, current.accentColor, `${current.accentColor}dd`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.nextGradient}
              >
                <Text style={styles.nextText}>
                  {isLast ? "Let's Go" : 'Next'}
                </Text>
                {!isLast && (
                  <ChevronRight size={18} color="#fff" strokeWidth={2.5} style={{ marginLeft: 4 }} />
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#141414',
  },
  safe: {
    flex: 1,
    paddingHorizontal: 28,
    paddingBottom: 16,
  },
  header: {
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 40,
  },
  iconBlock: {
    width: 120,
    height: 120,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 8,
  },
  stepLabel: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Outfit_700Bold',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  body: {
    fontSize: 16,
    fontFamily: 'Outfit_400Regular',
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  skipBtn: {
    paddingHorizontal: 16,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    fontSize: 15,
    fontFamily: 'Outfit_500Medium',
    color: 'rgba(255,255,255,0.4)',
  },
  nextBtn: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  nextBtnFull: {
    flex: 1,
  },
  nextGradient: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: {
    fontSize: 17,
    fontFamily: 'Outfit_700Bold',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
});
