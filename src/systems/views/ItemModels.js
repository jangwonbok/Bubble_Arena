import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// 아이템 3D 모델 — 참고 아이콘 시트 기반.
// 원칙: 9종이 실루엣(외형)과 대표 색만으로 구분되도록
//   물풍선(파랑·매듭 위) / 물약병(주황·물기둥) / 날개 운동화(보라·노랑·날개) / 방패(금·파랑)
//   안테나 폭탄(강철·전파) / 하트(분홍·초록 십자) / 스프링 운동화(보라·연두·스프링)
//   얼음 스톱워치(하늘색·눈송이) / 말굽자석(빨강·파랑)
// 크기 기준: 약 0.75 × 0.75 (원점 중심). 필드(ItemView)와 UI 아이콘이 같은 모델 사용.

const cache = new Map();
const once = (k, fn) => (cache.has(k) ? cache.get(k) : (cache.set(k, fn()), cache.get(k)));

// ---------------- 공용 지오메트리 ----------------
const lathe = (key, pts, seg = 36) => once(`lathe:${key}`, () => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg));
const extrude = (key, shapeFn, opts) =>
  once(`ext:${key}`, () => {
    const g = new THREE.ExtrudeGeometry(shapeFn(), { curveSegments: 24, bevelSegments: 4, ...opts });
    g.center();
    return g;
  });
const G = {
  sphere: () => once('sphere', () => new THREE.SphereGeometry(1, 32, 24)),
  cyl: () => once('cyl', () => new THREE.CylinderGeometry(1, 1, 1, 32)),
  rbox: (w, h, d, r) => once(`rbox:${w}:${h}:${d}:${r}`, () => new RoundedBoxGeometry(w, h, d, 4, r)),
  torus: (r, t, arc = Math.PI * 2) => once(`torus:${r}:${t}:${arc}`, () => new THREE.TorusGeometry(r, t, 16, 48, arc)),
  cone: () => once('cone', () => new THREE.ConeGeometry(1, 1, 24)),
};

