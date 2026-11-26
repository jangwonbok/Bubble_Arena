import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// 아이템 3D 모델 (참고 이미지 기반 디자인). 크기 기준: 약 0.7 × 0.7 (원점 중심).
// 게임 필드(ItemView)와 UI 아이콘(ItemIconRenderer)이 같은 모델을 사용한다.

const cache = new Map();
const once = (k, fn) => (cache.has(k) ? cache.get(k) : (cache.set(k, fn()), cache.get(k)));

// ---------------- 공용 지오메트리 ----------------
const lathe = (key, pts, seg = 32) => once(`lathe:${key}`, () => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg));
const extrude = (key, shapeFn, opts) => once(`ext:${key}`, () => {
  const g = new THREE.ExtrudeGeometry(shapeFn(), { curveSegments: 24, bevelSegments: 4, ...opts });
  g.center();
  return g;
});
const G = {
  sphere: () => once('sphere', () => new THREE.SphereGeometry(1, 32, 24)),
  cyl: () => once('cyl', () => new THREE.CylinderGeometry(1, 1, 1, 32)),
  rbox: (w, h, d, r) => once(`rbox:${w}:${h}:${d}:${r}`, () => new RoundedBoxGeometry(w, h, d, 4, r)),
  torus: (r, t, arc = Math.PI * 2) => once(`torus:${r}:${t}:${arc}`, () => new THREE.TorusGeometry(r, t, 16, 40, arc)),
  cone: () => once('cone', () => new THREE.ConeGeometry(1, 1, 24)),
};

// 물풍선 (아래쪽에 묶은 매듭)
const BALLOON_PTS = [[0, -0.5], [0.05, -0.47], [0.09, -0.42], [0.2, -0.32], [0.32, -0.16], [0.39, 0.03], [0.4, 0.18], [0.36, 0.34], [0.27, 0.46], [0.14, 0.53], [0, 0.55]];
// 물방울 (끝이 위로)
const DROP_PTS = [[0, -0.3], [0.17, -0.28], [0.27, -0.18], [0.31, -0.02], [0.28, 0.12], [0.2, 0.25], [0.1, 0.37], [0.03, 0.45], [0, 0.48]];

function shieldShape(s = 1) {
  const sh = new THREE.Shape();
  sh.moveTo(-0.38 * s, 0.42 * s);
  sh.quadraticCurveTo(0, 0.52 * s, 0.38 * s, 0.42 * s);
  sh.lineTo(0.38 * s, 0.06 * s);
  sh.quadraticCurveTo(0.34 * s, -0.3 * s, 0, -0.54 * s);
  sh.quadraticCurveTo(-0.34 * s, -0.3 * s, -0.38 * s, 0.06 * s);
  sh.closePath();
  return sh;
}
function starShape(points = 4, r1 = 0.5, r2 = 0.16) {
  const sh = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? r2 : r1;
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) sh.moveTo(x, y);
    else sh.lineTo(x, y);
  }
  sh.closePath();
  return sh;
}
function heartShape() {
  const sh = new THREE.Shape();
  sh.moveTo(0, -0.3);
  sh.bezierCurveTo(-0.08, -0.22, -0.38, -0.05, -0.38, 0.12);
  sh.bezierCurveTo(-0.38, 0.3, -0.18, 0.38, 0, 0.22);
  sh.bezierCurveTo(0.18, 0.38, 0.38, 0.3, 0.38, 0.12);
  sh.bezierCurveTo(0.38, -0.05, 0.08, -0.22, 0, -0.3);
  return sh;
}
function boltShape() {
  const sh = new THREE.Shape();
  [[0.08, 0.5], [-0.2, 0.02], [0.0, 0.02], [-0.1, -0.5], [0.22, 0.08], [0.02, 0.08], [0.18, 0.5]].forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y)));
  sh.closePath();
  return sh;
}
function plusShape() {
  const a = 0.12;
  const b = 0.38;
  const sh = new THREE.Shape();
  [[-a, b], [a, b], [a, a], [b, a], [b, -a], [a, -a], [a, -b], [-a, -b], [-a, -a], [-b, -a], [-b, a], [-a, a]].forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y)));
  sh.closePath();
  return sh;
}
class Helix extends THREE.Curve {
  constructor(r, h, turns) {
    super();
    Object.assign(this, { r, h, turns });
  }
  getPoint(t, target = new THREE.Vector3()) {
    const a = t * Math.PI * 2 * this.turns;
    return target.set(Math.cos(a) * this.r, t * this.h, Math.sin(a) * this.r);
  }
}

