import { Pt } from '../models/types';
import { FrameEval } from './analyzer';
import { CONNECTIONS } from './geometry';
import { RepPhase } from './rep-counter';

/** Skeleton colours for each state. */
export const COLORS = {
  idle: '#9aa4b2',
  ready: '#38bdf8',
  moving: '#fbbf24',
  depth: '#22c55e',
  fault: '#ff4d4f',
};

/** Skeleton colour: grey out of position, red on a fault, amber while moving, green at depth, blue when ready. */
export function poseColor(ev: FrameEval | null, phase: RepPhase): string {
  if (!ev?.ok || !ev.inPosition) return COLORS.idle;
  if (ev.faults.length) return COLORS.fault;
  if (phase === 'moving') return ev.bottom ? COLORS.depth : COLORS.moving;
  return COLORS.ready;
}

export interface PoseDrawOptions {
  color: string;
  minVisibility: number;
  /** Size unit relative to the video resolution. */
  scale: number;
  showAngle: boolean;
  /** Text is drawn in a mirrored context and must be flipped back. */
  mirrorText: boolean;
}

/** Draws the skeleton in video pixel coordinates. */
export function drawPose(ctx: CanvasRenderingContext2D, lm: Pt[], ev: FrameEval | null, o: PoseDrawOptions): void {
  const s = o.scale;
  ctx.lineWidth = 4 * s;
  ctx.strokeStyle = o.color;
  ctx.lineCap = 'round';
  for (const [a, b] of CONNECTIONS) {
    if (lm[a].v < o.minVisibility || lm[b].v < o.minVisibility) continue;
    ctx.beginPath();
    ctx.moveTo(lm[a].x, lm[a].y);
    ctx.lineTo(lm[b].x, lm[b].y);
    ctx.stroke();
  }
  ctx.fillStyle = '#fff';
  for (let i = 11; i < lm.length; i++) {
    if (lm[i].v < o.minVisibility) continue;
    ctx.beginPath();
    ctx.arc(lm[i].x, lm[i].y, 5 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  if (o.showAngle && ev?.ok && ev.joint) {
    const j = ev.joint;
    ctx.save();
    ctx.translate(j.x, j.y);
    if (o.mirrorText) ctx.scale(-1, 1);
    ctx.font = `bold ${22 * s}px system-ui, sans-serif`;
    ctx.fillStyle = o.color;
    ctx.strokeStyle = 'rgba(0,0,0,.7)';
    ctx.lineWidth = 4 * s;
    const label = `${Math.round(ev.angle)}°`;
    ctx.strokeText(label, 12 * s, -12 * s);
    ctx.fillText(label, 12 * s, -12 * s);
    ctx.restore();
  }
}

/** Everything the recorded video shows on top of the camera image. */
export interface HudState {
  title: string;
  valid: number;
  invalid: number;
  inSet: boolean;
  setNumber: number;
  restSec: number | null;
  toast: { ok: boolean; text: string; at: number } | null;
  banner: { title: string; detail: string; at: number } | null;
  hint: string;
  now: number;
}

/** How long a rep notification stays visible. */
export const TOAST_MS = 2500;
/** How long the end-of-set banner stays visible. */
export const BANNER_MS = 4500;

/** Draws counters and notifications (used for the recorded video). */
export function drawHud(ctx: CanvasRenderingContext2D, w: number, h: number, hud: HudState): void {
  const u = Math.min(w, h) / 360;
  ctx.save();
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(0,0,0,.8)';
  ctx.shadowBlur = 8 * u;

  // Counter
  ctx.globalAlpha = hud.inSet ? 1 : 0.5;
  ctx.fillStyle = '#fff';
  ctx.font = `800 ${64 * u}px system-ui, sans-serif`;
  ctx.fillText(String(hud.valid), 12 * u, 10 * u);
  const cw = ctx.measureText(String(hud.valid)).width;
  ctx.globalAlpha = 1;
  if (hud.invalid > 0) {
    ctx.fillStyle = COLORS.fault;
    ctx.font = `700 ${20 * u}px system-ui, sans-serif`;
    ctx.fillText(`✗ ${hud.invalid}`, 20 * u + cw, 46 * u);
  }
  ctx.shadowBlur = 0;

  // Set / rest pill
  const pill = hud.inSet
    ? { text: `Serie ${hud.setNumber}`, bg: COLORS.ready, fg: '#04121f' }
    : hud.restSec !== null
      ? { text: `Descanso ${clock(hud.restSec)}`, bg: '#f59e0b', fg: '#1f1300' }
      : { text: 'Esperando', bg: 'rgba(0,0,0,.6)', fg: '#fff' };
  ctx.font = `700 ${14 * u}px system-ui, sans-serif`;
  const pw = ctx.measureText(pill.text).width + 22 * u;
  box(ctx, w - pw - 12 * u, 12 * u, pw, 28 * u, 14 * u, pill.bg);
  ctx.fillStyle = pill.fg;
  ctx.textAlign = 'center';
  ctx.fillText(pill.text, w - pw / 2 - 12 * u, 19 * u);

  // Hint bar
  if (hud.hint) {
    box(ctx, 0, h - 30 * u, w, 30 * u, 0, 'rgba(0,0,0,.65)');
    ctx.fillStyle = '#fde68a';
    ctx.font = `600 ${13 * u}px system-ui, sans-serif`;
    fitText(ctx, hud.hint, w - 20 * u);
    ctx.fillText(hud.hint, w / 2, h - 22 * u);
  }

  // Rep toast
  if (hud.toast && hud.now - hud.toast.at < TOAST_MS) {
    ctx.globalAlpha = fade(hud.now - hud.toast.at, TOAST_MS);
    const text = `${hud.toast.ok ? '✓' : '✗'} ${hud.toast.text}`;
    ctx.font = `700 ${17 * u}px system-ui, sans-serif`;
    fitText(ctx, text, w * 0.85);
    const tw = ctx.measureText(text).width + 28 * u;
    box(ctx, (w - tw) / 2, h - 80 * u, tw, 34 * u, 10 * u, hud.toast.ok ? 'rgba(34,197,94,.92)' : 'rgba(255,77,79,.92)');
    ctx.fillStyle = hud.toast.ok ? '#03140a' : '#fff';
    ctx.fillText(text, w / 2, h - 71 * u);
    ctx.globalAlpha = 1;
  }

  // End-of-set banner
  if (hud.banner && hud.now - hud.banner.at < BANNER_MS) {
    ctx.globalAlpha = fade(hud.now - hud.banner.at, BANNER_MS);
    const bw = Math.min(w * 0.85, 300 * u);
    const bh = 76 * u;
    box(ctx, (w - bw) / 2, (h - bh) / 2, bw, bh, 14 * u, 'rgba(11,18,32,.88)', COLORS.ready);
    ctx.fillStyle = '#fff';
    ctx.font = `800 ${22 * u}px system-ui, sans-serif`;
    fitText(ctx, hud.banner.title, bw - 20 * u);
    ctx.fillText(hud.banner.title, w / 2, (h - bh) / 2 + 12 * u);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = `600 ${15 * u}px system-ui, sans-serif`;
    fitText(ctx, hud.banner.detail, bw - 20 * u);
    ctx.fillText(hud.banner.detail, w / 2, (h - bh) / 2 + 44 * u);
    ctx.globalAlpha = 1;
  }

  // Watermark
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,.6)';
  ctx.font = `600 ${10 * u}px system-ui, sans-serif`;
  const stamp = new Date(hud.now).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
  ctx.fillText(`TrackBody · ${hud.title} · ${stamp}`, w - 10 * u, h - (hud.hint ? 46 : 16) * u);
  ctx.restore();
}

/** Opacity of a notification: solid for 80% of its life, then fades out. */
function fade(age: number, total: number): number {
  const t = age / total;
  return t < 0.8 ? 1 : Math.max(0, 1 - (t - 0.8) / 0.2);
}

/** Seconds as m:ss. */
function clock(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

/** Shrinks the current font until the text fits. Leaves textAlign centered. */
function fitText(ctx: CanvasRenderingContext2D, text: string, max: number): void {
  ctx.textAlign = 'center';
  const m = /(\d+(?:\.\d+)?)px/.exec(ctx.font);
  if (!m) return;
  let size = parseFloat(m[1]);
  while (size > 8 && ctx.measureText(text).width > max) {
    size -= 1;
    ctx.font = ctx.font.replace(/\d+(?:\.\d+)?px/, `${size}px`);
  }
}

/** Filled (optionally outlined) rounded rectangle. */
function box(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string,
): void {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}
