import { CONFIG, TILE, TERRAIN, DIRS, isBreakable } from '../core/Config.js';

// 격자 맵의 순수 로직 데이터 (렌더링과 분리, 서버에서도 그대로 사용)

/** 맵 크기에 맞는 네 모서리 시작 위치 */
export function spawnPoints(size = CONFIG.MAP_SIZE) {
  const f = size - 2;
  return [
    { x: 1, z: 1 },
    { x: f, z: 1 },
    { x: 1, z: f },
    { x: f, z: f },
  ];
}
export const SPAWN_POINTS = spawnPoints();

/** 인원 수에 따른 공정한 시작 위치 순서 (2인은 대각선) */
export function spawnOrder(count) {
  if (count === 2) return [0, 3];
  if (count === 3) return [0, 3, 1];
  return [0, 1, 2, 3];
}

export class MapGrid {
  constructor(size = CONFIG.MAP_SIZE) {
    this.size = size;
    this.spawns = spawnPoints(size);
    this.tiles = new Uint8Array(size * size);
    this.terrain = new Uint8Array(size * size);
  }

  idx(x, z) {
    return z * this.size + x;
  }

  inBounds(x, z) {
    return x >= 0 && z >= 0 && x < this.size && z < this.size;
  }

  get(x, z) {
    if (!this.inBounds(x, z)) return TILE.WALL;
    return this.tiles[this.idx(x, z)];
  }

  set(x, z, v) {
    if (this.inBounds(x, z)) this.tiles[this.idx(x, z)] = v;
  }

  terrainAt(x, z) {
    if (!this.inBounds(x, z)) return TERRAIN.NONE;
    return this.terrain[this.idx(x, z)];
  }

  isSolid(x, z) {
    return this.get(x, z) !== TILE.EMPTY;
  }

  /** 물줄기를 막는 타일 */
  blocksBlast(x, z) {
    const t = this.get(x, z);
    return t === TILE.WALL || t === TILE.PILLAR;
  }

  isIndestructible(x, z) {
    return this.blocksBlast(x, z);
  }

  /** 사분면 좌표 → 4방향 대칭 좌표 */
  mirror(list) {
    const last = this.size - 1;
    const out = new Map();
    for (const [x, z] of list || []) {
      for (const [mx, mz] of [[x, z], [last - x, z], [x, last - z], [last - x, last - z]]) {
        out.set(this.idx(mx, mz), [mx, mz]);
      }
    }
    return [...out.values()];
  }

  safeZone() {
    const safe = new Set();
    for (const s of this.spawns) {
      const sx = s.x === 1 ? 1 : -1;
      const sz = s.z === 1 ? 1 : -1;
      [[0, 0], [sx, 0], [2 * sx, 0], [0, sz], [0, 2 * sz]].forEach(([ox, oz]) =>
        safe.add(this.idx(s.x + ox, s.z + oz)),
      );
    }
    return safe;
  }

