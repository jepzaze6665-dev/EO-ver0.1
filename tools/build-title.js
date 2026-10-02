#!/usr/bin/env node
// TITLE ART (owner's art, desgin/UI/title/): background + logo + eclipse emblem -> assets/ui/title/
//   node tools/build-title.js
// bg.png      = the background as painted (copied)
// logo.png    = the logo with its black background removed, cropped to the art
// emblem.png  = the eclipse emblem, background removed, cropped; icon.png = 64 px of it (favicon / game icon)
// Background removal: black pixels CONNECTED TO THE IMAGE EDGE are the background (the eclipse disc inside the art is dark
// too but enclosed, so it stays solid); pixels near that background get a soft alpha from their brightness (the glow fades
// out instead of ending in a black rim) and their colour is un-premultiplied.
const fs = require('fs');
const path = require('path');
const png = require('./png.js');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'desgin', 'UI', 'title');
const OUT = path.join(ROOT, 'assets', 'ui', 'title');
// source files (the owner's names); first match wins
const FILES = {
  bg: ['bg.png', 'ภาพพื้นหลัง.png'],
  logo: ['logo.png', 'image-6626a46e-4c55-4fcd-9bc4-721ecef25bfe-0.png'],
  emblem: ['emblem.png', 'image-4bc1099c-2cf9-4bdf-96b7-b0b7998c3ded-0.png'],
};
// defaults: background threshold (max channel), soft edge reach (px), brightness scale of the soft edge, and HOLE = enclosed
// dark regions smaller than this share of the image are letter holes -> background (0 = keep every enclosed region)
const CUT = { bg: 26, soft: 6, softLum: 90, hole: 0.01 };

const find = (names) => names.map((n) => path.join(SRC, n)).find((f) => fs.existsSync(f));

function cutBlack(img, o = {}) {
  const { bg: BG, soft: SOFT, softLum: SOFT_LUM, hole: HOLE, erode: R = 0 } = { ...CUT, ...o };
  const { width: W, height: H, data: d } = img, N = W * H, bg = new Uint8Array(N), mx = (i) => Math.max(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
  // ERODE (dark costumes): the flood may only travel through CORE background = every pixel within R is dark too, so it cannot
  // seep through a thin dark gap into black clothes; afterwards it widens back R px into dark pixels next to it
  const dark = new Uint8Array(N);
  for (let i = 0; i < N; i++) dark[i] = mx(i) <= BG ? 1 : 0;
  let pass = dark;
  if (R > 0) {
    const rowOk = new Uint8Array(N); // horizontal run check, then vertical
    for (let y = 0; y < H; y++) { let run = 0; for (let x = 0; x < W; x++) { run = dark[y * W + x] ? run + 1 : 0; rowOk[y * W + x] = run; } }
    const h = new Uint8Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const xe = Math.min(W - 1, x + R); h[y * W + x] = rowOk[y * W + xe] >= xe - Math.max(0, x - R) + 1 ? 1 : 0; }
    pass = new Uint8Array(N);
    for (let x = 0; x < W; x++) { let run = 0; const col = new Uint16Array(H); for (let y = 0; y < H; y++) { run = h[y * W + x] ? run + 1 : 0; col[y] = run; }
      for (let y = 0; y < H; y++) { const ye = Math.min(H - 1, y + R); pass[y * W + x] = col[ye] >= ye - Math.max(0, y - R) + 1 ? 1 : 0; } }
  }
  const st = [];
  for (let x = 0; x < W; x++) st.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) st.push(y * W, y * W + W - 1);
  while (st.length) {
    const i = st.pop();
    if (bg[i] || !pass[i]) continue;
    bg[i] = 1;
    const x = i % W, y = (i / W) | 0;
    if (x > 0) st.push(i - 1); if (x < W - 1) st.push(i + 1); if (y > 0) st.push(i - W); if (y < H - 1) st.push(i + W);
  }
  for (let k = 0; k < R; k++) { // widen back into dark pixels touching the background
    const add = [];
    for (let i = 0; i < N; i++) if (!bg[i] && dark[i]) { const x = i % W; if ((x > 0 && bg[i - 1]) || (x < W - 1 && bg[i + 1]) || (i >= W && bg[i - W]) || (i < N - W && bg[i + W])) add.push(i); }
    for (const i of add) bg[i] = 1;
  }
  // enclosed dark holes (the inside of "O", "P"...) are background too when SMALL; the eclipse disc is a big dark region
  // (several % of the image) and stays solid
  // (small dark specks INSIDE the disc's box are its texture, not holes: kept)
  const seen = new Uint8Array(N), maxHole = N * HOLE, regions = [];
  for (let s = 0; s < N; s++) {
    if (bg[s] || seen[s] || mx(s) > BG) continue;
    const reg = [s], q = [s]; seen[s] = 1;
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    while (q.length) {
      const i = q.pop(), x = i % W, y = (i / W) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
        if (j >= 0 && !seen[j] && !bg[j] && mx(j) <= BG) { seen[j] = 1; q.push(j); reg.push(j); }
      }
    }
    regions.push({ reg, x0, y0, x1, y1 });
  }
  const big = regions.filter((r) => r.reg.length >= maxHole).map((r) => {
    const m = (r.x1 - r.x0) * 0.15; return { x0: r.x0 - m, y0: r.y0 - m, x1: r.x1 + m, y1: r.y1 + m };
  });
  for (const r of regions) {
    if (r.reg.length >= maxHole) continue;
    const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
    if (big.some((b) => cx >= b.x0 && cx <= b.x1 && cy >= b.y0 && cy <= b.y1)) continue;
    for (const i of r.reg) bg[i] = 1;
  }
  // distance (in px, up to SOFT) from the background, for the soft edge
  const dist = new Uint8Array(N).fill(255);
  let front = [];
  for (let i = 0; i < N; i++) if (bg[i]) { dist[i] = 0; front.push(i); }
  for (let k = 1; k <= SOFT && front.length; k++) {
    const next = [];
    for (const i of front) {
      const x = i % W, y = (i / W) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) if (j >= 0 && dist[j] === 255) { dist[j] = k; next.push(j); }
    }
    front = next;
  }
  for (let i = 0; i < N; i++) {
    const o = i * 4;
    if (bg[i]) { d[o + 3] = 0; continue; }
    if (dist[i] <= SOFT) {
      const a = Math.min(1, mx(i) / SOFT_LUM);
      d[o + 3] = Math.round(a * 255);
      if (a > 0) for (let c = 0; c < 3; c++) d[o + c] = Math.min(255, Math.round(d[o + c] / a));
    }
  }
  return img;
}

