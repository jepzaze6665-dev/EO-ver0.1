import { TILE } from '../core/constants.js';

// MAP MANAGER — every playable map (data: maps/mapRegistry.js) and where it lies.
// Maps live on GRIDS (world/levels): a grid is one tile map; several maps may share one (Lumina + the forest).
// Inside a grid every tile gets an area number (1 = first map of that grid, ...; 0 = no map: wall / gap). Only the
// active map's area is walkable (WorldMap.isSolid), drawn and simulated, so each map behaves as its own place and
// the only ways between maps are exits (world/transitionSystem.js) or teleports (waystones, respawn, load).
// Map lookups by id work for every map; lookups by POSITION need a grid (default: the loaded one).
export class MapManager {
  constructor(maps) {
    this.list = maps;
    this.byId = {};
    maps.forEach((d) => { this.byId[d.id] = { ...d }; });
    this.grids = {};   // gridId -> { map, byArea }
    this.cur = null;   // the loaded grid
  }
  get(id) { return this.byId[id] || null; }
  gridOf(id) { const d = this.byId[id]; return d ? d.grid : null; }
  mapsOn(gridId) { return this.list.filter((d) => d.grid === gridId).map((d) => this.byId[d.id]); }
  // a grid's tile map was built: give its tiles to its maps (first matching map wins)
  attach(gridId, m) {
    const defs = this.mapsOn(gridId);
    defs.forEach((d, i) => { d.area = i + 1; d.box = { tx0: Infinity, ty0: Infinity, tx1: -1, ty1: -1 }; });
    m.area = new Uint8Array(m.w * m.h);
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
    this.grids[gridId] = { id: gridId, map: m, byArea: [null, ...defs] };
  }
  use(gridId) { this.cur = this.grids[gridId] || null; }
  get gridId() { return this.cur ? this.cur.id : null; }
  // tile -> map id on a grid (default: the loaded grid)
  idAtTile(tx, ty, gridId) {
    const G = gridId ? this.grids[gridId] : this.cur;
    if (!G || !G.map.inBounds(tx, ty)) return null;
    const d = G.byArea[G.map.area[ty * G.map.w + tx]];
    return d ? d.id : null;
  }
  idAt(x, y, gridId) { return this.idAtTile(Math.floor(x / TILE), Math.floor(y / TILE), gridId); }
  activate(id) { this.cur.map.activeArea = this.byId[id].area; }
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
