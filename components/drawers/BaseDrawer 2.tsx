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
}: BaseDrawerProps) {
  const { colors } = useZealTheme();
  const insets = useSafeAreaInsets();
  const topOffset = Math.max(insets.top, 0) + 16;
  const internalRef = useRef<BottomSheetModal>(null);
  const ref = sheetRef ?? internalRef;
  const dismissingRef = useRef(false);

  // Track footer height so we can add equivalent paddingBottom to the scroll
  // content. This makes gorhom's dynamic sizing include the footer space in its
  // height measurement, so the sheet opens tall enough to show all children
  // without the footer overlapping the last items.
  const [footerHeight, setFooterHeight] = useState(0);

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
        keyboardBehavior: 'interactive' as const,
        keyboardBlurBehavior: 'restore' as const,
        android_keyboardInputMode: 'adjustResize' as const,
      }
    : {};

  return (
    <BottomSheetModal
      ref={ref}
      enableDynamicSizing
      maxDynamicContentSize={maxContentSize}
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      backgroundStyle={[styles.sheetBg, { backgroundColor: colors.card }]}
      handleIndicatorStyle={[styles.handle, { backgroundColor: colors.border }]}
      enablePanDownToClose
      enableOverDrag={false}
      topInset={topOffset}
      stackBehavior={stackBehavior}
      {...keyboardProps}
    >
      {header}
      <BottomSheetScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: footerHeight }}
      >
        {children}
      </BottomSheetScrollView>
      {footer ? (
        <View onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}>
          {footer}
        </View>
      ) : null}
    </BottomSheetModal>
  );
}

export { BaseDrawer };
export type { BaseDrawerProps };

const styles = StyleSheet.create({
  sheetBg: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
  },
});
