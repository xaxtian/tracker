import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EXERCISES, ExerciseId } from '../../models/types';
import { HistoryService } from '../../services/history.service';

/** Home page: one card per exercise with today's valid reps. */
@Component({
  selector: 'app-home',
  imports: [RouterLink],
  template: `
    <h1 class="title">¿Qué vas a entrenar?</h1>
    <p class="muted">
      Solo cuentan las repeticiones estrictas. Las series se detectan solas: empiezan con la primera
      repetición y terminan cuando descansas o te bajas de la barra.
    </p>
    <div class="grid">
      @for (ex of exercises; track ex.id) {
        <a class="exercise" [routerLink]="['/workout', ex.id]">
          <span class="icon">{{ ex.icon }}</span>
          <span class="name">{{ ex.name }}</span>
          <span class="today">Hoy: {{ today()[ex.id] ?? 0 }} válidas</span>
        </a>
      }
    </div>
  `,
  styles: `
    .title { margin: 8px 0 4px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-top: 16px; }
    .exercise {
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      padding: 24px 12px; border-radius: 16px; background: var(--card); border: 1px solid var(--line);
      color: var(--text); text-decoration: none; transition: transform .1s, border-color .1s;
      &:hover { border-color: var(--accent); transform: translateY(-2px); }
    }
    .icon { font-size: 48px; }
    .name { font-size: 20px; font-weight: 700; }
    .today { font-size: 13px; color: var(--muted); }
  `,
})
export class HomeComponent {
  private history = inject(HistoryService);
  readonly exercises = (Object.keys(EXERCISES) as ExerciseId[]).map((id) => ({ id, ...EXERCISES[id] }));

  /** Valid reps per exercise since midnight. */
  readonly today = computed(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const totals: Partial<Record<ExerciseId, number>> = {};
    for (const s of this.history.sets()) {
      if (s.start >= start.getTime()) totals[s.exercise] = (totals[s.exercise] ?? 0) + s.valid;
    }
    return totals;
  });
}
