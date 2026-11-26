import { NET } from '../core/Config.js';

const TOKEN_KEY = 'bubbleArena.token';
const SERVER_KEY = 'bubbleArena.server';

/**
 * WebSocket 연결 관리: 접속 · 메시지 라우팅 · 자동 재접속(토큰으로 세션 복구) · 핑 측정
 * 서버 주소 우선순위: ?server=ws://... → VITE_SERVER_URL → (개발) ws://<호스트>:2567/ws → (배포) 같은 주소의 /ws
 */
export class NetClient {
  constructor() {
    this.handlers = new Map();
    this.status = 'idle'; // idle | connecting | open | reconnecting | failed
    this.ws = null;
    this.manualClose = false;
    this.retries = 0;
    this.rtt = 0;
    this.profile = null;
    this.url = NetClient.resolveUrl();
  }

  static resolveUrl() {
    const q = new URLSearchParams(location.search).get('server');
    if (q) {
      sessionStorage.setItem(SERVER_KEY, q);
      return q;
    }
    const saved = sessionStorage.getItem(SERVER_KEY);
    if (saved) return saved;
    if (import.meta.env.VITE_SERVER_URL) return import.meta.env.VITE_SERVER_URL;
    if (import.meta.env.DEV) return `ws://${location.hostname}:${NET.PORT}/ws`;
    // 정적 호스팅(GitHub Pages)에는 게임 서버가 없음 → 서버 주소를 따로 지정해야 온라인 가능
    if (NetClient.isStaticHost()) return null;
    return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
  }

  static isStaticHost() {
    return /\.github\.io$/i.test(location.hostname);
  }

  get token() {
    return sessionStorage.getItem(TOKEN_KEY); // 탭마다 별도 세션 (같은 브라우저 2탭 = 플레이어 2명)
  }

  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(fn);
  }

  emit(type, data) {
    this.handlers.get(type)?.forEach((fn) => fn(data));
  }

  setStatus(s) {
    this.status = s;
    this.emit('status', s);
  }

  /** 접속 후 welcome 수신까지 대기 */
  connect(profile) {
    this.profile = profile;
    if (!this.url) {
      this.setStatus('failed');
      return Promise.reject(Object.assign(new Error('no server'), { code: 'NO_SERVER' }));
    }
    if (this.status === 'open') return Promise.resolve();
    if (this.connecting) return this.connecting;
    this.manualClose = false;
    this.connecting = new Promise((resolve, reject) => {
      this.setStatus('connecting');
      this.open(resolve, reject);
    }).finally(() => (this.connecting = null));
    return this.connecting;
  }

  open(resolve, reject) {
    let welcomed = false;
    let ws;
    try {
      ws = new WebSocket(this.url);
    } catch (e) {
      reject?.(e);
      return;
    }
    this.ws = ws;
    const timeout = setTimeout(() => {
      if (!welcomed) ws.close();
    }, 5000);
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'hello', name: this.profile?.name, charId: this.profile?.charId, token: this.token }));
    };
    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === 'welcome') {
        welcomed = true;
        clearTimeout(timeout);
        sessionStorage.setItem(TOKEN_KEY, msg.token);
        this.id = msg.id;
        this.retries = 0;
        this.setStatus('open');
        this.startPing();
        resolve?.(msg);
        this.emit('welcome', msg);
        return;
      }
      if (msg.type === 'pong') {
        this.rtt = performance.now() - msg.t;
        this.emit('rtt', this.rtt);
        return;
      }
      this.emit(msg.type, msg);
    };
    ws.onclose = () => {
      clearTimeout(timeout);
      this.stopPing();
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.manualClose) {
        this.setStatus('idle');
        return;
      }
      if (!welcomed && this.status === 'connecting') {
        this.setStatus('failed');
        reject?.(new Error('서버에 연결할 수 없습니다'));
        return;
      }
      // 예기치 않은 끊김 → 자동 재접속
      this.scheduleReconnect();
    };
    ws.onerror = () => {};
  }

  scheduleReconnect() {
    if (this.retries >= 12) {
      this.setStatus('failed');
      this.emit('lost');
      return;
    }
    this.setStatus('reconnecting');
    const delay = Math.min(4000, 400 * 2 ** this.retries++);
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => this.open(null, null), delay);
  }

  send(msg) {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }

  startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => this.send({ type: 'ping', t: performance.now() }), 2000);
    this.send({ type: 'ping', t: performance.now() });
  }

  stopPing() {
    clearInterval(this.pingTimer);
  }

  close() {
    this.manualClose = true;
    clearTimeout(this.retryTimer);
    this.ws?.close();
    this.ws = null;
    this.setStatus('idle');
  }
}
