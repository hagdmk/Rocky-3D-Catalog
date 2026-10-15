// Geometry measurement for tools/check.mjs: surface distances between parts,
// "inside a solid" tests and the end points / centre lines of linear members.
// Works on world-space triangle soups, so it needs no renderer.

import * as THREE from 'three';

export function meshesOf(obj) {
  const out = [];
  obj.traverse((o) => { if (o.isMesh && !o.userData.isEdge) out.push(o); });
  return out;
}

// ---------------------------------------------------------------- solids
// Closed primitives count as solids, so a part that sits inside another one
// reads as touching it.  Open cylinders and plates are surface only.
function solidOf(m) {
  const s = solidShape(m);
  if (s) s.hollow = !!m.userData.hollow;
  return s;
}

function solidShape(m) {
  const g = m.geometry;
  const p = g.parameters || {};
  const inv = new THREE.Matrix4().copy(m.matrixWorld).invert();
  const box = new THREE.Box3().setFromObject(m);
  switch (g.type) {
    case 'BoxGeometry':
    case 'RoundedBoxGeometry':
      return { kind: 'box', inv, box, hx: p.width / 2, hy: p.height / 2, hz: p.depth / 2 };
    case 'CylinderGeometry':
      if (p.openEnded || (p.thetaLength !== undefined && p.thetaLength < Math.PI * 2 - 1e-6)) return null;
      return { kind: 'cyl', inv, box, rt: p.radiusTop, rb: p.radiusBottom, h: p.height };
    case 'SphereGeometry':
      return { kind: 'sphere', inv, box, r: p.radius };
    case 'TubeGeometry': {
      const len = p.path.getLength();
      const pts = p.path.getSpacedPoints(Math.max(60, Math.ceil(len / 0.004)));
      return { kind: 'tube', inv, box, r: p.radius, pts };
    }
    case 'TorusGeometry':
      return { kind: 'torus', inv, box, R: p.radius, r: p.tube };
    case 'LatheGeometry':
      return { kind: 'lathe', inv, box, poly: p.points.map((v) => [v.x, v.y]) };
    case 'ExtrudeGeometry': {
      const sh = Array.isArray(p.shapes) ? p.shapes[0] : p.shapes;
      const poly = sh.extractPoints(12).shape.map((v) => [v.x, v.y]);
      return { kind: 'extrude', inv, box, poly, hd: p.options.depth / 2 };
    }
    default:
      return null;
  }
}

function inPoly(poly, x, y) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}

const _v = new THREE.Vector3();
export function insideSolid(s, x, y, z) {
  if (x < s.box.min.x || y < s.box.min.y || z < s.box.min.z || x > s.box.max.x || y > s.box.max.y || z > s.box.max.z) return false;
  if (s.clip && (x < s.clip.min.x || y < s.clip.min.y || z < s.clip.min.z || x > s.clip.max.x || y > s.clip.max.y || z > s.clip.max.z)) return false;
  _v.set(x, y, z).applyMatrix4(s.inv);
  const { x: lx, y: ly, z: lz } = _v;
  switch (s.kind) {
    case 'box': return Math.abs(lx) <= s.hx && Math.abs(ly) <= s.hy && Math.abs(lz) <= s.hz;
    case 'cyl': {
      if (Math.abs(ly) > s.h / 2) return false;
      const r = s.rb + ((s.rt - s.rb) * (ly + s.h / 2)) / s.h;
      return lx * lx + lz * lz <= r * r;
    }
    case 'sphere': return lx * lx + ly * ly + lz * lz <= s.r * s.r;
    case 'torus': {
      const q = Math.hypot(lx, ly) - s.R;
      return q * q + lz * lz <= s.r * s.r;
    }
    case 'lathe': return inPoly(s.poly, Math.hypot(lx, lz), ly);
    case 'extrude': return Math.abs(lz) <= s.hd && inPoly(s.poly, lx, ly);
    case 'tube': {
      const r2 = s.r * s.r;
      const P = s.pts;
      for (let i = 0; i < P.length - 1; i++) {
        const a = P[i];
        const b = P[i + 1];
        const abx = b.x - a.x; const aby = b.y - a.y; const abz = b.z - a.z;
        const apx = lx - a.x; const apy = ly - a.y; const apz = lz - a.z;
        const L = abx * abx + aby * aby + abz * abz;
        let t = L > 0 ? (apx * abx + apy * aby + apz * abz) / L : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const dx = apx - t * abx; const dy = apy - t * aby; const dz = apz - t * abz;
        if (dx * dx + dy * dy + dz * dz <= r2) return true;
      }
      return false;
    }
    default: return false;
  }
}

