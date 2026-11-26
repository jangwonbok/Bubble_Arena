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

    // 물줄기 세그먼트 (풀)
    this.streamGeo = new THREE.CapsuleGeometry(0.36, 0.56, 6, 16).rotateZ(Math.PI / 2);
    this.coreGeo = new THREE.CapsuleGeometry(0.17, 0.66, 4, 10).rotateZ(Math.PI / 2);
    this.waterMat = new THREE.MeshStandardMaterial({
      color: 0x36a8ff, emissive: 0x1a6dff, emissiveIntensity: 0.5, roughness: 0.08, transparent: true, opacity: 0.86, depthWrite: false,
    });
    this.coreMat = new THREE.MeshBasicMaterial({ color: 0xc8eeff, transparent: true, opacity: 0.75, depthWrite: false });
    this.segPool = [];
    this.segs = [];

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

  acquireSeg() {
    let s = this.segPool.pop();
    if (!s) {
      const outer = new THREE.Mesh(this.streamGeo, this.waterMat);
      const core = new THREE.Mesh(this.coreGeo, this.coreMat);
      outer.renderOrder = 3;
      core.renderOrder = 4;
      s = new THREE.Group();
      s.add(outer, core);
    }
    this.scene.add(s);
    return s;
  }

  explosion(tiles) {
    let maxReach = 0;
    for (const t of tiles) {
      const s = this.acquireSeg();
      const wx = toWorld(t.x);
      const wz = toWorld(t.z);
      s.position.set(wx, 0.38, wz);
      s.rotation.set(0, 0, 0);
      let len = 1;
      if (!t.dir) {
        // 중심: 둥근 물보라 (가로·세로 겹침)
        s.userData.center = true;
      } else {
        s.userData.center = false;
        s.rotation.y = t.dir.dx !== 0 ? 0 : Math.PI / 2;
        if (t.end) len = 0.85;
      }
      s.userData.t = 0;
      s.userData.len = len;
      s.userData.delay = t.dir ? 0.012 * (Math.abs(t.x - tiles[0].x) + Math.abs(t.z - tiles[0].z)) : 0;
      s.scale.set(0.001, 0.001, 0.001);
      this.segs.push(s);
      maxReach++;

      this.droplets.emit(wx, 0.4, wz, {
        count: t.dir ? 5 : 16, speed: t.dir ? 1.8 : 3.2, up: t.dir ? 3.5 : 5,
        vx: t.dir ? t.dir.dx * 1.5 : 0, vz: t.dir ? t.dir.dz * 1.5 : 0,
        size: 0.07, colors: [0x7fd0ff, 0xd8f4ff, 0x3a9dff], life: 0.8,
      });
    }
    // 중심에 세로 방향 세그먼트 추가 (십자 모양)
    const c = tiles[0];
    const extra = this.acquireSeg();
    extra.position.set(toWorld(c.x), 0.38, toWorld(c.z));
    extra.rotation.set(0, Math.PI / 2, 0);
    extra.userData = { t: 0, len: 1, delay: 0, center: true };
    extra.scale.setScalar(0.001);
    this.segs.push(extra);

    this.addRing(c.x, c.z, 2.5);
    this.sm.addShake(0.08 + Math.min(0.12, maxReach * 0.006));
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

  clear() {
    for (const s of this.segs) {
      this.scene.remove(s);
      this.segPool.push(s);
    }
    this.segs.length = 0;
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
    const D = CONFIG.FLAME_DURATION;
    for (let i = this.segs.length - 1; i >= 0; i--) {
      const s = this.segs[i];
      const u = s.userData;
      u.t += dt;
      const t = u.t - u.delay;
      if (t >= D) {
        this.scene.remove(s);
        this.segPool.push(s);
        this.segs.splice(i, 1);
        continue;
      }
      if (t < 0) continue;
      const k = t / D;
      const grow = k < 0.15 ? k / 0.15 : k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : 1;
      const wob = 1 + Math.sin(time * 40 + i) * 0.06;
      const thick = grow * wob * (u.center ? 1.25 : 1);
      s.scale.set(u.len * (u.center ? 1 : Math.min(1, grow * 1.5)), thick, thick);
      s.position.y = 0.38 + (1 - grow) * -0.2;
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
