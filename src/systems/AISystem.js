import { CONFIG } from '../core/Config.js';
import { DangerMap } from './ai/DangerMap.js';
import { AIBrain } from './ai/AIBrain.js';

// controller === 'ai' 인 캐릭터를 독립적으로 구동.
// 온라인에서 플레이어가 접속을 끊으면 controller를 'ai'로 바꾸는 것만으로 AI가 대신 조종한다.
// 위험 지도는 프레임마다 1회 계산하여 공유.
export class AISystem {
  constructor() {
    this.danger = new DangerMap(CONFIG.MAP_SIZE);
    this.brains = new Map(); // character id → AIBrain
  }

  setup(characters) {
    this.brains.clear();
    this.characters = characters;
  }

  reset() {
    for (const b of this.brains.values()) b.reset();
  }

  brainFor(c) {
    let b = this.brains.get(c.id);
    if (!b || b.c !== c) {
      b = new AIBrain(c);
      this.brains.set(c.id, b);
    }
    return b;
  }

  update(world, dt) {
    const ais = world.characters.filter((c) => c.controller === 'ai');
    if (!ais.length) return;
    this.danger.compute(world);
    for (const c of ais) this.brainFor(c).update(world, dt, this.danger);
  }
}
