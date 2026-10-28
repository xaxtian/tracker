/**
 * Phase timing and velocity of a single rep.
 *
 * Works offline on the per-frame samples of one rep (primary joint angle +
 * vertical position of a tracked point), once the rep is over:
 *
 * 1. The trajectory is smoothed with a centred (zero-lag) local linear
 *    regression, which also gives the angular velocity at every frame.
 * 2. Each phase starts/ends when the joint's speed crosses a small fraction of
 *    that phase's peak speed. Crossing times are interpolated between frames,
 *    so the resolution is finer than the frame interval.
 */

export interface Sample {
  /** Frame time, epoch ms with sub-ms precision. */
  t: number;
  /** Primary joint angle (high = extended). */
  a: number;
  /** Vertical pixel position of the tracked point (hip, shoulders…). */
  y: number | null;
  /** Pixel length of the reference body segments, for the px -> m scale. */
  body: number | null;
}

export interface RepTempo {
  eccentricSec: number;
  concentricSec: number;
  /** Hold at the turnaround (bottom of a squat, top of a pull-up). */
  pauseTurnSec: number;
  /** Hold in the extended position before this rep (null on the first rep of a set). */
  pauseBetweenSec: number | null;
  /** Mean concentric velocity, m/s. */
  meanConVel: number | null;
  /** Peak concentric velocity, m/s. */
  peakConVel: number | null;
  /** Mean eccentric velocity, m/s. */
  meanEccVel: number | null;
  /** Frames analyzed per second during the rep (precision indicator). */
  fps: number;
}

export interface TempoOptions {
  /** True when closing the joint is the eccentric phase (squat, push-up); false for pull-ups. */
  flexIsEccentric: boolean;
  heightM: number;
  /** Fraction of body height represented by the reference segments. */
  bodyRatio: number;
  /** End time of the previous rep, to measure the pause between reps. */
  prevEndT: number | null;
}

export interface TempoResult {
  tempo: RepTempo;
  /** End of the extension phase (start of the pause before the next rep). */
  endT: number;
}

/** Smoothing window (half-width, ms) for the first pass. */
const SMOOTH_MS = 120;
/** The window is then adapted to each phase: 8% of its duration, within these limits. */
const PHASE_SMOOTH = { fraction: 0.08, min: 60, max: 160 };
/** A phase is "moving" while speed is above this fraction of its peak speed. */
const SPEED_FRACTION = 0.1;

interface Bounds {
  a: number[];
  aTop: number;
  flexStart: number;
  flexEnd: number;
  extStart: number;
  extEnd: number;
}

/** Phase boundaries on the trajectory smoothed with a window of halfWidth ms. */
function phaseBounds(t: number[], raw: number[], halfWidth: number): Bounds | null {
  const { value: a, slope: va } = smooth(t, raw, halfWidth);

  // Bottom of the movement and the range of motion.
  let iMin = 0;
  for (let i = 1; i < a.length; i++) if (a[i] < a[iMin]) iMin = i;
  let aTop = -Infinity;
  for (let i = 0; i <= iMin; i++) aTop = Math.max(aTop, a[i]);
  if (aTop - a[iMin] < 10) return null;

  // Peak closing speed before the bottom and peak opening speed after it (deg/ms).
  let iDown = 0, iUp = iMin;
  for (let i = 0; i <= iMin; i++) if (va[i] < va[iDown]) iDown = i;
  for (let i = iMin; i < va.length; i++) if (va[i] > va[iUp]) iUp = i;
  const vDown = -va[iDown], vUp = va[iUp];
  if (vDown <= 0 || vUp <= 0) return null;
  const thDown = -SPEED_FRACTION * vDown; // closing while va < thDown
  const thUp = SPEED_FRACTION * vUp; // opening while va > thUp

  /** Interpolated time where va crosses level between samples i and i+1. */
  const cross = (i: number, level: number) => {
    const f = va[i + 1] === va[i] ? 0 : (level - va[i]) / (va[i + 1] - va[i]);
    return t[i] + Math.max(0, Math.min(1, f)) * (t[i + 1] - t[i]);
  };

  let flexStart = t[0];
  for (let i = iDown - 1; i >= 0; i--) if (va[i] >= thDown) { flexStart = cross(i, thDown); break; }
  let flexEnd = t[iMin];
  for (let i = iDown; i < iMin; i++) if (va[i + 1] >= thDown) { flexEnd = cross(i, thDown); break; }
  let extStart = t[iMin];
  for (let i = iUp - 1; i >= iMin; i--) if (va[i] <= thUp) { extStart = cross(i, thUp); break; }
  let extEnd = t[t.length - 1];
  for (let i = iUp; i < va.length - 1; i++) if (va[i + 1] <= thUp) { extEnd = cross(i, thUp); break; }
  return { a, aTop, flexStart, flexEnd, extStart, extEnd };
}

const phaseWindow = (ms: number) =>
  Math.max(PHASE_SMOOTH.min, Math.min(PHASE_SMOOTH.max, ms * PHASE_SMOOTH.fraction));

