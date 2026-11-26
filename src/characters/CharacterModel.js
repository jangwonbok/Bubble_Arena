import * as THREE from 'three';
import { Assets } from '../core/Assets.js';
import { CONFIG } from '../core/Config.js';
import { toWorld } from '../core/SceneManager.js';
import { STATE } from './Character.js';

// 공유 지오메트리 (모든 캐릭터 공통)
let G = null;
function geos() {
  if (G) return G;
  G = {
    sphere: new THREE.SphereGeometry(1, 28, 20),
    cap: new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.42),
    brim: new THREE.CylinderGeometry(1, 1, 1, 24, 1, false, -Math.PI * 0.42, Math.PI * 0.84),
    cone: new THREE.ConeGeometry(1, 1, 12),
    mouth: new THREE.TorusGeometry(0.045, 0.014, 6, 12, Math.PI),
    bubble: new THREE.SphereGeometry(0.5, 32, 24),
    ring: new THREE.RingGeometry(0.42, 0.5, 64, 1, Math.PI / 2, Math.PI * 2),
    marker: new THREE.ConeGeometry(0.11, 0.2, 4),
  };
  return G;
}

const SKIN = new THREE.MeshStandardMaterial({ color: 0xffe3cf, roughness: 0.55 });
const EYE = new THREE.MeshStandardMaterial({ color: 0x1d1a2b, roughness: 0.3 });
const WHITE = new THREE.MeshBasicMaterial({ color: 0xffffff });
const BLUSH = new THREE.MeshBasicMaterial({ color: 0xff8fa8, transparent: true, opacity: 0.6 });
const MOUTH = new THREE.MeshBasicMaterial({ color: 0x6b2a2a });
const LEAF = new THREE.MeshStandardMaterial({ color: 0x5fd35c, roughness: 0.5 });
const BASE_SCALE = 1.3; // 캐릭터 전체 크기
const BLACK = new THREE.Color(0);

/**
 * GLB 파츠 찾기 + 회전 피벗 만들기.
 * 다리처럼 메시 원점이 모델 중심에 있는 파츠는 엉덩이(파츠 윗면 중앙)를 축으로 하는 피벗 그룹을 만든다.
 */
function buildRig(model) {
  model.updateMatrixWorld(true);
  const rig = { legs: [], arms: [], eyes: [], tails: [], antennas: [] };
  const byName = (re) => {
    const out = [];
    model.traverse((o) => { if (o.name && re.test(o.name)) out.push(o); });
    return out;
  };
  const sideOf = (o) => {
    const box = new THREE.Box3().setFromObject(o);
    const c = box.getCenter(new THREE.Vector3());
    return model.worldToLocal(c).x < 0 ? -1 : 1;
  };
  // 다리/발: 파츠 윗면 중앙에 피벗
  for (const leg of byName(/^(leg_l|leg_r|foot_l|foot_r)$/)) {
    if (!leg.isMesh) continue;
    leg.geometry.computeBoundingBox();
    const bb = leg.geometry.boundingBox.clone().applyMatrix4(leg.matrix);
    const pivotPos = new THREE.Vector3((bb.min.x + bb.max.x) / 2, bb.max.y, (bb.min.z + bb.max.z) / 2);
    const pivot = new THREE.Group();
    pivot.position.copy(pivotPos);
    leg.parent.add(pivot);
    pivot.add(leg);
    leg.position.sub(pivotPos);
    rig.legs.push({ pivot, side: /_l$/.test(leg.name) ? 1 : -1 });
  }
  // 팔/앞발: 변환을 가진 관절 노드를 그대로 회전
  for (const arm of byName(/^(arm_l|arm_r|paw_l|paw_r|arm_joint|hand_joint)$/)) {
    if (arm.isMesh && arm.parent && /_(l|r)$/.test(arm.parent.name)) continue;
    rig.arms.push({ node: arm, side: sideOf(arm), base: arm.rotation.clone() });
  }
  for (const eye of byName(/^(eye_l|eye_r|eyes_open)$/)) rig.eyes.push({ node: eye, base: eye.scale.y });
  for (const tail of byName(/^tail$/)) if (!tail.isMesh || !tail.parent || tail.parent.name !== 'tail') rig.tails.push({ node: tail, base: tail.rotation.y });
  for (const ant of byName(/^antenna$/)) rig.antennas.push({ node: ant, base: ant.rotation.z });
  return rig;
}

