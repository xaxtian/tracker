import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DEFAULT_SETTINGS, SettingsService } from '../../services/settings.service';
import { SettingsComponent } from './settings.component';

describe('SettingsComponent', () => {
  let f: ComponentFixture<SettingsComponent>;
  let el: HTMLElement;
  let svc: SettingsService;

  beforeEach(() => {
    localStorage.clear();
    f = TestBed.createComponent(SettingsComponent);
    svc = TestBed.inject(SettingsService);
    f.detectChanges();
    el = f.nativeElement;
  });

  const labels = () => [...el.querySelectorAll('.field label')].map((l) => l.textContent?.trim());
  const input = (id: string) => el.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!;
  const openSection = (title: string) => {
    [...el.querySelectorAll<HTMLButtonElement>('.sec-head')].find((b) => b.textContent?.includes(title))!.click();
    f.detectChanges();
  };

  it('shows one section per exercise plus general, with squats open', () => {
    expect([...el.querySelectorAll('.sec-head h2')].map((h) => h.textContent)).toEqual([
      '🏋️ Sentadillas', '💪 Flexiones', '🧗 Dominadas', '⚙️ General',
    ]);
    expect(labels()).toContain('Extensión arriba');
    expect(labels()).not.toContain('Tu altura');
  });

  it('opens another section', () => {
    openSection('General');
    expect(labels()).toEqual(expect.arrayContaining(['Tu altura', 'Cámara a 60 fps', 'Modelo']));
    expect(labels()).not.toContain('Extensión arriba');
  });

  it('saves a slider value as a number and shows it with its unit', () => {
    const range = input('squatmaxTorsoLean') as HTMLInputElement;
    range.value = '62';
    range.dispatchEvent(new Event('input'));
    f.detectChanges();
    expect(svc.settings().squat.maxTorsoLean).toBe(62);
    const out = range.closest('.field')!.querySelector('output')!;
    expect(out.textContent).toBe('62°');
  });

  it('shows ratio settings as a percentage', () => {
    openSection('Dominadas');
    const out = input('pullupmaxHipSwing').closest('.field')!.querySelector('output')!;
    expect(out.textContent).toBe('30%');
  });

  it('only shows dependent fields when they apply', () => {
    expect(labels()).not.toContain('Tolerancia de talones');
    expect(labels()).not.toContain('Tiempo mínimo de bajada');
    const heels = input('squatcheckHeels') as HTMLInputElement;
    heels.checked = true;
    heels.dispatchEvent(new Event('change'));
    const ecc = input('squatcheckEccentric') as HTMLInputElement;
    ecc.checked = true;
    ecc.dispatchEvent(new Event('change'));
    f.detectChanges();
    expect(svc.settings().squat.checkHeels).toBe(true);
    expect(labels()).toEqual(expect.arrayContaining(['Tolerancia de talones', 'Tiempo mínimo de bajada']));
  });

  it('switches the depth criterion with the select', () => {
    expect(labels()).toContain('Margen de profundidad');
    const sel = input('squatdepthMode') as HTMLSelectElement;
    sel.value = 'kneeAngle';
    sel.dispatchEvent(new Event('change'));
    f.detectChanges();
    expect(svc.settings().squat.depthMode).toBe('kneeAngle');
    expect(labels()).toContain('Ángulo de rodilla abajo');
    expect(labels()).not.toContain('Margen de profundidad');
  });

  it('restores the defaults of the open section', () => {
    svc.update('squat', 'topKneeAngle', 150);
    svc.update('pushup', 'topElbowAngle', 140);
    [...el.querySelectorAll<HTMLButtonElement>('.card > .btn')][0].click();
    expect(svc.settings().squat).toEqual(DEFAULT_SETTINGS.squat);
    expect(svc.settings().pushup.topElbowAngle).toBe(140);
  });
});
