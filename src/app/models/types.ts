import type { RepTempo } from '../analysis/tempo';

export type { RepTempo };

/** The exercises the app can track. */
export type ExerciseId = 'squat' | 'pushup' | 'pullup';

/** Optional strictness rule shared by all exercises. */
export interface EccentricRule {
  /** Reject reps whose eccentric (lowering) phase is shorter than `minEccentricSec`. */
  checkEccentric: boolean;
  /** Minimum eccentric duration in seconds. */
  minEccentricSec: number;
}

/** Landmark in pixel coordinates (x right, y down) with visibility 0..1. */
export interface Pt {
  /** Horizontal position in video pixels. */
  x: number;
  /** Vertical position in video pixels (grows downwards). */
  y: number;
  /** MediaPipe visibility score, 0..1. */
  v: number;
}

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

/** Settings shared by every exercise. */
export interface GeneralSettings {
  /** Seconds without reps that close a squat set (push-ups use three times this). */
  restTimeoutSec: number;
  /** Seconds out of position (off the bar, out of plank, out of frame) that close a set. */
  offPositionSec: number;
  /** Minimum landmark visibility to analyse a joint. */
  minVisibility: number;
  /** Consecutive frames a technique fault must be seen to invalidate a rep. */
  faultFrames: number;
  /** Degrees the joint must close to count as an attempt. */
  minRange: number;
  /** Landmark smoothing, 0 (none) .. 0.9 (heavy, laggy). */
  smoothing: number;
  /** Speak rep counts and faults. */
  voice: boolean;
  /** Beep on every rep. */
  beep: boolean;
  /** Draw measured angles on screen. */
  showAngles: boolean;
  /** Start recording as soon as the camera starts. */
  autoRecord: boolean;
  /** Ask the camera for 60 fps. */
  highFps: boolean;
  /** User height, used to convert pixels to metres. */
  userHeightCm: number;
  /** MediaPipe model: lighter/faster or full/more accurate. */
  model: 'lite' | 'full';
}

/** Every user setting, grouped by section. */
export interface AppSettings {
  general: GeneralSettings;
  squat: SquatSettings;
  pushup: PushupSettings;
  pullup: PullupSettings;
}

/** A section of {@link AppSettings}. */
export type SettingsSection = keyof AppSettings;

/** A finished rep as produced by the rep counter. */
export interface RepResult {
  /** True when it met every strictness criterion. */
  valid: boolean;
  /** Fault ids that made it invalid (keys of {@link FAULT_MESSAGES}). */
  reasons: string[];
  /** Epoch ms when the rep started (left the top position). */
  start: number;
  /** Epoch ms when it was completed. */
  end: number;
  /** Phase timing and velocity, when it could be measured. */
  tempo?: RepTempo;
}

/** A rep as stored in the history. */
export interface RepRecord {
  /** True when it met every strictness criterion. */
  valid: boolean;
  /** Fault ids that made it invalid. */
  reasons: string[];
  /** Phase timing and velocity, when it could be measured. */
  tempo?: RepTempo;
}

/** A set as stored in the history. */
export interface SetRecord {
  /** Unique id. */
  id: string;
  exercise: ExerciseId;
  /** Epoch ms of the first rep's start. */
  start: number;
  /** Epoch ms of the last rep's end. */
  end: number;
  /** Number of valid reps. */
  valid: number;
  /** Number of invalid reps. */
  invalid: number;
  /** Fault id -> times it invalidated a rep. */
  reasons: Record<string, number>;
  /** Seconds since the previous set ended (null for the first set of a session). */
  restBeforeSec: number | null;
  /** Extra load in kg (weight, vest, belt). Negative = assisted (band). Missing/0 = bodyweight. */
  loadKg?: number;
  /** Per-rep detail (sets recorded before tempo tracking don't have it). */
  reps?: RepRecord[];
  /** Recording that contains this set, and where it starts in it. */
  recordingId?: string;
  videoOffsetSec?: number;
}

/** Display name, icon and camera placement tips of each exercise. */
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

/** On-screen explanation of each fault id. */
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
  // tempo
  fastEccentric: 'Bajada demasiado rápida',
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
  fastEccentric: 'baja más lento',
  kip: 'sin impulso',
};

/** Names of the two pauses, which depend on where the joint is flexed. */
export const PAUSE_LABELS: Record<ExerciseId, { turn: string; between: string }> = {
  squat: { turn: 'Pausa abajo', between: 'Pausa arriba' },
  pushup: { turn: 'Pausa abajo', between: 'Pausa arriba' },
  pullup: { turn: 'Pausa arriba', between: 'Pausa colgado' },
};
