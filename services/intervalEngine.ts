/**
 * Interval Engine
 *
 * Expands a `DayPrescription`'s `intervals` spec into a flat sequence of
 * segments (warmup → work × N + recovery × N → cooldown) and tracks
 * progress through them as the run unfolds.
 *
 * Segments can be either time-based (`durationSeconds`) or distance-based
 * (`distanceMeters`). The engine receives `tick(elapsedSec, distanceMeters)`
 * calls from RunContext and auto-advances when the current segment completes.
 *
 * The engine is dumb — it doesn't know about haptics, audio, or UI. The
 * RunContext subscribes to its snapshots and triggers cues on advance.
 *
 * NOTE: We intentionally treat `work_distance_meters` as a distance-mode
 * segment so a "6 × 400m" repeat advances when the runner has covered 400m
 * regardless of pace. `work_seconds` becomes a time-mode segment.
 */

import type { DayPrescription } from '@/services/planEngine';

export type SegmentType = 'warmup' | 'work' | 'recovery' | 'cooldown';
export type SegmentMode = 'time' | 'distance';

export interface IntervalSegment {
  /** 0-based position in the full sequence. */
  index: number;
  type: SegmentType;
  mode: SegmentMode;
  /** Total seconds — set when mode='time'. */
  durationSeconds?: number;
  /** Total meters — set when mode='distance'. */
  distanceMeters?: number;
  /** For work/recovery segments: which rep this is (1-based). */
  repNumber?: number;
  /** Total reps (for the parent group). */
  totalReps?: number;
  /** Display label like "400m work" or "Warmup • 10 min". */
  label: string;
  /** Optional pace target for this segment (sec/mile). */
  targetPaceSecPerMile?: number;
  /** Free-text description (e.g. "8 × 60s hill repeats"). */
  description?: string;
}

export interface IntervalSnapshot {
  hasIntervals: boolean;
  totalSegments: number;
  currentSegmentIndex: number;
  currentSegment: IntervalSegment | null;
  nextSegment: IntervalSegment | null;
  /** For time mode: seconds into the current segment. */
  elapsedInCurrentSec: number;
  /** For time mode: seconds remaining (0 when complete). */
  remainingInCurrentSec: number;
  /** For distance mode: meters into the current segment. */
  elapsedInCurrentMeters: number;
  /** For distance mode: meters remaining (0 when complete). */
  remainingInCurrentMeters: number;
  /** Overall workout progress 0..1 (sum of finished segments / total). */
  workoutProgress: number;
  isComplete: boolean;
}

const EMPTY_SNAPSHOT: IntervalSnapshot = {
  hasIntervals: false,
  totalSegments: 0,
  currentSegmentIndex: 0,
  currentSegment: null,
  nextSegment: null,
  elapsedInCurrentSec: 0,
  remainingInCurrentSec: 0,
  elapsedInCurrentMeters: 0,
  remainingInCurrentMeters: 0,
  workoutProgress: 0,
  isComplete: false,
};

export type IntervalListener = (snapshot: IntervalSnapshot, advanced: boolean) => void;

class IntervalEngine {
  private segments: IntervalSegment[] = [];
  private currentIndex = 0;
  /** Workout-elapsed-seconds at the moment the current segment started. */
  private segmentStartElapsedSec = 0;
  /** Workout-distance-meters at the moment the current segment started. */
  private segmentStartDistanceMeters = 0;
  private lastTickElapsedSec = 0;
  private lastTickDistanceMeters = 0;
  private listeners = new Set<IntervalListener>();

  // ─── Loading ────────────────────────────────────────────────────────

