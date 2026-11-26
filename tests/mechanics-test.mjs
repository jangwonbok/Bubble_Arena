// 신규 메커니즘 단위 테스트: 블록 밀기 · 용암 · 이동형 발판/낙하 · 기본 물줄기 범위 · 맵 크기
// 실행: node tests/mechanics-test.mjs
import { EventBus } from '../src/core/EventBus.js';
import { MatchSimulation, RULESETS } from '../src/core/MatchSimulation.js';
import { getMap } from '../src/maps/index.js';
import { CHARACTER_DEFS } from '../src/characters/characterDefs.js';
import { Character } from '../src/characters/Character.js';
import { TILE, TERRAIN, CONFIG } from '../src/core/Config.js';
import { BombSystem } from '../src/systems/BombSystem.js';

let fail = 0;
const check = (c, msg) => {
  console.log(`${c ? '  ✔' : '  ✘'} ${msg}`);
  if (!c) fail++;
};

function setup(mapId) {
  const bus = new EventBus();
  const chars = CHARACTER_DEFS.map((d, i) => new Character(d, { slot: i, controller: i === 0 ? 'local' : 'remote', human: true }));
  const sim = new MatchSimulation({ bus, mapDef: getMap(mapId), characters: chars, rules: { ...RULESETS.online, endWhenHumansOut: false }, seed: 5 });
  // 다른 캐릭터는 멀리 (가만히)
  const events = [];
  bus.on('blockPushed', (e) => events.push(['push', e]));
  bus.on('eliminated', (e) => events.push(['elim', e]));
  return { sim, w: sim.world, g: sim.grid, p: chars[0], events };
}
const run = (sim, sec, fn) => {
  for (let i = 0; i < sec * 60; i++) {
    fn?.();
    sim.step(1 / 60);
  }
};

console.log('맵 크기 / 기본 범위');
{
  const { g, p, w } = setup('meadow');
  check(g.size === 17 && CONFIG.MAP_SIZE === 17, `맵 크기 ${g.size}×${g.size}`);
  check(g.spawns[3].x === 15 && g.spawns[3].z === 15, '시작 위치가 맵 크기에 맞춰 모서리에 배치');
  check(p.range === 1, `기본 물줄기 범위 ${p.range}칸`);
  for (const [x, z] of [[2, 3], [3, 3], [4, 3], [3, 2], [3, 4]]) if (g.get(x, z) !== TILE.PILLAR) g.set(x, z, TILE.EMPTY);
  const bt = BombSystem.blastTiles(w, 3, 3, p.range);
  check(bt.length === 5 && bt.every((t) => Math.abs(t.x - 3) + Math.abs(t.z - 3) <= 1), `범위 1 → 중심 + 상하좌우 1칸 (${bt.length}칸)`);
}

console.log('블록 밀기');
{
  const { sim, g, p, events } = setup('meadow');
  // (3,1) 플레이어, (4,1) 밀 블록, (5,1) 빈칸
  for (let x = 1; x <= 6; x++) g.set(x, 1, TILE.EMPTY);
  g.set(4, 1, TILE.PUSH);
  p.x = 3; p.z = 1;
  run(sim, 0.15, () => (p.intentDir = { dx: 1, dz: 0 }));
  check(g.get(4, 1) === TILE.PUSH, '짧게 밀면 움직이지 않음');
  run(sim, 0.2, () => (p.intentDir = { dx: 1, dz: 0 }));
  check(g.get(5, 1) === TILE.PUSH && g.get(4, 1) === TILE.EMPTY, '0.25초 이상 밀면 한 칸 이동');
  check(events.some(([k]) => k === 'push'), 'blockPushed 이벤트 발생 (온라인 동기화용)');
  // 뒤에 블록이 있으면 밀리지 않음
  g.set(7, 1, TILE.BLOCK);
  g.set(6, 1, TILE.EMPTY);
  run(sim, 1.2, () => (p.intentDir = { dx: 1, dz: 0 }));
  check(g.get(6, 1) === TILE.PUSH && g.get(7, 1) === TILE.BLOCK, '앞이 막히면 더 이상 밀리지 않음');
  // 물줄기로 파괴
  p.intentDir = null;
  const bx = Math.round(p.x);
  p.x = bx;
  BombSystem.tryPlace(sim.world, p);
  p.invulnerable = 99;
  run(sim, 3, () => (p.intentDir = null));
  check(g.get(bx + 1, 1) !== TILE.PUSH, '밀 수 있는 블록도 물줄기에 파괴됨');
}

