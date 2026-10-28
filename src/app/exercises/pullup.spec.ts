import { LM } from '../analysis/geometry';
import { DEFAULT_SETTINGS } from '../services/settings.service';
import { pullupPose } from '../../testing/landmarks';
import { pullup } from './pullup';

const g = DEFAULT_SETTINGS.general;
const s = pullup.defaults;

describe('pull-up module', () => {
  it('describes a front-view pull that ends when leaving the bar', () => {
    expect(pullup).toMatchObject({ id: 'pullup', category: 'Tracción', camera: 'front', setEnd: 'offPosition' });
    const a = pullup.createAnalyzer();
    expect(a.flexIsEccentric).toBe(false);
    expect(a.bodyRatio).toBeCloseTo(0.62);
  });

  it('recognises a dead hang', () => {
    const ev = pullup.createAnalyzer().evaluate(pullupPose('hang'), s, g);
    expect(ev).toMatchObject({ ok: true, inPosition: true, extended: true, bottom: false, trackY: 300 });
    expect(ev.metrics['barbilla']).toBeCloseTo(-75);
    expect(ev.bodyPx).toBeCloseTo(200 + Math.hypot(15, 100) + Math.hypot(5, 100), 3);
  });

  it('counts the top when the mouth passes the hands', () => {
    const ev = pullup.createAnalyzer().evaluate(pullupPose('top'), s, g);
    expect(ev.bottom).toBe(true);
    expect(ev.extended).toBe(false);
    expect(ev.metrics['barbilla']).toBeCloseTo(10);
  });

  it('respects a stricter chin margin', () => {
    expect(pullup.createAnalyzer().evaluate(pullupPose('top'), { ...s, chinMargin: 0.2 }, g).bottom).toBe(false);
  });

  it('flags swinging relative to the start of the rep', () => {
    const a = pullup.createAnalyzer();
    a.startRep(pullupPose('hang'));
    expect(a.evaluate(pullupPose('hang', { hipDx: 20 }), s, g).faults).toEqual([]);
    expect(a.evaluate(pullupPose('hang', { hipDx: 80 }), s, g).faults).toContain('swing');
  });

  it('flags kipping when the knees bend during the rep', () => {
    const a = pullup.createAnalyzer();
    a.evaluate(pullupPose('hang'), s, g);
    a.startRep(pullupPose('hang'));
    expect(a.evaluate(pullupPose('top', { kneeBend: 100 }), s, g).faults).toContain('kip');
  });

  it('is out of position when the hands are below the shoulders', () => {
    const pose = pullupPose('hang');
    pose[LM.wristL].y = 450;
    pose[LM.wristR].y = 450;
    expect(pullup.createAnalyzer().evaluate(pose, s, g).inPosition).toBe(false);
  });

  it('works with hidden hips but cannot measure swing or velocity scale', () => {
    const pose = pullupPose('hang', { hipDx: 200 });
    pose[LM.hipL].v = 0;
    pose[LM.hipR].v = 0;
    const ev = pullup.createAnalyzer().evaluate(pose, s, g);
    expect(ev.ok).toBe(true);
    expect(ev.faults).not.toContain('swing');
    expect(ev.bodyPx).toBeUndefined();
  });

  it('needs at least one arm and the mouth', () => {
    const noMouth = pullupPose('hang');
    noMouth[9].v = 0;
    expect(pullup.createAnalyzer().evaluate(noMouth, s, g).ok).toBe(false);
    const oneArm = pullupPose('hang');
    oneArm[LM.wristR].v = 0;
    expect(pullup.createAnalyzer().evaluate(oneArm, s, g).ok).toBe(true);
  });
});
