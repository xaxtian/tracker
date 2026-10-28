import type { EccentricRule, GeneralSettings, Pt } from '../models/types';
import { Analyzer, EMPTY, FrameEval, SEGMENT } from '../analysis/analyzer';
import { LM, angle, dist, mid, visible } from '../analysis/geometry';
import { ECCENTRIC_DEFAULTS, ExerciseModule } from './exercise';

/** Strictness criteria for pull-ups (front view). */
export interface PullupSettings extends EccentricRule {
  /** Elbow angle (deg) that counts as a full dead hang. */
  hangElbowAngle: number;
  /** How far the mouth must pass above the hands, as a fraction of torso length. */
  chinMargin: number;
  /** Maximum horizontal hip travel during a rep, as a fraction of torso length. */
  maxHipSwing: number;
  /** Maximum change of knee angle during a rep (deg); more means kipping. */
  maxKneeAngleChange: number;
}

/** Pull-up seen from the front: elbow angle, chin over the hands, no swinging and no kipping. */
export class PullupAnalyzer implements Analyzer<PullupSettings> {
  readonly noDepthFault = 'pullupNoDepth';
  readonly flexIsEccentric = false;
  readonly bodyRatio = SEGMENT.trunk + SEGMENT.upperArm + SEGMENT.forearm;
  private baseHipX = 0;
  private baseKnee: number | null = null;
  private lastMin = 0.5;

  /** Mean knee angle of the visible legs (both are seen from the front). */
  private kneeAngle(lm: Pt[], min: number): number | null {
    const sides = [
      [LM.hipL, LM.kneeL, LM.ankleL],
      [LM.hipR, LM.kneeR, LM.ankleR],
    ].filter(([h, k, a]) => visible(min, lm[h], lm[k], lm[a]));
    if (!sides.length) return null;
    return sides.reduce((s, [h, k, a]) => s + angle(lm[h], lm[k], lm[a]), 0) / sides.length;
  }

  startRep(lm: Pt[]): void {
    this.baseHipX = mid(lm[LM.hipL], lm[LM.hipR]).x;
    this.baseKnee = this.kneeAngle(lm, this.lastMin);
  }

  evaluate(lm: Pt[], s: PullupSettings, g: GeneralSettings): FrameEval {
    const min = g.minVisibility;
    this.lastMin = min;

    const arms = [
      [LM.shoulderL, LM.elbowL, LM.wristL],
      [LM.shoulderR, LM.elbowR, LM.wristR],
    ].filter(([a, b, c]) => visible(min, lm[a], lm[b], lm[c]));
    const mouth = mid(lm[LM.mouthL], lm[LM.mouthR]);
    const hip = mid(lm[LM.hipL], lm[LM.hipR]);
    if (!arms.length || !visible(min, mouth)) return EMPTY;

    const elbow = arms.reduce((s, [a, b, c]) => s + angle(lm[a], lm[b], lm[c]), 0) / arms.length;
    const wristY = arms.reduce((s, [, , c]) => s + lm[c].y, 0) / arms.length;
    const shoulderY = arms.reduce((s, [a]) => s + lm[a].y, 0) / arms.length;
    const shoulders = mid(lm[LM.shoulderL], lm[LM.shoulderR]);
    const torso = hip.v >= min ? dist(shoulders, hip) : dist(lm[LM.shoulderL], lm[LM.shoulderR]) * 1.4;

    const inPosition = wristY < shoulderY;
    // > 0 when the mouth is above the hands (bar)
    const chinOver = (wristY - mouth.y) / (torso || 1);

    const faults: string[] = [];
    if (hip.v >= min && Math.abs(hip.x - this.baseHipX) / (torso || 1) > s.maxHipSwing) faults.push('swing');
    const knee = this.kneeAngle(lm, min);
    if (knee !== null && this.baseKnee !== null && Math.abs(knee - this.baseKnee) > s.maxKneeAngleChange) {
      faults.push('kip');
    }

    return {
      ok: true,
      inPosition,
      angle: elbow,
      extended: elbow >= s.hangElbowAngle,
      bottom: chinOver >= s.chinMargin,
      faults,
      metrics: { codo: elbow, barbilla: chinOver * 100, ...(knee !== null ? { rodilla: knee } : {}) },
      joint: lm[arms[0][1]],
      trackY: shoulders.y,
      bodyPx: hip.v >= min
        ? dist(shoulders, hip) + arms.reduce((n, [a, b, c]) => n + dist(lm[a], lm[b]) + dist(lm[b], lm[c]), 0) / arms.length
        : undefined,
    };
  }
}

/** Strict pull-up / chin-up. */
export const pullup: ExerciseModule<'pullup', PullupSettings> = {
  id: 'pullup',
  name: 'Dominadas',
  icon: '🧗',
  category: 'Tracción',
  camera: 'front',
  tips: [
    'Coloca la cámara de frente, lo bastante lejos para ver manos y pies.',
    'Empieza colgado con los brazos completamente estirados.',
    'La serie termina sola cuando te bajas de la barra.',
  ],
  hints: { position: 'Cuélgate de la barra', start: 'Estira los brazos del todo para empezar' },
  pauseLabels: { turn: 'Pausa arriba', between: 'Pausa colgado' },
  setEnd: 'offPosition',
  defaults: {
    hangElbowAngle: 160,
    chinMargin: 0,
    maxHipSwing: 0.3,
    maxKneeAngleChange: 45,
    ...ECCENTRIC_DEFAULTS,
  },
  fields: [
    { key: 'hangElbowAngle', label: 'Colgado completo', help: 'Ángulo de codo mínimo abajo (brazos estirados).', type: 'range', min: 130, max: 180, step: 1, unit: '°' },
    { key: 'chinMargin', label: 'Altura de la barbilla', help: 'Cuánto tiene que pasar la boca por encima de las manos. 0 = a la altura de las manos. Positivo = más exigente. En % del tronco.', type: 'range', min: -0.2, max: 0.3, step: 0.01, unit: '%' },
    { key: 'maxHipSwing', label: 'Balanceo máximo', help: 'Desplazamiento horizontal máximo de la cadera, en % del tronco.', type: 'range', min: 0.05, max: 1, step: 0.01, unit: '%' },
    { key: 'maxKneeAngleChange', label: 'Movimiento máximo de rodillas', help: 'Cambio máximo del ángulo de rodilla durante la repetición (detecta kipping).', type: 'range', min: 10, max: 120, step: 1, unit: '°' },
  ],
  faults: {
    pullupNoDepth: { message: 'La barbilla no superó la barra', voice: 'barbilla arriba' },
  },
  createAnalyzer: () => new PullupAnalyzer(),
};