export function insideShape(shape, x, y, z, { skipHollow = false } = {}) {
  for (const s of shape.solids) if (!(skipHollow && s.hollow) && insideSolid(s, x, y, z)) return true;
  return false;
}

// ---------------------------------------------------------------- shapes
/** World triangle soup + solids of a set of meshes. */
export function shapeOf(name, meshes) {
  let nt = 0;
  for (const m of meshes) {
    const g = m.geometry;
    nt += (g.index ? g.index.count : g.attributes.position.count) / 3;
  }
  const T = new Float64Array(nt * 9);
  const TB = new Float64Array(nt * 6);
  let k = 0;
  const a = new THREE.Vector3();
  for (const m of meshes) {
    const g = m.geometry;
    const pos = g.attributes.position;
    const idx = g.index;
    const n = idx ? idx.count : pos.count;
    for (let i = 0; i < n; i += 3) {
      let mnx = Infinity; let mny = Infinity; let mnz = Infinity; let mxx = -Infinity; let mxy = -Infinity; let mxz = -Infinity;
      for (let j = 0; j < 3; j++) {
        const vi = idx ? idx.getX(i + j) : i + j;
        a.fromBufferAttribute(pos, vi).applyMatrix4(m.matrixWorld);
        T[k * 9 + j * 3] = a.x; T[k * 9 + j * 3 + 1] = a.y; T[k * 9 + j * 3 + 2] = a.z;
        if (a.x < mnx) mnx = a.x; if (a.y < mny) mny = a.y; if (a.z < mnz) mnz = a.z;
        if (a.x > mxx) mxx = a.x; if (a.y > mxy) mxy = a.y; if (a.z > mxz) mxz = a.z;
      }
      TB[k * 6] = mnx; TB[k * 6 + 1] = mny; TB[k * 6 + 2] = mnz;
      TB[k * 6 + 3] = mxx; TB[k * 6 + 4] = mxy; TB[k * 6 + 5] = mxz;
      k++;
    }
  }
  const box = new THREE.Box3();
  for (const m of meshes) box.union(new THREE.Box3().setFromObject(m));
  const solids = meshes.map(solidOf).filter(Boolean);
  return { name, meshes, T, TB, nt: k, box, solids };
}

/** Part of a shape near a point: triangles and solids clipped to a cube of half-size h. */
export function regionShape(shape, p, h) {
  const clip = new THREE.Box3(new THREE.Vector3(p.x - h, p.y - h, p.z - h), new THREE.Vector3(p.x + h, p.y + h, p.z + h));
  const keep = [];
  const { TB } = shape;
  for (let t = 0; t < shape.nt; t++) {
    const o = t * 6;
    if (TB[o] > clip.max.x || TB[o + 3] < clip.min.x || TB[o + 1] > clip.max.y || TB[o + 4] < clip.min.y
      || TB[o + 2] > clip.max.z || TB[o + 5] < clip.min.z) continue;
    keep.push(t);
  }
  const T = new Float64Array(keep.length * 9);
  const TB2 = new Float64Array(keep.length * 6);
  keep.forEach((t, i) => { T.set(shape.T.subarray(t * 9, t * 9 + 9), i * 9); TB2.set(TB.subarray(t * 6, t * 6 + 6), i * 6); });
  const box = shape.box.clone().intersect(clip);
  const solids = shape.solids.map((s) => ({ ...s, clip }));
  return { name: `${shape.name}@region`, T, TB: TB2, nt: keep.length, box, solids };
}

export function boxGap(b1, b2) {
  const dx = Math.max(0, b1.min.x - b2.max.x, b2.min.x - b1.max.x);
  const dy = Math.max(0, b1.min.y - b2.max.y, b2.min.y - b1.max.y);
  const dz = Math.max(0, b1.min.z - b2.max.z, b2.min.z - b1.max.z);
  return Math.hypot(dx, dy, dz);
}

