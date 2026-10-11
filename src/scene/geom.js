// Small geometry toolkit used by the component builders.  Every helper
// returns a Mesh positioned in world (vehicle) coordinates and tags it with
// a realistic material key in userData.mat; the viewer assigns materials.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

const PLACEHOLDER = new THREE.MeshBasicMaterial();

export function mesh(geometry, mat = 'greyPlastic') {
  const m = new THREE.Mesh(geometry, PLACEHOLDER);
  m.userData.mat = mat;
  return m;
}

export function group(...children) {
  const g = new THREE.Group();
  for (const c of children.flat()) if (c) g.add(c);
  return g;
}

function place(m, pos, rot) {
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
  return m;
}

/** Rounded box. size = [x, y, z] extents, pos = centre. */
export function rbox(size, pos, mat, { r = 0.01, rot = null, seg = 2 } = {}) {
  const rr = Math.min(r, size[0] / 2 - 1e-4, size[1] / 2 - 1e-4, size[2] / 2 - 1e-4);
  const g = rr > 0.0005
    ? new RoundedBoxGeometry(size[0], size[1], size[2], seg, rr)
    : new THREE.BoxGeometry(size[0], size[1], size[2]);
  return place(mesh(g, mat), pos, rot);
}

export function box(size, pos, mat, rot = null) {
  return place(mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), mat), pos, rot);
}

const AXIS_ROT = { x: [0, 0, Math.PI / 2], y: [0, 0, 0], z: [Math.PI / 2, 0, 0] };

/** Cylinder of radius r and length len along an axis. */
export function cyl(r, len, axis, pos, mat, { r2 = r, seg = 24, open = false, rot = null } = {}) {
  const g = new THREE.CylinderGeometry(r2, r, len, seg, 1, open);
  const m = mesh(g, mat);
  place(m, pos, rot || AXIS_ROT[axis]);
  return m;
}

const _up = new THREE.Vector3(0, 1, 0);
/** Cylinder spanning two points. */
export function beam(a, b, r, mat, { seg = 12, r2 = r } = {}) {
  const pa = Array.isArray(a) ? V(...a) : a;
  const pb = Array.isArray(b) ? V(...b) : b;
  const dir = new THREE.Vector3().subVectors(pb, pa);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r2, r, len, seg, 1);
  const m = mesh(g, mat);
  m.position.copy(pa).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(_up, dir.normalize());
  return m;
}

/** Square-section beam spanning two points. */
export function bar(a, b, w, h, mat) {
  const pa = Array.isArray(a) ? V(...a) : a;
  const pb = Array.isArray(b) ? V(...b) : b;
  const dir = new THREE.Vector3().subVectors(pb, pa);
  const len = dir.length();
  const m = mesh(new THREE.BoxGeometry(w, len, h), mat);
  m.position.copy(pa).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(_up, dir.normalize());
  return m;
}

/** Smooth tube through points ([x,y,z] arrays or Vector3). */
export function tube(points, r, mat, { closed = false, seg = null, radial = 8, tension = 0.5 } = {}) {
  const pts = points.map((p) => (Array.isArray(p) ? V(...p) : p));
  const curve = new THREE.CatmullRomCurve3(pts, closed, 'catmullrom', tension);
  const len = curve.getLength();
  const g = new THREE.TubeGeometry(curve, seg || Math.max(8, Math.ceil(len / 0.03)), r, radial, closed);
  return mesh(g, mat);
}

export function torus(R, r, axis, pos, mat, { arc = Math.PI * 2, seg = 32, rot = null } = {}) {
  const g = new THREE.TorusGeometry(R, r, 10, seg, arc);
  const rotation = rot || { x: [0, Math.PI / 2, 0], y: [Math.PI / 2, 0, 0], z: [0, 0, 0] }[axis];
  return place(mesh(g, mat), pos, rotation);
}

/** Lathe around an axis. profile = [[radius, along], ...]. */
export function lathe(profile, axis, pos, mat, { seg = 40 } = {}) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  return place(mesh(g, mat), pos, AXIS_ROT[axis]);
}

/** Flat disc (short cylinder). */
export function disc(r, t, axis, pos, mat, seg = 32) {
  return cyl(r, t, axis, pos, mat, { seg });
}

export function sphere(r, pos, mat, scale = null) {
  const m = mesh(new THREE.SphereGeometry(r, 20, 14), mat);
  place(m, pos);
  if (scale) m.scale.set(scale[0], scale[1], scale[2]);
  return m;
}

/**
 * Extrude a 2D outline.  pts = [[u, w], ...] in the plane given by `plane`:
 *  'xy' (side view, extruded along z), 'xz' (top view, along y), 'zy' (front view, along x).
 * `depth` is centred on `center` along the extrusion axis.
 */
export function extrude(pts, depth, plane, center, mat, { bevel = 0.004, curveSeg = 1 } = {}) {
  const shape = new THREE.Shape(pts.map(([u, w]) => new THREE.Vector2(u, w)));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: curveSeg,
  });
  g.translate(0, 0, -depth / 2);
  const m = mesh(g, mat);
  if (plane === 'xz') {
    m.rotation.set(Math.PI / 2, 0, 0); // shape (u,w) -> (x, z), depth -> -y
  } else if (plane === 'zy') {
    m.rotation.set(0, Math.PI / 2, 0); // shape (u,w) -> (-z.. ) handled by caller with u = z
  }
  m.position.set(center[0], center[1], center[2]);
  return m;
}

/** Coil spring along y. */
export function helix(R, h, turns, r, pos, mat) {
  const pts = [];
  const n = Math.ceil(turns * 24);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = t * turns * Math.PI * 2;
    pts.push(V(pos[0] + R * Math.cos(a), pos[1] - h / 2 + h * t, pos[2] + R * Math.sin(a)));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  return mesh(new THREE.TubeGeometry(curve, n * 2, r, 6, false), mat);
}

/** Thin plate following a quad (4 corner points), with thickness t. */
export function quadPlate(corners, t, mat) {
  const [a, b, c, d] = corners.map((p) => (Array.isArray(p) ? V(...p) : p));
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a)).normalize().multiplyScalar(t / 2);
  const pts = [a, b, c, d].flatMap((p) => [p.clone().add(n), p.clone().sub(n)]);
  const pos = [];
  for (const p of pts) pos.push(p.x, p.y, p.z);
  // 0,2,4,6 = top face (a,b,c,d); 1,3,5,7 = bottom face
  const idx = [0, 2, 4, 0, 4, 6, 1, 5, 3, 1, 7, 5, 0, 1, 3, 0, 3, 2, 2, 3, 5, 2, 5, 4, 4, 5, 7, 4, 7, 6, 6, 7, 1, 6, 1, 0];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return mesh(g, mat);
}

const _axes = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
/** Rotate a mesh so its local `axis` points along normal n, and place it at p. */
export function faceTo(m, p, n, axis = 'z') {
  m.quaternion.setFromUnitVectors(_axes[axis], n.clone().normalize());
  m.position.copy(p);
  return m;
}

/** Mesh from a skin-patch geometry (see body.js). Adds panel outline if present. */
export function skinMesh(geometry, mat) {
  if (!geometry) return null;
  const m = mesh(geometry, mat);
  if (geometry.userData.edges) {
    const lines = new THREE.LineSegments(geometry.userData.edges, new THREE.LineBasicMaterial());
    lines.userData.isEdge = true;
    m.add(lines);
  }
  return m;
}
