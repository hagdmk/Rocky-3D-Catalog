#!/usr/bin/env node
// Consistency check for the 3D map (no browser needed):
//   node tools/check.mjs [--only=basic,joints,shared,pass,clash,float] [--verbose]
// * every catalog group has at least one 3D location and vice versa,
// * every component has geometry inside the scene bounds,
// * every component's `match` rule selects at least one part row,
// * joints: parts fastened together touch in every vehicle configuration (src/scene/joints.js),
// * shared parts: a non-fastener part number listed in two groups resolves to
//   the same component in both, or to components that touch,
// * pass-through: beams, bars and tubes do not run through other parts' solids
//   or cross their surfaces (plates, skins, trims),
// * clash: no part sits deep inside another part's solid,
// * floating: every piece of every component (its meshes, merged plates split into their islands, grouped by
//   contact) touches another part in each configuration where it is shown; a joint row proves only the
//   piece its partner touches.
// A joint lets the two parts it names overlap only where they are fastened:
// within the end region of an @start/@end reference, or for a bounded length / depth.
import { register } from 'node:module';
import { readFile } from 'node:fs/promises';

register('./three-loader.mjs', import.meta.url);
const THREE = await import('three');
const { buildScene } = await import('../src/scene/build.js');
const { Catalog } = await import('../src/catalog.js');
const M = await import('./measure.mjs');
const { JOINTS, PASS_OK, SHARED_OK, FLOAT_OK } = await import('../src/scene/joints.js');

const args = process.argv.slice(2);
const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const want = (k) => !only.length || only.includes(k);
const verbose = args.includes('--verbose');

const data = JSON.parse(await readFile(new URL('../data/catalog.json', import.meta.url), 'utf8'));
const catalog = new Catalog(data);
const reg = buildScene();
for (const it of reg.items) {
  it.system = catalog.systemOfGroup(it.groups[0]);
  it.root.updateMatrixWorld(true);
}
catalog.linkComponents(reg.items);

const errors = [];
const warnings = [];
const info = [];

// ---------------------------------------------------------------- basic
if (want('basic')) {
  for (const it of reg.items) {
    for (const g of it.groups) if (!catalog.groups.has(g)) errors.push(`${it.id}: unknown group "${g}"`);
    let meshes = 0;
    it.root.traverse((o) => { if (o.isMesh) meshes++; });
    if (!meshes) errors.push(`${it.id}: no meshes`);
    const box = new THREE.Box3().setFromObject(it.root);
    const ok = Number.isFinite(box.min.x) && box.min.x > -3.8 && box.max.x < 3.6 && box.min.y > -0.05 && box.max.y < 2.0
      && box.min.z > -2.2 && box.max.z < 2.2;
    if (!ok) errors.push(`${it.id}: geometry out of bounds ${JSON.stringify(box)}`);
  }
  for (const gid of catalog.groups.keys()) {
    if (!catalog.componentsByGroup.has(gid)) errors.push(`group "${gid}" has no 3D location`);
  }
  for (const it of reg.items) {
    for (const gid of it.groups) {
      const g = catalog.groups.get(gid);
      if (!g) continue;
      const n = g.parts.filter((p) => catalog.partMatches(it, p)).length;
      if (!n) warnings.push(`${it.id}: no part rows of "${gid}" match this location`);
    }
  }
  let specific = 0;
  let multi = 0;
  const fallback = new Map();
  for (const [gid, comps] of catalog.componentsByGroup) {
    if (comps.length < 2) continue;
    for (const p of catalog.groups.get(gid).parts) {
      multi++;
      const hits = comps.filter((c) => catalog.partMatches(c, p));
      if (hits.length && hits.length < comps.length) specific++;
      if (!hits.length) fallback.set(gid, (fallback.get(gid) || 0) + 1);
    }
  }
  info.push(`part rows in multi-location groups resolved to a subset of locations: ${specific}/${multi}`);
  const fb = [...fallback.values()].reduce((a, b) => a + b, 0);
  if (fb) {
    info.push(`part rows matching no location rule (shown on every location of their group): ${fb}`);
    if (verbose) for (const [g, n] of [...fallback].sort((a, b) => b[1] - a[1])) info.push(`  ${n}\t${g}`);
  }
}

