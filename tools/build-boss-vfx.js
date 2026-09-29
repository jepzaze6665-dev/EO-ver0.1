// BOSS VFX: the owner's per-map boss effect sheets (desgin/monster/<route>/<map>/VFX BOSS/*) -> animated strips in the
// same format as the skill VFX (assets/vfx: one horizontal strip per effect, right-facing, rotated in game by
// src/vfx/vfx.js sprite()). Each sheet has 13 rows of effects with a different number of frames per row.
//   light sheets (fake checkerboard): background flood-removed like the monster sheets
//   dark sheets: glow extraction — alpha from how much brighter than the background a pixel is (soft light kept)
// Row names per sheet below (same idea on every sheet, but the owner's rows are not always in the same order).
// Output: assets/vfx/boss/<prefix>_<name>.png + assets/vfx/boss.json (merged into Assets.vfx by core/assets.js).
// Usage: node tools/build-boss-vfx.js [--preview]
const fs = require('fs');
const path = require('path');
const os = require('os');
const png = require('./png.js');
const { removeBackground, projection, runs, fitSegments, crop, scaleImage, bbox, mirror } = require('./build-monsters.js');

const ROOT = path.join(__dirname, '..');
const SCALE = 0.5; // 2048 px sheets -> game pixels (same as the skill VFX)
const SHEETS = [
  {
    prefix: 'g', dir: 'desgin/monster/A/A1/VFX BOSS', bg: 'light', skipX: 96, // A1 green (Guardian): row numbers drawn on the left
    names: ['orb', 'slash', 'burst', 'shockwave', 'bolt', 'blast', 'sigil', 'quake', 'crystal', 'spark', 'pillar', 'vortex', 'eruption'],
    mirror: ['bolt'], // the projectile flies left on the sheet
    counts: { eruption: 9 }, // rows whose frames touch: split into this many at the emptiest columns
  },
  {
    prefix: 'm', dir: 'desgin/monster/A/A2/VFX BOSS', bg: 'dark', // A2 orange (Magma Beast)
    names: ['orb', 'slash', 'burst', 'crater', 'bolt', 'blast', 'sigil', 'eruption', 'spark', 'shockwave', 'pillar', 'vortex', 'spikes'],
    counts: { slash: 11 },
  },
  {
    prefix: 'r', dir: 'desgin/monster/A/A3/VFX BOSS', bg: 'light', // A3 blue + gold (Rune Knight)
    names: ['orb', 'slash', 'burst', 'spikes', 'bolt', 'blast', 'sigil', 'pillar', 'crystal', 'spark', 'dome', 'vortex', 'shatter'],
    mirror: ['bolt'],
    counts: { slash: 8 },
  },
  {
    prefix: 'f', dir: 'desgin/monster/B/B1/VFX BOSS', bg: 'light', skipX: 60, clearLines: true, // grey checkerboard: flood-removed; lines between rows // B1 ice blue (the Frost Arena boss), row numbers on the left
    names: ['spark', 'slash', 'burst', 'spikes', 'bolt', 'blast', 'sigil', 'crater', 'crystal', 'vortex', 'pillar', 'shockwave', 'shatter'],
    counts: { shockwave: 9, shatter: 8, pillar: 14 },
  },
  {
    // B1 AURA sheet (owner: "used when the boss changes phase"): ring forming -> spiked ring -> big ring -> corrupted
    // violet vortex -> burst pillar
    prefix: 'fa', dir: 'desgin/monster/B/B1/AURA Phase BOSS', bg: 'light',
    names: ['form', 'ring', 'bigring', 'void', 'burst'],
    counts: { void: 9, burst: 10 },
  },
  {
    prefix: 'c', dir: 'desgin/monster/B/B2/VFX BOSS', bg: 'light', skipX: 60, clearLines: true, // B2 amethyst (the Colossus)
    names: ['spark', 'slash', 'burst', 'spikes', 'bolt', 'blast', 'sigil', 'crater', 'star', 'sparkle', 'pillar', 'eruption', 'shatter'],
    counts: { slash: 7, crater: 8, star: 9, pillar: 11, eruption: 9, shatter: 9 },
  },
  {
    prefix: 'w', dir: 'desgin/monster/B/B3/VFX BOSS', bg: 'light', // B3 ice blue (the Crystal Warden)
    names: ['spark', 'slash', 'burst', 'spikes', 'bolt', 'blast', 'sigil', 'crater', 'crystal', 'sparkle', 'pillar', 'eruption', 'shatter'],
    counts: { spark: 13, slash: 12, burst: 11, spikes: 9, bolt: 8, blast: 10, sigil: 9, crater: 9, crystal: 10, sparkle: 10, pillar: 12, eruption: 10, shatter: 8 },
  },
  {
    prefix: 'ca', dir: 'desgin/monster/B/B2/AURA Phase BOSS', bg: 'light', // B2 phase aura: gather -> ring -> vortex -> surge -> burst
    names: ['form', 'ring', 'vortex', 'surge', 'burst'],
    counts: { ring: 8, vortex: 8, surge: 7, burst: 9 },
  },
];