// ---------------- 재질 ----------------
export function itemMaterials(envMap = null) {
  const key = envMap ? envMap.uuid : 'none';
  return once(`mats:${key}`, () => {
    const gloss = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08, envMap, envMapIntensity: 0.6, ...o });
    const matte = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, envMap, envMapIntensity: 0.5, ...o });
    return {
      balloon: gloss(0x2f8cff, { sheen: 0.4, sheenColor: new THREE.Color(0x9fdcff) }),
      balloonDark: gloss(0x1a5fd0),
      drop: gloss(0xff8a1a, { emissive: 0xff4a00, emissiveIntensity: 0.15 }),
      gemPurple: gloss(0xb04aff, { transparent: true, opacity: 0.92 }),
      gemBlue: gloss(0x2fa8ff, { transparent: true, opacity: 0.92 }),
      gemRed: gloss(0xff2f5a, { transparent: true, opacity: 0.92 }),
      gemGreen: gloss(0x6be04a, { transparent: true, opacity: 0.92 }),
      gemYellow: gloss(0xffd23a, { transparent: true, opacity: 0.92 }),
      splash: new THREE.MeshPhysicalMaterial({ color: 0x7fd8ff, roughness: 0.05, transparent: true, opacity: 0.55, depthWrite: false, envMap }),
      white: gloss(0xffffff, { roughness: 0.35 }),
      whiteMatte: matte(0xf4f6fb),
      purple: gloss(0x5a3ad0, { roughness: 0.35 }),
      purpleDark: gloss(0x3a2690, { roughness: 0.35 }),
      blueShoe: gloss(0x2f6fff, { roughness: 0.3 }),
      yellow: gloss(0xffc21a, { emissive: 0x8a5a00, emissiveIntensity: 0.25 }),
      lime: gloss(0x8fdc2a, { roughness: 0.3 }),
      gold: gloss(0xffc83a, { metalness: 0.65, roughness: 0.22, emissive: 0x6a4000, emissiveIntensity: 0.25 }),
      shieldBlue: gloss(0x1f7aff, { emissive: 0x0a2a8a, emissiveIntensity: 0.25 }),
      shieldLight: gloss(0x6fc0ff),
      navy: gloss(0x24306a, { metalness: 0.2 }),
      steel: gloss(0xc8d0de, { metalness: 0.8, roughness: 0.25 }),
      orangeLens: gloss(0xff7a1a, { emissive: 0xff5000, emissiveIntensity: 0.6 }),
      rope: matte(0xb08a5a),
      spark: new THREE.MeshBasicMaterial({ color: 0xffe36a }),
      pink: gloss(0xff6f9e, { sheen: 0.3 }),
      green: gloss(0x3ccf5a),
      ice: new THREE.MeshPhysicalMaterial({ color: 0xc8f0ff, roughness: 0.04, transmission: 0, transparent: true, opacity: 0.5, clearcoat: 1, iridescence: 0.6, envMap, envMapIntensity: 1.2, depthWrite: false }),
      iceEdge: new THREE.MeshBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.35, wireframe: true }),
      clockOrange: gloss(0xff7a2a),
      clockFace: matte(0xfffaf0),
      dark: matte(0x2a2a3a),
      magnetRed: gloss(0xe8303e),
      magnetGrey: gloss(0x4a5060, { metalness: 0.5 }),
    };
  });
}

const mk = (geo, mat, pos = [0, 0, 0], scale = 1, rot = [0, 0, 0]) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  if (typeof scale === 'number') m.scale.setScalar(scale);
  else m.scale.set(...scale);
  m.rotation.set(...rot);
  m.castShadow = true;
  return m;
};

// 하이라이트 (유광 반사 느낌)
const shine = (pos, scale, rot = [0, 0, 0.5]) => mk(G.sphere(), once('mat:shine', () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })), pos, scale, rot);

