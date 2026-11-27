import * as THREE from 'three';
import { Assets } from '../../core/Assets.js';
import { toWorld } from '../../core/SceneManager.js';

// 투명하고 입체적인 물풍선 표현 (오브젝트 풀 재사용)
export class BombView {
  constructor(scene, bus, defs) {
    this.scene = scene;
    this.active = new Map(); // bomb.id → {group, bomb}
    this.pool = [];
    this.popping = []; // 터지는 중인 물풍선 (짧은 연출 후 풀로 반환)
    this.skinMats = defs.map(
      (d) =>
        new THREE.MeshPhysicalMaterial({
          // 밝은 물빛 + 캐릭터 색 살짝 + 은은한 자체 발광 (그늘에서도 칙칙하지 않게)
          color: new THREE.Color(d.color).lerp(new THREE.Color(0xffffff), 0.3),
          emissive: new THREE.Color(d.color),
          emissiveIntensity: 0.32,
          roughness: 0.06,
          metalness: 0,
          clearcoat: 1,
          clearcoatRoughness: 0.04,
          transparent: true,
          opacity: 0.82,
          sheen: 0.6,
          sheenColor: new THREE.Color(0xffffff),
        }),
    );
    // 속 물: 짙은 남색 → 맑은 하늘색 (투명한 껍질 너머로 비쳐 전체가 밝아 보이도록)
    this.coreMat = new THREE.MeshStandardMaterial({ color: 0xbfeaff, emissive: 0x6fc8ff, emissiveIntensity: 0.5, roughness: 0.2, transparent: true, opacity: 0.35 });
    this.knotMats = defs.map((d) => new THREE.MeshStandardMaterial({ color: new THREE.Color(d.color).lerp(new THREE.Color(0xffffff), 0.15), emissive: d.color, emissiveIntensity: 0.15, roughness: 0.35 }));
    this.shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    this.knotGeo = new THREE.ConeGeometry(0.07, 0.12, 10);

    bus.on('bombPlaced', ({ bomb }) => this.add(bomb));
    bus.on('bombExploded', ({ bomb, tiles }) => {
      this.remove(bomb);
      this.shockwave(bomb, tiles);
    });
  }

  /** 주변 폭발 충격: 가까운 물풍선일수록 크게 출렁임 (스프링에 속도 충격) */
  shockwave(bomb, tiles) {
    for (const { group, bomb: b } of this.active.values()) {
      const d = Math.abs(b.x - bomb.x) + Math.abs(b.z - bomb.z);
      if (d === 0 || d > 4) continue;
      const hit = tiles?.some((t) => t.x === b.x && t.z === b.z);
      const u = group.userData;
      u.jv += (hit ? 9 : 5) / d;
      u.tiltVX += (b.x - bomb.x) * (3 / d);
      u.tiltVZ += (b.z - bomb.z) * (3 / d);
    }
  }

