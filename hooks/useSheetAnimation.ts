import { useRef, useEffect } from 'react';
import { Animated, Dimensions, PanResponder } from 'react-native';

const SCREEN_HEIGHT   = Dimensions.get('window').height;
const SHEET_OFFSET    = SCREEN_HEIGHT * 0.55;
const DISMISS_DIST    = 80;   // px dragged down → dismiss
const DISMISS_VEL     = 0.5;  // gesture velocity → dismiss

/**
 * Splits Modal animation so the backdrop fades independently from the sheet
 * sliding up. Use with `animationType="none"` on the <Modal>.
 *
 * Returns:
 *   backdropStyle  — apply to the dim overlay Animated.View
 *   sheetStyle     — apply to the bottom sheet Animated.View
 *   onClose        — call instead of closing directly; runs exit anim then fires callback
 *   panHandlers    — spread onto the drag handle View for swipe-to-dismiss
 */
export function useSheetAnimation(
  visible: boolean,
  onCloseFn: () => void,
  options?: { sheetOffset?: number; duration?: number },
) {
  const offset = options?.sheetOffset ?? SHEET_OFFSET;
  const dur    = options?.duration    ?? 260;

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(offset)).current;

  // Keep latest onCloseFn accessible from the PanResponder without
  // recreating it (PanResponder is created once in a ref).
  const onCloseFnRef = useRef(onCloseFn);
  useEffect(() => { onCloseFnRef.current = onCloseFn; }, [onCloseFn]);

  // ── Close animation ────────────────────────────────────────────
  // Defined as a plain function (not a hook) so the PanResponder ref
  // can call it via runCloseRef.current().
  const runClose = () => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: Math.round(dur * 0.7),
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: offset,
        duration: Math.round(dur * 0.8),
        useNativeDriver: true,
      }),
    ]).start(() => {
      sheetTranslateY.setValue(offset);
      backdropOpacity.setValue(0);
      onCloseFnRef.current();
    });
  };

  // Keep a mutable ref so the PanResponder (created once) always calls
  // the latest version even if offset/dur change between renders.
  const runCloseRef = useRef(runClose);
  runCloseRef.current = runClose;

  // ── Open animation ─────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: dur,
          useNativeDriver: true,
        }),
        Animated.spring(sheetTranslateY, {
          toValue: 0,
          damping: 26,
          stiffness: 260,
          mass: 0.8,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // ── Swipe-to-dismiss pan responder ─────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      // Only claim the gesture when the user is dragging downward
      // and the vertical delta is larger than the horizontal delta.
      onMoveShouldSetPanResponder: (_, gs) =>
        gs.dy > 6 && Math.abs(gs.dy) > Math.abs(gs.dx),

      onPanResponderMove: (_, gs) => {
        if (gs.dy <= 0) return;
        sheetTranslateY.setValue(gs.dy);
        // Fade backdrop proportionally as the sheet moves away
        backdropOpacity.setValue(Math.max(0, 1 - gs.dy / offset));
      },

      onPanResponderRelease: (_, gs) => {
        if (gs.dy > DISMISS_DIST || gs.vy > DISMISS_VEL) {
          // Far enough or fast enough — dismiss
          runCloseRef.current();
        } else {
          // Not enough — spring back to resting position
          Animated.parallel([
            Animated.spring(sheetTranslateY, {
              toValue: 0,
              damping: 26,
              stiffness: 260,
              mass: 0.8,
              useNativeDriver: true,
            }),
            Animated.timing(backdropOpacity, {
              toValue: 1,
              duration: 160,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },

      onPanResponderTerminate: (_, gs) => {
        // Another gesture (e.g. scroll) stole the responder — snap back
        Animated.parallel([
          Animated.spring(sheetTranslateY, {
            toValue: 0,
            damping: 26,
            stiffness: 260,
            mass: 0.8,
            useNativeDriver: true,
          }),
          Animated.timing(backdropOpacity, {
            toValue: 1,
            duration: 160,
            useNativeDriver: true,
          }),
        ]).start();
      },
    })
  ).current;

  const backdropStyle = { opacity: backdropOpacity };
  const sheetStyle    = { transform: [{ translateY: sheetTranslateY }] };

  return { backdropStyle, sheetStyle, onClose: runClose, panHandlers: panResponder.panHandlers };
}
