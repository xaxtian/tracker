import { DEFAULT_SETTINGS } from '../services/settings.service';
import { landmarks } from '../../testing/landmarks';
import { hspu } from './hspu';

const g = DEFAULT_SETTINGS.general;
const s = hspu.defaults;

/** Upside down, hands on the floor at y = 600, arms straight. Index 0 is the nose. */
const TOP = landmarks({ 0: [320, 490], 11: [300, 440], 13: [300, 520], 15: [300, 600], 23: [305, 240], 25: [305, 120], 27: [305, 20] });
/** Elbows bent, head almost on the floor. */
const BOTTOM = landmarks({ 0: [330, 575], 11: [310, 515], 13: [250, 560], 15: [300, 600], 23: [315, 315], 25: [318, 200], 27: [320, 95] });

describe('handstand push-up module', () => {
  it('is a side-view push that ends when coming down', () => {
    expect(hspu).toMatchObject({ id: 'hspu', name: 'Flexiones de pino', category: 'Empuje', setEnd: 'offPosition' });
    expect(hspu.createAnalyzer().flexIsEccentric).toBe(true);
  });

  it('recognises a handstand with straight arms', () => {
    const ev = hspu.createAnalyzer().evaluate(TOP, s, g);
    expect(ev).toMatchObject({ ok: true, inPosition: true, extended: true, bottom: false, faults: [] });
    expect(ev.metrics['cabeza']).toBeCloseTo(137.5);
  });

  it('reaches depth when the head is near the hands', () => {
    const ev = hspu.createAnalyzer().evaluate(BOTTOM, s, g);
    expect(ev.inPosition).toBe(true);
    expect(ev.bottom).toBe(true);
    expect(ev.extended).toBe(false);
    expect(hspu.createAnalyzer().evaluate(BOTTOM, { ...s, headMargin: 0.2 }, g).bottom).toBe(false);
  });

  it('flags an arched or bent body', () => {
    const arched = landmarks({ 0: [320, 490], 11: [300, 440], 13: [300, 520], 15: [300, 600], 23: [305, 240], 25: [370, 140], 27: [440, 40] });
    expect(hspu.createAnalyzer().evaluate(arched, s, g).faults).toContain('archedBack');
  });

  it('flags kicking during the rep', () => {
    const a = hspu.createAnalyzer();
    a.evaluate(TOP, s, g);
    a.startRep(TOP);
    const kick = landmarks({ 0: [330, 575], 11: [310, 515], 13: [250, 560], 15: [300, 600], 23: [315, 315], 25: [318, 200], 27: [420, 200] });
    expect(a.evaluate(kick, s, g).faults).toContain('kip');
  });

  it('is out of position standing up', () => {
    const standing = landmarks({ 0: [300, 150], 11: [300, 200], 13: [300, 280], 15: [300, 360], 23: [300, 400] });
    expect(hspu.createAnalyzer().evaluate(standing, s, g).inPosition).toBe(false);
  });

  it('needs the head to judge depth', () => {
    const noHead = landmarks({ 11: [300, 440], 13: [300, 520], 15: [300, 600], 23: [305, 240] });
    expect(hspu.createAnalyzer().evaluate(noHead, s, g).ok).toBe(false);
  });
});
