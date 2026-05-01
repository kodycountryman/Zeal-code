import React, { memo } from 'react';
import {
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme } from '@/context/AppContext';
import type { AppIconName } from '@/constants/iconMap';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary';
type ButtonSize = 'sm' | 'md' | 'lg';

interface Props {
  label: string;
  onPress: () => void;
  /** Optional press-in callback for parent-driven animations (e.g. spring scale) */
  onPressIn?: () => void;
  /** Optional press-out callback */
  onPressOut?: () => void;
  /**
   * `primary`   — accent-filled CTA with shadow. Use for the main action on screen.
   * `secondary` — outlined neutral. Use for the alternate action paired with a primary.
   * `tertiary`  — small accent-bordered ghost. Use for inline actions like "Shuffle".
   */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Optional leading icon — uses PlatformIcon, so any AppIconName works */
  icon?: AppIconName;
  /** Stretch to fill the parent's width. Default false. */
  fullWidth?: boolean;
  /**
   * Destructive intent. Primary becomes red-filled; secondary/tertiary get red text.
   * Use sparingly — discard/delete actions only.
   */
  destructive?: boolean;
  /** Show a spinner instead of the icon while a long-running action is in flight */
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Optional style override for the touchable container */
  style?: ViewStyle;
}

const SIZE_SPECS: Record<ButtonSize, { paddingVertical: number; paddingHorizontal: number; fontSize: number; iconSize: number; gap: number }> = {
  sm: { paddingVertical: 5,  paddingHorizontal: 9,  fontSize: 11, iconSize: 11, gap: 4 },
  md: { paddingVertical: 13, paddingHorizontal: 16, fontSize: 14, iconSize: 15, gap: 7 },
  lg: { paddingVertical: 16, paddingHorizontal: 20, fontSize: 16, iconSize: 17, gap: 8 },
};

const RADIUS_BY_VARIANT: Record<ButtonVariant, number> = {
  primary:   16,
  secondary: 16,
  tertiary:  10,
};

/**
 * The single button component for Zeal+. See STYLE.md § Buttons.
 *
 * Per-screen exceptions (DO NOT migrate these):
 * - components/run/RunControls.tsx — bespoke circular Start/Pause/Stop with pulse animation.
 *
 * Variant cheat-sheet:
 *   primary   → "Start Workout", "Save Run", post-run save
 *   secondary → "Plan", "Modify", "Add Exercise"
 *   tertiary  → "Shuffle", small inline accent actions
 */
function Button({
  label,
  onPress,
  onPressIn,
  onPressOut,
  variant = 'primary',
  size = 'md',
  icon,
  fullWidth = false,
  destructive = false,
  loading = false,
  disabled = false,
  testID,
  accessibilityLabel,
  accessibilityHint,
  style,
}: Props) {
  const { colors, accent, isDark } = useZealTheme();
  const sizeSpec = SIZE_SPECS[size];
  const radius = RADIUS_BY_VARIANT[variant];
  const destructiveColor = colors.status.danger;

  // ── Resolve colors per variant + destructive ──────────────────────────
  let backgroundColor: string = 'transparent';
  let borderColor: string = 'transparent';
  let borderWidth = 0;
  let textColor: string = colors.text;
  let shadow: ViewStyle = {};

  if (variant === 'primary') {
    backgroundColor = destructive ? destructiveColor : accent;
    textColor = colors.textInverse;
    shadow = {
      shadowColor: destructive ? destructiveColor : accent,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: isDark ? 0.3 : 0.18,
      shadowRadius: 8,
      elevation: 5,
    };
  } else if (variant === 'secondary') {
    backgroundColor = 'transparent';
    // Destructive secondary: tinted red border so the action reads as risky
    // even before the user notices the text color.
    borderColor = destructive ? `${destructiveColor}59` : colors.border;
    borderWidth = 1;
    textColor = destructive ? destructiveColor : colors.text;
  } else {
    // tertiary
    backgroundColor = `${destructive ? destructiveColor : accent}12`;
    borderColor = destructive ? destructiveColor : accent;
    borderWidth = 1;
    textColor = destructive ? destructiveColor : accent;
  }

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sizeSpec.gap,
    paddingVertical: sizeSpec.paddingVertical,
    paddingHorizontal: sizeSpec.paddingHorizontal,
    borderRadius: radius,
    backgroundColor,
    borderColor,
    borderWidth,
    opacity: disabled ? 0.5 : 1,
    alignSelf: fullWidth ? 'stretch' : 'flex-start',
    ...shadow,
  };

  const textStyle: TextStyle = {
    fontSize: sizeSpec.fontSize,
    fontFamily: variant === 'primary' ? 'Outfit_700Bold' : 'Outfit_600SemiBold',
    color: textColor,
    letterSpacing: variant === 'tertiary' ? 0.2 : 0,
  };

  return (
    <TouchableOpacity
      activeOpacity={0.78}
      onPress={loading || disabled ? undefined : onPress}
      onPressIn={loading || disabled ? undefined : onPressIn}
      onPressOut={loading || disabled ? undefined : onPressOut}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading }}
      style={[containerStyle, style]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : icon ? (
        <PlatformIcon
          name={icon}
          size={sizeSpec.iconSize}
          color={textColor}
          strokeWidth={variant === 'tertiary' ? 2.5 : 2}
        />
      ) : null}
      <Text style={textStyle} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default memo(Button);

const _styles = StyleSheet.create({
  // (Container + text styles are computed inline since they depend on theme + variant.)
});