  build() {
    const g = new THREE.Group();
    const skin = new THREE.Mesh(Assets.geo.sphere, this.skinMats[0]);
    skin.scale.set(0.34, 0.32, 0.34);
    skin.position.y = 0.34;
    skin.castShadow = true;
    skin.renderOrder = 1;
    const core = new THREE.Mesh(Assets.geo.sphere, this.coreMat);
    core.scale.setScalar(0.2);
    core.position.y = 0.32;
    const knot = new THREE.Mesh(this.knotGeo, this.knotMats[0]);
    knot.position.y = 0.68;
    knot.rotation.x = Math.PI;
    const knotBall = new THREE.Mesh(Assets.geo.sphereLow, this.knotMats[0]);
    knotBall.scale.setScalar(0.045);
    knotBall.position.y = 0.73;
    const shine = new THREE.Mesh(Assets.geo.sphereLow, this.shineMat);
    shine.scale.set(0.07, 0.1, 0.03);
    shine.position.set(-0.13, 0.48, 0.27);
    shine.rotation.z = 0.5;
    const shadow = new THREE.Mesh(Assets.geo.shadow, Assets.mat.shadow);
    shadow.scale.setScalar(0.7);
    shadow.position.y = 0.012;
    const antenna = new THREE.Group();
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6), new THREE.MeshStandardMaterial({ color: 0xd0d6e0, metalness: 0.6 }));
    rod.position.y = 0.85;
    const lamp = new THREE.Mesh(Assets.geo.sphereLow, new THREE.MeshBasicMaterial({ color: 0xff2a3a }));
    lamp.scale.setScalar(0.05);
    lamp.position.y = 1.0;
    antenna.add(rod, lamp);
    const body = new THREE.Group(); // 출렁임/기울기는 몸통에만 (그림자는 바닥에 고정)
    body.add(core, skin, knot, knotBall, shine, antenna);
    g.add(body, shadow);
    g.userData = { body, skin, knot, knotBall, antenna, lamp, shadow };
    return g;
  }

  add(bomb) {
    const g = this.pool.pop() || this.build();
    const ownerId = bomb.owner.def.id; // 외형(색) 기준
    g.userData.skin.material = this.skinMats[ownerId];
    g.userData.knot.material = this.knotMats[ownerId];
    g.userData.knotBall.material = this.knotMats[ownerId];
    g.position.set(toWorld(bomb.x), 0, toWorld(bomb.z));
    g.scale.setScalar(1);
    g.rotation.set(0, 0, 0);
    const u = g.userData;
    // 물리 상태 (모두 스프링/중력으로 적분 → 프레임레이트와 무관하게 부드러움)
    u.age = 0;
    u.s = 0.18; // 몸통 크기 (스프링 → 목표 크기)
    u.sv = 0;
    u.y = 0.42; // 손에서 툭 떨어뜨림
    u.vy = 0;
    u.j = 0; // 출렁임(찌그러짐) 스프링
    u.jv = 0;
    u.tiltX = 0; // 기울기 스프링 (충격/착지)
    u.tiltZ = 0;
    u.tiltVX = (Math.random() - 0.5) * 2;
    u.tiltVZ = (Math.random() - 0.5) * 2;
    u.phase = Math.random() * Math.PI * 2; // 숨쉬기 위상 (주파수를 적분 → 박자가 튀지 않음)
    u.spin = Math.random() * Math.PI * 2;
    u.landed = false;
    u.popT = -1;
    u.antenna.visible = !!bomb.remote;
    this.scene.add(g);
    this.active.set(bomb.id, { group: g, bomb });
  }

  /** 폭발: 바로 지우지 않고 짧게 부풀었다 터지는 연출 후 회수 */
  remove(bomb) {
    const e = this.active.get(bomb.id);
    if (!e) return;
    this.active.delete(bomb.id);
    e.group.userData.popT = 0;
    this.popping.push(e.group);
  }

  clear() {
    for (const e of this.active.values()) {
      this.scene.remove(e.group);
      this.pool.push(e.group);
    }
    this.active.clear();
    for (const g of this.popping) {
      this.scene.remove(g);
      this.pool.push(g);
    }
    this.popping.length = 0;
  }

  /**
   * 물풍선 모션 (물리 기반):
   *  1) 생성: 손에서 툭 떨어져 바닥에 통통 튀고, 크기는 스프링으로 '뽁' 부풀며 살짝 넘쳤다가 안정
   *  2) 대기: 부피를 유지한 채 숨쉬듯 출렁임. 터질 때가 가까울수록 점점 부풀고 박자가 빨라짐
   *     (주파수를 위상에 적분 → 박자가 빨라져도 끊기거나 튀지 않음)
   *  3) 직전 0.3초: 빵빵하게 부풀며 떨림 (예고 동작)
   *  4) 폭발: 0.1초 동안 납작하게 퍼지며 터짐 → 물줄기 중심 물보라로 이어짐
   *  + 주변 폭발 충격을 받으면 출렁이고 기울었다가 스프링으로 복원
   */
  update(dt, time) {
    const step = Math.min(dt, 1 / 30); // 큰 프레임 지연에도 스프링이 폭주하지 않도록
    for (const { group, bomb } of this.active.values()) {
      const u = group.userData;
      u.age += dt;
      const fuseP = bomb.remote ? 0.12 : Math.min(1, 1 - Math.max(0, bomb.timer) / bomb.fuse); // 0 → 1
      const left = bomb.remote ? Infinity : Math.max(0, bomb.timer);
      const antic = left < 0.3 ? 1 - left / 0.3 : 0; // 터지기 직전 예고

      // 1) 크기 스프링: 목표 = 서서히 부풂(ease-in) + 직전 부풂
      const target = 1 + 0.1 * fuseP * fuseP + 0.16 * antic * antic;
      u.sv += ((target - u.s) * 170 - u.sv * 10) * step;
      u.s += u.sv * step;

      // 2) 떨어뜨림: 중력 + 바닥 튕김 (튕길 때 찌그러짐 충격)
      if (!u.landed) {
        u.vy -= 22 * step;
        u.y += u.vy * step;
        if (u.y <= 0) {
          u.y = 0;
          if (u.vy < -1.2) {
            u.jv -= -u.vy * 2.2; // 착지 → 납작
            u.vy = -u.vy * 0.32;
          } else {
            u.vy = 0;
            u.landed = true;
          }
        }
      }

      // 3) 출렁임 스프링 (충격/착지) + 숨쉬기
      u.jv += (-u.j * 260 - u.jv * 9) * step;
      u.j += u.jv * step;
      // 박자: 1.6Hz → 최대 약 5Hz (60fps 에서도 한 주기 12프레임 이상 → 떨림이 아닌 출렁임으로 보임)
      const freq = 1.6 + fuseP * 2.6 + antic * 0.8; // Hz
      u.phase += dt * freq * Math.PI * 2;
      const breath = Math.sin(u.phase) * (0.026 + fuseP * 0.022) * (1 - antic * 0.5);
      const w = Math.max(-0.35, Math.min(0.35, breath + u.j * 0.12));
      // 부피 보존: 가로가 늘면 세로가 줄어듦
      const sx = u.s * (1 + w);
      const sy = u.s / ((1 + w) * (1 + w));

      // 4) 기울기 스프링 + 잔잔한 흔들림
      u.tiltVX += (-u.tiltX * 90 - u.tiltVX * 7) * step;
      u.tiltVZ += (-u.tiltZ * 90 - u.tiltVZ * 7) * step;
      u.tiltX += u.tiltVX * step;
      u.tiltZ += u.tiltVZ * step;
      const sway = Math.sin(u.phase * 0.5) * 0.04;

      const body = u.body;
      body.scale.set(sx, sy, sx);
      body.position.y = u.y;
      body.rotation.set(u.tiltZ * 0.25 + sway, 0, -u.tiltX * 0.25 + sway * 0.6);
      u.spin += dt * (0.25 + fuseP * 0.5);
      group.rotation.y = Math.sin(u.spin) * 0.25;
      // 직전 떨림 (작은 진동)
      const tremble = antic * 0.025;
      body.position.x = Math.sin(time * 61 + bomb.id) * tremble;
      body.position.z = Math.cos(time * 53 + bomb.id) * tremble;
      // 매듭은 몸통보다 한 박자 늦게 따라 흔들림 (2차 모션)
      u.knot.rotation.z = -w * 1.6 + u.tiltX * 0.2;
      u.knotBall.position.x = Math.sin(u.phase - 0.8) * 0.012;
      // 그림자: 공중에 있을수록 작고 옅음
      const sh = u.s * (1 + w * 0.6) * (1 - Math.min(0.5, u.y * 1.2));
      u.shadow.scale.setScalar(0.7 * sh);
      if (bomb.remote) u.lamp.visible = Math.floor(time * 4) % 2 === 0;
    }

    // 폭발: 0.1초 동안 가로로 퍼지며 납작해졌다가 사라짐 (물줄기 중심 물보라로 이어짐)
    const POP = 0.1;
    for (let i = this.popping.length - 1; i >= 0; i--) {
      const g = this.popping[i];
      const u = g.userData;
      u.popT += dt;
      const k = u.popT / POP;
      if (k >= 1) {
        this.scene.remove(g);
        this.pool.push(g);
        this.popping.splice(i, 1);
        continue;
      }
      const e = 1 - (1 - k) * (1 - k); // ease-out
      const s = u.s || 1;
      u.body.scale.set(s * (1 + e * 0.7), s * Math.max(0.05, 1 - e * 0.75), s * (1 + e * 0.7));
      u.body.position.y = 0;
      u.shadow.scale.setScalar(0.7 * s * (1 + e * 0.5));
    }
  }
}
