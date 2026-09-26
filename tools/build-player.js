// Converts the raw Umbral Sword sheets in /UB (fake-checkerboard background, 6 columns)
// into clean alpha sprite strips + an atlas description consumed by src/player/playerSprites.js.
// Usage: node tools/build-player.js
const fs = require('fs');
const path = require('path');
const png = require('./png.js');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'player');
fs.mkdirSync(OUT, { recursive: true });

// CHARACTER VISUAL STANDARD (shared by every animation)
const STD = {
  bodyHeight: 60,          // neutral-pose body height in game pixels (all sheets normalised to this)
  canvas: [128, 128],      // every frame of every animation uses this canvas
  pivot: [64, 120],        // feet-centre pivot inside the canvas (ground line y = 120)
};
// name -> [file, rows]
const SHEETS = {
  walk: ['desgin/class cr/UB/UB WALK1.png', 4],
  run: ['desgin/class cr/UB/UB WALK2', 4],
  atk1: ['desgin/class cr/UB/UB ATK1', 4],
  atk2: ['desgin/class cr/UB/UB ATK2', 4],
  guard: ['desgin/class cr/UB/UB DF', 4],
  hit: ['desgin/class cr/UB/UB HIT', 4],
  pr: ['desgin/class cr/UB/UB PR', 4],
  sk1: ['desgin/class cr/UB/UB SK1.png', 4],
  sk2: ['desgin/class cr/UB/UB SK2.png', 4],
  sk3: ['desgin/class cr/UB/UB SK3.PNG', 4],
  sk4: ['desgin/class cr/UB/UB SK4.png', 4],
  sk5: ['desgin/class cr/UB/UB SK5.png', 4],
  sk6: ['desgin/class cr/UB/UB SK6.png', 4],
  ult: ['desgin/class cr/UB/UB UT.png', 4],
  vfx: ['desgin/class cr/UB/UB VFX', 8],
};
const COLS = 6;

function removeBackground(img) {
  const { width: w, height: h, data } = img;
  const isBg = (i, loose) => {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const mn = Math.min(r, g, b), mx = Math.max(r, g, b);
    return loose ? mn > 175 && mx - mn < 26 : mn > 212 && mx - mn < 20;
  };
  // flood fill from all strict-bg pixels (checkerboard covers the whole sheet)
  const mark = new Uint8Array(w * h);
  const stack = [];
  for (let p = 0; p < w * h; p++) if (isBg(p * 4, false)) { mark[p] = 1; stack.push(p); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w, y = (p / w) | 0;
    const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
    for (const q of nb) if (q >= 0 && !mark[q] && isBg(q * 4, true)) { mark[q] = 1; stack.push(q); }
  }
  for (let p = 0; p < w * h; p++) {
    if (mark[p]) { data[p * 4 + 3] = 0; continue; }
    // soften light fringe pixels touching the background (un-mix from white)
    const x = p % w, y = (p / w) | 0;
    const touches = (x > 0 && mark[p - 1]) || (x < w - 1 && mark[p + 1]) || (y > 0 && mark[p - w]) || (y < h - 1 && mark[p + w]);
    if (touches) {
      const i = p * 4, r = data[i], g = data[i + 1], b = data[i + 2];
      const lum = (r + g + b) / 3, sat = Math.max(r, g, b) - Math.min(r, g, b);
      if (lum > 120 && sat < 40) {
        const a = Math.max(0, Math.min(1, (235 - lum) / 175));
        data[i + 3] = Math.round(a * 255);
        // darken remaining colour so the white does not show through
        data[i] = Math.round(r * 0.35); data[i + 1] = Math.round(g * 0.35); data[i + 2] = Math.round(b * 0.4);
      }
    }
  }
}

