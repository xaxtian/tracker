import type { RepTempo } from '../analysis/tempo';
import type { ExerciseId, ExerciseSettingsMap } from '../exercises';

export type { ExerciseId, RepTempo };

/** Optional strictness rule shared by all exercises. */
export interface EccentricRule {
  /** Reject reps whose eccentric (lowering) phase is shorter than `minEccentricSec`. */
  checkEccentric: boolean;
  /** Minimum eccentric duration in seconds. */
  minEccentricSec: number;
}

/** Landmark in pixel coordinates (x right, y down) with visibility 0..1. */
export interface Pt {
  /** Horizontal position in video pixels. */
  x: number;
  /** Vertical position in video pixels (grows downwards). */
  y: number;
  /** MediaPipe visibility score, 0..1. */
  v: number;
}

/** Settings shared by every exercise. */
export interface GeneralSettings {
  /** Seconds without reps that close a set (exercises with `longInactivity` use three times this). */
  restTimeoutSec: number;
  /** Seconds out of position (off the bar, out of plank, out of frame) that close a set. */
  offPositionSec: number;
  /** Minimum landmark visibility to analyse a joint. */
  minVisibility: number;
  /** Consecutive frames a technique fault must be seen to invalidate a rep. */
  faultFrames: number;
  /** Degrees the joint must close to count as an attempt. */
  minRange: number;
  /** Landmark smoothing, 0 (none) .. 0.9 (heavy, laggy). */
  smoothing: number;
  /** Speak rep counts and faults. */
  voice: boolean;
  /** Beep on every rep. */
  beep: boolean;
  /** Draw measured angles on screen. */
  showAngles: boolean;
  /** Start recording as soon as the camera starts. */
  autoRecord: boolean;
  /** Ask the camera for 60 fps. */
  highFps: boolean;
  /** User height, used to convert pixels to metres. */
  userHeightCm: number;
  /** MediaPipe model: lighter/faster or full/more accurate. */
  model: 'lite' | 'full';
}

/** Every user setting: the general ones plus one section per exercise (see the exercise modules). */
export type AppSettings = { general: GeneralSettings } & ExerciseSettingsMap;

/** A section of {@link AppSettings}. */
export type SettingsSection = keyof AppSettings;

/** A finished rep as produced by the rep counter. */
export interface RepResult {
  /** True when it met every strictness criterion. */
  valid: boolean;
  /** Fault ids that made it invalid (see FAULT_MESSAGES in the exercise registry). */
  reasons: string[];
  /** Epoch ms when the rep started (left the top position). */
  start: number;
  /** Epoch ms when it was completed. */
  end: number;
  /** Phase timing and velocity, when it could be measured. */
  tempo?: RepTempo;
}

/** A rep as stored in the history. */
export interface RepRecord {
  /** True when it met every strictness criterion. */
  valid: boolean;
  /** Fault ids that made it invalid. */
  reasons: string[];
  /** Phase timing and velocity, when it could be measured. */
  tempo?: RepTempo;
}

/** A set as stored in the history. */
export interface SetRecord {
  /** Unique id. */
  id: string;
  exercise: ExerciseId;
  /** Epoch ms of the first rep's start. */
  start: number;
  /** Epoch ms of the last rep's end. */
  end: number;
  /** Number of valid reps. */
  valid: number;
  /** Number of invalid reps. */
  invalid: number;
  /** Fault id -> times it invalidated a rep. */
  reasons: Record<string, number>;
  /** Seconds since the previous set ended (null for the first set of a session). */
  restBeforeSec: number | null;
  /** Extra load in kg (weight, vest, belt). Negative = assisted (band). Missing/0 = bodyweight. */
  loadKg?: number;
  /** Side trained in a unilateral exercise (L = left, R = right). */
  side?: 'L' | 'R';
  /** Per-rep detail (sets recorded before tempo tracking don't have it). */
  reps?: RepRecord[];
  /** Recording that contains this set, and where it starts in it. */
  recordingId?: string;
  videoOffsetSec?: number;
}
