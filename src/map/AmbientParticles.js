import * as THREE from 'three';

// 맵별 환경 파티클 (눈, 불씨, 꽃잎, 반짝이, 구름 안개)
const PRESETS = {
  snow: { count: 420, color: 0xffffff, size: 0.16, vy: -0.9, sway: 0.5, opacity: 0.9, area: [32, 14, 28] },
  embers: { count: 260, color: 0xff8a30, size: 0.13, vy: 0.9, sway: 0.4, opacity: 0.9, area: [30, 10, 26], additive: true },
  petals: { count: 120, color: 0xffb3d1, size: 0.14, vy: -0.4, sway: 1.2, opacity: 0.85, area: [32, 10, 28] },
  sparkles: { count: 180, color: 0xfff6b0, size: 0.14, vy: 0.15, sway: 0.3, opacity: 1, area: [30, 8, 26], additive: true, twinkle: true },
  clouds: { count: 60, color: 0xffffff, size: 2.6, vy: 0, sway: 0.25, opacity: 0.35, area: [44, 4, 40], yOffset: -3.5 },
};

let spriteTex = null;
function sprite() {
  if (spriteTex) return spriteTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  spriteTex = new THREE.CanvasTexture(c);
  return spriteTex;
}

export class AmbientParticles {
  constructor(scene) {
    this.scene = scene;
    this.systems = new Map(); // preset → Points (캐시)
    this.active = null;
  }

  set(name) {
    if (this.active) this.active.visible = false;
    this.active = null;
    if (!name || !PRESETS[name]) return;
    if (!this.systems.has(name)) this.systems.set(name, this.build(PRESETS[name]));
    this.active = this.systems.get(name);
    this.active.visible = true;
  }

  build(p) {
    const pos = new Float32Array(p.count * 3);
    const seed = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * p.area[0];
      pos[i * 3 + 1] = Math.random() * p.area[1] + (p.yOffset || 0);
      pos[i * 3 + 2] = (Math.random() - 0.5) * p.area[2];
      seed[i] = Math.random() * 100;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: p.color,
      size: p.size,
      map: sprite(),
      transparent: true,
      opacity: p.opacity,
      depthWrite: false,
      blending: p.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const pts = new THREE.Points(geo, mat);
    pts.userData = { p, seed };
    pts.frustumCulled = false;
    pts.visible = false;
    this.scene.add(pts);
    return pts;
  }

  update(dt, time) {
    const pts = this.active;
    if (!pts) return;
    const { p, seed } = pts.userData;
    const a = pts.geometry.attributes.position.array;
    const y0 = p.yOffset || 0;
    for (let i = 0; i < p.count; i++) {
      const s = seed[i];
      a[i * 3] += Math.sin(time * 0.7 + s) * p.sway * dt;
      a[i * 3 + 1] += p.vy * dt * (0.6 + (s % 1));
      a[i * 3 + 2] += Math.cos(time * 0.5 + s) * p.sway * 0.5 * dt;
      if (a[i * 3 + 1] < y0) a[i * 3 + 1] += p.area[1];
      if (a[i * 3 + 1] > y0 + p.area[1]) a[i * 3 + 1] -= p.area[1];
    }
    pts.geometry.attributes.position.needsUpdate = true;
    if (p.twinkle) pts.material.opacity = 0.6 + Math.sin(time * 5) * 0.4;
  }
}
