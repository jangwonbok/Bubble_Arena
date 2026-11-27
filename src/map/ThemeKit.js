import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TERRAIN, CONFIG } from '../core/Config.js';

// 맵 테마별 3D 구성요소 (텍스처·장애물·블록·배경). 모두 캐시되어 재사용된다.
// 새 테마 추가: 아래 각 사전(FLOOR_TEX, WALL, PILLARS, BLOCKS, SCENERY)에 항목을 추가.

const cache = new Map();
const once = (key, fn) => {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
};

function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function canvasTex(size, draw, { repeat = 1, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat !== 1) t.repeat.set(repeat, repeat);
  return t;
}

const speckle = (ctx, s, n, r, colorFn, seed) => {
  const rnd = seeded(seed);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colorFn(rnd);
    ctx.beginPath();
    ctx.arc(rnd() * s, rnd() * s, r[0] + rnd() * (r[1] - r[0]), 0, Math.PI * 2);
    ctx.fill();
  }
};

const edgeShade = (ctx, s) => {
  const g = ctx.createLinearGradient(0, 0, 0, s);
  g.addColorStop(0, 'rgba(255,255,255,0.2)');
  g.addColorStop(0.1, 'rgba(255,255,255,0)');
  g.addColorStop(0.9, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.15)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
};

// ---------------- 바닥 텍스처 (흰 바탕 → 인스턴스 색으로 틴트) ----------------
const FLOOR_TEX = {
  grass: (ctx, s) => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, 700, [1, 3], (r) => `rgba(200,200,200,${0.4 + r() * 0.4})`, 7);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    const rnd = seeded(3);
    for (let i = 0; i < 40; i++) {
      const x = rnd() * s, y = rnd() * s;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 2, y - 6, x + 4 * (rnd() - 0.5), y - 11);
      ctx.stroke();
    }
    edgeShade(ctx, s);
  },
  snow: (ctx, s) => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, 300, [2, 7], (r) => `rgba(205,222,245,${0.3 + r() * 0.3})`, 11);
    speckle(ctx, s, 80, [1, 2], () => 'rgba(255,255,255,1)', 12);
    edgeShade(ctx, s);
  },
  rock: (ctx, s) => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, 500, [2, 8], (r) => `rgba(150,140,140,${0.3 + r() * 0.4})`, 21);
    ctx.strokeStyle = 'rgba(255,120,40,0.75)';
    ctx.lineWidth = 3;
    const rnd = seeded(8);
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      let x = rnd() * s, y = rnd() * s;
      ctx.moveTo(x, y);
      for (let i = 0; i < 4; i++) ctx.lineTo((x += (rnd() - 0.5) * 70), (y += (rnd() - 0.5) * 70));
      ctx.stroke();
    }
    edgeShade(ctx, s);
  },
  sand: (ctx, s) => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, 1400, [0.6, 1.8], (r) => `rgba(190,160,110,${0.25 + r() * 0.35})`, 31);
    ctx.strokeStyle = 'rgba(220,190,140,0.5)';
    ctx.lineWidth = 3;
    for (let y = 20; y < s; y += 46) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(s * 0.3, y - 10, s * 0.6, y + 10, s, y);
      ctx.stroke();
    }
    edgeShade(ctx, s);
  },
  candy: (ctx, s) => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, s, s);
    const cols = ['#ff7fb0', '#7fd6ff', '#ffe27a', '#9be89b', '#c59bff'];
    const rnd = seeded(41);
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = cols[i % cols.length];
      ctx.save();
      ctx.translate(rnd() * s, rnd() * s);
      ctx.rotate(rnd() * Math.PI);
      ctx.fillRect(-7, -2.5, 14, 5);
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, s - 12, s - 12);
  },
  cloud: (ctx, s) => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, 60, [10, 30], () => 'rgba(225,235,252,0.35)', 51);
    ctx.strokeStyle = 'rgba(180,200,235,0.6)';
    ctx.lineWidth = 6;
    ctx.strokeRect(5, 5, s - 10, s - 10);
  },
  // 갑판 / 다리 판자 (가로 판자 3장 + 못)
  deck: (ctx, s) => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, s, s);
    const rnd = seeded(91);
    const h = s / 3;
    for (let i = 0; i < 3; i++) {
      const y = i * h;
      ctx.fillStyle = `rgba(150,110,70,${0.06 + rnd() * 0.08})`;
      ctx.fillRect(0, y, s, h);
      ctx.strokeStyle = 'rgba(120,80,40,0.22)';
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 4; k++) {
        const yy = y + 10 + rnd() * (h - 20);
        ctx.beginPath(); ctx.moveTo(0, yy); ctx.bezierCurveTo(s * 0.3, yy + 4, s * 0.7, yy - 4, s, yy); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(90,55,25,0.55)';
      ctx.fillRect(0, y, s, 4);
      ctx.fillStyle = 'rgba(80,80,90,0.6)';
      for (const x of [14, s - 14]) { ctx.beginPath(); ctx.arc(x, y + h / 2, 3.5, 0, 7); ctx.fill(); }
    }
  },
  // 파스텔 체크 타일 (모서리 둥근 줄눈 + 하이라이트)
  checker: (ctx, s) => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, s - 10, s - 10);
    ctx.strokeStyle = 'rgba(200,150,170,0.25)';
    ctx.lineWidth = 3;
    ctx.strokeRect(12, 12, s - 24, s - 24);
    speckle(ctx, s, 16, [2, 4], () => 'rgba(255,255,255,0.8)', 93);
  },
};

export function floorTexture(style) {
  return once(`floor:${style}`, () => canvasTex(256, FLOOR_TEX[style] || FLOOR_TEX.grass));
}

// ---------------- 공용 표면 텍스처 ----------------
const tex = {
  stone: () =>
    canvasTex(256, (ctx, s) => {
      ctx.fillStyle = '#c9ced6';
      ctx.fillRect(0, 0, s, s);
      speckle(ctx, s, 500, [2, 6], (r) => { const v = 175 + Math.floor(r() * 50); return `rgba(${v},${v + 3},${v + 10},0.6)`; }, 21);
      ctx.strokeStyle = 'rgba(110,118,132,0.55)';
      ctx.lineWidth = 3;
      [[30, 40, 120, 60], [150, 190, 230, 200], [170, 40, 220, 100]].forEach(([a, b, c, d]) => {
        ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo((a + c) / 2 + 10, (b + d) / 2 + 12); ctx.lineTo(c, d); ctx.stroke();
      });
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 6;
      ctx.strokeRect(6, 6, s - 12, s - 12);
    }),
  basalt: () =>
    canvasTex(256, (ctx, s) => {
      ctx.fillStyle = '#3b3236';
      ctx.fillRect(0, 0, s, s);
      speckle(ctx, s, 400, [2, 7], (r) => `rgba(${70 + r() * 30},${60 + r() * 20},${62 + r() * 20},0.7)`, 22);
      ctx.strokeStyle = '#ff7a22';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      const rnd = seeded(5);
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        let x = rnd() * s, y = rnd() * s;
        ctx.moveTo(x, y);
        for (let i = 0; i < 4; i++) ctx.lineTo((x += (rnd() - 0.5) * 80), (y += (rnd() - 0.5) * 80));
        ctx.stroke();
      }
    }),
  basaltGlow: () =>
    canvasTex(256, (ctx, s) => {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = '#ff6a10';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      const rnd = seeded(5);
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        let x = rnd() * s, y = rnd() * s;
        ctx.moveTo(x, y);
        for (let i = 0; i < 4; i++) ctx.lineTo((x += (rnd() - 0.5) * 80), (y += (rnd() - 0.5) * 80));
        ctx.stroke();
      }
    }),
  wood: () =>
    canvasTex(256, (ctx, s) => {
      const rnd = seeded(5);
      for (let i = 0; i < 4; i++) {
        const y = (i * s) / 4;
        ctx.fillStyle = i % 2 ? '#eb9632' : '#f4a944';
        ctx.fillRect(0, y, s, s / 4);
        ctx.strokeStyle = 'rgba(150,75,10,0.25)';
        ctx.lineWidth = 1.5;
        for (let k = 0; k < 5; k++) {
          const yy = y + 8 + rnd() * (s / 4 - 16);
          ctx.beginPath(); ctx.moveTo(0, yy); ctx.bezierCurveTo(s * 0.3, yy + 3, s * 0.6, yy - 3, s, yy); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(120,55,5,0.45)';
        ctx.fillRect(0, y, s, 3);
      }
    }),
  stripes: () =>
    canvasTex(128, (ctx, s) => {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#ff3f6e';
      for (let i = -s; i < s * 2; i += 32) {
        ctx.beginPath();
        ctx.moveTo(i, 0); ctx.lineTo(i + 16, 0); ctx.lineTo(i + 16 + s, s); ctx.lineTo(i + s, s);
        ctx.fill();
      }
    }),
  choco: () =>
    canvasTex(128, (ctx, s) => {
      ctx.fillStyle = '#7a4526';
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = '#5a2f17';
      ctx.lineWidth = 6;
      for (let i = 0; i <= s; i += s / 2) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, s); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(s, i); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,220,190,0.25)';
      ctx.lineWidth = 3;
      for (let i = 4; i <= s; i += s / 2) {
        ctx.beginPath(); ctx.moveTo(i, 4); ctx.lineTo(i, s); ctx.stroke();
      }
    }),
  biscuit: () =>
    canvasTex(128, (ctx, s) => {
      ctx.fillStyle = '#e8b070';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#b97a3a';
      for (let y = 16; y < s; y += 32) for (let x = 16; x < s; x += 32) { ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); }
    }),
  arrows: () =>
    canvasTex(128, (ctx, s) => {
      ctx.fillStyle = '#9fd8ff';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#ffffff';
      for (let k = 0; k < 2; k++) {
        const x0 = k * 64 + 14;
        ctx.beginPath();
        ctx.moveTo(x0, 30); ctx.lineTo(x0 + 26, 64); ctx.lineTo(x0, 98); ctx.lineTo(x0 + 14, 98); ctx.lineTo(x0 + 40, 64); ctx.lineTo(x0 + 14, 30);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(40,120,220,0.25)';
      ctx.fillRect(0, 0, s, 8);
      ctx.fillRect(0, s - 8, s, 8);
    }),
  boost: () =>
    canvasTex(128, (ctx, s) => {
      ctx.fillStyle = '#ffe36a';
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = '#ff6fa5';
      for (let i = -s; i < s * 2; i += 28) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 14, 0); ctx.lineTo(i + 14 + s, s); ctx.lineTo(i + s, s); ctx.fill();
      }
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 14 : 30;
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        ctx.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
      }
      ctx.fill();
    }),
  lava: () =>
    canvasTex(128, (ctx, s) => {
      const g = ctx.createRadialGradient(64, 64, 10, 64, 64, 90);
      g.addColorStop(0, '#fff0a0');
      g.addColorStop(0.4, '#ff9a20');
      g.addColorStop(1, '#d8360a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      speckle(ctx, s, 30, [4, 10], () => 'rgba(255,240,170,0.6)', 61);
    }),
  marble: () =>
    canvasTex(256, (ctx, s) => {
      ctx.fillStyle = '#f4f7fc';
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = 'rgba(180,195,225,0.6)';
      ctx.lineWidth = 2;
      const rnd = seeded(71);
      for (let k = 0; k < 6; k++) {
        ctx.beginPath();
        let x = rnd() * s, y = 0;
        ctx.moveTo(x, y);
        while (y < s) ctx.lineTo((x += (rnd() - 0.5) * 40), (y += 20));
        ctx.stroke();
      }
    }),
  water: () =>
    canvasTex(256, (ctx, s) => {
      const g = ctx.createLinearGradient(0, 0, s, s);
      g.addColorStop(0, '#36b6ef');
      g.addColorStop(1, '#1f8fd6');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      const rnd = seeded(97);
      for (let k = 0; k < 14; k++) {
        const x = rnd() * s, y = rnd() * s, w = 18 + rnd() * 24;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + w / 2, y - 6, x + w, y);
        ctx.stroke();
      }
      speckle(ctx, s, 24, [1.5, 3], () => 'rgba(255,255,255,0.7)', 98);
    }),
  hull: () =>
    canvasTex(128, (ctx, s) => {
      ctx.fillStyle = '#7a4a2a';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 2 ? '#6a3e22' : '#84512e';
        ctx.fillRect(0, (i * s) / 4, s, s / 4 - 3);
      }
      ctx.fillStyle = '#d9a84a';
      ctx.fillRect(0, s - 14, s, 6); // 금색 띠
    }),
  brick: () =>
    canvasTex(128, (ctx, s) => {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = 'rgba(200,120,150,0.45)';
      ctx.lineWidth = 3;
      for (let r = 0; r < 4; r++) {
        const y = (r * s) / 4;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke();
        for (let x = (r % 2) * 32; x < s; x += 64) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + s / 4); ctx.stroke(); }
      }
    }),
};
const T = (name) => once(`tex:${name}`, tex[name]);

