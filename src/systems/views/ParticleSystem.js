import * as THREE from 'three';

// InstancedMesh 기반 파티클 풀 (드로우콜 1회, 할당 없음)
export class ParticleSystem {
  constructor(scene, geometry, material, max = 600) {
    this.max = max;
    this.mesh = new THREE.InstancedMesh(geometry, material, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.p = [];
    for (let i = 0; i < max; i++) {
      this.p.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 0.1, rx: 0, ry: 0, spin: 0, gravity: 9 });
      this.mesh.setColorAt(i, new THREE.Color(1, 1, 1));
    }
    this.cursor = 0;
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
    this.hideAll();
    scene.add(this.mesh);
  }

  hideAll() {
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    for (let i = 0; i < this.max; i++) {
      this.p[i].life = 0;
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  emit(x, y, z, opts = {}) {
    const n = opts.count ?? 8;
    for (let k = 0; k < n; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      const p = this.p[i];
      const sp = opts.speed ?? 3;
      const a = Math.random() * Math.PI * 2;
      const h = Math.random() * sp;
      p.x = x + (Math.random() - 0.5) * (opts.spread ?? 0.3);
      p.y = y;
      p.z = z + (Math.random() - 0.5) * (opts.spread ?? 0.3);
      p.vx = Math.cos(a) * h + (opts.vx ?? 0);
      p.vz = Math.sin(a) * h + (opts.vz ?? 0);
      p.vy = (opts.up ?? 3) * (0.5 + Math.random());
      p.max = p.life = (opts.life ?? 0.7) * (0.6 + Math.random() * 0.6);
      p.s = (opts.size ?? 0.08) * (0.6 + Math.random() * 0.8);
      p.gravity = opts.gravity ?? 9;
      p.spin = (Math.random() - 0.5) * 12;
      p.rx = Math.random() * 6;
      p.ry = Math.random() * 6;
      const col = Array.isArray(opts.colors) ? opts.colors[(Math.random() * opts.colors.length) | 0] : opts.color ?? 0xffffff;
      this.color.set(col);
      this.mesh.setColorAt(i, this.color);
    }
    this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt) {
    const d = this.dummy;
    let any = false;
    for (let i = 0; i < this.max; i++) {
      const p = this.p[i];
      if (p.life <= 0) continue;
      any = true;
      p.life -= dt;
      p.vy -= p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.03) {
        p.y = 0.03;
        p.vy *= -0.3;
        p.vx *= 0.7;
        p.vz *= 0.7;
      }
      p.rx += p.spin * dt;
      const k = Math.max(0, p.life / p.max);
      d.position.set(p.x, p.y, p.z);
      d.rotation.set(p.rx, p.ry, 0);
      d.scale.setScalar(p.life > 0 ? p.s * Math.min(1, k * 1.8) : 0);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    if (any || this._wasAny) this.mesh.instanceMatrix.needsUpdate = true;
    this._wasAny = any;
  }
}
