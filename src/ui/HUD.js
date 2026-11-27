import { el, avatar } from './dom.js';
import { icon } from './icons.js';
import { TouchControls } from './TouchControls.js';
import { fullscreenAction, showFullscreenButton } from './Modals.js';
import { Fullscreen } from '../core/Fullscreen.js';
import { Device } from '../core/Device.js';
import { CONFIG } from '../core/Config.js';
import { STATE } from '../characters/Character.js';
import { PERSONALITY_LABEL, MAP_ICON } from './components.js';
import { ITEM_DEFS } from '../systems/items/itemDefs.js';

const STATUS_TEXT = { alive: '생존', trapped: '갇힘!', dead: '탈락' };
// 아이템 획득 칩에 쓰는 짧은 이름
const ITEM_SHORT = {
  bomb: '물풍선 +1',
  range: '물줄기 +1',
  speed: '스피드 UP',
  shield: '방어막',
  remote: '원격 폭발',
  life: '생명 +1',
  jump: '점프 슈즈',
  slow: '시간 지연',
  magnet: '아이템 자석',
};

export function charLabel(c) {
  if (c.isPlayer) return 'YOU';
  if (c.aiTakeover) return 'AI 대체 중';
  if (c.human) return '플레이어';
  return PERSONALITY_LABEL[c.personality] || 'AI';
}