function sneaker(M, upper, upperDark, extra) {
  const g = new THREE.Group();
  g.add(mk(G.rbox(0.62, 0.1, 0.26, 0.045), M.white, [0.02, -0.17, 0])); // 밑창
  g.add(mk(G.rbox(0.6, 0.04, 0.27, 0.02), upperDark, [0.02, -0.11, 0])); // 중창 라인
  g.add(mk(G.rbox(0.42, 0.2, 0.24, 0.08), upper, [-0.04, -0.01, 0])); // 몸통
  g.add(mk(G.sphere(), upper, [0.2, -0.05, 0], [0.14, 0.1, 0.12])); // 앞코
  g.add(mk(G.sphere(), M.white, [0.27, -0.09, 0], [0.07, 0.05, 0.1])); // 토캡
  g.add(mk(G.rbox(0.2, 0.32, 0.25, 0.08), upperDark, [-0.17, 0.12, 0])); // 발목(하이탑)
  g.add(mk(G.rbox(0.16, 0.05, 0.26, 0.025), M.white, [-0.17, 0.28, 0])); // 칼라
  g.add(mk(G.rbox(0.1, 0.24, 0.17, 0.04), upper, [-0.02, 0.12, 0], 1, [0, 0, -0.35])); // 혀
  for (let k = 0; k < 3; k++) g.add(mk(G.rbox(0.03, 0.02, 0.2, 0.01), M.white, [0.04 + k * 0.06, 0.07 - k * 0.04, 0], 1, [0, 0, -0.35])); // 끈
  extra?.(g);
  return g;
}

