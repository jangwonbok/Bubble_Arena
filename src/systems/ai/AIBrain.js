import { CONFIG, TERRAIN_SPEED, isConveyor } from '../../core/Config.js';
import { STATE } from '../../characters/Character.js';
import { BombSystem } from '../BombSystem.js';
import { bfs, buildPath } from './Pathfinding.js';
import { DangerMap } from './DangerMap.js';

// 성향별 파라미터
export const PERSONALITIES = {
  aggressive: {
    attack: 3.6, approach: 2.2, item: 0.8, block: 0.7, rescue: 0, keepAway: 0,
    enemyBombChance: 0.95, blockBombChance: 0.8, nearBombChance: 0.6,
    react: 0.12, escapeMargin: 0.45, avoidTrapped: true,
  },
  balanced: {
    attack: 1.6, approach: 0.7, item: 2.0, block: 1.1, rescue: 0, keepAway: 0.3,
    enemyBombChance: 0.7, blockBombChance: 0.85, nearBombChance: 0.1,
    react: 0.15, escapeMargin: 0.6, avoidTrapped: true,
  },
  survival: {
    attack: 0.35, approach: 0, item: 1.4, block: 0.9, rescue: 1.6, keepAway: 1.6,
    enemyBombChance: 0.45, blockBombChance: 0.7, nearBombChance: 0,
    react: 0.08, escapeMargin: 0.9, avoidTrapped: false,
  },
};

const scratch = new DangerMap(CONFIG.MAP_SIZE);

export class AIBrain {
  constructor(c) {
    this.c = c;
    this.p = PERSONALITIES[c.personality] || PERSONALITIES.balanced;
    this.reset();
  }

  reset() {
    this.path = [];
    this.mode = 'idle';
    this.react = 0;
    this.stuck = 0;
    this.lastX = this.c.x;
    this.lastZ = this.c.z;
    this.noBombUntil = 0;
    this.goalLabel = '';
  }

  update(world, dt, danger) {
    const c = this.c;
    c.intentDir = null;
    c.intentBomb = false;
    c.intentDetonate = false;
    if (!c.canAct) {
      this.path = [];
      this.mode = 'idle';
      return;
    }

    const grid = world.grid;
    const cur = grid.idx(c.tx, c.tz);
    const inDanger = !danger.isSafe(cur);
    // 이동형 발판 위에서는 계속 밀리므로 중앙 판정을 넉넉하게
    const tol = isConveyor(grid.terrainAt(c.tx, c.tz)) ? 0.22 : 0.03;
    const atCenter = Math.abs(c.x - c.tx) < tol && Math.abs(c.z - c.tz) < tol;

    // 위험 감지 → 반응 시간 이후 탈출
    if (inDanger && this.mode !== 'escape') {
      this.react += dt;
      if (this.react >= this.p.react) {
        this.react = 0;
        this.planEscape(world, danger);
      }
    }

    // 경로 유효성 검사
    if (this.path.length) {
      const nx = this.path[0];
      const ni = grid.idx(nx.x, nx.z);
      const blocked = grid.isSolid(nx.x, nx.z) || (world.bombs.has(ni) && ni !== cur);
      const risky = this.mode !== 'escape' && !danger.isSafe(ni);
      if (blocked || risky) {
        this.path = [];
        this.mode = 'idle';
      }
    }

    this.idleWait = Math.max(0, (this.idleWait || 0) - dt);
    if (!this.path.length && (atCenter || this.mode === 'idle') && (this.idleWait <= 0 || inDanger)) {
      if (this.mode === 'escape' && !inDanger) this.mode = 'idle';
      this.decide(world, danger, inDanger, atCenter);
      if (!this.path.length && !c.intentBomb) this.idleWait = 0.12;
    }

    this.follow(world, dt);
    this.considerDetonate(world);

    // 막힘 감지
    if (c.intentDir) {
      if (Math.abs(c.x - this.lastX) + Math.abs(c.z - this.lastZ) < 1e-3) {
        this.stuck += dt;
        if (this.stuck > 0.4) {
          this.path = [];
          this.mode = 'idle';
          this.stuck = 0;
        }
      } else this.stuck = 0;
    }
    this.lastX = c.x;
    this.lastZ = c.z;
  }

