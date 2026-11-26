// 맵 레이아웃 ASCII 출력 + 블록 밀도 통계 (디자인 검토용)
// 실행: node tests/print-maps.mjs [mapId]
import { MAPS } from '../src/maps/index.js';
import { MapGrid } from '../src/map/MapGrid.js';
import { createRng } from '../src/core/rng.js';
import { TILE, TERRAIN } from '../src/core/Config.js';

const only = process.argv[2];
for (const def of MAPS) {
  if (only && def.id !== only) continue;
  const g = new MapGrid(def.size);
  g.generate(def, createRng(42));
  let free = 0, blocks = 0, push = 0;
  const rows = [];
  for (let z = 0; z < g.size; z++) {
    let r = '';
    for (let x = 0; x < g.size; x++) {
      const t = g.get(x, z), tr = g.terrainAt(x, z);
      const sp = g.spawns.some((s) => s.x === x && s.z === z);
      let ch = '.';
      if (t === TILE.WALL) ch = '#';
      else if (t === TILE.PILLAR) ch = 'O';
      else if (t === TILE.PIT) ch = ' ';
      else if (t === TILE.BLOCK) ch = 'b';
      else if (t === TILE.PUSH) ch = 'P';
      else if (tr === TERRAIN.LAVA) ch = '~';
      else if (tr === TERRAIN.ICE) ch = ',';
      else if (tr === TERRAIN.BOOST) ch = '>';
      else if (tr === TERRAIN.JELLY) ch = 'j';
      if (sp) ch = '@';
      if (t === TILE.EMPTY || t === TILE.BLOCK || t === TILE.PUSH) {
        if (tr !== TERRAIN.LAVA) free++;
        if (t === TILE.BLOCK) blocks++;
        if (t === TILE.PUSH) push++;
      }
      r += ch + ' ';
    }
    rows.push(r);
  }
  // 시작 위치에서 (블록은 부술 수 있으므로 통과로 보고) 도달할 수 없는 칸 수
  const pass = (x, z) => { const t = g.get(x, z); return (t === TILE.EMPTY || t === TILE.BLOCK || t === TILE.PUSH) && g.terrainAt(x, z) !== TERRAIN.LAVA; };
  const seen = new Set([g.idx(1, 1)]);
  const q = [[1, 1]];
  while (q.length) {
    const [x, z] = q.pop();
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz, k = g.idx(nx, nz);
      if (!seen.has(k) && pass(nx, nz)) { seen.add(k); q.push([nx, nz]); }
    }
  }
  let unreachable = 0;
  for (let z = 0; z < g.size; z++) for (let x = 0; x < g.size; x++) if (pass(x, z) && !seen.has(g.idx(x, z))) unreachable++;
  console.log(`\n${def.id} ${g.size}x${g.size}  blocks=${blocks} push=${push} density=${((blocks + push) / free * 100).toFixed(0)}% connected=${g.isConnected()} unreachable=${unreachable}`);
  console.log(rows.join('\n'));
}
