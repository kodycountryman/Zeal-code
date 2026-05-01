import React, { memo } from 'react';
import { Text, StyleSheet, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme } from '@/context/AppContext';
import type { AppIconName } from '@/constants/iconMap';

type ChipVariant = 'neutral' | 'selectable';

interface Props {
  label: string;
  /** Optional leading icon — uses PlatformIcon, so any AppIconName works */
  icon?: AppIconName;
  /**
   * `neutral` — display chip with no interaction (replaces the home meta chips,
   *   "60 min", "Strength", etc). Borderless, low-contrast background.
   * `selectable` — interactive single-select chip (replaces RUN_TYPE pills,
   *   Outdoor/Treadmill toggle, mi/km toggle, drawer single-select). Bordered,
   *   accent-tinted when `selected`.
   */
  variant?: ChipVariant;
  /** Selected state — only meaningful when `variant === 'selectable'` */
  selected?: boolean;
  onPress?: () => void;
  /** Optional style override for the container (e.g. `flex: 1` for segmented rows) */
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
}

/**
 * The single chip component for Zeal+. See STYLE.md § 7.
 *
 * Use `<Chip variant="neutral">` for display-only metadata pills.
 * Use `<Chip variant="selectable" selected={...} onPress={...}>` for toggles.
 *
 * The drawer multi-select tinted-border chips remain bespoke — they're a
 * semantically distinct pattern (multi-select with simultaneously-active
 * states) and live in their host components. STYLE.md documents this.
 */
function Chip({
  label,
  icon,
  variant = 'neutral',
  selected = false,
  onPress,
  style,
  testID,
  accessibilityLabel,
}: Props) {
  const { colors, accent } = useZealTheme();

  // ── Neutral (display-only) ────────────────────────────────────────────
  if (variant === 'neutral') {
    const bg = colors.glass.chip;
    const content = (
      <View style={[styles.neutralChip, { backgroundColor: bg }, style]}>
        {icon && <PlatformIcon name={icon} size={11} color={colors.textSecondary} />}
        <Text style={[styles.neutralText, { color: colors.textSecondary }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    );
    if (!onPress) return content;
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
      >
        {content}
      </TouchableOpacity>
    );
  }

  // ── Selectable ────────────────────────────────────────────────────────
  const bg = selected ? `${accent}20` : 'transparent';
  const border = selected ? accent : colors.border;
  const textColor = selected ? accent : colors.text;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      style={[
        styles.selectableChip,
        { backgroundColor: bg, borderColor: border },
        style,
      ]}
    >
      {icon && <PlatformIcon name={icon} size={14} color={textColor} />}
      <Text style={[styles.selectableText, { color: textColor }]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default memo(Chip);

const styles = StyleSheet.create({
  // Neutral — small, borderless, low-contrast background. Matches STYLE.md § 7.
  neutralChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  neutralText: {
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
  },

  // Selectable — pill, bordered, accent-tinted when selected.
  selectableChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  selectableText: {
    fontSize: 13,
    fontFamily: 'Outfit_600SemiBold',
  },
});
