import { Injectable } from '@angular/core';

/** Voice and beep feedback. */
@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private ctx: AudioContext | null = null;
  private voice: SpeechSynthesisVoice | null = null;

  /** Must be called from a user gesture so mobile browsers allow audio. */
  unlock(): void {
    try {
      this.ctx ??= new AudioContext();
      void this.ctx.resume();
    } catch {
      /* no audio */
    }
    if ('speechSynthesis' in window) {
      const pick = () => {
        const voices = speechSynthesis.getVoices();
        this.voice = voices.find((v) => v.lang.startsWith('es-ES')) ?? voices.find((v) => v.lang.startsWith('es')) ?? null;
      };
      pick();
      speechSynthesis.onvoiceschanged = pick;
    }
  }

  speak(text: string): void {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'es-ES';
    if (this.voice) u.voice = this.voice;
    u.rate = 1.15;
    speechSynthesis.speak(u);
  }

  beep(ok: boolean): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = ok ? 'sine' : 'square';
    osc.frequency.value = ok ? 880 : 220;
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (ok ? 0.15 : 0.35));
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  }
}
