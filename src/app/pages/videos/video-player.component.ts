import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EXERCISES } from '../../models/types';
import { RecordingMeta, VideoStoreService, formatBytes, formatClock } from '../../services/video-store.service';
import { RecordingPlayerComponent } from './recording-player.component';

@Component({
  selector: 'app-video-player',
  imports: [RouterLink, DatePipe, RecordingPlayerComponent],
  template: `
    <header class="page-head">
      <a routerLink="/videos" class="back" aria-label="Volver">←</a>
      @if (meta(); as m) {
        <h1>{{ ex[m.exercise].icon }} {{ ex[m.exercise].name }}</h1>
      } @else {
        <h1>Vídeo</h1>
      }
    </header>

    @if (error()) {
      <p class="muted">{{ error() }}</p>
    }

    @if (meta(); as m) {
      <p class="muted">{{ m.start | date: "EEEE d MMMM, HH:mm" }} · {{ clock(m.durationSec) }} · {{ bytes(m.size) }}</p>
      <app-recording-player [meta]="m" [startAt]="startAt">
        <button class="btn danger" (click)="remove(m)">🗑 Borrar</button>
      </app-recording-player>
    }
  `,
})
export class VideoPlayerComponent {
  private store = inject(VideoStoreService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly ex = EXERCISES;
  readonly clock = formatClock;
  readonly bytes = formatBytes;
  readonly meta = signal<RecordingMeta | null>(null);
  readonly error = signal('');
  readonly startAt = Number(this.route.snapshot.queryParamMap.get('t') ?? 0) || 0;

  constructor() {
    void this.load(this.route.snapshot.paramMap.get('id') ?? '');
  }

  private async load(id: string): Promise<void> {
    await this.store.refresh();
    const m = this.store.recordings().find((r) => r.id === id);
    if (m) this.meta.set(m);
    else this.error.set('Este vídeo ya no existe.');
  }

  async remove(m: RecordingMeta): Promise<void> {
    if (!confirm('¿Borrar este vídeo? No se puede deshacer.')) return;
    await this.store.remove(m.id);
    void this.router.navigate(['/videos']);
  }
}
