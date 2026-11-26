import { el, avatar } from './dom.js';
import { STATE } from '../characters/Character.js';
import { charLabel } from './HUD.js';

const REASON = {
  eliminated: '물방울에서 탈출하지 못했어요…',
  lastStanding: '최후의 1인이 결정되었습니다!',
  timeUp: '시간 종료! 생존자 중 최고 점수가 승리',
  humansOut: '모든 플레이어가 탈락했습니다',
};

export class ResultScreen {
  constructor(game) {
    this.game = game;
    const click = () => game.audio.play('click');
    this.title = el('div', { class: 'result-title' });
    this.reason = el('p', { class: 'result-reason' });
    this.table = el('div', { class: 'rank-table' });
    this.summary = el('div', { class: 'result-summary' });
    this.root = el('div', { class: 'screen overlay result-screen' }, [
      el('div', { class: 'panel modal-panel result-panel' }, [
        this.title,
        this.reason,
        this.summary,
        this.table,
        el('div', { class: 'result-buttons' }, [
          this.againBtn = el('button', { class: 'btn btn-primary btn-big', text: '다시 플레이', onclick: () => { click(); game.restart(); } }),
          this.menuBtn = el('button', { class: 'btn', text: '메인 화면', onclick: () => { click(); game.toMenu(); } }),
        ]),
      ]),
    ]);
  }

  onShow() {
    const o = this.game.outcome;
    if (!o) return;
    const p = this.game.player;
    const rank = o.ranking.indexOf(p) + 1;
    this.title.textContent = o.playerWin ? 'WIN!' : 'LOSE';
    this.title.className = `result-title ${o.playerWin ? 'win' : 'lose'}`;
    this.reason.textContent = (o.mode === 'practice' ? 'AI 연습전 종료 · ' : '') + REASON[o.reason];
    const online = o.mode === 'online';
    this.againBtn.textContent = online ? '대기방으로' : '다시 플레이';
    this.menuBtn.textContent = online ? '방 나가기' : '메인 화면';

    const stat = (label, value, extra = '') => el('div', { class: `sum ${extra}` }, [el('small', { text: label }), el('b', { text: value })]);
    this.summary.innerHTML = '';
    this.summary.append(
      stat('최종 순위', `${rank}위`),
      stat('최종 점수', p.score.toLocaleString(), o.newBest ? 'best' : ''),
      stat('처치', `${p.kills}명`),
      o.mode === 'practice' ? stat('부활', `${p.deaths}회`) : stat('최고 기록', this.game.records.best.toLocaleString()),
    );
    if (o.newBest) this.summary.append(el('div', { class: 'new-best', text: 'NEW BEST!' }));

    this.table.innerHTML = '';
    this.table.append(el('div', { class: 'rank-row head' }, ['순위', '캐릭터', '점수', '처치', '구출', '상태'].map((t) => el('span', { text: t }))));
    o.ranking.forEach((c, i) => {
      this.table.append(
        el('div', { class: `rank-row${c.isPlayer ? ' me' : ''}`, style: { '--c': c.def.css } }, [
          el('span', { class: 'rank-no', text: i === 0 ? '👑' : `${i + 1}` }),
          el('span', { class: 'rank-name' }, [avatar(c.def, 28), el('b', { text: c.name }), el('small', { text: charLabel(c) })]),
          el('span', { text: c.score.toLocaleString() }),
          el('span', { text: String(c.kills) }),
          el('span', { text: String(c.rescues) }),
          el('span', { class: 'rank-state', text: c.state === STATE.DEAD ? '탈락' : '생존' }),
        ]),
      );
    });
  }
}
