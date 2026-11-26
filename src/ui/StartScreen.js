import { el, soundControls } from './dom.js';
import { ITEM_DEFS } from '../systems/items/itemDefs.js';

export class StartScreen {
  constructor(game) {
    this.game = game;
    const click = () => game.audio.play('click');

    this.best = el('div', { class: 'best' });
    this.howto = this.buildHowTo(click);
    this.settings = el('div', { class: 'modal hidden' }, [
      el('div', { class: 'panel modal-panel' }, [
        el('h2', { text: '사운드 설정' }),
        soundControls(game.audio, click),
        el('button', { class: 'btn btn-primary', text: '확인', onclick: () => { click(); this.settings.classList.add('hidden'); } }),
      ]),
    ]);

    this.root = el('div', { class: 'screen start-screen' }, [
      el('div', { class: 'logo' }, [
        el('div', { class: 'logo-bubbles' }, [el('i'), el('i'), el('i')]),
        el('h1', { class: 'logo-title' }, [el('span', { text: 'Bubble' }), el('span', { text: 'Arena' })]),
        el('div', { class: 'logo-3d', text: '3D' }),
        el('p', { class: 'logo-sub', text: '물풍선으로 친구들을 가둬라! 최후의 1인이 되는 귀여운 아레나 배틀' }),
      ]),
      el('div', { class: 'mode-grid' }, [
        this.modeBtn('🎮', '싱글 플레이', '나 + AI 3명', () => game.ui.show('mapSelect', { mode: 'single' }), 'primary'),
        this.modeBtn('🎯', 'AI 연습전', '부활 가능 · 점수 연습', () => game.ui.show('mapSelect', { mode: 'practice' })),
        this.modeBtn('🌐', '온라인 일반전', '자동 매칭 · 최대 4명', () => game.ui.show('lobby', { mode: 'public' })),
        this.modeBtn('💌', '친구 초대전', '방 코드로 초대 · 맵 투표', () => game.ui.show('lobby', { mode: 'friend' })),
      ]),
      el('div', { class: 'menu-buttons small' }, [
        el('button', { class: 'btn', text: '게임 방법', onclick: () => { click(); this.howto.classList.remove('hidden'); } }),
        el('button', { class: 'btn', text: '사운드 설정', onclick: () => { game.audio.unlock(); click(); this.settings.classList.remove('hidden'); } }),
      ]),
      this.best,
      this.howto,
      this.settings,
    ]);
  }

  modeBtn(icon, title, sub, onClick, kind = '') {
    return el('button', {
      class: `mode-btn ${kind}`,
      onclick: () => {
        this.game.audio.unlock();
        this.game.audio.play('click');
        onClick();
      },
    }, [el('span', { class: 'mode-icon', text: icon }), el('b', { text: title }), el('small', { text: sub })]);
  }

  buildHowTo(click) {
    const row = (k, t) => el('div', { class: 'howto-row' }, [el('div', { class: 'keys', html: k }), el('div', { text: t })]);
    const modal = el('div', { class: 'modal hidden' }, [
      el('div', { class: 'panel modal-panel howto' }, [
        el('h2', { text: '게임 방법' }),
        row('<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / <kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd>', '캐릭터 이동'),
        row('<kbd class="wide">SPACE</kbd>', '물풍선 설치 (2.5초 후 십자 모양으로 터져요)'),
        row('<kbd>E</kbd> / <kbd>Shift</kbd>', '원격 폭발 (원격 폭발 아이템 사용 시)'),
        row('<kbd>ESC</kbd> / <kbd>P</kbd>', '일시정지'),
        el('ul', { class: 'rules' }, [
          el('li', { text: '물줄기에 맞으면 물방울에 갇혀요. 3초 안에 다른 캐릭터가 닿으면 구출, 아니면 탈락!' }),
          el('li', { text: '나무 상자를 부수면 아이템이 나올 수 있어요.' }),
          el('li', { text: '마지막까지 살아남거나, 3분 후 생존자 중 점수가 가장 높으면 승리.' }),
          el('li', { text: '물풍선끼리는 연쇄 폭발해요. 돌 기둥은 물줄기를 막아요.' }),
        ]),
        el('h3', { text: '아이템' }),
        el('div', { class: 'items-guide' }, Object.entries(ITEM_DEFS).map(([id, d]) =>
          el('div', { class: `ig${d.basic ? ' basic' : ''}` }, [
            el('img', { class: 'ig-img', src: this.game.itemView.iconURL(id), alt: d.name }),
            el('div', {}, [el('b', { text: d.name }), el('small', { text: d.desc })]),
          ]),
        )),
        el('button', { class: 'btn btn-primary', text: '알겠어요!', onclick: () => { click(); modal.classList.add('hidden'); } }),
      ]),
    ]);
    return modal;
  }

  onShow() {
    const r = this.game.records;
    this.best.textContent = `🏆 최고 점수 ${r.best.toLocaleString()} · 승리 ${r.wins} / ${r.plays}판`;
    this.howto.classList.add('hidden');
    this.settings.classList.add('hidden');
  }
}
