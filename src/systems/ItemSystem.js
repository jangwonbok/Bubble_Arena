import { CONFIG, TILE } from '../core/Config.js';
import { STATE } from '../characters/Character.js';
import { ITEM_DEFS, ITEM_CFG, itemWeights } from './items/itemDefs.js';

// 하위 호환: 아이템 표시 정보
export const ITEM_TYPES = Object.fromEntries(Object.entries(ITEM_DEFS).map(([k, d]) => [k, { label: d.name, icon: d.icon }]));

let nextItemId = 1;

// 파괴된 블록에서 확률적으로 아이템 등장 → 획득 시 효과 적용 + 지속 효과 시간 관리
export const ItemSystem = {
  /** 맵별 아이템 생성 규칙 (world.map.items) → 없으면 기본값 */
  rules(world) {
    return {
      dropChance: world.map?.items?.dropChance ?? CONFIG.ITEM_DROP_CHANCE,
      weights: itemWeights(world.map?.items?.weights),
    };
  },

  pickType(rng, w = itemWeights()) {
    const entries = Object.entries(w);
    let r = rng() * entries.reduce((s, [, v]) => s + v, 0);
    for (const [id, v] of entries) {
      if ((r -= v) < 0) return id;
    }
    return entries[0][0];
  },

  maybeSpawn(world, x, z) {
    const r = this.rules(world);
    if (world.rng() > r.dropChance) return;
    const item = {
      id: nextItemId++,
      type: this.pickType(world.rng, r.weights),
      x,
      z,
      idx: world.grid.idx(x, z),
      grace: CONFIG.ITEM_FLAME_GRACE,
    };
    world.items.set(item.idx, item);
    world.bus.emit('itemSpawned', { item });
  },

  flameHit(world, idx) {
    const item = world.items.get(idx);
    if (!item || item.grace > 0) return;
    world.items.delete(idx);
    world.bus.emit('itemRemoved', { item, by: null });
  },

  apply(c, type, world) {
    ITEM_DEFS[type]?.apply(c, world);
  },

  pick(world, c, item, magnet = false) {
    world.items.delete(item.idx);
    this.apply(c, item.type, world);
    c.score += CONFIG.SCORE.ITEM;
    world.bus.emit('itemRemoved', { item, by: c, magnet });
  },

  /** 지속 효과 시간 감소 */
  tickEffects(world, c, dt) {
    if (c.shieldTime > 0) c.shieldTime = Math.max(0, c.shieldTime - dt);
    if (c.slowTime > 0) c.slowTime = Math.max(0, c.slowTime - dt);
    if (c.magnetTime > 0) c.magnetTime = Math.max(0, c.magnetTime - dt);
    if (c.jumpTime > 0) {
      const next = c.jumpTime - dt;
      if (next > 0) c.jumpTime = next;
      else {
        // 블록 위에서 착지하지 않도록: 빈 칸에 설 때까지 공중 유지
        const t = world.grid.get(c.tx, c.tz);
        if (t === TILE.BLOCK || t === TILE.PUSH) c.jumpTime = 0.05;
        else {
          c.jumpTime = 0;
          const bomb = world.bombs.get(world.grid.idx(c.tx, c.tz));
          if (bomb) bomb.passers.add(c.id); // 물풍선 위에 착지하면 빠져나갈 수 있게
        }
      }
    }
  },

  update(world, dt) {
    for (const item of world.items.values()) if (item.grace > 0) item.grace -= dt;
    for (const c of world.characters) {
      if (c.state === STATE.DEAD) continue;
      this.tickEffects(world, c, dt);
      if (!c.canAct) continue;
      const item = world.items.get(world.grid.idx(c.tx, c.tz));
      if (item) this.pick(world, c, item);
      // 아이템 자석: 반경 안의 아이템을 끌어당겨 획득
      if (c.magnetTime > 0) {
        for (const it of [...world.items.values()]) {
          if (it.grace > 0) continue;
          if (Math.hypot(it.x - c.x, it.z - c.z) <= ITEM_CFG.MAGNET_RADIUS) this.pick(world, c, it, true);
        }
      }
    }
  },
};
