import { CONFIG, NET, TILE } from '../core/Config.js';
import { MapGrid } from '../map/MapGrid.js';
import { getMap } from '../maps/index.js';
import { Character, STATE } from '../characters/Character.js';
import { CHARACTER_DEFS } from '../characters/characterDefs.js';
import { MovementSystem } from '../systems/MovementSystem.js';
import { unpackChar, decodeDir, encodeDir, DIR_LIST } from './protocol.js';
import { computePlatforms, onPlatform } from '../maps/effects/PlatformEffect.js';

const STEP = 1 / NET.TICK_RATE;
const INTERP_DELAY = 0.1; // 다른 플레이어는 100ms 과거 상태를 보간해서 표시

/**
 * 온라인 경기의 클라이언트 측 상태.
 * - 판정은 하지 않는다 (서버 이벤트/스냅샷을 그대로 반영)
 * - 내 캐릭터: 입력 즉시 예측 이동 → 서버 확인(ack) 후 미확인 입력 재적용(reconciliation)
 * - 다른 캐릭터: 스냅샷 버퍼 보간
 * 서버 이벤트는 싱글 플레이와 같은 이벤트 버스로 내보내므로 렌더링/사운드/UI 코드는 공용.
 */
export class OnlineMatch {
  constructor(game, start) {
    this.game = game;
    this.bus = game.bus;
    this.mapDef = getMap(start.mapId);
    this.grid = new MapGrid(this.mapDef.size || CONFIG.MAP_SIZE);
    this.grid.load(start.grid);

    this.characters = start.players.map((p) => {
      const controller = p.slot === start.yourSlot ? 'local' : p.human ? 'remote' : 'ai';
      const c = new Character(CHARACTER_DEFS[p.charId], { slot: p.slot, controller, name: p.name, personality: p.personality, human: p.human });
      c.reset(p.spawn);
      return c;
    });
    start.chars.forEach((a, i) => unpackChar(this.characters[i], a));
    this.me = this.characters[start.yourSlot];
    this.pred = new Character(this.me.def, { slot: this.me.id, controller: 'local' });
    this.pred.reset(this.me.spawn);
    unpackChar(this.pred, start.chars[start.yourSlot]);

    this.world = {
      grid: this.grid,
      characters: this.characters,
      bombs: new Map(),
      flames: new Map(),
      items: new Map(),
      hazards: [],
      bus: this.bus,
      map: this.mapDef,
      elapsed: start.t,
      platforms: computePlatforms(this.mapDef, start.t),
      predictOnly: true, // 예측 이동은 맵(블록 밀기)을 바꾸지 않음 → 서버 이벤트로만 반영
    };
    this.start = start;
    this.timeLeft = start.time;
    this.countdown = start.countdown;
    this.snaps = [{ t: start.t, c: start.chars }];
    this.offset = null;
    this.pending = [];
    this.seq = 0;
    this.acc = 0;
    this.prev = { x: this.pred.x, z: this.pred.z };
    this.cur = { x: this.pred.x, z: this.pred.z };
    this.corr = { x: 0, z: 0 };
    this.lastTickAt = performance.now();
  }

  /** 재접속 시: 진행 중이던 물풍선/아이템/위험 지역을 뷰에 다시 그림 */
  replayInitialState() {
    const s = this.start;
    for (const b of s.bombs) this.applyEvent({ k: 'bp', ...b });
    for (const it of s.items) this.applyEvent({ k: 'is', ...it });
    for (const h of s.hazards) {
      this.applyEvent({ k: 'hw', ...h });
      if (h.active) this.applyEvent({ k: 'ha', id: h.id });
    }
  }

  idxOf(x, z) {
    return this.grid.idx(x, z);
  }

  findBomb(id) {
    for (const b of this.world.bombs.values()) if (b.id === id) return b;
    return null;
  }