// ---------------------------------------------------------------- configurations
const CONFIGS = [];
for (const drive of ['rwd', 'dm', 'pdm']) for (const susp of ['air', 'coil']) for (const booster of ['vacuum', 'ibooster']) CONFIGS.push({ drive, susp, booster });
const cfgName = (c) => `${c.drive}/${c.susp}/${c.booster}`;
const variantOk = (variant, cfg) => !variant || Object.entries(variant).every(([k, v]) => (Array.isArray(v) ? v : [v]).includes(cfg[k]));
const visibleIn = (it, cfg) => variantOk(it.variant, cfg);

const shapeCache = new Map();
const shapeOfItem = (it) => {
  if (!shapeCache.has(it.id)) shapeCache.set(it.id, M.shapeOf(it.id, M.meshesOf(it.root)));
  return shapeCache.get(it.id);
};
const distCache = new Map();
function itemDist(a, b) {
  const k = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
  if (!distCache.has(k)) {
    const A = shapeOfItem(a);
    const B = shapeOfItem(b);
    const g = M.boxGap(A.box, B.box);
    distCache.set(k, g > 0.3 ? { d: g } : M.shapeDist(A, B));
  }
  return distCache.get(k);
}
const mm = M.mm;
// a failing gap (mm) printed with the fewest decimals (1..6) that still show it above the limit:
// 2.4 -> '2.4', 2.0004 -> '2.0004', 2.0000247 -> '2.00002' (never '2 mm > 2 mm')
const mmAbove = (v, limit) => {
  let k = 1;
  while (k < 6 && Number(v.toFixed(k)) <= limit) k++;
  return v.toFixed(k);
};

