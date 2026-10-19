// UI controller: system tree, search, info panel, tooltip, settings.

import { tagLabels } from '../catalog.js';
import { SYSTEM_COLORS } from '../scene/materials.js';

// The catalog PDF; a page can override it with <meta name="catalog-pdf" content="…">.
const PDF = document.querySelector('meta[name=catalog-pdf]')?.content || 'model_s_partsGuide-NA-2012-2016.pdf';
const VARIANT_KO = {
  drive: { rwd: 'RWD', dm: '듀얼 모터', pdm: 'P 듀얼 모터' },
  susp: { air: '에어 서스펜션', coil: '코일 서스펜션' },
  booster: { vacuum: '진공 부스터', ibooster: 'iBooster' },
};

// Fasteners and consumables: a bolt or clip listed in two groups does not make them one part.
const HARDWARE = /\b(BOLTS?|BLT|NUTS?|SCREWS?|SCR|WASHERS?|WSHR|CLIPS?|RIVETS?|RIVITS?|RVT|RIVNUT|NUTSERT|STUDS?|GROMMETS?|TAPE|SEALANT|SEALER|PRIMER|CABLE TIES?|TIE STRAPS?|TIE-STRAP|ZIP TIE|LABELS?|STICKER|ADHESIVE|GLUE|COMPOUND|GREASE|LUBRICANT|BETASEAL|INSTAPACK|BUTYL|URETHANE|FASTENERS?|HARDWARE|PUSH ?PIN|SHIM|CLAMP|HOSE RING)\b/i;
const NO_PN = /^(NA|N\/A|-|NO LONGER AVAILABLE|DISCONTINUED|TBA|)$/i;
// Group-name qualifiers for vehicle configurations: "Front Subframe" / "Front Subframe - Dual Motor",
// "Motor Cooling - RWD" / "Motor Cooling - Dual Motor - Large Rear Drive Unit", trims, regions, generations.
const CONFIG_QUALIFIER = /\s+-\s+(Dual Motor|Single Motor|Rear Wheel Drive|RWD|(?:1st|2nd) Generation|(?:Base|Performance|Premium|Signature|Next Generation) Trim|Base|Premium|NA|EU and APAC|North America|Europe|China|Japan and Australia|Park Assist|Driver Assist|(?:Large|Small) Rear Drive Unit)(?=\s+-\s+|$)/gi;
/** Groups with the same family are versions of one assembly for different configurations. */
const groupFamily = (name) => name.replace(CONFIG_QUALIFIER, '').replace(/^(Dual|Single)\s+/i, '').trim().toUpperCase();

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function pageRange(pages) {
  if (!pages.length) return '';
  const a = Math.min(...pages);
  const b = Math.max(...pages);
  return a === b ? `p.${a}` : `p.${a}–${b}`;
}

export class App {
  constructor(viewer, catalog) {
    this.viewer = viewer;
    this.cat = catalog;
    this.state = { mode: null };
    this.locFilter = true;
    this.tableFilter = '';
    this.groupLinks = new Map(); // component id -> how its catalog groups relate (see groupLink)
  }

  init() {
    this.buildTree();
    this.bindTopbar();
    this.bindConfig();
    this.bindToolbar();
    this.bindViewer();
    this.bindKeys();
    this.buildAbout();
    window.addEventListener('hashchange', () => this.applyHash());
    window.addEventListener('resize', () => this.updateInsets());
    this.updateInsets();
    this.applyHash(true);
  }

  // ------------------------------------------------------------------ helpers
  sysColor(sid) { return SYSTEM_COLORS[sid] || '#ccc'; }

  visible(comp) { return this.viewer.isVisible(comp); }

  componentLabel(c) {
    return `${c.ko}`;
  }

  /**
   * Show the locations of a catalog group (or one location): unhide the system that owns the
   * group `gid` (every location of the group lists it; without `gid`, the location's own system)
   * when one of them is hidden only by that, and switch the vehicle configuration when none of
   * them is fitted in the current one.
   */
  ensureVisible(comps, gid = null) {
    const c = comps[0];
    if (!c) return;
    const sid = gid ? this.cat.systemOfGroup(gid) : c.system;
    const sysHidden = (x) => x.systems.every((s) => this.viewer.hiddenSystems.has(s));
    const fitted = comps.filter((x) => this.viewer.inConfig(x));
    if ((fitted.length ? fitted : comps).some(sysHidden)) this.setSystemHidden(sid, false);
    if (fitted.length) return;
    if (c.variant) {
      for (const [k, v] of Object.entries(c.variant)) {
        const val = Array.isArray(v) ? v[0] : v;
        if (this.viewer.variant[k] !== val && !(Array.isArray(v) && v.includes(this.viewer.variant[k]))) this.setVariant(k, val);
      }
    }
  }

