import { Injectable, signal } from '@angular/core';
import { ExerciseId } from '../models/types';

/** A set inside a recording, used as a chapter to jump to. */
export interface RecordingMark {
  setId: string;
  index: number;
  startSec: number;
  endSec: number;
  valid: number;
  invalid: number;
}

export interface RecordingMeta {
  id: string;
  exercise: ExerciseId;
  start: number;
  end: number;
  durationSec: number;
  mime: string;
  size: number;
  chunks: number;
  sets: RecordingMark[];
}

const DB_NAME = 'trackbody-videos';

/**
 * Stores recordings in IndexedDB. Video data is written in small chunks while
 * recording, so a long session never has to fit in memory and survives a crash.
 */
@Injectable({ providedIn: 'root' })
export class VideoStoreService {
  readonly recordings = signal<RecordingMeta[]>([]);
  private db: Promise<IDBDatabase> | null = null;

  constructor() {
    void this.refresh();
    // Ask the browser not to evict our videos when space runs low.
    void navigator.storage?.persist?.().catch(() => undefined);
  }

  async refresh(): Promise<void> {
    try {
      const all = await this.req<RecordingMeta[]>('meta', 'readonly', (s) => s.getAll());
      this.recordings.set(all.sort((a, b) => b.start - a.start));
    } catch {
      this.recordings.set([]);
    }
  }

  async putMeta(meta: RecordingMeta): Promise<void> {
    await this.req('meta', 'readwrite', (s) => s.put(meta));
    await this.refresh();
  }

  async putChunk(id: string, i: number, data: Blob): Promise<void> {
    await this.req('chunks', 'readwrite', (s) => s.put({ id, i, data }));
  }

  async getBlob(meta: RecordingMeta): Promise<Blob> {
    const rows = await this.req<{ i: number; data: Blob }[]>('chunks', 'readonly', (s) =>
      s.getAll(IDBKeyRange.bound([meta.id, 0], [meta.id, Number.MAX_SAFE_INTEGER])),
    );
    return new Blob(
      rows.sort((a, b) => a.i - b.i).map((r) => r.data),
      { type: meta.mime },
    );
  }

  async remove(id: string): Promise<void> {
    await this.req('chunks', 'readwrite', (s) =>
      s.delete(IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER])),
    );
    await this.req('meta', 'readwrite', (s) => s.delete(id));
    await this.refresh();
  }

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise((resolve, reject) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore('meta', { keyPath: 'id' });
        r.result.createObjectStore('chunks', { keyPath: ['id', 'i'] });
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    return this.db;
  }

  private async req<T>(
    store: 'meta' | 'chunks',
    mode: IDBTransactionMode,
    fn: (s: IDBObjectStore) => IDBRequest,
  ): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const r = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(r.result as T);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
}

export function fileExtension(mime: string): string {
  return mime.includes('mp4') ? 'mp4' : 'webm';
}

export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatClock(sec: number): string {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60);
  return `${m}:${String(sec % 60).padStart(2, '0')}`;
}