  findItem(id) {
    for (const it of this.world.items.values()) if (it.id === id) return it;
    return null;
  }

  applyEvent(e) {
    const ch = (i) => (i >= 0 ? this.characters[i] : null);
    const bus = this.bus;
    switch (e.k) {
      case 'bp': {
        const bomb = { id: e.id, x: e.x, z: e.z, idx: this.idxOf(e.x, e.z), owner: ch(e.o), range: e.r, timer: e.t, fuse: e.rm ? e.t : CONFIG.BOMB_FUSE, passers: new Set(e.p), remote: !!e.rm };
        this.world.bombs.set(bomb.idx, bomb);
        bomb.owner.placeAnim = 0.25;
        bus.emit('bombPlaced', { bomb });
        break;
      }
      case 'bx': {
        const bomb = this.findBomb(e.id) || { id: e.id, owner: ch(e.o) };
        if (bomb.idx !== undefined) this.world.bombs.delete(bomb.idx);
        const tiles = e.tiles.map(([x, z, d, end]) => ({ x, z, dir: d ? DIR_LIST[d] : null, end: !!end }));
        bus.emit('bombExploded', { bomb, tiles });
        break;
      }
      case 'bd':
        this.grid.set(e.x, e.z, TILE.EMPTY);
        bus.emit('blockDestroyed', { x: e.x, z: e.z, idx: this.idxOf(e.x, e.z) });
        break;
      case 'is': {
        const item = { id: e.id, type: e.ty, x: e.x, z: e.z, idx: this.idxOf(e.x, e.z) };
        this.world.items.set(item.idx, item);
        bus.emit('itemSpawned', { item });
        break;
      }
      case 'ir': {
        const item = this.findItem(e.id);
        if (!item) break;
        this.world.items.delete(item.idx);
        bus.emit('itemRemoved', { item, by: ch(e.by), magnet: !!e.mg });
        break;
      }
      case 'tr': {
        const c = ch(e.c);
        c.state = STATE.TRAPPED;
        c.hitAnim = 0.4;
        c.trapTimer = CONFIG.TRAP_DURATION;
        bus.emit('trapped', { c, by: ch(e.by) });
        break;
      }
      case 'rs':
        ch(e.c).state = STATE.ALIVE;
        bus.emit('rescued', { c: ch(e.c), by: ch(e.by) });
        break;
      case 'el': {
        const c = ch(e.c);
        c.state = STATE.DEAD;
        c.deathCause = e.cause;
        bus.emit('eliminated', { c, by: ch(e.by), cause: e.cause });
        break;
      }
      case 'pb': {
        const n = this.grid.size;
        const [fx, fz, tx, tz] = [e.f % n, (e.f / n) | 0, e.t % n, (e.t / n) | 0];
        this.grid.set(fx, fz, TILE.EMPTY);
        this.grid.set(tx, tz, TILE.PUSH);
        bus.emit('blockPushed', { from: e.f, to: e.t, fx, fz, tx, tz, by: ch(e.by) });
        break;
      }
      case 'sb':
        bus.emit('shieldBlocked', { c: ch(e.c) });
        break;
      case 'lu':
        bus.emit('lifeUsed', { c: ch(e.c), cause: e.cause });
        break;
      case 'sw':
        bus.emit('slowed', { c: ch(e.c), by: ch(e.by) });
        break;
      case 'dt':
        bus.emit('detonated', { c: ch(e.c), count: e.n });
        break;
      case 'hw': {
        const hazard = { id: e.id, kind: e.kind, tiles: e.tiles, warn: e.warn, duration: e.dur, warnLeft: e.warn, life: e.dur, meta: e.meta || {}, active: false };
        this.world.hazards.push(hazard);
        bus.emit('hazardWarn', { hazard });
        break;
      }
      case 'ha': {
        const hazard = this.world.hazards.find((h) => h.id === e.id);
        if (!hazard) break;
        hazard.active = true;
        bus.emit('hazardActive', { hazard });
        break;
      }
      case 'he': {
        const i = this.world.hazards.findIndex((h) => h.id === e.id);
        if (i < 0) break;
        const [hazard] = this.world.hazards.splice(i, 1);
        bus.emit('hazardEnd', { hazard });
        break;
      }
      case 'dc':
      case 'rc':
      case 'left':
        bus.emit('netNotice', { kind: e.k, c: ch(e.c) });
        break;
      default:
    }
  }