// ---------------- 아이템별 모델 ----------------
const BUILDERS = {
  // 물풍선 증가: 반짝이는 파란 물풍선 + 매듭
  bomb(M) {
    const g = new THREE.Group();
    g.add(mk(lathe('balloon', BALLOON_PTS), M.balloon, [0, 0.04, 0], 0.62));
    g.add(mk(G.torus(0.05, 0.022), M.balloonDark, [0, -0.28, 0], 1, [Math.PI / 2, 0, 0]));
    g.add(mk(G.cone(), M.balloonDark, [0, -0.34, 0], [0.07, 0.08, 0.07]));
    g.add(shine([-0.1, 0.18, 0.18], [0.06, 0.1, 0.03], [0, 0, 0.5]));
    g.add(shine([-0.15, 0.04, 0.2], [0.025, 0.025, 0.02]));
    return g;
  },
  // 물줄기 확장: 가운데 주황 물방울 + 주변 젤리 방울 + 물보라
  range(M) {
    const g = new THREE.Group();
    g.add(mk(lathe('drop', DROP_PTS), M.drop, [0, -0.02, 0], 0.75, [0, 0, -0.35]));
    g.add(shine([-0.06, 0.08, 0.2], [0.05, 0.08, 0.03]));
    const gems = [M.gemPurple, M.gemBlue, M.gemRed, M.gemGreen, M.gemYellow, M.gemBlue];
    gems.forEach((mat, i) => {
      const a = (i / gems.length) * Math.PI * 2;
      const r = i % 2 ? 0.32 : 0.3;
      g.add(mk(lathe('drop', DROP_PTS), mat, [Math.cos(a) * r, Math.sin(a) * r * 0.8, -0.05], 0.3, [0, 0, a - Math.PI / 2]));
    });
    g.add(mk(G.torus(0.36, 0.025), M.splash, [0, 0, -0.06]));
    return g;
  },
  // 스피드 업: 보라 하이탑 운동화 + 노란 번개
  speed(M) {
    return sneaker(M, M.purple, M.blueShoe, (g) => {
      for (const z of [0.13, -0.13]) g.add(mk(extrude('bolt', boltShape, { depth: 0.02, bevelThickness: 0.01, bevelSize: 0.01 }), M.yellow, [-0.06, 0.03, z], 0.32, [0, 0, -0.9]));
      g.add(mk(extrude('bolt', boltShape, { depth: 0.02, bevelThickness: 0.01, bevelSize: 0.01 }), M.yellow, [-0.42, -0.02, 0], 0.42, [0, Math.PI / 2, -0.4]));
    });
  },
  // 방어막: 금테 파란 방패 + 반짝임
  shield(M) {
    const g = new THREE.Group();
    g.add(mk(extrude('shieldRim', () => shieldShape(1), { depth: 0.06, bevelThickness: 0.03, bevelSize: 0.03 }), M.gold, [0, 0, 0], 0.82));
    g.add(mk(extrude('shieldFace', () => shieldShape(0.82), { depth: 0.05, bevelThickness: 0.025, bevelSize: 0.02 }), M.shieldBlue, [0, 0, 0.045], 0.82));
    g.add(mk(extrude('shieldHi', () => shieldShape(0.5), { depth: 0.01, bevelThickness: 0.01, bevelSize: 0.01 }), M.shieldLight, [-0.05, 0.05, 0.085], [0.55, 0.82, 0.82]));
    g.add(mk(extrude('star4', () => starShape(4, 0.5, 0.14), { depth: 0.04, bevelThickness: 0.015, bevelSize: 0.01 }), M.gold, [0.3, 0.32, 0.05], 0.22));
    g.add(mk(extrude('star4', () => starShape(4, 0.5, 0.14), { depth: 0.04, bevelThickness: 0.015, bevelSize: 0.01 }), M.gold, [-0.33, -0.18, 0.05], 0.13));
    return g;
  },
  // 원격 폭발: 남색 폭탄 + 흰 띠 + 주황 렌즈 + 금속 뚜껑 + 심지 불꽃
  remote(M) {
    const g = new THREE.Group();
    g.add(mk(G.sphere(), M.navy, [0, -0.04, 0], 0.3));
    g.add(mk(G.cyl(), M.white, [0, -0.06, 0], [0.305, 0.1, 0.305]));
    g.add(mk(G.cyl(), M.steel, [0, -0.06, 0.29], [0.1, 0.05, 0.1], [Math.PI / 2, 0, 0]));
    g.add(mk(G.cyl(), M.orangeLens, [0, -0.06, 0.31], [0.075, 0.04, 0.075], [Math.PI / 2, 0, 0]));
    g.add(mk(G.cyl(), M.steel, [0, 0.27, 0], [0.11, 0.08, 0.11]));
    const fuse = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.3, 0), new THREE.Vector3(0.05, 0.38, 0), new THREE.Vector3(0.14, 0.4, 0.02), new THREE.Vector3(0.2, 0.36, 0.02)]);
    g.add(mk(once('geo:fuse', () => new THREE.TubeGeometry(fuse, 16, 0.022, 8)), M.rope));
    g.add(mk(G.sphere(), M.orangeLens, [0.21, 0.36, 0.02], 0.04));
    g.add(mk(extrude('star4', () => starShape(4, 0.5, 0.14), { depth: 0.04, bevelThickness: 0.015, bevelSize: 0.01 }), M.spark, [0.23, 0.38, 0.03], 0.16));
    g.add(shine([-0.12, 0.08, 0.22], [0.05, 0.08, 0.03]));
    return g;
  },
  // 생명 추가: 분홍 원 배지 + 흰 하트 + 초록 플러스
  life(M) {
    const g = new THREE.Group();
    g.add(mk(G.sphere(), M.pink, [0, 0.02, 0], [0.34, 0.34, 0.13]));
    g.add(mk(extrude('heart', heartShape, { depth: 0.06, bevelThickness: 0.03, bevelSize: 0.025 }), M.white, [0, 0.04, 0.12], 0.62));
    g.add(mk(G.sphere(), M.green, [0.24, -0.22, 0.12], [0.13, 0.13, 0.07]));
    g.add(mk(extrude('plus', plusShape, { depth: 0.04, bevelThickness: 0.015, bevelSize: 0.015 }), M.white, [0.24, -0.22, 0.18], 0.24));
    g.add(shine([-0.16, 0.18, 0.12], [0.05, 0.035, 0.02]));
    return g;
  },
  // 점프 슈즈: 보라·초록 운동화 + 초록 스프링
  jump(M) {
    const g = sneaker(M, M.purple, M.lime, (s) => {
      for (const z of [0.13, -0.13]) s.add(mk(G.rbox(0.18, 0.06, 0.01, 0.005), M.lime, [-0.02, 0.02, z], 1, [0, 0, 0.3]));
    });
    g.position.y = 0.1;
    const wrap = new THREE.Group();
    wrap.add(g);
    const helix = once('geo:spring', () => new THREE.TubeGeometry(new Helix(0.07, 0.16, 4), 80, 0.014, 8));
    for (const x of [-0.14, 0.18]) wrap.add(mk(helix, M.lime, [x, -0.25, 0]));
    return wrap;
  },
  // 시간 지연: 얼음 큐브 속 주황 자명종
  slow(M) {
    const g = new THREE.Group();
    const clock = new THREE.Group();
    clock.add(mk(G.cyl(), M.clockOrange, [0, 0, 0], [0.19, 0.09, 0.19], [Math.PI / 2, 0, 0]));
    clock.add(mk(G.cyl(), M.clockFace, [0, 0, 0.046], [0.15, 0.01, 0.15], [Math.PI / 2, 0, 0]));
    clock.add(mk(G.rbox(0.02, 0.11, 0.01, 0.005), M.dark, [0, 0.045, 0.055]));
    clock.add(mk(G.rbox(0.08, 0.02, 0.01, 0.005), M.dark, [0.035, 0, 0.055]));
    for (const sx of [-1, 1]) {
      clock.add(mk(G.sphere(), M.clockOrange, [sx * 0.12, 0.17, 0], [0.065, 0.045, 0.065], [0, 0, sx * -0.6]));
      clock.add(mk(G.rbox(0.03, 0.07, 0.03, 0.01), M.dark, [sx * 0.1, -0.2, 0], 1, [0, 0, sx * 0.4]));
    }
    clock.add(mk(G.sphere(), M.dark, [0, 0.21, 0], 0.025));
    clock.rotation.set(0.1, -0.35, 0.12);
    g.add(clock);
    const cube = mk(G.rbox(0.56, 0.56, 0.5, 0.08), M.ice, [0, 0, 0]);
    cube.renderOrder = 2;
    cube.castShadow = false;
    g.add(cube);
    const edge = mk(G.rbox(0.57, 0.57, 0.51, 0.08), M.iceEdge);
    edge.renderOrder = 3;
    g.add(edge);
    g.add(shine([-0.16, 0.18, 0.26], [0.09, 0.04, 0.01], [0, 0, 0.6]));
    return g;
  },
  // 아이템 자석: 말굽 자석 (빨강 몸체 + 은색 극)
  magnet(M) {
    const g = new THREE.Group();
    g.add(mk(G.torus(0.2, 0.085, Math.PI), M.magnetRed, [0, -0.04, 0], 1, [0, 0, Math.PI]));
    for (const sx of [-1, 1]) {
      g.add(mk(G.cyl(), M.magnetRed, [sx * 0.2, 0.08, 0], [0.085, 0.24, 0.085]));
      g.add(mk(G.cyl(), M.steel, [sx * 0.2, 0.25, 0], [0.087, 0.1, 0.087]));
    }
    g.add(shine([-0.24, 0.06, 0.08], [0.02, 0.08, 0.02], [0, 0, 0]));
    // 끌려오는 반짝이
    for (const [x, y, s] of [[0, 0.38, 0.14], [-0.13, 0.46, 0.09], [0.14, 0.5, 0.1]]) {
      g.add(mk(extrude('star4', () => starShape(4, 0.5, 0.14), { depth: 0.04, bevelThickness: 0.015, bevelSize: 0.01 }), M.yellow, [x, y, 0], s));
    }
    return g;
  },
};

export const ITEM_COLORS = { bomb: 0x2f8cff, range: 0xff8a1a, speed: 0x7a4aff, shield: 0x3d8bff, remote: 0x4a5a8a, life: 0xff6f9e, jump: 0x8fdc2a, slow: 0x4fd0ff, magnet: 0xe8303e };

export function buildItemModel(type, envMap = null) {
  const M = itemMaterials(envMap);
  return (BUILDERS[type] || BUILDERS.bomb)(M);
}
