import React, { useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ZEAL_ACCENT_COLORS } from '@/constants/colors';

const { width, height } = Dimensions.get('window');

function getDayCircles() {
  const day = new Date().getDate();
  const seed = day * 31;
  const circles = [];
  const positions = [
    { top: -60, left: -80 },
    { top: height * 0.3, right: -100, left: undefined },
    { top: height * 0.6, left: width * 0.2 },
    { bottom: 80, right: -60, top: undefined, left: undefined },
    { top: height * 0.15, left: width * 0.6 },
  ];
  for (let i = 0; i < 5; i++) {
    const colorIdx = (seed + i * 7) % ZEAL_ACCENT_COLORS.length;
    const size = 160 + ((seed + i * 13) % 120);
    circles.push({
      ...positions[i],
      size,
      color: ZEAL_ACCENT_COLORS[colorIdx],
    });
  }
  return circles;
}

export default function ZealBackground() {
  const circles = useRef(getDayCircles()).current;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {circles.map((c, i) => (
        <View
          key={i}
          style={[
            styles.circle,
            {
              width: c.size,
              height: c.size,
              borderRadius: c.size / 2,
              top: c.top,
              left: c.left,
              right: (c as any).right,
              bottom: (c as any).bottom,
            },
          ]}
        >
          <LinearGradient
            colors={[`${c.color}08`, 'transparent']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0.3, y: 0.3 }}
            end={{ x: 1, y: 1 }}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    position: 'absolute',
    overflow: 'hidden',
  },
});
