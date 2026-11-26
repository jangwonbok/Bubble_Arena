import { CONFIG, TILE, DIRS, isBreakable } from '../core/Config.js';
import { CollisionSystem } from './CollisionSystem.js';
import { STATE } from '../characters/Character.js';
import { ITEM_CFG } from './items/itemDefs.js';

let nextBombId = 1;

// 물풍선 설치 · 타이머 · 십자 폭발 · 연쇄 폭발 · 물줄기 피격
export const BombSystem = {
  tryPlace(world, c) {
    if (!c.canAct || c.bombsLeft <= 0) return false;
    const x = c.tx;
    const z = c.tz;
    const idx = world.grid.idx(x, z);
    if (world.bombs.has(idx) || world.grid.isSolid(x, z)) return false;

    const bomb = {
      id: nextBombId++,
      x,
      z,
      idx,
      owner: c,
      range: c.range,
      timer: CONFIG.BOMB_FUSE,
      fuse: CONFIG.BOMB_FUSE,
      passers: new Set(),
      remote: false,
    };
    // 원격 폭발: 원하는 순간 터뜨림 (안 누르면 ITEM_CFG.REMOTE_FUSE 후 자동 폭발)
    if (c.remoteCharges > 0) {
      c.remoteCharges--;
      bomb.remote = true;
      bomb.timer = bomb.fuse = ITEM_CFG.REMOTE_FUSE;
    }
    // 설치 순간 겹쳐 있던 캐릭터는 빠져나갈 수 있도록 통과 허용
    for (const o of world.characters) {
      if (o.alive && CollisionSystem.overlapsTile(o, x, z)) bomb.passers.add(o.id);
    }
    world.bombs.set(idx, bomb);
    c.activeBombs++;
    c.placeAnim = 0.25;
    world.bus.emit('bombPlaced', { bomb });
    return true;
  },

  /** 원격 물풍선 모두 폭발 */
  detonate(world, c) {
    let n = 0;
    for (const b of world.bombs.values()) {
      if (b.owner === c && b.remote && b.timer > 0.02) {
        b.timer = 0.01;
        n++;
      }
    }
    if (n) world.bus.emit('detonated', { c, count: n });
    return n;
  },

  update(world, dt) {
    // 타이머 진행
    const due = [];
    for (const b of world.bombs.values()) {
      b.timer -= dt;
      if (b.timer <= 0) due.push(b);
    }
    for (const b of due) if (world.bombs.has(b.idx)) this.explode(world, b);

    // 물줄기 지속시간
    for (const [idx, f] of world.flames) {
      f.t -= dt;
      if (f.t <= 0) world.flames.delete(idx);
    }

    // 물줄기 피격 → 물방울에 갇힘
    for (const c of world.characters) {
      if (c.state !== STATE.ALIVE || c.invulnerable > 0 || c.jumpTime > 0) continue; // 점프 중엔 물줄기 위로
      const f = world.flames.get(world.grid.idx(c.tx, c.tz));
      if (!f) continue;
      if (c.shieldTime > 0) {
        // 방어막: 1회 방어 후 소멸, 잠깐 무적
        c.shieldTime = 0;
        c.invulnerable = 1.0;
        world.bus.emit('shieldBlocked', { c });
        continue;
      }
      world.systems.bubble.trap(world, c, f.owner);
    }
  },

  /** 폭발 범위 계산 (AI 위험 예측에서도 재사용) */
  blastTiles(world, x, z, range, blocks = null) {
    const tiles = [{ x, z, dir: null, end: false }];
    for (const d of DIRS) {
      for (let i = 1; i <= range; i++) {
        const tx = x + d.dx * i;
        const tz = z + d.dz * i;
        const t = world.grid.get(tx, tz);
        if (t === TILE.WALL || t === TILE.PILLAR) break;
        const stop = isBreakable(t) || world.bombs.has(world.grid.idx(tx, tz));
        tiles.push({ x: tx, z: tz, dir: d, end: stop || i === range });
        if (isBreakable(t) && blocks) blocks.push({ x: tx, z: tz });
        if (stop) break;
      }
    }
    return tiles;
  },

  explode(world, bomb) {
    world.bombs.delete(bomb.idx);
    bomb.owner.activeBombs = Math.max(0, bomb.owner.activeBombs - 1);

    const blocks = [];
    const tiles = this.blastTiles(world, bomb.x, bomb.z, bomb.range, blocks);

    for (const t of tiles) {
      const idx = world.grid.idx(t.x, t.z);
      world.flames.set(idx, { t: CONFIG.FLAME_DURATION, owner: bomb.owner });

      // 연쇄 폭발
      const other = world.bombs.get(idx);
      if (other) other.timer = Math.min(other.timer, CONFIG.CHAIN_DELAY);

      // 아이템 제거
      world.systems.item.flameHit(world, idx);
    }

    for (const b of blocks) {
      if (!isBreakable(world.grid.get(b.x, b.z))) continue;
      world.grid.set(b.x, b.z, TILE.EMPTY);
      bomb.owner.score += CONFIG.SCORE.BLOCK;
      world.bus.emit('blockDestroyed', { x: b.x, z: b.z, idx: world.grid.idx(b.x, b.z) });
      world.systems.item.maybeSpawn(world, b.x, b.z);
    }

    world.bus.emit('bombExploded', { bomb, tiles });
  },
};
