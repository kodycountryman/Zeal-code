import type { Split } from '@/types/run';

export interface HRZone {
  label: string;
  color: string;
  minPct: number; // of maxHR
  maxPct: number;
  durationSeconds: number;
  percentage: number; // of total time with HR data
}

const ZONE_DEFS = [
  { label: 'Light',     color: '#6366f1', minPct: 0.50, maxPct: 0.60 },
  { label: 'Moderate',  color: '#3b82f6', minPct: 0.60, maxPct: 0.70 },
  { label: 'Aerobic',   color: '#22c55e', minPct: 0.70, maxPct: 0.80 },
  { label: 'Threshold', color: '#f59e0b', minPct: 0.80, maxPct: 0.90 },
  { label: 'VO₂ Max',   color: '#ef4444', minPct: 0.90, maxPct: 1.10 },
];

/**
 * Compute HR zone breakdown from splits data.
 * maxHR: estimated max heart rate (220 - age, or 190 as default if unknown)
 */
export function computeHRZones(splits: Split[], maxHR: number = 190): HRZone[] {
  const splitsWithHR = splits.filter(s => s.averageHeartRate && s.averageHeartRate > 0);
  if (splitsWithHR.length === 0) return [];

  const totalDuration = splitsWithHR.reduce((s, sp) => s + sp.durationSeconds, 0);

  return ZONE_DEFS.map(def => {
    const inZone = splitsWithHR.filter(sp => {
      const pct = (sp.averageHeartRate ?? 0) / maxHR;
      return pct >= def.minPct && pct < def.maxPct;
    });
    const dur = inZone.reduce((s, sp) => s + sp.durationSeconds, 0);
    return {
      ...def,
      durationSeconds: dur,
      percentage: totalDuration > 0 ? dur / totalDuration : 0,
    };
  }).filter(z => z.durationSeconds > 0);
}

export function formatZoneDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
