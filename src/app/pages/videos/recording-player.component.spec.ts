import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RecordingMeta, VideoStoreService } from '../../services/video-store.service';
import { FakeVideoStore, fakeVideoStore, mockMediaElements, mockObjectUrls, recordingMeta, setProps } from '../../../testing/fakes';
import { RecordingPlayerComponent } from './recording-player.component';

const META = recordingMeta('r1', {
  sets: [
    { setId: 's1', index: 1, startSec: 3, endSec: 30, valid: 8, invalid: 0 },
    { setId: 's2', index: 2, startSec: 120, endSec: 150, valid: 6, invalid: 2 },
  ],
});

describe('RecordingPlayerComponent', () => {
  let store: FakeVideoStore;
  let f: ComponentFixture<RecordingPlayerComponent>;
  let urls: ReturnType<typeof mockObjectUrls>;
  let media: ReturnType<typeof mockMediaElements>;

  beforeEach(() => {
    store = fakeVideoStore();
    urls = mockObjectUrls();
    media = mockMediaElements();
    TestBed.configureTestingModule({ providers: [{ provide: VideoStoreService, useValue: store }] });
  });

  afterEach(() => jest.restoreAllMocks());

  const render = async (meta: RecordingMeta = META, inputs: Record<string, unknown> = {}) => {
    f = TestBed.createComponent(RecordingPlayerComponent);
    f.componentRef.setInput('meta', meta);
    for (const [k, v] of Object.entries(inputs)) f.componentRef.setInput(k, v);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    return f.nativeElement as HTMLElement;
  };
  const video = () => f.nativeElement.querySelector('video') as HTMLVideoElement;

  it('loads the recording into the video element', async () => {
    const el = await render();
    expect(store.getBlob).toHaveBeenCalledWith(META);
    expect(video().getAttribute('src')).toBe('blob:fake/1');
    expect(el.textContent).toContain('⬇ Descargar');
  });

  it('lists one chapter per set', async () => {
    const el = await render();
    const chapters = [...el.querySelectorAll('.chap')].map((c) => [...c.children].map((x) => x.textContent?.trim()).join(' | '));
    expect(chapters).toEqual(['Serie 1 | 8 ✓ | 0:03', 'Serie 2 | 6 ✓ | 2 ✗ | 2:00']);
  });

  it('jumps to a set and plays', async () => {
    const el = await render();
    el.querySelectorAll<HTMLButtonElement>('.chap')[1].click();
    expect(video().currentTime).toBe(120);
    expect(media.play).toHaveBeenCalled();
  });

  it('highlights the set being played', async () => {
    const el = await render();
    video().currentTime = 125;
    video().dispatchEvent(new Event('timeupdate'));
    f.detectChanges();
    expect(el.querySelector('.chap.active')?.textContent).toContain('Serie 2');
    expect(f.componentInstance.current()).toBe('s2');
  });

  it('starts at the requested second and autoplays once loaded', async () => {
    await render(META, { startAt: 120, autoplay: true });
    setProps(video(), { duration: 200 });
    video().dispatchEvent(new Event('loadedmetadata'));
    expect(video().currentTime).toBe(120);
    expect(media.play).toHaveBeenCalled();
  });

  it('fixes the unknown duration of recorded WebM files before seeking', async () => {
    await render(META, { startAt: 3 });
    const v = video();
    setProps(v, { duration: Infinity });
    v.dispatchEvent(new Event('loadedmetadata'));
    expect(v.currentTime).toBe(1e9);
    // While fixing, time updates are ignored.
    v.dispatchEvent(new Event('timeupdate'));
    expect(f.componentInstance.time()).toBe(0);
    setProps(v, { duration: 200 });
    v.dispatchEvent(new Event('durationchange'));
    expect(v.currentTime).toBe(3);
  });

  it('reports an empty or unreadable video', async () => {
    store.getBlob.mockResolvedValueOnce(new Blob([]));
    expect((await render()).textContent).toContain('El vídeo está vacío.');
    store.getBlob.mockRejectedValueOnce(new Error('db closed'));
    expect((await render(recordingMeta('r2'))).textContent).toContain('No se pudo cargar el vídeo: db closed');
  });

  it('loads the new video when the input changes and frees the old one', async () => {
    await render();
    f.componentRef.setInput('meta', recordingMeta('r2'));
    f.detectChanges();
    await f.whenStable();
    expect(store.getBlob).toHaveBeenCalledTimes(2);
    expect(urls.revoke).toHaveBeenCalledWith('blob:fake/1');
  });

  it('downloads the loaded video without reading it again', async () => {
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const el = await render();
    [...el.querySelectorAll<HTMLButtonElement>('.btn')].find((b) => b.textContent?.includes('Descargar'))!.click();
    await f.whenStable();
    expect(click).toHaveBeenCalled();
    expect(store.getBlob).toHaveBeenCalledTimes(1);
  });

  it('frees the video memory when destroyed', async () => {
    await render();
    f.destroy();
    expect(urls.revoke).toHaveBeenCalledWith('blob:fake/1');
  });
});
