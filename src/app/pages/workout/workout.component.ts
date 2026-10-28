import { Component, ElementRef, OnDestroy, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DecimalPipe, KeyValuePipe } from '@angular/common';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { Analyzer, FrameEval } from '../../analysis/analyzer';
import { BANNER_MS, HudState, drawPose, poseColor } from '../../analysis/overlay';
import { RepCounter, RepOptions } from '../../analysis/rep-counter';
import { fmt2, fmtLoad, tempoText, velocityLoss } from '../../analysis/set-stats';
import { SetEndRules, SetTracker } from '../../analysis/set-tracker';
import { Exercise, FAULT_MESSAGES, FAULT_VOICE, getExercise, isExerciseId, sideLabel } from '../../exercises';
import { AppSettings, ExerciseId, Pt, RepResult, RepTempo, SetRecord } from '../../models/types';
import { FeedbackService } from '../../services/feedback.service';
import { HistoryService } from '../../services/history.service';
import { PoseService } from '../../services/pose.service';
import { SettingsService } from '../../services/settings.service';
import { SessionRecorder, recordingSupported } from '../../services/session-recorder';
import { RecordingMeta, VideoStoreService, formatClock } from '../../services/video-store.service';

/** Camera and model state. */
type Status = 'off' | 'loading' | 'running' | 'error';

/** localStorage key of the last camera used. */
const CAMERA_KEY = 'trackbody.camera';
/** localStorage key of the load per exercise. */
const LOAD_KEY = 'trackbody.load';
/** kg added or removed by the −/+ buttons. */
const LOAD_STEP = 2.5;
/** Allowed load range in kg (negative = assistance). */
const LOAD_LIMITS = { min: -100, max: 500 };

/**
 * Training screen: camera, pose analysis, rep counting, automatic sets,
 * tempo, load and recording. `onFrame()` runs once per camera frame.
 */
@Component({
  selector: 'app-workout',
  imports: [RouterLink, DecimalPipe, KeyValuePipe],
  templateUrl: './workout.component.html',
  styleUrl: './workout.component.scss',
})
export class WorkoutComponent implements OnDestroy {
  private router = inject(Router);
  private pose = inject(PoseService);
  private fb = inject(FeedbackService);
  private history = inject(HistoryService);
  private settingsSvc = inject(SettingsService);
  private videoStore = inject(VideoStoreService);
  readonly settings = this.settingsSvc.settings;

  readonly exercise: ExerciseId;
  /** The exercise module: texts, settings, set-end rule and analyzer. */
  readonly info: Exercise;

  private videoRef = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  /** Camera and model state. */
  readonly status = signal<Status>('off');
  readonly error = signal('');
  /** Front (`user`) or rear (`environment`) camera. */
  readonly facing = signal<'user' | 'environment'>('user');
  /** Specific camera chosen in the list, if any. */
  readonly deviceId = signal<string | null>(null);
  /** Video cameras available. */
  readonly cameras = signal<MediaDeviceInfo[]>([]);
  /** Instruction shown when the person is not detected or not in position. */
  readonly hint = signal('');
  /** A set is in progress. */
  readonly inSet = signal(false);
  /** Valid reps in the current set. */
  readonly valid = signal(0);
  /** Invalid reps in the current set. */
  readonly invalid = signal(0);
  /** Seconds since the last set ended. */
  readonly restSec = signal<number | null>(null);
  /** Last rep notification (the id restarts its animation). */
  readonly lastRep = signal<{ ok: boolean; text: string; id: number } | null>(null);
  /** Live angles shown under the video. */
  readonly metrics = signal<Record<string, number>>({});
  /** Sets finished since the page was opened. */
  readonly sessionSets = signal<SetRecord[]>([]);
  readonly setNumber = computed(() => this.sessionSets().length + (this.inSet() ? 1 : 0));
  readonly lastRepList = computed(() => {
    const r = this.lastRep();
    return r ? [r] : [];
  });
  readonly noSort = () => 0;
  /** End-of-set banner. */
  readonly setBanner = signal<{ title: string; detail: string; id: number } | null>(null);
  readonly setBannerList = computed(() => {
    const b = this.setBanner();
    return b ? [b] : [];
  });
  readonly canRecord = recordingSupported();
  /** A recording is in progress. */
  readonly recording = signal(false);
  /** Recording length (s). */
  readonly recSec = signal(0);
  /** Recording saved last, for the "Ver vídeo" link. */
  readonly lastRecording = signal<RecordingMeta | null>(null);
  readonly formatClock = formatClock;
  readonly fmt2 = fmt2;
  readonly velocityLoss = velocityLoss;
  readonly pauseLabels: { turn: string; between: string };
  /** Tempo of the last rep, shown in the detail panel. */
  readonly lastTempo = signal<RepTempo | null>(null);
  /** Velocity loss of the current set, %. */
  readonly setVelLoss = signal<number | null>(null);
  /** Frame rate delivered by the camera and frames actually analyzed per second. */
  readonly cameraFps = signal<number | null>(null);
  readonly analysisFps = signal<number | null>(null);
  /** Extra load (kg) saved with each set; remembered per exercise. */
  readonly loadKg = signal(0);
  readonly fmtLoad = fmtLoad;
  /** Side trained in the current set of a unilateral exercise ("brazo izquierdo"…). */
  readonly sideText = signal('');