  /**
   * How the catalog groups of a location relate, for the chip in its info panel:
   * 'shared'   — a part (not a fastener) with the same part number is listed in groups of
   *              different assemblies, e.g. the lower I-shaft link in both steering groups;
   * 'variants' — all groups are versions of one assembly for different configurations
   *              (drive, generation, trim, region), e.g. Front Subframe / - Dual Motor;
   * 'mixed'    — groups of several assemblies, some of them in versions per configuration,
   *              e.g. the front seat: seat assemblies and seat covers, each per trim;
   * 'split'    — the location's parts are spread over unrelated groups.
   * `families` lists the assemblies: [{ name (Korean), gids }].
   */
  groupLink(comp) {
    let r = this.groupLinks.get(comp.id);
    if (r) return r;
    const family = new Map(comp.groups.map((gid) => [gid, groupFamily(this.cat.groups.get(gid).name)]));
    const families = new Set(family.values());
    const seen = new Map(); // part number -> first row listing it for this location
    const same = []; // [row, the same part in another assembly's group]
    for (const gid of comp.groups) {
      for (const p of this.cat.groups.get(gid).parts) {
        const pn = (p.pn || '').trim().toUpperCase();
        if (NO_PN.test(pn) || HARDWARE.test(p.name) || !this.cat.partMatches(comp, p)) continue;
        const first = seen.get(pn);
        if (!first) seen.set(pn, p);
        else if (family.get(first.group.id) !== family.get(gid)) same.push([first, p]);
      }
    }
    const kind = same.length ? 'shared' : families.size === 1 ? 'variants' : families.size < family.size ? 'mixed' : 'split';
    const list = [...families].map((f) => {
      const gids = comp.groups.filter((gid) => family.get(gid) === f);
      // the Korean name of an assembly: the name segments its groups share ("앞좌석 어셈블리 - 베이스 트림")
      const segs = gids.map((gid) => this.cat.groups.get(gid).nameKo.split(' - '));
      let k = 0;
      while (k < segs[0].length && segs.every((s) => s[k] === segs[0][k])) k++;
      return { name: segs[0].slice(0, Math.max(1, k)).join(' - '), gids };
    });
    r = { kind, same, families: list };
    this.groupLinks.set(comp.id, r);
    return r;
  }

  groupLinkChip(comp) {
    const n = comp.groups.length;
    const { kind, same, families } = this.groupLink(comp);
    if (kind === 'shared') {
      const where = (p) => `${p.group.nameKo}${p.no && p.no !== '*' ? ` #${p.no}` : ''}`;
      const examples = [...new Map(same.map(([a, b]) => [`${where(a)} = ${where(b)}`, a])).entries()]
        .slice(0, 3).map(([pair, a]) => `${a.name} ${a.pn} — ${pair}`);
      const title = `같은 부품이 카탈로그의 여러 그룹에 실려 있어 한 위치로 표시합니다. 예: ${examples.join('; ')}`;
      return `<span class="chip" title="${esc(title)}">${n}개 그룹 공유</span>`;
    }
    if (kind === 'variants') return `<span class="chip" title="이 위치는 차량 구성·사양(구동 방식, 세대, 트림, 지역 등)별로 나뉜 카탈로그 그룹을 함께 다룹니다">${n}개 그룹(구성별)</span>`;
    if (kind === 'mixed') {
      const parts = families.map((f) => (f.gids.length > 1 ? `${f.name}(구성별 ${f.gids.length}개)` : f.name));
      const title = `이 위치는 서로 다른 어셈블리의 카탈로그 그룹 ${n}개를 함께 다룹니다: ${parts.join(', ')}. 같은 어셈블리의 그룹은 차량 구성·사양(구동 방식, 세대, 트림, 지역 등)별로 나뉜 것입니다.`;
      return `<span class="chip" title="${esc(title)}">${n}개 그룹(구성별 포함)</span>`;
    }
    return `<span class="chip" title="이 위치의 부품이 카탈로그의 여러 그룹에 나뉘어 실려 있습니다">${n}개 그룹</span>`;
  }

  // ------------------------------------------------------------------ tree
  buildTree() {
    const tree = $('#tree');
    tree.innerHTML = '';
    for (const s of this.cat.systems) {
      const nGroups = s.subsystems.reduce((a, sub) => a + sub.groups.length, 0);
      const node = el(`<div class="sys" data-sys="${s.id}">
        <div class="sys-row">
          <input type="checkbox" checked title="표시/숨김">
          <span class="dot" style="background:${this.sysColor(s.id)}"></span>
          <span class="name">${esc(s.nameKo)}<small>${esc(s.name)}</small></span>
          <span class="count" title="그룹 수">${nGroups}</span>
          <span class="caret">▶</span>
        </div>
        <div class="subs" hidden></div>
      </div>`);
      const subs = $('.subs', node);
      for (const sub of s.subsystems) {
        if (sub.name !== s.name || s.subsystems.length > 1) subs.append(el(`<div class="sub-name">${esc(sub.nameKo)} · ${esc(sub.name)}</div>`));
        for (const g of sub.groups) {
          const row = el(`<div class="grp" data-g="${g.id}" title="${esc(g.name)}"><span class="n">${esc(g.nameKo)}</span><span class="c">${g.parts.length}</span></div>`);
          row.addEventListener('click', () => { this.selectGroup(g.id, { frame: true }); this.closeSideOnMobile(); });
          row.addEventListener('mouseenter', () => this.previewGroup(g.id));
          row.addEventListener('mouseleave', () => this.viewer.setPreview([]));
          subs.append(row);
        }
      }
      const cb = $('input', node);
      cb.addEventListener('click', (e) => e.stopPropagation());
      cb.addEventListener('change', () => this.setSystemHidden(s.id, !cb.checked));
      $('.sys-row', node).addEventListener('click', () => {
        node.classList.toggle('open');
        subs.hidden = !node.classList.contains('open');
      });
      $('.sys-row', node).addEventListener('mouseenter', () => {
        const ids = this.cat.components.filter((c) => c.systems.includes(s.id) && this.visible(c)).map((c) => c.id);
        this.viewer.setPreview(ids);
      });
      $('.sys-row', node).addEventListener('mouseleave', () => this.viewer.setPreview([]));
      tree.append(node);
    }
    $('#btn-show-all').addEventListener('click', () => this.cat.systems.forEach((s) => this.setSystemHidden(s.id, false)));
    $('#btn-hide-all').addEventListener('click', () => this.cat.systems.forEach((s) => this.setSystemHidden(s.id, true)));
    $('#btn-collapse').addEventListener('click', () => $$('.sys').forEach((n) => { n.classList.remove('open'); $('.subs', n).hidden = true; }));
  }

