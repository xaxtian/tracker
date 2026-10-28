import { Pt, RepResult } from '../models/types';
import { Analyzer, FrameEval } from './analyzers';

export type RepPhase = 'idle' | 'top' | 'moving';

/**
 * Generic rep state machine for "extended -> flexed -> extended" movements
 * (squat: knee, push-up and pull-up: elbow).
 *
 * idle   : waiting for the first full extension.
 * top    : fully extended, ready for a rep.
 * moving : rep in progress; tracks depth and faults until extension returns.
 */
export class RepCounter {
  phase: RepPhase = 'idle';

  private start = 0;
  private startedFromTop = true;
  private bottomReached = false;
  private minAngle = 180;
  private peakAfterBottom = 0;
  private faultStreak = new Map<string, number>();
  private faults = new Set<string>();

  constructor(private analyzer: Analyzer) {}

  reset(): void {
    this.phase = 'idle';
    this.faultStreak.clear();
    this.faults.clear();
  }

  update(ev: FrameEval, lm: Pt[], now: number, minRange: number, faultFrames: number): RepResult | null {
    if (!ev.ok) return null;
    if (!ev.inPosition) {
      this.reset();
      return null;
    }

    switch (this.phase) {
      case 'idle':
        if (ev.extended) this.phase = 'top';
        return null;

      case 'top':
        if (!ev.extended && ev.angle < this.topAngle(ev) - minRange) {
          this.begin(lm, now, true, ev.angle);
        }
        return null;

      case 'moving': {
        this.trackFaults(ev, faultFrames);
        this.minAngle = Math.min(this.minAngle, ev.angle);
        if (ev.bottom) this.bottomReached = true;
        if (this.bottomReached) this.peakAfterBottom = Math.max(this.peakAfterBottom, ev.angle);

        if (ev.extended) {
          const res = this.finish(now, true);
          this.phase = 'top';
          return res;
        }

        // Came back up part of the way and started a new rep without locking out.
        if (
          this.bottomReached &&
          this.peakAfterBottom > this.minAngle + minRange &&
          ev.angle < this.peakAfterBottom - minRange * 0.6
        ) {
          const res = this.finish(now, false);
          this.begin(lm, now, false, ev.angle);
          return res;
        }
        return null;
      }
    }
  }

  /** Angle used as reference for "started moving": the extension angle seen at the top. */
  private topRef = 180;
  private topAngle(ev: FrameEval): number {
    if (ev.extended) this.topRef = ev.angle;
    return this.topRef;
  }

  private begin(lm: Pt[], now: number, fromTop: boolean, angle: number): void {
    this.phase = 'moving';
    this.start = now;
    this.startedFromTop = fromTop;
    this.bottomReached = false;
    this.minAngle = angle;
    this.peakAfterBottom = 0;
    this.faultStreak.clear();
    this.faults.clear();
    this.analyzer.startRep(lm);
  }

  private trackFaults(ev: FrameEval, faultFrames: number): void {
    const current = new Set(ev.faults);
    for (const f of current) {
      const n = (this.faultStreak.get(f) ?? 0) + 1;
      this.faultStreak.set(f, n);
      if (n >= faultFrames) this.faults.add(f);
    }
    for (const f of [...this.faultStreak.keys()]) {
      if (!current.has(f)) this.faultStreak.delete(f);
    }
  }

  private finish(now: number, lockedOut: boolean): RepResult {
    const reasons: string[] = [];
    if (!this.bottomReached) reasons.push(this.analyzer.noDepthFault);
    if (!this.startedFromTop) reasons.push('noStart');
    if (!lockedOut) reasons.push('noLockout');
    reasons.push(...this.faults);
    return { valid: reasons.length === 0, reasons, start: this.start, end: now };
  }
}
