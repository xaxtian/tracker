import { DEFAULT_SETTINGS } from '../services/settings.service';
import { landmarks } from '../../testing/landmarks';
import { curl, curlSingle } from './curl';

const g = DEFAULT_SETTINGS.general;
const s = curl.defaults;

/** Standing, side view (left side), arm hanging straight. */
const DOWN = landmarks({ 11: [300, 200], 13: [300, 320], 15: [300, 430], 23: [305, 420] });
/** Curled to 45°, upper arm still vertical. */
const UP = landmarks({ 11: [300, 200], 13: [300, 320], 15: [378, 242], 23: [305, 420] });

describe('curl modules', () => {
  it('are arm exercises, concentric when curling up', () => {
    expect(curl).toMatchObject({ id: 'curl', category: 'Brazos', setEnd: 'inactivity' });
    expect(curl.unilateral).toBeUndefined();
    const a = curl.createAnalyzer();
    expect(a.flexIsEccentric).toBe(false);
    expect(a.bodyRatio).toBeCloseTo(0.332);
  });

  it('the unilateral curl shares the analysis and records the arm', () => {
    expect(curlSingle).toMatchObject({ id: 'curlSingle', name: 'Curl de bíceps unilateral', unilateral: { limb: 'brazo' } });
    expect(curlSingle.defaults).toEqual(curl.defaults);
    expect(curlSingle.faults).toBe(curl.faults);
  });

  it('recognises the straight arm', () => {
    const ev = curl.createAnalyzer().evaluate(DOWN, s, g);
    expect(ev).toMatchObject({ ok: true, inPosition: true, extended: true, bottom: false, faults: [], trackY: 430, side: 'L' });
    expect(ev.bodyPx).toBeCloseTo(230);
  });

  it('reaches the top of the curl', () => {
    const ev = curl.createAnalyzer().evaluate(UP, s, g);
    expect(ev.angle).toBeCloseTo(45, 0);
    expect(ev.bottom).toBe(true);
    expect(ev.faults).toEqual([]);
  });

  it('flags the elbow moving forward', () => {
    const drift = landmarks({ 11: [300, 200], 13: [370, 300], 15: [420, 220], 23: [305, 420] });
    expect(curl.createAnalyzer().evaluate(drift, s, g).faults).toEqual(['elbowDrift']);
  });

  it('flags swinging the torso during the rep', () => {
    const a = curl.createAnalyzer();
    a.evaluate(DOWN, s, g);
    a.startRep(DOWN);
    const leanBack = landmarks({ 11: [350, 205], 13: [350, 325], 15: [428, 247], 23: [305, 420] });
    expect(a.evaluate(leanBack, s, g).faults).toEqual(['torsoSwing']);
  });

  it('analyses the arm closest to the camera', () => {
    const right = landmarks({ 12: [300, 200], 14: [300, 320], 16: [300, 430], 24: [305, 420] });
    expect(curlSingle.createAnalyzer().evaluate(right, s, g).side).toBe('R');
  });

  it('is out of position with the arm raised above the shoulder', () => {
    const raised = landmarks({ 11: [300, 200], 13: [300, 100], 15: [300, 0], 23: [305, 420] });
    expect(curl.createAnalyzer().evaluate(raised, s, g).inPosition).toBe(false);
  });

  it('works without the hip, skipping the torso check', () => {
    const noHip = landmarks({ 11: [300, 200], 13: [300, 320], 15: [300, 430] });
    const ev = curl.createAnalyzer().evaluate(noHip, s, g);
    expect(ev.ok).toBe(true);
    expect(ev.metrics['tronco']).toBeUndefined();
  });
});
