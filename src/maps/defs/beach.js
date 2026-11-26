// 4. 열대 해변 (17×17) — 모래사장, 야자수, 바위 + 주기적으로 가장자리를 덮는 밀물
export default {
  id: 'beach',
  name: '열대 해변',
  theme: 'beach',
  size: 17,
  description: '야자수가 늘어선 모래사장. 12초마다 바닷물이 맵 가장자리 2줄을 덮어요',
  effectText: '밀물: 12초마다 가장자리 2줄 침수 (좌우 ↔ 위아래 번갈아, 2.5초 전 경고)',
  layout: {
    pillars: 'grid',
    removePillars: [[8, 8]],
    altPillars: [[4, 2], [2, 4], [6, 4], [4, 6], [8, 4], [4, 8]], // 해변 바위
    openLanes: [[7,7],[8,7],[7,8],[8,8]],
    blockFill: 0.95,
    pushRatio: 0.16,
  },
  effects: [
    { type: 'hazard', kind: 'tide', pattern: 'tide', depth: 2, interval: 12, firstDelay: 14, warn: 2.5, duration: 1.6 },
  ],
  items: { dropChance: 0.36, weights: { bomb: 0.34, range: 0.36, speed: 0.3 } },
  visual: {
    floor: { tex: 'sand', a: 0xf7e2a8, b: 0xefd593 },
    wall: { style: 'driftwood', color: 0xc89a66 },
    pillar: { style: 'palm' },
    pillarAlt: { style: 'beachRock' },
    block: { style: 'sandcastle' },
    blockAlt: { style: 'coralBlock' },
    push: { style: 'barrel' },
    preview: { floor: '#f6e0a4', alt: '#eed392', wall: '#b88a58', pillar: '#4fb35a', block: '#e8c07a', push: '#a0623a' },
  },
  env: {
    sky: ['#2fb4ff', '#8fdcff', '#fff4d6'],
    fog: { color: 0xc6ecff, near: 36, far: 76 },
    hemi: { sky: 0xfff6dc, ground: 0xe6c88a, intensity: 1.3 },
    sun: { color: 0xfff0cc, intensity: 2.6 },
    exposure: 1.05,
    ground: 0xf1d898,
    scenery: 'beach',
    particles: null,
  },
};