  private analyzer: Analyzer;
  private counter: RepCounter;
  private tracker: SetTracker;
  private stream: MediaStream | null = null;
  private raf = 0;
  private vfcHandle = 0;
  private looping = false;
  private readonly useVfc = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
  private frameOffset: number | null = null;
  private lastFrameT = 0;
  private fpsAvg = 0;
  private fpsShownAt = 0;
  private lastVideoTime = -1;
  private smoothed: Pt[] | null = null;
  private repId = 0;
  private recorder: SessionRecorder | null = null;
  private toastAt = 0;
  private bannerAt = 0;
  private bannerTimer: ReturnType<typeof setTimeout> | undefined;
  /** Side seen in the last analysed frame, and the side of the current set (unilateral exercises). */
  private lastSide: 'L' | 'R' | undefined;
  private setSide: 'L' | 'R' | undefined;

  constructor() {
    const id = inject(ActivatedRoute).snapshot.paramMap.get('exercise');
    this.exercise = isExerciseId(id) ? id : 'squat';
    if (!isExerciseId(id)) void this.router.navigate(['/']);
    this.info = getExercise(this.exercise);
    this.pauseLabels = this.info.pauseLabels;
    this.analyzer = this.info.createAnalyzer();
    this.counter = new RepCounter(this.analyzer);
    this.tracker = new SetTracker(this.exercise);
    // Rear camera is more practical on a phone propped up in front of you.
    if (/Android|iPhone|iPad/i.test(navigator.userAgent)) this.facing.set('environment');
    this.loadCameraChoice();
    this.loadKg.set(this.readLoads()[this.exercise] ?? 0);
    void this.listCameras();
  }

  /** Sets the extra load. It applies to the set in progress and the next ones. */
  setLoad(kg: number | string): void {
    let n = typeof kg === 'number' ? kg : parseFloat(String(kg).replace(',', '.'));
    if (!Number.isFinite(n)) n = 0;
    n = Math.round(Math.min(LOAD_LIMITS.max, Math.max(LOAD_LIMITS.min, n)) * 100) / 100;
    this.loadKg.set(n);
    try {
      localStorage.setItem(LOAD_KEY, JSON.stringify({ ...this.readLoads(), [this.exercise]: n }));
    } catch {
      /* storage unavailable */
    }
  }

  stepLoad(dir: 1 | -1): void {
    this.setLoad(Math.round((this.loadKg() + dir * LOAD_STEP) / LOAD_STEP) * LOAD_STEP);
  }

  private readLoads(): Partial<Record<ExerciseId, number>> {
    try {
      return JSON.parse(localStorage.getItem(LOAD_KEY) ?? '{}') ?? {};
    } catch {
      return {};
    }
  }

  /** Loads the model, opens the camera and starts analysing frames. */
  async start(): Promise<void> {
    this.fb.unlock();
    this.status.set('loading');
    this.error.set('');
    try {
      await Promise.all([this.pose.init(this.settings().general.model), this.openCamera()]);
      this.status.set('running');
      this.startLoop();
      if (this.settings().general.autoRecord && this.canRecord) await this.startRecording();
    } catch (e) {
      this.stopCamera();
      this.status.set('error');
      this.error.set(this.describeError(e));
    }
  }

