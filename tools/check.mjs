#!/usr/bin/env node
// Consistency check for the 3D map (no browser needed):
//   node tools/check.mjs [--only=basic,joints,shared,pass,clash] [--verbose]
// * every catalog group has at least one 3D location and vice versa,
// * every component has geometry inside the scene bounds,
// * every component's `match` rule selects at least one part row,
// * joints: parts fastened together touch in every vehicle configuration (src/scene/joints.js),
// * shared parts: a non-fastener part number listed in two groups resolves to
//   the same component in both, or to components that touch,
// * pass-through: beams, bars and tubes do not run through other parts' solids
//   or cross their surfaces (plates, skins, trims),
// * clash: no part sits deep inside another part's solid.
// A joint lets the two parts it names overlap only where they are fastened:
// within the end region of an @start/@end reference, or for a bounded length / depth.
import { register } from 'node:module';
import { readFile } from 'node:fs/promises';

register('./three-loader.mjs', import.meta.url);
const THREE = await import('three');
const { buildScene } = await import('../src/scene/build.js');
const { Catalog } = await import('../src/catalog.js');
const M = await import('./measure.mjs');
const { JOINTS, PASS_OK, SHARED_OK } = await import('../src/scene/joints.js');

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
// 'part' = both meshes belong to the referenced parts (bounded overlap), '' = not covered.
const END_ZONE = 0.05;
function cover(a, ma, b, mb, p) {
  const rows = pairRows.get(`${a.id}|${b.id}`);
  if (!rows) return '';
  let best = '';
  for (const { ra, rb } of rows) {
    if (!within(ma, ra.obj) || !within(mb, rb.obj)) continue;
    const ends = [ra.end, rb.end].filter(Boolean);
    if (!ends.length) { best = 'part'; continue; }
    if (ends.some((e) => p.distanceTo(e.p) <= e.r + END_ZONE)) return 'end';
  }
  return best;
}

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
    const gap = mm(r.d);
    if (gap > max) {
      const where = `${M.fmt(r.pa)} → ${M.fmt(r.pb)}`;
      (j.known ? warnings : errors).push(`joint ${label}: gap ${gap} mm > ${max} mm ${where}  [${j.note}]`);
    } else {
      ok++;
      if (verbose) info.push(`joint ok ${gap} mm  ${label}`);
    }
  }
  info.push(`joints: ${ok}/${JOINTS.length} within tolerance`);
}

// ---------------------------------------------------------------- shared parts
if (want('shared')) {
  const HW = /\b(BOLTS?|BLT|NUTS?|SCREWS?|SCR|WASHERS?|WSHR|CLIPS?|RIVETS?|RIVITS?|RVT|RIVNUT|NUTSERT|STUDS?|GROMMETS?|TAPE|SEALANT|SEALER|PRIMER|CABLE TIES?|TIE STRAPS?|TIE-STRAP|ZIP TIE|LABELS?|STICKER|ADHESIVE|GLUE|COMPOUND|GREASE|LUBRICANT|BETASEAL|INSTAPACK|BUTYL|URETHANE|FASTENER|PUSH ?PIN|SHIM|CLAMP|HOSE RING)\b/i;
  const BLANK = /^(NA|N\/A|-|NO LONGER AVAILABLE|DISCONTINUED|TBA|)$/i;
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
          if (!best || mm(best.d) > 3) { worst = { cfg, best }; break; }
        }
        if (!shown) { unchecked++; if (verbose) info.push(`shared part ${k}: ${gids[i]} and ${gids[j]} are never shown together`); }
        if (shown && worst) {
          fails++;
          const r = ra[0];
          const b = worst.best;
          errors.push(`shared part ${k} "${r.name}" (#${ra[0].no} in ${gids[i]}, #${rb[0].no} in ${gids[j]}): `
            + `${b ? `${b.a} and ${b.b} are ${mm(b.d)} mm apart` : 'no side-compatible pair'} in ${cfgName(worst.cfg)}`);
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
        const solids = S.solids.filter((x) => !x.hollow);
        let free = 0;
        let part = 0;
        let first = null;
        for (const p of pts) {
          const s = solids.find((x) => M.insideSolid(x, p.x, p.y, p.z));
          if (!s) continue;
          const c = cover(a, m, b, s.mesh, p);
          if (c === 'end') continue;
          if (c === 'part') part++; else free++;
          if (!first) first = p;
        }
        // centre line crossing a surface-only mesh (plate, skin, trim, open shell)
        let cross = 0;
        let crossAt = null;
        const TB = S.TB;
        for (const r of S.ranges) {
          if (r.mesh.userData.hollow || S.solids.some((x) => x.mesh === r.mesh)) continue;
          for (let i = 0; i + 1 < pts.length; i++) {
            const p = pts[i];
            const q = pts[i + 1];
            for (let t = r.t0; t < r.t1; t++) {
              const o = t * 6;
              if (Math.max(p.x, q.x) < TB[o] || Math.min(p.x, q.x) > TB[o + 3] || Math.max(p.y, q.y) < TB[o + 1]
                || Math.min(p.y, q.y) > TB[o + 4] || Math.max(p.z, q.z) < TB[o + 2] || Math.min(p.z, q.z) > TB[o + 5]) continue;
              if (!M.segmentHitsTri(p, q, S.T, t * 9)) continue;
              if (cover(a, m, b, r.mesh, p)) continue;
              cross++;
              if (!crossAt) crossAt = p;
              break;
            }
          }
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
  let pairsN = 0;
  const found = new Set();
  for (const a of reg.items) {
    const A = shapeOfItem(a);
    for (const b of reg.items) {
      if (b === a || !A.box.intersectsBox(boxes.get(b.id)) || !together(a, b)) continue;
      const B = shapeOfItem(b);
      const solids = B.solids.filter((x) => !x.hollow);
      if (!solids.length) continue;
      pairsN++;
      for (const r of A.ranges) {
        if (r.mesh.userData.span) continue; // linear members: pass-through above
        const region = new THREE.Box3().setFromObject(r.mesh).intersect(B.box);
        if (region.isEmpty()) continue;
        const P = M.sample(A, region, STEP, r.t0, r.t1);
        let worst = null;
        for (let i = 0; i < P.length; i += 3) {
          for (const s of solids) {
            const d = M.insideDepth(s, P[i], P[i + 1], P[i + 2]);
            if (d <= DEPTH || (worst && d <= worst.d)) continue;
            const p = new THREE.Vector3(P[i], P[i + 1], P[i + 2]);
            const c = cover(a, r.mesh, b, s.mesh, p);
            if (c === 'end' || (c === 'part' && d <= PART_DEPTH)) continue;
            worst = { d, p, part: partName(r.mesh), into: partName(s.mesh), c };
          }
        }
        if (!worst) continue;
        const key = `${a.id}#${worst.part}|${b.id}#${worst.into}`;
        if (found.has(`${b.id}#${worst.into}|${a.id}#${worst.part}`) || found.has(key)) continue; // report each overlap once
        found.add(key);
        const msg = `${a.id}${worst.part ? `#${worst.part}` : ''} is ${mm(worst.d)} mm deep inside ${b.id}${worst.into ? `#${worst.into}` : ''} at ${M.fmt(worst.p)}`
          + (worst.c === 'part' ? ` (fastened together; limit ${PART_DEPTH * 1000} mm)` : '');
        if (allowed(a, b, worst.part) || allowed(b, a, worst.into)) { if (verbose) info.push(`clash allowed: ${msg}`); continue; }
        errors.push(`clash: ${msg}`);
      }
    }
  }
  info.push(`clash: ${pairsN} overlapping component pairs tested`);
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
