// Builds the ITEM icons from the owner's icon sheets (desgin/ITEM/<version>/*.png — several icons per sheet, laid out in
// the order of the item catalogue PDF) into small game icons:
//   assets/icons/items/<item id>.png (SIZE × SIZE, transparent) + assets/icons/items/items.json { id: { file } }
// Which icon is which item = SHEETS below: one list of item ids per row, in reading order (null = an icon not used).
// Icons are found on the sheet's GRID: rows = bands of solid pixels split by empty horizontal gaps (must match the manifest's
// row count), each row's solid span is split into equal cells (one per manifest entry), each icon = the solid bbox inside its
// cell (+ its glow). Blob grouping was not used: on several sheets the icons' glows touch. A row-count mismatch stops the build.
// Sheets later in the list win when an item appears twice (the SET sheet draws the set pieces with a shared symbol).
// Usage: node tools/build-item-icons.js [--preview]   (--preview: a contact sheet in <os tmp>/eo-item-icons.png)
const fs = require('fs');
const os = require('os');
const path = require('path');
const png = require('./png.js');
const { removeBackground } = require('./build-monsters.js');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'desgin', 'ITEM', 'v1.0');
const OUT = path.join(ROOT, 'assets', 'icons', 'items');
const SIZE = 64;
const PAD = 0.06; // empty border around each icon (share of its size)

const SHEETS = [
  { file: 'AEGIS  GUARD  COUNTER ITEMS.png', rows: [
    ['core_ironheart', 'core_counter', 'core_vanguard', 'armor_fortress', 'armor_guardian', 'armor_risk'],
    ['charm_heavy', 'charm_guardian', 'rune_guarding_soul', 'rune_iron_will', 'rune_retribution', 'rune_provocation'],
  ] },
  { file: 'UMBRAL ITEMS.png', rows: [
    ['core_shadow_fang', 'core_nightglass', 'armor_duskweave'],
    ['relic_heart_eclipse', 'relic_bloodletter', 'rune_red_thirst'],
    ['rune_full_moon', 'rune_shadow_hunger', 'charm_assassin'],
  ] },
  { file: 'ASTRAL ITEMS.png', rows: [
    ['core_star_loom', 'core_fallen_constellation', 'armor_starveil', 'relic_orrery'],
    ['relic_spindle', 'rune_comet_tail', 'rune_supernova', 'charm_starfocus'],
  ] },
  { file: 'UNIVERSAL ITEMS.png', rows: [
    ['armor_pathfinder', 'relic_ember_war', 'rune_second_wind'],
    ['rune_executioner', 'rune_hunters_sigil', 'charm_wanderer'],
  ] },
  { file: 'image-483eb67d-129e-432e-a1d4-a7d3accbd0fe-0.png', rows: [ // boss signature items
    ['relic_oath_mirror', 'relic_last_bastion', 'relic_dawn_core', 'core_runeblade'],
    ['armor_amethyst_shell', 'relic_warden_prism', 'relic_cinder_crown'],
  ] },
  { file: 'Create a collection of SECRET  LEGACY item icons for ECLIPSE ONLINE..png', checker: true, rows: [ // opaque fake checkerboard
    ['duskfang_blade', 'crystalbreaker', 'shadeweave', 'eclipse_sigil', 'hunger_rune'],
    ['shade_charm', 'eclipse_relic', 'hunters_charm', 'guardian_heart', 'veil_stillness', 'umbral_band'],
  ] },
  { file: 'KEY.png', rows: [ // six takes on the dragon key: the round seal with the keyhole is used (owner may swap)
    [null, 'varkharon_seal', null],
    [null, null, null],
  ] },
  { file: '1. SET ITEMS IRON VIGIL ECLIPSE CONSTELLATION.png', rows: [ // last: the set pieces' matching versions win
    ['core_ironheart', 'armor_fortress', 'charm_heavy'],
    ['core_shadow_fang', 'relic_heart_eclipse', 'charm_assassin'],
    ['core_star_loom', 'armor_starveil', 'rune_supernova'],
  ] },
];

