import { FrameEval } from '../app/analysis/analyzers';

/** Smooth 0..1 profile with constant-speed middle (trapezoidal velocity). */
export function trapezoid(x: number): number {
  const r = 0.15, vmax = 1 / (1 - r);
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  if (x < r) return (vmax * x * x) / (2 * r);
  if (x > 1 - r) return 1 - (vmax * (1 - x) ** 2) / (2 * r);
  return (vmax * r) / 2 + vmax * (x - r);
}

export interface RepPlan {
  top: number;
  bottom: number;
  /** Seconds: hold at the top, flexing, hold at the bottom, extending. */
  rest: number;
  flex: number;
  hold: number;
  extend: number;
}

export const DEFAULT_PLAN: RepPlan = { top: 175, bottom: 60, rest: 1, flex: 2, hold: 0.5, extend: 1 };

/** Joint angle at time t (s) for a sequence of identical reps. */
export function angleAt(t: number, p: RepPlan = DEFAULT_PLAN): number {
  const cycle = p.rest + p.flex + p.hold + p.extend;
  const u = t % cycle;
  const range = p.top - p.bottom;
  if (u < p.rest) return p.top;
  if (u < p.rest + p.flex) return p.top - range * trapezoid((u - p.rest) / p.flex);
  if (u < p.rest + p.flex + p.hold) return p.bottom;
  return p.bottom + range * trapezoid((u - p.rest - p.flex - p.hold) / p.extend);
}

/** Frame evaluation for an angle, with a tracked point that moves 1 px per degree. */
export function evalFor(angle: number, extra: Partial<FrameEval> = {}): FrameEval {
  return {
    ok: true,
    inPosition: true,
    angle,
    extended: angle >= 160,
    bottom: angle <= 90,
    faults: [],
    metrics: {},
    trackY: 600 - angle,
    bodyPx: 400,
    ...extra,
  };
}
