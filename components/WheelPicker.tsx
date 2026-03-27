import React, { useRef, useState, useCallback, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';

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
  /** Row height for each value; snap interval. Default 48. Log sets use ~38 for a shorter wheel. */
  itemHeight?: number;
}

const DEFAULT_ITEM_H = 48;

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
  bgColor = 'rgba(0,0,0,0.25)',
  itemHeight = DEFAULT_ITEM_H,
}: WheelPickerProps) {
  const itemH = itemHeight;
  const digitSize = itemH <= 40 ? 18 : 22;
  const cornerR = itemH <= 40 ? 10 : 12;
  const scrollRef = useRef<ScrollView>(null);
  const initIndex = findClosestIndex(values, selectedValue);
  const [selIdx, setSelIdx] = useState<number>(initIndex);
  const lastEmitted = useRef<number>(-1);
  const mounted = useRef<boolean>(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: initIndex * itemH, animated: false });
    }, 60);
    return () => clearTimeout(t);
  }, [initIndex, itemH]);

  const onScroll = useCallback((e: { nativeEvent: { contentOffset: { y: number } } }) => {
    const y = e.nativeEvent?.contentOffset?.y ?? 0;
    const idx = Math.round(y / itemH);
    const clamped = Math.max(0, Math.min(idx, values.length - 1));
    if (clamped !== lastEmitted.current) {
      lastEmitted.current = clamped;
      setSelIdx(clamped);
    }
  }, [values.length, itemH]);

  const onEnd = useCallback((e: { nativeEvent: { contentOffset: { y: number } } }) => {
    const y = e.nativeEvent?.contentOffset?.y ?? 0;
    const idx = Math.round(y / itemH);
    const clamped = Math.max(0, Math.min(idx, values.length - 1));
    setSelIdx(clamped);
    onValueChange(values[clamped]);
  }, [values, onValueChange, itemH]);

  const displayText = formatValue
    ? formatValue(values[selIdx] ?? values[0])
    : `${values[selIdx] ?? values[0]}${suffix}`;

  return (
    <View style={[styles.container, { width, height: itemH, borderRadius: cornerR }]}>
      {/* Glassy wheel background */}
      <View pointerEvents="none" style={[styles.bgWrap, { backgroundColor: bgColor }]} />
      <BlurView
        pointerEvents="none"
        intensity={22}
        tint={textColor.toLowerCase() === '#ffffff' ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.specTop} />

      {/* Top hairline */}
      <View pointerEvents="none" style={[styles.hairline, { top: 0 }]} />
      {/* Bottom hairline */}
      <View pointerEvents="none" style={[styles.hairline, { bottom: 0 }]} />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemH}
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
            <View key={`${val}-${i}`} style={[styles.item, { height: itemH }]}>
              <Text
                style={[
                  styles.itemText,
                  {
                    opacity: isSelected ? 1 : 0,
                    fontSize: digitSize,
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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  bgWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  specTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    textAlign: 'center',
    letterSpacing: -0.5,
  },
});
