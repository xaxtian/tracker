import type { EccentricRule, GeneralSettings, Pt } from '../models/types';
import { Analyzer, EMPTY, FrameEval, SEGMENT, facingSide } from '../analysis/analyzer';
import { SidePicker, angle, dist, leanFromVertical, visible } from '../analysis/geometry';
import { KipDetector, armAndTrunkPx, kneeAngle } from './common';
import { ECCENTRIC_DEFAULTS, ExerciseModule } from './exercise';

/** Strictness criteria for parallel-bar dips (side view). */
export interface DipsSettings extends EccentricRule {
  /** Elbow angle (deg) with arms locked out at the top. */
  topElbowAngle: number;
  /**
   * Depth: how far the shoulder must drop relative to the elbow, as a fraction
   * of the upper arm. 0 = shoulder at elbow height (upper arm parallel to the floor).
   */
  depthOffset: number;
  /** Maximum change of knee angle during a rep (deg); more means kipping. */
  maxKneeAngleChange: number;
}

/**
 * Dips seen from the side. The hands stay fixed on the bars and the forearm
 * stays close to vertical; that tells a dip apart from just standing and
 * bending the arms.
 */
export class DipsAnalyzer implements Analyzer<DipsSettings> {
  readonly noDepthFault = 'dipsNoDepth';
  readonly flexIsEccentric = true;
  readonly bodyRatio = SEGMENT.trunk + SEGMENT.upperArm + SEGMENT.forearm;
  private side = new SidePicker();
  private kip = new KipDetector();
  private lastMin = 0.5;

  private pts(lm: Pt[]) {
    return facingSide(this.side, lm, ['shoulder', 'elbow', 'wrist', 'hip']);
  }

  startRep(lm: Pt[]): void {
    this.kip.start(this.pts(lm), this.lastMin);
  }

  evaluate(lm: Pt[], s: DipsSettings, g: GeneralSettings): FrameEval {
    const min = (this.lastMin = g.minVisibility);
    const p = this.pts(lm);
    const { sh, el, wr, hip } = p;
    if (!visible(min, sh, el, wr)) return EMPTY;

    const elbow = angle(sh, el, wr);
    const upperArm = dist(sh, el);
    const hasHip = visible(min, hip);
    const forearmLean = leanFromVertical(el, wr);
    const inPosition = wr.y > el.y && wr.y > sh.y && forearmLean < 35 && (!hasHip || leanFromVertical(hip, sh) < 60);
    // > 0 when the shoulder is below the elbow
    const depth = (sh.y - el.y) / (upperArm || 1);

    const faults: string[] = [];
    if (this.kip.kipping(p, min, s.maxKneeAngleChange)) faults.push('kip');
    const knee = kneeAngle(p, min);

    return {
      ok: true,
      inPosition,
      angle: elbow,
      extended: elbow >= s.topElbowAngle,
      bottom: depth >= s.depthOffset,
      faults,
      metrics: { codo: elbow, profundidad: depth * 100, ...(knee !== null ? { rodilla: knee } : {}) },
      joint: el,
      trackY: sh.y,
      bodyPx: hasHip ? armAndTrunkPx(p) : undefined,
      side: p.side,
    };
  }
}

/** Parallel-bar dips. */
export const dips: ExerciseModule<'dips', DipsSettings> = {
  id: 'dips',
  name: 'Fondos en paralelas',
  icon: '🔻',
  category: 'Empuje',
  camera: 'side',
  tips: [
    'Coloca la cámara de lado, a la altura de las barras, a 2-3 m.',
    'Que se vea el cuerpo entero, de la cabeza a los pies.',
    'Empieza arriba, con los brazos estirados.',
  ],
  hints: { position: 'Súbete a las paralelas con los brazos estirados', start: 'Estira los brazos del todo para empezar' },
  pauseLabels: { turn: 'Pausa abajo', between: 'Pausa arriba' },
  setEnd: 'inactivity',
  defaults: {
    topElbowAngle: 160,
    depthOffset: 0,
    maxKneeAngleChange: 45,
    ...ECCENTRIC_DEFAULTS,
  },
  fields: [
    { key: 'topElbowAngle', label: 'Extensión arriba', help: 'Ángulo de codo mínimo con los brazos estirados.', type: 'range', min: 130, max: 180, step: 1, unit: '°' },
    { key: 'depthOffset', label: 'Profundidad', help: 'Cuánto tiene que bajar el hombro respecto al codo, en % del brazo. 0 = hombro a la altura del codo (brazo paralelo al suelo). Positivo = más profundo.', type: 'range', min: -0.3, max: 0.5, step: 0.01, unit: '%' },
    { key: 'maxKneeAngleChange', label: 'Movimiento máximo de rodillas', help: 'Cambio máximo del ángulo de rodilla durante la repetición (detecta impulso con las piernas).', type: 'range', min: 10, max: 120, step: 1, unit: '°' },
  ],
  faults: {
    dipsNoDepth: { message: 'El hombro no bajó hasta el codo', voice: 'más abajo' },
  },
  createAnalyzer: () => new DipsAnalyzer(),
};
