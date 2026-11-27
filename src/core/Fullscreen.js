// 전체 화면 (Fullscreen API). 브라우저마다 접두사가 달라 한곳에서 처리.
// - Android Chrome / 태블릿 / PC: 버튼으로 바로 전체 화면
// - iPhone Safari: Fullscreen API 미지원 → "홈 화면에 추가" 후 아이콘으로 실행하면 주소창 없이 전체 화면 (manifest)
const root = document.documentElement;
const PREF_KEY = 'bubbleArena.fullscreen';

export const Fullscreen = {
  supported: !!(root.requestFullscreen || root.webkitRequestFullscreen),
  isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  /** 홈 화면 아이콘으로 실행됨 (이미 주소창 없음) */
  standalone:
    (typeof matchMedia === 'function' && (matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches)) ||
    navigator.standalone === true,

  get active() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  },

  /** 사용자가 한 번 전체 화면을 켰으면 다음 경기 시작 때도 자동으로 */
  get preferred() {
    return localStorage.getItem(PREF_KEY) === '1';
  },

  async enter() {
    if (!this.supported || this.active) return;
    try {
      if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: 'hide' });
      else root.webkitRequestFullscreen();
      localStorage.setItem(PREF_KEY, '1');
    } catch {
      /* 사용자 제스처 밖이거나 거부됨 → 무시 */
    }
  },

  async exit() {
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else document.webkitExitFullscreen?.();
    } catch {
      /* 무시 */
    }
    localStorage.setItem(PREF_KEY, '0');
  },

  toggle() {
    return this.active ? this.exit() : this.enter();
  },

  onChange(fn) {
    document.addEventListener('fullscreenchange', fn);
    document.addEventListener('webkitfullscreenchange', fn);
  },
};
