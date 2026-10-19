// Parametric body skin.
//
// The outer surface is a loft of cross-sections along the car.  Each section
// (left half, mirrored for the right) is a Catmull-Rom curve through seven
// control points, parameterised by v:
//   v = -1  bottom centerline           v = 2  shoulder / beltline
//   v =  0  lower edge of the side skin  v = 3  window sill
//   v =  1  maximum width                v = 4  roof edge / hood crown
//                                        v = 5  top centerline
// Body panels are rectangles in (s, v) space, so panel cut lines follow the
// surface exactly.  The same surface, offset inward, provides interior trims.

import * as THREE from 'three';
import {
  LENGTH, topY, beltY, halfWidth, roofHalfWidth, roofDrop, sillFraction, sideBottomY, bottomY, xOf,
} from './profile.js';

const V_MIN = -1;
const V_MAX = 5;

function sectionPoints(s) {
  const W = halfWidth(s);
  const T = topY(s);
  const L = beltY(s);
  const Bs = sideBottomY(s);
  const Bc = bottomY(s) - 0.012;
  const p = [];
  p.push([0, Bc]); // -1 bottom center
  p.push([0.955 * W, Bs]); // 0 lower edge
  p.push([W, Bs + 0.4 * (L - Bs)]); // 1 max width
  p.push([0.994 * W, L]); // 2 shoulder
  const p3 = [sillFraction(s) * W, L + 0.025];
  p.push(p3); // 3 sill
  const p4 = [Math.min(roofHalfWidth(s), p3[0] - 0.012), Math.max(T - roofDrop(s), p3[1] + 0.006)];
  p.push(p4); // 4 roof edge
  p.push([0, Math.max(T, p4[1] + 0.002)]); // 5 top center
  return p;
}

// Centripetal Catmull-Rom between p1 and p2.
function cr(p0, p1, p2, p3, t) {
  const alpha = 0.5;
  const tj = (a, b) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    return Math.pow(Math.max(dx * dx + dy * dy, 1e-12), alpha * 0.5);
  };
  const t0 = 0;
  const t1 = t0 + tj(p0, p1);
  const t2 = t1 + tj(p1, p2);
  const t3 = t2 + tj(p2, p3);
  const tt = t1 + (t2 - t1) * t;
  const lerp = (a, b, ta, tb) => {
    const w = (tt - ta) / (tb - ta || 1e-9);
    return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w];
  };
  const A1 = lerp(p0, p1, t0, t1);
  const A2 = lerp(p1, p2, t1, t2);
  const A3 = lerp(p2, p3, t2, t3);
  const B1 = lerp(A1, A2, t0, t2);
  const B2 = lerp(A2, A3, t1, t3);
  return lerp(B1, B2, t1, t2);
}

const sectionCache = new Map();
function sectionAt(s) {
  const key = Math.round(s * 1e5);
  let pts = sectionCache.get(key);
  if (!pts) {
    pts = sectionPoints(s);
    sectionCache.set(key, pts);
  }
  return pts;
}

