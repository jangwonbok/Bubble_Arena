import * as THREE from 'three';
import { CONFIG } from '../../core/Config.js';
import { Assets } from '../../core/Assets.js';
import { toWorld } from '../../core/SceneManager.js';
import { ParticleSystem } from './ParticleSystem.js';

// 십자형 물줄기, 물 튀김 파티클, 파편, 반짝임 등 모든 이펙트
export class EffectsView {
  constructor(scene, bus, sceneManager) {
    this.scene = scene;
    this.sm = sceneManager;

    // 물줄기: 방향별 한 줄기(arm) + 중심 물보라(burst). 풀에서 재사용, 개체마다 재질 복제(개별 페이드)
    // 줄기 몸통: 반지름 1, 길이 1, +X 방향으로 0→1 (scale.x = 길이, scale.y/z = 굵기)
    this.armGeo = new THREE.CylinderGeometry(1, 1, 1, 18, 1, true).rotateZ(-Math.PI / 2).translate(0.5, 0, 0);
    this.tipGeo = new THREE.SphereGeometry(1, 18, 12);
    this.burstGeo = new THREE.SphereGeometry(1, 24, 16);
    this.waterMat = new THREE.MeshStandardMaterial({
      color: 0x36a8ff, emissive: 0x1a6dff, emissiveIntensity: 0.5, roughness: 0.08, transparent: true, opacity: 0.86, depthWrite: false,
    });
    this.coreMat = new THREE.MeshBasicMaterial({ color: 0xd4f2ff, transparent: true, opacity: 0.8, depthWrite: false });
    this.armPool = [];
    this.burstPool = [];
    this.blasts = []; // { arms: [...], burst, t, ox, oz }

    // 바닥 물결 링
    this.ringGeo = new THREE.RingGeometry(0.35, 0.5, 32).rotateX(-Math.PI / 2);
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xd6f3ff, transparent: true, opacity: 0.8, depthWrite: false });
    this.ringPool = [];
    this.rings = [];

    // 파티클
    this.droplets = new ParticleSystem(
      scene,
      new THREE.SphereGeometry(1, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, emissive: 0x3a8cff, emissiveIntensity: 0.25 }),
      700,
    );
    this.chips = new ParticleSystem(
      scene,
      new THREE.BoxGeometry(1, 0.5, 1.6),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }),
      240,
    );
    this.sparkles = new ParticleSystem(
      scene,
      new THREE.OctahedronGeometry(1, 0),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      200,
    );

    bus.on('bombExploded', ({ tiles }) => this.explosion(tiles));
    bus.on('blockDestroyed', ({ x, z }) =>
      this.chips.emit(toWorld(x), 0.5, toWorld(z), { count: 10, speed: 3, up: 4, size: 0.07, colors: [0xe08a2c, 0xf4b25a, 0xb8641a], life: 0.9, gravity: 12 }),
    );
    bus.on('trapped', ({ c }) => {
      this.droplets.emit(toWorld(c.x), 0.6, toWorld(c.z), { count: 16, speed: 2, up: 3, size: 0.06, colors: [0x9fe3ff, 0xffffff], life: 0.6 });
    });
    bus.on('rescued', ({ c, by }) => {
      this.droplets.emit(toWorld(c.x), 0.6, toWorld(c.z), { count: 24, speed: 3, up: 3, size: 0.07, colors: [0x9fe3ff, 0xffffff], life: 0.7 });
      this.sparkles.emit(toWorld(c.x), 1, toWorld(c.z), { count: 12, speed: 2, up: 3, size: 0.06, colors: [0xfff27a, 0xffffff], life: 0.8, gravity: 4 });
      this.addRing(c.x, c.z, 1.6);
    });
    bus.on('eliminated', ({ c }) => {
      this.droplets.emit(toWorld(c.x), 0.6, toWorld(c.z), { count: 40, speed: 4, up: 4.5, size: 0.08, colors: [0x9fe3ff, 0xffffff, c.def.color], life: 0.9 });
      this.addRing(c.x, c.z, 2.2);
      this.sm.addShake(0.15);
    });
    bus.on('itemRemoved', ({ item, by }) => {
      if (by) {
        this.sparkles.emit(toWorld(item.x), 0.6, toWorld(item.z), { count: 14, speed: 1.6, up: 3.5, size: 0.06, colors: [0xfff27a, 0xffffff, 0x7fe0ff], life: 0.7, gravity: 3 });
      } else {
        this.droplets.emit(toWorld(item.x), 0.4, toWorld(item.z), { count: 8, speed: 1.5, up: 2, size: 0.05, color: 0x9fe3ff, life: 0.5 });
      }
    });
    bus.on('shieldBlocked', ({ c }) => {
      this.sparkles.emit(toWorld(c.x), 0.6, toWorld(c.z), { count: 22, speed: 3, up: 3, size: 0.08, colors: [0xffd24a, 0x7fc8ff, 0xffffff], life: 0.8, gravity: 4 });
      this.addRing(c.x, c.z, 2);
    });
    bus.on('lifeUsed', ({ c }) => {
      this.sparkles.emit(toWorld(c.x), 0.8, toWorld(c.z), { count: 26, speed: 2, up: 4, size: 0.09, colors: [0xff5a8a, 0xffb3d1, 0xffffff], life: 1, gravity: 3 });
      this.addRing(c.x, c.z, 2.4);
    });
    bus.on('slowed', ({ c }) => {
      this.droplets.emit(toWorld(c.x), 0.9, toWorld(c.z), { count: 12, speed: 1, up: 1.5, size: 0.06, colors: [0x9fe3ff, 0xffffff], life: 0.9, gravity: 1 });
    });
    bus.on('itemSpawned', ({ item }) =>
      this.sparkles.emit(toWorld(item.x), 0.5, toWorld(item.z), { count: 8, speed: 1.2, up: 2.5, size: 0.05, color: 0xfff7b0, life: 0.6, gravity: 2 }),
    );
  }

  acquireArm() {
    let a = this.armPool.pop();
    if (!a) {
      const outerMat = this.waterMat.clone();
      const coreMat = this.coreMat.clone();
      const body = new THREE.Mesh(this.armGeo, outerMat);
      const core = new THREE.Mesh(this.armGeo, coreMat);
      const tip = new THREE.Mesh(this.tipGeo, outerMat);
      const tipCore = new THREE.Mesh(this.tipGeo, coreMat);
      body.renderOrder = 3;
      tip.renderOrder = 3;
      core.renderOrder = 4;
      tipCore.renderOrder = 4;
      a = new THREE.Group();
      a.add(body, core, tip, tipCore);
      a.userData = { body, core, tip, tipCore, outerMat, coreMat };
    }
    this.scene.add(a);
    return a;
  }

  acquireBurst() {
    let b = this.burstPool.pop();
    if (!b) {
      const outerMat = this.waterMat.clone();
      const coreMat = this.coreMat.clone();
      const outer = new THREE.Mesh(this.burstGeo, outerMat);
      const core = new THREE.Mesh(this.burstGeo, coreMat);
      outer.renderOrder = 3;
      core.renderOrder = 4;
      core.scale.setScalar(0.55);
      b = new THREE.Group();
      b.add(outer, core);
      b.userData = { outerMat, coreMat };
    }
    this.scene.add(b);
    return b;
  }

  explosion(tiles) {
    const c = tiles[0];
    const ox = toWorld(c.x);
    const oz = toWorld(c.z);
    const blast = { t: 0, arms: [], burst: null, seed: Math.random() * 10 };

    // 방향별 도달 거리 계산 → 방향마다 이어진 한 줄기로 표현 (칸마다 끊기지 않음)
    const reach = new Map();
    for (const t of tiles) {
      if (!t.dir) continue;
      const key = `${t.dir.dx},${t.dir.dz}`;
      const dist = Math.abs(t.x - c.x) + Math.abs(t.z - c.z);
      const r = reach.get(key);
      if (!r || dist > r.dist) reach.set(key, { dir: t.dir, dist, end: t.end });
    }
    for (const { dir, dist } of reach.values()) {
      const a = this.acquireArm();
      a.position.set(ox, 0.36, oz);
      a.rotation.set(0, Math.atan2(-dir.dz, dir.dx), 0);
      a.userData.len = dist + 0.32; // 마지막 칸 중심보다 조금 더 (둥근 끝)
      a.userData.tiles = dist;
      a.userData.dir = dir;
      a.userData.splashed = false;
      a.visible = false;
      blast.arms.push(a);
    }

    const b = this.acquireBurst();
    b.position.set(ox, 0.38, oz);
    b.scale.setScalar(0.01);
    blast.burst = b;
    blast.ox = ox;
    blast.oz = oz;
    this.blasts.push(blast);

    // 중심 물보라 + 각 칸에서 약한 물 튀김
    this.droplets.emit(ox, 0.45, oz, { count: 18, speed: 3.2, up: 5, size: 0.075, colors: [0x7fd0ff, 0xd8f4ff, 0x3a9dff], life: 0.85 });
    for (const t of tiles) {
      if (!t.dir) continue;
      this.droplets.emit(toWorld(t.x), 0.4, toWorld(t.z), {
        count: 3, speed: 1.4, up: 2.6, vx: t.dir.dx * 1.2, vz: t.dir.dz * 1.2,
        size: 0.06, colors: [0x7fd0ff, 0xd8f4ff], life: 0.6,
      });
    }

    this.addRing(c.x, c.z, 2.5);
    this.sm.addShake(0.08 + Math.min(0.12, tiles.length * 0.006));
  }

  addRing(x, z, scale) {
    let r = this.ringPool.pop();
    if (!r) r = new THREE.Mesh(this.ringGeo, this.ringMat.clone());
    r.position.set(toWorld(x), 0.03, toWorld(z));
    r.userData = { t: 0, scale };
    r.scale.setScalar(0.1);
    this.scene.add(r);
    this.rings.push(r);
  }

  releaseBlast(b) {
    for (const a of b.arms) {
      this.scene.remove(a);
      this.armPool.push(a);
    }
    this.scene.remove(b.burst);
    this.burstPool.push(b.burst);
  }

  clear() {
    for (const b of this.blasts) this.releaseBlast(b);
    this.blasts.length = 0;
    for (const r of this.rings) {
      this.scene.remove(r);
      this.ringPool.push(r);
    }
    this.rings.length = 0;
    this.droplets.hideAll();
    this.chips.hideAll();
    this.sparkles.hideAll();
  }

  update(dt, time) {
    // 물줄기 타임라인 (판정 시간 FLAME_DURATION 과 맞춤)
    //  0 ~ EXT       : 중심에서 끝까지 빠르게 뻗어 나감 (ease-out)
    //  ~ FADE_START  : 출렁이며 유지
    //  FADE_START ~ D: 가늘어지고 투명해지며 바닥으로 가라앉음 (판정이 끝나는 SAFE_TAIL 즈음 거의 사라짐)
    const D = CONFIG.FLAME_DURATION;
    const EXT = 0.13;
    const FADE_START = D * 0.65;
    const END = D + 0.05;
    const easeOut = (x) => 1 - Math.pow(1 - x, 3);
    const easeOutBack = (x) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      const b = this.blasts[i];
      b.t += dt;
      const t = b.t;
      if (t >= END) {
        this.releaseBlast(b);
        this.blasts.splice(i, 1);
        continue;
      }
      const fade = t < FADE_START ? 0 : Math.min(1, (t - FADE_START) / (END - FADE_START));
      const fadeE = fade * fade; // ease-in
      const alpha = 1 - fadeE;

      // 중심 물보라: 톡 부풀었다가 줄기 굵기로 안정 → 함께 사라짐
      const bk = Math.min(1, t / 0.12);
      const burstR = (bk < 1 ? easeOutBack(bk) * 0.62 : 0.62 - Math.min(0.14, (t - 0.12) * 0.6)) * (1 - fadeE * 0.85);
      const bw = 1 + Math.sin(time * 26 + b.seed) * 0.05;
      b.burst.scale.set(burstR * bw, burstR * 0.8 / bw, burstR * bw);
      b.burst.position.y = 0.38 - fadeE * 0.18;
      b.burst.userData.outerMat.opacity = 0.86 * alpha;
      b.burst.userData.coreMat.opacity = 0.8 * alpha;

      for (let j = 0; j < b.arms.length; j++) {
        const a = b.arms[j];
        const u = a.userData;
        a.visible = true;
        const ext = easeOut(Math.min(1, t / (EXT * (0.7 + 0.3 * Math.min(u.tiles, 5) / 5))));
        const len = Math.max(0.05, u.len * ext);
        // 굵기: 뻗어 나가는 동안 살짝 두툼 → 유지(출렁임) → 가늘어짐
        const wave = 1 + Math.sin(time * 34 + j * 1.7 + b.seed) * 0.07;
        const swell = t < EXT ? 1.12 : 1;
        const thick = 0.33 * swell * wave * (1 - fadeE * 0.9);
        u.body.scale.set(len, thick, thick);
        u.core.scale.set(len, thick * 0.45, thick * 0.45);
        u.tip.position.x = len;
        u.tipCore.position.x = len;
        const tipR = thick * (1.08 + (1 - ext) * 0.25);
        u.tip.scale.setScalar(tipR);
        u.tipCore.scale.setScalar(tipR * 0.48);
        a.position.y = 0.36 - fadeE * 0.2;
        u.outerMat.opacity = 0.86 * alpha;
        u.coreMat.opacity = 0.8 * alpha;
        // 끝에 도달한 순간 물보라
        if (!u.splashed && ext >= 0.98) {
          u.splashed = true;
          const ex = b.ox + u.dir.dx * u.tiles;
          const ez = b.oz + u.dir.dz * u.tiles;
          this.droplets.emit(ex, 0.4, ez, {
            count: 7, speed: 1.8, up: 3.2, vx: u.dir.dx * 2, vz: u.dir.dz * 2,
            size: 0.065, colors: [0x7fd0ff, 0xd8f4ff, 0xffffff], life: 0.7,
          });
        }
      }
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.userData.t += dt;
      const k = r.userData.t / 0.6;
      if (k >= 1) {
        this.scene.remove(r);
        this.ringPool.push(r);
        this.rings.splice(i, 1);
        continue;
      }
      r.scale.setScalar(0.2 + k * r.userData.scale);
      r.material.opacity = 0.8 * (1 - k);
    }

    this.droplets.update(dt);
    this.chips.update(dt);
    this.sparkles.update(dt);
  }
}
