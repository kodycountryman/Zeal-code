import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Reanimated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { PlatformIcon } from '@/components/PlatformIcon';
import type { AppIconName } from '@/constants/iconMap';
import { useSubscription, PaywallVersion } from '@/context/SubscriptionContext';
import { PRO_GOLD } from '@/services/proGate';
import { SWIFT_REANIMATED_SPRING } from '@/constants/animation';

const ORANGE = '#f87116';
const BG = '#0c0c0f';
const CARD_BG = '#161619';
const BORDER = '#242428';
const TEXT = '#f0f0f0';
const TEXT_SEC = '#888';
const GOLD = PRO_GOLD;

const PRO_FEATURES: { icon: AppIconName; label: string; sub: string }[] = [
  { icon: 'dumbbell', label: 'All 8 Workout Styles', sub: 'Bodybuilding, CrossFit, HIIT, Hyrox & more' },
  { icon: 'calendar-range', label: 'Full Plan Builder', sub: 'Long-term advanced programming' },
  { icon: 'bar-chart-3', label: 'Full Insights & Radar Chart', sub: 'Deep analytics, unlimited history' },
  { icon: 'zap', label: 'Progressive Overload', sub: 'Advanced load & volume tracking' },
  { icon: 'layers', label: 'Supersets & Circuits', sub: 'Advanced workout structures' },
  { icon: 'heart', label: 'Apple Health Sync', sub: 'Connect workouts to Health app' },
  { icon: 'target', label: 'Equipment Customization', sub: 'Tailor workouts to your gear' },
  { icon: 'bookmark', label: 'Unlimited Saved Workouts', sub: 'Save and organize custom workouts' },
  { icon: 'award', label: 'Achievements & Milestones', sub: 'Track your long-term wins' },
  { icon: 'thumbs-up', label: 'Exercise Preferences', sub: 'Like/dislike for smarter workouts' },
];

const CORE_ITEMS = [
  { label: 'Strength + Cardio styles' },
  { label: 'Basic set/rep tracking' },
  { label: '7-day workout history' },
  { label: 'Streak tracking' },
  { label: 'Basic training score' },
  { label: '1 saved workout' },
  { label: 'Daily Bible verse' },
];

const PRO_ITEMS = [
  { label: 'All 8 workout styles' },
  { label: 'Full plan builder' },
  { label: 'Unlimited workout history' },
  { label: 'Full insights + radar chart' },
  { label: 'Progressive overload' },
  { label: 'Supersets & circuits' },
  { label: 'Apple Health sync' },
  { label: 'Equipment customization' },
  { label: 'Unlimited saved workouts' },
  { label: 'Achievements & milestones' },
  { label: 'Full About Me profile' },
  { label: 'Exercise preferences' },
];

interface Props {
  visible: boolean;
  version: PaywallVersion;
  onClose: () => void;
  onPurchase: () => void;
  onRestore: () => void;
  isPurchasing: boolean;
  isRestoring: boolean;
  purchaseError: string | null;
  restoreError: string | null;
}

