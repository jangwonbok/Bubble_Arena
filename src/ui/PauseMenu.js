import { el, soundControls } from './dom.js';

export class PauseMenu {
  constructor(game) {
    this.game = game;
    const click = () => game.audio.play('click');
    this.title = el('h2', { class: 'pause-title', text: '일시정지' });
    this.note = el('p', { class: 'sub' });
    this.restartBtn = el('button', { class: 'btn', text: '게임 재시작', onclick: () => { click(); game.restart(); } });
    this.menuBtn = el('button', { class: 'btn', text: '메인 화면', onclick: () => { click(); game.toMenu(); } });
    this.root = el('div', { class: 'screen overlay pause-screen' }, [
      el('div', { class: 'panel modal-panel' }, [
        this.title,
        this.note,
        el('button', { class: 'btn btn-primary btn-big', text: '계속하기', onclick: () => { click(); game.resume(); } }),
        this.restartBtn,
        this.menuBtn,
        el('h3', { text: '사운드 설정' }),
        soundControls(game.audio, click),
      ]),
    ]);
  }

  onShow() {
    const online = this.game.mode === 'online';
    this.title.textContent = online ? '메뉴' : '일시정지';
    this.note.textContent = online ? '온라인 경기는 멈추지 않아요. 메뉴가 열린 동안 캐릭터는 정지합니다.' : '';
    this.note.classList.toggle('hidden', !online);
    this.restartBtn.classList.toggle('hidden', online);
    this.menuBtn.textContent = online ? '경기 나가기 (메인 화면)' : '메인 화면';
  }
}
