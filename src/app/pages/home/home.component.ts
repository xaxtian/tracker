import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EXERCISES_BY_CATEGORY, ExerciseId } from '../../exercises';
import { HistoryService } from '../../services/history.service';

/** Home page: the exercises grouped by category, each with today's valid reps. */
@Component({
  selector: 'app-home',
  imports: [RouterLink],
  template: `
    <h1 class="title">¿Qué vas a entrenar?</h1>
    <p class="muted">
      Solo cuentan las repeticiones estrictas. Las series se detectan solas: empiezan con la primera
      repetición y terminan cuando descansas o te bajas de la barra.
    </p>
    @for (g of groups; track g.category) {
      <h2 class="category">{{ g.category }}</h2>
      <div class="grid">
        @for (ex of g.exercises; track ex.id) {
          <a class="exercise" [routerLink]="['/workout', ex.id]">
            <span class="icon">{{ ex.icon }}</span>
            <span class="name">{{ ex.name }}</span>
            <span class="today">Hoy: {{ today()[ex.id] ?? 0 }} válidas</span>
          </a>
        }
      </div>
    }
  `,
  styles: `
    .title { margin: 8px 0 4px; }
    .category { margin: 20px 0 8px; font-size: 15px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
    .exercise {
      display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center;
      padding: 16px 10px; border-radius: 16px; background: var(--card); border: 1px solid var(--line);
      color: var(--text); text-decoration: none; transition: transform .1s, border-color .1s;
      &:hover { border-color: var(--accent); transform: translateY(-2px); }
    }
    .icon { font-size: 40px; }
    .name { font-size: 17px; font-weight: 700; }
    .today { font-size: 13px; color: var(--muted); }
  `,
})
export class HomeComponent {
  private history = inject(HistoryService);
  /** Exercise cards by category. */
  readonly groups = EXERCISES_BY_CATEGORY;

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
