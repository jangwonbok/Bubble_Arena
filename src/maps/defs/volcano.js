import { TERRAIN } from '../../core/Config.js';

// 3. 화산 지대 (17×17) — 보랏빛 암반 위로 흐르는 용암 강(닿으면 탈락) + 다리 + 주기적 분출
export default {
  id: 'volcano',
  name: '화산 지대',
  theme: 'volcano',
  size: 17,
  description: '용암이 흐르는 화산 지대. 용암 강은 다리로만 건널 수 있고, 닿으면 즉시 탈락!',
  effectText: '용암 강: 닿으면 탈락 · 9초마다 화산 분출 (2초 전 경고)',
  layout: {
    pillars: 'grid',
    removePillars: [[8, 8]],
    altPillars: [[4, 4], [2, 6], [6, 2]], // 분화구
    openLanes: [[7,7],[8,7],[7,8],[8,8]],
    blockFill: 0.95,
    pushRatio: 0.14,
    // 중앙으로 가는 길을 가르는 용암 강. (7,5)/(5,7) 쪽과 외곽이 다리 역할
    terrain: [{ type: TERRAIN.LAVA, tiles: [[7, 3], [8, 3], [7, 4], [3, 7], [3, 8], [4, 7]] }],
  },
  effects: [
    { type: 'hazard', kind: 'eruption', pattern: 'scatter', count: 10, cluster: true, interval: 9, firstDelay: 12, warn: 2.2, duration: 0.9 },
  ],
  items: { dropChance: 0.4, weights: { bomb: 0.34, range: 0.42, speed: 0.24 } },
  visual: {
    floor: { tex: 'rock', a: 0x7a62a0, b: 0x67528a },
    wall: { style: 'basalt', color: 0x4a4046 },
    pillar: { style: 'basalt' },
    pillarAlt: { style: 'vent' },
    block: { style: 'rockCracked' },
    blockAlt: { style: 'crystalRock' },
    push: { style: 'magmaStone' },
    preview: { floor: '#7a62a0', alt: '#67528a', wall: '#2c2629', pillar: '#3d3438', block: '#e09a62', lava: '#ff6a1a', push: '#5a3a3a' },
  },
  env: {
    sky: ['#2a1a3e', '#5a2a4a', '#d0603a'],
    fog: { color: 0x4a2a3a, near: 28, far: 58 },
    hemi: { sky: 0xffc8d0, ground: 0x4a2a3a, intensity: 1.05 },
    sun: { color: 0xffc090, intensity: 2.3 },
    exposure: 1.15,
    ground: 0x3a2e3e,
    scenery: 'volcano',
    particles: 'embers',
  },
};
