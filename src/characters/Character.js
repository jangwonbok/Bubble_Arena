import { CONFIG } from '../core/Config.js';

// 캐릭터의 순수 상태 데이터 (렌더링과 분리)
export const STATE = {
  ALIVE: 'alive',
  TRAPPED: 'trapped',
  DEAD: 'dead',
};

export class Character {
  /**
   * def: 외형 정의(characterDefs), opts:
   *  slot       : 경기 내 고유 번호(0~3) → id
   *  controller : 'local'(이 브라우저의 플레이어) | 'remote'(다른 플레이어) | 'ai'
   *  personality: AI 성향 (aggressive | balanced | survival)
   *  name       : 표시 이름(닉네임)
   */
  constructor(def, opts = {}) {
    this.def = def;
    this.id = opts.slot ?? def.id;
    this.controller = opts.controller ?? (def.personality === null ? 'local' : 'ai');
    this.personality = opts.personality ?? def.personality ?? 'balanced';
    this.name = opts.name ?? def.name;
    this.human = opts.human ?? this.controller !== 'ai';
    this.spawn = null;
  }

  /** 이 브라우저에서 조작하는 캐릭터인가 */
  get isPlayer() {
    return this.controller === 'local';
  }

  reset(spawn) {
    this.spawn = spawn;
    this.slideDir = null;
    this.deaths = 0;
    this.x = spawn.x;
    this.z = spawn.z;
    this.facing = { dx: 0, dz: 1 };
    this.state = STATE.ALIVE;
    this.trapTimer = 0;
    this.trappedBy = null;
    this.invulnerable = 0;

    this.maxBombs = CONFIG.BOMB_BASE_COUNT;
    this.activeBombs = 0;
    this.range = CONFIG.RANGE_BASE;
    this.speedLevel = 0;
    this.clearItemEffects();

    this.score = 0;
    this.kills = 0;
    this.rescues = 0;
    this.eliminatedAt = null;

    // 입력 의도 (플레이어/AI 공통 인터페이스)
    this.intentDir = null;
    this.intentBomb = false;
    this.intentDetonate = false;

    // 애니메이션용 상태
    this.moving = false;
    this.placeAnim = 0;
    this.hitAnim = 0;
    this.result = null; // 'win' | 'lose'
  }

  /** 추가 아이템 효과 초기화 */
  clearItemEffects() {
    this.shieldTime = 0; // 방어막 남은 시간
    this.remoteCharges = 0; // 원격 물풍선 남은 개수
    this.lives = 0; // 추가 생명
    this.jumpTime = 0; // 점프 슈즈 남은 시간
    this.slowTime = 0; // 시간 지연(감속) 남은 시간
    this.magnetTime = 0; // 아이템 자석 남은 시간
  }

  get tx() {
    return Math.round(this.x);
  }

  get tz() {
    return Math.round(this.z);
  }

  get speedMult() {
    return Math.min(CONFIG.SPEED_MAX_MULT, 1 + this.speedLevel * CONFIG.SPEED_STEP);
  }

  get speed() {
    return CONFIG.SPEED_BASE * this.speedMult * (this.slowTime > 0 ? 0.5 : 1);
  }

  get alive() {
    return this.state !== STATE.DEAD;
  }

  get canAct() {
    return this.state === STATE.ALIVE;
  }

  get bombsLeft() {
    return this.maxBombs - this.activeBombs;
  }
}
