import { TILE, WORLD_W, WORLD_H, CHUNK, T, SOLID_TILES, Z } from '../core/constants.js';
import { makeCanvas, Assets } from '../core/assets.js';
import { hash2 } from '../core/rng.js';
import { EDGE_PRIORITY } from './tiles.js';

// Tile grid + props + collision + chunk-cached ground rendering for the whole connected world.
export class WorldMap {
  // w / h: grid size in tiles (world/levels: every grid names its own size; the default = the original world)
  constructor(tileset, w = WORLD_W, h = WORLD_H) {
    this.w = w; this.h = h;
    this.tiles = new Uint8Array(this.w * this.h).fill(T.CANOPY);
    this.zone = new Uint8Array(this.w * this.h);
    this.sub = new Uint8Array(this.w * this.h); // sub-area index (see subAreas)
    this.secret = new Uint8Array(this.w * this.h); // secret id -> hidden on minimap until found
    this.blocker = new Uint8Array(this.w * this.h); // dynamic blockers (gates, barriers, props)
    this.revealed = new Uint8Array(this.w * this.h);
    // map areas (world/mapManager.js): area per tile + the active map's area; other areas count as solid
    this.area = new Uint8Array(this.w * this.h);
    this.activeArea = 0;
    this.subAreas = [null];
    this.props = [];
    this.propGrid = new Map();
    this.tileset = tileset;
    this.chunkCache = new Map();
    this.style = { restored: false };
    this.secretsFound = new Set();
  }

