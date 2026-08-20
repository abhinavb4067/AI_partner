/**
 * In-App Web Audio Ringtone Generator
 * Synthesizes a classic harmonic phone ringtone without needing external mp3 files.
 */

class RingtoneManager {
  constructor() {
    this.audioCtx = null;
    this.isPlaying = false;
    this.intervalId = null;
  }

  initContext() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playSingleRing() {
    if (!this.isPlaying || !this.audioCtx) return;

    try {
      const now = this.audioCtx.currentTime;

      // Frequencies for pleasant dual-tone phone ring (440Hz + 480Hz)
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const gainNode = this.audioCtx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(440, now);
      osc2.frequency.setValueAtTime(480, now);

      gainNode.gain.setValueAtTime(0, now);
      // Ring burst 1: 0 to 0.8s
      gainNode.gain.linearRampToValueAtTime(0.15, now + 0.05);
      gainNode.gain.setValueAtTime(0.15, now + 0.8);
      gainNode.gain.linearRampToValueAtTime(0, now + 0.85);

      // Ring burst 2: 1.0s to 1.8s
      gainNode.gain.setValueAtTime(0, now + 1.0);
      gainNode.gain.linearRampToValueAtTime(0.15, now + 1.05);
      gainNode.gain.setValueAtTime(0.15, now + 1.8);
      gainNode.gain.linearRampToValueAtTime(0, now + 1.85);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 2.0);
      osc2.stop(now + 2.0);
    } catch (e) {
      console.warn('[Ringtone] Audio synthesis error:', e);
    }
  }

  start() {
    if (this.isPlaying) return;
    this.initContext();
    this.isPlaying = true;

    // Play first burst immediately
    this.playSingleRing();

    // Repeat every 3 seconds
    this.intervalId = setInterval(() => {
      if (this.isPlaying) {
        this.playSingleRing();
      }
    }, 3000);
  }

  stop() {
    this.isPlaying = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export const ringtone = new RingtoneManager();
