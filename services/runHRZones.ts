/**
 * Heart Rate Zones
 *
 * Auto-calculates 5 training zones from a max HR (either user-supplied or
 * derived from `220 - age`). Aggregates time-in-zone across a run history
 * using per-split average HRs (when available).
 *
 * Zone definitions (% of max HR):
 *   1. Recovery       50-60%
 *   2. Aerobic Base   60-70%
 *   3. Tempo          70-80%
 *   4. Threshold      80-90%
 *   5. VO2max         90-100%
 */

import { RunLog } from '@/types/run';

export type ZoneNumber = 1 | 2 | 3 | 4 | 5;

export interface HRZone {
  zone: ZoneNumber;
  name: string;
  pctRangeLow: number;   // e.g. 0.5
  pctRangeHigh: number;  // e.g. 0.6
  bpmLow: number;
  bpmHigh: number;
  description: string;
  color: string;
}

const ZONE_DEFINITIONS: Omit<HRZone, 'bpmLow' | 'bpmHigh'>[] = [
  { zone: 1, name: 'Recovery',     pctRangeLow: 0.50, pctRangeHigh: 0.60, description: 'Easy recovery — barely working',         color: '#60a5fa' },
  { zone: 2, name: 'Aerobic Base', pctRangeLow: 0.60, pctRangeHigh: 0.70, description: 'Conversational pace, fat burning',       color: '#22c55e' },
  { zone: 3, name: 'Tempo',        pctRangeLow: 0.70, pctRangeHigh: 0.80, description: 'Comfortably hard, sustained effort',      color: '#eab308' },
  { zone: 4, name: 'Threshold',    pctRangeLow: 0.80, pctRangeHigh: 0.90, description: 'Lactate threshold, hard breathing',       color: '#f97316' },
  { zone: 5, name: 'VO2max',       pctRangeLow: 0.90, pctRangeHigh: 1.00, description: 'Maximum effort, all-out',                 color: '#ef4444' },
];

/**
 * Given max HR, return the 5 zone definitions with absolute BPM ranges.
 */
export function buildZones(maxHR: number): HRZone[] {
  if (maxHR <= 0) return [];
  return ZONE_DEFINITIONS.map(z => ({
    ...z,
    bpmLow: Math.round(maxHR * z.pctRangeLow),
    bpmHigh: Math.round(maxHR * z.pctRangeHigh),
  }));
}

/**
 * Estimate max HR from age. Standard 220-age formula. Returns null if no age.
 * Falls back gracefully — the user can override in settings.
 */
export function estimateMaxHR(age: number | null | undefined): number | null {
  if (!age || age <= 0 || age > 100) return null;
  return 220 - age;
}

/** Convert a BPM into its zone (1-5) given max HR. Returns null if no max HR. */
export function bpmToZone(bpm: number, maxHR: number): ZoneNumber | null {
  if (!maxHR || maxHR <= 0 || bpm <= 0) return null;
  const pct = bpm / maxHR;
  if (pct < 0.50) return 1; // anything below zone 1 still counts as recovery
  if (pct < 0.60) return 1;
  if (pct < 0.70) return 2;
  if (pct < 0.80) return 3;
  if (pct < 0.90) return 4;
  return 5;
}

export interface TimeInZoneBucket {
  zone: ZoneNumber;
  name: string;
  color: string;
  totalSeconds: number;
  /** Percentage of total HR-tagged time spent in this zone. */
  pctOfTotal: number;
}

/**
 * Aggregate per-split HR samples across an entire run history into time-in-
 * zone totals. Splits without HR data are skipped — totals reflect only the
 * portions of runs where HR was captured.
 */
export function getTimeInZoneAcrossHistory(history: RunLog[], maxHR: number): TimeInZoneBucket[] {
  const totals: Record<ZoneNumber, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  for (const r of history) {
    for (const s of r.splits) {
      if (!s.averageHeartRate || s.averageHeartRate <= 0) continue;
      const zone = bpmToZone(s.averageHeartRate, maxHR);
      if (zone === null) continue;
      totals[zone] += s.durationSeconds;
    }
  }

  const grandTotal = totals[1] + totals[2] + totals[3] + totals[4] + totals[5];
  return ZONE_DEFINITIONS.map(z => {
    const totalSeconds = totals[z.zone];
    const pctOfTotal = grandTotal > 0 ? (totalSeconds / grandTotal) * 100 : 0;
    return {
      zone: z.zone,
      name: z.name,
      color: z.color,
      totalSeconds,
      pctOfTotal,
    };
  });
}

/**
 * Aggregate time-in-zone for a single run.
 */
export function getTimeInZoneForRun(run: RunLog, maxHR: number): TimeInZoneBucket[] {
  return getTimeInZoneAcrossHistory([run], maxHR);
}

export const HR_ZONE_DEFINITIONS = ZONE_DEFINITIONS;
