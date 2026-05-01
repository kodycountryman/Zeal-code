/**
 * ComingSoon — Reusable template for unreleased tab screens.
 *
 * Renders a full-screen glass-morphism placeholder with:
 *   - Ambient accent-tinted glow background
 *   - Pulsing glass icon tile
 *   - Playfair serif title + "Coming Soon" pill badge
 *   - Subtitle description
 *   - Feature preview cards (3 items, each icon + title + 1-line description)
 *
 * Usage:
 *   <ComingSoon
 *     MainIcon={Brain}
 *     title="AI Coach"
 *     tagline="Your pocket personal trainer"
 *     description="..."
 *     features={[{ Icon: Mic, title: '...', description: '...' }, ...]}
 *   />
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useZealTheme } from '@/context/AppContext';
import AmbientGlow from '@/components/AmbientGlow';
import ZealBackground from '@/components/ZealBackground';
import type { LucideIcon } from 'lucide-react-native';

export interface ComingSoonFeature {
  Icon: LucideIcon;
  title: string;
  description: string;
}

interface Props {
  MainIcon: LucideIcon;
  title: string;
  tagline: string;
  description: string;
  features: ComingSoonFeature[];
}

export default function ComingSoon({
  MainIcon,
  title,
  tagline,
  description,
  features,
}: Props) {
  const { colors, accent, isDark } = useZealTheme();

  // Subtle pulse on the icon tile — scale 1.0 → 1.06 → 1.0 forever.
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
        withTiming(1.0, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [pulse]);

  const iconPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  // Glow halo (opacity + scale, slightly offset phase so the glow breathes)
  const glow = useSharedValue(0.35);
  useEffect(() => {
    glow.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.35, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [glow]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
  }));

  const borderColor = colors.glass.cardBorder;
  const subtleBorder = colors.glass.borderSubtle;
  const glassBg = colors.surface.card;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ZealBackground />
      <AmbientGlow color={accent} opacity={0.05} />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* ───── Icon hero ───── */}
          <View style={styles.iconHero}>
            {/* Animated soft halo behind the tile */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.iconHalo,
                glowStyle,
                { backgroundColor: `${accent}22` },
              ]}
            />
            <Animated.View style={iconPulseStyle}>
              <View
                style={[
                  styles.iconTileOuter,
                  {
                    borderColor,
                    shadowColor: accent,
                  },
                ]}
              >
                <BlurView
                  intensity={isDark ? 62 : 36}
                  tint={isDark ? 'dark' : 'light'}
                  style={StyleSheet.absoluteFill}
                />
                <View
                  style={[styles.iconTileInner, { backgroundColor: `${accent}1A` }]}
                >
                  <MainIcon size={50} color={accent} strokeWidth={1.7} />
                </View>
                {/* Top-left glass highlight */}
                <LinearGradient
                  colors={
                    isDark
                      ? ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']
                      : ['rgba(255,255,255,0.85)', 'rgba(255,255,255,0)']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  locations={[0, 0.55]}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
              </View>
            </Animated.View>
          </View>

          {/* ───── Coming Soon badge ───── */}
          <View
            style={[
              styles.badge,
              {
                backgroundColor: `${accent}15`,
                borderColor: `${accent}40`,
              },
            ]}
          >
            <View style={[styles.badgeDot, { backgroundColor: accent }]} />
            <Text style={[styles.badgeText, { color: accent }]}>COMING SOON</Text>
          </View>

          {/* ───── Title + tagline ───── */}
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>{tagline}</Text>

          {/* ───── Description ───── */}
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {description}
          </Text>

          {/* ───── Feature preview cards ───── */}
          <View style={styles.featureList}>
            {features.map((feature, i) => {
              const FIcon = feature.Icon;
              return (
                <View
                  key={i}
                  style={[
                    styles.featureCard,
                    { borderColor, backgroundColor: glassBg },
                  ]}
                >
                  <BlurView
                    intensity={isDark ? 50 : 30}
                    tint={isDark ? 'dark' : 'light'}
                    style={StyleSheet.absoluteFill}
                  />
                  <View
                    style={[
                      styles.featureIconWrap,
                      { backgroundColor: `${accent}18`, borderColor: subtleBorder },
                    ]}
                  >
                    <FIcon size={20} color={accent} strokeWidth={2} />
                  </View>
                  <View style={styles.featureText}>
                    <Text
                      style={[styles.featureTitle, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {feature.title}
                    </Text>
                    <Text
                      style={[styles.featureDescription, { color: colors.textSecondary }]}
                      numberOfLines={2}
                    >
                      {feature.description}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* ───── Footer hint ───── */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textMuted }]}>
              We&apos;ll let you know the moment it&apos;s ready.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingTop: 40,
    paddingHorizontal: 24,
    paddingBottom: 160,
    alignItems: 'center',
  },

  // ───── Icon hero ─────
  iconHero: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  iconHalo: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  iconTileOuter: {
    width: 108,
    height: 108,
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 10,
  },
  iconTileInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ───── Badge ─────
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 18,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 1.2,
  },

  // ───── Title & copy ─────
  title: {
    fontSize: 36,
    fontFamily: 'PlayfairDisplay_700Bold',
    letterSpacing: -0.8,
    textAlign: 'center',
    marginBottom: 6,
  },
  tagline: {
    fontSize: 15,
    fontFamily: 'Outfit_500Medium',
    textAlign: 'center',
    marginBottom: 18,
    letterSpacing: 0.1,
  },
  description: {
    fontSize: 14,
    fontFamily: 'Outfit_400Regular',
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 320,
    marginBottom: 36,
  },

  // ───── Feature cards ─────
  featureList: {
    width: '100%',
    gap: 12,
    marginBottom: 32,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  featureIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
    gap: 2,
  },
  featureTitle: {
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.1,
  },
  featureDescription: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
    lineHeight: 17,
  },

  // ───── Footer ─────
  footer: {
    paddingTop: 8,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});