console.log('용암');
{
  const { sim, g, p, events } = setup('volcano');
  let lava = null;
  for (let i = 0; i < g.terrain.length && !lava; i++) if (g.terrain[i] === TERRAIN.LAVA) lava = { x: i % g.size, z: (i / g.size) | 0 };
  check(!!lava, `용암 타일 존재 (${lava?.x},${lava?.z})`);
  // 용암 옆 칸에서 용암 쪽으로 걸어 들어감
  const side = { x: lava.x - 1, z: lava.z };
  if (g.get(side.x, side.z) !== TILE.EMPTY) g.set(side.x, side.z, TILE.EMPTY);
  p.x = side.x; p.z = side.z;
  run(sim, 0.6, () => (p.intentDir = { dx: 1, dz: 0 }));
  check(p.state === 'dead', `용암에 닿으면 탈락 (state=${p.state})`);
  check(events.some(([k, e]) => k === 'elim' && e.cause === 'lava'), '탈락 원인 lava');
}

console.log('이동형 발판 / 낙하');
{
  const { sim, g, w, p, events } = setup('sky');
  check(g.get(8, 4) === TILE.PIT && g.get(8, 8) === TILE.EMPTY, '협곡(허공)과 중앙 다리');
  // 발판 위치 추적
  const xs = [];
  run(sim, 6, () => xs.push(w.platforms[0].z));
  check(Math.min(...xs) <= 2.01 && Math.max(...xs) >= 6.99, `발판 왕복 이동 z ${Math.min(...xs).toFixed(1)}~${Math.max(...xs).toFixed(1)}`);
  // 발판이 없을 때 협곡으로는 이동 불가
  const plat = w.platforms[0];
  const emptyZ = [2, 3, 4, 5, 6, 7].find((z) => Math.abs(plat.z - z) > 1.2);
  g.set(7, emptyZ, TILE.EMPTY);
  p.x = 7; p.z = emptyZ;
  run(sim, 0.3, () => (p.intentDir = { dx: 1, dz: 0 }));
  check(p.x <= 7.001 && p.state === 'alive', '발판 없는 허공으로는 걸어 들어갈 수 없음');
  // 발판 위에 서 있으면 함께 이동
  p.intentDir = null;
  p.x = plat.x; p.z = plat.z;
  const z0 = p.z;
  run(sim, 0.5, () => (p.intentDir = null));
  check(Math.abs(p.z - w.platforms[0].z) < 0.05 && p.state === 'alive', `발판에 타고 이동 (z ${z0.toFixed(2)} → ${p.z.toFixed(2)})`);
  // 허공에 강제로 놓으면 낙하 탈락
  const q = sim.characters[1];
  q.x = 8; q.z = [2, 3, 4, 5, 6, 7].find((z) => Math.abs(w.platforms[0].z - z) > 1.2);
  run(sim, 0.05);
  check(q.state === 'dead' && events.some(([k, e]) => k === 'elim' && e.cause === 'fall'), '발판 없는 허공 → 낙하 탈락');
}