// 물풍선: 매듭이 위쪽 (참고 이미지처럼 둥근 몸통이 아래)
const BALLOON_PTS = [[0, -0.5], [0.16, -0.48], [0.29, -0.4], [0.37, -0.27], [0.4, -0.1], [0.37, 0.07], [0.29, 0.21], [0.18, 0.32], [0.09, 0.39], [0.06, 0.43], [0, 0.44]];
// 물방울 (끝이 위로)
const DROP_PTS = [[0, -0.3], [0.17, -0.28], [0.27, -0.18], [0.31, -0.02], [0.28, 0.12], [0.2, 0.25], [0.1, 0.37], [0.03, 0.45], [0, 0.48]];
// 물약병 (둥근 플라스크)
const FLASK_PTS = [[0, -0.32], [0.18, -0.31], [0.27, -0.24], [0.3, -0.1], [0.27, 0.04], [0.17, 0.13], [0.1, 0.17], [0.09, 0.3], [0.11, 0.33], [0.11, 0.36], [0, 0.36]];

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
    if (i === 0) sh.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else sh.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  sh.closePath();
  return sh;
}
function heartShape() {
  const sh = new THREE.Shape();
  sh.moveTo(0, -0.34);
  sh.bezierCurveTo(-0.1, -0.24, -0.42, -0.04, -0.42, 0.15);
  sh.bezierCurveTo(-0.42, 0.34, -0.2, 0.42, 0, 0.24);
  sh.bezierCurveTo(0.2, 0.42, 0.42, 0.34, 0.42, 0.15);
  sh.bezierCurveTo(0.42, -0.04, 0.1, -0.24, 0, -0.34);
  return sh;
}
function plusShape(a = 0.13, b = 0.38) {
  const sh = new THREE.Shape();
  [[-a, b], [a, b], [a, a], [b, a], [b, -a], [a, -a], [a, -b], [-a, -b], [-a, -a], [-b, -a], [-b, a], [-a, a]].forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y)));
  sh.closePath();
  return sh;
}
/** 깃털 3개짜리 날개 */
function wingShape() {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.quadraticCurveTo(0.1, 0.32, 0.42, 0.42);
  sh.quadraticCurveTo(0.34, 0.33, 0.36, 0.28);
  sh.quadraticCurveTo(0.46, 0.27, 0.5, 0.22);
  sh.quadraticCurveTo(0.38, 0.16, 0.4, 0.12);
  sh.quadraticCurveTo(0.46, 0.08, 0.46, 0.04);
  sh.quadraticCurveTo(0.2, 0.02, 0, 0);
  return sh;
}
/** 눈송이 (6갈래) */
function snowflakeShape() {
  const sh = new THREE.Shape();
  const n = 6;
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2;
    const r = i % 2 ? 0.14 : 0.5;
    if (i === 0) sh.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else sh.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
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
    const matte = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, envMap, envMapIntensity: 0.4, ...o });
    return {
      balloon: gloss(0x1878ff, { emissive: 0x0a3ab0, emissiveIntensity: 0.3 }),
      balloonDark: gloss(0x1460d8),
      water: new THREE.MeshPhysicalMaterial({ color: 0x2aa6ff, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.93, emissive: 0x0a58d0, emissiveIntensity: 0.4, envMap, envMapIntensity: 0.8 }),
      foam: gloss(0xeaf8ff, { emissive: 0x9fdcff, emissiveIntensity: 0.25 }),
      glass: new THREE.MeshPhysicalMaterial({ color: 0xfff2e0, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.28, depthWrite: false, envMap, envMapIntensity: 1 }),
      potion: gloss(0xff7a00, { emissive: 0xff4a00, emissiveIntensity: 0.6 }),
      cork: matte(0xb07840),
      white: gloss(0xffffff, { roughness: 0.35 }),
      black: gloss(0x24242e, { roughness: 0.4 }),
      purple: gloss(0x7a3ad8, { roughness: 0.3 }),
      purpleDark: gloss(0x4a2690, { roughness: 0.3 }),
      yellow: gloss(0xffc21a, { emissive: 0x8a5a00, emissiveIntensity: 0.25 }),
      lime: gloss(0x8fdc2a, { roughness: 0.3, emissive: 0x2a5000, emissiveIntensity: 0.2 }),
      springGreen: gloss(0x7fe04a, { metalness: 0.25, roughness: 0.25, emissive: 0x2a6010, emissiveIntensity: 0.25 }),
      speedLine: new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.85 }),
      gold: gloss(0xffc83a, { metalness: 0.65, roughness: 0.22, emissive: 0x6a4000, emissiveIntensity: 0.25 }),
      shieldBlue: gloss(0x1f7aff, { emissive: 0x0a2a8a, emissiveIntensity: 0.25 }),
      shieldLight: gloss(0x6fc0ff),
      steel: gloss(0x3a4258, { metalness: 0.55, roughness: 0.3 }),
      steelLight: gloss(0xb8c2d4, { metalness: 0.8, roughness: 0.22 }),
      red: gloss(0xff3a2a, { emissive: 0xd01000, emissiveIntensity: 0.7 }),
      wave: new THREE.MeshBasicMaterial({ color: 0xff6a3a, transparent: true, opacity: 0.85 }),
      heart: gloss(0xff4f8a, { emissive: 0x8a0a3a, emissiveIntensity: 0.25, sheen: 0.4 }),
      green: gloss(0x2fcf5a, { emissive: 0x0a5a20, emissiveIntensity: 0.2 }),
      ice: new THREE.MeshPhysicalMaterial({ color: 0xcff4ff, roughness: 0.04, transparent: true, opacity: 0.55, clearcoat: 1, iridescence: 0.5, envMap, envMapIntensity: 1.1, depthWrite: false }),
      watchFrame: gloss(0x8fd8ff, { metalness: 0.3, roughness: 0.2, emissive: 0x1a5a90, emissiveIntensity: 0.2 }),
      watchFace: matte(0xf6fbff),
      ink: matte(0x24466e),
      snow: new THREE.MeshBasicMaterial({ color: 0xe8f8ff }),
      magnetRed: gloss(0xe8303e),
      magnetBlue: gloss(0x2f6fe8),
      spark: new THREE.MeshBasicMaterial({ color: 0xfff27a }),
      star: gloss(0xffd23a, { emissive: 0xffa000, emissiveIntensity: 0.5 }),
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
const shine = (pos, scale, rot = [0, 0, 0.5]) => mk(G.sphere(), once('mat:shine', () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })), pos, scale, rot);
const star4 = () => extrude('star4', () => starShape(4, 0.5, 0.14), { depth: 0.04, bevelThickness: 0.015, bevelSize: 0.01 });

