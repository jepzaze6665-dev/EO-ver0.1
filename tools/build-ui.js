// Builds the UI kit (desgin/UI/*.png, AI sheets on a black or transparent background) into cut-out pieces:
//   assets/ui/<piece>.png + assets/ui/ui.json  { piece: { file, w, h, slice? } }
// Steps per sheet: remove the background (flood fill from the chosen image edges over near-background pixels, then a
// soft alpha fringe so glows fade instead of ending in a black halo) -> find the separate pieces (blobs, reading
// order: top-to-bottom rows, left-to-right) -> crop, scale, save under the names below.
// `slice` = border size (px, after scaling) for CSS border-image / 9-slice drawing of frames that must stretch.
// Usage: node tools/build-ui.js
const fs = require('fs');
const path = require('path');
const png = require('./png.js');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'desgin', 'UI');
const OUT = path.join(ROOT, 'assets', 'ui');
fs.mkdirSync(OUT, { recursive: true });

// names = pieces in reading order; seed = which image edges the background flood starts from
const SHEETS = {
  // pixel-art plate (buttons, name plates, small info boxes) — stretches between its end caps
  plate: { scale: 0.5, names: ['plate'], slice: 120 },
  // pixel-art window frame: 4 corners + 4 edges laid out as a frame (named by their 3×3 place, no centre piece);
  // `whole` also saves the complete frame (for CSS border-image / 9-slice drawing)
  frame_kit: {
    scale: 0.5, grid3: true, grow: 0, whole: { name: 'frame', slice: 130 }, // pieces sit a few px apart: no merging
    names: ['frame_corner_tl', 'frame_edge_top', 'frame_corner_tr', 'frame_edge_left', 'frame_edge_right', 'frame_corner_bl', 'frame_edge_bottom', 'frame_corner_br'],
  },
  // skill slot (transparent sheet): the other states are generated from it (see VARIANTS) — one art, four states
  slot_frame: { scale: 0.25, names: ['slot_normal'], variants: { slot_hover: 'glow', slot_pressed: 'dark', slot_disabled: 'grey' } },
  // long bar frame (HP / stamina / boss): the inner slot is see-through; the bar is drawn behind it
  bar_frame: { scale: 0.5, names: ['bar_frame'], slice: 190 },
  // shadow crystal (Shadow Mark / emblem): its loose shards belong to it — merge them into one piece
  crystal: { scale: 0.25, names: ['crystal'], grow: 12, largest: true },
};

// generated state variants (pure pixel maths on the cut piece)
const VARIANTS = {
  glow: (r, g, b) => [Math.min(255, r * 1.25 + 18), Math.min(255, g * 1.1 + 6), Math.min(255, b * 1.35 + 30)],
  dark: (r, g, b) => [r * 0.7, g * 0.7, b * 0.75],
  grey: (r, g, b) => { const l = (r * 0.3 + g * 0.59 + b * 0.11) * 0.8; return [l, l, l * 1.05]; },
};
function variant(img, kind) {
  const out = png.create(img.width, img.height), fn = VARIANTS[kind];
  for (let i = 0; i < img.data.length; i += 4) {
    const [r, g, b] = fn(img.data[i], img.data[i + 1], img.data[i + 2]);
    out.data[i] = r; out.data[i + 1] = g; out.data[i + 2] = b; out.data[i + 3] = img.data[i + 3];
  }
  return out;
}
const BG_MAX = 24;     // "background" = every channel below this (black sheets) …
const FRINGE = 56;     // … and pixels next to the background darker than this fade out (soft edge)
const CELL = 4, GROW = 1, MIN_CELLS = 60; // blob search grid (px), merge distance (cells), ignore sparks

