import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent, Animated } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';

const THUMB_W = 28;
const THUMB_H = 22;
const THUMB_SCALE_PRESSED = 34 / 28;
const THUMB_SIZE = THUMB_H;
const TRACK_HEIGHT = 4;

interface Props {
  value: number;
  minimumValue: number;
  maximumValue: number;
  onValueChange: (value: number) => void;
  minimumTrackColor: string;
  maximumTrackColor: string;
  thumbColor: string;
  step?: number;
  style?: object;
}

export default function CustomSlider({
  value,
  minimumValue,
  maximumValue,
  onValueChange,
  minimumTrackColor,
  maximumTrackColor,
  thumbColor,
  step,
  style,
}: Props) {
  const [trackWidth, setTrackWidth] = useState(0);

  const trackWidthRef = useRef(0);
  const gestureStartValue = useRef(value);
  const valueRef = useRef(value);
  const onValueChangeRef = useRef(onValueChange);
  const minimumValueRef = useRef(minimumValue);
  const maximumValueRef = useRef(maximumValue);
  const stepRef = useRef(step);

  valueRef.current = value;
  onValueChangeRef.current = onValueChange;
  minimumValueRef.current = minimumValue;
  maximumValueRef.current = maximumValue;
  stepRef.current = step;

  const thumbScale = useRef(new Animated.Value(1)).current;

  const animateIn = useCallback(() => {
    Animated.spring(thumbScale, {
      toValue: THUMB_SCALE_PRESSED,
      useNativeDriver: true,
      tension: 200,
      friction: 7,
    }).start();
  }, [thumbScale]);

  const animateOut = useCallback(() => {
    Animated.spring(thumbScale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 200,
      friction: 7,
    }).start();
  }, [thumbScale]);

  const ratio =
    trackWidth > 0
      ? Math.max(0, Math.min(1, (value - minimumValue) / (maximumValue - minimumValue)))
      : 0;

  const effectiveWidth = Math.max(1, trackWidth - THUMB_W);
  const thumbOffset = ratio * effectiveWidth;

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    trackWidthRef.current = w;
    setTrackWidth(w);
  }, []);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activeOffsetX([-3, 3])
        .failOffsetY([-8, 8])
        .onBegin(() => {
          animateIn();
        })
        .onStart(() => {
          gestureStartValue.current = valueRef.current;
        })
        .onUpdate((e) => {
          const tw = trackWidthRef.current;
          const minV = minimumValueRef.current;
          const maxV = maximumValueRef.current;
          const s = stepRef.current;
          const ew = tw - THUMB_W;
          if (ew <= 0) return;
          const startRatio = (gestureStartValue.current - minV) / (maxV - minV);
          const startOffset = Math.max(0, Math.min(ew, startRatio * ew));
          const newOffset = startOffset + e.translationX;
          const newRatio = Math.max(0, Math.min(1, newOffset / ew));
          let newVal = minV + newRatio * (maxV - minV);
          if (s && s > 0) {
            newVal = Math.round(newVal / s) * s;
          }
          onValueChangeRef.current(Math.max(minV, Math.min(maxV, newVal)));
        })
        .onEnd(() => {
          animateOut();
        })
        .onFinalize(() => {
          animateOut();
        }),
    [animateIn, animateOut]
  );

  return (
    <View style={[styles.container, style]} onLayout={onLayout}>
      <View style={styles.trackWrapper}>
        <View
          style={[
            styles.trackBg,
            {
              left: THUMB_W / 2,
              right: THUMB_W / 2,
              backgroundColor: maximumTrackColor,
            },
          ]}
        />
        <View
          style={[
            styles.trackFill,
            {
              left: THUMB_W / 2,
              width: Math.max(0, thumbOffset),
              backgroundColor: minimumTrackColor,
            },
          ]}
        />
        <GestureDetector gesture={gesture}>
          <View
            style={[
              styles.thumbHit,
              {
                left: thumbOffset - 10,
              },
            ]}
          >
            <Animated.View
              style={[
                styles.thumb,
                {
                  width: THUMB_W,
                  height: THUMB_H,
                  borderRadius: THUMB_H / 2,
                  backgroundColor: thumbColor,
                  transform: [{ scale: thumbScale }],
                },
              ]}
            />
          </View>
        </GestureDetector>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 44,
    justifyContent: 'center',
  },
  trackWrapper: {
    height: THUMB_SIZE,
    position: 'relative',
    justifyContent: 'center',
  },
  trackBg: {
    position: 'absolute',
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
  },
  trackFill: {
    position: 'absolute',
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
  },
  thumbHit: {
    position: 'absolute',
    width: THUMB_W + 20,
    height: THUMB_H + 20,
    alignItems: 'center',
    justifyContent: 'center',
    top: -(20 / 2),
  },
  thumb: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
});
