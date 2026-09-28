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
const A3 = 'desgin/Map/A/a3/image-092dabfa-467b-48b0-901c-8dad361ac42e-0';
const CITY = 'desgin/Map/City/ASTERIA CITY/image-c0f27881-0e5a-4221-ab7f-192ea8b07205-0';
const B2 = 'desgin/Map/B/B2/image-76690731-d973-441f-ba7f-1b03cda9b3eb-0';
const B1 = 'desgin/Map/B/B1/image-4e5b0ee7-22d6-4f86-96e0-1b8e9df7ebb6-0';

// skin -> sheet + rows. Each row: [name, region [x0, y0, x1, y1] (sheet px), picks (card indices in reading order)]
//   a pick may also be a card box [x0, y0, x1, y1] (sheets whose cards touch: no gap to find them by); region null then
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
  // A3 RUNE CITADEL (owner's sheet desgin/Map/A/a3): dark stone + bronze gold, grid cards ~72 px
  citadel: {
    src: A3, grade: { sat: 0.9, dark: 0.85 }, bg: 'measured',
    rows: [
      ['GRASS', [15, 36, 615, 410], [0, 1, 8, 9]],
      ['FLOWERS', [15, 36, 615, 410], [6, 7, 14, 15]],
      ['DIRT', [635, 36, 1137, 410], [0, 1, 7, 8]],
      ['COBBLE', [1152, 36, 1654, 410], [0, 1, 7, 8]],
      ['RUIN', [1152, 36, 1654, 410], [2, 3, 9, 10]],
      ['ARENA', [1393, 1761, 1587, 1951], [0, 1, 2, 3]],
      ['MOSS_STONE', [20, 1761, 220, 1951], [0, 1, 2, 3]],
      ['CORRUPT', [235, 1761, 440, 1951], [0, 1, 2, 3]],
      ['CLIFF', [1152, 36, 1654, 410], [5, 6, 12, 13]],
      ['WATER', [1669, 36, 1961, 410], [1, 5, 1, 5]],
      ['DEEP_WATER', [1669, 36, 1961, 410], [6, 7, 8, 9]],
      ['SHALLOW', [1669, 36, 1961, 410], [2, 3, 2, 3]],
      ['face:cliff', [1620, 1495, 1850, 1580], [0, 1, 2, 0]],
      ['face:wall', [620, 1495, 1000, 1580], [0, 1, 2, 3]],
    ],
  },
  // CITY 2 ASTERIA (owner's sheet desgin/Map/City/ASTERIA CITY): green lawns, pale pavers, blue moat water, ~76 px cards
  asteria: {
    src: CITY, grade: { sat: 0.9, dark: 0.86 },
    rows: [
      ['GRASS', [10, 40, 690, 375], [0, 1, 8, 9]],
      ['FLOWERS', [10, 40, 690, 375], [7, 15, 31, 15]],
      ['DIRT', [700, 40, 1352, 375], [0, 1, 8, 9]],
      ['COBBLE', [1356, 40, 2040, 375], [0, 1, 8, 9]],
      ['ARENA', [1356, 40, 2040, 375], [16, 17, 5, 13]],
      ['RUIN', [1356, 40, 2040, 375], [14, 15, 22, 23]],
      ['MOSS_STONE', [1356, 40, 2040, 375], [2, 10, 18, 26]],
      ['CLIFF', [385, 1600, 565, 1700], [0, 1, 0, 1]],
      ['WATER', [10, 515, 620, 770], [0, 1, 7, 8]],
      ['DEEP_WATER', [10, 515, 620, 770], [3, 10, 3, 10]],
      ['SHALLOW', [10, 515, 620, 770], [11, 12, 11, 12]],
      ['face:cliff', [190, 1600, 380, 1700], [0, 1, 2, 0]],
      ['face:wall', [565, 1600, 745, 1700], [0, 1, 0, 1]],
    ],
  },
  // B1 FROSTWIND PLAINS (owner's sheet desgin/Map/B/B1): snow fields, packed-snow roads, blue water, lake ice. The
  // cards touch each other (thin dark lines, no gaps) -> explicit card boxes
  frost: {
    src: B1, grade: { sat: 0.92, dark: 0.9 },
    rows: [
      ['GRASS', null, [[8, 77, 79, 163], [85, 77, 158, 163], [8, 77, 79, 163], [85, 77, 158, 163]]],
      ['FLOWERS', null, [[250, 77, 333, 163], [340, 77, 423, 163], [430, 77, 514, 163], [520, 77, 613, 163]]],
      ['DIRT', null, [[8, 248, 79, 334], [86, 248, 165, 334], [8, 248, 79, 334], [86, 248, 165, 334]]],
      ['COBBLE', null, [[469, 416, 565, 506], [572, 416, 673, 506], [469, 416, 565, 506], [572, 416, 673, 506]]],
      ['ARENA', null, [[8, 416, 80, 506], [87, 416, 166, 506], [8, 416, 80, 506], [87, 416, 166, 506]]],
      ['RUIN', null, [[786, 416, 882, 506], [890, 416, 993, 506], [786, 416, 882, 506], [890, 416, 993, 506]]],
      ['MOSS_STONE', null, [[1623, 1594, 1737, 1718], [1623, 1594, 1737, 1718], [1623, 1594, 1737, 1718], [1623, 1594, 1737, 1718]]],
      ['ICE', null, [[1757, 1594, 1864, 1718], [1757, 1594, 1864, 1718], [1757, 1594, 1864, 1718], [1757, 1594, 1864, 1718]]],
      ['CLIFF', null, [[786, 416, 882, 506], [890, 416, 993, 506], [786, 416, 882, 506], [890, 416, 993, 506]]], // dark rough stone (the 'cliff top' cards stripe)
      ['WATER', null, [[9, 594, 88, 675], [93, 594, 171, 675], [9, 594, 88, 675], [93, 594, 171, 675]]],
      ['DEEP_WATER', null, [[599, 594, 677, 675], [599, 594, 677, 675], [599, 594, 677, 675], [599, 594, 677, 675]]],
      ['SHALLOW', null, [[919, 594, 1018, 675], [1020, 594, 1119, 675], [919, 594, 1018, 675], [1020, 594, 1119, 675]]],
      ['face:cliff', null, [[333, 1599, 406, 1683], [333, 1599, 406, 1683], [333, 1599, 406, 1683], [333, 1599, 406, 1683]]],
    ],
  },
  // B2 CRYSTAL CAVERNS (owner's sheet desgin/Map/B/B2): dark cave stone, moss, underground water, crystal growth, rune floor
  caverns: {
    src: B2, grade: { sat: 0.95, dark: 0.9 },
    rows: [
      ['GRASS', null, [[23, 54, 107, 138], [118, 54, 201, 138], [211, 54, 295, 138], [306, 54, 389, 138]]],
      ['DIRT', null, [[23, 211, 107, 294], [118, 211, 201, 294], [211, 211, 296, 294], [306, 211, 389, 294]]],
      ['COBBLE', null, [[23, 370, 107, 453], [118, 370, 201, 453], [211, 370, 296, 453], [306, 370, 389, 453]]],
      ['RUIN', null, [[683, 370, 766, 453], [776, 370, 859, 453], [869, 370, 953, 453], [683, 370, 766, 453]]],
      ['ARENA', null, [[1148, 1476, 1223, 1551], [1226, 1476, 1301, 1551], [1148, 1554, 1223, 1629], [1226, 1554, 1301, 1629]]],
      ['CORRUPT', null, [[978, 1476, 1054, 1551], [1057, 1476, 1133, 1551], [978, 1554, 1054, 1629], [1057, 1554, 1133, 1629]]],
      ['MOSS_STONE', null, [[1526, 1476, 1597, 1551], [1601, 1476, 1672, 1551], [1526, 1554, 1597, 1629], [1601, 1554, 1672, 1629]]],
      ['CLIFF', null, [[160, 1628, 239, 1682], [160, 1628, 239, 1682], [160, 1455, 239, 1531], [160, 1628, 239, 1682]]],
      ['WATER', null, [[133, 533, 229, 613], [244, 533, 341, 613], [133, 533, 229, 613], [244, 533, 341, 613]]],
      ['DEEP_WATER', null, [[23, 533, 118, 613], [23, 533, 118, 613], [23, 533, 118, 613], [23, 533, 118, 613]]],
      ['SHALLOW', null, [[355, 533, 452, 613], [466, 533, 563, 613], [355, 533, 452, 613], [466, 533, 563, 613]]],
      ['face:cliff', null, [[253, 1628, 326, 1682], [253, 1628, 326, 1682], [253, 1628, 326, 1682], [253, 1628, 326, 1682]]],
    ],
  },
};

