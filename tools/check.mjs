#!/usr/bin/env node
// Consistency check for the 3D map (no browser needed):
//   node tools/check.mjs
// * every catalog group has at least one 3D location and vice versa,
// * every component has geometry inside the scene bounds,
// * every component's `match` rule selects at least one part row.
import { register } from 'node:module';
import { readFile } from 'node:fs/promises';

register('./three-loader.mjs', import.meta.url);
const THREE = await import('three');
const { buildScene } = await import('../src/scene/build.js');
const { Catalog } = await import('../src/catalog.js');

const data = JSON.parse(await readFile(new URL('../data/catalog.json', import.meta.url), 'utf8'));
const catalog = new Catalog(data);
const reg = buildScene();
for (const it of reg.items) it.system = catalog.systemOfGroup(it.groups[0]);
catalog.linkComponents(reg.items);

const errors = [];
const warnings = [];

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
for (const [gid, comps] of catalog.componentsByGroup) {
  if (comps.length < 2) continue;
  for (const p of catalog.groups.get(gid).parts) {
    multi++;
    const hits = comps.filter((c) => catalog.partMatches(c, p));
    if (hits.length && hits.length < comps.length) specific++;
  }
}

const m = catalog.meta.stats;
console.log(`catalog: ${m.systems} systems, ${m.groups} groups, ${m.rows} part rows, ${m.uniquePartNumbers} unique part numbers`);
console.log(`3D map: ${reg.items.length} components; ${catalog.componentsByGroup.size}/${catalog.groups.size} groups placed`);
console.log(`part rows in multi-location groups resolved to a subset of locations: ${specific}/${multi}`);
for (const w of warnings) console.log(`warning: ${w}`);
for (const e of errors) console.log(`ERROR: ${e}`);
if (errors.length) process.exit(1);
console.log('OK');
