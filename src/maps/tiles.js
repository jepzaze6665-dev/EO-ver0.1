import { T, TILE } from '../core/constants.js';
import { makeCanvas } from '../core/assets.js';
import { hash2, vnoise, RNG } from '../core/rng.js';

// Procedurally painted 32x32 ground tiles (dark-fantasy palette). Each type has
// several variants; edges between types are blended by jagged overlay masks.
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const PAL = {
  grass: ['#2f5a2c', '#3b6b33', '#4d8040', '#24482a'],
  forest: ['#1c3526', '#23422d', '#2f5536', '#152a1e'],
  corrupt: ['#231a30', '#2d2040', '#5d2b86', '#170f22'],
  dirt: ['#5c4330', '#6e5138', '#84654a', '#47331f'],
  sand: ['#6b6146', '#7b7050', '#91845f', '#564c36'],
  cobble: ['#666a74', '#7c808a', '#90949d', '#34363e'],
  ruin: ['#434956', '#4f5664', '#5e6676', '#262a33'],
  moss: ['#3c4a44', '#44574a', '#4f6b4c', '#26302d'],
  arena: ['#39414e', '#434c5a', '#566072', '#20252e'],
  cave: ['#211c2b', '#2a2436', '#3a3149', '#15121c'],
  valley: ['#4a6534', '#5a7640', '#8a9150', '#36502a'],
  water: ['#1b4a6b', '#215a80', '#3a86b0', '#123654'],
  deep: ['#0f2b44', '#133452', '#1e4f74', '#0a1f33'],
  shallow: ['#2b6a7c', '#357a8c', '#5aa6b8', '#1f5566'],
  canopy: ['#11231a', '#183022', '#24452d', '#0a170f'],
  void: ['#07060b', '#0b0a12', '#141224', '#040307'],
  scorched: ['#2e2622', '#3a302a', '#56463a', '#1c1614'],
};

function paint(ctx, fn) {
  const img = ctx.createImageData(TILE, TILE);
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const c = fn(x, y);
    const o = (y * TILE + x) * 4;
    img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = c[3] ?? 255;
  }
  ctx.putImageData(img, 0, 0);
}

// quantise a 0..1 value into palette steps for a crisp pixel-art look
function band(pal, v) {
  const p = pal.map(hex);
  if (v < 0.25) return p[3];
  if (v < 0.6) return p[0];
  if (v < 0.85) return p[1];
  return p[2];
}

function grassLike(pal, seed, opts = {}) {
  return (x, y) => {
    const n = vnoise(x / 6, y / 6, seed) * 0.6 + vnoise(x / 2.5, y / 2.5, seed + 7) * 0.4;
    const h = hash2(x, y, seed);
    let c = band(pal, n * 0.9 + h * 0.18);
    // blades
    if (h > 0.93) c = hex(pal[2]);
    if (opts.flowers && h > 0.985) c = hex(['#d8c46a', '#c86a8a', '#9a7ad8', '#e8e8f0'][Math.floor(hash2(y, x, seed) * 4)]);
    if (opts.leaves && h < 0.03) c = hex('#6b4a2a');
    if (opts.veins) {
      const v = Math.abs(vnoise(x / 5, y / 5, seed + 3) - 0.5);
      if (v < 0.035) c = hex('#7a3aa8');
      else if (v < 0.07) c = hex('#43245e');
    }
    return c;
  };
}

function stones(pal, seed, size, opts = {}) {
  const p = pal.map(hex);
  return (x, y) => {
    // offset brick/slab grid
    const row = Math.floor(y / size);
    const off = row % 2 ? size / 2 : 0;
    const cx = Math.floor((x + off) / size), lx = (x + off) % size, ly = y % size;
    const grout = lx === 0 || ly === 0;
    const sh = hash2(cx, row, seed);
    let c = grout ? p[3] : mix(p[0], p[1], sh);
    if (!grout) {
      if (ly === 1 || lx === 1) c = mix(c, p[2], 0.5); // top-left highlight
      if (ly === size - 1 || lx === size - 1) c = mix(c, p[3], 0.45);
      const n = hash2(x, y, seed + 1);
      if (n > 0.92) c = mix(c, p[3], 0.4);
      if (opts.moss && vnoise(x / 4, y / 4, seed + 9) > 0.62) c = mix(c, hex('#3f6a3c'), 0.7);
      if (opts.crack && Math.abs(vnoise(x / 6, y / 3, seed + 4) - 0.5) < 0.03) c = p[3];
    }
    return c;
  };
}