  previewGroup(gid) {
    const comps = (this.cat.componentsByGroup.get(gid) || []).filter((c) => this.visible(c));
    this.viewer.setPreview(comps.map((c) => c.id));
  }

  setSystemHidden(sid, hidden) {
    this.viewer.setSystemHidden(sid, hidden);
    const node = $(`.sys[data-sys="${sid}"]`);
    if (node) {
      $('input', node).checked = !hidden;
      node.classList.toggle('hidden-sys', hidden);
    }
    this.syncInfoVisibility();
  }

  syncTreeSelection() {
    $$('.grp.sel').forEach((n) => n.classList.remove('sel'));
    const gid = this.state.gid;
    if (!gid) return;
    const row = $(`.grp[data-g="${gid}"]`);
    if (!row) return;
    row.classList.add('sel');
    const sys = row.closest('.sys');
    if (!sys.classList.contains('open')) {
      sys.classList.add('open');
      $('.subs', sys).hidden = false;
    }
    row.scrollIntoView({ block: 'nearest' });
  }

  // ------------------------------------------------------------------ selection
  selectComponent(id, { gid = null, part = null, frame = false, hash = true } = {}) {
    const comp = this.cat.componentById.get(id);
    if (!comp) return;
    const asked = gid && comp.groups.includes(gid) ? gid : null;
    this.ensureVisible([comp], asked);
    const g = asked || this.preferredGroup(comp);
    this.state = { mode: 'comp', comp, gid: g, part };
    this.tableFilter = '';
    const emphasis = part ? this.instancesForPart(part).map((c) => c.id) : [];
    this.viewer.setSelected([id], emphasis);
    if (frame) this.viewer.frame([id, ...emphasis]);
    this.renderInfo();
    this.syncTreeSelection();
    if (hash) this.setHash(`c.${id}${g !== comp.groups[0] ? `~${g}` : ''}`);
  }

  selectGroup(gid, { frame = false, part = null, hash = true } = {}) {
    const g = this.cat.groups.get(gid);
    if (!g) return;
    const all = this.cat.componentsByGroup.get(gid) || [];
    this.ensureVisible(all, gid);
    const comps = all.filter((c) => this.visible(c));
    this.state = { mode: 'group', gid, part };
    this.tableFilter = '';
    // all locations of the group: the viewer highlights whichever of them are drawn, also
    // after systems are hidden or shown again
    this.viewer.setSelected(all.map((c) => c.id), part ? this.instancesForPart(part).map((c) => c.id) : []);
    if (frame && comps.length) this.viewer.frame(comps.map((c) => c.id));
    this.renderInfo();
    this.syncTreeSelection();
    if (hash) this.setHash(`g.${gid}`);
  }

  clearSelection() {
    this.state = { mode: null };
    this.viewer.setSelected([], []);
    this.renderInfo();
    this.syncTreeSelection();
    this.setHash('');
  }

  /** Pick the tab to open first: a group matching the current vehicle configuration. */
  preferredGroup(comp) {
    if (comp.groups.length === 1) return comp.groups[0];
    const v = this.viewer.variant;
    const score = (gid) => {
      const n = this.cat.groups.get(gid).name.toUpperCase();
      let sc = 0;
      if (/DUAL MOTOR/.test(n)) sc += v.drive === 'rwd' ? -1 : 1;
      if (/REAR WHEEL DRIVE|RWD|SINGLE MOTOR/.test(n)) sc += v.drive === 'rwd' ? 1 : -1;
      if (/SMALL REAR DRIVE/.test(n)) sc += v.drive === 'dm' ? 1 : -1;
      if (/LARGE REAR DRIVE/.test(n)) sc += v.drive === 'pdm' ? 1 : -1;
      if (/2ND GENERATION/.test(n)) sc += 0.2;
      return sc;
    };
    let best = comp.groups[0];
    let bestScore = score(best);
    for (const gid of comp.groups) {
      const sc = score(gid);
      if (sc > bestScore) { best = gid; bestScore = sc; }
    }
    return best;
  }

  instancesForPart(part) {
    return this.cat.componentsForPart(part, (c) => this.visible(c));
  }

