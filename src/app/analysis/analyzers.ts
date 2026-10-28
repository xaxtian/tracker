import { AppSettings, ExerciseId, Pt } from '../models/types';
import {
  LM, SidePicker, angle, belowLine, dist, fromHorizontal, leanFromVertical, mid, visible,
} from './geometry';

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
}

export interface Analyzer {
  readonly noDepthFault: string;
  /** Closing the joint is the eccentric phase (squat, push-up) or the concentric one (pull-up). */
  readonly flexIsEccentric: boolean;
  /** Fraction of body height covered by the segments summed in bodyPx (Winter's anthropometric ratios). */
  readonly bodyRatio: number;
  /** Called when a rep starts, to store baselines (hip position, knee angle…). */
  startRep(lm: Pt[]): void;
  evaluate(lm: Pt[], s: AppSettings): FrameEval;
}

const EMPTY: FrameEval = {
  ok: false, inPosition: false, angle: 0, extended: false, bottom: false, faults: [], metrics: {},
};

// Segment lengths as a fraction of body height (Winter, Biomechanics of Human Movement).
const THIGH = 0.245, SHANK = 0.246, TRUNK = 0.288, UPPER_ARM = 0.186, FOREARM = 0.146;

class SquatAnalyzer implements Analyzer {
  readonly noDepthFault = 'squatNoDepth';
  readonly flexIsEccentric = true;
  readonly bodyRatio = THIGH + SHANK + TRUNK;
  private side = new SidePicker();
  private heelBase = 0;

  private pts(lm: Pt[]) {
    const s = this.side.pick(
      lm,
      [LM.shoulderL, LM.hipL, LM.kneeL, LM.ankleL],
      [LM.shoulderR, LM.hipR, LM.kneeR, LM.ankleR],
    );
    const L = s === 'L';
    return {
      sh: lm[L ? LM.shoulderL : LM.shoulderR],
      hip: lm[L ? LM.hipL : LM.hipR],
      knee: lm[L ? LM.kneeL : LM.kneeR],
      ankle: lm[L ? LM.ankleL : LM.ankleR],
      heel: lm[L ? LM.heelL : LM.heelR],
      toe: lm[L ? LM.toeL : LM.toeR],
    };
  }

  startRep(lm: Pt[]): void {
    const p = this.pts(lm);
    this.heelBase = p.toe.y - p.heel.y;
  }

  evaluate(lm: Pt[], all: AppSettings): FrameEval {
    const s = all.squat;
    const p = this.pts(lm);
    if (!visible(all.general.minVisibility, p.sh, p.hip, p.knee, p.ankle)) return EMPTY;

    const knee = angle(p.hip, p.knee, p.ankle);
    const lean = leanFromVertical(p.hip, p.sh);
    const thigh = dist(p.hip, p.knee);
    const shin = dist(p.knee, p.ankle);
    // > 0 when the hip is below the top of the knee
    const hipDepth = (p.hip.y - p.knee.y) / (thigh || 1);

    const bottom = s.depthMode === 'hipBelowKnee' ? hipDepth >= s.depthOffset : knee <= s.bottomKneeAngle;

    const faults: string[] = [];
    if (lean > s.maxTorsoLean) faults.push('torsoLean');
    if (s.checkHeels && visible(all.general.minVisibility, p.heel, p.toe)) {
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
    };
  }
}

class PushupAnalyzer implements Analyzer {
  readonly noDepthFault = 'pushupNoDepth';
  readonly flexIsEccentric = true;
  readonly bodyRatio = THIGH + SHANK + TRUNK;
  private side = new SidePicker();

  startRep(): void {}

  evaluate(lm: Pt[], all: AppSettings): FrameEval {
    const s = all.pushup;
    const min = all.general.minVisibility;
    const side = this.side.pick(
      lm,
      [LM.shoulderL, LM.elbowL, LM.wristL, LM.hipL, LM.kneeL],
      [LM.shoulderR, LM.elbowR, LM.wristR, LM.hipR, LM.kneeR],
    );
    const L = side === 'L';
    const sh = lm[L ? LM.shoulderL : LM.shoulderR];
    const el = lm[L ? LM.elbowL : LM.elbowR];
    const wr = lm[L ? LM.wristL : LM.wristR];
    const hip = lm[L ? LM.hipL : LM.hipR];
    const knee = lm[L ? LM.kneeL : LM.kneeR];
    const ankle = lm[L ? LM.ankleL : LM.ankleR];

    if (!visible(min, sh, el, wr, hip, knee)) return EMPTY;
    const hasAnkle = visible(min, ankle);
    const foot = hasAnkle ? ankle : knee;

    const elbow = angle(sh, el, wr);
    const bodyLine = angle(sh, hip, foot);
    const kneeAngle = hasAnkle ? angle(hip, knee, ankle) : 180;
    const horizontal = fromHorizontal(sh, foot) < 40;
    const inPosition = horizontal && kneeAngle > 120 && wr.y > sh.y - dist(sh, el) * 0.3;

    const faults: string[] = [];
    if (bodyLine < s.minBodyLineAngle) {
      faults.push(belowLine(hip, sh, foot) > 0 ? 'hipSag' : 'hipPike');
    }
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
    };
  }
}

