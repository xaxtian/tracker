import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { VideoStoreService } from '../../services/video-store.service';
import { FakeVideoStore, fakeVideoStore, mockMediaElements, mockObjectUrls, recordingMeta } from '../../../testing/fakes';
import { VideoPlayerComponent } from './video-player.component';

describe('VideoPlayerComponent', () => {
  let store: FakeVideoStore;

  const setup = (id: string, t?: string) => {
    store = fakeVideoStore([recordingMeta('r1', { exercise: 'pushup' })]);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: VideoStoreService, useValue: store },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id }), queryParamMap: convertToParamMap(t ? { t } : {}) } },
        },
      ],
    });
  };

  const render = async () => {
    const f = TestBed.createComponent(VideoPlayerComponent);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    return { f, el: f.nativeElement as HTMLElement };
  };

  beforeEach(() => {
    mockObjectUrls();
    mockMediaElements();
  });
  afterEach(() => jest.restoreAllMocks());

  it('shows the recording from the URL', async () => {
    setup('r1');
    const { el, f } = await render();
    expect(el.querySelector('h1')?.textContent).toBe('💪 Flexiones');
    expect(el.querySelector('app-recording-player')).not.toBeNull();
    expect(f.componentInstance.startAt).toBe(0);
  });

  it('reads the start second from ?t=', async () => {
    setup('r1', '42');
    const { f } = await render();
    expect(f.componentInstance.startAt).toBe(42);
  });

  it('says so when the video no longer exists', async () => {
    setup('missing');
    const { el } = await render();
    expect(el.querySelector('h1')?.textContent).toBe('Vídeo');
    expect(el.textContent).toContain('Este vídeo ya no existe.');
  });

  it('deletes the video and goes back to the list', async () => {
    setup('r1');
    const { el, f } = await render();
    const nav = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    el.querySelector<HTMLButtonElement>('.btn.danger')!.click();
    await f.whenStable();
    expect(confirm).toHaveBeenCalled();
    expect(store.remove).toHaveBeenCalledWith('r1');
    expect(nav).toHaveBeenCalledWith(['/videos']);
  });

  it('keeps the video if deletion is cancelled', async () => {
    setup('r1');
    const { f } = await render();
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    await f.componentInstance.remove(recordingMeta('r1'));
    expect(store.remove).not.toHaveBeenCalled();
  });
});
