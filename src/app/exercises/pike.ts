import type { EccentricRule, GeneralSettings, Pt } from '../models/types';
import { Analyzer, EMPTY, FrameEval, SEGMENT, facingSide } from '../analysis/analyzer';
import { LM, SidePicker, angle, dist, visible } from '../analysis/geometry';
import { armAndTrunkPx, headAboveHands } from './common';
import { ECCENTRIC_DEFAULTS, ExerciseModule } from './exercise';

/** Strictness criteria for pike push-ups (side view). */
export interface PikeSettings extends EccentricRule {
  /** Elbow angle (deg) with arms locked out. */
  topElbowAngle: number;
  /** The rep reaches depth when the nose is this close to the hands, in upper-arm lengths. */
  headMargin: number;
  /** Maximum shoulder-hip-ankle angle (deg): above it the hips have dropped out of the pike. */
  maxHipAngle: number;
  /** Minimum knee angle (deg). */
  minKneeAngle: number;
}

/** Pike push-up seen from the side: elbow angle, head towards the floor, hips kept high. */
export class PikeAnalyzer implements Analyzer<PikeSettings> {
  readonly noDepthFault = 'pikeNoDepth';
  readonly flexIsEccentric = true;
  readonly bodyRatio = SEGMENT.trunk + SEGMENT.upperArm + SEGMENT.forearm;
  private side = new SidePicker();

  startRep(): void {}

  evaluate(lm: Pt[], s: PikeSettings, g: GeneralSettings): FrameEval {
    const min = g.minVisibility;
    const p = facingSide(this.side, lm, ['shoulder', 'elbow', 'wrist', 'hip', 'knee']);
    const { sh, el, wr, hip, knee, ankle } = p;
    const nose = lm[LM.nose];
    if (!visible(min, sh, el, wr, hip, knee, nose)) return EMPTY;

    const hasAnkle = visible(min, ankle);
    const foot = hasAnkle ? ankle : knee;
    const elbow = angle(sh, el, wr);
    const hipAngle = angle(sh, hip, foot);
    const kneeAngle = hasAnkle ? angle(hip, knee, ankle) : 180;
    // Inverted V: hips above shoulders and feet, hands on the floor below the shoulders.
    const inPosition = hip.y < sh.y && wr.y > sh.y && foot.y > hip.y && hipAngle < 155;
    const head = headAboveHands(nose, wr, dist(sh, el));

    const faults: string[] = [];
    if (hipAngle > s.maxHipAngle) faults.push('pikeFlat');
    if (kneeAngle < s.minKneeAngle) faults.push('kneesBent');

    return {
      ok: true,
      inPosition,
      angle: elbow,
      extended: elbow >= s.topElbowAngle,
      bottom: head <= s.headMargin,
      faults,
      metrics: { codo: elbow, cadera: hipAngle, cabeza: head * 100 },
      joint: el,
      trackY: sh.y,
      bodyPx: armAndTrunkPx(p),
      side: p.side,
    };
  }
}

/** Pike push-up (hips high, inverted V). */
export const pike: ExerciseModule<'pike', PikeSettings> = {
  id: 'pike',
  name: 'Flexiones pike',
  icon: '⛰️',
  category: 'Empuje',
  camera: 'side',
  tips: [
    'Coloca la cámara de lado, en el suelo o a poca altura, a 2 m.',
    'Que se vea el cuerpo entero: manos, cabeza, cadera y pies.',
    'Empieza en V invertida con los brazos estirados y la cadera alta.',
  ],
  hints: { position: 'Ponte en V invertida: manos y pies en el suelo, cadera arriba', start: 'Estira los brazos del todo para empezar' },
  pauseLabels: { turn: 'Pausa abajo', between: 'Pausa arriba' },
  setEnd: 'longInactivity',
  defaults: {
    topElbowAngle: 160,
    headMargin: 0.4,
    maxHipAngle: 120,
    minKneeAngle: 150,
    ...ECCENTRIC_DEFAULTS,
  },
  fields: [
    { key: 'topElbowAngle', label: 'Extensión arriba', help: 'Ángulo de codo mínimo con los brazos estirados.', type: 'range', min: 130, max: 180, step: 1, unit: '°' },
    { key: 'headMargin', label: 'Cabeza al suelo', help: 'Distancia máxima de la nariz a las manos, en % del brazo. Más bajo = más exigente.', type: 'range', min: 0.1, max: 1, step: 0.01, unit: '%' },
    { key: 'maxHipAngle', label: 'Cadera alta (hombro-cadera-tobillo)', help: 'Por encima de este ángulo la cadera ha bajado y deja de ser pike.', type: 'range', min: 60, max: 150, step: 1, unit: '°' },
    { key: 'minKneeAngle', label: 'Rodillas estiradas', help: 'Ángulo de rodilla mínimo.', type: 'range', min: 120, max: 180, step: 1, unit: '°' },
  ],
  faults: {
    pikeNoDepth: { message: 'La cabeza no bajó lo suficiente', voice: 'más abajo' },
    pikeFlat: { message: 'Cadera demasiado baja', voice: 'cadera arriba' },
  },
  createAnalyzer: () => new PikeAnalyzer(),
};
