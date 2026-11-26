import { el, avatar } from './dom.js';
import { CONFIG } from '../core/Config.js';
import { STATE } from '../characters/Character.js';
import { PERSONALITY_LABEL, MAP_ICON } from './components.js';
import { ITEM_DEFS } from '../systems/items/itemDefs.js';

const STATUS_TEXT = { alive: '생존', trapped: '갇힘!', dead: '탈락' };

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
    this.score = el('div', { class: 'score-value', text: '0' });
    this.aliveCount = el('div', { class: 'alive-value', text: '4' });
    this.aliveTotal = el('span', { text: '/4' });
    this.meAvatar = el('div', { class: 'me-avatar' });
    this.pauseBtn = el('button', {
      class: 'pause-btn', 'aria-label': '일시정지', html: '<span></span><span></span>',
      onclick: () => { game.audio.play('click'); game.pause(); },
    });
    this.cardsBox = el('div', { class: 'cards' });
    this.mapChip = el('div', { class: 'map-chip' });
    this.netChip = el('div', { class: 'net-chip hidden' });

    this.bombIcons = el('div', { class: 'pips' });
    this.rangeIcons = el('div', { class: 'pips' });
    this.speedIcons = el('div', { class: 'pips' });
    this.feed = el('div', { class: 'feed' });
    this.effectChips = el('div', { class: 'effect-chips' });

    this.root = el('div', { class: 'screen hud' }, [
      el('div', { class: 'hud-top' }, [
        el('div', { class: 'hud-left' }, [
          el('div', { class: 'panel hud-score' }, [
            this.meAvatar,
            el('div', {}, [el('small', { text: 'SCORE' }), this.score]),
            el('div', { class: 'divider' }),
            el('div', {}, [el('small', { text: '생존' }), el('div', { class: 'alive-wrap' }, [this.aliveCount, this.aliveTotal])]),
          ]),
          this.mapChip,
          this.netChip,
        ]),
        el('div', { class: 'panel hud-timer' }, [el('span', { class: 'clock' }), this.timer]),
        el('div', { class: 'hud-right' }, [this.cardsBox, this.pauseBtn]),
      ]),
      el('div', { class: 'hud-bottom' }, [
        el('div', { class: 'panel controls-hint' }, [
          el('div', { html: '<kbd>WASD</kbd> / <kbd>방향키</kbd> 이동' }),
          el('div', { html: '<kbd>SPACE</kbd> 물풍선' }),
          el('div', { html: '<kbd>E</kbd> / <kbd>Shift</kbd> 원격 폭발' }),
          el('div', { html: '<kbd>ESC</kbd> 메뉴' }),
        ]),
        this.effectChips,
        el('div', { class: 'panel player-stats' }, [
          el('div', { class: 'stat stat-bomb' }, [el('img', { class: 'stat-img', src: game.itemView.iconURL('bomb'), alt: '' }), el('small', { text: '물풍선' }), this.bombIcons]),
          el('div', { class: 'stat stat-range' }, [el('img', { class: 'stat-img', src: game.itemView.iconURL('range'), alt: '' }), el('small', { text: '물줄기' }), this.rangeIcons]),
          el('div', { class: 'stat stat-speed' }, [el('img', { class: 'stat-img', src: game.itemView.iconURL('speed'), alt: '' }), el('small', { text: '스피드' }), this.speedIcons]),
        ]),
      ]),
      this.feed,
    ]);

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
    b.on('itemRemoved', ({ item, by }) => {
      if (by && by.isPlayer) {
        const d = ITEM_DEFS[item.type];
        if (d) this.toast(`${this.img(item.type)} ${d.name}${d.basic ? '' : ` — ${d.desc}`}`, 'item');
      }
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
    while (this.feed.children.length > 5) this.feed.lastChild.remove();
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3100);
  }

  /** 경기마다 참가자 구성이 달라지므로 카드 재생성 */
  rebuild() {
    const g = this.game;
    this.builtFor = g.characters;
    this.cache = {};
    this.feed.innerHTML = '';
    this.meAvatar.innerHTML = '';
    this.meAvatar.append(avatar(g.player.def, 44));
    this.aliveTotal.textContent = `/${g.characters.length}`;
    const def = g.mapDef;
    this.mapChip.textContent = `${MAP_ICON[def.id] || ''} ${def.name} · ${def.effectText}`;
    this.mapChip.className = `map-chip panel${g.mode === 'practice' ? ' practice' : ''}`;
    this.cardsBox.innerHTML = '';
    this.cards = g.characters.map((c) => {
      const status = el('span', { class: 'status' });
      const stats = el('div', { class: 'mini-stats' });
      const label = el('small');
      const card = el('div', { class: `char-card${c.isPlayer ? ' me' : ''}`, style: { '--c': c.def.css } }, [
        avatar(c.def, 36),
        el('div', { class: 'card-info' }, [
          el('div', { class: 'card-top' }, [el('b', { text: c.name }), label]),
          el('div', { class: 'card-bottom' }, [status, stats]),
        ]),
        el('div', { class: 'trap-bar' }, [el('i')]),
      ]);
      this.cardsBox.append(card);
      return { c, card, status, stats, label, bar: card.querySelector('.trap-bar i') };
    });
  }

  onShow() {
    if (this.builtFor !== this.game.characters) this.rebuild();
    this.refresh();
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
      this.set(x.stats, `ms${c.id}`, `💧${c.maxBombs} 🌊${c.range} 👟${c.speedMult.toFixed(2).replace(/0$/, '')}x · ${c.score} ${icons}`);
    }

    const p = g.player;
    // 활성 아이템 효과
    const fx = [];
    if (p.shieldTime > 0) fx.push(['shield', `${this.img('shield')} 방어막 ${Math.ceil(p.shieldTime)}s`]);
    if (p.remoteCharges > 0) fx.push(['remote', `${this.img('remote')} 원격 ×${p.remoteCharges} <kbd>E</kbd>`]);
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
  }
}