  /**
   * Build a segment sequence from the prescription's intervals spec. Pass
   * null/undefined to clear the engine.
   */
  loadFromPrescription(prescription: DayPrescription | null | undefined): void {
    this.segments = [];
    this.currentIndex = 0;
    this.segmentStartElapsedSec = 0;
    this.segmentStartDistanceMeters = 0;
    this.lastTickElapsedSec = 0;
    this.lastTickDistanceMeters = 0;

    if (!prescription || !prescription.intervals) {
      this.notify(false);
      return;
    }

    const spec = prescription.intervals;
    const segments: IntervalSegment[] = [];
    let segIdx = 0;

    // Warmup
    if (spec.warmup_minutes && spec.warmup_minutes > 0) {
      segments.push({
        index: segIdx++,
        type: 'warmup',
        mode: 'time',
        durationSeconds: spec.warmup_minutes * 60,
        label: `Warmup • ${spec.warmup_minutes} min`,
        description: 'Easy effort, build into the workout',
      });
    }

    // Work + recovery × count for each repeat group
    for (const group of spec.repeats) {
      const totalReps = group.count;
      for (let rep = 1; rep <= totalReps; rep++) {
        // Work segment
        const workSeg: IntervalSegment = {
          index: segIdx++,
          type: 'work',
          mode: group.work_distance_meters ? 'distance' : 'time',
          repNumber: rep,
          totalReps,
          label: buildWorkLabel(group, rep, totalReps),
          targetPaceSecPerMile: group.target_pace_sec_per_mile,
          description: group.description,
        };
        if (group.work_distance_meters) {
          workSeg.distanceMeters = group.work_distance_meters;
        } else if (group.work_seconds) {
          workSeg.durationSeconds = group.work_seconds;
        } else {
          // Default to 60 seconds if neither was specified
          workSeg.durationSeconds = 60;
        }
        segments.push(workSeg);

        // Recovery segment (only between reps, skip after the last rep within a group)
        if (group.recovery_seconds && group.recovery_seconds > 0 && rep < totalReps) {
          segments.push({
            index: segIdx++,
            type: 'recovery',
            mode: 'time',
            durationSeconds: group.recovery_seconds,
            repNumber: rep,
            totalReps,
            label: `Recovery • ${group.recovery_seconds}s`,
            description: 'Easy jog or walk',
          });
        }
      }
    }

    // Cooldown
    if (spec.cooldown_minutes && spec.cooldown_minutes > 0) {
      segments.push({
        index: segIdx++,
        type: 'cooldown',
        mode: 'time',
        durationSeconds: spec.cooldown_minutes * 60,
        label: `Cooldown • ${spec.cooldown_minutes} min`,
        description: 'Easy effort, settle the heart rate',
      });
    }

    this.segments = segments;
    this.notify(false);
  }

  // ─── Tick ───────────────────────────────────────────────────────────

  /**
   * Called by RunContext on every snapshot. Updates the current segment's
   * progress and advances if the segment has completed.
   *
   * Returns the advanced state so the caller can fire audio/haptic cues.
   */
  tick(elapsedSec: number, distanceMeters: number): { advanced: boolean; newSegment: IntervalSegment | null } {
    this.lastTickElapsedSec = elapsedSec;
    this.lastTickDistanceMeters = distanceMeters;

    if (this.segments.length === 0 || this.currentIndex >= this.segments.length) {
      return { advanced: false, newSegment: null };
    }

    const seg = this.segments[this.currentIndex];
    let advanced = false;

    if (seg.mode === 'time' && seg.durationSeconds) {
      const elapsedInSeg = elapsedSec - this.segmentStartElapsedSec;
      if (elapsedInSeg >= seg.durationSeconds) {
        // Segment complete — advance
        this.currentIndex += 1;
        this.segmentStartElapsedSec = elapsedSec;
        this.segmentStartDistanceMeters = distanceMeters;
        advanced = true;
      }
    } else if (seg.mode === 'distance' && seg.distanceMeters) {
      const distInSeg = distanceMeters - this.segmentStartDistanceMeters;
      if (distInSeg >= seg.distanceMeters) {
        this.currentIndex += 1;
        this.segmentStartElapsedSec = elapsedSec;
        this.segmentStartDistanceMeters = distanceMeters;
        advanced = true;
      }
    }

    if (advanced) {
      const newSegment = this.currentIndex < this.segments.length
        ? this.segments[this.currentIndex]
        : null;
      this.notify(true);
      return { advanced: true, newSegment };
    }

    // Always notify so the UI can update the progress ring/timer
    this.notify(false);
    return { advanced: false, newSegment: null };
  }

