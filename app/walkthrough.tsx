import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import WalkthroughPage from '@/components/walkthrough/WalkthroughPage';
import type { AppIconName } from '@/constants/iconMap';
import { setWalkthroughPromptState } from '@/services/walkthroughPrompt';

const { width: SW } = Dimensions.get('window');
const ACCENT = '#f87116';
const BG = '#0e0e0e';

interface Page {
  icon: AppIconName;
  iconAccent: string;
  title: string;
  body: string;
}

const PAGES: Page[] = [
  {
    icon: 'zap',
    iconAccent: ACCENT,
    title: 'Welcome to Zeal+',
    body: 'A training studio in your pocket — workouts and runs that adapt to you, day by day.',
  },
  {
    icon: 'dumbbell',
    iconAccent: '#3b82f6',
    title: 'Today\'s Workout',
    body: 'Open Train and your session is already built — sets, reps, rest, all dialed in.',
  },
  {
    icon: 'calendar',
    iconAccent: '#22c55e',
    title: 'Workout & Running Plans',
    body: 'Run a workout plan and a running plan side by side. Hybrid days mix both into one session.',
  },
  {
    icon: 'figure-run',
    iconAccent: '#06b6d4',
    title: 'Outdoor Runs',
    body: 'Track every step with GPS, real-time pace, splits, and a route that keeps drawing — even when your screen is locked.',
  },
  {
    icon: 'trending-up',
    iconAccent: '#8b5cf6',
    title: 'Streaks & 75 Hard',
    body: 'Build streaks that stick. Tackle 75 Hard with the full checklist: workouts, water, reading, photo.',
  },
  {
    icon: 'user',
    iconAccent: '#ec4899',
    title: 'Your Profile, Your Pace',
    body: 'Tweak your goals, themes, and equipment in Settings. Replay this walkthrough anytime.',
  },
  {
    icon: 'party-popper',
    iconAccent: '#22c55e',
    title: 'You\'re Ready',
    body: 'That\'s the tour. Let\'s go build something great.',
  },
];

export default function WalkthroughScreen() {
  const router = useRouter();
  const listRef = useRef<FlatList<Page>>(null);
  const [page, setPage] = useState(0);

  const isLastPage = page === PAGES.length - 1;

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SW);
    if (idx !== page) {
      setPage(idx);
      void Haptics.selectionAsync().catch(() => {});
    }
  }, [page]);

  const goToPage = useCallback((idx: number) => {
    listRef.current?.scrollToOffset({ offset: idx * SW, animated: true });
    setPage(idx);
  }, []);

  const handleNext = useCallback(() => {
    if (isLastPage) {
      void setWalkthroughPromptState('completed');
      router.back();
    } else {
      goToPage(page + 1);
    }
  }, [isLastPage, page, goToPage, router]);

  const handleSkip = useCallback(() => {
    void setWalkthroughPromptState('completed');
    router.back();
  }, [router]);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#1a0a00', '#0e0e0e', '#0e0e0e']}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Skip button */}
        <View style={styles.topBar}>
          {!isLastPage ? (
            <TouchableOpacity onPress={handleSkip} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}
        </View>

        {/* Pager */}
        <FlatList
          ref={listRef}
          data={PAGES}
          keyExtractor={(_, i) => `wt-${i}`}
          renderItem={({ item }) => (
            <WalkthroughPage
              icon={item.icon}
              iconAccent={item.iconAccent}
              title={item.title}
              body={item.body}
            />
          )}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          style={styles.pager}
        />

        {/* Dots + CTA */}
        <View style={styles.bottomBlock}>
          <View style={styles.dots}>
            {PAGES.map((_, i) => (
              <View
                key={`dot-${i}`}
                style={[
                  styles.dot,
                  i === page && styles.dotActive,
                ]}
              />
            ))}
          </View>

          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={handleNext}
            activeOpacity={0.88}
            testID="walkthrough-cta"
          >
            <LinearGradient
              colors={['#ff8c35', '#f87116', '#d96010']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              <Text style={styles.ctaText}>{isLastPage ? 'Get Started' : 'Next'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  safe: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 8,
    height: 36,
  },
  skipText: {
    fontSize: 15,
    fontFamily: 'Outfit_500Medium',
    color: 'rgba(255,255,255,0.55)',
  },
  pager: {
    flex: 1,
  },
  bottomBlock: {
    paddingHorizontal: 28,
    paddingBottom: 8,
    gap: 24,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  dotActive: {
    width: 22,
    backgroundColor: ACCENT,
  },
  ctaBtn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  ctaGradient: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontSize: 17,
    fontFamily: 'Outfit_700Bold',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
});
