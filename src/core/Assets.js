import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// 공유 지오메트리 / 머티리얼 / 절차적 텍스처.
// 한 번만 생성하고 모든 오브젝트가 재사용 → 재시작 시 메모리 누수 없음.

function canvasTex(size, draw, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat !== 1) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
  }
  return t;
}

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function grassTexture() {
  return canvasTex(256, (ctx, s) => {
    const r = seeded(7);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) {
      const v = 215 + Math.floor(r() * 40);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      const x = r() * s, y = r() * s;
      ctx.fillRect(x, y, 2 + r() * 3, 2 + r() * 3);
    }
    // 잔디 잎
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 40; i++) {
      const x = r() * s, y = r() * s;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 2, y - 6, x + 4 * (r() - 0.5), y - 11);
      ctx.stroke();
    }
    // 테두리 음영 (타일 구분감)
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, 'rgba(255,255,255,0.18)');
    g.addColorStop(0.1, 'rgba(255,255,255,0)');
    g.addColorStop(0.92, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.16)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

function stoneTexture() {
  return canvasTex(256, (ctx, s) => {
    const r = seeded(21);
    ctx.fillStyle = '#c9ced6';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 500; i++) {
      const v = 175 + Math.floor(r() * 50);
      ctx.fillStyle = `rgba(${v},${v + 3},${v + 10},0.6)`;
      ctx.beginPath();
      ctx.arc(r() * s, r() * s, 2 + r() * 6, 0, Math.PI * 2);
      ctx.fill();
    }
    // 돌 균열 라인
    ctx.strokeStyle = 'rgba(110,118,132,0.55)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    const lines = [
      [[30, 40], [90, 70], [120, 60]],
      [[150, 190], [200, 170], [230, 200]],
      [[60, 180], [80, 215]],
      [[170, 40], [185, 90], [220, 100]],
    ];
    for (const l of lines) {
      ctx.beginPath();
      ctx.moveTo(l[0][0], l[0][1]);
      for (let i = 1; i < l.length; i++) ctx.lineTo(l[i][0], l[i][1]);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, s - 12, s - 12);
  });
}

function woodTexture() {
  return canvasTex(256, (ctx, s) => {
    const r = seeded(5);
    ctx.fillStyle = '#f0a040';
    ctx.fillRect(0, 0, s, s);
    // 판자
    const planks = 4;
    for (let i = 0; i < planks; i++) {
      const y = (i * s) / planks;
      ctx.fillStyle = i % 2 ? '#eb9632' : '#f4a944';
      ctx.fillRect(0, y, s, s / planks);
      ctx.strokeStyle = 'rgba(150,75,10,0.25)';
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 5; k++) {
        ctx.beginPath();
        const yy = y + 8 + r() * (s / planks - 16);
        ctx.moveTo(0, yy);
        ctx.bezierCurveTo(s * 0.3, yy + 4 * (r() - 0.5), s * 0.6, yy + 4 * (r() - 0.5), s, yy);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(120,55,5,0.45)';
      ctx.fillRect(0, y, s, 3);
    }
    // 프레임 + X 보강재
    ctx.strokeStyle = '#b8641a';
    ctx.lineWidth = 22;
    ctx.strokeRect(11, 11, s - 22, s - 22);
    ctx.strokeStyle = '#ffc56b';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, s - 8, s - 8);
    ctx.lineWidth = 16;
    ctx.strokeStyle = '#c87020';
    ctx.beginPath();
    ctx.moveTo(24, 24);
    ctx.lineTo(s - 24, s - 24);
    ctx.stroke();
    // 못
    ctx.fillStyle = '#7a8090';
    [[22, 22], [s - 22, 22], [22, s - 22], [s - 22, s - 22]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    });
  });
}

function dropletSprite() {
  return canvasTex(64, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(190,235,255,0.9)');
    g.addColorStop(1, 'rgba(120,200,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

function shadowBlob() {
  return canvasTex(128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.45)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

class AssetLibrary {
  init() {
    if (this.ready) return;
    this.ready = true;
    this.tex = {
      grass: grassTexture(),
      stone: stoneTexture(),
      wood: woodTexture(),
      droplet: dropletSprite(),
      shadow: shadowBlob(),
    };

    this.geo = {
      tile: new RoundedBoxGeometry(1, 0.3, 1, 2, 0.06),
      pillar: new RoundedBoxGeometry(0.92, 0.9, 0.92, 3, 0.12),
      wall: new RoundedBoxGeometry(1, 0.7, 1, 2, 0.1),
      block: new RoundedBoxGeometry(0.86, 0.82, 0.86, 3, 0.1),
      sphere: new THREE.SphereGeometry(1, 24, 16),
      sphereLow: new THREE.SphereGeometry(1, 10, 8),
      shadow: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    };

    this.mat = {
      tile: new THREE.MeshStandardMaterial({ map: this.tex.grass, roughness: 0.95 }),
      pillar: new THREE.MeshStandardMaterial({ map: this.tex.stone, roughness: 0.85 }),
      wall: new THREE.MeshStandardMaterial({ map: this.tex.stone, color: 0xb9bfcb, roughness: 0.9 }),
      block: new THREE.MeshStandardMaterial({ map: this.tex.wood, roughness: 0.7 }),
      shadow: new THREE.MeshBasicMaterial({ map: this.tex.shadow, transparent: true, depthWrite: false }),
    };
  }
}

export const Assets = new AssetLibrary();
