// Web Audio API 기반 효과음 · 배경음 (외부 파일 없이 합성)
// public/assets/sounds 에 같은 이름의 파일(.mp3/.ogg)을 넣으면 그 파일을 우선 사용하도록 확장 가능.
const STORAGE_KEY = 'bubbleArena.sound';

export class AudioManager {
  constructor() {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    this.enabled = saved.enabled ?? true;
    this.volume = saved.volume ?? 0.7;
    this.musicOn = saved.music ?? true;
    this.ctx = null;
    this.bgmTimer = null;
    this.bgmStep = 0;
    this.listeners = new Set();
  }

  /** 사용자 입력 이후에만 AudioContext 생성 가능 (브라우저 정책) */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.32;
      this.musicBus.connect(this.master);
      this.noiseBuf = this.makeNoise();
      this.applyVolume();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: this.enabled, volume: this.volume, music: this.musicOn }));
    this.listeners.forEach((fn) => fn());
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  applyVolume() {
    if (!this.master) return;
    this.master.gain.setTargetAtTime(this.enabled ? this.volume : 0, this.ctx.currentTime, 0.02);
    this.musicBus.gain.setTargetAtTime(this.musicOn ? 0.32 : 0, this.ctx.currentTime, 0.05);
  }

  setEnabled(v) {
    this.enabled = v;
    this.applyVolume();
    this.save();
  }

  setVolume(v) {
    this.volume = v;
    this.applyVolume();
    this.save();
  }

  setMusic(v) {
    this.musicOn = v;
    this.applyVolume();
    this.save();
  }

  makeNoise() {
    const len = this.ctx.sampleRate * 1;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  tone({ freq = 440, to = null, type = 'sine', dur = 0.15, vol = 0.3, delay = 0, bus = null }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus || this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise({ dur = 0.3, vol = 0.3, freq = 1200, to = 300, q = 0.8, delay = 0, type = 'lowpass' }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.sfxBus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  play(name) {
    if (!this.ctx || !this.enabled) return;
    switch (name) {
      case 'click':
        this.tone({ freq: 880, to: 1320, type: 'triangle', dur: 0.08, vol: 0.18 });
        break;
      case 'place':
        this.tone({ freq: 260, to: 520, type: 'sine', dur: 0.12, vol: 0.35 });
        this.tone({ freq: 700, to: 400, type: 'triangle', dur: 0.06, vol: 0.12, delay: 0.03 });
        break;
      case 'explode':
        this.noise({ dur: 0.55, vol: 0.5, freq: 2400, to: 200, type: 'lowpass' });
        this.noise({ dur: 0.3, vol: 0.25, freq: 5000, to: 1500, type: 'bandpass', q: 1.5, delay: 0.02 });
        this.tone({ freq: 140, to: 50, type: 'sine', dur: 0.35, vol: 0.45 });
        break;
      case 'block':
        this.tone({ freq: 220, to: 120, type: 'square', dur: 0.08, vol: 0.08 });
        this.noise({ dur: 0.12, vol: 0.15, freq: 1500, to: 600, type: 'bandpass', q: 2 });
        break;
      case 'trap':
        for (let i = 0; i < 4; i++) this.tone({ freq: 400 + i * 160, to: 700 + i * 160, type: 'sine', dur: 0.1, vol: 0.2, delay: i * 0.05 });
        break;
      case 'rescue':
        [784, 988, 1175, 1568].forEach((f, i) => this.tone({ freq: f, type: 'triangle', dur: 0.14, vol: 0.18, delay: i * 0.06 }));
        break;
      case 'pop':
        this.tone({ freq: 900, to: 120, type: 'sine', dur: 0.25, vol: 0.4 });
        this.noise({ dur: 0.2, vol: 0.3, freq: 3000, to: 400, type: 'highpass' });
        break;
      case 'item':
        [660, 880, 1320].forEach((f, i) => this.tone({ freq: f, type: 'square', dur: 0.08, vol: 0.09, delay: i * 0.05 }));
        break;
      case 'count':
        this.tone({ freq: 660, type: 'square', dur: 0.12, vol: 0.12 });
        break;
      case 'go':
        this.tone({ freq: 990, type: 'square', dur: 0.3, vol: 0.14 });
        this.tone({ freq: 1320, type: 'triangle', dur: 0.3, vol: 0.1, delay: 0.05 });
        break;
      case 'win':
        [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone({ freq: f, type: 'triangle', dur: 0.22, vol: 0.2, delay: i * 0.13 }));
        break;
      case 'lose':
        [523, 466, 392, 330].forEach((f, i) => this.tone({ freq: f, type: 'triangle', dur: 0.3, vol: 0.2, delay: i * 0.2 }));
        break;
      case 'tick':
        this.tone({ freq: 1200, type: 'sine', dur: 0.05, vol: 0.08 });
        break;
      // 맵 위험 지역
      case 'warn':
        [0, 0.18, 0.36].forEach((d) => this.tone({ freq: 880, to: 660, type: 'square', dur: 0.12, vol: 0.07, delay: d }));
        break;
      case 'eruption':
        this.noise({ dur: 0.9, vol: 0.5, freq: 900, to: 80, type: 'lowpass' });
        this.tone({ freq: 90, to: 40, type: 'sawtooth', dur: 0.6, vol: 0.25 });
        break;
      case 'wave':
        this.noise({ dur: 1.1, vol: 0.4, freq: 400, to: 3000, type: 'bandpass', q: 0.7 });
        this.noise({ dur: 0.8, vol: 0.25, freq: 3000, to: 500, type: 'lowpass', delay: 0.4 });
        break;
      case 'shield':
        [1200, 1600].forEach((f, i) => this.tone({ freq: f, to: f * 0.7, type: 'triangle', dur: 0.2, vol: 0.18, delay: i * 0.06 }));
        break;
      case 'life':
        [523, 659, 784, 1047].forEach((f, i) => this.tone({ freq: f, type: 'sine', dur: 0.18, vol: 0.2, delay: i * 0.07 }));
        break;
      case 'slow':
        this.tone({ freq: 800, to: 200, type: 'sine', dur: 0.6, vol: 0.2 });
        break;
      case 'detonate':
        this.tone({ freq: 1800, type: 'square', dur: 0.05, vol: 0.1 });
        this.tone({ freq: 1800, type: 'square', dur: 0.05, vol: 0.1, delay: 0.08 });
        break;
      case 'push':
        this.noise({ dur: 0.18, vol: 0.18, freq: 600, to: 200, type: 'lowpass' });
        this.tone({ freq: 160, to: 110, type: 'triangle', dur: 0.15, vol: 0.12 });
        break;
      case 'fall':
        this.tone({ freq: 900, to: 120, type: 'sine', dur: 0.8, vol: 0.25 });
        break;
      case 'tide':
        this.noise({ dur: 1.6, vol: 0.4, freq: 300, to: 2500, type: 'bandpass', q: 0.6 });
        this.noise({ dur: 1.0, vol: 0.25, freq: 2500, to: 400, type: 'lowpass', delay: 0.6 });
        break;
      case 'crumble':
        for (let i = 0; i < 4; i++) this.noise({ dur: 0.15, vol: 0.2, freq: 1800, to: 300, type: 'bandpass', q: 2, delay: i * 0.08 });
        break;
      default:
        break;
    }
  }

  // 간단한 루프 배경음 (스텝 시퀀서)
  startMusic() {
    if (!this.ctx || this.bgmTimer) return;
    const bpm = 132;
    const step = 60 / bpm / 2;
    const mel = [72, 0, 76, 79, 77, 0, 76, 72, 74, 0, 77, 81, 79, 77, 76, 74, 72, 0, 76, 79, 81, 79, 77, 76, 74, 76, 77, 74, 72, 0, 0, 0];
    const bass = [48, 48, 55, 55, 53, 53, 50, 50];
    const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
    let next = this.ctx.currentTime + 0.05;
    this.bgmStep = 0;
    const schedule = () => {
      while (next < this.ctx.currentTime + 0.2) {
        const i = this.bgmStep % mel.length;
        const delay = next - this.ctx.currentTime;
        if (mel[i]) this.tone({ freq: midi(mel[i]), type: 'triangle', dur: step * 0.9, vol: 0.12, delay, bus: this.musicBus });
        if (i % 4 === 0) this.tone({ freq: midi(bass[(i / 4) % bass.length]), type: 'sine', dur: step * 3, vol: 0.22, delay, bus: this.musicBus });
        if (i % 2 === 1) this.tone({ freq: 2400, to: 1800, type: 'square', dur: 0.02, vol: 0.015, delay, bus: this.musicBus });
        next += step;
        this.bgmStep++;
      }
    };
    this.bgmTimer = setInterval(schedule, 50);
  }

  stopMusic() {
    clearInterval(this.bgmTimer);
    this.bgmTimer = null;
  }
}
