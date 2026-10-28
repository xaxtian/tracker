import { LM } from '../analysis/geometry';
import { DEFAULT_SETTINGS } from '../services/settings.service';
import { landmarks } from '../../testing/landmarks';
import { dips } from './dips';

const g = DEFAULT_SETTINGS.general;
const s = dips.defaults;

/** Side view (left side). Hands fixed on the bars at y = 360, forearms vertical. */
const TOP = landmarks({ 11: [300, 200], 13: [300, 280], 15: [300, 360], 23: [310, 400], 25: [320, 520], 27: [330, 640] });
/** Shoulder dropped to elbow height, elbow behind, forearm still vertical. */
const BOTTOM = landmarks({ 11: [220, 285], 13: [300, 280], 15: [300, 360], 23: [240, 480], 25: [250, 600], 27: [260, 720] });

describe('dips module', () => {
  it('is a side-view push, eccentric going down', () => {
    expect(dips).toMatchObject({ id: 'dips', name: 'Fondos en paralelas', category: 'Empuje', camera: 'side', setEnd: 'inactivity' });
    const a = dips.createAnalyzer();
    expect(a.flexIsEccentric).toBe(true);
    expect(a.bodyRatio).toBeCloseTo(0.62);
    expect(dips.faults[a.noDepthFault].message).toBe('El hombro no bajó hasta el codo');
  });

  it('recognises the top of a dip', () => {
    const ev = dips.createAnalyzer().evaluate(TOP, s, g);
    expect(ev).toMatchObject({ ok: true, inPosition: true, extended: true, bottom: false, faults: [], trackY: 200, side: 'L' });
    expect(ev.angle).toBeCloseTo(180);
    expect(ev.metrics['profundidad']).toBeCloseTo(-100);
    expect(ev.bodyPx).toBeCloseTo(Math.hypot(10, 200) + 80 + 80);
  });

  it('reaches depth when the shoulder drops to the elbow', () => {
    const ev = dips.createAnalyzer().evaluate(BOTTOM, s, g);
    expect(ev.inPosition).toBe(true);
    expect(ev.bottom).toBe(true);
    expect(ev.extended).toBe(false);
    expect(ev.angle).toBeLessThan(95);
  });

  it('can demand more depth', () => {
    expect(dips.createAnalyzer().evaluate(BOTTOM, { ...s, depthOffset: 0.3 }, g).bottom).toBe(false);
  });

  it('does not take standing and bending the arms for a dip', () => {
    // Upper arm vertical, forearm tilted forward: a curl, not a dip.
    const standing = landmarks({ 11: [300, 200], 13: [300, 300], 15: [370, 330], 23: [305, 420] });
    expect(dips.createAnalyzer().evaluate(standing, s, g).inPosition).toBe(false);
  });

  it('flags kicking the legs during the rep', () => {
    const a = dips.createAnalyzer();
    a.evaluate(TOP, s, g);
    a.startRep(TOP);
    const kick = landmarks({ 11: [220, 285], 13: [300, 280], 15: [300, 360], 23: [240, 480], 25: [240, 600], 27: [340, 600] });
    expect(a.evaluate(kick, s, g).faults).toEqual(['kip']);
    expect(a.evaluate(BOTTOM, s, g).faults).toEqual([]);
  });

  it('works without the hips but cannot scale velocity', () => {
    const pose = landmarks({ 11: [300, 200], 13: [300, 280], 15: [300, 360] });
    const ev = dips.createAnalyzer().evaluate(pose, s, g);
    expect(ev.ok).toBe(true);
    expect(ev.bodyPx).toBeUndefined();
  });

  it('needs the arm', () => {
    const pose = landmarks({ 11: [300, 200], 13: [300, 280], 15: [300, 360] });
    pose[LM.wristL].v = 0;
    expect(dips.createAnalyzer().evaluate(pose, s, g).ok).toBe(false);
  });
});
