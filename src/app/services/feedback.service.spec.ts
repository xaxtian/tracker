import { TestBed } from '@angular/core/testing';
import { FeedbackService } from './feedback.service';

type Win = Record<string, unknown>;

class FakeUtterance {
  lang = '';
  voice: unknown = null;
  rate = 1;
  constructor(readonly text: string) {}
}

function fakeAudio() {
  const osc = { type: '', frequency: { value: 0 }, connect: jest.fn((n) => n), start: jest.fn(), stop: jest.fn() };
  const gain = { gain: { setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() }, connect: jest.fn((n) => n) };
  const ctx = {
    currentTime: 10,
    destination: {},
    resume: jest.fn(async () => undefined),
    createOscillator: jest.fn(() => osc),
    createGain: jest.fn(() => gain),
  };
  return { ctx, osc, gain, Ctor: jest.fn(() => ctx) };
}

describe('FeedbackService', () => {
  const w = window as unknown as Win;
  let synth: { speak: jest.Mock; cancel: jest.Mock; getVoices: jest.Mock; onvoiceschanged: unknown };

  beforeEach(() => {
    synth = {
      speak: jest.fn(),
      cancel: jest.fn(),
      getVoices: jest.fn(() => [{ lang: 'en-US' }, { lang: 'es-MX' }, { lang: 'es-ES', name: 'Lucía' }]),
      onvoiceschanged: null,
    };
    w['speechSynthesis'] = synth;
    w['SpeechSynthesisUtterance'] = FakeUtterance;
  });

  afterEach(() => {
    delete w['speechSynthesis'];
    delete w['SpeechSynthesisUtterance'];
    delete w['AudioContext'];
  });

  it('speaks in Spanish, interrupting the previous phrase', () => {
    const fb = TestBed.inject(FeedbackService);
    fb.speak('3');
    expect(synth.cancel).toHaveBeenCalled();
    const u = synth.speak.mock.calls[0][0] as FakeUtterance;
    expect(u.text).toBe('3');
    expect(u.lang).toBe('es-ES');
    expect(u.rate).toBeGreaterThan(1);
  });

  it('prefers a Spain Spanish voice once unlocked', () => {
    w['AudioContext'] = fakeAudio().Ctor;
    const fb = TestBed.inject(FeedbackService);
    fb.unlock();
    fb.speak('hola');
    expect((synth.speak.mock.calls[0][0] as FakeUtterance).voice).toEqual({ lang: 'es-ES', name: 'Lucía' });
    expect(synth.onvoiceschanged).toEqual(expect.any(Function));
  });

  it('falls back to any Spanish voice', () => {
    synth.getVoices.mockReturnValue([{ lang: 'es-MX' }]);
    const fb = TestBed.inject(FeedbackService);
    fb.unlock();
    fb.speak('hola');
    expect((synth.speak.mock.calls[0][0] as FakeUtterance).voice).toEqual({ lang: 'es-MX' });
  });

  it('does nothing without speech synthesis', () => {
    delete w['speechSynthesis'];
    const fb = TestBed.inject(FeedbackService);
    expect(() => { fb.unlock(); fb.speak('x'); }).not.toThrow();
  });

  it('beeps high for a valid rep and low for an invalid one', () => {
    const a = fakeAudio();
    w['AudioContext'] = a.Ctor;
    const fb = TestBed.inject(FeedbackService);
    fb.unlock();
    expect(a.ctx.resume).toHaveBeenCalled();
    fb.beep(true);
    expect(a.osc.frequency.value).toBe(880);
    expect(a.osc.type).toBe('sine');
    fb.beep(false);
    expect(a.osc.frequency.value).toBe(220);
    expect(a.osc.type).toBe('square');
    expect(a.osc.start).toHaveBeenCalledTimes(2);
  });

  it('stays silent until unlocked or without audio support', () => {
    const fb = TestBed.inject(FeedbackService);
    expect(() => fb.beep(true)).not.toThrow();
    fb.unlock(); // AudioContext undefined → caught
    expect(() => fb.beep(true)).not.toThrow();
  });
});
