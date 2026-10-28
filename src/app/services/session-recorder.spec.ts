import { createMockCtx, mockCanvas } from '../../testing/canvas.mock';
import { landmarks } from '../../testing/landmarks';
import { FakeMediaRecorder, installMediaRecorder } from '../../testing/media-recorder.mock';
import { SetRecord } from '../models/types';
import { SessionRecorder, recordingSupported } from './session-recorder';
import { VideoStoreService } from './video-store.service';

const store = () => ({
  putMeta: jest.fn(async (_m: unknown) => undefined),
  putChunk: jest.fn(async (_id: string, _i: number, _data: Blob) => undefined),
});

describe('SessionRecorder', () => {
  const g = globalThis as Record<string, unknown>;
  let now = 1_000_000;
  let uninstall: () => void;

  beforeEach(() => {
    uninstall = installMediaRecorder();
    mockCanvas();
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    uninstall();
  });

  const make = (w = 1920, h = 1080) => {
    const s = store();
    const r = new SessionRecorder(s as unknown as VideoStoreService, 'pullup', w, h);
    return { s, r, mr: FakeMediaRecorder.last };
  };

  it('is supported only with MediaRecorder and canvas capture', () => {
    expect(recordingSupported()).toBe(true);
    delete g['MediaRecorder'];
    expect(recordingSupported()).toBe(false);
  });

  it('caps the video at 1280 px and even dimensions', () => {
    const { r } = make(1920, 1080);
    const canvas = (r as unknown as { canvas: HTMLCanvasElement }).canvas;
    expect([canvas.width, canvas.height]).toEqual([1280, 720]);
    const small = make(641, 359).r as unknown as { canvas: HTMLCanvasElement };
    expect([small.canvas.width % 2, small.canvas.height % 2]).toEqual([0, 0]);
  });

  it('picks the first supported format and a moderate bitrate', () => {
    const { r, mr } = make();
    expect(mr.options.mimeType).toBe('video/webm;codecs=vp9');
    expect(mr.options.videoBitsPerSecond).toBe(2_500_000);
    expect(r.meta).toMatchObject({ id: `rec-${now}`, exercise: 'pullup', mime: 'video/webm;codecs=vp9', sets: [] });
  });

  it('prefers MP4 when the browser supports it', () => {
    FakeMediaRecorder.supported = ['video/mp4', 'video/webm'];
    expect(make().mr.options.mimeType).toBe('video/mp4');
    FakeMediaRecorder.supported = ['video/webm;codecs=vp9', 'video/webm'];
  });

  it('saves the metadata and records in 2 s chunks', async () => {
    const { r, s, mr } = make();
    await r.start();
    expect(s.putMeta).toHaveBeenCalledWith(r.meta);
    expect(mr.start).toHaveBeenCalledWith(2000);
  });

  it('writes every chunk to storage in order and returns the final metadata', async () => {
    const { r, s, mr } = make();
    await r.start();
    mr.emit('aa');
    mr.ondataavailable?.({ data: new Blob([]) }); // empty chunks are skipped
    mr.emit('bbb');
    now += 30_000;
    const m = await r.stop();
    expect(s.putChunk.mock.calls.map((c) => c[1])).toEqual([0, 1, 2]);
    expect(m.chunks).toBe(3);
    expect(m.size).toBe(2 + 3 + 3);
    expect(m.durationSec).toBe(30);
    expect(m.end).toBe(now);
  });

  it('keeps going when a chunk cannot be stored', async () => {
    const { r, s, mr } = make();
    s.putChunk.mockRejectedValueOnce(new Error('quota'));
    await r.start();
    mr.emit('a');
    mr.emit('b');
    await expect(r.stop()).resolves.toBeDefined();
    expect(s.putChunk).toHaveBeenCalledTimes(3);
  });

  it('adds a chapter for each set, starting 2 s early', () => {
    const { r, s } = make();
    const start = r.meta.start;
    now += 20_000;
    const set = { id: 's1', start: start + 10_000, end: start + 18_000, valid: 6, invalid: 1 } as SetRecord;
    expect(r.markSet(set, 1)).toBe(8);
    expect(r.meta.sets).toEqual([{ setId: 's1', index: 1, startSec: 8, endSec: 18, valid: 6, invalid: 1 }]);
    expect(s.putMeta).toHaveBeenLastCalledWith(expect.objectContaining({ durationSec: 20 }));
    // A set that started with the recording cannot start before 0.
    expect(r.markSet({ ...set, id: 's2', start }, 2)).toBe(0);
  });

  it('draws the camera, the skeleton and the HUD on each frame', () => {
    const ctx = createMockCtx();
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ctx as never);
    const { r } = make(1280, 720);
    const video = { videoWidth: 1280, videoHeight: 720 } as HTMLVideoElement;
    const hud = { title: 'Dominadas', valid: 3, invalid: 0, inSet: true, setNumber: 1, restSec: null, toast: null, banner: null, hint: '', now };
    r.draw(video, true, landmarks({ 11: [10, 10], 13: [10, 50] }), null, { color: '#fff', minVisibility: 0.5, showAngle: false }, hud);
    expect(ctx.drawImage).toHaveBeenCalledWith(video, 0, 0, 1280, 720);
    // mirrored: flip horizontally
    expect(ctx.scale).toHaveBeenCalledWith(-1, 1);
    expect(ctx.lineTo).toHaveBeenCalled();
    expect(ctx.texts).toContain('3');
  });

  it('skips frames before the camera has a size', () => {
    const ctx = createMockCtx();
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ctx as never);
    const { r } = make();
    (ctx.drawImage as jest.Mock).mockClear();
    r.draw({ videoWidth: 0, videoHeight: 0 } as HTMLVideoElement, false, null, null, { color: '', minVisibility: 0, showAngle: false }, {} as never);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('can be stopped twice', async () => {
    const { r } = make();
    await r.start();
    await r.stop();
    await expect(r.stop()).resolves.toBeDefined();
  });
});
