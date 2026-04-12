import React, { useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useZealTheme } from '@/context/AppContext';
import { PlatformIcon } from '@/components/PlatformIcon';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  interpolate,
  Extrapolation,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import type { MealEntry } from '@/types/nutrition';

const DELETE_W = 72;

interface Props {
  entry: MealEntry;
  onTap: () => void;
  onDelete: () => void;
}

function DeleteAction({ progress, onPress }: { progress: SharedValue<number>; onPress: () => void }) {
  const animStyle = useAnimatedStyle(() => {
    const scale = interpolate(progress.value, [0, 0.6, 1], [0.5, 1.05, 1], Extrapolation.CLAMP);
    const opacity = interpolate(progress.value, [0, 0.3, 1], [0, 0.9, 1], Extrapolation.CLAMP);
    return { transform: [{ scale }], opacity };
  });

  return (
    <Pressable
      style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.7 }]}
      onPress={onPress}
    >
      <Animated.View style={animStyle}>
        <PlatformIcon name="trash" size={20} color="rgba(255,69,58,0.9)" strokeWidth={2} />
      </Animated.View>
    </Pressable>
  );
}

export default function MealEntryRow({ entry, onTap, onDelete }: Props) {
  const { colors, isDark } = useZealTheme();
  const swipeableRef = useRef<SwipeableMethods>(null);

  const handleDelete = useCallback(() => {
    swipeableRef.current?.close();
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    onDelete();
  }, [onDelete]);

  const renderRightActions = useCallback(
    (progress: SharedValue<number>) => (
      <View style={styles.actionsContainer}>
        <DeleteAction progress={progress} onPress={handleDelete} />
      </View>
    ),
    [handleDelete],
  );

  const servingLabel = `${entry.quantity}${entry.quantity !== 1 ? '' : ''} ${entry.servingSize.label}`;
  const borderColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';

  return (
    <ReanimatedSwipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={DELETE_W / 2}
      overshootRight={false}
      friction={1}
      activeOffsetX={[-8, 8]}
      failOffsetY={[-5, 5]}
      containerStyle={styles.swipeContainer}
    >
      <Pressable
        style={[styles.row, { borderBottomColor: borderColor }]}
        onPress={onTap}
      >
        <View style={styles.left}>
          <Text
            style={[styles.foodName, { color: colors.text }]}
            numberOfLines={1}
          >
            {entry.food.name}
          </Text>
          <Text
            style={[styles.serving, { color: colors.textMuted }]}
            numberOfLines={1}
          >
            {servingLabel} &middot; {Math.round(entry.nutrients.calories)} cal
          </Text>
        </View>
        <Text style={[styles.calories, { color: colors.textSecondary }]}>
          {Math.round(entry.nutrients.calories)}
        </Text>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  swipeContainer: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  left: {
    flex: 1,
    marginRight: 12,
  },
  foodName: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    lineHeight: 20,
  },
  serving: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    lineHeight: 17,
    marginTop: 2,
  },
  calories: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    lineHeight: 20,
  },
  actionsContainer: {
    width: DELETE_W,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
