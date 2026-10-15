#!/usr/bin/env node
// Consistency check for the 3D map (no browser needed):
//   node tools/check.mjs [--only=basic,joints,shared,pass] [--verbose]
// * every catalog group has at least one 3D location and vice versa,
// * every component has geometry inside the scene bounds,
// * every component's `match` rule selects at least one part row,
// * joints: parts fastened together touch in every vehicle configuration (tools/joints.mjs),
// * shared parts: a non-fastener part number listed in two groups resolves to
//   the same component in both, or to components that touch,
// * pass-through: beams, bars and tubes do not run through other parts.
import { register } from 'node:module';
import { readFile } from 'node:fs/promises';

register('./three-loader.mjs', import.meta.url);
const THREE = await import('three');
const { buildScene } = await import('../src/scene/build.js');
const { Catalog } = await import('../src/catalog.js');
const M = await import('./measure.mjs');
const { JOINTS, PASS_OK, SHARED_OK } = await import('./joints.mjs');

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
/** Resolve 'comp#name@end' to {it, shape, label}. */
function resolveRef(ref) {
  const m = ref.match(/^([^#@]+)(?:#([^@]+))?(?:@(start|end))?$/);
  if (!m) throw new Error(`bad reference "${ref}"`);
  const [, id, name, end] = m;
  const it = reg.byId.get(id);
  if (!it) throw new Error(`unknown component "${id}"`);
  let obj = it.root;
  if (name) {
    obj = it.root.getObjectByName(name);
    if (!obj) throw new Error(`component "${id}" has no part named "${name}"`);
  }
  const meshes = M.meshesOf(obj);
  if (!meshes.length) throw new Error(`"${ref}" has no meshes`);
  if (!end) return { it, shape: name ? M.shapeOf(ref, meshes) : shapeOfItem(it) };
  if (meshes.length !== 1 || !meshes[0].userData.span) throw new Error(`"${ref}": @${end} needs a single beam, bar or tube`);
  const e = M.endOf(meshes[0], end);
  return { it, shape: M.regionShape(M.shapeOf(ref, meshes), e.p, e.r + 0.003), end: e.p };
}

const jointPairs = new Set();
if (want('joints') || want('pass')) {
  for (const j of JOINTS) {
    const ia = j.a.split(/[#@]/)[0];
    const ib = j.b.split(/[#@]/)[0];
    jointPairs.add(`${ia}|${ib}`);
    jointPairs.add(`${ib}|${ia}`);
  }
}

if (want('joints')) {
  let ok = 0;
  for (const j of JOINTS) {
    const label = `${j.a} ↔ ${j.b}`;
    let A;
    let B;
    try {
      A = resolveRef(j.a);
      B = resolveRef(j.b);
    } catch (e) {
      errors.push(`joint ${label}: ${e.message}`);
      continue;
    }
    const cfgs = CONFIGS.filter((c) => visibleIn(A.it, c) && visibleIn(B.it, c) && variantOk(j.variant, c));
    if (!cfgs.length) {
      errors.push(`joint ${label}: the two parts are never shown together${j.variant ? ` with ${JSON.stringify(j.variant)}` : ''}`);
      continue;
    }
    const r = M.shapeDist(A.shape, B.shape);
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
  const HW = /\b(BOLTS?|BLT|NUTS?|SCREWS?|SCR|WASHERS?|WSHR|CLIPS?|RIVETS?|RIVITS?|RVT|RIVNUT|NUTSERT|STUDS?|GROMMETS?|TAPE|SEALANT|SEALER|PRIMER|CABLE TIES?|TIE STRAPS?|TIE-STRAP|ZIP TIE|LABELS?|STICKER|ADHESIVE|GLUE|GREASE|LUBRICANT|BETASEAL|INSTAPACK|BUTYL|URETHANE|FASTENER|PUSH ?PIN|SHIM|CLAMP|HOSE RING)\b/i;
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
        for (const cfg of CONFIGS) {
          const vis = (c) => visibleIn(c, cfg);
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
  info.push(`shared parts: ${pairs - fails}/${pairs} group pairs resolve to one component or to touching components (${okPats.length} allow-listed keys)`);
}

// ---------------------------------------------------------------- pass-through
if (want('pass')) {
  const STEP = 0.004;
  const LIMIT_MM = 10;
  const glob = (pat, id) => new RegExp(`^${pat.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`).test(id);
  const allowed = (a, b, aName) => PASS_OK.some((r) => {
    const [ra, rn] = r.a.split('#');
    return glob(ra, a.id) && (!rn || rn === aName) && glob(r.b, b.id);
  });
  const boxes = new Map(reg.items.map((it) => [it.id, new THREE.Box3().setFromObject(it.root)]));
  let checked = 0;
  for (const a of reg.items) {
    a.root.traverse((m) => {
      if (!m.isMesh || !m.userData.span) return;
      checked++;
      const pts = M.centreLine(m, STEP);
      const mbox = new THREE.Box3().setFromPoints(pts);
      const named = m.name || (m.parent && m.parent.name) || '';
      for (const b of reg.items) {
        if (b === a || jointPairs.has(`${a.id}|${b.id}`)) continue;
        if (!mbox.intersectsBox(boxes.get(b.id))) continue;
        if (!CONFIGS.some((c) => visibleIn(a, c) && visibleIn(b, c))) continue;
        const S = shapeOfItem(b);
        if (!S.solids.some((x) => !x.hollow)) continue;
        let n = 0;
        let first = null;
        for (const p of pts) {
          if (M.insideShape(S, p.x, p.y, p.z, { skipHollow: true })) { n++; if (!first) first = p; }
        }
        const len = n * STEP * 1000;
        if (len <= LIMIT_MM) continue;
        const msg = `${a.id}${named ? `#${named}` : ''} runs ${Math.round(len)} mm through ${b.id} from ${M.fmt(first)}`;
        if (allowed(a, b, named)) { if (verbose) info.push(`pass-through allowed: ${msg}`); continue; }
        errors.push(`pass-through: ${msg}`);
      }
    });
  }
  info.push(`pass-through: ${checked} beams, bars and tubes scanned`);
}

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
