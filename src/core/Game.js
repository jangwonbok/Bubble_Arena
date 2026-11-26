import { CONFIG, TILE, TERRAIN } from './Config.js';
import { EventBus } from './EventBus.js';
import { SceneManager } from './SceneManager.js';
import { Input } from './Input.js';
import { AudioManager } from './AudioManager.js';
import { Assets } from './Assets.js';
import { createRng, randomSeed } from './rng.js';
import { MatchSimulation, RULESETS } from './MatchSimulation.js';
import { MapGrid } from '../map/MapGrid.js';
import { MapView } from '../map/MapView.js';
import { getMap, resolveMapId } from '../maps/index.js';
import { CHARACTER_DEFS } from '../characters/characterDefs.js';
import { Character, STATE } from '../characters/Character.js';
import { CharacterModel } from '../characters/CharacterModel.js';
import { loadModel, instantiate, renderPortrait, disposePortraitRenderer } from '../characters/ModelLibrary.js';
import { Portraits } from '../ui/dom.js';
import { BombView } from '../systems/views/BombView.js';
import { EffectsView } from '../systems/views/EffectsView.js';
import { ItemView } from '../systems/views/ItemView.js';
import { HazardView } from '../systems/views/HazardView.js';
import { OnlineSession } from '../net/OnlineSession.js';
import { OnlineMatch } from '../net/OnlineMatch.js';
import { UIManager } from '../ui/UIManager.js';

const RECORD_KEY = 'bubbleArena.records';
const AI_ORDER = ['aggressive', 'balanced', 'survival'];

/**
 * 게임 상태 머신 + 메인 루프.
 * mode: 'single' | 'practice' (브라우저에서 MatchSimulation 실행) | 'online' (서버 판정, OnlineMatch로 동기화)
 * state: menu → countdown → playing → (paused) → ended
 */
