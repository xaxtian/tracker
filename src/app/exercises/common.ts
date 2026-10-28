import type { Pt } from '../models/types';
import { angle, belowLine, dist, visible } from '../analysis/geometry';
import type { SidePoints } from '../analysis/analyzer';
import type { FaultText } from './exercise';

/** Faults any exercise can raise. Exercise modules add their own. */
export const COMMON_FAULTS: Record<string, FaultText> = {
  noDepth: { message: 'No llegaste abajo del todo', voice: 'más abajo' },
  noLockout: { message: 'No extendiste del todo', voice: 'extiende del todo' },
  noStart: { message: 'No empezaste desde extensión completa', voice: 'empieza extendido' },
  fastEccentric: { message: 'Bajada demasiado rápida', voice: 'baja más lento' },
  swing: { message: 'Balanceo del cuerpo', voice: 'sin balanceo' },
  kip: { message: 'Impulso con las piernas (kipping)', voice: 'sin impulso' },
  hipSag: { message: 'Cadera caída', voice: 'cadera caída' },
  hipPike: { message: 'Cadera demasiado alta', voice: 'cadera alta' },
  kneesBent: { message: 'Rodillas dobladas', voice: 'rodillas' },
};

/** Knee angle of one side, or null when the leg is not visible. */
export function kneeAngle(p: SidePoints, min: number): number | null {
  return visible(min, p.hip, p.knee, p.ankle) ? angle(p.hip, p.knee, p.ankle) : null;
}

/**
 * How far the nose is above the hands, in upper-arm lengths. Used by the
 * inverted presses (pike and handstand push-ups): 0 means the nose is at hand
 * level; the head touches the floor at about 0.3.
 */
export function headAboveHands(nose: Pt, wrist: Pt, upperArm: number): number {
  return (wrist.y - nose.y) / (upperArm || 1);
}

/** Hip sag / pike fault for a straight-body exercise, or null when the body line is good. */
export function bodyLineFault(sh: Pt, hip: Pt, foot: Pt, minAngle: number): 'hipSag' | 'hipPike' | null {
  if (angle(sh, hip, foot) >= minAngle) return null;
  return belowLine(hip, sh, foot) > 0 ? 'hipSag' : 'hipPike';
}

/** Trunk + upper arm + forearm in pixels: reference length for presses and pulls. */
export function armAndTrunkPx(p: SidePoints): number {
  return dist(p.sh, p.hip) + dist(p.sh, p.el) + dist(p.el, p.wr);
}

/** Tracks a knee-angle baseline and flags kipping when it changes too much during a rep. */
export class KipDetector {
  private base: number | null = null;

  /** Stores the knee angle at the start of the rep. */
  start(p: SidePoints, min: number): void {
    this.base = kneeAngle(p, min);
  }

  /** True when the knee angle moved more than `maxChange` degrees since the start. */
  kipping(p: SidePoints, min: number, maxChange: number): boolean {
    const k = kneeAngle(p, min);
    return k !== null && this.base !== null && Math.abs(k - this.base) > maxChange;
  }
}
