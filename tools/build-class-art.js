#!/usr/bin/env node
// CLASS ART (owner's art for the class-select screen): splash (full-body character) + emblem per class
//   node tools/build-class-art.js [--preview]
// Sources: desgin/UI/ตัวละคร/<CODE>.png (splash, 1376×2048, black bg) and desgin/UI/ICON CLASS/<line>/<file> (emblems; the
// owner's files have random names -> mapped in EMBLEMS). Output: assets/ui/class/<classId>_splash.png (height SPLASH_H) +
// <classId>_emblem.png (EMBLEM px) + class.json. Background = black connected to the edge (build-title cutBlack) with a LOW
// threshold: many classes wear black, so only true black is removed; enclosed regions are kept (hole 0).
const fs = require('fs');
const os = require('os');
const path = require('path');
const png = require('./png.js');
const { cutBlack, crop, shrink } = require('./build-title.js');

const ROOT = path.join(__dirname, '..');
const SPLASH_DIR = path.join(ROOT, 'desgin', 'UI', 'ตัวละคร');
const EMBLEM_DIR = path.join(ROOT, 'desgin', 'UI', 'ICON CLASS');
const OUT = path.join(ROOT, 'assets', 'ui', 'class');
const SPLASH_H = 900, EMBLEM = 160;

// class id -> splash file code (desgin/UI/ตัวละคร/<code>.png)
const SPLASH = {
  umbral_sword: 'UB', nightfall_reaper: 'RP', duskrunner: 'DR', blade_of_echoes: 'BE',
  astral_weaver: 'AW', stormcaller: 'SM', void_scribe: 'VS', lumen_oracle: 'LO',
  aegis_guardian: 'AG', warden_of_dawn: 'WD', bulwark_sentinel: 'BS', oathbreaker: 'OK',
};
// class id -> emblem file (identified by eye from the owner's sheet, 2026-10-02)
const EMBLEMS = {
  nightfall_reaper: 'UB/image-0169b8eb-9513-4633-9880-22b380d94c71-0.png',
  blade_of_echoes: 'UB/image-54fef1d6-c63a-4b61-9bdd-090124368eac-0.png',
  umbral_sword: 'UB/image-c6395d23-ebbd-4c1b-8986-7f457df5f6a8-0.png',
  duskrunner: 'UB/image-f62cc081-1a0b-4401-9a68-8faea19cdda0-0.png',
  astral_weaver: 'AW/AW.png',
  lumen_oracle: 'AW/image-0dc3966f-20ba-4b74-85b6-5f12d2830e65-0.png',
  void_scribe: 'AW/image-c81315e9-bb38-4574-83b7-cef00705c431-0.png',
  stormcaller: 'AW/image-ee975c34-4e73-44df-ae8b-0bf28c4721af-0.png',
  aegis_guardian: 'AG/image-54348bc7-9ade-4000-8663-a01e0d3fb6fa-0.png',
  bulwark_sentinel: 'AG/image-6f059803-0be6-4d33-b646-cb2f79ff3759-0.png',
  warden_of_dawn: 'AG/image-b4bd3a37-eebd-4dc0-af1f-75699234d299-0.png',
  oathbreaker: 'AG/image-c462c400-5f50-44df-83c1-0d9142ef7bc0-0.png',
};
const SPLASH_CUT = { bg: 12, soft: 3, softLum: 36, hole: 0, erode: 5, gap: 0.5, gapMin: 400 }; // gap: enclosed pure-black gaps between limbs / beside blades
const EMBLEM_CUT = { bg: 18, soft: 5, softLum: 70, hole: 0 };

// drop small DARK islands left floating in the background (AI noise specks); bright sparks / magic motes are art: kept
function dropSpecks(img, maxSize = 400, maxLum = 60) {
  const { width: W, height: H, data: d } = img, N = W * H, seen = new Uint8Array(N);
  for (let s = 0; s < N; s++) {
    if (seen[s] || d[s * 4 + 3] < 16) continue;
    const reg = [s], q = [s]; seen[s] = 1; let lum = 0;
    while (q.length) {
      const i = q.pop(), x = i % W;
      lum = Math.max(lum, d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i >= W ? i - W : -1, i < N - W ? i + W : -1]) if (j >= 0 && !seen[j] && d[j * 4 + 3] >= 16) { seen[j] = 1; q.push(j); reg.push(j); }
    }
    if (reg.length <= maxSize && lum <= maxLum) for (const i of reg) d[i * 4 + 3] = 0;
  }
  return img;
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const meta = {}, previews = [];
  for (const [id, code] of Object.entries(SPLASH)) {
    const f = path.join(SPLASH_DIR, code + '.png');
    if (!fs.existsSync(f)) { console.log('missing splash', id); continue; }
    const im = shrink(crop(dropSpecks(cutBlack(png.read(f), SPLASH_CUT)), 4), SPLASH_H);
    png.write(path.join(OUT, id + '_splash.png'), im);
    meta[id] = { splash: `assets/ui/class/${id}_splash.png`, sw: im.width, sh: im.height };
    previews.push(im);
  }
  for (const [id, rel] of Object.entries(EMBLEMS)) {
    const f = path.join(EMBLEM_DIR, rel);
    if (!fs.existsSync(f)) { console.log('missing emblem', id); continue; }
    const im = shrink(crop(cutBlack(png.read(f), EMBLEM_CUT), 4), EMBLEM);
    png.write(path.join(OUT, id + '_emblem.png'), im);
    (meta[id] ||= {}).emblem = `assets/ui/class/${id}_emblem.png`;
  }
  fs.writeFileSync(path.join(OUT, 'class.json'), JSON.stringify(meta, null, 1));
  console.log(Object.keys(meta).length, 'classes ->', path.relative(ROOT, OUT));
  if (process.argv.includes('--preview')) { // splashes on MAGENTA: any hole eaten into a dark costume shows at once
    const h = 300, ws = previews.map((p) => Math.round(p.width * h / p.height)), sheet = png.create(ws.reduce((a, b) => a + b, 0), h);
    for (let i = 0; i < sheet.data.length; i += 4) { sheet.data[i] = 200; sheet.data[i + 1] = 0; sheet.data[i + 2] = 200; sheet.data[i + 3] = 255; }
    let ox = 0;
    previews.forEach((p, n) => {
      for (let y = 0; y < h; y++) for (let x = 0; x < ws[n]; x++) {
        const si = (Math.floor(y * p.height / h) * p.width + Math.floor(x * p.width / ws[n])) * 4, di = (y * sheet.width + ox + x) * 4, a = p.data[si + 3] / 255;
        for (let c = 0; c < 3; c++) sheet.data[di + c] = Math.round(p.data[si + c] * a + sheet.data[di + c] * (1 - a));
      }
      ox += ws[n];
    });
    const out = path.join(os.tmpdir(), 'eo-class-art.png');
    png.write(out, sheet);
    console.log('preview:', out);
  }
}

if (require.main === module) main();
module.exports = { SPLASH, EMBLEMS };