function cobbleFn(pal, seed) {
  const p = pal.map(hex);
  // voronoi-ish round cobbles
  const pts = [];
  const r = new RNG(seed);
  for (let i = 0; i < 9; i++) pts.push([r.range(0, 32), r.range(0, 32), r.next()]);
  return (x, y) => {
    let d1 = 1e9, d2 = 1e9, s = 0;
    for (const [px, py, sv] of pts) for (const ox of [-32, 0, 32]) for (const oy of [-32, 0, 32]) {
      const d = (x - px - ox) ** 2 + (y - py - oy) ** 2;
      if (d < d1) { d2 = d1; d1 = d; s = sv; } else if (d < d2) d2 = d;
    }
    const edge = Math.sqrt(d2) - Math.sqrt(d1);
    if (edge < 1.3) return p[3];
    let c = mix(p[0], p[1], s);
    if (edge < 2.4) c = mix(c, p[3], 0.35);
    if (hash2(x, y, seed) > 0.95) c = mix(c, p[2], 0.6);
    return c;
  };
}

function waterFn(pal, seed) {
  return (x, y) => {
    const n = vnoise(x / 7, y / 4, seed) * 0.7 + vnoise(x / 3, y / 2, seed + 5) * 0.3;
    let c = band(pal, n);
    const w = Math.sin((x + y * 0.4) / 3 + seed) * 0.5 + 0.5;
    if (w > 0.94 && hash2(x, y, seed) > 0.5) c = hex(pal[2]);
    return c;
  };
}

// molten rock: bright core flowing between dark cooling crust
function lavaFn(seed) {
  const core = hex('#ffb040'), hot = hex('#e8601a'), deep = hex('#9a2410'), crust = hex('#2a1410');
  return (x, y) => {
    const n = vnoise(x / 6, y / 5, seed) * 0.65 + vnoise(x / 2.5, y / 2.5, seed + 3) * 0.35;
    const vein = Math.abs(vnoise(x / 7, y / 7, seed + 9) - 0.5);
    if (vein < 0.05) return crust;
    if (vein < 0.08) return mix(crust, deep, 0.6);
    if (n > 0.72) return core;
    if (n > 0.5) return mix(hot, core, (n - 0.5) / 0.22);
    return mix(deep, hot, n / 0.5);
  };
}

function canopyFn(pal, seed, tint) {
  const p = pal.map(hex);
  const r = new RNG(seed);
  const crowns = [];
  for (let i = 0; i < 7; i++) crowns.push([r.range(-4, 36), r.range(-4, 36), r.range(7, 13)]);
  return (x, y) => {
    let best = null, bd = 1e9;
    for (const [cx, cy, cr] of crowns) {
      for (const ox of [-32, 0, 32]) for (const oy of [-32, 0, 32]) {
        const d = Math.hypot(x - cx - ox, y - cy - oy) / cr;
        if (d < 1 && d < bd) { bd = d; best = [cx + ox, cy + oy, cr]; }
      }
    }
    if (!best) return p[3];
    // shade: light from top-left
    const lx = (x - best[0]) / best[2], ly = (y - best[1]) / best[2];
    const light = -(lx + ly) * 0.5 + (1 - bd) * 0.6 + (hash2(x, y, seed) - 0.5) * 0.35;
    let c = light > 0.55 ? p[2] : light > 0.15 ? p[1] : light > -0.2 ? p[0] : p[3];
    if (bd > 0.88) c = p[3];
    if (tint) c = mix(c, hex(tint), 0.35);
    return c;
  };
}

function cliffTop(seed) {
  const p = ['#4a4a52', '#5a5a63', '#6d6d78', '#2c2c33'].map(hex);
  return (x, y) => {
    const n = vnoise(x / 5, y / 5, seed) * 0.7 + hash2(x, y, seed) * 0.3;
    let c = n < 0.3 ? p[3] : n < 0.6 ? p[0] : n < 0.85 ? p[1] : p[2];
    if (vnoise(x / 6, y / 6, seed + 3) > 0.7) c = mix(c, hex('#3d5a3a'), 0.6);
    return c;
  };
}

