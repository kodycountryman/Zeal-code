import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import BaseDrawer from '@/components/drawers/BaseDrawer';
import DrawerHeader from '@/components/drawers/DrawerHeader';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme } from '@/context/AppContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { showProGate, PRO_GOLD } from '@/services/proGate';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelectStrength: () => void;
  onSelectRun: () => void;
  onSelectHybrid: () => void;
}

/**
 * Unified "Start a Plan" chooser. Replaces the separate entry points that
 * previously existed on Home (strength only) and Run (run + hybrid). Offers
 * all three plan types side-by-side so users don't have to guess which tab
 * owns which kind of plan.
 *
 * Pattern: stateless sheet. The parent owns each builder drawer's visibility
 * and fires the respective onSelect* callback; the sheet just routes the tap.
 * Callers typically dismiss the sheet first, then open the matching builder
 * drawer after a short delay to avoid stacked-sheet animation jank.
 */
function PlanTypeChooserSheet({
  visible,
  onClose,
  onSelectStrength,
  onSelectRun,
  onSelectHybrid,
}: Props) {
  const { colors, accent, isDark } = useZealTheme();
  const { hasPro, openPaywall } = useSubscription();

  const handleHybridTap = () => {
    if (!hasPro) {
      showProGate('runPlans', openPaywall);
      return;
    }
    onSelectHybrid();
  };

  const header = <DrawerHeader title="Start a Plan" onClose={onClose} />;

  const cardBg = colors.cardSecondary;
  const cardBorder = colors.border;

  return (
    <BaseDrawer visible={visible} onClose={onClose} header={header}>
      <View style={styles.content}>
        <Text style={[styles.intro, { color: colors.textSecondary }]}>
          Pick the kind of plan that matches your goal. You can switch plans
          anytime.
        </Text>

        {/* Strength */}
        <TouchableOpacity
          style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}
          onPress={onSelectStrength}
          activeOpacity={0.8}
          testID="plan-chooser-strength"
          accessibilityRole="button"
          accessibilityLabel="Start a Strength Plan"
        >
          <View style={[styles.iconWrap, { backgroundColor: `${accent}20` }]}>
            <PlatformIcon name="dumbbell" size={20} color={accent} />
          </View>
          <View style={styles.cardBody}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Strength Plan</Text>
            <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
              Periodized lifting programs — bodybuilding, powerlifting, general
              strength, and more.
            </Text>
          </View>
          <PlatformIcon name="chevron-right" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Run */}
        <TouchableOpacity
          style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}
          onPress={onSelectRun}
          activeOpacity={0.8}
          testID="plan-chooser-run"
          accessibilityRole="button"
          accessibilityLabel="Start a Run Plan"
        >
          <View style={[styles.iconWrap, { backgroundColor: `${accent}20` }]}>
            <PlatformIcon name="figure-run" size={20} color={accent} />
          </View>
          <View style={styles.cardBody}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Run Plan</Text>
            <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
              5K, 10K, Half Marathon, Marathon, or general run training.
            </Text>
          </View>
          <PlatformIcon name="chevron-right" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Hybrid */}
        <TouchableOpacity
          style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}
          onPress={handleHybridTap}
          activeOpacity={0.8}
          testID="plan-chooser-hybrid"
          accessibilityRole="button"
          accessibilityLabel="Start a Hybrid Plan"
        >
          <View style={[styles.iconWrap, { backgroundColor: '#3b82f620' }]}>
            <PlatformIcon name="dumbbell" size={20} color="#3b82f6" />
          </View>
          <View style={styles.cardBody}>
            <View style={styles.titleRow}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Hybrid Plan</Text>
              {!hasPro && <PlatformIcon name="crown" size={12} color={PRO_GOLD} />}
            </View>
            <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
              Combine strength training with run programming in one weekly
              schedule.
            </Text>
          </View>
          <PlatformIcon name="chevron-right" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </BaseDrawer>
  );
}

export default memo(PlanTypeChooserSheet);

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 32,
    gap: 12,
  },
  intro: {
    fontSize: 13,
    fontFamily: 'Outfit_400Regular',
    lineHeight: 19,
    marginBottom: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.2,
  },
  cardSub: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
    lineHeight: 17,
  },
});