  onTick(m) {
    const now = performance.now() / 1000;
    const sample = m.t - now;
    // 서버 시간 추정 (가장 지연이 적었던 샘플 기준, 서서히 추종)
    this.offset = this.offset === null ? sample : Math.max(sample, this.offset - 0.002);
    this.lastTickAt = performance.now();
    this.timeLeft = m.time;
    this.world.elapsed = m.t;
    if (this.countdown > 0) this.countdown = 0;

    for (const e of m.ev) this.applyEvent(e);

    this.snaps.push({ t: m.t, c: m.c });
    while (this.snaps.length > 30) this.snaps.shift();

    // 비위치 상태는 최신 스냅샷 반영
    this.characters.forEach((c, i) => unpackChar(c, m.c[i], { position: false }));
    this.reconcile(m);
  }

  /** 서버 확정 위치에서 미확인 입력을 다시 적용 */
  reconcile(m) {
    const me = this.me;
    const s = m.c[me.id];
    const pred = this.pred;
    const ox = pred.x;
    const oz = pred.z;
    unpackChar(pred, s);
    this.pending = this.pending.filter((p) => p.s > m.ack);
    if (me.state !== STATE.ALIVE) {
      this.pending = [];
      this.prev = { x: pred.x, z: pred.z };
      this.cur = { x: pred.x, z: pred.z };
      this.corr = { x: 0, z: 0 };
      return;
    }
    for (const p of this.pending) {
      pred.intentDir = decodeDir(p.d);
      MovementSystem.stepCharacter(this.world, pred, STEP);
    }
    const dx = pred.x - ox;
    const dz = pred.z - oz;
    if (Math.abs(dx) + Math.abs(dz) > 1.5) {
      // 크게 어긋나면 즉시 맞춤 (구출/순간 이동 등)
      this.prev = { x: pred.x, z: pred.z };
      this.cur = { x: pred.x, z: pred.z };
      this.corr = { x: 0, z: 0 };
    } else {
      // 작은 오차는 화면에서 부드럽게 흡수
      this.prev.x += dx;
      this.prev.z += dz;
      this.cur.x += dx;
      this.cur.z += dz;
      this.corr.x -= dx;
      this.corr.z -= dz;
    }
  }

