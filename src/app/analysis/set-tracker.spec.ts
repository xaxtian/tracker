import { RepResult, RepTempo } from '../models/types';
import { SetEndRules, SetTracker } from './set-tracker';

const T0 = 1_700_000_000_000;
const tempo: RepTempo = {
  eccentricSec: 2, concentricSec: 1, pauseTurnSec: 0.3, pauseBetweenSec: 8,
  meanConVel: 0.5, peakConVel: 0.9, meanEccVel: 0.25, fps: 30,
};
const rep = (atSec: number, valid = true, reasons: string[] = []): RepResult => ({
  valid, reasons, start: T0 + atSec * 1000, end: T0 + (atSec + 3) * 1000, tempo: { ...tempo },
});
const RULES: SetEndRules = { offPositionSec: 2, inactivitySec: 10 };
const at = (sec: number) => T0 + sec * 1000;
const inPos = { inPosition: true, moving: false };

describe('SetTracker', () => {
  it('starts a set with the first rep', () => {
    const t = new SetTracker('squat');
    expect(t.active).toBe(false);
    t.addRep(rep(0));
    expect(t.active).toBe(true);
    expect(t.current).toMatchObject({ exercise: 'squat', start: at(0), end: at(3), valid: 1, invalid: 0, restBeforeSec: null });
  });

  it('accumulates valid and invalid reps with their reasons', () => {
    const t = new SetTracker('pushup');
    t.addRep(rep(0));
    t.addRep(rep(4, false, ['hipSag']));
    t.addRep(rep(8, false, ['hipSag', 'noLockout']));
    t.addRep(rep(12));
    const s = t.current!;
    expect(s.valid).toBe(2);
    expect(s.invalid).toBe(2);
    expect(s.reasons).toEqual({ hipSag: 2, noLockout: 1 });
    expect(s.reps).toHaveLength(4);
    expect(s.end).toBe(at(15));
  });

  it('does not count the rest before the first rep as a pause inside the set', () => {
    const t = new SetTracker('squat');
    t.addRep(rep(0));
    t.addRep(rep(4));
    expect(t.current!.reps![0].tempo!.pauseBetweenSec).toBeNull();
    expect(t.current!.reps![1].tempo!.pauseBetweenSec).toBe(8);
  });

  it('ends the set after being out of position for too long', () => {
    const t = new SetTracker('pullup');
    t.addRep(rep(0));
    expect(t.tick({ inPosition: false, moving: false }, at(4), RULES)).toBeNull();
    expect(t.tick({ inPosition: false, moving: false }, at(5.5), RULES)).toBeNull();
    const done = t.tick({ inPosition: false, moving: false }, at(6.1), RULES);
    expect(done?.valid).toBe(1);
    expect(t.active).toBe(false);
  });

  it('forgives a short moment out of position', () => {
    const t = new SetTracker('pullup');
    t.addRep(rep(0));
    t.tick({ inPosition: false, moving: false }, at(4), RULES);
    t.tick(inPos, at(5), RULES);
    expect(t.tick({ inPosition: false, moving: false }, at(6.5), RULES)).toBeNull();
  });

  it('ends the set after inactivity, but not while a rep is in progress', () => {
    const t = new SetTracker('squat');
    t.addRep(rep(0)); // last activity at 3 s
    expect(t.tick({ inPosition: true, moving: true }, at(12), RULES)).toBeNull();
    expect(t.tick(inPos, at(21), RULES)).toBeNull();
    expect(t.tick(inPos, at(22.1), RULES)).not.toBeNull();
  });

  it('never ends by inactivity when the rule is off (pull-ups)', () => {
    const t = new SetTracker('pullup');
    t.addRep(rep(0));
    expect(t.tick(inPos, at(600), { offPositionSec: 2, inactivitySec: null })).toBeNull();
  });

  it('measures the rest before the next set', () => {
    const t = new SetTracker('squat');
    t.addRep(rep(0));
    t.finish();
    expect(t.lastSetEnd).toBe(at(3));
    t.addRep(rep(93));
    expect(t.current!.restBeforeSec).toBe(90);
  });

  it('finish() returns null without a set and tick() does nothing', () => {
    const t = new SetTracker('squat');
    expect(t.finish()).toBeNull();
    expect(t.tick(inPos, at(100), RULES)).toBeNull();
  });

  it('gives every set a different id', () => {
    const t = new SetTracker('squat');
    t.addRep(rep(0));
    const a = t.finish()!;
    t.addRep(rep(0));
    expect(t.finish()!.id).not.toBe(a.id);
  });
});
