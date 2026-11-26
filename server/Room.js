import { EventBus } from '../src/core/EventBus.js';
import { CONFIG, NET } from '../src/core/Config.js';
import { randomSeed } from '../src/core/rng.js';
import { MatchSimulation, RULESETS } from '../src/core/MatchSimulation.js';
import { getMap, resolveMapId, isValidMapChoice, MAP_IDS } from '../src/maps/index.js';
import { Character } from '../src/characters/Character.js';
import { CHARACTER_DEFS } from '../src/characters/characterDefs.js';
import { MovementSystem } from '../src/systems/MovementSystem.js';
import { BombSystem } from '../src/systems/BombSystem.js';
import { packChar, serializeEvent, SIM_EVENTS, decodeDir, isInt } from '../src/net/protocol.js';

const AI_PERSONALITIES = ['aggressive', 'balanced', 'survival'];
const TICK_DT = 1 / NET.TICK_RATE;
const MAX_QUEUE = 10; // 클라이언트 입력 버퍼 상한
const MAX_CREDIT = 4; // 지터 흡수용 입력 처리 크레딧 (속도 핵 방지: 장기 평균은 틱당 1개)
const REJOIN_GRACE_MS = 60_000;
const LOBBY_GRACE_MS = 10_000;

/**
 * 게임방 하나 = 독립적인 대기방 상태 + 독립적인 MatchSimulation.
 * 서버가 모든 판정(이동/물풍선/폭발/피격/아이템/맵 효과/승패)을 수행하고
 * 클라이언트에는 입력만 받는다.
 */
export class Room {
  constructor(manager, code, mode) {
    this.manager = manager;
    this.code = code;
    this.mode = mode; // 'public' | 'friend'
    this.players = [];
    this.hostId = null;
    this.mapChoice = 'random';
    this.fillAI = true;
    this.state = 'lobby';
    this.sim = null;
    this.timer = null;
    this.createdAt = Date.now();
  }

  get humanCount() {
    return this.players.length;
  }

  log(...a) {
    console.log(`[room ${this.code}]`, ...a);
  }

  // ---------------- 대기방 ----------------
  addPlayer(p) {
    if (this.players.length >= NET.MAX_PLAYERS) return 'full';
    if (this.state !== 'lobby') return 'playing';
    if (this.players.some((o) => o.charId === p.charId)) p.charId = this.freeCharId();
    p.room = this;
    p.ready = false;
    p.slot = null;
    p.vote = null;
    this.players.push(p);
    if (!this.hostId) this.hostId = p.id;
    this.log(`join ${p.name} (${this.players.length})`);
    this.broadcastRoom();
    return null;
  }

  freeCharId(except = null) {
    const used = new Set(this.players.filter((o) => o !== except).map((o) => o.charId));
    return CHARACTER_DEFS.find((d) => !used.has(d.id))?.id ?? 0;
  }

  removePlayer(p, reason = 'leave') {
    const i = this.players.indexOf(p);
    if (i < 0) return;
    this.players.splice(i, 1);
    clearTimeout(p.graceTimer);
    p.room = null;
    if (this.state === 'playing' && p.slot != null) {
      const c = this.sim.characters[p.slot];
      c.controller = 'ai'; // 남은 경기는 AI가 대신 진행
      this.events.push({ k: 'left', c: p.slot });
    }
    if (this.hostId === p.id) this.hostId = this.players.find((o) => o.connected)?.id ?? this.players[0]?.id ?? null;
    this.log(`${reason} ${p.name}`);
    if (!this.players.length) return this.destroy();
    if (this.state === 'playing' && !this.players.some((o) => o.connected)) return this.destroy();
    this.broadcastRoom();
  }

  destroy() {
    this.stopLoop();
    this.state = 'closed';
    this.manager.removeRoom(this);
    this.log('closed');
  }

