import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import * as Speech from 'expo-speech';
import BaseDrawer from '@/components/drawers/BaseDrawer';
import DrawerHeader from '@/components/drawers/DrawerHeader';
import { PlatformIcon } from '@/components/PlatformIcon';
import { useZealTheme } from '@/context/AppContext';
import { useRun } from '@/context/RunContext';
import { runAudioService } from '@/services/runAudioService';

interface Props {
  visible: boolean;
  onClose: () => void;
}

interface VoiceOption {
  identifier: string;
  name: string;
  language: string;
}

export default function RunAudioSettingsDrawer({ visible, onClose }: Props) {
  const { colors, accent, isDark } = useZealTheme();
  const run = useRun();
  const prefs = run.preferences;
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);

  // Load available voices on open
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void (async () => {
      const list = await runAudioService.getAvailableVoices();
      if (cancelled) return;
      setVoices(list.map(v => ({
        identifier: v.identifier,
        name: v.name ?? v.identifier,
        language: v.language ?? '',
      })));
    })();
    return () => { cancelled = true; };
  }, [visible]);

  const handleToggle = useCallback((key: keyof typeof prefs, value: boolean) => {
    run.updatePreferences({ [key]: value });
  }, [run]);

  const handlePickVoice = useCallback((id: string | null) => {
    setSelectedVoice(id);
    runAudioService.setVoice(id);
    // Sample the voice so the user hears it immediately
    runAudioService.speak('This is your run coach.', 'voice_preview', 0);
  }, []);

  const handleTestCue = useCallback(() => {
    runAudioService.speak(
      'Mile 1 complete. Pace 8 minutes 15 seconds. Keep it steady.',
      'test_cue',
      0,
    );
  }, []);

  const header = <DrawerHeader title="Audio Coaching" onClose={onClose} />;

  return (
    <BaseDrawer visible={visible} onClose={onClose} header={header}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Master toggle ───────────────────────────────────────── */}
        <View style={[styles.card, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
          <View style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: `${accent}20` }]}>
              <PlatformIcon name="bell" size={18} color={accent} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Audio Cues</Text>
              <Text style={[styles.rowSub, { color: colors.textMuted }]}>
                Spoken coaching while you run
              </Text>
            </View>
            <Switch
              value={prefs.audioCuesEnabled}
              onValueChange={(v) => handleToggle('audioCuesEnabled', v)}
              trackColor={{ false: colors.border, true: accent }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* ── Per-cue toggles (disabled when master is off) ───────── */}
        <View style={[styles.card, { backgroundColor: colors.cardSecondary, borderColor: colors.border, opacity: prefs.audioCuesEnabled ? 1 : 0.5 }]}>
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>WHAT TO ANNOUNCE</Text>

          <ToggleRow
            label="Splits"
            description="Mile/km summary with pace"
            value={prefs.audioCueSplits}
            disabled={!prefs.audioCuesEnabled}
            onValueChange={(v) => handleToggle('audioCueSplits', v)}
          />
          <Divider />
          <ToggleRow
            label="Pace alerts"
            description="When you're off your target pace"
            value={prefs.audioCuePace}
            disabled={!prefs.audioCuesEnabled}
            onValueChange={(v) => handleToggle('audioCuePace', v)}
          />
          <Divider />
          <ToggleRow
            label="Heart rate alerts"
            description="When HR exceeds your top zone"
            value={prefs.audioCueHeartRate}
            disabled={!prefs.audioCuesEnabled}
            onValueChange={(v) => handleToggle('audioCueHeartRate', v)}
          />
        </View>

        {/* ── Voice picker ────────────────────────────────────────── */}
        {voices.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
            <Text style={[styles.cardLabel, { color: colors.textMuted }]}>VOICE</Text>
            <View style={{ gap: 6 }}>
              <TouchableOpacity
                style={[
                  styles.voiceRow,
                  { borderColor: selectedVoice === null ? accent : colors.border, backgroundColor: selectedVoice === null ? `${accent}10` : 'transparent' },
                ]}
                onPress={() => handlePickVoice(null)}
                activeOpacity={0.7}
              >
                <Text style={[styles.voiceName, { color: selectedVoice === null ? accent : colors.text }]}>System Default</Text>
                {selectedVoice === null && <PlatformIcon name="check" size={16} color={accent} />}
              </TouchableOpacity>
              {voices.map((v) => {
                const active = selectedVoice === v.identifier;
                return (
                  <TouchableOpacity
                    key={v.identifier}
                    style={[
                      styles.voiceRow,
                      { borderColor: active ? accent : colors.border, backgroundColor: active ? `${accent}10` : 'transparent' },
                    ]}
                    onPress={() => handlePickVoice(v.identifier)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.voiceName, { color: active ? accent : colors.text }]} numberOfLines={1}>{v.name}</Text>
                      <Text style={[styles.voiceLang, { color: colors.textMuted }]}>{v.language}</Text>
                    </View>
                    {active && <PlatformIcon name="check" size={16} color={accent} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Test cue button ─────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.testButton, { backgroundColor: accent, opacity: prefs.audioCuesEnabled ? 1 : 0.5 }]}
          onPress={handleTestCue}
          disabled={!prefs.audioCuesEnabled}
          activeOpacity={0.85}
        >
          <PlatformIcon name="bell" size={16} color="#fff" />
          <Text style={styles.testButtonText}>Test Cue</Text>
        </TouchableOpacity>

        <View style={[styles.infoBox, { backgroundColor: isDark ? 'rgba(96,165,250,0.06)' : 'rgba(96,165,250,0.08)', borderColor: 'rgba(96,165,250,0.25)' }]}>
          <PlatformIcon name="info" size={14} color="#60a5fa" />
          <Text style={[styles.infoBoxText, { color: colors.textSecondary }]}>
            Music from Spotify, Apple Music, or Podcasts will duck briefly during cues, then resume.
          </Text>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </BaseDrawer>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const { colors, accent } = useZealTheme();
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.rowSub, { color: colors.textMuted }]}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: accent }}
        thumbColor="#fff"
      />
    </View>
  );
}

function Divider() {
  const { colors } = useZealTheme();
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
  },
  card: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  cardLabel: {
    fontSize: 10,
    fontFamily: 'Outfit_700Bold',
    letterSpacing: 0.8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
  },
  rowSub: {
    fontSize: 11,
    fontFamily: 'Outfit_400Regular',
    lineHeight: 15,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 2,
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  voiceName: {
    fontSize: 14,
    fontFamily: 'Outfit_600SemiBold',
  },
  voiceLang: {
    fontSize: 11,
    fontFamily: 'Outfit_400Regular',
    marginTop: 1,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  testButtonText: {
    fontSize: 14,
    fontFamily: 'Outfit_700Bold',
    color: '#fff',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'Outfit_400Regular',
    lineHeight: 16,
  },
});
