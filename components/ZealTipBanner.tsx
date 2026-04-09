import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  TouchableOpacity,
  Modal,
  Switch,
  Platform,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lightbulb, X } from 'lucide-react-native';
import { useAppContext, useZealTheme } from '@/context/AppContext';
import { ZEAL_TIPS } from '@/constants/zealTips';
import { useAppTour } from '@/context/AppTourContext';

const ACCENT = '#f87116';
const BANNER_DELAY_MS = 5500;
const BANNER_DURATION_MS = 6700;

export default function ZealTipBanner() {
  const insets = useSafeAreaInsets();
  const { notifPrefs, saveNotifPrefs } = useAppContext();
  const { colors, isDark } = useZealTheme();
  const { tourActive } = useAppTour();

  const [visible, setVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentTip, setCurrentTip] = useState(ZEAL_TIPS[0]);

  const hasShownThisSession = useRef(false);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const translateY = useRef(new Animated.Value(-160)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;

  const dismiss = useCallback(() => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    Animated.timing(translateY, {
      toValue: -160,
      duration: 320,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start(() => setVisible(false));
  }, [translateY]);

  useEffect(() => {
    if (!notifPrefs.zealTipsEnabled) return;
    if (hasShownThisSession.current) return;
    if (tourActive) return;

    autoTimerRef.current = setTimeout(() => {
      const randomTip = ZEAL_TIPS[Math.floor(Math.random() * ZEAL_TIPS.length)];
      setCurrentTip(randomTip);
      translateY.setValue(-160);
      progressAnim.setValue(1);
      setVisible(true);

      // Drop in
      Animated.spring(translateY, {
        toValue: 0,
        damping: 20,
        stiffness: 200,
        useNativeDriver: true,
      }).start();

      // Progress bar
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: BANNER_DURATION_MS,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start();

      // Auto-dismiss
      dismissTimerRef.current = setTimeout(() => dismiss(), BANNER_DURATION_MS);
      hasShownThisSession.current = true;
    }, BANNER_DELAY_MS);

    return () => {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [tourActive]); // eslint-disable-line react-hooks/exhaustive-deps — re-check when tour ends

  const handleTap = () => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    progressAnim.stopAnimation();
    Animated.timing(translateY, {
      toValue: -160,
      duration: 280,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      setModalOpen(true);
    });
  };

  const handleDismissX = () => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    progressAnim.stopAnimation();
    dismiss();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy < -6,
      onPanResponderGrant: () => {
        if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
        progressAnim.stopAnimation();
      },
      onPanResponderMove: (_, gs) => {
        if (gs.dy < 0) translateY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy < -50 || gs.vy < -0.6) {
          dismiss();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            tension: 140,
            friction: 18,
            useNativeDriver: true,
          }).start();
          // Restart auto-dismiss
          dismissTimerRef.current = setTimeout(() => dismiss(), 3000);
        }
      },
    })
  ).current;

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const topPos = insets.top + 8;

  return (
    <>
      {visible && (
        <Animated.View
          style={[
            styles.banner,
            { top: topPos, transform: [{ translateY }] },
          ]}
          {...panResponder.panHandlers}
        >
          <TouchableOpacity
            onPress={handleTap}
            activeOpacity={0.88}
            style={styles.bannerInner}
          >
            {/* Header row */}
            <View style={styles.headerRow}>
              <View style={styles.iconWrap}>
                <Lightbulb size={14} color={ACCENT} strokeWidth={2.5} />
              </View>
              <Text style={styles.tagLabel}>Zeal Tip</Text>
              <TouchableOpacity
                onPress={handleDismissX}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.closeBtn}
              >
                <X size={13} color="rgba(255,255,255,0.4)" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>

            {/* Tip body */}
            <Text style={styles.tipText} numberOfLines={2}>
              {currentTip.tip}
            </Text>

            {/* Progress bar */}
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Tap-to-view Modal */}
      <Modal
        visible={modalOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: isDark ? '#1a1a1a' : '#f5f5f5', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}>
            {/* Icon */}
            <View style={styles.modalIconWrap}>
              <Lightbulb size={26} color={ACCENT} strokeWidth={2} />
            </View>

            {/* Title */}
            <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#111' }]}>Zeal Tip</Text>

            {/* Tip */}
            <Text style={[styles.modalBody, { color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.65)' }]}>
              {currentTip.tip}
            </Text>

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]} />

            {/* Toggle row */}
            <View style={styles.toggleRow}>
              <View>
                <Text style={[styles.toggleLabel, { color: isDark ? '#fff' : '#111' }]}>Show Zeal Tips</Text>
                <Text style={[styles.toggleSub, { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }]}>Hints shown on app open</Text>
              </View>
              <Switch
                value={notifPrefs.zealTipsEnabled}
                onValueChange={(v) => saveNotifPrefs({ zealTipsEnabled: v })}
                trackColor={{ false: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)', true: `${ACCENT}50` }}
                thumbColor={notifPrefs.zealTipsEnabled ? ACCENT : (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.3)')}
              />
            </View>

            {/* Got it CTA */}
            <TouchableOpacity
              style={styles.gotItBtn}
              onPress={() => setModalOpen(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.gotItText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: 'rgba(18,18,18,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  bannerInner: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 0,
    gap: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconWrap: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: 'rgba(248,113,22,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagLabel: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    color: ACCENT,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  closeBtn: {
    padding: 2,
  },
  tipText: {
    fontSize: 13,
    fontFamily: 'Outfit_400Regular',
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 19,
  },
  progressTrack: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 1,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressBar: {
    height: 2,
    backgroundColor: ACCENT,
    borderRadius: 1,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
    gap: 14,
  },
  modalIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(248,113,22,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,22,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
    textAlign: 'center',
  },
  modalBody: {
    fontSize: 15,
    fontFamily: 'Outfit_400Regular',
    textAlign: 'center',
    lineHeight: 23,
  },
  divider: {
    width: '100%',
    height: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  toggleLabel: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
  },
  toggleSub: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
    marginTop: 2,
  },
  gotItBtn: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  gotItText: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    color: '#fff',
  },
});
