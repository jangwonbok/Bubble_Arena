import { el } from './dom.js';

const DEAD_ZONE = 14; // px: 이 안에서는 정지
const SWITCH_BIAS = 1.25; // 축 전환 히스테리시스 (대각선 근처에서 방향이 덜덜 바뀌지 않도록)
const MAX_R = 46; // 노브 최대 이동 반경(px)

/** 손가락이 영역 밖으로 나가도 계속 추적 (일부 브라우저는 실패 시 예외 → 무시) */
function capture(elm, id) {
  try {
    elm.setPointerCapture(id);
  } catch {
    /* 캡처 실패해도 pointermove/up 은 영역 안에서 계속 동작 */
  }
}

/**
 * 모바일 가상 조작 UI
 *  - 왼쪽 아래: 플로팅 조이스틱 (왼쪽 영역 아무 곳이나 누른 위치가 중심) → 4방향
 *  - 오른쪽 아래: 물풍선 버튼(크게) + 원격 폭발 버튼(원격 물풍선이 있을 때만)
 * 포인터 ID 별로 추적하므로 이동하면서 동시에 물풍선 설치 가능 (멀티터치).
 * 손을 떼거나(pointerup/cancel), 화면 회전·탭 전환(Input.reset) 시 즉시 정지 → 입력이 남지 않음.
 */
export class TouchControls {
  constructor(game) {
    this.game = game;
    this.input = game.input;
    this.stickId = null;
    this.origin = null;
    this.axis = null;

    this.knob = el('div', { class: 'tc-knob' });
    this.base = el('div', { class: 'tc-base' }, [
      el('i', { class: 'tc-arrow up' }), el('i', { class: 'tc-arrow down' }), el('i', { class: 'tc-arrow left' }), el('i', { class: 'tc-arrow right' }),
      this.knob,
    ]);
    this.zone = el('div', { class: 'tc-zone' }, [this.base]);

    this.bombBtn = el('button', { class: 'tc-btn tc-bomb', 'aria-label': '물풍선 설치' }, [
      el('img', { src: game.itemView.iconURL('bomb'), alt: '' }),
      el('span', { text: '물풍선' }),
    ]);
    this.remoteCount = el('b', { class: 'tc-count' });
    this.remoteBtn = el('button', { class: 'tc-btn tc-remote hidden', 'aria-label': '원격 폭발' }, [
      el('img', { src: game.itemView.iconURL('remote'), alt: '' }),
      this.remoteCount,
    ]);
    this.root = el('div', { class: 'touch-controls' }, [this.zone, el('div', { class: 'tc-actions' }, [this.remoteBtn, this.bombBtn])]);

    this.bindStick();
    this.bindButton(this.bombBtn, () => this.input.queueBomb());
    this.bindButton(this.remoteBtn, () => this.input.queueDetonate());
    this.input.on('reset', () => this.release());
    // 길게 눌렀을 때 메뉴/선택/확대 방지
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  bindStick() {
    const z = this.zone;
    z.addEventListener('pointerdown', (e) => {
      if (this.stickId !== null) return;
      e.preventDefault();
      this.stickId = e.pointerId;
      capture(z, e.pointerId);
      const r = z.getBoundingClientRect();
      // 누른 곳이 조이스틱 중심 (가장자리에서는 베이스가 잘리지 않도록 보정)
      const pad = 64;
      this.origin = {
        x: Math.min(Math.max(e.clientX, r.left + pad), r.right - pad),
        y: Math.min(Math.max(e.clientY, r.top + pad), r.bottom - pad),
      };
      this.base.style.left = `${this.origin.x - r.left}px`;
      this.base.style.top = `${this.origin.y - r.top}px`;
      this.base.classList.add('active');
      this.move(e);
    });
    // 이동/해제는 창 전체에서 받음 → 손가락이 조작 영역 밖으로 나가도 끊기지 않고, 뗐을 때 확실히 멈춤
    window.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.stickId) this.move(e);
    });
    const end = (e) => {
      if (e.pointerId === this.stickId) this.release();
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  move(e) {
    const dx = e.clientX - this.origin.x;
    const dy = e.clientY - this.origin.y;
    const len = Math.hypot(dx, dy);
    const k = len > MAX_R ? MAX_R / len : 1;
    this.knob.style.transform = `translate(calc(-50% + ${dx * k}px), calc(-50% + ${dy * k}px))`;

    let dir = null;
    if (len >= DEAD_ZONE) {
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      // 현재 축을 유지하다가 다른 축이 충분히 커질 때만 전환
      let axis = ax >= ay ? 'x' : 'y';
      if (this.axis === 'x' && ay < ax * SWITCH_BIAS) axis = 'x';
      else if (this.axis === 'y' && ax < ay * SWITCH_BIAS) axis = 'y';
      this.axis = axis;
      dir = axis === 'x' ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    } else {
      this.axis = null;
    }
    this.input.setTouchDir(dir);
    this.base.dataset.dir = dir || '';
  }

  release() {
    this.stickId = null;
    this.axis = null;
    this.input.setTouchDir(null);
    this.knob.style.transform = 'translate(-50%, -50%)';
    this.base.classList.remove('active');
    this.base.dataset.dir = '';
    this.base.style.left = '';
    this.base.style.top = '';
  }

  bindButton(btn, fire) {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      capture(btn, e.pointerId);
      btn.classList.add('pressed');
      fire();
      navigator.vibrate?.(12);
    });
    const up = () => btn.classList.remove('pressed');
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  /** HUD 갱신 시 호출: 원격 물풍선 버튼 표시 / 물풍선 남은 개수 */
  refresh(p) {
    const charges = p?.remoteCharges || 0;
    this.remoteBtn.classList.toggle('hidden', charges <= 0);
    this.remoteCount.textContent = charges > 0 ? `×${charges}` : '';
    this.bombBtn.classList.toggle('empty', !!p && p.bombsLeft <= 0);
  }
}
