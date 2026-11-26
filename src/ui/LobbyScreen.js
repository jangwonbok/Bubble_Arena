import { el, avatar } from './dom.js';
import { renderMapCards, renderCharPicker } from './components.js';
import { CHARACTER_DEFS } from '../characters/characterDefs.js';
import { getMap } from '../maps/index.js';
import { NET } from '../core/Config.js';

const MODE_TITLE = { public: '온라인 일반전', friend: '친구 초대전' };

// 온라인 대기방: 프로필 → 방 생성/입장 → 플레이어 목록/준비/맵 선택·투표/시작
export class LobbyScreen {
  constructor(game) {
    this.game = game;
    this.s = game.session;
    this.mode = 'public';
    const click = () => game.audio.play('click');
    this.click = click;

    this.title = el('h2');
    this.status = el('div', { class: 'lobby-status' });

    // 입장 전
    this.nameInput = el('input', { class: 'text-input', maxlength: '12', placeholder: '닉네임 (최대 12자)' });
    this.nameInput.addEventListener('change', () => this.saveName());
    this.nameInput.addEventListener('keydown', (e) => e.stopPropagation());
    this.entryChars = el('div');
    this.codeInput = el('input', { class: 'text-input code-input', maxlength: '5', placeholder: '방 코드' });
    this.codeInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') this.doJoin();
    });
    this.codeInput.addEventListener('input', () => (this.codeInput.value = this.codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '')));
    this.publicActions = el('div', { class: 'row-buttons' }, [
      el('button', { class: 'btn btn-primary btn-big', text: '빠른 매칭 시작', onclick: () => { click(); this.saveName(); this.s.quick(); } }),
    ]);
    this.friendActions = el('div', { class: 'friend-actions' }, [
      el('button', { class: 'btn btn-primary', text: '방 만들기', onclick: () => { click(); this.saveName(); this.s.create(); } }),
      el('div', { class: 'join-row' }, [this.codeInput, el('button', { class: 'btn', text: '코드로 입장', onclick: () => this.doJoin() })]),
    ]);
    this.entry = el('div', { class: 'lobby-entry' }, [
      el('h3', { text: '닉네임' }),
      this.nameInput,
      el('h3', { text: '캐릭터' }),
      this.entryChars,
      this.publicActions,
      this.friendActions,
    ]);

    // 방 안
    this.codeBox = el('div', { class: 'room-code' });
    this.playersBox = el('div', { class: 'lobby-players' });
    this.roomChars = el('div');
    this.mapTitle = el('h3');
    this.maps = el('div');
    this.fillToggle = el('label', { class: 'fill-toggle' });
    this.readyBtn = el('button', { class: 'btn btn-primary btn-big', onclick: () => this.onReady() });
    this.roomBox = el('div', { class: 'lobby-room' }, [
      this.codeBox,
      this.playersBox,
      el('h3', { text: '내 캐릭터' }),
      this.roomChars,
      this.mapTitle,
      this.maps,
      this.fillToggle,
    ]);

    this.backBtn = el('button', { class: 'btn', onclick: () => this.onBack() });
    this.root = el('div', { class: 'screen overlay lobby-screen' }, [
      el('div', { class: 'panel modal-panel wide' }, [
        this.title,
        this.status,
        this.entry,
        this.roomBox,
        el('div', { class: 'row-buttons' }, [this.backBtn, this.readyBtn]),
      ]),
    ]);

    this.s.onChange(() => this.render());
  }

  saveName() {
    const name = this.nameInput.value.trim().slice(0, 12);
    if (name && name !== this.s.profile.name) this.s.setProfile({ name });
  }

  doJoin() {
    this.click();
    this.saveName();
    if (this.codeInput.value.length === 5) this.s.join(this.codeInput.value);
    else this.game.ui.toast('방 코드 5자리를 입력해 주세요');
  }

  onBack() {
    this.click();
    if (this.s.room) this.s.leave();
    else {
      this.game.setupMenuScene('meadow');
      this.game.ui.show('start');
    }
  }

  onReady() {
    this.click();
    const r = this.s.room;
    if (!r) return;
    if (this.s.isHost) this.s.start();
    else this.s.ready(!this.s.me?.ready);
  }

  async onShow(opts = {}) {
    this.mode = opts.mode || this.mode;
    if (opts.code) this.codeInput.value = opts.code;
    this.nameInput.value = this.s.profile.name;
    this.render();
    await this.s.ensure();
    this.render();
  }

  canStartReason(r) {
    const others = r.players.filter((p) => p.id !== r.hostId);
    if (others.some((p) => !p.ready)) return '모든 플레이어 준비 대기 중';
    const total = r.fillAI ? NET.MAX_PLAYERS : r.players.length;
    if (total < 2) return '2명 이상 필요 (AI 채우기 가능)';
    return null;
  }

  render() {
    if (this.game.ui?.current !== 'lobby') return;
    const s = this.s;
    const r = s.room;
    const mode = r ? r.mode : this.mode;
    this.title.textContent = MODE_TITLE[mode];

    // 상태 줄
    const st = s.net.status;
    const stText = { idle: '연결 전', connecting: '서버 연결 중…', open: `● 연결됨 · ${Math.round(s.net.rtt)}ms`, reconnecting: '재접속 중…', failed: '연결 실패' }[st];
    this.status.innerHTML = '';
    this.status.append(el('span', { class: `dot ${st}`, text: stText }));
    if (s.error) this.status.append(el('span', { class: 'err', text: s.error }));

    this.entry.classList.toggle('hidden', !!r);
    this.roomBox.classList.toggle('hidden', !r);
    this.publicActions.classList.toggle('hidden', mode !== 'public');
    this.friendActions.classList.toggle('hidden', mode !== 'friend');
    this.backBtn.textContent = r ? '방 나가기' : '뒤로';

    if (!r) {
      renderCharPicker(this.entryChars, {
        selected: s.profile.charId,
        onPick: (id) => {
          this.click();
          s.saveProfile({ charId: id });
          this.render();
        },
      });
      this.readyBtn.classList.add('hidden');
      return;
    }

    // 방 코드
    this.codeBox.innerHTML = '';
    if (r.mode === 'friend') {
      this.codeBox.append(
        el('div', {}, [el('small', { text: '방 코드' }), el('b', { text: r.code })]),
        el('button', { class: 'chip-toggle', text: '📋 코드 복사', onclick: () => this.copy(r.code, '방 코드를 복사했습니다') }),
        el('button', { class: 'chip-toggle', text: '🔗 초대 링크 복사', onclick: () => this.copy(s.inviteLink(), '초대 링크를 복사했습니다. 친구에게 보내 주세요!') }),
      );
    } else {
      this.codeBox.append(el('div', {}, [el('small', { text: '공개 방 (자동 매칭)' }), el('b', { text: r.code })]), el('span', { class: 'hint', text: '다른 플레이어가 빠른 매칭으로 들어올 수 있어요' }));
    }

    // 플레이어 목록 (4칸)
    this.playersBox.innerHTML = '';
    for (let i = 0; i < NET.MAX_PLAYERS; i++) {
      const p = r.players[i];
      if (p) {
        const def = CHARACTER_DEFS[p.charId];
        const isHost = p.id === r.hostId;
        this.playersBox.append(
          el('div', { class: `lobby-player${p.id === s.net.id ? ' me' : ''}${p.connected ? '' : ' offline'}`, style: { '--c': def.css } }, [
            avatar(def, 46),
            el('div', { class: 'lp-info' }, [
              el('b', { text: `${isHost ? '👑 ' : ''}${p.name}` }),
              el('small', { text: `${def.name}${p.id === s.net.id ? ' · 나' : ''}${p.connected ? '' : ' · 접속 끊김'}` }),
            ]),
            el('span', { class: `ready-badge ${isHost ? 'host' : p.ready ? 'on' : ''}`, text: isHost ? '방장' : p.ready ? '준비 완료' : '대기 중' }),
          ]),
        );
      } else {
        this.playersBox.append(el('div', { class: 'lobby-player empty' }, [el('div', { class: 'empty-avatar', text: r.fillAI ? '🤖' : '…' }), el('b', { text: r.fillAI ? 'AI가 채워요' : '빈 자리' })]));
      }
    }

    // 캐릭터 (다른 사람이 고른 것은 선택 불가)
    const me = s.me;
    const taken = new Set(r.players.filter((p) => p.id !== s.net.id).map((p) => p.charId));
    renderCharPicker(this.roomChars, {
      selected: me?.charId,
      taken,
      onPick: (id) => {
        this.click();
        s.setProfile({ charId: id });
      },
    });

    // 맵
    if (r.mode === 'friend') {
      this.mapTitle.textContent = '맵 투표 — 방장이 시작하면 최다 득표 맵으로 결정 (동률은 무작위)';
      renderMapCards(this.maps, { votes: r.votes, myVote: me?.vote, mode: 'vote', onPick: (id) => { this.click(); s.vote(id); } });
    } else {
      const chosen = r.mapChoice === 'random' ? '랜덤' : getMap(r.mapChoice).name;
      this.mapTitle.textContent = s.isHost ? '맵 선택 (방장)' : `방장이 선택한 맵: ${chosen}`;
      renderMapCards(this.maps, { selected: r.mapChoice, mode: s.isHost ? 'select' : 'view', onPick: (id) => { this.click(); s.setMap(id); } });
    }

    // AI 채우기 옵션
    this.fillToggle.innerHTML = '';
    const cb = el('input', { type: 'checkbox' });
    cb.checked = r.fillAI;
    cb.disabled = !s.isHost;
    cb.addEventListener('change', () => s.fill(cb.checked));
    this.fillToggle.append(cb, el('span', { text: `인원이 부족하면 빈자리를 AI로 채우기${s.isHost ? '' : ' (방장 설정)'}` }));

    // 준비 / 시작 버튼
    this.readyBtn.classList.remove('hidden');
    if (s.isHost) {
      const reason = this.canStartReason(r);
      this.readyBtn.textContent = reason ? `게임 시작 (${reason})` : '게임 시작!';
      this.readyBtn.disabled = !!reason;
    } else {
      this.readyBtn.disabled = false;
      this.readyBtn.textContent = me?.ready ? '준비 취소' : '준비 완료';
    }
  }

  async copy(text, msg) {
    try {
      await navigator.clipboard.writeText(text);
      this.game.ui.toast(`✅ ${msg}`);
    } catch {
      window.prompt('복사해서 공유하세요', text);
    }
  }
}
