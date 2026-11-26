import { TERRAIN } from '../../core/Config.js';

// 2. 얼음 왕국 (17×17) — 중앙의 큰 얼음 호수(미끄러짐) + 얼음 장애물 + 눈사람 + 밀 수 있는 눈덩이
const lake = [];
for (let z = 5; z <= 8; z++) for (let x = 5; x <= 8; x++) lake.push([x, z]);

export default {
  id: 'ice',
  name: '얼음 왕국',
  theme: 'ice',
  size: 17,
  description: '눈과 얼음으로 덮인 왕국. 중앙 얼음 호수는 미끄럽고, 눈덩이는 밀어서 옮길 수 있어요',
  effectText: '얼음 호수: 1.25배 속도 · 키를 떼도 미끄러짐 · 눈덩이 밀기',
  layout: {
    pillars: 'grid',
    removePillars: [[8, 8]],
    altPillars: [[2, 2], [6, 2], [2, 6], [4, 4]], // 눈사람
    openLanes: [[7,7],[8,7],[7,8],[8,8]],
    sparse: lake, // 얼음 호수는 블록이 드문드문 → 미끄러지며 질주
    sparseFill: 0.22,
    blockFill: 0.95,
    pushRatio: 0.28, // 눈덩이가 많음
    terrain: [
      { type: TERRAIN.ICE, tiles: lake },
      { type: TERRAIN.ICE, tiles: [[3, 8], [8, 3], [4, 8], [8, 4]] },
    ],
  },
  effects: [],
  items: { dropChance: 0.36, weights: { bomb: 0.38, range: 0.38, speed: 0.24 } },
  visual: {
    floor: { tex: 'snow', a: 0xf7fbff, b: 0xe6eefa },
    wall: { style: 'ice', color: 0xcfe6ff },
    pillar: { style: 'iceCrystal' },
    pillarAlt: { style: 'snowman' },
    block: { style: 'snow' },
    blockAlt: { style: 'iceBlock' },
    push: { style: 'snowball' },
    preview: { floor: '#f1f7ff', alt: '#e0ecfa', wall: '#a8c8ec', pillar: '#7fc4ff', block: '#b9d4f5', ice: '#7fcfff', push: '#ffffff' },
  },
  env: {
    sky: ['#7fb2e8', '#c4dcf5', '#f2f8ff'],
    fog: { color: 0xdceafa, near: 30, far: 60 },
    hemi: { sky: 0xeef6ff, ground: 0x9fb6d6, intensity: 1.35 },
    sun: { color: 0xeaf4ff, intensity: 2.1 },
    exposure: 1.0,
    ground: 0xeef5ff,
    scenery: 'ice',
    particles: 'snow',
  },
};