  idx(tx, ty) { return ty * this.w + tx; }
  inBounds(tx, ty) { return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h; }
  get(tx, ty) { return this.inBounds(tx, ty) ? this.tiles[ty * this.w + tx] : T.VOID; }
  set(tx, ty, t) { if (this.inBounds(tx, ty)) this.tiles[ty * this.w + tx] = t; }
  zoneAt(x, y) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    return this.inBounds(tx, ty) ? this.zone[ty * this.w + tx] : Z.NONE;
  }
  subAt(x, y) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    return this.inBounds(tx, ty) ? this.subAreas[this.sub[ty * this.w + tx]] : null;
  }
  addSubArea(info) { this.subAreas.push(info); return this.subAreas.length - 1; }

  isSolid(tx, ty) {
    if (!this.inBounds(tx, ty)) return true;
    const i = ty * this.w + tx;
    if (this.activeArea && this.area[i] !== this.activeArea) return true; // outside the current map
    return this.blocker[i] > 0 || SOLID_TILES.has(this.tiles[i]);
  }
  // terrain / blocker solidity ignoring which map is active (world state checks, tools)
  isTerrainSolid(tx, ty) {
    if (!this.inBounds(tx, ty)) return true;
    const i = ty * this.w + tx;
    return this.blocker[i] > 0 || SOLID_TILES.has(this.tiles[i]);
  }
  isSolidAt(x, y) { return this.isSolid(Math.floor(x / TILE), Math.floor(y / TILE)); }
  blocksShot(x, y) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (!this.inBounds(tx, ty)) return true;
    const t = this.tiles[ty * this.w + tx];
    if (t === T.WATER || t === T.DEEP_WATER || t === T.LAVA) return false;
    return this.isSolid(tx, ty);
  }
  isWater(x, y) {
    const t = this.get(Math.floor(x / TILE), Math.floor(y / TILE));
    return t === T.WATER || t === T.DEEP_WATER;
  }

  // Resolve a circle against solid tiles (axis separated for smooth wall sliding).
  moveCircle(e, dx, dy) {
    const r = e.radius;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / (TILE * 0.4)));
    const sx = dx / steps, sy = dy / steps;
    let hit = false;
    for (let s = 0; s < steps; s++) {
      e.x += sx;
      if (this.circleBlocked(e.x, e.y, r)) { e.x -= sx; hit = true; this.nudge(e, 'x', sx); }
      e.y += sy;
      if (this.circleBlocked(e.x, e.y, r)) { e.y -= sy; hit = true; this.nudge(e, 'y', sy); }
    }
    return hit;
  }
  // corner-sliding: when blocked on one axis, try to slip around a corner
  nudge(e, axis, amt) {
    if (Math.abs(amt) < 0.01) return;
    const other = axis === 'x' ? 'y' : 'x';
    for (const off of [2, -2, 4, -4]) {
      const ox = axis === 'x' ? amt : off, oy = axis === 'x' ? off : amt;
      if (!this.circleBlocked(e.x + ox, e.y + oy, e.radius)) {
        e[other] += off * 0.5;
        return;
      }
    }
  }
  circleBlocked(x, y, r) {
    const tx0 = Math.floor((x - r) / TILE), tx1 = Math.floor((x + r) / TILE);
    const ty0 = Math.floor((y - r) / TILE), ty1 = Math.floor((y + r) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (!this.isSolid(tx, ty)) continue;
      const cx = Math.max(tx * TILE, Math.min(x, tx * TILE + TILE));
      const cy = Math.max(ty * TILE, Math.min(y, ty * TILE + TILE));
      if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return true;
    }
    return false;
  }
  lineOfSight(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.ceil(d / 12);
    for (let i = 1; i < n; i++) {
      const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
      const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
      const t = this.get(tx, ty);
      if (t !== T.WATER && t !== T.DEEP_WATER && this.isSolid(tx, ty)) return false;
    }
    return true;
  }
  // nearest walkable point (used for spawns / respawns)
  // nearest open tile, searched inside the map that owns (x, y) (so it also works before a map switch)
  findOpen(x, y, maxR = 6) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    const keep = this.activeArea, own = this.inBounds(tx, ty) ? this.area[ty * this.w + tx] : 0;
    if (keep && own) this.activeArea = own;
    try {
      for (let r = 0; r <= maxR; r++)
        for (let oy = -r; oy <= r; oy++) for (let ox = -r; ox <= r; ox++) {
          if (Math.max(Math.abs(ox), Math.abs(oy)) !== r) continue;
          if (!this.isSolid(tx + ox, ty + oy)) return { x: (tx + ox + 0.5) * TILE, y: (ty + oy + 0.5) * TILE };
        }
      return { x, y };
    } finally { this.activeArea = keep; }
  }
  // area of a world position (0 = between maps)
  areaAt(x, y) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    return this.inBounds(tx, ty) ? this.area[ty * this.w + tx] : 0;
  }

  // ---------------- props
  addProp(p) {
    const def = Assets.props[p.name];
    p.def = def || null;
    p.scale = p.scale || 1;
    p.visible = p.visible !== false;
    p.alpha = 1;
    p.layer = p.layer || 'y';
    this.props.push(p);
    const key = this.chunkKey(p.x, p.y);
    if (!this.propGrid.has(key)) this.propGrid.set(key, []);
    this.propGrid.get(key).push(p);
    if (p.solid) this.setPropSolid(p, true);
    return p;
  }
  setPropSolid(p, on) {
    const fp = p.footprint || [[0, 0]];
    const tx = Math.floor(p.x / TILE), ty = Math.floor((p.y - 2) / TILE);
    for (const [ox, oy] of fp) {
      const i = this.idx(tx + ox, ty + oy);
      if (this.inBounds(tx + ox, ty + oy)) this.blocker[i] = Math.max(0, this.blocker[i] + (on ? 1 : -1));
    }
  }
  chunkKey(x, y) {
    return Math.floor(x / (CHUNK * TILE)) + ',' + Math.floor(y / (CHUNK * TILE));
  }
  propsInView(cam, out) {
    out.length = 0;
    const cs = CHUNK * TILE;
    const cx0 = Math.floor((cam.left - 160) / cs), cx1 = Math.floor((cam.left + cam.width + 160) / cs);
    const cy0 = Math.floor((cam.top - 80) / cs), cy1 = Math.floor((cam.top + cam.height + 260) / cs);
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const list = this.propGrid.get(cx + ',' + cy);
      if (!list) continue;
      for (const p of list) if (p.visible) out.push(p);
    }
    return out;
  }
  setBlockRect(tx0, ty0, tx1, ty1, on) {
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++)
      if (this.inBounds(tx, ty)) this.blocker[this.idx(tx, ty)] = on ? 1 : 0;
  }

  // ---------------- rendering
  invalidate() { this.chunkCache.clear(); }

  texFor(tx, ty, t) {
    const ts = this.tileset;
    const v = Math.floor(hash2(tx, ty, 3) * 4);
    const z = this.zone[ty * this.w + tx];
    if (t === T.CANOPY) {
      if (z === Z.VALLEY) return ts.alt.canopy_valley[v];
      const sa = this.subAreas[this.sub[ty * this.w + tx]];
      if (sa && sa.ancient) return ts.alt.canopy_ancient[v];
      if ((z === Z.FOREST || z === Z.GATE) && !this.style.restored && ty < 142) return ts.alt.canopy_corrupt[v];
      return ts.tex[T.CANOPY][v];
    }
    if (t === T.CORRUPT && this.style.restored) return ts.alt.forest_restored[v];
    if (t === T.FOREST_FLOOR && this.style.restored && z === Z.FOREST && hash2(tx, ty, 9) > 0.7) return ts.alt.forest_restored[v];
    const arr = ts.tex[t] || ts.tex[T.VOID];
    return arr[v];
  }
  effectiveType(t) {
    if (t === T.CORRUPT && this.style.restored) return T.FOREST_FLOOR;
    return t;
  }

  maskedEdge(tex, dir) {
    if (!tex._edges) tex._edges = [];
    if (!tex._edges[dir]) {
      const c = makeCanvas(TILE, TILE);
      const g = c.getContext('2d');
      g.drawImage(this.tileset.masks[dir], 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.drawImage(tex, 0, 0);
      tex._edges[dir] = c;
    }
    return tex._edges[dir];
  }

  renderChunk(cx, cy) {
    const size = CHUNK * TILE;
    const c = makeCanvas(size, size);
    const g = c.getContext('2d');
    const ts = this.tileset;
    const tx0 = cx * CHUNK, ty0 = cy * CHUNK;
    for (let ty = ty0; ty < ty0 + CHUNK; ty++) for (let tx = tx0; tx < tx0 + CHUNK; tx++) {
      const px = (tx - tx0) * TILE, py = (ty - ty0) * TILE;
      if (!this.inBounds(tx, ty)) { g.drawImage(ts.tex[T.VOID][0], px, py); continue; }
      const t = this.tiles[ty * this.w + tx];
      g.drawImage(this.texFor(tx, ty, t), px, py);
      // wall faces: solid block with walkable ground below shows a vertical face
      if (t === T.CLIFF || t === T.RUIN_WALL || t === T.CAVE_WALL) {
        const below = this.get(tx, ty + 1);
        if (!SOLID_TILES.has(below) || below === T.WATER) {
          const face = t === T.RUIN_WALL ? ts.faces.wall : t === T.CAVE_WALL ? ts.faces.cave : ts.faces.cliff;
          g.drawImage(face[Math.floor(hash2(tx, ty, 4) * 4)], 0, 0, TILE, TILE, px, py + 8, TILE, TILE - 8);
        }
        continue;
      }
      // edge blending from higher-priority neighbours
      const et = this.effectiveType(t);
      const myP = EDGE_PRIORITY[et] ?? 0;
      const nb = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      for (let d = 0; d < 4; d++) {
        const nx = tx + nb[d][0], ny = ty + nb[d][1];
        if (!this.inBounds(nx, ny)) continue;
        const nt = this.effectiveType(this.tiles[ny * this.w + nx]);
        const p = EDGE_PRIORITY[nt];
        if (p === undefined || p <= myP) continue;
        g.drawImage(this.maskedEdge(this.texFor(nx, ny, this.tiles[ny * this.w + nx]), d), px, py);
      }
      // water: bank shadow at top edge
      if (t === T.WATER || t === T.DEEP_WATER) {
        const up = this.get(tx, ty - 1);
        if (up !== T.WATER && up !== T.DEEP_WATER && up !== T.BRIDGE) {
          g.fillStyle = 'rgba(0,0,0,0.35)';
          g.fillRect(px, py, TILE, 5);
        }
      }
    }
    return c;
  }

  drawGround(ctx, cam) {
    const size = CHUNK * TILE;
    const cx0 = Math.floor(cam.left / size), cx1 = Math.floor((cam.left + cam.width) / size);
    const cy0 = Math.floor(cam.top / size), cy1 = Math.floor((cam.top + cam.height) / size);
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const key = cx + ',' + cy;
      let c = this.chunkCache.get(key);
      if (!c) {
        c = this.renderChunk(cx, cy);
        this.chunkCache.set(key, c);
        if (this.chunkCache.size > 64) this.chunkCache.delete(this.chunkCache.keys().next().value);
      } else {
        // refresh LRU order
        this.chunkCache.delete(key);
        this.chunkCache.set(key, c);
      }
      ctx.drawImage(c, cx * size, cy * size);
    }
  }

  // Render at most one not-yet-cached chunk just outside the view per frame, so walking
  // into new areas never stalls a frame building several chunks at once.
  prefetch(cam) {
    const size = CHUNK * TILE;
    const cx0 = Math.floor(cam.left / size) - 1, cx1 = Math.floor((cam.left + cam.width) / size) + 1;
    const cy0 = Math.floor(cam.top / size) - 1, cy1 = Math.floor((cam.top + cam.height) / size) + 1;
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      const key = cx + ',' + cy;
      if (this.chunkCache.has(key)) continue;
      this.chunkCache.set(key, this.renderChunk(cx, cy));
      if (this.chunkCache.size > 64) this.chunkCache.delete(this.chunkCache.keys().next().value);
      return;
    }
  }

  // animated water highlights for visible water tiles
  drawWater(ctx, cam, time) {
    const tx0 = Math.floor(cam.left / TILE), tx1 = Math.ceil((cam.left + cam.width) / TILE);
    const ty0 = Math.floor(cam.top / TILE), ty1 = Math.ceil((cam.top + cam.height) / TILE);
    ctx.fillStyle = 'rgba(160,220,255,0.35)';
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const t = this.get(tx, ty);
      if (t !== T.WATER && t !== T.DEEP_WATER && t !== T.SHALLOW) continue;
      const h = hash2(tx, ty, 11);
      const ph = (time * 0.8 + h * 6) % 3;
      if (ph > 1.4) continue;
      const x = tx * TILE + ((h * 20 + time * 12) % 26);
      const y = ty * TILE + 6 + h * 18;
      const w = 4 + Math.sin(ph * Math.PI / 1.4) * 5;
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), 1);
    }
  }
}
