// 기기 판별 (터치 조작 UI 자동 활성화 / 모바일 렌더링 최적화용)
// URL 로 강제 가능: ?touch=1 (터치 UI 켜기), ?touch=0 (끄기)
const q = new URLSearchParams(location.search).get('touch');
const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const noHover = typeof matchMedia === 'function' && matchMedia('(hover: none)').matches;
const hasTouch = typeof navigator !== 'undefined' && (navigator.maxTouchPoints || 0) > 0;

export const Device = {
  /** 터치 조작 UI 를 보여 줄지 (휴대폰/태블릿) */
  touch: q === '1' ? true : q === '0' ? false : coarse || (hasTouch && noHover),
  /** 저사양 모드 (렌더링 해상도·그림자 품질 낮춤): 터치 기기 기준 */
  lowPower: q === '1' || coarse || (hasTouch && noHover),
  listeners: new Set(),
  onChange(fn) {
    this.listeners.add(fn);
  },
  /** 터치 노트북 등: 실제로 화면을 터치하면 터치 UI 를 켬 (?touch=0 이면 유지) */
  enableTouch() {
    if (this.touch || q === '0') return;
    this.touch = true;
    document.body.classList.add('touch');
    for (const fn of this.listeners) fn();
  },
};

if (typeof document !== 'undefined') {
  document.body.classList.toggle('touch', Device.touch);
  window.addEventListener('touchstart', () => Device.enableTouch(), { passive: true, once: true });
}