// dark background: keep the glow. alpha = brightness above the background, colour un-mixed from the background
function glowExtract(img) {
  const { width: w, height: h, data } = img;
  let n = 0, sum = [0, 0, 0], mx = 0;
  for (let y = 0; y < h; y += 3) for (let x = 0; x < w; x += 3) {
    if (x > 24 && y > 24 && x < w - 24 && y < h - 24) continue;
    const i = (y * w + x) * 4;
    for (let c = 0; c < 3; c++) sum[c] += data[i + c];
    mx = Math.max(mx, data[i], data[i + 1], data[i + 2]); n++;
  }
  const bg = sum.map((v) => v / n), floor = mx + 6;
  for (let p = 0; p < w * h; p++) {
    const i = p * 4, m = Math.max(data[i], data[i + 1], data[i + 2]);
    const a = Math.max(0, Math.min(1, (m - floor) / (190 - floor)));
    if (a <= 0) { data[i + 3] = 0; continue; }
    for (let c = 0; c < 3; c++) data[i + c] = Math.max(0, Math.min(255, (data[i + c] - bg[c] * (1 - a)) / a));
    data[i + 3] = Math.round(a * 255);
  }
}

function buildSheet(sh, out, preview) {
  const dir = path.join(ROOT, sh.dir);
  const file = fs.readdirSync(dir).find((f) => !f.startsWith('.'));
  const img = png.read(path.join(dir, file));
  if (sh.bg === 'dark') glowExtract(img); else removeBackground(img);
  if (sh.skipX) for (let y = 0; y < img.height; y++) for (let x = 0; x < sh.skipX; x++) img.data[(y * img.width + x) * 4 + 3] = 0;
  // separator lines drawn across the sheet between rows would join every frame of a row: clear any pixel row
  // (and its neighbours) that is opaque across most of the width
  if (sh.clearLines) {
    const w = img.width, full = [];
    for (let y = 0; y < img.height; y++) { let n = 0; for (let x = 0; x < w; x++) if (img.data[(y * w + x) * 4 + 3] > 40) n++; if (n > w * 0.92) full.push(y); }
    for (const y of full) for (let yy = Math.max(0, y - 2); yy <= Math.min(img.height - 1, y + 2); yy++) for (let x = 0; x < w; x++) img.data[(yy * w + x) * 4 + 3] = 0;
  }
  const rowsP = projection(img, 0, 0, img.width, img.height, 'y');
  const rows = fitSegments(runs(rowsP, 8), rowsP, sh.names.length);
  const meta = {};
  rows.forEach((r, ri) => {
    const name = `${sh.prefix}_${sh.names[ri]}`;
    const colP = projection(img, 0, r.a, img.width, r.b, 'x');
    const want = sh.counts && sh.counts[sh.names[ri]];
    const segs = want ? fitSegments(runs(colP, 10), colP, want) : runs(colP, 10).filter((s) => s.mass > 60);
    let frames = segs.map((s) => {
      const im = crop(img, s.a, r.a, s.b, r.b), bb = bbox(im);
      return bb ? crop(im, bb.minx, bb.miny, bb.maxx + 1, bb.maxy + 1) : null;
    }).filter(Boolean).map((im) => scaleImage(im, SCALE));
    // drop fragments left by splitting touching frames (much narrower than the row's typical frame)
    const med = frames.map((f) => f.width).sort((a, b) => a - b)[frames.length >> 1];
    frames = frames.filter((f, k) => f.width >= med * 0.4 || k === 0);
    if ((sh.mirror || []).includes(sh.names[ri])) frames = frames.map(mirror);
    const fw = Math.max(...frames.map((f) => f.width)) + 2, fh = Math.max(...frames.map((f) => f.height)) + 2;
    const strip = png.create(fw * frames.length, fh);
    frames.forEach((f, k) => {
      const dx = k * fw + ((fw - f.width) >> 1), dy = (fh - f.height) >> 1;
      for (let y = 0; y < f.height; y++) f.data.copy(strip.data, ((dy + y) * strip.width + dx) * 4, y * f.width * 4, (y + 1) * f.width * 4);
    });
    png.write(path.join(out, name + '.png'), strip);
    meta[name] = { file: `assets/vfx/boss/${name}.png`, fw, fh, frames: frames.length, set: 'boss' };
    if (preview) console.log(`  ${name.padEnd(14)} ${frames.length} frames ${fw}x${fh}`);
  });
  return meta;
}

const preview = process.argv.includes('--preview');
const out = path.join(ROOT, 'assets/vfx/boss');
fs.mkdirSync(out, { recursive: true });
const meta = {};
for (const sh of SHEETS) { Object.assign(meta, buildSheet(sh, out, preview)); console.log(`${sh.prefix}: ${sh.dir}`); }
fs.writeFileSync(path.join(ROOT, 'assets/vfx/boss.json'), JSON.stringify(meta, null, 1));
console.log(Object.keys(meta).length, 'boss effects');
if (preview) {
  // contact sheet: every strip on a dark card (glow check)
  const list = Object.keys(meta), W = 1400;
  const ims = list.map((n) => png.read(path.join(ROOT, meta[n].file)));
  const H = ims.reduce((s, im) => s + Math.min(im.height, 90) + 4, 0);
  const pv = png.create(W, H);
  for (let i = 0; i < pv.data.length; i += 4) { pv.data[i] = 24; pv.data[i + 1] = 26; pv.data[i + 2] = 34; pv.data[i + 3] = 255; }
  let y = 0;
  for (const im of ims) {
    const hh = Math.min(im.height, 90), ww = Math.min(im.width, W);
    for (let yy = 0; yy < hh; yy++) for (let xx = 0; xx < ww; xx++) {
      const si = (yy * im.width + xx) * 4, a = im.data[si + 3] / 255, di = ((y + yy) * W + xx) * 4;
      for (let c = 0; c < 3; c++) pv.data[di + c] = pv.data[di + c] * (1 - a) + im.data[si + c] * a;
    }
    y += hh + 4;
  }
  const f = path.join(os.tmpdir(), 'eo-boss-vfx.png');
  png.write(f, pv);
  console.log('preview', f);
}