  /** Closes the current set, stops recording and releases the camera. */
  async stop(): Promise<void> {
    this.flushRep();
    this.endSet();
    await this.stopRecording();
    this.stopLoop();
    this.stopCamera();
    this.counter.reset();
    this.status.set('off');
    this.hint.set('');
  }

  /** Starts or stops recording. */
  async toggleRecording(): Promise<void> {
    if (this.recording()) await this.stopRecording();
    else await this.startRecording();
  }

  private async startRecording(): Promise<void> {
    const video = this.videoRef().nativeElement;
    if (this.recorder || !video.videoWidth) return;
    try {
      const r = new SessionRecorder(this.videoStore, this.exercise, video.videoWidth, video.videoHeight);
      this.recorder = r;
      await r.start();
      this.recording.set(true);
      this.recSec.set(0);
    } catch (e) {
      this.recorder = null;
      this.recording.set(false);
      this.error.set(`No se pudo grabar: ${(e as Error)?.message ?? e}`);
    }
  }

  private async stopRecording(): Promise<void> {
    const r = this.recorder;
    if (!r) return;
    this.recorder = null;
    this.recording.set(false);
    try {
      this.lastRecording.set(await r.stop());
    } catch {
      /* partial recording stays in storage */
    }
  }

  /** Toggles between front and rear camera. */
  async switchCamera(): Promise<void> {
    this.facing.update((f) => (f === 'user' ? 'environment' : 'user'));
    this.deviceId.set(null);
    await this.reopenCamera();
  }

  /** Picks a specific camera from the device list. */
  async selectCamera(id: string): Promise<void> {
    this.deviceId.set(id);
    const label = this.cameras().find((c) => c.deviceId === id)?.label ?? '';
    if (/front|frontal|user|delant|selfie/i.test(label)) this.facing.set('user');
    else if (/back|rear|trasera|environment|posterior/i.test(label)) this.facing.set('environment');
    await this.reopenCamera();
  }

  private async reopenCamera(): Promise<void> {
    this.saveCameraChoice();
    if (this.status() !== 'running') return;
    this.stopCamera();
    // The view changes completely: restart the rep in progress (the set is kept).
    this.flushRep();
    try {
      await this.openCamera();
      this.startLoop();
    } catch (e) {
      this.stopLoop();
      this.status.set('error');
      this.error.set(this.describeError(e));
    }
  }

  /** Manually close the current set. */
  endSet(): void {
    const set = this.tracker.finish();
    if (set) this.onSetEnded(set);
  }

  ngOnDestroy(): void {
    clearTimeout(this.bannerTimer);
    void this.stop();
  }

  /** Faults of a set, with counts. */
  reasonsOf(set: SetRecord): string {
    return Object.entries(set.reasons)
      .map(([k, n]) => `${FAULT_MESSAGES[k] ?? k} ×${n}`)
      .join(', ');
  }

  /** Seconds as m:ss. */
  formatRest(sec: number): string {
    const m = Math.floor(sec / 60);
    return `${m}:${String(sec % 60).padStart(2, '0')}`;
  }

  // ---------------------------------------------------------------------------

  /** Opens the camera, trying the chosen device, then the exact facing mode, then a plain hint. */
  private async openCamera(): Promise<void> {
    const video = this.videoRef().nativeElement;
    const size = {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: this.settings().general.highFps ? 60 : 30 },
    };
    const id = this.deviceId();
    const attempts: MediaTrackConstraints[] = id
      ? [{ ...size, deviceId: { exact: id } }]
      : [];
    // "exact" forces the switch on phones that ignore a plain facingMode hint.
    attempts.push({ ...size, facingMode: { exact: this.facing() } }, { ...size, facingMode: this.facing() });

