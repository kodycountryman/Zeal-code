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
import { X, Crown, Check, Minus, Zap, BarChart3, Dumbbell, CalendarRange, Target, Heart, Layers, Award, ThumbsUp, Bookmark } from 'lucide-react-native';
import { useSubscription, PaywallVersion } from '@/context/SubscriptionContext';
import { PRO_GOLD } from '@/services/proGate';

const ORANGE = '#f87116';
const BG = '#0c0c0f';
const CARD_BG = '#161619';
const BORDER = '#242428';
const TEXT = '#f0f0f0';
const TEXT_SEC = '#888';
const GOLD = PRO_GOLD;

const PRO_FEATURES = [
  { icon: Dumbbell, label: 'All 8 Workout Styles', sub: 'Bodybuilding, CrossFit, HIIT, Hyrox & more' },
  { icon: CalendarRange, label: 'Full Plan Builder', sub: 'Long-term advanced programming' },
  { icon: BarChart3, label: 'Full Insights & Radar Chart', sub: 'Deep analytics, unlimited history' },
  { icon: Zap, label: 'Progressive Overload', sub: 'Advanced load & volume tracking' },
  { icon: Layers, label: 'Supersets & Circuits', sub: 'Advanced workout structures' },
  { icon: Heart, label: 'Apple Health Sync', sub: 'Connect workouts to Health app' },
  { icon: Target, label: 'Equipment Customization', sub: 'Tailor workouts to your gear' },
  { icon: Bookmark, label: 'Unlimited Saved Workouts', sub: 'Save and organize custom workouts' },
  { icon: Award, label: 'Achievements & Milestones', sub: 'Track your long-term wins' },
  { icon: ThumbsUp, label: 'Exercise Preferences', sub: 'Like/dislike for smarter workouts' },
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
}: Props) {
  const scaleAnim = useRef(new Animated.Value(0.94)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const crownRotate = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0.7)).current;

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

      Animated.loop(
        Animated.sequence([
          Animated.timing(glowPulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
          Animated.timing(glowPulse, { toValue: 0.7, duration: 1800, useNativeDriver: true }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(crownRotate, { toValue: 1, duration: 3000, useNativeDriver: true }),
          Animated.timing(crownRotate, { toValue: -1, duration: 3000, useNativeDriver: true }),
          Animated.timing(crownRotate, { toValue: 0, duration: 1500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      scaleAnim.setValue(0.94);
      opacityAnim.setValue(0);
      glowPulse.stopAnimation();
      crownRotate.stopAnimation();
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
              <X size={18} color="#666" strokeWidth={2.5} />
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
                    <Crown size={40} color={GOLD} strokeWidth={1.5} />
                  </Animated.View>
                </View>

                <Text style={styles.wordmark}>zeal</Text>
                <Text style={styles.proLabel}>PRO</Text>

                {isTrial ? (
                  <View style={styles.contractBadge}>
                    <Text style={styles.contractBadgeText}>7-DAY FREE CONTRACT</Text>
                  </View>
                ) : (
                  <View style={[styles.contractBadge, styles.contractBadgeAlt]}>
                    <Text style={[styles.contractBadgeText, { color: ORANGE }]}>UPGRADE YOUR TRAINING</Text>
                  </View>
                )}

                <Text style={styles.heroDesc}>
                  {isTrial
                    ? "Commit to 7 days of elite training. Your card is required but won't be charged until Day 8. Cancel anytime — no penalties."
                    : 'Unlock the full Zeal experience. Train smarter with advanced workouts, full analytics, and unlimited programming.'}
                </Text>
              </View>

              <View style={styles.featureList}>
                {PRO_FEATURES.map((feat) => (
                  <View key={feat.label} style={styles.featureRow}>
                    <View style={styles.featureIconWrap}>
                      <feat.icon size={16} color={ORANGE} strokeWidth={2} />
                    </View>
                    <View style={styles.featureText}>
                      <Text style={styles.featureLabel}>{feat.label}</Text>
                      <Text style={styles.featureSub}>{feat.sub}</Text>
                    </View>
                    <View style={styles.checkWrap}>
                      <Check size={14} color="#22c55e" strokeWidth={3} />
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.priceCard}>
                <View style={styles.priceRow}>
                  <View>
                    <Text style={styles.priceAmount}>$5.99</Text>
                    <Text style={styles.pricePer}>per month</Text>
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
                      <Text style={styles.priceDetailLine}>✓ No charge until Day 8</Text>
                      <Text style={styles.priceDetailLine}>✓ Cancel within 7 days — pay nothing</Text>
                      <Text style={styles.priceDetailLine}>✓ $5.99/mo after your free trial ends</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.priceDetailLine}>✓ Billed monthly · Cancel anytime</Text>
                      <Text style={styles.priceDetailLine}>✓ Instant access to all Pro features</Text>
                    </>
                  )}
                </View>
              </View>

              <View style={styles.compareSection}>
                <Text style={styles.compareTitle}>CORE VS PRO</Text>
                <View style={styles.compareRow}>
                  <View style={[styles.compareCol, styles.coreCol]}>
                    <View style={styles.compareColHeader}>
                      <Text style={styles.coreColTitle}>Zeal Core</Text>
                      <Text style={styles.coreColSubtitle}>Free forever</Text>
                    </View>
                    {CORE_ITEMS.map((item) => (
                      <View key={item.label} style={styles.compareItem}>
                        <View style={[styles.compareCheckWrap, styles.coreCheckWrap]}>
                          <Check size={10} color="#555" strokeWidth={3} />
                        </View>
                        <Text style={styles.coreItemText}>{item.label}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={[styles.compareCol, styles.proCol]}>
                    <View style={styles.compareColHeader}>
                      <Text style={styles.proColTitle}>Zeal Pro ✦</Text>
                      <Text style={styles.proColSubtitle}>$5.99/mo</Text>
                    </View>
                    <View style={styles.compareItem}>
                      <View style={[styles.compareCheckWrap, styles.proCheckWrap]}>
                        <Check size={10} color="#22c55e" strokeWidth={3} />
                      </View>
                      <Text style={styles.proItemEverything}>Everything in Core</Text>
                    </View>
                    {PRO_ITEMS.map((item) => (
                      <View key={item.label} style={styles.compareItem}>
                        <View style={[styles.compareCheckWrap, styles.proCheckWrap]}>
                          <Check size={10} color="#22c55e" strokeWidth={3} />
                        </View>
                        <Text style={styles.proItemText}>{item.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>

              </View>

              <View style={{ height: 120 }} />
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.ctaBtn, isPurchasing && styles.ctaBtnLoading]}
                onPress={onPurchase}
                activeOpacity={0.88}
                disabled={isPurchasing || isRestoring}
                testID="paywall-cta"
              >
                {isPurchasing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.ctaBtnText}>
                    {isTrial ? 'Start your free 7 days' : 'Accept the Contract'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onRestore}
                activeOpacity={0.7}
                disabled={isPurchasing || isRestoring}
                testID="paywall-restore"
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
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
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  glowRing: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: GOLD,
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
  },
  crownIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1a1508',
    borderWidth: 1.5,
    borderColor: '#3a2e0a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    fontSize: 30,
    fontFamily: 'Outfit_800ExtraBold',
    fontStyle: 'italic',
    color: TEXT,
    letterSpacing: -0.8,
  },
  proLabel: {
    fontSize: 12,
    fontFamily: 'Outfit_700Bold',
    color: GOLD,
    letterSpacing: 4,
    marginTop: -6,
  },
  contractBadge: {
    backgroundColor: '#f5c84218',
    borderWidth: 1,
    borderColor: '#f5c84240',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginTop: 4,
  },
  contractBadgeAlt: {
    backgroundColor: `${ORANGE}15`,
    borderColor: `${ORANGE}35`,
  },
  contractBadgeText: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    color: GOLD,
    letterSpacing: 1.5,
  },
  heroDesc: {
    fontSize: 14,
    color: TEXT_SEC,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 8,
    marginTop: 4,
  },
  featureList: {
    gap: 2,
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 14,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    gap: 12,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: BORDER,
  },
  featureIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: `${ORANGE}18`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
    gap: 2,
  },
  featureLabel: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
    color: TEXT,
  },
  featureSub: {
    fontSize: 11,
    color: TEXT_SEC,
  },
  checkWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#22c55e18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: `${ORANGE}30`,
    marginBottom: 20,
    gap: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceAmount: {
    fontSize: 36,
    fontFamily: 'Outfit_800ExtraBold',
    color: TEXT,
    letterSpacing: -1,
  },
  pricePer: {
    fontSize: 12,
    color: TEXT_SEC,
    marginTop: -4,
  },
  trialPill: {
    backgroundColor: '#22c55e1a',
    borderWidth: 1,
    borderColor: '#22c55e40',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  trialPillText: {
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
    color: '#22c55e',
  },
  priceDivider: {
    height: 1,
    backgroundColor: BORDER,
  },
  priceDetails: {
    gap: 6,
  },
  priceDetailLine: {
    fontSize: 13,
    color: TEXT_SEC,
    lineHeight: 19,
  },
  compareSection: {
    gap: 12,
    marginBottom: 8,
  },
  compareTitle: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    color: TEXT_SEC,
    letterSpacing: 1.5,
  },
  compareRow: {
    flexDirection: 'row',
    gap: 8,
  },
  compareCol: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  coreCol: {
    backgroundColor: '#0f0f12',
    borderColor: BORDER,
  },
  proCol: {
    backgroundColor: `${ORANGE}0d`,
    borderColor: `${ORANGE}30`,
  },
  compareColHeader: {
    padding: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    gap: 2,
  },
  coreColTitle: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
    color: TEXT_SEC,
  },
  coreColSubtitle: {
    fontSize: 11,
    color: '#444',
  },
  proColTitle: {
    fontSize: 13,
    fontFamily: 'Outfit_700Bold',
    color: ORANGE,
  },
  proColSubtitle: {
    fontSize: 11,
    color: `${ORANGE}99`,
  },
  compareItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  compareCheckWrap: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  coreCheckWrap: {
    backgroundColor: '#1e1e22',
  },
  proCheckWrap: {
    backgroundColor: '#22c55e18',
  },
  coreItemText: {
    fontSize: 11,
    color: '#666',
    flex: 1,
  },
  coreItemLocked: {
    fontSize: 11,
    color: '#333',
    flex: 1,
    textDecorationLine: 'line-through',
  },
  proItemText: {
    fontSize: 11,
    color: TEXT,
    flex: 1,
  },
  proItemEverything: {
    fontSize: 11,
    color: '#22c55e',
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
    paddingVertical: 14,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    backgroundColor: BG,
    alignItems: 'center',
  },
  ctaBtn: {
    width: '100%',
    backgroundColor: ORANGE,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  ctaBtnLoading: {
    opacity: 0.7,
  },
  ctaBtnText: {
    color: '#fff',
    fontSize: 17,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.3,
  },
  restoreText: {
    fontSize: 13,
    color: TEXT_SEC,
    textDecorationLine: 'underline',
  },
});