  roomState() {
    const votes = {};
    for (const p of this.players) if (p.vote) votes[p.vote] = (votes[p.vote] || 0) + 1;
    return {
      type: 'room',
      code: this.code,
      mode: this.mode,
      hostId: this.hostId,
      state: this.state,
      mapChoice: this.mapChoice,
      fillAI: this.fillAI,
      votes,
      players: this.players.map((p) => ({ id: p.id, name: p.name, charId: p.charId, ready: p.ready, connected: p.connected, vote: p.vote })),
    };
  }

  broadcastRoom() {
    this.broadcast(this.roomState());
  }

  broadcast(msg) {
    const s = JSON.stringify(msg);
    for (const p of this.players) p.sendRaw?.(s);
  }

  canStart() {
    if (this.state !== 'lobby') return '이미 게임 중입니다';
    const others = this.players.filter((p) => p.id !== this.hostId);
    if (others.some((p) => !p.ready)) return '모든 플레이어가 준비해야 합니다';
    if (!this.players.every((p) => p.connected)) return '접속이 끊긴 플레이어가 있습니다';
    const total = this.fillAI ? NET.MAX_PLAYERS : this.players.length;
    if (total < 2) return '2명 이상 필요합니다 (AI 채우기를 켜 주세요)';
    return null;
  }

  handle(p, msg) {
    const isHost = p.id === this.hostId;
    switch (msg.type) {
      case 'profile':
        if (this.state !== 'lobby') return;
        if (isInt(msg.charId, 0, CHARACTER_DEFS.length - 1)) {
          if (this.players.some((o) => o !== p && o.charId === msg.charId)) return p.send({ type: 'error', msg: '이미 선택된 캐릭터입니다' });
          p.charId = msg.charId;
        }
        this.broadcastRoom();
        return;
      case 'ready':
        if (this.state !== 'lobby') return;
        p.ready = !!msg.v;
        return this.broadcastRoom();
      case 'map':
        if (!isHost || this.state !== 'lobby' || !isValidMapChoice(msg.id)) return;
        this.mapChoice = msg.id;
        return this.broadcastRoom();
      case 'vote':
        if (this.mode !== 'friend' || this.state !== 'lobby' || !isValidMapChoice(msg.id)) return;
        p.vote = msg.id;
        return this.broadcastRoom();
      case 'fill':
        if (!isHost || this.state !== 'lobby') return;
        this.fillAI = !!msg.v;
        return this.broadcastRoom();
      case 'start': {
        if (!isHost) return;
        const err = this.canStart();
        if (err) return p.send({ type: 'error', msg: err });
        return this.start();
      }
      case 'input':
        return this.onInput(p, msg);
      default:
    }
  }

  /** 친구 초대전: 투표 집계 (동률이면 무작위, 투표 없으면 방장 선택) */
  pickMap() {
    if (this.mode === 'friend') {
      const tally = new Map();
      for (const p of this.players) if (p.vote) tally.set(p.vote, (tally.get(p.vote) || 0) + 1);
      if (tally.size) {
        const max = Math.max(...tally.values());
        const top = [...tally].filter(([, v]) => v === max).map(([k]) => k);
        return resolveMapId(top[Math.floor(Math.random() * top.length)]);
      }
    }
    return resolveMapId(this.mapChoice);
  }