// Keeps only the main figure (largest blob) plus nearby effect particles; strips
// fragments that leak in from neighbouring cells. Returns a per-cell keep mask.
function cellMask(img, x0, y0, cw, ch) {
  const { width: w, data } = img;
  const lab = new Int32Array(cw * ch).fill(-1);
  const comps = [];
  for (let sy = 0; sy < ch; sy++) for (let sx = 0; sx < cw; sx++) {
    const p = sy * cw + sx;
    if (lab[p] !== -1 || data[((y0 + sy) * w + x0 + sx) * 4 + 3] < 40) continue;
    const id = comps.length, c = { n: 0, minx: sx, maxx: sx, miny: sy, maxy: sy, edge: false };
    comps.push(c);
    const st = [p]; lab[p] = id;
    while (st.length) {
      const q = st.pop(), qx = q % cw, qy = (q / cw) | 0;
      c.n++;
      if (qx < c.minx) c.minx = qx; if (qx > c.maxx) c.maxx = qx; if (qy < c.miny) c.miny = qy; if (qy > c.maxy) c.maxy = qy;
      if (qx === 0 || qy === 0 || qx === cw - 1 || qy === ch - 1) c.edge = true;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = qx + dx, ny = qy + dy;
        if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue;
        const r = ny * cw + nx;
        if (lab[r] === -1 && data[((y0 + ny) * w + x0 + nx) * 4 + 3] >= 40) { lab[r] = id; st.push(r); }
      }
    }
  }
  const keep = new Uint8Array(cw * ch);
  if (!comps.length) return keep;
  let main = 0;
  comps.forEach((c, i) => { if (c.n > comps[main].n) main = i; });
  const M = comps[main], margin = 60;
  const ok = comps.map((c, i) => i === main || (!c.edge && c.n >= 6 &&
    c.maxx > M.minx - margin && c.minx < M.maxx + margin && c.maxy > M.miny - margin && c.miny < M.maxy + margin));
  for (let p = 0; p < cw * ch; p++) if (lab[p] >= 0 && ok[lab[p]]) keep[p] = 1;
  // also keep soft fringe pixels (alpha < 40) next to kept pixels
  for (let sy = 1; sy < ch - 1; sy++) for (let sx = 1; sx < cw - 1; sx++) {
    const p = sy * cw + sx;
    if (keep[p] || lab[p] >= 0) continue;
    if (keep[p - 1] === 1 || keep[p + 1] === 1 || keep[p - cw] === 1 || keep[p + cw] === 1) keep[p] = 2;
  }
  return keep;
}

function applyMask(img, x0, y0, cw, ch, keep) {
  for (let sy = 0; sy < ch; sy++) for (let sx = 0; sx < cw; sx++)
    if (!keep[sy * cw + sx]) img.data[((y0 + sy) * img.width + x0 + sx) * 4 + 3] = 0;
}

function analyseCell(img, x0, y0, cw, ch) {
  const { width: w, data } = img;
  let minx = 1e9, miny = 1e9, maxx = -1, maxy = -1;
  const darkXs = [];
  let darkMaxY = -1, darkMinY = 1e9;
  for (let y = y0; y < y0 + ch; y++) for (let x = x0; x < x0 + cw; x++) {
    const i = (y * w + x) * 4;
    if (data[i + 3] < 40) continue;
    if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r + g + b < 110) { darkXs.push(x); if (y > darkMaxY) darkMaxY = y; if (y < darkMinY) darkMinY = y; }
  }
  if (maxx < 0) return null;
  darkXs.sort((a, b) => a - b);
  const ax = darkXs.length ? darkXs[darkXs.length >> 1] : (minx + maxx) / 2;
  const ay = darkMaxY > 0 ? darkMaxY : maxy;
  return { minx, miny, maxx, maxy, ax, ay, bodyH: darkMaxY > 0 ? darkMaxY - darkMinY : maxy - miny };
}

function downscale(src, sx, sy, sw, sh, scale, clip) {
  const dw = Math.max(1, Math.round(sw * scale)), dh = Math.max(1, Math.round(sh * scale));
  const out = png.create(dw, dh);
  const inv = 1 / scale;
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    const fx0 = sx + x * inv, fy0 = sy + y * inv;
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let yy = Math.floor(fy0); yy < Math.floor(fy0 + inv); yy++) for (let xx = Math.floor(fx0); xx < Math.floor(fx0 + inv); xx++) {
      n++;
      if (xx < clip.x0 || yy < clip.y0 || xx >= clip.x1 || yy >= clip.y1) continue;
      const i = (yy * src.width + xx) * 4, al = src.data[i + 3] / 255;
      r += src.data[i] * al; g += src.data[i + 1] * al; b += src.data[i + 2] * al; a += al;
    }
    const o = (y * dw + x) * 4;
    if (a > 0 && a / n > 0.18) {
      out.data[o] = Math.round(r / a); out.data[o + 1] = Math.round(g / a); out.data[o + 2] = Math.round(b / a);
      out.data[o + 3] = Math.round(Math.min(1, (a / n) * 1.15) * 255);
    }
  }
  return out;
}

