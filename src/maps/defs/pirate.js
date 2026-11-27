// 7. 해적섬 (17×17) — 왼쪽은 해적선 갑판, 오른쪽은 열대 섬. 가운데 3칸 바다 해협을 다리 3개로 건넌다.
// 해협(x=7~9)은 바다(PIT: 이동 불가, 물줄기는 통과). 다리: z=3 · 8 · 13
// 레이아웃은 4방향 대칭(공정성 유지), 외형만 좌우(배 ↔ 섬)가 다르다.
const CH_X = [7, 8]; // 사분면 기준 (7 → 9 로 대칭)
const BRIDGES = [3, 8]; // 사분면 기준 (3 → 13 으로 대칭)
const channel = [];
for (const x of CH_X) for (let z = 1; z <= 8; z++) if (!BRIDGES.includes(z)) channel.push([x, z]);

const isChannel = (x) => x >= 7 && x <= 9;
const isShip = (x) => x < 7;

export default {
  id: 'pirate',
  name: '해적섬',
  theme: 'pirate',
  size: 17,
  description: '해적선 갑판과 열대 섬 사이로 바다 해협이 흘러요. 다리 3개로만 건널 수 있고, 큰 파도가 갑판을 휩쓸어요',
  effectText: '바다 해협: 다리 3개로만 이동 · 14초마다 큰 파도 (2.2초 전 경고)',
  layout: {
    pillars: 'grid',
    removePillars: [[8, 2], [8, 4], [8, 6], [8, 8], [6, 8]], // 해협 자리 + 가운데 다리 입구
    pits: channel,
    openLanes: [[7, 3], [8, 3], [7, 8], [8, 8], [6, 8]], // 다리 + 가운데 다리 입구
    blockFill: 0.9,
    pushRatio: 0.2,
  },
  effects: [
    { type: 'hazard', kind: 'wave', pattern: 'band', interval: 14, firstDelay: 16, warn: 2.2, duration: 1.2 },
  ],
  items: { dropChance: 0.4, weights: { bomb: 0.35, range: 0.36, speed: 0.29 } },
  visual: {
    floor: { tex: 'deck', a: 0xd9a36a, b: 0xcd9660 },
    // 칸마다 바닥/장애물/블록/벽 외형 선택 (판정과 무관, 렌더링 전용)
    floorAt: (x, z) => {
      if (isChannel(x)) return { tex: 'deck', a: 0xb98552, b: 0xad7a4a }; // 다리 판자
      if (isShip(x)) return { tex: 'deck', a: 0xd9a36a, b: 0xcd9660 };
      return { tex: 'sand', a: 0xf3dda2, b: 0xe9cf8e };
    },
    wallAt: (x) => (x <= 8 ? 'hull' : 'rockwall'),
    pillarAt: (x, z) => {
      if (isShip(x)) return (x + z) % 8 === 0 ? 'mast' : (x * 3 + z) % 4 === 0 ? 'cannon' : 'barrelStack';
      return (x + z) % 6 === 0 ? 'tiki' : (x + z) % 4 === 0 ? 'beachRock' : 'palm';
    },
    blockAt: (x, z) => (isShip(x) ? 'cargoCrate' : (x * 7 + z * 3) % 3 === 0 ? 'treasureChest' : 'sandcastle'),
    landmarks: [{ style: 'seaRocks', x: 8, z: 8 }],
    wall: { style: 'hull', color: 0x7a4a2a },
    pillar: { style: 'barrelStack' },
    block: { style: 'cargoCrate' },
    push: { style: 'barrel' },
    pit: { style: 'water' },
    preview: { floor: '#d9a36a', alt: '#cd9660', wall: '#6b3f22', pillar: '#7a5230', block: '#b07a40', push: '#a0623a', pit: '#2fa6e0' },
  },
  env: {
    sky: ['#2fa8ff', '#8fd8ff', '#e6f8ff'],
    fog: { color: 0xbfe8ff, near: 40, far: 90 },
    hemi: { sky: 0xfff6e0, ground: 0x6fb8d8, intensity: 1.3 },
    sun: { color: 0xfff0d0, intensity: 2.5 },
    exposure: 1.05,
    ground: null,
    scenery: 'pirate',
    particles: null,
  },
};
