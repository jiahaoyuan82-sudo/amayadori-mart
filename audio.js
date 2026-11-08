'use strict';
/* =========================================================
 * audio.js — WebAudio 合成音效 + 背景音乐 (无需音频文件)
 * ========================================================= */

const Sound = {
  ctx: null, master: null, sfx: null, bgmBus: null, bgmFilter: null, rainGain: null,
  muted: false, musicOn: true,

  init() {
    if (this.ctx) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : 0.7;
    this.master.connect(c.destination);
    // 音效总线: 削掉刺耳的高频
    const sfxLP = c.createBiquadFilter(); sfxLP.type = 'lowpass'; sfxLP.frequency.value = 3200;
    this.sfx = c.createGain(); this.sfx.gain.value = 0.9;
    this.sfx.connect(sfxLP); sfxLP.connect(this.master);
    // 音乐总线
    this.bgmFilter = c.createBiquadFilter(); this.bgmFilter.type = 'lowpass'; this.bgmFilter.frequency.value = 2400;
    this.bgmBus = c.createGain(); this.bgmBus.gain.value = this.musicOn ? 0.22 : 0;
    this.bgmBus.connect(this.bgmFilter); this.bgmFilter.connect(this.master);
    // 雨声
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 300;
    this.rainGain = c.createGain(); this.rainGain.gain.value = 0;
    src.connect(lp); lp.connect(hp); hp.connect(this.rainGain); this.rainGain.connect(this.master);
    src.start();
    Music.start();
  },

  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.05); },
  setMusic(on) { this.musicOn = on; if (this.bgmBus) this.bgmBus.gain.setTargetAtTime(on ? 0.22 : 0, this.ctx.currentTime, 0.4); },
  setRain(v) { if (this.rainGain) this.rainGain.gain.setTargetAtTime(v * 0.1, this.ctx.currentTime, 0.5); },
  setNight(n) { if (this.bgmFilter) this.bgmFilter.frequency.setTargetAtTime(2400 - n * 1100, this.ctx.currentTime, 2); },

  /** 柔和的音: attack 起音时间, out 输出总线 */
  tone(freq, start, dur, type = 'sine', vol = 0.2, attack = 0.012, out) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + start;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out || this.sfx);
    o.start(t); o.stop(t + dur + 0.05);
  },

  // 入店铃: 低一点、圆润的「叮—咚」, 带一点泛音
  chime() {
    const ding = (f, s) => { this.tone(f, s, 1.6, 'sine', 0.09, 0.03); this.tone(f * 2, s, 0.7, 'sine', 0.015, 0.03); this.tone(f / 2, s, 1.2, 'triangle', 0.03, 0.04); };
    ding(587.3, 0); ding(440, 0.42);
  },
  coin() { this.tone(784, 0, 0.18, 'triangle', 0.08); this.tone(1046.5, 0.07, 0.3, 'triangle', 0.07); },
  restock() { this.tone(196, 0, 0.14, 'triangle', 0.16); this.tone(262, 0.06, 0.14, 'triangle', 0.12); },
  angry() { this.tone(196, 0, 0.25, 'triangle', 0.1); this.tone(165, 0.13, 0.35, 'triangle', 0.1); },
  click() { this.tone(520, 0, 0.07, 'sine', 0.08, 0.005); },
  thump() { this.tone(110, 0, 0.18, 'triangle', 0.14); this.tone(82, 0.07, 0.22, 'triangle', 0.12); },
};

/* =========================================================
 * 背景音乐: 程序生成的 lo-fi 爵士 (每次播放都有点不一样)
 * ========================================================= */
const Music = {
  bpm: 74, step: 0, next: 0, timer: null, bar: 0,
  // 和弦进行 (MIDI): Fmaj7 - Em7 - Dm7 - Cmaj7 / Fmaj7 - Em7 - Am7 - G7sus
  prog: [
    [53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59],
    [53, 57, 60, 64], [52, 55, 59, 62], [45, 48, 52, 55], [43, 48, 50, 53],
  ],
  scale: [72, 74, 76, 79, 81, 84, 86],   // C 大调五声音阶
  mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); },

  start() {
    if (this.timer || !Sound.ctx) return;
    this.next = Sound.ctx.currentTime + 0.3;
    this.timer = setInterval(() => this.schedule(), 120);
  },
  schedule() {
    const c = Sound.ctx;
    if (!c || c.state !== 'running') return;
    const s16 = 60 / this.bpm / 4;
    while (this.next < c.currentTime + 0.4) {
      this.play(this.step, this.next);
      // 轻微的摇摆感
      this.next += s16 * (this.step % 2 ? 0.86 : 1.14);
      this.step = (this.step + 1) % 16;
      if (this.step === 0) this.bar = (this.bar + 1) % this.prog.length;
    }
  },
  epiano(m, t, dur, vol) {
    const c = Sound.ctx, f = this.mtof(m), out = Sound.bgmBus;
    for (const [mul, v, det] of [[1, 1, -4], [1, 0.6, 5], [2, 0.12, 0]]) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = f * mul; o.detune.value = det;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * v, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
    }
  },
  play(step, t) {
    const c = Sound.ctx, chord = this.prog[this.bar], out = Sound.bgmBus;
    // 和弦 (每小节第 1 拍, 偶尔在第 3 拍补一下)
    if (step === 0) chord.forEach((m, i) => this.epiano(m, t + i * 0.012, 3.2, 0.11));
    if (step === 10 && Math.random() < 0.5) chord.slice(1).forEach(m => this.epiano(m + 12, t, 1.4, 0.04));
    // 贝斯
    if (step === 0 || step === 8 || (step === 14 && Math.random() < 0.4)) {
      const root = chord[0] - 12 + (step === 14 ? 7 : 0);
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'triangle'; o.frequency.value = this.mtof(root);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 1);
    }
    // 轻轻的鼓: 底鼓 + 闷闷的军鼓 + 沙沙的踩镲
    if (step === 0 || step === 7 || step === 10) {
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
      g.gain.setValueAtTime(0.32, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.3);
    }
    const noiseHit = (vol, dur, freq, type) => {
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = Sound.noise; f.type = type; f.frequency.value = freq;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random()); s.stop(t + dur + 0.02);
    };
    if (step === 4 || step === 12) noiseHit(0.09, 0.18, 1800, 'bandpass');
    if (step % 2 === 0) noiseHit(step % 4 ? 0.025 : 0.04, 0.05, 7000, 'highpass');
    // 旋律: 稀疏随机的五声音阶
    if (step % 2 === 0 && Math.random() < 0.22) {
      const m = this.scale[(Math.random() * this.scale.length) | 0];
      const o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
      o.type = 'sine'; o.frequency.value = this.mtof(m);
      lfo.frequency.value = 5; lg.gain.value = 3; lfo.connect(lg); lg.connect(o.frequency);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      o.connect(g); g.connect(out); o.start(t); lfo.start(t); o.stop(t + 1.2); lfo.stop(t + 1.2);
    }
  },
};