/** Points on the triangles of a shape that meet `region`, about `s` apart. */
function sample(shape, region, s) {
  const out = [];
  const { T, TB } = shape;
  for (let t = 0; t < shape.nt; t++) {
    const o = t * 6;
    if (TB[o] > region.max.x || TB[o + 3] < region.min.x || TB[o + 1] > region.max.y || TB[o + 4] < region.min.y
      || TB[o + 2] > region.max.z || TB[o + 5] < region.min.z) continue;
    const p = t * 9;
    const V3 = [[T[p], T[p + 1], T[p + 2]], [T[p + 3], T[p + 4], T[p + 5]], [T[p + 6], T[p + 7], T[p + 8]]];
    const el = (i, j) => Math.hypot(V3[i][0] - V3[j][0], V3[i][1] - V3[j][1], V3[i][2] - V3[j][2]);
    const e01 = el(0, 1); const e12 = el(1, 2); const e20 = el(2, 0);
    let b0 = 0; let b1 = 1; let ap = 2; let L = e01;
    if (e12 > L) { b0 = 1; b1 = 2; ap = 0; L = e12; }
    if (e20 > L) { b0 = 2; b1 = 0; ap = 1; L = e20; }
    if (L < 1e-9) continue;
    const P0 = V3[b0]; const P1 = V3[b1]; const P2 = V3[ap];
    const ux = (P1[0] - P0[0]) / L; const uy = (P1[1] - P0[1]) / L; const uz = (P1[2] - P0[2]) / L;
    const wx = P2[0] - P0[0]; const wy = P2[1] - P0[1]; const wz = P2[2] - P0[2];
    const proj = wx * ux + wy * uy + wz * uz;
    const H = Math.sqrt(Math.max(0, wx * wx + wy * wy + wz * wz - proj * proj));
    const nr = Math.max(1, Math.ceil(H / s));
    for (let k = 0; k <= nr; k++) {
      const tt = k / nr;
      const ax = P0[0] + tt * (P2[0] - P0[0]); const ay = P0[1] + tt * (P2[1] - P0[1]); const az = P0[2] + tt * (P2[2] - P0[2]);
      const bx = P1[0] + tt * (P2[0] - P1[0]); const by = P1[1] + tt * (P2[1] - P1[1]); const bz = P1[2] + tt * (P2[2] - P1[2]);
      const m = Math.max(1, Math.ceil((L * (1 - tt)) / s));
      for (let i = 0; i <= m; i++) {
        const x = ax + ((bx - ax) * i) / m; const y = ay + ((by - ay) * i) / m; const z = az + ((bz - az) * i) / m;
        if (x < region.min.x || x > region.max.x || y < region.min.y || y > region.max.y || z < region.min.z || z > region.max.z) continue;
        out.push(x, y, z);
      }
    }
  }
  return new Float64Array(out);
}

function kdBuild(P) {
  const n = P.length / 3;
  const idx = new Int32Array(n);
  for (let i = 0; i < n; i++) idx[i] = i * 3;
  const nodes = [];
  function build(lo, hi) {
    if (hi - lo <= 12) { nodes.push({ leaf: true, lo, hi }); return nodes.length - 1; }
    const mn = [Infinity, Infinity, Infinity]; const mx = [-Infinity, -Infinity, -Infinity];
    for (let i = lo; i < hi; i++) for (let a = 0; a < 3; a++) { const v = P[idx[i] + a]; if (v < mn[a]) mn[a] = v; if (v > mx[a]) mx[a] = v; }
    let axis = 0;
    for (let a = 1; a < 3; a++) if (mx[a] - mn[a] > mx[axis] - mn[axis]) axis = a;
    const sub = Array.from(idx.subarray(lo, hi)).sort((u, v) => P[u + axis] - P[v + axis]);
    idx.set(sub, lo);
    const mid = (lo + hi) >> 1;
    const split = P[idx[mid] + axis];
    const me = nodes.length;
    nodes.push(null);
    const left = build(lo, mid);
    const right = build(mid, hi);
    nodes[me] = { leaf: false, axis, split, left, right };
    return me;
  }
  const root = build(0, n);
  return { nodes, idx, root, P };
}

