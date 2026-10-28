import type { EccentricRule, GeneralSettings, Pt } from '../models/types';
import { Analyzer, EMPTY, FrameEval, SEGMENT, facingSide } from '../analysis/analyzer';
import { SidePicker, angle, dist, leanFromVertical, visible } from '../analysis/geometry';
import { ECCENTRIC_DEFAULTS, ExerciseModule, FaultText, SettingField } from './exercise';

/** Strictness criteria for biceps curls (side view). */
export interface CurlSettings extends EccentricRule {
  /** Elbow angle (deg) that counts as the arm fully straight at the bottom. */
  topElbowAngle: number;
  /** Elbow angle (deg) to reach at the top of the curl. */
  bottomElbowAngle: number;
  /** Maximum angle of the upper arm from vertical (deg): more means the elbow moved forward. */
  maxElbowDrift: number;
  /** Maximum change of torso lean during a rep (deg): more means swinging. */
  maxTorsoSwing: number;
}

/**
 * Biceps curl seen from the side: elbow angle, upper arm kept still and no
 * torso swing. Analyses the arm closest to the camera.
 */
export class CurlAnalyzer implements Analyzer<CurlSettings> {
  readonly noDepthFault = 'curlNoTop';
  readonly flexIsEccentric = false;
  readonly bodyRatio = SEGMENT.upperArm + SEGMENT.forearm;
  private side = new SidePicker();
  private baseLean: number | null = null;
  private lastMin = 0.5;

  private pts(lm: Pt[]) {
    return facingSide(this.side, lm, ['shoulder', 'elbow', 'wrist']);
  }

  private lean(lm: Pt[], min: number): number | null {
    const { sh, hip } = this.pts(lm);
    return visible(min, sh, hip) ? leanFromVertical(hip, sh) : null;
  }

  startRep(lm: Pt[]): void {
    this.baseLean = this.lean(lm, this.lastMin);
  }

  evaluate(lm: Pt[], s: CurlSettings, g: GeneralSettings): FrameEval {
    const min = (this.lastMin = g.minVisibility);
    const p = this.pts(lm);
    const { sh, el, wr } = p;
    if (!visible(min, sh, el, wr)) return EMPTY;

    const elbow = angle(sh, el, wr);
    const lean = this.lean(lm, min);
    const drift = leanFromVertical(sh, el);
    // Standing or sitting upright with the elbow below the shoulder.
    const inPosition = el.y > sh.y && (lean === null || lean < 45);

    const faults: string[] = [];
    if (drift > s.maxElbowDrift) faults.push('elbowDrift');
    if (lean !== null && this.baseLean !== null && Math.abs(lean - this.baseLean) > s.maxTorsoSwing) faults.push('torsoSwing');

    return {
      ok: true,
      inPosition,
      angle: elbow,
      extended: elbow >= s.topElbowAngle,
      bottom: elbow <= s.bottomElbowAngle,
      faults,
      metrics: { codo: elbow, brazo: drift, ...(lean !== null ? { tronco: lean } : {}) },
      joint: el,
      trackY: wr.y,
      bodyPx: dist(sh, el) + dist(el, wr),
      side: p.side,
    };
  }
}

const CURL_DEFAULTS: CurlSettings = {
  topElbowAngle: 150,
  bottomElbowAngle: 50,
  maxElbowDrift: 30,
  maxTorsoSwing: 10,
  ...ECCENTRIC_DEFAULTS,
};

const CURL_FIELDS: SettingField<CurlSettings>[] = [
  { key: 'topElbowAngle', label: 'Brazo estirado abajo', help: 'Ángulo de codo mínimo abajo.', type: 'range', min: 120, max: 180, step: 1, unit: '°' },
  { key: 'bottomElbowAngle', label: 'Ángulo de codo arriba', help: 'El codo tiene que cerrarse al menos hasta este ángulo. Más bajo = más exigente.', type: 'range', min: 25, max: 90, step: 1, unit: '°' },
  { key: 'maxElbowDrift', label: 'Movimiento máximo del codo', help: 'Ángulo máximo del brazo respecto a la vertical: el codo debe quedarse pegado al cuerpo.', type: 'range', min: 5, max: 60, step: 1, unit: '°' },
  { key: 'maxTorsoSwing', label: 'Balanceo máximo del tronco', help: 'Cambio máximo de inclinación del tronco durante la repetición.', type: 'range', min: 2, max: 40, step: 1, unit: '°' },
];

const CURL_FAULTS: Record<string, FaultText> = {
  curlNoTop: { message: 'No subiste del todo', voice: 'sube más' },
  elbowDrift: { message: 'Moviste el codo', voice: 'codo quieto' },
  torsoSwing: { message: 'Balanceo del tronco', voice: 'sin balanceo' },
};

/** Biceps curl with both arms at once (dumbbells or bar). */
export const curl: ExerciseModule<'curl', CurlSettings> = {
  id: 'curl',
  name: 'Curl de bíceps',
  icon: '🦾',
  category: 'Brazos',
  camera: 'side',
  tips: [
    'Coloca la cámara de lado, a la altura del pecho, a 2 m.',
    'Que se vean el hombro, el codo, la muñeca y la cadera.',
    'Empieza con los brazos estirados.',
  ],
  hints: { position: 'Ponte de pie, de lado a la cámara', start: 'Estira los brazos del todo para empezar' },
  pauseLabels: { turn: 'Pausa arriba', between: 'Pausa abajo' },
  setEnd: 'inactivity',
  defaults: CURL_DEFAULTS,
  fields: CURL_FIELDS,
  faults: CURL_FAULTS,
  createAnalyzer: () => new CurlAnalyzer(),
};

/** Biceps curl one arm at a time. Each set records which arm was trained. */
export const curlSingle: ExerciseModule<'curlSingle', CurlSettings> = {
  ...curl,
  id: 'curlSingle',
  name: 'Curl de bíceps unilateral',
  icon: '✊',
  unilateral: { limb: 'brazo' },
  tips: [
    'Ponte de lado con el brazo que trabaja hacia la cámara, a 2 m.',
    'Que se vean el hombro, el codo, la muñeca y la cadera.',
    'Cada serie guarda qué brazo has trabajado. Para cambiar de brazo, date la vuelta.',
  ],
  hints: { position: 'Ponte de pie, con el brazo que trabaja hacia la cámara', start: 'Estira el brazo del todo para empezar' },
};
