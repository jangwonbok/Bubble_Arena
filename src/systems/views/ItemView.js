import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { toWorld } from '../../core/SceneManager.js';
import { buildItemModel, ITEM_COLORS } from './ItemModels.js';
import { ITEM_IDS } from '../items/itemDefs.js';

// 필드 위 아이템 표시 (오브젝트 풀) + UI용 아이콘 이미지 생성
export class ItemView {
  constructor(scene, bus, renderer) {
    this.scene = scene;
    this.active = new Map();
    this.pools = {};
    this.flying = [];
    this.icons = null;

    // 유광 반사용 환경맵 (아이템 재질에만 적용)
    this.envMap = null;
    if (renderer) {
      const pmrem = new THREE.PMREMGenerator(renderer);
      this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
    }

    this.padGeo = new THREE.CylinderGeometry(0.36, 0.4, 0.07, 32);
    this.ringGeo = new THREE.TorusGeometry(0.4, 0.022, 6, 40).rotateX(Math.PI / 2);
    this.glowGeo = new THREE.CircleGeometry(0.46, 32).rotateX(-Math.PI / 2);
    this.glowTex = this.makeGlowTexture();
    this.padMats = {};

    bus.on('itemSpawned', ({ item }) => this.add(item));
    bus.on('itemRemoved', ({ item, by, magnet }) => {
      if (magnet && by) this.flyTo(item, by);
      else this.remove(item);
    });
  }

  makeGlowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  padMat(type) {
    const col = ITEM_COLORS[type] ?? 0xffffff;
    return (this.padMats[type] ??= {
      pad: new THREE.MeshStandardMaterial({ color: col, roughness: 0.3, emissive: col, emissiveIntensity: 0.45 }),
      glow: new THREE.MeshBasicMaterial({ color: col, map: this.glowTex, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }),
    });
  }

  build(type) {
    const g = new THREE.Group();
    const m = this.padMat(type);
    const pad = new THREE.Mesh(this.padGeo, m.pad);
    pad.position.y = 0.035;
    pad.receiveShadow = true;
    const glow = new THREE.Mesh(this.glowGeo, m.glow);
    glow.position.y = 0.075;
    const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }));
    ring.position.y = 0.09;
    const icon = buildItemModel(type, this.envMap);
    icon.scale.setScalar(0.78);
    const holder = new THREE.Group();
    holder.position.y = 0.5;
    holder.add(icon);
    g.add(pad, glow, ring, holder);
    g.userData = { icon: holder, ring, glow, type };
    return g;
  }

  add(item) {
    const g = (this.pools[item.type] ??= []).pop() || this.build(item.type);
    g.position.set(toWorld(item.x), 0, toWorld(item.z));
    g.userData.age = 0;
    g.userData.phase = item.id;
    g.scale.setScalar(0.01);
    this.scene.add(g);
    this.active.set(item.id, g);
  }

  release(g) {
    this.scene.remove(g);
    (this.pools[g.userData.type] ??= []).push(g);
  }

  remove(item) {
    const g = this.active.get(item.id);
    if (!g) return;
    this.release(g);
    this.active.delete(item.id);
  }

  /** 자석: 아이템이 캐릭터에게 날아감 */
  flyTo(item, c) {
    const g = this.active.get(item.id);
    if (!g) return;
    this.active.delete(item.id);
    this.flying.push({ g, c, t: 0, x0: g.position.x, z0: g.position.z });
  }

  clear() {
    for (const f of this.flying) this.release(f.g);
    this.flying.length = 0;
    for (const g of this.active.values()) this.release(g);
    this.active.clear();
  }

  update(dt, time) {
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i];
      f.t += dt / 0.3;
      const k = Math.min(1, f.t);
      f.g.position.x = f.x0 + (toWorld(f.c.x) - f.x0) * k;
      f.g.position.z = f.z0 + (toWorld(f.c.z) - f.z0) * k;
      f.g.position.y = Math.sin(k * Math.PI) * 0.8;
      f.g.scale.setScalar(1 - k * 0.7);
      if (k >= 1) {
        this.release(f.g);
        this.flying.splice(i, 1);
      }
    }
    for (const g of this.active.values()) {
      const u = g.userData;
      u.age += dt;
      const a = Math.min(1, u.age / 0.35);
      g.scale.setScalar(a < 1 ? a * (1 + Math.sin(a * Math.PI) * 0.4) : 1);
      u.icon.position.y = 0.5 + Math.sin(time * 3 + u.phase) * 0.07;
      // 정면을 보여주며 좌우로 살랑 (참고 이미지처럼 아이콘 앞면이 잘 보이게)
      u.icon.rotation.y = Math.sin(time * 1.4 + u.phase) * 0.6;
      const pulse = (time * 1.2 + u.phase * 0.3) % 1;
      u.ring.scale.setScalar(1 + pulse * 0.45);
      u.ring.material.opacity = 0.5 * (1 - pulse);
      u.glow.material.opacity = 0.3 + Math.sin(time * 3 + u.phase) * 0.1;
    }
  }

  /** UI 아이콘 이미지 (data URL). 같은 3D 모델을 오프스크린에서 한 번씩 렌더링 */
  iconURL(type) {
    if (!this.icons) this.renderIcons();
    return this.icons[type] || '';
  }

  renderIcons() {
    this.icons = {};
    let r;
    try {
      const size = 160;
      r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      r.setSize(size, size, false);
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 0.95;
      const pmrem = new THREE.PMREMGenerator(r);
      const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xffffff, 0x8aa0c8, 0.7));
      const sun = new THREE.DirectionalLight(0xffffff, 1.7);
      sun.position.set(-2, 4, 5);
      scene.add(sun);
      const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
      cam.position.set(0, 0.25, 2.1);
      cam.lookAt(0, 0, 0);
      for (const type of ITEM_IDS) {
        const model = buildItemModel(type, env);
        model.rotation.y = -0.25;
        model.rotation.x = 0.08;
        scene.add(model);
        r.render(scene, cam);
        this.icons[type] = r.domElement.toDataURL('image/png');
        scene.remove(model);
      }
      pmrem.dispose();
      env.dispose();
    } catch (e) {
      console.warn('[ItemView] 아이콘 생성 실패', e);
    } finally {
      r?.dispose();
      r?.forceContextLoss();
    }
  }
}
