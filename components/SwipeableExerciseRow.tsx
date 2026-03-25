import React, { useCallback, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  PanResponder,
  TouchableOpacity,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Info, ArrowLeftRight, Trash2 } from 'lucide-react-native';

const BTN_W = 64;
const REVEAL_W = BTN_W * 3;
const SNAP_THRESHOLD = 30;
const DELETE_THRESHOLD = REVEAL_W + 80;

interface Props {
  id: string;
  openId: string | null;
  onOpen: (id: string | null) => void;
  onInfo: () => void;
  onSwap: () => void;
  onDelete: () => void;
  rowBg: string;
  children: React.ReactNode;
}

export default function SwipeableExerciseRow({
  id,
  openId,
  onOpen,
  onInfo,
  onSwap,
  onDelete,
  rowBg,
  children,
}: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const hardPullProgress = useRef(new Animated.Value(0)).current;
  const revealProgress = useRef(new Animated.Value(0)).current;
  const isOpenRef = useRef(false);
  const isHardRef = useRef(false);
  const hardHapticFired = useRef(false);
  const startXRef = useRef(0);
  const isDraggingRef = useRef(false);

  const idRef = useRef(id);
  const onDeleteRef = useRef(onDelete);
  const onSwapRef = useRef(onSwap);
  const onInfoRef = useRef(onInfo);
  const onOpenRef = useRef(onOpen);

  useEffect(() => { idRef.current = id; }, [id]);
  useEffect(() => { onDeleteRef.current = onDelete; }, [onDelete]);
  useEffect(() => { onSwapRef.current = onSwap; }, [onSwap]);
  useEffect(() => { onInfoRef.current = onInfo; }, [onInfo]);
  useEffect(() => { onOpenRef.current = onOpen; }, [onOpen]);

  const snapClose = useCallback((animated = true) => {
    isOpenRef.current = false;
    if (animated) {
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        damping: 24,
        stiffness: 380,
        mass: 0.7,
      }).start();
      Animated.spring(revealProgress, {
        toValue: 0,
        useNativeDriver: false,
        damping: 24,
        stiffness: 380,
        mass: 0.7,
      }).start();
    } else {
      translateX.setValue(0);
      revealProgress.setValue(0);
    }
    Animated.timing(hardPullProgress, {
      toValue: 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
  }, [translateX, revealProgress, hardPullProgress]);

  useEffect(() => {
    if (openId !== id && isOpenRef.current) {
      snapClose();
    }
  }, [openId, id, snapClose]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isOpenRef.current,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, { dx, dy }) => {
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        if (absDy > absDx * 0.6) return false;
        return absDx > 12 && absDx > absDy * 2;
      },
      onMoveShouldSetPanResponderCapture: (_, { dx, dy }) => {
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        if (absDy > absDx * 0.6) return false;
        return absDx > 15 && absDx > absDy * 2;
      },
      onPanResponderGrant: (_, gestureState) => {
        hardHapticFired.current = false;
        isHardRef.current = false;
        isDraggingRef.current = true;
        translateX.stopAnimation((val) => {
          startXRef.current = val;
        });
        revealProgress.stopAnimation();
      },
      onPanResponderMove: (_, { dx }) => {
        if (!isDraggingRef.current) return;
        const raw = startXRef.current + dx;
        const clamped = Math.min(0, raw);
        translateX.setValue(clamped);

        const reveal = Math.min(1, Math.max(0, -clamped / REVEAL_W));
        revealProgress.setValue(reveal);

        const progress = Math.max(
          0,
          Math.min(1, (-clamped - REVEAL_W) / (DELETE_THRESHOLD - REVEAL_W))
        );
        hardPullProgress.setValue(progress);

        if (-clamped >= DELETE_THRESHOLD) {
          if (!hardHapticFired.current) {
            hardHapticFired.current = true;
            isHardRef.current = true;
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            }
          }
        } else {
          if (isHardRef.current) {
            isHardRef.current = false;
            hardHapticFired.current = false;
          }
        }
      },
      onPanResponderRelease: (_, { dx, vx }) => {
        isDraggingRef.current = false;
        const currentX = startXRef.current + dx;

        if (isHardRef.current) {
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          }
          Animated.timing(translateX, {
            toValue: -600,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            onDeleteRef.current();
          });
          return;
        }

        if (-currentX > SNAP_THRESHOLD || vx < -0.5) {
          isOpenRef.current = true;
          onOpenRef.current(idRef.current);
          Animated.spring(translateX, {
            toValue: -REVEAL_W,
            useNativeDriver: true,
            damping: 20,
            stiffness: 360,
            mass: 0.7,
          }).start();
          Animated.spring(revealProgress, {
            toValue: 1,
            useNativeDriver: false,
            damping: 20,
            stiffness: 360,
            mass: 0.7,
          }).start();
          startXRef.current = -REVEAL_W;
        } else {
          isOpenRef.current = false;
          onOpenRef.current(null);
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            damping: 24,
            stiffness: 400,
            mass: 0.7,
          }).start();
          Animated.spring(revealProgress, {
            toValue: 0,
            useNativeDriver: false,
            damping: 24,
            stiffness: 400,
            mass: 0.7,
          }).start();
          Animated.timing(hardPullProgress, {
            toValue: 0,
            duration: 200,
            useNativeDriver: false,
          }).start();
          startXRef.current = 0;
        }
      },
      onPanResponderTerminate: () => {
        isDraggingRef.current = false;
        isHardRef.current = false;
        hardHapticFired.current = false;
        if (isOpenRef.current) {
          Animated.spring(translateX, {
            toValue: -REVEAL_W,
            useNativeDriver: true,
            damping: 24,
            stiffness: 380,
            mass: 0.7,
          }).start();
          Animated.spring(revealProgress, {
            toValue: 1,
            useNativeDriver: false,
            damping: 24,
            stiffness: 380,
            mass: 0.7,
          }).start();
          startXRef.current = -REVEAL_W;
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            damping: 24,
            stiffness: 380,
            mass: 0.7,
          }).start();
          Animated.spring(revealProgress, {
            toValue: 0,
            useNativeDriver: false,
            damping: 24,
            stiffness: 380,
            mass: 0.7,
          }).start();
          Animated.timing(hardPullProgress, {
            toValue: 0,
            duration: 200,
            useNativeDriver: false,
          }).start();
          startXRef.current = 0;
        }
      },
    })
  ).current;

  const iconScale = revealProgress.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [0.4, 1.1, 1],
  });

  const deleteBg = hardPullProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['#c0392b', '#e53935'],
  });

  const handleInfo = useCallback(() => {
    snapClose();
    onInfoRef.current();
  }, [snapClose]);

  const handleSwap = useCallback(() => {
    snapClose();
    onSwapRef.current();
  }, [snapClose]);

  const handleDelete = useCallback(() => {
    onDeleteRef.current();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.actions} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.infoBtn}
          onPress={handleInfo}
          activeOpacity={0.75}
        >
          <Animated.View style={{ transform: [{ scale: iconScale }] }}>
            <Info size={20} color="#ffffff" strokeWidth={2.2} />
          </Animated.View>
        </TouchableOpacity>

        <View style={[styles.divider, { left: BTN_W }]} />

        <TouchableOpacity
          style={styles.swapBtn}
          onPress={handleSwap}
          activeOpacity={0.75}
        >
          <Animated.View style={{ transform: [{ scale: iconScale }] }}>
            <ArrowLeftRight size={20} color="#ffffff" strokeWidth={2.2} />
          </Animated.View>
        </TouchableOpacity>

        <View style={[styles.divider, { left: BTN_W * 2 }]} />

        <Animated.View style={[styles.deleteBtn, { backgroundColor: deleteBg }]}>
          <TouchableOpacity
            style={styles.deleteBtnInner}
            onPress={handleDelete}
            activeOpacity={0.75}
          >
            <Animated.View style={{ transform: [{ scale: iconScale }] }}>
              <Trash2 size={20} color="#ffffff" strokeWidth={2.2} />
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </View>

      <Animated.View
        style={[styles.rowContent, { backgroundColor: rowBg, transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  actions: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    width: REVEAL_W,
  },
  infoBtn: {
    width: BTN_W,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1d6fce',
  },
  swapBtn: {
    width: BTN_W,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#b8600a',
  },
  deleteBtn: {
    width: BTN_W,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  deleteBtnInner: {
    flex: 1,
    width: '100%' as const,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    width: 1,
    top: 8,
    bottom: 8,
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  rowContent: {
    width: '100%' as const,
  },
});