function blit(dst, src, dx, dy) {
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
    const X = dx + x, Y = dy + y;
    if (X < 0 || Y < 0 || X >= dst.width || Y >= dst.height) continue;
    const s = (y * src.width + x) * 4, d = (Y * dst.width + X) * 4;
    if (src.data[s + 3] === 0) continue;
    src.data.copy(dst.data, d, s, s + 4);
  }
}

// Split positions: least-occupied line near each uniform split (sheets are not evenly spaced).
function splits(count, n, len) {
  const out = [0], cell = len / n;
  for (let k = 1; k < n; k++) {
    const t = k * cell;
    let best = Math.round(t), bestV = Infinity;
    for (let p = Math.round(t - cell * 0.3); p <= Math.round(t + cell * 0.3); p++) {
      const v = count[p] * 1000 + Math.abs(p - t);
      if (v < bestV) { bestV = v; best = p; }
    }
    out.push(best);
  }
  out.push(len);
  return out;
}
// Preferred splitter: find the n occupied runs (merging small gaps) and cut halfway between them.
function blobSplits(count, n, len) {
  let runs = [], start = -1, gap = 0;
  for (let i = 0; i <= len; i++) {
    const occ = i < len && count[i] > 0;
    if (occ) { if (start < 0) start = i; gap = 0; }
    else if (start >= 0) {
      gap++;
      if (gap > 14 || i === len) { runs.push([start, i - gap]); start = -1; gap = 0; }
    }
  }
  runs = runs.filter(([a, b]) => b - a > 12);
  if (runs.length !== n) return null;
  const out = [0];
  for (let k = 0; k < n - 1; k++) out.push(Math.round((runs[k][1] + runs[k + 1][0]) / 2));
  out.push(len);
  return out;
}
function projection(img, horizontal, a0, a1) {
  const n = horizontal ? img.height : img.width, count = new Float64Array(n);
  for (let y = horizontal ? 0 : a0; y < (horizontal ? img.height : a1); y++)
    for (let x = horizontal ? 0 : 0; x < img.width; x++)
      if (img.data[(y * img.width + x) * 4 + 3] >= 40) count[horizontal ? y : x]++;
  return count;
}

// Which side rows face right/left? (AI-made sheets are inconsistent.) Uses warm skin pixels
// vs dark hair in the head region: the face sits on the side the character is looking at.
function facingScore(img, s, r) {
  let score = 0;
  for (let c = 0; c < COLS; c++) {
    let top = 1e9;
    for (let y = r * s.fh; y < (r + 1) * s.fh; y++) for (let x = c * s.fw + s.ax - 14; x < c * s.fw + s.ax + 14; x++) if (img.data[(y * img.width + x) * 4 + 3] > 100) top = Math.min(top, y);
    if (top > 1e8) continue;
    let sx = 0, sn = 0, ax = 0, an = 0;
    for (let y = top; y < top + 26; y++) for (let x = c * s.fw + s.ax - 18; x < c * s.fw + s.ax + 18; x++) {
      const i = (y * img.width + x) * 4;
      if (img.data[i + 3] < 100) continue;
      const R = img.data[i], G = img.data[i + 1], B = img.data[i + 2];
      if (R < 90 && G < 90 && B < 90) { ax += x; an++; }
      if (R > 80 && R - B > 25 && G >= B) { sx += x; sn++; }
    }
    if (sn > 1 && an) score += Math.sign(sx / sn - ax / an);
  }
  return score;
}
function sideRows(img, s, base) {
  const a = facingScore(img, s, base + 2), b = facingScore(img, s, base + 3);
  if (a > 0 && b < 0) return { right: base + 2, left: base + 3, flipLeft: false, flipRight: false };
  if (a < 0 && b > 0) return { right: base + 3, left: base + 2, flipLeft: false, flipRight: false };
  if (a >= 0 && b >= 0) { const r = a >= b ? base + 2 : base + 3; return { right: r, left: r, flipLeft: true, flipRight: false }; }
  const l = a <= b ? base + 2 : base + 3;
  return { right: l, left: l, flipLeft: false, flipRight: true };
}