const geo = {
  rbox: (w, h, d, r = 0.1) => once(`rbox:${w}:${h}:${d}:${r}`, () => new RoundedBoxGeometry(w, h, d, 3, r)),
  sphere: () => once('sphere', () => new THREE.SphereGeometry(1, 20, 14)),
  ico: () => once('ico', () => new THREE.IcosahedronGeometry(1, 1)),
  cyl: () => once('cyl', () => new THREE.CylinderGeometry(1, 1, 1, 20)),
  cone: () => once('cone', () => new THREE.ConeGeometry(1, 1, 16)),
  octa: () => once('octa', () => new THREE.OctahedronGeometry(1, 0)),
  torus: () => once('torus', () => new THREE.TorusGeometry(1, 0.35, 10, 24)),
};
const std = (key, params) => once(`mat:${key}`, () => new THREE.MeshStandardMaterial(params));

const M = (pos = [0, 0, 0], scale = [1, 1, 1], rot = [0, 0, 0]) =>
  new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale));

// ---------------- 외곽 벽 ----------------
export function wallMaterial(style, color) {
  switch (style) {
    case 'ice': return std('wall:ice', { color: 0xcfe8ff, roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.92 });
    case 'basalt': return std('wall:basalt', { map: T('basalt'), emissiveMap: T('basaltGlow'), emissive: 0xff6a10, emissiveIntensity: 0.9, roughness: 0.9 });
    case 'driftwood': return std('wall:drift', { map: T('wood'), color: 0xd8b088, roughness: 0.9 });
    case 'biscuit': return std('wall:biscuit', { map: T('biscuit'), roughness: 0.8 });
    case 'cloudstone': return std('wall:marble', { map: T('marble'), color, roughness: 0.5 });
    case 'hull': return std('wall:hull', { map: T('hull'), roughness: 0.8 });
    case 'rockwall': return std('wall:rockwall', { map: T('stone'), color: 0xb7a996, roughness: 0.95 });
    case 'castle': return std(`wall:castle:${color}`, { map: T('brick'), color: color ?? 0xffc2d6, roughness: 0.6 });
    default: return std(`wall:stone:${color}`, { map: T('stone'), color, roughness: 0.9 });
  }
}

