import { RepRecord, RepTempo } from '../models/types';

/** Formats seconds or m/s with two decimals and a Spanish decimal comma. */
export function fmt2(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : n.toFixed(2).replace('.', ',');
}

/** Short tempo summary for notifications: "↓1,84 ↑0,92 s · 0,62 m/s". */
export function tempoText(t: RepTempo | undefined): string {
  if (!t) return '';
  const vel = t.meanConVel !== null ? ` · ${fmt2(t.meanConVel)} m/s` : '';
  return `↓${fmt2(t.eccentricSec)} ↑${fmt2(t.concentricSec)} s${vel}`;
}

/**
 * Velocity loss of the set, in %: how much slower the last valid rep was than
 * the fastest one (mean concentric velocity). A common fatigue indicator.
 */
export function velocityLoss(reps: RepRecord[] | undefined): number | null {
  const v = (reps ?? []).filter((r) => r.valid && r.tempo?.meanConVel).map((r) => r.tempo!.meanConVel!);
  if (v.length < 2) return null;
  const best = Math.max(...v);
  return Math.max(0, ((best - v[v.length - 1]) / best) * 100);
}

export interface TempoAverages {
  eccentricSec: number | null;
  concentricSec: number | null;
  meanConVel: number | null;
  bestConVel: number | null;
}

export function tempoAverages(reps: RepRecord[] | undefined): TempoAverages {
  const t = (reps ?? []).filter((r) => r.valid && r.tempo).map((r) => r.tempo!);
  const avg = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const vels = t.map((x) => x.meanConVel).filter((x): x is number => x !== null);
  return {
    eccentricSec: avg(t.map((x) => x.eccentricSec)),
    concentricSec: avg(t.map((x) => x.concentricSec)),
    meanConVel: avg(vels),
    bestConVel: vels.length ? Math.max(...vels) : null,
  };
}
