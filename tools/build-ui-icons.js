#!/usr/bin/env node
// UI v2 icons (owner's art, desgin/UI/*.png, transparent 1024-1254² sheets) -> assets/ui/icons/<name>.png + icons.json.
//   node tools/build-ui-icons.js [--preview]
// Each sheet = icons in reading order. Pieces are found as blobs of solid pixels (alpha > `solid`) on a 4× smaller mask,
// dilated by `join` cells so the parts of one icon (sparks, gems) join; blobs smaller than `min` cells are dropped. The
// expected count must match (else the tool stops: the art changed -> update NAMES). Each icon is cropped with `pad` and
// shrunk (area average, premultiplied alpha) to `size` (longest side), kept centred on a square canvas unless `keepAspect`.
const fs = require('fs');
const os = require('os');
const path = require('path');
const png = require('./png.js');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'desgin', 'UI');
const OUT = path.join(ROOT, 'assets', 'ui', 'icons');

const SHEETS = [
  { file: 'ไอคอนแท็บกระเป๋า — 6+ กลุ่ม.png', prefix: 'tab_', solid: 25, names: ['all', 'weapon', 'armor', 'relic', 'charm', 'rune', 'material', 'consumable'] },
  { file: 'ไอคอนเมนูบน — 8 อัน.png', prefix: 'menu_', solid: 170, join: 2, names: ['equipment', 'skills', 'class', 'codex', 'quests', 'map', 'settings', 'save'] },
  { file: 'ไอคอน Final Stats — ประมาณ 14 อัน.png', prefix: 'stat_', solid: 25,
    names: ['hp', 'attack', 'defense', 'speed', 'crit', 'critDmg', 'attackSpeed', 'cdr', 'resource', 'guard', 'barrier', 'counter', 'magic', 'damageReduction'] },
  { file: 'ไอคอนช่อง Loadout ที่ยังว่าง.png', prefix: 'empty_', solid: 60, names: ['weapon', 'armor', 'relic', 'charm', 'rune'] },
  { file: 'ไอคอนบริการ NPC.png', prefix: 'npc_', solid: 200, join: 1, names: ['shop', 'smith', 'storage', 'waystone', 'guild'] },
  { file: 'ไอคอนสกุลเงิน.png', prefix: 'cur_', solid: 120, names: ['gold', 'crystal', 'token'] },
  { file: 'กรอบเลเวลทรงเพชร.png', prefix: '', solid: 120, size: 128, names: ['level_diamond'] },
  { file: 'แท่นยืนตัวละคร.png', prefix: '', solid: 120, size: 320, keepAspect: true, names: ['pedestal'] },
];
const CELL = 4;

function blobs(img, { solid, join = 3, min = 20 }) {
  const W = Math.ceil(img.width / CELL), H = Math.ceil(img.height / CELL), m = new Uint8Array(W * H);
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if (img.data[(y * img.width + x) * 4 + 3] > solid) m[((y / CELL) | 0) * W + ((x / CELL) | 0)] = 1;
  const d = new Uint8Array(W * H); // dilate
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m[y * W + x]) {
    for (let yy = Math.max(0, y - join); yy <= Math.min(H - 1, y + join); yy++) for (let xx = Math.max(0, x - join); xx <= Math.min(W - 1, x + join); xx++) d[yy * W + xx] = 1;
  }
  const seen = new Int32Array(W * H).fill(-1), out = [];
  for (let s = 0; s < W * H; s++) if (d[s] && seen[s] < 0) {
    const st = [s]; seen[s] = out.length; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0;
    while (st.length) {
      const c = st.pop(), cx = c % W, cy = (c / W) | 0; n++;
      if (m[c]) { x0 = Math.min(x0, cx); y0 = Math.min(y0, cy); x1 = Math.max(x1, cx); y1 = Math.max(y1, cy); }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy, k = ny * W + nx;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && d[k] && seen[k] < 0) { seen[k] = out.length; st.push(k); }
      }
    }
    if (n >= min && x1 >= 0) out.push({ x0: x0 * CELL, y0: y0 * CELL, x1: Math.min(img.width, (x1 + 1) * CELL), y1: Math.min(img.height, (y1 + 1) * CELL) });
  }
  // reading order: rows = blobs whose vertical centres are within half an icon height
  out.sort((a, b) => (a.y0 + a.y1) - (b.y0 + b.y1));
  const rows = [];
  for (const b of out) {
    const cy = (b.y0 + b.y1) / 2, row = rows.find((r) => Math.abs(r.cy - cy) < (b.y1 - b.y0) * 0.6);
    if (row) row.items.push(b); else rows.push({ cy, items: [b] });
  }
  return rows.flatMap((r) => r.items.sort((a, b) => a.x0 - b.x0));
}

