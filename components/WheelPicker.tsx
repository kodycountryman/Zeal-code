import React, { useRef, useState, useCallback, useEffect } from 'react';
import { FlatList, View, Text } from 'react-native';
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
  const listRef = useRef<FlatList>(null);
  const initIndex = findClosestIndex(values, selectedValue);
  const [selIdx, setSelIdx] = useState<number>(initIndex);
  const lastEmitted = useRef<number>(-1);

  const padding = ITEM_H * Math.floor(visibleItems / 2);
  const containerH = ITEM_H * visibleItems;

  // O(1) layout — required for accurate scrollToOffset and virtualization
  const getItemLayout = useCallback((_: any, index: number) => ({
    length: ITEM_H,
    offset: ITEM_H * index,
    index,
  }), []);


  // Re-snap when selectedValue changes externally — always instant, no animation
  useEffect(() => {
    const idx = findClosestIndex(values, selectedValue);
    setSelIdx(idx);
    listRef.current?.scrollToOffset({ offset: idx * ITEM_H, animated: false });
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

  const renderItem = useCallback(({ item: val, index: i }: { item: number; index: number }) => {
    const dist = Math.abs(i - selIdx);
    const opacity = dist === 0 ? 1 : dist === 1 ? 0.35 : 0;
    const fontSize = dist === 0 ? 22 : 16;
    const fontWeight = dist === 0 ? ('800' as const) : ('400' as const);
    const displayText = formatValue ? formatValue(val) : `${val}${suffix}`;
    return (
      <View style={{ height: ITEM_H, justifyContent: 'center', alignItems: 'center' }}>
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
  }, [selIdx, formatValue, suffix, textColor]);

  const Spacer = useCallback(() => <View style={{ height: padding }} />, [padding]);

  const containerStyle = width
    ? { width, height: containerH, overflow: 'hidden' as const }
    : { alignSelf: 'stretch' as const, height: containerH, overflow: 'hidden' as const };

  const fadeColor = bgColor ?? 'transparent';

  return (
    <View style={[containerStyle, bgColor ? { backgroundColor: bgColor } : undefined]}>
      <FlatList
        ref={listRef}
        data={values}
        keyExtractor={(_, i) => String(i)}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        initialScrollIndex={initIndex}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate={0.993}
        onScroll={onScroll}
        onMomentumScrollEnd={onEnd}
        onScrollEndDrag={onEnd}
        scrollEventThrottle={16}
        nestedScrollEnabled
        ListHeaderComponent={Spacer}
        ListFooterComponent={Spacer}
        // Keep only the visible window + a small buffer — anything beyond is unmounted
        windowSize={5}
        initialNumToRender={visibleItems + 2}
        maxToRenderPerBatch={visibleItems + 2}
        removeClippedSubviews={false}
      />

      {/* Fade gradients — only when there are adjacent rows visible to fade */}
      {visibleItems > 1 && (
        <>
          <LinearGradient
            colors={[fadeColor, 'transparent']}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: ITEM_H, zIndex: 3 }}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['transparent', fadeColor]}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: ITEM_H, zIndex: 3 }}
            pointerEvents="none"
          />
        </>
      )}
    </View>
  );
}
