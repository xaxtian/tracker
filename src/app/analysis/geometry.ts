import { Pt } from '../models/types';

/** MediaPipe Pose landmark indices. */
export const LM = {
  nose: 0,
  mouthL: 9,
  mouthR: 10,
  shoulderL: 11,
  shoulderR: 12,
  elbowL: 13,
  elbowR: 14,
  wristL: 15,
  wristR: 16,
  hipL: 23,
  hipR: 24,
  kneeL: 25,
  kneeR: 26,
  ankleL: 27,
  ankleR: 28,
  heelL: 29,
  heelR: 30,
  toeL: 31,
  toeR: 32,
} as const;

/** Pairs of landmark indices joined by a bone when drawing the skeleton. */
export const CONNECTIONS: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 29], [29, 31], [27, 31],
  [24, 26], [26, 28], [28, 30], [30, 32], [28, 32],
];

/** Angle ABC (at B) in degrees, 0..180. */
export function angle(a: Pt, b: Pt, c: Pt): number {
  const v1x = a.x - b.x, v1y = a.y - b.y;
  const v2x = c.x - b.x, v2y = c.y - b.y;
  const dot = v1x * v2x + v1y * v2y;
  const m = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (m === 0) return 180;
  return (Math.acos(Math.max(-1, Math.min(1, dot / m))) * 180) / Math.PI;
}

/** Angle of segment from->to relative to vertical (0 = upright). */
export function leanFromVertical(from: Pt, to: Pt): number {
  return (Math.atan2(Math.abs(to.x - from.x), Math.abs(to.y - from.y)) * 180) / Math.PI;
}

/** Angle of segment a-b relative to horizontal (0 = flat). */
export function fromHorizontal(a: Pt, b: Pt): number {
  return (Math.atan2(Math.abs(b.y - a.y), Math.abs(b.x - a.x)) * 180) / Math.PI;
}

/** Distance between two points, in pixels. */
export function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Midpoint of two landmarks; its visibility is the lower of the two. */
export function mid(a: Pt, b: Pt): Pt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, v: Math.min(a.v, b.v) };
}

/** True when every point reaches the minimum visibility. */
export function visible(min: number, ...pts: Pt[]): boolean {
  return pts.every((p) => p && p.v >= min);
}

/**
 * Signed distance of p from the line a-b, positive when p is below the line
 * (larger y) in image space.
 */
export function belowLine(p: Pt, a: Pt, b: Pt): number {
  if (b.x === a.x) return 0;
  const t = (p.x - a.x) / (b.x - a.x);
  const yOnLine = a.y + t * (b.y - a.y);
  return p.y - yOnLine;
}

/** Body side: left or right. */
export type Side = 'L' | 'R';

/** Picks the body side facing the camera, with hysteresis to avoid flicker. */
export class SidePicker {
  private side: Side = 'L';

  /** Returns the side whose landmarks `idsL` / `idsR` are more visible on average. */
  pick(lm: Pt[], idsL: number[], idsR: number[]): Side {
    const score = (ids: number[]) => ids.reduce((s, i) => s + (lm[i]?.v ?? 0), 0) / ids.length;
    const l = score(idsL), r = score(idsR);
    if (this.side === 'L' && r > l + 0.15) this.side = 'R';
    else if (this.side === 'R' && l > r + 0.15) this.side = 'L';
    return this.side;
  }
}