  // ---------------- 경기 ----------------
  start() {
    const mapId = this.pickMap();
    const mapDef = getMap(mapId);
    const seed = randomSeed();

    // 슬롯 구성: 사람 → AI 채우기
    const chars = [];
    this.players.forEach((p, i) => {
      p.slot = i;
      p.inputQ = [];
      p.credit = 0;
      p.lastSeq = 0;
      p.ack = 0;
      chars.push(new Character(CHARACTER_DEFS[p.charId], { slot: i, controller: 'remote', name: p.name, human: true }));
    });
    if (this.fillAI) {
      const used = new Set(this.players.map((p) => p.charId));
      const free = CHARACTER_DEFS.filter((d) => !used.has(d.id));
      let k = 0;
      while (chars.length < NET.MAX_PLAYERS && free.length) {
        const d = free.shift();
        const personality = AI_PERSONALITIES[k++ % AI_PERSONALITIES.length];
        chars.push(new Character(d, { slot: chars.length, controller: 'ai', personality, name: `${d.name} (AI)`, human: false }));
      }
    }

    this.bus = new EventBus();
    this.events = [];
    for (const type of SIM_EVENTS) {
      this.bus.on(type, (payload) => {
        const e = serializeEvent(type, payload);
        if (e) this.events.push(e);
      });
    }
    this.sim = new MatchSimulation({ bus: this.bus, mapDef, characters: chars, rules: RULESETS.online, seed });
    this.state = 'playing';
    this.countdown = CONFIG.COUNTDOWN + 0.6;
    this.mapId = mapId;
    this.log(`start map=${mapId} humans=${this.players.length} total=${chars.length}`);

    this.broadcastRoom();
    for (const p of this.players) p.send(this.startPayload(p));
    this.startLoop();
  }

  startPayload(p, rejoin = false) {
    const w = this.sim.world;
    return {
      type: 'start',
      rejoin,
      mapId: this.mapId,
      seed: this.sim.seed,
      grid: this.sim.grid.serialize(),
      yourSlot: p.slot,
      countdown: Math.max(0, this.countdown),
      time: this.sim.timeLeft,
      t: w.elapsed,
      players: this.sim.characters.map((c) => ({ slot: c.id, charId: c.def.id, name: c.name, human: c.human, personality: c.personality, spawn: c.spawn })),
      chars: this.sim.characters.map(packChar),
      bombs: [...w.bombs.values()].map((b) => ({ id: b.id, x: b.x, z: b.z, o: b.owner.id, r: b.range, t: b.timer, p: [...b.passers], rm: b.remote ? 1 : 0 })),
      items: [...w.items.values()].map((it) => ({ id: it.id, ty: it.type, x: it.x, z: it.z })),
      hazards: w.hazards.map((h) => ({ id: h.id, kind: h.kind, tiles: h.tiles, warn: h.warnLeft, dur: h.duration, meta: h.meta, active: h.active })),
    };
  }

  startLoop() {
    this.stopLoop();
    this.lastTime = performance.now();
    this.acc = 0;
    // setInterval 지연이 생겨도 고정 틱으로 따라잡기
    this.timer = setInterval(() => {
      const now = performance.now();
      this.acc += Math.min(0.25, (now - this.lastTime) / 1000);
      this.lastTime = now;
      let steps = 0;
      while (this.acc >= TICK_DT && steps++ < 5) {
        this.acc -= TICK_DT;
        this.tick();
        if (this.state !== 'playing') return;
      }
    }, 1000 / NET.TICK_RATE);
  }

  stopLoop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  onInput(p, msg) {
    if (this.state !== 'playing' || p.slot == null) return;
    // 비정상 데이터 차단
    if (!isInt(msg.s, 1, 1e9) || !isInt(msg.d, 0, 4) || (msg.b !== 0 && msg.b !== 1)) return;
    if (msg.x !== undefined && msg.x !== 0 && msg.x !== 1) return;
    if (msg.s <= p.lastSeq) return; // 중복/역순 패킷
    p.lastSeq = msg.s;
    if (this.countdown > 0) {
      p.ack = msg.s;
      return;
    }
    p.inputQ.push({ s: msg.s, d: msg.d, b: msg.b, x: msg.x ? 1 : 0 });
    if (p.inputQ.length > MAX_QUEUE) p.inputQ.shift();
  }

