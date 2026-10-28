import { Pt, RepResult } from '../models/types';
import { DEFAULT_PLAN, RepPlan, angleAt, evalFor } from '../../testing/motion';
import { Analyzer, FrameEval } from './analyzer';
import { RepCounter, RepOptions } from './rep-counter';

const T0 = 1e12;
const OPTS: RepOptions = { minRange: 30, faultFrames: 3, minEccentricSec: null, heightM: 1.75 };

function stubAnalyzer(flexIsEccentric = true): Analyzer & { startRep: jest.Mock } {
  return {
    noDepthFault: 'noDepth',
    flexIsEccentric,
    bodyRatio: 0.779,
    startRep: jest.fn(),
    evaluate: () => { throw new Error('not used'); },
  };
}

interface Emitted { rep: RepResult; at: number }

/** Feeds `seconds` of frames to the counter; `frame(t)` builds each evaluation. */
function run(c: RepCounter, frame: (t: number) => FrameEval, seconds: number, fps = 30, o: RepOptions = OPTS): Emitted[] {
  const out: Emitted[] = [];
  const lm: Pt[] = [];
  for (let i = 0; i / fps <= seconds; i++) {
    const t = i / fps;
    const r = c.update(frame(t), lm, T0 + t * 1000, o);
    if (r) out.push({ rep: r, at: t });
  }
  return out;
}

const plan = (p: Partial<RepPlan>): RepPlan => ({ ...DEFAULT_PLAN, ...p });
const CYCLE = 4.5; // rest 1 + flex 2 + hold 0.5 + extend 1

