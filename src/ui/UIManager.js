import { el } from './dom.js';
import { StartScreen } from './StartScreen.js';
import { MapSelectScreen } from './MapSelectScreen.js';
import { LobbyScreen } from './LobbyScreen.js';
import { HUD } from './HUD.js';
import { PauseMenu } from './PauseMenu.js';
import { ResultScreen } from './ResultScreen.js';

// 화면 전환 관리: start / mapSelect / lobby / hud / pause / result
// (+ 카운트다운, 배너, 알림, 네트워크 상태 오버레이)
export class UIManager {
  constructor(root, game) {
    this.game = game;
    this.screens = {
      start: new StartScreen(game),
      mapSelect: new MapSelectScreen(game),
      lobby: new LobbyScreen(game),
      hud: new HUD(game),
      pause: new PauseMenu(game),
      result: new ResultScreen(game),
    };
    for (const s of Object.values(this.screens)) {
      s.root.classList.add('hidden');
      root.append(s.root);
    }
    this.countEl = el('div', { class: 'countdown hidden' });
    this.bannerEl = el('div', { class: 'banner hidden' });
    this.toasts = el('div', { class: 'global-toasts' });
    this.netEl = el('div', { class: 'net-status hidden' });
    root.append(this.countEl, this.bannerEl, this.toasts, this.netEl);
    this.current = null;

    game.session.net.on('status', (s) => this.netStatus(s));
  }

  show(name, opts = {}) {
    // HUD는 일시정지/결과 화면 뒤에도 유지
    const keepHud = name === 'pause' || name === 'result' || name === 'hud';
    for (const [k, s] of Object.entries(this.screens)) {
      const visible = k === name || (k === 'hud' && keepHud);
      s.root.classList.toggle('hidden', !visible);
    }
    this.screens.hud.root.classList.toggle('dimmed', name === 'pause' || name === 'result');
    if (name !== 'hud' && name !== 'pause') this.countdown(null);
    const prev = this.current;
    this.current = name;
    this.screens[name].onShow?.(opts, prev);
  }

  toast(html, ms = 3000) {
    const t = el('div', { class: 'toast', html });
    this.toasts.prepend(t);
    while (this.toasts.children.length > 4) this.toasts.lastChild.remove();
    setTimeout(() => t.classList.add('out'), ms - 500);
    setTimeout(() => t.remove(), ms);
  }

  netStatus(s) {
    const inOnline = this.game.mode === 'online' || this.game.session.room;
    const text = { reconnecting: '🔌 서버와 연결이 끊겼습니다. 재접속 중…', failed: '⚠ 서버에 연결할 수 없습니다' }[s];
    this.netEl.classList.toggle('hidden', !(text && inOnline));
    if (text) this.netEl.textContent = text;
    if (s === 'open' && inOnline && this.netEl.dataset.was === 'reconnecting') this.toast('✅ 다시 연결되었습니다');
    this.netEl.dataset.was = s;
  }

  countdown(text) {
    if (!text) {
      this.countEl.classList.add('hidden');
      return;
    }
    this.countEl.classList.remove('hidden');
    this.countEl.textContent = text;
    this.countEl.classList.remove('pop');
    void this.countEl.offsetWidth; // 애니메이션 재시작
    this.countEl.classList.add('pop');
    this.countEl.classList.toggle('go', text === 'START!');
  }

  banner(text) {
    this.bannerEl.classList.toggle('hidden', !text);
    if (text) {
      this.bannerEl.textContent = text;
      this.bannerEl.className = `banner ${text === 'WIN!' ? 'win' : 'lose'}`;
    }
  }

  update(dt) {
    if (this.current === 'hud' || this.current === 'pause') this.screens.hud.update(dt);
  }
}
