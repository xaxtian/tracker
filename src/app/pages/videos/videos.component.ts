import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { EXERCISES } from '../../exercises';
import { RecordingMeta, VideoStoreService, formatBytes, formatClock } from '../../services/video-store.service';
import { downloadRecording } from './video-actions';

/** List of saved recordings with storage usage. */
@Component({
  selector: 'app-videos',
  imports: [RouterLink, DatePipe],
  template: `
    <h1>Vídeos</h1>
    <p class="muted">
      Los vídeos se guardan solo en este dispositivo.
      @if (usage(); as u) { Espacio usado: {{ u }}. }
    </p>

    @if (store.recordings().length === 0) {
      <p class="muted">Aún no hay vídeos. Pulsa <b>⏺ Grabar</b> durante un entrenamiento o activa la grabación automática en Ajustes.</p>
    }

    <div class="list">
      @for (r of store.recordings(); track r.id) {
        <div class="item">
          <a class="main" [routerLink]="['/videos', r.id]">
            <span class="icon">{{ ex[r.exercise].icon }}</span>
            <span class="txt">
              <b>{{ ex[r.exercise].name }}</b>
              <small>{{ r.start | date: "EEE d MMM, HH:mm" }} · {{ clock(r.durationSec) }} · {{ bytes(r.size) }}</small>
              <small>{{ r.sets.length }} {{ r.sets.length === 1 ? 'serie' : 'series' }} · {{ totalValid(r) }} válidas</small>
            </span>
          </a>
          <div class="acts">
            <button class="icon-btn" (click)="download(r)" aria-label="Descargar">⬇</button>
            <button class="icon-btn" (click)="remove(r)" aria-label="Borrar">🗑</button>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .list { display: flex; flex-direction: column; gap: 8px; }
    .item { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 12px; background: var(--card); border: 1px solid var(--line); }
    .main { flex: 1; display: flex; align-items: center; gap: 12px; color: var(--text); text-decoration: none; min-width: 0; }
    .icon { font-size: 30px; }
    .txt { display: flex; flex-direction: column; min-width: 0; small { color: var(--muted); } }
    .acts { display: flex; gap: 4px; }
    .icon-btn { background: none; border: 1px solid var(--line); border-radius: 8px; color: var(--text); font-size: 18px; padding: 6px 10px; cursor: pointer; }
  `,
})
export class VideosComponent {
  readonly store = inject(VideoStoreService);
  readonly ex = EXERCISES;
  /** Storage used and available, as text. */
  readonly usage = signal<string | null>(null);
  readonly clock = formatClock;
  readonly bytes = formatBytes;

  constructor() {
    void this.store.refresh();
    void navigator.storage?.estimate?.().then((e) => {
      if (e.usage !== undefined) {
        this.usage.set(formatBytes(e.usage) + (e.quota ? ` de ${formatBytes(e.quota)} disponibles` : ''));
      }
    });
  }

  /** Valid reps across all the sets of a recording. */
  totalValid(r: RecordingMeta): number {
    return r.sets.reduce((n, s) => n + s.valid, 0);
  }

  /** Saves the video file. */
  download(r: RecordingMeta): void {
    void downloadRecording(this.store, r);
  }

  /** Deletes a recording after confirmation. */
  remove(r: RecordingMeta): void {
    if (confirm('¿Borrar este vídeo? No se puede deshacer.')) void this.store.remove(r.id);
  }
}