const SOLID = 120; // alpha that counts as the icon itself (glow below it is kept inside the icon's cell)
// row bands: y ranges with solid pixels, split where a run of >= GAP_Y empty lines appears; small bands (sparks) dropped
const GAP_Y = 6, MIN_BAND = 40;
function rowBands(img) {
  const { width: W, height: H, data } = img, cnt = new Int32Array(H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > SOLID) cnt[y]++;
  const bands = []; let y0 = -1, empty = 0;
  for (let y = 0; y <= H; y++) {
    const on = y < H && cnt[y] > 2;
    if (on) { if (y0 < 0) y0 = y; empty = 0; }
    else if (y0 >= 0 && (++empty >= GAP_Y || y === H)) { const y1 = y - empty + 1; if (y1 - y0 >= MIN_BAND) bands.push({ y0, y1 }); y0 = -1; empty = 0; }
  }
  return bands;
}
// a row's icons, first try: 2-D solid components inside the band (8 px cells, touching cells join); sparks join the nearest
// piece. Works when icons overlap in x (two diagonal swords) but not when they touch — then null.
function rowComponents(img, band, n) {
  const { width: W, data } = img, C = 8, cw = Math.ceil(W / C), y0 = band.y0, ch = Math.ceil((band.y1 - y0) / C);
  const occ = new Uint8Array(cw * ch);
  for (let y = y0; y < band.y1; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > SOLID) occ[(((y - y0) / C) | 0) * cw + ((x / C) | 0)] = 1;
  const lab = new Int32Array(cw * ch).fill(-1), comps = [];
  for (let s0 = 0; s0 < cw * ch; s0++) {
    if (!occ[s0] || lab[s0] >= 0) continue;
    const st = [s0], c = { x0: 1e9, y0: 1e9, x1: -1, y1: -1, n: 0 }; lab[s0] = comps.length;
    while (st.length) {
      const p = st.pop(), x = p % cw, y = (p / cw) | 0;
      c.n++; c.x0 = Math.min(c.x0, x); c.y0 = Math.min(c.y0, y); c.x1 = Math.max(c.x1, x); c.y1 = Math.max(c.y1, y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy, q = yy * cw + xx;
        if (xx >= 0 && yy >= 0 && xx < cw && yy < ch && occ[q] && lab[q] < 0) { lab[q] = lab[s0]; st.push(q); }
      }
    }
    comps.push(c);
  }
  const big = comps.filter((c) => c.n >= 40), small = comps.filter((c) => c.n < 40);
  if (big.length !== n) return null;
  const dist = (a, b) => Math.max(0, Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1)) + Math.max(0, Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1));
  for (const sp of small) { // a spark joins the nearest icon if it is close, else it is dropped
    let best = null, bd = 1e9;
    for (const b of big) { const d = dist(sp, b); if (d < bd) { bd = d; best = b; } }
    if (best && bd <= 4) { best.x0 = Math.min(best.x0, sp.x0); best.y0 = Math.min(best.y0, sp.y0); best.x1 = Math.max(best.x1, sp.x1); best.y1 = Math.max(best.y1, sp.y1); }
  }
  return big.sort((a, b) => (a.x0 + a.x1) - (b.x0 + b.x1)).map((c) => ({
    x0: Math.max(0, c.x0 * C - 4), y0: Math.max(0, y0 + c.y0 * C - 4), x1: Math.min(W, (c.x1 + 1) * C + 4), y1: Math.min(img.height, y0 + (c.y1 + 1) * C + 4),
  }));
}
// a row's icons, fallback: its solid x-span cut at the column gaps (or into n equal cells); icon = bbox of alpha > 40 in its cell
function rowCells(img, band, n) {
  const comp = rowComponents(img, band, n);
  if (comp) return comp;
  const { width: W, data } = img, colCnt = new Int32Array(W);
  for (let y = band.y0; y < band.y1; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > SOLID) colCnt[x]++;
  let x0 = 0, x1 = W - 1;
  while (x0 < W && colCnt[x0] < 2) x0++;
  while (x1 > 0 && colCnt[x1] < 2) x1--;
  // columns: solid x-runs split by empty columns; sparks (narrow runs) join their neighbour; the widest gaps are kept until
  // there are n columns. Falls back to n equal cells when the icons touch (no gaps at all).
  let segs = [];
  for (let x = x0, s0 = -1; x <= x1 + 1; x++) {
    const on = x <= x1 && colCnt[x] >= 2;
    if (on && s0 < 0) s0 = x;
    if (!on && s0 >= 0) { segs.push([s0, x]); s0 = -1; }
  }
  while (segs.length > n) { // merge across the smallest gap
    let k = 0, best = 1e9;
    for (let i = 0; i < segs.length - 1; i++) { const gap = segs[i + 1][0] - segs[i][1]; if (gap < best) { best = gap; k = i; } }
    segs.splice(k, 2, [segs[k][0], segs[k + 1][1]]);
  }
  const step = (x1 + 1 - x0) / n, cells = [];
  const bounds = segs.length === n
    ? segs.map(([a, b], i) => [i === 0 ? x0 : Math.round((segs[i - 1][1] + a) / 2), i === n - 1 ? x1 + 1 : Math.round((b + segs[i + 1][0]) / 2)])
    : Array.from({ length: n }, (_, i) => [Math.round(x0 + i * step), Math.round(x0 + (i + 1) * step)]);
  for (let i = 0; i < n; i++) {
    const [cx0, cx1] = bounds[i];
    let bx0 = 1e9, by0 = 1e9, bx1 = -1, by1 = -1;
    const ry0 = band.even ? band.y0 : Math.max(0, band.y0 - 20), ry1 = band.even ? band.y1 : Math.min(img.height, band.y1 + 20);
    for (let y = ry0; y < ry1; y++) for (let x = cx0; x < cx1; x++) {
      if (data[(y * W + x) * 4 + 3] > 40) { bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y); }
    }
    cells.push({ x0: bx0, y0: by0, x1: bx1 + 1, y1: by1 + 1 });
  }
  return cells;
}
function gridIcons(img, rows) {
  let bands = rowBands(img);
  // rows whose icons overlap in height (no empty line between them): split the solid height into equal rows instead
  if (bands.length !== rows.length && bands.length) {
    const y0 = bands[0].y0, y1 = bands[bands.length - 1].y1, h = (y1 - y0) / rows.length;
    bands = rows.map((_, i) => ({ y0: Math.round(y0 + i * h), y1: Math.round(y0 + (i + 1) * h), even: true }));
  }
  if (bands.length !== rows.length) return { error: `found ${bands.length} icon rows, the manifest lists ${rows.length}` };
  return { cells: rows.map((ids, r) => rowCells(img, bands[r], ids.length)) };
}

