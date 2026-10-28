import { TestBed } from '@angular/core/testing';
import { DEFAULT_SETTINGS, SettingsService } from './settings.service';

const KEY = 'trackbody.settings';
const create = () => TestBed.inject(SettingsService);

describe('SettingsService', () => {
  beforeEach(() => localStorage.clear());

  it('starts with the defaults', () => {
    expect(create().settings()).toEqual(DEFAULT_SETTINGS);
  });

  it('does not share objects with the defaults', () => {
    const svc = create();
    svc.update('squat', 'maxTorsoLean', 70);
    expect(DEFAULT_SETTINGS.squat.maxTorsoLean).toBe(50);
  });

  it('updates one value and saves it', () => {
    const svc = create();
    svc.update('pushup', 'bottomElbowAngle', 80);
    expect(svc.settings().pushup.bottomElbowAngle).toBe(80);
    expect(JSON.parse(localStorage.getItem(KEY)!).pushup.bottomElbowAngle).toBe(80);
  });

  it('loads saved values and fills in settings added later', () => {
    localStorage.setItem(KEY, JSON.stringify({ general: { userHeightCm: 190 }, squat: { checkHeels: true } }));
    const s = create().settings();
    expect(s.general.userHeightCm).toBe(190);
    expect(s.general.highFps).toBe(DEFAULT_SETTINGS.general.highFps);
    expect(s.squat.checkHeels).toBe(true);
    expect(s.pullup).toEqual(DEFAULT_SETTINGS.pullup);
  });

  it('ignores corrupt storage', () => {
    localStorage.setItem(KEY, '{not json');
    expect(create().settings()).toEqual(DEFAULT_SETTINGS);
  });

  it('resets one section only', () => {
    const svc = create();
    svc.update('squat', 'topKneeAngle', 150);
    svc.update('general', 'voice', false);
    svc.resetSection('squat');
    expect(svc.settings().squat).toEqual(DEFAULT_SETTINGS.squat);
    expect(svc.settings().general.voice).toBe(false);
  });

  it('keeps working when storage is unavailable', () => {
    const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    const svc = create();
    expect(() => svc.update('general', 'beep', false)).not.toThrow();
    expect(svc.settings().general.beep).toBe(false);
    spy.mockRestore();
  });
});
