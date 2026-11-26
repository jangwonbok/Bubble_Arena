import * as THREE from 'three';
import { Assets } from '../core/Assets.js';
import { TILE, TERRAIN, isConveyor } from '../core/Config.js';
import { toWorld } from '../core/SceneManager.js';
import { floorTexture, wallMaterial, pillarParts, makeBlock, terrainMaterial, pitMaterial, conveyorTexture, lavaTexture, buildScenery, makePlatform } from './ThemeKit.js';
import { AmbientParticles } from './AmbientParticles.js';

// 맵의 3D 표현.
// - 정적 요소(바닥/벽/고정 장애물/특수 지형)는 맵별로 1회 생성 후 캐시 → 맵 전환 시 표시만 바꿈
// - 배경(scenery)은 테마별 캐시
// - 파괴 가능한 블록은 매 판 다시 배치 (스타일별 오브젝트 풀)
const CONV_ROT = { [TERRAIN.CONV_E]: 0, [TERRAIN.CONV_W]: Math.PI, [TERRAIN.CONV_S]: -Math.PI / 2, [TERRAIN.CONV_N]: Math.PI / 2 };

export class MapView {
  constructor(scene, bus) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.blockGroup = new THREE.Group();
    this.root.add(this.blockGroup);
    scene.add(this.root);

    this.statics = new Map();
    this.sceneries = new Map();
    this.current = null;
    this.currentScenery = null;
    this.blocks = new Map();
    this.dying = [];
    this.pools = new Map();
    this.blockStyle = 'crate';
    this.ambient = new AmbientParticles(scene);
    this.dummy = new THREE.Object3D();

