export type ExerciseId = 'squat' | 'pushup' | 'pullup';

/** Landmark in pixel coordinates (x right, y down) with visibility 0..1. */
export interface Pt {
  x: number;
  y: number;
  v: number;
}

export interface SquatSettings {
  topKneeAngle: number;
  depthMode: 'hipBelowKnee' | 'kneeAngle';
  depthOffset: number;
  bottomKneeAngle: number;
  maxTorsoLean: number;
  checkHeels: boolean;
  heelTolerance: number;
}

export interface PushupSettings {
  topElbowAngle: number;
  bottomElbowAngle: number;
  minBodyLineAngle: number;
  minKneeAngle: number;
}

export interface PullupSettings {
  hangElbowAngle: number;
  chinMargin: number;
  maxHipSwing: number;
  maxKneeAngleChange: number;
}

export interface GeneralSettings {
  restTimeoutSec: number;
  offPositionSec: number;
  minVisibility: number;
  faultFrames: number;
  minRange: number;
  smoothing: number;
  voice: boolean;
  beep: boolean;
  showAngles: boolean;
  autoRecord: boolean;
  model: 'lite' | 'full';
}

export interface AppSettings {
  general: GeneralSettings;
  squat: SquatSettings;
  pushup: PushupSettings;
  pullup: PullupSettings;
}

export type SettingsSection = keyof AppSettings;

export interface RepResult {
  valid: boolean;
  reasons: string[];
  start: number;
  end: number;
}

export interface SetRecord {
  id: string;
  exercise: ExerciseId;
  start: number;
  end: number;
  valid: number;
  invalid: number;
  /** Fault id -> times it invalidated a rep. */
  reasons: Record<string, number>;
  restBeforeSec: number | null;
  /** Recording that contains this set, and where it starts in it. */
  recordingId?: string;
  videoOffsetSec?: number;
}

export const EXERCISES: Record<ExerciseId, { name: string; icon: string; tips: string[] }> = {
  squat: {
    name: 'Sentadillas',
    icon: '🏋️',
    tips: [
      'Coloca la cámara de lado, a 2-3 m y a la altura de la cadera.',
      'Que se vea el cuerpo entero, de la cabeza a los pies.',
      'Empieza de pie con las piernas estiradas.',
    ],
  },
  pushup: {
    name: 'Flexiones',
    icon: '💪',
    tips: [
      'Coloca la cámara de lado, en el suelo o a poca altura, a 2 m.',
      'Que se vea el cuerpo entero, de la cabeza a los pies.',
      'Empieza en plancha con los brazos estirados.',
    ],
  },
  pullup: {
    name: 'Dominadas',
    icon: '🧗',
    tips: [
      'Coloca la cámara de frente, lo bastante lejos para ver manos y pies.',
      'Empieza colgado con los brazos completamente estirados.',
      'La serie termina sola cuando te bajas de la barra.',
    ],
  },
};

export const FAULT_MESSAGES: Record<string, string> = {
  // common
  noDepth: 'No llegaste abajo del todo',
  noLockout: 'No extendiste del todo',
  noStart: 'No empezaste desde extensión completa',
  // squat
  squatNoDepth: 'No bajaste del paralelo',
  torsoLean: 'Tronco demasiado inclinado',
  heelsUp: 'Levantaste los talones',
  // pushup
  pushupNoDepth: 'No bajaste lo suficiente',
  hipSag: 'Cadera caída',
  hipPike: 'Cadera demasiado alta',
  kneesBent: 'Rodillas dobladas',
  // pullup
  pullupNoDepth: 'La barbilla no superó la barra',
  swing: 'Balanceo del cuerpo',
  kip: 'Impulso con las piernas (kipping)',
};

/** Short phrases for voice feedback. */
export const FAULT_VOICE: Record<string, string> = {
  noLockout: 'extiende del todo',
  noStart: 'empieza extendido',
  squatNoDepth: 'más abajo',
  torsoLean: 'pecho arriba',
  heelsUp: 'talones',
  pushupNoDepth: 'más abajo',
  hipSag: 'cadera caída',
  hipPike: 'cadera alta',
  kneesBent: 'rodillas',
  pullupNoDepth: 'barbilla arriba',
  swing: 'sin balanceo',
  kip: 'sin impulso',
};
