import { el, avatar } from './dom.js';
import { CHARACTER_DEFS } from '../characters/characterDefs.js';
import { icon } from './icons.js';
import { topActions } from './Modals.js';
import { renderMapCards, renderCharPicker, MAP_ICON } from './components.js';
import { getMap, MAPS } from '../maps/index.js';

const MODE_TEXT = {
  single: { title: '싱글 플레이', sub: '플레이어 1명 + AI 3명 · 최후의 1인이 되거나 3분 후 최고 점수' },
  practice: { title: 'AI 연습전', sub: '탈락해도 2.5초 후 부활 · 3분 동안 점수 경쟁 (기록 미저장)' },
  // 싱글 플레이 sub 문구는 AI 인원에 따라 render() 에서 갱신
};

// 싱글/연습전 시작 전: 캐릭터 + 맵 선택 (선택한 맵이 배경에 바로 미리보기됨)
export class MapSelectScreen {
  constructor(game) {
    this.game = game;
    this.mode = 'single';
    this.mapId = 'random';
    this.charId = game.session.profile.charId ?? 0;
    this.aiCount = game.session.profile.aiCount ?? 3;
    this.aiRow = el('div', { class: 'ai-row' });
    const click = () => game.audio.play('click');
    const back = () => { click(); game.setupMenuScene('meadow'); game.ui.show('start'); };

    this.crumbTitle = el('span');
    this.title = el('h2', { class: 'sel-title' });
    this.sub = el('p', { class: 'sel-sub' });
    this.chars = el('div');
    this.maps = el('div');
    this.desc = el('div', { class: 'map-desc' });
    this.root = el('div', { class: 'screen overlay select-screen' }, [
      el('div', { class: 'top-bar' }, [
        el('div', { class: 'crumb' }, [
          el('button', { class: 'crumb-back', 'aria-label': '뒤로', onclick: back }, [icon('back')]),
          el('div', { class: 'crumb-trail' }, [el('span', { class: 'home-link', text: '홈', onclick: back }), el('span', { text: '›' }), this.crumbTitle]),
        ]),
        topActions(game, ['fullscreen', 'settings', 'sound', 'help']),
      ]),
      el('div', { class: 'panel select-panel' }, [
        this.title,
        this.sub,
        el('div', { class: 'sec-head' }, [icon('user'), el('span', { text: '캐릭터 선택' })]),
        this.chars,
        this.aiRow,
        el('div', { class: 'sec-head' }, [icon('map'), el('span', { text: '맵 선택' })]),
        this.maps,
        this.desc,
        el('div', { class: 'row-buttons' }, [
          el('button', { class: 'btn', text: '뒤로', onclick: back }),
          el('button', { class: 'btn btn-primary btn-big btn-start', onclick: () => { click(); game.startLocal({ mode: this.mode, mapId: this.mapId, charId: this.charId, aiCount: this.aiCount }); } }, [
            icon('sparkle', 'spark-l'),
            el('span', { text: '게임 시작' }),
            icon('sparkle', 'spark-r'),
          ]),
        ]),
      ]),
    ]);
  }

  onShow(opts = {}) {
    this.mode = opts.mode || this.mode;
    this.title.textContent = MODE_TEXT[this.mode].title;
    this.crumbTitle.textContent = MODE_TEXT[this.mode].title;
    this.sub.textContent = MODE_TEXT[this.mode].sub;
    this.game.buildMapThumbs?.();
    this.render();
  }

  render() {
    const click = () => this.game.audio.play('click');
    renderCharPicker(this.chars, {
      selected: this.charId,
      onPick: (id) => {
        click();
        this.charId = id;
        this.game.session.saveProfile({ charId: id });
        this.render();
      },
    });
    this.renderAiRow(click);
    if (this.mode === 'single') this.sub.textContent = `플레이어 1명 + AI ${this.aiCount}명 · 최후의 1인이 되거나 3분 후 최고 점수`;
    renderMapCards(this.maps, {
      selected: this.mapId,
      mode: 'select',
      onPick: (id) => {
        click();
        this.mapId = id;
        if (id !== 'random') this.game.setupMenuScene(id); // 3D 배경으로 미리보기
        this.render();
      },
    });
    const def = this.mapId === 'random' ? null : getMap(this.mapId);
    this.renderDesc(def);
  }

  /** AI 인원 선택 (1~3명) + 함께할 상대 미리보기 */
  renderAiRow(click) {
    const others = CHARACTER_DEFS.filter((d) => d.id !== this.charId);
    const max = others.length;
    this.aiRow.innerHTML = '';
    const seg = el('div', { class: 'seg' });
    for (let n = 1; n <= max; n++) {
      seg.append(
        el('button', {
          class: `seg-btn${n === this.aiCount ? ' on' : ''}`,
          onclick: () => {
            click();
            this.aiCount = n;
            this.game.session.saveProfile({ aiCount: n });
            this.render();
          },
        }, [el('b', { text: `${n}명` })]),
      );
    }
    const SPAWN_TEXT = { 1: '1 : 1 대결 · 대각선 시작', 2: '3인전 · 세 모서리 시작', 3: '4인전 · 네 모서리 시작' };
    this.aiRow.append(
      el('div', { class: 'sec-head' }, [icon('robot'), el('span', { text: 'AI 인원' })]),
      seg,
      el('div', { class: 'ai-foes' }, others.map((d, i) => {
        const a = avatar(d, 30);
        a.classList.toggle('off', i >= this.aiCount);
        a.title = i < this.aiCount ? `${d.name} 참가` : `${d.name} 불참`;
        return a;
      })),
      el('span', { class: 'ai-hint', text: `총 ${this.aiCount + 1}명 · ${SPAWN_TEXT[this.aiCount] || ''}` }),
    );
  }

  renderDesc(def) {
    this.desc.innerHTML = '';
    this.desc.append(
      el('b', { text: def ? `${MAP_ICON[def.id]} ${def.name}` : '🎲 랜덤 맵' }),
      el('span', { text: def ? ` · ${def.description}` : ` · 시작할 때 ${MAPS.length}개 맵 중 하나가 무작위로 선택됩니다` }),
    );
  }
}
