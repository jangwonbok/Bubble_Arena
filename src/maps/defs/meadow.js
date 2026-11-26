// 1. 초원 마을 — 기본 맵 (17×17)
// layout 좌표는 좌상단 사분면(1~8) 기준 → 자동 4방향 대칭
export default {
  id: 'meadow',
  name: '초원 마을',
  theme: 'meadow',
  size: 17,
  description: '나무 상자와 풀숲 블록이 빽빽한 마을. 길을 뚫으며 중앙 광장을 차지하세요',
  effectText: '기본 규칙 · 파란 화살표 상자는 밀 수 있음',
  layout: {
    pillars: 'grid',
    removePillars: [[8, 8]], // 중앙 광장
    altPillars: [[4, 4], [2, 8], [8, 2], [6, 6]], // 둥근 나무 (랜드마크)
    openLanes: [[7,7],[8,7],[7,8],[8,8]],
    blockFill: 0.96, // 촘촘한 블록 → 길을 직접 뚫어야 하는 전략적 구조
    pushRatio: 0.15,
  },
  effects: [],
  items: { dropChance: 0.36, weights: { bomb: 0.36, range: 0.38, speed: 0.26 } },
  visual: {
    floor: { tex: 'grass', a: 0x8fdc5c, b: 0x76c94a },
    wall: { style: 'stone', color: 0xb9bfcb },
    pillar: { style: 'stone' },
    pillarAlt: { style: 'tree' },
    block: { style: 'crate' },
    blockAlt: { style: 'leafBlock' }, // 2색 블록 군집
    push: { style: 'pushCrate' },
    preview: { floor: '#86d257', alt: '#76c94a', wall: '#9aa3b2', pillar: '#c3c9d3', block: '#f0a040', push: '#3d8bff' },
  },
  env: {
    sky: ['#5ec8ff', '#a9e3ff', '#e8f8ff'],
    fog: { color: 0xbfe6ff, near: 34, far: 66 },
    hemi: { sky: 0xdff4ff, ground: 0x6aa04a, intensity: 1.25 },
    sun: { color: 0xfff3dc, intensity: 2.4 },
    exposure: 1.05,
    ground: 0x86d057,
    scenery: 'meadow',
    particles: 'petals',
  },
};