// ---------------- 고정 장애물 (인스턴싱용 파츠 목록) ----------------
const PILLARS = {
  stone: () => [{ geo: geo.rbox(0.92, 0.9, 0.92, 0.12), mat: std('p:stone', { map: T('stone'), roughness: 0.85 }), m: M([0, 0.45, 0]) }],
  iceCrystal: () => [
    { geo: geo.rbox(0.9, 0.5, 0.9, 0.1), mat: std('p:icebase', { color: 0xdff1ff, roughness: 0.2 }), m: M([0, 0.25, 0]) },
    { geo: geo.octa(), mat: std('p:crystal', { color: 0x8fd4ff, emissive: 0x2a7fd0, emissiveIntensity: 0.4, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.88 }), m: M([0, 0.85, 0], [0.32, 0.55, 0.32]) },
    { geo: geo.octa(), mat: std('p:crystal2', { color: 0xc8ecff, emissive: 0x4a9fe0, emissiveIntensity: 0.3, roughness: 0.05, transparent: true, opacity: 0.85 }), m: M([0.22, 0.65, 0.15], [0.14, 0.3, 0.14], [0, 0, -0.4]) },
  ],
  basalt: () => [
    { geo: geo.rbox(0.92, 1.0, 0.92, 0.08), mat: wallMaterial('basalt'), m: M([0, 0.5, 0]) },
    { geo: geo.cone(), mat: std('p:basaltTop', { color: 0x2e2629, roughness: 0.9, flatShading: true }), m: M([0, 1.12, 0], [0.32, 0.28, 0.32]) },
  ],
  palm: () => [
    { geo: geo.sphere(), mat: std('p:sandmound', { color: 0xf1d898, roughness: 1 }), m: M([0, 0.02, 0], [0.45, 0.16, 0.45]) },
    { geo: geo.cyl(), mat: std('p:trunk', { color: 0xa8743e, roughness: 0.9 }), m: M([0.03, 0.55, 0], [0.09, 1.1, 0.09], [0, 0, -0.06]) },
    { geo: geo.torus(), mat: std('p:trunkRing', { color: 0x8a5c2e, roughness: 1 }), m: M([0.02, 0.35, 0], [0.1, 0.1, 0.1], [Math.PI / 2, 0, 0]) },
    { geo: geo.torus(), mat: std('p:trunkRing', { color: 0x8a5c2e, roughness: 1 }), m: M([0.04, 0.75, 0], [0.095, 0.095, 0.1], [Math.PI / 2, 0, 0]) },
    ...[0, 1, 2, 3, 4].map((k) => ({
      geo: geo.sphere(),
      mat: std('p:frond', { color: 0x3fae4a, roughness: 0.7, flatShading: true }),
      m: M([0.06 + Math.cos((k / 5) * Math.PI * 2) * 0.3, 1.12, Math.sin((k / 5) * Math.PI * 2) * 0.3], [0.38, 0.05, 0.13], [0, -(k / 5) * Math.PI * 2, -0.35]),
    })),
    { geo: geo.sphere(), mat: std('p:coco', { color: 0x6b4423, roughness: 0.8 }), m: M([0.12, 1.04, 0.06], [0.07, 0.07, 0.07]) },
    { geo: geo.sphere(), mat: std('p:coco', { color: 0x6b4423, roughness: 0.8 }), m: M([-0.02, 1.03, 0.1], [0.07, 0.07, 0.07]) },
  ],
  candyCane: () => [
    { geo: geo.rbox(0.9, 0.22, 0.9, 0.08), mat: std('p:candybase', { color: 0xffffff, roughness: 0.4 }), m: M([0, 0.11, 0]) },
    { geo: geo.cyl(), mat: std('p:cane', { map: T('stripes'), roughness: 0.25 }), m: M([0, 0.6, 0], [0.26, 0.85, 0.26]) },
    { geo: geo.sphere(), mat: std('p:caneTop', { color: 0xff3f6e, roughness: 0.25 }), m: M([0, 1.05, 0], [0.3, 0.16, 0.3]) },
    { geo: geo.sphere(), mat: std('p:cherry', { color: 0xff2040, roughness: 0.15, emissive: 0x400010 }), m: M([0, 1.24, 0], [0.11, 0.11, 0.11]) },
  ],
  tree: () => [
    { geo: geo.cyl(), mat: std('p:treetrunk', { color: 0x9a6538, roughness: 0.9 }), m: M([0, 0.35, 0], [0.12, 0.7, 0.12]) },
    { geo: geo.ico(), mat: std('p:treeleaf', { color: 0x46b84a, roughness: 0.8, flatShading: true }), m: M([0, 0.95, 0], [0.48, 0.45, 0.48]) },
    { geo: geo.ico(), mat: std('p:treeleaf2', { color: 0x5fcf5a, roughness: 0.8, flatShading: true }), m: M([0.15, 1.25, 0.05], [0.3, 0.28, 0.3]) },
    { geo: geo.sphere(), mat: std('p:apple', { color: 0xff4a5a, roughness: 0.4 }), m: M([0.3, 0.9, 0.25], [0.07, 0.07, 0.07]) },
  ],
  snowman: () => [
    { geo: geo.sphere(), mat: std('p:snowbody', { color: 0xffffff, roughness: 0.7 }), m: M([0, 0.32, 0], [0.38, 0.34, 0.38]) },
    { geo: geo.sphere(), mat: std('p:snowbody', {}), m: M([0, 0.8, 0], [0.26, 0.25, 0.26]) },
    { geo: geo.cone(), mat: std('p:carrot', { color: 0xff8a1a, roughness: 0.5 }), m: M([0, 0.8, 0.3], [0.05, 0.2, 0.05], [Math.PI / 2, 0, 0]) },
    { geo: geo.sphere(), mat: std('p:coal', { color: 0x1d1a2b }), m: M([-0.09, 0.88, 0.22], [0.035, 0.035, 0.035]) },
    { geo: geo.sphere(), mat: std('p:coal', {}), m: M([0.09, 0.88, 0.22], [0.035, 0.035, 0.035]) },
    { geo: geo.cyl(), mat: std('p:scarf', { color: 0xff4d5e, roughness: 0.6 }), m: M([0, 0.6, 0], [0.24, 0.07, 0.24]) },
    { geo: geo.cyl(), mat: std('p:hat', { color: 0x2a3a6a, roughness: 0.5 }), m: M([0, 1.12, 0], [0.17, 0.2, 0.17]) },
    { geo: geo.cyl(), mat: std('p:hat', {}), m: M([0, 1.03, 0], [0.26, 0.03, 0.26]) },
  ],
  vent: () => [
    { geo: geo.cone(), mat: std('p:vent', { color: 0x3a2e36, roughness: 0.9, flatShading: true }), m: M([0, 0.45, 0], [0.46, 0.9, 0.46]) },
    { geo: geo.sphere(), mat: std('p:ventlava', { color: 0xffa040, emissive: 0xff5a00, emissiveIntensity: 1.5 }), m: M([0, 0.88, 0], [0.13, 0.06, 0.13]) },
  ],
  beachRock: () => [
    { geo: geo.ico(), mat: std('p:brock', { color: 0x9a8f86, roughness: 0.9, flatShading: true }), m: M([0, 0.35, 0], [0.46, 0.4, 0.44]) },
    { geo: geo.ico(), mat: std('p:brock2', { color: 0xb3a89e, roughness: 0.9, flatShading: true }), m: M([0.2, 0.62, 0.1], [0.22, 0.22, 0.22]) },
    { geo: geo.sphere(), mat: std('p:star', { color: 0xff8a6a, roughness: 0.6 }), m: M([-0.2, 0.7, 0.25], [0.09, 0.03, 0.09]) },
  ],
  cupcake: () => [
    { geo: geo.cyl(), mat: std('p:cupwrap', { map: T('stripes'), color: 0x9fd8ff, roughness: 0.5 }), m: M([0, 0.25, 0], [0.36, 0.5, 0.36]) },
    { geo: geo.sphere(), mat: std('p:frost', { color: 0xffb3d9, roughness: 0.3 }), m: M([0, 0.6, 0], [0.42, 0.28, 0.42]) },
    { geo: geo.sphere(), mat: std('p:frost2', { color: 0xfff0f6, roughness: 0.3 }), m: M([0, 0.82, 0], [0.26, 0.18, 0.26]) },
    { geo: geo.sphere(), mat: std('p:cherry', { color: 0xff2040, roughness: 0.15, emissive: 0x400010 }), m: M([0, 1.0, 0], [0.09, 0.09, 0.09]) },
  ],
  cloudPillar: () => [
    { geo: geo.rbox(0.9, 0.16, 0.9, 0.05), mat: std('p:goldbase', { color: 0xffd86b, roughness: 0.35, metalness: 0.4 }), m: M([0, 0.08, 0]) },
    { geo: geo.cyl(), mat: std('p:column', { map: T('marble'), roughness: 0.4 }), m: M([0, 0.55, 0], [0.3, 0.8, 0.3]) },
    { geo: geo.rbox(0.8, 0.16, 0.8, 0.05), mat: std('p:goldbase', { color: 0xffd86b, roughness: 0.35, metalness: 0.4 }), m: M([0, 1.0, 0]) },
  ],

  // ---- 해적섬 ----
  barrelStack: () => [
    ...[[-0.2, -0.18], [0.2, -0.18], [0, 0.2]].map(([x, z]) => ({
      geo: geo.cyl(), mat: std('p:barrel', { map: T('wood'), color: 0xc07a48, roughness: 0.8 }), m: M([x, 0.28, z], [0.2, 0.56, 0.2]),
    })),
    ...[[-0.2, -0.18], [0.2, -0.18], [0, 0.2]].map(([x, z]) => ({
      geo: geo.torus(), mat: std('p:hoop', { color: 0x5a6070, metalness: 0.5, roughness: 0.4 }), m: M([x, 0.44, z], [0.2, 0.2, 0.08], [Math.PI / 2, 0, 0]),
    })),
    { geo: geo.cyl(), mat: std('p:barrel', {}), m: M([0, 0.82, -0.02], [0.2, 0.5, 0.2]) },
    { geo: geo.torus(), mat: std('p:hoop', {}), m: M([0, 0.95, -0.02], [0.2, 0.2, 0.08], [Math.PI / 2, 0, 0]) },
  ],
  cannon: () => [
    { geo: geo.rbox(0.8, 0.26, 0.6, 0.06), mat: std('p:carriage', { map: T('wood'), color: 0x9a5a30, roughness: 0.8 }), m: M([0, 0.2, 0]) },
    ...[-1, 1].map((sx) => ({ geo: geo.cyl(), mat: std('p:wheel', { color: 0x4a2e1a, roughness: 0.8 }), m: M([sx * 0.26, 0.17, 0.32], [0.17, 0.07, 0.17], [Math.PI / 2, 0, 0]) })),
    ...[-1, 1].map((sx) => ({ geo: geo.cyl(), mat: std('p:wheel', {}), m: M([sx * 0.26, 0.17, -0.32], [0.17, 0.07, 0.17], [Math.PI / 2, 0, 0]) })),
    { geo: geo.cyl(), mat: std('p:iron', { color: 0x2e3440, metalness: 0.7, roughness: 0.35 }), m: M([0.08, 0.5, 0], [0.17, 0.78, 0.17], [0, 0, Math.PI / 2 - 0.2]) },
    { geo: geo.sphere(), mat: std('p:iron', {}), m: M([-0.3, 0.42, 0], [0.18, 0.18, 0.18]) },
    { geo: geo.torus(), mat: std('p:brass', { color: 0xd9a84a, metalness: 0.7, roughness: 0.3 }), m: M([0.44, 0.6, 0], [0.16, 0.16, 0.16], [0, Math.PI / 2, 0]) },
  ],
  mast: () => [
    { geo: geo.cyl(), mat: std('p:mastbase', { map: T('wood'), color: 0x8a5530 }), m: M([0, 0.12, 0], [0.38, 0.24, 0.38]) },
    { geo: geo.cyl(), mat: std('p:mast', { color: 0x8a5530, roughness: 0.8 }), m: M([0, 1.25, 0], [0.09, 2.5, 0.09]) },
    { geo: geo.cyl(), mat: std('p:mast', {}), m: M([0, 1.95, 0], [0.04, 1.5, 0.04], [0, 0, Math.PI / 2]) },
    { geo: geo.rbox(1.3, 1.0, 0.04, 0.02), mat: std('p:sail', { color: 0xfff4dc, roughness: 0.9, side: THREE.DoubleSide }), m: M([0, 1.45, 0.06]) },
    { geo: geo.rbox(0.36, 0.22, 0.02, 0.01), mat: std('p:flag', { color: 0x1d1d26, roughness: 0.8 }), m: M([0.18, 2.42, 0]) },
    { geo: geo.sphere(), mat: std('p:skull', { color: 0xffffff }), m: M([0.16, 2.43, 0.02], [0.05, 0.05, 0.02]) },
  ],
  tiki: () => [
    { geo: geo.rbox(0.62, 1.15, 0.62, 0.1), mat: std('p:tiki', { color: 0x7d8a6a, roughness: 0.95, flatShading: true }), m: M([0, 0.58, 0]) },
    { geo: geo.rbox(0.72, 0.12, 0.72, 0.05), mat: std('p:tikitop', { color: 0x5f6b50, roughness: 0.95 }), m: M([0, 1.18, 0]) },
    ...[-1, 1].map((sx) => ({ geo: geo.sphere(), mat: std('p:tikieye', { color: 0xffe9a8, emissive: 0x8a6a10, emissiveIntensity: 0.3 }), m: M([sx * 0.14, 0.86, 0.31], [0.08, 0.06, 0.03]) })),
    { geo: geo.rbox(0.34, 0.1, 0.04, 0.02), mat: std('p:tikimouth', { color: 0x3a3a2a }), m: M([0, 0.55, 0.31]) },
    { geo: geo.sphere(), mat: std('p:leafSm', { color: 0x48b84a, roughness: 0.7, flatShading: true }), m: M([0.28, 1.25, 0.1], [0.24, 0.08, 0.12], [0, 0.4, -0.4]) },
  ],

  // ---- 스위트 캐슬 ----
  lollipop: () => [
    { geo: geo.cyl(), mat: std('p:lolliBase', { color: 0xfff6fa, roughness: 0.4 }), m: M([0, 0.05, 0], [0.3, 0.1, 0.3]) },
    { geo: geo.cyl(), mat: std('p:lolliStick', { color: 0xffffff, roughness: 0.35 }), m: M([0, 0.55, 0], [0.05, 1.1, 0.05]) },
    { geo: geo.cyl(), mat: std('p:lolliCandy', { map: T('stripes'), color: 0xffd0ec, roughness: 0.2 }), m: M([0, 1.15, 0], [0.4, 0.1, 0.4], [Math.PI / 2, 0, 0]) },
    { geo: geo.torus(), mat: std('p:lolliSwirl', { color: 0x7fd6ff, roughness: 0.2 }), m: M([0, 1.15, 0.06], [0.22, 0.22, 0.3]) },
  ],
  gingerHouse: () => [
    { geo: geo.rbox(0.78, 0.6, 0.72, 0.06), mat: std('p:ginger', { color: 0xb86a35, roughness: 0.7 }), m: M([0, 0.3, 0]) },
    { geo: geo.rbox(0.62, 0.08, 0.92, 0.03), mat: std('p:icing', { color: 0xffffff, roughness: 0.4 }), m: M([-0.2, 0.78, 0], [1, 1, 1], [0, 0, 0.72]) },
    { geo: geo.rbox(0.62, 0.08, 0.92, 0.03), mat: std('p:icing', {}), m: M([0.2, 0.78, 0], [1, 1, 1], [0, 0, -0.72]) },
    { geo: geo.rbox(0.56, 0.06, 0.86, 0.02), mat: std('p:roof', { color: 0x9a5528, roughness: 0.7 }), m: M([-0.18, 0.74, 0], [1, 1, 1], [0, 0, 0.72]) },
    { geo: geo.rbox(0.56, 0.06, 0.86, 0.02), mat: std('p:roof', {}), m: M([0.18, 0.74, 0], [1, 1, 1], [0, 0, -0.72]) },
    { geo: geo.rbox(0.22, 0.32, 0.04, 0.04), mat: std('p:door', { color: 0xff7aa8, roughness: 0.4 }), m: M([0, 0.18, 0.37]) },
    ...[-1, 1].map((sx) => ({ geo: geo.rbox(0.14, 0.14, 0.04, 0.03), mat: std('p:window', { color: 0xfff27a, emissive: 0xffc030, emissiveIntensity: 0.35 }), m: M([sx * 0.24, 0.4, 0.37]) })),
    ...[[-0.3, 0.38], [0.3, 0.38], [0, 0.45]].map(([x, y], k) => ({
      geo: geo.sphere(), mat: std(`p:gumdrop${k}`, { color: [0xff5a7a, 0x6fd6ff, 0x9be87a][k], roughness: 0.2 }), m: M([x, y + 0.12, 0.38], [0.05, 0.05, 0.05]),
    })),
  ],
};
export const pillarParts = (style) => once(`pillar:${style}`, PILLARS[style] || PILLARS.stone);