  /** 원격 물풍선: 상대가 폭발 범위에 있고 내가 안전하면 터뜨림 */
  considerDetonate(world) {
    const c = this.c;
    const mine = [...world.bombs.values()].filter((b) => b.owner === c && b.remote);
    if (!mine.length) return;
    const enemies = this.enemies(world);
    let hit = false;
    let selfHit = false;
    for (const b of mine) {
      for (const t of BombSystem.blastTiles(world, b.x, b.z, b.range)) {
        if (t.x === c.tx && t.z === c.tz) selfHit = true;
        if (enemies.some((e) => e.tx === t.x && e.tz === t.z)) hit = true;
      }
    }
    if (hit && !selfHit) c.intentDetonate = true;
  }

  follow(world, dt) {
    const c = this.c;
    if (!this.path.length) return;
    const next = this.path[0];
    const dx = next.x - c.x;
    const dz = next.z - c.z;
    const remain = Math.abs(dx) + Math.abs(dz);
    const step = c.speed * (TERRAIN_SPEED[world.grid.terrainAt(c.tx, c.tz)] || 1) * dt;
    if (remain <= step + 1e-3) {
      c.x = next.x;
      c.z = next.z;
      c.moving = true;
      c.slideDir = null; // AI는 목표 타일에서 정확히 멈춤 (얼음 위 진동 방지)
      this.path.shift();
      if (!this.path.length) {
        if (this.mode === 'move') this.mode = 'idle';
        return;
      }
      if (this.mode === 'move') {
        // 매 타일마다 목표 재평가
        this.path = [];
        this.mode = 'idle';
        return;
      }
      return this.follow(world, 0);
    }
    // 주 진행 방향 선택 (격자 이동 시스템이 반대 축 정렬 처리)
    const tx = Math.round(c.x);
    const tz = Math.round(c.z);
    if (next.x !== tx) c.intentDir = { dx: Math.sign(next.x - c.x) || Math.sign(next.x - tx), dz: 0 };
    else if (next.z !== tz) c.intentDir = { dx: 0, dz: Math.sign(next.z - c.z) || Math.sign(next.z - tz) };
    else if (Math.abs(dx) > Math.abs(dz)) c.intentDir = { dx: Math.sign(dx), dz: 0 };
    else c.intentDir = { dx: 0, dz: Math.sign(dz) };
  }

  planEscape(world, danger) {
    const c = this.c;
    const res = bfs(world, c.tx, c.tz, danger, { mode: 'escape', stepTime: 1 / c.speed });
    let best = -1;
    let bestScore = -Infinity;
    for (const idx of res.order) {
      let score;
      if (danger.isSafe(idx)) score = 1000 - res.dist[idx];
      else score = danger.start[idx] * 10 - res.dist[idx];
      if (score > bestScore) {
        bestScore = score;
        best = idx;
      }
    }
    if (best >= 0) {
      this.path = buildPath(world.grid, res, best);
      this.mode = this.path.length ? 'escape' : 'idle';
    }
  }

  /** 지금 이 자리에 물풍선을 놓아도 탈출 가능한가 → 탈출 경로 반환 */
  escapeAfterPlacing(world) {
    const c = this.c;
    const d = scratch.compute(world, { x: c.tx, z: c.tz, range: c.range, t: CONFIG.BOMB_FUSE });
    const stepTime = 1 / c.speed;
    const res = bfs(world, c.tx, c.tz, d, { mode: 'escape', stepTime });
    let best = -1;
    for (const idx of res.order) {
      if (d.isSafe(idx) && res.dist[idx] > 0) {
        best = idx;
        break;
      }
    }
    if (best < 0) return null;
    if (res.dist[best] * stepTime > CONFIG.BOMB_FUSE - this.p.escapeMargin) return null;
    return buildPath(world.grid, res, best);
  }

  enemies(world) {
    return world.characters.filter((o) => o !== this.c && o.state === STATE.ALIVE);
  }

