import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const EXERCISE_DB_BASE =
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

function toFolder(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, '_')
    .replace(/\//g, '_')
    .replace(/&/g, 'and')
    .replace(/'/g, '')
    .replace(/,/g, '');
}

function nameVariants(exerciseName: string): string[] {
  const base = exerciseName.trim();
  const noParens = base.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  const noPunct = base.replace(/[(),']/g, '').replace(/\s+/g, ' ').trim();
  const noEquipPrefix = base
    .replace(/^(barbell|dumbbell|cable|machine|ez-bar|ez bar|smith machine|resistance band|band|kettlebell|trap bar|hex bar)\s+/i, '')
    .trim();
  const titleCase = (s: string) =>
    s.replace(/\b\w/g, (c) => c.toUpperCase());

  const variants: string[] = [
    toFolder(base),
    toFolder(noParens),
    toFolder(noPunct),
    toFolder(noEquipPrefix),
    toFolder(titleCase(base.toLowerCase())),
    toFolder(titleCase(noParens.toLowerCase())),
    toFolder(titleCase(noPunct.toLowerCase())),
    toFolder(titleCase(noEquipPrefix.toLowerCase())),
    toFolder(base.toLowerCase()),
    toFolder(noParens.toLowerCase()),
    toFolder(noPunct.toLowerCase()),
    toFolder(noEquipPrefix.toLowerCase()),
  ];

  return [...new Set(variants)];
}

function getUrl(folder: string, index: 0 | 1): string {
  return `${EXERCISE_DB_BASE}${encodeURIComponent(folder)}/${index}.jpg`;
}

interface Props {
  exerciseName: string;
  exerciseId?: string;
  aliases?: string[];
  cardBg: string;
}

export default function ExerciseAnimationView({ exerciseName, exerciseId, aliases, cardBg }: Props) {
  const candidates = [
    exerciseName,
    ...(exerciseId ? [exerciseId] : []),
    ...(aliases ?? []),
  ].filter(Boolean) as string[];

  const variants = [...new Set(candidates.flatMap((c) => nameVariants(c)))];
  const [variantIdx, setVariantIdx] = useState(0);
  const [img0Loaded, setImg0Loaded] = useState(false);
  const [img1Loaded, setImg1Loaded] = useState(false);
  const [img0Error, setImg0Error] = useState(false);
  const [img1Error, setImg1Error] = useState(false);
  const [allFailed, setAllFailed] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<ReturnType<typeof Animated.loop> | null>(null);

  const folder = variants[variantIdx] ?? '';
  const url0 = getUrl(folder, 0);
  const url1 = getUrl(folder, 1);

  const resetForVariant = useCallback(() => {
    setImg0Loaded(false);
    setImg1Loaded(false);
    setImg0Error(false);
    setImg1Error(false);
    loopRef.current?.stop();
    loopRef.current = null;
    fadeAnim.setValue(0);
  }, [fadeAnim]);

  const handleImg0Error = useCallback(() => {
    setImg0Error(true);
    const next = variantIdx + 1;
    if (next < variants.length) {
      resetForVariant();
      setVariantIdx(next);
    } else {
      setAllFailed(true);
    }
  }, [variantIdx, variants.length, resetForVariant]);

  const startLoop = useCallback(() => {
    loopRef.current?.stop();
    loopRef.current = null;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(800),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.delay(800),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );
    loopRef.current = loop;
    loop.start();
  }, [fadeAnim]);

  useEffect(() => {
    if (img0Loaded && img1Loaded) {
      startLoop();
    } else if (img0Loaded && img1Error) {
      loopRef.current?.stop();
      loopRef.current = null;
      fadeAnim.setValue(0);
    }
    return () => {
      loopRef.current?.stop();
    };
  }, [img0Loaded, img1Loaded, img1Error, startLoop, fadeAnim]);

  useEffect(() => {
    return () => {
      loopRef.current?.stop();
    };
  }, []);

  const img0Opacity = fadeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  const gradientColors: [string, string] = [`${cardBg}00`, cardBg];

  if (allFailed) {
    return (
      <View style={styles.fallback}>
        <LinearGradient
          colors={['#1a1a1a', '#0d0d0d']}
          style={StyleSheet.absoluteFillObject}
        />
        <LinearGradient
          colors={gradientColors}
          style={styles.bottomGradient}
          pointerEvents="none"
        />
      </View>
    );
  }

  const showSkeleton = !img0Loaded && !img0Error;

  return (
    <View style={styles.container}>
      {showSkeleton && <SkeletonPulse />}

      {!img0Error && (
        <Animated.Image
          key={`img0-${variantIdx}`}
          source={{ uri: url0 }}
          style={[
            styles.image,
            { opacity: img0Loaded ? img0Opacity : 0 },
          ]}
          resizeMode="cover"
          onLoad={() => setImg0Loaded(true)}
          onError={handleImg0Error}
        />
      )}

      {!img1Error && img0Loaded && (
        <Animated.Image
          key={`img1-${variantIdx}`}
          source={{ uri: url1 }}
          style={[
            styles.absoluteFill,
            { opacity: img0Loaded && img1Loaded ? fadeAnim : 0 },
          ]}
          resizeMode="cover"
          onLoad={() => setImg1Loaded(true)}
          onError={() => setImg1Error(true)}
        />
      )}

      <LinearGradient
        colors={gradientColors}
        style={styles.bottomGradient}
        pointerEvents="none"
      />
    </View>
  );
}

function SkeletonPulse() {
  const pulse = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.7,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.3,
          duration: 400,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  return (
    <Animated.View style={[styles.skeleton, { opacity: pulse }]} />
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#111111',
    marginBottom: 12,
  },
  fallback: {
    width: '100%',
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  absoluteFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  skeleton: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#222222',
    borderRadius: 16,
  },
  bottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 70,
  },
});
