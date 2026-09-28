// TILE SKINS: ground textures cut from the owner's map tileset sheets (desgin/Map/A/<a2|a3>/...) for one grid.
// The AI sheets draw every tile as a separate card with a dark painted border, so a tile repeated as-is shows a grid.
// For each chosen tile the tool:
//   1. finds the tile cards (blobs on the dark sheet background) inside a region, in reading order,
//   2. crops the centre (drops the painted border),
//   3. wrap-blends the edges (the last k px fade into the first k px, both axes) -> the texture repeats seamlessly,
//   4. area-downscales to the game tile (32 px) + a light colour grade (same idea as the prop grade),
// and writes assets/tiles/<skin>.png (one row per tile type, 4 variants) + assets/tiles/tiles.json.
// The game (world/levels: `skin`) swaps these textures in for that grid only; other grids keep the painted tiles.
// Usage: node tools/build-tiles.js [--preview]   (preview = 4x contact sheet in <os tmp>/eo-tiles-<skin>.png)
const fs = require('fs');
const path = require('path');
const os = require('os');
const png = require('./png.js');

const ROOT = path.join(__dirname, '..');
const TILE = 32, VARIANTS = 4;
const A2 = 'desgin/Map/A/a2/image-11462af1-b6f1-43a6-96f9-71e6baef142e-0';

// skin -> sheet + rows. Each row: [name, region [x0, y0, x1, y1] (sheet px), picks (card indices in reading order)]
//   name = a tile type of core/constants.js T, or 'face:<cliff|wall|cave>' for vertical wall faces.
//   grade: { sat, dark } colour grade (sat < 1 calmer colours, dark < 1 darker) to sit with the game's night palette
const SKINS = {
  valley: {
    src: A2, grade: { sat: 0.86, dark: 0.82 },
    rows: [
      ['GRASS', [15, 36, 625, 410], [1, 3, 6, 10]],
      ['FLOWERS', [15, 36, 625, 410], [2, 5, 11, 13]],
      ['VALLEY', [15, 36, 625, 410], [0, 4, 0, 12]],
      ['DIRT', [15, 455, 625, 676], [0, 1, 0, 1]],
      ['COBBLE', [15, 716, 625, 937], [0, 1, 2, 5]],
      ['RUIN', [15, 716, 625, 937], [3, 4, 3, 4]],
      ['MOSS_STONE', [1367, 896, 1930, 1178], [5, 6, 5, 6]],
      ['SCORCHED', [1367, 896, 1930, 1178], [7, 8, 7, 8]],
      ['CLIFF', [1367, 896, 1930, 1178], [0, 2, 0, 2]],
      ['WATER', [15, 983, 625, 1117], [2, 3, 2, 3]],
      ['DEEP_WATER', [15, 983, 625, 1117], [0, 1, 0, 1]],
      ['SHALLOW', [15, 983, 625, 1117], [4, 3, 4, 2]],
      ['face:cliff', [981, 1262, 1338, 1350], [0, 1, 2, 3]],
    ],
  },
};

// the owner's sheets may or may not carry a .png extension
const sheetPath = (p) => [p, p + '.png'].map((q) => path.join(ROOT, q)).find((q) => fs.existsSync(q)) || path.join(ROOT, p);

// dark navy sheet background
const isBg = (d, i) => { const r = d[i], g = d[i + 1], b = d[i + 2]; return r < 42 && g < 48 && b < 64 && b >= r; };

function cards(img, [x0, y0, x1, y1]) {
  const { width: w, data } = img;
  const seen = new Uint8Array(w * img.height), out = [];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const p = y * w + x;
    if (seen[p] || isBg(data, p * 4)) continue;
    const b = { minx: x, maxx: x, miny: y, maxy: y }, st = [p]; seen[p] = 1;
    while (st.length) {
      const q = st.pop(), qx = q % w, qy = (q / w) | 0;
      if (qx < b.minx) b.minx = qx; if (qx > b.maxx) b.maxx = qx; if (qy < b.miny) b.miny = qy; if (qy > b.maxy) b.maxy = qy;
      for (const r of [q - 1, q + 1, q - w, q + w]) {
        const rx = r % w, ry = (r / w) | 0;
        if (rx < x0 || rx >= x1 || ry < y0 || ry >= y1 || seen[r] || isBg(data, r * 4)) continue;
        seen[r] = 1; st.push(r);
      }
    }
    if (b.maxx - b.minx > 40 && b.maxy - b.miny > 40) out.push(b); // letters of the labels are smaller
  }
  // reading order: rows (cards whose tops are within half a card) then x
  const h = out.length ? out[0].maxy - out[0].miny : 1;
  return out.sort((a, b) => (Math.abs(a.miny - b.miny) < h / 2 ? a.minx - b.minx : a.miny - b.miny));
}

