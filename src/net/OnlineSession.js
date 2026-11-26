import { NetClient } from './NetClient.js';

const PROFILE_KEY = 'bubbleArena.profile';

/**
 * 온라인 대기방 컨트롤러: 프로필 · 방 생성/입장 · 준비 · 맵 선택/투표 · 시작
 * 서버 메시지를 받아 Game / UI 에 전달한다.
 */
export class OnlineSession {
  constructor(game) {
    this.game = game;
    this.net = new NetClient();
    this.room = null;
    this.mode = 'public';
    this.error = null;
    const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
    this.profile = saved || { name: `플레이어${Math.floor(Math.random() * 900 + 100)}`, charId: 0 };
    this.listeners = new Set();

    const n = this.net;
    n.on('room', (m) => {
      this.room = m;
      this.error = null;
      this.changed();
    });
    n.on('left', () => {
      this.room = null;
      this.changed();
    });
    n.on('error', (m) => {
      this.error = m.msg;
      this.changed();
      game.ui.toast?.(`⚠ ${m.msg}`);
    });
    n.on('profile', (m) => this.saveProfile({ name: m.name, charId: m.charId }));
    n.on('welcome', (m) => {
      if (!m.resumed) this.room = null;
      this.changed();
    });
    n.on('start', (m) => game.startOnline(m));
    n.on('tick', (m) => game.online?.onTick(m));
    n.on('end', (m) => game.onOnlineEnd(m));
    n.on('status', () => this.changed());
    n.on('rtt', () => this.changed());
    n.on('lost', () => {
      this.room = null;
      game.onConnectionLost();
    });
  }

  get me() {
    return this.room?.players.find((p) => p.id === this.net.id);
  }

  get isHost() {
    return this.room && this.room.hostId === this.net.id;
  }

  onChange(fn) {
    this.listeners.add(fn);
  }

  changed() {
    this.listeners.forEach((fn) => fn());
  }

  saveProfile(p) {
    this.profile = { ...this.profile, ...p };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(this.profile));
  }

  async ensure() {
    try {
      await this.net.connect(this.profile);
      return true;
    } catch (e) {
      this.error =
        e.code === 'NO_SERVER'
          ? '이 웹 버전(GitHub Pages)에는 온라인 게임 서버가 연결되어 있지 않습니다. 싱글 플레이 / AI 연습전은 바로 플레이할 수 있고, 온라인은 게임 서버를 실행한 뒤 주소 뒤에 ?server=wss://서버주소/ws 를 붙여 접속하세요.'
          : `서버(${this.net.url})에 연결할 수 없습니다. 게임 서버(npm run server)가 실행 중인지 확인해 주세요.`;
      this.changed();
      return false;
    }
  }

  setProfile(p) {
    this.saveProfile(p);
    this.net.send({ type: 'profile', name: this.profile.name, charId: this.profile.charId });
  }

  async quick() {
    if (!(await this.ensure())) return;
    this.mode = 'public';
    this.net.send({ type: 'profile', name: this.profile.name, charId: this.profile.charId });
    this.net.send({ type: 'quick' });
  }

  async create() {
    if (!(await this.ensure())) return;
    this.mode = 'friend';
    this.net.send({ type: 'profile', name: this.profile.name, charId: this.profile.charId });
    this.net.send({ type: 'create', mode: 'friend' });
  }

  async join(code) {
    if (!(await this.ensure())) return;
    this.mode = 'friend';
    this.net.send({ type: 'profile', name: this.profile.name, charId: this.profile.charId });
    this.net.send({ type: 'join', code: String(code).trim().toUpperCase() });
  }

  leave() {
    this.net.send({ type: 'leave' });
    this.room = null;
    this.changed();
  }

  ready(v) {
    this.net.send({ type: 'ready', v });
  }

  setMap(id) {
    this.net.send({ type: 'map', id });
  }

  vote(id) {
    this.net.send({ type: 'vote', id });
  }

  fill(v) {
    this.net.send({ type: 'fill', v });
  }

  start() {
    this.net.send({ type: 'start' });
  }

  inviteLink() {
    const u = new URL(location.href);
    u.search = '';
    u.searchParams.set('room', this.room.code);
    const custom = new URLSearchParams(location.search).get('server');
    if (custom) u.searchParams.set('server', custom);
    return u.toString();
  }
}
