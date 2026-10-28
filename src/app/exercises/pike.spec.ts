import { DEFAULT_SETTINGS } from '../services/settings.service';
import { landmarks, pushupPose } from '../../testing/landmarks';
import { pike } from './pike';

const g = DEFAULT_SETTINGS.general;
const s = pike.defaults;

/** Inverted V: hands (y 600) and feet (y 600) on the floor, hips high. Index 0 is the nose. */
const pose = (o: { hip?: [number, number]; knee?: [number, number] } = {}) =>
  landmarks({
    0: [185, 480], 11: [210, 440], 13: [205, 520], 15: [200, 600],
    23: o.hip ?? [350, 330], 25: o.knee ?? [420, 465], 27: [490, 600],
  });
/** Elbows bent, head down between the hands. */
const BOTTOM = landmarks({ 0: [175, 570], 11: [195, 505], 13: [255, 555], 15: [200, 600], 23: [350, 330], 25: [420, 465], 27: [490, 600] });

describe('pike push-up module', () => {
  it('is a side-view push ended after a long rest', () => {
    expect(pike).toMatchObject({ id: 'pike', name: 'Flexiones pike', category: 'Empuje', setEnd: 'longInactivity' });
  });

  it('recognises the pike position with straight arms', () => {
    const ev = pike.createAnalyzer().evaluate(pose(), s, g);
    expect(ev).toMatchObject({ ok: true, inPosition: true, extended: true, bottom: false, faults: [] });
    expect(ev.metrics['cadera']).toBeCloseTo(79, 0);
  });

  it('reaches depth with the head between the hands', () => {
    const ev = pike.createAnalyzer().evaluate(BOTTOM, s, g);
    expect(ev.inPosition).toBe(true);
    expect(ev.bottom).toBe(true);
  });

  it('flags hips that dropped out of the pike', () => {
    const ev = pike.createAnalyzer().evaluate(pose({ hip: [350, 430], knee: [420, 515] }), s, g);
    expect(ev.inPosition).toBe(true);
    expect(ev.faults).toEqual(['pikeFlat']);
  });

  it('flags bent knees', () => {
    expect(pike.createAnalyzer().evaluate(pose({ knee: [460, 440] }), s, g).faults).toEqual(['kneesBent']);
  });

  it('does not take a regular plank for a pike', () => {
    const plank = pushupPose();
    plank[0] = { x: 80, y: 310, v: 0.99 };
    expect(pike.createAnalyzer().evaluate(plank, s, g).inPosition).toBe(false);
  });
});
