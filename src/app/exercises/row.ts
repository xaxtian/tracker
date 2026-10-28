import type { EccentricRule, GeneralSettings, Pt } from '../models/types';
import { Analyzer, EMPTY, FrameEval, SEGMENT, facingSide } from '../analysis/analyzer';
import { SidePicker, angle, dist, fromHorizontal, visible } from '../analysis/geometry';
import { bodyLineFault } from './common';
import { ECCENTRIC_DEFAULTS, ExerciseModule } from './exercise';

/** Strictness criteria for inverted rows (side view). */
export interface RowSettings extends EccentricRule {
  /** Elbow angle (deg) that counts as arms fully straight at the bottom. */
  hangElbowAngle: number;
  /** The rep reaches the bar when the shoulder is this close below the hands, in upper-arm lengths. */
  chestMargin: number;
  /** Minimum shoulder-hip-ankle angle (deg): below it the hip sags or pikes. */
  minBodyLineAngle: number;
}

/** Inverted (Australian) row seen from the side: elbow angle, chest to the bar, straight body. */
export class RowAnalyzer implements Analyzer<RowSettings> {
  readonly noDepthFault = 'rowNoDepth';
  readonly flexIsEccentric = false;
  readonly bodyRatio = SEGMENT.thigh + SEGMENT.shank + SEGMENT.trunk;
  private side = new SidePicker();

  startRep(): void {}

  evaluate(lm: Pt[], s: RowSettings, g: GeneralSettings): FrameEval {
    const min = g.minVisibility;
    const p = facingSide(this.side, lm, ['shoulder', 'elbow', 'wrist', 'hip']);
    const { sh, el, wr, hip, knee, ankle } = p;
    if (!visible(min, sh, el, wr, hip)) return EMPTY;

    const hasAnkle = visible(min, ankle);
    const foot = hasAnkle ? ankle : visible(min, knee) ? knee : null;
    const elbow = angle(sh, el, wr);
    // Hanging under the bar: hands above the shoulders, body closer to horizontal than vertical.
    const inPosition = wr.y < sh.y && (foot === null || fromHorizontal(sh, foot) < 50);
    // Shoulder distance below the hands, in upper-arm lengths.
    const chest = (sh.y - wr.y) / (dist(sh, el) || 1);

    const faults: string[] = [];
    const line = foot ? bodyLineFault(sh, hip, foot, s.minBodyLineAngle) : null;
    if (line) faults.push(line);

    return {
      ok: true,
      inPosition,
      angle: elbow,
      extended: elbow >= s.hangElbowAngle,
      bottom: chest <= s.chestMargin,
      faults,
      metrics: { codo: elbow, pecho: chest * 100, ...(foot ? { cuerpo: angle(sh, hip, foot) } : {}) },
      joint: el,
      trackY: sh.y,
      bodyPx: hasAnkle ? dist(sh, hip) + dist(hip, knee) + dist(knee, ankle) : undefined,
      side: p.side,
    };
  }
}

/** Inverted / Australian row under a low bar or rings. */
export const row: ExerciseModule<'row', RowSettings> = {
  id: 'row',
  name: 'Remo invertido',
  icon: '🚣',
  category: 'Tracción',
  camera: 'side',
  tips: [
    'Coloca la cámara de lado, a la altura de la barra, a 2-3 m.',
    'Que se vea el cuerpo entero, de las manos a los pies.',
    'Empieza colgado bajo la barra con los brazos estirados y el cuerpo recto.',
  ],
  hints: { position: 'Cuélgate bajo la barra con el cuerpo recto', start: 'Estira los brazos del todo para empezar' },
  pauseLabels: { turn: 'Pausa arriba', between: 'Pausa abajo' },
  setEnd: 'offPosition',
  defaults: {
    hangElbowAngle: 160,
    chestMargin: 0.5,
    minBodyLineAngle: 160,
    ...ECCENTRIC_DEFAULTS,
  },
  fields: [
    { key: 'hangElbowAngle', label: 'Brazos estirados abajo', help: 'Ángulo de codo mínimo abajo.', type: 'range', min: 130, max: 180, step: 1, unit: '°' },
    { key: 'chestMargin', label: 'Pecho a la barra', help: 'Distancia máxima del hombro por debajo de las manos, en % del brazo. Con el pecho tocando la barra suele estar en un 40-50 %. Más bajo = más exigente.', type: 'range', min: 0.1, max: 1.2, step: 0.01, unit: '%' },
    { key: 'minBodyLineAngle', label: 'Cuerpo recto (hombro-cadera-tobillo)', help: 'Por debajo de este ángulo se considera cadera caída o levantada.', type: 'range', min: 130, max: 180, step: 1, unit: '°' },
  ],
  faults: {
    rowNoDepth: { message: 'El pecho no llegó a la barra', voice: 'pecho a la barra' },
  },
  createAnalyzer: () => new RowAnalyzer(),
};
