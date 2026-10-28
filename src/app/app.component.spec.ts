import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  it('shows the brand and the four sections', async () => {
    await TestBed.configureTestingModule({ imports: [AppComponent], providers: [provideRouter([])] }).compileComponents();
    const f = TestBed.createComponent(AppComponent);
    f.detectChanges();
    const el: HTMLElement = f.nativeElement;
    expect(el.querySelector('.brand')?.textContent).toBe('TrackBody');
    const links = [...el.querySelectorAll('.links a')].map((a) => [a.textContent?.trim(), a.getAttribute('href')]);
    expect(links).toEqual([
      ['Entrenar', '/'],
      ['Historial', '/history'],
      ['Vídeos', '/videos'],
      ['Ajustes', '/settings'],
    ]);
    expect(el.querySelector('router-outlet')).not.toBeNull();
  });
});
