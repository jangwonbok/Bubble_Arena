// 전체 화면 / 앱 설치(PWA) 처리. 브라우저마다 지원 범위가 달라 한곳에서 관리한다.
//
// 지원 범위 (2026 기준)
//  - Android Chrome · Samsung Internet · Firefox Android · Edge : Fullscreen API ✅ → 주소창·내비게이션 바까지 숨김
//  - iPad Safari (iPadOS 16.4+)                                   : Fullscreen API ✅ (webkit 접두사 포함)
//  - iPhone Safari / iPhone 의 모든 브라우저(엔진이 WebKit)       : Fullscreen API ❌ (동영상만 가능)
//      → 대체: "홈 화면에 추가" 후 아이콘으로 실행 = 독립 실행(standalone) 모드 → 주소창·툴바 없음
//  - Android Chrome 등은 앱 설치(beforeinstallprompt)도 지원 → 설치하면 manifest 의 display: fullscreen 으로 실행
//  - PC 브라우저: Fullscreen API ✅ (F11 과 같은 효과)
const root = document.documentElement;
const PREF_KEY = 'bubbleArena.fullscreen';

export const Fullscreen = {
  supported: !!(root.requestFullscreen || root.webkitRequestFullscreen),
  isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  /** 홈 화면 아이콘/설치된 앱으로 실행됨 (이미 주소창 없음) */
  standalone:
    (typeof matchMedia === 'function' &&
      (matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches)) ||
    navigator.standalone === true,

  get active() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  },

  /**
   * 자동 전체 화면 여부: 사용자가 직접 끄지 않았다면 켬 (기본 ON).
   * 직접 '전체 화면 해제' 버튼을 누르면 OFF 로 기억 → 다시 강제로 들어가지 않음.
   */
  get preferred() {
    return localStorage.getItem(PREF_KEY) !== '0';
  },

  async enter() {
    if (!this.supported || this.active) return;
    try {
      if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: 'hide' });
      else root.webkitRequestFullscreen();
      localStorage.setItem(PREF_KEY, '1');
    } catch {
      /* 사용자 제스처 밖이거나 거부됨 → 다음 터치 때 다시 시도 */
    }
  },

  /** 터치/버튼 같은 사용자 동작 안에서 호출: 원하는 상태면 조용히 전체 화면으로 */
  autoEnter() {
    if (this.supported && this.preferred && !this.active && !this.standalone) this.enter();
  },

  async exit() {
    localStorage.setItem(PREF_KEY, '0');
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else document.webkitExitFullscreen?.();
    } catch {
      /* 무시 */
    }
  },

  toggle() {
    return this.active ? this.exit() : this.enter();
  },

  onChange(fn) {
    document.addEventListener('fullscreenchange', fn);
    document.addEventListener('webkitfullscreenchange', fn);
  },
};

// ---------------- 앱 설치 (PWA) ----------------
// Android Chrome 등: 설치 가능해지면 beforeinstallprompt 이벤트를 받아 두었다가 버튼으로 설치 창을 띄움
export const Install = {
  deferred: null,
  installed: Fullscreen.standalone,
  listeners: new Set(),
  get canPrompt() {
    return !!this.deferred && !this.installed;
  },
  async prompt() {
    if (!this.deferred) return false;
    this.deferred.prompt();
    const choice = await this.deferred.userChoice.catch(() => null);
    this.deferred = null;
    this.emit();
    return choice?.outcome === 'accepted';
  },
  onChange(fn) {
    this.listeners.add(fn);
  },
  emit() {
    for (const fn of this.listeners) fn();
  },
};

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // 브라우저 기본 미니 배너 대신 게임 안 버튼으로
  Install.deferred = e;
  Install.emit();
});
window.addEventListener('appinstalled', () => {
  Install.installed = true;
  Install.deferred = null;
  Install.emit();
});

/** 서비스 워커 등록 (배포 빌드만): 설치 조건 충족용. 캐시는 하지 않아 새 배포가 바로 반영됨 */
export function registerServiceWorker() {
  if (!import.meta.env?.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
  });
}

/** 브라우저 상단/하단 바 색을 맵 하늘색에 맞춤 (숨길 수 없는 환경에서 덜 거슬리게) */
export function setThemeColor(color) {
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.append(meta);
  }
  meta.content = color;
}