/** 운동화 공용 (밑창 색 · 몸통 색 · 포인트 색 지정) */
function sneaker(M, { upper, accent, sole, toe }) {
  const g = new THREE.Group();
  g.add(mk(G.rbox(0.64, 0.12, 0.27, 0.05), sole, [0.02, -0.17, 0])); // 밑창
  g.add(mk(G.rbox(0.62, 0.04, 0.28, 0.02), M.white, [0.02, -0.1, 0])); // 중창 라인
  g.add(mk(G.rbox(0.42, 0.2, 0.25, 0.08), upper, [-0.04, -0.0, 0])); // 몸통
  g.add(mk(G.sphere(), toe, [0.21, -0.05, 0], [0.15, 0.1, 0.13])); // 앞코
  g.add(mk(G.rbox(0.22, 0.34, 0.26, 0.09), upper, [-0.17, 0.13, 0])); // 발목(하이탑)
  g.add(mk(G.rbox(0.18, 0.06, 0.27, 0.025), accent, [-0.17, 0.3, 0])); // 칼라
  g.add(mk(G.rbox(0.1, 0.24, 0.18, 0.04), accent, [-0.02, 0.13, 0], 1, [0, 0, -0.35])); // 혀
  for (let k = 0; k < 3; k++) g.add(mk(G.rbox(0.03, 0.022, 0.22, 0.01), M.white, [0.04 + k * 0.06, 0.08 - k * 0.04, 0], 1, [0, 0, -0.35])); // 끈
  for (const z of [0.13, -0.13]) g.add(mk(G.rbox(0.26, 0.05, 0.012, 0.01), accent, [-0.04, 0.0, z], 1, [0, 0, 0.35])); // 옆 줄무늬
  return g;
}