export default function PaywallModal({
  visible,
  version,
  onClose,
  onPurchase,
  onRestore,
  isPurchasing,
  isRestoring,
  purchaseError,
  restoreError,
}: Props) {
  const scaleAnim = useRef(new Animated.Value(0.94)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const crownRotate = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0.7)).current;
  const glowLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const crownLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const ctaScale = useSharedValue(1);
  const ctaAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: ctaScale.value }] }));

  const isTrial = version === 'trial';

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 80,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();

      glowLoopRef.current?.stop();
      glowLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(glowPulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
          Animated.timing(glowPulse, { toValue: 0.7, duration: 1000, useNativeDriver: true }),
        ])
      );
      glowLoopRef.current.start();

      crownLoopRef.current?.stop();
      crownLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(crownRotate, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(crownRotate, { toValue: -1, duration: 1200, useNativeDriver: true }),
          Animated.timing(crownRotate, { toValue: 0, duration: 800, useNativeDriver: true }),
        ])
      );
      crownLoopRef.current.start();
    } else {
      scaleAnim.setValue(0.94);
      opacityAnim.setValue(0);
      glowLoopRef.current?.stop();
      glowLoopRef.current = null;
      crownLoopRef.current?.stop();
      crownLoopRef.current = null;
    }
  }, [visible]);

  const crownDeg = crownRotate.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-6deg', '0deg', '6deg'],
  });

  useEffect(() => {
    if (purchaseError) {
      Alert.alert('Purchase Failed', purchaseError);
    }
  }, [purchaseError]);

  useEffect(() => {
    if (restoreError) {
      Alert.alert('Restore Failed', restoreError);
    }
  }, [restoreError]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
      testID="paywall-modal"
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.container,
            { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
          ]}
        >
          <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
              testID="paywall-close"
            >
              <PlatformIcon name="x" size={18} color="#666" strokeWidth={2.5} />
            </TouchableOpacity>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <View style={styles.heroSection}>
                <View style={styles.crownContainer}>
                  <Animated.View
                    style={[
                      styles.glowRing,
                      {
                        opacity: glowPulse,
                        transform: [{ scale: glowPulse }],
                      },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.crownIconWrap,
                      { transform: [{ rotate: crownDeg }] },
                    ]}
                  >
                    <PlatformIcon name="crown" size={40} color={GOLD} strokeWidth={1.5} />
                  </Animated.View>
                </View>

                <Text style={styles.wordmark}>zeal</Text>
                <Text style={styles.proLabel}>PRO</Text>

                {isTrial ? (
                  <View style={styles.contractBadge}>
                    <Text style={styles.contractBadgeText}>7-DAY FREE TRIAL</Text>
                  </View>
                ) : (
                  <View style={[styles.contractBadge, styles.contractBadgeAlt]}>
                    <Text style={[styles.contractBadgeText, { color: 'rgba(255,255,255,0.9)' }]}>UPGRADE YOUR TRAINING</Text>
                  </View>
                )}

                <Text style={styles.heroDesc}>
                  {isTrial
                    ? "Try everything free for 7 days. No charge until Day 8 — cancel anytime."
                    : 'Unlock the full Zeal experience. Advanced workouts, full analytics, unlimited programming.'}
                </Text>
              </View>

              <View style={styles.featureList}>
                {PRO_FEATURES.map((feat, i) => (
                  <View key={feat.label}>
                    {i > 0 && <View style={styles.featureDivider} />}
                    <View style={styles.featureRow}>
                      <View style={styles.featureIconWrap}>
                        <PlatformIcon name={feat.icon} size={17} color="rgba(255,255,255,0.85)" strokeWidth={2} />
                      </View>
                      <View style={styles.featureText}>
                        <Text style={styles.featureLabel}>{feat.label}</Text>
                        <Text style={styles.featureSub}>{feat.sub}</Text>
                      </View>
                      <PlatformIcon name="check" size={16} color="rgba(255,255,255,0.45)" strokeWidth={2.5} />
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.priceCard}>
                {/* Inner glow overlay */}
                <View style={styles.priceCardInnerGlow} pointerEvents="none" />

                <View style={styles.priceRow}>
                  <View>
                    <Text style={styles.priceAmount}>$5.99</Text>
                    <Text style={styles.pricePer}>PER MONTH</Text>
                  </View>
                  {isTrial && (
                    <View style={styles.trialPill}>
                      <Text style={styles.trialPillText}>First 7 days FREE</Text>
                    </View>
                  )}
                </View>
                <View style={styles.priceDivider} />
                <View style={styles.priceDetails}>
                  {isTrial ? (
                    <>
                      <View style={styles.priceDetailRow}><PlatformIcon name="check" size={13} color="rgba(255,255,255,0.45)" strokeWidth={2.5} /><Text style={styles.priceDetailLine}>No charge until Day 8</Text></View>
                      <View style={styles.priceDetailRow}><PlatformIcon name="check" size={13} color="rgba(255,255,255,0.45)" strokeWidth={2.5} /><Text style={styles.priceDetailLine}>Cancel within 7 days — pay nothing</Text></View>
                      <View style={styles.priceDetailRow}><PlatformIcon name="check" size={13} color="rgba(255,255,255,0.45)" strokeWidth={2.5} /><Text style={styles.priceDetailLine}>$5.99/mo after your free trial ends</Text></View>
                    </>
                  ) : (
                    <>
                      <View style={styles.priceDetailRow}><PlatformIcon name="check" size={13} color="rgba(255,255,255,0.45)" strokeWidth={2.5} /><Text style={styles.priceDetailLine}>Billed monthly · Cancel anytime</Text></View>
                      <View style={styles.priceDetailRow}><PlatformIcon name="check" size={13} color="rgba(255,255,255,0.45)" strokeWidth={2.5} /><Text style={styles.priceDetailLine}>Instant access to all Pro features</Text></View>
                    </>
                  )}
                </View>
              </View>

              <View style={styles.compareSection}>
                <Text style={styles.compareTitle}>CORE VS PRO</Text>
                <View style={styles.compareRow}>
                  <View style={[styles.compareCol, styles.coreCol]}>
                    <View style={[styles.compareColHeader, styles.coreColHeader]}>
                      <Text style={styles.coreColTitle}>Zeal Core</Text>
                      <Text style={styles.coreColSubtitle}>Free forever</Text>
                    </View>
                    {CORE_ITEMS.map((item) => (
                      <View key={item.label} style={styles.compareItem}>
                        <PlatformIcon name="check" size={12} color="rgba(255,255,255,0.2)" strokeWidth={2.5} />
                        <Text style={styles.coreItemText}>{item.label}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={[styles.compareCol, styles.proCol]}>
                    <View style={[styles.compareColHeader, styles.proColHeader]}>
                      <Text style={styles.proColTitle}>Zeal Pro ✦</Text>
                      <Text style={styles.proColSubtitle}>$5.99/mo</Text>
                    </View>
                    <View style={styles.compareItem}>
                      <PlatformIcon name="check" size={12} color="rgba(255,255,255,0.45)" strokeWidth={2.5} />
                      <Text style={styles.proItemEverything}>Everything in Core</Text>
                    </View>
                    {PRO_ITEMS.map((item) => (
                      <View key={item.label} style={styles.compareItem}>
                        <PlatformIcon name="check" size={12} color="rgba(255,255,255,0.45)" strokeWidth={2.5} />
                        <Text style={styles.proItemText}>{item.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>

              <View style={{ height: 120 }} />
            </ScrollView>

            <View style={styles.footer}>
              <Reanimated.View style={[{ width: '100%' }, ctaAnimStyle]}>
                <TouchableOpacity
                  style={[styles.ctaBtn, isPurchasing && styles.ctaBtnLoading]}
                  onPress={onPurchase}
                  onPressIn={() => { ctaScale.value = withSpring(0.97, SWIFT_REANIMATED_SPRING); }}
                  onPressOut={() => { ctaScale.value = withSpring(1, SWIFT_REANIMATED_SPRING); }}
                  activeOpacity={1}
                  disabled={isPurchasing || isRestoring}
                  testID="paywall-cta"
                >
                  {isPurchasing ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {isTrial
                        ? <PlatformIcon name="play" size={16} color="#fff" fill="#fff" />
                        : <PlatformIcon name="lock" size={16} color="#fff" strokeWidth={2} />
                      }
                      <Text style={styles.ctaBtnText}>
                        {isTrial ? 'Start Free Trial' : 'Unlock Zeal Pro'}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </Reanimated.View>

              <TouchableOpacity
                onPress={onRestore}
                activeOpacity={0.7}
                disabled={isPurchasing || isRestoring}
                testID="paywall-restore"
                style={{ marginTop: 4 }}
              >
                {isRestoring ? (
                  <ActivityIndicator color={TEXT_SEC} size="small" />
                ) : (
                  <Text style={styles.restoreText}>Restore Purchases</Text>
                )}
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

export function ConnectedPaywallModal() {
  const {
    paywallOpen,
    paywallVersion,
    closePaywall,
    startPurchase,
    restorePurchases,
    isPurchasing,
    isRestoring,
    purchaseError,
    restoreError,
  } = useSubscription();

  return (
    <PaywallModal
      visible={paywallOpen}
      version={paywallVersion}
      onClose={closePaywall}
      onPurchase={startPurchase}
      onRestore={restorePurchases}
      isPurchasing={isPurchasing}
      isRestoring={isRestoring}
      purchaseError={purchaseError}
      restoreError={restoreError}
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  container: {
    height: '97%',
    backgroundColor: BG,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden',
  },
  safeArea: {
    flex: 1,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1e1e22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 14,
  },
  heroSection: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 24,
    gap: 10,
  },
  crownContainer: {
    width: 104,
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: GOLD,
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
  },
  crownIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1a1508',
    borderWidth: 1.5,
    borderColor: '#3a2e0a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    fontSize: 36,
    fontFamily: 'Outfit_800ExtraBold',
    fontStyle: 'italic',
    color: TEXT,
    letterSpacing: -1.5,
    marginTop: 20,
  },
  proLabel: {
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
    color: GOLD,
    letterSpacing: 6,
    marginTop: 2,
    marginBottom: 6,
  },
  contractBadge: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginTop: 16,
  },
  contractBadgeAlt: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.25)',
  },
  contractBadgeText: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 1.5,
  },
  heroDesc: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
    marginTop: 4,
  },
  featureList: {
    marginBottom: 20,
  },
  featureDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    gap: 12,
  },
  featureIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
    gap: 2,
  },
  featureLabel: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
    color: TEXT,
  },
  featureSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  priceCard: {
    backgroundColor: CARD_BG,
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 20,
    gap: 12,
    overflow: 'hidden',
  },
  priceCardInnerGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 25,
    borderWidth: 0,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceAmount: {
    fontSize: 42,
    fontFamily: 'Outfit_800ExtraBold',
    color: TEXT,
    letterSpacing: -1,
  },
  pricePer: {
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
    color: TEXT_SEC,
    letterSpacing: 1.5,
    marginTop: 2,
  },
  trialPill: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  trialPillText: {
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
    color: 'rgba(255,255,255,0.85)',
  },
  priceDivider: {
    height: 1,
    backgroundColor: BORDER,
  },
  priceDetails: {
    gap: 8,
  },
  priceDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceDetailLine: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 20,
  },
  compareSection: {
    gap: 12,
    marginBottom: 8,
  },
  compareTitle: {
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 2,
    marginBottom: 12,
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  compareCol: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  coreCol: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  proCol: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  compareColHeader: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    gap: 2,
  },
  coreColHeader: {
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  proColHeader: {
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  coreColTitle: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
    color: 'rgba(255,255,255,0.5)',
  },
  coreColSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
  },
  proColTitle: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
    color: '#ffffff',
  },
  proColSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
  },
  compareItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  coreItemText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    flex: 1,
  },
  proItemText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    flex: 1,
  },
  proItemEverything: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    flex: 1,
    fontFamily: 'Outfit_600SemiBold',
  },
  comparePlusMore: {
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
    textAlign: 'center',
    marginTop: 4,
  },
  footer: {
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 14,
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    backgroundColor: BG,
    alignItems: 'center',
  },
  ctaBtn: {
    width: '100%',
    backgroundColor: ORANGE,
    borderRadius: 26,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 6,
  },
  ctaBtnLoading: {
    opacity: 0.8,
  },
  ctaBtnText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.3,
  },
  restoreText: {
    fontSize: 13,
    color: TEXT_SEC,
    textDecorationLine: 'underline',
  },
});
