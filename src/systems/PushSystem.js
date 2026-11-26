import { TILE, TERRAIN } from '../core/Config.js';
import { CollisionSystem } from './CollisionSystem.js';
import { STATE } from '../characters/Character.js';

// 밀 수 있는 블록: 블록 쪽으로 PUSH_TIME 동안 계속 밀면 한 칸 이동.
// 도착 칸이 비어 있어야 함 (벽/블록/물풍선/아이템/캐릭터/허공/용암 불가)
export const PushSystem = {
  canPushTo(world, tx, tz) {
    const g = world.grid;
    if (g.get(tx, tz) !== TILE.EMPTY) return false;
    if (g.terrainAt(tx, tz) === TERRAIN.LAVA) return false;
    const ti = g.idx(tx, tz);
    if (world.bombs.has(ti) || world.items.has(ti)) return false;
    for (const o of world.characters) {
      if (o.state !== STATE.DEAD && CollisionSystem.overlapsTile(o, tx, tz, 0.9)) return false;
    }
    return true;
  },

  tryPush(world, c, x, z, dir) {
    const g = world.grid;
    if (g.get(x, z) !== TILE.PUSH) return false;
    const tx = x + dir.dx;
    const tz = z + dir.dz;
    if (!this.canPushTo(world, tx, tz)) return false;
    g.set(x, z, TILE.EMPTY);
    g.set(tx, tz, TILE.PUSH);
    c.pushTime = 0;
    world.bus.emit('blockPushed', { from: g.idx(x, z), to: g.idx(tx, tz), fx: x, fz: z, tx, tz, by: c });
    return true;
  },
};