  /**
   * Manually skip to the next segment. Used by the "Skip" button.
   */
  skipToNext(): IntervalSegment | null {
    if (this.segments.length === 0 || this.currentIndex >= this.segments.length) return null;
    this.currentIndex += 1;
    this.segmentStartElapsedSec = this.lastTickElapsedSec;
    this.segmentStartDistanceMeters = this.lastTickDistanceMeters;
    const newSegment = this.currentIndex < this.segments.length
      ? this.segments[this.currentIndex]
      : null;
    this.notify(true);
    return newSegment;
  }

  /**
   * Reset all state — called when a run is discarded or completed.
   */
  reset(): void {
    this.segments = [];
    this.currentIndex = 0;
    this.segmentStartElapsedSec = 0;
    this.segmentStartDistanceMeters = 0;
    this.lastTickElapsedSec = 0;
    this.lastTickDistanceMeters = 0;
    this.notify(false);
  }

  // ─── Snapshots & Subscriptions ──────────────────────────────────────

  getSnapshot(): IntervalSnapshot {
    if (this.segments.length === 0) return EMPTY_SNAPSHOT;
    const isComplete = this.currentIndex >= this.segments.length;
    const currentSegment = isComplete ? null : this.segments[this.currentIndex];
    const nextSegment = (this.currentIndex + 1) < this.segments.length
      ? this.segments[this.currentIndex + 1]
      : null;

    let elapsedInCurrentSec = 0;
    let remainingInCurrentSec = 0;
    let elapsedInCurrentMeters = 0;
    let remainingInCurrentMeters = 0;

    if (currentSegment) {
      if (currentSegment.mode === 'time' && currentSegment.durationSeconds) {
        elapsedInCurrentSec = Math.max(0, this.lastTickElapsedSec - this.segmentStartElapsedSec);
        remainingInCurrentSec = Math.max(0, currentSegment.durationSeconds - elapsedInCurrentSec);
      } else if (currentSegment.mode === 'distance' && currentSegment.distanceMeters) {
        elapsedInCurrentMeters = Math.max(0, this.lastTickDistanceMeters - this.segmentStartDistanceMeters);
        remainingInCurrentMeters = Math.max(0, currentSegment.distanceMeters - elapsedInCurrentMeters);
      }
    }

    return {
      hasIntervals: true,
      totalSegments: this.segments.length,
      currentSegmentIndex: this.currentIndex,
      currentSegment,
      nextSegment,
      elapsedInCurrentSec,
      remainingInCurrentSec,
      elapsedInCurrentMeters,
      remainingInCurrentMeters,
      workoutProgress: this.segments.length > 0
        ? Math.min(1, this.currentIndex / this.segments.length)
        : 0,
      isComplete,
    };
  }

  /** Returns the full segment list — useful for the preview panel. */
  getSegments(): IntervalSegment[] {
    return [...this.segments];
  }

  subscribe(listener: IntervalListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private notify(advanced: boolean) {
    if (this.listeners.size === 0) return;
    const snap = this.getSnapshot();
    for (const fn of this.listeners) {
      try {
        fn(snap, advanced);
      } catch (e) {
        __DEV__ && console.log('[IntervalEngine] listener error:', e);
      }
    }
  }

  hasIntervals(): boolean {
    return this.segments.length > 0;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

function buildWorkLabel(
  group: NonNullable<DayPrescription['intervals']>['repeats'][number],
  rep: number,
  totalReps: number,
): string {
  if (group.work_distance_meters) {
    const m = group.work_distance_meters;
    const display = m >= 1000 ? `${(m / 1000).toFixed(m % 1000 === 0 ? 0 : 1)}km` : `${m}m`;
    return `${display} • ${rep}/${totalReps}`;
  }
  if (group.work_seconds) {
    return `${group.work_seconds}s work • ${rep}/${totalReps}`;
  }
  return `Work • ${rep}/${totalReps}`;
}

export const intervalEngine = new IntervalEngine();
