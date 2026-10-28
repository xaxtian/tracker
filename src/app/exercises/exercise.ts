import type { Analyzer } from '../analysis/analyzer';
import type { EccentricRule } from '../models/types';

/** Group shown on the home page. */
export type ExerciseCategory = 'Piernas' | 'Empuje' | 'Tracción' | 'Brazos' | 'Core';

/** Display order of the categories. */
export const CATEGORY_ORDER: ExerciseCategory[] = ['Piernas', 'Empuje', 'Tracción', 'Brazos', 'Core'];

/**
 * How a set ends, besides leaving the position for `offPositionSec`:
 * - `inactivity`: also after `restTimeoutSec` without reps;
 * - `longInactivity`: also after three times `restTimeoutSec` (you can hold the position and rest);
 * - `offPosition`: only by leaving the position (getting off the bar).
 */
export type SetEndMode = 'inactivity' | 'longInactivity' | 'offPosition';

/** One control on the settings page. */
export interface SettingField<S = Record<string, unknown>> {
  /** Setting key inside the exercise settings. */
  key: Extract<keyof S, string>;
  /** Visible name. */
  label: string;
  /** Explanation under the control. */
  help: string;
  /** Slider, switch or drop-down. */
  type: 'range' | 'toggle' | 'select';
  min?: number;
  max?: number;
  step?: number;
  /** Unit after the value. `%` shows a ratio as a percentage. */
  unit?: string;
  options?: { value: string; label: string }[];
  /** Only show when this returns true (e.g. a tolerance only when its check is on). */
  when?(s: S): boolean;
}

/** On-screen message and short spoken phrase of a fault. */
export interface FaultText {
  message: string;
  voice: string;
}

/**
 * Everything the app needs to know about one exercise. Adding an exercise is
 * writing one of these and listing it in `EXERCISE_MODULES` (exercises/index.ts).
 */
export interface ExerciseModule<Id extends string = string, S extends EccentricRule = EccentricRule> {
  /** Stable id, stored in the history. Never change it once used. */
  id: Id;
  /** Display name. */
  name: string;
  icon: string;
  category: ExerciseCategory;
  /** Where the camera must be. */
  camera: 'side' | 'front';
  /** Camera placement tips shown before starting. */
  tips: string[];
  /** Hints shown when the person is not in position, or in position but not ready to start. */
  hints: { position: string; start: string };
  /** Names of the pause at the turnaround and of the pause between reps. */
  pauseLabels: { turn: string; between: string };
  /** How a set ends. */
  setEnd: SetEndMode;
  /** One limb at a time: each set records which side was trained. `limb` names it ("brazo", "pierna"). */
  unilateral?: { limb: 'brazo' | 'pierna' };
  /** Default settings. */
  defaults: S;
  /** Settings controls (the minimum eccentric time controls are added automatically). */
  fields: SettingField<S>[];
  /** Faults specific to this exercise, including its `noDepthFault`. */
  faults: Record<string, FaultText>;
  /** Creates the analyzer that implements the strictness criteria. */
  createAnalyzer(): Analyzer<S>;
}

/** Settings controls for the optional minimum eccentric time, shared by every exercise. */
export function eccentricFields<S extends EccentricRule>(): SettingField<S>[] {
  return [
    {
      key: 'checkEccentric' as Extract<keyof S, string>,
      label: 'Exigir bajada controlada',
      help: 'Invalida la repetición si la fase excéntrica (la bajada) dura menos del tiempo mínimo.',
      type: 'toggle',
    },
    {
      key: 'minEccentricSec' as Extract<keyof S, string>,
      label: 'Tiempo mínimo de bajada',
      help: 'Duración mínima de la fase excéntrica.',
      type: 'range', min: 0.3, max: 6, step: 0.1, unit: ' s',
      when: (s) => s.checkEccentric,
    },
  ];
}

/** Default values of the minimum eccentric time rule. */
export const ECCENTRIC_DEFAULTS: EccentricRule = { checkEccentric: false, minEccentricSec: 1.5 };