    let lastError: unknown;
    for (const c of attempts) {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ video: c, audio: false });
        break;
      } catch (e) {
        lastError = e;
        if ((e as { name?: string })?.name === 'NotAllowedError') throw e;
      }
    }
    if (!this.stream) throw lastError;

    // Reflect the camera actually opened (for the mirror effect and the selector).
    const s = this.stream.getVideoTracks()[0]?.getSettings();
    if (s?.facingMode === 'user' || s?.facingMode === 'environment') this.facing.set(s.facingMode);
    if (s?.deviceId) this.deviceId.set(s.deviceId);
    this.cameraFps.set(s?.frameRate ? Math.round(s.frameRate) : null);
    this.saveCameraChoice();
    void this.listCameras();

    video.srcObject = this.stream;
    await video.play();
  }

  private async listCameras(): Promise<void> {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      this.cameras.set(all.filter((d) => d.kind === 'videoinput' && d.deviceId));
    } catch {
      this.cameras.set([]);
    }
  }

  private loadCameraChoice(): void {
    try {
      const saved = JSON.parse(localStorage.getItem(CAMERA_KEY) ?? 'null');
      if (saved?.facing === 'user' || saved?.facing === 'environment') this.facing.set(saved.facing);
      if (typeof saved?.deviceId === 'string') this.deviceId.set(saved.deviceId);
    } catch {
      /* ignore */
    }
  }

  private saveCameraChoice(): void {
    try {
      localStorage.setItem(CAMERA_KEY, JSON.stringify({ facing: this.facing(), deviceId: this.deviceId() }));
    } catch {
      /* storage unavailable */
    }
  }

  private stopCamera(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    const video = this.videoRef().nativeElement;
    video.srcObject = null;
    this.smoothed = null;
  }

  /** Starts the per-frame loop. */
  private startLoop(): void {
    this.stopLoop();
    this.looping = true;
    this.lastVideoTime = -1;
    this.frameOffset = null;
    this.lastFrameT = 0;
    this.fpsAvg = 0;
    this.schedule();
  }

  private stopLoop(): void {
    this.looping = false;
    cancelAnimationFrame(this.raf);
    if (this.vfcHandle) this.videoRef().nativeElement.cancelVideoFrameCallback(this.vfcHandle);
    this.vfcHandle = 0;
  }

  /**
   * Runs once per camera frame. requestVideoFrameCallback gives the real
   * timestamp of each frame, which is what makes phase timing precise.
   */
  private schedule(): void {
    if (!this.looping) return;
    const video = this.videoRef().nativeElement;
    if (this.useVfc) {
      this.vfcHandle = video.requestVideoFrameCallback((_now, meta) => this.onFrame(this.frameTime(meta)));
    } else {
      this.raf = requestAnimationFrame(() => this.onFrame(performance.now()));
    }
  }

  /** Frame time on the performance clock (ms). */
  private frameTime(meta: VideoFrameCallbackMetadata): number {
    const now = performance.now();
    if (meta.captureTime && Math.abs(now - meta.captureTime) < 1000) return meta.captureTime;
    const media = meta.mediaTime * 1000;
    if (this.frameOffset === null || Math.abs(media + this.frameOffset - now) > 1000) this.frameOffset = now - media;
    return media + this.frameOffset;
  }

  /** Analyses one camera frame: pose → evaluation → rep counter → set tracker → screen and video. */
  private onFrame(frameT: number): void {
    this.schedule();
    const video = this.videoRef().nativeElement;
    if (video.readyState < 2) return;
    if (!this.useVfc) {
      if (video.currentTime === this.lastVideoTime) return;
      this.lastVideoTime = video.currentTime;
    }
    if (frameT <= this.lastFrameT) return;
    this.measureFps(frameT);

    const s = this.settings();
    const now = performance.timeOrigin + frameT;
    const raw = this.pose.detect(video, frameT);
    const lm = raw ? this.toPixels(raw, video.videoWidth, video.videoHeight, s.general.smoothing) : null;
    if (!raw) this.smoothed = null;

    let ev: FrameEval | null = null;
    if (lm) {
      ev = this.analyzer.evaluate(lm, s[this.exercise], s.general);
      if (ev.ok && ev.side) this.lastSide = ev.side;
      const rep = this.counter.update(ev, lm, now, this.repOptions(s));
      if (rep) this.onRep(rep);
    }

    const inPosition = !!ev && ev.ok && ev.inPosition;
    const ended = this.tracker.tick({ inPosition, moving: this.counter.phase === 'moving' }, now, this.endRules());
    if (ended) this.onSetEnded(ended);

    this.restSec.set(
      !this.tracker.active && this.tracker.lastSetEnd ? Math.floor((now - this.tracker.lastSetEnd) / 1000) : null,
    );
    this.metrics.set(ev?.ok ? ev.metrics : {});
    this.hint.set(this.hintFor(!!raw, ev));
    this.draw(video, lm, ev);
  }

  private measureFps(frameT: number): void {
    if (this.lastFrameT) {
      const dt = frameT - this.lastFrameT;
      if (dt > 0 && dt < 1000) this.fpsAvg = this.fpsAvg ? this.fpsAvg * 0.9 + (1000 / dt) * 0.1 : 1000 / dt;
    }
    this.lastFrameT = frameT;
    if (frameT - this.fpsShownAt > 1000) {
      this.fpsShownAt = frameT;
      this.analysisFps.set(Math.round(this.fpsAvg));
    }
  }

  /** Emits a finished rep that was still waiting to be timed. */
  private flushRep(): void {
    const r = this.counter.reset();
    if (r) this.onRep(r);
  }

  /** Rep counter settings for the current exercise. */
  private repOptions(s: AppSettings): RepOptions {
    const ex = s[this.exercise];
    return {
      minRange: s.general.minRange,
      faultFrames: s.general.faultFrames,
      minEccentricSec: ex.checkEccentric ? ex.minEccentricSec : null,
      heightM: s.general.userHeightCm / 100,
    };
  }

  /** When a set ends for this exercise (see the guide, "Series automáticas"). */
  private endRules(): SetEndRules {
    const g = this.settings().general;
    const inactivity = { inactivity: g.restTimeoutSec, longInactivity: g.restTimeoutSec * 3, offPosition: null };
    return { offPositionSec: g.offPositionSec, inactivitySec: inactivity[this.info.setEnd] };
  }

  /** Updates counters and gives feedback for a finished rep. */
  private onRep(rep: RepResult): void {
    // Unilateral exercise: switching sides starts a new set.
    if (this.info.unilateral && this.tracker.active && this.lastSide && this.setSide && this.lastSide !== this.setSide) {
      this.endSet();
    }
    const newSet = !this.tracker.active;
    if (newSet && this.info.unilateral) {
      this.setSide = this.lastSide;
      this.sideText.set(sideLabel(this.exercise, this.setSide));
    }
    this.tracker.addRep(rep);
    if (newSet) {
      this.inSet.set(true);
      this.valid.set(0);
      this.invalid.set(0);
    }
    const reps = this.tracker.current?.reps ?? [];
    this.lastTempo.set(reps[reps.length - 1]?.tempo ?? null);
    this.setVelLoss.set(velocityLoss(reps));
    const tempo = tempoText(rep.tempo);
    const g = this.settings().general;
    if (rep.valid) {
      this.valid.update((n) => n + 1);
      this.lastRep.set({ ok: true, text: `Repetición ${this.valid()}` + (tempo ? ` · ${tempo}` : ''), id: ++this.repId });
      this.toastAt = Date.now();
      if (g.voice) this.fb.speak(String(this.valid()));
    } else {
      this.invalid.update((n) => n + 1);
      this.lastRep.set({
        ok: false,
        text: rep.reasons.map((r) => FAULT_MESSAGES[r] ?? r).join(' · ') + (tempo ? ` (${tempo})` : ''),
        id: ++this.repId,
      });
      this.toastAt = Date.now();
      if (g.voice) this.fb.speak(`No cuenta, ${FAULT_VOICE[rep.reasons[0]] ?? ''}`);
    }
    if (g.beep) this.fb.beep(rep.valid);
  }

  /** Saves a finished set with its load, marks it in the video and announces it. */
  private onSetEnded(set: SetRecord): void {
    this.inSet.set(false);
    const index = this.sessionSets().length + 1;
    if (this.loadKg()) set.loadKg = this.loadKg();
    if (this.info.unilateral && this.setSide) set.side = this.setSide;
    this.sideText.set('');
    if (this.recorder) {
      set.recordingId = this.recorder.meta.id;
      set.videoOffsetSec = this.recorder.markSet(set, index);
    }
    const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
    const extra = [sideLabel(this.exercise, set.side), fmtLoad(set.loadKg)].filter(Boolean).join(' · ');
    this.showBanner(
      `Serie ${index} terminada`,
      (extra ? `${extra} · ` : '') +
        plural(set.valid, 'válida') + (set.invalid ? ` · ${set.invalid} no ${set.invalid === 1 ? 'válida' : 'válidas'}` : ''),
    );
    this.history.add(set);
    this.sessionSets.update((all) => [...all, set]);
    if (this.settings().general.voice) {
      this.fb.speak(`Serie terminada. ${set.valid} ${set.valid === 1 ? 'repetición' : 'repeticiones'}`);
    }
  }

  private showBanner(title: string, detail: string): void {
    this.bannerAt = Date.now();
    this.setBanner.set({ title, detail, id: this.bannerAt });
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => this.setBanner.set(null), BANNER_MS);
  }

  private hud(now: number): HudState {
    const r = this.lastRep();
    const b = this.setBanner();
    return {
      title: [this.info.name, this.sideText(), fmtLoad(this.loadKg())].filter(Boolean).join(' '),
      valid: this.valid(),
      invalid: this.invalid(),
      inSet: this.inSet(),
      setNumber: this.setNumber(),
      restSec: this.restSec(),
      toast: r ? { ok: r.ok, text: r.text, at: this.toastAt } : null,
      banner: b ? { title: b.title, detail: b.detail, at: this.bannerAt } : null,
      hint: this.hint(),
      now,
    };
  }

  /** What to tell the person when they are not detected or not ready. */
  private hintFor(detected: boolean, ev: FrameEval | null): string {
    if (!detected) return 'No te veo. Colócate delante de la cámara.';
    if (!ev?.ok) return 'No se ven bien tus articulaciones. Aléjate o mejora la luz.';
    if (!ev.inPosition) return this.info.hints.position;
    if (this.counter.phase === 'idle') return this.info.hints.start;
    return '';
  }


  /** MediaPipe landmarks (0..1) to video pixels, with exponential smoothing. */
  private toPixels(raw: NormalizedLandmark[], w: number, h: number, smoothing: number): Pt[] {
    const pts = raw.map((p) => ({ x: p.x * w, y: p.y * h, v: p.visibility ?? 1 }));
    const prev = this.smoothed;
    if (prev && smoothing > 0) {
      const a = 1 - smoothing;
      for (let i = 0; i < pts.length; i++) {
        pts[i].x = prev[i].x + a * (pts[i].x - prev[i].x);
        pts[i].y = prev[i].y + a * (pts[i].y - prev[i].y);
      }
    }
    this.smoothed = pts;
    return pts;
  }

  /** Draws the skeleton on screen and, when recording, the full video frame. */
  private draw(video: HTMLVideoElement, lm: Pt[] | null, ev: FrameEval | null): void {
    const canvas = this.canvasRef().nativeElement;
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    const g = this.settings().general;
    const pose = { color: poseColor(ev, this.counter.phase), minVisibility: g.minVisibility, showAngle: g.showAngles };
    const mirror = this.facing() === 'user';

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // The live canvas is mirrored with CSS, so only the text needs flipping.
      if (lm) drawPose(ctx, lm, ev, { ...pose, scale: canvas.width / 640, mirrorText: mirror });
    }

    if (this.recorder) {
      this.recorder.draw(video, mirror, lm, ev, pose, this.hud(Date.now()));
      this.recSec.set(Math.floor(this.recorder.elapsedSec));
    }
  }

  /** Readable message for a camera error. */
  private describeError(e: unknown): string {
    const name = (e as { name?: string })?.name;
    if (name === 'NotAllowedError') return 'Permiso de cámara denegado. Actívalo en los ajustes del navegador.';
    if (name === 'NotFoundError') return 'No se ha encontrado ninguna cámara.';
    if (!window.isSecureContext) return 'La cámara solo funciona con HTTPS (o en localhost).';
    return `No se pudo iniciar: ${(e as Error)?.message ?? e}`;
  }
}
