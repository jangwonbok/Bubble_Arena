// Web Audio API 기반 효과음 · 배경음 (외부 파일 없이 합성)
// public/assets/sounds 에 같은 이름의 파일(.mp3/.ogg)을 넣으면 그 파일을 우선 사용하도록 확장 가능.
const STORAGE_KEY = 'bubbleArena.sound';

export class AudioManager {
  constructor() {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    this.enabled = saved.enabled ?? true; // 효과음 ON/OFF
    this.volume = saved.volume ?? 0.7; // 효과음 볼륨
    this.musicOn = saved.music ?? true; // 배경음 ON/OFF
    this.musicVolume = saved.musicVolume ?? 0.6; // 배경음 볼륨
    this.ctx = null;
    this.bgmTimer = null;
    this.music = null;
    this.wanted = null;
    this.ducked = false;
    this.listeners = new Set();
    // 다른 탭/앱으로 가면 소리 멈춤, 돌아오면 재개 (모바일 배터리·예의)
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend();
      else this.ctx.resume();
    });
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
      this.musicBus.gain.value = 0;
      // 배경음 전용 컴프레서: 여러 파트가 겹쳐도 소리가 튀지 않게
      this.musicComp = this.ctx.createDynamicsCompressor();
      this.musicComp.threshold.value = -18;
      this.musicComp.ratio.value = 3;
      this.musicBus.connect(this.musicComp).connect(this.master);
      this.noiseBuf = this.makeNoise();
      this.applyVolume();
      if (this.wanted) this.playMusic(this.wanted.song, this.wanted); // 잠금 해제 전에 요청된 곡
    }
    if (this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume();
  }

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: this.enabled, volume: this.volume, music: this.musicOn, musicVolume: this.musicVolume }));
    this.listeners.forEach((fn) => fn());
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  applyVolume() {
    if (!this.master) return;
    const t = this.ctx.currentTime;
    // 효과음과 배경음은 따로 켜고 끄며 볼륨도 따로
    this.sfxBus.gain.setTargetAtTime(this.enabled ? this.volume : 0, t, 0.02);
    const music = this.musicOn ? this.musicVolume * 0.55 * (this.ducked ? 0.35 : 1) : 0;
    this.musicBus.gain.setTargetAtTime(music, t, 0.08);
  }

  setMusicVolume(v) {
    this.musicVolume = v;
    this.applyVolume();
    this.save();
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

  noise({ dur = 0.3, vol = 0.3, freq = 1200, to = 300, q = 0.8, delay = 0, type = 'lowpass', bus = null }) {
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
    s.connect(f).connect(g).connect(bus || this.sfxBus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  play(name) {
    if (!this.ctx || !this.enabled || document.hidden) return;
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
        // 승리 팡파르: 상승 아르페지오 + 마지막 화음
        [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone({ freq: f, type: 'triangle', dur: 0.22, vol: 0.2, delay: i * 0.13 }));
        [523, 659, 784, 1047].forEach((f) => this.tone({ freq: f, type: 'sine', dur: 1.1, vol: 0.09, delay: 0.82 }));
        this.noise({ dur: 0.6, vol: 0.08, freq: 9000, to: 4000, type: 'highpass', delay: 0.82 });
        break;
      case 'lose':
        [523, 466, 392, 330].forEach((f, i) => this.tone({ freq: f, type: 'triangle', dur: 0.3, vol: 0.2, delay: i * 0.2 }));
        this.tone({ freq: 262, to: 247, type: 'sine', dur: 0.9, vol: 0.12, delay: 0.8 });
        break;
      case 'ready':
        // 경기 시작 전 짧은 인트로 (카운트다운과 함께)
        [392, 523, 659].forEach((f, i) => this.tone({ freq: f, type: 'triangle', dur: 0.12, vol: 0.12, delay: i * 0.08 }));
        break;
      case 'hurry':
        // 남은 시간 30초: 경고 호루라기 두 번
        [0, 0.28].forEach((d) => {
          this.tone({ freq: 1400, to: 2000, type: 'square', dur: 0.18, vol: 0.08, delay: d });
          this.tone({ freq: 2000, to: 1400, type: 'triangle', dur: 0.12, vol: 0.08, delay: d + 0.16 });
        });
        break;
      case 'eliminatedMe':
        [659, 587, 523, 392].forEach((f, i) => this.tone({ freq: f, type: 'sine', dur: 0.22, vol: 0.16, delay: i * 0.12 }));
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

  // ======================= 배경음 (BGM) =======================
  // 외부 파일 없이 합성하는 4파트 스텝 시퀀서: 멜로디 · 아르페지오 · 베이스 · 드럼 (+ 화음 패드)
  // 곡: 'menu'(잔잔·몽글), 'game'(경쾌), 게임 중 남은 시간 30초 이하에는 'hurry'(빠르고 긴박)
  // 맵마다 조(key)와 멜로디 음색을 바꿔 분위기를 다르게 함.

  /** 재생할 곡 지정. 오디오가 아직 잠겨 있으면 잠금 해제(첫 터치/클릭) 순간 시작 */
  playMusic(song, opts = {}) {
    this.wanted = { song, ...opts };
    if (!this.ctx) return;
    const same = this.music && this.music.song === song && this.music.mapId === (opts.mapId || null);
    if (same && this.bgmTimer) return;
    this.stopMusic(true);
    this.music = { song, mapId: opts.mapId || null, step: 0, hurry: false };
    this.startScheduler();
  }

  /** 남은 시간이 적을 때: 템포·리듬을 올림 */
  setHurry(on) {
    if (this.music && this.music.song === 'game') this.music.hurry = on;
  }

  /** 일시정지 등에서 배경음을 잠시 작게 */
  duck(on) {
    this.ducked = on;
    this.applyVolume();
  }

  // 하위 호환 (기존 호출부)
  startMusic(mapId) {
    this.playMusic('game', { mapId });
  }

  stopMusic(quick = false) {
    clearInterval(this.bgmTimer);
    this.bgmTimer = null;
    this.music = null;
    if (!quick) this.wanted = null;
  }

  startScheduler() {
    const ctx = this.ctx;
    let next = ctx.currentTime + 0.08;
    const tick = () => {
      const m = this.music;
      if (!m) return;
      const song = SONGS[m.song];
      const bpm = song.bpm * (m.hurry ? 1.22 : 1);
      const step = 60 / bpm / 2; // 8분음표
      while (next < ctx.currentTime + 0.18) {
        this.musicStep(song, m, next - ctx.currentTime, step);
        next += step;
        m.step++;
      }
    };
    tick();
    this.bgmTimer = setInterval(tick, 30);
  }

  /** 한 스텝(8분음표)에 들어갈 음 예약 */
  musicStep(song, m, delay, step) {
    const len = song.melody.length;
    const i = m.step % len;
    const bar = Math.floor(i / 8);
    const beat = i % 8;
    const key = MAP_KEY[m.mapId] ?? 0;
    const lead = MAP_LEAD[m.mapId] || song.lead;
    const midi = (n) => 440 * Math.pow(2, (n + key - 69) / 12);
    const bus = this.musicBus;
    const chord = song.chords[bar % song.chords.length];

    // 멜로디 (-1 = 이전 음 이어서)
    const n = song.melody[i];
    if (n > 0) {
      let hold = 1;
      while (song.melody[(i + hold) % len] === -1 && hold < 8) hold++;
      const harsh = lead === 'sawtooth' || lead === 'square';
      this.note({ freq: midi(n), dur: step * hold * 0.92, type: lead, vol: song.leadVol * (harsh ? 0.55 : 1), delay, bus, vibrato: hold > 2, cutoff: harsh ? 2400 : 0 });
    }
    // 화음 패드 (마디 시작)
    if (beat === 0) for (const c of chord) this.note({ freq: midi(c + 60), dur: step * 7.6, type: 'sine', vol: song.padVol, delay, bus, attack: 0.08 });
    // 아르페지오
    if (song.arp && (beat % 2 === 1 || m.hurry)) {
      const tones = [chord[0], chord[1], chord[2], chord[0] + 12];
      this.note({ freq: midi(tones[(beat >> (m.hurry ? 0 : 1)) % 4] + 72), dur: step * 0.5, type: 'square', vol: 0.025, delay, bus, cutoff: 2600 });
    }
    // 베이스
    const bp = song.bass[beat];
    if (bp !== null) this.note({ freq: midi(chord[0] + 36 + bp), dur: step * 0.85, type: 'triangle', vol: song.bassVol, delay, bus });
    // 드럼
    const d = song.drums;
    if (d.kick.includes(beat)) this.kick(delay, bus, song.kickVol);
    if (d.snare.includes(beat) || (m.hurry && beat === 7 && bar % 2 === 1)) this.snare(delay, bus);
    if (d.hat) this.hat(delay, bus, beat % 2 ? 0.035 : 0.02);
    if (m.hurry) this.hat(delay + step / 2, bus, 0.018); // 16분 하이햇
  }

  /** 음악용 음 (부드러운 어택/릴리스 + 선택적 비브라토/필터) */
  note({ freq, dur, type = 'triangle', vol = 0.1, delay = 0, bus, attack = 0.012, vibrato = false, cutoff = 0 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    let out = g;
    if (vibrato) {
      const lfo = this.ctx.createOscillator();
      const lg = this.ctx.createGain();
      lfo.frequency.value = 5.5;
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(freq * 0.008, t + dur * 0.6);
      lfo.connect(lg).connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
    }
    if (cutoff) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = cutoff;
      o.connect(f).connect(g);
    } else o.connect(g);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.setValueAtTime(vol, t + Math.max(attack, dur * 0.6));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.04);
    out.connect(bus);
    o.start(t);
    o.stop(t + dur + 0.08);
  }

  kick(delay, bus, vol = 0.32) {
    this.tone({ freq: 150, to: 42, type: 'sine', dur: 0.16, vol, delay, bus });
  }

  snare(delay, bus) {
    this.noise({ dur: 0.12, vol: 0.12, freq: 2400, to: 1200, type: 'bandpass', q: 0.9, delay, bus });
    this.tone({ freq: 220, to: 160, type: 'triangle', dur: 0.06, vol: 0.06, delay, bus });
  }

  hat(delay, bus, vol) {
    this.noise({ dur: 0.035, vol, freq: 9000, to: 7000, type: 'highpass', q: 0.7, delay, bus });
  }
}

// ---------------- 곡 데이터 ----------------
// melody: 8분음표 64칸(8마디), MIDI 번호 (0 = 쉼표, -1 = 이어서). chords: 마디별 화음(근음 기준 반음 간격, C=0)
// bass: 마디 안 8칸 패턴 (근음 기준 반음, null = 쉼)
const C = [0, 4, 7];
const G = [7, 11, 14];
const Am = [9, 12, 16];
const F = [5, 9, 12];
const Em = [4, 7, 11];
const Dm = [2, 5, 9];
const SONGS = {
  game: {
    bpm: 128,
    lead: 'triangle',
    leadVol: 0.1,
    padVol: 0.022,
    bassVol: 0.16,
    kickVol: 0.3,
    arp: true,
    chords: [C, G, Am, F, C, G, F, G],
    melody: [
      76, -1, 79, -1, 84, -1, 83, 79,
      81, -1, 79, -1, 74, -1, 0, 0,
      72, -1, 76, 81, 79, -1, 76, -1,
      77, -1, 76, 74, 72, -1, -1, 0,
      79, 79, 84, -1, 79, 76, 79, -1,
      83, -1, 81, 79, 74, -1, 79, -1,
      81, -1, 77, 81, 84, -1, 83, 81,
      79, -1, -1, -1, 74, 76, 79, 83,
    ],
    bass: [0, null, 12, null, 0, 0, 12, null],
    drums: { kick: [0, 4, 6], snare: [2, 6], hat: true },
  },
  menu: {
    bpm: 96,
    lead: 'sine',
    leadVol: 0.11,
    padVol: 0.03,
    bassVol: 0.12,
    kickVol: 0.18,
    arp: true,
    chords: [F, G, Em, Am, F, G, Dm, G],
    melody: [
      0, 0, 81, -1, 79, -1, 77, -1,
      79, -1, -1, -1, 74, -1, 76, -1,
      76, -1, 79, -1, 83, -1, 81, -1,
      81, -1, -1, -1, 0, 0, 0, 0,
      0, 0, 84, -1, 83, -1, 81, -1,
      83, -1, 79, -1, 86, -1, 83, -1,
      77, -1, 81, -1, 77, -1, 74, -1,
      79, -1, -1, -1, -1, -1, 0, 0,
    ],
    bass: [0, null, null, null, 7, null, null, null],
    drums: { kick: [0], snare: [], hat: false },
  },
};
// 맵별 조(반음 이동)와 멜로디 음색
const MAP_KEY = { meadow: 0, ice: 2, volcano: -2, beach: 5, candy: 3, sky: 4, pirate: -3, castle: 1 };
const MAP_LEAD = { ice: 'sine', sky: 'sine', volcano: 'sawtooth', pirate: 'square' };