export class HUD {
  constructor(game) {
    this.game = game;
    this.timer = el('div', { class: 'timer-value', text: '3:00' });
    this.timerTag = el('div', { class: 'timer-tag' });
    this.score = el('div', { class: 'score-value', text: '0' });
    this.aliveCount = el('div', { class: 'alive-value', text: '4' });
    this.aliveTotal = el('span', { text: '/4' });
    this.meAvatar = el('div', { class: 'me-avatar hidden' });
    this.pauseBtn = el('button', {
      class: 'pause-btn', 'aria-label': '일시정지', html: '<span></span><span></span>',
      onclick: () => { game.audio.play('click'); game.pause(); },
    });
    this.zoomBtn = el('button', {
      class: 'zoom-btn', 'aria-label': '확대 / 전체 보기',
      onclick: () => {
        game.audio.play('click');
        game.sm.setZoom(!game.sm.zoomed);
        this.syncZoom();
      },
    });
    this.fsBtn = el('button', { class: 'zoom-btn fs-btn', 'aria-label': '전체 화면', onclick: () => fullscreenAction(game) });
    const syncFs = () => {
      this.fsBtn.innerHTML = '';
      this.fsBtn.append(icon(Fullscreen.active ? 'compress' : 'expand'));
      this.fsBtn.classList.toggle('hidden', !showFullscreenButton());
    };
    Fullscreen.onChange(syncFs);
    Device.onChange(syncFs);
    syncFs();
    this.cardsBox = el('div', { class: 'cards' });
    this.mapChip = el('div', { class: 'map-chip' });
    this.netChip = el('div', { class: 'net-chip hidden' });

    this.bombIcons = el('div', { class: 'pips' });
    this.rangeIcons = el('div', { class: 'pips' });
    this.speedIcons = el('div', { class: 'pips' });
    this.bombVal = el('b', { class: 'stat-val' });
    this.rangeVal = el('b', { class: 'stat-val' });
    this.speedVal = el('b', { class: 'stat-val' });
    this.remoteVal = el('b', { class: 'stat-val' });
    this.remoteSlot = el('div', { class: 'stat stat-remote' }, [
      el('div', { class: 'remote-ico' }, [el('img', { class: 'stat-img', src: game.itemView.iconURL('remote'), alt: '' })]),
      el('div', { class: 'stat-text' }, [
        el('small', { html: '<kbd>E</kbd>/<kbd>Shift</kbd>' }),
        el('span', { class: 'stat-line' }, [el('span', { class: 'stat-name', text: '원격 폭발' })]),
        this.remoteVal,
      ]),
    ]);
    this.feed = el('div', { class: 'feed' });
    this.itemLane = el('div', { class: 'item-lane' });
    this.effectChips = el('div', { class: 'effect-chips' });

    const stat = (cls, type, label, val, pips) =>
      el('div', { class: `stat ${cls}` }, [
        el('img', { class: 'stat-img', src: game.itemView.iconURL(type), alt: '' }),
        el('div', { class: 'stat-text' }, [el('small', { text: label }), val, pips]),
      ]);

    this.hint = el('div', { class: 'panel controls-hint' }, [
      el('div', { class: 'ch-head' }, [icon('keyboard'), el('b', { text: '조작법' }), el('span', { class: 'ch-q', text: '?' })]),
      el('div', { class: 'ch-short', html: '<kbd>WASD</kbd> / <kbd>SPACE</kbd>' }),
      el('div', { class: 'ch-full' }, [
        el('div', { html: '<kbd>WASD</kbd> / <kbd>방향키</kbd> 이동' }),
        el('div', { html: '<kbd>SPACE</kbd> 물풍선' }),
        el('div', { html: '<kbd>E</kbd> / <kbd>Shift</kbd> 원격 폭발' }),
        el('div', { html: '<kbd>ESC</kbd> 메뉴' }),
      ]),
    ]);

    this.root = el('div', { class: 'screen hud' }, [
      el('div', { class: 'hud-top' }, [
        el('div', { class: 'hud-left' }, [
          el('div', { class: 'panel hud-score' }, [
            this.meAvatar,
            el('div', { class: 'hs-block' }, [icon('trophy', 'hs-ico'), el('div', {}, [el('small', { text: 'SCORE' }), this.score])]),
            el('div', { class: 'divider' }),
            el('div', { class: 'hs-block' }, [icon('shield', 'hs-ico'), el('div', {}, [el('small', { text: '생존' }), el('div', { class: 'alive-wrap' }, [this.aliveCount, this.aliveTotal])])]),
          ]),
          this.mapChip,
          this.netChip,
        ]),
        el('div', { class: 'hud-timer-wrap' }, [
          this.timerTag,
          el('div', { class: 'panel hud-timer' }, [icon('stopwatch', 'clock-ico'), this.timer]),
        ]),
        el('div', { class: 'hud-right' }, [this.cardsBox, el('div', { class: 'hud-btns' }, [this.pauseBtn, this.zoomBtn, this.fsBtn])]),
      ]),
      el('div', { class: 'hud-bottom' }, [
        this.effectChips,
        el('div', { class: 'panel player-stats' }, [
          stat('stat-bomb', 'bomb', '물풍선', this.bombVal, this.bombIcons),
          el('i', { class: 'stat-sep' }),
          stat('stat-range', 'range', '물줄기', this.rangeVal, this.rangeIcons),
          el('i', { class: 'stat-sep' }),
          stat('stat-speed', 'speed', '스피드', this.speedVal, this.speedIcons),
          el('i', { class: 'stat-sep' }),
          this.remoteSlot,
        ]),
        this.hint,
      ]),
      this.feed,
      this.itemLane,
    ]);
    // 모바일 가상 조작 (body.touch 일 때만 CSS 로 표시)
    this.touch = new TouchControls(game);
    this.root.append(this.touch.root);

    this.acc = 0;
    this.cache = {};
    this.builtFor = null;
    const b = game.bus;
    const name = (c) => `<b style="color:${c.def.css}">${c.name}</b>`;
    b.on('trapped', ({ c }) => this.toast(`${name(c)} 물방울에 갇혔다!`));
    b.on('rescued', ({ c, by }) => this.toast(`${name(by)} → ${name(c)} 구출!`));
    b.on('eliminated', ({ c, by, cause }) => {
      const how = { lava: ' 용암에 빠짐!', fall: ' 허공으로 낙하!' }[cause];
      this.toast(by && by !== c ? `${name(by)} 가 ${name(c)} 탈락시킴!` : `${name(c)}${how || ' 탈락!'}`, 'big');
    });
    b.on('respawned', ({ c }) => this.toast(`${name(c)} 부활!`));
    b.on('hazardWarn', ({ hazard }) => {
      const t = { eruption: '🌋 화산 분출 경고!', wave: '🌊 파도가 몰려와요!', tide: '🌊 밀물이 들어와요! 가장자리를 피하세요', crumble: '☁️ 구름이 무너져요!' }[hazard.kind];
      if (t) this.toast(t, 'warn');
    });
    // 아이템 획득: 큰 말풍선 대신 화면 상단의 작은 칩 + 능력치 바 반짝임
    b.on('itemRemoved', ({ item, by }) => {
      if (by && by.isPlayer) this.itemNotice(item.type);
    });
    b.on('shieldBlocked', ({ c }) => this.toast(`🛡️ ${name(c)} 방어막이 물줄기를 막았다!`));
    b.on('lifeUsed', ({ c }) => this.toast(`❤️ ${name(c)} 생명을 사용해 살아남았다!`, 'big'));
    b.on('slowed', ({ c, by }) => c.isPlayer && this.toast(`⏳ ${name(by)} 의 시간 지연! 잠시 느려집니다`, 'warn'));
  }

