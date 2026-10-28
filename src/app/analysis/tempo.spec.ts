import { DEFAULT_PLAN, RepPlan, angleAt } from '../../testing/motion';
import { Sample, TempoOptions, computeTempo } from './tempo';

/** One rep (rest, flex, hold, extend, rest) sampled at `fps`. */
function samples(fps: number, plan: RepPlan = DEFAULT_PLAN, o: { noise?: number; y?: boolean; body?: boolean } = {}): Sample[] {
  const total = plan.rest * 2 + plan.flex + plan.hold + plan.extend;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 2;
  const out: Sample[] = [];
  for (let i = 0; i / fps <= total; i++) {
    const t = i / fps;
    // Past one cycle, hold the top position.
    const a = (t < total - plan.rest ? angleAt(t, plan) : plan.top) + (o.noise ? rnd() * o.noise : 0);
    out.push({ t: t * 1000, a, y: o.y === false ? null : 600 - a, body: o.body === false ? null : 400 });
  }
  return out;
}

const OPTS: TempoOptions = { flexIsEccentric: true, heightM: 1.75, bodyRatio: 0.779, prevEndT: null };
/** Metres per pixel in these samples: 1.75 m × 0.779 over 400 px. */
const M_PER_PX = (1.75 * 0.779) / 400;
const RANGE_PX = DEFAULT_PLAN.top - DEFAULT_PLAN.bottom;

describe('computeTempo', () => {
  it.each([30, 60])('times each phase to a few hundredths at %i fps', (fps) => {
    const r = computeTempo(samples(fps), OPTS)!;
    expect(r).not.toBeNull();
    expect(Math.abs(r.tempo.eccentricSec - 2)).toBeLessThan(0.08);
    expect(Math.abs(r.tempo.pauseTurnSec - 0.5)).toBeLessThan(0.08);
    expect(Math.abs(r.tempo.concentricSec - 1)).toBeLessThan(0.06);
    expect(Math.abs(r.tempo.fps - fps)).toBeLessThanOrEqual(1);
  });

  it('marks the end of the extension as the end of the rep', () => {
    const r = computeTempo(samples(60), OPTS)!;
    // rest 1 + flex 2 + hold 0.5 + extend 1 = 4.5 s
    expect(Math.abs(r.endT - 4500)).toBeLessThan(60);
  });

  it('measures mean and peak velocity in m/s', () => {
    const r = computeTempo(samples(60), OPTS)!;
    const meanCon = (RANGE_PX * M_PER_PX) / 1; // whole range in 1 s
    expect(Math.abs(r.tempo.meanConVel! - meanCon)).toBeLessThan(0.03);
    expect(Math.abs(r.tempo.meanEccVel! - meanCon / 2)).toBeLessThan(0.02);
    // Trapezoidal profile: peak = mean / (1 - 0.15)
    expect(Math.abs(r.tempo.peakConVel! - meanCon / 0.85)).toBeLessThan(0.04);
  });

  it('stays accurate with noisy landmarks', () => {
    const r = computeTempo(samples(30, DEFAULT_PLAN, { noise: 1.5 }), OPTS)!;
    expect(Math.abs(r.tempo.eccentricSec - 2)).toBeLessThan(0.1);
    expect(Math.abs(r.tempo.concentricSec - 1)).toBeLessThan(0.1);
  });

  it('swaps phases for pull-ups (going up is concentric)', () => {
    const r = computeTempo(samples(60), { ...OPTS, flexIsEccentric: false })!;
    expect(Math.abs(r.tempo.concentricSec - 2)).toBeLessThan(0.08);
    expect(Math.abs(r.tempo.eccentricSec - 1)).toBeLessThan(0.06);
  });

  it('measures the pause since the previous rep', () => {
    expect(computeTempo(samples(60), OPTS)!.tempo.pauseBetweenSec).toBeNull();
    const r = computeTempo(samples(60), { ...OPTS, prevEndT: 0 })!;
    // The rep starts moving ~1 s after t = 0.
    expect(Math.abs(r.tempo.pauseBetweenSec! - 1)).toBeLessThan(0.08);
    expect(computeTempo(samples(60), { ...OPTS, prevEndT: 5000 })!.tempo.pauseBetweenSec).toBe(0);
  });

  it('leaves velocity empty when it cannot be scaled', () => {
    const noBody = computeTempo(samples(60, DEFAULT_PLAN, { body: false }), OPTS)!;
    expect(noBody.tempo.meanConVel).toBeNull();
    expect(noBody.tempo.peakConVel).toBeNull();
    expect(noBody.tempo.eccentricSec).toBeGreaterThan(1.9);
    const noY = computeTempo(samples(60, DEFAULT_PLAN, { y: false }), OPTS)!;
    expect(noY.tempo.meanConVel).toBeNull();
  });

  it('gives up on too little data or too little movement', () => {
    expect(computeTempo(samples(60).slice(0, 5), OPTS)).toBeNull();
    const tiny = samples(60, { ...DEFAULT_PLAN, bottom: DEFAULT_PLAN.top - 5 });
    expect(computeTempo(tiny, OPTS)).toBeNull();
  });

  it('rounds to milliseconds', () => {
    const t = computeTempo(samples(60), OPTS)!.tempo;
    for (const v of [t.eccentricSec, t.concentricSec, t.pauseTurnSec]) {
      expect(Math.round(v * 1000) / 1000).toBe(v);
    }
  });
});
