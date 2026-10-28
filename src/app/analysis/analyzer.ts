import type { GeneralSettings, Pt } from '../models/types';
import { LM, Side, SidePicker } from './geometry';

/** What an analyzer reports for a single video frame. */
export interface FrameEval {
  /** Key landmarks are visible enough to analyze this frame. */
  ok: boolean;
  /** Person is in the exercise position (on the bar, in plank, standing in frame). */
  inPosition: boolean;
  /** Primary joint angle; high = extended, low = flexed. */
  angle: number;
  /** Full extension reached (start/end of a rep). */
  extended: boolean;
  /** Depth / goal of the rep reached. */
  bottom: boolean;
  /** Fault ids detected this frame. */
  faults: string[];
  /** Live metrics shown on screen. */
  metrics: Record<string, number>;
  /** Point where the primary angle is drawn. */
  joint?: Pt;
  /** Vertical pixel position of the point whose velocity is measured. */
  trackY?: number;
  /** Pixel length of the reference segments used to convert px to metres. */
  bodyPx?: number;
  /** Body side being analysed (side-view exercises). */
  side?: Side;
}

/**
 * Turns the landmarks of one frame into a {@link FrameEval} for one exercise.
 * Every exercise module provides one. `S` is the exercise's own settings.
 */
export interface Analyzer<S = unknown> {
  /** Fault id used when a rep does not reach the required depth / height. */
  readonly noDepthFault: string;
  /** Closing the joint is the eccentric phase (squat, push-up) or the concentric one (pull-up). */
  readonly flexIsEccentric: boolean;
  /** Fraction of body height covered by the segments summed in bodyPx (Winter's anthropometric ratios). */
  readonly bodyRatio: number;
  /** Called when a rep starts, to store baselines (hip position, knee angle…). */
  startRep(lm: Pt[]): void;
  /** Evaluates one frame with the exercise settings and the general settings. */
  evaluate(lm: Pt[], s: S, g: GeneralSettings): FrameEval;
}

/** Evaluation returned when the key joints are not visible. */
export const EMPTY: FrameEval = {
  ok: false, inPosition: false, angle: 0, extended: false, bottom: false, faults: [], metrics: {},
};

/** Segment lengths as a fraction of body height (Winter, Biomechanics of Human Movement). */
export const SEGMENT = {
  thigh: 0.245,
  shank: 0.246,
  trunk: 0.288,
  upperArm: 0.186,
  forearm: 0.146,
} as const;

/** The landmarks of one body side. */
export interface SidePoints {
  side: Side;
  sh: Pt;
  el: Pt;
  wr: Pt;
  hip: Pt;
  knee: Pt;
  ankle: Pt;
  heel: Pt;
  toe: Pt;
}

/** Joint names, used to tell the side picker which joints matter for an exercise. */
export type Joint = 'shoulder' | 'elbow' | 'wrist' | 'hip' | 'knee' | 'ankle';

const IDS: Record<Joint, [number, number]> = {
  shoulder: [LM.shoulderL, LM.shoulderR],
  elbow: [LM.elbowL, LM.elbowR],
  wrist: [LM.wristL, LM.wristR],
  hip: [LM.hipL, LM.hipR],
  knee: [LM.kneeL, LM.kneeR],
  ankle: [LM.ankleL, LM.ankleR],
};

/** Landmarks of the given side. */
export function sidePoints(lm: Pt[], side: Side): SidePoints {
  const i = side === 'L' ? 0 : 1;
  return {
    side,
    sh: lm[IDS.shoulder[i]],
    el: lm[IDS.elbow[i]],
    wr: lm[IDS.wrist[i]],
    hip: lm[IDS.hip[i]],
    knee: lm[IDS.knee[i]],
    ankle: lm[IDS.ankle[i]],
    heel: lm[side === 'L' ? LM.heelL : LM.heelR],
    toe: lm[side === 'L' ? LM.toeL : LM.toeR],
  };
}

/** Landmarks of the side facing the camera, judged by the given joints. */
export function facingSide(picker: SidePicker, lm: Pt[], joints: Joint[]): SidePoints {
  const side = picker.pick(lm, joints.map((j) => IDS[j][0]), joints.map((j) => IDS[j][1]));
  return sidePoints(lm, side);
}
