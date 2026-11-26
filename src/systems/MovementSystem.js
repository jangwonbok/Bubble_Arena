import { CollisionSystem } from './CollisionSystem.js';
import { TILE, TERRAIN, TERRAIN_SPEED, CONVEYOR_DIR, CONVEYOR_SPEED, PUSH_TIME } from '../core/Config.js';
import { PushSystem } from './PushSystem.js';

const EPS = 1e-4;
const CORNER_ASSIST = 0.42; // 모서리 미끄러짐 허용 오프셋

// 격자 기반 이동: 한 번에 한 축만 중심에서 벗어날 수 있다는 불변식을 유지.
// 진행 방향 반대 축이 어긋나 있으면 먼저 정렬(코너 보정)한 뒤 진행한다.
export const MovementSystem = {
  update(world, dt) {
    for (const c of world.characters) this.stepCharacter(world, c, dt);
  },

  /**
   * 캐릭터 1명을 dt만큼 이동 (지형 효과 포함).
   * 싱글/서버 시뮬레이션과 온라인 클라이언트 예측이 모두 이 함수를 사용 → 결과 일치.
   */
  stepCharacter(world, c, dt) {
    this.updatePassers(world, c);
    if (!c.canAct) {
      c.moving = false;
      c.slideDir = null;
      return;
    }
    const ox = c.x;
    const oz = c.z;
    const grid = world.grid;
    const terr = grid.terrainAt(c.tx, c.tz);
    const mult = TERRAIN_SPEED[terr] || 1;

    c.pushTarget = null;
    if (c.intentDir) {
      c.facing = c.intentDir;
      this.move(world, c, c.intentDir, c.speed * mult * dt);
      c.slideDir = terr === TERRAIN.ICE ? c.intentDir : null;
      // 밀 수 있는 블록을 계속 밀고 있으면 일정 시간 후 한 칸 이동
      const pt = c.pushTarget;
      if (pt) {
        const key = `${pt.x},${pt.z},${c.intentDir.dx},${c.intentDir.dz}`;
        c.pushTime = c.pushKey === key ? (c.pushTime || 0) + dt : dt;
        c.pushKey = key;
        // 온라인 클라이언트 예측(world.predictOnly)에서는 맵을 바꾸지 않음 → 서버가 판정
        if (c.pushTime >= PUSH_TIME && !world.predictOnly) PushSystem.tryPush(world, c, pt.x, pt.z, c.intentDir);
      }
    } else if (c.slideDir) {
      if (terr === TERRAIN.ICE) {
        // 얼음 위: 입력이 없어도 미끄러짐
        this.move(world, c, c.slideDir, c.speed * mult * dt);
        if (Math.abs(c.x - ox) + Math.abs(c.z - oz) < EPS) c.slideDir = null;
      } else {
        // 얼음을 벗어나면 타일 중앙에서 멈춤
        const axis = c.slideDir.dx !== 0 ? 'x' : 'z';
        const s = c.slideDir.dx !== 0 ? c.slideDir.dx : c.slideDir.dz;
        const remain = (Math.round(c[axis]) - c[axis]) * s;
        if (remain > EPS) this.move(world, c, c.slideDir, Math.min(remain, c.speed * dt));
        else c.slideDir = null;
      }
    }

    // 이동형 발판 (컨베이어)
    const conv = CONVEYOR_DIR[grid.terrainAt(c.tx, c.tz)];
    if (conv) this.move(world, c, conv, CONVEYOR_SPEED * dt);

    if (!c.pushTarget) {
      c.pushKey = null;
      c.pushTime = 0;
    }
    c.moving = Math.abs(c.x - ox) + Math.abs(c.z - oz) > EPS;
  },

  /** 물풍선 위에서 벗어나면 해당 물풍선은 그 캐릭터에게도 장애물이 됨 */
  updatePassers(world, c) {
    for (const b of world.bombs.values()) {
      if (b.passers.has(c.id) && !CollisionSystem.overlapsTile(c, b.x, b.z)) b.passers.delete(c.id);
    }
  },

  move(world, c, dir, dist) {
    if (dir.dx !== 0) {
      const r = this.moveAxis(world, c, 'x', 'z', dir.dx, dist);
      return r;
    }
    return this.moveAxis(world, c, 'z', 'x', dir.dz, dist);
  },

  /**
   * main: 진행 축, side: 정렬 축, s: 진행 부호
   */
  moveAxis(world, c, main, side, s, dist) {
    const at = (m, sd) => (main === 'x' ? [m, sd] : [sd, m]);
    const pass = (m, sd) => {
      const [x, z] = at(m, sd);
      return CollisionSystem.isPassable(world, c, x, z);
    };

    const tm = Math.round(c[main]);
    const ts = Math.round(c[side]);
    const off = c[side] - ts;

    if (Math.abs(off) > EPS) {
      // 옆 축이 어긋나 있음 → 정렬 시도
      if (pass(tm + s, ts)) {
        const slide = Math.min(dist, Math.abs(off));
        c[side] -= Math.sign(off) * slide;
        if (Math.abs(c[side] - ts) < EPS) c[side] = ts;
        dist -= slide;
        if (dist <= 0) return;
      } else {
        // 코너 보정: 어긋난 쪽 줄로 미끄러져 들어감
        const ns = ts + Math.sign(off);
        if (Math.abs(off) > 0.5 - CORNER_ASSIST && pass(tm + s, ns) && pass(tm, ns)) {
          const need = Math.abs(ns - c[side]);
          const slide = Math.min(dist, need);
          c[side] += Math.sign(off) * slide;
          if (Math.abs(c[side] - ns) < EPS) c[side] = ns;
        }
        return;
      }
    } else if (!pass(tm + s, ts)) {
      // 정면이 막힘: 타일 중심까지만 이동
      const limit = tm;
      if (s > 0 && c[main] < limit) c[main] = Math.min(limit, c[main] + dist);
      else if (s < 0 && c[main] > limit) c[main] = Math.max(limit, c[main] - dist);
      // 타일 중앙에서 밀 수 있는 블록을 마주하고 있으면 밀기 대상으로 기록
      if (Math.abs(c[main] - tm) < 0.02) {
        const [px, pz] = at(tm + s, ts);
        if (world.grid.get(px, pz) === TILE.PUSH) c.pushTarget = { x: px, z: pz };
      }
      return;
    }

    // 진행 축 이동
    const cur = Math.round(c[main]);
    let next = c[main] + s * dist;
    if (!pass(cur + s, Math.round(c[side]))) {
      // 앞 타일이 막혀 있으면 현재 타일 중심을 넘지 못함 (절대 뒤로 밀지 않음)
      next = s > 0 ? Math.min(next, Math.max(c[main], cur)) : Math.max(next, Math.min(c[main], cur));
    } else {
      // 다음 타일 중심을 넘어서는 경우 그 다음 타일도 확인
      const nCur = Math.round(next);
      if (nCur !== cur && !pass(nCur + s, Math.round(c[side]))) {
        next = s > 0 ? Math.min(next, nCur) : Math.max(next, nCur);
      }
    }
    c[main] = next;
  },
};
