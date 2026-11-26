import { el } from './dom.js';
import { renderMapCards, renderCharPicker } from './components.js';
import { getMap } from '../maps/index.js';

const MODE_TEXT = {
  single: { title: '싱글 플레이', sub: '플레이어 1명 + AI 3명 · 최후의 1인이 되거나 3분 후 최고 점수' },
  practice: { title: 'AI 연습전', sub: '탈락해도 2.5초 후 부활 · 3분 동안 점수 경쟁 (기록 미저장)' },
};

// 싱글/연습전 시작 전: 캐릭터 + 맵 선택 (선택한 맵이 배경에 바로 미리보기됨)
export class MapSelectScreen {
  constructor(game) {
    this.game = game;
    this.mode = 'single';
    this.mapId = 'random';
    this.charId = game.session.profile.charId ?? 0;
    const click = () => game.audio.play('click');

    this.title = el('h2');
    this.sub = el('p', { class: 'sub' });
    this.chars = el('div');
    this.maps = el('div');
    this.desc = el('div', { class: 'map-desc' });
    this.root = el('div', { class: 'screen overlay select-screen' }, [
      el('div', { class: 'panel modal-panel wide' }, [
        this.title,
        this.sub,
        el('h3', { text: '캐릭터 선택' }),
        this.chars,
        el('h3', { text: '맵 선택' }),
        this.maps,
        this.desc,
        el('div', { class: 'row-buttons' }, [
          el('button', { class: 'btn', text: '뒤로', onclick: () => { click(); game.setupMenuScene('meadow'); game.ui.show('start'); } }),
          el('button', { class: 'btn btn-primary btn-big', text: '게임 시작', onclick: () => { click(); game.startLocal({ mode: this.mode, mapId: this.mapId, charId: this.charId }); } }),
        ]),
      ]),
    ]);
  }

  onShow(opts = {}) {
    this.mode = opts.mode || this.mode;
    this.title.textContent = MODE_TEXT[this.mode].title;
    this.sub.textContent = MODE_TEXT[this.mode].sub;
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
    this.desc.textContent = def ? `${def.name} — ${def.description}` : '🎲 시작할 때 6개 맵 중 하나가 무작위로 선택됩니다';
  }
}
