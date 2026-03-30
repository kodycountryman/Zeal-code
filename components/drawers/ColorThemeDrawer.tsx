import React, { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  useWindowDimensions,
} from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { Zap, Palette } from 'lucide-react-native';
import DrawerHeader from '@/components/drawers/DrawerHeader';
import { useZealTheme, useAppContext, AppTheme } from '@/context/AppContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  visible: boolean;
  onClose: () => void;
  onBack?: () => void;
}

const THEMES: { id: AppTheme; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
  { id: 'zeal', label: 'Zeal' },
  { id: 'neon', label: 'Neon' },
];

export default function ColorThemeDrawer({ visible, onClose, onBack }: Props) {
  const { colors, accent } = useZealTheme();
  const { appTheme, setAppTheme, reflectWorkoutColor, setReflectWorkoutColor, saveState } = useAppContext();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const topOffset = Math.max(insets.top, 0) + 16;
  const { height: windowH } = useWindowDimensions();
  const maxDynamicContentSize = useMemo(() => {
    return Math.max(360, Math.min(windowH - topOffset - 24, Math.round(windowH * 0.75)));
  }, [windowH, topOffset]);
  const [contentH, setContentH] = useState(0);
  // Compute a tight snap height so the sheet never opens past content.
  const snapPoints = useMemo(() => {
    const HANDLE_EST = 24;
    const desired = contentH > 0 ? contentH + HANDLE_EST : maxDynamicContentSize;
    const clamped = Math.min(maxDynamicContentSize, Math.max(320, Math.round(desired)));
    return [clamped];
  }, [contentH, maxDynamicContentSize]);

  const [localTheme, setLocalTheme] = useState<AppTheme>(appTheme);
  const [localReflect, setLocalReflect] = useState(reflectWorkoutColor);

  useEffect(() => {
    if (visible) {
      setLocalTheme(appTheme);
      setLocalReflect(reflectWorkoutColor);
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [visible, appTheme, reflectWorkoutColor]);

  const handleDismiss = useCallback(() => {
    onClose();
  }, [onClose]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.6}
        pressBehavior="close"
      />
    ),
    []
  );

  const handleThemeSelect = (t: AppTheme) => {
    setLocalTheme(t);
    setAppTheme(t);
  };

  const handleReflectToggle = (v: boolean) => {
    setLocalReflect(v);
    setReflectWorkoutColor(v);
  };

  const handleApply = () => {
    setAppTheme(localTheme);
    setReflectWorkoutColor(localReflect);
    saveState();
    onClose();
  };

  const showReflect = localTheme === 'system' || localTheme === 'dark' || localTheme === 'light';

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      maxDynamicContentSize={maxDynamicContentSize}
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      backgroundStyle={[styles.sheetBg, { backgroundColor: colors.card }]}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
      enablePanDownToClose
      enableOverDrag={false}
      topInset={topOffset}
      stackBehavior="push"
    >
      <BottomSheetView style={styles.container} onLayout={(e) => setContentH(e.nativeEvent.layout.height)}>
        <DrawerHeader
          title="Color Theme"
          onBack={onBack}
          onClose={onBack ? undefined : onClose}
          rightContent={
            <TouchableOpacity
              style={[styles.headerApplyBtn, { backgroundColor: accent }]}
              onPress={handleApply}
              activeOpacity={0.85}
            >
              <Text style={styles.headerApplyText}>Apply</Text>
            </TouchableOpacity>
          }
        />

        <View style={styles.content}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>APP THEME</Text>

          <View style={[styles.tabStrip, { backgroundColor: colors.cardSecondary ?? colors.background ?? '#191715' }]}>
            {THEMES.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.tab,
                  localTheme === t.id && { backgroundColor: accent, borderRadius: 8 },
                ]}
                onPress={() => handleThemeSelect(t.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: localTheme === t.id ? '#fff' : colors.textSecondary },
                    localTheme === t.id && { fontWeight: '700' as const },
                  ]}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {localTheme === 'zeal' && (
            <View style={styles.themePreview}>
              <LinearGradient
                colors={['#191715', '#1f1715']}
                style={styles.zealPreview}
              >
                <View style={styles.zealCircle1} />
                <View style={styles.zealCircle2} />
                <View style={styles.zealCircle3} />
                <Text style={styles.zealPreviewText}>✦ Zeal theme: dark + gradient orbs + randomized accents</Text>
              </LinearGradient>
            </View>
          )}

          {localTheme === 'neon' && (
            <View style={styles.themePreview}>
              <LinearGradient
                colors={['#06060f', '#0d0d1e']}
                style={styles.neonPreview}
              >
                <View style={styles.neonTitleRow}>
                  <Zap size={18} color="#00e5ff" />
                  <Text style={[styles.neonPreviewText, { color: '#00e5ff' }]}>NEON</Text>
                </View>
                <Text style={styles.neonSub}>Electric cyan on deep dark</Text>
              </LinearGradient>
            </View>
          )}

          {showReflect && (
            <View style={[styles.toggleRow, { backgroundColor: colors.cardSecondary ?? colors.card }]}>
              <View style={styles.toggleInfo}>
                <Text style={[styles.toggleLabel, { color: colors.text }]}>Reflect Workout Color</Text>
                <Text style={[styles.toggleSub, { color: colors.textSecondary }]}>
                  Auto-matches accent color to your current workout style
                </Text>
              </View>
              <Switch
                value={localReflect}
                onValueChange={handleReflectToggle}
                trackColor={{ false: colors.border, true: `${accent}88` }}
                thumbColor={localReflect ? accent : colors.textSecondary}
              />
            </View>
          )}


        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetBg: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  container: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 14,
    gap: 8,
  },
  headerCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(128,128,128,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  headerApplyBtn: {
    borderRadius: 19,
    width: 80,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerApplyText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600' as const,
  },
  content: { paddingHorizontal: 20, gap: 16 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  tabStrip: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    gap: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: { fontSize: 12, fontWeight: '500' },
  themePreview: { borderRadius: 14, overflow: 'hidden' },
  zealPreview: {
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  zealCircle1: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(248,113,22,0.12)',
    top: -30,
    left: -20,
  },
  zealCircle2: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(139,92,246,0.1)',
    bottom: -20,
    right: 20,
  },
  zealCircle3: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(34,197,94,0.08)',
    top: 10,
    right: 60,
  },
  zealPreviewText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, textAlign: 'center', zIndex: 1 },
  neonPreview: {
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  neonTitleRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  neonPreviewText: { fontSize: 22, fontWeight: '900' as const, letterSpacing: 4 },
  neonSub: { color: 'rgba(200,200,255,0.5)', fontSize: 11 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  toggleInfo: { flex: 1, gap: 3 },
  toggleLabel: { fontSize: 14, fontWeight: '600' },
  toggleSub: { fontSize: 12 },
  applyBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  applyBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
