// Node에서 공용 게임 로직(MatchSimulation)을 맵별로 돌려 보는 헤드리스 테스트
// 실행: node tests/sim-test.mjs
import { EventBus } from '../src/core/EventBus.js';
import { MatchSimulation, RULESETS } from '../src/core/MatchSimulation.js';
import { MAPS } from '../src/maps/index.js';
import { CHARACTER_DEFS } from '../src/characters/characterDefs.js';
import { Character } from '../src/characters/Character.js';
import { TILE } from '../src/core/Config.js';

const PERS = ['aggressive', 'balanced', 'survival', 'aggressive'];
let failed = 0;

for (const map of MAPS) {
  for (let run = 0; run < 3; run++) {
    const bus = new EventBus();
    const stats = { placed: 0, trapped: 0, hazards: 0, elim: 0, items: 0 };
    bus.on('bombPlaced', () => stats.placed++);
    bus.on('trapped', () => stats.trapped++);
    bus.on('hazardActive', () => stats.hazards++);
    bus.on('eliminated', () => stats.elim++);
    bus.on('itemRemoved', ({ by }) => by && stats.items++);
    const chars = CHARACTER_DEFS.map((d, i) => new Character(d, { slot: i, controller: 'ai', personality: PERS[i], human: i === 0 }));
    const sim = new MatchSimulation({ bus, mapDef: map, characters: chars, rules: { ...RULESETS.online, endWhenHumansOut: false }, seed: 1000 + run });

    // 대칭성 검사 (공정성)
    const g = sim.grid;
    let sym = true;
    for (let z = 0; z < g.size; z++) for (let x = 0; x < g.size; x++) {
      const a = g.get(x, z), b = g.get(g.size - 1 - x, g.size - 1 - z);
      if ((a === TILE.BLOCK) !== (b === TILE.BLOCK) || (a === TILE.PILLAR) !== (b === TILE.PILLAR) || (a === TILE.PIT) !== (b === TILE.PIT)) sym = false;
    }
    let err = null;
    const t0 = performance.now();
    try {
      for (let i = 0; i < 180 * 30 && !sim.ended; i++) sim.step(1 / 30);
    } catch (e) {
      err = e;
    }
    const ms = (performance.now() - t0).toFixed(0);
    const pockets = g.unreachableCount();
    const ok = !err && sym && g.isConnected() && pockets === 0;
    if (!ok) failed++;
    console.log(
      `${ok ? 'OK ' : 'ERR'} ${map.id.padEnd(8)} run${run} sym=${sym} pockets=${pockets} end=${sim.outcome?.reason ?? 'none'}@${sim.world.elapsed.toFixed(0)}s ` +
        `placed=${stats.placed} trapped=${stats.trapped} elim=${stats.elim} items=${stats.items} hazards=${stats.hazards} blocksLeft=${g.countBlocks()} ${ms}ms`,
      err ? `\n${err.stack}` : '',
    );
  }
}
console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
process.exit(failed ? 1 : 0);
