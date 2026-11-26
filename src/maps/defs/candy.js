import { TERRAIN } from '../../core/Config.js';

// 5. 캔디 월드 (17×17) — 사탕/컵케이크 장애물, 초콜릿 블록, 젤리 바닥, 줄무늬 가속 사탕길, 밀 수 있는 젤리 큐브
const jelly = [];
for (let z = 6; z <= 8; z++) for (let x = 6; x <= 8; x++) jelly.push([x, z]);

export default {
  id: 'candy',
  name: '캔디 월드',
  theme: 'candy',
  size: 17,
  description: '알록달록한 동화 속 과자 나라. 사탕길은 빠르고 중앙 젤리 바닥은 끈적해요',
  effectText: '사탕길: 1.55배 가속 · 젤리 바닥: 0.6배 감속 · 젤리 큐브 밀기',
  layout: {
    pillars: 'grid',
    removePillars: [[8, 8]],
    altPillars: [[4, 4], [2, 8], [8, 2]], // 컵케이크
    openLanes: [[7, 7], [8, 7], [7, 8], [8, 8]],
    sparse: jelly,
    sparseFill: 0.35,
    blockFill: 0.96,
    pushRatio: 0.2,
    terrain: [
      { type: TERRAIN.BOOST, tiles: [[3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [3, 4], [3, 5], [3, 6], [3, 7], [3, 8]] },
      { type: TERRAIN.JELLY, tiles: jelly },
    ],
  },
  effects: [],
  items: { dropChance: 0.38, weights: { bomb: 0.36, range: 0.36, speed: 0.28 } },
  visual: {
    floor: { tex: 'candy', a: 0xffd6e8, b: 0xfff0f6 },
    wall: { style: 'biscuit', color: 0xe8b070 },
    pillar: { style: 'candyCane' },
    pillarAlt: { style: 'cupcake' },
    block: { style: 'chocolate' },
    blockAlt: { style: 'giftBox' },
    push: { style: 'jellyCube' },
    preview: { floor: '#ffd6e8', alt: '#fff0f6', wall: '#d9a062', pillar: '#ff6b9a', block: '#7a4a2a', boost: '#ffcf3a', jelly: '#7be0a0', push: '#ff7ab8' },
  },
  env: {
    sky: ['#ff9ccf', '#ffd0ea', '#fff4fb'],
    fog: { color: 0xffe0f0, near: 34, far: 68 },
    hemi: { sky: 0xfff0fa, ground: 0xffb0d0, intensity: 1.35 },
    sun: { color: 0xfff4f0, intensity: 2.2 },
    exposure: 1.0,
    ground: 0xffc4e0,
    scenery: 'candy',
    particles: 'sparkles',
  },
};
