import { DIRS } from '../../core/Config.js';

// BFS 기반 경로 탐색.
// mode 'safe'  : 폭발 예정이 전혀 없는 타일만 이동
// mode 'escape': 도착 시각 기준으로 물줄기와 겹치지 않는 타일만 이동 (탈출용)
export function bfs(world, sx, sz, danger, opts = {}) {
  const { grid } = world;
  const n = grid.size * grid.size;
  const dist = new Int16Array(n).fill(-1);
  const prev = new Int16Array(n).fill(-1);
  const mode = opts.mode || 'safe';
  const stepTime = opts.stepTime || 0.3;
  const avoid = opts.avoid;
  const order = [];

  const s = grid.idx(sx, sz);
  dist[s] = 0;
  const queue = [s];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    order.push(cur);
    const cx = cur % grid.size;
    const cz = (cur / grid.size) | 0;
    for (const d of DIRS) {
      const nx = cx + d.dx;
      const nz = cz + d.dz;
      const ni = grid.idx(nx, nz);
      if (!grid.inBounds(nx, nz) || dist[ni] !== -1) continue;
      if (grid.isSolid(nx, nz) || world.bombs.has(ni)) continue;
      if (avoid && avoid.has(ni)) continue;
      const steps = dist[cur] + 1;
      if (mode === 'safe') {
        if (danger.start[ni] !== Infinity) continue;
      } else {
        const t = steps * stepTime;
        const safeBefore = danger.start[ni] > t + stepTime * 0.6 + 0.12;
        const safeAfter = t - stepTime * 0.5 > danger.end[ni] + 0.08;
        if (!safeBefore && !safeAfter) continue;
      }
      dist[ni] = steps;
      prev[ni] = cur;
      queue.push(ni);
    }
  }
  return { dist, prev, order };
}

export function buildPath(grid, result, target) {
  const path = [];
  let cur = target;
  while (cur !== -1 && result.dist[cur] > 0) {
    path.push({ x: cur % grid.size, z: (cur / grid.size) | 0 });
    cur = result.prev[cur];
  }
  return path.reverse();
}