// ---------------- 파괴 가능한 블록 (풀링되는 Object3D 팩토리) ----------------
const BLOCKS = {
  crate: () => new THREE.Mesh(geo.rbox(0.86, 0.82, 0.86, 0.1), std('b:crate', { map: makeCrateTex(), roughness: 0.7 })),
  snow: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo.rbox(0.84, 0.72, 0.84, 0.16), std('b:snow', { map: floorTexture('snow'), color: 0xb9d4f5, roughness: 0.6 })));
    const cap = new THREE.Mesh(geo.sphere(), std('b:snowcap', { color: 0xffffff, roughness: 0.8 }));
    cap.position.y = 0.36; cap.scale.set(0.4, 0.14, 0.4);
    const ice = new THREE.Mesh(geo.cone(), std('p:crystal', {}));
    ice.position.set(0.3, -0.05, 0.43); ice.rotation.x = Math.PI; ice.scale.set(0.05, 0.16, 0.05);
    g.add(cap, ice);
    return g;
  },
  rockCracked: () =>
    new THREE.Mesh(geo.rbox(0.84, 0.78, 0.84, 0.14), std('b:rock', { map: T('stone'), color: 0xe09a62, emissiveMap: T('basaltGlow'), emissive: 0xff5a10, emissiveIntensity: 0.7, roughness: 0.9 })),
  sandcastle: () => {
    const g = new THREE.Group();
    const sand = std('b:sand', { map: floorTexture('sand'), color: 0xe8c07a, roughness: 1 });
    g.add(new THREE.Mesh(geo.rbox(0.82, 0.6, 0.82, 0.06), sand));
    for (const [x, z] of [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]]) {
      const t = new THREE.Mesh(geo.rbox(0.22, 0.26, 0.22, 0.04), sand);
      t.position.set(x, 0.42, z);
      g.add(t);
    }
    const shell = new THREE.Mesh(geo.sphere(), std('b:shell', { color: 0xff9fb0, roughness: 0.5 }));
    shell.position.set(0, 0.05, 0.42); shell.scale.set(0.09, 0.07, 0.03);
    g.add(shell);
    g.children[0].position.y = -0.1;
    return g;
  },
  chocolate: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo.rbox(0.84, 0.7, 0.84, 0.08), std('b:choco', { map: T('choco'), roughness: 0.45 })));
    const icing = new THREE.Mesh(geo.rbox(0.88, 0.12, 0.88, 0.06), std('b:icing', { color: 0xff9ccc, roughness: 0.35 }));
    icing.position.y = 0.36;
    const sprinkle = new THREE.Mesh(geo.sphere(), std('b:sprinkle', { color: 0xfff27a }));
    sprinkle.position.set(0.15, 0.44, 0.1); sprinkle.scale.setScalar(0.05);
    g.add(icing, sprinkle);
    return g;
  },
  // ---- 보조 블록 (layout 위치에 따라 군집으로 섞여 배치) ----
  leafBlock: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo.rbox(0.84, 0.78, 0.84, 0.18), std('b:leaf', { color: 0x4fbf4a, roughness: 0.8, flatShading: true })));
    for (const [x, y, z] of [[-0.22, 0.36, 0.2], [0.2, 0.38, -0.18], [0.05, 0.42, 0.05]]) {
      const b = new THREE.Mesh(geo.ico(), std('b:leaf2', { color: 0x6fd65a, roughness: 0.8, flatShading: true }));
      b.position.set(x, y, z);
      b.scale.setScalar(0.2);
      g.add(b);
    }
    const flower = new THREE.Mesh(geo.sphere(), std('b:flower', { color: 0xff7aa8 }));
    flower.position.set(0.3, 0.2, 0.42);
    flower.scale.setScalar(0.06);
    g.add(flower);
    return g;
  },
  iceBlock: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo.rbox(0.84, 0.8, 0.84, 0.08), std('b:ice', { color: 0x8fd4ff, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.85, emissive: 0x2a6fb0, emissiveIntensity: 0.25 })));
    const core = new THREE.Mesh(geo.octa(), std('b:icecore', { color: 0xffffff, emissive: 0x9fdcff, emissiveIntensity: 0.4, transparent: true, opacity: 0.7 }));
    core.scale.set(0.16, 0.26, 0.16);
    g.add(core);
    return g;
  },
  crystalRock: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo.rbox(0.84, 0.74, 0.84, 0.14), std('b:darkrock', { map: T('stone'), color: 0x8a7a9a, roughness: 0.9 })));
    for (const [x, z, h, r] of [[-0.18, 0.12, 0.38, 0.3], [0.16, -0.1, 0.3, -0.25], [0.05, 0.22, 0.24, 0.1]]) {
      const c = new THREE.Mesh(geo.octa(), std('b:amethyst', { color: 0xc07aff, emissive: 0x7a2ad0, emissiveIntensity: 0.6, roughness: 0.15 }));
      c.position.set(x, 0.36 + h / 3, z);
      c.scale.set(0.09, h, 0.09);
      c.rotation.z = r;
      g.add(c);
    }
    return g;
  },
  coralBlock: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo.rbox(0.84, 0.72, 0.84, 0.2), std('b:coralbase', { map: floorTexture('sand'), color: 0x9fd8e8, roughness: 0.9 })));
    for (const [x, z, h] of [[-0.2, 0.1, 0.3], [0.15, -0.15, 0.36], [0.2, 0.2, 0.24], [-0.1, -0.2, 0.22]]) {
      const c = new THREE.Mesh(geo.cyl(), std('b:coral', { color: 0xff7a8a, roughness: 0.6 }));
      c.position.set(x, 0.36 + h / 2, z);
      c.scale.set(0.05, h, 0.05);
      g.add(c);
      const tip = new THREE.Mesh(geo.sphere(), std('b:coral', {}));
      tip.position.set(x, 0.36 + h, z);
      tip.scale.setScalar(0.07);
      g.add(tip);
    }
    return g;
  },
  giftBox: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo.rbox(0.82, 0.76, 0.82, 0.06), std('b:gift', { color: 0x6fc8ff, roughness: 0.4 })));
    for (const rot of [0, Math.PI / 2]) {
      const rib = new THREE.Mesh(geo.rbox(0.86, 0.8, 0.14, 0.03), std('b:ribbon', { color: 0xff4d7a, roughness: 0.35 }));
      rib.rotation.y = rot;
      g.add(rib);
    }
    for (const sx of [-1, 1]) {
      const bow = new THREE.Mesh(geo.torus(), std('b:ribbon', {}));
      bow.position.set(sx * 0.1, 0.46, 0);
      bow.rotation.set(0, Math.PI / 2, sx * 0.6);
      bow.scale.setScalar(0.1);
      g.add(bow);
    }
    return g;
  },
  starCloud: () => {
    const g = new THREE.Group();
    const mat = std('b:goldcloud', { color: 0xfff0b0, roughness: 0.9, emissive: 0xffe08a, emissiveIntensity: 0.2 });
    for (const [x, y, z, r] of [[0, 0.05, 0, 0.36], [0.22, -0.1, 0.12, 0.26], [-0.22, -0.08, 0.1, 0.27], [0.1, -0.08, -0.22, 0.26], [-0.12, 0.2, -0.05, 0.24]]) {
      const s = new THREE.Mesh(geo.sphere(), mat);
      s.position.set(x, y, z);
      s.scale.setScalar(r);
      g.add(s);
    }
    const star = new THREE.Mesh(geo.octa(), std('b:star', { color: 0xffd23a, emissive: 0xffa000, emissiveIntensity: 0.6 }));
    star.position.set(0, 0.42, 0);
    star.scale.set(0.12, 0.12, 0.05);
    g.add(star);
    return g;
  },

  // ---- 해적섬 ----
  cargoCrate: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo.rbox(0.84, 0.76, 0.84, 0.08), std('b:cargo', { map: makeCrateTex(), color: 0xd8a878, roughness: 0.75 })));
    const rope = std('b:rope', { color: 0xd9c08a, roughness: 1 });
    for (const rot of [0, Math.PI / 2]) {
      const r = new THREE.Mesh(geo.rbox(0.88, 0.8, 0.07, 0.03), rope);
      r.rotation.y = rot;
      g.add(r);
    }
    return g;
  },
  treasureChest: () => {
    const g = new THREE.Group();
    const wood = std('b:chest', { map: T('wood'), color: 0xb0683a, roughness: 0.7 });
    const gold = std('b:chestGold', { color: 0xffc83a, metalness: 0.75, roughness: 0.3, emissive: 0x6a4000, emissiveIntensity: 0.2 });
    const body = new THREE.Mesh(geo.rbox(0.82, 0.48, 0.66, 0.06), wood);
    body.position.y = -0.14;
    const lid = new THREE.Mesh(geo.cyl(), wood);
    lid.rotation.z = Math.PI / 2;
    lid.scale.set(0.3, 0.82, 0.33);
    lid.position.y = 0.12;
    g.add(body, lid);
    for (const x of [-0.3, 0.3]) {
      const band = new THREE.Mesh(geo.rbox(0.09, 0.5, 0.7, 0.02), gold);
      band.position.set(x, -0.13, 0);
      const arc = new THREE.Mesh(geo.cyl(), gold);
      arc.rotation.z = Math.PI / 2;
      arc.scale.set(0.315, 0.09, 0.345);
      arc.position.set(x, 0.12, 0);
      g.add(band, arc);
    }
    const lock = new THREE.Mesh(geo.rbox(0.14, 0.16, 0.06, 0.02), gold);
    lock.position.set(0, 0.04, 0.34);
    const coin = new THREE.Mesh(geo.cyl(), gold);
    coin.scale.set(0.08, 0.02, 0.08);
    coin.position.set(0.12, 0.42, 0.05);
    g.add(lock, coin);
    return g;
  },
  // ---- 스위트 캐슬 ----
  macaron: () => {
    const g = new THREE.Group();
    const shell = std('b:macShell', { color: 0x9fe6c8, roughness: 0.55 });
    for (const y of [-0.2, 0.2]) {
      const s = new THREE.Mesh(geo.sphere(), shell);
      s.scale.set(0.42, 0.17, 0.42);
      s.position.y = y;
      g.add(s);
    }
    const cream = new THREE.Mesh(geo.cyl(), std('b:macCream', { color: 0xfff6ee, roughness: 0.5 }));
    cream.scale.set(0.39, 0.16, 0.39);
    const foot = new THREE.Mesh(geo.torus(), std('b:macFoot', { color: 0x6fcfa6, roughness: 0.8 }));
    foot.rotation.x = Math.PI / 2;
    foot.scale.set(0.37, 0.37, 0.2);
    foot.position.y = 0.09;
    g.add(cream, foot);
    return g;
  },
  cakeBlock: () => {
    const g = new THREE.Group();
    const sponge = new THREE.Mesh(geo.rbox(0.84, 0.68, 0.84, 0.08), std('b:sponge', { color: 0xffe2b0, roughness: 0.8 }));
    sponge.position.y = -0.05;
    const jam = new THREE.Mesh(geo.rbox(0.86, 0.08, 0.86, 0.03), std('b:jam', { color: 0xff5a8a, roughness: 0.3 }));
    jam.position.y = -0.05;
    const frost = new THREE.Mesh(geo.rbox(0.88, 0.14, 0.88, 0.06), std('b:frost', { color: 0xfff6fb, roughness: 0.4 }));
    frost.position.y = 0.3;
    const berry = new THREE.Mesh(geo.sphere(), std('p:cherry', { color: 0xff2040, roughness: 0.15, emissive: 0x400010 }));
    berry.scale.setScalar(0.1);
    berry.position.y = 0.46;
    g.add(sponge, jam, frost, berry);
    return g;
  },

  pushCrate: () => new THREE.Mesh(geo.rbox(0.84, 0.8, 0.84, 0.12), std('push:crate', { map: makePushTex('#3d8bff', '#2a62d0'), roughness: 0.5 })),
  snowball: () => {
    const g = new THREE.Group();
    const ball = new THREE.Mesh(geo.sphere(), std('push:snow', { map: floorTexture('snow'), color: 0xffffff, roughness: 0.8 }));
    ball.scale.setScalar(0.42);
    ball.position.y = 0.02;
    const ring = new THREE.Mesh(geo.torus(), std('push:ring', { color: 0x7fc4ff, emissive: 0x3a8ad0, emissiveIntensity: 0.4 }));
    ring.rotation.x = Math.PI / 2;
    ring.scale.set(0.3, 0.3, 0.15);
    ring.position.y = -0.34;
    g.add(ball, ring);
    return g;
  },
  magmaStone: () => {
    const m = new THREE.Mesh(geo.ico(), std('push:magma', { map: T('basalt'), emissiveMap: T('basaltGlow'), emissive: 0xff6010, emissiveIntensity: 1.2, roughness: 0.9, flatShading: true }));
    m.scale.set(0.38, 0.34, 0.38);
    m.position.y = -0.05;
    return m;
  },
  barrel: () => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(geo.cyl(), std('push:barrel', { map: T('wood'), color: 0xc07a48, roughness: 0.8 }));
    body.scale.set(0.36, 0.78, 0.36);
    g.add(body);
    for (const y of [-0.25, 0.25]) {
      const hoop = new THREE.Mesh(geo.torus(), std('push:hoop', { color: 0x6a7080, metalness: 0.5, roughness: 0.4 }));
      hoop.rotation.x = Math.PI / 2;
      hoop.scale.set(0.37, 0.37, 0.12);
      hoop.position.y = y;
      g.add(hoop);
    }
    return g;
  },
  jellyCube: () => {
    const g = new THREE.Group();
    const cube = new THREE.Mesh(geo.rbox(0.8, 0.74, 0.8, 0.2), std('push:jelly', { color: 0xff6fb5, roughness: 0.1, transparent: true, opacity: 0.85, emissive: 0x8a1050, emissiveIntensity: 0.25 }));
    const shine = new THREE.Mesh(geo.sphere(), std('push:jellyshine', { color: 0xffffff, transparent: true, opacity: 0.5 }));
    shine.scale.set(0.12, 0.08, 0.04);
    shine.position.set(-0.18, 0.2, 0.4);
    g.add(cube, shine);
    return g;
  },
  cloudCushion: () => {
    const g = new THREE.Group();
    const mat = std('push:cushion', { color: 0xffc2dc, roughness: 0.9, emissive: 0xffe0ee, emissiveIntensity: 0.15 });
    for (const [x, y, z, r] of [[0, 0, 0, 0.36], [0.2, -0.08, 0.15, 0.26], [-0.2, -0.06, 0.12, 0.27], [0, 0.16, -0.12, 0.25]]) {
      const p = new THREE.Mesh(geo.sphere(), mat);
      p.position.set(x, y, z);
      p.scale.setScalar(r);
      g.add(p);
    }
    return g;
  },
  cloudPuff: () => {
    const g = new THREE.Group();
    const mat = std('b:cloud', { color: 0xffffff, roughness: 0.95, emissive: 0xdfe9ff, emissiveIntensity: 0.15 });
    for (const [x, y, z, r] of [[0, 0.05, 0, 0.36], [0.22, -0.1, 0.12, 0.26], [-0.22, -0.08, 0.1, 0.27], [0.1, -0.08, -0.22, 0.26], [-0.12, 0.2, -0.05, 0.24]]) {
      const s = new THREE.Mesh(geo.sphere(), mat);
      s.position.set(x, y, z); s.scale.setScalar(r);
      g.add(s);
    }
    return g;
  },
};

