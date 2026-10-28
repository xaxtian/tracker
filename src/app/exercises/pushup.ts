import type { EccentricRule, GeneralSettings, Pt } from '../models/types';
import { Analyzer, EMPTY, FrameEval, SEGMENT, facingSide } from '../analysis/analyzer';
import { SidePicker, angle, dist, fromHorizontal, visible } from '../analysis/geometry';
import { bodyLineFault } from './common';
import { ECCENTRIC_DEFAULTS, ExerciseModule } from './exercise';

/** Strictness criteria for push-ups (side view). */
export interface PushupSettings extends EccentricRule {
  /** Elbow angle (deg) with arms locked out. */
  topElbowAngle: number;
  /** Elbow angle (deg) to reach at the bottom. */
  bottomElbowAngle: number;
  /** Minimum shoulder-hip-ankle angle (deg): below it the hip sags or pikes. */
  minBodyLineAngle: number;
  /** Minimum knee angle (deg). */
  minKneeAngle: number;
}

/** Push-up seen from the side: elbow angle, straight body line and straight knees. */
export class PushupAnalyzer implements Analyzer<PushupSettings> {
  readonly noDepthFault = 'pushupNoDepth';
  readonly flexIsEccentric = true;
  readonly bodyRatio = SEGMENT.thigh + SEGMENT.shank + SEGMENT.trunk;
  private side = new SidePicker();

  startRep(): void {}

  evaluate(lm: Pt[], s: PushupSettings, g: GeneralSettings): FrameEval {
    const min = g.minVisibility;
    const { sh, el, wr, hip, knee, ankle, side } = facingSide(this.side, lm, ['shoulder', 'elbow', 'wrist', 'hip', 'knee']);
    if (!visible(min, sh, el, wr, hip, knee)) return EMPTY;
    const hasAnkle = visible(min, ankle);
    const foot = hasAnkle ? ankle : knee;

    const elbow = angle(sh, el, wr);
    const bodyLine = angle(sh, hip, foot);
    const kneeAngle = hasAnkle ? angle(hip, knee, ankle) : 180;
    const horizontal = fromHorizontal(sh, foot) < 40;
    const inPosition = horizontal && kneeAngle > 120 && wr.y > sh.y - dist(sh, el) * 0.3;

    const faults: string[] = [];
    const line = bodyLineFault(sh, hip, foot, s.minBodyLineAngle);
    if (line) faults.push(line);
    if (kneeAngle < s.minKneeAngle) faults.push('kneesBent');

    return {
      ok: true,
      inPosition,
      angle: elbow,
      extended: elbow >= s.topElbowAngle,
      bottom: elbow <= s.bottomElbowAngle,
      faults,
      metrics: { codo: elbow, cuerpo: bodyLine, rodilla: kneeAngle },
      joint: el,
      trackY: sh.y,
      bodyPx: hasAnkle ? dist(sh, hip) + dist(hip, knee) + dist(knee, ankle) : undefined,
      side,
    };
  }
}

/** Classic push-up. */
export const pushup: ExerciseModule<'pushup', PushupSettings> = {
  id: 'pushup',
  name: 'Flexiones',
  icon: '💪',
  category: 'Empuje',
  camera: 'side',
  tips: [
    'Coloca la cámara de lado, en el suelo o a poca altura, a 2 m.',
    'Que se vea el cuerpo entero, de la cabeza a los pies.',
    'Empieza en plancha con los brazos estirados.',
  ],
  hints: { position: 'Ponte en plancha con el cuerpo entero visible', start: 'Estira los brazos del todo para empezar' },
  pauseLabels: { turn: 'Pausa abajo', between: 'Pausa arriba' },
  setEnd: 'longInactivity',
  defaults: {
    topElbowAngle: 160,
    bottomElbowAngle: 90,
    minBodyLineAngle: 160,
    minKneeAngle: 150,
    ...ECCENTRIC_DEFAULTS,
  },
  fields: [
    { key: 'topElbowAngle', label: 'Extensión arriba', help: 'Ángulo de codo mínimo con los brazos estirados.', type: 'range', min: 130, max: 180, step: 1, unit: '°' },
    { key: 'bottomElbowAngle', label: 'Ángulo de codo abajo', help: 'El codo tiene que cerrarse al menos hasta este ángulo. Más bajo = más exigente.', type: 'range', min: 45, max: 120, step: 1, unit: '°' },
    { key: 'minBodyLineAngle', label: 'Cuerpo recto (hombro-cadera-tobillo)', help: 'Por debajo de este ángulo se considera cadera caída o levantada.', type: 'range', min: 130, max: 180, step: 1, unit: '°' },
    { key: 'minKneeAngle', label: 'Rodillas estiradas', help: 'Ángulo de rodilla mínimo.', type: 'range', min: 120, max: 180, step: 1, unit: '°' },
  ],
  faults: {
    pushupNoDepth: { message: 'No bajaste lo suficiente', voice: 'más abajo' },
  },
  createAnalyzer: () => new PushupAnalyzer(),
};
