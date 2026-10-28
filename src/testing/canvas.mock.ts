/** Records the drawing calls made on a 2D canvas context (jsdom has no canvas). */
export interface MockCtx extends CanvasRenderingContext2D {
  texts: string[];
  /** Font size (px) in use when each text was drawn. */
  sizes: Record<string, number>;
}

export function createMockCtx(): MockCtx {
  const texts: string[] = [];
  const sizes: Record<string, number> = {};
  const fns = [
    'beginPath', 'moveTo', 'lineTo', 'stroke', 'arc', 'fill', 'save', 'restore', 'translate', 'scale',
    'strokeText', 'rect', 'roundRect', 'fillRect', 'clearRect', 'drawImage',
  ];
  const ctx: Record<string, unknown> = {
    texts,
    sizes,
    font: '10px sans-serif',
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    lineCap: 'butt',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    shadowColor: '',
    shadowBlur: 0,
    fillText: jest.fn((t: string) => {
      texts.push(t);
      sizes[t] = parseFloat(/(\d+(?:\.\d+)?)px/.exec(ctx['font'] as string)?.[1] ?? '0');
    }),
    // Width grows with text length and font size, so fitText() can be exercised.
    measureText: jest.fn((t: string) => {
      const px = parseFloat(/(\d+(?:\.\d+)?)px/.exec(ctx['font'] as string)?.[1] ?? '10');
      return { width: t.length * px * 0.5 } as TextMetrics;
    }),
  };
  for (const f of fns) ctx[f] = jest.fn();
  return ctx as unknown as MockCtx;
}

/** Makes every <canvas> return the same mock context. */
export function mockCanvas(ctx: MockCtx = createMockCtx()): MockCtx {
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ctx as never);
  return ctx;
}
