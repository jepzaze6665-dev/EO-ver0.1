// Builds the skill icons (owner's art: desgin/ICON SKILL/<line>/<class>/SK1..SK7 | UT, 1024² or 1254² PNG, some
// with a transparent background, some on a dark square) into small game icons:
//   assets/icons/<class>_<sk>.png (SIZE × SIZE) + assets/icons/icons.json { key: { file } }
// Keys are lower case: 'ag_sk1', 'ub_ut', 'sm_sk7'. Which skill shows which icon = src/data/skillIcons.js.
// Downscale = area average with premultiplied alpha (no dark fringe around transparent edges).
// Usage: node tools/build-icons.js
const fs = require('fs');
const path = require('path');
const png = require('./png.js');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'desgin', 'ICON SKILL');
const OUT = path.join(ROOT, 'assets', 'icons');
const SIZE = 64;
fs.mkdirSync(OUT, { recursive: true });

function shrink(img, S) {
  const out = png.create(S, S), k = img.width / S, kh = img.height / S;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const x0 = Math.floor(x * k), x1 = Math.max(x0 + 1, Math.floor((x + 1) * k)), y0 = Math.floor(y * kh), y1 = Math.max(y0 + 1, Math.floor((y + 1) * kh));
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
      const i = (yy * img.width + xx) * 4, al = img.data[i + 3] / 255;
      r += img.data[i] * al; g += img.data[i + 1] * al; b += img.data[i + 2] * al; a += al; n++;
    }
    const o = (y * S + x) * 4;
    if (a > 0) { out.data[o] = r / a; out.data[o + 1] = g / a; out.data[o + 2] = b / a; }
    out.data[o + 3] = Math.round((a / n) * 255);
  }
  return out;
}

const meta = {};
for (const line of fs.readdirSync(SRC)) {
  for (const cls of fs.readdirSync(path.join(SRC, line))) {
    const dir = path.join(SRC, line, cls);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir)) {
      const sk = file.replace(/\.png$/i, '').toLowerCase().replace(/\s+/g, '');
      if (!/^(sk\d+|ut)$/.test(sk)) { console.log('skip', line, cls, file); continue; }
      const key = `${cls.toLowerCase()}_${sk}`;
      png.write(path.join(OUT, key + '.png'), shrink(png.read(path.join(dir, file)), SIZE));
      meta[key] = { file: 'assets/icons/' + key + '.png' };
    }
  }
}
fs.writeFileSync(path.join(OUT, 'icons.json'), JSON.stringify(meta, null, 1));
console.log(Object.keys(meta).length, 'icons ->', path.relative(ROOT, OUT));
