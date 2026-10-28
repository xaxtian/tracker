import type { EccentricRule, GeneralSettings, Pt } from '../models/types';
import { Analyzer, EMPTY, FrameEval, SEGMENT, facingSide } from '../analysis/analyzer';
import { SidePicker, angle, dist, leanFromVertical, visible } from '../analysis/geometry';
import { ECCENTRIC_DEFAULTS, ExerciseModule } from './exercise';

/** Strictness criteria for squats (side view). */
export interface SquatSettings extends EccentricRule {
  /** Knee angle (deg) that counts as standing fully upright. */
  topKneeAngle: number;
  /** Depth test: hip below the knee, or knee closed to `bottomKneeAngle`. */
  depthMode: 'hipBelowKnee' | 'kneeAngle';
  /** Extra depth required below the knee, as a fraction of the thigh length (negative = more lenient). */
  depthOffset: number;
  /** Knee angle (deg) to reach when `depthMode` is `kneeAngle`. */
  bottomKneeAngle: number;
  /** Maximum torso lean from vertical (deg). */
  maxTorsoLean: number;
  /** Reject reps where the heels come off the floor. */
  checkHeels: boolean;
  /** Allowed heel rise, as a fraction of the shin length. */
  heelTolerance: number;
}

/** Squat seen from the side: knee angle, hip depth, torso lean and (optionally) heel rise. */
export class SquatAnalyzer implements Analyzer<SquatSettings> {
  readonly noDepthFault = 'squatNoDepth';
  readonly flexIsEccentric = true;
  readonly bodyRatio = SEGMENT.thigh + SEGMENT.shank + SEGMENT.trunk;
  private side = new SidePicker();
  private heelBase = 0;

  private pts(lm: Pt[]) {
    return facingSide(this.side, lm, ['shoulder', 'hip', 'knee', 'ankle']);
  }

  startRep(lm: Pt[]): void {
    const p = this.pts(lm);
    this.heelBase = p.toe.y - p.heel.y;
  }

  evaluate(lm: Pt[], s: SquatSettings, g: GeneralSettings): FrameEval {
    const p = this.pts(lm);
    if (!visible(g.minVisibility, p.sh, p.hip, p.knee, p.ankle)) return EMPTY;

    const knee = angle(p.hip, p.knee, p.ankle);
    const lean = leanFromVertical(p.hip, p.sh);
    const thigh = dist(p.hip, p.knee);
    const shin = dist(p.knee, p.ankle);
    // > 0 when the hip is below the top of the knee
    const hipDepth = (p.hip.y - p.knee.y) / (thigh || 1);

    const bottom = s.depthMode === 'hipBelowKnee' ? hipDepth >= s.depthOffset : knee <= s.bottomKneeAngle;

    const faults: string[] = [];
    if (lean > s.maxTorsoLean) faults.push('torsoLean');
    if (s.checkHeels && visible(g.minVisibility, p.heel, p.toe)) {
      const rise = (p.toe.y - p.heel.y - this.heelBase) / (shin || 1);
      if (rise > s.heelTolerance) faults.push('heelsUp');
    }

    return {
      ok: true,
      inPosition: true,
      angle: knee,
      extended: knee >= s.topKneeAngle,
      bottom,
      faults,
      metrics: { rodilla: knee, tronco: lean, profundidad: hipDepth * 100 },
      joint: p.knee,
      trackY: p.hip.y,
      bodyPx: thigh + shin + dist(p.sh, p.hip),
      side: p.side,
    };
  }
}

/** Back squat / air squat. */
export const squat: ExerciseModule<'squat', SquatSettings> = {
  id: 'squat',
  name: 'Sentadillas',
  icon: '🏋️',
  category: 'Piernas',
  camera: 'side',
  tips: [
    'Coloca la cámara de lado, a 2-3 m y a la altura de la cadera.',
    'Que se vea el cuerpo entero, de la cabeza a los pies.',
    'Empieza de pie con las piernas estiradas.',
  ],
  hints: { position: 'Colócate de lado con el cuerpo entero visible', start: 'Ponte de pie con las piernas estiradas' },
  pauseLabels: { turn: 'Pausa abajo', between: 'Pausa arriba' },
  setEnd: 'inactivity',
  defaults: {
    topKneeAngle: 165,
    depthMode: 'hipBelowKnee',
    depthOffset: 0,
    bottomKneeAngle: 90,
    maxTorsoLean: 50,
    checkHeels: false,
    heelTolerance: 0.08,
    ...ECCENTRIC_DEFAULTS,
  },
  fields: [
    { key: 'topKneeAngle', label: 'Extensión arriba', help: 'Ángulo de rodilla mínimo para considerar que estás de pie del todo.', type: 'range', min: 140, max: 180, step: 1, unit: '°' },
    {
      key: 'depthMode', label: 'Criterio de profundidad', help: 'Cómo se decide que has bajado lo suficiente.', type: 'select',
      options: [
        { value: 'hipBelowKnee', label: 'Cadera por debajo de la rodilla' },
        { value: 'kneeAngle', label: 'Ángulo de rodilla' },
      ],
    },
    { key: 'depthOffset', label: 'Margen de profundidad', help: 'Positivo = más exigente (cadera más baja que la rodilla). Negativo = más permisivo. En % de la longitud del muslo.', type: 'range', min: -0.3, max: 0.3, step: 0.01, unit: '%', when: (s) => s.depthMode === 'hipBelowKnee' },
    { key: 'bottomKneeAngle', label: 'Ángulo de rodilla abajo', help: 'La rodilla tiene que cerrarse al menos hasta este ángulo.', type: 'range', min: 50, max: 130, step: 1, unit: '°', when: (s) => s.depthMode === 'kneeAngle' },
    { key: 'maxTorsoLean', label: 'Inclinación máxima del tronco', help: 'Ángulo máximo del tronco respecto a la vertical.', type: 'range', min: 20, max: 80, step: 1, unit: '°' },
    { key: 'checkHeels', label: 'Comprobar talones', help: 'Invalida la repetición si levantas los talones. Necesita buena visibilidad de los pies.', type: 'toggle' },
    { key: 'heelTolerance', label: 'Tolerancia de talones', help: 'Cuánto se pueden levantar los talones, en % de la longitud de la espinilla.', type: 'range', min: 0.02, max: 0.3, step: 0.01, unit: '%', when: (s) => s.checkHeels },
  ],
  faults: {
    squatNoDepth: { message: 'No bajaste del paralelo', voice: 'más abajo' },
    torsoLean: { message: 'Tronco demasiado inclinado', voice: 'pecho arriba' },
    heelsUp: { message: 'Levantaste los talones', voice: 'talones' },
  },
  createAnalyzer: () => new SquatAnalyzer(),
};
