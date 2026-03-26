import React, { useRef, useState, useCallback, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';

interface WheelPickerProps {
  values: number[];
  selectedValue: number;
  onValueChange: (value: number) => number | void;
  width?: number;
  textColor?: string;
  mutedColor?: string;
  accentColor?: string;
  bgColor?: string;
  visibleItems?: number;
  suffix?: string;
  formatValue?: (v: number) => string;
}

const ITEM_H = 48;

function findClosestIndex(values: number[], target: number): number {
  let best = 0;
  let bestDist = Math.abs(values[0] - target);
  for (let i = 1; i < values.length; i++) {
    const d = Math.abs(values[i] - target);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

export default function WheelPicker({
  values,
  selectedValue,
  onValueChange,
  width = 80,
  suffix = '',
  formatValue,
  textColor = '#FFFFFF',
}: WheelPickerProps) {
  const scrollRef = useRef<ScrollView>(null);
  const initIndex = findClosestIndex(values, selectedValue);
  const [selIdx, setSelIdx] = useState<number>(initIndex);
  const lastEmitted = useRef<number>(-1);
  const mounted = useRef<boolean>(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: initIndex * ITEM_H, animated: false });
    }, 60);
    return () => clearTimeout(t);
  }, [initIndex]);

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

  const displayText = formatValue
    ? formatValue(values[selIdx] ?? values[0])
    : `${values[selIdx] ?? values[0]}${suffix}`;

  return (
    <View style={[styles.container, { width, height: ITEM_H }]}>
      {/* Top hairline */}
      <View pointerEvents="none" style={[styles.hairline, { top: 0 }]} />
      {/* Bottom hairline */}
      <View pointerEvents="none" style={[styles.hairline, { bottom: 0 }]} />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onScroll={onScroll}
        onMomentumScrollEnd={onEnd}
        onScrollEndDrag={onEnd}
        scrollEventThrottle={16}
        nestedScrollEnabled
      >
        {values.map((val, i) => {
          const isSelected = i === selIdx;
          const displayVal = formatValue ? formatValue(val) : `${val}${suffix}`;
          return (
            <View key={`${val}-${i}`} style={styles.item}>
              <Text
                style={[
                  styles.itemText,
                  {
                    opacity: isSelected ? 1 : 0,
                    fontSize: 22,
                    fontFamily: 'Outfit_800ExtraBold',
                    color: textColor,
                    includeFontPadding: false,
                  },
                ]}
              >
                {displayVal}
              </Text>
            </View>
          );
        })}
      </ScrollView>
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
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.14)',
    zIndex: 2,
  },
  item: {
    height: ITEM_H,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    textAlign: 'center',
    letterSpacing: -0.5,
  },
});
