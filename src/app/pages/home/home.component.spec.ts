import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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
    return f;
  };

  it('offers the three exercises', () => {
    const el: HTMLElement = render().nativeElement;
    const cards = [...el.querySelectorAll('a.exercise')];
    expect(cards.map((c) => c.querySelector('.name')?.textContent)).toEqual(['Sentadillas', 'Flexiones', 'Dominadas']);
    expect(cards.map((c) => c.getAttribute('href'))).toEqual(['/workout/squat', '/workout/pushup', '/workout/pullup']);
  });

  it("adds up today's valid reps per exercise", () => {
    const today = new Date();
    today.setHours(9, 0, 0, 0);
    const h = TestBed.inject(HistoryService);
    h.add(setRecord('a', { exercise: 'squat', start: today.getTime(), valid: 8 }));
    h.add(setRecord('b', { exercise: 'squat', start: today.getTime() + 60_000, valid: 6 }));
    h.add(setRecord('c', { exercise: 'pullup', start: today.getTime() - 86_400_000, valid: 10 }));
    const el: HTMLElement = render().nativeElement;
    const today$ = [...el.querySelectorAll('.today')].map((t) => t.textContent?.trim());
    expect(today$).toEqual(['Hoy: 14 válidas', 'Hoy: 0 válidas', 'Hoy: 0 válidas']);
  });
});
