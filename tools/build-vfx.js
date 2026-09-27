// Builds skill VFX strips (6 frames x direction rows, RGBA) into right-facing strips;
// the game rotates each strip to any aim angle (src/vfx/vfx.js sprite()).
//   ub: desgin/VFX/UB/sk1..sk7  (uniform 4-row grid, row 3 = right)
//   aw: desgin/VFX/AW/SK1..UT   (rows detected from alpha; row 3 = East/right, SK3 has an extra 5th row)
// Usage: node tools/build-vfx.js
const fs = require('fs');
const path = require('path');
const png = require('./png.js');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'vfx');
fs.mkdirSync(OUT, { recursive: true });
const SCALE = 0.5, COLS = 6, ROW = 3;
const SETS = {
  ub: { src: 'desgin/VFX/UB', detectRows: false, names: { sk1: 'slash', sk2: 'thrust', sk3: 'twin', sk4: 'wave', sk5: 'burst', sk6: 'shards', sk7: 'eclipse' } },
  aw: {
    src: 'desgin/VFX/AW', detectRows: true, clean: true,
    names: { SK1: 'aw_needle', SK2: 'aw_star', SK3: 'aw_comet', SK4: 'aw_sigil', SK5: 'aw_nova', SK6: 'aw_orb', UT: 'aw_starfall' },
    stripLabel: { UT: 64 }, // UT has "S/N/W/E" labels drawn in the first column
  },
};

// vertical runs of opaque pixels = the direction rows
function detectRows(img) {
  const c = new Array(img.height).fill(0);
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if (img.data[(y * img.width + x) * 4 + 3] > 120) c[y]++;
  const runs = []; let s = -1;
  for (let y = 0; y <= img.height; y++) {
    const o = y < img.height && c[y] > 2;
    if (o && s < 0) s = y;
    if (!o && s >= 0) { if (y - s > 8) runs.push([s, y]); s = -1; }
  }
  return runs;
}

// remove faint pixels and tiny isolated specks (AI-sheet noise) from one output frame
function cleanFrame(out, x0, fw, fh) {
  const W = out.width, A = (x, y) => out.data[(y * W + x0 + x) * 4 + 3];
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (A(x, y) < 30) out.data[(y * W + x0 + x) * 4 + 3] = 0;
  const lab = new Int32Array(fw * fh).fill(-1), sizes = [];
  for (let p = 0; p < fw * fh; p++) {
    if (lab[p] >= 0 || !A(p % fw, (p / fw) | 0)) continue;
    const id = sizes.length, st = [p]; lab[p] = id; let n = 0;
    while (st.length) {
      const q = st.pop(), qx = q % fw, qy = (q / fw) | 0; n++;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = qx + dx, ny = qy + dy, r = ny * fw + nx;
        if (nx >= 0 && ny >= 0 && nx < fw && ny < fh && lab[r] < 0 && A(nx, ny)) { lab[r] = id; st.push(r); }
      }
    }
    sizes.push(n);
  }
  for (let p = 0; p < fw * fh; p++) if (lab[p] >= 0 && sizes[lab[p]] < 12) out.data[(((p / fw) | 0) * W + x0 + (p % fw)) * 4 + 3] = 0;
}

const meta = {};
for (const [setName, set] of Object.entries(SETS)) {
  for (const [file, name] of Object.entries(set.names)) {
    const img = png.read(path.join(ROOT, set.src, file));
    const cw = img.width / COLS, ch = img.height / 4;
    let y0 = ROW * ch, clipY0 = 0, clipY1 = img.height;
    if (set.detectRows) {
      const run = detectRows(img)[ROW];
      const mid = (run[0] + run[1]) / 2;
      y0 = Math.round(mid - ch / 2);
      clipY0 = run[0] - 20; clipY1 = run[1] + 20; // never pull in pixels of neighbouring rows
    }
    const strip = (set.stripLabel && set.stripLabel[file]) || 0;
    const fw = Math.round(cw * SCALE), fh = Math.round(ch * SCALE);
    const out = png.create(fw * COLS, fh);
    for (let c = 0; c < COLS; c++) {
      const x0 = c * cw;
      for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
        let r = 0, g = 0, b = 0, a = 0, n = 0;
        for (let yy = 0; yy < 2; yy++) for (let xx = 0; xx < 2; xx++) {
          const sx = Math.floor(x0 + x / SCALE + xx), sy = Math.floor(y0 + y / SCALE + yy);
          n++;
          if (sy < clipY0 || sy >= clipY1 || sy < 0 || sy >= img.height || (c === 0 && sx < strip)) continue;
          const i = (sy * img.width + sx) * 4, al = img.data[i + 3] / 255;
          r += img.data[i] * al; g += img.data[i + 1] * al; b += img.data[i + 2] * al; a += al;
        }
        const o = (y * out.width + c * fw + x) * 4;
        if (a > 0.05) { out.data[o] = r / a; out.data[o + 1] = g / a; out.data[o + 2] = b / a; out.data[o + 3] = Math.round((a / n) * 255); }
      }
      if (set.clean) cleanFrame(out, c * fw, fw, fh);
    }
    png.write(path.join(OUT, name + '.png'), out);
    meta[name] = { file: 'assets/vfx/' + name + '.png', fw, fh, frames: COLS, set: setName };
    console.log(setName, name.padEnd(12), fw + 'x' + fh);
  }
}
fs.writeFileSync(path.join(OUT, 'vfx.json'), JSON.stringify(meta, null, 1));
