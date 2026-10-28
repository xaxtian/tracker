import { TestBed } from '@angular/core/testing';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { PoseService } from './pose.service';

const create = PoseLandmarker.createFromOptions as unknown as jest.Mock;
const video = {} as HTMLVideoElement;

describe('PoseService', () => {
  beforeEach(() => {
    create.mockClear();
    (FilesetResolver.forVisionTasks as jest.Mock).mockClear();
  });

  it('returns nothing before the model is loaded', () => {
    expect(TestBed.inject(PoseService).detect(video, 1)).toBeNull();
  });

  it('loads the chosen model from the app assets, on the GPU, in video mode', async () => {
    await TestBed.inject(PoseService).init('lite');
    expect(FilesetResolver.forVisionTasks).toHaveBeenCalledWith(expect.stringMatching(/mediapipe\/wasm$/));
    const opts = create.mock.calls[0][1];
    expect(opts.baseOptions.modelAssetPath).toMatch(/models\/pose_landmarker_lite\.task$/);
    expect(opts.baseOptions.delegate).toBe('GPU');
    expect(opts.runningMode).toBe('VIDEO');
    expect(opts.numPoses).toBe(1);
  });

  it('falls back to the CPU when the GPU fails', async () => {
    create.mockRejectedValueOnce(new Error('no webgl'));
    await TestBed.inject(PoseService).init('full');
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][1].baseOptions.delegate).toBe('CPU');
  });

  it('does not reload the same model, and closes the old one on change', async () => {
    const svc = TestBed.inject(PoseService);
    await svc.init('full');
    await svc.init('full');
    expect(create).toHaveBeenCalledTimes(1);
    const first = (await create.mock.results[0].value) as PoseLandmarker;
    await svc.init('lite');
    expect(first.close).toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('returns the first person and forces increasing timestamps', async () => {
    const svc = TestBed.inject(PoseService);
    await svc.init('full');
    const lm = (await create.mock.results[0].value) as PoseLandmarker;
    const detect = lm.detectForVideo as jest.Mock;
    detect.mockReturnValue({ landmarks: [[{ x: 0.5, y: 0.5, z: 0 }]] });
    expect(svc.detect(video, 100)).toEqual([{ x: 0.5, y: 0.5, z: 0 }]);
    svc.detect(video, 100);
    svc.detect(video, 50);
    expect(detect.mock.calls.map((c) => c[1])).toEqual([100, 101, 102]);
    detect.mockReturnValue({ landmarks: [] });
    expect(svc.detect(video, 200)).toBeNull();
  });
});
