import { defineStore } from 'pinia';

export const useAudioStore = defineStore('audio', {
  state: () => ({
    enabled: true,
    audioCtx: null,
  }),

  actions: {
    async init() {
      try {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        this.enabled = false;
      }
      const saved = await window.electronAPI?.getConfig('audioEnabled');
      if (saved !== undefined && saved !== null) {
        this.enabled = saved;
      }
    },

    async toggle() {
      this.enabled = !this.enabled;
      await window.electronAPI?.setConfig('audioEnabled', this.enabled);
    },

    _ensureCtx() {
      if (!this.audioCtx) {
        try {
          this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch {
          return null;
        }
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      return this.audioCtx;
    },

    playTone(frequency, duration, gain = 0.2, type = 'sine') {
      if (!this.enabled) return;
      const ctx = this._ensureCtx();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g);
      g.connect(ctx.destination);
      osc.frequency.value = frequency;
      osc.type = type;
      const now = ctx.currentTime;
      g.gain.setValueAtTime(gain, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.start(now);
      osc.stop(now + duration);
    },

    playEffect(effect) {
      if (!this.enabled || !effect) return;
      const ctx = this._ensureCtx();
      if (!ctx) return;

      const { type, frequencies, duration, gain } = effect;
      const now = ctx.currentTime;

      switch (type) {
        case 'chime': {
          frequencies.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.connect(g);
            g.connect(ctx.destination);
            osc.frequency.value = freq;
            osc.type = 'sine';
            const start = now + i * duration * 0.4;
            g.gain.setValueAtTime(gain, start);
            g.gain.exponentialRampToValueAtTime(0.001, start + duration);
            osc.start(start);
            osc.stop(start + duration);
          });
          break;
        }
        case 'ascending': {
          frequencies.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.connect(g);
            g.connect(ctx.destination);
            osc.frequency.value = freq;
            osc.type = 'triangle';
            const start = now + i * (duration / frequencies.length);
            g.gain.setValueAtTime(gain, start);
            g.gain.exponentialRampToValueAtTime(0.001, start + duration / frequencies.length);
            osc.start(start);
            osc.stop(start + duration / frequencies.length);
          });
          break;
        }
        case 'sigh': {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.connect(g);
          g.connect(ctx.destination);
          osc.frequency.setValueAtTime(frequencies[0], now);
          osc.frequency.linearRampToValueAtTime(frequencies[1], now + duration);
          osc.type = 'sine';
          g.gain.setValueAtTime(gain, now);
          g.gain.linearRampToValueAtTime(0.001, now + duration);
          osc.start(now);
          osc.stop(now + duration);
          break;
        }
        case 'buzz': {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.connect(g);
          g.connect(ctx.destination);
          osc.frequency.value = frequencies[0];
          osc.type = 'square';
          g.gain.setValueAtTime(gain * 0.6, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + duration);
          osc.start(now);
          osc.stop(now + duration);
          break;
        }
        case 'pop': {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.connect(g);
          g.connect(ctx.destination);
          osc.frequency.setValueAtTime(frequencies[1] || 1200, now);
          osc.frequency.exponentialRampToValueAtTime(frequencies[0] || 800, now + duration);
          osc.type = 'sine';
          g.gain.setValueAtTime(gain, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + duration);
          osc.start(now);
          osc.stop(now + duration);
          break;
        }
        default:
          break;
      }
    },
  },
});
