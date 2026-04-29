import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Modal,
  ActivityIndicator,
  Alert,
  Linking,
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
const GOLD = PRO_GOLD;
const WHITE = '#ffffff';

const TERMS_URL = 'https://zealplus.app/terms-of-service.html';
const PRIVACY_URL = 'https://zealplus.app/privacy-policy.html';

const TRIAL_SUB = "Try everything free for 7 days.\nNo charge until Day 8 — cancel anytime.";
const NO_TRIAL_SUB = "Everything Zeal offers, for less than\na coffee a week.";

const FEATURES: { icon: AppIconName; label: string; sub: string }[] = [
  {
    icon: 'dumbbell',
    label: 'All Workout Styles',
    sub: 'CrossFit, HIIT, Hyrox + more',
  },
  {
    icon: 'bar-chart-3',
    label: 'Full Analytics & Insights',
    sub: 'Training load, strength, PRs',
  },
  {
    icon: 'calendar',
    label: 'Custom Training Plans',
    sub: 'Periodized, AI-powered',
  },
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
  /** Localized price string pulled from the App Store via RevenueCat, e.g. "$5.99". */
  priceString: string | null;
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
  priceString,
}: Props) {
  const scaleAnim = useRef(new Animated.Value(0.96)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const ctaScale = useSharedValue(1);
  const ctaAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: ctaScale.value }] }));

  const isTrial = version === 'trial';

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          speed: 20,
          bounciness: 4,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.96);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  useEffect(() => {
    if (purchaseError) Alert.alert('Purchase Failed', purchaseError);
  }, [purchaseError]);

  useEffect(() => {
    if (restoreError) Alert.alert('Restore Failed', restoreError);
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

            {/* ── Close ── */}
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
              testID="paywall-close"
            >
              <PlatformIcon name="x" size={16} color="rgba(255,255,255,0.45)" strokeWidth={2.5} />
            </TouchableOpacity>

            {/* ── Hero ── */}
            <View style={styles.hero}>
              <View style={styles.zealProRow}>
                <PlatformIcon name="crown" size={14} color={GOLD} strokeWidth={2} />
                <Text style={styles.zealProLabel}>ZEAL PRO</Text>
              </View>
              <Text style={styles.headline}>{"Your training,\nfully unlocked."}</Text>
              <Text style={styles.subtext}>{isTrial ? TRIAL_SUB : NO_TRIAL_SUB}</Text>
            </View>

            {/* ── Features ── */}
            <View style={styles.featuresBlock}>
              {FEATURES.map(({ icon, label, sub }) => (
                <View key={label}>
                  <View style={styles.featureDivider} />
                  <View style={styles.featureRow}>
                    <PlatformIcon name={icon} size={15} color={WHITE} strokeWidth={1.75} />
                    <Text style={styles.featureLabel}>{label}</Text>
                    <Text style={styles.featureSub}>{sub}</Text>
                  </View>
                </View>
              ))}
              <View style={styles.featureDivider} />
            </View>

            {/* ── Price ── (Phase 12B: trial transparency for App Store) */}
            <View style={styles.priceArea}>
              {isTrial ? (
                <>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceAmount}>7 days</Text>
                    <Text style={styles.priceMo}>free</Text>
                  </View>
                  <Text style={styles.priceSubProminent}>
                    Then {priceString ?? ''}/month, auto-renews monthly until canceled.
                  </Text>
                </>
              ) : (
                <>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceAmount}>{priceString ?? '—'}</Text>
                    <Text style={styles.priceMo}>/mo</Text>
                  </View>
                  <Text style={styles.priceSub}>
                    Billed {priceString ?? ''} monthly. Auto-renews until canceled.
                  </Text>
                </>
              )}
            </View>

            {/* ── Footer / CTA ── */}
            <View style={styles.footer}>
              <Reanimated.View style={[{ width: '100%' }, ctaAnimStyle]}>
                <TouchableOpacity
                  style={[styles.ctaBtn, (isPurchasing || isRestoring) && styles.ctaBtnLoading]}
                  onPress={onPurchase}
                  onPressIn={() => { ctaScale.value = withSpring(0.96, SWIFT_REANIMATED_SPRING); }}
                  onPressOut={() => { ctaScale.value = withSpring(1, SWIFT_REANIMATED_SPRING); }}
                  activeOpacity={1}
                  disabled={isPurchasing || isRestoring}
                  testID="paywall-cta"
                >
                  {isPurchasing
                    ? <ActivityIndicator color="#fff" size="small" />
                    : (
                      <View style={{ alignItems: 'center', gap: 2 }}>
                        <Text style={styles.ctaBtnText}>
                          {isTrial
                            ? 'Start 7-Day Free Trial'
                            : `Unlock Pro · ${priceString ?? ''}/mo`}
                        </Text>
                        {isTrial && (
                          <Text style={styles.ctaBtnSubText}>
                            Then {priceString ?? ''}/mo · Cancel anytime
                          </Text>
                        )}
                      </View>
                    )
                  }
                </TouchableOpacity>
              </Reanimated.View>

              {/* ── Apple-required subscription disclosures ── */}
              <Text style={styles.disclosureText}>
                Payment is charged to your Apple ID at confirmation of purchase. Subscription automatically renews each month unless canceled at least 24 hours before the end of the current period. Manage or cancel anytime in Settings › Apple ID › Subscriptions.
              </Text>

              <View style={styles.footerLinks}>
                <TouchableOpacity
                  onPress={onRestore}
                  disabled={isPurchasing || isRestoring}
                  activeOpacity={0.7}
                  testID="paywall-restore"
                >
                  {isRestoring
                    ? <ActivityIndicator color="rgba(255,255,255,0.3)" size="small" />
                    : <Text style={styles.footerLinkText}>Restore Purchases</Text>
                  }
                </TouchableOpacity>
                <Text style={styles.footerDot}>·</Text>
                <TouchableOpacity onPress={() => void Linking.openURL(TERMS_URL)} activeOpacity={0.7}>
                  <Text style={styles.footerLinkText}>Terms</Text>
                </TouchableOpacity>
                <Text style={styles.footerDot}>·</Text>
                <TouchableOpacity onPress={() => void Linking.openURL(PRIVACY_URL)} activeOpacity={0.7}>
                  <Text style={styles.footerLinkText}>Privacy</Text>
                </TouchableOpacity>
              </View>
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
    offerings,
  } = useSubscription();

  // Pull the localized price string from RevenueCat offerings.
  // Falls back to the first available package if `monthly` isn't populated.
  // If RC offerings haven't loaded (dev builds without RC keys, cold launch
  // before the fetch resolves, etc.) fall back to the known App Store price
  // so the paywall never renders a naked dash. RC's localized string wins
  // as soon as it arrives.
  const FALLBACK_MONTHLY_PRICE = '$5.99';
  const monthlyPackage =
    offerings?.current?.monthly ??
    offerings?.current?.availablePackages?.[0] ??
    null;
  const priceString: string = monthlyPackage?.product?.priceString ?? FALLBACK_MONTHLY_PRICE;

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
      priceString={priceString}
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Hero ──────────────────────────────────────────
  hero: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  zealProRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  zealProLabel: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    color: GOLD,
    letterSpacing: 4,
  },
  headline: {
    fontSize: 38,
    fontFamily: 'Outfit_800ExtraBold',
    fontStyle: 'italic',
    color: WHITE,
    textAlign: 'center',
    lineHeight: 44,
    letterSpacing: -1,
    marginTop: 14,
  },
  subtext: {
    fontSize: 15,
    fontFamily: 'Outfit_400Regular',
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 10,
    paddingHorizontal: 8,
  },

  // ── Features ──────────────────────────────────────
  featuresBlock: {
    flex: 1.5,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  featureDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  featureLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Outfit_500Medium',
    color: WHITE,
  },
  featureSub: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'right',
    flexShrink: 1,
  },

  // ── Price ─────────────────────────────────────────
  priceArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  priceAmount: {
    fontSize: 48,
    fontFamily: 'Outfit_800ExtraBold',
    color: WHITE,
    letterSpacing: -1,
    lineHeight: 52,
    paddingRight: 2,
  },
  priceMo: {
    fontSize: 16,
    fontFamily: 'Outfit_400Regular',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 8,
  },
  // Phase 12B: prominent variant for trial post-trial billing line
  priceSubProminent: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
    color: 'rgba(255,255,255,0.78)',
    marginTop: 6,
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  priceSub: {
    fontSize: 13,
    fontFamily: 'Outfit_400Regular',
    color: 'rgba(255,255,255,0.35)',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 28,
  },

  // ── Footer / CTA ──────────────────────────────────
  footer: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 12,
    alignItems: 'center',
  },
  ctaBtn: {
    width: '100%',
    backgroundColor: ORANGE,
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  ctaBtnLoading: {
    opacity: 0.75,
  },
  ctaBtnText: {
    color: WHITE,
    fontSize: 17,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.2,
  },
  // Phase 12B: post-trial price line directly inside the CTA button so the
  // billing terms are visible at the moment of decision (App Store guideline 3.1.2c).
  ctaBtnSubText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
    letterSpacing: 0.2,
  },
  disclosureText: {
    fontSize: 10,
    lineHeight: 14,
    fontFamily: 'Outfit_400Regular',
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerLinkText: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
    color: 'rgba(255,255,255,0.3)',
  },
  footerDot: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.2)',
  },
});