function makePushTex(c1, c2) {
  return once('tex:push:' + c1, () =>
    canvasTex(256, (ctx, s) => {
      ctx.fillStyle = c1;
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = c2;
      ctx.lineWidth = 20;
      ctx.strokeRect(10, 10, s - 20, s - 20);
      ctx.fillStyle = '#ffffff';
      // 양방향 화살표 = 밀 수 있다는 표시
      const arrow = (rot) => {
        ctx.save();
        ctx.translate(s / 2, s / 2);
        ctx.rotate(rot);
        ctx.beginPath();
        ctx.moveTo(78, 0); ctx.lineTo(40, -34); ctx.lineTo(40, -14); ctx.lineTo(0, -14); ctx.lineTo(0, 14); ctx.lineTo(40, 14); ctx.lineTo(40, 34);
        ctx.fill();
        ctx.restore();
      };
      arrow(0);
      arrow(Math.PI);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(20, 20, s - 40, 14);
    }),
  );
}

function makeCrateTex() {
  return once('tex:crate', () =>
    canvasTex(256, (ctx, s) => {
      ctx.drawImage(T('wood').image, 0, 0);
      ctx.strokeStyle = '#b8641a'; ctx.lineWidth = 22; ctx.strokeRect(11, 11, s - 22, s - 22);
      ctx.strokeStyle = '#ffc56b'; ctx.lineWidth = 4; ctx.strokeRect(4, 4, s - 8, s - 8);
      ctx.lineWidth = 16; ctx.strokeStyle = '#c87020';
      ctx.beginPath(); ctx.moveTo(24, 24); ctx.lineTo(s - 24, s - 24); ctx.stroke();
      ctx.fillStyle = '#7a8090';
      [[22, 22], [s - 22, 22], [22, s - 22], [s - 22, s - 22]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill(); });
    }),
  );
}

