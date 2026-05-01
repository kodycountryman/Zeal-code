import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import BaseDrawer from '@/components/drawers/BaseDrawer';
import DrawerHeader from '@/components/drawers/DrawerHeader';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme } from '@/context/AppContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { showProGate, PRO_GOLD, PRO_LOCKED_OPACITY } from '@/services/proGate';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelectWorkout: () => void;
  onSelectRun: () => void;
  /** @deprecated Hybrid is now a workout style inside the Workout Plan flow.
   *  Kept as an optional prop so existing callers continue to compile while
   *  they're migrated. New callers should not pass it.
   */
  onSelectHybrid?: () => void;
  /** @deprecated Renamed to onSelectWorkout. Old name kept for transitional callers. */
  onSelectStrength?: () => void;
}

/**
 * "Start a Plan" chooser — Phase 5a.
 *
 * Two top-level options: Workout Plan (covers every style — Strength,
 * Bodybuilding, CrossFit, Hyrox, HIIT, Pilates, Mobility, Low-Impact,
 * Hybrid) and Running Plan. Hybrid is no longer a separate top-level
 * choice; it's a workout style picked inside the Workout Plan flow,
 * because a hybrid plan is fundamentally a workout schedule that mixes
 * in run segments.
 *
 * The user can have one active Workout Plan AND one active Running Plan
 * simultaneously (Phase 5b). Picking a plan type that's already active
 * replaces it.
 *
 * Pattern: stateless sheet. The parent owns each builder drawer's
 * visibility and fires the respective callback. Callers typically dismiss
 * this sheet first, then open the matching builder drawer after a short
 * delay to avoid stacked-sheet animation jank.
 */
function PlanTypeChooserSheet({
  visible,
  onClose,
  onSelectWorkout,
  onSelectRun,
  onSelectStrength,
}: Props) {
  const { colors, accent } = useZealTheme();
  const { hasPro, openPaywall } = useSubscription();

  // Bridge old prop name to new behavior
  const handleWorkoutTap = onSelectWorkout ?? onSelectStrength ?? (() => {});

  const handleRunTap = () => {
    if (!hasPro) {
      showProGate('run_plan', openPaywall);
      return;
    }
    onSelectRun();
  };

  const header = <DrawerHeader title="Start a Plan" onClose={onClose} />;

  const cardBg = colors.cardSecondary;
  const cardBorder = colors.border;

  return (
    <BaseDrawer visible={visible} onClose={onClose} header={header}>
      <View style={styles.content}>
        <Text style={[styles.intro, { color: colors.textSecondary }]}>
          Pick the kind of plan that matches your goal. You can run a
          workout plan and a running plan at the same time.
        </Text>

        {/* Workout Plan */}
        <TouchableOpacity
          style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}
          onPress={handleWorkoutTap}
          activeOpacity={0.8}
          testID="plan-chooser-workout"
          accessibilityRole="button"
          accessibilityLabel="Start a Workout Plan"
        >
          <View style={[styles.iconWrap, { backgroundColor: `${accent}20` }]}>
            <PlatformIcon name="dumbbell" size={20} color={accent} />
          </View>
          <View style={styles.cardBody}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Workout Plan</Text>
            <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
              Strength, Bodybuilding, CrossFit, HIIT, Pilates, Mobility,
              Hybrid — pick your style next.
            </Text>
          </View>
          <PlatformIcon name="chevron-right" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Run Plan — Pro only */}
        <TouchableOpacity
          style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder, opacity: hasPro ? 1 : PRO_LOCKED_OPACITY }]}
          onPress={handleRunTap}
          activeOpacity={0.8}
          testID="plan-chooser-run"
          accessibilityRole="button"
          accessibilityLabel="Start a Running Plan"
        >
          <View style={[styles.iconWrap, { backgroundColor: hasPro ? `${accent}20` : `${PRO_GOLD}18` }]}>
            <PlatformIcon name="figure-run" size={20} color={hasPro ? accent : PRO_GOLD} />
          </View>
          <View style={styles.cardBody}>
            <View style={styles.cardTitleRow}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Running Plan</Text>
              {!hasPro && (
                <View style={[styles.proBadge, { backgroundColor: `${PRO_GOLD}20`, borderColor: `${PRO_GOLD}40` }]}>
                  <Text style={[styles.proBadgeText, { color: PRO_GOLD }]}>PRO</Text>
                </View>
              )}
            </View>
            <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
              5K, 10K, Half Marathon, Marathon, or general run training.
            </Text>
          </View>
          {hasPro
            ? <PlatformIcon name="chevron-right" size={18} color={colors.textMuted} />
            : <PlatformIcon name="lock" size={16} color={PRO_GOLD} />
          }
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
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.2,
  },
  proBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  proBadgeText: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.5,
  },
  cardSub: {
    fontSize: 12,
    fontFamily: 'Outfit_400Regular',
    lineHeight: 17,
  },
});
