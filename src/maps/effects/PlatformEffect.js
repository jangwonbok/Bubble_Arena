import { STATE } from '../../characters/Character.js';

// 이동형 발판: 허공(PIT) 위 직선 트랙을 왕복. 위치는 경과 시간만으로 결정되므로
// 서버/클라이언트가 같은 시간을 넣으면 같은 위치가 나온다.
export function platformState(cfg, t) {
  const span = cfg.track.length - 1;
  const travel = span / cfg.speed;
  const pause = cfg.pause ?? 0.8;
  const period = 2 * (travel + pause);
  const u = (((t + (cfg.phase || 0)) % period) + period) % period;
  let p;
  if (u < pause) p = 0;
  else if (u < pause + travel) p = (u - pause) * cfg.speed;
  else if (u < 2 * pause + travel) p = span;
  else p = span - (u - 2 * pause - travel) * cfg.speed;
  const a = cfg.track[0];
  const b = cfg.track[span];
  const f = span ? p / span : 0;
  return { x: a[0] + (b[0] - a[0]) * f, z: a[1] + (b[1] - a[1]) * f };
}

/** 캐릭터가 발판 위에 있는가 */
export const onPlatform = (p, c, tol = 0.55) => Math.abs(c.x - p.x) < tol && Math.abs(c.z - p.z) < tol;

/** 허공 타일 (x,z)를 지금 발판이 덮고 있는가 (이동 가능 판정) */
export function platformCovers(world, x, z) {
  for (const p of world.platforms || []) if (Math.round(p.x) === x && Math.round(p.z) === z) return true;
  return false;
}

export function isOnAnyPlatform(world, c, tol = 0.62) {
  for (const p of world.platforms || []) if (onPlatform(p, c, tol)) return true;
  return false;
}

/** 맵 정의의 effects 중 발판 목록 → 현재 위치 계산 (클라이언트 표시용) */
export function computePlatforms(def, t) {
  return (def.effects || []).filter((e) => e.type === 'platform').map((cfg) => platformState(cfg, t));
}

export class PlatformEffect {
  constructor(cfg, index) {
    this.cfg = cfg;
    this.index = index;
  }

  update(world) {
    world.platforms ??= [];
    const s = platformState(this.cfg, world.elapsed);
    const prev = world.platforms[this.index];
    if (!prev) {
      world.platforms[this.index] = { x: s.x, z: s.z };
      return;
    }
    const dx = s.x - prev.x;
    const dz = s.z - prev.z;
    // 발판 위 캐릭터는 함께 이동
    for (const c of world.characters) {
      if (c.state !== STATE.DEAD && onPlatform(prev, c)) {
        c.x += dx;
        c.z += dz;
      }
    }
    prev.x = s.x;
    prev.z = s.z;
  }
}
