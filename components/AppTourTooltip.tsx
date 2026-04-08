import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Animated } from 'react-native';
import { X } from 'lucide-react-native';
import { useZealTheme } from '@/context/AppContext';
import { TOUR_STEPS, type HighlightRect } from '@/context/AppTourContext';
import type { LucideIcon } from 'lucide-react-native';

interface Props {
  stepIndex: number;
  title: string;
  body: string;
  icon: LucideIcon;
  iconColor: string;
  tapHint: string;
  isLast: boolean;
  targetRect: HighlightRect | null;
  arrowDirection: 'up' | 'down' | null;
  tooltipFade: Animated.Value;
  tooltipSlide: Animated.Value;
  onSkip: () => void;
  onBack: () => void;
  onFinish: () => void;
}

export default function AppTourTooltip({
  stepIndex,
  title,
  body,
  icon: StepIcon,
  iconColor,
  tapHint,
  isLast,
  targetRect,
  arrowDirection,
  tooltipFade,
  tooltipSlide,
  onSkip,
  onBack,
  onFinish,
}: Props) {
  const { isDark } = useZealTheme();
  const totalSteps = TOUR_STEPS.length;

  const cardBg = isDark ? 'rgba(24,24,24,0.98)' : 'rgba(255,255,255,0.98)';
  const cardBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const titleColor = isDark ? '#fff' : '#111';
  const bodyColor = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
  const hintColor = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)';
  const skipColor = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)';
  const dotMuted = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)';

  // Position tooltip above or below target
  let tooltipTop: number;
  if (!targetRect || arrowDirection === null) {
    // Centered on screen
    tooltipTop = -1; // signals centered mode
  } else if (arrowDirection === 'down') {
    // Tooltip above target, arrow points down
    tooltipTop = Math.max(60, targetRect.y - 260);
  } else {
    // Tooltip below target, arrow points up
    tooltipTop = targetRect.y + targetRect.height + 16;
  }

  // Arrow horizontal position
  const arrowLeft = targetRect
    ? targetRect.x + targetRect.width / 2 - 20 - 6 // 20 = tooltip left margin, 6 = half arrow width
    : 0;

  const isCentered = tooltipTop === -1;

  return (
    <Animated.View
      style={[
        styles.tooltipCard,
        {
          backgroundColor: cardBg,
          borderColor: cardBorder,
          opacity: tooltipFade,
          transform: [{ translateY: tooltipSlide }],
        },
        isCentered
          ? styles.tooltipCentered
          : { top: tooltipTop },
      ]}
      pointerEvents="box-none"
    >
      {/* Arrow pointing at target */}
      {arrowDirection === 'down' && targetRect && (
        <View style={[styles.arrowDown, { left: Math.max(12, Math.min(arrowLeft, 280)) }]}>
          <View style={[styles.arrowTriangleDown, { borderTopColor: cardBg }]} />
        </View>
      )}
      {arrowDirection === 'up' && targetRect && (
        <View style={[styles.arrowUp, { left: Math.max(12, Math.min(arrowLeft, 280)) }]}>
          <View style={[styles.arrowTriangleUp, { borderBottomColor: cardBg }]} />
        </View>
      )}

      {/* Dot indicators */}
      <View style={styles.tooltipTop}>
        <View style={styles.stepDots}>
          {TOUR_STEPS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.stepDot,
                i === stepIndex
                  ? { backgroundColor: iconColor, width: 18 }
                  : i < stepIndex
                    ? { backgroundColor: `${iconColor}60`, width: 6 }
                    : { backgroundColor: dotMuted, width: 6 },
              ]}
            />
          ))}
        </View>
        <Text style={[styles.stepCounter, { color: hintColor }]}>
          {stepIndex + 1}/{totalSteps}
        </Text>
      </View>

      {/* Body */}
      <View style={styles.tooltipBody}>
        <View style={[styles.tooltipIconWrap, { backgroundColor: `${iconColor}15` }]}>
          <StepIcon size={22} color={iconColor} strokeWidth={2} />
        </View>
        <View style={styles.tooltipText}>
          <Text style={[styles.tooltipTitle, { color: titleColor }]}>{title}</Text>
          <Text style={[styles.tooltipDesc, { color: bodyColor }]}>{body}</Text>
          {!isLast && tapHint ? (
            <Text style={[styles.tapHint, { color: hintColor }]}>{tapHint}</Text>
          ) : null}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.tooltipActions}>
        {isLast ? (
          <TouchableOpacity
            style={[styles.finishBtn, { backgroundColor: iconColor }]}
            onPress={onFinish}
            activeOpacity={0.85}
          >
            <Text style={styles.finishText}>Let's Go!</Text>
          </TouchableOpacity>
        ) : (
          <>
            {stepIndex > 0 && (
              <TouchableOpacity
                style={styles.skipBtn}
                onPress={onBack}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.skipText, { color: skipColor }]}>Back</Text>
              </TouchableOpacity>
            )}
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              style={styles.skipBtn}
              onPress={onSkip}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.skipText, { color: skipColor }]}>Skip</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tooltipCard: {
    position: 'absolute',
    left: 20,
    right: 20,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    zIndex: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
      },
      android: { elevation: 16 },
      default: {},
    }),
  },
  tooltipCentered: {
    top: '35%',
  },
  arrowDown: {
    position: 'absolute',
    bottom: -8,
    zIndex: 21,
  },
  arrowTriangleDown: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  arrowUp: {
    position: 'absolute',
    top: -8,
    zIndex: 21,
  },
  arrowTriangleUp: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  tooltipTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  stepDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  stepDot: {
    height: 5,
    borderRadius: 3,
  },
  stepCounter: {
    fontSize: 11,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.5,
  },
  tooltipBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 16,
  },
  tooltipIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tooltipText: {
    flex: 1,
    gap: 4,
  },
  tooltipTitle: {
    fontSize: 18,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.3,
  },
  tooltipDesc: {
    fontSize: 14,
    fontFamily: 'Outfit_400Regular',
    lineHeight: 20,
  },
  tapHint: {
    marginTop: 8,
    fontSize: 12,
    fontFamily: 'Outfit_600SemiBold',
    letterSpacing: 0.2,
  },
  tooltipActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  skipBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 14,
    fontFamily: 'Outfit_500Medium',
  },
  finishBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 13,
  },
  finishText: {
    fontSize: 15,
    fontFamily: 'Outfit_700Bold',
    color: '#fff',
    letterSpacing: 0.2,
  },
});
