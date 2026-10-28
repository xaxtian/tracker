import type { EccentricRule, GeneralSettings, Pt } from '../models/types';
import { Analyzer, EMPTY, FrameEval, SEGMENT, facingSide } from '../analysis/analyzer';
import { LM, SidePicker, angle, dist, leanFromVertical, visible } from '../analysis/geometry';
import { KipDetector, armAndTrunkPx, headAboveHands } from './common';
import { ECCENTRIC_DEFAULTS, ExerciseModule } from './exercise';

/** Strictness criteria for handstand push-ups (side view). */
export interface HspuSettings extends EccentricRule {
  /** Elbow angle (deg) with arms locked out. */
  topElbowAngle: number;
  /** The rep reaches depth when the nose is this close to the hands, in upper-arm lengths. */
  headMargin: number;
  /** Minimum shoulder-hip-ankle angle (deg): below it the body is arched or bent at the hips. */
  minBodyLineAngle: number;
  /** Maximum change of knee angle during a rep (deg); more means kipping. */
  maxKneeAngleChange: number;
}

/** Handstand push-up seen from the side: elbow angle, head to the floor, straight body. */
export class HspuAnalyzer implements Analyzer<HspuSettings> {
  readonly noDepthFault = 'hspuNoDepth';
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

  evaluate(lm: Pt[], s: HspuSettings, g: GeneralSettings): FrameEval {
    const min = (this.lastMin = g.minVisibility);
    const p = this.pts(lm);
    const { sh, el, wr, hip, ankle } = p;
    const nose = lm[LM.nose];
    if (!visible(min, sh, el, wr, hip, nose)) return EMPTY;

    const elbow = angle(sh, el, wr);
    const upperArm = dist(sh, el);
    // Upside down: hips above the shoulders, hands below them, body close to vertical.
    const inPosition = hip.y < sh.y && wr.y > sh.y && leanFromVertical(sh, hip) < 45;
    const head = headAboveHands(nose, wr, upperArm);

    const faults: string[] = [];
    const hasAnkle = visible(min, ankle);
    const bodyLine = hasAnkle ? angle(sh, hip, ankle) : null;
    if (bodyLine !== null && bodyLine < s.minBodyLineAngle) faults.push('archedBack');
    if (this.kip.kipping(p, min, s.maxKneeAngleChange)) faults.push('kip');

    return {
      ok: true,
      inPosition,
      angle: elbow,
      extended: elbow >= s.topElbowAngle,
      bottom: head <= s.headMargin,
      faults,
      metrics: { codo: elbow, cabeza: head * 100, ...(bodyLine !== null ? { cuerpo: bodyLine } : {}) },
      joint: el,
      trackY: sh.y,
      bodyPx: armAndTrunkPx(p),
      side: p.side,
    };
  }
}

/** Handstand push-up (free or against a wall). */
export const hspu: ExerciseModule<'hspu', HspuSettings> = {
  id: 'hspu',
  name: 'Flexiones de pino',
  icon: '🤸',
  category: 'Empuje',
  camera: 'side',
  tips: [
    'Coloca la cámara de lado, a 2-3 m, a la altura de la cadera cuando estás en pino.',
    'Si usas la pared, ponte de lado a la cámara: que se vean manos, cabeza, cadera y pies.',
    'Empieza en pino con los brazos estirados.',
  ],
  hints: { position: 'Ponte en pino con las manos en el suelo', start: 'Estira los brazos del todo para empezar' },
  pauseLabels: { turn: 'Pausa abajo', between: 'Pausa arriba' },
  setEnd: 'offPosition',
  defaults: {
    topElbowAngle: 160,
    headMargin: 0.4,
    minBodyLineAngle: 150,
    maxKneeAngleChange: 45,
    ...ECCENTRIC_DEFAULTS,
  },
  fields: [
    { key: 'topElbowAngle', label: 'Extensión arriba', help: 'Ángulo de codo mínimo con los brazos estirados.', type: 'range', min: 130, max: 180, step: 1, unit: '°' },
    { key: 'headMargin', label: 'Cabeza al suelo', help: 'Distancia máxima de la nariz a las manos, en % del brazo. Con la cabeza tocando el suelo suele estar en un 30-40 %. Más bajo = más exigente.', type: 'range', min: 0.1, max: 1, step: 0.01, unit: '%' },
    { key: 'minBodyLineAngle', label: 'Cuerpo recto (hombro-cadera-tobillo)', help: 'Por debajo de este ángulo el cuerpo está arqueado o doblado por la cadera.', type: 'range', min: 120, max: 180, step: 1, unit: '°' },
    { key: 'maxKneeAngleChange', label: 'Movimiento máximo de rodillas', help: 'Cambio máximo del ángulo de rodilla durante la repetición (detecta impulso con las piernas).', type: 'range', min: 10, max: 120, step: 1, unit: '°' },
  ],
  faults: {
    hspuNoDepth: { message: 'La cabeza no llegó al suelo', voice: 'cabeza al suelo' },
    archedBack: { message: 'Cuerpo arqueado', voice: 'cuerpo recto' },
  },
  createAnalyzer: () => new HspuAnalyzer(),
};
