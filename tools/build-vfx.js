// Builds skill VFX strips from desgin/VFX/UB/sk1..sk7 (RGBA, 6 frames x 4 direction rows).
// Uses the right-facing row (row 3); the game rotates it to any aim angle.
// Usage: node tools/build-vfx.js
const fs = require('fs');
const path = require('path');
const png = require('./png.js');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'desgin', 'VFX', 'UB');
const OUT = path.join(ROOT, 'assets', 'vfx');
fs.mkdirSync(OUT, { recursive: true });
const SCALE = 0.5, COLS = 6, ROW = 3;
const NAMES = { sk1: 'slash', sk2: 'thrust', sk3: 'twin', sk4: 'wave', sk5: 'burst', sk6: 'shards', sk7: 'eclipse' };

const meta = {};
for (const [file, name] of Object.entries(NAMES)) {
  const img = png.read(path.join(SRC, file));
  const cw = img.width / COLS, ch = img.height / 4;
  const fw = Math.round(cw * SCALE), fh = Math.round(ch * SCALE);
  const out = png.create(fw * COLS, fh);
  for (let c = 0; c < COLS; c++) {
    const x0 = c * cw, y0 = ROW * ch;
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = 0; yy < 2; yy++) for (let xx = 0; xx < 2; xx++) {
        const sx = Math.floor(x0 + x / SCALE + xx), sy = Math.floor(y0 + y / SCALE + yy);
        const i = (sy * img.width + sx) * 4, al = img.data[i + 3] / 255;
        r += img.data[i] * al; g += img.data[i + 1] * al; b += img.data[i + 2] * al; a += al; n++;
      }
      const o = (y * out.width + c * fw + x) * 4;
      if (a > 0.05) { out.data[o] = r / a; out.data[o + 1] = g / a; out.data[o + 2] = b / a; out.data[o + 3] = Math.round((a / n) * 255); }
    }
  }
  png.write(path.join(OUT, name + '.png'), out);
  meta[name] = { file: 'assets/vfx/' + name + '.png', fw, fh, frames: COLS };
  console.log(name, fw + 'x' + fh);
}
fs.writeFileSync(path.join(OUT, 'vfx.json'), JSON.stringify(meta, null, 1));
