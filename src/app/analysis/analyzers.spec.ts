import { AppSettings } from '../models/types';
import { DEFAULT_SETTINGS } from '../services/settings.service';
import { landmarks, pullupPose, pushupPose, squatPose } from '../../testing/landmarks';
import { createAnalyzer } from './analyzers';
import { LM } from './geometry';

const settings = (patch: (s: AppSettings) => void = () => undefined): AppSettings => {
  const s = structuredClone(DEFAULT_SETTINGS);
  patch(s);
  return s;
};

describe('createAnalyzer', () => {
  it('describes each exercise', () => {
    const squat = createAnalyzer('squat'), push = createAnalyzer('pushup'), pull = createAnalyzer('pullup');
    expect([squat.noDepthFault, push.noDepthFault, pull.noDepthFault]).toEqual(['squatNoDepth', 'pushupNoDepth', 'pullupNoDepth']);
    // Going down is the eccentric phase in squats and push-ups, the concentric one in pull-ups.
    expect([squat.flexIsEccentric, push.flexIsEccentric, pull.flexIsEccentric]).toEqual([true, true, false]);
    expect(squat.bodyRatio).toBeCloseTo(0.779);
    expect(push.bodyRatio).toBeCloseTo(0.779);
    expect(pull.bodyRatio).toBeCloseTo(0.62);
  });
});

describe('SquatAnalyzer', () => {
  const s = settings();

  it('reports the knee angle and full extension when standing', () => {
    const ev = createAnalyzer('squat').evaluate(squatPose(175), s);
    expect(ev.ok).toBe(true);
    expect(ev.inPosition).toBe(true);
    expect(ev.angle).toBeCloseTo(175, 0);
    expect(ev.extended).toBe(true);
    expect(ev.bottom).toBe(false);
    expect(ev.faults).toEqual([]);
    expect(Object.keys(ev.metrics)).toEqual(['rodilla', 'tronco', 'profundidad']);
  });

  it('detects depth when the hip goes below the knee', () => {
    const a = createAnalyzer('squat');
    expect(a.evaluate(squatPose(60), s).bottom).toBe(false);
    const deep = a.evaluate(squatPose(35), s);
    expect(deep.bottom).toBe(true);
    expect(deep.extended).toBe(false);
    expect(deep.metrics['profundidad']).toBeGreaterThan(0);
  });

  it('can use the knee angle as depth criterion', () => {
    const k = settings((x) => (x.squat.depthMode = 'kneeAngle'));
    const a = createAnalyzer('squat');
    expect(a.evaluate(squatPose(95), k).bottom).toBe(false);
    expect(a.evaluate(squatPose(85), k).bottom).toBe(true);
  });

  it('flags too much torso lean', () => {
    const ev = createAnalyzer('squat').evaluate(squatPose(100, 60), s);
    expect(ev.faults).toContain('torsoLean');
  });

  it('flags raised heels only when the check is on', () => {
    const a = createAnalyzer('squat');
    const start = squatPose(175);
    a.startRep(start);
    const up = squatPose(120);
    up[LM.heelL] = { ...up[LM.heelL], y: up[LM.heelL].y - 30 };
    expect(a.evaluate(up, s).faults).not.toContain('heelsUp');
    expect(a.evaluate(up, settings((x) => (x.squat.checkHeels = true))).faults).toContain('heelsUp');
  });

  it('gives the hip height and body length used for velocity', () => {
    const ev = createAnalyzer('squat').evaluate(squatPose(175), s);
    const pose = squatPose(175);
    expect(ev.trackY).toBeCloseTo(pose[LM.hipL].y);
    // thigh + shank + trunk = 0.779 × 1.75 m × 300 px/m
    expect(ev.bodyPx).toBeCloseTo(0.779 * 1.75 * 300, 0);
    expect(ev.joint).toEqual(pose[LM.kneeL]);
  });

  it('returns an empty evaluation when a key joint is not visible', () => {
    const pose = squatPose(175);
    pose[LM.kneeL].v = 0.1;
    const ev = createAnalyzer('squat').evaluate(pose, s);
    expect(ev.ok).toBe(false);
    expect(ev.inPosition).toBe(false);
  });
});

