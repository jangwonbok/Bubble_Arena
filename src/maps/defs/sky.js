// 6. 하늘 섬 (17×17) — 구름 위 경기장. 중앙 허공 협곡을 오가는 이동형 발판 + 낙하 구멍 + 무너지는 구름
// 협곡(x=8)은 위/중앙/아래 다리(z=1, 8, 15)와 이동형 발판으로만 건널 수 있다.
const gap = [[8, 2], [8, 3], [8, 4], [8, 5], [8, 6], [8, 7]];

export default {
  id: 'sky',
  name: '하늘 섬',
  theme: 'sky',
  size: 17,
  description: '구름 위에 떠 있는 경기장. 협곡의 이동형 발판을 타고 건너세요. 떨어지면 탈락!',
  effectText: '이동형 발판 · 허공에 떨어지면 탈락 · 10초마다 구름 붕괴',
  layout: {
    pillars: 'grid',
    removePillars: [[8, 8]], // 중앙 다리
    pits: [...gap, [1, 8]], // 협곡 2구간 + 좌우 가장자리 구멍
    openLanes: [[7, 2], [7, 3], [7, 4], [7, 5], [7, 6], [7, 7], [7, 8], [8, 8]], // 협곡 옆 승강장
    blockFill: 0.94,
    pushRatio: 0.12,
  },
  effects: [
    // 위쪽 협곡 발판 (z 2→6 왕복), 아래쪽 협곡 발판 (z 12→8 왕복, 위상 반대)
    { type: 'platform', track: [[8, 2], [8, 3], [8, 4], [8, 5], [8, 6], [8, 7]], speed: 1.2, pause: 1.0, phase: 0 },
    { type: 'platform', track: [[8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9]], speed: 1.2, pause: 1.0, phase: 0 },
    { type: 'hazard', kind: 'crumble', pattern: 'scatter', count: 7, interval: 10, firstDelay: 14, warn: 2.0, duration: 1.4 },
  ],
  items: { dropChance: 0.36, weights: { bomb: 0.35, range: 0.35, speed: 0.3 } },
  visual: {
    floor: { tex: 'cloud', a: 0xf4f8ff, b: 0xd9e6fa },
    wall: { style: 'cloudstone', color: 0xaebfdc },
    pillar: { style: 'cloudPillar' },
    block: { style: 'cloudPuff' },
    blockAlt: { style: 'starCloud' },
    push: { style: 'cloudCushion' },
    pit: { style: 'void' },
    preview: { floor: '#ffffff', alt: '#eaf1fc', wall: '#b8c8e4', pillar: '#ffd86b', block: '#dfe9ff', push: '#ffb3d1', pit: '#5cb8ff', plat: '#ffd86b' },
  },
  env: {
    sky: ['#3d8bff', '#8fc8ff', '#e2f2ff'],
    fog: { color: 0xcfe6ff, near: 38, far: 86 },
    hemi: { sky: 0xffffff, ground: 0x9cc8ff, intensity: 1.4 },
    sun: { color: 0xfff6e6, intensity: 2.4 },
    exposure: 1.05,
    ground: null, // 바닥 없음 (떠 있는 섬)
    scenery: 'sky',
    particles: 'clouds',
  },
};