// checker sheets: light, grey (unsaturated) pixels on the OUTLINE are leftovers of the fake checkerboard -> peeled off,
// a few passes from the transparent side only (grey metal inside an icon is never touched)
function defringe(img, passes = 3) {
  const { width: W, height: H, data } = img;
  for (let pass = 0; pass < passes; pass++) {
    const kill = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] === 0) continue;
      const mx = Math.max(data[i], data[i + 1], data[i + 2]), mn = Math.min(data[i], data[i + 1], data[i + 2]);
      if (mn < 150 || mx - mn > 40) continue; // only light greys
      let edge = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H || data[((yy * W) + xx) * 4 + 3] === 0) { edge = true; break; } }
      if (edge) kill.push(i);
    }
    if (!kill.length) break;
    for (const i of kill) data[i + 3] = 0;
  }
}

// square crop of the icon's box, padded, centred
function cutIcon(img, b) {
  const w = b.x1 - b.x0, h = b.y1 - b.y0, side = Math.ceil(Math.max(w, h) * (1 + PAD * 2));
  const out = png.create(side, side), ox = Math.floor((side - w) / 2), oy = Math.floor((side - h) / 2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const si = ((b.y0 + y) * img.width + (b.x0 + x)) * 4, di = ((oy + y) * side + (ox + x)) * 4;
    for (let c = 0; c < 4; c++) out.data[di + c] = img.data[si + c];
  }
  return out;
}