export function computeTempo(s: Sample[], o: TempoOptions): TempoResult | null {
  if (s.length < 6) return null;
  const t = s.map((x) => x.t);
  const raw = s.map((x) => x.a);

  // Pass 1 finds the phases; pass 2 re-measures each phase with a window suited
  // to its speed (slow phases need more smoothing, fast ones less blurring).
  const p1 = phaseBounds(t, raw, SMOOTH_MS);
  if (!p1) return null;
  const pf = phaseBounds(t, raw, phaseWindow(p1.flexEnd - p1.flexStart)) ?? p1;
  const pe = phaseBounds(t, raw, phaseWindow(p1.extEnd - p1.extStart)) ?? p1;
  const { a, aTop } = p1;
  let { flexStart, flexEnd } = pf;
  let { extStart, extEnd } = pe;
  flexEnd = Math.max(flexEnd, flexStart);
  extStart = Math.max(extStart, flexEnd);
  extEnd = Math.max(extEnd, extStart);

  // px -> m scale from the reference segments, measured near full extension.
  const near = s.filter((x, i) => x.body && a[i] >= aTop - 15).map((x) => x.body!);
  const bodyPx = median(near.length ? near : s.filter((x) => x.body).map((x) => x.body!));
  const mPerPx = bodyPx ? (o.heightM * o.bodyRatio) / bodyPx : null;

  // Vertical position of the tracked point, smoothed the same way.
  const ys = s.map((x, i) => ({ t: t[i], y: x.y })).filter((x): x is { t: number; y: number } => x.y !== null);
  const ySm = ys.length >= 6 ? smooth(ys.map((x) => x.t), ys.map((x) => x.y), phaseWindow(extEnd - extStart)) : null;
  const yAt = (time: number): number | null => {
    if (!ySm) return null;
    const ts = ys.map((x) => x.t);
    if (time <= ts[0]) return ySm.value[0];
    for (let i = 0; i < ts.length - 1; i++) {
      if (time <= ts[i + 1]) return ySm.value[i] + ((time - ts[i]) / (ts[i + 1] - ts[i] || 1)) * (ySm.value[i + 1] - ySm.value[i]);
    }
    return ySm.value[ts.length - 1];
  };
  const meanVel = (t0: number, t1: number): number | null => {
    const y0 = yAt(t0), y1 = yAt(t1);
    if (mPerPx === null || y0 === null || y1 === null || t1 - t0 < 50) return null;
    return (Math.abs(y1 - y0) * mPerPx) / ((t1 - t0) / 1000);
  };
  const peakVel = (t0: number, t1: number): number | null => {
    if (mPerPx === null || !ySm) return null;
    let best: number | null = null;
    ys.forEach((p, i) => {
      if (p.t < t0 || p.t > t1) return;
      const v = Math.abs(ySm.slope[i]) * 1000 * mPerPx;
      best = best === null ? v : Math.max(best, v);
    });
    return best;
  };

  const flexSec = (flexEnd - flexStart) / 1000;
  const turnSec = (extStart - flexEnd) / 1000;
  const extSec = (extEnd - extStart) / 1000;
  const [conT0, conT1] = o.flexIsEccentric ? [extStart, extEnd] : [flexStart, flexEnd];
  const [eccT0, eccT1] = o.flexIsEccentric ? [flexStart, flexEnd] : [extStart, extEnd];
  const between = o.prevEndT !== null ? Math.max(0, flexStart - o.prevEndT) / 1000 : null;
  const frames = t.filter((x) => x >= flexStart && x <= extEnd).length;

  return {
    endT: extEnd,
    tempo: {
      eccentricSec: r3(o.flexIsEccentric ? flexSec : extSec),
      concentricSec: r3(o.flexIsEccentric ? extSec : flexSec),
      pauseTurnSec: r3(turnSec),
      pauseBetweenSec: between === null ? null : r3(between),
      meanConVel: r3n(meanVel(conT0, conT1)),
      peakConVel: r3n(peakVel(conT0, conT1)),
      meanEccVel: r3n(meanVel(eccT0, eccT1)),
      fps: Math.round(frames / Math.max(0.001, (extEnd - flexStart) / 1000)),
    },
  };
}

/**
 * Centred Gaussian-weighted local linear regression: smoothed value and slope
 * (per ms) at every sample, without the lag of a causal filter.
 */
function smooth(t: number[], v: number[], halfWidth: number): { value: number[]; slope: number[] } {
  const value: number[] = [], slope: number[] = [];
  const sigma = halfWidth / 2;
  let lo = 0;
  for (let i = 0; i < t.length; i++) {
    while (t[i] - t[lo] > halfWidth) lo++;
    let sw = 0, st = 0, sv = 0, stt = 0, stv = 0;
    for (let j = lo; j < t.length && t[j] - t[i] <= halfWidth; j++) {
      const dt = t[j] - t[i];
      const w = Math.exp(-(dt * dt) / (2 * sigma * sigma));
      sw += w; st += w * dt; sv += w * v[j]; stt += w * dt * dt; stv += w * dt * v[j];
    }
    const den = sw * stt - st * st;
    const b = den > 1e-9 ? (sw * stv - st * sv) / den : 0;
    value.push((sv - b * st) / sw);
    slope.push(b);
  }
  return { value, slope };
}

function median(v: number[]): number | null {
  if (!v.length) return null;
  const a = [...v].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const r3n = (n: number | null) => (n === null ? null : r3(n));