function crop(img, pad = 6) {
  const { width: W, height: H, data: d } = img;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
  const out = png.create(x1 - x0 + 1, y1 - y0 + 1);
  for (let y = 0; y < out.height; y++) out.data.set(d.subarray(((y0 + y) * W + x0) * 4, ((y0 + y) * W + x1 + 1) * 4), y * out.width * 4);
  return out;
}

// area-average downscale, premultiplied alpha
function shrink(img, S) {
  const k = Math.max(img.width, img.height) / S, W = Math.round(img.width / k), H = Math.round(img.height / k), out = png.create(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let yy = Math.floor(y * k); yy < Math.min(img.height, Math.floor((y + 1) * k)); yy++) for (let xx = Math.floor(x * k); xx < Math.min(img.width, Math.floor((x + 1) * k)); xx++) {
      const i = (yy * img.width + xx) * 4, al = img.data[i + 3] / 255;
      r += img.data[i] * al; g += img.data[i + 1] * al; b += img.data[i + 2] * al; a += al; n++;
    }
    const o = (y * W + x) * 4;
    if (a > 0) { out.data[o] = r / a; out.data[o + 1] = g / a; out.data[o + 2] = b / a; }
    out.data[o + 3] = n ? Math.round((a / n) * 255) : 0;
  }
  return out;
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const meta = {};
  const bg = find(FILES.bg);
  if (bg) { fs.copyFileSync(bg, path.join(OUT, 'bg.png')); const im = png.read(bg); meta.bg = { file: 'assets/ui/title/bg.png', w: im.width, h: im.height }; }
  for (const k of ['logo', 'emblem']) {
    const f = find(FILES[k]);
    if (!f) { console.log('missing', k); continue; }
    const im = crop(cutBlack(png.read(f)));
    png.write(path.join(OUT, k + '.png'), im);
    meta[k] = { file: `assets/ui/title/${k}.png`, w: im.width, h: im.height };
    if (k === 'emblem') { const ic = shrink(im, 64); png.write(path.join(OUT, 'icon.png'), ic); meta.icon = { file: 'assets/ui/title/icon.png', w: ic.width, h: ic.height }; }
  }
  fs.writeFileSync(path.join(OUT, 'title.json'), JSON.stringify(meta, null, 1));
  console.log(meta);
}

if (require.main === module) main();
module.exports = { FILES, cutBlack, crop, shrink };
