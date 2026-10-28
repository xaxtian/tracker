import { Component, HostListener, OnDestroy, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { TempoAverages, fmt2, fmtLoad, tempoAverages, velocityLoss } from '../../analysis/set-stats';
import { RecordingMeta, VideoStoreService } from '../../services/video-store.service';
import { RecordingPlayerComponent } from '../videos/recording-player.component';
import { EXERCISES, ExerciseId, FAULT_MESSAGES, PAUSE_LABELS, SetRecord } from '../../models/types';
import { HistoryService } from '../../services/history.service';

interface ExerciseGroup {
  exercise: ExerciseId;
  sets: SetRecord[];
  valid: number;
  invalid: number;
  best: number;
}

interface DayGroup {
  day: number;
  groups: ExerciseGroup[];
}

@Component({
  selector: 'app-history',
  imports: [DatePipe, DecimalPipe, RecordingPlayerComponent],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss',
})
export class HistoryComponent implements OnDestroy {
  private history = inject(HistoryService);
  private videos = inject(VideoStoreService);
  readonly expanded = signal<string | null>(null);
  readonly fmt2 = fmt2;
  readonly fmtLoad = fmtLoad;
  readonly playing = signal<{ set: SetRecord; meta: RecordingMeta } | null>(null);
  readonly videoIds = computed(() => new Set(this.videos.recordings().map((r) => r.id)));
  readonly ex = EXERCISES;
  readonly filter = signal<ExerciseId | 'all'>('all');
  readonly exerciseIds: ExerciseId[] = ['squat', 'pushup', 'pullup'];
  readonly filters: (ExerciseId | 'all')[] = ['all', ...this.exerciseIds];

  readonly days = computed<DayGroup[]>(() => {
    const f = this.filter();
    const byDay = new Map<number, Map<ExerciseId, SetRecord[]>>();
    for (const s of this.history.sets()) {
      if (f !== 'all' && s.exercise !== f) continue;
      const d = new Date(s.start);
      d.setHours(0, 0, 0, 0);
      const day = byDay.get(d.getTime()) ?? new Map();
      byDay.set(d.getTime(), day);
      day.set(s.exercise, [...(day.get(s.exercise) ?? []), s]);
    }
    return [...byDay.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([day, m]) => ({
        day,
        groups: [...m.entries()].map(([exercise, sets]) => ({
          exercise,
          sets: sets.sort((a, b) => a.start - b.start),
          valid: sets.reduce((n, s) => n + s.valid, 0),
          invalid: sets.reduce((n, s) => n + s.invalid, 0),
          best: Math.max(...sets.map((s) => s.valid)),
        })),
      }));
  });

  readonly records = computed(() => {
    const best: Partial<Record<ExerciseId, number>> = {};
    for (const s of this.history.sets()) best[s.exercise] = Math.max(best[s.exercise] ?? 0, s.valid);
    return best;
  });

  toggle(s: SetRecord): void {
    this.expanded.update((id) => (id === s.id ? null : s.id));
  }

  avg(s: SetRecord): TempoAverages {
    return tempoAverages(s.reps);
  }

  loss(s: SetRecord): number | null {
    return velocityLoss(s.reps);
  }

  labels(ex: ExerciseId) {
    return PAUSE_LABELS[ex];
  }

  faultList(reasons: string[]): string {
    return reasons.map((r) => FAULT_MESSAGES[r] ?? r).join(' · ');
  }

  fpsOf(s: SetRecord): string {
    const f = (s.reps ?? []).map((r) => r.tempo?.fps).filter((x): x is number => !!x);
    return f.length ? String(Math.round(f.reduce((a, b) => a + b, 0) / f.length)) : '?';
  }

  play(s: SetRecord): void {
    const meta = this.videos.recordings().find((r) => r.id === s.recordingId);
    if (!meta) return;
    this.playing.set({ set: s, meta });
    document.body.style.overflow = 'hidden';
  }

  @HostListener('document:keydown.escape')
  closePlayer(): void {
    if (!this.playing()) return;
    this.playing.set(null);
    document.body.style.overflow = '';
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }

  label(f: ExerciseId | 'all'): string {
    return f === 'all' ? 'Todo' : EXERCISES[f].name;
  }

  reasons(s: SetRecord): string {
    return Object.entries(s.reasons)
      .map(([k, n]) => `${FAULT_MESSAGES[k] ?? k} ×${n}`)
      .join(', ');
  }

  duration(s: SetRecord): string {
    return `${Math.max(1, Math.round((s.end - s.start) / 1000))} s`;
  }

  rest(sec: number | null): string {
    if (sec === null) return '—';
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  }

  /** Corrects the load of a set after the fact. */
  setLoad(s: SetRecord, value: string): void {
    const n = parseFloat(String(value).replace(',', '.'));
    const kg = Number.isFinite(n) ? Math.round(Math.min(500, Math.max(-100, n)) * 100) / 100 : 0;
    this.history.update(s.id, { loadKg: kg || undefined });
  }

  remove(s: SetRecord): void {
    if (confirm('¿Borrar esta serie?')) this.history.remove(s.id);
  }

  clearAll(): void {
    if (confirm('¿Borrar todo el historial? No se puede deshacer.')) this.history.clear();
  }

  exportJson(): void {
    const blob = new Blob([this.history.exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `trackbody-historial-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
