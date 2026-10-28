import { signal } from '@angular/core';
import { RecordingMeta } from '../app/services/video-store.service';
import { SetRecord } from '../app/models/types';

/** In-memory stand-in for VideoStoreService. */
export function fakeVideoStore(initial: RecordingMeta[] = []) {
  const recordings = signal<RecordingMeta[]>(initial);
  return {
    recordings,
    refresh: jest.fn(async () => undefined),
    getBlob: jest.fn(async (_m: RecordingMeta) => new Blob(['video-bytes'], { type: 'video/webm' })),
    remove: jest.fn(async (id: string) => recordings.update((all) => all.filter((r) => r.id !== id))),
    putMeta: jest.fn(async () => undefined),
    putChunk: jest.fn(async () => undefined),
  };
}
export type FakeVideoStore = ReturnType<typeof fakeVideoStore>;

export const recordingMeta = (id: string, o: Partial<RecordingMeta> = {}): RecordingMeta => ({
  id, exercise: 'squat', start: new Date(2026, 9, 28, 18, 5).getTime(), end: 0, durationSec: 125,
  mime: 'video/webm', size: 5 * 1024 * 1024, chunks: 3, sets: [], ...o,
});

export const setRecord = (id: string, o: Partial<SetRecord> = {}): SetRecord => ({
  id, exercise: 'squat', start: new Date(2026, 9, 28, 18, 10).getTime(), end: new Date(2026, 9, 28, 18, 10, 40).getTime(),
  valid: 8, invalid: 0, reasons: {}, restBeforeSec: null, ...o,
});

/** jsdom has no object URLs: hand out predictable ones. */
export function mockObjectUrls() {
  let n = 0;
  const create = jest.fn(() => `blob:fake/${++n}`);
  const revoke = jest.fn();
  Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
  return { create, revoke };
}

/** jsdom does not implement media playback. */
export function mockMediaElements() {
  const play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(async () => undefined);
  const pause = jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  const load = jest.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
  return { play, pause, load };
}

/** Sets read-only properties on a DOM element (videoWidth, readyState, duration…). */
export function setProps(el: object, props: Record<string, unknown>): void {
  for (const [k, value] of Object.entries(props)) Object.defineProperty(el, k, { value, configurable: true, writable: true });
}
