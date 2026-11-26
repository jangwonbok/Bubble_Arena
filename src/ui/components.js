import { el, avatar } from './dom.js';
import { MAPS } from '../maps/index.js';
import { MapGrid } from '../map/MapGrid.js';
import { createRng } from '../core/rng.js';
import { TILE, TERRAIN } from '../core/Config.js';
import { CHARACTER_DEFS } from '../characters/characterDefs.js';

const MAP_ICON = { meadow: '🌿', ice: '❄️', volcano: '🌋', beach: '🌊', candy: '🍭', sky: '☁️' };
const previewCache = new Map();

/** 맵 정의로부터 실제 레이아웃을 생성해 미리보기 이미지를 그린다 */
export function mapPreview(def) {
  if (previewCache.has(def.id)) return previewCache.get(def.id);
  const grid = new MapGrid(def.size);
  grid.generate(def, createRng(42));
  const P = def.visual.preview;
  const s = 12;
  const c = document.createElement('canvas');
  c.width = c.height = grid.size * s;
  const ctx = c.getContext('2d');
  const terrainColor = { [TERRAIN.ICE]: P.ice, [TERRAIN.BOOST]: P.boost, [TERRAIN.JELLY]: P.jelly, [TERRAIN.LAVA]: P.lava };
  for (let z = 0; z < grid.size; z++) {
    for (let x = 0; x < grid.size; x++) {
      const t = grid.get(x, z);
      const tr = grid.terrainAt(x, z);
      let col = (x + z) % 2 ? P.alt : P.floor;
      if (tr) col = terrainColor[tr] || P.conv || col;
      if (t === TILE.WALL) col = P.wall;
      if (t === TILE.PIT) col = P.pit || '#000';
      ctx.fillStyle = col;
      ctx.fillRect(x * s, z * s, s, s);
      if (t === TILE.PILLAR) {
        ctx.fillStyle = P.pillar;
        ctx.beginPath();
        ctx.roundRect(x * s + 1.5, z * s + 1.5, s - 3, s - 3, 3);
        ctx.fill();
      } else if (t === TILE.BLOCK) {
        ctx.fillStyle = P.block;
        ctx.fillRect(x * s + 2, z * s + 2, s - 4, s - 4);
        ctx.strokeStyle = 'rgba(0,0,0,0.18)';
        ctx.strokeRect(x * s + 2.5, z * s + 2.5, s - 5, s - 5);
      } else if (t === TILE.PUSH) {
        ctx.fillStyle = P.push || '#3d8bff';
        ctx.beginPath();
        ctx.roundRect(x * s + 2, z * s + 2, s - 4, s - 4, 3);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(x * s + 3, z * s + s / 2 - 1, s - 6, 2);
      } else if (tr >= TERRAIN.CONV_E && tr <= TERRAIN.CONV_N && t === TILE.EMPTY) {
        ctx.fillStyle = '#fff';
        ctx.font = `${s - 2}px sans-serif`;
        ctx.fillText(tr === TERRAIN.CONV_E ? '›' : '‹', x * s + 3, z * s + s - 2);
      }
    }
  }
  // 이동형 발판 (트랙 중앙에 표시)
  for (const e of (def.effects || []).filter((ef) => ef.type === 'platform')) {
    const [x, z] = e.track[Math.floor(e.track.length / 2)];
    ctx.fillStyle = P.plat || '#ffd86b';
    ctx.fillRect(x * s + 1, z * s + 1, s - 2, s - 2);
  }
  // 시작 위치
  const cols = ['#3d8bff', '#ff4d5e', '#36c96b', '#ffb81f'];
  grid.spawns.map((p) => [p.x, p.z]).forEach(([x, z], i) => {
    ctx.fillStyle = cols[i];
    ctx.beginPath();
    ctx.arc(x * s + s / 2, z * s + s / 2, s * 0.38, 0, Math.PI * 2);
    ctx.fill();
  });
  const url = c.toDataURL();
  previewCache.set(def.id, url);
  return url;
}

/**
 * 맵 카드 목록 렌더링
 * opts: { selected, votes, myVote, onPick(id), mode: 'select'|'vote'|'view' }
 */
export function renderMapCards(container, opts) {
  container.innerHTML = '';
  container.classList.add('map-cards');
  const cards = [...MAPS.map((m) => m.id), 'random'];
  for (const id of cards) {
    const def = MAPS.find((m) => m.id === id);
    const votes = opts.votes?.[id] || 0;
    const card = el(
      'button',
      {
        class: `map-card${opts.selected === id ? ' selected' : ''}${opts.myVote === id ? ' voted' : ''}${opts.mode === 'view' ? ' readonly' : ''}`,
        title: def ? def.description : '6개 맵 중 무작위',
        onclick: () => opts.mode !== 'view' && opts.onPick?.(id),
      },
      [
        def
          ? el('img', { class: 'map-thumb', src: mapPreview(def), alt: def.name })
          : el('div', { class: 'map-thumb random-thumb', text: '?' }),
        el('div', { class: 'map-info' }, [
          el('b', { text: `${MAP_ICON[id] || '🎲'} ${def ? def.name : '랜덤 맵'}` }),
          el('small', { text: def ? def.effectText : '시작할 때 무작위로 결정' }),
        ]),
        votes ? el('span', { class: 'vote-badge', text: `🗳 ${votes}` }) : null,
      ],
    );
    container.append(card);
  }
}

/** 캐릭터 선택 */
export function renderCharPicker(container, { selected, taken = new Set(), onPick }) {
  container.innerHTML = '';
  container.classList.add('char-picker');
  for (const d of CHARACTER_DEFS) {
    const isTaken = taken.has(d.id) && d.id !== selected;
    container.append(
      el(
        'button',
        {
          class: `char-pick${d.id === selected ? ' selected' : ''}${isTaken ? ' taken' : ''}`,
          style: { '--c': d.css },
          title: isTaken ? '다른 플레이어가 선택함' : d.name,
          onclick: () => !isTaken && onPick(d.id),
        },
        [avatar(d, 44), el('span', { text: d.name })],
      ),
    );
  }
}

export const PERSONALITY_LABEL = { aggressive: '공격형', balanced: '균형형', survival: '생존형' };
export { MAP_ICON };
