/** Minimal MediaRecorder: emit() simulates a chunk; stop() flushes one last chunk. */
export class FakeMediaRecorder {
  static supported = ['video/webm;codecs=vp9', 'video/webm'];
  static isTypeSupported = (m: string) => FakeMediaRecorder.supported.includes(m);
  static last: FakeMediaRecorder;
  state: 'inactive' | 'recording' = 'inactive';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  start = jest.fn(() => (this.state = 'recording'));
  constructor(readonly stream: unknown, readonly options: { mimeType?: string; videoBitsPerSecond: number }) {
    FakeMediaRecorder.last = this;
  }
  get mimeType() {
    return this.options.mimeType ?? '';
  }
  emit(text: string) {
    this.ondataavailable?.({ data: new Blob([text]) });
  }
  stop() {
    this.emit('end');
    this.state = 'inactive';
    setTimeout(() => this.onstop?.());
  }
}

/** Installs MediaRecorder and canvas.captureStream. Returns a cleanup function. */
export function installMediaRecorder(): () => void {
  const g = globalThis as Record<string, unknown>;
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  g['MediaRecorder'] = FakeMediaRecorder;
  proto['captureStream'] = jest.fn(() => ({ id: 'stream' }));
  return () => {
    delete g['MediaRecorder'];
    delete proto['captureStream'];
  };
}
