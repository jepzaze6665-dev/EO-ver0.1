// Builds the NPC sprites from the owner's GPT sheets (desgin/NPC/*.png, black background, prompts in docs/npc/NPC_PROMPTS.md):
//   assets/npcs/<art id>.png (one strip of 6 cells) + assets/npcs/npcs.json { id: { file, cw, ch, ax, ay, frames } }
// Strip order (FRAMES): front, back, left, right, walk1, walk2 (walk = toward the camera).
// Sheet layout = one character per row; SHEETS names the art ids per row (null = not used) and which source column is
// which frame (`pick`). Rows / columns are found as bands of solid pixels split by empty gaps; small loose pieces
// (sparks, a hanging lantern) join the nearest column. Background = black flood-filled from the edges (only through
// pixels whose 2-px neighbourhood is all black, so the dark outlines survive). Each sheet is scaled so its average
// front-pose height becomes TARGET px (the player is ~58).
// Usage: node tools/build-npcs.js [--preview]
const fs = require('fs');
const os = require('os');
const path = require('path');
const png = require('./png.js');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'desgin', 'NPC');
const OUT = path.join(ROOT, 'assets', 'npcs');
const TARGET = 60;
const FRAMES = ['front', 'back', 'left', 'right', 'walk1', 'walk2'];
const STD = [0, 1, 2, 3, 4, 5]; // source column per FRAMES entry

const SHEETS = [
  { file: 'image-d5a149ab-c391-4dc2-b59a-28d8d310d647-0.png', rows: ['aldric', 'maren', 'borin'] },
  { file: 'image-865cdf86-de45-4f39-9e21-59f058765d38-0.png', rows: ['kael', 'wren', 'pilgrim'] },
  { file: 'image-9ababaa3-042f-43a5-8a4d-a2bc3f8ea70d-0.png', rows: ['seraphine', 'odo', 'hilde'] },
  { file: 'image-a1da1ef6-3344-4aa8-9a47-31e40b7757c6-0.png', rows: ['callum', 'imre', 'marrow'] },
  // waystone keeper: 4 direction rows × 8 poses (front, right, back, left) -> one character
  { file: 'image-b78139fa-49da-431a-94f7-999f50442342-0.png', single: 'keeper', cols: 8,
    pick: { front: [0, 0], back: [2, 0], left: [3, 0], right: [1, 0], walk1: [0, 2], walk2: [0, 5] } },
];

// characters whose 3rd column faces RIGHT (GPT mixed the two side poses): their left / right are exchanged
const SWAP_SIDES = new Set(['aldric', 'borin', 'kael', 'wren', 'seraphine', 'odo', 'hilde']);

const SOLID = 40; // alpha that counts as content for the grid search
const dark = (d, i) => Math.max(d[i], d[i + 1], d[i + 2]) < 22;

function clearBlack(img, erode = 2) {
  const { width: w, height: h, data } = img;
  const blk = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) blk[p] = dark(data, p * 4) ? 1 : 0;
  const core = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let all = 1;
    for (let dy = -erode; dy <= erode && all; dy++) for (let dx = -erode; dx <= erode; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      if (!blk[yy * w + xx]) { all = 0; break; }
    }
    core[y * w + x] = all;
  }
  const bg = new Uint8Array(w * h), st = [];
  for (let x = 0; x < w; x++) { st.push(x, (h - 1) * w + x); }
  for (let y = 0; y < h; y++) { st.push(y * w, y * w + w - 1); }
  while (st.length) {
    const p = st.pop();
    if (bg[p] || !core[p]) continue;
    bg[p] = 1;
    const x = p % w, y = (p / w) | 0;
    if (x > 0) st.push(p - 1); if (x < w - 1) st.push(p + 1);
    if (y > 0) st.push(p - w); if (y < h - 1) st.push(p + w);
  }
  // widen back over the eroded rim, but only across black pixels
  for (let pass = 0; pass < erode + 1; pass++) {
    const add = [];
    for (let p = 0; p < w * h; p++) {
      if (bg[p] || !blk[p]) continue;
      const x = p % w, y = (p / w) | 0;
      if ((x > 0 && bg[p - 1]) || (x < w - 1 && bg[p + 1]) || (y > 0 && bg[p - w]) || (y < h - 1 && bg[p + w])) add.push(p);
    }
    for (const p of add) bg[p] = 1;
  }
  for (let p = 0; p < w * h; p++) if (bg[p]) data[p * 4 + 3] = 0;
}

// spans of index i where has(i), split by >= gap empty; spans shorter than min dropped
function spans(n, has, gap, min) {
  const out = []; let s = -1, last = -1;
  for (let i = 0; i < n; i++) {
    if (!has(i)) continue;
    if (s < 0) s = i; else if (i - last > gap) { out.push([s, last]); s = i; }
    last = i;
  }
  if (s >= 0) out.push([s, last]);
  return out.filter(([a, b]) => b - a + 1 >= min);
}

