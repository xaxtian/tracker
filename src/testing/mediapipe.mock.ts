/**
 * Stand-in for `@mediapipe/tasks-vision` in unit tests (the real package loads
 * WASM and a GPU context, which jsdom cannot provide).
 */
export const FilesetResolver = {
  forVisionTasks: jest.fn(async (path: string) => ({ wasmPath: path })),
};

export class PoseLandmarker {
  static createFromOptions = jest.fn(async (_fileset: unknown, options: unknown) => new PoseLandmarker(options));
  detectForVideo = jest.fn((_video: unknown, _ts: number) => ({ landmarks: [] as unknown[] }));
  close = jest.fn();
  constructor(readonly options: unknown) {}
}

export type NormalizedLandmark = { x: number; y: number; z: number; visibility?: number };