function removeBackground(img, cfg) {
  const { width: w, height: h, data } = img;
  let clear = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 10) clear++;
  if (clear > w * h * 0.2) return 'had alpha'; // already transparent (e.g. skill_slot)
  const key = [data[0], data[1], data[2]], tol = cfg.keyTol || 0;
  const isBg = (i) => tol ? Math.abs(data[i] - key[0]) + Math.abs(data[i + 1] - key[1]) + Math.abs(data[i + 2] - key[2]) < tol * 3
    : data[i] < BG_MAX && data[i + 1] < BG_MAX && data[i + 2] < BG_MAX;
  const seen = new Uint8Array(w * h), stack = [];
  const seed = cfg.seed || ['top', 'bottom', 'left', 'right'];
  const push = (x, y) => { const p = y * w + x; if (!seen[p] && isBg(p * 4)) { seen[p] = 1; stack.push(p); } };
  for (let x = 0; x < w; x++) { if (seed.includes('top')) push(x, 0); if (seed.includes('bottom')) push(x, h - 1); }
  for (let y = 0; y < h; y++) { if (seed.includes('left')) push(0, y); if (seed.includes('right')) push(w - 1, y); }
  for (const [hx, hy] of cfg.holes || []) push(Math.round(hx * (w - 1)), Math.round(hy * (h - 1))); // enclosed holes (sheet fractions)
  while (stack.length) {
    const p = stack.pop(), x = p % w, y = (p / w) | 0;
    data[p * 4 + 3] = 0;
    if (x > 0) push(x - 1, y); if (x < w - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < h - 1) push(x, y + 1);
  }
  // soft fringe: dark pixels touching the cleared background fade by brightness (glows keep their colour)
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const p = y * w + x, i = p * 4;
      if (data[i + 3] === 0) continue;
      if (data[i - 1] && data[i + 7] && data[i - w * 4 + 3] && data[i + w * 4 + 3]) continue; // no cleared neighbour
      const m = Math.max(data[i], data[i + 1], data[i + 2]);
      if (m < FRINGE) data[i + 3] = Math.min(data[i + 3], Math.round((m / FRINGE) * 255));
    }
  }
  return 'keyed';
}

// separate pieces: occupied grid cells, grown so a piece's glow / sparks stay with it, then connected groups
function findBlobs(img, grow = GROW) {
  const { width: w, height: h, data } = img, gw = Math.ceil(w / CELL), gh = Math.ceil(h / CELL);
  const occ = new Uint8Array(gw * gh);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > 24) occ[((y / CELL) | 0) * gw + ((x / CELL) | 0)] = 1;
  const grown = new Uint8Array(gw * gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) if (occ[y * gw + x]) {
    for (let dy = -grow; dy <= grow; dy++) for (let dx = -grow; dx <= grow; dx++) {
      const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < gw && ny < gh) grown[ny * gw + nx] = 1;
    }
  }
  const label = new Int32Array(gw * gh).fill(-1), blobs = [];
  for (let s = 0; s < gw * gh; s++) {
    if (!grown[s] || label[s] >= 0) continue;
    const b = { x0: 1e9, y0: 1e9, x1: -1, y1: -1, cells: 0 }, st = [s]; label[s] = blobs.length;
    while (st.length) {
      const c = st.pop(), cx = c % gw, cy = (c / gw) | 0;
      if (occ[c]) { b.cells++; b.x0 = Math.min(b.x0, cx); b.y0 = Math.min(b.y0, cy); b.x1 = Math.max(b.x1, cx); b.y1 = Math.max(b.y1, cy); }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy, n = ny * gw + nx;
        if (nx >= 0 && ny >= 0 && nx < gw && ny < gh && grown[n] && label[n] < 0) { label[n] = blobs.length; st.push(n); }
      }
    }
    blobs.push(b);
  }
  const px = blobs.filter((b) => b.cells >= MIN_CELLS).map((b) => ({ x: b.x0 * CELL, y: b.y0 * CELL, w: Math.min(w, (b.x1 + 1) * CELL) - b.x0 * CELL, h: Math.min(h, (b.y1 + 1) * CELL) - b.y0 * CELL }));
  // reading order: rows of pieces whose vertical spans overlap, each row left to right
  px.sort((a, b) => a.y - b.y);
  const rows = [];
  for (const b of px) {
    const row = rows.find((r) => b.y < r.y1 - 8 && b.y + b.h > r.y0 + 8);
    if (row) { row.items.push(b); row.y0 = Math.min(row.y0, b.y); row.y1 = Math.max(row.y1, b.y + b.h); } else rows.push({ y0: b.y, y1: b.y + b.h, items: [b] });
  }
  return rows.flatMap((r) => r.items.sort((a, b) => a.x - b.x));
}

