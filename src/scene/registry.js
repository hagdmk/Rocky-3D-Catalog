// Component registry: a component is one physical item in the 3D map
// (e.g. "front door, LH") linked to one or more catalog groups.

import * as THREE from 'three';

export class Registry {
  constructor() {
    this.items = [];
    this.byId = new Map();
  }

  /**
   * def = {
   *   id, ko, en,              // labels
   *   groups: [groupId, ...],  // catalog groups (primary first, sets colour)
   *   tags: 'LF',              // location: L/R side, F/B front/rear
   *   match: /regex/,          // optional: which part rows belong to this instance
   *   shell: bool,             // exterior skin (affected by X-ray mode)
   *   variant: {drive:'rwd'|'dm', susp:'air'|'coil'},
   *   explodeWith: id,         // optional: share that component's exploded-view offset
   *   object: THREE.Object3D,
   * }
   */
  add(def) {
    if (this.byId.has(def.id)) throw new Error(`duplicate component id ${def.id}`);
    if (!def.object) throw new Error(`component ${def.id} has no object`);
    const root = new THREE.Group();
    root.name = def.id;
    root.add(def.object);
    const item = {
      tags: '', shell: false, trim: false, variant: null, match: null, ...def, root,
    };
    root.traverse((o) => { o.userData.compId = def.id; });
    this.items.push(item);
    this.byId.set(def.id, item);
    return item;
  }
}
