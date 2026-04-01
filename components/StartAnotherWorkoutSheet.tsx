import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useZealTheme, useAppContext } from '@/context/AppContext';
import { WORKOUT_STYLE_COLORS, TRAINING_SPLITS } from '@/constants/colors';
import { WORKOUT_STYLE_KEYS as STYLE_OPTIONS } from '@/constants/workoutStyles';
import { SESSION_DURATION_OPTIONS as DURATION_CHIPS } from '@/services/planConstants';
import { useSheetAnimation } from '@/hooks/useSheetAnimation';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called after the override is applied — use to navigate or trigger regen */
  onComplete?: () => void;
}

export default function StartAnotherWorkoutSheet({ visible, onClose, onComplete }: Props) {
  const { colors } = useZealTheme();
  const ctx = useAppContext();

  const [step, setStep] = useState(1);
  const [duration, setDuration] = useState(60);
  const [style, setStyle] = useState('Strength');
  const [split, setSplit] = useState('');

  const splitOptions = useMemo(() => TRAINING_SPLITS[style] ?? ['Full Body'], [style]);

  const reset = useCallback(() => {
    setStep(1);
    setDuration(60);
    setStyle('Strength');
    setSplit('');
  }, []);

  const { backdropStyle, sheetStyle, onClose: animClose, panHandlers } = useSheetAnimation(visible, () => {
    onClose();
    setTimeout(reset, 50);
  });

  const handleLetsGo = useCallback(() => {
    const finalSplit = split || splitOptions[0] || 'Full Body';
    ctx.applyWorkoutOverride({
      style,
      split: finalSplit,
      duration,
      rest: ctx.restBetweenSets,
      muscles: [],
      setDate: new Date().toISOString().slice(0, 10),
    });
    animClose();
    onComplete?.();
  }, [style, split, duration, splitOptions, ctx, animClose, onComplete]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={animClose}
      statusBarTranslucent
    >
      {/* Backdrop — fades independently */}
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={animClose} activeOpacity={1} />
      </Animated.View>

      {/* Sheet — slides up independently */}
      <Animated.View style={[styles.sheetWrap, sheetStyle]}>
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} {...panHandlers} />
          <TouchableOpacity style={styles.closeBtn} onPress={animClose} activeOpacity={0.7}>
            <X size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Step 1 — Duration */}
          {step === 1 && (
            <View style={styles.content}>
              <Text style={[styles.title, { color: colors.text }]}>How long?</Text>
              <View style={styles.chipRow}>
                {DURATION_CHIPS.map(d => (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.durationChip,
                      { borderColor: duration === d ? '#f87116' : colors.border },
                      duration === d && { backgroundColor: '#f8711615' },
                    ]}
                    onPress={() => setDuration(d)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.durationChipText, { color: duration === d ? '#f87116' : colors.text }]}>
                      {d} min
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(2)} activeOpacity={0.85}>
                <Text style={styles.nextBtnText}>Next</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Step 2 — Style */}
          {step === 2 && (
            <View style={styles.content}>
              <Text style={[styles.title, { color: colors.text }]}>What type?</Text>
              <View style={styles.styleGrid}>
                {STYLE_OPTIONS.map(s => {
                  const sColor = WORKOUT_STYLE_COLORS[s] ?? '#f87116';
                  const isSelected = style === s;
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[
                        styles.styleChip,
                        { borderColor: isSelected ? sColor : colors.border },
                        isSelected && { backgroundColor: `${sColor}18` },
                      ]}
                      onPress={() => { setStyle(s); setSplit(''); }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.styleChipDot, { backgroundColor: sColor }]} />
                      <Text style={[styles.styleChipText, { color: isSelected ? sColor : colors.text }]}>{s}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(3)} activeOpacity={0.85}>
                <Text style={styles.nextBtnText}>Next</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Step 3 — Split/Focus */}
          {step === 3 && (
            <View style={styles.content}>
              <Text style={[styles.title, { color: colors.text }]}>Focus?</Text>
              <View style={styles.styleGrid}>
                {splitOptions.map(sp => {
                  const isSelected = split === sp || (!split && sp === splitOptions[0]);
                  return (
                    <TouchableOpacity
                      key={sp}
                      style={[
                        styles.splitChip,
                        { borderColor: isSelected ? '#f87116' : colors.border },
                        isSelected && { backgroundColor: '#f8711615' },
                      ]}
                      onPress={() => setSplit(sp)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.splitChipText, { color: isSelected ? '#f87116' : colors.text }]}>{sp}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity style={styles.nextBtn} onPress={handleLetsGo} activeOpacity={0.85}>
                <Text style={styles.nextBtnText}>Let&apos;s Go</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheetWrap: {
    flex: 1,
    justifyContent: 'flex-end' as const,
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 22,
    paddingBottom: 44,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center' as const,
    marginBottom: 16,
  },
  closeBtn: {
    position: 'absolute' as const,
    top: 22,
    right: 22,
    zIndex: 10,
  },
  content: {
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: -0.5,
  },
  chipRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 10,
  },
  durationChip: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: 'center' as const,
  },
  durationChipText: {
    fontSize: 15,
    fontFamily: 'Outfit_600SemiBold',
  },
  styleGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  styleChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  styleChipDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  styleChipText: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
  },
  splitChip: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  splitChipText: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
  },
  nextBtn: {
    backgroundColor: '#f87116',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center' as const,
  },
  nextBtnText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Outfit_700Bold',
  },
});