export class CharacterModel {
  constructor(def, scene) {
    const g = geos();
    this.def = def;
    this.root = new THREE.Group(); // 위치
    this.body = new THREE.Group(); // 회전 / 애니메이션
    this.root.add(this.body);

    this.mat = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.45, emissive: 0x000000 });
    this.accentMat = new THREE.MeshStandardMaterial({ color: def.accent, roughness: 0.5 });
    this.mats = [this.mat, this.accentMat];

    const add = (parent, geo, mat, pos, scale, shadow = true) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(...pos);
      if (typeof scale === 'number') m.scale.setScalar(scale);
      else m.scale.set(...scale);
      m.castShadow = shadow;
      parent.add(m);
      return m;
    };

    // 몸통
    this.torso = add(this.body, g.sphere, this.mat, [0, 0.27, 0], [0.2, 0.22, 0.18]);
    add(this.body, g.sphere, this.accentMat, [0, 0.3, 0.12], [0.06, 0.06, 0.04], false); // 단추
    // 발
    this.footL = add(this.body, g.sphere, this.mat, [-0.1, 0.06, 0.02], [0.08, 0.06, 0.11]);
    this.footR = add(this.body, g.sphere, this.mat, [0.1, 0.06, 0.02], [0.08, 0.06, 0.11]);
    // 손
    this.handL = add(this.body, g.sphere, SKIN, [-0.22, 0.28, 0], 0.07);
    this.handR = add(this.body, g.sphere, SKIN, [0.22, 0.28, 0], 0.07);

    // 머리 (2등신 → 머리가 몸만큼 큼)
    this.head = new THREE.Group();
    this.head.position.set(0, 0.64, 0);
    this.body.add(this.head);
    add(this.head, g.sphere, SKIN, [0, 0, 0], 0.33);
    // 얼굴
    this.eyes = [];
    for (const sx of [-1, 1]) {
      const eye = add(this.head, g.sphere, EYE, [sx * 0.115, 0.01, 0.29], [0.05, 0.075, 0.04], false);
      add(eye, g.sphere, WHITE, [0.3, 0.35, 0.6], [0.35, 0.3, 0.3], false);
      this.eyes.push(eye);
      const b = add(this.head, g.sphere, BLUSH, [sx * 0.2, -0.08, 0.255], [0.055, 0.03, 0.02], false);
      b.rotation.y = sx * 0.6;
    }
    this.mouth = add(this.head, g.mouth, MOUTH, [0, -0.08, 0.31], 1, false);
    this.mouth.rotation.z = Math.PI;

    this.buildHeadwear(def.style, add, g);

    // 그림자 블롭
    this.shadow = new THREE.Mesh(Assets.geo.shadow, Assets.mat.shadow);
    this.shadow.scale.setScalar(0.75);
    this.shadow.position.y = 0.012;
    this.root.add(this.shadow);

    // 팀 색 바닥 링 (밝은 파스텔 모델도 멀리서 구분되도록)
    this.teamRing = new THREE.Group();
    const ringMat = new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.9, depthWrite: false });
    const discMat = new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.22, depthWrite: false });
    const teamRingMesh = new THREE.Mesh(new THREE.RingGeometry(0.33, 0.41, 40).rotateX(-Math.PI / 2), ringMat);
    const teamDisc = new THREE.Mesh(new THREE.CircleGeometry(0.33, 40).rotateX(-Math.PI / 2), discMat);
    this.teamRing.add(teamDisc, teamRingMesh);
    this.teamRing.position.y = 0.016;
    this.teamRing.renderOrder = 1;
    this.root.add(this.teamRing);

    // 물방울 (갇힘)
    this.bubbleMat = new THREE.MeshPhysicalMaterial({
      color: 0xbfeeff,
      roughness: 0.05,
      metalness: 0,
      transparent: true,
      opacity: 0.38,
      clearcoat: 1,
      iridescence: 1,
      iridescenceIOR: 1.35,
      depthWrite: false,
    });
    this.bubble = new THREE.Mesh(g.bubble, this.bubbleMat);
    this.bubble.position.y = 0.45;
    this.bubble.renderOrder = 2;
    this.bubble.visible = false;
    this.root.add(this.bubble);
    this.bubbleShine = add(this.bubble, g.sphere, WHITE, [-0.22, 0.25, 0.42], [0.09, 0.06, 0.03], false);

    // 탈락 카운트다운 링
    this.ringGeo = g.ring.clone();
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0x5ad1ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
    this.ring = new THREE.Mesh(this.ringGeo, this.ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.03;
    this.ring.visible = false;
    this.root.add(this.ring);

    // 플레이어 표시 마커
    {  // "나" 표시 마커 (조작 중인 캐릭터에만 표시)
      this.marker = new THREE.Mesh(g.marker, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      this.marker.rotation.x = Math.PI;
      this.marker.position.y = 1.25;
      this.root.add(this.marker);
    }

    // ---- 아이템 효과 표시 ----
    this.fx = {};
    const fxMat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    this.fx.shield = new THREE.Mesh(g.bubble, new THREE.MeshPhysicalMaterial({ color: 0x7fc8ff, emissive: 0xffd24a, emissiveIntensity: 0.25, roughness: 0.1, transparent: true, opacity: 0.28, iridescence: 1, depthWrite: false }));
    this.fx.shield.position.y = 0.45;
    this.fx.shield.scale.setScalar(1.05);
    this.fx.jump = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.04, 8, 24).rotateX(Math.PI / 2), fxMat(0xb8f04a, 0.9));
    this.fx.jump.position.y = 0.04;
    this.fx.slow = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 6, 24).rotateX(Math.PI / 2), fxMat(0x6fd8ff, 0.9));
    this.fx.slow.position.y = 1.15;
    this.fx.magnet = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.025, 6, 36, Math.PI * 1.4).rotateX(Math.PI / 2), fxMat(0xff4d5e, 0.85));
    this.fx.magnet.position.y = 0.35;
    const heart = new THREE.Group();
    const hm = new THREE.MeshBasicMaterial({ color: 0xff5a8a });
    for (const sx of [-1, 1]) {
      const h = new THREE.Mesh(g.sphere, hm);
      h.scale.set(0.06, 0.06, 0.04);
      h.position.x = sx * 0.045;
      heart.add(h);
    }
    const tip = new THREE.Mesh(g.cone, hm);
    tip.scale.set(0.085, 0.09, 0.04);
    tip.rotation.z = Math.PI;
    tip.position.y = -0.06;
    heart.add(tip);
    heart.position.set(0.32, 1.05, 0);
    this.fx.life = heart;
    for (const m of Object.values(this.fx)) {
      m.visible = false;
      this.root.add(m);
    }

    this.walkPhase = 0;
    this.deadT = 0;
    this.yaw = 0;
    scene.add(this.root);
  }

  buildHeadwear(style, add, g) {
    const h = this.head;
    if (style === 'cap') {
      add(h, g.cap, this.mat, [0, 0.02, 0], 0.345);
      const brim = add(h, g.brim, this.mat, [0, 0.12, 0.05], [0.4, 0.025, 0.42]);
      brim.rotation.x = 0.12;
      add(h, g.sphere, this.accentMat, [0, 0.355, 0], 0.045);
      add(h, g.sphere, this.accentMat, [0, 0.22, 0.27], [0.08, 0.06, 0.03], false);
    } else if (style === 'spiky') {
      add(h, g.cap, this.mat, [0, 0.0, 0], 0.35);
      const spikes = [[0, 0.36, 0.05, 0], [-0.17, 0.3, 0.05, 0.6], [0.17, 0.3, 0.05, -0.6], [-0.09, 0.33, -0.15, 0.3], [0.09, 0.33, -0.15, -0.3]];
      for (const [x, y, z, r] of spikes) {
        const c = add(h, g.cone, this.mat, [x, y, z], [0.08, 0.2, 0.08]);
        c.rotation.z = r;
        c.rotation.x = z < 0 ? -0.4 : 0.1;
      }
      // 이마 밴드
      const band = add(h, g.sphere, this.accentMat, [0, 0.12, 0], [0.34, 0.04, 0.34], false);
      band.rotation.x = 0.15;
    } else if (style === 'sprout') {
      add(h, g.cap, this.mat, [0, 0.03, 0], 0.345);
      add(h, g.cone, LEAF, [0, 0.42, 0], [0.018, 0.14, 0.018]);
      const l1 = add(h, g.sphere, LEAF, [-0.08, 0.5, 0], [0.09, 0.03, 0.05]);
      l1.rotation.z = 0.5;
      const l2 = add(h, g.sphere, LEAF, [0.08, 0.5, 0], [0.09, 0.03, 0.05]);
      l2.rotation.z = -0.5;
      this.sprout = [l1, l2];
    } else if (style === 'cat') {
      add(h, g.cap, this.mat, [0, 0.03, 0], 0.345);
      for (const sx of [-1, 1]) {
        const ear = add(h, g.cone, this.mat, [sx * 0.19, 0.31, 0], [0.1, 0.18, 0.07]);
        ear.rotation.z = -sx * 0.45;
        const inner = add(h, g.cone, this.accentMat, [sx * 0.185, 0.3, 0.035], [0.055, 0.12, 0.03], false);
        inner.rotation.z = -sx * 0.45;
      }
    }
  }

  /**
   * GLB 모델 장착: 기존(절차적) 몸체를 숨기고 같은 body 그룹 안에 넣는다.
   * → 이동/회전/찌그러짐/점프 등 기존 애니메이션이 그대로 적용되고,
   *   이름 있는 파츠(다리·팔·눈·꼬리)는 아래 rig 로 개별 애니메이션.
   */
  attachGLB(wrapper) {
    if (this.glb) this.body.remove(this.glb);
    for (const ch of this.body.children) ch.visible = false;
    wrapper.scale.setScalar(1 / BASE_SCALE); // root 의 BASE_SCALE 상쇄 → 정규화 크기 그대로
    this.body.add(wrapper);
    this.body.rotation.order = 'YXZ';
    this.glb = wrapper;
    this.glbMats = wrapper.userData.mats;
    this.rig = buildRig(wrapper.userData.model);
    this.lastEmissive = null;
    // 더 큰 GLB 모델에 맞춰 물방울/방어막 크기 조정
    this.bubbleScale = 1.32;
    this.bubble.position.y = 0.55;
    this.fx.shield.scale.setScalar(1.38);
    this.fx.shield.position.y = 0.55;
  }

  setEmissive(r, g, b) {
    this.mat.emissive.setRGB(r, g, b);
    if (!this.glbMats) return;
    const key = `${r.toFixed(2)},${g.toFixed(2)},${b.toFixed(2)}`;
    if (key === this.lastEmissive) return;
    this.lastEmissive = key;
    const off = r + g + b === 0;
    for (const m of this.glbMats) {
      if (!m.emissive) continue;
      if (off) m.emissive.copy(m.userData.baseEmissive || BLACK);
      else m.emissive.setRGB(r, g, b);
    }
  }

  /** GLB 파츠 애니메이션 */
  animateRig(c, time, footSwing, handLift, blink, moving) {
    const rig = this.rig;
    for (const leg of rig.legs) leg.pivot.rotation.x = footSwing * 0.65 * leg.side;
    for (const arm of rig.arms) {
      const walk = moving ? -footSwing * 0.55 * arm.side : 0;
      const wave = handLift ? Math.sin(time * 12 + arm.side) * 0.25 : 0;
      arm.node.rotation.x = arm.base.x + walk * (1 - handLift);
      arm.node.rotation.z = arm.base.z + arm.side * (2.2 + wave) * handLift;
    }
    const closed = c.state === STATE.TRAPPED ? 0.35 : blink;
    for (const eye of rig.eyes) eye.node.scale.y = eye.base * closed;
    for (const tail of rig.tails) tail.node.rotation.y = tail.base + Math.sin(time * 5) * 0.45;
    for (const ant of rig.antennas) ant.node.rotation.z = ant.base + Math.sin(time * 4) * 0.15;
  }

  reset(c) {
    this.root.visible = true;
    this.root.scale.setScalar(BASE_SCALE);
    this.body.position.set(0, 0, 0);
    this.body.rotation.set(0, 0, 0);
    this.bubble.visible = false;
    this.ring.visible = false;
    this.shadow.visible = true;
    this.deadT = 0;
    this.yaw = 0;
    this.setEmissive(0, 0, 0);
    this.root.position.set(toWorld(c.x), 0, toWorld(c.z));
  }

  update(dt, c, time) {
    for (const m of Object.values(this.fx)) m.visible = false;
    this.root.position.x = toWorld(c.x);
    this.root.position.z = toWorld(c.z);

    // 방향 회전
    const targetYaw = Math.atan2(c.facing.dx, c.facing.dz);
    let d = targetYaw - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, dt * 14);

    const b = this.body;
    let bodyY = 0;
    let squashY = 1;
    let squashXZ = 1;
    let footSwing = 0;
    let handLift = 0;
    let roll = 0;
    let extraYaw = 0;

    if (c.state === STATE.DEAD) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 0.6);
      this.bubble.visible = false;
      this.ring.visible = false;
      this.root.scale.setScalar(Math.max(0.001, BASE_SCALE * (1 - k)));
      if (c.deathCause === 'fall') {
        b.position.y = -k * k * 4; // 허공으로 떨어짐
        this.shadow.visible = false;
      } else {
        b.position.y = k * 1.2;
      }
      if (c.deathCause === 'lava') this.setEmissive(1.2 * (1 - k), 0.3 * (1 - k), 0);
      b.rotation.y += dt * 12;
      if (k >= 1) this.root.visible = false;
      return;
    }

    if (c.state === STATE.TRAPPED) {
      this.bubble.visible = true;
      this.ring.visible = true;
      const frac = Math.max(0, c.trapTimer / CONFIG.TRAP_DURATION);
      this.ringGeo.setDrawRange(0, Math.ceil(frac * 64) * 6);
      this.ringMat.color.setHex(frac < 0.35 ? 0xff5a6e : frac < 0.65 ? 0xffc23a : 0x5ad1ff);
      const wob = Math.sin(time * 6) * 0.05;
      const bs = this.bubbleScale || 1;
      this.bubble.scale.set((1 + wob) * bs, (1 - wob) * bs, (1 + wob) * bs);
      this.bubbleMat.opacity = 0.32 + Math.sin(time * 3) * 0.06;
      bodyY = (this.glb ? 0.12 : 0.28) + Math.sin(time * 3) * 0.06;
      handLift = 1;
      roll = Math.sin(time * 5) * 0.25;
      squashY = 0.92;
      this.yaw += dt * 0.8;
    } else {
      this.bubble.visible = false;
      this.ring.visible = false;
      if (c.result === 'win') {
        const t = time * 7;
        bodyY = Math.abs(Math.sin(t)) * 0.35;
        handLift = 1;
        extraYaw = time * 4;
      } else if (c.result === 'lose') {
        bodyY = 0;
        squashY = 0.85;
        roll = Math.sin(time * 1.5) * 0.08;
        this.head.rotation.x = 0.35;
      } else if (c.moving) {
        this.walkPhase += dt * c.speed * 4.2;
        footSwing = Math.sin(this.walkPhase);
        bodyY = Math.abs(Math.sin(this.walkPhase)) * 0.06;
      } else {
        this.walkPhase = 0;
        squashY = 1 + Math.sin(time * 3 + this.def.id) * 0.025;
      }
      if (c.result !== 'lose') this.head.rotation.x = 0;
    }

    if (c.placeAnim > 0) {
      const k = c.placeAnim / 0.25;
      squashY *= 1 - Math.sin(k * Math.PI) * 0.22;
      squashXZ *= 1 + Math.sin(k * Math.PI) * 0.12;
    }
    if (c.hitAnim > 0) {
      extraYaw += c.hitAnim * 18;
      this.setEmissive(c.hitAnim * 1.5, c.hitAnim * 1.5, c.hitAnim * 1.5);
    } else {
      this.setEmissive(0, 0, 0);
    }

    // 아이템 효과
    if (c.state !== STATE.DEAD) {
      const fx = this.fx;
      if (c.jumpTime > 0) {
        bodyY += 0.12 + Math.abs(Math.sin(time * 9)) * 0.3; // 통통 튀며 공중
        fx.jump.visible = true;
        fx.jump.scale.setScalar(1 + Math.sin(time * 18) * 0.15);
      }
      if (c.shieldTime > 0) {
        fx.shield.visible = c.shieldTime > 2 || Math.floor(time * 8) % 2 === 0; // 끝나갈 때 깜빡임
        fx.shield.rotation.y = time;
        fx.shield.material.opacity = 0.22 + Math.sin(time * 4) * 0.06;
      }
      if (c.slowTime > 0) {
        fx.slow.visible = true;
        fx.slow.rotation.y = -time * 3;
        this.setEmissive(0.05, 0.25, 0.45); // 얼어붙은 듯한 푸른빛
      }
      if (c.magnetTime > 0) {
        fx.magnet.visible = true;
        fx.magnet.rotation.y = time * 4;
      }
      if (c.lives > 0) {
        fx.life.visible = true;
        fx.life.position.y = 1.05 + Math.sin(time * 3) * 0.05 + bodyY;
        fx.life.scale.setScalar(1 + Math.sin(time * 6) * 0.08);
      }
    }

    let pitch = 0;
    if (this.glb) {
      if (this.def.hover && c.state !== STATE.TRAPPED) bodyY += 0.1 + Math.sin(time * 3 + this.def.id) * 0.05; // 피코: 떠다님
      if (c.moving && !c.result) pitch = this.def.hover ? 0.22 : 0.1; // 진행 방향으로 살짝 기울임
      if (c.result === 'lose') pitch = 0.25; // 고개 숙임
      if (!c.moving && !this.def.hover && c.state === STATE.ALIVE) roll += Math.sin(time * 2 + this.def.id) * 0.03; // 대기 중 살랑
      if (c.moving && !this.def.hover) roll += Math.sin(this.walkPhase) * 0.06; // 뒤뚱뒤뚱
    }

    b.position.y = bodyY;
    b.scale.set(squashXZ, squashY, squashXZ);
    b.rotation.set(pitch, this.yaw + extraYaw, roll);

    this.footL.position.z = 0.02 + footSwing * 0.09;
    this.footR.position.z = 0.02 - footSwing * 0.09;
    this.footL.position.y = 0.06 + Math.max(0, footSwing) * 0.04;
    this.footR.position.y = 0.06 + Math.max(0, -footSwing) * 0.04;
    const handY = 0.28 + handLift * (0.22 + Math.sin(time * 14) * 0.04);
    this.handL.position.set(-0.22 - handLift * 0.05, handY, -footSwing * 0.08);
    this.handR.position.set(0.22 + handLift * 0.05, handY, footSwing * 0.08);

    // 눈 깜빡임
    const blink = (time + this.def.id * 1.3) % 3.2 < 0.12 ? 0.15 : 1;
    if (this.rig) this.animateRig(c, time, footSwing, handLift, blink, c.moving);
    for (const e of this.eyes) e.scale.y = 0.075 * (c.state === STATE.TRAPPED ? 0.3 : blink);

    if (this.sprout) {
      const s = Math.sin(time * 4) * 0.2;
      this.sprout[0].rotation.z = 0.5 + s;
      this.sprout[1].rotation.z = -0.5 - s;
    }

    // 무적(구출 직후) 깜빡임
    this.root.visible = !(c.invulnerable > 0 && Math.floor(time * 16) % 2 === 0);

    this.shadow.scale.setScalar(0.75 - bodyY * 0.5);
    this.teamRing.visible = c.state === STATE.ALIVE && !c.result;
    this.teamRing.scale.setScalar(c.isPlayer ? 1.05 + Math.sin(time * 4) * 0.04 : 1);
    if (this.marker) {
      this.marker.visible = c.isPlayer && c.state !== STATE.DEAD;
      this.marker.position.y = 1.3 + Math.sin(time * 4) * 0.06 + bodyY;
      this.marker.rotation.y = time * 2;
      this.marker.material.color.setHex(this.def.color);
    }
  }
}