function grid(img, rowsWanted, colsWanted) {
  const { width: w, height: h, data } = img;
  const a = (x, y) => data[(y * w + x) * 4 + 3] > SOLID;
  const rowHas = (y) => { for (let x = 0; x < w; x++) if (a(x, y)) return true; return false; };
  let rows = spans(h, rowHas, 25, 30);
  if (rows.length !== rowsWanted) throw new Error(`found ${rows.length} rows, expected ${rowsWanted}`);
  return rows.map(([y0, y1]) => {
    const colHas = (x) => { for (let y = y0; y <= y1; y++) if (a(x, y)) return true; return false; };
    let cols = spans(w, colHas, 6, 1);
    // merge the narrow pieces (sparks, lanterns) into the nearest wide column until the count matches
    while (cols.length > colsWanted) {
      let k = 0;
      for (let i = 1; i < cols.length; i++) if (cols[i][1] - cols[i][0] < cols[k][1] - cols[k][0]) k = i;
      const [s, e] = cols[k];
      const left = k > 0 ? s - cols[k - 1][1] : Infinity, right = k < cols.length - 1 ? cols[k + 1][0] - e : Infinity;
      const j = left <= right ? k - 1 : k + 1;
      cols[j] = [Math.min(cols[j][0], s), Math.max(cols[j][1], e)];
      cols.splice(k, 1);
    }
    if (cols.length !== colsWanted) throw new Error(`row ${y0}: found ${cols.length} columns, expected ${colsWanted}`);
    return cols.map(([x0, x1]) => {
      let t = y1, b = y0;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (a(x, y)) { if (y < t) t = y; if (y > b) b = y; }
      return { x0, x1, y0: t, y1: b };
    });
  });
}

// area-average downscale of a box of the sheet
function cut(img, box, s) {
  const sw = box.x1 - box.x0 + 1, sh = box.y1 - box.y0 + 1;
  const W = Math.max(1, Math.round(sw * s)), H = Math.max(1, Math.round(sh * s));
  const out = png.create(W, H), d = img.data, o = out.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const fx0 = box.x0 + x / s, fx1 = box.x0 + (x + 1) / s, fy0 = box.y0 + y / s, fy1 = box.y0 + (y + 1) / s;
    let r = 0, g = 0, b = 0, al = 0, n = 0;
    for (let yy = Math.floor(fy0); yy < Math.ceil(fy1); yy++) for (let xx = Math.floor(fx0); xx < Math.ceil(fx1); xx++) {
      const i = (yy * img.width + xx) * 4, A = d[i + 3];
      r += d[i] * A; g += d[i + 1] * A; b += d[i + 2] * A; al += A; n++;
    }
    const i = (y * W + x) * 4;
    if (al > 0) { o[i] = r / al; o[i + 1] = g / al; o[i + 2] = b / al; }
    o[i + 3] = n ? al / n : 0;
  }
  return out;
}

function build(preview) {
  fs.mkdirSync(OUT, { recursive: true });
  const meta = {}, previews = [];
  for (const sheet of SHEETS) {
    const img = png.read(path.join(SRC, sheet.file));
    clearBlack(img);
    const chars = sheet.single
      ? [{ id: sheet.single, cells: grid(img, 4, sheet.cols), pick: sheet.pick }]
      : grid(img, sheet.rows.length, 6).map((cells, r) => ({ id: sheet.rows[r], cells: [cells] }));
    const boxOf = (c, f, k) => {
      if (c.pick) return c.cells[c.pick[f][0]][c.pick[f][1]];
      const col = SWAP_SIDES.has(c.id) && (k === 2 || k === 3) ? 5 - k : STD[k];
      return c.cells[0][col];
    };
    const fronts = chars.map((c) => { const b = boxOf(c, 'front', 0); return b.y1 - b.y0 + 1; });
    const s = TARGET / (fronts.reduce((a, b) => a + b, 0) / fronts.length);
    for (const c of chars) {
      if (!c.id) continue;
      const frames = FRAMES.map((f, k) => {
        const box = boxOf(c, f, k);
        return { img: cut(img, box, s), box };
      });
      // shared cell: feet (box bottom) on one line, horizontal centre of the box = the pivot
      const cw = Math.max(...frames.map((f) => f.img.width)) + 4, ch = Math.max(...frames.map((f) => f.img.height)) + 2;
      const strip = png.create(cw * FRAMES.length, ch);
      frames.forEach((f, k) => {
        const ox = k * cw + Math.floor((cw - f.img.width) / 2), oy = ch - 1 - f.img.height;
        for (let y = 0; y < f.img.height; y++) for (let x = 0; x < f.img.width; x++) {
          const si = (y * f.img.width + x) * 4, di = ((oy + y) * strip.width + ox + x) * 4;
          for (let q = 0; q < 4; q++) strip.data[di + q] = f.img.data[si + q];
        }
      });
      png.write(path.join(OUT, c.id + '.png'), strip);
      meta[c.id] = { file: 'assets/npcs/' + c.id + '.png', cw, ch, ax: Math.floor(cw / 2), ay: ch - 1, frames: FRAMES };
      previews.push(strip);
      console.log(`${c.id}: cell ${cw}×${ch}`);
    }
  }
  fs.writeFileSync(path.join(OUT, 'npcs.json'), JSON.stringify(meta, null, 1) + '\n');
  if (preview) {
    const W = Math.max(...previews.map((p) => p.width)), H = previews.reduce((a, p) => a + p.height + 4, 0);
    const pv = png.create(W, H);
    for (let i = 0; i < W * H; i++) { pv.data[i * 4] = 255; pv.data[i * 4 + 2] = 255; pv.data[i * 4 + 3] = 255; }
    let y0 = 0;
    for (const p of previews) {
      for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) {
        const si = (y * p.width + x) * 4, di = ((y0 + y) * W + x) * 4, A = p.data[si + 3] / 255;
        for (let q = 0; q < 3; q++) pv.data[di + q] = pv.data[di + q] * (1 - A) + p.data[si + q] * A;
      }
      y0 += p.height + 4;
    }
    const f = path.join(os.tmpdir(), 'eo-npcs.png');
    png.write(f, pv); console.log('preview', f);
  }
}

build(process.argv.includes('--preview'));
