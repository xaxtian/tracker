import { Component, ElementRef, OnDestroy, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { RecordingMeta, VideoStoreService, formatClock } from '../../services/video-store.service';
import { canShareFiles, downloadRecording, shareRecording } from './video-actions';

/** Video player for a recording, with a chapter per set and download/share buttons. */
@Component({
  selector: 'app-recording-player',
  template: `
    @if (error()) {
      <p class="muted">{{ error() }}</p>
    } @else if (!url()) {
      <p class="muted">Cargando vídeo…</p>
    }
    @if (url()) {
      <div class="player">
        <video #video controls playsinline [src]="url()" (loadedmetadata)="onLoaded()" (timeupdate)="onTime()"></video>
      </div>

      @if (meta().sets.length) {
        <div class="chapters">
          @for (s of meta().sets; track s.setId) {
            <button class="chap" [class.active]="current() === s.setId" (click)="seek(s.startSec)">
              <b>Serie {{ s.index }}</b>
              <span class="ok">{{ s.valid }} ✓</span>
              @if (s.invalid) { <span class="ko">{{ s.invalid }} ✗</span> }
              <small>{{ clock(s.startSec) }}</small>
            </button>
          }
        </div>
      }

      <div class="actions">
        <button class="btn primary" (click)="download()">⬇ Descargar</button>
        @if (canShare) {
          <button class="btn" (click)="share()">📤 Compartir / Guardar en galería</button>
        }
        <ng-content />
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .player { background: #000; border-radius: 12px; overflow: hidden; }
    video { display: block; width: 100%; max-height: 65vh; background: #000; }
    .chapters { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .chap {
      display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 10px; cursor: pointer;
      background: var(--card); border: 1px solid var(--line); color: var(--text); font-size: 14px;
      &.active { border-color: var(--accent); }
      small { color: var(--muted); }
    }
    .ok { color: var(--ok); font-weight: 700; }
    .ko { color: var(--ko); font-weight: 700; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
  `,
})
export class RecordingPlayerComponent implements OnDestroy {
  readonly meta = input.required<RecordingMeta>();
  /** Second to start playing from. */
  readonly startAt = input(0);
  readonly autoplay = input(false);

  private store = inject(VideoStoreService);
  private videoRef = viewChild<ElementRef<HTMLVideoElement>>('video');

  readonly clock = formatClock;
  readonly canShare = canShareFiles();
  readonly url = signal('');
  readonly error = signal('');
  readonly time = signal(0);
  readonly current = computed(() => {
    const t = this.time();
    return this.meta().sets.find((s) => t >= s.startSec && t <= s.endSec + 3)?.setId ?? null;
  });

  private blob: Blob | null = null;
  private fixingDuration = false;
  private loadedId = '';

  constructor() {
    effect(() => {
      const m = this.meta();
      if (m.id !== this.loadedId) void this.load(m);
    });
  }

  private async load(m: RecordingMeta): Promise<void> {
    this.loadedId = m.id;
    this.revoke();
    this.error.set('');
    try {
      const blob = await this.store.getBlob(m);
      if (m.id !== this.loadedId) return;
      if (!blob.size) {
        this.error.set('El vídeo está vacío.');
        return;
      }
      this.blob = blob;
      this.url.set(URL.createObjectURL(blob));
    } catch (e) {
      this.error.set(`No se pudo cargar el vídeo: ${(e as Error)?.message ?? e}`);
    }
  }

  onLoaded(): void {
    const v = this.videoRef()?.nativeElement;
    if (!v) return;
    const begin = () => {
      if (this.startAt()) v.currentTime = this.startAt();
      if (this.autoplay()) void v.play().catch(() => undefined);
    };
    // Recorded WebM files have no duration until the end is reached once; force it so seeking works.
    if (!Number.isFinite(v.duration)) {
      this.fixingDuration = true;
      v.addEventListener(
        'durationchange',
        () => {
          this.fixingDuration = false;
          v.currentTime = 0;
          begin();
        },
        { once: true },
      );
      v.currentTime = 1e9;
    } else {
      begin();
    }
  }

  onTime(): void {
    const v = this.videoRef()?.nativeElement;
    if (v && !this.fixingDuration) this.time.set(v.currentTime);
  }

  seek(sec: number): void {
    const v = this.videoRef()?.nativeElement;
    if (!v) return;
    v.currentTime = sec;
    void v.play().catch(() => undefined);
  }

  download(): void {
    void downloadRecording(this.store, this.meta(), this.blob ?? undefined);
  }

  share(): void {
    void shareRecording(this.store, this.meta(), this.blob ?? undefined);
  }

  ngOnDestroy(): void {
    this.revoke();
  }

  private revoke(): void {
    if (this.url()) URL.revokeObjectURL(this.url());
    this.url.set('');
    this.blob = null;
  }
}