const get = (im, x, y) => { const i = (y * im.width + x) * 4; return [im.data[i], im.data[i + 1], im.data[i + 2]]; };
// centre crop -> seamless (wrap-blend) -> w x h float RGB
function seamless(img, b, inset = 0.12, blend = 0.2) {
  const cw = b.maxx - b.minx + 1, ch = b.maxy - b.miny + 1;
  const sx = b.minx + Math.round(cw * inset), sy = b.miny + Math.round(ch * inset);
  const W = cw - 2 * Math.round(cw * inset), H = ch - 2 * Math.round(ch * inset);
  const kx = Math.round(W * blend), ky = Math.round(H * blend);
  const OW = W - kx, OH = H - ky;
  const src = (x, y) => get(img, sx + x, sy + y);
  // horizontal wrap
  const rowPass = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < OW; x++) {
    const a = x < kx ? x / kx : 1;
    const p = src(x, y), q = x < kx ? src(x + OW, y) : p;
    rowPass.push([p[0] * a + q[0] * (1 - a), p[1] * a + q[1] * (1 - a), p[2] * a + q[2] * (1 - a)]);
  }
  const rp = (x, y) => rowPass[y * OW + x];
  const out = [];
  for (let y = 0; y < OH; y++) for (let x = 0; x < OW; x++) {
    const a = y < ky ? y / ky : 1;
    const p = rp(x, y), q = y < ky ? rp(x, y + OH) : p;
    out.push([p[0] * a + q[0] * (1 - a), p[1] * a + q[1] * (1 - a), p[2] * a + q[2] * (1 - a)]);
  }
  return { w: OW, h: OH, px: out };
}
function toTile(t, grade, face) {
  const o = png.create(TILE, TILE);
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const x0 = Math.floor((x * t.w) / TILE), x1 = Math.max(x0 + 1, Math.floor(((x + 1) * t.w) / TILE));
    const y0 = Math.floor((y * t.h) / TILE), y1 = Math.max(y0 + 1, Math.floor(((y + 1) * t.h) / TILE));
    let r = 0, g = 0, b = 0, n = 0;
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const p = t.px[yy * t.w + xx]; r += p[0]; g += p[1]; b += p[2]; n++; }
    r /= n; g /= n; b /= n;
    const l = 0.3 * r + 0.59 * g + 0.11 * b;
    r = (l + (r - l) * grade.sat) * grade.dark; g = (l + (g - l) * grade.sat) * grade.dark; b = (l + (b - l) * grade.sat) * grade.dark + 4;
    if (face && y > 26) { const k = 1 - (y - 26) / 10; r *= k; g *= k; b *= k; } // faces fade into shadow at the foot
    const i = (y * TILE + x) * 4;
    o.data[i] = Math.max(0, Math.min(255, r)); o.data[i + 1] = Math.max(0, Math.min(255, g)); o.data[i + 2] = Math.max(0, Math.min(255, b)); o.data[i + 3] = 255;
  }
  return o;
}

// the variants of one tile type are mixed tile by tile on the ground: pull each one's average colour to the row
// average, otherwise a light and a dark card make a checkerboard
function equalize(tiles) {
  const mean = (t) => { const m = [0, 0, 0]; for (let i = 0; i < t.data.length; i += 4) for (let c = 0; c < 3; c++) m[c] += t.data[i + c]; return m.map((v) => v / (t.data.length / 4)); };
  const ms = tiles.map(mean), avg = [0, 1, 2].map((c) => ms.reduce((a, m) => a + m[c], 0) / ms.length);
  tiles.forEach((t, k) => {
    const f = [0, 1, 2].map((c) => (ms[k][c] > 1 ? avg[c] / ms[k][c] : 1));
    for (let i = 0; i < t.data.length; i += 4) for (let c = 0; c < 3; c++) t.data[i + c] = Math.max(0, Math.min(255, t.data[i + c] * f[c]));
  });
}

const preview = process.argv.includes('--preview');
const outDir = path.join(ROOT, 'assets/tiles');
fs.mkdirSync(outDir, { recursive: true });
const meta = {};
for (const [id, skin] of Object.entries(SKINS)) {
  const img = png.read(sheetPath(skin.src));
  const atlas = png.create(TILE * VARIANTS, TILE * skin.rows.length);
  const rows = {};
  skin.rows.forEach(([name, region, picks], r) => {
    const list = cards(img, region);
    const face = name.startsWith('face:');
    const tiles = picks.map((k) => {
      const b = list[k];
      if (!b) throw new Error(`${id}.${name}: card ${k} missing (found ${list.length})`);
      return toTile(seamless(img, b, face ? 0.08 : 0.12, face ? 0.12 : 0.2), skin.grade, face);
    });
    equalize(tiles);
    tiles.forEach((t, v) => {
      for (let y = 0; y < TILE; y++) t.data.copy(atlas.data, ((r * TILE + y) * atlas.width + v * TILE) * 4, y * TILE * 4, (y + 1) * TILE * 4);
    });
    rows[name] = r;
    console.log(`${id}.${name}: ${list.length} cards in region, picked ${picks.join(',')}`);
  });
  png.write(path.join(outDir, id + '.png'), atlas);
  meta[id] = { file: `assets/tiles/${id}.png`, tile: TILE, variants: VARIANTS, rows };
  if (preview) {
    // each variant repeated 3x3 at 2x zoom, one row per type: seams and colours at a glance
    const Z = 2, R = 3, cellW = TILE * R * Z + 6;
    const pv = png.create(cellW * VARIANTS, (TILE * R * Z + 6) * skin.rows.length);
    for (let r = 0; r < skin.rows.length; r++) for (let v = 0; v < VARIANTS; v++)
      for (let y = 0; y < TILE * R * Z; y++) for (let x = 0; x < TILE * R * Z; x++) {
        const sx = v * TILE + (Math.floor(x / Z) % TILE), sy = r * TILE + (Math.floor(y / Z) % TILE);
        atlas.data.copy(pv.data, ((r * (TILE * R * Z + 6) + y) * pv.width + v * cellW + x) * 4, (sy * atlas.width + sx) * 4, (sy * atlas.width + sx) * 4 + 4);
      }
    const f = path.join(os.tmpdir(), `eo-tiles-${id}.png`);
    png.write(f, pv);
    console.log('preview', f);
  }
}
fs.writeFileSync(path.join(outDir, 'tiles.json'), JSON.stringify(meta, null, 1));
module.exports = { SKINS };
