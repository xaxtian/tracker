import { LM } from '../analysis/geometry';
import { DEFAULT_SETTINGS } from '../services/settings.service';
import { squatPose } from '../../testing/landmarks';
import { SquatSettings, squat } from './squat';

const g = DEFAULT_SETTINGS.general;
const s = (patch: Partial<SquatSettings> = {}): SquatSettings => ({ ...squat.defaults, ...patch });

describe('squat module', () => {
  it('describes a side-view leg exercise ended by inactivity', () => {
    expect(squat).toMatchObject({ id: 'squat', category: 'Piernas', camera: 'side', setEnd: 'inactivity' });
    const a = squat.createAnalyzer();
    expect(a.flexIsEccentric).toBe(true);
    expect(a.bodyRatio).toBeCloseTo(0.779);
    expect(squat.faults[a.noDepthFault]).toBeDefined();
  });

  it('reports the knee angle and full extension when standing', () => {
    const ev = squat.createAnalyzer().evaluate(squatPose(175), s(), g);
    expect(ev).toMatchObject({ ok: true, inPosition: true, extended: true, bottom: false, faults: [], side: 'L' });
    expect(ev.angle).toBeCloseTo(175, 0);
    expect(Object.keys(ev.metrics)).toEqual(['rodilla', 'tronco', 'profundidad']);
  });

  it('detects depth when the hip goes below the knee', () => {
    const a = squat.createAnalyzer();
    expect(a.evaluate(squatPose(60), s(), g).bottom).toBe(false);
    const deep = a.evaluate(squatPose(35), s(), g);
    expect(deep.bottom).toBe(true);
    expect(deep.metrics['profundidad']).toBeGreaterThan(0);
  });

  it('can use the knee angle as depth criterion', () => {
    const a = squat.createAnalyzer();
    expect(a.evaluate(squatPose(95), s({ depthMode: 'kneeAngle' }), g).bottom).toBe(false);
    expect(a.evaluate(squatPose(85), s({ depthMode: 'kneeAngle' }), g).bottom).toBe(true);
  });

  it('flags too much torso lean', () => {
    expect(squat.createAnalyzer().evaluate(squatPose(100, 60), s(), g).faults).toContain('torsoLean');
  });

  it('flags raised heels only when the check is on', () => {
    const a = squat.createAnalyzer();
    a.startRep(squatPose(175));
    const up = squatPose(120);
    up[LM.heelL] = { ...up[LM.heelL], y: up[LM.heelL].y - 30 };
    expect(a.evaluate(up, s(), g).faults).not.toContain('heelsUp');
    expect(a.evaluate(up, s({ checkHeels: true }), g).faults).toContain('heelsUp');
  });

  it('gives the hip height and body length used for velocity', () => {
    const pose = squatPose(175);
    const ev = squat.createAnalyzer().evaluate(pose, s(), g);
    expect(ev.trackY).toBeCloseTo(pose[LM.hipL].y);
    expect(ev.bodyPx).toBeCloseTo(0.779 * 1.75 * 300, 0);
    expect(ev.joint).toEqual(pose[LM.kneeL]);
  });

  it('returns an empty evaluation when a key joint is not visible', () => {
    const pose = squatPose(175);
    pose[LM.kneeL].v = 0.1;
    expect(squat.createAnalyzer().evaluate(pose, s(), g).ok).toBe(false);
  });
});
