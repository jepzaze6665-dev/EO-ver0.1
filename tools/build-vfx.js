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
const SCALE = 0.5, COLS = 6, ROW = 3, ROW_DEFAULT = ROW;
const SETS = {
  ub: { src: 'desgin/VFX/UB', detectRows: false, names: { sk1: 'slash', sk2: 'thrust', sk3: 'twin', sk4: 'wave', sk5: 'burst', sk6: 'shards', sk7: 'eclipse' } },
  ag: {
    src: 'desgin/VFX/AG', detectRows: true, clean: true,
    names: { sk1: 'ag_bash', sk2: 'ag_crescent', sk3: 'ag_emblem', sk4: 'ag_beacon', sk5: 'ag_dome', sk6: 'ag_flash', sk7: 'ag_aegis' },
    rows: { sk3: 0, sk4: 0, sk5: 0, sk7: 0 }, // effects centred on the caster use the front view (row 0), not the side view
    // the crescent frames of SK2 are drawn opening forward (bulging back at the swinger): mirror them so the
    // arc bulges toward the target like every other slash; the lead-in arrow frames stay as drawn
    mirrorFrames: { sk2: [2, 3, 4, 5] },
  },
  rp: {
    src: 'desgin/VFX/RP', detectRows: true, clean: true,
    names: { SK1: 'rp_crescent', SK2: 'rp_lance', SK3: 'rp_flames', SK4: 'rp_portal', SK5: 'rp_spear', SK6: 'rp_vortex', sk7: 'rp_blacksun' },
    rows: { SK3: 0, SK4: 0, sk7: 0 }, // caster / target-centred effects: front view
  },
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

// ---- component-based extraction (AW-style sheets: frames wider than their grid cell) ----
// 1) faint pixels fade smoothly (no hard alpha threshold ring); 2) every blob of glow belongs to one
// frame (nearest cell centre); 3) blobs that join two frames are cut at the emptiest column between
// them and the cut is feathered; 4) each frame keeps its cell centre as pivot, and the output frame
// is enlarged to fit the widest effect, so nothing is sliced by a grid line.
const SOFT_FLOOR = 18, DUST = 14, CUT_FEATHER = 8;
function extractRow(img, file, set) {
  const ROW = set.rows && set.rows[file] !== undefined ? set.rows[file] : ROW_DEFAULT;
  const W = img.width, H = img.height, d = img.data, cw = W / COLS;
  const A = new Uint8Array(W * H);
  const strip = (set.stripLabel && set.stripLabel[file]) || 0;
  for (let p = 0; p < W * H; p++) {
    const x = p % W;
    const a = x < strip ? 0 : d[p * 4 + 3];
    A[p] = a <= SOFT_FLOOR ? 0 : Math.round(((a - SOFT_FLOOR) / (255 - SOFT_FLOOR)) * 255);
  }
  const runs = detectRows(img), rowC = runs.map(([a, b]) => (a + b) / 2);
  const nearestRow = (y) => { let k = 0; rowC.forEach((c, i) => { if (Math.abs(c - y) < Math.abs(rowC[k] - y)) k = i; }); return k; };
  // label blobs (8-connected)
  const lab = new Int32Array(W * H).fill(-1), comps = [];
  for (let p0 = 0; p0 < W * H; p0++) {
    if (lab[p0] >= 0 || !A[p0]) continue;
    const c = { n: 0, sx: 0, sy: 0, minx: 1e9, maxx: -1 }, id = comps.length, st = [p0];
    comps.push(c); lab[p0] = id;
    while (st.length) {
      const q = st.pop(), qx = q % W, qy = (q / W) | 0;
      c.n++; c.sx += qx; c.sy += qy; if (qx < c.minx) c.minx = qx; if (qx > c.maxx) c.maxx = qx;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = qx + dx, ny = qy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const r = ny * W + nx;
        if (lab[r] < 0 && A[r]) { lab[r] = id; st.push(r); }
      }
    }
  }
  // pixels of the wanted (right-facing) row
  const inRow = (l, y) => (comps[l].n >= DUST) && nearestRow(comps[l].n > 4000 ? y : comps[l].sy / comps[l].n) === ROW;
  // column projection of that row -> cut lines at the emptiest column near each grid boundary
  const proj = new Float64Array(W);
  for (let p = 0; p < W * H; p++) { const l = lab[p]; if (l >= 0 && inRow(l, (p / W) | 0)) proj[p % W] += A[p]; }
  const cuts = [0];
  for (let k = 1; k < COLS; k++) {
    let best = Math.round(k * cw), bv = Infinity;
    for (let x = Math.round((k - 0.35) * cw); x <= Math.round((k + 0.35) * cw); x++) { const v = proj[x] * 1000 + Math.abs(x - k * cw); if (v < bv) { bv = v; best = x; } }
    cuts.push(best);
  }
  cuts.push(W);
  const colOfX = (x) => { let k = 0; while (k < COLS - 1 && x >= cuts[k + 1]) k++; return k; };
  // blob -> frame: whole blob by centroid, unless it crosses a cut (then per pixel, feathered)
  const owner = comps.map((c) => (colOfX(c.minx) === colOfX(c.maxx) ? colOfX(c.sx / c.n) : -2));
  const frames = [...Array(COLS)].map(() => ({ px: [], minx: 1e9, maxx: -1, miny: 1e9, maxy: -1 }));
  for (let p = 0; p < W * H; p++) {
    const l = lab[p]; if (l < 0) continue;
    const x = p % W, y = (p / W) | 0;
    if (!inRow(l, y)) continue;
    let k = owner[l], a = A[p];
    if (k === -2) {
      k = colOfX(x);
      const dist = Math.min(k > 0 ? x - cuts[k] : Infinity, k < COLS - 1 ? cuts[k + 1] - 1 - x : Infinity);
      a = Math.round(a * Math.min(1, dist / CUT_FEATHER));
    }
    if (!a) continue;
    const f = frames[k];
    f.px.push(p, a);
    if (x < f.minx) f.minx = x; if (x > f.maxx) f.maxx = x; if (y < f.miny) f.miny = y; if (y > f.maxy) f.maxy = y;
  }
  // common frame size around each cell centre / the row centre
  const cy = rowC[ROW];
  let hw = cw / 2, hh = H / 8;
  frames.forEach((f, k) => { if (f.maxx < 0) return; const cx = (k + 0.5) * cw; hw = Math.max(hw, cx - f.minx + 2, f.maxx - cx + 3); hh = Math.max(hh, cy - f.miny + 2, f.maxy - cy + 3); });
  const fw = Math.ceil(hw * SCALE) * 2, fh = Math.ceil(hh * SCALE) * 2;
  const out = png.create(fw * COLS, fh);
  frames.forEach((f, k) => {
    // accumulate owned pixels into 2x2 output blocks (premultiplied)
    const acc = new Float64Array(fw * fh * 4);
    const ox = (k + 0.5) * cw - fw / 2 / SCALE, oy = cy - fh / 2 / SCALE;
    for (let i = 0; i < f.px.length; i += 2) {
      const p = f.px[i], a = f.px[i + 1] / 255, x = p % W, y = (p / W) | 0;
      const X = Math.floor((x - ox) * SCALE), Y = Math.floor((y - oy) * SCALE);
      if (X < 0 || Y < 0 || X >= fw || Y >= fh) continue;
      const o = (Y * fw + X) * 4;
      acc[o] += d[p * 4] * a; acc[o + 1] += d[p * 4 + 1] * a; acc[o + 2] += d[p * 4 + 2] * a; acc[o + 3] += a;
    }
    const n = 1 / (SCALE * SCALE);
    for (let Y = 0; Y < fh; Y++) for (let X = 0; X < fw; X++) {
      const o = (Y * fw + X) * 4, a = acc[o + 3];
      if (a <= 0.02) continue;
      const t = (Y * out.width + k * fw + X) * 4;
      out.data[t] = acc[o] / a; out.data[t + 1] = acc[o + 1] / a; out.data[t + 2] = acc[o + 2] / a; out.data[t + 3] = Math.round(Math.min(1, a / n) * 255);
    }
  });
  const mir = set.mirrorFrames && set.mirrorFrames[file];
  if (mir) for (const k of mir) {
    for (let Y = 0; Y < fh; Y++) for (let X = 0; X < fw / 2; X++) {
      const a = (Y * out.width + k * fw + X) * 4, b = (Y * out.width + k * fw + (fw - 1 - X)) * 4;
      for (let q = 0; q < 4; q++) { const t = out.data[a + q]; out.data[a + q] = out.data[b + q]; out.data[b + q] = t; }
    }
  }
  return { out, fw, fh };
}

const meta = {};
for (const [setName, set] of Object.entries(SETS)) {
  for (const [file, name] of Object.entries(set.names)) {
    const img = png.read(path.join(ROOT, set.src, file));
    if (set.detectRows) {
      const { out, fw, fh } = extractRow(img, file, set);
      png.write(path.join(OUT, name + '.png'), out);
      meta[name] = { file: 'assets/vfx/' + name + '.png', fw, fh, frames: COLS, set: setName };
      console.log(setName, name.padEnd(12), fw + 'x' + fh);
      continue;
    }
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
