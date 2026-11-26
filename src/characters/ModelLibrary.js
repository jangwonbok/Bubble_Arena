import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// GLB 캐릭터 모델 로더 + 정규화 + 초상화(UI 아바타) 생성
// 모든 모델은 원본 크기/원점이 제각각이므로 로드 후 다음 규칙으로 맞춘다:
//  - 정면: +Z (게임의 기본 방향과 같음)
//  - 높이: TARGET_HEIGHT, 너비(좌우 팔 포함)가 MAX_WIDTH 를 넘지 않도록 축소
//  - 바닥: y = 0, 좌우/앞뒤 중심: 원점
export const TARGET_HEIGHT = 1.3; // 월드 단위 (1 = 타일 1칸)
export const MAX_WIDTH = 1.12;

const BASE = import.meta.env?.BASE_URL ?? '/';
const loader = new GLTFLoader();
const cache = new Map(); // model → Promise<{ scene, scale, offset }>

export function modelURL(name) {
  return `${BASE}assets/models/${name}.glb`;
}

/** GLB 로드 + 정규화 정보 계산 (모델당 1회) */
export function loadModel(name) {
  if (!cache.has(name)) {
    cache.set(
      name,
      loader.loadAsync(modelURL(name)).then((gltf) => {
        const scene = gltf.scene;
        scene.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(scene);
        const size = box.getSize(new THREE.Vector3());
        const scale = Math.min(TARGET_HEIGHT / size.y, MAX_WIDTH / Math.max(size.x, size.z * 0.9));
        const center = box.getCenter(new THREE.Vector3());
        // 정규화 후 원점 기준 위치 보정값 (바닥을 y=0 에)
        const offset = new THREE.Vector3(-center.x * scale, -box.min.y * scale, -center.z * scale);
        return { scene, scale, offset, size };
      }),
    );
  }
  return cache.get(name);
}

/** 정규화된 인스턴스 생성 (재질은 인스턴스마다 복제 → 피격 번쩍임 등 개별 효과) */
export function instantiate(info, envMap = null) {
  const wrapper = new THREE.Group();
  const inst = info.scene.clone(true);
  const mats = [];
  inst.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const src = Array.isArray(o.material) ? o.material : [o.material];
    const cloned = src.map((m) => {
      const c = m.clone();
      if (envMap && 'envMap' in c && !c.envMap) {
        c.envMap = envMap;
        c.envMapIntensity = 0.25;
      }
      if (c.emissive) c.userData.baseEmissive = c.emissive.clone();
      mats.push(c);
      return c;
    });
    o.material = Array.isArray(o.material) ? cloned : cloned[0];
  });
  inst.scale.setScalar(info.scale);
  inst.position.copy(info.offset);
  wrapper.add(inst);
  wrapper.userData.mats = mats;
  wrapper.userData.model = inst;
  return wrapper;
}

// ---------------- UI 초상화 ----------------
let portraitRenderer = null;
let portraitEnv = null;
function getPortraitRenderer() {
  if (!portraitRenderer) {
    portraitRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    portraitRenderer.setSize(160, 160, false);
    portraitRenderer.outputColorSpace = THREE.SRGBColorSpace;
    portraitRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    const pmrem = new THREE.PMREMGenerator(portraitRenderer);
    portraitEnv = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
  }
  return portraitRenderer;
}

/** 모델 상반신 초상화 data URL (정면에서 약간 위) */
export function renderPortrait(info) {
  const r = getPortraitRenderer();
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xa0b0d0, 1.0));
  const sun = new THREE.DirectionalLight(0xffffff, 2.0);
  sun.position.set(-1.5, 3, 4);
  scene.add(sun);
  const model = instantiate(info, portraitEnv);
  model.rotation.y = -0.3;
  scene.add(model);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 20);
  // 얼굴이 크게 보이도록 위쪽 2/3 을 프레이밍
  cam.position.set(0, TARGET_HEIGHT * 0.66, 2.25);
  cam.lookAt(0, TARGET_HEIGHT * 0.58, 0);
  r.render(scene, cam);
  const url = r.domElement.toDataURL('image/png');
  for (const m of model.userData.mats) m.dispose();
  return url;
}

export function disposePortraitRenderer() {
  portraitEnv?.dispose();
  portraitRenderer?.dispose();
  portraitRenderer?.forceContextLoss();
  portraitRenderer = null;
  portraitEnv = null;
}
