import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import BaseDrawer from '@/components/drawers/BaseDrawer';
import CustomSlider from '@/components/CustomSlider';
import { useAppContext, useZealTheme } from '@/context/AppContext';
import { PlatformIcon } from '@/components/PlatformIcon';

// ── colour helper (red → yellow → green) ──────────────────────────────────
function readinessColor(value: number): string {
  const t = Math.max(0, Math.min(100, value)) / 100;
  let r: number, g: number, b: number;
  if (t <= 0.5) {
    const s = t / 0.5;
    r = Math.round(239 + (234 - 239) * s);
    g = Math.round(68  + (179 - 68)  * s);
    b = Math.round(68  + (8   - 68)  * s);
  } else {
    const s = (t - 0.5) / 0.5;
    r = Math.round(234 + (34  - 234) * s);
    g = Math.round(179 + (197 - 179) * s);
    b = Math.round(8   + (94  - 8)   * s);
  }
  return `rgb(${r},${g},${b})`;
}

// ── drawer ─────────────────────────────────────────────────────────────────
interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function MuscleReadinessDrawer({ visible, onClose }: Props) {
  const ctx = useAppContext();
  const { colors, isDark } = useZealTheme();

  const [editing, setEditing] = useState(false);
  const [localValues, setLocalValues] = useState<Record<string, number>>({});

  const muscles = ctx.muscleReadiness;

  const liveValues = (name: string) =>
    editing ? (localValues[name] ?? 100) : (muscles.find(m => m.name === name)?.value ?? 100);

  const liveOverall = editing
    ? Math.round(Object.values(localValues).reduce((a, b) => a + b, 0) / Math.max(1, Object.values(localValues).length))
    : Math.round(muscles.reduce((s, m) => s + m.value, 0) / Math.max(1, muscles.length));

  const overallColor = readinessColor(liveOverall);

  const startEdit = useCallback(() => {
    const map: Record<string, number> = {};
    ctx.muscleReadiness.forEach(m => { map[m.name] = m.value; });
    setLocalValues(map);
    setEditing(true);
  }, [ctx.muscleReadiness]);

  const saveEdit = useCallback(() => {
    const updated = ctx.muscleReadiness.map(m => {
      const v = Math.round(localValues[m.name] ?? m.value);
      const status: 'ready' | 'building' | 'recovering' =
        v >= 70 ? 'ready' : v >= 40 ? 'building' : 'recovering';
      return { ...m, value: v, status };
    });
    ctx.setMuscleReadiness(updated);
    setEditing(false);
  }, [ctx, localValues]);

  const handleChange = useCallback((name: string, v: number) => {
    setLocalValues(prev => ({ ...prev, [name]: Math.round(v) }));
  }, []);

  // ── header ──
  const header = (
    <View style={styles.header}>
      <Text style={[styles.title, { color: colors.text }]}>MUSCLE READINESS</Text>
      {editing ? (
        <TouchableOpacity
          style={[styles.editBtn, { backgroundColor: '#22c55e22', borderColor: '#22c55e44' }]}
          onPress={saveEdit}
          activeOpacity={0.7}
        >
          <PlatformIcon name="check" size={13} color="#22c55e" strokeWidth={2.5} />
          <Text style={[styles.editBtnText, { color: '#22c55e' }]}>Done</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.editBtn, { backgroundColor: `${colors.textMuted}18`, borderColor: `${colors.textMuted}30` }]}
          onPress={startEdit}
          activeOpacity={0.7}
        >
          <PlatformIcon name="pencil" size={12} color={colors.textMuted} strokeWidth={2} />
          <Text style={[styles.editBtnText, { color: colors.textMuted }]}>Edit</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <BaseDrawer
      visible={visible}
      onClose={() => { setEditing(false); onClose(); }}
      header={header}
      snapPoints={['92%']}
    >
      <View style={styles.body}>

        {/* Overall bar */}
        <View style={[styles.overallCard, {
          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        }]}>
          <View style={styles.overallRow}>
            <Text style={[styles.overallLabel, { color: colors.textMuted }]}>OVERALL</Text>
            <Text style={[styles.overallValue, { color: overallColor }]}>{liveOverall}%</Text>
          </View>
          <View style={styles.overallTrack}>
            <View style={[styles.overallFill, { width: `${liveOverall}%` as any, backgroundColor: overallColor }]} />
          </View>
        </View>

        {/* Muscle rows */}
        {muscles.map(m => {
          const val = liveValues(m.name);
          const color = readinessColor(val);
          return (
            <View
              key={m.name}
              style={[styles.muscleRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }]}
            >
              {/* Name + last worked */}
              <View style={styles.muscleLeft}>
                <Text style={[styles.muscleName, { color: colors.text }]}>{m.name}</Text>
                <Text style={[styles.muscleLastWorked, { color: colors.textMuted }]}>{m.lastWorked}</Text>
              </View>

              {/* Bar or slider + value */}
              <View style={styles.muscleRight}>
                {editing ? (
                  <CustomSlider
                    value={val}
                    minimumValue={0}
                    maximumValue={100}
                    step={1}
                    minimumTrackColor={color}
                    maximumTrackColor={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}
                    thumbColor={color}
                    onValueChange={v => handleChange(m.name, v)}
                    style={styles.slider}
                  />
                ) : (
                  <View style={styles.staticTrack}>
                    <View style={[styles.staticFill, { width: `${val}%` as any, backgroundColor: color }]} />
                  </View>
                )}
                <Text style={[styles.muscleVal, { color }]}>{val}%</Text>
              </View>
            </View>
          );
        })}

        {editing && (
          <Text style={[styles.editHint, { color: colors.textMuted }]}>
            Drag each bar to adjust readiness
          </Text>
        )}

      </View>
    </BaseDrawer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  body: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  overallCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  overallRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  overallLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  overallValue: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  overallTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  overallFill: {
    height: '100%',
    borderRadius: 3,
  },
  muscleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  muscleLeft: {
    width: 88,
    gap: 2,
  },
  muscleName: {
    fontSize: 14,
    fontWeight: '600',
  },
  muscleLastWorked: {
    fontSize: 10,
    fontWeight: '500',
  },
  muscleRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  staticTrack: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  staticFill: {
    height: '100%',
    borderRadius: 3,
  },
  slider: {
    flex: 1,
  },
  muscleVal: {
    fontSize: 13,
    fontWeight: '700',
    minWidth: 36,
    textAlign: 'right',
  },
  editHint: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 20,
    fontWeight: '500',
  },
});
