import { FrameEval } from '../analysis/analyzers';
import { HudState, PoseDrawOptions, drawHud, drawPose } from '../analysis/overlay';
import { ExerciseId, Pt, SetRecord } from '../models/types';
import { RecordingMeta, VideoStoreService } from './video-store.service';

const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];

export function recordingSupported(): boolean {
  return typeof MediaRecorder !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype;
}

/**
 * Records a composite video (camera + skeleton + counters + notifications)
 * by drawing everything on an off-screen canvas and capturing it.
 */
export class SessionRecorder {
  readonly meta: RecordingMeta;
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private rec: MediaRecorder;
  private writes: Promise<void> = Promise.resolve();
  private chunkIndex = 0;
  private stopped: Promise<void>;

  constructor(
    private store: VideoStoreService,
    exercise: ExerciseId,
    videoWidth: number,
    videoHeight: number,
  ) {
    // Cap at 1280 px on the long side to keep files small.
    const k = Math.min(1, 1280 / Math.max(videoWidth, videoHeight));
    this.canvas.width = Math.round((videoWidth * k) / 2) * 2;
    this.canvas.height = Math.round((videoHeight * k) / 2) * 2;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const mime = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
    const stream = this.canvas.captureStream(30);
    this.rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: 2_500_000 });

    const now = Date.now();
    this.meta = {
      id: `rec-${now}`,
      exercise,
      start: now,
      end: now,
      durationSec: 0,
      mime: this.rec.mimeType || mime || 'video/webm',
      size: 0,
      chunks: 0,
      sets: [],
    };

    this.rec.ondataavailable = (e) => {
      if (!e.data.size) return;
      const i = this.chunkIndex++;
      this.meta.size += e.data.size;
      this.meta.chunks = this.chunkIndex;
      this.writes = this.writes.then(() => this.store.putChunk(this.meta.id, i, e.data)).catch(() => undefined);
    };
    this.stopped = new Promise((resolve) => (this.rec.onstop = () => resolve()));
  }

  get elapsedSec(): number {
    return (Date.now() - this.meta.start) / 1000;
  }

  async start(): Promise<void> {
    await this.store.putMeta(this.meta);
    // Small timeslice: data is flushed to IndexedDB every 2 s.
    this.rec.start(2000);
  }

  /** Draws one frame of the composite video. */
  draw(video: HTMLVideoElement, mirror: boolean, lm: Pt[] | null, ev: FrameEval | null, pose: Omit<PoseDrawOptions, 'mirrorText' | 'scale'>, hud: HudState): void {
    const { width: W, height: H } = this.canvas;
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) return;
    const ctx = this.ctx;
    const k = Math.min(W / vw, H / vh);
    const ox = (W - vw * k) / 2, oy = (H - vh * k) / 2;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    if (mirror) {
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
    }
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    ctx.drawImage(video, 0, 0, vw, vh);
    if (lm) drawPose(ctx, lm, ev, { ...pose, scale: vw / 640, mirrorText: mirror });
    ctx.restore();

    drawHud(ctx, W, H, hud);
  }

  /** Adds a chapter for a finished set. Returns the offset (s) to play it from. */
  markSet(set: SetRecord, index: number): number {
    const startSec = Math.max(0, (set.start - this.meta.start) / 1000 - 2);
    this.meta.sets.push({
      setId: set.id,
      index,
      startSec,
      endSec: Math.max(startSec, (set.end - this.meta.start) / 1000),
      valid: set.valid,
      invalid: set.invalid,
    });
    void this.store.putMeta({ ...this.meta, end: Date.now(), durationSec: this.elapsedSec });
    return startSec;
  }

  async stop(): Promise<RecordingMeta> {
    if (this.rec.state !== 'inactive') {
      this.rec.stop();
      await this.stopped;
    }
    await this.writes;
    this.meta.end = Date.now();
    this.meta.durationSec = this.elapsedSec;
    await this.store.putMeta(this.meta);
    return this.meta;
  }
}
