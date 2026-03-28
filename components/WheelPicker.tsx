import React, { useRef, useState, useCallback, useEffect } from 'react';
import { ScrollView, View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

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
  itemHeight?: number;
}

const ITEM_H = 44;

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
  width,
  visibleItems = 3,
  suffix = '',
  formatValue,
  textColor = '#fff',
  bgColor,
}: WheelPickerProps) {
  const scrollRef = useRef<ScrollView>(null);
  const initIndex = findClosestIndex(values, selectedValue);
  const [selIdx, setSelIdx] = useState<number>(initIndex);
  const lastEmitted = useRef<number>(-1);
  const mounted = useRef<boolean>(false);

  const padding = ITEM_H * Math.floor(visibleItems / 2);
  const containerH = ITEM_H * visibleItems;

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: initIndex * ITEM_H, animated: false });
    }, 60);
    return () => clearTimeout(t);
  }, [initIndex]);

  // Re-snap when selectedValue changes externally (e.g. switching chips) — always instant, no animation
  useEffect(() => {
    const idx = findClosestIndex(values, selectedValue);
    setSelIdx(idx);
    scrollRef.current?.scrollTo({ y: idx * ITEM_H, animated: false });
  }, [selectedValue, values]);

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

  const containerStyle = width
    ? { width, height: containerH, overflow: 'hidden' as const }
    : { alignSelf: 'stretch' as const, height: containerH, overflow: 'hidden' as const };

  const fadeColor = bgColor ?? 'transparent';

  return (
    <View style={[containerStyle, bgColor ? { backgroundColor: bgColor } : undefined]}>
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
        <View style={{ height: padding }} />
        {values.map((val, i) => {
          const dist = Math.abs(i - selIdx);
          const opacity = dist === 0 ? 1 : dist === 1 ? 0.35 : 0;
          const fontSize = dist === 0 ? 22 : 16;
          const fontWeight = dist === 0 ? ('800' as const) : ('400' as const);
          const displayText = formatValue ? formatValue(val) : `${val}${suffix}`;
          return (
            <View key={`${val}-${i}`} style={{ height: ITEM_H, justifyContent: 'center', alignItems: 'center' }}>
              <Text
                style={{
                  fontSize,
                  opacity,
                  fontWeight,
                  color: textColor,
                  textAlign: 'center',
                  letterSpacing: -0.3,
                }}
              >
                {displayText}
              </Text>
            </View>
          );
        })}
        <View style={{ height: padding }} />
      </ScrollView>

      {/* Top fade */}
      <LinearGradient
        colors={[fadeColor, 'transparent']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: ITEM_H, zIndex: 3 }}
        pointerEvents="none"
      />
      {/* Bottom fade */}
      <LinearGradient
        colors={['transparent', fadeColor]}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: ITEM_H, zIndex: 3 }}
        pointerEvents="none"
      />
    </View>
  );
}