function kdNearest(tree, x, y, z, bestSq) {
  const { nodes, idx, P } = tree;
  let best = bestSq;
  let bi = -1;
  const q = [x, y, z];
  const stack = [tree.root];
  const stackD = [0];
  while (stack.length) {
    const ni = stack.pop();
    const dd = stackD.pop();
    if (dd >= best) continue;
    const nd = nodes[ni];
    if (nd.leaf) {
      for (let i = nd.lo; i < nd.hi; i++) {
        const j = idx[i];
        const dx = P[j] - x; const dy = P[j + 1] - y; const dz = P[j + 2] - z;
        const d = dx * dx + dy * dy + dz * dz;
        if (d < best) { best = d; bi = j; }
      }
      continue;
    }
    const diff = q[nd.axis] - nd.split;
    stack.push(diff < 0 ? nd.right : nd.left); stackD.push(Math.max(dd, diff * diff));
    stack.push(diff < 0 ? nd.left : nd.right); stackD.push(dd);
  }
  return { dSq: best, j: bi };
}

function nearestPair(PA, PB) {
  if (!PA.length || !PB.length) return null;
  const tree = kdBuild(PB);
  let best = Infinity; let ia = -1; let ib = -1;
  for (let i = 0; i < PA.length; i += 3) {
    const r = kdNearest(tree, PA[i], PA[i + 1], PA[i + 2], best);
    if (r.j >= 0 && r.dSq < best) { best = r.dSq; ia = i; ib = r.j; if (best === 0) break; }
  }
  return { d: Math.sqrt(best), pa: [PA[ia], PA[ia + 1], PA[ia + 2]], pb: [PB[ib], PB[ib + 1], PB[ib + 2]] };
}

// closest point on a triangle (Ericson, Real-Time Collision Detection 5.1.5)
function closestOnTri(px, py, pz, T, o, out) {
  const ax = T[o]; const ay = T[o + 1]; const az = T[o + 2];
  const bx = T[o + 3]; const by = T[o + 4]; const bz = T[o + 5];
  const cx = T[o + 6]; const cy = T[o + 7]; const cz = T[o + 8];
  const abx = bx - ax; const aby = by - ay; const abz = bz - az;
  const acx = cx - ax; const acy = cy - ay; const acz = cz - az;
  const apx = px - ax; const apy = py - ay; const apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz; const d2 = acx * apx + acy * apy + acz * apz;
  if (d1 <= 0 && d2 <= 0) { out[0] = ax; out[1] = ay; out[2] = az; return; }
  const bpx = px - bx; const bpy = py - by; const bpz = pz - bz;
  const d3 = abx * bpx + aby * bpy + abz * bpz; const d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) { out[0] = bx; out[1] = by; out[2] = bz; return; }
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); out[0] = ax + v * abx; out[1] = ay + v * aby; out[2] = az + v * abz; return; }
  const cpx = px - cx; const cpy = py - cy; const cpz = pz - cz;
  const d5 = abx * cpx + aby * cpy + abz * cpz; const d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) { out[0] = cx; out[1] = cy; out[2] = cz; return; }
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); out[0] = ax + w * acx; out[1] = ay + w * acy; out[2] = az + w * acz; return; }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
    out[0] = bx + w * (cx - bx); out[1] = by + w * (cy - by); out[2] = bz + w * (cz - bz);
    return;
  }
  const den = 1 / (va + vb + vc);
  const v = vb * den; const w = vc * den;
  out[0] = ax + abx * v + acx * w; out[1] = ay + aby * v + acy * w; out[2] = az + abz * v + acz * w;
}

/** Distance from a point to a shape's surface; 0 if the point is inside one of its solids. */
export function pointToShape(p, shape) {
  const [px, py, pz] = p;
  if (insideShape(shape, px, py, pz)) return { d: 0, q: [px, py, pz], inside: true };
  let best = Infinity;
  const q = [0, 0, 0];
  const tmp = [0, 0, 0];
  const { TB } = shape;
  for (let t = 0; t < shape.nt; t++) {
    const o = t * 6;
    const bx = Math.max(0, TB[o] - px, px - TB[o + 3]);
    const by = Math.max(0, TB[o + 1] - py, py - TB[o + 4]);
    const bz = Math.max(0, TB[o + 2] - pz, pz - TB[o + 5]);
    if (bx * bx + by * by + bz * bz >= best * best) continue;
    closestOnTri(px, py, pz, shape.T, t * 9, tmp);
    const d = Math.hypot(tmp[0] - px, tmp[1] - py, tmp[2] - pz);
    if (d < best) { best = d; q[0] = tmp[0]; q[1] = tmp[1]; q[2] = tmp[2]; }
  }
  return { d: best, q, inside: false };
}

