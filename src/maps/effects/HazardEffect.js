import { TILE } from '../../core/Config.js';
import { PlatformEffect } from './PlatformEffect.js';

// 주기적 위험 지역 (화산 분출 / 파도 / 구름 붕괴).
// 경고(warn) → 활성(duration) 순서. 활성 시 해당 타일에 물줄기와 같은 판정(owner=null)을 만든다.
// 서버/클라이언트 공용 로직. 같은 world.rng 를 쓰므로 단일 시뮬레이션 안에서 결정적이다.
export class HazardEffect {
  constructor(cfg) {
    this.cfg = cfg;
    this.timer = cfg.firstDelay ?? cfg.interval;
  }

  pickTiles(world) {
    const { grid, rng } = world;
    const n = grid.size;
    const empty = (x, z) => grid.get(x, z) === TILE.EMPTY;
    const out = [];
    const cfg = this.cfg;

    if (cfg.pattern === 'band') {
      // 가로 또는 세로 2줄을 덮치는 파도
      const horizontal = rng() < 0.5;
      const s = 1 + Math.floor(rng() * (n - 3)); // 1..n-3
      for (let a = s; a <= s + 1; a++) {
        for (let b = 1; b < n - 1; b++) {
          const x = horizontal ? b : a;
          const z = horizontal ? a : b;
          if (empty(x, z)) out.push(grid.idx(x, z));
        }
      }
      return { tiles: out, dir: horizontal ? (rng() < 0.5 ? 1 : -1) : 0, axis: horizontal ? 'x' : 'z', band: [s, s + 1] };
    }

    if (cfg.pattern === 'tide') {
      // 밀물: 양쪽 가장자리 depth 줄을 동시에 덮음 (좌우 ↔ 위아래 번갈아) → 모든 시작 위치에 공평
      this.tideCount = (this.tideCount || 0) + 1;
      const axis = this.tideCount % 2 ? 'x' : 'z';
      const depth = cfg.depth || 2;
      for (let a = 1; a < n - 1; a++) {
        for (let k = 0; k < depth; k++) {
          for (const b of [1 + k, n - 2 - k]) {
            const x = axis === 'x' ? b : a;
            const z = axis === 'x' ? a : b;
            if (empty(x, z)) out.push(grid.idx(x, z));
          }
        }
      }
      return { tiles: out, axis, depth };
    }

    // scatter: 빈 타일 중 무작위 N곳 (+ 군집 옵션)
    const candidates = [];
    for (let z = 1; z < n - 1; z++) for (let x = 1; x < n - 1; x++) if (empty(x, z)) candidates.push(grid.idx(x, z));
    const used = new Set();
    for (let k = 0; k < cfg.count && candidates.length; k++) {
      const i = candidates.splice(Math.floor(rng() * candidates.length), 1)[0];
      used.add(i);
      if (cfg.cluster) {
        const x = i % n;
        const z = (i / n) | 0;
        const nx = x + (rng() < 0.5 ? 1 : -1);
        if (empty(nx, z)) used.add(grid.idx(nx, z));
      }
    }
    return { tiles: [...used] };
  }

  update(world, dt) {
    const cfg = this.cfg;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = cfg.interval;
      const picked = this.pickTiles(world);
      if (picked.tiles.length) {
        const hz = {
          id: ++world.hazardSeq,
          kind: cfg.kind,
          tiles: picked.tiles,
          meta: { dir: picked.dir, axis: picked.axis, band: picked.band, depth: picked.depth },
          warn: cfg.warn,
          duration: cfg.duration,
          warnLeft: cfg.warn,
          life: cfg.duration,
          active: false,
        };
        world.hazards.push(hz);
        world.bus.emit('hazardWarn', { hazard: hz });
      }
    }

    for (let i = world.hazards.length - 1; i >= 0; i--) {
      const hz = world.hazards[i];
      if (hz.kind !== cfg.kind) continue;
      if (!hz.active) {
        hz.warnLeft -= dt;
        if (hz.warnLeft <= 0) this.activate(world, hz);
      } else {
        hz.life -= dt;
        if (hz.life <= 0) {
          world.hazards.splice(i, 1);
          world.bus.emit('hazardEnd', { hazard: hz });
        }
      }
    }
  }

  activate(world, hz) {
    hz.active = true;
    for (const idx of hz.tiles) {
      const prev = world.flames.get(idx);
      world.flames.set(idx, { t: Math.max(prev?.t || 0, hz.duration), owner: null });
      const bomb = world.bombs.get(idx);
      if (bomb) bomb.timer = Math.min(bomb.timer, 0.05);
      world.systems.item.flameHit(world, idx);
    }
    world.bus.emit('hazardActive', { hazard: hz });
  }
}

export function createMapEffects(def) {
  let platformIndex = 0;
  return (def.effects || []).map((e) => {
    if (e.type === 'hazard') return new HazardEffect(e);
    if (e.type === 'platform') return new PlatformEffect(e, platformIndex++);
    throw new Error(`Unknown map effect: ${e.type}`);
  });
}
