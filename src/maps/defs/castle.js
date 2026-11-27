import { TERRAIN } from '../../core/Config.js';

// 8. 스위트 캐슬 (17×17) — 과자 성 안뜰. 중앙 3×3 분수대를 사탕 가속 고리가 둘러싸고,
// 격자 기둥 대신 진저브레드 집 · 컵케이크 · 막대사탕이 흩어져 있어 넓은 광장형 구조.
// (좌표는 좌상단 사분면 기준 → 4방향 대칭)
const fountain = [[7, 7], [8, 7], [7, 8], [8, 8]];
const ring = [[6, 6], [7, 6], [8, 6], [6, 7], [6, 8]];
const houses = [[5, 5], [5, 4]];
const cupcakes = [[3, 3], [3, 7]];
const lollipops = [[5, 2], [2, 5], [7, 3], [5, 8]];

// 사분면 좌표로 접기 (어느 칸이든 같은 장식 규칙 적용)
const fold = (v) => Math.min(v, 16 - v);
const has = (list, x, z) => list.some(([a, b]) => a === fold(x) && b === fold(z));

export default {
  id: 'castle',
  name: '스위트 캐슬',
  theme: 'castle',
  size: 17,
  description: '과자로 지은 성의 안뜰. 가운데 분수대를 도는 사탕길은 빠르고, 기둥이 적어 넓게 싸워요',
  effectText: '분수대 둘레 사탕길: 1.55배 가속 · 기둥 대신 과자 집 · 젤리 큐브 밀기',
  layout: {
    pillars: 'none',
    extraPillars: [...fountain, ...houses, ...cupcakes, ...lollipops],
    openLanes: ring,
    blockFill: 0.8,
    pushRatio: 0.16,
    terrain: [{ type: TERRAIN.BOOST, tiles: ring }],
  },
  effects: [],
  items: { dropChance: 0.4, weights: { bomb: 0.35, range: 0.36, speed: 0.29 } },
  visual: {
    floor: { tex: 'checker', a: 0xffd3e2, b: 0xfff1d8 },
    floorAt: (x, z) =>
      x === 8 || z === 8 ? { tex: 'checker', a: 0xc8f0dc, b: 0xe6fff2 } : { tex: 'checker', a: 0xffd3e2, b: 0xfff1d8 },
    wall: { style: 'castle', color: 0xffc2d6 },
    pillar: { style: 'lollipop' },
    pillarAt: (x, z) => {
      if (has(fountain, x, z)) return null; // 분수대는 랜드마크 한 개로 그림
      if (has(houses, x, z)) return 'gingerHouse';
      if (has(cupcakes, x, z)) return 'cupcake';
      return 'lollipop';
    },
    block: { style: 'macaron' },
    blockAt: (x, z) => ['macaron', 'cakeBlock', 'giftBox'][(fold(x) + fold(z)) % 3],
    push: { style: 'jellyCube' },
    landmarks: [{ style: 'fountain', x: 8, z: 8 }],
    preview: { floor: '#ffd3e2', alt: '#fff1d8', wall: '#f59ab8', pillar: '#c0703a', block: '#ff9ac0', boost: '#ffcf3a', push: '#ff7ab8' },
  },
  env: {
    sky: ['#ffa8d6', '#ffd6ec', '#fff6fb'],
    fog: { color: 0xffe6f2, near: 36, far: 74 },
    hemi: { sky: 0xfff4fa, ground: 0xffc0d8, intensity: 1.35 },
    sun: { color: 0xfff6f0, intensity: 2.3 },
    exposure: 1.0,
    ground: 0xbfe8a8,
    scenery: 'castle',
    particles: 'sparkles',
  },
};
