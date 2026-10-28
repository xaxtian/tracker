import { Injectable, signal } from '@angular/core';
import { EXERCISE_DEFAULTS } from '../exercises';
import { AppSettings, SettingsSection } from '../models/types';

/** Factory values of every setting: the general ones plus the defaults of every exercise module. */
export const DEFAULT_SETTINGS: AppSettings = {
  general: {
    restTimeoutSec: 10,
    offPositionSec: 2,
    minVisibility: 0.5,
    faultFrames: 3,
    minRange: 30,
    smoothing: 0.4,
    voice: true,
    beep: true,
    showAngles: true,
    autoRecord: false,
    highFps: true,
    userHeightCm: 175,
    model: 'full',
  },
  // One section per exercise, with the defaults declared in its module.
  ...EXERCISE_DEFAULTS,
};

/** localStorage key of the settings. */
const KEY = 'trackbody.settings';

/** User settings, kept in a signal and saved to localStorage on every change. */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  /** Current settings. */
  readonly settings = signal<AppSettings>(this.load());

  /** Changes one setting and saves. */
  update<S extends SettingsSection>(section: S, key: keyof AppSettings[S], value: unknown): void {
    this.settings.update((s) => ({ ...s, [section]: { ...s[section], [key]: value } }));
    this.save();
  }

  /** Restores the defaults of one section. */
  resetSection(section: SettingsSection): void {
    this.settings.update((s) => ({ ...s, [section]: structuredClone(DEFAULT_SETTINGS[section]) }));
    this.save();
  }

  /** Saved settings merged over the defaults, so settings added later get their default. */
  private load(): AppSettings {
    const base = structuredClone(DEFAULT_SETTINGS);
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return base;
      const saved = JSON.parse(raw) as Partial<AppSettings>;
      // Merge so new settings added in later versions get their defaults.
      for (const k of Object.keys(base) as SettingsSection[]) {
        Object.assign(base[k], saved[k] ?? {});
      }
    } catch {
      /* ignore corrupt storage */
    }
    return base;
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.settings()));
    } catch {
      /* storage unavailable */
    }
  }
}
