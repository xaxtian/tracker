import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RepRecord, RepTempo } from '../../models/types';
import { HistoryService } from '../../services/history.service';
import { VideoStoreService } from '../../services/video-store.service';
import { FakeVideoStore, fakeVideoStore, mockMediaElements, mockObjectUrls, recordingMeta, setRecord } from '../../../testing/fakes';
import { HistoryComponent } from './history.component';

const day = (d: number, h = 18, m = 0) => new Date(2026, 9, d, h, m).getTime();
const tempo = (meanConVel: number): RepTempo => ({
  eccentricSec: 2.01, concentricSec: 0.95, pauseTurnSec: 0.4, pauseBetweenSec: 1.2,
  meanConVel, peakConVel: meanConVel * 1.8, meanEccVel: 0.3, fps: 60,
});
const reps: RepRecord[] = [
  { valid: true, reasons: [], tempo: { ...tempo(0.8), pauseBetweenSec: null } },
  { valid: false, reasons: ['squatNoDepth'], tempo: tempo(0.75) },
  { valid: true, reasons: [], tempo: tempo(0.6) },
];

describe('HistoryComponent', () => {
  let f: ComponentFixture<HistoryComponent>;
  let el: HTMLElement;
  let history: HistoryService;
  let store: FakeVideoStore;

  beforeEach(() => {
    localStorage.clear();
    store = fakeVideoStore([recordingMeta('rec1')]);
    TestBed.configureTestingModule({
      providers: [{ provide: VideoStoreService, useValue: store }, { provide: LOCALE_ID, useValue: 'es' }],
    });
    history = TestBed.inject(HistoryService);
    history.add(setRecord('s1', { start: day(27, 9), valid: 10 }));
    history.add(setRecord('s2', { start: day(28, 18, 10), valid: 8, invalid: 1, reasons: { squatNoDepth: 1 }, reps, loadKg: 20, recordingId: 'rec1', videoOffsetSec: 12 }));
    history.add(setRecord('s3', { start: day(28, 18, 14), valid: 6, restBeforeSec: 125 }));
    history.add(setRecord('s4', { start: day(28, 18, 30), exercise: 'pullup', valid: 12, loadKg: -15, recordingId: 'gone' }));
    f = TestBed.createComponent(HistoryComponent);
    f.detectChanges();
    el = f.nativeElement;
  });

  afterEach(() => jest.restoreAllMocks());

  const rows = () => [...el.querySelectorAll<HTMLTableRowElement>('tr.set-row')];
  const cells = (r: HTMLTableRowElement) => [...r.cells].map((c) => c.textContent?.trim());
  const rowOf = (time: string) => rows().find((r) => r.cells[0].textContent?.includes(time))!;
  const refresh = () => f.detectChanges();

  it('shows the best set per exercise', () => {
    const records = [...el.querySelectorAll('.record b')].map((b) => b.textContent);
    expect(records).toEqual(['10', '0', '12']);
  });

  it('groups sets by day (newest first) and exercise', () => {
    expect([...el.querySelectorAll('h2')].map((h) => h.textContent)).toEqual(['miércoles 28 octubre 2026', 'martes 27 octubre 2026']);
    const heads = [...el.querySelectorAll('section.card')[0].querySelectorAll('.group-head')].map((h) => h.textContent!.replace(/\s+/g, ' '));
    expect(heads[0]).toContain('Sentadillas');
    expect(heads[0]).toContain('2 series · 14 válidas · 1 no válidas · mejor 8');
    expect(heads[1]).toContain('Dominadas');
  });

  it('shows load, reps, velocity, velocity loss and rest for each set', () => {
    expect(cells(rowOf('18:10'))).toEqual(['▸ 18:10', '+20 kg', '8', '1', '0,70', '25%', '—', '▶🗑']);
    expect(cells(rowOf('18:14'))).toEqual(['▸ 18:14', '—', '6', '0', '—', '—', '2:05', '🗑']);
    expect(cells(rowOf('18:30'))[1]).toBe('−15 kg');
    expect(rowOf('18:10').cells[5].classList).toContain('warn');
  });

  it('lists the reasons of invalid reps under the set', () => {
    expect(el.querySelector('tr.reasons')?.textContent).toContain('No bajaste del paralelo ×1');
  });

  it('filters by exercise', () => {
    [...el.querySelectorAll<HTMLButtonElement>('.chip')].find((c) => c.textContent === 'Dominadas')!.click();
    refresh();
    expect(rows()).toHaveLength(1);
    expect(f.componentInstance.label('all')).toBe('Todo');
  });

  it('expands a set to show every rep', () => {
    rowOf('18:10').click();
    refresh();
    const detail = el.querySelector('tr.detail')!;
    expect(detail.querySelector('.summary')?.textContent).toContain('Duración 40 s');
    expect(detail.querySelector('.summary')?.textContent).toContain('mejor 0,80 m/s');
    const repRows = [...detail.querySelectorAll('.reps tbody tr:not(.why)')].map((r) => [...(r as HTMLTableRowElement).cells].map((c) => c.textContent?.trim()));
    expect(repRows[0]).toEqual(['1', '✓', '2,01', '0,40', '0,95', '—', '0,80', '1,44']);
    expect(repRows[1][1]).toBe('✗');
    expect(detail.querySelector('.why')?.textContent).toContain('No bajaste del paralelo');
    expect(detail.querySelector('.note')?.textContent).toContain('Medido a 60 fps');
    // Click again to close.
    rowOf('18:10').click();
    refresh();
    expect(el.querySelector('tr.detail')).toBeNull();
  });

  it('explains when an old set has no per-rep detail', () => {
    rowOf('18:14').click();
    refresh();
    expect(el.querySelector('tr.detail')?.textContent).toContain('no tiene detalle por repetición');
    expect(f.componentInstance.fpsOf(history.sets()[2])).toBe('?');
  });

  it('corrects the load of a set', () => {
    rowOf('18:14').click();
    refresh();
    const input = el.querySelector<HTMLInputElement>('.edit-load input')!;
    expect(input.value).toBe('0');
    input.value = '7.5';
    input.dispatchEvent(new Event('change'));
    refresh();
    expect(history.sets().find((s) => s.id === 's3')!.loadKg).toBe(7.5);
    expect(cells(rowOf('18:14'))[1]).toBe('+7,5 kg');
    f.componentInstance.setLoad(history.sets()[2], '12,5');
    expect(history.sets()[2].loadKg).toBe(12.5);
    f.componentInstance.setLoad(history.sets()[2], 'abc');
    expect(history.sets()[2].loadKg).toBeUndefined();
    f.componentInstance.setLoad(history.sets()[2], '9999');
    expect(history.sets()[2].loadKg).toBe(500);
  });

  it('plays the set video in a popup and closes it', () => {
    mockObjectUrls();
    mockMediaElements();
    // Only sets whose video still exists have a play button.
    expect(rowOf('18:30').querySelector('[aria-label="Ver vídeo de la serie"]')).toBeNull();
    rowOf('18:10').querySelector<HTMLButtonElement>('[aria-label="Ver vídeo de la serie"]')!.click();
    refresh();
    expect(el.querySelector('tr.detail')).toBeNull(); // the click does not expand the row
    expect(el.querySelector('.modal app-recording-player')).not.toBeNull();
    expect(el.querySelector('.modal-head b')?.textContent).toContain('+20 kg');
    expect(document.body.style.overflow).toBe('hidden');
    expect(f.componentInstance.playing()?.set.videoOffsetSec).toBe(12);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    refresh();
    expect(el.querySelector('.modal')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  it('closes the popup by clicking outside, not inside', () => {
    mockObjectUrls();
    mockMediaElements();
    f.componentInstance.play(history.sets()[1]);
    refresh();
    el.querySelector<HTMLElement>('.modal')!.click();
    refresh();
    expect(el.querySelector('.modal')).not.toBeNull();
    el.querySelector<HTMLElement>('.modal-backdrop')!.click();
    refresh();
    expect(el.querySelector('.modal')).toBeNull();
  });

  it('does not open the popup if the video was deleted', () => {
    f.componentInstance.play(history.sets()[3]);
    expect(f.componentInstance.playing()).toBeNull();
  });

  it('deletes one set or everything after confirmation', () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    rowOf('18:14').querySelector<HTMLButtonElement>('[aria-label="Borrar serie"]')!.click();
    refresh();
    expect(history.sets().map((s) => s.id)).toEqual(['s1', 's2', 's4']);
    confirm.mockReturnValueOnce(false);
    el.querySelector<HTMLButtonElement>('.actions .danger')!.click();
    expect(history.sets()).toHaveLength(3);
    el.querySelector<HTMLButtonElement>('.actions .danger')!.click();
    refresh();
    expect(history.sets()).toEqual([]);
    expect(el.textContent).toContain('Todavía no hay series guardadas.');
  });

  it('exports the history as a JSON file', () => {
    mockObjectUrls();
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toMatch(/^trackbody-historial-\d{4}-\d{2}-\d{2}\.json$/);
    });
    el.querySelector<HTMLButtonElement>('.actions .btn:not(.danger)')!.click();
    expect(click).toHaveBeenCalled();
  });

  it('restores page scrolling when leaving with the popup open', () => {
    mockObjectUrls();
    mockMediaElements();
    f.componentInstance.play(history.sets()[1]);
    f.destroy();
    expect(document.body.style.overflow).toBe('');
  });
});
