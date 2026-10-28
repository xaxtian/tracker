import { Injectable, signal } from '@angular/core';
import { SetRecord } from '../models/types';

/** localStorage key of the history. */
const KEY = 'trackbody.history';

/** History of finished sets, kept in a signal and saved to localStorage. */
@Injectable({ providedIn: 'root' })
export class HistoryService {
  /** Every saved set, oldest first. */
  readonly sets = signal<SetRecord[]>(this.load());

  /** Appends a finished set. */
  add(set: SetRecord): void {
    this.sets.update((all) => [...all, set]);
    this.save();
  }

  /** Changes fields of a saved set (e.g. its load). */
  update(id: string, patch: Partial<SetRecord>): void {
    this.sets.update((all) => all.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    this.save();
  }

  /** Deletes one set. */
  remove(id: string): void {
    this.sets.update((all) => all.filter((s) => s.id !== id));
    this.save();
  }

  /** Deletes the whole history. */
  clear(): void {
    this.sets.set([]);
    this.save();
  }

  /** The whole history as indented JSON. */
  exportJson(): string {
    return JSON.stringify(this.sets(), null, 2);
  }

  private load(): SetRecord[] {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? '[]');
    } catch {
      return [];
    }
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.sets()));
    } catch {
      /* storage unavailable */
    }
  }
}
