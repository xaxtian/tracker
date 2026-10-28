import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { VideoStoreService } from '../../services/video-store.service';
import { FakeVideoStore, fakeVideoStore, mockObjectUrls, recordingMeta } from '../../../testing/fakes';
import { VideosComponent } from './videos.component';

describe('VideosComponent', () => {
  let store: FakeVideoStore;
  const nav = navigator as unknown as Record<string, unknown>;

  beforeEach(() => {
    store = fakeVideoStore([
      recordingMeta('a', {
        exercise: 'pullup',
        sets: [
          { setId: 's1', index: 1, startSec: 0, endSec: 10, valid: 5, invalid: 0 },
          { setId: 's2', index: 2, startSec: 60, endSec: 70, valid: 4, invalid: 1 },
        ],
      }),
      recordingMeta('b', { size: 900 * 1024, durationSec: 30 }),
    ]);
    nav['storage'] = { estimate: jest.fn(async () => ({ usage: 50 * 1024 * 1024, quota: 2 * 1024 ** 3 })) };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: VideoStoreService, useValue: store }, { provide: LOCALE_ID, useValue: 'es' }],
    });
  });

  afterEach(() => {
    delete nav['storage'];
    jest.restoreAllMocks();
  });

  const render = async () => {
    const f = TestBed.createComponent(VideosComponent);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    return { f, el: f.nativeElement as HTMLElement };
  };

  it('lists recordings with their details', async () => {
    const { el } = await render();
    const items = [...el.querySelectorAll('.item')];
    expect(items).toHaveLength(2);
    const first = items[0].textContent!.replace(/\s+/g, ' ');
    expect(first).toContain('Dominadas');
    expect(first).toContain('2:05 · 5.0 MB');
    expect(first).toContain('2 series · 9 válidas');
    expect(items[1].textContent).toContain('0 series');
    expect(items[0].querySelector('a.main')?.getAttribute('href')).toBe('/videos/a');
    expect(store.refresh).toHaveBeenCalled();
  });

  it('shows how much space is used', async () => {
    const { el } = await render();
    expect(el.textContent).toContain('Espacio usado: 50.0 MB de 2.00 GB disponibles.');
  });

  it('explains how to record when there are no videos', async () => {
    store.recordings.set([]);
    const { el } = await render();
    expect(el.textContent).toContain('Aún no hay vídeos');
  });

  it('deletes a video after confirmation', async () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const { f, el } = await render();
    const del = () => el.querySelector<HTMLButtonElement>('[aria-label="Borrar"]')!.click();
    del();
    expect(store.remove).not.toHaveBeenCalled();
    del();
    expect(store.remove).toHaveBeenCalledWith('a');
    await f.whenStable();
    f.detectChanges();
    expect(el.querySelectorAll('.item')).toHaveLength(1);
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  it('downloads a video', async () => {
    mockObjectUrls();
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const { f, el } = await render();
    el.querySelector<HTMLButtonElement>('[aria-label="Descargar"]')!.click();
    await f.whenStable();
    expect(store.getBlob).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
    expect(click).toHaveBeenCalled();
  });
});
