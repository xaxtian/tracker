import { Injectable, signal } from '@angular/core';
import { SetRecord } from '../models/types';

const KEY = 'trackbody.history';

@Injectable({ providedIn: 'root' })
export class HistoryService {
  readonly sets = signal<SetRecord[]>(this.load());

  add(set: SetRecord): void {
    this.sets.update((all) => [...all, set]);
    this.save();
  }

  update(id: string, patch: Partial<SetRecord>): void {
    this.sets.update((all) => all.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    this.save();
  }

  remove(id: string): void {
    this.sets.update((all) => all.filter((s) => s.id !== id));
    this.save();
  }

  clear(): void {
    this.sets.set([]);
    this.save();
  }

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
