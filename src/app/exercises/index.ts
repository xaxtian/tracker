/**
 * Exercise registry: the one list of exercises in the app.
 *
 * To add an exercise, write a module like `dips.ts` (analyzer + settings +
 * texts) and add it to `EXERCISE_MODULES`. Pages, settings, history, faults and
 * velocity all pick it up from here.
 */
import type { Analyzer } from '../analysis/analyzer';
import type { EccentricRule } from '../models/types';
import { COMMON_FAULTS } from './common';
import { curl, curlSingle } from './curl';
import { dips } from './dips';
import { CATEGORY_ORDER, ExerciseCategory, ExerciseModule } from './exercise';
import { hspu } from './hspu';
import { legRaise } from './leg-raise';
import { pike } from './pike';
import { pullup } from './pullup';
import { pushup } from './pushup';
import { row } from './row';
import { squat } from './squat';

/** Every exercise, in display order within each category. */
export const EXERCISE_MODULES = [squat, pushup, dips, pike, hspu, pullup, row, curl, curlSingle, legRaise] as const;

type AnyModule = (typeof EXERCISE_MODULES)[number];

/** Id of any registered exercise. */
export type ExerciseId = AnyModule['id'];

/** Settings of every exercise, keyed by id (part of `AppSettings`). */
export type ExerciseSettingsMap = { [M in AnyModule as M['id']]: M['defaults'] };

/** A module seen generically, for code that works with any exercise. */
export type Exercise = ExerciseModule<ExerciseId, EccentricRule>;

const BY_ID = new Map<string, Exercise>(EXERCISE_MODULES.map((m) => [m.id, m as unknown as Exercise]));

/** Ids of every exercise, in registry order. */
export const EXERCISE_IDS: ExerciseId[] = EXERCISE_MODULES.map((m) => m.id);

/** True when `id` is a registered exercise. */
export function isExerciseId(id: string | null | undefined): id is ExerciseId {
  return !!id && BY_ID.has(id);
}

/** The module of an exercise. */
export function getExercise(id: ExerciseId): Exercise {
  return BY_ID.get(id)!;
}

/** Creates the analyzer of an exercise. */
export function createAnalyzer(id: ExerciseId): Analyzer<EccentricRule> {
  return getExercise(id).createAnalyzer();
}

/** Display name, icon and camera tips of every exercise, by id. */
export const EXERCISES = Object.fromEntries(EXERCISE_MODULES.map((m) => [m.id, m])) as unknown as Record<ExerciseId, Exercise>;

/** Exercises grouped by category, in display order. Empty categories are left out. */
export const EXERCISES_BY_CATEGORY: { category: ExerciseCategory; exercises: Exercise[] }[] = CATEGORY_ORDER
  .map((category) => ({ category, exercises: EXERCISE_IDS.map(getExercise).filter((m) => m.category === category) }))
  .filter((g) => g.exercises.length > 0);

/**
 * Default settings of every exercise. Each gets its own copy: modules may share
 * a defaults object (both curls do), and their settings must stay independent.
 */
export const EXERCISE_DEFAULTS = Object.fromEntries(EXERCISE_MODULES.map((m) => [m.id, { ...m.defaults }])) as ExerciseSettingsMap;

const ALL_FAULTS = Object.assign({}, COMMON_FAULTS, ...EXERCISE_MODULES.map((m) => m.faults as Record<string, unknown>)) as typeof COMMON_FAULTS;

/** On-screen explanation of every fault id. */
export const FAULT_MESSAGES: Record<string, string> = Object.fromEntries(
  Object.entries(ALL_FAULTS).map(([id, f]) => [id, f.message]),
);

/** Short spoken phrase of every fault id. */
export const FAULT_VOICE: Record<string, string> = Object.fromEntries(
  Object.entries(ALL_FAULTS).map(([id, f]) => [id, f.voice]),
);

/** Names of the two pauses of each exercise, which depend on where the joint is flexed. */
export const PAUSE_LABELS = Object.fromEntries(EXERCISE_MODULES.map((m) => [m.id, m.pauseLabels])) as Record<
  ExerciseId,
  { turn: string; between: string }
>;

/** Trained side of a unilateral set, e.g. "brazo izquierdo"; empty for other exercises. */
export function sideLabel(id: ExerciseId, side: 'L' | 'R' | undefined): string {
  const limb = getExercise(id).unilateral?.limb;
  if (!limb || !side) return '';
  const feminine = limb === 'pierna';
  return `${limb} ${side === 'L' ? (feminine ? 'izquierda' : 'izquierdo') : feminine ? 'derecha' : 'derecho'}`;
}
