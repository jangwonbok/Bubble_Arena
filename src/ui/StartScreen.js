import { el, avatar } from './dom.js';
import { icon } from './icons.js';
import { topActions } from './Modals.js';
import { CHARACTER_DEFS } from '../characters/characterDefs.js';
import { MAPS } from '../maps/index.js';
import { Device } from '../core/Device.js';
import { Fullscreen, Install } from '../core/Fullscreen.js';

const BANNER_KEY = 'bubbleArena.installBannerClosed';

const VERSION = '2.0';

// 메인 화면: 프로필 카드 · 상단 아이콘 · 로고 · 하단 모드 카드 4종
export class StartScreen {
  constructor(game) {
    this.game = game;

    this.profileAvatar = el('div', { class: 'pc-avatar' });
    this.profileName = el('b', { class: 'pc-name' });
    this.profileStats = el('div', { class: 'pc-stats' });
    this.profile = el('div', { class: 'profile-card panel' }, [
      this.profileAvatar,
      el('div', { class: 'pc-info' }, [this.profileName, this.profileStats]),
    ]);
    this.footerStats = el('span', { class: 'ft-right' });

    const go = (fn) => () => {
      game.audio.unlock();
      game.audio.play('click');
      if (Device.touch) Fullscreen.autoEnter(); // 모바일: 모드를 고르는 순간 전체 화면
      fn();
    };

    // 앱 설치 안내 배너 (모바일 + 아직 설치 앱으로 실행 중이 아닐 때)
    this.bannerBtn = el('button', { class: 'ib-btn' });
    this.banner = el('div', { class: 'install-banner hidden' }, [
      el('span', { class: 'ib-ico', text: '📲' }),
      el('span', { class: 'ib-text', text: '앱으로 설치하면 주소창 없이 전체 화면으로 즐길 수 있어요' }),
      this.bannerBtn,
      el('button', { class: 'ib-close', 'aria-label': '닫기', text: '✕', onclick: () => { localStorage.setItem(BANNER_KEY, '1'); this.syncBanner(); } }),
    ]);
    this.bannerBtn.addEventListener('click', async () => {
      game.audio.unlock();
      game.audio.play('click');
      if (Install.canPrompt) await Install.prompt();
      else game.ui.modals.open('install');
      this.syncBanner();
    });
    Install.onChange(() => this.syncBanner());
    Device.onChange(() => this.syncBanner());

    this.root = el('div', { class: 'screen start-screen' }, [
      el('div', { class: 'top-bar' }, [this.profile, topActions(game, ['fullscreen', 'settings', 'sound', 'help'])]),
      el('div', { class: 'logo' }, [
        el('div', { class: 'logo-bubbles' }, [el('i'), el('i'), el('i'), el('i')]),
        el('h1', { class: 'logo-title' }, [el('span', { text: 'Bubble' }), el('span', { text: 'Arena' })]),
        el('div', { class: 'logo-3d', text: '3D' }),
        el('p', { class: 'logo-sub', text: '물풍선으로 친구들을 가둬라! 최후의 1인이 되는 귀여운 아레나 배틀' }),
      ]),
      el('div', { class: 'mode-dock' }, [
        this.banner, // 설치 안내는 모드 카드 묶음의 맨 윗줄 (다른 요소와 겹치지 않음)
        el('button', { class: 'mode-hero', onclick: go(() => game.ui.show('lobby', { mode: 'public' })) }, [
          el('span', { class: 'mh-badge', text: 'BEST' }),
          el('span', { class: 'mh-spark s1' }, [icon('sparkle')]),
          el('span', { class: 'mh-spark s2' }, [icon('sparkle')]),
          el('span', { class: 'mh-icon' }, [icon('globe')]),
          el('b', { class: 'mh-title', text: '온라인 일반전' }),
          el('small', { class: 'mh-sub', text: '자동 매칭 · 최대 4인' }),
          el('span', { class: 'mh-cta' }, [el('b', { text: '게임 시작' }), el('small', { text: 'GAME START' })]),
        ]),
        this.modeCard('friend', 'mail', '친구 초대전', '방 코드로 초대 · 맵 투표', go(() => game.ui.show('lobby', { mode: 'friend' }))),
        this.modeCard('single', 'gamepad', '싱글 플레이', '나 + AI 3명', go(() => game.ui.show('mapSelect', { mode: 'single' }))),
      ]),
      el('div', { class: 'footer-bar' }, [
        el('span', { text: `Version ${VERSION}` }),
        el('span', { class: 'ft-sep', text: '|' }),
        el('span', { text: 'Bubble Arena 3D' }),
        this.footerStats,
      ]),
    ]);
  }

  modeCard(kind, ico, title, sub, onClick, ico2) {
    return el('button', { class: `mode-card mc-${kind}`, onclick: onClick }, [
      el('span', { class: 'mc-icon' }, [icon(ico), ico2 ? icon(ico2, 'second') : null]),
      el('b', { text: title }),
      el('small', { text: sub }),
    ]);
  }

  /**
   * 설치 배너 표시 조건: 터치 기기 + 독립 실행 아님 + 닫지 않음 +
   *  (Android 등 설치 가능 → '설치' 버튼) 또는 (iPhone 처럼 전체 화면 API 가 없음 → '방법 보기')
   */
  syncBanner() {
    const closed = localStorage.getItem(BANNER_KEY) === '1';
    const iosLike = Fullscreen.isIOS && !Fullscreen.supported;
    const show = Device.touch && !Fullscreen.standalone && !Install.installed && !closed && (Install.canPrompt || iosLike);
    this.banner.classList.toggle('hidden', !show);
    this.bannerBtn.textContent = Install.canPrompt ? '설치' : '방법 보기';
  }

  onShow() {
    this.syncBanner();
    const r = this.game.records;
    const p = this.game.session.profile;
    const def = CHARACTER_DEFS[p.charId] || CHARACTER_DEFS[0];
    this.profileAvatar.innerHTML = '';
    this.profileAvatar.append(avatar(def, 52));
    this.profileName.textContent = p.name;
    this.profileStats.innerHTML = '';
    this.profileStats.append(
      icon('trophy'),
      el('span', { text: `최고 점수 ${r.best.toLocaleString()}` }),
      el('i', { class: 'sep' }),
      el('span', { text: `승리 ${r.wins} / ${r.plays}판` }),
    );
    this.footerStats.textContent = `캐릭터 ${CHARACTER_DEFS.length}종 · 맵 ${MAPS.length}종`;
  }
}
