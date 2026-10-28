import { Pt, RepResult } from '../models/types';
import { Analyzer, FrameEval } from './analyzer';
import { Sample, computeTempo } from './tempo';

/** State of the rep counter: waiting for extension, ready at the top, or in the middle of a rep. */
export type RepPhase = 'idle' | 'top' | 'moving';

/** Settings the rep counter needs on every frame. */
export interface RepOptions {
  minRange: number;
  faultFrames: number;
  /** Minimum eccentric duration in seconds, or null when the check is off. */
  minEccentricSec: number | null;
  heightM: number;
}

/** Samples older than this are dropped from the trajectory buffer. */
const BUFFER_MS = 20_000;
/** How far before the rep trigger the trajectory is searched for the real start. */
const PRE_ROLL_MS = 4_000;
/** After full extension, wait for the movement to settle (max) before timing the rep. */
const SETTLE_MAX_MS = 700;
/** Minimum wait after extension before a rep can be announced. */
const SETTLE_MIN_MS = 150;
/** The joint counts as still when it moves less than this (deg) over SETTLE_MIN_MS. */
const STILL_DEG = 2;

/** A finished rep that waits for the joint to settle before being timed. */
interface PendingRep {
  result: RepResult;
  from: number;
  finishT: number;
}

/**
 * Generic rep state machine for "extended -> flexed -> extended" movements
 * (squat: knee, push-up and pull-up: elbow).
 *
 * idle   : waiting for the first full extension.
 * top    : fully extended, ready for a rep.
 * moving : rep in progress; tracks depth and faults until extension returns.
 *
 * A completed rep is emitted a moment later (when the joint settles, at most
 * SETTLE_MAX_MS), so that its tempo can be measured over the whole movement.
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
  private topRef = 180;

  private samples: Sample[] = [];
  /** Trajectory before this time belongs to an earlier rep or to getting into position. */
  private windowFrom = -Infinity;
  private lastEndT: number | null = null;
  private pending: PendingRep | null = null;
  private opts: RepOptions | null = null;

  constructor(private analyzer: Analyzer) {}

  /** Clears the state. Returns a rep that was still waiting to be timed, if any. */
  reset(): RepResult | null {
    const flushed = this.resolvePending();
    this.phase = 'idle';
    this.faultStreak.clear();
    this.faults.clear();
    this.samples = [];
    this.windowFrom = -Infinity;
    this.lastEndT = null;
    return flushed;
  }

  /** Feeds one frame. Returns a rep when one is completed and timed, otherwise null. */
  update(ev: FrameEval, lm: Pt[], now: number, o: RepOptions): RepResult | null {
    this.opts = o;
    if (!ev.ok) {
      return this.pending && now - this.pending.finishT > SETTLE_MAX_MS ? this.resolvePending() : null;
    }
    if (!ev.inPosition) return this.reset();

    this.samples.push({ t: now, a: ev.angle, y: ev.trackY ?? null, body: ev.bodyPx ?? null });
    while (this.samples.length && now - this.samples[0].t > BUFFER_MS) this.samples.shift();

    let out: RepResult | null = null;
    if (this.pending && this.settled(now)) out = this.resolvePending();

    switch (this.phase) {
      case 'idle':
        if (ev.extended) {
          this.phase = 'top';
          this.windowFrom = now;
        }
        break;

      case 'top':
        if (ev.extended) this.topRef = ev.angle;
        if (!ev.extended && ev.angle < this.topRef - o.minRange) {
          out ??= this.resolvePending();
          this.begin(lm, now, true, ev.angle);
        }
        break;

      case 'moving': {
        this.trackFaults(ev, o.faultFrames);
        // The rise is measured from the deepest point so far: going on past the
        // depth threshold is not "coming back up".
        if (ev.angle < this.minAngle) {
          this.minAngle = ev.angle;
          this.peakAfterBottom = ev.angle;
        }
        if (ev.bottom) this.bottomReached = true;
        if (this.bottomReached) this.peakAfterBottom = Math.max(this.peakAfterBottom, ev.angle);

        if (ev.extended) {
          this.pending = { result: this.judge(now, true), from: this.repWindowStart(), finishT: now };
          this.windowFrom = now;
          this.phase = 'top';
          this.topRef = ev.angle;
          break;
        }

        // Came back up part of the way and started a new rep without locking out:
        // time it right away, the next rep is already under way.
        if (
          this.bottomReached &&
          this.peakAfterBottom > this.minAngle + o.minRange &&
          ev.angle < this.peakAfterBottom - o.minRange * 0.6
        ) {
          this.pending = { result: this.judge(now, false), from: this.repWindowStart(), finishT: now };
          out ??= this.resolvePending();
          this.windowFrom = now;
          this.begin(lm, now, false, ev.angle);
        }
        break;
      }
    }
    return out;
  }

  private repWindowStart(): number {
    return Math.max(this.windowFrom, this.start - PRE_ROLL_MS);
  }

  /** The joint has stopped moving after the rep (or we waited long enough). */
  private settled(now: number): boolean {
    const p = this.pending!;
    const age = now - p.finishT;
    if (age >= SETTLE_MAX_MS) return true;
    if (age < SETTLE_MIN_MS) return false;
    // Compare the average angle of the two halves of the last SETTLE_MIN_MS:
    // averages ignore frame-to-frame jitter but still catch real movement.
    const half = SETTLE_MIN_MS / 2;
    const mean = (from: number, to: number) => {
      const v = this.samples.filter((x) => now - x.t >= from && now - x.t < to).map((x) => x.a);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };
    const newer = mean(0, half), older = mean(half, SETTLE_MIN_MS);
    return newer !== null && older !== null && Math.abs(newer - older) < STILL_DEG;
  }

  /** Times the pending rep and applies the tempo-based rule. */
  private resolvePending(): RepResult | null {
    const p = this.pending;
    if (!p) return null;
    this.pending = null;
    const o = this.opts;
    const window = this.samples.filter((x) => x.t >= p.from);
    const res = o
      ? computeTempo(window, {
          flexIsEccentric: this.analyzer.flexIsEccentric,
          heightM: o.heightM,
          bodyRatio: this.analyzer.bodyRatio,
          prevEndT: this.lastEndT,
        })
      : null;
    this.lastEndT = res?.endT ?? null;

    const r = p.result;
    if (res) r.tempo = res.tempo;
    if (o?.minEccentricSec != null && res && res.tempo.eccentricSec < o.minEccentricSec) {
      r.reasons.push('fastEccentric');
      r.valid = false;
    }
    return r;
  }

  /** Starts a new rep: resets depth and fault tracking and stores the analyzer baselines. */
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

  /** Confirms a fault once it has been seen in `faultFrames` consecutive frames. */
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

  /** Builds the result of a rep from its depth, start, lockout and confirmed faults. */
  private judge(now: number, lockedOut: boolean): RepResult {
    const reasons: string[] = [];
    if (!this.bottomReached) reasons.push(this.analyzer.noDepthFault);
    if (!this.startedFromTop) reasons.push('noStart');
    if (!lockedOut) reasons.push('noLockout');
    reasons.push(...this.faults);
    return { valid: reasons.length === 0, reasons, start: this.start, end: now };
  }
}
