import { Injectable } from '@angular/core';
import { FilesetResolver, NormalizedLandmark, PoseLandmarker } from '@mediapipe/tasks-vision';

@Injectable({ providedIn: 'root' })
export class PoseService {
  private landmarker: PoseLandmarker | null = null;
  private model: string | null = null;
  private lastTs = -1;

  async init(model: 'lite' | 'full'): Promise<void> {
    if (this.landmarker && this.model === model) return;
    this.landmarker?.close();
    this.landmarker = null;

    const base = document.baseURI;
    const fileset = await FilesetResolver.forVisionTasks(new URL('mediapipe/wasm', base).href);
    const options = (delegate: 'GPU' | 'CPU') => ({
      baseOptions: { modelAssetPath: new URL(`models/pose_landmarker_${model}.task`, base).href, delegate },
      runningMode: 'VIDEO' as const,
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    try {
      this.landmarker = await PoseLandmarker.createFromOptions(fileset, options('GPU'));
    } catch {
      this.landmarker = await PoseLandmarker.createFromOptions(fileset, options('CPU'));
    }
    this.model = model;
  }

  /** Returns the normalized landmarks of the detected person, or null. */
  detect(video: HTMLVideoElement, ts: number): NormalizedLandmark[] | null {
    if (!this.landmarker) return null;
    // MediaPipe requires strictly increasing timestamps.
    if (ts <= this.lastTs) ts = this.lastTs + 1;
    this.lastTs = ts;
    const res = this.landmarker.detectForVideo(video, ts);
    return res.landmarks[0] ?? null;
  }
}