// Frame validation: measures the output exactly like the game will draw it.
function validate(sheet, rows) {
  const [CW, CH] = STD.canvas, [PX, PY] = STD.pivot;
  const heights = [], feet = [], centers = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < COLS; c++) {
    let t = 1e9, b = -1, xs = 0, n = 0;
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      const i = ((r * CH + y) * sheet.width + c * CW + x) * 4, d = sheet.data;
      if (d[i + 3] > 150 && d[i] + d[i + 1] + d[i + 2] < 200) { t = Math.min(t, y); b = Math.max(b, y); xs += x; n++; }
    }
    if (b < 0) continue;
    if (c === 0 || c === COLS - 1) heights.push(b - t);
    feet.push(b - PY); centers.push(xs / n - PX);
  }
  const med = (a) => a.slice().sort((p, q) => p - q)[a.length >> 1];
  const h = med(heights), feetMax = Math.max(...feet.map(Math.abs)), centerMed = med(centers);
  const issues = [];
  if (Math.abs(h - STD.bodyHeight) > 4) issues.push('Scale Difference');
  if (feetMax > 3) issues.push('Ground Offset');
  if (Math.abs(centerMed) > 6) issues.push('Pivot Offset');
  return { bodyHeight: h, feetMaxOffset: feetMax, centerOffset: Math.round(centerMed), ok: issues.length === 0, issues };
}

const [CW, CH] = STD.canvas, [PX, PY] = STD.pivot;
const atlas = { standard: STD, cols: COLS, sheets: {}, validation: {} };
for (const [name, [file, rows]] of Object.entries(SHEETS)) {
  const img = png.read(path.join(ROOT, file));
  removeBackground(img);
  const py = projection(img, true);
  const ys = blobSplits(py, rows, img.height) || splits(py, rows, img.height);
  const cells = [], neutral = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < COLS; c++) {
    const xs = c === 0 ? (cells.xs = (() => { const px = projection(img, false, ys[r], ys[r + 1]); return blobSplits(px, COLS, img.width) || splits(px, COLS, img.width); })()) : cells.xs;
    const x0 = xs[c], y0 = ys[r], w0 = xs[c + 1] - x0, h0 = ys[r + 1] - y0;
    applyMask(img, x0, y0, w0, h0, cellMask(img, x0, y0, w0, h0));
    const a = analyseCell(img, x0, y0, w0, h0);
    if (a) Object.assign(a, { x0, y0, x1: x0 + w0, y1: y0 + h0 });
    cells.push(a);
    if (a && (c === 0 || c === COLS - 1) && r % 4 < 2) neutral.push(a.bodyH); // front/back neutral poses
  }
  // one measured factor per sheet: the neutral body always becomes STD.bodyHeight
  neutral.sort((p, q) => p - q);
  const scale = STD.bodyHeight / neutral[neutral.length >> 1];
  const sheet = png.create(CW * COLS, CH * rows);
  cells.forEach((a, idx) => {
    if (!a) return;
    const r = Math.floor(idx / COLS), c = idx % COLS;
    const frame = downscale(img, a.ax - PX / scale, a.ay - PY / scale, CW / scale, CH / scale, scale, a);
    blit(sheet, frame, c * CW, r * CH);
  });
  png.write(path.join(OUT, name + '.png'), sheet);
  const sides = [];
  for (let base = 0; base < rows; base += 4) sides.push(sideRows(sheet, { fw: CW, fh: CH, ax: PX }, base));
  atlas.sheets[name] = { file: 'assets/player/' + name + '.png', fw: CW, fh: CH, rows, cols: COLS, ax: PX, ay: PY, sides, sourceScale: +scale.toFixed(4) };
  const v = validate(sheet, rows);
  atlas.validation[name] = v;
  console.log(name.padEnd(6), 'scale', scale.toFixed(3), 'body', v.bodyHeight, 'feet±', v.feetMaxOffset, 'center', v.centerOffset, v.ok ? 'OK' : '⚠ ' + v.issues.join(', '));
}
fs.writeFileSync(path.join(OUT, 'atlas.json'), JSON.stringify(atlas, null, 1));