function crop(img, r, scale) {
  const ow = Math.max(1, Math.round(r.w * scale)), oh = Math.max(1, Math.round(r.h * scale)), out = png.create(ow, oh);
  // box filter downscale (premultiplied, so transparent pixels never darken the edges)
  for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
    const sx0 = r.x + x / scale, sy0 = r.y + y / scale, sx1 = r.x + (x + 1) / scale, sy1 = r.y + (y + 1) / scale;
    let R = 0, G = 0, B = 0, A = 0, n = 0;
    for (let sy = Math.floor(sy0); sy < Math.ceil(sy1); sy++) for (let sx = Math.floor(sx0); sx < Math.ceil(sx1); sx++) {
      const i = (sy * img.width + sx) * 4, a = img.data[i + 3];
      R += img.data[i] * a; G += img.data[i + 1] * a; B += img.data[i + 2] * a; A += a; n++;
    }
    const o = (y * ow + x) * 4;
    if (A) { out.data[o] = R / A; out.data[o + 1] = G / A; out.data[o + 2] = B / A; out.data[o + 3] = A / n; }
  }
  return out;
}

const atlas = {};
let problems = 0;
for (const [sheet, cfg] of Object.entries(SHEETS)) {
  const file = path.join(SRC, sheet + '.png');
  if (!fs.existsSync(file)) { console.log(`✗ ${sheet}: missing ${path.relative(ROOT, file)}`); problems++; continue; }
  const img = png.read(file);
  const bg = removeBackground(img, cfg);
  let blobs = findBlobs(img, cfg.grow);
  if (cfg.largest) blobs = [blobs.sort((a, b) => b.w * b.h - a.w * a.h)[0]];
  if (cfg.grid3) { // order = 3×3 cell of each piece's centre (TL, T, TR, L, C, R, BL, B, BR)
    const cell = (b) => Math.min(2, Math.floor(((b.y + b.h / 2) / img.height) * 3)) * 3 + Math.min(2, Math.floor(((b.x + b.w / 2) / img.width) * 3));
    blobs = blobs.sort((a, b) => cell(a) - cell(b));
  }
  const ok = blobs.length === cfg.names.length;
  if (!ok) problems++;
  console.log(`${ok ? '✓' : '✗'} ${sheet} (${img.width}x${img.height}, ${bg}): ${blobs.length} pieces, expected ${cfg.names.length}`);
  if (cfg.whole) { // the complete sheet content as one piece too (bounding box of every piece)
    const x0 = Math.min(...blobs.map((b) => b.x)), y0 = Math.min(...blobs.map((b) => b.y));
    const r = { x: x0, y: y0, w: Math.max(...blobs.map((b) => b.x + b.w)) - x0, h: Math.max(...blobs.map((b) => b.y + b.h)) - y0 };
    const out = crop(img, r, cfg.scale), name = cfg.whole.name;
    png.write(path.join(OUT, name + '.png'), out);
    atlas[name] = { file: `assets/ui/${name}.png`, w: out.width, h: out.height, slice: Math.round(cfg.whole.slice * cfg.scale) };
    console.log(`    ${name.padEnd(18)} ${out.width}x${out.height}  slice ${atlas[name].slice} (whole)`);
  }
  blobs.slice(0, cfg.names.length).forEach((b, i) => {
    const name = cfg.names[i], out = crop(img, b, cfg.scale);
    png.write(path.join(OUT, name + '.png'), out);
    const slice = typeof cfg.slice === 'number' ? Math.round(cfg.slice * cfg.scale) : cfg.slice && cfg.slice[name] ? Math.round(cfg.slice[name] * cfg.scale) : undefined;
    atlas[name] = { file: `assets/ui/${name}.png`, w: out.width, h: out.height, ...(slice ? { slice } : {}) };
    if (i === 0) for (const [vn, kind] of Object.entries(cfg.variants || {})) {
      png.write(path.join(OUT, vn + '.png'), variant(out, kind));
      atlas[vn] = { file: `assets/ui/${vn}.png`, w: out.width, h: out.height };
      console.log(`    ${vn.padEnd(18)} ${out.width}x${out.height}  (${kind} of ${name})`);
    }
    console.log(`    ${name.padEnd(18)} ${out.width}x${out.height}${slice ? `  slice ${slice}` : ''}`);
  });
}
fs.writeFileSync(path.join(OUT, 'ui.json'), JSON.stringify(atlas, null, 1));
console.log(problems ? `\n${problems} sheet(s) need attention` : `\nUI kit built: ${Object.keys(atlas).length} pieces -> assets/ui/`);
process.exit(problems ? 1 : 0);
