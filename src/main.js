import { Viewer } from './scene/viewer.js';
import { buildScene } from './scene/build.js';
import { Catalog } from './catalog.js';
import { App } from './ui/app.js';
import { JOINTS } from '../tools/joints.mjs';

async function main() {
  const res = await fetch('data/catalog.json');
  if (!res.ok) throw new Error(`catalog.json: HTTP ${res.status}`);
  const catalog = new Catalog(await res.json());

  const reg = buildScene();
  const unknown = [];
  for (const it of reg.items) for (const g of it.groups) if (!catalog.groups.has(g)) unknown.push(`${it.id} → ${g}`);
  if (unknown.length) console.error('Components reference unknown catalog groups:', unknown);

  const viewer = new Viewer(document.getElementById('viewport'));
  viewer.setComponents(reg.items, (gid) => catalog.systemOfGroup(gid));
  catalog.linkComponents(reg.items);
  // parts fastened together, so hidden mounting partners can be drawn as context
  viewer.setMounts(JOINTS.map((j) => [j.a.split(/[#@]/)[0], j.b.split(/[#@]/)[0]]));
  const unmapped = [...catalog.groups.keys()].filter((g) => !catalog.componentsByGroup.has(g));
  if (unmapped.length) console.warn('Catalog groups without a 3D location:', unmapped);

  const app = new App(viewer, catalog);
  app.init();

  window.__viewer = viewer;
  window.__app = app;
  window.__catalog = catalog;
  document.getElementById('loading').classList.add('done');
  window.__ready = true;
}

main().catch((err) => {
  console.error(err);
  const l = document.getElementById('loading');
  l.innerHTML = `<div style="color:#ff6b6b;max-width:520px;text-align:center;padding:20px">3D 맵을 불러오지 못했습니다.<br><small>${String(err.message || err)}</small><br><small>로컬 파일(file://)로 열었다면 간단한 웹 서버로 실행해 주세요: <code>python3 -m http.server</code></small></div>`;
});