/**
 * 블록 생성. 여러 파츠로 된 블록은 재질별로 지오메트리를 합쳐(스타일당 1회, 캐시)
 * 블록 1개 = 재질 수만큼의 메시만 그리도록 한다 → 블록이 많은 맵에서도 드로우콜 절감.
 */
export function makeBlock(style) {
  const key = BLOCKS[style] ? style : 'crate';
  const parts = once(`merged:${key}`, () => {
    const src = BLOCKS[key]();
    src.updateMatrixWorld(true);
    const byMat = new Map();
    src.traverse((m) => {
      if (!m.isMesh) return;
      let g = m.geometry.clone().applyMatrix4(m.matrixWorld);
      if (g.index) g = g.toNonIndexed();
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
      if (!byMat.has(m.material)) byMat.set(m.material, []);
      byMat.get(m.material).push(g);
    });
    return [...byMat].map(([mat, geos]) => ({ mat, geo: geos.length === 1 ? geos[0] : mergeGeometries(geos) }));
  });
  const make = (p) => {
    const m = new THREE.Mesh(p.geo, p.mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  if (parts.length === 1) return make(parts[0]);
  const g = new THREE.Group();
  for (const p of parts) g.add(make(p));
  return g;
}

// ---------------- 특수 지형 오버레이 ----------------
export function terrainMaterial(type) {
  if (type === TERRAIN.LAVA) return std('t:lava', { map: T('lava'), color: 0xff8a3a, emissiveMap: T('lava'), emissive: 0xff4a00, emissiveIntensity: 0.75, roughness: 0.5 });
  if (type === TERRAIN.ICE) return std('t:ice', { color: 0xa8dcff, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.8, emissive: 0x3a8ad0, emissiveIntensity: 0.15 });
  if (type === TERRAIN.BOOST) return std('t:boost', { map: T('boost'), roughness: 0.3, emissive: 0xffa040, emissiveIntensity: 0.15 });
  if (type === TERRAIN.JELLY) return std('t:jelly', { color: 0x6fe39a, roughness: 0.1, transparent: true, opacity: 0.8, emissive: 0x1a8a4a, emissiveIntensity: 0.25 });
  return std('t:conv', { map: T('arrows'), roughness: 0.6, emissive: 0x2a6ac0, emissiveIntensity: 0.15 });
}
export const conveyorTexture = () => T('arrows');

/** 하늘 섬 이동형 발판 (금색 판 + 구름) */
export function makePlatform() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(geo.rbox(0.96, 0.22, 0.96, 0.08), std('plat:base', { color: 0xffd86b, roughness: 0.35, metalness: 0.35 }));
  base.position.y = -0.11;
  const top = new THREE.Mesh(geo.rbox(0.88, 0.1, 0.88, 0.05), std('plat:top', { map: floorTexture('cloud'), color: 0xfff6dc, roughness: 0.8 }));
  g.add(base, top);
  const puff = std('plat:puff', { color: 0xffffff, roughness: 1, emissive: 0xe6f0ff, emissiveIntensity: 0.2 });
  for (const [x, z] of [[-0.4, 0.4], [0.4, 0.4], [-0.4, -0.4], [0.4, -0.4], [0, 0.48], [0, -0.48]]) {
    const p = new THREE.Mesh(geo.sphere(), puff);
    p.position.set(x, -0.28, z);
    p.scale.set(0.24, 0.16, 0.24);
    g.add(p);
  }
  g.traverse((m) => { if (m.isMesh) m.castShadow = m.receiveShadow = true; });
  return g;
}

export function pitMaterial(style) {
  if (style === 'lava') return std('pit:lava', { map: T('lava'), emissiveMap: T('lava'), emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.4 });
  if (style === 'void') {
    return once('mat:pit:void', () =>
      new THREE.MeshBasicMaterial({
        fog: false,
        map: canvasTex(128, (ctx, s) => {
          const g = ctx.createRadialGradient(s / 2, s / 2, 4, s / 2, s / 2, s * 0.75);
          g.addColorStop(0, '#bfe6ff');
          g.addColorStop(0.6, '#5fb2f2');
          g.addColorStop(1, '#2a6fc0');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, s, s);
          speckle(ctx, s, 10, [8, 18], () => 'rgba(255,255,255,0.55)', 81);
        }),
      }),
    );
  }
  if (style === 'water') return std('pit:water', { map: T('water'), roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.95 });
  return null;
}
export const lavaTexture = () => T('lava');
export const waterTexture = () => T('water');

// ---------------- 랜드마크 (여러 칸을 차지하는 장식 한 덩어리) ----------------
const LANDMARKS = {
  // 스위트 캐슬 중앙 분수대 (3×3 칸)
  fountain() {
    const g = new THREE.Group();
    const pink = std('lm:pink', { map: T('brick'), color: 0xffb3cf, roughness: 0.5 });
    const cream = std('lm:cream', { color: 0xfff4f8, roughness: 0.4 });
    const water = std('lm:water', { color: 0x7fd8ff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.85, emissive: 0x2a8ad0, emissiveIntensity: 0.2 });
    const add = (geom, mat, pos, scale, rot = [0, 0, 0]) => {
      const m = new THREE.Mesh(geom, mat);
      m.position.set(...pos);
      m.scale.set(...scale);
      m.rotation.set(...rot);
      m.castShadow = m.receiveShadow = true;
      g.add(m);
      return m;
    };
    add(geo.cyl(), pink, [0, 0.22, 0], [1.4, 0.44, 1.4]);
    add(geo.torus(), cream, [0, 0.46, 0], [1.36, 1.36, 0.5], [Math.PI / 2, 0, 0]);
    g.userData.pool = add(geo.cyl(), water, [0, 0.42, 0], [1.25, 0.06, 1.25]);
    add(geo.cyl(), cream, [0, 0.85, 0], [0.22, 0.9, 0.22]);
    add(geo.sphere(), pink, [0, 1.25, 0], [0.62, 0.2, 0.62]);
    add(geo.cyl(), water, [0, 1.32, 0], [0.52, 0.04, 0.52]);
    add(geo.cyl(), cream, [0, 1.55, 0], [0.12, 0.5, 0.12]);
    add(geo.sphere(), pink, [0, 1.78, 0], [0.32, 0.12, 0.32]);
    // 꼭대기 하트 + 물줄기
    const spray = std('lm:spray', { color: 0xdff6ff, transparent: true, opacity: 0.75, emissive: 0x9fdcff, emissiveIntensity: 0.4 });
    g.userData.spray = [];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      g.userData.spray.push(add(geo.sphere(), spray, [Math.cos(a) * 0.4, 1.7, Math.sin(a) * 0.4], [0.07, 0.07, 0.07]));
    }
    add(geo.sphere(), std('lm:heart', { color: 0xff5a8a, roughness: 0.3, emissive: 0x6a0020, emissiveIntensity: 0.2 }), [0, 2.0, 0], [0.12, 0.12, 0.08]);
    // 둘레 작은 탑 4개
    for (const [x, z] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) {
      add(geo.cyl(), pink, [x, 0.45, z], [0.18, 0.9, 0.18]);
      add(geo.cone(), std('lm:roof', { color: 0x8fd0ff, roughness: 0.4 }), [x, 1.08, z], [0.24, 0.38, 0.24]);
    }
    return g;
  },
  // 해적섬 가운데 다리 양옆 바다 바위 (다리를 가리지 않도록 물 칸에만 배치, 판정 없음)
  seaRocks() {
    const g = new THREE.Group();
    const rock = std('lm:rock', { color: 0x9a948a, roughness: 0.95, flatShading: true });
    const moss = std('lm:moss', { color: 0x5fb84a, roughness: 0.9 });
    const foam = std('lm:foam', { color: 0xffffff, transparent: true, opacity: 0.7, roughness: 0.6 });
    for (const [x, z, s] of [[-0.9, -1.2, 0.42], [0.2, -1.35, 0.3], [0.95, -1.1, 0.36], [-0.7, 1.25, 0.34], [0.6, 1.3, 0.44], [0, 2.4, 0.24], [-0.4, -2.5, 0.26]]) {
      const b = new THREE.Mesh(geo.ico(), rock);
      b.position.set(x, -0.18, z);
      b.scale.set(s, s * 0.8, s);
      b.rotation.y = x * 3;
      b.castShadow = true;
      const m = new THREE.Mesh(geo.sphere(), moss);
      m.position.set(x, -0.18 + s * 0.7, z);
      m.scale.set(s * 0.5, s * 0.15, s * 0.5);
      const f = new THREE.Mesh(geo.torus(), foam);
      f.rotation.x = Math.PI / 2;
      f.position.set(x, -0.26, z);
      f.scale.set(s * 1.1, s * 1.1, 0.12);
      g.add(b, m, f);
    }
    return g;
  },
};