// ---------------- 아이템별 모델 ----------------
const BUILDERS = {
  // 물풍선 증가: 매듭이 위로 묶인 파란 물풍선 + 물방울 + 반짝임
  bomb(M) {
    const g = new THREE.Group();
    g.add(mk(lathe('balloonTop', BALLOON_PTS), M.balloon, [0, -0.04, 0], 0.72));
    g.add(mk(G.torus(0.045, 0.02), M.balloonDark, [0, 0.29, 0], 1, [Math.PI / 2, 0, 0]));
    g.add(mk(G.cone(), M.balloonDark, [0, 0.33, 0], [0.065, 0.07, 0.065], [Math.PI, 0, 0]));
    g.add(shine([-0.12, 0.05, 0.25], [0.07, 0.11, 0.03], [0, 0, 0.4]));
    g.add(shine([-0.17, -0.12, 0.22], [0.03, 0.03, 0.02]));
    // 튀는 물방울
    g.add(mk(lathe('drop', DROP_PTS), M.water, [0.3, 0.24, 0.05], 0.14, [0, 0, -0.6]));
    g.add(mk(lathe('drop', DROP_PTS), M.water, [0.36, 0.08, 0.02], 0.1, [0, 0, -0.9]));
    g.add(mk(G.sphere(), M.water, [-0.33, 0.24, 0], 0.05));
    g.add(mk(star4(), M.spark, [0.06, -0.08, 0.3], 0.14));
    return g;
  },

  // 물줄기 확장: 물기둥이 솟구치는 주황 물약병
  range(M) {
    const g = new THREE.Group();
    const bottle = new THREE.Group();
    bottle.add(mk(lathe('flaskLiquid', FLASK_PTS.slice(0, 6).concat([[0, 0.04]])), M.potion, [0, 0, 0], 0.92));
    const glass = mk(lathe('flask', FLASK_PTS), M.glass, [0, 0, 0], 1);
    glass.renderOrder = 2;
    bottle.add(glass);
    bottle.add(mk(G.cyl(), M.cork, [0, 0.38, 0], [0.085, 0.07, 0.085]));
    bottle.add(shine([-0.13, -0.05, 0.22], [0.04, 0.09, 0.02], [0, 0, 0.3]));
    bottle.rotation.z = -0.5;
    bottle.scale.setScalar(1.25);
    bottle.position.set(-0.1, -0.12, 0);
    g.add(bottle);
    // 병 입구에서 솟구치는 물기둥 (부채꼴)
    const mouth = new THREE.Vector3(0.14, 0.24, 0);
    for (const [ang, len] of [[-0.9, 0.36], [-0.45, 0.46], [0, 0.5], [0.45, 0.4]]) {
      const jet = mk(lathe('drop', DROP_PTS), M.water, [mouth.x + Math.sin(-ang) * len * 0.5 + 0.05, mouth.y + Math.cos(ang) * len * 0.5, 0], [0.18, len * 1.3, 0.18], [0, 0, ang - 0.5]);
      g.add(jet);
    }
    g.add(mk(G.sphere(), M.foam, [0.18, 0.28, 0.02], [0.1, 0.07, 0.08]));
    for (const [x, y, s] of [[0.42, 0.5, 0.05], [0.05, 0.58, 0.04], [0.5, 0.25, 0.04]]) g.add(mk(G.sphere(), M.water, [x, y, 0], s));
    g.add(mk(star4(), M.spark, [-0.3, 0.3, 0.05], 0.13));
    return g;
  },

  // 스피드 업: 날개 달린 보라 운동화 + 노란 밑창 + 속도선
  speed(M) {
    const g = new THREE.Group();
    const shoe = sneaker(M, { upper: M.purple, accent: M.yellow, sole: M.yellow, toe: M.black });
    g.add(shoe);
    const wing = extrude('wing', wingShape, { depth: 0.03, bevelThickness: 0.012, bevelSize: 0.01 });
    for (const z of [0.15, -0.15]) g.add(mk(wing, z > 0 ? M.white : M.yellow, [-0.22, 0.26, z], 0.75, [0, 0, 0.25]));
    for (const [y, len] of [[0.05, 0.22], [-0.05, 0.3], [-0.15, 0.2]]) g.add(mk(G.cyl(), M.speedLine, [-0.5, y, 0], [0.012, len, 0.012], [0, 0, Math.PI / 2]));
    g.rotation.z = 0.12;
    return g;
  },

  // 방어막: 금테 파란 방패 + 반짝임
  shield(M) {
    const g = new THREE.Group();
    g.add(mk(extrude('shieldRim', () => shieldShape(1), { depth: 0.06, bevelThickness: 0.03, bevelSize: 0.03 }), M.gold, [0, 0, 0], 0.86));
    g.add(mk(extrude('shieldFace', () => shieldShape(0.82), { depth: 0.05, bevelThickness: 0.025, bevelSize: 0.02 }), M.shieldBlue, [0, 0, 0.045], 0.86));
    g.add(mk(extrude('shieldHi', () => shieldShape(0.5), { depth: 0.01, bevelThickness: 0.01, bevelSize: 0.01 }), M.shieldLight, [-0.06, 0.05, 0.088], [0.55, 0.86, 0.86]));
    g.add(mk(star4(), M.star, [0.33, 0.34, 0.05], 0.24));
    g.add(mk(star4(), M.star, [-0.36, -0.2, 0.05], 0.15));
    g.add(mk(star4(), M.spark, [-0.12, 0.2, 0.1], 0.1));
    return g;
  },

  // 원격 폭발: 강철 폭탄 + 금속 띠 + 빨간 렌즈 + 안테나 + 전파
  remote(M) {
    const g = new THREE.Group();
    g.add(mk(G.sphere(), M.steel, [0, -0.08, 0], 0.32));
    g.add(mk(G.torus(0.3, 0.035), M.steelLight, [0, -0.08, 0], 1, [0.25, 0, 0])); // 금속 띠
    g.add(mk(G.cyl(), M.steelLight, [-0.06, -0.1, 0.29], [0.085, 0.05, 0.085], [Math.PI / 2, 0, 0]));
    g.add(mk(G.cyl(), M.red, [-0.06, -0.1, 0.32], [0.06, 0.03, 0.06], [Math.PI / 2, 0, 0]));
    g.add(mk(G.rbox(0.06, 0.12, 0.04, 0.015), M.steelLight, [0.2, -0.06, 0.24], 1, [0, 0.6, 0])); // 측면 스위치
    g.add(mk(G.cyl(), M.steelLight, [0, 0.24, 0], [0.09, 0.06, 0.09]));
    g.add(mk(G.cyl(), M.steelLight, [0, 0.38, 0], [0.016, 0.24, 0.016]));
    g.add(mk(G.sphere(), M.red, [0, 0.52, 0], 0.055));
    // 전파 (안테나 끝에서 퍼지는 호)
    for (const [r, s] of [[0.11, 1], [0.18, -1]]) {
      for (const side of [-1, 1]) {
        g.add(mk(G.torus(r, 0.012, Math.PI / 2), M.wave, [0, 0.52, 0], 1, [0, 0, side > 0 ? -Math.PI / 4 : Math.PI * 0.75]));
      }
    }
    g.add(shine([-0.14, 0.04, 0.24], [0.05, 0.08, 0.03]));
    return g;
  },

  // 생명 추가: 큰 분홍 하트 + 초록 십자
  life(M) {
    const g = new THREE.Group();
    g.add(mk(extrude('heartBig', heartShape, { depth: 0.16, bevelThickness: 0.07, bevelSize: 0.05, bevelSegments: 6 }), M.heart, [0, 0.03, 0], 0.95));
    g.add(shine([-0.2, 0.17, 0.15], [0.07, 0.05, 0.02], [0, 0, 0.6]));
    g.add(mk(extrude('plusOutline', () => plusShape(0.17, 0.44), { depth: 0.05, bevelThickness: 0.015, bevelSize: 0.015 }), M.white, [0.24, -0.2, 0.17], 0.42));
    g.add(mk(extrude('plus', () => plusShape(0.12, 0.38), { depth: 0.07, bevelThickness: 0.015, bevelSize: 0.015 }), M.green, [0.24, -0.2, 0.2], 0.42));
    g.add(mk(star4(), M.spark, [-0.36, 0.34, 0.05], 0.12));
    g.add(mk(star4(), M.spark, [0.38, 0.3, 0.05], 0.09));
    return g;
  },

  // 점프 슈즈: 보라·연두 운동화 + 크고 굵은 스프링
  jump(M) {
    const wrap = new THREE.Group();
    const shoe = sneaker(M, { upper: M.purple, accent: M.lime, sole: M.purpleDark, toe: M.lime });
    shoe.position.y = 0.14;
    shoe.rotation.z = 0.15;
    wrap.add(shoe);
    const helix = once('geo:springBig', () => new THREE.TubeGeometry(new Helix(0.09, 0.26, 4.5), 120, 0.022, 8));
    for (const x of [-0.16, 0.18]) wrap.add(mk(helix, M.springGreen, [x, -0.4, 0]));
    // 튀어오르는 먼지
    for (const [x, s] of [[-0.3, 0.07], [0.32, 0.06]]) wrap.add(mk(G.sphere(), M.foam, [x, -0.38, 0.05], s));
    return wrap;
  },

  // 시간 지연: 얼음이 낀 하늘색 스톱워치 + 눈송이
  slow(M) {
    const g = new THREE.Group();
    g.add(mk(G.torus(0.27, 0.05), M.watchFrame, [0, -0.04, 0]));
    g.add(mk(G.cyl(), M.watchFace, [0, -0.04, 0], [0.26, 0.05, 0.26], [Math.PI / 2, 0, 0]));
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      g.add(mk(G.rbox(0.015, k % 3 ? 0.03 : 0.06, 0.01, 0.004), M.ink, [Math.sin(a) * 0.21, -0.04 + Math.cos(a) * 0.21, 0.03], 1, [0, 0, -a]));
    }
    g.add(mk(G.rbox(0.025, 0.15, 0.012, 0.006), M.ink, [0, 0.03, 0.04]));
    g.add(mk(G.rbox(0.11, 0.022, 0.012, 0.006), M.ink, [0.05, -0.04, 0.04], 1, [0, 0, 0.3]));
    g.add(mk(G.sphere(), M.ink, [0, -0.04, 0.045], 0.025));
    // 용두 + 옆 버튼
    g.add(mk(G.cyl(), M.watchFrame, [0, 0.29, 0], [0.04, 0.07, 0.04]));
    g.add(mk(G.cyl(), M.watchFrame, [0, 0.34, 0], [0.08, 0.04, 0.08]));
    g.add(mk(G.cyl(), M.watchFrame, [0.2, 0.22, 0], [0.03, 0.06, 0.03], [0, 0, -0.75]));
    // 얼음 덮개 + 고드름
    const iceCap = mk(G.sphere(), M.ice, [0, 0.0, 0.02], [0.36, 0.38, 0.14]);
    iceCap.renderOrder = 2;
    iceCap.castShadow = false;
    g.add(iceCap);
    for (const [x, h] of [[-0.18, 0.12], [-0.05, 0.16], [0.1, 0.11], [0.2, 0.08]]) g.add(mk(G.cone(), M.ice, [x, -0.34 - h / 2, 0.03], [0.03, h, 0.03], [Math.PI, 0, 0]));
    const flake = extrude('flake', snowflakeShape, { depth: 0.02, bevelThickness: 0.008, bevelSize: 0.006 });
    for (const [x, y, s] of [[-0.36, 0.28, 0.18], [0.37, 0.12, 0.14], [-0.34, -0.26, 0.12], [0.3, -0.32, 0.1]]) g.add(mk(flake, M.snow, [x, y, 0.05], s));
    return g;
  },

  // 아이템 자석: 빨강·파랑 말굽자석 + 은색 극 + 별
  magnet(M) {
    const g = new THREE.Group();
    const arc = G.torus(0.2, 0.085, Math.PI / 2);
    g.add(mk(arc, M.magnetRed, [0, -0.06, 0], 1, [0, 0, Math.PI])); // 왼쪽 아래 1/4
    g.add(mk(arc, M.magnetBlue, [0, -0.06, 0], 1, [0, 0, Math.PI * 1.5])); // 오른쪽 아래 1/4
    g.add(mk(G.cyl(), M.magnetRed, [-0.2, 0.06, 0], [0.085, 0.24, 0.085]));
    g.add(mk(G.cyl(), M.magnetBlue, [0.2, 0.06, 0], [0.085, 0.24, 0.085]));
    for (const x of [-0.2, 0.2]) g.add(mk(G.cyl(), M.steelLight, [x, 0.23, 0], [0.087, 0.1, 0.087]));
    g.add(shine([-0.25, 0.02, 0.08], [0.02, 0.09, 0.02], [0, 0, 0]));
    // 끌려오는 별
    for (const [x, y, s] of [[0, 0.4, 0.17], [-0.17, 0.5, 0.11], [0.19, 0.53, 0.12], [0.36, 0.38, 0.08]]) g.add(mk(star4(), M.star, [x, y, 0], s));
    // 자력선
    for (const r of [0.33, 0.43]) g.add(mk(G.torus(r, 0.01, Math.PI * 0.6), once('mat:field', () => new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.6 })), [0, 0.14, -0.02], 1, [0, 0, Math.PI * 0.2]));
    g.rotation.z = -0.15;
    return g;
  },
};

// UI 등에서 쓰는 대표 색
export const ITEM_COLORS = { bomb: 0x1f86ff, range: 0xff8a1a, speed: 0x7a3ad8, shield: 0xffc83a, remote: 0x3a4258, life: 0xff4f8a, jump: 0x8fdc2a, slow: 0x8fd8ff, magnet: 0xe8303e };

export function buildItemModel(type, envMap = null) {
  const M = itemMaterials(envMap);
  return (BUILDERS[type] || BUILDERS.bomb)(M);
}