// crop the box (+pad, so soft glow is kept) into a canvas: square (centred) or the box's own aspect
function cut(img, b, pad, keepAspect) {
  const x0 = Math.max(0, b.x0 - pad), y0 = Math.max(0, b.y0 - pad), x1 = Math.min(img.width, b.x1 + pad), y1 = Math.min(img.height, b.y1 + pad);
  const w = x1 - x0, h = y1 - y0, W = keepAspect ? w : Math.max(w, h), H = keepAspect ? h : Math.max(w, h);
  const out = png.create(W, H), ox = (W - w) >> 1, oy = (H - h) >> 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const si = ((y0 + y) * img.width + x0 + x) * 4, di = ((oy + y) * W + ox + x) * 4;
    for (let c = 0; c < 4; c++) out.data[di + c] = img.data[si + c];
  }
  return out;
}

// area-average downscale, premultiplied alpha (no dark fringe); longest side -> S
function shrink(img, S) {
  const k = Math.max(img.width, img.height) / S, W = Math.max(1, Math.round(img.width / k)), H = Math.max(1, Math.round(img.height / k));
  const out = png.create(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const xa = Math.floor(x * k), xb = Math.max(xa + 1, Math.min(img.width, Math.floor((x + 1) * k))), ya = Math.floor(y * k), yb = Math.max(ya + 1, Math.min(img.height, Math.floor((y + 1) * k)));
    let r = 0, g = 0, bl = 0, a = 0, n = 0;
    for (let yy = ya; yy < yb; yy++) for (let xx = xa; xx < xb; xx++) {
      const i = (yy * img.width + xx) * 4, al = img.data[i + 3] / 255;
      r += img.data[i] * al; g += img.data[i + 1] * al; bl += img.data[i + 2] * al; a += al; n++;
    }
    const o = (y * W + x) * 4;
    if (a > 0) { out.data[o] = r / a; out.data[o + 1] = g / a; out.data[o + 2] = bl / a; }
    out.data[o + 3] = Math.round((a / n) * 255);
  }
  return out;
}

// line icons are drawn faint (pale grey, part-transparent): make the line colour pure white, alpha stretched so the
// strongest pixel is opaque -> the UI tints / dims them with CSS opacity
function boostLine(img) {
  let max = 1;
  for (let i = 3; i < img.data.length; i += 4) max = Math.max(max, img.data[i]);
  for (let i = 0; i < img.data.length; i += 4) {
    const lum = (img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3;
    img.data[i + 3] = Math.min(255, Math.round(img.data[i + 3] * (255 / max) * (0.55 + 0.45 * lum / 255) * 1.25));
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
  }
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const meta = {}, made = [];
  for (const s of SHEETS) {
    const file = path.join(SRC, s.file);
    if (!fs.existsSync(file)) { console.log('missing sheet (skipped):', s.file); continue; }
    const img = png.read(file), found = blobs(img, s);
    if (found.length !== s.names.length) throw new Error(`${s.file}: found ${found.length} icons, expected ${s.names.length}`);
    const size = s.size || 64, line = !s.size && s.prefix !== 'cur_';
    found.forEach((b, i) => {
      let im = shrink(cut(img, b, s.pad ?? Math.round((b.x1 - b.x0) * 0.08), s.keepAspect), size);
      if (line) boostLine(im);
      const name = s.prefix + s.names[i];
      png.write(path.join(OUT, name + '.png'), im);
      meta[name] = { file: 'assets/ui/icons/' + name + '.png', w: im.width, h: im.height };
      made.push([name, im]);
    });
    console.log(s.file.padEnd(40), found.length, 'icons');
  }
  fs.writeFileSync(path.join(OUT, 'icons.json'), JSON.stringify(meta, null, 1));
  console.log(made.length, 'UI icons ->', path.relative(ROOT, OUT));
  if (process.argv.includes('--preview')) { // contact sheet on a dark backdrop
    const cs = 72, per = 10, small = made.filter(([, im]) => im.width <= 64), sheet = png.create(per * cs, Math.ceil(small.length / per) * cs);
    for (let i = 0; i < sheet.data.length; i += 4) { sheet.data[i] = 30; sheet.data[i + 1] = 28; sheet.data[i + 2] = 36; sheet.data[i + 3] = 255; }
    small.forEach(([, im], n) => {
      const bx = (n % per) * cs + 4, by = ((n / per) | 0) * cs + 4;
      for (let y = 0; y < im.height; y++) for (let x = 0; x < im.width; x++) {
        const si = (y * im.width + x) * 4, di = ((by + y) * sheet.width + bx + x) * 4, a = im.data[si + 3] / 255;
        for (let c = 0; c < 3; c++) sheet.data[di + c] = Math.round(im.data[si + c] * a + sheet.data[di + c] * (1 - a));
      }
    });
    const out = path.join(os.tmpdir(), 'eo-ui-icons.png');
    png.write(out, sheet);
    console.log('preview:', out, small.map(([n]) => n).join(' '));
  }
}

if (require.main === module) main();
module.exports = { SHEETS, blobs };
