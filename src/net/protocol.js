// 서버 ↔ 클라이언트 공용 프로토콜 정의 (순수 JS, Node/브라우저 공용)
import { STATE } from '../characters/Character.js';

export const PROTOCOL_VERSION = 1;

// 방향 인코딩: 0=정지 1=→ 2=← 3=↓ 4=↑
export const DIR_LIST = [null, { dx: 1, dz: 0 }, { dx: -1, dz: 0 }, { dx: 0, dz: 1 }, { dx: 0, dz: -1 }];
export function encodeDir(d) {
  if (!d) return 0;
  if (d.dx === 1) return 1;
  if (d.dx === -1) return 2;
  if (d.dz === 1) return 3;
  return 4;
}
export const decodeDir = (n) => DIR_LIST[n] || null;

const STATE_CODES = [STATE.ALIVE, STATE.TRAPPED, STATE.DEAD];
const r3 = (v) => Math.round(v * 1000) / 1000;
const r2 = (v) => Math.round((v || 0) * 100) / 100;
const r1 = (v) => Math.round((v || 0) * 10) / 10;

/** 캐릭터 상태 스냅샷 (배열로 압축) */
export function packChar(c) {
  return [
    r3(c.x), r3(c.z), STATE_CODES.indexOf(c.state), encodeDir(c.facing), c.moving ? 1 : 0,
    Math.round(c.trapTimer * 100) / 100, c.invulnerable > 0 ? 1 : 0,
    c.maxBombs, c.activeBombs, c.range, c.speedLevel,
    c.score, c.kills, c.rescues, c.controller === 'ai' && c.human ? 1 : 0, encodeDir(c.slideDir),
    r1(c.shieldTime), c.remoteCharges, c.lives, r2(c.jumpTime), r2(c.slowTime), r1(c.magnetTime),
  ];
}

export function unpackChar(c, a, { position = true } = {}) {
  if (position) {
    c.x = a[0];
    c.z = a[1];
  }
  c.state = STATE_CODES[a[2]];
  c.facing = decodeDir(a[3]) || c.facing;
  c.moving = !!a[4];
  c.trapTimer = a[5];
  c.invulnerable = a[6] ? 1 : 0;
  c.maxBombs = a[7];
  c.activeBombs = a[8];
  c.range = a[9];
  c.speedLevel = a[10];
  c.score = a[11];
  c.kills = a[12];
  c.rescues = a[13];
  c.aiTakeover = !!a[14];
  c.slideDir = decodeDir(a[15]);
  c.shieldTime = a[16] || 0;
  c.remoteCharges = a[17] || 0;
  c.lives = a[18] || 0;
  c.jumpTime = a[19] || 0;
  c.slowTime = a[20] || 0;
  c.magnetTime = a[21] || 0;
}

const dirIndex = (d) => (d ? encodeDir(d) : 0);

/** 서버 시뮬레이션 이벤트 → 전송용 객체 */
export function serializeEvent(type, p) {
  switch (type) {
    case 'bombPlaced':
      return { k: 'bp', id: p.bomb.id, x: p.bomb.x, z: p.bomb.z, o: p.bomb.owner.id, r: p.bomb.range, t: p.bomb.timer, p: [...p.bomb.passers], rm: p.bomb.remote ? 1 : 0 };
    case 'bombExploded':
      return { k: 'bx', id: p.bomb.id, o: p.bomb.owner.id, tiles: p.tiles.map((t) => [t.x, t.z, dirIndex(t.dir), t.end ? 1 : 0]) };
    case 'blockDestroyed':
      return { k: 'bd', x: p.x, z: p.z };
    case 'itemSpawned':
      return { k: 'is', id: p.item.id, ty: p.item.type, x: p.item.x, z: p.item.z };
    case 'itemRemoved':
      return { k: 'ir', id: p.item.id, by: p.by ? p.by.id : -1, mg: p.magnet ? 1 : 0 };
    case 'shieldBlocked':
      return { k: 'sb', c: p.c.id };
    case 'lifeUsed':
      return { k: 'lu', c: p.c.id, cause: p.cause };
    case 'slowed':
      return { k: 'sw', c: p.c.id, by: p.by.id };
    case 'detonated':
      return { k: 'dt', c: p.c.id, n: p.count };
    case 'trapped':
      return { k: 'tr', c: p.c.id, by: p.by ? p.by.id : -1 };
    case 'rescued':
      return { k: 'rs', c: p.c.id, by: p.by.id };
    case 'eliminated':
      return { k: 'el', c: p.c.id, by: p.by ? p.by.id : -1, cause: p.cause };
    case 'blockPushed':
      return { k: 'pb', f: p.from, t: p.to, by: p.by.id };
    case 'hazardWarn':
      return { k: 'hw', id: p.hazard.id, kind: p.hazard.kind, tiles: p.hazard.tiles, warn: p.hazard.warnLeft, dur: p.hazard.duration, meta: p.hazard.meta };
    case 'hazardActive':
      return { k: 'ha', id: p.hazard.id };
    case 'hazardEnd':
      return { k: 'he', id: p.hazard.id };
    default:
      return null;
  }
}

export const SIM_EVENTS = ['bombPlaced', 'bombExploded', 'blockDestroyed', 'itemSpawned', 'itemRemoved', 'trapped', 'rescued', 'eliminated', 'hazardWarn', 'hazardActive', 'hazardEnd', 'blockPushed', 'shieldBlocked', 'lifeUsed', 'slowed', 'detonated'];

// 입력 검증 유틸 (서버)
export function sanitizeName(name) {
  const s = String(name ?? '')
    .replace(/[<>&"'`\\\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 12);
  return s || '플레이어';
}

export const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const isRoomCode = (v) => typeof v === 'string' && /^[A-Z0-9]{5}$/.test(v);
export const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
