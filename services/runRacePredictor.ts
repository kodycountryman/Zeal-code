/**
 * Race Time Prediction
 *
 * Uses the Riegel formula to extrapolate finish times from a known
 * performance to other distances:
 *
 *   T2 = T1 × (D2 / D1)^1.06
 *
 * The exponent (1.06) is the standard for trained runners over distances
 * within a reasonable range. Predictions become less reliable as the gap
 * between known and target distances widens, so we surface confidence based
 * on the source-distance proximity and recency of the data point used.
 */

import { RunLog, Split, METERS_PER_MILE } from '@/types/run';

const FIVE_K_M = 5000;
const TEN_K_M = 10000;
const HALF_M = 21_097.5;
const MARATHON_M = 42_195;

export type RaceDistanceKey = '5k' | '10k' | 'half_marathon' | 'marathon';

export interface RacePrediction {
  distance: RaceDistanceKey;
  distanceMeters: number;
  predictedTimeSeconds: number;
  predictedPaceSecPerMile: number;
  /** 0-100 — higher when source data is closer in distance & more recent. */
  confidence: number;
  confidenceLabel: 'high' | 'medium' | 'low';
  /** What we used as the source — name + date for transparency. */
  sourceDescription: string;
}

const RIEGEL_EXPONENT = 1.06;

function predictFromBenchmark(timeSeconds: number, fromMeters: number, toMeters: number): number {
  return timeSeconds * Math.pow(toMeters / fromMeters, RIEGEL_EXPONENT);
}

/**
 * Find the best source benchmark for prediction.
 * Strategy:
 *   1. Use the user's actual race or near-race effort within the last 90 days
 *      (prefer same-distance tier or just below — predicting up is fine).
 *   2. Fall back to fastest comparable split (mile splits inside any run).
 *   3. Fall back to fastest run distance overall.
 *
 * Returns the source benchmark (distance + time + recency in days) or null.
 */
interface Benchmark {
  meters: number;
  seconds: number;
  source: string;
  daysAgo: number;
  /** Was this the runner's average pace across a full run, or a sub-segment? */
  fromFullRun: boolean;
}

function findBestBenchmark(history: RunLog[]): Benchmark | null {
  if (history.length === 0) return null;
  const now = Date.now();

  // Collect all candidate benchmarks
  const candidates: Benchmark[] = [];

  for (const r of history) {
    const ms = new Date(r.startTime).getTime();
    const daysAgo = Math.floor((now - ms) / 86_400_000);
    if (daysAgo > 180) continue; // ignore data older than 6 months

    if (r.distanceMeters >= 1500 && r.averagePaceSecondsPerMeter > 0) {
      candidates.push({
        meters: r.distanceMeters,
        seconds: r.durationSeconds,
        source: r.runType === 'race' ? 'Race effort' : 'Run',
        daysAgo,
        fromFullRun: true,
      });
    }

    // Best mile split inside this run (often a faster benchmark than the full run pace)
    let bestSplit: Split | null = null;
    for (const s of r.splits) {
      if (s.unit !== 'imperial') continue; // only mile splits are useful here
      if (s.paceSecondsPerMeter <= 0) continue;
      if (!bestSplit || s.paceSecondsPerMeter < bestSplit.paceSecondsPerMeter) {
        bestSplit = s;
      }
    }
    if (bestSplit) {
      candidates.push({
        meters: bestSplit.distanceMeters,
        seconds: bestSplit.durationSeconds,
        source: `Best mile in a ${(r.distanceMeters / METERS_PER_MILE).toFixed(1)}mi run`,
        daysAgo,
        fromFullRun: false,
      });
    }
  }

  if (candidates.length === 0) return null;

  // Score each candidate: prefer recent + longer (more reliable for race prediction)
  // Score = recency_weight × distance_weight
  function score(c: Benchmark): number {
    const recencyWeight = Math.max(0.2, 1 - (c.daysAgo / 90));
    // Distance weight: full runs of 5K+ score highest, then near-distance benchmarks
    const distanceKm = c.meters / 1000;
    let distanceWeight = 1;
    if (c.fromFullRun) {
      if (distanceKm >= 10) distanceWeight = 1.4;
      else if (distanceKm >= 5) distanceWeight = 1.2;
      else if (distanceKm >= 3) distanceWeight = 1.0;
      else distanceWeight = 0.7;
    } else {
      // Single-mile splits are less reliable for marathon prediction
      distanceWeight = 0.6;
    }
    // Penalize slow benchmarks slightly so race-pace efforts win
    const paceSecPerMile = (c.seconds / c.meters) * METERS_PER_MILE;
    const paceWeight = paceSecPerMile < 480 ? 1.1 : paceSecPerMile < 600 ? 1.0 : 0.9;
    return recencyWeight * distanceWeight * paceWeight;
  }

  candidates.sort((a, b) => score(b) - score(a));
  return candidates[0];
}

