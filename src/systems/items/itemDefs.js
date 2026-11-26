import { CONFIG } from '../../core/Config.js';
import { STATE } from '../../characters/Character.js';

// 아이템 레지스트리 (서버/클라이언트 공용, 렌더링 없음)
// 새 아이템 추가: 아래에 항목 하나를 추가하고 ItemView 에 3D 아이콘 빌더를 추가하면 끝.
//  weight : 기본 등장 가중치 (맵 정의의 items.weights 로 덮어쓸 수 있음)
//  apply  : 획득 시 효과 (world 는 범위 효과용)
export const ITEM_CFG = {
  SHIELD_TIME: 10, // 방어막 지속 (그 안에 1회 방어)
  REMOTE_CHARGES: 3, // 원격 물풍선 개수
  REMOTE_MAX: 5,
  REMOTE_FUSE: 8, // 원격 물풍선 자동 폭발까지 (안 누르면)
  LIFE_MAX: 1,
  JUMP_TIME: 6, // 점프 슈즈 지속
  SLOW_TIME: 4, // 시간 지연: 상대 감속 시간
  SLOW_RADIUS: 5, // 시간 지연: 영향 반경(칸)
  SLOW_MULT: 0.5,
  MAGNET_TIME: 10,
  MAGNET_RADIUS: 3,
};

export const ITEM_DEFS = {
  // ---------- 기본 아이템 ----------
  bomb: {
    name: '물풍선 증가',
    desc: '동시에 설치할 수 있는 물풍선 +1 (최대 3개)',
    icon: '💧',
    weight: 0.36,
    basic: true,
    apply(c) {
      c.maxBombs = Math.min(CONFIG.BOMB_MAX_COUNT, c.maxBombs + 1);
    },
  },
  range: {
    name: '물줄기 확장',
    desc: '물풍선 폭발 범위 +1칸 (최대 5칸)',
    icon: '🌊',
    weight: 0.38,
    basic: true,
    apply(c) {
      c.range = Math.min(CONFIG.RANGE_MAX, c.range + 1);
    },
  },
  speed: {
    name: '스피드 업',
    desc: '이동 속도 증가 (기본 속도의 최대 1.5배)',
    icon: '👟',
    weight: 0.26,
    basic: true,
    apply(c) {
      const maxLevel = Math.round((CONFIG.SPEED_MAX_MULT - 1) / CONFIG.SPEED_STEP);
      c.speedLevel = Math.min(maxLevel, c.speedLevel + 1);
    },
  },

  // ---------- 추가 아이템 ----------
  shield: {
    name: '방어막',
    desc: `${ITEM_CFG.SHIELD_TIME}초 동안 물줄기 공격 1회 방어`,
    icon: '🛡️',
    weight: 0.06,
    apply(c) {
      c.shieldTime = ITEM_CFG.SHIELD_TIME;
    },
  },
  remote: {
    name: '원격 폭발',
    desc: `다음 물풍선 ${ITEM_CFG.REMOTE_CHARGES}개를 원하는 순간에 터뜨림 (E 키)`,
    icon: '📡',
    weight: 0.05,
    apply(c) {
      c.remoteCharges = Math.min(ITEM_CFG.REMOTE_MAX, c.remoteCharges + ITEM_CFG.REMOTE_CHARGES);
    },
  },
  life: {
    name: '생명 추가',
    desc: '탈락할 때 1회 살아남음 (물방울·용암·낙하)',
    icon: '❤️',
    weight: 0.04,
    apply(c) {
      c.lives = Math.min(ITEM_CFG.LIFE_MAX, c.lives + 1);
    },
  },
  jump: {
    name: '점프 슈즈',
    desc: `${ITEM_CFG.JUMP_TIME}초 동안 블록·물풍선·물줄기를 뛰어넘음`,
    icon: '🦘',
    weight: 0.05,
    apply(c) {
      c.jumpTime = ITEM_CFG.JUMP_TIME;
    },
  },
  slow: {
    name: '시간 지연',
    desc: `주변 ${ITEM_CFG.SLOW_RADIUS}칸 안의 상대를 ${ITEM_CFG.SLOW_TIME}초 동안 절반 속도로`,
    icon: '⏳',
    weight: 0.05,
    apply(c, world) {
      for (const o of world.characters) {
        if (o === c || o.state === STATE.DEAD) continue;
        if (Math.hypot(o.x - c.x, o.z - c.z) > ITEM_CFG.SLOW_RADIUS) continue;
        o.slowTime = ITEM_CFG.SLOW_TIME;
        world.bus.emit('slowed', { c: o, by: c });
      }
    },
  },
  magnet: {
    name: '아이템 자석',
    desc: `${ITEM_CFG.MAGNET_TIME}초 동안 주변 ${ITEM_CFG.MAGNET_RADIUS}칸의 아이템을 끌어당김`,
    icon: '🧲',
    weight: 0.05,
    apply(c) {
      c.magnetTime = ITEM_CFG.MAGNET_TIME;
    },
  },
};

export const ITEM_IDS = Object.keys(ITEM_DEFS);

/** 기본 가중치 + 맵별 가중치 덮어쓰기 */
export function itemWeights(mapWeights = {}) {
  const w = {};
  for (const [id, d] of Object.entries(ITEM_DEFS)) w[id] = mapWeights[id] ?? d.weight;
  return w;
}
