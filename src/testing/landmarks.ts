import { Pt } from '../app/models/types';

/** 33 MediaPipe landmarks, all invisible except the ones given. */
export function landmarks(points: Record<number, [number, number]>, v = 0.99): Pt[] {
  const lm: Pt[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, v: 0.05 }));
  for (const [i, [x, y]] of Object.entries(points)) lm[Number(i)] = { x, y, v };
  return lm;
}

const rad = (d: number) => (d * Math.PI) / 180;

/**
 * Side view of a squat (left side visible) for a given knee angle.
 * Pixel scale: 300 px per metre, person 1.75 m tall.
 */
export function squatPose(kneeAngle: number, torsoLean = 10): Pt[] {
  const H = 1.75, PX = 300;
  const SHANK = 0.246 * H, THIGH = 0.245 * H, TRUNK = 0.288 * H;
  const a = rad(0.35 * (180 - kneeAngle)), b = rad(0.65 * (180 - kneeAngle));
  const ankle = { x: 1.0, y: 2.0 };
  const knee = { x: ankle.x + SHANK * Math.sin(a), y: ankle.y - SHANK * Math.cos(a) };
  const hip = { x: knee.x - THIGH * Math.sin(b), y: knee.y - THIGH * Math.cos(b) };
  const lean = rad(torsoLean);
  const sh = { x: hip.x + TRUNK * Math.sin(lean), y: hip.y - TRUNK * Math.cos(lean) };
  const p = (q: { x: number; y: number }): [number, number] => [q.x * PX, q.y * PX];
  return landmarks({
    11: p(sh), 23: p(hip), 25: p(knee), 27: p(ankle),
    29: p({ x: ankle.x - 0.05, y: ankle.y + 0.03 }), 31: p({ x: ankle.x + 0.15, y: ankle.y + 0.03 }),
  });
}

/** Side view of a push-up plank (left side) with the given elbow angle. */
export function pushupPose(opts: { elbow?: 'straight' | 'bent'; hipDy?: number; kneeDy?: number } = {}): Pt[] {
  // Bent: about 53° at the elbow. Straight: 180°.
  const elbow: [number, number] = [100, 350];
  const wrist: [number, number] = opts.elbow === 'bent' ? [140, 320] : [100, 400];
  return landmarks({
    11: [100, 300], 13: elbow, 15: wrist,
    23: [300, 300 + (opts.hipDy ?? 0)], 25: [450, 300 + (opts.kneeDy ?? 0)], 27: [600, 300],
  });
}

/** Front view of a pull-up: hanging (arms straight) or at the top (chin over the bar). */
export function pullupPose(pos: 'hang' | 'top', opts: { hipDx?: number; kneeBend?: number } = {}): Pt[] {
  const dx = opts.hipDx ?? 0;
  const knee = opts.kneeBend ?? 0;
  if (pos === 'hang') {
    return landmarks({
      11: [260, 300], 12: [340, 300], 13: [245, 200], 14: [355, 200], 15: [240, 100], 16: [360, 100],
      9: [295, 250], 10: [305, 250],
      23: [270 + dx, 500], 24: [330 + dx, 500], 25: [270 + dx + knee, 650], 26: [330 + dx + knee, 650],
      27: [270 + dx, 800], 28: [330 + dx, 800],
    });
  }
  return landmarks({
    11: [260, 130], 12: [340, 130], 13: [200, 140], 14: [400, 140], 15: [240, 100], 16: [360, 100],
    9: [295, 80], 10: [305, 80],
    23: [270 + dx, 330], 24: [330 + dx, 330], 25: [270 + dx + knee, 480], 26: [330 + dx + knee, 480],
    27: [270 + dx, 630], 28: [330 + dx, 630],
  });
}
