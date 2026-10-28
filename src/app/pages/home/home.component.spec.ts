import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EXERCISE_IDS } from '../../exercises';
import { HistoryService } from '../../services/history.service';
import { setRecord } from '../../../testing/fakes';
import { HomeComponent } from './home.component';

describe('HomeComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [HomeComponent], providers: [provideRouter([])] });
  });

  const render = () => {
    const f = TestBed.createComponent(HomeComponent);
    f.detectChanges();
    return f.nativeElement as HTMLElement;
  };
  const card = (el: HTMLElement, id: string) => el.querySelector(`a.exercise[href="/workout/${id}"]`)!;

  it('offers every registered exercise, grouped by category', () => {
    const el = render();
    expect([...el.querySelectorAll('h2.category')].map((h) => h.textContent)).toEqual(['Piernas', 'Empuje', 'Tracción', 'Brazos', 'Core']);
    const hrefs = [...el.querySelectorAll('a.exercise')].map((c) => c.getAttribute('href'));
    expect(hrefs).toHaveLength(EXERCISE_IDS.length);
    expect(new Set(hrefs)).toEqual(new Set(EXERCISE_IDS.map((id) => `/workout/${id}`)));
    expect(card(el, 'dips').querySelector('.name')?.textContent).toBe('Fondos en paralelas');
  });

  it("adds up today's valid reps per exercise", () => {
    const today = new Date();
    today.setHours(9, 0, 0, 0);
    const h = TestBed.inject(HistoryService);
    h.add(setRecord('a', { exercise: 'squat', start: today.getTime(), valid: 8 }));
    h.add(setRecord('b', { exercise: 'squat', start: today.getTime() + 60_000, valid: 6 }));
    h.add(setRecord('c', { exercise: 'pullup', start: today.getTime() - 86_400_000, valid: 10 }));
    h.add(setRecord('d', { exercise: 'legRaise', start: today.getTime(), valid: 12 }));
    const el = render();
    const todayOf = (id: string) => card(el, id).querySelector('.today')?.textContent?.trim();
    expect(todayOf('squat')).toBe('Hoy: 14 válidas');
    expect(todayOf('pullup')).toBe('Hoy: 0 válidas');
    expect(todayOf('legRaise')).toBe('Hoy: 12 válidas');
  });
});
