// 키보드 입력 관리. 방향은 "가장 최근에 누른 키" 우선.
const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};

export class Input {
  constructor() {
    this.stack = []; // 눌린 방향 순서
    this.bombQueued = false;
    this.listeners = new Map();
    this._down = (e) => this.onDown(e);
    this._up = (e) => this.onUp(e);
    this._blur = () => this.reset();
    window.addEventListener('keydown', this._down);
    window.addEventListener('keyup', this._up);
    window.addEventListener('blur', this._blur);
  }

  onDown(e) {
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

  /** 현재 이동 방향 {dx, dz} (z+ = 화면 아래) */
  getDirection() {
    const d = this.stack[this.stack.length - 1];
    switch (d) {
      case 'up': return { dx: 0, dz: -1 };
      case 'down': return { dx: 0, dz: 1 };
      case 'left': return { dx: -1, dz: 0 };
      case 'right': return { dx: 1, dz: 0 };
      default: return null;
    }
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
    this.bombQueued = false;
    this.detonateQueued = false;
  }

  on(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
  }

  emit(type) {
    this.listeners.get(type)?.forEach((fn) => fn());
  }
}
