import { TILE } from '../core/constants.js';

// MAP MANAGER — splits the generated world into separate maps (data: maps/mapRegistry.js).
// Every world tile gets an area number (1 = first map, ...; 0 = no map: wall / gap between maps). Only the active
// map's area is walkable (WorldMap.isSolid), drawn and simulated, so each map behaves as its own place and the
// only ways between maps are exits (world/transitionSystem.js) or teleports (waystones, respawn, load).
export class MapManager {
  constructor(worldMap, maps) {
    this.map = worldMap;
    this.list = maps;
    this.byId = {};
    maps.forEach((d, i) => { this.byId[d.id] = { ...d, area: i + 1 }; });
    this.assign();
  }
  get(id) { return this.byId[id] || null; }
  // world tile -> area (first matching map wins)
  assign() {
    const m = this.map, defs = this.list.map((d) => this.byId[d.id]);
    m.area = new Uint8Array(m.w * m.h);
    for (const d of defs) d.box = { tx0: Infinity, ty0: Infinity, tx1: -1, ty1: -1 };
    for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) {
      const i = ty * m.w + tx, z = m.zone[i];
      if (!z) continue;
      for (const d of defs) {
        const r = d.region;
        if (!r.zones.includes(z) || (r.minTy !== undefined && ty < r.minTy) || (r.maxTy !== undefined && ty > r.maxTy)) continue;
        m.area[i] = d.area;
        const b = d.box; if (tx < b.tx0) b.tx0 = tx; if (ty < b.ty0) b.ty0 = ty; if (tx > b.tx1) b.tx1 = tx; if (ty > b.ty1) b.ty1 = ty;
        break;
      }
    }
    this.byArea = [null, ...defs];
  }
  idAtTile(tx, ty) {
    const m = this.map;
    if (!m.inBounds(tx, ty)) return null;
    const d = this.byArea[m.area[ty * m.w + tx]];
    return d ? d.id : null;
  }
  idAt(x, y) { return this.idAtTile(Math.floor(x / TILE), Math.floor(y / TILE)); }
  activate(id) { this.map.activeArea = this.byId[id].area; }
  // camera bounds (px) with a small margin of scenery around the map
  boundsPx(id, margin = 3) {
    const b = this.byId[id].box;
    return { x0: (b.tx0 - margin) * TILE, y0: (b.ty0 - margin) * TILE, x1: (b.tx1 + 1 + margin) * TILE, y1: (b.ty1 + 1 + margin) * TILE };
  }
  // first exit on the shortest exit path from map `from` to map `to` (BFS over exits) — for quest arrows
  nextExit(from, to) {
    if (!from || !to || from === to) return null;
    const prev = { [from]: null }, queue = [from];
    while (queue.length) {
      const cur = queue.shift();
      for (const e of this.byId[cur].exits) {
        if (e.to in prev) continue;
        prev[e.to] = { map: cur, exit: e };
        if (e.to === to) {
          let step = prev[to];
          while (step.map !== from) step = prev[step.map];
          return step.exit;
        }
        queue.push(e.to);
      }
    }
    return null;
  }
  exitCenter(e) { return { x: ((e.rect[0] + e.rect[2] + 1) / 2) * TILE, y: ((e.rect[1] + e.rect[3] + 1) / 2) * TILE }; }
}
