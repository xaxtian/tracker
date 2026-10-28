import { LM } from '../analysis/geometry';
import { DEFAULT_SETTINGS } from '../services/settings.service';
import { landmarks, pushupPose } from '../../testing/landmarks';
import { pushup } from './pushup';

const g = DEFAULT_SETTINGS.general;
const s = pushup.defaults;

describe('push-up module', () => {
  it('describes a side-view push ended after a long rest', () => {
    expect(pushup).toMatchObject({ id: 'pushup', category: 'Empuje', camera: 'side', setEnd: 'longInactivity' });
    expect(pushup.createAnalyzer().flexIsEccentric).toBe(true);
  });

  it('recognises a straight-arm plank', () => {
    const ev = pushup.createAnalyzer().evaluate(pushupPose(), s, g);
    expect(ev).toMatchObject({ ok: true, inPosition: true, extended: true, bottom: false, faults: [], trackY: 300 });
    expect(ev.angle).toBeCloseTo(180);
    expect(ev.bodyPx).toBeCloseTo(500);
  });

  it('detects the bottom with bent elbows', () => {
    const ev = pushup.createAnalyzer().evaluate(pushupPose({ elbow: 'bent' }), s, g);
    expect(ev.angle).toBeCloseTo(53.13, 1);
    expect(ev.bottom).toBe(true);
    expect(ev.extended).toBe(false);
  });

  it('tells a sagging hip from a piked hip', () => {
    const a = pushup.createAnalyzer();
    expect(a.evaluate(pushupPose({ hipDy: 60 }), s, g).faults).toEqual(['hipSag']);
    expect(a.evaluate(pushupPose({ hipDy: -60 }), s, g).faults).toEqual(['hipPike']);
  });

  it('flags bent knees while still in plank', () => {
    const ev = pushup.createAnalyzer().evaluate(pushupPose({ kneeDy: -50 }), s, g);
    expect(ev.inPosition).toBe(true);
    expect(ev.faults).toEqual(['kneesBent']);
  });

  it('is out of position when standing up', () => {
    const standing = landmarks({ 11: [100, 100], 13: [100, 180], 15: [100, 260], 23: [100, 300], 25: [100, 450], 27: [100, 600] });
    expect(pushup.createAnalyzer().evaluate(standing, s, g).inPosition).toBe(false);
  });

  it('works without the ankle (knee push-up view) but cannot scale velocity', () => {
    const pose = pushupPose();
    pose[LM.ankleL].v = 0.1;
    const ev = pushup.createAnalyzer().evaluate(pose, s, g);
    expect(ev.ok).toBe(true);
    expect(ev.metrics['rodilla']).toBe(180);
    expect(ev.bodyPx).toBeUndefined();
  });

  it('uses the right side when it is the visible one', () => {
    const right = landmarks({ 12: [100, 300], 14: [100, 350], 16: [100, 400], 24: [300, 300], 26: [450, 300], 28: [600, 300] });
    const ev = pushup.createAnalyzer().evaluate(right, s, g);
    expect(ev).toMatchObject({ ok: true, extended: true, side: 'R' });
  });

  it('returns an empty evaluation when the arm is not visible', () => {
    const pose = pushupPose();
    pose[LM.wristL].v = 0;
    expect(pushup.createAnalyzer().evaluate(pose, s, g).ok).toBe(false);
  });
});