// Point on the left half (z <= 0) of the skin.
export function skinPoint(s, v, out = new THREE.Vector3()) {
  s = Math.min(Math.max(s, 0), LENGTH);
  const p = sectionAt(s);
  const i = Math.min(Math.max(Math.floor(v - V_MIN), 0), p.length - 2);
  const t = v - V_MIN - i;
  const get = (k) => {
    if (k < 0) return [-p[1][0], p[1][1]]; // mirror across bottom centerline
    if (k >= p.length) return [-p[p.length - 2][0], p[p.length - 2][1]]; // mirror across top
    return p[k];
  };
  const q = cr(get(i - 1), get(i), get(i + 1), get(i + 2), t);
  return out.set(xOf(s), q[1], -q[0]);
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _d = new THREE.Vector3();
// Outward normal of the left half.
export function skinNormal(s, v, out = new THREE.Vector3()) {
  const es = 0.002;
  const ev = 0.004;
  skinPoint(Math.min(s + es, LENGTH - 1e-4), v, _a);
  skinPoint(Math.max(s - es, 1e-4), v, _b);
  skinPoint(s, Math.min(v + ev, V_MAX), _c);
  skinPoint(s, Math.max(v - ev, V_MIN), _d);
  const ds = _a.sub(_b);
  const dv = _c.sub(_d);
  // ds points to -x (rearward), dv goes up/around; for the left half the
  // outward normal is ds x dv.
  out.crossVectors(ds, dv);
  if (out.lengthSq() < 1e-14) {
    out.set(s < LENGTH / 2 ? 1 : -1, 0, 0);
  }
  return out.normalize();
}

function sortedUnique(values, eps = 1e-6) {
  const v = [...values].sort((a, b) => a - b);
  const out = [];
  for (const x of v) if (!out.length || x - out[out.length - 1] > eps) out.push(x);
  return out;
}

// `step` may be a number or a function of the position (finer near the ends).
function samples(lo, hi, step, breaks) {
  const vals = [];
  if (typeof step === 'function') {
    for (let x = lo; x < hi; x += Math.max(1e-3, step(x))) vals.push(x);
    vals.push(hi);
  } else {
    const n = Math.max(1, Math.ceil((hi - lo) / step));
    for (let i = 0; i <= n; i++) vals.push(lo + ((hi - lo) * i) / n);
  }
  for (const b of breaks) if (b > lo && b < hi) vals.push(b);
  return sortedUnique(vals);
}

/** Default longitudinal step: fine on the steep front and rear faces. */
export const dsAdaptive = (s) => (s < 0.35 || s > 4.55 ? 0.005 : 0.0125);

/**
 * Build a surface patch on (or offset from) the skin.
 * opts: {s0, s1, v0, v1, side: 'L'|'R'|'both', offset, ds, dv, include, field, edges}
 *  - offset > 0 moves the patch outward along the normal, < 0 inward.
 *  - include(s, v) keeps whole grid quads by their centre (rectangular cuts).
 *  - field(s, v) is a signed function (<= 0 inside); triangles are clipped
 *    exactly along its zero contour, giving smooth non-rectangular outlines.
 * Returns a BufferGeometry with positions + normals, or null if empty.
 */
export function skinPatch(opts) {
  const {
    s0, s1, v0, v1, side = 'both', offset = 0, ds = dsAdaptive, dv = 0.06,
    include = null, field = null, sBreaks = [], vBreaks = [], edges = false,
  } = opts;
  const ss = samples(s0, s1, ds, sBreaks);
  const vs = samples(v0, v1, dv, vBreaks);
  const ns = ss.length;
  const nv = vs.length;
  const sides = side === 'both' ? ['L', 'R'] : [side];
  const pos = [];
  const nor = [];
  const idx = [];
  const edgePos = [];
  const P = new THREE.Vector3();
  const N = new THREE.Vector3();

  // Field and inclusion are symmetric, so evaluate them once for both halves.
  const fv = field ? new Float64Array(ns * nv) : null;
  if (fv) for (let i = 0; i < ns; i++) for (let j = 0; j < nv; j++) fv[i * nv + j] = field(ss[i], vs[j]);
  const keep = [];
  for (let i = 0; i < ns - 1; i++) {
    keep.push([]);
    for (let j = 0; j < nv - 1; j++) {
      let k = include ? include((ss[i] + ss[i + 1]) / 2, (vs[j] + vs[j + 1]) / 2) : true;
      if (k && fv) {
        const f = [fv[i * nv + j], fv[(i + 1) * nv + j], fv[(i + 1) * nv + j + 1], fv[i * nv + j + 1]];
        if (f.every((x) => x > 0)) k = false;
        else if (f.some((x) => x > 0)) k = 2; // partially inside: clip
      }
      keep[i].push(k);
    }
  }

  for (const sd of sides) {
    const flip = sd === 'R';
    const base = pos.length / 3;
    for (let i = 0; i < ns; i++) {
      for (let j = 0; j < nv; j++) {
        skinPoint(ss[i], vs[j], P);
        skinNormal(ss[i], vs[j], N);
        if (offset) P.addScaledVector(N, offset);
        if (flip) { P.z = -P.z; N.z = -N.z; }
        pos.push(P.x, P.y, P.z);
        nor.push(N.x, N.y, N.z);
      }
    }
    const fAt = (g) => fv[g - base];
    const cut = new Map();
    const cutVertex = (a, b) => {
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      let k = cut.get(key);
      if (k !== undefined) return k;
      const fa = fAt(a);
      const fb = fAt(b);
      const t = fa / (fa - fb);
      k = pos.length / 3;
      for (let c = 0; c < 3; c++) pos.push(pos[a * 3 + c] + (pos[b * 3 + c] - pos[a * 3 + c]) * t);
      const n = [0, 1, 2].map((c) => nor[a * 3 + c] + (nor[b * 3 + c] - nor[a * 3 + c]) * t);
      const l = Math.hypot(n[0], n[1], n[2]) || 1;
      nor.push(n[0] / l, n[1] / l, n[2] / l);
      cut.set(key, k);
      return k;
    };
    const vtx = (k) => [pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]];
    const clipTri = (tri) => {
      const poly = [];
      const contour = [];
      for (let e = 0; e < 3; e++) {
        const a = tri[e];
        const b = tri[(e + 1) % 3];
        const ia = fAt(a) <= 0;
        const ib = fAt(b) <= 0;
        if (ia) poly.push(a);
        if (ia !== ib) {
          const c = cutVertex(a, b);
          poly.push(c);
          contour.push(c);
        }
      }
      for (let k = 1; k < poly.length - 1; k++) idx.push(poly[0], poly[k], poly[k + 1]);
      if (edges && contour.length === 2) edgePos.push(...vtx(contour[0]), ...vtx(contour[1]));
    };
    for (let i = 0; i < ns - 1; i++) {
      for (let j = 0; j < nv - 1; j++) {
        const k = keep[i][j];
        if (!k) continue;
        const a = base + i * nv + j;
        const b = base + (i + 1) * nv + j;
        const c = base + (i + 1) * nv + j + 1;
        const d = base + i * nv + j + 1;
        const tris = flip ? [[a, c, b], [a, d, c]] : [[a, b, c], [a, c, d]];
        if (k === 2) tris.forEach(clipTri);
        else for (const t of tris) idx.push(...t);
      }
    }
    if (edges) {
      // Outline along rectangular cuts (quads fully inside next to excluded quads).
      const at = (i, j) => vtx(base + i * nv + j);
      const k = (i, j) => i >= 0 && j >= 0 && i < ns - 1 && j < nv - 1 && keep[i][j];
      // with both halves built, the panel continues across the centreline (v = -1 / v = 5): no outline there
      const seamLo = side === 'both' && vs[0] <= V_MIN + 1e-9;
      const seamHi = side === 'both' && vs[nv - 1] >= V_MAX - 1e-9;
      for (let i = 0; i < ns - 1; i++) {
        for (let j = 0; j < nv - 1; j++) {
          if (keep[i][j] !== true) continue;
          if (!k(i - 1, j)) edgePos.push(...at(i, j), ...at(i, j + 1));
          if (!k(i + 1, j)) edgePos.push(...at(i + 1, j), ...at(i + 1, j + 1));
          if (!k(i, j - 1) && !(seamLo && j === 0)) edgePos.push(...at(i, j), ...at(i + 1, j));
          if (!k(i, j + 1) && !(seamHi && j === nv - 2)) edgePos.push(...at(i, j + 1), ...at(i + 1, j + 1));
        }
      }
    }
  }
  if (!idx.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  if (edges && edgePos.length) {
    const eg = new THREE.BufferGeometry();
    eg.setAttribute('position', new THREE.Float32BufferAttribute(edgePos, 3));
    g.userData.edges = eg;
  }
  return g;
}

/** Point on the skin of a given side, optionally offset along the normal. */
export function skinAt(s, v, side = 'L', offset = 0) {
  const p = skinPoint(s, v, new THREE.Vector3());
  if (offset) p.addScaledVector(skinNormal(s, v, new THREE.Vector3()), offset);
  if (side === 'R') p.z = -p.z;
  return p;
}

/** Polyline along the skin following a closed or open loop of (s, v) pairs. */
export function skinPath(svPairs, side = 'L', offset = 0, steps = 6) {
  const pts = [];
  for (let k = 0; k < svPairs.length - 1; k++) {
    const [sa, va] = svPairs[k];
    const [sb, vb] = svPairs[k + 1];
    for (let t = 0; t < steps; t++) {
      const u = t / steps;
      pts.push(skinAt(sa + (sb - sa) * u, va + (vb - va) * u, side, offset));
    }
  }
  const [sl, vl] = svPairs[svPairs.length - 1];
  pts.push(skinAt(sl, vl, side, offset));
  return pts;
}

/**
 * Find the skin point on the front (end = 'front') or rear face closest to a
 * target (y, z) — used to stick sensors, badges and plates onto the fascias.
 * Returns {p, n} (point and outward normal) in world coordinates.
 */
export function findOnFace(end, y, z, offset = 0) {
  const side = z > 0 ? 'R' : 'L';
  const zz = -Math.abs(z);
  const sRange = end === 'front' ? [0.0, 0.7] : [4.2, LENGTH];
  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  let best = null;
  const search = (s0, s1, v0, v1, n) => {
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= n; j++) {
        const s = s0 + ((s1 - s0) * i) / n;
        const v = v0 + ((v1 - v0) * j) / n;
        skinPoint(s, v, P);
        skinNormal(s, v, N);
        const facing = end === 'front' ? N.x : -N.x;
        if (facing < 0.25) continue;
        const d = (P.y - y) ** 2 + (P.z - zz) ** 2;
        if (!best || d < best.d) best = { d, s, v };
      }
    }
  };
  search(sRange[0], sRange[1], V_MIN, V_MAX, 60);
  if (best) {
    const ds = (sRange[1] - sRange[0]) / 60;
    const dv = (V_MAX - V_MIN) / 60;
    search(Math.max(0, best.s - ds), Math.min(LENGTH, best.s + ds), Math.max(V_MIN, best.v - dv), Math.min(V_MAX, best.v + dv), 24);
  }
  const p = skinAt(best.s, best.v, side, offset);
  const n = skinNormal(best.s, best.v, new THREE.Vector3());
  if (side === 'R') n.z = -n.z;
  return { p, n, s: best.s, v: best.v };
}

export { V_MIN, V_MAX };
