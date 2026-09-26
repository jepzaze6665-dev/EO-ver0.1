import { TILE, T, SOLID_TILES } from '../core/constants.js';
import { RNG, vnoise } from '../core/rng.js';

// Brush toolkit used by the zone builders. All coordinates are in tiles.
// Collects spawns / interactables / npcs / lights for the World to instantiate.
export class Builder {
  constructor(map, seed = 7) {
    this.m = map;
    this.r = new RNG(seed);
    this.spawns = [];
    this.interactables = [];
    this.npcs = [];
    this.lights = [];
    this.regions = {}; // named rects for world logic (arena bounds etc.)
  }

  paint(tx, ty, t, only) {
    if (!this.m.inBounds(tx, ty)) return;
    if (only && !only.includes(this.m.get(tx, ty))) return;
    this.m.set(tx, ty, t);
  }
  rect(x0, y0, x1, y1, t, only) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.paint(x, y, t, only);
  }
  // disc with noisy edge (noise = tiles of wobble)
  disc(cx, cy, r, t, { noise = 1.5, only, seed = 1 } = {}) {
    const R = Math.ceil(r + noise + 1);
    for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) {
      const d = Math.hypot(x - cx, y - cy);
      const edge = r + (vnoise(x / 3, y / 3, seed + cx * 7 + cy) - 0.5) * 2 * noise;
      if (d <= edge) this.paint(x, y, t, only);
    }
  }
  ellipse(cx, cy, rx, ry, t, opts = {}) {
    const noise = opts.noise ?? 1;
    for (let y = Math.floor(cy - ry - noise - 1); y <= cy + ry + noise + 1; y++)
      for (let x = Math.floor(cx - rx - noise - 1); x <= cx + rx + noise + 1; x++) {
        const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
        const edge = 1 + (vnoise(x / 3, y / 3, 5 + cx) - 0.5) * 2 * (noise / Math.max(rx, ry));
        if (d <= edge) this.paint(x, y, t, opts.only);
      }
  }
  // thick polyline (paths, rivers, corridors)
  line(points, width, t, { noise = 0.8, only, seed = 3 } = {}) {
    for (let i = 0; i < points.length - 1; i++) {
      const [x0, y0] = points[i], [x1, y1] = points[i + 1];
      const len = Math.hypot(x1 - x0, y1 - y0);
      const steps = Math.ceil(len * 2);
      for (let s = 0; s <= steps; s++) {
        const f = s / steps;
        const x = x0 + (x1 - x0) * f, y = y0 + (y1 - y0) * f;
        const w = width / 2 + (vnoise(x / 4, y / 4, seed) - 0.5) * 2 * noise;
        const R = Math.ceil(w + 1);
        for (let yy = Math.floor(y - R); yy <= y + R; yy++) for (let xx = Math.floor(x - R); xx <= x + R; xx++)
          if (Math.hypot(xx + 0.5 - x, yy + 0.5 - y) <= w) this.paint(xx, yy, t, only);
      }
    }
  }
  zoneRect(x0, y0, x1, y1, z) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (this.m.inBounds(x, y)) this.m.zone[this.m.idx(x, y)] = z;
  }
  // sub-area assignment for tiles inside a disc that are walkable (for banners / map labels)
  subDisc(cx, cy, r, sub) {
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++)
      if (this.m.inBounds(x, y) && Math.hypot(x - cx, y - cy) <= r) this.m.sub[this.m.idx(x, y)] = sub;
  }
  subRect(x0, y0, x1, y1, sub) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (this.m.inBounds(x, y)) this.m.sub[this.m.idx(x, y)] = sub;
  }
  secretRect(x0, y0, x1, y1, id) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (this.m.inBounds(x, y)) this.m.secret[this.m.idx(x, y)] = id;
  }

  // tile coords -> prop at the tile's base
  prop(name, tx, ty, opts = {}) {
    return this.m.addProp({ name, x: (tx + 0.5) * TILE + (opts.dx || 0), y: (ty + 1) * TILE - 3 + (opts.dy || 0), ...opts });
  }
  propPx(name, x, y, opts = {}) {
    return this.m.addProp({ name, x, y, ...opts });
  }

  open(tx, ty) { return !SOLID_TILES.has(this.m.get(tx, ty)); }

  // random decoration on walkable tiles of given types inside a rect
  scatter(x0, y0, x1, y1, names, count, { on, solid = false, minGap = 0, jitter = 10, keepClear } = {}) {
    let placed = 0, guard = 0;
    const taken = [];
    while (placed < count && guard++ < count * 30) {
      const tx = this.r.int(x0, x1), ty = this.r.int(y0, y1);
      const t = this.m.get(tx, ty);
      if (on ? !on.includes(t) : SOLID_TILES.has(t)) continue;
      if (this.m.blocker[this.m.idx(tx, ty)]) continue;
      if (keepClear && keepClear.some(([cx, cy, r]) => Math.hypot(tx - cx, ty - cy) < r)) continue;
      if (minGap && taken.some(([ax, ay]) => Math.hypot(ax - tx, ay - ty) < minGap)) continue;
      taken.push([tx, ty]);
      this.prop(this.r.pick(names), tx, ty, {
        dx: this.r.range(-jitter, jitter), dy: this.r.range(-jitter / 2, jitter / 2),
        solid, flip: this.r.chance(0.5),
      });
      placed++;
    }
  }

  // Tree sprites along the boundary between blocked canopy and open ground, so forest walls look organic.
  edgeTrees(x0, y0, x1, y1, names, density = 0.55, opts = {}) {
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (this.m.get(tx, ty) !== T.CANOPY) continue;
      const openS = this.open(tx, ty + 1), openN = this.open(tx, ty - 1), openE = this.open(tx + 1, ty), openW = this.open(tx - 1, ty);
      if (!(openS || openN || openE || openW)) continue;
      if (!this.r.chance(openS ? density + 0.2 : density)) continue;
      const set = typeof names === 'function' ? names(tx, ty) : names;
      if (!set) continue;
      this.prop(this.r.pick(set), tx, ty, {
        dx: this.r.range(-8, 8) + (openE ? 6 : 0) - (openW ? 6 : 0),
        dy: openS ? this.r.range(-2, 4) : this.r.range(-10, 0),
        flip: this.r.chance(0.5), tree: true, ...opts,
      });
    }
  }

  spawn(type, tx, ty, opts = {}) {
    this.spawns.push({ type, x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE, count: 1, radius: 2, ...opts });
  }
  interact(def) {
    const it = { radius: 34, ...def };
    if (def.tx !== undefined) { it.x = (def.tx + 0.5) * TILE; it.y = (def.ty + 0.6) * TILE; }
    this.interactables.push(it);
    return it;
  }
  npc(def) {
    this.npcs.push({ ...def, x: (def.tx + 0.5) * TILE, y: (def.ty + 0.7) * TILE });
  }
  light(tx, ty, r, color, opts = {}) {
    this.lights.push({ x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE, r, color, ...opts });
  }
}
