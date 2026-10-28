import { RepCounter } from '../analysis/rep-counter';
import { Pt, RepResult } from '../models/types';
import { DEFAULT_SETTINGS } from '../services/settings.service';
import { landmarks, pullupPose, pushupPose, squatPose } from '../../testing/landmarks';
import { Exercise, ExerciseId, getExercise } from '.';

/**
 * One full rep per exercise, end to end: landmarks → analyzer → rep counter.
 * Each case gives the extended pose and the pose at the goal of the rep; the
 * frames in between are interpolated with a smooth profile.
 */
type PoseAt = (k: number) => Pt[];
type Case = [ExerciseId, Pt[], Pt[]] | [ExerciseId, PoseAt];

/** Side-view curl: forearm (110 px) rotated from hanging (k = 0) to 45° at the elbow (k = 1). */
function curlPose(side: 'L' | 'R', k: number): Pt[] {
  const a = (135 * k * Math.PI) / 180;
  const [sh, el, wr, hip] = side === 'L' ? [11, 13, 15, 23] : [12, 14, 16, 24];
  return landmarks({ [sh]: [300, 200], [el]: [300, 320], [wr]: [300 + 110 * Math.sin(a), 320 + 110 * Math.cos(a)], [hip]: [305, 420] });
}

const CASES: Case[] = [
  ['squat', squatPose(175), squatPose(35)],
  ['pushup', pushupPose(), pushupPose({ elbow: 'bent' })],
  [
    'dips',
    landmarks({ 11: [300, 200], 13: [300, 280], 15: [300, 360], 23: [310, 400], 25: [320, 520], 27: [330, 640] }),
    landmarks({ 11: [220, 285], 13: [300, 280], 15: [300, 360], 23: [240, 480], 25: [250, 600], 27: [260, 720] }),
  ],
  [
    'pike',
    landmarks({ 0: [185, 480], 11: [210, 440], 13: [205, 520], 15: [200, 600], 23: [350, 330], 25: [420, 465], 27: [490, 600] }),
    landmarks({ 0: [175, 570], 11: [195, 505], 13: [255, 555], 15: [200, 600], 23: [350, 330], 25: [420, 465], 27: [490, 600] }),
  ],
  [
    'hspu',
    landmarks({ 0: [320, 490], 11: [300, 440], 13: [300, 520], 15: [300, 600], 23: [305, 240], 25: [305, 120], 27: [305, 20] }),
    landmarks({ 0: [330, 575], 11: [310, 515], 13: [250, 560], 15: [300, 600], 23: [315, 315], 25: [318, 200], 27: [320, 95] }),
  ],
  ['pullup', pullupPose('hang'), pullupPose('top')],
  [
    'row',
    landmarks({ 11: [300, 360], 13: [300, 280], 15: [300, 200], 23: [500, 400], 25: [650, 430], 27: [800, 460] }),
    landmarks({ 11: [310, 235], 13: [250, 280], 15: [300, 200], 23: [510, 280], 25: [655, 320], 27: [800, 360] }),
  ],
  // Curls rotate a rigid forearm instead of interpolating the wrist in a straight line.
  ['curl', (k: number) => curlPose('L', k)],
  ['curlSingle', (k: number) => curlPose('R', k)],
  [
    'legRaise',
    landmarks({ 15: [300, 100], 11: [300, 200], 23: [305, 420], 25: [305, 560], 27: [305, 700] }),
    landmarks({ 15: [300, 100], 11: [300, 200], 23: [305, 420], 25: [445, 410], 27: [585, 400] }),
  ],
];

const smooth = (x: number) => x * x * (3 - 2 * x);
const lerp = (a: Pt[], b: Pt[], k: number): Pt[] =>
  a.map((p, i) => ({ x: p.x + (b[i].x - p.x) * k, y: p.y + (b[i].y - p.y) * k, v: Math.min(p.v, b[i].v) }));

/** How far into the movement (0 = extended, 1 = goal) at time t (s). */
function progress(t: number): number {
  if (t < 1) return 0;
  if (t < 2.5) return smooth((t - 1) / 1.5);
  if (t < 2.8) return 1;
  if (t < 3.8) return 1 - smooth((t - 2.8) / 1);
  return 0;
}

/** A pose function for a case: interpolated between its two poses, or its own function. */
const poseOf = (c: Case): PoseAt => (c.length === 2 ? c[1] : (k: number) => lerp(c[1], c[2], k));

function run(m: Exercise, poseAt: PoseAt, until = 1): { reps: RepResult[]; side?: string } {
  const s = DEFAULT_SETTINGS;
  const analyzer = m.createAnalyzer();
  const counter = new RepCounter(analyzer);
  const opts = { minRange: s.general.minRange, faultFrames: s.general.faultFrames, minEccentricSec: null, heightM: 1.75 };
  const reps: RepResult[] = [];
  let side: string | undefined;
  for (let i = 0; i <= 30 * 5; i++) {
    const t = i / 30;
    const lm = poseAt(progress(t) * until);
    const ev = analyzer.evaluate(lm, s[m.id], s.general);
    side = ev.side ?? side;
    const r = counter.update(ev, lm, 1e12 + t * 1000, opts);
    if (r) reps.push(r);
  }
  return { reps, side };
}

describe('one full rep of every exercise', () => {
  it.each(CASES.map((c) => [c[0], c] as const))('%s counts one strict rep and times it', (id, c) => {
    const { reps } = run(getExercise(id), poseOf(c));
    expect(reps).toHaveLength(1);
    expect(reps[0].reasons).toEqual([]);
    expect(reps[0].valid).toBe(true);
    // Flexing takes 1.5 s and extending 1 s; which one is eccentric depends on the exercise.
    const flexIsEccentric = getExercise(id).createAnalyzer().flexIsEccentric;
    const t = reps[0].tempo!;
    expect(flexIsEccentric ? t.eccentricSec : t.concentricSec).toBeGreaterThan(1.1);
    expect(flexIsEccentric ? t.concentricSec : t.eccentricSec).toBeLessThan(1.1);
  });

  it.each(CASES.map((c) => [c[0], c] as const))('%s does not count a half rep', (id, c) => {
    const { reps } = run(getExercise(id), poseOf(c), 0.55);
    // Either too small to be an attempt, or an attempt without depth.
    for (const r of reps) expect(r.valid).toBe(false);
  });

  it('reports the trained side of the unilateral curl', () => {
    const c = CASES.find(([id]) => id === 'curlSingle')!;
    expect(run(getExercise('curlSingle'), poseOf(c)).side).toBe('R');
  });
});
