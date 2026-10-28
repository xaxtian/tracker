import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { ExerciseId, RepResult } from '../../models/types';
import { FeedbackService } from '../../services/feedback.service';
import { HistoryService } from '../../services/history.service';
import { PoseService } from '../../services/pose.service';
import { SettingsService } from '../../services/settings.service';
import { VideoStoreService } from '../../services/video-store.service';
import { SessionRecorder } from '../../services/session-recorder';
import { installMediaRecorder, FakeMediaRecorder } from '../../../testing/media-recorder.mock';
import { mockCanvas } from '../../../testing/canvas.mock';
import { fakeVideoStore, mockMediaElements, setProps, setRecord } from '../../../testing/fakes';
import { squatPose } from '../../../testing/landmarks';
import { angleAt } from '../../../testing/motion';
import { WorkoutComponent } from './workout.component';

/** Private members reached by the tests. */
interface Internals {
  onRep(r: RepResult): void;
  onSetEnded(s: ReturnType<typeof setRecord>): void;
  onFrame(t: number): void;
  endRules(): { offPositionSec: number; inactivitySec: number | null };
  describeError(e: unknown): string;
}

function fakeStream(settings: MediaTrackSettings = { facingMode: 'environment', deviceId: 'cam-back', frameRate: 60 }) {
  const track = { stop: jest.fn(), getSettings: () => settings };
  return { track, stream: { getVideoTracks: () => [track], getTracks: () => [track] } };
}