// ---------------------------------------------------------------- joints
/** Resolve 'comp#name@end' to {it, obj, meshes, shape, end}. */
function resolveRef(ref) {
  const m = ref.match(/^([^#@]+)(?:#([^@]+))?(?:@(start|end))?$/);
  if (!m) throw new Error(`bad reference "${ref}"`);
  const [, id, name, end] = m;
  const it = reg.byId.get(id);
  if (!it) throw new Error(`unknown component "${id}"`);
  let obj = it.root;
  if (name) {
    const found = [];
    it.root.traverse((o) => { if (o !== it.root && o.name === name) found.push(o); });
    if (!found.length) throw new Error(`component "${id}" has no part named "${name}"`);
    if (found.length > 1) throw new Error(`component "${id}" has ${found.length} parts named "${name}"`);
    [obj] = found;
  }
  const meshes = M.meshesOf(obj);
  if (!meshes.length) throw new Error(`"${ref}" has no meshes`);
  if (!end) return { it, obj, meshes, shape: name ? M.shapeOf(ref, meshes) : shapeOfItem(it) };
  if (meshes.length !== 1 || !meshes[0].userData.span) throw new Error(`"${ref}": @${end} needs a single beam, bar or tube`);
  const e = M.endOf(meshes[0], end);
  return { it, obj, meshes, shape: M.regionShape(M.shapeOf(ref, meshes), e.p, e.r + 0.003), end: e };
}

const refCache = new Map();
const refOf = (ref) => {
  if (!refCache.has(ref)) {
    try { refCache.set(ref, resolveRef(ref)); } catch (e) { refCache.set(ref, { error: e.message }); }
  }
  return refCache.get(ref);
};
const within = (o, anc) => { for (let x = o; x; x = x.parent) if (x === anc) return true; return false; };

// joint rows by component pair, oriented: pairRows.get('a|b') = [{ra, rb, j}] with ra on a
const pairRows = new Map();
if (want('pass') || want('clash')) {
  for (const j of JOINTS) {
    const A = refOf(j.a);
    const B = refOf(j.b);
    if (A.error || B.error) continue;
    const add = (x, y) => {
      const k = `${x.it.id}|${y.it.id}`;
      if (!pairRows.has(k)) pairRows.set(k, []);
      pairRows.get(k).push({ ra: x, rb: y, j });
    };
    add(A, B);
    add(B, A);
  }
}
// Is the overlap of mesh `ma` of a (at point p) with mesh `mb` of b covered by a joint?
// 'end' = within the end region of an @start/@end reference (any depth there),
// 'inset' = a row with `inset: '<reason>'` (one part set into the other, e.g. a heater core in its slot),
// 'part' = both meshes belong to the referenced parts (bounded overlap), '' = not covered.
const END_ZONE = 0.05;
const RANK = { '': 0, part: 1, inset: 2, end: 3 };
function cover(a, ma, b, mb, p) {
  const rows = pairRows.get(`${a.id}|${b.id}`);
  if (!rows) return '';
  let best = '';
  for (const { ra, rb, j } of rows) {
    if (!within(ma, ra.obj) || !within(mb, rb.obj)) continue;
    const ends = [ra.end, rb.end].filter(Boolean);
    const kind = !ends.length ? (j.inset ? 'inset' : 'part') : ends.some((e) => p.distanceTo(e.p) <= e.r + END_ZONE) ? 'end' : '';
    if (RANK[kind] > RANK[best]) best = kind;
  }
  return best;
}
// The weakest cover over several solids that contain a point: one uncovered solid makes the point free.
const weakest = (kinds) => kinds.reduce((w, k) => (RANK[k] < RANK[w] ? k : w), 'end');

if (want('joints')) {
  let ok = 0;
  for (const j of JOINTS) {
    const label = `${j.a} ↔ ${j.b}`;
    let A;
    let B;
    A = refOf(j.a);
    B = refOf(j.b);
    if (A.error || B.error) {
      errors.push(`joint ${label}: ${A.error || B.error}`);
      continue;
    }
    const cfgs = CONFIGS.filter((c) => visibleIn(A.it, c) && visibleIn(B.it, c) && variantOk(j.variant, c));
    if (!cfgs.length) {
      errors.push(`joint ${label}: the two parts are never shown together${j.variant ? ` with ${JSON.stringify(j.variant)}` : ''}`);
      continue;
    }
    // a hollow placeholder counts by its shell: the part must reach it
    const r = M.shapeDist(A.shape, B.shape, { hollowSurface: true });
    const max = j.max ?? 2;
    const gapMm = r.d * 1000;
    if (gapMm > max + 1e-6) { // unrounded: 2.4 mm does not pass a 2 mm row
      const where = `${M.fmt(r.pa)} → ${M.fmt(r.pb)}`;
      (j.known ? warnings : errors).push(`joint ${label}: gap ${mmAbove(gapMm, max)} mm > ${max} mm ${where}  [${j.note}]`);
    } else {
      ok++;
      if (verbose) info.push(`joint ok ${gapMm.toFixed(2)} mm  ${label}`);
    }
  }
  info.push(`joints: ${ok}/${JOINTS.length} within tolerance`);
}

// ---------------------------------------------------------------- shared parts
if (want('shared')) {
  const HW = /\b(BOLTS?|BLT|NUTS?|SCREWS?|SCR|WASHERS?|WSHR|CLIPS?|RIVETS?|RIVITS?|RVT|RIVNUT|NUTSERT|STUDS?|GROMMETS?|TAPE|SEALANT|SEALER|PRIMER|CABLE TIES?|TIE STRAPS?|TIE-STRAP|ZIP TIE|LABELS?|STICKER|ADHESIVE|GLUE|COMPOUND|GREASE|LUBRICANT|BETASEAL|INSTAPACK|BUTYL|URETHANE|FASTENER|PUSH ?PIN|SHIM|CLAMP|HOSE RING)\b/i;
  const BLANK = /^(NA|N\/A|-|NO LONGER AVAILABLE|DISCONTINUED|TBA|)$/i;
  const SHARED_MAX = 3; // mm between the components of a shared part
  const keyOf = (p) => (!p.pn || BLANK.test(p.pn.trim())
    ? `NAME:${p.name.trim().toUpperCase().replace(/\s*[,-]\s*/g, ', ').replace(/\s+/g, ' ')}`
    : `PN:${p.pn.trim().toUpperCase()}`);
  const sideOf = (t = '') => (t.includes('L') ? 'L' : t.includes('R') ? 'R' : '');
  const globRe = (pat) => new RegExp(`^${pat.split('*').map((x) => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
  const okPats = SHARED_OK.flatMap((s) => s.keys.map((k) => ({ k, re: globRe(k) })));
  const okOf = (k) => okPats.find((o) => o.re.test(k));
  const usedOk = new Set();
  const byKey = new Map();
  for (const p of catalog.parts) {
    if (HW.test(p.name)) continue;
    const k = keyOf(p);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(p);
  }
  let pairs = 0;
  let fails = 0;
  let unchecked = 0;
  for (const [k, ps] of byKey) {
    const gids = [...new Set(ps.map((p) => p.group.id))];
    if (gids.length < 2) continue;
    const ok = okOf(k);
    if (ok) { usedOk.add(ok.k); continue; }
    for (let i = 0; i < gids.length; i++) {
      for (let j = i + 1; j < gids.length; j++) {
        pairs++;
        const ra = ps.filter((p) => p.group.id === gids[i]);
        const rb = ps.filter((p) => p.group.id === gids[j]);
        let worst = null;
        let shown = false;
        // a row whose matching part is not fitted in a configuration (e.g. vacuum-booster rows with an
        // iBooster) does not apply there
        const matchers = (rows) => rows.flatMap((p) => (catalog.componentsByGroup.get(p.group.id) || []).filter((c) => catalog.partMatches(c, p)));
        const ma = matchers(ra);
        const mb = matchers(rb);
        for (const cfg of CONFIGS) {
          const vis = (c) => visibleIn(c, cfg);
          // rows with no location rule of their own apply wherever their group is shown
          if ((ma.length && !ma.some(vis)) || (mb.length && !mb.some(vis))) continue;
          const ca = [...new Set(ra.flatMap((p) => catalog.componentsForPart(p, vis)))];
          const cb = [...new Set(rb.flatMap((p) => catalog.componentsForPart(p, vis)))];
          if (!ca.length || !cb.length) continue;
          shown = true;
          if (ca.some((c) => cb.includes(c))) continue;
          let best = null;
          for (const a of ca) {
            for (const b of cb) {
              if (sideOf(a.tags) && sideOf(b.tags) && sideOf(a.tags) !== sideOf(b.tags)) continue;
              const r = itemDist(a, b);
              if (!best || r.d < best.d) best = { ...r, a: a.id, b: b.id };
            }
          }
          if (!best || best.d * 1000 > SHARED_MAX + 1e-6) { worst = { cfg, best }; break; } // unrounded, like the joints
        }
        if (!shown) { unchecked++; if (verbose) info.push(`shared part ${k}: ${gids[i]} and ${gids[j]} are never shown together`); }
        if (shown && worst) {
          fails++;
          const r = ra[0];
          const b = worst.best;
          errors.push(`shared part ${k} "${r.name}" (#${ra[0].no} in ${gids[i]}, #${rb[0].no} in ${gids[j]}): `
            + `${b ? `${b.a} and ${b.b} are ${mmAbove(b.d * 1000, SHARED_MAX)} mm apart` : 'no side-compatible pair'} in ${cfgName(worst.cfg)}`);
        }
      }
    }
  }
  for (const o of okPats) if (!usedOk.has(o.k)) warnings.push(`SHARED_OK entry ${o.k} is not needed any more`);
  info.push(`shared parts: ${pairs - fails - unchecked}/${pairs - unchecked} group pairs resolve to one component or to touching components `
    + `(${unchecked} pairs never shown together, ${okPats.length} allow-listed keys)`);
}