function targetDistanceMeters(d: RaceDistanceKey): number {
  switch (d) {
    case '5k': return FIVE_K_M;
    case '10k': return TEN_K_M;
    case 'half_marathon': return HALF_M;
    case 'marathon': return MARATHON_M;
  }
}

function describeDistance(d: RaceDistanceKey): string {
  switch (d) {
    case '5k': return '5K';
    case '10k': return '10K';
    case 'half_marathon': return 'Half Marathon';
    case 'marathon': return 'Marathon';
  }
}

/**
 * Compute confidence (0-100) for a prediction given the gap between source
 * and target distance + recency of the source.
 */
function computeConfidence(sourceMeters: number, targetMeters: number, daysAgo: number): number {
  // Distance ratio penalty — bigger ratio = lower confidence
  const ratio = Math.max(sourceMeters, targetMeters) / Math.min(sourceMeters, targetMeters);
  let distanceScore = 100;
  if (ratio > 8) distanceScore = 20;
  else if (ratio > 4) distanceScore = 45;
  else if (ratio > 2) distanceScore = 70;
  else distanceScore = 90;

  // Recency penalty
  let recencyScore = 100;
  if (daysAgo > 90) recencyScore = 35;
  else if (daysAgo > 60) recencyScore = 60;
  else if (daysAgo > 30) recencyScore = 80;

  return Math.round((distanceScore + recencyScore) / 2);
}

export function getRacePredictions(history: RunLog[]): RacePrediction[] {
  const benchmark = findBestBenchmark(history);
  if (!benchmark) return [];

  const distances: RaceDistanceKey[] = ['5k', '10k', 'half_marathon', 'marathon'];
  const predictions: RacePrediction[] = [];

  for (const d of distances) {
    const targetM = targetDistanceMeters(d);
    const predictedSec = predictFromBenchmark(benchmark.seconds, benchmark.meters, targetM);
    const predictedPaceSecPerMile = (predictedSec / targetM) * METERS_PER_MILE;
    const confidence = computeConfidence(benchmark.meters, targetM, benchmark.daysAgo);
    const confidenceLabel: 'high' | 'medium' | 'low' = confidence >= 75 ? 'high' : confidence >= 50 ? 'medium' : 'low';

    predictions.push({
      distance: d,
      distanceMeters: targetM,
      predictedTimeSeconds: predictedSec,
      predictedPaceSecPerMile,
      confidence,
      confidenceLabel,
      sourceDescription: `${benchmark.source} · ${benchmark.daysAgo}d ago`,
    });
  }

  return predictions;
}

export function describeRaceDistance(d: RaceDistanceKey): string {
  return describeDistance(d);
}

/** Format seconds → "H:MM:SS" or "MM:SS". */
export function formatRaceTime(totalSeconds: number): string {
  if (!isFinite(totalSeconds) || totalSeconds <= 0) return '—';
  const hrs = Math.floor(totalSeconds / 3600);
  const min = Math.floor((totalSeconds % 3600) / 60);
  const sec = Math.round(totalSeconds % 60);
  if (hrs > 0) return `${hrs}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${min}:${String(sec).padStart(2, '0')}`;
}