  /** 타일 (x,z)에 물풍선을 놓았을 때 얻는 가치 */
  blastValue(world, x, z, enemies) {
    const blocks = [];
    const tiles = BombSystem.blastTiles(world, x, z, this.c.range, blocks);
    let enemyHits = 0;
    for (const t of tiles) {
      for (const e of enemies) if (e.tx === t.x && e.tz === t.z) enemyHits++;
    }
    return { blocks: blocks.length, enemyHits };
  }

  decide(world, danger, inDanger, atCenter) {
    const c = this.c;
    const p = this.p;
    const grid = world.grid;
    if (inDanger) {
      this.planEscape(world, danger);
      return;
    }

    if (!atCenter) {
      // 타일 중앙으로 먼저 정렬
      this.path = [{ x: c.tx, z: c.tz }];
      this.mode = 'move';
      return;
    }

    const enemies = this.enemies(world);
    const now = world.elapsed;

    // 1) 현재 위치에서 물풍선 설치 판단
    if (atCenter && c.bombsLeft > 0 && now >= this.noBombUntil) {
      const v = this.blastValue(world, c.tx, c.tz, enemies);
      const nearEnemy = enemies.some((e) => Math.abs(e.x - c.x) + Math.abs(e.z - c.z) <= 2.2);
      let chance = 0;
      if (v.enemyHits > 0) chance = p.enemyBombChance;
      else if (v.blocks > 0) chance = p.blockBombChance;
      else if (nearEnemy) chance = p.nearBombChance;
      if (chance > 0 && Math.random() < chance) {
        const esc = this.escapeAfterPlacing(world);
        if (esc && esc.length) {
          c.intentBomb = true;
          this.path = esc;
          this.mode = 'escape';
          this.goalLabel = 'bomb';
          return;
        }
      }
      if (chance > 0) this.noBombUntil = now + 0.5;
    }

    // 2) 목표 타일 선택
    const avoid = new Set();
    if (p.avoidTrapped) {
      for (const o of world.characters) {
        if (o !== c && o.state === STATE.TRAPPED) avoid.add(grid.idx(o.tx, o.tz));
      }
    }
    const res = bfs(world, c.tx, c.tz, danger, { mode: 'safe', avoid });
    let best = -1;
    let bestScore = -Infinity;
    const canBomb = c.bombsLeft > 0;

    for (const idx of res.order) {
      const x = idx % grid.size;
      const z = (idx / grid.size) | 0;
      const d = res.dist[idx];
      let score = 0;

      const item = world.items.get(idx);
      if (item) score += p.item * 3;

      if (canBomb) {
        const v = this.blastValue(world, x, z, enemies);
        score += p.block * Math.min(3, v.blocks) * 0.9;
        score += p.attack * v.enemyHits * 2;
      }

      let nearest = Infinity;
      for (const e of enemies) nearest = Math.min(nearest, Math.abs(e.tx - x) + Math.abs(e.tz - z));
      if (nearest < Infinity) {
        score += (p.approach * 2) / (1 + nearest);
        if (p.keepAway > 0 && nearest < 3) score -= p.keepAway * (3 - nearest);
      }

      if (p.rescue > 0) {
        for (const o of world.characters) {
          if (o !== c && o.state === STATE.TRAPPED && o.tx === x && o.tz === z) score += p.rescue * 3;
        }
      }

      // 거리 할인 + 약간의 무작위성
      score = score / (1 + d * 0.32) + Math.random() * 0.05;
      if (d === 0) score *= 0.9; // 제자리보다는 이동 선호
      if (score > bestScore) {
        bestScore = score;
        best = idx;
      }
    }

    if (best >= 0 && bestScore > 0.06) {
      const path = buildPath(grid, res, best);
      if (path.length) {
        this.path = path;
        this.mode = 'move';
        return;
      }
      // 이미 목표 위치 → 다음 프레임에 설치 판단
      this.noBombUntil = 0;
    }

    // 3) 할 일이 없으면 주변 배회
    const near = res.order.filter((i) => res.dist[i] >= 1 && res.dist[i] <= 3);
    if (near.length && Math.random() < 0.5) {
      const pick = near[Math.floor(Math.random() * near.length)];
      this.path = buildPath(grid, res, pick);
      this.mode = 'move';
    } else {
      this.mode = 'idle';
    }
  }
}