describe('RepCounter', () => {
  it('counts strict reps and times them', () => {
    const c = new RepCounter(stubAnalyzer());
    const reps = run(c, (t) => evalFor(angleAt(t)), 3 * CYCLE + 1);
    expect(reps).toHaveLength(3);
    for (const { rep } of reps) {
      expect(rep.valid).toBe(true);
      expect(rep.reasons).toEqual([]);
      expect(Math.abs(rep.tempo!.eccentricSec - 2)).toBeLessThan(0.1);
      expect(Math.abs(rep.tempo!.concentricSec - 1)).toBeLessThan(0.1);
      expect(rep.tempo!.meanConVel).toBeGreaterThan(0);
    }
    // Only the 2nd and 3rd reps have a previous rep to measure the pause from.
    expect(reps[0].rep.tempo!.pauseBetweenSec).toBeNull();
    expect(Math.abs(reps[1].rep.tempo!.pauseBetweenSec! - 1)).toBeLessThan(0.1);
  });

  it('announces a rep shortly after lockout, once the joint settles', () => {
    const reps = run(new RepCounter(stubAnalyzer()), (t) => evalFor(angleAt(t)), CYCLE + 1);
    const lockout = 1 + 2 + 0.5 + 1;
    expect(reps[0].at).toBeGreaterThan(lockout - 0.3);
    expect(reps[0].at).toBeLessThan(lockout + 0.75);
  });

  it('goes idle → top → moving and calls startRep when a rep begins', () => {
    const a = stubAnalyzer();
    const c = new RepCounter(a);
    expect(c.phase).toBe('idle');
    run(c, (t) => evalFor(angleAt(t)), 0.5);
    expect(c.phase).toBe('top');
    run(c, (t) => evalFor(angleAt(t + 0.5)), 1.5);
    expect(c.phase).toBe('moving');
    expect(a.startRep).toHaveBeenCalledTimes(1);
  });

  it('does not start before reaching full extension', () => {
    const c = new RepCounter(stubAnalyzer());
    // Starts already bent and never extends.
    const reps = run(c, () => evalFor(100), 3);
    expect(reps).toEqual([]);
    expect(c.phase).toBe('idle');
  });

  it('ignores small movements below the minimum range', () => {
    const c = new RepCounter(stubAnalyzer());
    const reps = run(c, (t) => evalFor(angleAt(t, plan({ bottom: 150 }))), 2 * CYCLE);
    expect(reps).toEqual([]);
  });

  it('marks a shallow rep as no depth', () => {
    const reps = run(new RepCounter(stubAnalyzer()), (t) => evalFor(angleAt(t, plan({ bottom: 110 }))), CYCLE + 1);
    expect(reps).toHaveLength(1);
    expect(reps[0].rep.valid).toBe(false);
    expect(reps[0].rep.reasons).toEqual(['noDepth']);
  });

  it('confirms a technique fault only after enough consecutive frames', () => {
    const faultyFrames = (n: number) => (t: number) => {
      const ev = evalFor(angleAt(t));
      // Fault during the first n frames after 2 s (mid descent).
      const i = Math.round((t - 2) * 30);
      if (i >= 0 && i < n) ev.faults = ['hipSag'];
      return ev;
    };
    const twoFrames = run(new RepCounter(stubAnalyzer()), faultyFrames(2), CYCLE + 1);
    expect(twoFrames[0].rep.valid).toBe(true);
    const threeFrames = run(new RepCounter(stubAnalyzer()), faultyFrames(3), CYCLE + 1);
    expect(threeFrames[0].rep.valid).toBe(false);
    expect(threeFrames[0].rep.reasons).toEqual(['hipSag']);
  });

  it('applies the optional minimum eccentric time', () => {
    const strict = run(new RepCounter(stubAnalyzer()), (t) => evalFor(angleAt(t)), CYCLE + 1, 30, { ...OPTS, minEccentricSec: 3 });
    expect(strict[0].rep.valid).toBe(false);
    expect(strict[0].rep.reasons).toEqual(['fastEccentric']);
    const ok = run(new RepCounter(stubAnalyzer()), (t) => evalFor(angleAt(t)), CYCLE + 1, 30, { ...OPTS, minEccentricSec: 1.5 });
    expect(ok[0].rep.valid).toBe(true);
  });

  it('uses the extension phase as eccentric for pull-ups', () => {
    // Pull-up: flexing (going up) takes 2 s, extending (lowering) 1 s.
    const r = run(new RepCounter(stubAnalyzer(false)), (t) => evalFor(angleAt(t)), CYCLE + 1, 30, { ...OPTS, minEccentricSec: 1.5 });
    expect(r[0].rep.reasons).toEqual(['fastEccentric']);
    expect(Math.abs(r[0].rep.tempo!.eccentricSec - 1)).toBeLessThan(0.1);
  });

  it('flags a rep without lockout and the next one as not started from the top', () => {
    // 175 → 60 → 130 (no lockout) → 60 → 175
    const path = (t: number): number => {
      if (t < 1) return 175;
      if (t < 2) return 175 - 115 * (t - 1);
      if (t < 2.5) return 60;
      if (t < 3) return 60 + 140 * (t - 2.5);
      if (t < 3.5) return 130 - 140 * (t - 3);
      if (t < 4) return 60;
      if (t < 5) return 60 + 115 * (t - 4);
      return 175;
    };
    const reps = run(new RepCounter(stubAnalyzer()), (t) => evalFor(path(t)), 6.5);
    expect(reps.map((r) => r.rep.reasons)).toEqual([['noLockout'], ['noStart']]);
  });

  it('counts one rep when going far past the depth threshold', () => {
    // Depth is reached at 90° but the rep goes on down to 40°: still one rep.
    const deep = (t: number) => evalFor(angleAt(t, plan({ bottom: 40 })));
    const reps = run(new RepCounter(stubAnalyzer()), deep, CYCLE + 1);
    expect(reps).toHaveLength(1);
    expect(reps[0].rep.valid).toBe(true);
  });

  it('emits the pending rep when the person leaves the position', () => {
    const c = new RepCounter(stubAnalyzer());
    run(c, (t) => evalFor(angleAt(t)), 4.55); // just after lockout, still settling
    const r = c.update(evalFor(175, { inPosition: false }), [], T0 + 4600, OPTS);
    expect(r?.valid).toBe(true);
    expect(c.phase).toBe('idle');
  });

  it('emits the pending rep after a while even if tracking is lost', () => {
    const c = new RepCounter(stubAnalyzer());
    run(c, (t) => evalFor(angleAt(t)), 4.55);
    const lost = evalFor(0, { ok: false });
    expect(c.update(lost, [], T0 + 4700, OPTS)).toBeNull();
    expect(c.update(lost, [], T0 + 5400, OPTS)?.valid).toBe(true);
  });

  it('reset() flushes a pending rep, then has nothing to return', () => {
    const c = new RepCounter(stubAnalyzer());
    run(c, (t) => evalFor(angleAt(t)), 4.55);
    expect(c.reset()?.valid).toBe(true);
    expect(c.reset()).toBeNull();
    expect(c.phase).toBe('idle');
  });
});
