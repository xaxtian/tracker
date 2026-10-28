import { Injectable, signal } from '@angular/core';
import { AppSettings, SettingsSection } from '../models/types';

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
    model: 'full',
  },
  squat: {
    topKneeAngle: 165,
    depthMode: 'hipBelowKnee',
    depthOffset: 0,
    bottomKneeAngle: 90,
    maxTorsoLean: 50,
    checkHeels: false,
    heelTolerance: 0.08,
  },
  pushup: {
    topElbowAngle: 160,
    bottomElbowAngle: 90,
    minBodyLineAngle: 160,
    minKneeAngle: 150,
  },
  pullup: {
    hangElbowAngle: 160,
    chinMargin: 0,
    maxHipSwing: 0.3,
    maxKneeAngleChange: 45,
  },
};

const KEY = 'trackbody.settings';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  readonly settings = signal<AppSettings>(this.load());

  update<S extends SettingsSection>(section: S, key: keyof AppSettings[S], value: unknown): void {
    this.settings.update((s) => ({ ...s, [section]: { ...s[section], [key]: value } }));
    this.save();
  }

  resetSection(section: SettingsSection): void {
    this.settings.update((s) => ({ ...s, [section]: structuredClone(DEFAULT_SETTINGS[section]) }));
    this.save();
  }

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
