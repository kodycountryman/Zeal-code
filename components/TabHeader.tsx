import React, { forwardRef, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme, useAppContext } from '@/context/AppContext';

interface Props {
  /** Page title shown next to the avatar. e.g. "Home", "Workout", "Run" */
  title: string;
  /** Tap handler for the avatar — typically opens the profile drawer */
  onAvatarPress: () => void;
  /** Optional right-side meta — date, units toggle, settings cog, etc. */
  rightSlot?: React.ReactNode;
  /** Optional absolutely-positioned center overlay (e.g. workout's elapsed timer) */
  centerOverlay?: React.ReactNode;
  /** TestID for the avatar button (defaults to "tab-header-avatar") */
  avatarTestID?: string;
  /** Hit-slop for the avatar — defaults to 10px on all sides */
  avatarHitSlop?: { top: number; bottom: number; left: number; right: number };
}

/**
 * Unified header used at the top of every primary tab screen.
 *
 * Layout: [avatar] [title]                                    [rightSlot]
 *
 * The wordmark ("zeal") is intentionally absent — it lives on splash /
 * onboarding / paywall only. Page identity comes from `title`.
 *
 * Spacing matches the previous Home/Workout headers (16/4/10) so other
 * screen layouts don't shift during migration.
 *
 * Use `centerOverlay` for things that need to float dead-center regardless of
 * title length (e.g. the Workout screen's elapsed-timer pill).
 */
const TabHeader = forwardRef<View, Props>(function TabHeader(
  {
    title,
    onAvatarPress,
    rightSlot,
    centerOverlay,
    avatarTestID = 'tab-header-avatar',
    avatarHitSlop = { top: 10, bottom: 10, left: 10, right: 10 },
  },
  avatarRef,
) {
  const { colors } = useZealTheme();
  const ctx = useAppContext();
  const userPhotoUri = ctx.userPhotoUri;

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <TouchableOpacity
          ref={avatarRef as unknown as React.Ref<View>}
          style={[
            styles.avatarBtn,
            { borderColor: userPhotoUri ? 'transparent' : colors.border },
          ]}
          onPress={onAvatarPress}
          testID={avatarTestID}
          activeOpacity={0.7}
          hitSlop={avatarHitSlop}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
        >
          {userPhotoUri ? (
            <Image source={{ uri: userPhotoUri }} style={styles.avatarImage} />
          ) : (
            <PlatformIcon name="user" size={17} color={colors.textSecondary} />
          )}
        </TouchableOpacity>

        <Text
          style={[styles.title, { color: colors.text }]}
          numberOfLines={1}
          accessibilityRole="header"
        >
          {title}
        </Text>
      </View>

      {centerOverlay}

      {rightSlot ? <View style={styles.right}>{rightSlot}</View> : null}
    </View>
  );
});

export default memo(TabHeader);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
    gap: 10,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Outfit_800ExtraBold',
    letterSpacing: -0.5,
  },
});
