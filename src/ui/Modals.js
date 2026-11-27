import { el, soundControls } from './dom.js';
import { icon } from './icons.js';
import { ITEM_DEFS } from '../systems/items/itemDefs.js';

// 모든 화면에서 공용으로 여는 모달: 게임 방법 / 설정
export class Modals {
  constructor(game, root) {
    this.game = game;
    const click = () => game.audio.play('click');
    this.click = click;
    this.howto = this.buildHowTo(click);
    this.settings = el('div', { class: 'modal hidden' }, [
      el('div', { class: 'panel modal-panel settings-panel' }, [
        el('div', { class: 'modal-head' }, [icon('gear'), el('h2', { text: '설정' })]),
        el('h3', { text: '사운드' }),
        soundControls(game.audio, click),
        el('button', { class: 'btn btn-primary', text: '확인', onclick: () => { click(); this.close(); } }),
      ]),
    ]);
    for (const m of [this.howto, this.settings]) {
      m.addEventListener('pointerdown', (e) => {
        if (e.target === m) this.close();
      });
      root.append(m);
    }
  }

  open(name) {
    this.game.audio.unlock();
    this.click();
    this.close();
    this[name]?.classList.remove('hidden');
  }

  close() {
    this.howto.classList.add('hidden');
    this.settings.classList.add('hidden');
  }

  buildHowTo(click) {
    const row = (k, t) => el('div', { class: 'howto-row' }, [el('div', { class: 'keys', html: k }), el('div', { text: t })]);
    return el('div', { class: 'modal hidden' }, [
      el('div', { class: 'panel modal-panel howto' }, [
        el('div', { class: 'modal-head' }, [icon('help'), el('h2', { text: '게임 방법' })]),
        el('div', { class: 'howto-keys' }, [
          row('<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / <kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd>', '캐릭터 이동'),
          row('<kbd class="wide">SPACE</kbd>', '물풍선 설치 (2.5초 후 십자 모양으로 터져요)'),
          row('<kbd>E</kbd> / <kbd>Shift</kbd>', '원격 폭발 (원격 폭발 아이템 사용 시)'),
          row('<kbd>ESC</kbd> / <kbd>P</kbd>', '일시정지'),
        ]),
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
        el('button', { class: 'btn btn-primary', text: '알겠어요!', onclick: () => { click(); this.close(); } }),
      ]),
    ]);
  }
}

/**
 * 우측 상단 원형 아이콘 버튼 묶음
 * items: ['settings', 'sound', 'help'] + { icon, label, onClick, kind }
 */
export function topActions(game, items) {
  const wrap = el('div', { class: 'top-actions' });
  for (const it of items) {
    if (it === 'sound') {
      const btn = el('button', { class: 'ta-btn', 'aria-label': '사운드' });
      const ico = el('span', { class: 'ta-ico' });
      const label = el('span', { class: 'ta-label', text: '사운드' });
      const sync = () => {
        const on = game.audio.enabled || game.audio.musicOn;
        ico.innerHTML = '';
        ico.append(icon(on ? 'sound' : 'mute'));
        btn.classList.toggle('off', !on);
      };
      btn.addEventListener('click', () => {
        const a = game.audio;
        a.unlock();
        const on = a.enabled || a.musicOn;
        a.setEnabled(!on);
        a.setMusic(!on);
        a.play('click');
      });
      game.audio.onChange(sync);
      sync();
      btn.append(ico, label);
      wrap.append(btn);
      continue;
    }
    const def = typeof it === 'string'
      ? {
          settings: { icon: 'gear', label: '설정', onClick: () => game.ui.modals.open('settings') },
          help: { icon: 'help', label: '게임 방법', onClick: () => game.ui.modals.open('howto') },
        }[it]
      : it;
    wrap.append(
      el('button', { class: `ta-btn ${def.kind || ''}`, 'aria-label': def.label, onclick: def.onClick }, [
        el('span', { class: 'ta-ico' }, [icon(def.icon)]),
        el('span', { class: 'ta-label', text: def.label }),
      ]),
    );
  }
  return wrap;
}
