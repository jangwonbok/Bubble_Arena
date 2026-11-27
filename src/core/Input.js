// 입력 관리: 키보드(PC) + 터치(모바일 가상 조이스틱/버튼).
// - 키보드 방향은 "가장 최근에 누른 키" 우선.
// - 터치 방향은 별도 채널(touchDir)로 받는다. 키보드를 누르고 있으면 키보드가 우선 → 서로 간섭하지 않음.
// - 물풍선/원격 폭발은 어느 쪽에서 들어와도 같은 큐로 처리.
const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};
const DIR_VEC = {
  up: { dx: 0, dz: -1 },
  down: { dx: 0, dz: 1 },
  left: { dx: -1, dz: 0 },
  right: { dx: 1, dz: 0 },
};

export class Input {
  constructor() {
    this.stack = []; // 눌린 방향 순서 (키보드)
    this.touchDir = null; // 'up' | 'down' | 'left' | 'right' | null (가상 조이스틱)
    this.bombQueued = false;
    this.detonateQueued = false;
    this.listeners = new Map();
    this._down = (e) => this.onDown(e);
    this._up = (e) => this.onUp(e);
    this._blur = () => this.reset();
    window.addEventListener('keydown', this._down);
    window.addEventListener('keyup', this._up);
    window.addEventListener('blur', this._blur);
    // 화면 회전 / 탭 전환 시 눌린 상태가 남지 않도록
    window.addEventListener('orientationchange', this._blur);
    document.addEventListener('visibilitychange', () => document.hidden && this.reset());
  }

  onDown(e) {
    // 입력창(닉네임 등)에 타이핑 중이면 게임 키로 쓰지 않음
    if (e.target?.closest?.('input, textarea')) return;
    const dir = KEYMAP[e.code];
    if (dir) {
      e.preventDefault();
      if (!this.stack.includes(dir)) this.stack.push(dir);
    } else if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) this.bombQueued = true;
    } else if (e.code === 'KeyE' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      if (!e.repeat) this.detonateQueued = true;
    } else if (e.code === 'Escape' || e.code === 'KeyP') {
      if (!e.repeat) this.emit('pause');
    }
  }

  onUp(e) {
    const dir = KEYMAP[e.code];
    if (dir) this.stack = this.stack.filter((d) => d !== dir);
  }

  // ---- 터치 (TouchControls 에서 호출) ----
  setTouchDir(dir) {
    this.touchDir = DIR_VEC[dir] ? dir : null;
  }

  queueBomb() {
    this.bombQueued = true;
  }

  queueDetonate() {
    this.detonateQueued = true;
  }

  /** 현재 이동 방향 {dx, dz} (z+ = 화면 아래). 키보드 우선, 없으면 터치 */
  getDirection() {
    const d = this.stack[this.stack.length - 1] || this.touchDir;
    return d ? DIR_VEC[d] : null;
  }

  consumeDetonate() {
    const q = this.detonateQueued;
    this.detonateQueued = false;
    return q;
  }

  consumeBomb() {
    const q = this.bombQueued;
    this.bombQueued = false;
    return q;
  }

  reset() {
    this.stack = [];
    this.touchDir = null;
    this.bombQueued = false;
    this.detonateQueued = false;
    this.emit('reset'); // 터치 UI 도 손 뗀 상태로
  }

  on(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
  }

  emit(type) {
    this.listeners.get(type)?.forEach((fn) => fn());
  }
}