export function makeLandmark(style) {
  return (LANDMARKS[style] || (() => new THREE.Group()))();
}

// ---------------- 배경 (테마별 1회 생성) ----------------
function scatter(seed, count, ok, place) {
  const rnd = seeded(seed);
  let n = 0;
  for (let k = 0; k < count * 10 && n < count; k++) {
    const x = (rnd() - 0.5) * 50;
    const z = (rnd() - 0.5) * 44 - 4;
    if (!ok(x, z)) continue;
    n++;
    place(x, z, rnd);
  }
}
const R = CONFIG.MAP_SIZE / 2; // 맵 반폭 (17×17 → 8.5)
const outside = (x, z) => !(Math.abs(x) < R + 1.2 && Math.abs(z) < R + 1.2);

function groundDisc(g, color, y = -0.31) {
  const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color, roughness: 1 }));
  ground.position.y = y;
  ground.receiveShadow = true;
  g.add(ground);
}

function tree(g, x, z, rnd, leafColor, trunkColor = 0xa0673a) {
  const t = new THREE.Group();
  const h = 0.9 + rnd() * 0.6;
  const trunk = new THREE.Mesh(geo.cyl(), std(`trunk:${trunkColor}`, { color: trunkColor, roughness: 0.9 }));
  trunk.scale.set(0.2, h, 0.2);
  trunk.position.y = h / 2;
  trunk.castShadow = true;
  t.add(trunk);
  for (const [bx, by, bz, br] of [[0, h + 0.55, 0, 0.85], [0.35, h + 0.2, 0.2, 0.6], [-0.35, h + 0.25, -0.1, 0.62]]) {
    const leaf = new THREE.Mesh(geo.ico(), std(`leaf:${leafColor}`, { color: leafColor, roughness: 0.8, flatShading: true }));
    leaf.position.set(bx, by, bz);
    leaf.scale.setScalar(br);
    leaf.castShadow = true;
    t.add(leaf);
  }
  t.position.set(x, -0.3, z);
  t.scale.setScalar(0.9 + rnd() * 0.7);
  g.add(t);
}

const SCENERY = {
  meadow(g, env) {
    groundDisc(g, env.ground);
    const path = new THREE.Mesh(new THREE.RingGeometry(R + 3.6, R + 4.8, 64).rotateX(-Math.PI / 2), std('sc:path', { color: 0xe6c88a, roughness: 1 }));
    path.position.y = -0.3;
    g.add(path);
    const pond = new THREE.Mesh(new THREE.CircleGeometry(3.2, 32).rotateX(-Math.PI / 2), std('sc:pond', { color: 0x47b8f0, roughness: 0.15, transparent: true, opacity: 0.9 }));
    pond.position.set(-15, -0.28, -6);
    pond.scale.set(1.4, 1, 0.9);
    g.add(pond);
    const ok = (x, z) => outside(x, z) && !(Math.hypot(x, z) > R + 3.3 && Math.hypot(x, z) < R + 5.1) && Math.hypot(x + 15, z + 6) > 4;
    const leaves = [0x4cbb4a, 0x5cc85a, 0x3ea94a];
    scatter(99, 46, ok, (x, z, r) => tree(g, x, z, r, leaves[Math.floor(r() * 3)]));
    const flowers = [0xff7aa8, 0xffe15a, 0xffffff, 0xb08cff];
    scatter(5, 90, ok, (x, z, r) => {
      const fc = flowers[Math.floor(r() * 4)];
      const f = new THREE.Mesh(geo.sphere(), std(`fl:${fc}`, { color: fc }));
      f.position.set(x, -0.22, z);
      f.scale.setScalar(0.09);
      g.add(f);
    });
  },
  ice(g, env) {
    groundDisc(g, env.ground);
    const lake = new THREE.Mesh(new THREE.CircleGeometry(4, 32).rotateX(-Math.PI / 2), std('sc:frozen', { color: 0xa8dcff, roughness: 0.05, metalness: 0.3 }));
    lake.position.set(12, -0.29, -8);
    lake.scale.set(1.3, 1, 0.8);
    g.add(lake);
    scatter(17, 50, outside, (x, z, r) => {
      const p = new THREE.Group();
      const h = 1 + r() * 0.8;
      const trunk = new THREE.Mesh(geo.cyl(), std('sc:pinetrunk', { color: 0x7a5236 }));
      trunk.scale.set(0.14, 0.5, 0.14);
      trunk.position.y = 0.25;
      p.add(trunk);
      for (let k = 0; k < 3; k++) {
        const c = new THREE.Mesh(geo.cone(), std('sc:pine', { color: 0x2f7a5a, flatShading: true, roughness: 0.8 }));
        c.scale.set(0.75 - k * 0.18, 0.7, 0.75 - k * 0.18);
        c.position.y = 0.6 + k * 0.42;
        c.castShadow = true;
        const snow = new THREE.Mesh(geo.cone(), std('sc:pinesnow', { color: 0xffffff, roughness: 0.9 }));
        snow.scale.set(0.42 - k * 0.1, 0.3, 0.42 - k * 0.1);
        snow.position.y = c.position.y + 0.24;
        p.add(c, snow);
      }
      p.position.set(x, -0.3, z);
      p.scale.setScalar(h);
      g.add(p);
    });
    scatter(23, 30, outside, (x, z, r) => {
      const s = new THREE.Mesh(geo.octa(), std('p:crystal', {}));
      s.position.set(x, 0, z);
      s.scale.set(0.2, 0.5 + r() * 0.6, 0.2);
      s.rotation.z = (r() - 0.5) * 0.6;
      g.add(s);
    });
  },
  volcano(g, env) {
    groundDisc(g, env.ground);
    const lavaRing = new THREE.Mesh(new THREE.RingGeometry(R + 3.8, R + 5, 64).rotateX(-Math.PI / 2), pitMaterial('lava'));
    lavaRing.position.y = -0.29;
    g.add(lavaRing);
    const mountain = new THREE.Mesh(new THREE.ConeGeometry(9, 9, 10, 1, true), std('sc:volcano', { color: 0x4a3a3a, flatShading: true, roughness: 1 }));
    mountain.position.set(-6, 4, -26);
    g.add(mountain);
    const crater = new THREE.Mesh(new THREE.CircleGeometry(1.6, 16).rotateX(-Math.PI / 2), pitMaterial('lava'));
    crater.position.set(-6, 7.6, -26);
    g.add(crater);
    const glow = new THREE.PointLight(0xff6a20, 40, 30, 2);
    glow.position.set(0, 3, 0);
    g.add(glow);
    scatter(31, 60, (x, z) => outside(x, z) && !(Math.hypot(x, z) > R + 3.6 && Math.hypot(x, z) < R + 5.2), (x, z, r) => {
      const rock = new THREE.Mesh(geo.ico(), std('sc:rock', { color: 0x3a3034, flatShading: true }));
      rock.position.set(x, -0.1, z);
      rock.scale.set(0.4 + r() * 0.8, 0.3 + r() * 0.7, 0.4 + r() * 0.8);
      rock.castShadow = true;
      g.add(rock);
    });
  },
  beach(g, env) {
    groundDisc(g, env.ground);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(140, 40).rotateX(-Math.PI / 2), std('sc:sea', { color: 0x2fb0e8, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.92 }));
    sea.position.set(0, -0.2, -30);
    g.add(sea);
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(140, 1.2).rotateX(-Math.PI / 2), std('sc:foam', { color: 0xffffff, transparent: true, opacity: 0.8 }));
    foam.position.set(0, -0.18, -(R + 3.7));
    g.add(foam);
    g.userData.sea = { sea, foam };
    scatter(41, 26, (x, z) => outside(x, z) && z > -(R + 3), (x, z, r) => {
      const p = new THREE.Group();
      for (const part of pillarParts('palm')) {
        const m = new THREE.Mesh(part.geo, part.mat);
        m.applyMatrix4(part.m);
        m.castShadow = true;
        p.add(m);
      }
      p.position.set(x, -0.3, z);
      p.scale.setScalar(1.6 + r());
      p.rotation.y = r() * 6;
      g.add(p);
    });
    const umbrellaCols = [0xff5a6e, 0x4fb6ff, 0xffd23f];
    scatter(7, 8, (x, z) => outside(x, z) && z > -(R + 2.5) && Math.abs(x) < 18, (x, z, r) => {
      const u = new THREE.Group();
      const pole = new THREE.Mesh(geo.cyl(), std('sc:pole', { color: 0xffffff }));
      pole.scale.set(0.04, 1.6, 0.04);
      pole.position.y = 0.8;
      const top = new THREE.Mesh(geo.cone(), std(`sc:umb${umbrellaCols.length}${Math.floor(r() * 3)}`, { color: umbrellaCols[Math.floor(r() * 3)], roughness: 0.6 }));
      top.scale.set(0.9, 0.35, 0.9);
      top.position.y = 1.6;
      top.castShadow = true;
      u.add(pole, top);
      u.position.set(x, -0.3, z);
      g.add(u);
    });
  },
  candy(g, env) {
    groundDisc(g, env.ground);
    const cols = [0xff6fa5, 0x6fc8ff, 0xffd23f, 0x9be87a, 0xc58cff];
    scatter(51, 40, outside, (x, z, r) => {
      const c = cols[Math.floor(r() * cols.length)];
      if (r() < 0.5) {
        const l = new THREE.Group();
        const stick = new THREE.Mesh(geo.cyl(), std('sc:stick', { color: 0xffffff }));
        stick.scale.set(0.05, 1.6, 0.05);
        stick.position.y = 0.8;
        const disc = new THREE.Mesh(geo.cyl(), std(`sc:lolli${c}`, { color: c, roughness: 0.2 }));
        disc.scale.set(0.6, 0.12, 0.6);
        disc.rotation.x = Math.PI / 2;
        disc.position.y = 1.9;
        disc.castShadow = true;
        const swirl = new THREE.Mesh(geo.torus(), std('sc:swirl', { color: 0xffffff, roughness: 0.2 }));
        swirl.scale.set(0.32, 0.32, 0.3);
        swirl.position.set(0, 1.9, 0.07);
        l.add(stick, disc, swirl);
        l.position.set(x, -0.3, z);
        l.rotation.y = r() * 6;
        l.scale.setScalar(0.9 + r() * 0.8);
        g.add(l);
      } else {
        const gum = new THREE.Mesh(geo.sphere(), std(`sc:gum${c}`, { color: c, roughness: 0.15, transparent: true, opacity: 0.9 }));
        gum.scale.set(0.6, 0.55, 0.6);
        gum.position.set(x, -0.2, z);
        gum.castShadow = true;
        g.add(gum);
      }
    });
  },
  sky(g) {
    // 떠 있는 섬: 경기장 아래 바위 + 잔디 테두리
    const rock = new THREE.Mesh(new THREE.ConeGeometry(R + 4.5, 10, 9, 3), std('sc:islandrock', { color: 0x9c8a7a, flatShading: true, roughness: 1 }));
    rock.rotation.x = Math.PI;
    rock.position.y = -6.4; // 원뿔 윗면(y≈-1.4)이 허공 구멍보다 아래에 오도록
    g.add(rock);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(R + 4.5, R + 4.3, 0.4, 32), std('sc:islandgrass', { color: 0x8fdc5c, roughness: 1 }));
    top.position.y = -1.6;
    top.receiveShadow = true;
    g.add(top);
    const cloudMat = std('sc:cloud', { color: 0xffffff, roughness: 1, emissive: 0xe6f0ff, emissiveIntensity: 0.2 });
    scatter(61, 40, (x, z) => Math.hypot(x, z) > R + 6, (x, z, r) => {
      const c = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const s = new THREE.Mesh(geo.sphere(), cloudMat);
        s.position.set((k - 1.5) * 0.9, (r() - 0.5) * 0.4, (r() - 0.5) * 0.6);
        s.scale.setScalar(0.7 + r() * 0.6);
        c.add(s);
      }
      c.position.set(x * 1.2, -2 - r() * 6, z * 1.2);
      c.scale.setScalar(1 + r() * 1.5);
      g.add(c);
    });
    // 작은 떠 있는 섬들
    scatter(67, 6, (x, z) => Math.hypot(x, z) > R + 9, (x, z, r) => {
      const isl = new THREE.Group();
      const b = new THREE.Mesh(geo.cone(), std('sc:islandrock', {}));
      b.rotation.x = Math.PI;
      b.scale.set(1.4, 2, 1.4);
      b.position.y = -1;
      const t = new THREE.Mesh(geo.cyl(), std('sc:islandgrass', {}));
      t.scale.set(1.4, 0.25, 1.4);
      isl.add(b, t);
      tree(isl, 0, 0, r, 0x4cbb4a);
      isl.position.set(x, 1 + r() * 3, z);
      g.add(isl);
    });
    const rainbow = new THREE.Group();
    [0xff6b6b, 0xffb84d, 0xfff06b, 0x7be07b, 0x6bb8ff, 0xb08cff].forEach((c, i) => {
      const arc = new THREE.Mesh(new THREE.TorusGeometry(14 - i * 0.5, 0.25, 6, 48, Math.PI), std(`sc:rb${i}`, { color: c, emissive: c, emissiveIntensity: 0.3, transparent: true, opacity: 0.55 }));
      rainbow.add(arc);
    });
    rainbow.position.set(4, -2, -30);
    g.add(rainbow);
  },
};