// area-average downscale with premultiplied alpha (same as tools/build-icons.js: no dark fringe)
function shrink(img, S) {
  const out = png.create(S, S), k = img.width / S, kh = img.height / S;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const x0 = Math.floor(x * k), x1 = Math.max(x0 + 1, Math.floor((x + 1) * k)), y0 = Math.floor(y * kh), y1 = Math.max(y0 + 1, Math.floor((y + 1) * kh));
    let r = 0, g = 0, bl = 0, a = 0, n = 0;
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
      const i = (yy * img.width + xx) * 4, al = img.data[i + 3] / 255;
      r += img.data[i] * al; g += img.data[i + 1] * al; bl += img.data[i + 2] * al; a += al; n++;
    }
    const o = (y * S + x) * 4;
    if (a > 0) { out.data[o] = r / a; out.data[o + 1] = g / a; out.data[o + 2] = bl / a; }
    out.data[o + 3] = Math.round((a / n) * 255);
  }
  return out;
}

function main() {
  const preview = process.argv.includes('--preview');
  fs.mkdirSync(OUT, { recursive: true });
  const icons = {}; // id -> 64 px image (later sheets win)
  for (const sheet of SHEETS) {
    const file = path.join(SRC, sheet.file);
    if (!fs.existsSync(file)) { console.log('missing sheet (skipped):', sheet.file); continue; }
    const img = png.read(file);
    if (sheet.checker) { removeBackground(img, 40, 2); defringe(img); } // opaque light checkerboard -> transparent (eroded flood keeps pale art)
    const g = gridIcons(img, sheet.rows);
    if (g.error) throw new Error(`${sheet.file}: ${g.error}`);
    sheet.rows.forEach((ids, r) => ids.forEach((id, c) => { if (id) icons[id] = shrink(cutIcon(img, g.cells[r][c]), SIZE); }));
    console.log(sheet.file.slice(0, 48).padEnd(48), sheet.rows.map((x) => x.length).join('+'), 'icons');
  }
  const meta = {};
  for (const [id, im] of Object.entries(icons)) { png.write(path.join(OUT, id + '.png'), im); meta[id] = { file: 'assets/icons/items/' + id + '.png' }; }
  fs.writeFileSync(path.join(OUT, 'items.json'), JSON.stringify(meta, null, 1));
  console.log(Object.keys(meta).length, 'item icons ->', path.relative(ROOT, OUT));
  if (preview) { // contact sheet on a dark-grey backdrop (holes / leftovers are easy to see)
    const ids = Object.keys(icons).sort(), per = 10, cs = SIZE + 8, sheetImg = png.create(per * cs, Math.ceil(ids.length / per) * cs);
    for (let i = 0; i < sheetImg.data.length; i += 4) { sheetImg.data[i] = 46; sheetImg.data[i + 1] = 40; sheetImg.data[i + 2] = 60; sheetImg.data[i + 3] = 255; }
    ids.forEach((id, n) => {
      const im = icons[id], bx = (n % per) * cs + 4, by = ((n / per) | 0) * cs + 4;
      for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
        const si = (y * SIZE + x) * 4, di = ((by + y) * sheetImg.width + bx + x) * 4, a = im.data[si + 3] / 255;
        for (let c = 0; c < 3; c++) sheetImg.data[di + c] = Math.round(im.data[si + c] * a + sheetImg.data[di + c] * (1 - a));
      }
    });
    const out = path.join(os.tmpdir(), 'eo-item-icons.png');
    png.write(out, sheetImg);
    console.log('preview:', out, '(order = ids sorted A-Z:', ids.join(' '), ')');
  }
}

if (require.main === module) main();
module.exports = { SHEETS, rowBands, gridIcons };
