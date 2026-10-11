// Three.js viewer: rendering, picking, focus/dim highlighting, x-ray,
// explode, visibility and camera control for the component registry.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makeMaterial } from './materials.js';

const CAR_CENTER = new THREE.Vector3(0, 0.62, 0);

// dist = distance for a wide viewport; halfW = half of the car's projected
// width in that view, used to back off on narrow (portrait) screens.
export const VIEWS = {
  iso: { dir: [0.78, 0.42, 0.95], dist: 7.0, halfW: 2.9 },
  front: { dir: [1, 0.12, 0], dist: 6.4, halfW: 1.25 },
  rear: { dir: [-1, 0.14, 0], dist: 6.4, halfW: 1.25 },
  left: { dir: [0, 0.1, -1], dist: 7.0, halfW: 2.7 },
  right: { dir: [0, 0.1, 1], dist: 7.0, halfW: 2.7 },
  top: { dir: [0.0001, 1, 0], dist: 7.4, halfW: 2.7 },
  bottom: { dir: [0.0001, -1, 0.0001], dist: 7.0, halfW: 2.7 },
};

export class Viewer {
  constructor(container) {
    this.container = container;
    this.listeners = {};
    this.hovered = null;
    this.selected = new Set();
    this.emphasis = new Set(); // e.g. instances matching a selected part row
    this.preview = new Set(); // hover from the UI (tree, chips, search)
    this.xray = true;
    this.colorMode = 'system';
    this.explode = 0;
    this.hiddenSystems = new Set();
    this.variant = { drive: 'dm', susp: 'air' };
    this.needsRender = true;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0d1218');
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
    this.scene = scene;

    scene.add(new THREE.HemisphereLight('#dfe9ff', '#2a2f36', 0.9));
    const key = new THREE.DirectionalLight('#ffffff', 1.6);
    key.position.set(4, 8, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight('#9fc4ff', 0.6);
    rim.position.set(-6, 3, -4);
    scene.add(rim);

    this.addGround();

    const camera = new THREE.PerspectiveCamera(38, Math.max(0.2, container.clientWidth / Math.max(1, container.clientHeight)), 0.05, 200);
    this.camera = camera;
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.minDistance = 0.6;
    controls.maxDistance = 30;
    controls.screenSpacePanning = true;
    controls.zoomToCursor = true;
    controls.target.copy(CAR_CENTER);
    controls.addEventListener('change', () => { this.needsRender = true; });
    this.controls = controls;
    this.setView('iso', false);

    this.carRoot = new THREE.Group();
    scene.add(this.carRoot);

    // Post-processing: outlines for selection (orange) and hover (cyan).
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    const composer = new EffectComposer(renderer, target);
    composer.addPass(new RenderPass(scene, camera));
    const selOutline = new OutlinePass(new THREE.Vector2(1, 1), scene, camera);
    Object.assign(selOutline, { edgeStrength: 4.0, edgeGlow: 0.4, edgeThickness: 1.4, pulsePeriod: 0 });
    selOutline.visibleEdgeColor.set('#ffb340');
    selOutline.hiddenEdgeColor.set('#7a4a10');
    composer.addPass(selOutline);
    const hovOutline = new OutlinePass(new THREE.Vector2(1, 1), scene, camera);
    Object.assign(hovOutline, { edgeStrength: 3.0, edgeGlow: 0.0, edgeThickness: 1.0, pulsePeriod: 0 });
    hovOutline.visibleEdgeColor.set('#7fe8ff');
    hovOutline.hiddenEdgeColor.set('#1c5866');
    composer.addPass(hovOutline);
    composer.addPass(new OutputPass());
    this.composer = composer;
    this.selOutline = selOutline;
    this.hovOutline = hovOutline;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.bindPointer();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    this.tween = null;
    const loop = (t) => {
      requestAnimationFrame(loop);
      this.tick(t);
    };
    requestAnimationFrame(loop);
  }

  on(evt, fn) { (this.listeners[evt] ||= []).push(fn); }
  emit(evt, ...args) { for (const fn of this.listeners[evt] || []) fn(...args); }

  addGround() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(128, 128, 10, 128, 128, 128);
    grd.addColorStop(0, 'rgba(0,0,0,0.55)');
    grd.addColorStop(0.55, 'rgba(0,0,0,0.25)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(6.4, 3.2),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.002;
    shadow.renderOrder = -2;
    this.scene.add(shadow);
    const grid = new THREE.GridHelper(40, 80, '#2b3846', '#18212b');
    grid.material.transparent = true;
    grid.material.opacity = 0.55;
    grid.material.depthWrite = false;
    grid.renderOrder = -3;
    this.scene.add(grid);
    this.ground = [shadow, grid];
  }

  /** Attach registry items to the scene and prepare materials. */
  setComponents(items, groupSystem) {
    this.items = items;
    this.byId = new Map(items.map((it) => [it.id, it]));
    this.groupSystem = groupSystem;
    const center = new THREE.Vector3();
    const box = new THREE.Box3();
    for (const it of items) {
      it.system = groupSystem(it.groups[0]);
      this.carRoot.add(it.root);
      it.root.updateMatrixWorld(true);
      box.setFromObject(it.root);
      box.getCenter(center);
      it.center = center.clone();
      it.size = box.getSize(new THREE.Vector3()).length();
      // Exploded-view direction: away from the car centre, exaggerated sideways/up.
      const d = center.clone().sub(CAR_CENTER);
      it.explodeDir = new THREE.Vector3(d.x * 0.55, d.y * 1.3 + (it.shell ? 0.25 : 0), d.z * 1.6);
      it.meshes = [];
      it.edges = [];
      it.root.traverse((o) => {
        if (o.isMesh) it.meshes.push(o);
        else if (o.isLineSegments && o.userData.isEdge) it.edges.push(o);
      });
    }
    this.applyMaterials();
    this.applyVisibility();
  }

  applyMaterials() {
    for (const it of this.items) {
      const cache = new Map();
      it.materials = [];
      for (const m of it.meshes) {
        const key = m.userData.mat || 'greyPlastic';
        let mat = cache.get(key);
        if (!mat) {
          mat = makeMaterial(key, it.system, this.colorMode);
          cache.set(key, mat);
          it.materials.push(mat);
        }
        if (m.material && m.material !== mat && m.material.dispose && it.materials.indexOf(m.material) < 0) {
          // placeholder material is shared; nothing to dispose
        }
        m.material = mat;
      }
      if (!it.edgeMaterial) {
        it.edgeMaterial = new THREE.LineBasicMaterial({ color: '#0b0f14', transparent: true, opacity: 0.55, depthWrite: false });
      }
      for (const e of it.edges) e.material = it.edgeMaterial;
    }
    this.applyState();
  }

  setColorMode(mode) {
    this.colorMode = mode;
    for (const it of this.items) for (const m of it.materials || []) m.dispose();
    this.applyMaterials();
  }

  isVisible(it) {
    if (this.hiddenSystems.has(it.system)) return false;
    if (it.variant) {
      for (const [k, v] of Object.entries(it.variant)) {
        const allowed = Array.isArray(v) ? v : [v];
        if (this.variant[k] && !allowed.includes(this.variant[k])) return false;
      }
    }
    return true;
  }

  applyVisibility() {
    for (const it of this.items) it.root.visible = this.isVisible(it);
    this.pickables = this.items.filter((it) => it.root.visible).flatMap((it) => it.meshes);
    this.applyState();
  }

  focusSet() {
    const f = new Set(this.selected);
    for (const id of this.emphasis) f.add(id);
    if (this.hovered) f.add(this.hovered);
    for (const id of this.preview) f.add(id);
    return f;
  }

  /** Recompute target opacity/emissive for every component (animated in tick). */
  applyState() {
    if (!this.items) return;
    const focus = this.focusSet();
    const anyFocus = focus.size > 0;
    for (const it of this.items) {
      const isFocus = focus.has(it.id);
      const strong = this.selected.has(it.id) || this.emphasis.has(it.id);
      for (const m of it.materials) {
        let op = m.userData.baseOpacity;
        if (this.xray) {
          if (it.shell) op = Math.min(op, m.userData.glass ? 0.14 : 0.16);
          else if (it.trim) op = Math.min(op, 0.4);
        }
        let boost = 0;
        if (anyFocus) {
          if (isFocus) {
            op = m.userData.glass ? Math.max(op, 0.6) : 1;
            boost = strong ? 0.42 : 0.26;
          } else {
            op = Math.min(op, it.shell ? 0.05 : it.trim ? 0.07 : 0.14);
          }
        }
        m.userData.targetOpacity = op;
        m.userData.targetBoost = boost;
        // Focused parts are drawn last, on top of the translucent context, so
        // they stay crisp even when they sit deep inside the car.
        m.userData.onTop = anyFocus && isFocus;
      }
      const eo = anyFocus ? (isFocus ? 0.75 : 0.05) : (it.shell && this.xray ? 0.25 : 0.5);
      it.edgeMaterial.userData.targetOpacity = eo;
      const order = anyFocus && isFocus ? 10 : (it.shell ? 2 : it.trim ? 1 : 0);
      for (const mesh of it.meshes) mesh.renderOrder = order;
      for (const e of it.edges) e.renderOrder = order + 1;
    }
    const objs = (ids) => [...ids].map((id) => this.byId.get(id)).filter((it) => it && it.root.visible).map((it) => it.root);
    this.selOutline.selectedObjects = objs(new Set([...this.selected, ...this.emphasis]));
    const hov = new Set(this.preview);
    if (this.hovered) hov.add(this.hovered);
    for (const id of this.selected) hov.delete(id);
    for (const id of this.emphasis) hov.delete(id);
    this.hovOutline.selectedObjects = objs(hov);
    this.animating = true;
    this.needsRender = true;
  }

  /** Step material opacity/emissive toward their targets. */
  stepMaterials(dt) {
    if (!this.animating || !this.items) return;
    const k = Math.min(1, dt / 90);
    let moving = false;
    for (const it of this.items) {
      for (const m of it.materials) {
        const to = m.userData.targetOpacity ?? m.opacity;
        const tb = m.userData.targetBoost ?? 0;
        const cb = m.userData.boost ?? 0;
        let o = m.opacity + (to - m.opacity) * k;
        let b = cb + (tb - cb) * k;
        if (Math.abs(to - o) < 0.01) o = to; else moving = true;
        if (Math.abs(tb - b) < 0.01) b = tb; else moving = true;
        const wasTransparent = m.transparent;
        m.opacity = o;
        m.transparent = o < 0.999 || !!m.userData.onTop;
        m.depthWrite = o > 0.5;
        if (wasTransparent !== m.transparent) m.needsUpdate = true;
        if (b !== cb) {
          m.userData.boost = b;
          m.emissive.copy(m.userData.baseEmissive).lerp(m.userData.baseColor, b);
        }
      }
      const em = it.edgeMaterial;
      const te = em.userData.targetOpacity ?? em.opacity;
      em.opacity += (te - em.opacity) * k;
      if (Math.abs(te - em.opacity) < 0.01) em.opacity = te; else moving = true;
    }
    this.animating = moving;
    this.needsRender = true;
  }

  setHovered(id) {
    if (this.hovered === id) return;
    this.hovered = id;
    this.applyState();
  }

  setSelected(ids, emphasis = []) {
    this.selected = new Set(ids);
    this.emphasis = new Set(emphasis);
    this.applyState();
  }

  setPreview(ids) {
    this.preview = new Set(ids || []);
    this.applyState();
  }

  setEmphasis(ids) {
    this.emphasis = new Set(ids);
    this.applyState();
  }

  setXray(on) { this.xray = on; this.applyState(); }

  setExplode(amount) {
    this.explode = amount;
    for (const it of this.items) it.root.position.copy(it.explodeDir).multiplyScalar(amount);
    this.needsRender = true;
  }

  setSystemHidden(sys, hidden) {
    if (hidden) this.hiddenSystems.add(sys); else this.hiddenSystems.delete(sys);
    this.applyVisibility();
  }

  setVariant(key, value) {
    this.variant[key] = value;
    this.applyVisibility();
  }

  bindPointer() {
    const el = this.renderer.domElement;
    let down = null;
    let moveQueued = false;
    let lastEvent = null;
    el.addEventListener('pointermove', (e) => {
      lastEvent = e;
      if (e.pointerType === 'touch') return;
      if (moveQueued) return;
      moveQueued = true;
      requestAnimationFrame(() => {
        moveQueued = false;
        const id = down && down.moved ? null : this.pick(lastEvent);
        this.setHovered(id);
        this.emit('hover', id, lastEvent);
      });
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) down.moved = true;
    });
    el.addEventListener('pointerleave', () => { this.setHovered(null); this.emit('hover', null, null); });
    el.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false }; });
    el.addEventListener('pointerup', (e) => {
      if (!down) return;
      const moved = down.moved || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6;
      down = null;
      if (moved) return;
      const id = this.pick(e);
      this.emit('pick', id, e);
    });
    el.addEventListener('dblclick', (e) => {
      const id = this.pick(e);
      if (id) this.emit('focus', id);
    });
  }

  /** Pick a component under the pointer; interior parts win over x-rayed skin. */
  pick(e) {
    if (!e || !this.pickables) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, false);
    if (!hits.length) return null;
    if (this.xray) {
      const rank = (h) => {
        const it = this.byId.get(h.object.userData.compId);
        return it.shell ? 2 : it.trim ? 1 : 0;
      };
      for (const r of [0, 1]) {
        const hit = hits.find((h) => rank(h) === r);
        if (hit) return hit.object.userData.compId;
      }
    }
    return hits[0].object.userData.compId;
  }

  resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${h}px`;
    this.composer.setSize(w, h);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.needsRender = true;
  }

  setView(name, animate = true) {
    const v = VIEWS[name] || VIEWS.iso;
    const dir = new THREE.Vector3(...v.dir).normalize();
    const aspect = this.camera.aspect || 1.6;
    const hHalf = Math.tan(((this.camera.fov * Math.PI) / 180) / 2) * aspect;
    const dist = Math.max(v.dist, v.halfW / hHalf + 1.2);
    this.flyTo(CAR_CENTER.clone(), CAR_CENTER.clone().addScaledVector(dir, dist), animate);
  }

  /** Fly the camera to frame the given component ids. */
  frame(ids, animate = true) {
    const box = new THREE.Box3();
    for (const id of ids) {
      const it = this.byId.get(id);
      if (it && it.root.visible) box.expandByObject(it.root);
    }
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 0.25);
    const fov = (this.camera.fov * Math.PI) / 180;
    const dist = Math.min(Math.max(radius / Math.sin(fov / 2) * 1.5, 1.8), 14);
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.flyTo(center, center.clone().addScaledVector(dir, dist), animate);
  }

  zoom(factor) {
    const t = this.controls.target;
    const p = this.camera.position.clone().sub(t).multiplyScalar(factor).add(t);
    this.flyTo(t.clone(), p, true, 260);
  }

  flyTo(target, position, animate = true, ms = 650) {
    if (!animate) {
      this.controls.target.copy(target);
      this.camera.position.copy(position);
      this.controls.update();
      this.needsRender = true;
      return;
    }
    this.tween = {
      t0: performance.now(), ms,
      fromT: this.controls.target.clone(), toT: target,
      fromP: this.camera.position.clone(), toP: position,
    };
  }

  tick(now) {
    const dt = Math.min(100, now - (this.lastTick || now));
    this.lastTick = now;
    this.stepMaterials(dt || 16);
    if (this.tween) {
      const tw = this.tween;
      const k = Math.min(1, (now - tw.t0) / tw.ms);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      this.controls.target.lerpVectors(tw.fromT, tw.toT, e);
      this.camera.position.lerpVectors(tw.fromP, tw.toP, e);
      if (k >= 1) this.tween = null;
      this.needsRender = true;
    }
    if (this.controls.update()) this.needsRender = true;
    if (!this.needsRender) return;
    this.needsRender = false;
    this.composer.render();
  }

  /** Screen position of a component centre (for labels). */
  project(id) {
    const it = this.byId.get(id);
    if (!it) return null;
    const p = it.center.clone().add(it.root.position).project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return { x: (p.x + 1) / 2 * rect.width, y: (1 - p.y) / 2 * rect.height, behind: p.z > 1 };
  }
}
