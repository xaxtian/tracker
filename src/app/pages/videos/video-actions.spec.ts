import { VideoStoreService } from '../../services/video-store.service';
import { fakeVideoStore, mockObjectUrls, recordingMeta } from '../../../testing/fakes';
import { canShareFiles, downloadRecording, recordingFileName, shareRecording } from './video-actions';

type Nav = Record<string, unknown>;

describe('video actions', () => {
  const nav = navigator as unknown as Nav;
  let store: ReturnType<typeof fakeVideoStore>;
  const svc = () => store as unknown as VideoStoreService;

  beforeEach(() => {
    store = fakeVideoStore();
    mockObjectUrls();
  });

  afterEach(() => {
    delete nav['canShare'];
    delete nav['share'];
    jest.restoreAllMocks();
  });

  it('names the file after the exercise and the date', () => {
    expect(recordingFileName(recordingMeta('r', { exercise: 'pullup' }))).toBe('trackbody_dominadas_2026-10-28_18-05.webm');
    expect(recordingFileName(recordingMeta('r', { mime: 'video/mp4' }))).toMatch(/\.mp4$/);
  });

  it('downloads through a temporary link', async () => {
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('trackbody_sentadillas_2026-10-28_18-05.webm');
      expect(this.href).toBe('blob:fake/1');
      expect(document.body.contains(this)).toBe(true);
    });
    await downloadRecording(svc(), recordingMeta('r'));
    expect(store.getBlob).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('reuses an already loaded video', async () => {
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    await downloadRecording(svc(), recordingMeta('r'), new Blob(['x']));
    expect(store.getBlob).not.toHaveBeenCalled();
  });

  it('shares with the system sheet when files can be shared', async () => {
    nav['canShare'] = jest.fn(() => true);
    nav['share'] = jest.fn(async () => undefined);
    expect(await shareRecording(svc(), recordingMeta('r', { exercise: 'pushup' }))).toBe(true);
    const data = (nav['share'] as jest.Mock).mock.calls[0][0];
    expect(data.title).toBe('TrackBody · Flexiones');
    expect(data.files[0].name).toBe('trackbody_flexiones_2026-10-28_18-05.webm');
  });

  it('treats a cancelled share as done', async () => {
    nav['canShare'] = jest.fn(() => true);
    nav['share'] = jest.fn(async () => { throw new DOMException('cancel', 'AbortError'); });
    expect(await shareRecording(svc(), recordingMeta('r'))).toBe(true);
  });

  it('reports when sharing files is not possible', async () => {
    expect(canShareFiles()).toBe(false);
    expect(await shareRecording(svc(), recordingMeta('r'))).toBe(false);
    nav['canShare'] = () => { throw new Error('bad'); };
    expect(canShareFiles()).toBe(false);
    nav['canShare'] = () => true;
    expect(canShareFiles()).toBe(true);
  });
});
