import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme } from '@/context/AppContext';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

interface DrawerHeaderProps {
  title: string;
  /**
   * Provide to show a back chevron (left side) instead of X.
   * This is the canonical signal that the drawer is a nested child.
   */
  onBack?: () => void;
  /**
   * Provide to show an X close button (left side).
   * Only shown when onBack is NOT provided.
   */
  onClose?: () => void;
  /** Optional right-side slot (Done / Save / Apply button, etc.) */
  rightContent?: React.ReactNode;
}

/**
 * Standardized drawer header.
 *
 * Layout:
 *   [ ← back | ✕ close ]   Title (centered)   [ rightContent ]
 *
 * When onBack is provided, the whole header area also handles a
 * rightward horizontal swipe gesture as a back trigger.
 */
export default function DrawerHeader({ title, onBack, onClose, rightContent }: DrawerHeaderProps) {
  const { colors } = useZealTheme();

  // Horizontal swipe-right gesture for back navigation (only active for nested drawers).
  const swipeBack = onBack
    ? Gesture.Pan()
        .activeOffsetX([20, Infinity])
        .failOffsetY([-8, 8])
        .onEnd((e) => {
          if (e.velocityX > 300 || e.translationX > 60) {
            runOnJS(onBack)();
          }
        })
    : null;

  const header = (
    <View style={styles.header}>
      {/* Left control */}
      {onBack ? (
        <TouchableOpacity
          style={styles.leftBtn}
          onPress={onBack}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <PlatformIcon name="chevron-left" size={24} color={colors.text} strokeWidth={2.2} />
        </TouchableOpacity>
      ) : onClose ? (
        <TouchableOpacity
          style={styles.leftBtn}
          onPress={onClose}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={[styles.circleBtn, { backgroundColor: 'rgba(128,128,128,0.15)' }]}>
            <PlatformIcon name="x" size={16} color="#888" strokeWidth={2.5} />
          </View>
        </TouchableOpacity>
      ) : (
        <View style={styles.leftBtn} />
      )}

      {/* Title */}
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
        {title}
      </Text>

      {/* Right slot */}
      <View style={styles.rightSlot}>
        {rightContent ?? null}
      </View>
    </View>
  );

  if (swipeBack) {
    return <GestureDetector gesture={swipeBack}>{header}</GestureDetector>;
  }
  return header;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
  },
  leftBtn: {
    width: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  circleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  rightSlot: {
    width: 80,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
