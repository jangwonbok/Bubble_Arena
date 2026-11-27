import * as THREE from 'three';
import { CONFIG } from './Config.js';
import { Device } from './Device.js';

const HALF = (CONFIG.MAP_SIZE - 1) / 2;
/** 타일 좌표 → 월드 좌표 */
export const toWorld = (t) => t - HALF;

// 렌더러 · 카메라 · 조명 · 씬 관리
export class SceneManager {
  constructor(canvas) {
    // 모바일: 안티앨리어싱 대신 적당한 해상도(최대 1.5배)로 → 발열/배터리·프레임 안정
    this.lowPower = Device.lowPower;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.lowPower || window.devicePixelRatio < 2, powerPreference: 'high-performance' });
    this.maxPixelRatio = this.lowPower ? 1.5 : 2;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.maxPixelRatio));
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
    // 화면 회전: 일부 모바일 브라우저는 회전 직후 크기를 늦게 알려 줌 → 한 번 더 맞춤
    window.addEventListener('orientationchange', () => setTimeout(this.onResize, 250));
    Device.onChange(this.onResize);
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
    this.fogBase = { near: env.fog.near, far: env.fog.far };
    this.applyFog();
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
    const shadowRes = this.lowPower ? 1024 : 2048;
    sun.shadow.mapSize.set(shadowRes, shadowRes);
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.maxPixelRatio));
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    const portrait = aspect < 0.85;
    // 세로 화면은 시야각을 넓혀 카메라가 너무 멀어지지 않게 (멀어지면 안개에 묻혀 흐려짐)
    this.camera.fov = portrait ? 56 : 40;
    const BASE_DIST = Math.hypot(19.8, 15.3); // 가로 화면 기준 거리 (≈25)
    let dist = BASE_DIST * Math.max(1, 1.45 / aspect);
    if (portrait) {
      // 맵 폭(벽 포함 약 18칸 + 여유)이 가로 시야에 딱 들어오는 거리
      const hHalf = Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * aspect);
      // 태블릿 세로(덜 좁은 화면)는 위아래 UI 와 겹치지 않도록 여유를 더 둠
      const margin = aspect > 0.6 ? 2.6 : 0.9;
      dist = Math.max(BASE_DIST * 0.9, (CONFIG.MAP_SIZE / 2 + margin) / Math.tan(hHalf));
    }
    const dir = new THREE.Vector3(0, 19.8, 15.3).normalize();
    this.camDir = dir.clone();
    this.gamePos.copy(dir.clone().multiplyScalar(dist));
    this.distExtra = Math.max(0, dist - BASE_DIST);
    this.menuScale = portrait ? Math.max(1, dist / BASE_DIST) * 0.92 : 1; // 메인 화면 회전 카메라 거리
    // 세로 + 터치 조작: 아래쪽 조이스틱/버튼 자리를 비우도록 맵을 살짝 위로
    this.camTarget.set(0, 0, portrait && Device.touch ? 2.4 : 0.6);
    this.camera.updateProjectionMatrix();
    this.computeZoom(aspect, portrait, dist);
    this.applyFog();
  }

  /**
   * 휴대폰 확대 카메라: 화면에 약 11칸이 보이도록 당겨서 내 캐릭터를 따라감.
   * 맵 가장자리에서는 맵 밖이 과하게 보이지 않도록 따라가는 범위를 제한.
   */
  computeZoom(aspect, portrait, overviewDist) {
    const phone = Math.min(window.innerWidth, window.innerHeight) < 600;
    this.zoomAvailable = Device.touch || phone;
    const saved = localStorage.getItem('bubbleArena.zoom');
    this.zoomed = this.zoomAvailable && (saved === null ? phone : saved === '1');
    const vHalf = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * aspect);
    const SIN_ELEV = 0.79; // 카메라 내려다보는 각(≈52°) → 바닥에서 세로 범위가 늘어나는 비율
    const VIEW = portrait ? 10 : 12; // 화면에 보일 칸 수 (짧은 쪽 기준, 가로 화면은 원근감 때문에 조금 더 넓게)
    const distW = VIEW / 2 / Math.tan(hHalf);
    const distH = ((VIEW / 2) * SIN_ELEV) / Math.tan(vHalf);
    this.zoomDist = Math.min(overviewDist, Math.max(distW, distH));
    // 가장자리에서도 캐릭터가 화면 구석 UI(점수판·조이스틱) 밑에 숨지 않도록 맵 밖으로 약 2칸까지는 따라감
    const R = CONFIG.MAP_SIZE / 2 + 2.4;
    this.clampX = Math.max(0, R - this.zoomDist * Math.tan(hHalf));
    this.clampZ = Math.max(0, R - (this.zoomDist * Math.tan(vHalf)) / SIN_ELEV);
    // 세로 화면: 캐릭터를 화면 중앙보다 약간 위에 (아래쪽은 조이스틱 자리)
    this.zoomOffsetZ = portrait && Device.touch ? 1.4 : 0.3;
  }

  setZoom(on) {
    if (!this.zoomAvailable) return;
    this.zoomed = on;
    localStorage.setItem('bubbleArena.zoom', on ? '1' : '0');
  }

  /** 따라갈 위치 (월드 좌표). null 이면 전체 보기 */
  setFollow(x, z) {
    if (x === null) this.followPos = null;
    else (this.followPos ??= new THREE.Vector3()).set(x, 0, z);
  }

  /** 카메라가 멀어진 만큼 안개도 뒤로 (세로 화면에서 맵이 뿌옇게 보이지 않도록) */
  applyFog() {
    if (!this.fogBase) return;
    const extra = (this.distExtra || 0) * (this.menuScale > 1 ? 1.2 : 1);
    this.scene.fog.near = this.fogBase.near + extra;
    this.scene.fog.far = this.fogBase.far + extra;
  }

  update(dt, time) {
    if (this.cameraMode === 'menu') {
      this.menuAngle += dt * 0.12;
      const r = 19.6 * (this.menuScale || 1);
      const target = new THREE.Vector3(Math.sin(this.menuAngle) * r, 12.4 * (this.menuScale || 1), Math.cos(this.menuAngle) * r);
      this.camera.position.lerp(target, Math.min(1, dt * 2));
      this.camera.lookAt(0, 0, 0);
    } else {
      this.look ??= this.camTarget.clone();
      this.desiredPos ??= new THREE.Vector3();
      this.desiredLook ??= new THREE.Vector3();
      if (this.zoomed && this.followPos) {
        // 확대: 캐릭터를 부드럽게 따라감 (가장자리에서는 멈춤)
        const f = this.followPos;
        this.desiredLook.set(
          THREE.MathUtils.clamp(f.x, -this.clampX, this.clampX),
          0,
          THREE.MathUtils.clamp(f.z, -this.clampZ, this.clampZ) + this.zoomOffsetZ,
        );
        this.desiredPos.copy(this.desiredLook).addScaledVector(this.camDir, this.zoomDist);
      } else {
        this.desiredLook.copy(this.camTarget);
        this.desiredPos.copy(this.gamePos);
      }
      const k = Math.min(1, dt * 4);
      this.look.lerp(this.desiredLook, k);
      this.camera.position.lerp(this.desiredPos, k);
      this.camera.lookAt(this.look);
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