console.log('추가 아이템');
{
  const { ItemSystem } = await import('../src/systems/ItemSystem.js');
  const { ITEM_DEFS, ITEM_CFG } = await import('../src/systems/items/itemDefs.js');
  const { BubbleSystem } = await import('../src/systems/BubbleSystem.js');
  const clearRow = (g) => { for (let x = 1; x <= 9; x++) if (g.get(x, 1) !== TILE.PILLAR) g.set(x, 1, TILE.EMPTY); };

  // 방어막: 물줄기 1회 방어
  {
    const { sim, w, g, p } = setup('meadow');
    clearRow(g);
    ItemSystem.apply(p, 'shield', w);
    w.flames.set(g.idx(1, 1), { t: 0.5, owner: sim.characters[1] });
    run(sim, 0.05);
    check(p.state === 'alive' && p.shieldTime === 0 && p.invulnerable > 0, '방어막: 물줄기 1회 방어 후 소멸');
    p.invulnerable = 0;
    w.flames.set(g.idx(1, 1), { t: 0.5, owner: sim.characters[1] });
    run(sim, 0.05);
    check(p.state === 'trapped', '방어막 소멸 후에는 다시 갇힘');
  }
  // 원격 폭발: 버튼 전까지 안 터지고, 누르면 즉시 폭발
  {
    const { sim, w, g, p } = setup('meadow');
    clearRow(g);
    ItemSystem.apply(p, 'remote', w);
    check(p.remoteCharges === ITEM_CFG.REMOTE_CHARGES, `원격 물풍선 ${p.remoteCharges}개 충전`);
    p.intentBomb = true;
    run(sim, 1 / 60);
    p.invulnerable = 99;
    run(sim, 3.5);
    check(w.bombs.size === 1 && [...w.bombs.values()][0].remote, '원격 물풍선은 2.5초가 지나도 터지지 않음');
    p.intentDetonate = true;
    run(sim, 0.05);
    check(w.bombs.size === 0, 'E 키(원격 폭발)로 즉시 폭발');
  }
  // 생명 추가: 물방울 시간 초과 / 용암에서 1회 생존
  {
    const { sim, w, p } = setup('meadow');
    ItemSystem.apply(p, 'life', w);
    ItemSystem.apply(p, 'life', w);
    check(p.lives === 1, '생명은 최대 1개');
    BubbleSystem.trap(w, p, sim.characters[1]);
    run(sim, 3.2);
    check(p.state === 'alive' && p.lives === 0, '생명 추가: 물방울에서 탈락하지 않고 생존');
    p.invulnerable = 0;
    BubbleSystem.trap(w, p, sim.characters[1]);
    run(sim, 3.2);
    check(p.state === 'dead', '생명이 없으면 정상 탈락');
  }
  // 점프 슈즈: 블록/물풍선 통과 + 물줄기 무시 + 블록 위에서 착지하지 않음
  {
    const { sim, w, g, p } = setup('meadow');
    clearRow(g);
    g.set(2, 1, TILE.BLOCK);
    ItemSystem.apply(p, 'jump', w);
    w.flames.set(g.idx(1, 1), { t: 0.3, owner: sim.characters[1] });
    run(sim, 0.4, () => (p.intentDir = { dx: 1, dz: 0 }));
    check(p.state === 'alive' && p.x > 2, `점프 중: 물줄기 무시 + 블록 넘어감 (x=${p.x.toFixed(2)})`);
    p.x = 2; p.z = 1; p.jumpTime = 0.02;
    run(sim, 0.1, () => (p.intentDir = null));
    check(p.jumpTime > 0, '블록 위에서는 착지하지 않고 공중 유지');
    run(sim, 0.5, () => (p.intentDir = { dx: 1, dz: 0 }));
    check(p.jumpTime === 0 && g.get(p.tx, p.tz) === TILE.EMPTY, '빈 칸에서 착지');
  }
  // 시간 지연: 주변 상대 감속
  {
    const { sim, w, p } = setup('meadow');
    const [, a, b] = sim.characters;
    a.x = p.x + 2; a.z = p.z;
    b.x = 13; b.z = 13;
    const s0 = a.speed;
    ItemSystem.apply(p, 'slow', w);
    check(a.slowTime > 0 && Math.abs(a.speed - s0 * 0.5) < 1e-9, '시간 지연: 반경 안 상대 속도 절반');
    check(b.slowTime === 0 && p.slowTime === 0, '반경 밖 상대와 자신은 영향 없음');
    run(sim, ITEM_CFG.SLOW_TIME + 0.1);
    check(a.slowTime === 0 && a.speed === s0, '시간이 지나면 원래 속도');
  }
  // 아이템 자석
  {
    const { sim, w, g, p } = setup('meadow');
    ItemSystem.apply(p, 'magnet', w);
    const it = { id: 9999, type: 'range', x: 3, z: 1, idx: g.idx(3, 1), grace: 0 };
    w.items.set(it.idx, it);
    const r0 = p.range;
    run(sim, 0.05);
    check(!w.items.has(it.idx) && p.range === r0 + 1, '아이템 자석: 2칸 떨어진 아이템 자동 획득');
  }
  // 등장 가중치: 기본 + 추가 아이템 모두 등장
  {
    const seen = new Set();
    let s = 7;
    const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 3000; i++) seen.add(ItemSystem.pickType(rng));
    check(Object.keys(ITEM_DEFS).every((k) => seen.has(k)), `9종 아이템 모두 등장 (${[...seen].join(', ')})`);
  }
}

console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED');
process.exit(fail ? 1 : 0);