describe('PushupAnalyzer', () => {
  const s = settings();

  it('recognises a straight-arm plank', () => {
    const ev = createAnalyzer('pushup').evaluate(pushupPose(), s);
    expect(ev.ok).toBe(true);
    expect(ev.inPosition).toBe(true);
    expect(ev.angle).toBeCloseTo(180);
    expect(ev.extended).toBe(true);
    expect(ev.bottom).toBe(false);
    expect(ev.faults).toEqual([]);
    expect(ev.trackY).toBe(300);
    expect(ev.bodyPx).toBeCloseTo(500);
  });

  it('detects the bottom with bent elbows', () => {
    const ev = createAnalyzer('pushup').evaluate(pushupPose({ elbow: 'bent' }), s);
    expect(ev.angle).toBeCloseTo(53.13, 1);
    expect(ev.bottom).toBe(true);
    expect(ev.extended).toBe(false);
  });

  it('tells a sagging hip from a piked hip', () => {
    const a = createAnalyzer('pushup');
    expect(a.evaluate(pushupPose({ hipDy: 60 }), s).faults).toEqual(['hipSag']);
    expect(a.evaluate(pushupPose({ hipDy: -60 }), s).faults).toEqual(['hipPike']);
  });

  it('flags bent knees while still in plank', () => {
    const ev = createAnalyzer('pushup').evaluate(pushupPose({ kneeDy: -50 }), s);
    expect(ev.inPosition).toBe(true);
    expect(ev.faults).toEqual(['kneesBent']);
  });

  it('is out of position when standing up', () => {
    const standing = landmarks({ 11: [100, 100], 13: [100, 180], 15: [100, 260], 23: [100, 300], 25: [100, 450], 27: [100, 600] });
    expect(createAnalyzer('pushup').evaluate(standing, s).inPosition).toBe(false);
  });

  it('works without the ankle (knee push-up view) but cannot scale velocity', () => {
    const pose = pushupPose();
    pose[LM.ankleL].v = 0.1;
    const ev = createAnalyzer('pushup').evaluate(pose, s);
    expect(ev.ok).toBe(true);
    expect(ev.metrics['rodilla']).toBe(180);
    expect(ev.bodyPx).toBeUndefined();
  });

  it('uses the right side when it is the visible one', () => {
    const right = landmarks({ 12: [100, 300], 14: [100, 350], 16: [100, 400], 24: [300, 300], 26: [450, 300], 28: [600, 300] });
    const ev = createAnalyzer('pushup').evaluate(right, s);
    expect(ev.ok).toBe(true);
    expect(ev.extended).toBe(true);
  });

  it('returns an empty evaluation when the arm is not visible', () => {
    const pose = pushupPose();
    pose[LM.wristL].v = 0;
    expect(createAnalyzer('pushup').evaluate(pose, s).ok).toBe(false);
  });
});

describe('PullupAnalyzer', () => {
  const s = settings();

  it('recognises a dead hang', () => {
    const ev = createAnalyzer('pullup').evaluate(pullupPose('hang'), s);
    expect(ev.ok).toBe(true);
    expect(ev.inPosition).toBe(true);
    expect(ev.extended).toBe(true);
    expect(ev.bottom).toBe(false);
    expect(ev.metrics['barbilla']).toBeCloseTo(-75);
    expect(ev.trackY).toBe(300);
    expect(ev.bodyPx).toBeCloseTo(200 + Math.hypot(15, 100) + Math.hypot(5, 100), 3);
  });

  it('counts the top when the mouth passes the hands', () => {
    const ev = createAnalyzer('pullup').evaluate(pullupPose('top'), s);
    expect(ev.bottom).toBe(true);
    expect(ev.extended).toBe(false);
    expect(ev.metrics['barbilla']).toBeCloseTo(10);
  });

  it('respects a stricter chin margin', () => {
    const strict = settings((x) => (x.pullup.chinMargin = 0.2));
    expect(createAnalyzer('pullup').evaluate(pullupPose('top'), strict).bottom).toBe(false);
  });

  it('flags swinging relative to the start of the rep', () => {
    const a = createAnalyzer('pullup');
    a.startRep(pullupPose('hang'));
    expect(a.evaluate(pullupPose('hang', { hipDx: 20 }), s).faults).toEqual([]);
    expect(a.evaluate(pullupPose('hang', { hipDx: 80 }), s).faults).toContain('swing');
  });

  it('flags kipping when the knees bend during the rep', () => {
    const a = createAnalyzer('pullup');
    a.evaluate(pullupPose('hang'), s);
    a.startRep(pullupPose('hang'));
    expect(a.evaluate(pullupPose('top', { kneeBend: 100 }), s).faults).toContain('kip');
  });

  it('is out of position when the hands are below the shoulders', () => {
    const pose = pullupPose('hang');
    pose[LM.wristL].y = 450;
    pose[LM.wristR].y = 450;
    expect(createAnalyzer('pullup').evaluate(pose, s).inPosition).toBe(false);
  });

  it('works with hidden hips but cannot measure swing or velocity scale', () => {
    const pose = pullupPose('hang', { hipDx: 200 });
    pose[LM.hipL].v = 0;
    pose[LM.hipR].v = 0;
    const ev = createAnalyzer('pullup').evaluate(pose, s);
    expect(ev.ok).toBe(true);
    expect(ev.faults).not.toContain('swing');
    expect(ev.bodyPx).toBeUndefined();
  });

  it('needs at least one arm and the mouth', () => {
    const noMouth = pullupPose('hang');
    noMouth[9].v = 0;
    expect(createAnalyzer('pullup').evaluate(noMouth, s).ok).toBe(false);
    const oneArm = pullupPose('hang');
    oneArm[LM.wristR].v = 0;
    expect(createAnalyzer('pullup').evaluate(oneArm, s).ok).toBe(true);
  });
});
