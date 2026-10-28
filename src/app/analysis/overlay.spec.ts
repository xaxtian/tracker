import { createMockCtx } from '../../testing/canvas.mock';
import { landmarks } from '../../testing/landmarks';
import { evalFor } from '../../testing/motion';
import { BANNER_MS, COLORS, HudState, TOAST_MS, drawHud, drawPose, poseColor } from './overlay';

describe('poseColor', () => {
  it('is grey when the person is not analyzable or out of position', () => {
    expect(poseColor(null, 'top')).toBe(COLORS.idle);
    expect(poseColor(evalFor(170, { ok: false }), 'top')).toBe(COLORS.idle);
    expect(poseColor(evalFor(170, { inPosition: false }), 'top')).toBe(COLORS.idle);
  });
  it('is red on a technique fault', () => {
    expect(poseColor(evalFor(120, { faults: ['hipSag'] }), 'moving')).toBe(COLORS.fault);
  });
  it('is amber while moving and green once depth is reached', () => {
    expect(poseColor(evalFor(120), 'moving')).toBe(COLORS.moving);
    expect(poseColor(evalFor(80), 'moving')).toBe(COLORS.depth);
  });
  it('is blue when ready at the top', () => {
    expect(poseColor(evalFor(175), 'top')).toBe(COLORS.ready);
  });
});

describe('drawPose', () => {
  const opts = { color: '#fff', minVisibility: 0.5, scale: 1, showAngle: true, mirrorText: false };
  const lm = landmarks({ 11: [0, 0], 13: [0, 10], 15: [0, 20], 23: [10, 0] });

  it('draws only the bones whose both ends are visible', () => {
    const ctx = createMockCtx();
    drawPose(ctx, lm, null, opts);
    // 11-13, 13-15, 11-23 are visible
    expect(ctx.lineTo).toHaveBeenCalledTimes(3);
    // one dot per visible body landmark (index ≥ 11)
    expect(ctx.arc).toHaveBeenCalledTimes(4);
  });

  it('writes the joint angle next to the joint', () => {
    const ctx = createMockCtx();
    drawPose(ctx, lm, evalFor(92.6, { joint: { x: 5, y: 5, v: 1 } }), opts);
    expect(ctx.texts).toContain('93°');
    expect(ctx.translate).toHaveBeenCalledWith(5, 5);
    expect(ctx.scale).not.toHaveBeenCalled();
  });

  it('flips the label back when the canvas is mirrored', () => {
    const ctx = createMockCtx();
    drawPose(ctx, lm, evalFor(90, { joint: { x: 5, y: 5, v: 1 } }), { ...opts, mirrorText: true });
    expect(ctx.scale).toHaveBeenCalledWith(-1, 1);
  });

  it('hides the angle when disabled', () => {
    const ctx = createMockCtx();
    drawPose(ctx, lm, evalFor(90, { joint: { x: 5, y: 5, v: 1 } }), { ...opts, showAngle: false });
    expect(ctx.texts).toEqual([]);
  });
});

describe('drawHud', () => {
  const NOW = new Date(2026, 9, 28, 18, 30).getTime();
  const hud = (o: Partial<HudState> = {}): HudState => ({
    title: 'Sentadillas', valid: 7, invalid: 0, inSet: true, setNumber: 2, restSec: null,
    toast: null, banner: null, hint: '', now: NOW, ...o,
  });
  const draw = (o: Partial<HudState> = {}) => {
    const ctx = createMockCtx();
    drawHud(ctx, 1280, 720, hud(o));
    return ctx.texts;
  };

  it('draws the counter, the set pill and a watermark', () => {
    const texts = draw();
    expect(texts).toContain('7');
    expect(texts).toContain('Serie 2');
    expect(texts.some((t) => t.startsWith('TrackBody · Sentadillas · '))).toBe(true);
  });

  it('shows invalid reps', () => {
    expect(draw({ invalid: 3 })).toContain('✗ 3');
    expect(draw({ invalid: 0 })).not.toContain('✗ 0');
  });

  it('shows the rest clock between sets and "Esperando" before the first one', () => {
    expect(draw({ inSet: false, restSec: 65 })).toContain('Descanso 1:05');
    expect(draw({ inSet: false, restSec: null })).toContain('Esperando');
  });

  it('shows a rep toast only while it is fresh', () => {
    const toast = { ok: true, text: 'Repetición 7', at: NOW - 100 };
    expect(draw({ toast })).toContain('✓ Repetición 7');
    expect(draw({ toast: { ...toast, ok: false, text: 'Cadera caída' } })).toContain('✗ Cadera caída');
    expect(draw({ toast: { ...toast, at: NOW - TOAST_MS - 1 } })).not.toContain('✓ Repetición 7');
  });

  it('shows the end-of-set banner only while it is fresh', () => {
    const banner = { title: 'Serie 2 terminada', detail: '7 válidas', at: NOW - 200 };
    expect(draw({ banner })).toEqual(expect.arrayContaining(['Serie 2 terminada', '7 válidas']));
    expect(draw({ banner: { ...banner, at: NOW - BANNER_MS - 1 } })).not.toContain('Serie 2 terminada');
  });

  it('shows the hint bar', () => {
    expect(draw({ hint: 'No te veo' })).toContain('No te veo');
  });

  it('shrinks long texts to fit', () => {
    const ctx = createMockCtx();
    const u = 720 / 360;
    drawHud(ctx, 1280, 720, hud({ hint: 'x'.repeat(200), banner: { title: 'Corto', detail: 'y'.repeat(200), at: NOW } }));
    expect(ctx.sizes['x'.repeat(200)]).toBeLessThan(13 * u);
    expect(ctx.sizes['y'.repeat(200)]).toBeLessThan(15 * u);
    expect(ctx.sizes['Corto']).toBeCloseTo(22 * u);
  });

  it('falls back to rect() when roundRect is unavailable', () => {
    const ctx = createMockCtx();
    (ctx as unknown as { roundRect?: unknown }).roundRect = undefined;
    drawHud(ctx, 640, 360, hud());
    expect(ctx.rect).toHaveBeenCalled();
  });
});
