import * as THREE from 'three';
import { Assets } from '../../core/Assets.js';
import { toWorld } from '../../core/SceneManager.js';

// 투명하고 입체적인 물풍선 표현 (오브젝트 풀 재사용)
export class BombView {
  constructor(scene, bus, defs) {
    this.scene = scene;
    this.active = new Map(); // bomb.id → {group, bomb}
    this.pool = [];
    this.skinMats = defs.map(
      (d) =>
        new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(d.color).lerp(new THREE.Color(0x9fe3ff), 0.45),
          roughness: 0.08,
          metalness: 0,
          clearcoat: 1,
          clearcoatRoughness: 0.05,
          transparent: true,
          opacity: 0.78,
          sheen: 0.5,
        }),
    );
    this.coreMat = new THREE.MeshStandardMaterial({ color: 0x2a8cff, emissive: 0x0a3a8a, roughness: 0.3, transparent: true, opacity: 0.55 });
    this.knotMats = defs.map((d) => new THREE.MeshStandardMaterial({ color: d.color, roughness: 0.4 }));
    this.shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    this.knotGeo = new THREE.ConeGeometry(0.07, 0.12, 10);

    bus.on('bombPlaced', ({ bomb }) => this.add(bomb));
    bus.on('bombExploded', ({ bomb }) => this.remove(bomb));
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
    g.add(core, skin, knot, knotBall, shine, shadow, antenna);
    g.userData = { skin, knot, knotBall, antenna, lamp };
    return g;
  }

  add(bomb) {
    const g = this.pool.pop() || this.build();
    const ownerId = bomb.owner.def.id; // 외형(색) 기준
    g.userData.skin.material = this.skinMats[ownerId];
    g.userData.knot.material = this.knotMats[ownerId];
    g.userData.knotBall.material = this.knotMats[ownerId];
    g.position.set(toWorld(bomb.x), 0, toWorld(bomb.z));
    g.scale.setScalar(0.01);
    g.userData.age = 0;
    g.userData.antenna.visible = !!bomb.remote;
    this.scene.add(g);
    this.active.set(bomb.id, { group: g, bomb });
  }

  remove(bomb) {
    const e = this.active.get(bomb.id);
    if (!e) return;
    this.scene.remove(e.group);
    this.pool.push(e.group);
    this.active.delete(bomb.id);
  }

  clear() {
    for (const e of this.active.values()) {
      this.scene.remove(e.group);
      this.pool.push(e.group);
    }
    this.active.clear();
  }

  update(dt, time) {
    for (const { group, bomb } of this.active.values()) {
      group.userData.age += dt;
      const appear = Math.min(1, group.userData.age / 0.18);
      const pop = appear < 1 ? 1 + Math.sin(appear * Math.PI) * 0.35 : 1;
      const urgency = bomb.remote ? 0.15 : 1 - Math.max(0, bomb.timer) / bomb.fuse; // 0 → 1 (원격은 일정)
      const freq = 5 + urgency * 22;
      const amp = 0.04 + urgency * 0.08;
      const w = Math.sin(time * freq + bomb.id) * amp;
      group.scale.set((1 + w) * appear * pop, (1 - w) * appear * pop, (1 + w) * appear * pop);
      group.rotation.y = Math.sin(time * 2 + bomb.id) * 0.2;
      if (bomb.remote) group.userData.lamp.visible = Math.floor(time * 4) % 2 === 0;
    }
  }
}
