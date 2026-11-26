import * as THREE from 'three';
import { toWorld } from '../../core/SceneManager.js';
import { CONFIG } from '../../core/Config.js';

const WARN_COLOR = { eruption: 0xff4a1a, wave: 0x2f9cff, tide: 0x2f9cff, crumble: 0xffffff };

// 맵 위험 지역 연출: 경고 표시 → 분출 / 파도 / 구름 붕괴
export class HazardView {
  constructor(scene, bus, { effects, mapView, sm }) {
    this.scene = scene;
    this.effects = effects;
    this.mapView = mapView;
    this.sm = sm;
    this.size = CONFIG.MAP_SIZE;
    this.tides = [];
    this.warnPool = [];
    this.warns = []; // {mesh, hz, t}
    this.columns = []; // 용암 기둥
    this.colPool = [];
    this.waves = [];
    this.wavePool = [];
    this.hiddenTiles = new Map(); // hazard id → tiles

    this.warnGeo = new THREE.CircleGeometry(0.46, 28).rotateX(-Math.PI / 2);
    this.ringGeo = new THREE.RingGeometry(0.38, 0.47, 28).rotateX(-Math.PI / 2);
    this.colGeo = new THREE.CylinderGeometry(0.3, 0.42, 1, 12, 1, true);
    this.colMat = new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0xff5a00, emissiveIntensity: 1.4, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
    this.waveMat = new THREE.MeshStandardMaterial({ color: 0x3fb4ff, emissive: 0x1a6dff, emissiveIntensity: 0.3, roughness: 0.1, transparent: true, opacity: 0.85, depthWrite: false });
    this.foamMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, transparent: true, opacity: 0.95 });

    bus.on('hazardWarn', ({ hazard }) => this.warn(hazard));
    bus.on('hazardActive', ({ hazard }) => this.activate(hazard));
    bus.on('hazardEnd', ({ hazard }) => this.end(hazard));
  }

  pos(idx) {
    return [toWorld(idx % this.size), toWorld((idx / this.size) | 0)];
  }

  warn(hz) {
    for (const idx of hz.tiles) {
      let m = this.warnPool.pop();
      if (!m) {
        m = new THREE.Group();
        const disc = new THREE.Mesh(this.warnGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
        const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
        m.add(disc, ring);
      }
      const col = WARN_COLOR[hz.kind] ?? 0xffffff;
      m.children[0].material.color.setHex(col);
      m.children[1].material.color.setHex(col);
      const [x, z] = this.pos(idx);
      m.position.set(x, 0.02, z);
      this.scene.add(m);
      this.warns.push({ mesh: m, hz, t: 0 });
    }
  }

  clearWarns(hz) {
    for (let i = this.warns.length - 1; i >= 0; i--) {
      if (this.warns[i].hz.id !== hz.id) continue;
      this.scene.remove(this.warns[i].mesh);
      this.warnPool.push(this.warns[i].mesh);
      this.warns.splice(i, 1);
    }
  }

  activate(hz) {
    this.clearWarns(hz);
    if (hz.kind === 'eruption') {
      for (const idx of hz.tiles) {
        const [x, z] = this.pos(idx);
        const c = this.colPool.pop() || new THREE.Mesh(this.colGeo, this.colMat);
        c.position.set(x, 0, z);
        c.userData = { t: 0, life: hz.duration };
        this.scene.add(c);
        this.columns.push(c);
        this.effects.chips.emit(x, 0.4, z, { count: 8, speed: 2, up: 6, size: 0.07, colors: [0xff8a20, 0xffd060, 0x5a2a20], life: 1, gravity: 10 });
      }
      this.sm.addShake(0.2);
    } else if (hz.kind === 'wave') {
      const w = this.wavePool.pop() || this.buildWave();
      const [a, b] = hz.meta.band;
      const mid = toWorld((a + b) / 2);
      const horizontal = hz.meta.axis === 'x';
      w.rotation.y = horizontal ? Math.PI / 2 : 0; // 파도 벽은 진행 방향과 수직
      w.userData = { t: 0, life: hz.duration, horizontal, mid, dir: hz.meta.dir || 1 };
      this.scene.add(w);
      this.waves.push(w);
      for (const idx of hz.tiles) {
        const [x, z] = this.pos(idx);
        this.effects.droplets.emit(x, 0.5, z, { count: 3, speed: 1.5, up: 3, size: 0.07, colors: [0x7fd0ff, 0xffffff], life: 0.8 });
      }
      this.sm.addShake(0.12);
    } else if (hz.kind === 'tide') {
      // 양쪽 가장자리에서 바닷물이 밀려 들어옴
      const n = this.size;
      const depth = hz.meta.depth || 2;
      for (const side of [-1, 1]) {
        const w = new THREE.Mesh(this.tideGeo ??= new THREE.BoxGeometry(1, 1, 1), this.waveMat);
        const horizontal = hz.meta.axis === 'x';
        const len = n - 2;
        w.scale.set(horizontal ? depth : len, 0.5, horizontal ? len : depth);
        const edge = (n / 2 - 1 - depth / 2) * side;
        w.userData = { t: 0, life: hz.duration, horizontal, edge, side, depth };
        this.scene.add(w);
        this.tides.push(w);
      }
      for (const idx of hz.tiles) {
        const [x, z] = this.pos(idx);
        if (Math.random() < 0.4) this.effects.droplets.emit(x, 0.4, z, { count: 3, speed: 1.2, up: 2.5, size: 0.07, colors: [0x7fd0ff, 0xffffff], life: 0.8 });
      }
      this.sm.addShake(0.1);
    } else if (hz.kind === 'crumble') {
      for (const idx of hz.tiles) {
        const [x, z] = this.pos(idx);
        this.mapView.setTileHidden(idx, true);
        this.effects.droplets.emit(x, 0.1, z, { count: 10, speed: 1.4, up: 1.5, size: 0.12, color: 0xffffff, life: 0.9, gravity: 3 });
      }
      this.hiddenTiles.set(hz.id, hz.tiles);
    }
  }

  end(hz) {
    this.clearWarns(hz);
    const tiles = this.hiddenTiles.get(hz.id);
    if (tiles) {
      for (const idx of tiles) this.mapView.setTileHidden(idx, false);
      this.hiddenTiles.delete(hz.id);
    }
  }

  buildWave() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 24, 1, false, 0, Math.PI), this.waveMat);
    body.rotation.z = Math.PI / 2;
    body.scale.set(1.1, 2.2, 1.2);
    const foam = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 1.8, 4, 8), this.foamMat);
    foam.rotation.z = Math.PI / 2;
    foam.position.y = 1.05;
    g.add(body, foam);
    return g;
  }

  clear() {
    for (const w of this.warns) {
      this.scene.remove(w.mesh);
      this.warnPool.push(w.mesh);
    }
    this.warns.length = 0;
    for (const c of this.columns) {
      this.scene.remove(c);
      this.colPool.push(c);
    }
    this.columns.length = 0;
    for (const w of this.waves) {
      this.scene.remove(w);
      this.wavePool.push(w);
    }
    this.waves.length = 0;
    this.hiddenTiles.clear();
    for (const t of this.tides) this.scene.remove(t);
    this.tides.length = 0;
  }

  update(dt, time) {
    for (const w of this.warns) {
      w.t += dt;
      const k = Math.min(1, w.t / w.hz.warn);
      const freq = 4 + k * 14;
      const pulse = 0.5 + Math.sin(w.t * freq) * 0.5;
      w.mesh.children[0].material.opacity = 0.15 + k * 0.35 * pulse;
      w.mesh.children[1].material.opacity = 0.5 + pulse * 0.5;
      w.mesh.children[1].scale.setScalar(1.3 - k * 0.3);
    }
    for (let i = this.columns.length - 1; i >= 0; i--) {
      const c = this.columns[i];
      c.userData.t += dt;
      const k = c.userData.t / c.userData.life;
      if (k >= 1) {
        this.scene.remove(c);
        this.colPool.push(c);
        this.columns.splice(i, 1);
        continue;
      }
      const h = Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5) * 2.4 * (1 - Math.max(0, k - 0.7) / 0.3);
      c.scale.set(1 + Math.sin(time * 30) * 0.08, Math.max(0.01, h), 1);
      c.position.y = h / 2;
    }
    for (let i = this.tides.length - 1; i >= 0; i--) {
      const w = this.tides[i];
      const u = w.userData;
      u.t += dt;
      const k = u.t / u.life;
      if (k >= 1) {
        this.scene.remove(w);
        this.tides.splice(i, 1);
        continue;
      }
      // 바깥에서 들어왔다가 다시 빠져나감
      const inK = k < 0.2 ? k / 0.2 : k > 0.75 ? Math.max(0, 1 - (k - 0.75) / 0.25) : 1;
      const off = u.edge + u.side * (1 - inK) * (u.depth + 1);
      if (u.horizontal) w.position.set(off, 0.2 + Math.sin(time * 6) * 0.04, 0);
      else w.position.set(0, 0.2 + Math.sin(time * 6) * 0.04, off);
    }
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      const u = w.userData;
      u.t += dt;
      const k = u.t / u.life;
      if (k >= 1) {
        this.scene.remove(w);
        this.wavePool.push(w);
        this.waves.splice(i, 1);
        continue;
      }
      // 파도: 맵 한쪽에서 반대쪽으로 쓸고 지나감
      const sweep = (k * 2 - 1) * 9 * u.dir;
      if (u.horizontal) w.position.set(sweep, 0, u.mid);
      else w.position.set(u.mid, 0, sweep);
      const s = Math.sin(Math.min(1, k * 3) * Math.PI * 0.5) * (1 - Math.max(0, k - 0.8) / 0.2);
      w.scale.set(1, Math.max(0.01, s), 1);
    }
  }
}
