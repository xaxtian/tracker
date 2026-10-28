import {
  EXERCISES, EXERCISES_BY_CATEGORY, EXERCISE_DEFAULTS, EXERCISE_IDS, EXERCISE_MODULES, FAULT_MESSAGES, FAULT_VOICE,
  PAUSE_LABELS, createAnalyzer, getExercise, isExerciseId, sideLabel,
} from '.';
import { COMMON_FAULTS } from './common';
import { CATEGORY_ORDER, eccentricFields } from './exercise';

/**
 * Contract every exercise module must meet. A new module that forgets a
 * fault text, a default or a field fails here.
 */
describe('exercise registry', () => {
  it('has the ten exercises with unique ids', () => {
    expect(EXERCISE_IDS).toEqual(['squat', 'pushup', 'dips', 'pike', 'hspu', 'pullup', 'row', 'curl', 'curlSingle', 'legRaise']);
    expect(new Set(EXERCISE_IDS).size).toBe(EXERCISE_IDS.length);
  });

  it('looks exercises up by id', () => {
    expect(isExerciseId('dips')).toBe(true);
    expect(isExerciseId('burpees')).toBe(false);
    expect(isExerciseId(null)).toBe(false);
    expect(getExercise('row').name).toBe('Remo invertido');
    expect(EXERCISES.hspu.icon).toBe('🤸');
    expect(createAnalyzer('legRaise').noDepthFault).toBe('legRaiseNoDepth');
  });

  it('groups exercises by category in display order', () => {
    expect(EXERCISES_BY_CATEGORY.map((c) => c.category)).toEqual(CATEGORY_ORDER);
    expect(EXERCISES_BY_CATEGORY.flatMap((c) => c.exercises).length).toBe(EXERCISE_IDS.length);
  });

  describe.each(EXERCISE_MODULES.map((m) => [m.id, m] as const))('%s', (_id, m) => {
    const analyzer = m.createAnalyzer();

    it('has a name, icon, tips and hints', () => {
      expect(m.name).toBeTruthy();
      expect(m.icon).toBeTruthy();
      expect(m.tips.length).toBeGreaterThan(0);
      expect(m.hints.position).toBeTruthy();
      expect(m.hints.start).toBeTruthy();
      expect(m.pauseLabels.turn).toBeTruthy();
      expect(['inactivity', 'longInactivity', 'offPosition']).toContain(m.setEnd);
      expect(CATEGORY_ORDER).toContain(m.category);
    });

    it('explains its no-depth fault', () => {
      expect(FAULT_MESSAGES[analyzer.noDepthFault]).toBeTruthy();
      expect(m.faults[analyzer.noDepthFault]).toBeDefined();
    });

    it('has a default for every settings field, plus the eccentric rule', () => {
      const defaults = m.defaults as unknown as Record<string, unknown>;
      for (const f of [...m.fields, ...eccentricFields()]) {
        expect(defaults).toHaveProperty(f.key);
        if (f.type === 'range') {
          const v = defaults[f.key] as number;
          expect(v).toBeGreaterThanOrEqual(f.min!);
          expect(v).toBeLessThanOrEqual(f.max!);
        }
      }
      expect(m.defaults.checkEccentric).toBe(false);
    });

    it('has a voice phrase for each of its faults', () => {
      for (const id of Object.keys(m.faults)) expect(FAULT_VOICE[id]).toBeTruthy();
    });

    it('has pause labels in the lookup', () => {
      expect(PAUSE_LABELS[m.id]).toBe(m.pauseLabels);
    });
  });

  it('does not redefine a fault with a different text', () => {
    const seen = new Map<string, string>(Object.entries(COMMON_FAULTS).map(([k, v]) => [k, v.message]));
    for (const m of EXERCISE_MODULES) {
      for (const [id, f] of Object.entries(m.faults)) {
        if (seen.has(id)) expect(f.message).toBe(seen.get(id));
        seen.set(id, f.message);
      }
    }
  });

  it('gives every exercise its own copy of the defaults', () => {
    expect(EXERCISE_DEFAULTS.curl).toEqual(EXERCISE_DEFAULTS.curlSingle);
    expect(EXERCISE_DEFAULTS.curl).not.toBe(EXERCISE_DEFAULTS.curlSingle);
  });

  it('names the trained side of unilateral exercises only', () => {
    expect(sideLabel('curlSingle', 'L')).toBe('brazo izquierdo');
    expect(sideLabel('curlSingle', 'R')).toBe('brazo derecho');
    expect(sideLabel('curlSingle', undefined)).toBe('');
    expect(sideLabel('curl', 'L')).toBe('');
  });
});
