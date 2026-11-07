// Syntetyzator dźwięków Web Audio API oraz bezpieczna obsługa wibracji (Haptics)
import { storage } from './storage.js';

class FeedbackManager {
  constructor() {
    this.audioCtx = null;
    this.isAudioUnlocked = false;
  }

  // Odblokowanie kontekstu audio po pierwszym geście użytkownika
  unlockAudio() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    this.isAudioUnlocked = true;
  }

  // Wibracje haptic
  vibrate(pattern) {
    const settings = storage.getSettings();
    if (!settings.vibration) return;
    try {
      if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
      }
    } catch (e) {
      // Ignorujemy błędy braku uprawnień na niektórych przeglądarkach
    }
  }

  // 1. Zmiana pozycji o 1 oczko (Tick)
  tick(isFast = false) {
    this.vibrate(8);

    const settings = storage.getSettings();
    if (!settings.sound || !this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = isFast ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(isFast ? 420 : 320, now);
      osc.frequency.exponentialRampToValueAtTime(isFast ? 680 : 180, now + 0.02);

      gain.gain.setValueAtTime(isFast ? 0.04 : 0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.028);
    } catch (e) {}
  }

  // 2. Przekroczenie linii środkowej / zatwierdzenie kroku (Commit)
  stepCommit(stepIndex) {
    this.vibrate(35);

    const settings = storage.getSettings();
    if (!settings.sound || !this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      // Skala rosnąca w miarę postępu kroków (Krok 2 -> 3 -> 4)
      const baseFreq = 520 + (stepIndex || 1) * 120;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.35, now + 0.08);

      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.13);
    } catch (e) {}
  }

  // 3. Zapisanie zadania po puszczeniu palca (Success)
  taskSaved() {
    this.vibrate([30, 40, 30]);

    const settings = storage.getSettings();
    if (!settings.sound || !this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      const playTone = (freq, startOffset, duration) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + startOffset);
        gain.gain.setValueAtTime(0.15, now + startOffset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now + startOffset);
        osc.stop(now + startOffset + duration);
      };

      playTone(587.33, 0.00, 0.10); // D5
      playTone(739.99, 0.07, 0.10); // F#5
      playTone(880.00, 0.14, 0.22); // A5
    } catch (e) {}
  }

  // 4. Anulowanie zadania w górnej strefie (Cancel)
  taskCancelled() {
    this.vibrate([80]);

    const settings = storage.getSettings();
    if (!settings.sound || !this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.16);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.20);
    } catch (e) {}
  }

  // 5. Wjazd do strefy anulowania (ostrzeżenie)
  cancelZoneEntered() {
    this.vibrate(20);
  }
}

export const feedback = new FeedbackManager();