  tick() {
    const sim = this.sim;
    const w = sim.world;

    if (this.countdown > 0) {
      this.countdown -= TICK_DT;
      return;
    }

    // 1) 플레이어 입력 적용 (틱당 평균 1개, 지터로 밀린 입력은 크레딧 내에서 추가 처리)
    for (const p of this.players) {
      if (p.slot == null) continue;
      const c = sim.characters[p.slot];
      c.intentDir = null;
      c.intentBomb = false;
      if (c.controller !== 'remote') continue;
      p.credit = Math.min(MAX_CREDIT, p.credit + 1);
      while (p.inputQ.length > 1 && p.credit >= 2) {
        const inp = p.inputQ.shift();
        p.credit--;
        p.ack = inp.s;
        if (inp.b) BombSystem.tryPlace(w, c);
        if (inp.x && c.canAct) BombSystem.detonate(w, c);
        c.intentDir = decodeDir(inp.d);
        MovementSystem.stepCharacter(w, c, TICK_DT);
      }
      if (p.inputQ.length && p.credit >= 1) {
        const inp = p.inputQ.shift();
        p.credit--;
        p.ack = inp.s;
        c.intentDir = decodeDir(inp.d);
        c.intentBomb = !!inp.b;
        c.intentDetonate = !!inp.x;
      } else {
        c.intentDir = null;
      }
    }

    // 2) 공용 시뮬레이션 한 스텝 (AI · 물풍선 · 폭발 · 피격 · 아이템 · 맵 효과 · 승패)
    sim.step(TICK_DT);

    // 3) 상태 전송
    const chars = sim.characters.map(packChar);
    const ev = this.events;
    this.events = [];
    for (const p of this.players) {
      if (!p.connected) continue;
      p.send({ type: 'tick', t: Math.round(w.elapsed * 1000) / 1000, time: Math.round(sim.timeLeft * 100) / 100, ack: p.ack, c: chars, ev });
    }

    if (sim.outcome) this.end();
  }

  end() {
    this.stopLoop();
    const sim = this.sim;
    const msg = { type: 'end', outcome: sim.outcome, chars: sim.characters.map(packChar) };
    this.log(`end ${sim.outcome.reason} winner=${sim.outcome.winnerId}`);
    this.state = 'lobby';
    for (const p of [...this.players]) {
      if (!p.connected) {
        this.removePlayer(p, 'timeout');
        continue;
      }
      p.send(msg);
      p.ready = false;
      p.slot = null;
    }
    this.sim = null;
    if (this.state !== 'closed') this.broadcastRoom();
  }

  // ---------------- 접속 종료 / 재접속 ----------------
  onDisconnect(p) {
    p.connected = false;
    if (this.state === 'playing' && p.slot != null) {
      const c = this.sim.characters[p.slot];
      c.controller = 'ai'; // 접속이 끊기면 AI가 임시로 조종
      c.personality = 'balanced';
      this.events.push({ k: 'dc', c: p.slot });
      p.graceTimer = setTimeout(() => this.removePlayer(p, 'timeout'), REJOIN_GRACE_MS);
    } else {
      p.graceTimer = setTimeout(() => this.removePlayer(p, 'timeout'), LOBBY_GRACE_MS);
    }
    if (this.hostId === p.id) {
      const next = this.players.find((o) => o.connected);
      if (next) this.hostId = next.id;
    }
    if (!this.players.some((o) => o.connected)) {
      // 아무도 없으면 즉시 정리
      if (this.state === 'playing') return this.destroy();
    }
    this.broadcastRoom();
  }

  onReconnect(p) {
    clearTimeout(p.graceTimer);
    p.connected = true;
    if (!this.players.some((o) => o.id === this.hostId && o.connected)) this.hostId = p.id;
    this.broadcastRoom();
    if (this.state === 'playing' && p.slot != null) {
      const c = this.sim.characters[p.slot];
      c.controller = 'remote';
      p.inputQ = [];
      p.credit = 0;
      p.lastSeq = 0; // 새로고침 후 재접속하면 입력 번호가 1부터 다시 시작
      p.ack = 0;
      this.events.push({ k: 'rc', c: p.slot });
      p.send(this.startPayload(p, true));
    }
  }
}

export { MAP_IDS };
