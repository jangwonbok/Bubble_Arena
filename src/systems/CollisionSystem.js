import { TILE } from '../core/Config.js';
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
    const bomb = world.bombs.get(world.grid.idx(x, z));
    if (bomb && !(c && bomb.passers.has(c.id))) return false;
    return true;
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
