import React, { useRef, useState, useCallback, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, Animated } from 'react-native';

interface WheelPickerProps {
  values: number[];
  selectedValue: number;
  onValueChange: (value: number) => void;
  width?: number;
  textColor?: string;
  mutedColor?: string;
  accentColor?: string;
  bgColor?: string;
  visibleItems?: number;
  suffix?: string;
  formatValue?: (v: number) => string;
}

const ITEM_H = 44;

function findClosestIndex(values: number[], target: number): number {
  let best = 0;
  let bestDist = Math.abs(values[0] - target);
  for (let i = 1; i < values.length; i++) {
    const d = Math.abs(values[i] - target);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

export default function WheelPicker({
  values,
  selectedValue,
  onValueChange,
  width = 76,
  suffix = '',
  formatValue,
  accentColor = '#f87116',
}: WheelPickerProps) {
  const scrollRef = useRef<ScrollView>(null);
  const initIndex = findClosestIndex(values, selectedValue);
  const [selIdx, setSelIdx] = useState<number>(initIndex);
  const lastEmitted = useRef<number>(-1);
  const mounted = useRef<boolean>(false);

  const [showHint, setShowHint] = useState<boolean>(false);
  const hintOpacity = useRef(new Animated.Value(0)).current;
  const fingerY = useRef(new Animated.Value(0)).current;
  const touchStartY = useRef<number | null>(null);
  const scrollStarted = useRef<boolean>(false);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintAnim = useRef<Animated.CompositeAnimation | null>(null);
  const hintShownOnce = useRef<boolean>(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: initIndex * ITEM_H, animated: false });
    }, 60);
    return () => clearTimeout(t);
  }, [initIndex]);

  const showSwipeHint = useCallback(() => {
    if (showHint) return;
    setShowHint(true);
    fingerY.setValue(0);
    hintOpacity.setValue(0);

    hintAnim.current = Animated.sequence([
      Animated.timing(hintOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(fingerY, {
          toValue: -18,
          duration: 320,
          useNativeDriver: true,
        }),
        Animated.timing(fingerY, {
          toValue: 18,
          duration: 420,
          useNativeDriver: true,
        }),
        Animated.timing(fingerY, {
          toValue: -14,
          duration: 340,
          useNativeDriver: true,
        }),
        Animated.timing(fingerY, {
          toValue: 14,
          duration: 340,
          useNativeDriver: true,
        }),
        Animated.timing(fingerY, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(hintOpacity, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]);

    hintAnim.current.start(() => {
      setShowHint(false);
      hintShownOnce.current = true;
    });
  }, [showHint, fingerY, hintOpacity]);

  const hideHint = useCallback(() => {
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
    }
  }, []);

  const onScroll = useCallback((e: { nativeEvent: { contentOffset: { y: number } } }) => {
    const y = e.nativeEvent?.contentOffset?.y ?? 0;
    const idx = Math.round(y / ITEM_H);
    const clamped = Math.max(0, Math.min(idx, values.length - 1));
    if (clamped !== lastEmitted.current) {
      lastEmitted.current = clamped;
      setSelIdx(clamped);
    }
  }, [values.length]);

  const onEnd = useCallback((e: { nativeEvent: { contentOffset: { y: number } } }) => {
    const y = e.nativeEvent?.contentOffset?.y ?? 0;
    const idx = Math.round(y / ITEM_H);
    const clamped = Math.max(0, Math.min(idx, values.length - 1));
    setSelIdx(clamped);
    onValueChange(values[clamped]);
  }, [values, onValueChange]);

  const onScrollBeginDrag = useCallback(() => {
    scrollStarted.current = true;
    hideHint();
  }, [hideHint]);

  const onTouchStart = useCallback((e: { nativeEvent: { pageY: number } }) => {
    scrollStarted.current = false;
    touchStartY.current = e.nativeEvent.pageY;

    tapTimer.current = setTimeout(() => {
      if (!scrollStarted.current) {
        showSwipeHint();
      }
    }, 180);
  }, [showSwipeHint]);

  const onTouchEnd = useCallback(() => {
    if (!scrollStarted.current) {
      hideHint();
    }
  }, [hideHint]);

  return (
    <View style={[styles.container, { width, height: ITEM_H }]}>
      <View
        pointerEvents="none"
        style={[styles.hairline, { top: 0 }]}
      />
      <View
        pointerEvents="none"
        style={[styles.hairline, { bottom: 0 }]}
      />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onScroll={onScroll}
        onMomentumScrollEnd={onEnd}
        onScrollEndDrag={onEnd}
        onScrollBeginDrag={onScrollBeginDrag}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        scrollEventThrottle={16}
        nestedScrollEnabled
      >
        {values.map((val, i) => {
          const dist = Math.abs(i - selIdx);
          const isSelected = dist === 0;
          const opacity = dist === 0 ? 1 : 0;
          const fontSize = isSelected ? 22 : 16;
          const fw = isSelected ? ('800' as const) : ('400' as const);
          const displayText = formatValue ? formatValue(val) : `${val}${suffix}`;

          return (
            <View key={`${val}-${i}`} style={styles.item}>
              <Text
                style={[
                  styles.itemText,
                  {
                    fontSize,
                    opacity,
                    fontWeight: fw,
                  },
                ]}
              >
                {displayText}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {showHint && (
        <Animated.View
          pointerEvents="none"
          style={[styles.hintOverlay, { opacity: hintOpacity }]}
        >
          <Animated.View style={{ transform: [{ translateY: fingerY }] }}>
            <View style={styles.hintPill}>
              <View style={[styles.hintArrowUp, { borderBottomColor: accentColor }]} />
              <Text style={[styles.hintFinger]}>☝</Text>
              <View style={[styles.hintArrowDown, { borderTopColor: accentColor }]} />
            </View>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  hairline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    zIndex: 2,
  },
  item: {
    height: ITEM_H,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  hintOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 6,
  },
  hintPill: {
    alignItems: 'center',
    gap: 2,
  },
  hintFinger: {
    fontSize: 20,
  },
  hintArrowUp: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  hintArrowDown: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
