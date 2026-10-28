import { Pt } from '../models/types';
import { CONNECTIONS, LM, SidePicker, angle, belowLine, dist, fromHorizontal, leanFromVertical, mid, visible } from './geometry';

const p = (x: number, y: number, v = 1): Pt => ({ x, y, v });

describe('geometry', () => {
  describe('angle', () => {
    it('measures a right angle', () => {
      expect(angle(p(0, 1), p(0, 0), p(1, 0))).toBeCloseTo(90);
    });
    it('measures a straight line as 180°', () => {
      expect(angle(p(-1, 0), p(0, 0), p(1, 0))).toBeCloseTo(180);
    });
    it('measures a closed joint as 0°', () => {
      expect(angle(p(1, 0), p(0, 0), p(2, 0))).toBeCloseTo(0);
    });
    it('returns 180 when two points coincide (no direction)', () => {
      expect(angle(p(0, 0), p(0, 0), p(1, 0))).toBe(180);
    });
    it('measures 45°', () => {
      expect(angle(p(1, 0), p(0, 0), p(1, 1))).toBeCloseTo(45);
    });
  });

  it('leanFromVertical is 0 when upright, 45 on the diagonal and 90 when flat', () => {
    expect(leanFromVertical(p(0, 10), p(0, 0))).toBeCloseTo(0);
    expect(leanFromVertical(p(0, 10), p(10, 0))).toBeCloseTo(45);
    expect(leanFromVertical(p(0, 0), p(10, 0))).toBeCloseTo(90);
  });

  it('fromHorizontal is 0 when flat and 90 when vertical', () => {
    expect(fromHorizontal(p(0, 0), p(10, 0))).toBeCloseTo(0);
    expect(fromHorizontal(p(0, 0), p(0, 10))).toBeCloseTo(90);
    expect(fromHorizontal(p(10, 10), p(0, 0))).toBeCloseTo(45);
  });

  it('dist is the euclidean distance', () => {
    expect(dist(p(0, 0), p(3, 4))).toBe(5);
  });

  it('mid averages position and keeps the lowest visibility', () => {
    expect(mid(p(0, 0, 0.9), p(10, 20, 0.4))).toEqual({ x: 5, y: 10, v: 0.4 });
  });

  it('visible requires every point to reach the threshold', () => {
    expect(visible(0.5, p(0, 0, 0.6), p(0, 0, 0.5))).toBe(true);
    expect(visible(0.5, p(0, 0, 0.6), p(0, 0, 0.4))).toBe(false);
    expect(visible(0.5)).toBe(true);
  });

  describe('belowLine', () => {
    it('is positive below the line and negative above (image y grows down)', () => {
      expect(belowLine(p(5, 10), p(0, 0), p(10, 0))).toBe(10);
      expect(belowLine(p(5, -3), p(0, 0), p(10, 0))).toBe(-3);
    });
    it('follows a sloped line', () => {
      expect(belowLine(p(5, 5), p(0, 0), p(10, 10))).toBeCloseTo(0);
    });
    it('returns 0 for a vertical line', () => {
      expect(belowLine(p(5, 5), p(0, 0), p(0, 10))).toBe(0);
    });
  });

  describe('SidePicker', () => {
    const lm = (l: number, r: number) => {
      const pts: Pt[] = Array.from({ length: 33 }, () => p(0, 0, 0));
      pts[LM.hipL] = p(0, 0, l);
      pts[LM.hipR] = p(0, 0, r);
      return pts;
    };

    it('starts on the left side', () => {
      expect(new SidePicker().pick(lm(0.5, 0.5), [LM.hipL], [LM.hipR])).toBe('L');
    });

    it('switches only when the other side is clearly more visible (hysteresis)', () => {
      const s = new SidePicker();
      expect(s.pick(lm(0.5, 0.6), [LM.hipL], [LM.hipR])).toBe('L');
      expect(s.pick(lm(0.5, 0.7), [LM.hipL], [LM.hipR])).toBe('R');
      expect(s.pick(lm(0.6, 0.5), [LM.hipL], [LM.hipR])).toBe('R');
      expect(s.pick(lm(0.9, 0.5), [LM.hipL], [LM.hipR])).toBe('L');
    });

    it('treats missing landmarks as invisible', () => {
      expect(new SidePicker().pick([], [LM.hipL], [LM.hipR])).toBe('L');
    });
  });

  it('every skeleton connection joins two body landmarks (11-32)', () => {
    for (const [a, b] of CONNECTIONS) {
      expect(Math.min(a, b)).toBeGreaterThanOrEqual(11);
      expect(Math.max(a, b)).toBeLessThanOrEqual(32);
    }
  });
});