  update(dt, inputEnabled) {
    const game = this.game;
    if (this.countdown > 0) this.countdown -= dt;

    // 0) 이동형 발판: 추정 서버 시간으로 위치 계산, 내 예측 캐릭터도 함께 태움
    if (this.offset !== null) {
      const est = this.offset + performance.now() / 1000;
      const plats = computePlatforms(this.mapDef, est);
      plats.forEach((p, i) => {
        const old = this.world.platforms[i];
        if (old && onPlatform(old, this.pred)) {
          const dx = p.x - old.x;
          const dz = p.z - old.z;
          this.pred.x += dx;
          this.pred.z += dz;
          this.cur.x += dx;
          this.cur.z += dz;
          this.prev.x += dx;
          this.prev.z += dz;
        }
      });
      this.world.platforms = plats;
      this.world.elapsed = est;
    }

    // 1) 고정 간격으로 입력 전송 + 예측
    this.acc += dt;
    let steps = 0;
    while (this.acc >= STEP && steps++ < 4) {
      this.acc -= STEP;
      if (this.countdown > 0 || this.me.state !== STATE.ALIVE) {
        game.input.consumeBomb();
        game.input.consumeDetonate();
        continue;
      }
      const dir = inputEnabled ? game.input.getDirection() : null;
      const bomb = inputEnabled && game.input.consumeBomb();
      const det = inputEnabled && game.input.consumeDetonate();
      const d = encodeDir(dir);
      const s = ++this.seq;
      game.session.net.send({ type: 'input', s, d, b: bomb ? 1 : 0, x: det ? 1 : 0 });
      this.pending.push({ s, d });
      if (this.pending.length > 90) this.pending.shift();
      this.pred.intentDir = dir;
      this.prev = { ...this.cur };
      MovementSystem.stepCharacter(this.world, this.pred, STEP);
      this.cur = { x: this.pred.x, z: this.pred.z };
    }
    if (this.acc > STEP) this.acc = STEP;

    // 2) 내 캐릭터 렌더 위치 (스텝 사이 보간 + 오차 보정 감쇠)
    const me = this.me;
    const k = Math.exp(-dt * 10);
    this.corr.x *= k;
    this.corr.z *= k;
    if (me.state === STATE.ALIVE) {
      const a = this.acc / STEP;
      me.x = this.prev.x + (this.cur.x - this.prev.x) * a + this.corr.x;
      me.z = this.prev.z + (this.cur.z - this.prev.z) * a + this.corr.z;
      me.facing = this.pred.facing;
      me.moving = this.pred.moving;
    } else {
      const last = this.snaps[this.snaps.length - 1].c[me.id];
      me.x = last[0];
      me.z = last[1];
    }

    // 3) 다른 캐릭터 보간
    const renderT = (this.offset ?? 0) + performance.now() / 1000 - INTERP_DELAY;
    const snaps = this.snaps;
    let a = snaps[0];
    let b = snaps[snaps.length - 1];
    for (let i = snaps.length - 1; i > 0; i--) {
      if (snaps[i - 1].t <= renderT) {
        a = snaps[i - 1];
        b = snaps[i];
        break;
      }
    }
    const span = b.t - a.t;
    const u = span > 0 ? Math.min(1, Math.max(0, (renderT - a.t) / span)) : 1;
    for (const c of this.characters) {
      if (c === me) continue;
      const pa = a.c[c.id];
      const pb = b.c[c.id];
      if (Math.abs(pa[0] - pb[0]) + Math.abs(pa[1] - pb[1]) > 2) {
        c.x = pb[0];
        c.z = pb[1];
      } else {
        c.x = pa[0] + (pb[0] - pa[0]) * u;
        c.z = pa[1] + (pb[1] - pa[1]) * u;
      }
    }

    // 4) 클라이언트 연출용 타이머
    for (const b2 of this.world.bombs.values()) b2.timer = Math.max(0, b2.timer - dt);
    for (const h of this.world.hazards) if (!h.active) h.warnLeft -= dt;
    for (const c of this.characters) {
      if (c.placeAnim > 0) c.placeAnim = Math.max(0, c.placeAnim - dt);
      if (c.hitAnim > 0) c.hitAnim = Math.max(0, c.hitAnim - dt);
      if (c.state === STATE.TRAPPED) c.trapTimer = Math.max(0, c.trapTimer - dt);
    }
  }

  /** 경기 종료 메시지 반영 */
  applyEnd(msg) {
    msg.chars.forEach((a, i) => unpackChar(this.characters[i], a));
    const ranking = msg.outcome.ranking.map((id) => this.characters[id]);
    const winner = this.characters[msg.outcome.winnerId];
    for (const c of this.characters) {
      c.moving = false;
      c.facing = { dx: 0, dz: 1 };
      if (c.state === STATE.TRAPPED) c.state = STATE.ALIVE;
      c.result = c.state === STATE.DEAD ? null : c === winner ? 'win' : 'lose';
    }
    return { reason: msg.outcome.reason, ranking, winner };
  }
}
