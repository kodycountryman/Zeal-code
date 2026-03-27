import { useMemo, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Options {
  /** Minimum sheet height in pixels. Default: 360 */
  minHeight?: number;
  /** Max fraction of window height the sheet can open to. Default: 0.92 */
  maxFraction?: number;
  /** Estimated pixel height of the drawer header + handle bar. Default: 86 */
  headerEst?: number;
  /** Estimated pixel height of the bottom padding/footer. Default: 16 */
  footerEst?: number;
}

interface DrawerSizing {
  /** Single-element snap-points array — always fits content; clamped to maxDynamicContentSize */
  snapPoints: number[];
  /** Max pixel height the sheet can reach */
  maxDynamicContentSize: number;
  /** topInset value to pass to BottomSheetModal */
  topOffset: number;
  /** True only when content overflows the fully-open sheet (must scroll to see all) */
  scrollEnabled: boolean;
  /** Raw measured content height (from onContentSizeChange) */
  contentH: number;
  /** Pass to BottomSheetScrollView's onContentSizeChange: (_w, h) => setContentH(h) */
  setContentH: (h: number) => void;
}

export function useDrawerSizing({
  minHeight = 360,
  maxFraction = 0.92,
  headerEst = 86,
  footerEst = 16,
}: Options = {}): DrawerSizing {
  const { height: windowH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const topOffset = Math.max(insets.top, 0) + 16;

  const [contentH, setContentH] = useState(0);

  const maxDynamicContentSize = useMemo(
    () => Math.max(minHeight, Math.min(windowH - topOffset - 24, Math.round(windowH * maxFraction))),
    [windowH, topOffset, minHeight, maxFraction],
  );

  const snapPoints = useMemo(() => {
    const desired = contentH > 0
      ? contentH + headerEst + footerEst
      : maxDynamicContentSize;
    const clamped = Math.min(maxDynamicContentSize, Math.max(minHeight, Math.round(desired)));
    return [clamped];
  }, [contentH, maxDynamicContentSize, headerEst, footerEst, minHeight]);

  // Scrolling is only needed once content + chrome exceeds the max sheet height.
  const scrollEnabled = snapPoints[0] >= maxDynamicContentSize;

  return { snapPoints, maxDynamicContentSize, topOffset, scrollEnabled, contentH, setContentH };
}