function voidFn(seed) {
  return (x, y) => {
    const n = vnoise(x / 9, y / 9, seed);
    let c = mix(hex('#050409'), hex('#120f20'), n * 0.8);
    if (hash2(x, y, seed) > 0.996) c = hex('#6a6490');
    return c;
  };
}

function bridgeFn(seed) {
  const p = ['#6e4d30', '#83603d', '#9a7550', '#3e2a18'].map(hex);
  return (x, y) => {
    if (x < 3 || x > 28) return x === 1 || x === 30 ? p[3] : mix(p[0], p[3], 0.5); // rails
    const plank = Math.floor(y / 6), ly = y % 6;
    if (ly === 0) return p[3];
    let c = mix(p[0], p[1], hash2(plank, 0, seed));
    if (ly === 1) c = mix(c, p[2], 0.5);
    if (hash2(x, y, seed) > 0.94) c = mix(c, p[3], 0.5);
    if ((x === 6 || x === 25) && ly === 3) c = hex('#2a2a2a');
    return c;
  };
}

// Steps that share the ruin-floor stone palette: lit tread, dark riser, worn edges.
function stairsFn(seed) {
  const p = PAL.ruin.map(hex);
  return (x, y) => {
    const ly = y % 8, step = Math.floor(y / 8);
    const worn = hash2(x >> 2, step, seed);
    let c;
    if (ly >= 6) c = mix(p[3], [0, 0, 0], 0.25);             // riser shadow
    else if (ly === 0) c = mix(p[2], [255, 255, 255], 0.12); // nosing highlight
    else c = mix(p[0], p[1], worn * 0.6 + step * 0.08);      // tread (lighter toward the top)
    if (x === 0 || x === 31) c = p[3];
    if (ly < 6 && (x + step * 5) % 11 === 0) c = mix(c, p[3], 0.5); // block joints
    if (hash2(x, y, seed) > 0.95) c = mix(c, hex('#3f6a3c'), 0.5);
    return c;
  };
}

function wallTop(seed) {
  return stones(['#50566a', '#5c6377', '#727a90', '#23262f'], seed, 8, { moss: true });
}

const VARIANTS = 4;

