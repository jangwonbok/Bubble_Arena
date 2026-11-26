import { TILE, TERRAIN } from '../core/Config.js';
import { STATE } from '../characters/Character.js';
import { isOnAnyPlatform } from '../maps/effects/PlatformEffect.js';

// 치명적 지형 판정: 용암에 닿으면 탈락 / 발판 없는 허공에 서 있으면 낙하 탈락
export const TerrainSystem = {
  update(world) {
    const g = world.grid;
    for (const c of world.characters) {
      if (c.state === STATE.DEAD) continue;
      const x = c.tx;
      const z = c.tz;
      if (g.get(x, z) === TILE.PIT && !isOnAnyPlatform(world, c)) {
        c.trappedBy = null;
        world.systems.bubble.eliminate(world, c, 'fall');
      } else if (g.terrainAt(x, z) === TERRAIN.LAVA && c.state === STATE.ALIVE && c.invulnerable <= 0) {
        c.trappedBy = null;
        world.systems.bubble.eliminate(world, c, 'lava');
      }
    }
  },
};
