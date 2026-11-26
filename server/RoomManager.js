import { randomBytes } from 'node:crypto';
import { Room } from './Room.js';
import { ROOM_CODE_CHARS, isRoomCode } from '../src/net/protocol.js';
import { NET } from '../src/core/Config.js';

// 방 생성/검색/코드 관리 + 플레이어 세션(재접속 토큰) 관리
export class RoomManager {
  constructor() {
    this.rooms = new Map(); // code → Room
    this.sessions = new Map(); // token → player
  }

  genCode() {
    for (;;) {
      const bytes = randomBytes(5);
      let code = '';
      for (const b of bytes) code += ROOM_CODE_CHARS[b % ROOM_CODE_CHARS.length];
      if (!this.rooms.has(code)) return code;
    }
  }

  create(mode) {
    const room = new Room(this, this.genCode(), mode);
    this.rooms.set(room.code, room);
    return room;
  }

  /** 온라인 일반전: 대기 중인 공개 방에 자동 매칭, 없으면 새로 생성 */
  quickMatch() {
    for (const r of this.rooms.values()) {
      if (r.mode === 'public' && r.state === 'lobby' && r.players.length < NET.MAX_PLAYERS && r.players.some((p) => p.connected)) return r;
    }
    return this.create('public');
  }

  find(code) {
    return isRoomCode(code) ? this.rooms.get(code) : null;
  }

  removeRoom(room) {
    this.rooms.delete(room.code);
  }

  stats() {
    return { rooms: this.rooms.size, playing: [...this.rooms.values()].filter((r) => r.state === 'playing').length, sessions: this.sessions.size };
  }
}