    this.sliding = [];
    bus.on('blockDestroyed', ({ idx }) => this.destroyBlock(idx));
    bus.on('blockPushed', ({ from, to, tx, tz }) => this.slideBlock(from, to, tx, tz));
  }

  build(grid, def) {
    // 정적 요소
    if (this.current) this.current.group.visible = false;
    if (!this.statics.has(def.id)) this.statics.set(def.id, this.buildStatic(grid, def));
    this.current = this.statics.get(def.id);
    this.current.group.visible = true;
    this.resetHiddenTiles();

    // 배경
    if (this.currentScenery) this.currentScenery.visible = false;
    const theme = def.env.scenery;
    if (!this.sceneries.has(theme)) {
      const s = buildScenery(theme, def.env);
      this.root.add(s);
      this.sceneries.set(theme, s);
    }
    this.currentScenery = this.sceneries.get(theme);
    this.currentScenery.visible = true;
    this.ambient.set(def.env.particles);

    // 블록
    for (const m of this.blocks.values()) this.release(m);
    for (const d of this.dying) this.release(d.mesh);
    this.blocks.clear();
    this.dying.length = 0;
    this.sliding.length = 0;
    this.blockStyle = def.visual.block.style;
    const pushStyle = def.visual.push?.style || 'pushCrate';
    for (let z = 0; z < grid.size; z++) {
      for (let x = 0; x < grid.size; x++) {
        const t = grid.get(x, z);
        if (t !== TILE.BLOCK && t !== TILE.PUSH) continue;
        // 보조 블록: 중앙에서의 거리 기준 2×2 군집 체크 무늬 → 대칭적인 2색 블록 배치
        const c = (grid.size - 1) / 2;
        const alt = def.visual.blockAlt && (Math.floor(Math.abs(x - c) / 2) + Math.floor(Math.abs(z - c) / 2)) % 2 === 1;
        const m = this.acquire(t === TILE.PUSH ? pushStyle : alt ? def.visual.blockAlt.style : this.blockStyle);
        m.position.set(toWorld(x), 0.41, toWorld(z));
        m.rotation.set(0, ((x * 7 + z * 3) % 4) * (Math.PI / 2), 0);
        m.scale.setScalar(1);
        this.blocks.set(grid.idx(x, z), m);
      }
    }
  }

  acquire(style) {
    if (!this.pools.has(style)) this.pools.set(style, []);
    const m = this.pools.get(style).pop() || makeBlock(style);
    m.userData.style = style;
    this.blockGroup.add(m);
    return m;
  }

  release(m) {
    this.blockGroup.remove(m);
    this.pools.get(m.userData.style).push(m);
  }

  /** 밀린 블록: 0.18초 동안 미끄러지듯 이동 */
  slideBlock(from, to, tx, tz) {
    const m = this.blocks.get(from);
    if (!m) return;
    this.blocks.delete(from);
    this.blocks.set(to, m);
    this.sliding.push({ mesh: m, fromX: m.position.x, fromZ: m.position.z, toX: toWorld(tx), toZ: toWorld(tz), t: 0 });
  }

  destroyBlock(idx) {
    this.sliding = this.sliding.filter((sl) => sl.mesh !== this.blocks.get(idx));
    const m = this.blocks.get(idx);
    if (!m) return;
    this.blocks.delete(idx);
    this.dying.push({ mesh: m, t: 0 });
  }

  /** 하늘 섬 구름 붕괴 등: 바닥 타일 숨기기 */
  setTileHidden(idx, hidden) {
    const st = this.current;
    const inst = st?.tileIndex.get(idx);
    if (inst === undefined) return;
    if (hidden) {
      this.dummy.position.set(0, -50, 0);
      this.dummy.scale.setScalar(0.0001);
      this.dummy.updateMatrix();
      st.floor.setMatrixAt(inst, this.dummy.matrix);
      st.hidden.add(idx);
    } else {
      st.floor.setMatrixAt(inst, st.floorMatrices[inst]);
      st.hidden.delete(idx);
    }
    st.floor.instanceMatrix.needsUpdate = true;
  }

  resetHiddenTiles() {
    for (const idx of [...(this.current?.hidden || [])]) this.setTileHidden(idx, false);
  }

  update(dt, time, platforms = null) {
    for (let i = this.sliding.length - 1; i >= 0; i--) {
      const sl = this.sliding[i];
      sl.t = Math.min(1, sl.t + dt / 0.18);
      const e = 1 - (1 - sl.t) * (1 - sl.t);
      sl.mesh.position.x = sl.fromX + (sl.toX - sl.fromX) * e;
      sl.mesh.position.z = sl.fromZ + (sl.toZ - sl.fromZ) * e;
      sl.mesh.position.y = 0.41 + Math.sin(sl.t * Math.PI) * 0.05;
      if (sl.t >= 1) this.sliding.splice(i, 1);
    }
    if (this.current?.platforms && platforms) {
      this.current.platforms.forEach((pm, i) => {
        const p = platforms[i];
        if (!p) return;
        pm.position.set(toWorld(p.x), Math.sin(time * 2 + i) * 0.03, toWorld(p.z));
      });
    }
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const d = this.dying[i];
      d.t += dt;
      const k = d.t / 0.3;
      if (k >= 1) {
        this.release(d.mesh);
        this.dying.splice(i, 1);
        continue;
      }
      const s = k < 0.3 ? 1 + k * 0.5 : (1.15 * (1 - k)) / 0.7;
      d.mesh.scale.set(s, Math.max(0.01, s * (1 - k * 0.4)), s);
      d.mesh.rotation.y += dt * 8;
    }
    const st = this.current;
    if (st) {
      if (st.hasConveyor) conveyorTexture().offset.x = -time * 1.4; // 실제 밀어내는 속도(1.4칸/초)와 동일
      if (st.hasLava) {
        const lt = lavaTexture();
        lt.offset.set(Math.sin(time * 0.3) * 0.1, time * 0.04);
      }
      if (st.jelly) st.jelly.scale.y = 1 + Math.sin(time * 6) * 0.25;
    }
    const sea = this.currentScenery?.userData.sea;
    if (sea) {
      sea.sea.position.y = -0.2 + Math.sin(time * 0.8) * 0.05;
      sea.foam.position.z = -10.2 + Math.sin(time * 0.8) * 0.3;
      sea.foam.material.opacity = 0.55 + Math.sin(time * 0.8) * 0.3;
    }
    this.ambient.update(dt, time);
  }

  buildStatic(grid, def) {
    const n = grid.size;
    const V = def.visual;
    const group = new THREE.Group();
    const dummy = this.dummy;
    const ca = new THREE.Color(V.floor.a);
    const cb = new THREE.Color(V.floor.b);

    // 바닥 (구멍 제외)
    const floorTiles = [];
    for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) if (grid.get(x, z) !== TILE.PIT) floorTiles.push([x, z]);
    const floorMat = new THREE.MeshStandardMaterial({ map: floorTexture(V.floor.tex), roughness: V.floor.tex === 'snow' ? 0.7 : 0.95 });
    const floor = new THREE.InstancedMesh(Assets.geo.tile, floorMat, floorTiles.length);
    const tileIndex = new Map();
    const floorMatrices = [];
    floorTiles.forEach(([x, z], i) => {
      dummy.position.set(toWorld(x), -0.15, toWorld(z));
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      floor.setMatrixAt(i, dummy.matrix);
      floorMatrices.push(dummy.matrix.clone());
      floor.setColorAt(i, (x + z) % 2 ? cb : ca);
      tileIndex.set(grid.idx(x, z), i);
    });
    floor.receiveShadow = true;
    group.add(floor);

    const walls = [];
    const pillars = [];
    const pits = [];
    const terrains = new Map();
    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        const t = grid.get(x, z);
        if (t === TILE.WALL) walls.push([x, z]);
        else if (t === TILE.PILLAR) pillars.push([x, z]);
        else if (t === TILE.PIT) pits.push([x, z]);
        const tr = grid.terrainAt(x, z);
        if (tr && t !== TILE.PILLAR && t !== TILE.WALL) {
          if (!terrains.has(tr)) terrains.set(tr, []);
          terrains.get(tr).push([x, z]);
        }
      }
    }

    // 외곽 벽
    const wallMesh = new THREE.InstancedMesh(Assets.geo.wall, wallMaterial(V.wall.style, V.wall.color), walls.length);
    walls.forEach(([x, z], k) => {
      dummy.position.set(toWorld(x), 0.35, toWorld(z));
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      wallMesh.setMatrixAt(k, dummy.matrix);
    });
    wallMesh.castShadow = wallMesh.receiveShadow = true;
    group.add(wallMesh);

    // 고정 장애물 (테마별 파츠를 각각 인스턴싱). layout.altPillars 위치는 랜드마크 장애물로 교체
    const altSet = new Set(grid.mirror(def.layout?.altPillars || []).map(([x, z]) => grid.idx(x, z)));
    const groups = [
      [V.pillar.style, pillars.filter(([x, z]) => !(V.pillarAlt && altSet.has(grid.idx(x, z))))],
      [V.pillarAlt?.style, V.pillarAlt ? pillars.filter(([x, z]) => altSet.has(grid.idx(x, z))) : []],
    ];
    for (const [style, list] of groups) {
     if (!style || !list.length) continue;
     for (const part of pillarParts(style)) {
      const im = new THREE.InstancedMesh(part.geo, part.mat, list.length);
      list.forEach(([x, z], k) => {
        dummy.position.set(toWorld(x), 0, toWorld(z));
        dummy.rotation.set(0, ((x + z) % 4) * (Math.PI / 2), 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        im.setMatrixAt(k, dummy.matrix.clone().multiply(part.m));
      });
      im.castShadow = im.receiveShadow = true;
      group.add(im);
     }
    }

    // 구멍 (용암 / 하늘)
    let hasLava = false;
    const pitMat = pitMaterial(V.pit?.style);
    if (pits.length && pitMat) {
      hasLava = V.pit.style === 'lava';
      const pm = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), pitMat, pits.length);
      pits.forEach(([x, z], k) => {
        dummy.position.set(toWorld(x), V.pit.style === 'void' ? -1.2 : -0.12, toWorld(z));
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        pm.setMatrixAt(k, dummy.matrix);
      });
      group.add(pm);
      if (hasLava) {
        const light = new THREE.PointLight(0xff7a20, 6, 4, 2);
        for (const [x, z] of pits.slice(0, 4)) {
          const l = light.clone();
          l.position.set(toWorld(x), 0.6, toWorld(z));
          group.add(l);
        }
      }
    }

    // 특수 지형 오버레이
    let hasConveyor = false;
    let jelly = null;
    const plane = new THREE.PlaneGeometry(0.94, 0.94).rotateX(-Math.PI / 2);
    for (const [type, tiles] of terrains) {
      const im = new THREE.InstancedMesh(plane, terrainMaterial(type), tiles.length);
      tiles.forEach(([x, z], k) => {
        dummy.position.set(toWorld(x), type === TERRAIN.LAVA ? 0.01 : 0.006, toWorld(z));
        dummy.rotation.set(0, CONV_ROT[type] ?? 0, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        im.setMatrixAt(k, dummy.matrix);
      });
      im.receiveShadow = true;
      if (isConveyor(type)) hasConveyor = true;
      if (type === TERRAIN.LAVA) {
        hasLava = true;
        im.geometry = new THREE.PlaneGeometry(1.0, 1.0).rotateX(-Math.PI / 2); // 강처럼 이어지도록 꽉 채움
        for (const [x, z] of tiles.filter((_, k) => k % 3 === 0)) {
          const l = new THREE.PointLight(0xff7a20, 5, 3.5, 2);
          l.position.set(toWorld(x), 0.5, toWorld(z));
          group.add(l);
        }
      }
      if (type === TERRAIN.JELLY) {
        // 젤리는 살짝 부풀어 있는 반투명 판
        im.geometry = new THREE.BoxGeometry(0.9, 0.06, 0.9);
        im.position.y = 0.03;
        jelly = im;
      }
      group.add(im);
    }

    const platforms = (def.effects || []).filter((e) => e.type === 'platform').map(() => {
      const pm = makePlatform();
      group.add(pm);
      return pm;
    });

    this.root.add(group);
    return { group, floor, tileIndex, floorMatrices, hidden: new Set(), hasConveyor, hasLava, jelly, platforms };
  }
}