export function buildTileset() {
  const tex = {};
  const add = (type, makeFn) => {
    tex[type] = [];
    for (let v = 0; v < VARIANTS; v++) {
      const c = makeCanvas(TILE, TILE);
      paint(c.getContext('2d'), makeFn(type * 97 + v * 13 + 1));
      tex[type].push(c);
    }
  };
  add(T.GRASS, (s) => grassLike(PAL.grass, s, { flowers: s % 3 === 0 }));
  add(T.FLOWERS, (s) => grassLike(PAL.grass, s, { flowers: true }));
  add(T.FOREST_FLOOR, (s) => grassLike(PAL.forest, s, { leaves: true }));
  add(T.CORRUPT, (s) => grassLike(PAL.corrupt, s, { veins: true }));
  add(T.VALLEY, (s) => grassLike(PAL.valley, s, { flowers: true }));
  add(T.DIRT, (s) => grassLike(PAL.dirt, s));
  add(T.SAND, (s) => grassLike(PAL.sand, s));
  add(T.COBBLE, (s) => cobbleFn(PAL.cobble, s));
  add(T.RUIN, (s) => stones(PAL.ruin, s, 16, { crack: true }));
  add(T.MOSS_STONE, (s) => stones(PAL.moss, s, 16, { moss: true, crack: true }));
  add(T.ARENA, (s) => cobbleFn(PAL.arena, s + 40));
  add(T.CAVE, (s) => grassLike(PAL.cave, s));
  add(T.WATER, (s) => waterFn(PAL.water, s));
  add(T.DEEP_WATER, (s) => waterFn(PAL.deep, s));
  add(T.SHALLOW, (s) => waterFn(PAL.shallow, s));
  add(T.CANOPY, (s) => canopyFn(PAL.canopy, s));
  add(T.CLIFF, (s) => cliffTop(s));
  add(T.CAVE_WALL, (s) => canopyFn(['#1d1826', '#262033', '#3a3050', '#0d0a13'], s));
  add(T.VOID, (s) => voidFn(s));
  add(T.BRIDGE, (s) => bridgeFn(s));
  add(T.STAIRS, (s) => stairsFn(s));
  add(T.BUILDING, (s) => grassLike(PAL.dirt, s));
  add(T.RUIN_WALL, (s) => wallTop(s));
  add(T.SCORCHED, (s) => stones(PAL.scorched, s, 11, { crack: true }));
  add(T.LAVA, (s) => lavaFn(s));

  // alternative palettes used by world state (corrupted canopy / restored forest)
  const alt = {};
  const addAlt = (key, makeFn) => {
    alt[key] = [];
    for (let v = 0; v < VARIANTS; v++) {
      const c = makeCanvas(TILE, TILE);
      paint(c.getContext('2d'), makeFn(v * 31 + key.length * 7));
      alt[key].push(c);
    }
  };
  addAlt('canopy_corrupt', (s) => canopyFn(PAL.canopy, s + 5, '#3a1f52'));
  addAlt('canopy_ancient', (s) => canopyFn(['#10252a', '#163339', '#20505a', '#08171b'], s + 9));
  addAlt('canopy_valley', (s) => canopyFn(['#2a3d1e', '#384f26', '#5b7034', '#1a2612'], s + 3));
  addAlt('forest_restored', (s) => grassLike(['#2a4a2c', '#335a33', '#4a7a42', '#1d3822'], s + 11, { flowers: s % 2 === 0 }));

  // wall / cliff front faces (drawn under a solid tile when the tile below is open)
  const faces = {};
  const mkFace = (key, base, dark, light) => {
    faces[key] = [];
    for (let v = 0; v < VARIANTS; v++) {
      const c = makeCanvas(TILE, TILE);
      const s = v * 17 + key.length;
      paint(c.getContext('2d'), (x, y) => {
        const b = hex(base), d = hex(dark), l = hex(light);
        let col = mix(b, d, y / 40);
        if (key === 'wall') {
          const row = Math.floor(y / 8), off = row % 2 ? 6 : 0;
          if (y % 8 === 0 || (x + off) % 12 === 0) col = d;
          else if (y % 8 === 1) col = mix(col, l, 0.4);
        } else {
          const n = vnoise(x / 3, y / 8, s);
          if (n > 0.72) col = mix(col, l, 0.5);
          if (n < 0.22) col = d;
          if (hash2(x, y, s) > 0.9) col = mix(col, d, 0.6);
        }
        if (y > 26) col = mix(col, [0, 0, 0], (y - 26) / 10);
        return col;
      });
      faces[key].push(c);
    }
  };
  mkFace('cliff', '#4a4550', '#1e1b24', '#6d6878');
  mkFace('wall', '#4a5062', '#1d2029', '#6c7590');
  mkFace('cave', '#2a2236', '#0f0c16', '#4a3d62');

  // jagged edge masks per direction (0 N, 1 E, 2 S, 3 W): overlay neighbour texture onto a tile
  const masks = [];
  for (let d = 0; d < 4; d++) {
    const m = makeCanvas(TILE, TILE);
    const g = m.getContext('2d');
    const img = g.createImageData(TILE, TILE);
    for (let i = 0; i < TILE; i++) {
      const depth = 2 + Math.floor(vnoise(i / 3, d * 10, 77) * 6 + hash2(i, d, 5) * 2);
      for (let j = 0; j < depth; j++) {
        let x, y;
        if (d === 0) { x = i; y = j; } else if (d === 2) { x = i; y = TILE - 1 - j; }
        else if (d === 1) { x = TILE - 1 - j; y = i; } else { x = j; y = i; }
        img.data[(y * TILE + x) * 4 + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    masks.push(m);
  }
  return { tex, alt, faces, masks };
}

// Overlay priority for edge blending: higher value spills onto lower neighbours.
export const EDGE_PRIORITY = {
  [T.CANOPY]: 9, [T.CAVE_WALL]: 9,
  [T.CORRUPT]: 7, [T.FOREST_FLOOR]: 6, [T.GRASS]: 6, [T.FLOWERS]: 6, [T.VALLEY]: 6,
  [T.MOSS_STONE]: 5, [T.SAND]: 4, [T.DIRT]: 3, [T.CAVE]: 3,
  [T.COBBLE]: 2, [T.RUIN]: 2, [T.ARENA]: 1, [T.SHALLOW]: 1, [T.SCORCHED]: 2,
};
