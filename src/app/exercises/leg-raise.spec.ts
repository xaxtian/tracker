import { DEFAULT_SETTINGS } from '../services/settings.service';
import { landmarks } from '../../testing/landmarks';
import { legRaise } from './leg-raise';

const g = DEFAULT_SETTINGS.general;
const s = legRaise.defaults;

/** Hanging from a bar (hands at y = 100), side view, legs straight down. */
const HANG = landmarks({ 15: [300, 100], 11: [300, 200], 23: [305, 420], 25: [305, 560], 27: [305, 700] });
/** Straight legs raised just above horizontal. */
const UP = landmarks({ 15: [300, 100], 11: [300, 200], 23: [305, 420], 25: [445, 410], 27: [585, 400] });

describe('leg raise module', () => {
  it('is a core exercise on the bar, concentric when raising', () => {
    expect(legRaise).toMatchObject({ id: 'legRaise', category: 'Core', setEnd: 'offPosition' });
    const a = legRaise.createAnalyzer();
    expect(a.flexIsEccentric).toBe(false);
    expect(a.bodyRatio).toBeCloseTo(0.491);
  });

  it('measures the hip angle while hanging', () => {
    const ev = legRaise.createAnalyzer().evaluate(HANG, s, g);
    expect(ev).toMatchObject({ ok: true, inPosition: true, extended: true, bottom: false, faults: [], trackY: 700 });
    expect(ev.bodyPx).toBeCloseTo(280);
  });

  it('reaches the top with the legs at hip height, or higher for toes to bar', () => {
    const ev = legRaise.createAnalyzer().evaluate(UP, s, g);
    expect(ev.angle).toBeLessThan(90);
    expect(ev.bottom).toBe(true);
    expect(legRaise.createAnalyzer().evaluate(UP, { ...s, topHipAngle: 45 }, g).bottom).toBe(false);
  });

  it('flags bent knees only when straight legs are required', () => {
    const tucked = landmarks({ 15: [300, 100], 11: [300, 200], 23: [305, 420], 25: [445, 410], 27: [445, 550] });
    expect(legRaise.createAnalyzer().evaluate(tucked, s, g).faults).toEqual(['kneesBent']);
    expect(legRaise.createAnalyzer().evaluate(tucked, { ...s, straightLegs: false }, g).faults).toEqual([]);
  });

  it('flags swinging during the rep', () => {
    const a = legRaise.createAnalyzer();
    a.startRep(HANG);
    const swung = landmarks({ 15: [300, 100], 11: [300, 200], 23: [400, 410], 25: [540, 400], 27: [680, 390] });
    expect(a.evaluate(swung, s, g).faults).toEqual(['swing']);
  });

  it('is out of position off the bar', () => {
    const standing = landmarks({ 15: [300, 400], 11: [300, 200], 23: [305, 420], 25: [305, 560], 27: [305, 700] });
    expect(legRaise.createAnalyzer().evaluate(standing, s, g).inPosition).toBe(false);
  });
});
