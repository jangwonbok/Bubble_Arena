import { CONFIG } from './Config.js';
import { createRng } from './rng.js';
import { MapGrid, spawnOrder } from '../map/MapGrid.js';
import { STATE } from '../characters/Character.js';
import { MovementSystem } from '../systems/MovementSystem.js';
import { BombSystem } from '../systems/BombSystem.js';
import { BubbleSystem } from '../systems/BubbleSystem.js';
import { ItemSystem } from '../systems/ItemSystem.js';
import { AISystem } from '../systems/AISystem.js';
import { TerrainSystem } from '../systems/TerrainSystem.js';
import { createMapEffects } from '../maps/effects/HazardEffect.js';

// 모드별 규칙
export const RULESETS = {
  single: { time: CONFIG.GAME_TIME, respawn: false, endWhenLocalDies: true, endWhenHumansOut: false, saveRecords: true },
  practice: { time: CONFIG.GAME_TIME, respawn: true, respawnDelay: 2.5, endWhenLocalDies: false, endWhenHumansOut: false, saveRecords: false },
  online: { time: CONFIG.GAME_TIME, respawn: false, endWhenLocalDies: false, endWhenHumansOut: true, saveRecords: true },
};

/**
 * 한 판의 게임 로직 전체 (렌더링 없음).
 * - 싱글/AI 연습전: 브라우저에서 실행
 * - 온라인: Node 서버에서 실행 (서버 권한 판정)
 * 같은 코드가 양쪽에서 돌아가므로 판정 결과가 항상 일치한다.
 */
export class MatchSimulation {
  constructor({ bus, mapDef, characters, rules = RULESETS.single, seed = 1 }) {
    this.bus = bus;
    this.mapDef = mapDef;
    this.rules = rules;
    this.seed = seed;
    this.rng = createRng(seed);

    this.grid = new MapGrid(mapDef.size || CONFIG.MAP_SIZE);
    this.grid.generate(mapDef, this.rng);

    this.characters = characters;
    this.world = {
      grid: this.grid,
      characters,
      bombs: new Map(),
      flames: new Map(),
      items: new Map(),
      hazards: [],
      hazardSeq: 0,
      platforms: [],
      bus,
      rng: this.rng,
      elapsed: 0,
      map: mapDef,
      rules,
      systems: { bubble: BubbleSystem, item: ItemSystem },
    };
    this.effects = createMapEffects(mapDef);

    const order = spawnOrder(characters.length);
    characters.forEach((c, i) => c.reset(this.grid.spawns[order[i]]));
    for (const e of this.effects) if (e.cfg?.track) e.update(this.world); // 발판 초기 위치

    this.ai = new AISystem();
    this.ai.setup(characters);
    this.timeLeft = rules.time;
    this.outcome = null;
  }

  get ended() {
    return !!this.outcome;
  }

  /** 고정/가변 dt 모두 가능. 입력(intentDir/intentBomb)은 호출 전에 설정 */
  step(dt) {
    if (this.outcome) return;
    const w = this.world;
    w.elapsed += dt;
    this.timeLeft = Math.max(0, this.timeLeft - dt);

    this.ai.update(w, dt);
    for (const c of this.characters) {
      if (c.intentBomb) BombSystem.tryPlace(w, c);
      if (c.intentDetonate && c.canAct) BombSystem.detonate(w, c);
      c.intentBomb = false;
      c.intentDetonate = false;
    }
    for (const e of this.effects) e.update(w, dt); // 발판 이동 · 위험 지역
    MovementSystem.update(w, dt);
    TerrainSystem.update(w); // 용암 / 낙하
    BombSystem.update(w, dt);
    BubbleSystem.update(w, dt);
    ItemSystem.update(w, dt);
    if (this.rules.respawn) this.updateRespawn();
    this.checkEnd();
  }

  updateRespawn() {
    const w = this.world;
    for (const c of this.characters) {
      if (c.state !== STATE.DEAD) continue;
      if (c.respawnAt == null) c.respawnAt = w.elapsed + this.rules.respawnDelay;
      else if (w.elapsed >= c.respawnAt) {
        c.respawnAt = null;
        c.deaths++;
        c.x = c.spawn.x;
        c.z = c.spawn.z;
        c.state = STATE.ALIVE;
        c.invulnerable = 2;
        c.trapTimer = 0;
        c.slideDir = null;
        c.maxBombs = CONFIG.BOMB_BASE_COUNT;
        c.range = CONFIG.RANGE_BASE;
        c.speedLevel = 0;
        c.clearItemEffects();
        this.bus.emit('respawned', { c });
      }
    }
  }

  checkEnd() {
    const alive = this.characters.filter((c) => c.state !== STATE.DEAD);
    const r = this.rules;
    if (r.endWhenLocalDies && this.characters.some((c) => c.controller === 'local' && c.state === STATE.DEAD)) {
      this.finish('eliminated');
    } else if (!r.respawn && alive.length <= 1) {
      this.finish('lastStanding');
    } else if (r.endWhenHumansOut && !alive.some((c) => c.human)) {
      this.finish('humansOut');
    } else if (this.timeLeft <= 0) {
      this.finish('timeUp');
    }
  }

  finish(reason) {
    if (this.outcome) return;
    const alive = this.characters.filter((c) => c.state !== STATE.DEAD);
    if (reason !== 'eliminated') for (const c of alive) c.score += CONFIG.SCORE.SURVIVE_BONUS;

    const ranking = [...this.characters].sort((a, b) => {
      if (this.rules.respawn) return b.score - a.score;
      const aa = a.state !== STATE.DEAD;
      const ba = b.state !== STATE.DEAD;
      if (aa !== ba) return aa ? -1 : 1;
      if (!aa && a.eliminatedAt !== b.eliminatedAt) return b.eliminatedAt - a.eliminatedAt;
      return b.score - a.score;
    });
    const winner = ranking[0];
    for (const c of this.characters) {
      c.intentDir = null;
      c.moving = false;
      c.slideDir = null;
      if (c.state === STATE.TRAPPED) c.state = STATE.ALIVE; // 종료 시 물방울 해제
      if (c.state !== STATE.DEAD) c.result = c === winner ? 'win' : 'lose';
      c.facing = { dx: 0, dz: 1 };
    }
    this.outcome = { reason, ranking: ranking.map((c) => c.id), winnerId: winner.id };
    this.bus.emit('matchEnd', this.outcome);
  }
}