  /**
   * 맵 정의(def.layout)에 따라 대칭 구조로 생성.
   * layout 좌표는 좌상단 사분면 기준 → 자동으로 4방향 대칭.
   * rng: 시드 난수 → 서버와 클라이언트가 같은 시드면 같은 맵
   */
  generate(def = null, rng = Math.random) {
    const L = def?.layout || {};
    const n = this.size;
    const last = n - 1;
    this.tiles.fill(TILE.EMPTY);
    this.terrain.fill(TERRAIN.NONE);

    for (let i = 0; i < n; i++) {
      this.set(i, 0, TILE.WALL);
      this.set(i, last, TILE.WALL);
      this.set(0, i, TILE.WALL);
      this.set(last, i, TILE.WALL);
    }
    // 고정 장애물: 기본은 짝수 좌표 격자
    if (L.pillars !== 'none') {
      for (let z = 2; z < last; z += 2) for (let x = 2; x < last; x += 2) this.set(x, z, TILE.PILLAR);
    }
    for (const [x, z] of this.mirror(L.removePillars)) this.set(x, z, TILE.EMPTY);
    for (const [x, z] of this.mirror(L.extraPillars)) this.set(x, z, TILE.PILLAR);
    for (const [x, z] of this.mirror(L.pits)) this.set(x, z, TILE.PIT);

    // 특수 지형
    for (const patch of L.terrain || []) {
      for (const [x, z] of this.mirror(patch.tiles)) {
        if (this.get(x, z) !== TILE.WALL) this.terrain[this.idx(x, z)] = patch.type;
      }
    }
    for (const conv of L.conveyors || []) {
      for (const [x, z] of conv.tiles) this.terrain[this.idx(x, z)] = conv.type;
    }

    // 시작 위치 주변 안전 공간
    const safe = this.safeZone();
    for (const i of safe) {
      this.tiles[i] = TILE.EMPTY;
      this.terrain[i] = TERRAIN.NONE;
    }

    if (!this.isConnected()) {
      // 안전장치: 연결이 끊기면 추가 장애물을 제거
      console.warn(`[MapGrid] ${def?.id} 레이아웃 연결 끊김 → 추가 장애물 제거`);
      for (let i = 0; i < this.tiles.length; i++) {
        if (this.tiles[i] === TILE.PIT) this.tiles[i] = TILE.EMPTY;
      }
    }

    // 파괴 가능한 블록 (+ 일부는 밀 수 있는 블록): 좌상단 사분면 생성 후 대칭 복사
    const fill = L.blockFill ?? CONFIG.BLOCK_FILL_CHANCE;
    const pushRatio = L.pushRatio ?? 0.14;
    const half = Math.floor(n / 2);
    // openLanes: 항상 비워 두는 통로/광장, sparse: 블록이 드문드문한 구역 (얼음 호수 등)
    const open = new Set(this.mirror(L.openLanes).map(([x, z]) => this.idx(x, z)));
    const sparse = new Set(this.mirror(L.sparse).map(([x, z]) => this.idx(x, z)));
    const sparseFill = L.sparseFill ?? 0.3;
    const canHold = (i) => this.tiles[i] === TILE.EMPTY && !safe.has(i) && !open.has(i) && this.terrain[i] < TERRAIN.CONV_E;
    for (let z = 1; z <= half; z++) {
      for (let x = 1; x <= half; x++) {
        const i = this.idx(x, z);
        if (!canHold(i)) continue;
        const chance = sparse.has(i) ? sparseFill : fill;
        if (rng() < chance) {
          const type = rng() < pushRatio ? TILE.PUSH : TILE.BLOCK;
          for (const [mx, mz] of this.mirror([[x, z]])) {
            const mi = this.idx(mx, mz);
            if (canHold(mi)) this.tiles[mi] = type;
          }
        }
      }
    }
    for (const [x, z] of this.mirror(L.pushBlocks)) {
      const i = this.idx(x, z);
      if (this.tiles[i] === TILE.EMPTY && !safe.has(i)) this.tiles[i] = TILE.PUSH;
    }
  }

  /** 블록을 무시했을 때 모든 시작 위치가 서로 연결되어 있는가 (용암 제외) */
  isConnected() {
    const passable = (i) => (this.tiles[i] === TILE.EMPTY || isBreakable(this.tiles[i])) && this.terrain[i] !== TERRAIN.LAVA;
    const start = this.idx(this.spawns[0].x, this.spawns[0].z);
    const seen = new Uint8Array(this.tiles.length);
    const q = [start];
    seen[start] = 1;
    while (q.length) {
      const c = q.pop();
      const cx = c % this.size;
      const cz = (c / this.size) | 0;
      for (const d of DIRS) {
        const nx = cx + d.dx;
        const nz = cz + d.dz;
        const ni = this.idx(nx, nz);
        if (!this.inBounds(nx, nz) || seen[ni] || !passable(ni)) continue;
        seen[ni] = 1;
        q.push(ni);
      }
    }
    return this.spawns.every((s) => seen[this.idx(s.x, s.z)]);
  }

  /** 시작 위치에서 갈 수 없는 칸 수 (블록은 부술 수 있으므로 통과로 간주). 0 이어야 정상 레이아웃 */
  unreachableCount() {
    const pass = (i) => (this.tiles[i] === TILE.EMPTY || isBreakable(this.tiles[i])) && this.terrain[i] !== TERRAIN.LAVA;
    const start = this.idx(this.spawns[0].x, this.spawns[0].z);
    const seen = new Uint8Array(this.tiles.length);
    const q = [start];
    seen[start] = 1;
    while (q.length) {
      const c = q.pop();
      const cx = c % this.size;
      const cz = (c / this.size) | 0;
      for (const d of DIRS) {
        const nx = cx + d.dx;
        const nz = cz + d.dz;
        const ni = this.idx(nx, nz);
        if (!this.inBounds(nx, nz) || seen[ni] || !pass(ni)) continue;
        seen[ni] = 1;
        q.push(ni);
      }
    }
    let n = 0;
    for (let i = 0; i < this.tiles.length; i++) if (pass(i) && !seen[i]) n++;
    return n;
  }

  countBlocks() {
    let c = 0;
    for (const t of this.tiles) if (isBreakable(t)) c++;
    return c;
  }

  serialize() {
    return { tiles: Array.from(this.tiles), terrain: Array.from(this.terrain) };
  }

  load({ tiles, terrain }) {
    this.tiles.set(tiles);
    this.terrain.set(terrain);
  }
}
