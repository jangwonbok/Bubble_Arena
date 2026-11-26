// 맵 레지스트리.
// 새 맵 추가: defs/ 에 정의 파일을 만들고 아래 MAPS 배열에 한 줄 추가하면 끝.
// (게임 시스템/서버 코드는 수정할 필요 없음)
import meadow from './defs/meadow.js';
import ice from './defs/ice.js';
import volcano from './defs/volcano.js';
import beach from './defs/beach.js';
import candy from './defs/candy.js';
import sky from './defs/sky.js';

export const MAPS = [meadow, ice, volcano, beach, candy, sky];
export const MAP_IDS = MAPS.map((m) => m.id);

export function getMap(id) {
  return MAPS.find((m) => m.id === id) || meadow;
}

export function isValidMapChoice(id) {
  return id === 'random' || MAP_IDS.includes(id);
}

export function resolveMapId(id, rng = Math.random) {
  if (id === 'random' || !MAP_IDS.includes(id)) return MAP_IDS[Math.floor(rng() * MAP_IDS.length)];
  return id;
}
