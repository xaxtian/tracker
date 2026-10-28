import type { EccentricRule, GeneralSettings, Pt } from '../models/types';
import { Analyzer, EMPTY, FrameEval, SEGMENT, facingSide } from '../analysis/analyzer';
import { SidePicker, angle, dist, visible } from '../analysis/geometry';
import { kneeAngle } from './common';
import { ECCENTRIC_DEFAULTS, ExerciseModule } from './exercise';

/** Strictness criteria for hanging leg raises (side view). */
export interface LegRaiseSettings extends EccentricRule {
  /** Hip angle (deg) that counts as hanging straight. */
  hangHipAngle: number;
  /** Hip angle (deg) to reach at the top: 90 = legs parallel to the floor, ~40 = toes to bar. */
  topHipAngle: number;
  /** Require straight legs. */
  straightLegs: boolean;
  /** Minimum knee angle (deg) when straight legs are required. */
  minKneeAngle: number;
  /** Maximum horizontal hip travel during a rep, as a fraction of torso length. */
  maxHipSwing: number;
}

/** Hanging leg raise seen from the side: hip angle, straight legs and no swinging. */
export class LegRaiseAnalyzer implements Analyzer<LegRaiseSettings> {
  readonly noDepthFault = 'legRaiseNoDepth';
  readonly flexIsEccentric = false;
  readonly bodyRatio = SEGMENT.thigh + SEGMENT.shank;
  private side = new SidePicker();
  private baseHipX: number | null = null;

  private pts(lm: Pt[]) {
    return facingSide(this.side, lm, ['shoulder', 'hip', 'knee', 'ankle']);
  }

  startRep(lm: Pt[]): void {
    this.baseHipX = this.pts(lm).hip.x;
  }

  evaluate(lm: Pt[], s: LegRaiseSettings, g: GeneralSettings): FrameEval {
    const min = g.minVisibility;
    const p = this.pts(lm);
    const { sh, wr, hip, knee, ankle } = p;
    if (!visible(min, sh, hip, knee)) return EMPTY;

    const hipAngle = angle(sh, hip, knee);
    const knees = kneeAngle(p, min);
    const torso = dist(sh, hip);
    // Hanging from the bar: hands above the shoulders.
    const inPosition = visible(min, wr) && wr.y < sh.y;

    const faults: string[] = [];
    if (this.baseHipX !== null && Math.abs(hip.x - this.baseHipX) / (torso || 1) > s.maxHipSwing) faults.push('swing');
    if (s.straightLegs && knees !== null && knees < s.minKneeAngle) faults.push('kneesBent');

    const hasAnkle = visible(min, ankle);
    return {
      ok: true,
      inPosition,
      angle: hipAngle,
      extended: hipAngle >= s.hangHipAngle,
      bottom: hipAngle <= s.topHipAngle,
      faults,
      metrics: { cadera: hipAngle, ...(knees !== null ? { rodilla: knees } : {}) },
      joint: hip,
      trackY: hasAnkle ? ankle.y : knee.y,
      bodyPx: hasAnkle ? dist(hip, knee) + dist(knee, ankle) : undefined,
      side: p.side,
    };
  }
}

/** Hanging leg raise / toes to bar. */
export const legRaise: ExerciseModule<'legRaise', LegRaiseSettings> = {
  id: 'legRaise',
  name: 'Elevaciones de piernas',
  icon: '🦵',
  category: 'Core',
  camera: 'side',
  tips: [
    'Coloca la cámara de lado, lo bastante lejos para ver manos y pies.',
    'Empieza colgado con el cuerpo y las piernas estirados.',
    'Para toes to bar, baja el ángulo de cadera arriba en Ajustes.',
  ],
  hints: { position: 'Cuélgate de la barra', start: 'Cuelga con las piernas estiradas para empezar' },
  pauseLabels: { turn: 'Pausa arriba', between: 'Pausa colgado' },
  setEnd: 'offPosition',
  defaults: {
    hangHipAngle: 160,
    topHipAngle: 90,
    straightLegs: true,
    minKneeAngle: 140,
    maxHipSwing: 0.4,
    ...ECCENTRIC_DEFAULTS,
  },
  fields: [
    { key: 'hangHipAngle', label: 'Colgado recto', help: 'Ángulo de cadera mínimo abajo (cuerpo estirado).', type: 'range', min: 130, max: 180, step: 1, unit: '°' },
    { key: 'topHipAngle', label: 'Ángulo de cadera arriba', help: '90° = piernas paralelas al suelo. Unos 40° = pies a la barra (toes to bar). Más bajo = más exigente.', type: 'range', min: 20, max: 120, step: 1, unit: '°' },
    { key: 'straightLegs', label: 'Piernas estiradas', help: 'Invalida la repetición si doblas las rodillas.', type: 'toggle' },
    { key: 'minKneeAngle', label: 'Ángulo de rodilla mínimo', help: 'Por debajo, las rodillas se consideran dobladas.', type: 'range', min: 100, max: 180, step: 1, unit: '°', when: (s) => s.straightLegs },
    { key: 'maxHipSwing', label: 'Balanceo máximo', help: 'Desplazamiento horizontal máximo de la cadera, en % del tronco.', type: 'range', min: 0.05, max: 1, step: 0.01, unit: '%' },
  ],
  faults: {
    legRaiseNoDepth: { message: 'Las piernas no subieron lo suficiente', voice: 'piernas más arriba' },
  },
  createAnalyzer: () => new LegRaiseAnalyzer(),
};
