import { DEFAULT_SETTINGS } from '../services/settings.service';
import { landmarks } from '../../testing/landmarks';
import { row } from './row';

const g = DEFAULT_SETTINGS.general;
const s = row.defaults;

/** Hanging under a bar at y = 200, arms straight, body straight with the feet on the floor. */
const HANG = landmarks({ 11: [300, 360], 13: [300, 280], 15: [300, 200], 23: [500, 400], 25: [650, 430], 27: [800, 460] });
/** Chest at the bar. */
const TOP = landmarks({ 11: [310, 235], 13: [250, 280], 15: [300, 200], 23: [510, 280], 25: [655, 320], 27: [800, 360] });

describe('inverted row module', () => {
  it('is a side-view pull, concentric going up', () => {
    expect(row).toMatchObject({ id: 'row', name: 'Remo invertido', category: 'Tracción', setEnd: 'offPosition' });
    const a = row.createAnalyzer();
    expect(a.flexIsEccentric).toBe(false);
    expect(a.bodyRatio).toBeCloseTo(0.779);
  });

  it('recognises the hang with straight arms', () => {
    const ev = row.createAnalyzer().evaluate(HANG, s, g);
    expect(ev).toMatchObject({ ok: true, inPosition: true, extended: true, bottom: false, faults: [], trackY: 360 });
    expect(ev.metrics['pecho']).toBeCloseTo(200);
    expect(ev.bodyPx).toBeGreaterThan(0);
  });

  it('reaches the top with the chest at the bar', () => {
    const ev = row.createAnalyzer().evaluate(TOP, s, g);
    expect(ev.inPosition).toBe(true);
    expect(ev.bottom).toBe(true);
    expect(ev.extended).toBe(false);
    expect(row.createAnalyzer().evaluate(TOP, { ...s, chestMargin: 0.3 }, g).bottom).toBe(false);
  });

  it('flags a sagging hip', () => {
    const sag = landmarks({ 11: [300, 360], 13: [300, 280], 15: [300, 200], 23: [500, 470], 25: [650, 465], 27: [800, 460] });
    expect(row.createAnalyzer().evaluate(sag, s, g).faults).toEqual(['hipSag']);
  });

  it('is out of position standing up (hands below the shoulders)', () => {
    const standing = landmarks({ 11: [300, 200], 13: [300, 280], 15: [300, 360], 23: [300, 400], 27: [300, 700] });
    expect(row.createAnalyzer().evaluate(standing, s, g).inPosition).toBe(false);
  });
});
