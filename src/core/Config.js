// 게임 전역 설정값 (밸런스 수치는 모두 여기서 조정)
export const CONFIG = {
  MAP_SIZE: 17, // 13 → 15 → 17 확대
  GAME_TIME: 180, // 초
  COUNTDOWN: 3,

  BOMB_FUSE: 2.5, // 초
  BOMB_BASE_COUNT: 1,
  BOMB_MAX_COUNT: 3,
  RANGE_BASE: 1, // 기본 물줄기 1칸 (아이템으로 최대 5칸)
  RANGE_MAX: 5,

  SPEED_BASE: 3.2, // 타일/초
  SPEED_STEP: 0.125, // 아이템 1개당 배율 증가
  SPEED_MAX_MULT: 1.5,

  FLAME_DURATION: 0.55, // 물줄기 지속 (피격 판정 시간)
  CHAIN_DELAY: 0.08, // 연쇄 폭발 지연
  TRAP_DURATION: 3.0, // 물방울 갇힘 → 탈락까지
  RESCUE_DISTANCE: 0.7,
  INVULNERABLE_AFTER_RESCUE: 1.0,

  BLOCK_FILL_CHANCE: 0.72,
  ITEM_DROP_CHANCE: 0.45,
  ITEM_WEIGHTS: { bomb: 0.36, range: 0.38, speed: 0.26 },
  ITEM_FLAME_GRACE: 0.6, // 블록에서 나온 아이템이 같은 폭발에 지워지지 않도록

  SCORE: {
    BLOCK: 10,
    ITEM: 20,
    TRAP: 30,
    KILL: 100,
    RESCUE: 50,
    SURVIVE_BONUS: 200,
  },
};

export const TILE = {
  EMPTY: 0,
  WALL: 1, // 외곽 벽 (파괴 불가)
  PILLAR: 2, // 내부 고정 장애물 (파괴 불가)
  BLOCK: 3, // 파괴 가능한 나무 블록
  PIT: 4, // 이동 불가 지형 (하늘 섬의 허공). 물줄기는 통과, 이동형 발판이 있으면 밟을 수 있음
  PUSH: 5, // 밀어서 옮길 수 있는 블록 (물줄기로 파괴 가능)
};

// 바닥 특수 지형 (TILE과 별도 레이어)
export const TERRAIN = {
  NONE: 0,
  ICE: 1, // 미끄러짐
  BOOST: 2, // 가속 발판
  JELLY: 3, // 감속 젤리
  CONV_E: 4, // 이동형 발판(컨베이어) →
  CONV_W: 5, // ←
  CONV_S: 6, // ↓
  CONV_N: 7, // ↑
  LAVA: 8, // 용암: 닿으면 탈락
};

export const TERRAIN_SPEED = { 1: 1.25, 2: 1.55, 3: 0.6 };
export const CONVEYOR_SPEED = 1.4; // 타일/초
export const CONVEYOR_DIR = {
  4: { dx: 1, dz: 0 },
  5: { dx: -1, dz: 0 },
  6: { dx: 0, dz: 1 },
  7: { dx: 0, dz: -1 },
};

export const NET = {
  TICK_RATE: 30,
  PORT: 2567, // 8787 등은 Windows 예약 포트 범위와 겹칠 수 있음
  MAX_PLAYERS: 4,
};

export const DIRS = [
  { dx: 1, dz: 0 },
  { dx: -1, dz: 0 },
  { dx: 0, dz: 1 },
  { dx: 0, dz: -1 },
];

/** 물줄기로 파괴되는 블록인가 (일반 블록 + 밀 수 있는 블록) */
export const isBreakable = (t) => t === TILE.BLOCK || t === TILE.PUSH;
/** 이동형 발판(컨베이어) 지형인가 */
export const isConveyor = (tr) => tr >= TERRAIN.CONV_E && tr <= TERRAIN.CONV_N;
/** 블록을 밀기 위해 밀고 있어야 하는 시간(초) */
export const PUSH_TIME = 0.25;