  /** 아이템 아이콘 <img> (3D 모델 렌더 이미지) */
  img(type) {
    return `<img class="item-ico" src="${this.game.itemView.iconURL(type)}" alt="">`;
  }

  toast(html, kind = '') {
    const t = el('div', { class: `toast ${kind}`, html });
    this.feed.prepend(t);
    // 휴대폰은 게임 화면을 덜 가리도록 최대 3개
    const max = window.innerWidth <= 600 || window.innerHeight <= 500 ? 3 : 5;
    while (this.feed.children.length > max) this.feed.lastChild.remove();
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3100);
  }

  /**
   * 아이템 획득 알림 (간결한 칩)
   *  - 아이콘 + 짧은 이름. 같은 아이템을 연달아 먹으면 칩 하나로 합쳐 ×N 표시
   *  - 최대 2개만 보이고 오래된 것부터 자연스럽게 사라짐 → 화면을 덮지 않음
   *  - 기본 능력치 아이템은 하단(또는 상단) 능력치 칸도 통통 튀어 무엇이 올랐는지 바로 보임
   */
  itemNotice(type) {
    const d = ITEM_DEFS[type];
    if (!d) return;
    const statEl = { bomb: this.bombVal, range: this.rangeVal, speed: this.speedVal }[type]?.closest('.stat');
    if (statEl) {
      statEl.classList.remove('bump');
      void statEl.offsetWidth;
      statEl.classList.add('bump');
    }

    const LIFE = 1700;
    const existing = [...this.itemLane.children].find((c) => c.dataset.type === type && !c.classList.contains('out'));
    if (existing) {
      const n = Number(existing.dataset.count) + 1;
      existing.dataset.count = n;
      existing.querySelector('.in-count').textContent = `×${n}`;
      existing.classList.remove('again');
      void existing.offsetWidth;
      existing.classList.add('again');
      this.scheduleOut(existing, LIFE);
      return;
    }
    const chip = el('div', { class: `item-chip${d.basic ? '' : ' special'}`, 'data-type': type, 'data-count': '1' }, [
      el('img', { src: this.game.itemView.iconURL(type), alt: '' }),
      el('b', { text: ITEM_SHORT[type] || d.name }),
      el('span', { class: 'in-count' }),
    ]);
    this.itemLane.prepend(chip);
    const alive = [...this.itemLane.children].filter((c) => !c.classList.contains('out'));
    for (const old of alive.slice(2)) this.removeChip(old); // 최대 2개
    this.scheduleOut(chip, LIFE);
  }

  scheduleOut(chip, ms) {
    clearTimeout(chip._t);
    chip._t = setTimeout(() => this.removeChip(chip), ms);
  }

  removeChip(chip) {
    clearTimeout(chip._t);
    chip.classList.add('out');
    setTimeout(() => chip.remove(), 350);
  }

  /** 경기마다 참가자 구성이 달라지므로 카드 재생성 */
  rebuild() {
    const g = this.game;
    this.builtFor = g.characters;
    this.cache = {};
    this.feed.innerHTML = '';
    this.itemLane.innerHTML = '';
    this.meAvatar.innerHTML = '';
    this.meAvatar.append(avatar(g.player.def, 44));
    this.aliveTotal.textContent = `/${g.characters.length}`;
    const def = g.mapDef;
    this.mapChip.innerHTML = '';
    this.mapChip.append(el('b', { text: `${MAP_ICON[def.id] || ''} ${def.name}` }), el('span', { text: ` · ${def.effectText}` }));
    this.mapChip.title = def.effectText;
    this.mapChip.className = `map-chip panel${g.mode === 'practice' ? ' practice' : ''}`;
    this.timerTag.textContent = { single: 'SINGLE', practice: 'PRACTICE', online: 'ONLINE' }[g.mode] || 'MATCH';
    this.cardsBox.innerHTML = '';
    const ico = (t) => `<img class="mini-ico" src="${g.itemView.iconURL(t)}" alt="">`;
    this.cards = g.characters.map((c) => {
      const status = el('span', { class: 'status' });
      const stats = el('div', { class: 'mini-stats' });
      const effects = el('span', { class: 'mini-fx' });
      const scoreEl = el('b', { class: 'card-score' });
      const label = el('small', { class: 'card-label' });
      const card = el('div', { class: `char-card${c.isPlayer ? ' me' : ''}`, style: { '--c': c.def.css } }, [
        avatar(c.def, 40),
        el('div', { class: 'card-info' }, [
          el('div', { class: 'card-top' }, [el('b', { class: 'card-name', text: c.name }), label, status]),
          el('div', { class: 'card-bottom' }, [stats, effects, scoreEl]),
        ]),
        el('div', { class: 'trap-bar' }, [el('i')]),
      ]);
      this.cardsBox.append(card);
      return { c, card, status, stats, effects, scoreEl, label, ico, bar: card.querySelector('.trap-bar i') };
    });
  }

  onShow() {
    if (this.builtFor !== this.game.characters) this.rebuild();
    this.syncZoom();
    this.refresh();
  }

  /** 확대/전체 보기 버튼 (휴대폰·터치 기기에서만) */
  syncZoom() {
    const sm = this.game.sm;
    this.zoomBtn.classList.toggle('hidden', !sm.zoomAvailable);
    this.zoomBtn.classList.toggle('on', !!sm.zoomed);
    this.zoomBtn.innerHTML = '';
    this.zoomBtn.append(icon(sm.zoomed ? 'map' : 'zoom'));
    this.zoomBtn.title = sm.zoomed ? '전체 보기' : '내 캐릭터 확대';
  }

  pips(container, key, value, max, cls) {
    const k = `${value}/${max}`;
    if (this.cache[key] === k) return;
    this.cache[key] = k;
    container.innerHTML = '';
    for (let i = 0; i < max; i++) container.append(el('i', { class: i < value ? `on ${cls}` : '' }));
  }

  set(node, key, text) {
    if (this.cache[key] === text) return;
    this.cache[key] = text;
    node.textContent = text;
  }

  update(dt) {
    this.acc += dt;
    if (this.acc < 0.1) return;
    this.acc = 0;
    this.refresh();
  }

  refresh() {
    const g = this.game;
    if (!g.player) return;
    if (this.builtFor !== g.characters) this.rebuild();
    const t = Math.ceil(g.timeLeft);
    this.set(this.timer, 'timer', `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`);
    this.timer.parentElement.classList.toggle('danger', t <= 30);
    this.set(this.score, 'score', g.player.score.toLocaleString());
    this.set(this.aliveCount, 'alive', String(g.characters.filter((c) => c.state !== STATE.DEAD).length));

    const online = g.mode === 'online';
    this.netChip.classList.toggle('hidden', !online);
    if (online) {
      const n = g.session.net;
      this.set(this.netChip, 'net', `🌐 ${g.session.room?.code ?? ''} · ${Math.round(n.rtt)}ms`);
      this.netChip.className = `net-chip panel${n.rtt > 150 ? ' slow' : ''}`;
    }

    for (const x of this.cards) {
      const c = x.c;
      this.set(x.status, `st${c.id}`, STATUS_TEXT[c.state]);
      this.set(x.label, `lb${c.id}`, charLabel(c));
      x.card.dataset.state = c.state;
      x.bar.style.transform = `scaleX(${c.state === STATE.TRAPPED ? c.trapTimer / CONFIG.TRAP_DURATION : 0})`;
      const icons = `${c.shieldTime > 0 ? '🛡️' : ''}${c.lives > 0 ? '❤️' : ''}${c.remoteCharges > 0 ? '📡' : ''}${c.jumpTime > 0 ? '🦘' : ''}${c.magnetTime > 0 ? '🧲' : ''}${c.slowTime > 0 ? '⏳' : ''}`;
      const statsKey = `${c.maxBombs}|${c.range}|${c.speedMult.toFixed(2)}`;
      if (this.cache[`ms${c.id}`] !== statsKey) {
        this.cache[`ms${c.id}`] = statsKey;
        x.stats.innerHTML = `<span>${x.ico('bomb')}${c.maxBombs}</span><span>${x.ico('range')}${c.range}</span><span>${x.ico('speed')}${c.speedMult.toFixed(1)}x</span>`;
      }
      this.set(x.effects, `fx${c.id}`, icons);
      this.set(x.scoreEl, `sc${c.id}`, c.score.toLocaleString());
    }

    const p = g.player;
    // 활성 아이템 효과
    const fx = [];
    if (p.shieldTime > 0) fx.push(['shield', `${this.img('shield')} 방어막 ${Math.ceil(p.shieldTime)}s`]);
    if (p.lives > 0) fx.push(['life', `${this.img('life')} 생명 +${p.lives}`]);
    if (p.jumpTime > 0) fx.push(['jump', `${this.img('jump')} 점프 ${Math.ceil(p.jumpTime)}s`]);
    if (p.magnetTime > 0) fx.push(['magnet', `${this.img('magnet')} 자석 ${Math.ceil(p.magnetTime)}s`]);
    if (p.slowTime > 0) fx.push(['slow bad', `${this.img('slow')} 느려짐 ${Math.ceil(p.slowTime)}s`]);
    const fxKey = fx.map((f) => f[1]).join('|');
    if (this.cache.fx !== fxKey) {
      this.cache.fx = fxKey;
      this.effectChips.innerHTML = fx.map(([k, t]) => `<span class="fx-chip ${k}">${t}</span>`).join('');
    }
    this.pips(this.bombIcons, 'b', p.bombsLeft, p.maxBombs, 'bomb');
    this.pips(this.rangeIcons, 'r', p.range, CONFIG.RANGE_MAX, 'range');
    const maxLv = Math.round((CONFIG.SPEED_MAX_MULT - 1) / CONFIG.SPEED_STEP);
    this.pips(this.speedIcons, 's', p.speedLevel + 1, maxLv + 1, 'speed');
    this.set(this.bombVal, 'bv', `${p.bombsLeft} / ${p.maxBombs}`);
    this.set(this.rangeVal, 'rv', `${p.range} / ${CONFIG.RANGE_MAX}`);
    this.set(this.speedVal, 'sv', `${p.speedMult.toFixed(1)}x`);
    this.set(this.remoteVal, 'remv', p.remoteCharges > 0 ? `Ready ×${p.remoteCharges}` : '없음');
    this.remoteSlot.classList.toggle('ready', p.remoteCharges > 0);
    this.touch.refresh(p);
  }
}