  // Deep links use plain tokens: #c.<location>[~<group>] or #g.<group>.
  setHash(h) {
    this.suppressHash = true;
    try {
      history.replaceState(null, '', `${location.pathname}${location.search}${h ? `#${h}` : ''}`);
    } catch {
      // sandboxed frames may refuse history changes; the selection still works
    }
    this.suppressHash = false;
  }

  applyHash(initial = false) {
    if (this.suppressHash) return;
    const h = decodeURIComponent(location.hash.slice(1));
    if (h.startsWith('c.')) {
      const [id, gid] = h.slice(2).split('~');
      this.selectComponent(id, { gid, frame: initial, hash: false });
    } else if (h.startsWith('g.')) {
      this.selectGroup(h.slice(2), { frame: initial, hash: false });
    }
  }

  // ------------------------------------------------------------------ info panel
  /** Keep the car centred in the part of the viewport not covered by panels. */
  updateInsets() {
    const mobile = window.matchMedia('(max-width: 860px)').matches;
    const info = $('#info');
    const side = $('#sidebar');
    if (mobile) {
      this.viewer.setInsets({ top: 50, bottom: info.hidden ? 50 : info.offsetHeight + 8 });
    } else {
      this.viewer.setInsets({
        left: side.offsetWidth + 10,
        right: info.hidden ? 0 : info.offsetWidth + 10,
        top: 56,
        bottom: 60,
      });
    }
  }

  renderInfo() {
    const info = $('#info');
    const st = this.state;
    if (!st.mode) {
      info.hidden = true;
      document.body.classList.remove('info-open');
      this.updateInsets();
      return;
    }
    info.hidden = false;
    document.body.classList.add('info-open');
    info.innerHTML = '';
    if (st.mode === 'comp') info.append(this.renderCompHead(st.comp));
    else info.append(this.renderGroupHead(this.cat.groups.get(st.gid)));
    if (st.mode === 'comp' && st.comp.groups.length > 1) info.append(this.renderGroupTabs(st.comp));
    const body = el('<div class="info-body"></div>');
    body.append(...this.renderGroupBody(st.gid, st.mode === 'comp' ? st.comp : null));
    info.append(body);
    this.syncInfoVisibility();
    this.updateInsets();
    if (st.part) {
      const row = $(`tr.row[data-i="${st.part.index}"]`, info);
      if (row) requestAnimationFrame(() => row.scrollIntoView({ block: 'center' }));
    }
  }

  /**
   * Keep the open panel truthful when systems are hidden or shown without redrawing it (the
   * table keeps its scroll): a selected location that is hidden, or drawn only as a faint
   * mounting ghost, is not highlighted, and the panel says so.
   */
  syncInfoVisibility() {
    const st = this.state;
    const info = $('#info');
    if (!st.mode || info.hidden) return;
    const note = $('[data-role=drawn-note]', info);
    if (note) {
      const comps = st.mode === 'comp' ? [st.comp] : (this.cat.componentsByGroup.get(st.gid) || []);
      const off = comps.length > 0 && !comps.some((c) => this.viewer.isDrawn(c.id));
      note.hidden = !off;
      if (off) {
        const ghost = comps.some((c) => c.ghost);
        const why = ghost ? '시스템이 숨겨져, 보이는 부품이 장착되는 부위만 흐린 윤곽으로 그려지며 강조되지 않습니다.'
          : comps.some((c) => this.viewer.inConfig(c)) ? '시스템이 숨겨져 3D에 그려지지 않습니다.'
            : '현재 차량 구성에는 이 위치가 없습니다.';
        note.textContent = ghost ? '윤곽만 표시' : '3D 숨김';
        note.title = `${why} “${st.mode === 'comp' ? '이 부품으로 이동' : '위치로 이동'}”을 누르면 다시 표시합니다.`;
      }
    }
    for (const b of $$('.inst button[data-c]', info)) {
      const c = this.cat.componentById.get(b.dataset.c);
      const vis = this.visible(c);
      $('.off-mark', b).hidden = vis;
      b.title = vis ? '' : this.viewer.inConfig(c) ? '시스템이 숨겨져 3D에 표시되지 않음' : '현재 차량 구성에서 숨겨짐';
    }
  }

  renderCompHead(comp) {
    const g = this.cat.groups.get(comp.groups[0]);
    const sys = g.system;
    const chips = tagLabels(comp.tags).map((t) => `<span class="chip loc">${t.ko}</span>`);
    if (comp.variant) {
      for (const [k, v] of Object.entries(comp.variant)) {
        const vals = (Array.isArray(v) ? v : [v]).map((x) => VARIANT_KO[k]?.[x] || x).join(' / ');
        chips.push(`<span class="chip var">${esc(vals)} 사양</span>`);
      }
    }
    if (comp.shell) chips.push('<span class="chip">외판</span>');
    if (comp.groups.length > 1) chips.push(this.groupLinkChip(comp));
    chips.push('<span class="chip off" data-role="drawn-note" hidden></span>');
    const head = el(`<div class="info-head">
      <div class="kicker"><span class="dot" style="background:${this.sysColor(sys.id)}"></span>${esc(sys.nameKo)} · ${esc(sys.name)}</div>
      <h2>${esc(comp.ko)}</h2>
      <div class="en">${esc(comp.en)}</div>
      <div class="chips">${chips.join('')}</div>
      <div class="info-actions">
        <button class="btn primary" data-act="frame">이 부품으로 이동</button>
        <button class="btn" data-act="isolate">이 시스템만 보기</button>
      </div>
      <button class="close-x" title="닫기 (Esc)">×</button>
    </div>`);
    $('[data-act=frame]', head).addEventListener('click', () => {
      this.ensureVisible([comp], this.state.gid); // its system may have been hidden since it was selected
      this.viewer.frame([comp.id]);
    });
    $('[data-act=isolate]', head).addEventListener('click', () => this.isolateSystem(comp.system));
    $('.close-x', head).addEventListener('click', () => this.clearSelection());
    return head;
  }

  renderGroupHead(g) {
    const comps = (this.cat.componentsByGroup.get(g.id) || []);
    const head = el(`<div class="info-head">
      <div class="kicker"><span class="dot" style="background:${this.sysColor(g.system.id)}"></span>${esc(g.system.nameKo)} · ${esc(g.system.name)}</div>
      <h2>${esc(g.nameKo)}</h2>
      <div class="en">${esc(g.name)} — 카탈로그 그룹</div>
      <div class="chips"><span class="chip">3D 위치 ${comps.length}곳</span><span class="chip">부품 ${g.parts.length}행</span><span class="chip off" data-role="drawn-note" hidden></span></div>
      <div class="info-actions">
        <button class="btn primary" data-act="frame">위치로 이동</button>
        <button class="btn" data-act="isolate">이 시스템만 보기</button>
      </div>
      <button class="close-x" title="닫기 (Esc)">×</button>
    </div>`);
    $('[data-act=frame]', head).addEventListener('click', () => {
      this.ensureVisible(comps, g.id);
      this.viewer.frame(comps.map((c) => c.id));
    });
    $('[data-act=isolate]', head).addEventListener('click', () => this.isolateSystem(g.system.id));
    $('.close-x', head).addEventListener('click', () => this.clearSelection());
    return head;
  }

  isolateSystem(sid) {
    for (const s of this.cat.systems) this.setSystemHidden(s.id, s.id !== sid);
  }

  renderGroupTabs(comp) {
    const tabs = el('<div class="gtabs"></div>');
    for (const gid of comp.groups) {
      const g = this.cat.groups.get(gid);
      const n = g.parts.filter((p) => this.cat.partMatches(comp, p)).length;
      const b = el(`<button class="${gid === this.state.gid ? 'on' : ''}" title="${esc(g.name)}">${esc(g.nameKo)}<span class="k">${n}</span></button>`);
      b.addEventListener('click', () => {
        this.state.gid = gid;
        this.state.part = null;
        this.viewer.setEmphasis([]);
        this.renderInfo();
        this.syncTreeSelection();
        this.setHash(`c.${comp.id}${gid !== comp.groups[0] ? `~${gid}` : ''}`);
      });
      tabs.append(b);
    }
    return tabs;
  }

  renderGroupBody(gid, comp) {
    const g = this.cat.groups.get(gid);
    const out = [];
    out.push(el(`<div class="crumb">${esc(g.system.nameKo)} › <b>${esc(g.subsystem.nameKo)}</b></div>`));
    out.push(el(`<h3>${esc(g.nameKo)}<small>${esc(g.subsystem.name)} › ${esc(g.name)}</small></h3>`));
    const first = Math.min(...g.pages);
    out.push(el(`<div class="gmeta">
      <span>부품 ${g.parts.length}행</span>
      <span>카탈로그 ${pageRange(g.pages)}</span>
      <a href="${PDF}#page=${first}" target="_blank" rel="noopener">PDF 원문 열기 ↗</a>
    </div>`));
    if (g.images.length) {
      const row = el('<div class="illus-row"></div>');
      for (const im of g.images) {
        const fig = el(`<figure class="illus" title="크게 보기"><img loading="lazy" src="data/${im.file}" width="${im.w}" height="${im.h}" alt="${esc(g.name)} 일러스트"><span class="zoom">p.${im.page} · 확대</span></figure>`);
        fig.addEventListener('click', () => this.openLightbox(`data/${im.file}`, `${g.nameKo} — ${g.name} (카탈로그 p.${im.page})`));
        row.append(fig);
      }
      out.push(row);
    } else {
      out.push(el('<div class="noillus">이 그룹은 카탈로그에 분해도가 없습니다. 차량 외부 품목이거나 소모품/자료입니다.</div>'));
    }

    // Other 3D locations of this group
    const comps = (this.cat.componentsByGroup.get(gid) || []);
    if (comps.length > 1 || !comp) {
      const inst = el(`<div class="inst"><div class="lbl">${comp ? '이 그룹의 다른 위치' : '3D 위치'} (${comps.length})</div><div class="chips"></div></div>`);
      const chipsEl = $('.chips', inst);
      for (const c of comps) {
        const b = el(`<button class="chip ${c === comp ? 'loc' : ''}" data-c="${c.id}">${esc(c.ko)}<span class="off-mark" hidden> ⦸</span></button>`);
        b.addEventListener('click', () => this.selectComponent(c.id, { gid }));
        b.addEventListener('mouseenter', () => this.visible(c) && this.viewer.setPreview([c.id]));
        b.addEventListener('mouseleave', () => this.viewer.setPreview([]));
        chipsEl.append(b);
      }
      out.push(inst);
    }

    // Parts table
    const hasFilter = comp && this.cat.hasLocationFilter(comp, gid);
    const matchCount = comp ? g.parts.filter((p) => this.cat.partMatches(comp, p)).length : g.parts.length;
    const tools = el(`<div class="tools">
      ${hasFilter ? `<label title="좌/우·앞/뒤 표기와 부품명으로 이 위치에 해당하는 행만 표시"><input type="checkbox" ${this.locFilter ? 'checked' : ''}> 이 위치 부품만 (${matchCount}/${g.parts.length})</label>` : ''}
      <input type="search" placeholder="표 안에서 찾기" value="${esc(this.tableFilter)}">
    </div>`);
    out.push(tools);
    const tableWrap = el('<div></div>');
    out.push(tableWrap);
    const draw = () => {
      tableWrap.innerHTML = '';
      tableWrap.append(this.renderTable(g, comp, hasFilter && this.locFilter));
    };
    if (hasFilter) {
      $('input[type=checkbox]', tools).addEventListener('change', (e) => { this.locFilter = e.target.checked; draw(); });
    }
    $('input[type=search]', tools).addEventListener('input', (e) => { this.tableFilter = e.target.value; draw(); });
    draw();
    return out;
  }

  renderTable(g, comp, onlyHere) {
    const q = this.tableFilter.trim().toUpperCase();
    const table = el(`<table class="parts"><thead><tr><th>No</th><th>부품명 / 설명</th><th>품번</th><th>수량</th></tr></thead><tbody></tbody></table>`);
    const tbody = $('tbody', table);
    let shown = 0;
    for (const p of g.parts) {
      const here = comp ? this.cat.partMatches(comp, p) : true;
      if (onlyHere && !here) continue;
      if (q && !(`${p.name} ${p.desc} ${p.pn} ${p.cmt}`.toUpperCase().includes(q))) continue;
      shown++;
      const open = this.state.part === p;
      const tags = tagLabels(p.tags).map((t) => `<span class="tag-mini">${t.key === 'L' ? 'LH' : t.key === 'R' ? 'RH' : t.key === 'F' ? 'FR' : 'RR'}</span>`).join('');
      const tr = el(`<tr class="row ${open ? 'open' : ''} ${here ? '' : 'other'}" data-i="${p.index}">
        <td class="no ${p.no === '*' ? 'na' : ''}" title="${p.no === '*' ? '일러스트에 표시되지 않음' : '일러스트 번호'}">${esc(p.no)}</td>
        <td>${esc(p.name)}${tags}<span class="d">${esc(p.desc)}</span></td>
        <td class="pn">${esc(p.pn || '—')}</td>
        <td class="q">${esc(p.qty)}</td>
      </tr>`);
      tr.addEventListener('click', () => this.togglePart(p));
      tr.addEventListener('mouseenter', () => this.viewer.setPreview(this.instancesForPart(p).map((c) => c.id)));
      tr.addEventListener('mouseleave', () => this.viewer.setPreview([]));
      tbody.append(tr);
      if (open) tbody.append(this.renderPartDetail(p));
    }
    if (!shown) tbody.append(el('<tr><td colspan="4" class="empty">조건에 맞는 부품이 없습니다.</td></tr>'));
    return table;
  }

  renderPartDetail(p) {
    // where the part is fitted in this configuration, also while its system is hidden
    const own = this.cat.componentsForPart(p);
    const fitted = own.filter((c) => this.viewer.inConfig(c));
    const inst = fitted.length ? fitted : own;
    const tr = el(`<tr class="detail"><td colspan="4"><dl class="pd">
      <dt>품번</dt><dd><b style="font-family:var(--mono)">${esc(p.pn || '—')}</b></dd>
      <dt>부품명</dt><dd>${esc(p.name)}</dd>
      <dt>설명</dt><dd>${esc(p.desc)}</dd>
      <dt>수량</dt><dd>${esc(p.qty)}${p.qty === '**' ? ' (필요 수량)' : ''}</dd>
      <dt>카테고리</dt><dd>${esc(p.cat)}</dd>
      ${p.cmt ? `<dt>비고</dt><dd>${esc(p.cmt)}</dd>` : ''}
      <dt>위치</dt><dd>${inst.map((c) => esc(c.ko)).join(', ') || '—'}</dd>
      <dt>원문</dt><dd><a href="${PDF}#page=${p.pg}" target="_blank" rel="noopener" style="color:var(--accent-2)">카탈로그 p.${p.pg} ↗</a></dd>
      <div class="acts">
        <button class="btn" data-act="copy">품번 복사</button>
        <button class="btn" data-act="frame">3D 위치로 이동</button>
      </div>
    </dl></td></tr>`);
    $('[data-act=copy]', tr).addEventListener('click', async (e) => {
      e.stopPropagation();
      const btn = e.currentTarget;
      try {
        await navigator.clipboard.writeText(p.pn);
        btn.textContent = '복사됨';
      } catch {
        // clipboard refused: select the part number so it can be copied by hand
        const pnEl = tr.querySelector('.pd b');
        const range = document.createRange();
        range.selectNodeContents(pnEl);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        btn.textContent = '품번 선택됨 — 복사하세요';
      }
    });
    $('[data-act=frame]', tr).addEventListener('click', (e) => {
      e.stopPropagation();
      // like the header buttons: its system may have been hidden since the row was opened
      this.ensureVisible(this.cat.componentsForPart(p), p.group.id);
      const ids = this.instancesForPart(p).map((c) => c.id);
      if (this.state.part === p) this.viewer.setEmphasis(ids);
      this.viewer.frame(ids);
    });
    return tr;
  }

  togglePart(p) {
    const st = this.state;
    st.part = st.part === p ? null : p;
    this.viewer.setEmphasis(st.part ? this.instancesForPart(p).map((c) => c.id) : []);
    const scroll = $('.info-body')?.scrollTop;
    this.renderInfo();
    const body = $('.info-body');
    if (body && scroll != null) body.scrollTop = scroll;
  }

  // ------------------------------------------------------------------ search
  bindTopbar() {
    const input = $('#search');
    const box = $('#search-results');
    let timer = null;
    let active = -1;
    const items = () => $$('.sr-item', box);
    const run = () => {
      const q = input.value;
      const res = this.cat.search(q);
      active = -1;
      if (q.trim().length < 2) { box.hidden = true; return; }
      box.innerHTML = '';
      if (!res.comps.length && !res.groups.length && !res.parts.length) {
        box.append(el('<div class="sr-empty">검색 결과가 없습니다.</div>'));
      }
      if (res.comps.length) {
        box.append(el('<div class="sr-sec">3D 위치</div>'));
        for (const c of res.comps) {
          const it = el(`<div class="sr-item"><span class="dot" style="background:${this.sysColor(c.system)}"></span><span class="t">${esc(c.ko)}<small>${esc(c.en)}</small></span></div>`);
          it.addEventListener('click', () => { this.selectComponent(c.id, { frame: true }); box.hidden = true; });
          it.addEventListener('mouseenter', () => this.visible(c) && this.viewer.setPreview([c.id]));
          box.append(it);
        }
      }
      if (res.groups.length) {
        box.append(el('<div class="sr-sec">카탈로그 그룹</div>'));
        for (const g of res.groups) {
          const it = el(`<div class="sr-item"><span class="dot" style="background:${this.sysColor(g.system.id)}"></span><span class="t">${esc(g.nameKo)}<small>${esc(g.system.nameKo)} · ${esc(g.name)}</small></span></div>`);
          it.addEventListener('click', () => { this.selectGroup(g.id, { frame: true }); box.hidden = true; });
          it.addEventListener('mouseenter', () => this.previewGroup(g.id));
          box.append(it);
        }
      }
      if (res.parts.length) {
        box.append(el(`<div class="sr-sec">부품 ${res.total > res.parts.length ? `(상위 ${res.parts.length} / ${res.total})` : `(${res.parts.length})`}</div>`));
        for (const p of res.parts) {
          const it = el(`<div class="sr-item"><span class="pn">${esc(p.pn || '—')}</span><span class="t">${esc(p.name)}<small>${esc(p.group.nameKo)} · ${esc(p.group.system.nameKo)}</small></span></div>`);
          it.addEventListener('click', () => { this.openPart(p); box.hidden = true; });
          it.addEventListener('mouseenter', () => this.viewer.setPreview(this.instancesForPart(p).map((c) => c.id)));
          box.append(it);
        }
      }
      box.hidden = false;
    };
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 120); });
    input.addEventListener('focus', () => { if (input.value.trim().length >= 2) run(); });
    input.addEventListener('keydown', (e) => {
      const list = items();
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!list.length) return;
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length;
        list.forEach((n, i) => n.classList.toggle('active', i === active));
        list[active].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        const target = list[active >= 0 ? active : 0];
        if (target) target.click();
      } else if (e.key === 'Escape') {
        box.hidden = true;
        input.blur();
      }
    });
    box.addEventListener('mouseleave', () => this.viewer.setPreview([]));
    document.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('.search')) { box.hidden = true; this.viewer.setPreview([]); }
    });
    $('#btn-menu').addEventListener('click', () => document.body.classList.toggle('side-open'));
    $('#btn-about').addEventListener('click', () => { $('#about').hidden = false; });
  }

  openPart(p) {
    const gid = p.group.id;
    const all = this.cat.componentsByGroup.get(gid) || [];
    if (!all.length) return;
    // the locations this row belongs to, shown or not; the group's system is shown for them
    this.ensureVisible(this.cat.componentsForPart(p), gid);
    const target = this.instancesForPart(p)[0] || all[0];
    this.selectComponent(target.id, { gid, part: p, frame: true });
  }

  closeSideOnMobile() {
    if (window.matchMedia('(max-width: 860px)').matches) document.body.classList.remove('side-open');
  }

  // ------------------------------------------------------------------ settings / toolbar
  bindConfig() {
    $$('#sidebar .tabs button').forEach((b) => b.addEventListener('click', () => {
      $$('#sidebar .tabs button').forEach((x) => x.classList.toggle('on', x === b));
      $('#tab-tree').hidden = b.dataset.tab !== 'tree';
      $('#tab-config').hidden = b.dataset.tab !== 'config';
    }));
    $('#cfg-xray').addEventListener('change', (e) => this.setXray(e.target.checked));
    $('#cfg-mounts').addEventListener('change', (e) => {
      this.viewer.setMountContext(e.target.checked);
      this.syncInfoVisibility(); // a hidden selection may become, or stop being, a ghost
    });
    this.bindSeg('#cfg-color', (v) => this.viewer.setColorMode(v));
    this.bindSeg('#cfg-drive', (v) => this.setVariant('drive', v, false));
    this.bindSeg('#cfg-susp', (v) => this.setVariant('susp', v, false));
    this.bindSeg('#cfg-booster', (v) => this.setVariant('booster', v, false));
    $('#cfg-explode').addEventListener('input', (e) => this.setExplode(+e.target.value));
    // apply defaults
    this.viewer.variant = { drive: 'dm', susp: 'air', booster: 'vacuum' };
    this.viewer.applyVisibility();
  }

  bindSeg(sel, fn) {
    $$(`${sel} button`).forEach((b) => b.addEventListener('click', () => {
      if (b.classList.contains('on')) return; // already the active value
      $$(`${sel} button`).forEach((x) => x.classList.toggle('on', x === b));
      fn(b.dataset.v);
    }));
  }

  setVariant(key, value, syncUi = true) {
    this.viewer.setVariant(key, value);
    if (syncUi) $$(`#cfg-${key} button`).forEach((x) => x.classList.toggle('on', x.dataset.v === value));
    // keep the selection consistent with the new configuration: a location that is not fitted
    // in it is deselected; one only hidden with its system keeps its panel (renderInfo notes it)
    if (this.state.mode === 'comp' && !this.viewer.inConfig(this.state.comp)) this.clearSelection();
    else if (this.state.mode) this.renderInfo();
  }

  setXray(on) {
    this.viewer.setXray(on);
    $('#cfg-xray').checked = on;
    $('#tb-xray').checked = on;
  }

  setExplode(v) {
    this.viewer.setExplode(v / 100);
    $('#cfg-explode').value = v;
    $('#tb-explode').value = v;
    $('#cfg-explode-val').textContent = `${v}%`;
  }

  bindToolbar() {
    $$('#views button').forEach((b) => b.addEventListener('click', () => this.viewer.setView(b.dataset.view)));
    $('#btn-zoom-in').addEventListener('click', () => this.viewer.zoom(0.75));
    $('#btn-zoom-out').addEventListener('click', () => this.viewer.zoom(1.33));
    $('#tb-xray').addEventListener('change', (e) => this.setXray(e.target.checked));
    $('#tb-explode').addEventListener('input', (e) => this.setExplode(+e.target.value));
  }

  // ------------------------------------------------------------------ 3D events
  bindViewer() {
    const tip = $('#tooltip');
    let hintGone = false;
    const dropHint = () => {
      if (hintGone) return;
      hintGone = true;
      $('#legend-hint').style.opacity = '0';
    };
    this.viewer.on('hover', (id, e) => {
      if (!id || !e) { tip.hidden = true; this.viewer.renderer.domElement.style.cursor = ''; return; }
      dropHint();
      const c = this.cat.componentById.get(id);
      const g = this.cat.groups.get(c.groups[0]);
      const nParts = c.groups.reduce((a, gid) => a + this.cat.groups.get(gid).parts.filter((p) => this.cat.partMatches(c, p)).length, 0);
      tip.innerHTML = `<div class="tt-t">${esc(c.ko)}</div>
        <div class="tt-s"><span class="dot" style="background:${this.sysColor(c.system)}"></span>${esc(g.nameKo)}${c.groups.length > 1 ? ` 외 ${c.groups.length - 1}개 그룹` : ''}</div>
        <div class="tt-h">관련 부품 ${nParts}행 · 클릭: 상세 · 더블클릭: 이동</div>`;
      tip.hidden = false;
      const pad = 16;
      const w = tip.offsetWidth;
      const hgt = tip.offsetHeight;
      let x = e.clientX + pad;
      let y = e.clientY + pad;
      if (x + w > window.innerWidth - 8) x = e.clientX - w - pad;
      if (y + hgt > window.innerHeight - 8) y = e.clientY - hgt - pad;
      tip.style.left = `${x}px`;
      tip.style.top = `${y}px`;
      this.viewer.renderer.domElement.style.cursor = 'pointer';
    });
    this.viewer.on('pick', (id) => {
      dropHint();
      $('#search-results').hidden = true;
      if (!id) {
        if (this.state.mode) this.clearSelection();
        return;
      }
      if (this.state.mode === 'comp' && this.state.comp.id === id && !this.state.part) return;
      // stay on the same catalog group if the picked instance shares it
      const keep = this.state.gid && this.cat.componentById.get(id).groups.includes(this.state.gid) ? this.state.gid : null;
      this.selectComponent(id, { gid: keep });
    });
    this.viewer.on('focus', (id) => this.viewer.frame([id]));
  }

  bindKeys() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!$('#lightbox').hidden) { $('#lightbox').hidden = true; return; }
        if (!$('#about').hidden) { $('#about').hidden = true; return; }
        if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
        this.clearSelection();
      } else if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        $('#search').focus();
      }
    });
    $('#lightbox').addEventListener('click', () => { $('#lightbox').hidden = true; });
  }

  openLightbox(src, caption) {
    const lb = $('#lightbox');
    $('img', lb).src = src;
    $('figcaption', lb).textContent = caption;
    lb.hidden = false;
  }

  buildAbout() {
    const m = this.cat.meta;
    const comps = this.cat.components.length;
    const card = el(`<div class="card">
      <button class="close-x" title="닫기">×</button>
      <h2>Model S 3D 파츠 맵</h2>
      <p>${esc(m.title)} — 원본 <a href="${PDF}" target="_blank" rel="noopener" style="color:var(--accent-2)">${esc(m.source)}</a> (${esc(m.sourceDate)} 발행)의 시스템 → 서브시스템 → 그룹 구조를 그대로 가져와, 각 그룹을 차량에서 실제로 쓰이는 위치에 배치한 3D 지도입니다.</p>
      <div class="stats">
        <div class="stat"><b>${m.stats.systems}</b><span>시스템</span></div>
        <div class="stat"><b>${m.stats.groups}</b><span>그룹(분해도)</span></div>
        <div class="stat"><b>${m.stats.rows.toLocaleString()}</b><span>부품 행</span></div>
        <div class="stat"><b>${comps}</b><span>3D 위치</span></div>
      </div>
      <h3>읽는 법</h3>
      <ul>
        <li>3D 위치(컴포넌트) 하나는 카탈로그 그룹 하나 이상과 연결됩니다. 예: 앞좌석은 트림별 시트 어셈블리·커버 그룹 9개와 연결.</li>
        <li>좌/우(LH/RH)·앞/뒤(FR/RR) 표기는 부품명에서 자동 추출해, 클릭한 위치에 해당하는 행만 걸러 보여 줍니다(“이 위치 부품만”).</li>
        <li>부품 행을 클릭하면 그 부품이 쓰이는 3D 위치가 주황색으로 강조됩니다.</li>
        <li>No 열의 <b>*</b>는 일러스트에 표시되지 않은 부품, 수량 <b>**</b>는 필요 수량입니다.</li>
        <li>품번 고유값 ${m.stats.uniquePartNumbers.toLocaleString()}개. 원본 PDF는 같은 행이 연식 열마다 반복되므로 중복 행은 제거했습니다.</li>
      </ul>
      <h3>주의</h3>
      <p>3D 형상은 실제 CAD 데이터가 아니라 차량 치수(전장 4,970 · 전폭 1,964 · 전고 1,445 · 축거 2,960 mm)를 바탕으로 절차적으로 만든 개략 모델입니다. 위치는 카탈로그 분해도와 일반적인 Model S 배치를 기준으로 한 근사치이니, 정비·주문 전에는 반드시 PDF 원문 페이지를 확인하세요.</p>
    </div>`);
    const about = $('#about');
    about.innerHTML = '';
    about.append(card);
    about.addEventListener('click', (e) => { if (e.target === about) about.hidden = true; });
    $('.close-x', card).addEventListener('click', () => { about.hidden = true; });
  }
}
