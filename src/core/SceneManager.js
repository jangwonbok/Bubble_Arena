import * as THREE from 'three';
import { CONFIG } from './Config.js';

const HALF = (CONFIG.MAP_SIZE - 1) / 2;
/** 타일 좌표 → 월드 좌표 */
export const toWorld = (t) => t - HALF;

// 렌더러 · 카메라 · 조명 · 씬 관리
export class SceneManager {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = this.makeSky();
    this.scene.fog = new THREE.Fog(0xbfe6ff, 30, 60);

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
    this.cameraMode = 'menu';
    this.menuAngle = 0;
    this.shake = 0;
    this.camTarget = new THREE.Vector3(0, 0, 0.6);
    this.gamePos = new THREE.Vector3(0, 19.8, 15.3);
    this.camera.position.copy(this.gamePos);
    this.camera.lookAt(this.camTarget);

    this.setupLights();
    this.onResize = this.onResize.bind(this);
    window.addEventListener('resize', this.onResize);
    this.onResize();
  }

  makeSky(stops = ['#5ec8ff', '#a9e3ff', '#e8f8ff']) {
    const key = stops.join();
    this.skyCache ??= new Map();
    if (this.skyCache.has(key)) return this.skyCache.get(key);
    const c = document.createElement('canvas');
    c.width = 2;
    c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, stops[0]);
    g.addColorStop(0.55, stops[1]);
    g.addColorStop(1, stops[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 2, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    this.skyCache.set(key, t);
    return t;
  }

  /** 맵별 조명 · 하늘 · 안개 적용 */
  applyEnvironment(env) {
    this.scene.background = this.makeSky(env.sky);
    this.scene.fog.color.setHex(env.fog.color);
    this.scene.fog.near = env.fog.near;
    this.scene.fog.far = env.fog.far;
    this.hemi.color.setHex(env.hemi.sky);
    this.hemi.groundColor.setHex(env.hemi.ground);
    this.hemi.intensity = env.hemi.intensity;
    this.sun.color.setHex(env.sun.color);
    this.sun.intensity = env.sun.intensity;
    this.renderer.toneMappingExposure = env.exposure ?? 1.05;
  }

  setupLights() {
    const hemi = new THREE.HemisphereLight(0xdff4ff, 0x6aa04a, 1.25);
    this.scene.add(hemi);
    this.hemi = hemi;

    const sun = new THREE.DirectionalLight(0xfff3dc, 2.4);
    sun.position.set(-7, 16, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = 13;
    Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 45 });
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 3;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;

    const fill = new THREE.DirectionalLight(0xbfe0ff, 0.5);
    fill.position.set(8, 6, -6);
    this.scene.add(fill);
  }

  setMode(mode) {
    this.cameraMode = mode;
  }

  addShake(amount) {
    this.shake = Math.min(0.35, this.shake + amount);
  }

  onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // 화면 비율이 좁으면 카메라를 뒤로 물려 맵 전체가 보이도록
    const aspectFactor = Math.max(1, 1.45 / this.camera.aspect);
    this.gamePos.set(0, 19.8 * aspectFactor, 15.3 * aspectFactor);
    this.camera.updateProjectionMatrix();
  }

  update(dt, time) {
    if (this.cameraMode === 'menu') {
      this.menuAngle += dt * 0.12;
      const r = 19.6;
      const target = new THREE.Vector3(Math.sin(this.menuAngle) * r, 12.4, Math.cos(this.menuAngle) * r);
      this.camera.position.lerp(target, Math.min(1, dt * 2));
      this.camera.lookAt(0, 0, 0);
    } else {
      this.camera.position.lerp(this.gamePos, Math.min(1, dt * 3.5));
      this.camera.lookAt(this.camTarget);
      if (this.shake > 0.001) {
        this.camera.position.x += (Math.random() - 0.5) * this.shake;
        this.camera.position.y += (Math.random() - 0.5) * this.shake;
        this.shake *= Math.pow(0.002, dt);
      }
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
