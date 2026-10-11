// Catalog index: groups, parts, component links, position matching, search.

const TAG_KO = { L: '좌측 (LH)', R: '우측 (RH)', F: '앞 (FR)', B: '뒤 (RR)' };

export function tagLabels(tags = '') {
  return [...tags].filter((ch) => TAG_KO[ch]).map((ch) => ({ key: ch, ko: TAG_KO[ch] }));
}

const sideOf = (t = '') => (t.includes('L') ? 'L' : t.includes('R') ? 'R' : '');
const endOf = (t = '') => (t.includes('F') ? 'F' : t.includes('B') ? 'B' : '');

export class Catalog {
  constructor(data) {
    this.meta = data.meta;
    this.systems = data.systems;
    this.groups = new Map();
    this.parts = [];
    for (const s of data.systems) {
      for (const sub of s.subsystems) {
        sub.system = s;
        for (const g of sub.groups) {
          g.system = s;
          g.subsystem = sub;
          this.groups.set(g.id, g);
          g.parts.forEach((p, i) => {
            p.group = g;
            p.index = i;
            p.text = `${p.name} | ${p.desc}`.toUpperCase();
            this.parts.push(p);
          });
        }
      }
    }
    this.componentsByGroup = new Map();
  }

  systemOfGroup(gid) {
    const g = this.groups.get(gid);
    return g ? g.system.id : null;
  }

  linkComponents(items) {
    this.components = items;
    this.componentById = new Map(items.map((c) => [c.id, c]));
    for (const c of items) {
      for (const gid of c.groups) {
        if (!this.componentsByGroup.has(gid)) this.componentsByGroup.set(gid, []);
        this.componentsByGroup.get(gid).push(c);
      }
    }
    // Which position axes distinguish the instances of each group?
    this.groupAxes = new Map();
    for (const [gid, comps] of this.componentsByGroup) {
      const sides = new Set(comps.map((c) => sideOf(c.tags)));
      const ends = new Set(comps.map((c) => endOf(c.tags)));
      this.groupAxes.set(gid, { side: sides.size > 1 || (sides.size === 1 && !sides.has('')), end: ends.size > 1 });
    }
  }

  /** Does a part row apply to this component instance? */
  partMatches(comp, part) {
    const gid = part.group.id;
    const comps = this.componentsByGroup.get(gid) || [];
    if (comps.length <= 1) return true;
    if (comp.match && !comp.match.test(part.text) && !comp.match.test(`${part.name} | ${part.desc}`)) return false;
    const axes = this.groupAxes.get(gid);
    const pt = part.tags || '';
    if (axes.side) {
      const ps = sideOf(pt);
      const cs = sideOf(comp.tags);
      if (ps && cs && ps !== cs) return false;
    }
    if (axes.end) {
      const pe = endOf(pt);
      const ce = endOf(comp.tags);
      if (pe && ce && pe !== ce) return false;
    }
    return true;
  }

  /** Is there any component-specific filtering for this group? */
  hasLocationFilter(comp, gid) {
    const comps = this.componentsByGroup.get(gid) || [];
    return comps.length > 1;
  }

  /** Components (instances) that a part row belongs to. */
  componentsForPart(part, visibleOnly = null) {
    const comps = (this.componentsByGroup.get(part.group.id) || []).filter((c) => !visibleOnly || visibleOnly(c));
    const hits = comps.filter((c) => this.partMatches(c, part));
    return hits.length ? hits : comps;
  }

  search(query, limit = 60) {
    const q = query.trim().toUpperCase();
    if (q.length < 2) return { comps: [], groups: [], parts: [] };
    const qn = q.replace(/[\s-]/g, '');
    const comps = this.components.filter((c) => c.ko.toUpperCase().includes(q) || c.en.toUpperCase().includes(q)).slice(0, 12);
    const groups = [...this.groups.values()].filter((g) => g.name.toUpperCase().includes(q) || g.nameKo.includes(query.trim())).slice(0, 12);
    const parts = [];
    for (const p of this.parts) {
      const pn = p.pn.toUpperCase().replace(/[\s-]/g, '');
      let score = 0;
      if (qn.length >= 4 && pn.includes(qn)) score = pn.startsWith(qn) ? 3 : 2;
      else if (p.text.includes(q)) score = 1;
      if (score) parts.push({ p, score });
    }
    parts.sort((a, b) => b.score - a.score);
    // collapse identical part numbers within a group
    const seen = new Set();
    const out = [];
    for (const { p } of parts) {
      const k = `${p.group.id}|${p.pn}|${p.name}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(p);
      if (out.length >= limit) break;
    }
    return { comps, groups, parts: out, total: parts.length };
  }
}