SCENERY.pirate = function pirate(g) {
  // 바다 + 왼쪽 아래 해적선 선체 + 오른쪽 섬 모래톱 + 먼 바다 섬들
  const sea = new THREE.Mesh(new THREE.CircleGeometry(70, 48).rotateX(-Math.PI / 2), std('sc:pirateSea', { map: T('water'), color: 0xffffff, roughness: 0.15, metalness: 0.1 }));
  sea.position.y = -0.42;
  sea.receiveShadow = true;
  g.add(sea);
  g.userData.water = true;

  // 선체: 왼쪽 절반 아래 (월드 x ≈ -8.5 ~ -1.5), 서쪽으로 뱃머리
  const hullMat = std('sc:hull', { map: T('hull'), roughness: 0.8 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(7.6, 1.6, R * 2 + 1.4), hullMat);
  hull.position.set(-5.0, -1.12, 0);
  g.add(hull);
  const bow = new THREE.Mesh(new THREE.CylinderGeometry(0.01, R + 0.7, 4.2, 3, 1), hullMat);
  bow.rotation.z = Math.PI / 2;
  bow.rotation.x = Math.PI / 2;
  bow.position.set(-10.9, -1.12, 0);
  bow.scale.set(1, 1, 0.42);
  g.add(bow);
  const rail = std('sc:rail', { color: 0x5a341c, roughness: 0.8 });
  for (const z of [-(R + 0.7), R + 0.7]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.5, 0.2), rail);
    r.position.set(-5.0, -0.1, z);
    g.add(r);
  }
  // 섬: 오른쪽 아래 모래톱 + 해변 잔디
  const isle = new THREE.Mesh(new THREE.CylinderGeometry(R + 1.5, R + 3, 0.7, 40), std('sc:isleSand', { color: 0xf1d898, roughness: 1 }));
  isle.scale.set(0.62, 1, 1.15);
  isle.position.set(6.2, -0.62, 0);
  isle.receiveShadow = true;
  g.add(isle);
  const palms = (x, z, r) => {
    const p = new THREE.Group();
    for (const part of pillarParts('palm')) {
      const m = new THREE.Mesh(part.geo, part.mat);
      m.applyMatrix4(part.m);
      m.castShadow = true;
      p.add(m);
    }
    p.position.set(x, -0.3, z);
    p.scale.setScalar(1.5 + r());
    p.rotation.y = r() * 6;
    g.add(p);
  };
  scatter(71, 10, (x, z) => x > R + 1.4 && x < R + 4 && Math.abs(z) < R + 2, (x, z, r) => palms(x, z, r));
  // 먼 섬들
  scatter(73, 7, (x, z) => Math.hypot(x, z) > R + 9, (x, z, r) => {
    const isl = new THREE.Mesh(geo.sphere(), std('sc:isleSand', {}));
    isl.scale.set(2 + r() * 2, 0.5, 1.6 + r() * 1.5);
    isl.position.set(x * 1.3, -0.4, z * 1.3);
    g.add(isl);
    palms(x * 1.3, z * 1.3, r);
  });
  // 바위
  scatter(79, 14, (x, z) => outside(x, z) && Math.hypot(x, z) < R + 12 && x > 0, (x, z, r) => {
    const rock = new THREE.Mesh(geo.ico(), std('lm:rock', { color: 0x9a948a, roughness: 0.95, flatShading: true }));
    rock.position.set(x, -0.3, z);
    rock.scale.set(0.5 + r() * 0.8, 0.4 + r() * 0.6, 0.5 + r() * 0.8);
    rock.castShadow = true;
    g.add(rock);
  });
};

SCENERY.castle = function castle(g, env) {
  SCENERY.candy(g, env);
  const brick = std('sc:castleBrick', { map: T('brick'), color: 0xffc2d6, roughness: 0.6 });
  const roofs = [0x8fd0ff, 0xff7aa8, 0xc59bff, 0xffd23f];
  const tower = (x, z, h, k) => {
    const t = new THREE.Group();
    const body = new THREE.Mesh(geo.cyl(), brick);
    body.scale.set(0.9, h, 0.9);
    body.position.y = h / 2 - 0.3;
    body.castShadow = true;
    const roof = new THREE.Mesh(geo.cone(), std(`sc:troof${k}`, { color: roofs[k % 4], roughness: 0.4 }));
    roof.scale.set(1.15, 1.4, 1.15);
    roof.position.y = h + 0.4;
    roof.castShadow = true;
    const flag = new THREE.Mesh(geo.rbox(0.5, 0.3, 0.03, 0.01), std('sc:flag', { color: 0xff5a8a, side: THREE.DoubleSide }));
    flag.position.set(0.28, h + 1.3, 0);
    t.add(body, roof, flag);
    t.position.set(x, 0, z);
    g.add(t);
  };
  const e = R + 1.4;
  [[-e, -e], [e, -e], [-e, e], [e, e]].forEach(([x, z], k) => tower(x, z, 3.2, k));
  // 위/아래 성문 (양쪽 작은 탑)
  [-1, 1].forEach((sz, k) => {
    tower(-2.4, sz * e, 2.2, k + 1);
    tower(2.4, sz * e, 2.2, k + 2);
    const gate = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.35, 8, 16, Math.PI), brick);
    gate.position.set(0, 0.6, sz * e);
    gate.castShadow = true;
    g.add(gate);
  });
};

export function buildScenery(theme, env) {
  const g = new THREE.Group();
  (SCENERY[theme] || SCENERY.meadow)(g, env);
  return g;
}
