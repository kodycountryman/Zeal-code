import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Alert,
} from 'react-native';
import BaseDrawer from '@/components/drawers/BaseDrawer';
import DrawerHeader from '@/components/drawers/DrawerHeader';
import { useZealTheme } from '@/context/AppContext';
import { PlatformIcon } from '@/components/PlatformIcon';
import {
  startRecording,
  stopRecording,
  analyzeVoiceFood,
} from '@/services/voiceFoodScanner';
import type { AIFoodResult } from '@/services/aiFoodScanner';

type RecordingState = 'idle' | 'recording' | 'analyzing';

interface Props {
  visible: boolean;
  onClose: () => void;
  onResult: (result: AIFoodResult) => void;
}

export default function VoiceFoodSheet({ visible, onClose, onResult }: Props) {
  const { colors, accent, isDark } = useZealTheme();
  const [state, setState] = useState<RecordingState>('idle');
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  // ── Pulse animation for recording state ──
  useEffect(() => {
    if (state === 'recording') {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }

    return () => {
      pulseLoop.current?.stop();
    };
  }, [state, pulseAnim]);

  // Reset state when sheet closes
  useEffect(() => {
    if (!visible) setState('idle');
  }, [visible]);

  const handleMicPress = useCallback(async () => {
    if (state === 'analyzing') return;

    if (state === 'idle') {
      // Start recording
      try {
        await startRecording();
        setState('recording');
      } catch (e: any) {
        Alert.alert('Microphone Error', e.message || 'Could not start recording.');
      }
    } else if (state === 'recording') {
      // Stop recording and analyze
      setState('analyzing');
      try {
        const uri = await stopRecording();
        if (!uri) {
          Alert.alert('Error', 'No audio was recorded. Please try again.');
          setState('idle');
          return;
        }

        const result = await analyzeVoiceFood(uri);
        onResult(result);
        onClose();
      } catch (e) {
        __DEV__ && console.error('[VoiceFoodSheet] Error:', e);
        Alert.alert('Analysis Failed', 'Could not analyze the recording. Please try again.');
        setState('idle');
      }
    }
  }, [state, onResult, onClose]);

  const handleClose = useCallback(async () => {
    if (state === 'recording') {
      await stopRecording();
    }
    setState('idle');
    onClose();
  }, [state, onClose]);

  const stateLabel =
    state === 'idle' ? 'Tap to start recording'
    : state === 'recording' ? 'Listening... tap to stop'
    : 'Analyzing your meal...';

  const micColor =
    state === 'recording' ? '#ef4444'
    : state === 'analyzing' ? colors.textMuted
    : accent;

  return (
    <BaseDrawer
      visible={visible}
      onClose={handleClose}
      snapPoints={['45%']}
      header={
        <DrawerHeader title="Voice Log" onClose={handleClose} />
      }
    >
      <View style={styles.content}>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Describe everything you ate and drank.{'\n'}
          Include quantities if you can.
        </Text>

        {/* Mic Button */}
        <View style={styles.micWrap}>
          <Animated.View
            style={[
              styles.pulseRing,
              {
                backgroundColor: state === 'recording' ? 'rgba(239,68,68,0.12)' : 'transparent',
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
          <TouchableOpacity
            style={[
              styles.micBtn,
              {
                backgroundColor: state === 'analyzing'
                  ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)')
                  : micColor + '18',
              },
            ]}
            onPress={handleMicPress}
            activeOpacity={0.7}
            disabled={state === 'analyzing'}
          >
            {state === 'analyzing' ? (
              <PlatformIcon name="sparkles" size={36} color={colors.textMuted} />
            ) : (
              <PlatformIcon
                name={state === 'recording' ? 'pause' : 'message-circle'}
                size={36}
                color={micColor}
              />
            )}
          </TouchableOpacity>
        </View>

        <Text style={[styles.stateLabel, { color: state === 'recording' ? '#ef4444' : colors.textMuted }]}>
          {stateLabel}
        </Text>

        {state === 'idle' && (
          <Text style={[styles.example, { color: colors.textMuted }]}>
            Example: "I had two scrambled eggs, a piece of toast{'\n'}with butter, and a glass of orange juice"
          </Text>
        )}
      </View>
    </BaseDrawer>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 20,
  },
  hint: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  micWrap: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  micBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateLabel: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    textAlign: 'center',
  },
  example: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    fontStyle: 'italic',
  },
});
