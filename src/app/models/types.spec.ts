import { createAnalyzer } from '../analysis/analyzers';
import { EXERCISES, ExerciseId, FAULT_MESSAGES, FAULT_VOICE, PAUSE_LABELS } from './types';

const IDS: ExerciseId[] = ['squat', 'pushup', 'pullup'];

describe('models', () => {
  it('describes every exercise with a name, icon and placement tips', () => {
    expect(Object.keys(EXERCISES).sort()).toEqual([...IDS].sort());
    for (const id of IDS) {
      expect(EXERCISES[id].name).toBeTruthy();
      expect(EXERCISES[id].icon).toBeTruthy();
      expect(EXERCISES[id].tips.length).toBeGreaterThan(0);
    }
  });

  it('has a message for every fault the app can raise', () => {
    const faults = [
      'noDepth', 'noLockout', 'noStart', 'fastEccentric',
      'torsoLean', 'heelsUp', 'hipSag', 'hipPike', 'kneesBent', 'swing', 'kip',
      ...IDS.map((id) => createAnalyzer(id).noDepthFault),
    ];
    for (const f of faults) expect(FAULT_MESSAGES[f]).toBeTruthy();
  });

  it('only has voice phrases for known faults', () => {
    for (const f of Object.keys(FAULT_VOICE)) expect(FAULT_MESSAGES[f]).toBeTruthy();
  });

  it('names the pauses by where the joint is flexed', () => {
    expect(PAUSE_LABELS.squat.turn).toBe('Pausa abajo');
    expect(PAUSE_LABELS.pullup.turn).toBe('Pausa arriba');
    expect(PAUSE_LABELS.pullup.between).toBe('Pausa colgado');
  });
});
