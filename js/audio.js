'use strict';
/* =========================================================
 * audio.js — WebAudio 合成音效 (无需音频文件)
 * ========================================================= */

const Sound = {
  ctx: null, master: null, rainGain: null, muted: false,

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return; }
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.6;
    this.master.connect(this.ctx.destination);
    // 雨声: 白噪音 + 滤波
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'lowpass'; bp.frequency.value = 1400;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 300;
    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.value = 0;
    src.connect(bp); bp.connect(hp); hp.connect(this.rainGain); this.rainGain.connect(this.master);
    src.start();
  },

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.6;
  },

  setRain(v) {
    if (this.rainGain) this.rainGain.gain.setTargetAtTime(v * 0.12, this.ctx.currentTime, 0.5);
  },

  tone(freq, start, dur, type = 'sine', vol = 0.25) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + start;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  },

  // 入店铃声 (原创的三音)
  chime() { this.tone(988, 0, 0.6, 'sine', 0.18); this.tone(784, 0.18, 0.6, 'sine', 0.18); this.tone(1175, 0.36, 0.9, 'sine', 0.16); },
  coin() { this.tone(1318, 0, 0.12, 'square', 0.08); this.tone(1760, 0.08, 0.25, 'square', 0.08); },
  restock() { this.tone(220, 0, 0.12, 'triangle', 0.25); this.tone(330, 0.06, 0.12, 'triangle', 0.2); },
  angry() { this.tone(180, 0, 0.25, 'sawtooth', 0.08); this.tone(140, 0.12, 0.3, 'sawtooth', 0.08); },
  click() { this.tone(660, 0, 0.06, 'triangle', 0.12); },
};
