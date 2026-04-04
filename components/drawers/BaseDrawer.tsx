import React, { useRef, useCallback, useEffect, useState, type ReactNode } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { useZealTheme } from '@/context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SCREEN_HEIGHT = Dimensions.get('window').height;

interface BaseDrawerProps {
  visible: boolean;
  onClose: () => void;
  maxHeight?: number;
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  hasTextInput?: boolean;
  sheetRef?: React.RefObject<BottomSheetModal>;
  stackBehavior?: 'push' | 'replace';
  snapPoints?: string[];
  backgroundColor?: string;
}

export default function BaseDrawer({
  visible,
  onClose,
  maxHeight,
  header,
  children,
  footer,
  hasTextInput = false,
  sheetRef,
  stackBehavior,
  snapPoints,
  backgroundColor,
}: BaseDrawerProps) {
  const { colors } = useZealTheme();
  const insets = useSafeAreaInsets();
  const topOffset = Math.max(insets.top, 0) + 16;
  const internalRef = useRef<BottomSheetModal>(null);
  const ref = sheetRef ?? internalRef;
  const dismissingRef = useRef(false);
  const [headerHeight, setHeaderHeight] = useState(0);

  const maxContentSize = maxHeight ?? SCREEN_HEIGHT * 0.92;

  useEffect(() => {
    if (visible) {
      dismissingRef.current = false;
      ref.current?.present();
    } else {
      dismissingRef.current = true;
      ref.current?.dismiss();
    }
  }, [visible, ref]);

  const handleDismiss = useCallback(() => {
    if (!dismissingRef.current) {
      onClose();
    }
    dismissingRef.current = false;
  }, [onClose]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.6}
        pressBehavior="close"
      />
    ),
    [],
  );

  const keyboardProps = hasTextInput
    ? {
        // 'extend' keeps the sheet at full height when keyboard opens (used with snap points).
        // 'interactive' moves the sheet up with the keyboard (used for dynamic-sized drawers).
        keyboardBehavior: snapPoints ? 'extend' as const : 'interactive' as const,
        keyboardBlurBehavior: 'restore' as const,
        android_keyboardInputMode: 'adjustResize' as const,
      }
    : {};

  const sheetBgColor = backgroundColor ?? colors.card;
  const dynamicProps = snapPoints
    ? { snapPoints, enableDynamicSizing: false, topInset: topOffset }
    : { enableDynamicSizing: true, maxDynamicContentSize: maxContentSize, topInset: topOffset };

  return (
    <BottomSheetModal
      ref={ref}
      {...dynamicProps}
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      backgroundStyle={[styles.sheetBg, { backgroundColor: sheetBgColor }]}
      handleIndicatorStyle={[styles.handle, { backgroundColor: colors.border }]}
      enablePanDownToClose
      enableOverDrag={false}
      stackBehavior={stackBehavior}
      {...keyboardProps}
    >
      {header ? (
        <View onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
          {header}
        </View>
      ) : null}
      <BottomSheetScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={header ? { paddingBottom: headerHeight } : undefined}
      >
        {children}
        {footer}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

export { BaseDrawer };
export type { BaseDrawerProps };

const styles = StyleSheet.create({
  sheetBg: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
  },
});