// the owner's sheets may or may not carry a .png extension
const sheetPath = (p) => [p, p + '.png'].map((q) => path.join(ROOT, q)).find((q) => fs.existsSync(q)) || path.join(ROOT, p);

// sheet background: measured from the sheet border (dark navy on the A2 sheet, near-black on the A3 one); a pixel
// within BG_TOL of it on every channel is background
const BG_TOL = 12;
let BG = [20, 26, 36];
function measureBg(img) {
  const { width: w, height: h, data } = img, hist = new Map();
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
    if (x > 12 && y > 12 && x < w - 12 && y < h - 12) continue;
    const i = (y * w + x) * 4, k = (data[i] >> 2) + ',' + (data[i + 1] >> 2) + ',' + (data[i + 2] >> 2);
    hist.set(k, (hist.get(k) || 0) + 1);
  }
  const top = [...hist].sort((a, b) => b[1] - a[1])[0][0].split(',').map((v) => v * 4 + 2);
  BG = top;
}
// skin.bg 'measured' (dark sheets whose tiles are dark too, A3) · default 'navy' (any dark blue-ish pixel, A2)
let BG_MODE = 'navy';
const isBg = (d, i) => BG_MODE === 'measured'
  ? Math.abs(d[i] - BG[0]) <= BG_TOL && Math.abs(d[i + 1] - BG[1]) <= BG_TOL && Math.abs(d[i + 2] - BG[2]) <= BG_TOL
  : d[i] < 42 && d[i + 1] < 48 && d[i + 2] < 64 && d[i + 2] >= d[i];

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
  measureBg(img); BG_MODE = skin.bg || 'navy';
  const atlas = png.create(TILE * VARIANTS, TILE * skin.rows.length);
  const rows = {};
  skin.rows.forEach(([name, region, picks], r) => {
    const list = region ? cards(img, region) : [];
    const face = name.startsWith('face:');
    const tiles = picks.map((k) => {
      const b = Array.isArray(k) ? { minx: k[0], miny: k[1], maxx: k[2], maxy: k[3] } : list[k];
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
