import { CONFIG } from '../core/Config.js';
import { STATE } from '../characters/Character.js';

// 물방울 갇힘 · 구출 · 탈락
export const BubbleSystem = {
  trap(world, c, by) {
    if (c.state !== STATE.ALIVE) return;
    c.state = STATE.TRAPPED;
    c.trapTimer = CONFIG.TRAP_DURATION;
    c.trappedBy = by;
    c.hitAnim = 0.4;
    c.intentDir = null;
    c.moving = false;
    // 위치를 타일 중심으로 스냅 (물방울이 타일 위에 고정)
    c.x = c.tx;
    c.z = c.tz;
    if (by && by !== c) by.score += CONFIG.SCORE.TRAP;
    world.bus.emit('trapped', { c, by });
  },

  update(world, dt) {
    for (const c of world.characters) {
      if (c.invulnerable > 0) c.invulnerable = Math.max(0, c.invulnerable - dt);
      if (c.placeAnim > 0) c.placeAnim = Math.max(0, c.placeAnim - dt);
      if (c.hitAnim > 0) c.hitAnim = Math.max(0, c.hitAnim - dt);
      if (c.state !== STATE.TRAPPED) continue;

      // 다른 캐릭터가 닿으면 구출
      const rescuer = world.characters.find(
        (o) =>
          o !== c &&
          o.state === STATE.ALIVE &&
          Math.hypot(o.x - c.x, o.z - c.z) < CONFIG.RESCUE_DISTANCE,
      );
      if (rescuer) {
        c.state = STATE.ALIVE;
        c.invulnerable = CONFIG.INVULNERABLE_AFTER_RESCUE;
        c.trapTimer = 0;
        rescuer.score += CONFIG.SCORE.RESCUE;
        rescuer.rescues++;
        world.bus.emit('rescued', { c, by: rescuer });
        continue;
      }

      c.trapTimer -= dt;
      if (c.trapTimer <= 0) this.eliminate(world, c);
    }
  },

  /** cause: 'bubble'(물방울 시간 초과) | 'lava' | 'fall' */
  eliminate(world, c, cause = 'bubble') {
    if (c.lives > 0) {
      c.lives--;
      c.state = STATE.ALIVE;
      c.trapTimer = 0;
      c.invulnerable = 2;
      c.slideDir = null;
      if (cause !== 'bubble') {
        // 용암/허공이면 시작 위치로 돌아감
        c.x = c.spawn.x;
        c.z = c.spawn.z;
      }
      world.bus.emit('lifeUsed', { c, cause });
      return;
    }
    c.state = STATE.DEAD;
    c.deathCause = cause;
    c.eliminatedAt = world.elapsed;
    const killer = c.trappedBy;
    if (killer && killer !== c) {
      killer.kills++;
      killer.score += CONFIG.SCORE.KILL;
    }
    world.bus.emit('eliminated', { c, by: killer, cause });
  },
};
