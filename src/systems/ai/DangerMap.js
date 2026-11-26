import { CONFIG, TILE, TERRAIN, DIRS, isBreakable } from '../../core/Config.js';

// 폭발 예정 지역 분석: 각 타일이 "언제부터 언제까지" 물줄기에 덮이는지 예측.
// 연쇄 폭발까지 고려하여 물풍선별 실제 폭발 시각을 계산한다.
export class DangerMap {
  constructor(size) {
    this.size = size;
    this.start = new Float32Array(size * size);
    this.end = new Float32Array(size * size);
  }

  isSafe(idx) {
    return this.start[idx] === Infinity;
  }

  blast(grid, b, bombAt) {
    const out = [grid.idx(b.x, b.z)];
    for (const d of DIRS) {
      for (let i = 1; i <= b.range; i++) {
        const x = b.x + d.dx * i;
        const z = b.z + d.dz * i;
        const t = grid.get(x, z);
        if (t === TILE.WALL || t === TILE.PILLAR) break;
        const idx = grid.idx(x, z);
        out.push(idx);
        if (isBreakable(t) || bombAt.has(idx)) break;
      }
    }
    return out;
  }

  /** extra: 가상의 물풍선 {x,z,range,t} (설치 전 탈출 가능 여부 판단용) */
  compute(world, extra = null) {
    const { grid } = world;
    this.start.fill(Infinity);
    this.end.fill(-Infinity);

    for (const [idx, f] of world.flames) {
      this.start[idx] = 0;
      this.end[idx] = Math.max(this.end[idx], f.t);
    }

    // 용암은 항상 위험
    for (let i = 0; i < grid.terrain.length; i++) {
      if (grid.terrain[i] === TERRAIN.LAVA) {
        this.start[i] = 0;
        this.end[i] = Infinity;
      }
    }

    // 맵 위험 지역(분출/파도/붕괴) 경고 단계도 폭발 예정으로 취급
    for (const hz of world.hazards || []) {
      if (hz.active) continue;
      const t0 = Math.max(0, hz.warnLeft);
      for (const idx of hz.tiles) {
        if (t0 < this.start[idx]) this.start[idx] = t0;
        this.end[idx] = Math.max(this.end[idx], t0 + hz.duration);
      }
    }

    const bombs = [];
    // 원격 물풍선은 언제든 터질 수 있으므로 곧 터지는 것으로 간주
    for (const b of world.bombs.values()) bombs.push({ x: b.x, z: b.z, range: b.range, t: b.remote ? Math.min(b.timer, 0.6) : b.timer });
    if (extra) bombs.push({ ...extra });
    if (!bombs.length) return this;

    const bombAt = new Map();
    bombs.forEach((b, i) => bombAt.set(grid.idx(b.x, b.z), i));
    const blasts = bombs.map((b) => this.blast(grid, b, bombAt));

    // 연쇄 폭발 시각 전파
    let changed = true;
    let guard = 0;
    while (changed && guard++ < bombs.length + 1) {
      changed = false;
      for (let i = 0; i < bombs.length; i++) {
        for (const idx of blasts[i]) {
          const j = bombAt.get(idx);
          if (j === undefined || j === i) continue;
          const t = bombs[i].t + CONFIG.CHAIN_DELAY;
          if (bombs[j].t > t) {
            bombs[j].t = t;
            changed = true;
          }
        }
      }
    }

    for (let i = 0; i < bombs.length; i++) {
      const t0 = Math.max(0, bombs[i].t);
      for (const idx of blasts[i]) {
        if (t0 < this.start[idx]) this.start[idx] = t0;
        this.end[idx] = Math.max(this.end[idx], t0 + CONFIG.FLAME_DURATION);
      }
    }
    return this;
  }
}
