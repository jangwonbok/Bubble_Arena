// Bubble Arena 3D 게임 서버 (Node.js + WebSocket)
// 실행: npm run server   (기본 포트 2567, PORT 환경 변수로 변경)
// - ws://<host>:2567/ws       : 게임 통신
// - http://<host>:2567/       : dist/ 빌드가 있으면 클라이언트도 함께 제공 (LAN 테스트용)
// - http://<host>:2567/health : 상태 확인
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { RoomManager } from './RoomManager.js';
import { NET } from '../src/core/Config.js';
import { CHARACTER_DEFS } from '../src/characters/characterDefs.js';
import { PROTOCOL_VERSION, sanitizeName, isInt } from '../src/net/protocol.js';

const PORT = Number(process.env.PORT) || NET.PORT;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };

const manager = new RoomManager();

// ---------------- HTTP (정적 파일 + 헬스체크) ----------------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
    return res.end(JSON.stringify({ ok: true, version: PROTOCOL_VERSION, ...manager.stats() }));
  }
  try {
    let file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
    if (!file.startsWith(ROOT)) throw new Error('bad path'); // 경로 탈출 방지
    if ((await stat(file).catch(() => null))?.isDirectory()) file = path.join(file, 'index.html');
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Bubble Arena 3D server is running. (클라이언트는 npm run dev 또는 npm run build 후 이 주소에서 실행)');
  }
});

// ---------------- WebSocket ----------------
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });

function makePlayer(name, charId) {
  return {
    id: randomUUID().slice(0, 8),
    token: randomBytes(18).toString('base64url'),
    name: sanitizeName(name),
    charId: isInt(charId, 0, CHARACTER_DEFS.length - 1) ? charId : 0,
    connected: true,
    room: null,
    ws: null,
    lastSeen: Date.now(),
  };
}

function attach(p, ws) {
  if (p.ws && p.ws !== ws) {
    try { p.ws.close(4000, 'replaced'); } catch { /* noop */ }
  }
  p.ws = ws;
  p.connected = true;
  p.sendRaw = (s) => {
    if (p.ws && p.ws.readyState === 1) p.ws.send(s);
  };
  p.send = (msg) => p.sendRaw(JSON.stringify(msg));
}

wss.on('connection', (ws, req) => {
  let player = null;
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));

  // 메시지 폭주 방지 (초당 제한)
  let windowStart = Date.now();
  let count = 0;

  ws.on('message', (raw) => {
    const now = Date.now();
    if (now - windowStart > 1000) {
      windowStart = now;
      count = 0;
    }
    if (++count > 120) {
      if (count > 400) ws.close(4008, 'rate limit');
      return;
    }
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!msg || typeof msg.type !== 'string') return;

    if (msg.type === 'ping') return ws.send(JSON.stringify({ type: 'pong', t: msg.t }));

    if (msg.type === 'hello') {
      if (player) return;
      // 재접속: 토큰으로 기존 세션 복구
      const prev = typeof msg.token === 'string' ? manager.sessions.get(msg.token) : null;
      if (prev) {
        player = prev;
        attach(player, ws);
        player.send({ type: 'welcome', id: player.id, token: player.token, name: player.name, charId: player.charId, resumed: true, version: PROTOCOL_VERSION });
        if (player.room && player.room.state !== 'closed') player.room.onReconnect(player);
        else player.room = null;
        return;
      }
      player = makePlayer(msg.name, msg.charId);
      attach(player, ws);
      manager.sessions.set(player.token, player);
      player.send({ type: 'welcome', id: player.id, token: player.token, name: player.name, charId: player.charId, resumed: false, version: PROTOCOL_VERSION });
      return;
    }
    if (!player) return;
    player.lastSeen = now;
    const room = player.room;

    switch (msg.type) {
      case 'profile':
        player.name = sanitizeName(msg.name);
        if (isInt(msg.charId, 0, CHARACTER_DEFS.length - 1) && !room) player.charId = msg.charId;
        if (room) room.handle(player, msg);
        else player.send({ type: 'profile', name: player.name, charId: player.charId });
        return;
      case 'quick': {
        if (room) room.removePlayer(player);
        const r = manager.quickMatch();
        const err = r.addPlayer(player);
        if (err) player.send({ type: 'error', msg: '입장할 수 없습니다' });
        return;
      }
      case 'create': {
        if (room) room.removePlayer(player);
        const r = manager.create(msg.mode === 'public' ? 'public' : 'friend');
        r.addPlayer(player);
        return;
      }
      case 'join': {
        const code = String(msg.code || '').toUpperCase();
        const r = manager.find(code);
        if (!r) return player.send({ type: 'error', msg: '방을 찾을 수 없습니다' });
        if (r === room) return r.broadcastRoom();
        if (r.state !== 'lobby') return player.send({ type: 'error', msg: '이미 게임이 진행 중인 방입니다' });
        if (r.players.length >= NET.MAX_PLAYERS) return player.send({ type: 'error', msg: '방이 가득 찼습니다' });
        if (room) room.removePlayer(player);
        r.addPlayer(player);
        return;
      }
      case 'leave':
        if (room) room.removePlayer(player);
        player.send({ type: 'left' });
        return;
      default:
        if (room) room.handle(player, msg);
    }
  });

  ws.on('close', () => {
    if (!player || player.ws !== ws) return;
    player.connected = false;
    player.ws = null;
    player.lastSeen = Date.now();
    if (player.room) player.room.onDisconnect(player);
  });
  ws.on('error', () => {});
});

// 끊긴 연결 감지 (하트비트)
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
  // 방이 없는 오래된 세션 정리
  const now = Date.now();
  for (const [token, p] of manager.sessions) {
    if (!p.connected && !p.room && now - p.lastSeen > 120_000) manager.sessions.delete(token);
  }
}, 5000);
wss.on('close', () => clearInterval(heartbeat));

server.listen(PORT, () => {
  console.log(`Bubble Arena 3D server listening on http://localhost:${PORT}  (ws path /ws)`);
});
