import { RepRecord, RepTempo } from '../models/types';
import { fmt2, fmtLoad, tempoAverages, tempoText, velocityLoss } from './set-stats';

const tempo = (o: Partial<RepTempo> = {}): RepTempo => ({
  eccentricSec: 2, concentricSec: 1, pauseTurnSec: 0.5, pauseBetweenSec: 1,
  meanConVel: 0.6, peakConVel: 1.1, meanEccVel: 0.3, fps: 30, ...o,
});
const rep = (valid: boolean, t?: Partial<RepTempo> | null): RepRecord => ({
  valid, reasons: valid ? [] : ['noDepth'], ...(t === null ? {} : { tempo: tempo(t ?? {}) }),
});

describe('set-stats', () => {
  describe('fmt2', () => {
    it('uses two decimals and a decimal comma', () => {
      expect(fmt2(1.844)).toBe('1,84');
      expect(fmt2(0)).toBe('0,00');
      expect(fmt2(2)).toBe('2,00');
    });
    it('shows a dash for missing values', () => {
      expect(fmt2(null)).toBe('—');
      expect(fmt2(undefined)).toBe('—');
    });
  });

  describe('fmtLoad', () => {
    it('formats added load with a plus sign', () => {
      expect(fmtLoad(20)).toBe('+20 kg');
      expect(fmtLoad(2.5)).toBe('+2,5 kg');
      expect(fmtLoad(1.25)).toBe('+1,25 kg');
    });
    it('formats assistance with a minus sign', () => {
      expect(fmtLoad(-10)).toBe('−10 kg');
    });
    it('is empty for bodyweight', () => {
      expect(fmtLoad(0)).toBe('');
      expect(fmtLoad(undefined)).toBe('');
      expect(fmtLoad(null)).toBe('');
    });
  });

  describe('tempoText', () => {
    it('summarises phases and velocity', () => {
      expect(tempoText(tempo({ eccentricSec: 1.84, concentricSec: 0.92, meanConVel: 0.62 }))).toBe('↓1,84 ↑0,92 s · 0,62 m/s');
    });
    it('omits the velocity when it is unknown', () => {
      expect(tempoText(tempo({ meanConVel: null }))).toBe('↓2,00 ↑1,00 s');
    });
    it('is empty without tempo', () => {
      expect(tempoText(undefined)).toBe('');
    });
  });

  describe('velocityLoss', () => {
    it('compares the last valid rep with the fastest one', () => {
      const reps = [rep(true, { meanConVel: 0.8 }), rep(true, { meanConVel: 1.0 }), rep(true, { meanConVel: 0.7 })];
      expect(velocityLoss(reps)).toBeCloseTo(30);
    });
    it('ignores invalid reps and reps without velocity', () => {
      const reps = [rep(true, { meanConVel: 1.0 }), rep(true, { meanConVel: 0.9 }), rep(false, { meanConVel: 0.2 }), rep(true, null)];
      expect(velocityLoss(reps)).toBeCloseTo(10);
    });
    it('is never negative', () => {
      expect(velocityLoss([rep(true, { meanConVel: 0.5 }), rep(true, { meanConVel: 0.9 })])).toBe(0);
    });
    it('needs at least two measured reps', () => {
      expect(velocityLoss([rep(true)])).toBeNull();
      expect(velocityLoss(undefined)).toBeNull();
    });
  });

  describe('tempoAverages', () => {
    it('averages valid reps only', () => {
      const a = tempoAverages([
        rep(true, { eccentricSec: 2, concentricSec: 1, meanConVel: 0.6 }),
        rep(true, { eccentricSec: 3, concentricSec: 2, meanConVel: 0.8 }),
        rep(false, { eccentricSec: 10, concentricSec: 10, meanConVel: 5 }),
      ]);
      expect(a.eccentricSec).toBeCloseTo(2.5);
      expect(a.concentricSec).toBeCloseTo(1.5);
      expect(a.meanConVel).toBeCloseTo(0.7);
      expect(a.bestConVel).toBeCloseTo(0.8);
    });
    it('skips missing velocities', () => {
      expect(tempoAverages([rep(true, { meanConVel: null }), rep(true, { meanConVel: 0.5 })]).meanConVel).toBe(0.5);
    });
    it('returns nulls without data', () => {
      expect(tempoAverages(undefined)).toEqual({ eccentricSec: null, concentricSec: null, meanConVel: null, bestConVel: null });
    });
  });
});