export class Game {
  constructor(canvas, uiRoot) {
    Assets.init();
    this.bus = new EventBus();
    this.sm = new SceneManager(canvas);
    this.input = new Input();
    this.audio = new AudioManager();

    const scene = this.sm.scene;
    this.mapView = new MapView(scene, this.bus);
    this.models = CHARACTER_DEFS.map((d) => new CharacterModel(d, scene)); // 외형(def.id)별 모델
    this.bombView = new BombView(scene, this.bus, CHARACTER_DEFS);
    this.itemView = new ItemView(scene, this.bus, this.sm.renderer);
    this.effects = new EffectsView(scene, this.bus, this.sm);
    this.hazardView = new HazardView(scene, this.bus, { effects: this.effects, mapView: this.mapView, sm: this.sm });

    this.mode = 'menu';
    this.state = 'menu';
    this.sim = null;
    this.online = null;
    this.characters = [];
    this.player = null;
    this.records = JSON.parse(localStorage.getItem(RECORD_KEY) || '{"best":0,"wins":0,"plays":0}');

    this.loadCharacterModels();
    this.session = new OnlineSession(this);
    this.bindEvents();
    this.ui = new UIManager(uiRoot, this);
    this.input.on('pause', () => this.togglePause());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing' && this.mode !== 'online') this.pause();
    });

    this.setupMenuScene('meadow');
    this.enterMenu();

    this.last = performance.now();
    this.time = 0;
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);

    // 초대 링크로 들어온 경우 친구 초대전 대기방으로
    const code = new URLSearchParams(location.search).get('room');
    if (code) this.ui.show('lobby', { mode: 'friend', code: code.toUpperCase() });
  }

  /** GLB 캐릭터 모델 비동기 로드. 실패하면 기본(절차적) 모델 유지 */
  loadCharacterModels() {
    const jobs = CHARACTER_DEFS.map((def) =>
      loadModel(def.model)
        .then((info) => {
          this.models[def.id].attachGLB(instantiate(info, this.itemView.envMap));
          try {
            Portraits.set(def.id, renderPortrait(info));
          } catch (e) {
            console.warn('[portrait]', def.model, e);
          }
        })
        .catch((e) => console.warn(`[model] ${def.model}.glb 로드 실패 → 기본 모델 사용`, e)),
    );
    this.modelsReady = Promise.all(jobs).then(() => disposePortraitRenderer());
  }

  get world() {
    return this.sim?.world ?? this.online?.world ?? this.menuWorld;
  }

  get grid() {
    return this.world?.grid;
  }

  get timeLeft() {
    return this.sim?.timeLeft ?? this.online?.timeLeft ?? CONFIG.GAME_TIME;
  }

  get mapDef() {
    return this.sim?.mapDef ?? this.online?.mapDef ?? this.menuMap;
  }

  modelFor(c) {
    return this.models[c.def.id];
  }

  bindEvents() {
    let lastExplode = 0;
    let lastBlock = 0;
    const b = this.bus;
    const a = this.audio;
    b.on('bombPlaced', () => a.play('place'));
    b.on('bombExploded', () => {
      if (this.time - lastExplode > 0.06) a.play('explode');
      lastExplode = this.time;
    });
    b.on('blockDestroyed', () => {
      if (this.time - lastBlock > 0.05) a.play('block');
      lastBlock = this.time;
    });
    b.on('trapped', () => a.play('trap'));
    b.on('rescued', () => a.play('rescue'));
    b.on('eliminated', ({ c, cause }) => {
      a.play(cause === 'lava' ? 'eruption' : cause === 'fall' ? 'fall' : 'pop');
      if (this.mode === 'online' && c === this.player) this.ui.toast('💦 탈락! 남은 경기를 관전합니다');
    });
    b.on('itemRemoved', ({ by }) => by && a.play('item'));
    b.on('hazardWarn', () => a.play('warn'));
    b.on('hazardActive', ({ hazard }) => a.play(hazard.kind));
    b.on('respawned', ({ c }) => {
      c.deathCause = null;
      this.modelFor(c).reset(c);
    });
    b.on('blockPushed', () => a.play('push'));
    b.on('shieldBlocked', () => a.play('shield'));
    b.on('lifeUsed', () => a.play('life'));
    b.on('slowed', () => a.play('slow'));
    b.on('detonated', () => a.play('detonate'));
    b.on('netNotice', ({ kind, c }) => {
      const t = { dc: '접속이 끊겼습니다 (AI가 대신 조종)', rc: '다시 접속했습니다', left: '방을 나갔습니다 (AI가 대신 조종)' }[kind];
      if (c && t) this.ui.toast(`<b style="color:${c.def.css}">${c.name}</b> ${t}`);
    });
  }

  clearViews() {
    this.bombView.clear();
    this.itemView.clear();
    this.effects.clear();
    this.hazardView.clear();
  }

  showModels(chars) {
    for (const m of this.models) m.root.visible = false;
    for (const c of chars) this.modelFor(c).reset(c);
  }

  applyMap(grid, def) {
    this.mapView.build(grid, def);
    this.sm.applyEnvironment(def.env);
  }

  /** 메인 화면 / 맵 미리보기용 배경 */
  setupMenuScene(mapId = 'meadow') {
    this.clearViews();
    const def = getMap(mapId);
    const grid = new MapGrid(def.size);
    grid.generate(def, createRng(7));
    const row = Math.floor(grid.size / 2);
    for (let x = 2; x <= grid.size - 3; x++) {
      if (grid.get(x, row) !== TILE.PILLAR && grid.get(x, row) !== TILE.WALL) grid.set(x, row, TILE.EMPTY);
      grid.terrain[grid.idx(x, row)] = TERRAIN.NONE;
    }
    this.menuMap = def;
    this.menuWorld = { grid };
    this.applyMap(grid, def);
    const chars = CHARACTER_DEFS.map((d, i) => new Character(d, { slot: i, controller: i === 0 ? 'local' : 'ai' }));
    chars.forEach((c, i) => {
      c.reset({ x: row - 3 + i * 2, z: row });
      c.result = 'win';
    });
    this.sim = null;
    this.online = null;
    this.characters = chars;
    this.player = chars[0];
    this.showModels(chars);
  }

  enterMenu() {
    this.mode = 'menu';
    this.state = 'menu';
    this.sm.setMode('menu');
    this.ui.show('start');
  }

  // ---------------- 싱글 / AI 연습전 ----------------
  startLocal({ mode = 'single', mapId = 'random', charId = 0 } = {}) {
    this.audio.unlock();
    this.audio.startMusic();
    this.lastLocal = { mode, mapId, charId };
    this.mode = mode;
    this.online = null;

    const def = getMap(resolveMapId(mapId));
    const pDef = CHARACTER_DEFS[charId] || CHARACTER_DEFS[0];
    const chars = [new Character(pDef, { slot: 0, controller: 'local', name: pDef.name })];
    CHARACTER_DEFS.filter((d) => d !== pDef).forEach((d, i) =>
      chars.push(new Character(d, { slot: i + 1, controller: 'ai', personality: AI_ORDER[i], name: d.name })),
    );

    this.clearViews();
    this.sim = new MatchSimulation({ bus: this.bus, mapDef: def, characters: chars, rules: RULESETS[mode], seed: randomSeed() });
    this.characters = chars;
    this.player = chars[0];
    this.applyMap(this.sim.grid, def);
    this.showModels(chars);
    this.beginCountdown(CONFIG.COUNTDOWN + 0.6);
  }

  beginCountdown(seconds) {
    this.input.reset();
    this.sm.setMode('game');
    this.outcome = null;
    this.paused = false;
    this.lastTick = null;
    this.countdown = seconds;
    this.lastCount = null;
    this.state = seconds > 0 ? 'countdown' : 'playing';
    this.ui.show('hud');
  }

  // ---------------- 온라인 ----------------
  startOnline(startMsg) {
    this.audio.unlock();
    this.audio.startMusic();
    this.mode = 'online';
    this.sim = null;
    this.clearViews();
    this.online = new OnlineMatch(this, startMsg);
    this.characters = this.online.characters;
    this.player = this.online.me;
    this.applyMap(this.online.grid, this.online.mapDef);
    this.showModels(this.characters);
    this.online.replayInitialState();
    this.beginCountdown(startMsg.countdown);
    if (startMsg.rejoin) this.ui.toast('🔌 경기에 다시 접속했습니다');
  }

  onOnlineEnd(msg) {
    if (!this.online) return;
    const r = this.online.applyEnd(msg);
    const me = this.player;
    this.finishCommon({
      reason: r.reason,
      ranking: r.ranking,
      winner: r.winner,
      playerWin: r.winner === me && me.state !== STATE.DEAD,
      save: true,
    });
  }

  onConnectionLost() {
    this.ui.toast('⚠ 서버 연결이 끊어졌습니다');
    if (this.mode === 'online') this.toMenu();
  }

  // ---------------- 공통 흐름 ----------------
  restart() {
    if (this.mode === 'online') {
      // 온라인: 같은 방 대기실로 복귀
      this.online = null;
      this.state = 'menu';
      this.sm.setMode('menu');
      this.ui.show('lobby', { mode: this.session.room?.mode === 'public' ? 'public' : 'friend' });
      return;
    }
    this.startLocal(this.lastLocal);
  }

  toMenu() {
    if (this.mode === 'online' || this.session.room) this.session.leave();
    this.audio.stopMusic();
    this.setupMenuScene(this.mapDef?.id || 'meadow');
    this.enterMenu();
  }

  pause() {
    if (this.state !== 'playing' && this.state !== 'countdown') return;
    this.input.reset();
    if (this.mode === 'online') {
      // 온라인은 멈출 수 없음 → 메뉴만 열고 조작 차단
      this.paused = true;
      this.ui.show('pause');
      return;
    }
    this.pausedFrom = this.state;
    this.state = 'paused';
    this.ui.show('pause');
  }

  resume() {
    if (this.mode === 'online') {
      this.paused = false;
      this.ui.show('hud');
      return;
    }
    if (this.state !== 'paused') return;
    this.state = this.pausedFrom || 'playing';
    this.last = performance.now();
    this.ui.show('hud');
  }

  togglePause() {
    if (this.ui.current === 'pause') this.resume();
    else this.pause();
  }

  frame(now) {
    requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;

    if (this.state === 'countdown') this.updateCountdown(dt);
    else if (this.state === 'playing') this.updatePlaying(dt);
    else if (this.state === 'ended') this.updateEnded(dt);

    const animDt = this.state === 'paused' ? 0 : dt;
    const t = this.time;
    for (const c of this.characters) this.modelFor(c).update(animDt, c, t);
    this.mapView.update(animDt, t, this.world?.platforms);
    this.bombView.update(animDt, t);
    this.itemView.update(animDt, t);
    this.effects.update(animDt, t);
    this.hazardView.update(animDt, t);
    this.sm.update(dt, t);
    this.sm.render();
    this.ui.update(dt);
  }

  updateCountdown(dt) {
    if (this.online) this.online.update(dt, false);
    this.countdown -= dt;
    const n = Math.ceil(this.countdown - 0.6);
    if (n !== this.lastCount) {
      this.lastCount = n;
      if (n > 0) {
        this.ui.countdown(String(n));
        this.audio.play('count');
      } else {
        this.ui.countdown('START!');
        this.audio.play('go');
      }
    }
    if (this.countdown <= 0) {
      this.state = 'playing';
      setTimeout(() => this.ui.countdown(null), 500);
    }
  }

  updatePlaying(dt) {
    if (this.online) {
      this.online.update(dt, !this.paused);
    } else {
      const p = this.player;
      if (p.canAct) {
        p.intentDir = this.input.getDirection();
        p.intentBomb = this.input.consumeBomb();
        p.intentDetonate = this.input.consumeDetonate();
      } else {
        p.intentDir = null;
        p.intentBomb = false;
        this.input.consumeBomb();
        this.input.consumeDetonate();
      }
      this.sim.step(dt);
      if (this.sim.outcome) this.onLocalEnd();
    }

    const tl = this.timeLeft;
    if (tl <= 10 && tl > 0 && Math.ceil(tl) !== this.lastTick) {
      this.lastTick = Math.ceil(tl);
      this.audio.play('tick');
    }
  }

  onLocalEnd() {
    const o = this.sim.outcome;
    const ranking = o.ranking.map((id) => this.characters[id]);
    const winner = this.characters[o.winnerId];
    this.finishCommon({
      reason: o.reason,
      ranking,
      winner,
      playerWin: winner === this.player && this.player.state !== STATE.DEAD,
      save: this.sim.rules.saveRecords,
    });
  }

  finishCommon({ reason, ranking, winner, playerWin, save }) {
    let newBest = false;
    if (save) {
      this.records.plays++;
      if (playerWin) this.records.wins++;
      newBest = this.player.score > this.records.best;
      if (newBest) this.records.best = this.player.score;
      localStorage.setItem(RECORD_KEY, JSON.stringify(this.records));
    }
    this.outcome = { reason, ranking, winner, playerWin, newBest, mode: this.mode };
    this.state = 'ended';
    this.endTimer = 1.6;
    this.paused = false;
    this.audio.play(playerWin ? 'win' : 'lose');
    this.ui.banner(playerWin ? 'WIN!' : reason === 'timeUp' ? 'TIME UP' : 'LOSE');
    if (this.ui.current === 'pause') this.ui.show('hud');
  }

  updateEnded(dt) {
    if (this.endTimer > 0) {
      this.endTimer -= dt;
      if (this.endTimer <= 0) {
        this.ui.banner(null);
        this.ui.show('result');
      }
    }
  }
}