describe('WorkoutComponent', () => {
  let f: ComponentFixture<WorkoutComponent>;
  let c: WorkoutComponent;
  let el: HTMLElement;
  let pose: { init: jest.Mock; detect: jest.Mock };
  let fb: { unlock: jest.Mock; speak: jest.Mock; beep: jest.Mock };
  let media: { getUserMedia: jest.Mock; enumerateDevices: jest.Mock };
  const nav = navigator as unknown as Record<string, unknown>;

  const setup = (exercise: string = 'squat') => {
    pose = { init: jest.fn(async () => undefined), detect: jest.fn(() => null) };
    fb = { unlock: jest.fn(), speak: jest.fn(), beep: jest.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ exercise }) } } },
        { provide: PoseService, useValue: pose },
        { provide: FeedbackService, useValue: fb },
        { provide: VideoStoreService, useValue: fakeVideoStore() },
      ],
    });
    f = TestBed.createComponent(WorkoutComponent);
    c = f.componentInstance;
    f.detectChanges();
    el = f.nativeElement;
  };
  const priv = () => c as unknown as Internals;
  const video = () => el.querySelector('video') as HTMLVideoElement;

  beforeEach(() => {
    localStorage.clear();
    mockCanvas();
    mockMediaElements();
    jest.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    media = {
      getUserMedia: jest.fn(async () => fakeStream().stream),
      enumerateDevices: jest.fn(async () => [
        { kind: 'videoinput', deviceId: 'cam-front', label: 'Front camera' },
        { kind: 'videoinput', deviceId: 'cam-back', label: 'Back camera' },
        { kind: 'audioinput', deviceId: 'mic', label: 'Mic' },
      ]),
    };
    nav['mediaDevices'] = media;
  });

  afterEach(() => {
    f?.destroy();
    delete nav['mediaDevices'];
    jest.restoreAllMocks();
  });

  describe('page', () => {
    it('shows the exercise and its camera tips', () => {
      setup('pullup');
      expect(el.querySelector('h1')?.textContent).toBe('🧗 Dominadas');
      expect(el.querySelectorAll('.tips li').length).toBeGreaterThan(0);
      expect(el.querySelector('.btn.primary')?.textContent).toContain('Iniciar cámara');
    });

    it('goes back home for an unknown exercise', () => {
      const navigate = jest.spyOn(Router.prototype, 'navigate').mockResolvedValue(true);
      setup('burpees');
      expect(c.exercise).toBe('squat');
      expect(navigate).toHaveBeenCalledWith(['/']);
    });

    it('lists only video cameras', async () => {
      setup();
      await f.whenStable();
      expect(c.cameras().map((d) => d.deviceId)).toEqual(['cam-front', 'cam-back']);
    });
  });

  describe('load', () => {
    beforeEach(() => setup('pullup'));

    it('starts at bodyweight', () => {
      expect(c.loadKg()).toBe(0);
      expect(el.querySelector('.load-bar small')?.textContent).toContain('Solo peso corporal');
    });

    it('steps in 2.5 kg and is remembered per exercise', () => {
      el.querySelector<HTMLButtonElement>('[aria-label="Añadir 2,5 kg"]')!.click();
      el.querySelector<HTMLButtonElement>('[aria-label="Añadir 2,5 kg"]')!.click();
      expect(c.loadKg()).toBe(5);
      c.stepLoad(-1);
      expect(c.loadKg()).toBe(2.5);
      expect(JSON.parse(localStorage.getItem('trackbody.load')!)).toEqual({ pullup: 2.5 });
    });

    it('snaps odd values to the 2.5 kg grid when stepping', () => {
      c.setLoad(3.2);
      c.stepLoad(1);
      expect(c.loadKg()).toBe(5);
    });

    it('accepts typed values, commas, negatives (assistance) and clamps', () => {
      c.setLoad('12,5');
      expect(c.loadKg()).toBe(12.5);
      c.setLoad('-20');
      expect(c.loadKg()).toBe(-20);
      f.detectChanges();
      expect(el.querySelector('.load-bar small')?.textContent).toContain('Asistencia');
      c.setLoad('9999');
      expect(c.loadKg()).toBe(500);
      c.setLoad('abc');
      expect(c.loadKg()).toBe(0);
    });

    it('restores the saved load for the exercise', () => {
      localStorage.setItem('trackbody.load', JSON.stringify({ pullup: 10, squat: 60 }));
      f.destroy();
      TestBed.resetTestingModule();
      setup('squat');
      expect(c.loadKg()).toBe(60);
    });

    it('survives corrupt storage', () => {
      localStorage.setItem('trackbody.load', '{oops');
      f.destroy();
      TestBed.resetTestingModule();
      setup('squat');
      expect(c.loadKg()).toBe(0);
    });
  });

  describe('reps and sets', () => {
    beforeEach(() => setup('squat'));
    const rep = (valid: boolean, reasons: string[] = []): RepResult => ({ valid, reasons, start: Date.now(), end: Date.now() + 3000 });

    it('counts a valid rep, says the number and beeps', () => {
      priv().onRep(rep(true));
      expect(c.valid()).toBe(1);
      expect(c.inSet()).toBe(true);
      expect(c.lastRep()).toMatchObject({ ok: true, text: 'Repetición 1' });
      expect(fb.speak).toHaveBeenCalledWith('1');
      expect(fb.beep).toHaveBeenCalledWith(true);
    });

    it('explains why a rep did not count', () => {
      priv().onRep(rep(false, ['squatNoDepth', 'torsoLean']));
      expect(c.invalid()).toBe(1);
      expect(c.lastRep()?.text).toBe('No bajaste del paralelo · Tronco demasiado inclinado');
      expect(fb.speak).toHaveBeenCalledWith('No cuenta, más abajo');
      expect(fb.beep).toHaveBeenCalledWith(false);
    });

    it('respects the voice and beep settings', () => {
      const s = TestBed.inject(SettingsService);
      s.update('general', 'voice', false);
      s.update('general', 'beep', false);
      priv().onRep(rep(true));
      expect(fb.speak).not.toHaveBeenCalled();
      expect(fb.beep).not.toHaveBeenCalled();
    });

    it('saves a finished set with its load and announces it', () => {
      c.setLoad(20);
      priv().onRep(rep(true));
      c.endSet();
      f.detectChanges();
      const saved = TestBed.inject(HistoryService).sets();
      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({ exercise: 'squat', valid: 1, loadKg: 20 });
      expect(c.inSet()).toBe(false);
      expect(c.setBanner()).toMatchObject({ title: 'Serie 1 terminada', detail: '+20 kg · 1 válida' });
      expect(fb.speak).toHaveBeenLastCalledWith('Serie terminada. 1 repetición');
      const row = el.querySelector('.sets tbody tr')!;
      expect([...(row as HTMLTableRowElement).cells].map((x) => x.textContent?.trim())).toEqual(['1', '+20 kg', '1', '0', '—', '—']);
    });

    it('does not store a load for bodyweight sets', () => {
      priv().onSetEnded(setRecord('x', { valid: 3, invalid: 2, reasons: { torsoLean: 2 } }));
      expect(TestBed.inject(HistoryService).sets()[0].loadKg).toBeUndefined();
      expect(c.setBanner()?.detail).toBe('3 válidas · 2 no válidas');
      f.detectChanges();
      expect(el.querySelector('.sets .reasons')?.textContent).toContain('Tronco demasiado inclinado ×2');
    });

    it('ends sets differently for each exercise', () => {
      expect(priv().endRules()).toEqual({ offPositionSec: 2, inactivitySec: 10 });
      f.destroy();
      TestBed.resetTestingModule();
      setup('pushup');
      expect(priv().endRules().inactivitySec).toBe(30);
      f.destroy();
      TestBed.resetTestingModule();
      setup('pullup');
      expect(priv().endRules().inactivitySec).toBeNull();
    });

    it('formats the rest time', () => {
      expect(c.formatRest(0)).toBe('0:00');
      expect(c.formatRest(95)).toBe('1:35');
    });
  });

  describe('camera', () => {
    it('opens the camera at 60 fps and starts analysing', async () => {
      setup();
      await c.start();
      f.detectChanges();
      expect(fb.unlock).toHaveBeenCalled();
      expect(pose.init).toHaveBeenCalledWith('full');
      const constraints = media.getUserMedia.mock.calls[0][0];
      expect(constraints.audio).toBe(false);
      expect(constraints.video.frameRate).toEqual({ ideal: 60 });
      expect(c.status()).toBe('running');
      expect(c.facing()).toBe('environment');
      expect(c.cameraFps()).toBe(60);
      expect(JSON.parse(localStorage.getItem('trackbody.camera')!)).toEqual({ facing: 'environment', deviceId: 'cam-back' });
      expect(el.querySelector('.controls')?.textContent).toContain('Terminar serie');
    });

    it('asks for 30 fps when high frame rate is off', async () => {
      setup();
      TestBed.inject(SettingsService).update('general', 'highFps', false);
      await c.start();
      expect(media.getUserMedia.mock.calls[0][0].video.frameRate).toEqual({ ideal: 30 });
    });

    it('stops the camera tracks', async () => {
      const { track, stream } = fakeStream();
      media.getUserMedia.mockResolvedValue(stream);
      setup();
      await c.start();
      await c.stop();
      expect(track.stop).toHaveBeenCalled();
      expect(c.status()).toBe('off');
    });

    it('shows a clear message when permission is denied', async () => {
      media.getUserMedia.mockRejectedValue(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
      setup();
      await c.start();
      f.detectChanges();
      expect(c.status()).toBe('error');
      expect(el.querySelector('.err')?.textContent).toContain('Permiso de cámara denegado');
      // Permission errors are not retried with other constraints.
      expect(media.getUserMedia).toHaveBeenCalledTimes(1);
    });

    it('retries without "exact" when the phone rejects it', async () => {
      media.getUserMedia
        .mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'OverconstrainedError' }))
        .mockResolvedValueOnce(fakeStream().stream);
      setup();
      const requested = c.facing();
      await c.start();
      expect(media.getUserMedia).toHaveBeenCalledTimes(2);
      expect(media.getUserMedia.mock.calls[0][0].video.facingMode).toEqual({ exact: requested });
      expect(typeof media.getUserMedia.mock.calls[1][0].video.facingMode).toBe('string');
      expect(c.status()).toBe('running');
    });

    it('switches between front and rear camera', async () => {
      setup();
      await c.start();
      media.getUserMedia.mockResolvedValue(fakeStream({ facingMode: 'user', deviceId: 'cam-front' }).stream);
      await c.switchCamera();
      expect(c.facing()).toBe('user');
      expect(media.getUserMedia.mock.calls.at(-1)![0].video.facingMode).toEqual({ exact: 'user' });
      expect(el.querySelector('.stage')?.classList).toBeTruthy();
    });

    it('opens a camera picked from the list by its id', async () => {
      setup();
      await f.whenStable();
      await c.selectCamera('cam-front');
      expect(c.facing()).toBe('user');
      expect(c.deviceId()).toBe('cam-front');
      expect(JSON.parse(localStorage.getItem('trackbody.camera')!)).toEqual({ facing: 'user', deviceId: 'cam-front' });
      await c.start();
      expect(media.getUserMedia.mock.calls[0][0].video.deviceId).toEqual({ exact: 'cam-front' });
    });

    it('remembers the last camera', () => {
      localStorage.setItem('trackbody.camera', JSON.stringify({ facing: 'user', deviceId: 'cam-front' }));
      setup();
      expect(c.facing()).toBe('user');
      expect(c.deviceId()).toBe('cam-front');
    });

    it('describes camera errors', () => {
      setup();
      const d = (e: unknown) => priv().describeError(e);
      expect(d({ name: 'NotFoundError' })).toBe('No se ha encontrado ninguna cámara.');
      setProps(window, { isSecureContext: true });
      expect(d(new Error('boom'))).toBe('No se pudo iniciar: boom');
      setProps(window, { isSecureContext: false });
      expect(d(new Error('boom'))).toContain('HTTPS');
      setProps(window, { isSecureContext: true });
    });
  });

  describe('recording', () => {
    let uninstall: () => void;
    beforeEach(() => (uninstall = installMediaRecorder()));
    afterEach(() => uninstall());

    const startCamera = async () => {
      setup('pushup');
      setProps(video(), { videoWidth: 1280, videoHeight: 720 });
      await c.start();
      f.detectChanges();
    };

    it('records on demand and saves the video', async () => {
      await startCamera();
      const recBtn = () => [...el.querySelectorAll<HTMLButtonElement>('.controls .btn')].find((b) => /Grabar|Parar grabación/.test(b.textContent!))!;
      expect(c.canRecord).toBe(true);
      recBtn().click();
      await f.whenStable();
      f.detectChanges();
      expect(c.recording()).toBe(true);
      expect(el.querySelector('.rec')?.textContent).toContain('REC');
      expect(FakeMediaRecorder.last.start).toHaveBeenCalledWith(2000);

      await c.toggleRecording();
      f.detectChanges();
      expect(c.recording()).toBe(false);
      expect(c.lastRecording()?.exercise).toBe('pushup');
      expect(el.querySelector('.saved')?.textContent).toContain('Vídeo guardado');
    });

    it('links each set to its place in the video', async () => {
      await startCamera();
      await c.toggleRecording();
      priv().onSetEnded(setRecord('s1', { exercise: 'pushup', start: Date.now(), end: Date.now() + 1000 }));
      const [set] = TestBed.inject(HistoryService).sets();
      expect(set.recordingId).toMatch(/^rec-/);
      expect(set.videoOffsetSec).toBe(0);
    });

    it('starts recording by itself when auto-record is on', async () => {
      setup('pushup');
      TestBed.inject(SettingsService).update('general', 'autoRecord', true);
      setProps(video(), { videoWidth: 1280, videoHeight: 720 });
      await c.start();
      expect(c.recording()).toBe(true);
    });

    it('reports a recorder failure without stopping the workout', async () => {
      await startCamera();
      jest.spyOn(SessionRecorder.prototype, 'start').mockRejectedValue(new Error('no codec'));
      await c.toggleRecording();
      expect(c.recording()).toBe(false);
      expect(c.error()).toBe('No se pudo grabar: no codec');
      expect(c.status()).toBe('running');
    });
  });

  describe('frame analysis (integration)', () => {
    const W = 1000;
    /** Normalized MediaPipe landmarks of a side-view squat. */
    const detected = (knee: number) =>
      squatPose(knee).map((p) => ({ x: p.x / W, y: p.y / W, z: 0, visibility: p.v }));

    beforeEach(() => {
      setup('squat');
      setProps(video(), { readyState: 4, videoWidth: W, videoHeight: W });
    });

    it('asks the person to step in when nobody is detected', () => {
      priv().onFrame(1000);
      expect(c.hint()).toBe('No te veo. Colócate delante de la cámara.');
    });

    it('counts two strict squats and times them, end to end', () => {
      const plan = { top: 175, bottom: 35, rest: 1, flex: 2, hold: 0.5, extend: 1 };
      for (let i = 1; i <= 30 * 10.5; i++) {
        const t = i / 30;
        pose.detect.mockReturnValue(detected(t < 9 ? angleAt(t, plan) : plan.top));
        // Without requestVideoFrameCallback, new frames are detected by the video clock.
        video().currentTime = t;
        priv().onFrame(t * 1000);
      }
      expect(c.valid()).toBe(2);
      expect(c.invalid()).toBe(0);
      expect(fb.speak.mock.calls.map((x) => x[0])).toEqual(['1', '2']);
      const t = c.lastTempo()!;
      expect(Math.abs(t.eccentricSec - 2)).toBeLessThan(0.15);
      expect(Math.abs(t.concentricSec - 1)).toBeLessThan(0.15);
      expect(t.meanConVel).toBeGreaterThan(0.2);
      expect(c.hint()).toBe('');
      expect(c.analysisFps()).toBe(30);

      c.endSet();
      const [set] = TestBed.inject(HistoryService).sets();
      expect(set.valid).toBe(2);
      expect(set.reps).toHaveLength(2);
    });

    it('ignores repeated frames', () => {
      pose.detect.mockReturnValue(detected(175));
      priv().onFrame(1000);
      priv().onFrame(1000);
      expect(pose.detect).toHaveBeenCalledTimes(1);
    });
  });
});
