import React, { useRef, useEffect, useState } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  mediaUrl?: string;
  exerciseName: string;
  cardBg: string;
}

export default function ExerciseAnimationView({ mediaUrl, exerciseName, cardBg }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const hasMedia = !!mediaUrl;
  const gradientColors: [string, string] = [`${cardBg}00`, cardBg];

  if (!hasMedia || failed) {
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

  return (
    <View style={styles.container}>
      {!loaded && <SkeletonPulse />}
      <Image
        source={{ uri: mediaUrl }}
        style={styles.image}
        contentFit="cover"
        transition={300}
        cachePolicy="disk"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        accessibilityLabel={exerciseName}
        autoplay={true}
      />
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
    aspectRatio: 1,
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
