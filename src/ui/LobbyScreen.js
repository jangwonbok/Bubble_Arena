import { el, avatar, Figures } from './dom.js';
import { icon } from './icons.js';
import { topActions } from './Modals.js';
import { renderMapCards, renderCharPicker, MAP_ICON } from './components.js';
import { CHARACTER_DEFS } from '../characters/characterDefs.js';
import { getMap } from '../maps/index.js';
import { NET } from '../core/Config.js';

const MODE_TITLE = { public: '온라인 일반전', friend: '친구 초대전' };

// 온라인 대기방: 프로필 → 방 생성/입장 → 플레이어 카드/준비/맵 선택·투표/시작
export class LobbyScreen {
  constructor(game) {
    this.game = game;
    this.s = game.session;
    this.mode = 'public';
    const click = () => game.audio.play('click');
    this.click = click;

    this.status = el('div', { class: 'lobby-status' });

    // ---------- 입장 전 ----------
    this.entryTitle = el('h2', { class: 'sel-title' });
    this.entrySub = el('p', { class: 'sel-sub' });
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
      el('button', { class: 'btn btn-primary btn-big btn-start', onclick: () => { click(); this.saveName(); this.s.quick(); } }, [
        icon('sparkle', 'spark-l'), el('span', { text: '빠른 매칭 시작' }), icon('sparkle', 'spark-r'),
      ]),
    ]);
    this.friendActions = el('div', { class: 'friend-actions' }, [
      el('button', { class: 'btn btn-orange btn-big', text: '방 만들기', onclick: () => { click(); this.saveName(); this.s.create(); } }),
      el('div', { class: 'join-or', text: '또는' }),
      el('div', { class: 'join-row' }, [this.codeInput, el('button', { class: 'btn btn-primary', text: '코드로 입장', onclick: () => this.doJoin() })]),
    ]);
    this.entry = el('div', { class: 'panel select-panel lobby-entry' }, [
      this.entryTitle,
      this.entrySub,
      el('div', { class: 'sec-head' }, [icon('user'), el('span', { text: '닉네임' })]),
      this.nameInput,
      el('div', { class: 'sec-head' }, [icon('people'), el('span', { text: '캐릭터' })]),
      this.entryChars,
      this.publicActions,
      this.friendActions,
    ]);

    // ---------- 방 안 ----------
    this.roomCode = el('b', { class: 'rc-code' });
    this.roomMap = el('span', { class: 'rc-map' });
    this.roomMode = el('span', { class: 'rc-mode' });
    this.roomStatusSlot = el('div', { class: 'rc-status' });
    this.roomCard = el('div', { class: 'room-card panel' }, [
      el('span', { class: 'rc-home' }, [icon('home')]),
      el('div', { class: 'rc-info' }, [this.roomCode, el('div', { class: 'rc-row' }, [this.roomMap, this.roomMode]), this.roomStatusSlot]),
    ]);
    this.roomTitle = el('h1', { class: 'room-title' });
    this.roomSub = el('p', { class: 'room-sub' });
    this.playersBox = el('div', { class: 'player-stage' });

    this.roomChars = el('div');
    this.mapTitle = el('div', { class: 'sec-head' });
    this.maps = el('div', { class: 'map-strip' });
    this.fillToggle = el('label', { class: 'fill-toggle' });
    this.readyBtn = el('button', { class: 'btn btn-orange btn-cta ready-btn', onclick: () => this.onReady() });
    this.readyNote = el('div', { class: 'ready-note' });
    this.inviteBox = el('div', { class: 'panel invite-card' });

    this.roomBox = el('div', { class: 'lobby-room' }, [
      el('div', { class: 'room-head' }, [this.roomTitle, this.roomSub]),
      this.playersBox,
      el('div', { class: 'room-bottom' }, [
        el('div', { class: 'panel room-setup' }, [
          el('div', { class: 'sec-head' }, [icon('user'), el('span', { text: '내 캐릭터' })]),
          this.roomChars,
          this.mapTitle,
          this.maps,
        ]),
        el('div', { class: 'ready-zone' }, [this.readyBtn, this.readyNote]),
        el('div', { class: 'room-right' }, [this.inviteBox, el('div', { class: 'panel fill-card' }, [this.fillToggle])]),
      ]),
    ]);

    this.backBtnLabel = el('span', { class: 'ta-label' });
    this.backBtn = el('button', { class: 'ta-btn danger', onclick: () => this.onBack() }, [el('span', { class: 'ta-ico' }, [icon('exit')]), this.backBtnLabel]);
    const actions = topActions(game, ['settings', 'sound', 'help']);
    actions.append(this.backBtn);

    this.crumbTitle = el('span');
    this.crumb = el('div', { class: 'crumb' }, [
      el('button', { class: 'crumb-back', 'aria-label': '뒤로', onclick: () => this.onBack() }, [icon('back')]),
      el('div', { class: 'crumb-trail' }, [el('span', { class: 'home-link', text: '홈', onclick: () => this.onBack() }), el('span', { text: '›' }), this.crumbTitle]),
    ]);

    this.root = el('div', { class: 'screen overlay lobby-screen' }, [
      el('div', { class: 'top-bar' }, [this.crumb, this.roomCard, actions]),
      this.entry,
      this.roomBox,
      this.status,
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
    this.game.buildMapThumbs?.();
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

  /** 투표 최다 맵 (친구전) 또는 방장이 고른 맵 이름 */
  currentMapName(r) {
    let id = r.mapChoice;
    if (r.mode === 'friend') {
      const entries = Object.entries(r.votes || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
      id = entries[0]?.[0] || 'random';
    }
    return id === 'random' ? '🎲 랜덤 맵' : `${MAP_ICON[id] || ''} ${getMap(id).name}`;
  }

  render() {
    if (this.game.ui?.current !== 'lobby') return;
    const s = this.s;
    const r = s.room;
    const mode = r ? r.mode : this.mode;

    // 연결 상태 (하단 작은 칩)
    const st = s.net.status;
    const stText = { idle: '연결 전', connecting: '서버 연결 중…', open: `연결됨 · ${Math.round(s.net.rtt)}ms`, reconnecting: '재접속 중…', failed: '연결 실패' }[st];
    this.status.innerHTML = '';
    this.status.append(el('span', { class: `dot ${st}`, text: stText }));
    if (s.error) this.status.append(el('span', { class: 'err', text: s.error }));
    (r ? this.roomStatusSlot : this.root).append(this.status);

    this.entry.classList.toggle('hidden', !!r);
    this.roomBox.classList.toggle('hidden', !r);
    this.crumb.classList.toggle('hidden', !!r);
    this.roomCard.classList.toggle('hidden', !r);
    this.publicActions.classList.toggle('hidden', mode !== 'public');
    this.friendActions.classList.toggle('hidden', mode !== 'friend');
    this.backBtnLabel.textContent = r ? '방 나가기' : '나가기';
    this.root.classList.toggle('in-room', !!r);

    if (!r) {
      this.crumbTitle.textContent = MODE_TITLE[mode];
      this.entryTitle.textContent = MODE_TITLE[mode];
      this.entrySub.textContent = mode === 'public' ? '자동 매칭으로 최대 4명이 함께 플레이해요' : '방을 만들어 친구를 초대하거나, 받은 방 코드로 입장하세요';
      renderCharPicker(this.entryChars, {
        selected: s.profile.charId,
        onPick: (id) => {
          this.click();
          s.saveProfile({ charId: id });
          this.render();
        },
      });
      return;
    }

    // 방 정보 카드 / 제목
    this.roomCode.textContent = `방 코드: #${r.code}`;
    this.roomMap.textContent = `맵: ${this.currentMapName(r)}`;
    this.roomMode.textContent = r.mode === 'friend' ? '친구 초대' : '공개 방';
    this.roomTitle.innerHTML = '';
    this.roomTitle.append(el('span', { text: `${MODE_TITLE[r.mode]} ` }), el('span', { class: 'accent', text: '대기방' }));
    this.roomSub.textContent = s.isHost ? '모두 준비 완료되면 게임을 시작할 수 있습니다.' : '준비 완료를 누르고 방장이 시작하기를 기다려 주세요.';

    // 플레이어 카드 (4칸)
    this.playersBox.innerHTML = '';
    for (let i = 0; i < NET.MAX_PLAYERS; i++) {
      const p = r.players[i];
      if (p) {
        const def = CHARACTER_DEFS[p.charId];
        const isHost = p.id === r.hostId;
        const isMe = p.id === s.net.id;
        const badge = isHost
          ? el('span', { class: 'pc-badge host' }, [el('b', { text: '방장' }), el('small', { text: 'HOST' })])
          : el('span', { class: `pc-badge ${p.ready ? 'ready' : 'wait'}` }, [
              p.ready ? icon('check') : null,
              el('b', { text: p.ready ? '준비 완료!' : '대기 중' }),
              el('small', { text: p.ready ? 'READY' : 'WAITING' }),
            ]);
        this.playersBox.append(
          el('div', { class: `player-card${isMe ? ' me' : ''}${p.connected ? '' : ' offline'}${p.ready || isHost ? ' is-ready' : ''}`, style: { '--c': def.css } }, [
            badge,
            el('div', { class: 'pc-figure' }, [
              el('div', { class: 'pc-pedestal' }),
              Figures.bind(el('img', { class: 'pc-fig', alt: def.name }), def.id),
              Figures.urls[def.id] ? null : avatar(def, 110),
            ]),
            el('div', { class: 'pc-nameplate' }, [
              isHost ? icon('crown') : null,
              el('b', { text: p.name }),
              isMe ? el('span', { class: 'me-tag', text: isHost ? '[방장]' : '[나]' }) : null,
            ]),
            el('small', { class: 'pc-char', text: `${def.name}${p.connected ? '' : ' · 접속 끊김'}` }),
          ]),
        );
      } else {
        this.playersBox.append(
          el('div', { class: 'player-card empty' }, [
            el('div', { class: 'pc-empty-ico', text: r.fillAI ? '🤖' : '+' }),
            el('b', { text: r.fillAI ? 'AI가 채워요' : '빈 자리' }),
            el('small', { text: r.fillAI ? '시작 시 AI 참가' : r.mode === 'friend' ? '친구를 초대해 보세요' : '매칭 대기 중…' }),
          ]),
        );
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
    this.roomChars.classList.add('compact');

    // 맵
    this.mapTitle.innerHTML = '';
    if (r.mode === 'friend') {
      this.mapTitle.append(icon('vote'), el('span', { text: '맵 투표' }), el('small', { text: '최다 득표 맵으로 결정 (동률은 무작위)' }));
      renderMapCards(this.maps, { votes: r.votes, myVote: me?.vote, mode: 'vote', onPick: (id) => { this.click(); s.vote(id); } });
    } else {
      this.mapTitle.append(icon('map'), el('span', { text: s.isHost ? '맵 선택 (방장)' : '방장이 선택한 맵' }));
      renderMapCards(this.maps, { selected: r.mapChoice, mode: s.isHost ? 'select' : 'view', onPick: (id) => { this.click(); s.setMap(id); } });
    }

    // 초대 카드
    this.inviteBox.innerHTML = '';
    if (r.mode === 'friend') {
      this.inviteBox.append(
        el('button', { class: 'btn btn-ghost invite-btn', onclick: () => this.copy(s.inviteLink(), '초대 링크를 복사했습니다. 친구에게 보내 주세요!') }, [icon('userPlus'), el('span', { text: '친구 초대' })]),
        el('div', { class: 'invite-row' }, [
          el('button', { class: 'mini-link', onclick: () => this.copy(r.code, '방 코드를 복사했습니다') }, [icon('copy'), el('span', { text: '코드 복사' })]),
          el('i', { class: 'sep' }),
          el('span', { text: `${r.players.length} / ${NET.MAX_PLAYERS}명` }),
        ]),
      );
    } else {
      this.inviteBox.append(
        el('div', { class: 'invite-public' }, [icon('globe'), el('b', { text: '공개 방' })]),
        el('small', { class: 'invite-hint', text: '다른 플레이어가 빠른 매칭으로 들어올 수 있어요' }),
      );
    }

    // AI 채우기 옵션
    this.fillToggle.innerHTML = '';
    const cb = el('input', { type: 'checkbox' });
    cb.checked = r.fillAI;
    cb.disabled = !s.isHost;
    cb.addEventListener('change', () => s.fill(cb.checked));
    this.fillToggle.append(cb, el('span', { class: 'switch' }), el('span', { text: `빈자리 AI로 채우기${s.isHost ? '' : ' (방장 설정)'}` }));

    // 준비 / 시작 버튼
    this.readyBtn.innerHTML = '';
    this.readyNote.innerHTML = '';
    if (s.isHost) {
      const reason = this.canStartReason(r);
      this.readyBtn.append(el('b', { text: '게임 시작' }), el('small', { text: 'GAME START' }));
      this.readyBtn.disabled = !!reason;
      this.readyNote.append(reason ? el('span', { class: 'wait', text: reason }) : el('span', { class: 'ok' }, [icon('check'), el('span', { text: '모든 플레이어 준비 완료!' })]));
    } else {
      this.readyBtn.disabled = false;
      this.readyBtn.append(el('b', { text: me?.ready ? '준비 취소' : '준비 완료' }), el('small', { text: me?.ready ? 'CANCEL' : 'READY' }));
      this.readyNote.append(el('span', { class: me?.ready ? 'ok' : 'wait', text: me?.ready ? '방장이 시작하기를 기다리는 중…' : '준비 완료를 눌러 주세요' }));
    }
    this.readyBtn.classList.toggle('pulse', !this.readyBtn.disabled);
  }

  async copy(text, msg) {
    this.click();
    try {
      await navigator.clipboard.writeText(text);
      this.game.ui.toast(`✅ ${msg}`);
    } catch {
      window.prompt('복사해서 공유하세요', text);
    }
  }
}
