import { ExerciseId, RepResult, SetRecord } from '../models/types';

export interface SetTick {
  /** The person is analyzable and in exercise position this frame. */
  inPosition: boolean;
  /** A rep is in progress (counts as activity). */
  moving: boolean;
}

export interface SetEndRules {
  /** End the set after this many seconds out of position (left the bar, stood up, left frame). */
  offPositionSec: number;
  /** End the set after this many seconds with no rep activity (null = never). */
  inactivitySec: number | null;
}

/**
 * Groups reps into sets automatically. A set starts with the first rep and
 * ends when the person leaves the exercise position or stops for too long.
 */
export class SetTracker {
  current: SetRecord | null = null;
  lastSetEnd: number | null = null;

  private lastActivity = 0;
  private offSince: number | null = null;

  constructor(private exercise: ExerciseId) {}

  get active(): boolean {
    return this.current !== null;
  }

  addRep(rep: RepResult): void {
    if (!this.current) {
      this.current = {
        id: `${rep.start}-${Math.random().toString(36).slice(2, 7)}`,
        exercise: this.exercise,
        start: rep.start,
        end: rep.end,
        valid: 0,
        invalid: 0,
        reasons: {},
        restBeforeSec: this.lastSetEnd ? Math.round((rep.start - this.lastSetEnd) / 1000) : null,
        reps: [],
      };
      // The pause before the first rep of a set is rest, not part of the set.
      if (rep.tempo) rep.tempo = { ...rep.tempo, pauseBetweenSec: null };
    }
    const s = this.current;
    s.end = rep.end;
    (s.reps ??= []).push({ valid: rep.valid, reasons: rep.reasons, ...(rep.tempo ? { tempo: rep.tempo } : {}) });
    if (rep.valid) s.valid++;
    else {
      s.invalid++;
      for (const r of rep.reasons) s.reasons[r] = (s.reasons[r] ?? 0) + 1;
    }
    this.lastActivity = rep.end;
  }

  /** Returns the finished set when it just ended, otherwise null. */
  tick(t: SetTick, now: number, rules: SetEndRules): SetRecord | null {
    if (!this.current) return null;
    if (t.moving) this.lastActivity = now;

    if (t.inPosition) this.offSince = null;
    else this.offSince ??= now;

    const off = this.offSince !== null && now - this.offSince > rules.offPositionSec * 1000;
    const idle = rules.inactivitySec !== null && now - this.lastActivity > rules.inactivitySec * 1000;
    return off || idle ? this.finish() : null;
  }

  finish(): SetRecord | null {
    const s = this.current;
    if (!s) return null;
    this.current = null;
    this.offSince = null;
    this.lastSetEnd = s.end;
    return s;
  }
}
