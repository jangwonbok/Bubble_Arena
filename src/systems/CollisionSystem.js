import { TILE, CONFIG } from '../core/Config.js';
import { platformCovers } from '../maps/effects/PlatformEffect.js';

// 타일 좌표 기반 충돌 판정
export const CollisionSystem = {
  /** 캐릭터 c가 타일 (x,z)에 들어갈 수 있는가 */
  isPassable(world, c, x, z) {
    const t = world.grid.get(x, z);
    if (t === TILE.PIT) return platformCovers(world, x, z); // 허공은 발판이 있을 때만
    const jumping = c && c.jumpTime > 0;
    if (t !== TILE.EMPTY && !(jumping && (t === TILE.BLOCK || t === TILE.PUSH))) return false;
    if (jumping) return true;
    const idx = world.grid.idx(x, z);
    const bomb = world.bombs.get(idx);
    if (bomb && !(c && bomb.passers.has(c.id))) return false;
    // 물줄기가 살아 있는 칸에는 새로 들어가지 않음 (방향키를 누르고 있어도 칸 중앙에서 멈춤)
    if (c && this.isFlameBlocked(world, c, x, z, idx)) return false;
    return true;
  },

  /** 판정이 살아 있는 물풍선 물줄기 칸인가 (이미 그 칸에 서 있는 캐릭터에게는 장애물이 아님) */
  isFlameBlocked(world, c, x, z, idx = world.grid.idx(x, z)) {
    const f = world.flames?.get(idx);
    if (!f || !f.bomb || f.t < CONFIG.FLAME_SAFE_TAIL) return false;
    return !(Math.round(c.x) === x && Math.round(c.z) === z);
  },

  /** 물풍선/블록/벽이 없는 순수 빈 타일 */
  isFree(world, x, z) {
    return !world.grid.isSolid(x, z) && !world.bombs.has(world.grid.idx(x, z));
  },

  /** 캐릭터가 타일 중심 기준으로 해당 타일과 겹치는가 */
  overlapsTile(c, x, z, margin = 0.8) {
    return Math.abs(c.x - x) < margin && Math.abs(c.z - z) < margin;
  },
};