class PullupAnalyzer implements Analyzer {
  readonly noDepthFault = 'pullupNoDepth';
  readonly flexIsEccentric = false;
  readonly bodyRatio = TRUNK + UPPER_ARM + FOREARM;
  private baseHipX = 0;
  private baseKnee: number | null = null;
  private lastMin = 0.5;

  private kneeAngle(lm: Pt[], min: number): number | null {
    const sides = [
      [LM.hipL, LM.kneeL, LM.ankleL],
      [LM.hipR, LM.kneeR, LM.ankleR],
    ].filter(([h, k, a]) => visible(min, lm[h], lm[k], lm[a]));
    if (!sides.length) return null;
    return sides.reduce((s, [h, k, a]) => s + angle(lm[h], lm[k], lm[a]), 0) / sides.length;
  }

  startRep(lm: Pt[]): void {
    this.baseHipX = mid(lm[LM.hipL], lm[LM.hipR]).x;
    this.baseKnee = this.kneeAngle(lm, this.lastMin);
  }

  evaluate(lm: Pt[], all: AppSettings): FrameEval {
    const s = all.pullup;
    const min = all.general.minVisibility;
    this.lastMin = min;

    const arms = [
      [LM.shoulderL, LM.elbowL, LM.wristL],
      [LM.shoulderR, LM.elbowR, LM.wristR],
    ].filter(([a, b, c]) => visible(min, lm[a], lm[b], lm[c]));
    const mouth = mid(lm[LM.mouthL], lm[LM.mouthR]);
    const hip = mid(lm[LM.hipL], lm[LM.hipR]);
    if (!arms.length || !visible(min, mouth)) return EMPTY;

    const elbow = arms.reduce((s, [a, b, c]) => s + angle(lm[a], lm[b], lm[c]), 0) / arms.length;
    const wristY = arms.reduce((s, [, , c]) => s + lm[c].y, 0) / arms.length;
    const shoulderY = arms.reduce((s, [a]) => s + lm[a].y, 0) / arms.length;
    const shoulders = mid(lm[LM.shoulderL], lm[LM.shoulderR]);
    const torso = hip.v >= min ? dist(shoulders, hip) : dist(lm[LM.shoulderL], lm[LM.shoulderR]) * 1.4;

    const inPosition = wristY < shoulderY;
    // > 0 when the mouth is above the hands (bar)
    const chinOver = (wristY - mouth.y) / (torso || 1);

    const faults: string[] = [];
    if (hip.v >= min && Math.abs(hip.x - this.baseHipX) / (torso || 1) > s.maxHipSwing) faults.push('swing');
    const knee = this.kneeAngle(lm, min);
    if (knee !== null && this.baseKnee !== null && Math.abs(knee - this.baseKnee) > s.maxKneeAngleChange) {
      faults.push('kip');
    }

    return {
      ok: true,
      inPosition,
      angle: elbow,
      extended: elbow >= s.hangElbowAngle,
      bottom: chinOver >= s.chinMargin,
      faults,
      metrics: { codo: elbow, barbilla: chinOver * 100, ...(knee !== null ? { rodilla: knee } : {}) },
      joint: arms.length ? lm[arms[0][1]] : undefined,
      trackY: shoulders.y,
      bodyPx: hip.v >= min
        ? dist(shoulders, hip) + arms.reduce((n, [a, b, c]) => n + dist(lm[a], lm[b]) + dist(lm[b], lm[c]), 0) / arms.length
        : undefined,
    };
  }
}

export function createAnalyzer(ex: ExerciseId): Analyzer {
  switch (ex) {
    case 'squat': return new SquatAnalyzer();
    case 'pushup': return new PushupAnalyzer();
    case 'pullup': return new PullupAnalyzer();
  }
}