// ---------------------------------------------------------------- pass-through and clash
const glob = (pat, id) => new RegExp(`^${pat.split('*').map((x) => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`).test(id);
const partName = (m) => m.name || (m.parent && m.parent.name) || '';
const usedPassOk = new Set();
const allowed = (a, b, aName) => PASS_OK.find((r) => {
  const [ra, rn] = r.a.split('#');
  const hit = glob(ra, a.id) && (!rn || rn === aName) && glob(r.b, b.id);
  if (hit) usedPassOk.add(r);
  return hit;
});
const boxes = new Map(reg.items.map((it) => [it.id, new THREE.Box3().setFromObject(it.root)]));
const together = (a, b) => CONFIGS.some((c) => visibleIn(a, c) && visibleIn(b, c));
// hollow() marks a closed placeholder block whose contents may run inside it. A thin plate (under 20 mm)
// or a surface-only mesh marked hollow is still tested like any other part.
const BLOCK_MIN = 0.02;
const isBlock = (s) => s.kind === 'box' && M.boxThickness(s) >= BLOCK_MIN;
const tested = (s) => !(s.hollow && isBlock(s));
for (const it of reg.items) {
  for (const s of shapeOfItem(it).solids) {
    if (s.hollow && s.kind !== 'box') errors.push(`${it.id}${partName(s.mesh) ? `#${partName(s.mesh)}` : ''}: hollow() is only for closed box placeholders (this is a ${s.kind})`);
  }
}

if (want('pass')) {
  const STEP = 0.004;
  const LIMIT = 0.010; // free run through another part's solid
  const PART_LIMIT = 0.040; // run through the part it is fastened to (a bolt through a bracket, a bar in a clamp)
  let checked = 0;
  for (const a of reg.items) {
    a.root.traverse((m) => {
      if (!m.isMesh || !m.userData.span) return;
      checked++;
      const pts = M.centreLine(m, STEP);
      const mbox = new THREE.Box3().setFromPoints(pts).expandByScalar(0.002);
      const named = partName(m);
      for (const b of reg.items) {
        if (b === a || !mbox.intersectsBox(boxes.get(b.id)) || !together(a, b)) continue;
        const S = shapeOfItem(b);
        const solids = S.solids.filter(tested);
        let free = 0;
        let part = 0;
        let first = null;
        for (const p of pts) {
          const kinds = solids.filter((x) => M.insideSolid(x, p.x, p.y, p.z)).map((x) => cover(a, m, b, x.mesh, p));
          if (!kinds.length) continue;
          const c = weakest(kinds);
          if (c === 'end') continue;
          if (c) part++; else free++;
          if (!first) first = p;
        }
        // centre line crossing another part's surface: any crossing of a surface-only mesh (plate, skin,
        // trim, open shell); entering and leaving a solid (2 or more crossings) however thin it is
        let cross = 0;
        let crossAt = null;
        const TB = S.TB;
        for (const r of S.ranges) {
          const sol = S.solids.find((x) => x.mesh === r.mesh);
          if (sol && !tested(sol)) continue;
          let n = 0;
          let at = null;
          for (let i = 0; i + 1 < pts.length; i++) {
            const p = pts[i];
            const q = pts[i + 1];
            const ts = []; // distinct crossings in this segment (a hit on a shared edge counts once)
            for (let t = r.t0; t < r.t1; t++) {
              const o = t * 6;
              if (Math.max(p.x, q.x) < TB[o] || Math.min(p.x, q.x) > TB[o + 3] || Math.max(p.y, q.y) < TB[o + 1]
                || Math.min(p.y, q.y) > TB[o + 4] || Math.max(p.z, q.z) < TB[o + 2] || Math.min(p.z, q.z) > TB[o + 5]) continue;
              const u = M.segmentHitT(p, q, S.T, t * 9);
              if (u < 0 || ts.some((v) => Math.abs(v - u) < 1e-6)) continue;
              ts.push(u);
            }
            if (!ts.length || cover(a, m, b, r.mesh, p)) continue;
            n += ts.length;
            if (!at) at = p;
          }
          if (n && (!sol || n >= 2)) { cross += n; if (!crossAt) crossAt = at; }
        }
        const msgs = [];
        if (free * STEP > LIMIT) msgs.push(`runs ${Math.round(free * STEP * 1000)} mm through ${b.id} from ${M.fmt(first)}`);
        if (part * STEP > PART_LIMIT) {
          msgs.push(`runs ${Math.round(part * STEP * 1000)} mm through ${b.id}, which it is fastened to, from ${M.fmt(first)} (limit ${PART_LIMIT * 1000} mm)`);
        }
        if (cross) msgs.push(`crosses the surface of ${b.id} ${cross}x, first at ${M.fmt(crossAt)}`);
        for (const msg0 of msgs) {
          const msg = `${a.id}${named ? `#${named}` : ''} ${msg0}`;
          if (allowed(a, b, named)) { if (verbose) info.push(`pass-through allowed: ${msg}`); continue; }
          errors.push(`pass-through: ${msg}`);
        }
      }
    });
  }
  info.push(`pass-through: ${checked} beams, bars and tubes scanned against solids and surfaces`);
}

if (want('clash')) {
  // surface points of every non-linear mesh tested against the other parts' solids
  const STEP = 0.008;
  const DEPTH = 0.010;
  const PART_DEPTH = 0.040;
  const PART_SPAN = 0.040; // a deep fastened overlap: second principal extent below this
  const PART_AREA = 0.0016; // ... and at most this area (m², 8 mm cells in its best-fit plane)
  let pairsN = 0;
  const found = new Set();
  for (const a of reg.items) {
    const A = shapeOfItem(a);
    for (const b of reg.items) {
      if (b === a || !A.box.intersectsBox(boxes.get(b.id)) || !together(a, b)) continue;
      const B = shapeOfItem(b);
      const solids = B.solids.filter(tested);
      if (!solids.length) continue;
      pairsN++;
      // every point of any mesh of a that lies 10-40 mm deep in a solid of b under a 'part' cover, once each
      // (in the first such solid): [x, y, z, a mesh, b solid]
      const deep = [];
      for (const r of A.ranges) {
        if (r.mesh.userData.span) continue; // linear members: pass-through above
        const region = new THREE.Box3().setFromObject(r.mesh).intersect(B.box);
        if (region.isEmpty()) continue;
        const P = M.sample(A, region, STEP, r.t0, r.t1);
        const aName = partName(r.mesh);
        let worst = null;
        for (let i = 0; i < P.length; i += 3) {
          let inPart = null;
          for (const s of solids) {
            const d = M.insideDepth(s, P[i], P[i + 1], P[i + 2]);
            if (d <= DEPTH) continue;
            const p = new THREE.Vector3(P[i], P[i + 1], P[i + 2]);
            const c = cover(a, r.mesh, b, s.mesh, p);
            if (c === 'end' || c === 'inset') continue;
            if (c === 'part' && d <= PART_DEPTH) {
              if (!inPart) inPart = [p.x, p.y, p.z, r.mesh, s.mesh];
              continue;
            }
            const bName = partName(s.mesh);
            if (allowed(a, b, aName) || allowed(b, a, bName)) {
              if (verbose && !worst) info.push(`clash allowed: ${a.id}${aName ? `#${aName}` : ''} inside ${b.id}${bName ? `#${bName}` : ''}`);
              continue;
            }
            if (!worst || d > worst.d) worst = { d, p, into: bName, c };
          }
          if (inPart) deep.push(inPart);
        }
        if (!worst) continue;
        const key = `${a.id}#${aName}|${b.id}#${worst.into}`;
        if (found.has(`${b.id}#${worst.into}|${a.id}#${aName}`) || found.has(key)) continue; // report each overlap once
        found.add(key);
        errors.push(`clash: ${a.id}${aName ? `#${aName}` : ''} is ${mm(worst.d)} mm deep inside ${b.id}${worst.into ? `#${worst.into}` : ''} at ${M.fmt(worst.p)}`
          + (worst.c === 'part' ? ` (fastened together; limit ${PART_DEPTH * 1000} mm)` : ''));
      }
      // fastened parts may overlap only locally (a bushing in an eye, a bolt in a bracket); a deep overlap
      // spread over a whole face (40 x 40 mm, or 1600 mm² in all) needs an explicit inset reason on the joint row.
      // Each separate overlap (points linked within 12 mm, over all meshes of a and all solids of b, so the
      // verdict does not depend on how either part is split into meshes; two small lugs far apart are not one
      // big overlap) is judged by its principal extents and by the area it covers in its best-fit plane
      // (8 mm grid cells). A PASS_OK entry exempts only its own mesh pairs: the rest of a failing overlap is
      // clustered again and judged without them.
      if (!deep.length) continue;
      const big = (cl) => {
        const e = M.principalExtents(cl);
        const area = M.planarArea(cl, STEP);
        return e[1] < PART_SPAN && area <= PART_AREA + 1e-12 ? null : { e, area };
      };
      const okPairs = new Map();
      const okPair = (q) => {
        const k = `${q[3].id}|${q[4].id}`;
        if (!okPairs.has(k)) okPairs.set(k, !!(allowed(a, b, partName(q[3])) || allowed(b, a, partName(q[4]))));
        return okPairs.get(k);
      };
      for (const cl0 of M.clusterPoints(deep, 0.012)) {
        if (!big(cl0)) continue;
        const rest = cl0.filter((q) => !okPair(q));
        const parts = rest.length === cl0.length ? [cl0] : M.clusterPoints(rest, 0.012);
        let bad = null;
        for (const cl of parts) { const v = big(cl); if (v) { bad = { cl, ...v }; break; } }
        if (!bad) continue;
        const { cl, e, area } = bad;
        const n = new Map(); // mesh/solid pair -> points
        for (const q of cl) {
          const k = `${q[3].id}|${q[4].id}`;
          if (!n.has(k)) n.set(k, { m: q[3], s: q[4], c: 0 });
          n.get(k).c++;
        }
        const top = [...n.values()].sort((u, v) => v.c - u.c)[0];
        const aName = partName(top.m);
        const bName = partName(top.s);
        errors.push(`clash: ${a.id}${aName ? `#${aName}` : ''} overlaps ${b.id}${bName ? `#${bName}` : ''}, which it is fastened to, more than ${DEPTH * 1000} mm deep over ${mm(e[0])} x ${mm(e[1])} mm, ${Math.round(area * 1e6)} mm² `
          + `${n.size > 1 ? `(one overlap over ${n.size} mesh/solid pairs) ` : ''}(limits ${PART_SPAN * 1000} mm across, ${Math.round(PART_AREA * 1e6)} mm²; set inside it? give the joint row an inset reason)`);
        break;
      }
    }
  }
  info.push(`clash: ${pairsN} overlapping component pairs tested`);
}
if (want('float')) {
  // Every separate piece of every component must touch another component in each configuration where
  // it is shown. A component's meshes are grouped into pieces by mutual contact (<= 2 mm, a hollow
  // block counts by its shell). A joint row proves contact only for the piece that really touches the
  // row's partner (measured here: a row on a whole component or a named group says nothing about its
  // other pieces); every other piece is measured against all parts near it.
  const okIds = new Set(FLOAT_OK.map((f) => f.id));
  const meshShape = new Map();
  const shapeOfMeshes = (key, ms) => { if (!meshShape.has(key)) meshShape.set(key, M.shapeOf(key, ms)); return meshShape.get(key); };
  const touch = (A, B) => M.boxGap(A.box, B.box) <= 0.002 && M.shapeDist(A, B, { coarse: 0.008, hollowSurface: true }).d <= 0.002;
  // joint references: mesh -> the partner references of the rows naming it
  const proven = new Map();
  for (const j of JOINTS) {
    if (j.known || (j.max ?? 2) > 2) continue;
    const A = refOf(j.a);
    const B = refOf(j.b);
    if (A.error || B.error || A.it === B.it) continue;
    for (const [x, y] of [[A, j.b], [B, j.a]]) {
      for (const m of x.meshes) {
        if (!proven.has(m)) proven.set(m, []);
        if (!proven.get(m).includes(y)) proven.get(m).push(y);
      }
    }
  }
  let pieces = 0;
  let measured = 0;
  let rowTested = 0;
  let rowMissed = 0;
  const touchCache = new Map();
  const touchOnce = (key, P, S) => { if (!touchCache.has(key)) touchCache.set(key, touch(P, S)); return touchCache.get(key); };
  // A plain BufferGeometry mesh can hold several separate plates (plates() merges them to save draw calls),
  // so it is split into its connected triangle islands (corners in the same 0.5 mm cell count as shared)
  // before the grouping. Typed primitives (box, cylinder, tube, lathe, ...) stay whole, so their solids and
  // hollow() keep working. An island is a surface-only mesh in world coordinates.
  const ISLAND_Q = 0.0005;
  const islandsOf = (m) => {
    const g = m.geometry;
    if (g.type !== 'BufferGeometry') return [m];
    const pos = g.attributes.position;
    const ix = g.index;
    const nt = Math.floor((ix ? ix.count : pos.count) / 3);
    const W = new Float64Array(nt * 9);
    const par = new Int32Array(nt).map((_, t) => t);
    const fd = (i) => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
    const cell = new Map();
    const v = new THREE.Vector3();
    for (let i = 0; i < nt * 3; i++) {
      v.fromBufferAttribute(pos, ix ? ix.getX(i) : i).applyMatrix4(m.matrixWorld);
      W[i * 3] = v.x; W[i * 3 + 1] = v.y; W[i * 3 + 2] = v.z;
      const key = (Math.round(v.x / ISLAND_Q) * 32768 + Math.round(v.y / ISLAND_Q)) * 32768 + Math.round(v.z / ISLAND_Q);
      const t = (i / 3) | 0;
      const o = cell.get(key);
      if (o === undefined) cell.set(key, t);
      else { const r1 = fd(o); const r2 = fd(t); if (r1 !== r2) par[r1] = r2; }
    }
    const isl = new Map();
    for (let t = 0; t < nt; t++) { const r = fd(t); if (!isl.has(r)) isl.set(r, []); isl.get(r).push(t); }
    if (isl.size < 2) return [m];
    return [...isl.values()].map((ts) => {
      const arr = new Float64Array(ts.length * 9);
      ts.forEach((t, k) => arr.set(W.subarray(t * 9, t * 9 + 9), k * 9));
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      const u = new THREE.Mesh(geo);
      u.userData = { ...m.userData };
      return u;
    });
  };
  let split = 0;
  for (const a of reg.items) {
    if (okIds.has(a.id)) continue;
    const real = M.meshesOf(a.root); // "mesh N" in the messages: the N-th of these (traversal order)
    const ms = []; // islands
    const owner = []; // island -> index in real
    const isl = []; // island -> [k, islands of its mesh]
    real.forEach((m, r) => {
      const us = islandsOf(m);
      if (us.length > 1) split++;
      us.forEach((u, k) => { ms.push(u); owner.push(r); isl.push([k, us.length]); });
    });
    const shapes = ms.map((m, i) => shapeOfMeshes(`${a.id}/${i}`, [m]));
    const parent = ms.map((_, i) => i);
    const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    for (let i = 0; i < ms.length; i++) {
      for (let k = i + 1; k < ms.length; k++) {
        if (find(i) === find(k)) continue;
        if (touch(shapes[i], shapes[k])) parent[find(i)] = find(k);
      }
    }
    const groups = new Map();
    ms.forEach((m, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); });
    const A = shapeOfItem(a);
    const near = reg.items.filter((b) => b !== a && M.boxGap(A.box, shapeOfItem(b).box) <= 0.002)
      .sort((x, y) => shapeOfItem(x).nt - shapeOfItem(y).nt);
    // the named() sub-part of a piece's first mesh (not the component's own root group)
    const nameOf = (idx) => { const m = real[owner[idx[0]]]; return m.name || (m.parent !== a.root && m.parent.name) || ''; };
    const names = [...groups.values()].map(nameOf);
    for (const idx of groups.values()) {
      pieces++;
      const pms = idx.map((i) => ms[i]);
      const P = idx.length === ms.length ? A : shapeOfMeshes(`${a.id}/piece${idx[0]}`, pms);
      const name = nameOf(idx);
      const N = owner[idx[0]];
      const [k, n] = isl[idx[0]];
      let what = name ? `#${name}` : `with mesh ${N}`;
      if (n > 1) what += `, ${name ? `mesh ${N} ` : ''}island ${k + 1} of ${n} around ${M.fmt(P.box.getCenter(new THREE.Vector3()))}`;
      else if (name && names.filter((x) => x === name).length > 1) what += `, mesh ${N}`;
      const label = `${a.id}${groups.size > 1 ? ` (piece ${what})` : ''}`;
      // a joint row naming one of the piece's meshes counts only if its partner touches this piece
      const byJoint = new Set();
      for (const ref of new Set(idx.flatMap((i) => proven.get(real[owner[i]]) || []))) {
        const y = refOf(ref);
        if (byJoint.has(y.it.id)) continue;
        rowTested++;
        const whole = y.shape === shapeOfItem(y.it);
        if (touchOnce(`${a.id}/${idx[0]}|${whole ? y.it.id : ref}`, P, y.shape)) byJoint.add(y.it.id);
        else {
          rowMissed++;
          if (verbose) info.push(`float: joint partner ${ref} does not touch ${label}, which is measured against every part near it`);
        }
      }
      for (const cfg of CONFIGS) {
        if (!visibleIn(a, cfg)) continue;
        if ([...byJoint].some((id) => visibleIn(reg.byId.get(id), cfg))) continue;
        measured++;
        const ok = near.some((b) => visibleIn(b, cfg) && touchOnce(`${a.id}/${idx[0]}|${b.id}`, P, shapeOfItem(b)));
        if (ok) continue;
        errors.push(`floating: ${label} touches no other part in ${cfgName(cfg)}`);
        break;
      }
    }
  }
  for (const id of okIds) if (!reg.byId.has(id)) warnings.push(`FLOAT_OK entry ${id} is not a component`);
  info.push(`floating: every piece of every component touches another part (${pieces} pieces, ${measured} piece/configuration cases measured, ${okIds.size} allow-listed; `
    + `${split} plain meshes split into separate islands, ${rowTested} joint-row partners tested on the pieces they name, ${rowMissed} of them do not touch that piece)`);
}
if (want('pass') && want('clash')) for (const r of PASS_OK) if (!usedPassOk.has(r)) warnings.push(`PASS_OK entry ${r.a} / ${r.b} is not needed any more`);

const m = catalog.meta.stats;
console.log(`catalog: ${m.systems} systems, ${m.groups} groups, ${m.rows} part rows, ${m.uniquePartNumbers} unique part numbers`);
console.log(`3D map: ${reg.items.length} components; ${catalog.componentsByGroup.size}/${catalog.groups.size} groups placed`);
for (const l of info) console.log(l);
for (const w of warnings) console.log(`warning: ${w}`);
for (const e of errors) console.log(`ERROR: ${e}`);
if (errors.length) {
  console.log(`${errors.length} error(s)`);
  process.exit(1);
}
console.log('OK');
