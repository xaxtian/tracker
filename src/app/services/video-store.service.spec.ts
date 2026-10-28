import { TestBed } from '@angular/core/testing';
import { IDBFactory } from 'fake-indexeddb';
import { RecordingMeta, VideoStoreService, fileExtension, formatBytes, formatClock } from './video-store.service';

export const meta = (id: string, o: Partial<RecordingMeta> = {}): RecordingMeta => ({
  id, exercise: 'squat', start: 1000, end: 2000, durationSec: 60, mime: 'video/webm', size: 10, chunks: 0, sets: [], ...o,
});

/** Reads a Blob as text (jsdom's Blob has no .text()). */
export const blobText = (b: Blob) =>
  new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.readAsText(b);
  });

describe('VideoStoreService', () => {
  beforeEach(() => {
    // A fresh, empty database for every test.
    (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  });

  const create = async () => {
    const s = TestBed.inject(VideoStoreService);
    await s.refresh();
    return s;
  };

  it('starts with no recordings', async () => {
    expect((await create()).recordings()).toEqual([]);
  });

  it('lists recordings newest first', async () => {
    const s = await create();
    await s.putMeta(meta('old', { start: 1 }));
    await s.putMeta(meta('new', { start: 5 }));
    expect(s.recordings().map((r) => r.id)).toEqual(['new', 'old']);
  });

  it('replaces the metadata of an existing recording', async () => {
    const s = await create();
    await s.putMeta(meta('a'));
    await s.putMeta(meta('a', { durationSec: 99 }));
    expect(s.recordings()).toHaveLength(1);
    expect(s.recordings()[0].durationSec).toBe(99);
  });

  it('joins the chunks of a recording in order', async () => {
    const s = await create();
    const m = meta('a', { mime: 'video/mp4' });
    await s.putMeta(m);
    await s.putChunk('a', 1, new Blob(['world']));
    await s.putChunk('a', 0, new Blob(['hello ']));
    await s.putChunk('b', 0, new Blob(['other']));
    const blob = await s.getBlob(m);
    expect(blob.type).toBe('video/mp4');
    expect(await blobText(blob)).toBe('hello world');
  });

  it('deletes a recording with all its chunks', async () => {
    const s = await create();
    await s.putMeta(meta('a'));
    await s.putMeta(meta('b'));
    await s.putChunk('a', 0, new Blob(['x']));
    await s.putChunk('b', 0, new Blob(['y']));
    await s.remove('a');
    expect(s.recordings().map((r) => r.id)).toEqual(['b']);
    expect((await s.getBlob(meta('a'))).size).toBe(0);
    expect(await blobText(await s.getBlob(meta('b')))).toBe('y');
  });

  it('shows an empty list when the database cannot be opened', async () => {
    (globalThis as { indexedDB: unknown }).indexedDB = {
      open: () => {
        const r: Record<string, unknown> = { error: new Error('blocked') };
        setTimeout(() => (r['onerror'] as () => void)());
        return r;
      },
    };
    const s = TestBed.inject(VideoStoreService);
    await s.refresh();
    expect(s.recordings()).toEqual([]);
  });
});

describe('video helpers', () => {
  it('picks the file extension from the MIME type', () => {
    expect(fileExtension('video/mp4;codecs=avc1')).toBe('mp4');
    expect(fileExtension('video/webm;codecs=vp9')).toBe('webm');
  });

  it('formats sizes in KB, MB and GB', () => {
    expect(formatBytes(10)).toBe('1 KB');
    expect(formatBytes(300 * 1024)).toBe('300 KB');
    expect(formatBytes(18.75 * 1024 * 1024)).toBe('18.8 MB');
    expect(formatBytes(1.5 * 1024 ** 3)).toBe('1.50 GB');
  });

  it('formats durations as m:ss', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(65.4)).toBe('1:05');
    expect(formatClock(-3)).toBe('0:00');
    expect(formatClock(3600)).toBe('60:00');
  });
});