function anyInside(P, shape) {
  for (const s of shape.solids) {
    for (let i = 0; i < P.length; i += 3) {
      if (insideSolid(s, P[i], P[i + 1], P[i + 2])) return [P[i], P[i + 1], P[i + 2]];
    }
  }
  return null;
}

const expand = (box, e) => box.clone().expandByScalar(e);

/**
 * Minimum surface distance between two shapes in metres: {d, pa, pb, overlap}.
 * d = 0 when the surfaces cross or one shape lies inside a solid of the other.
 * Coarse 12 mm sampling, a 2.5 mm pass near the closest pair, then an exact
 * point-to-triangle refinement.
 */
export function shapeDist(A, B, { fine = 0.0025, coarse = 0.012, fineLimit = 0.09 } = {}) {
  if (!A.nt || !B.nt) return { d: Infinity, overlap: false };
  let e = boxGap(A.box, B.box) + 0.05;
  let res = null;
  for (let iter = 0; iter < 6; iter++) {
    const PA = sample(A, expand(B.box, e), coarse);
    const PB = sample(B, expand(A.box, e), coarse);
    if (PA.length && PB.length) {
      const ins = anyInside(PA, B) || anyInside(PB, A);
      if (ins) return { d: 0, pa: ins, pb: ins, overlap: true };
      res = nearestPair(PA, PB);
      if (res && res.d <= e) break;
    }
    e = Math.max(e * 2, (res ? res.d : 0) + 0.05);
  }
  if (!res) return { d: Infinity, overlap: false };
  if (res.d > fineLimit) return { d: refine(res, A, B), pa: res.pa, pb: res.pb, overlap: false };
  const m = res.d + 2 * coarse + 0.01;
  const PA = sample(A, expand(B.box, m), fine);
  const PB = sample(B, expand(A.box, m), fine);
  const ins = anyInside(PA, B) || anyInside(PB, A);
  if (ins) return { d: 0, pa: ins, pb: ins, overlap: true };
  const r2 = nearestPair(PA, PB) || res;
  const d = refine(r2, A, B);
  return { d, pa: r2.pa, pb: r2.pb, overlap: d < 0.0015 };
}

function refine(r, A, B) {
  return Math.min(r.d, pointToShape(r.pa, B).d, pointToShape(r.pb, A).d);
}

// ---------------------------------------------------------------- linear members
// beam(), bar() and tube() in src/scene/geom.js mark their meshes with
// userData.span; their local axis runs along +y from the start to the end point.

/** World end point ('start' | 'end') and radius of a linear member. */
export function endOf(m, which) {
  const g = m.geometry;
  const p = g.parameters || {};
  let local;
  let r;
  if (g.type === 'TubeGeometry') {
    local = p.path.getPointAt(which === 'start' ? 0 : 1).clone();
    r = p.radius;
  } else if (g.type === 'CylinderGeometry') {
    local = new THREE.Vector3(0, (which === 'start' ? -1 : 1) * p.height / 2, 0);
    r = Math.max(p.radiusTop, p.radiusBottom);
  } else if (g.type === 'BoxGeometry' || g.type === 'RoundedBoxGeometry') {
    local = new THREE.Vector3(0, (which === 'start' ? -1 : 1) * p.height / 2, 0);
    r = Math.max(p.width, p.depth) / 2;
  } else {
    return null;
  }
  return { p: local.applyMatrix4(m.matrixWorld), r };
}

/** Points along the centre line of a linear member, about `step` apart. */
export function centreLine(m, step = 0.004) {
  const g = m.geometry;
  const p = g.parameters || {};
  const out = [];
  if (g.type === 'TubeGeometry') {
    const n = Math.max(2, Math.ceil(p.path.getLength() / step));
    for (const v of p.path.getSpacedPoints(n)) out.push(v.clone().applyMatrix4(m.matrixWorld));
  } else if (p.height !== undefined) {
    const n = Math.max(2, Math.ceil(p.height / step));
    for (let i = 0; i <= n; i++) out.push(new THREE.Vector3(0, -p.height / 2 + (p.height * i) / n, 0).applyMatrix4(m.matrixWorld));
  }
  return out;
}

export const mm = (d) => (Number.isFinite(d) ? Math.round(d * 1000) : d);
export const fmt = (p) => (p ? `(${(p.toArray ? p.toArray() : p).map((v) => v.toFixed(3)).join(', ')})` : '-');
