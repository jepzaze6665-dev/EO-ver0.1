// Converts the owner's monster sheets (desgin/monster/<route>/<map>/<file>, e.g. A/A1/1 · B/B2/BOSS) into clean, right-facing frames packed in one
// atlas per monster: assets/monsters/<id>.png + assets/monsters/monsters.json (read by src/monsters/sheetSprites.js).
// The sheets are AI images: a fake checkerboard / flat light background, rows of poses with a DIFFERENT number of
// frames per row. The tool:
//   1. measures the background tones from the sheet border and flood-fills them away from the edges
//      (grey shadows touching the background become soft black shadows),
//   2. finds the rows (horizontal gaps) and the frames in each row (vertical gaps; merged / split to the count the
//      sheet data expects),
//   3. keeps each frame's main figure + nearby effect pixels, mirrors left-facing rows, scales every frame of a
//      monster by ONE factor (neutral body height -> `height` game px) and packs them on a shared cell (feet pivot).
// Usage: node tools/build-monsters.js            (build all)
//        node tools/build-monsters.js --probe    (print detected rows / frames + preview atlases in <os tmp>/eo-monster-probe)
const fs = require('fs');
const path = require('path');
const png = require('./png.js');

const ROOT = path.join(__dirname, '..');
const SRC = 'desgin/monster/';

// Sheet data: rows in reading order. Each row = [animName, frameCount, opts?]
//   opts.flip   : the row is drawn facing LEFT -> mirror it (game frames face right)
//   opts.y      : [y0, y1] sheet px of the row (labelled / tightly packed sheets: no automatic row search);
//                 opts.x = [x0, x1] only that part of the row (e.g. the RIGHT column of a direction grid)
// `region`   : [x0, y0, x1, y1] only this part of the sheet is read (drops text labels / headers around the frames)
// `flip: true` on the sheet = every row faces left. Row opts.mirrorFrames: [i] = only those frames face the other way.
// `height`   : game px of the neutral body (row 0 frame 0 measures it); `feet` = pivot row inside the output cell.
// `anims`    : game animation -> [row name, frame indices?]; missing anims fall back in sheetSprites.js.
const SHEETS = {
  // ---------------- A1 WHISPERING FOREST
  rabbit: {
    file: 'A/A1/1', height: 22,
    rows: [['front', 5], ['back', 5], ['walk', 5, { flip: true }], ['lunge', 4, { flip: true }], ['hit', 5, { flip: true }],
      ['enrage', 5], ['death', 5, { flip: true }]],
  },
  frost_wolf: {
    file: 'A/A1/2', height: 30,
    rows: [['front', 6], ['back', 6], ['run', 5], ['bite', 4], ['hit', 5], ['howl', 5], ['death', 5]],
  },
  forest_guardian: {
    file: 'A/A1/Boss.png', height: 96,
    rows: [['idle', 9], ['walk', 7], ['claw', 6], ['charge', 5], ['roots', 7], ['beam', 7], ['corrupt', 8], ['hit', 7],
      ['death', 8], ['death_corrupt', 8]],
  },
  // B0: the owner's extra A1 sheets (they replace the old canvas-only goblins / crystal beasts / thornling look)
  leafling: {
    file: 'A/A1/3', height: 26, region: [300, 0, 2048, 2048], // labels on the left
    rows: [['views', 7], ['idle', 7], ['walk', 7], ['attack', 8], ['hit', 7], ['telegraph', 7], ['special', 7], ['death', 5]],
  },
  treant: {
    file: 'A/A1/4', height: 30, region: [380, 0, 2048, 2048], pocket: 6, clearLight: 175, // DOWN / UP / LEFT / RIGHT rows per action: the RIGHT row
    rows: [['idle', 4, { y: [294, 367] }], ['walk', 6, { y: [610, 680] }], ['attack', 5, { y: [940, 1011] }], ['hit', 3, { y: [1170, 1229] }],
      ['telegraph', 3, { y: [1416, 1487] }], ['special', 8, { y: [1672, 1750] }], ['death', 5, { y: [1952, 2022] }]],
  },
  // ---------------- A2 ASHEN BADLANDS
  armadillo: {
    file: 'A/A2/1', height: 24,
    rows: [['front', 6], ['back', 6], ['walk', 6, { flip: true }], ['walk_r', 6], ['attack', 4, { flip: true }], ['hit', 4],
      ['special', 4], ['death', 4]],
  },
  rock_rhino: {
    file: 'A/A2/2', height: 36,
    rows: [['views', 4], ['walk', 5, { flip: true }], ['gore', 5, { flip: true }], ['hit', 5, { flip: true }], ['stomp', 5, { flip: true }],
      ['death', 4, { flip: true }]],
  },
  magma_beast: {
    file: 'A/A2/boss', height: 80, flip: true, // drawn facing left on every row
    rows: [['idle', 8], ['walk', 8], ['run', 7], ['bite', 7], ['eruption', 7], ['fireball', 8], ['hit', 5], ['stagger', 7],
      ['enrage', 7], ['death', 8]],
  },
  quill_lizard: {
    file: 'A/A2/3', height: 26,
    rows: [['front', 6], ['back', 6], ['walk', 6, { flip: true }], ['leap', 6, { flip: true }], ['attack', 6, { flip: true }], ['hit', 6, { flip: true }],
      ['spikes', 5], ['spin', 5, { flip: true }], ['death', 6, { flip: true }]],
  },
  burrower: {
    file: 'A/A2/4', height: 30, // direction COLUMNS: the RIGHT column of every action row
    rows: [['idle', 1, { y: [149, 352], x: [1540, 2048] }], ['walk', 3, { y: [452, 616], x: [1540, 2048] }], ['attack', 2, { y: [712, 916], x: [1540, 2048] }],
      ['hit', 2, { y: [1020, 1172], x: [1540, 2048] }], ['telegraph', 2, { y: [1292, 1444], x: [1540, 2048] }], ['special', 1, { y: [1560, 1732], x: [1540, 2048] }],
      ['death', 2, { y: [1832, 1952], x: [1540, 1830] }]],
  },
  // ---------------- A3 RUNE CITADEL
  crystal_golem: {
    file: 'A/A3/1', height: 38,
    rows: [['front', 6], ['back', 6], ['side', 6], ['side_b', 6], ['special', 5], ['death', 5]],
  },
  bronze_hoplite: {
    file: 'A/A3/2', height: 40,
    rows: [['front', 7], ['back', 7], ['side', 7, { flip: true }], ['side_b', 7, { flip: true }], ['attack', 7, { mirrorFrames: [6] }], ['hit', 6], ['death', 6]],
  },
  void_scarab: {
    file: 'A/A3/3', height: 24, region: [150, 440, 2048, 2048], // rows = directions; columns = idle | walk×2 | attack | hit | telegraph | special | death×3
    rows: [['down', 10, { y: [472, 667] }], ['right', 10, { y: [1495, 1668] }]],
  },
  rune_wisp: {
    file: 'A/A3/4', height: 30,
    rows: [['idle', 4], ['idle_b', 4], ['dash', 4], ['hit', 4], ['telegraph', 4], ['breath', 4], ['death', 4]],
  },
  rune_knight: {
    file: 'A/A3/BOSS', height: 84,
    rows: [['idle', 8], ['walk', 8], ['lunge', 7], ['slash', 7], ['combo', 8], ['nova', 7], ['guard', 7], ['stance', 7],
      ['death', 8]],
  },
};

// ---------------------------------------------------------------- background
function neutral(d, i) { return Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]); }
function lum(d, i) { return (d[i] + d[i + 1] + d[i + 2]) / 3; }

function measureBackground(img) {
  const { width: w, height: h, data } = img;
  const hist = new Map();
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
    if (x > 30 && y > 30 && x < w - 30 && y < h - 30) continue;
    const i = (y * w + x) * 4;
    if (neutral(data, i) > 14) continue;
    const k = Math.round(lum(data, i) / 4) * 4;
    hist.set(k, (hist.get(k) || 0) + 1);
  }
  const total = [...hist.values()].reduce((a, b) => a + b, 0);
  const tones = [...hist].filter(([, n]) => n > total * 0.04).map(([k]) => k);
  return { lo: Math.min(...tones) - 10, hi: Math.max(...tones) + 10 };
}

function removeBackground(img, pocket = 40) {
  const { width: w, height: h, data } = img;
  const bg = measureBackground(img);
  const isBg = (p) => { const i = p * 4, l = lum(data, i); return neutral(data, i) <= 16 && l >= bg.lo && l <= bg.hi; };
  const mark = new Uint8Array(w * h); // 1 = background, 2 = shadow
  const st = [];
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) { const p = y * w + x; if (isBg(p)) { mark[p] = 1; st.push(p); } }
  for (let y = 0; y < h; y++) for (const x of [0, w - 1]) { const p = y * w + x; if (!mark[p] && isBg(p)) { mark[p] = 1; st.push(p); } }
  const flood = (test, val) => {
    while (st.length) {
      const p = st.pop(), x = p % w;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) {
        if (q < 0 || q >= w * h || mark[q]) continue;
        if (test(q)) { mark[q] = val; st.push(q); }
      }
    }
  };
  flood(isBg, 1);
  // enclosed background pockets (between legs / arms): strict tone match, large enough to be background
  const seen = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) {
    if (mark[p] || seen[p] || !isBg(p)) continue;
    const comp = [p]; seen[p] = 1;
    for (let k = 0; k < comp.length; k++) {
      const q0 = comp[k], x = q0 % w;
      for (const q of [x > 0 ? q0 - 1 : -1, x < w - 1 ? q0 + 1 : -1, q0 - w, q0 + w]) {
        if (q < 0 || q >= w * h || seen[q] || mark[q] || !isBg(q)) continue;
        seen[q] = 1; comp.push(q);
      }
    }
    if (comp.length >= pocket) for (const q of comp) mark[q] = 1; // sheet `pocket`: small sprites need a smaller size
  }
  // soft grey shadows touching the background -> translucent black
  for (let p = 0; p < w * h; p++) if (mark[p] === 1) st.push(p);
  const isShadow = (p) => { const i = p * 4, l = lum(data, i); return neutral(data, i) <= 14 && l < bg.lo && l > bg.lo * 0.45; };
  flood(isShadow, 2);
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (mark[p] === 1) { data[i + 3] = 0; continue; }
    if (mark[p] === 2) {
      const a = Math.min(0.55, (bg.lo - lum(data, i)) / bg.lo * 1.1);
      data[i] = data[i + 1] = data[i + 2] = 0; data[i + 3] = Math.round(a * 255);
      continue;
    }
    // light fringe on the figure edge (anti-aliased into the background): fade it
    const x = p % w;
    const edge = (x > 0 && mark[p - 1] === 1) || (x < w - 1 && mark[p + 1] === 1) || (p >= w && mark[p - w] === 1) || (p < w * (h - 1) && mark[p + w] === 1);
    if (edge && neutral(data, i) < 24 && lum(data, i) > bg.lo - 30) data[i + 3] = 90;
  }
  return bg;
}

// ---------------------------------------------------------------- segmentation
const SOLID = 60; // alpha counted as "content" (shadows stay below it)
function projection(img, x0, y0, x1, y1, axis) {
  const n = axis === 'y' ? y1 - y0 : x1 - x0;
  const out = new Float64Array(n);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++)
    if (img.data[(y * img.width + x) * 4 + 3] >= SOLID) out[axis === 'y' ? y - y0 : x - x0]++;
  return out;
}
function runs(proj, minGap) {
  const segs = [];
  let s = -1, gap = 0;
  for (let i = 0; i <= proj.length; i++) {
    const on = i < proj.length && proj[i] > 0;
    if (on) { if (s < 0) s = i; gap = 0; } else if (s >= 0) {
      gap++;
      if (gap >= minGap || i === proj.length) { segs.push([s, i - gap + 1]); s = -1; gap = 0; }
    }
  }
  return segs.map(([a, b]) => ({ a, b, mass: proj.slice(a, b).reduce((x, y) => x + y, 0) }));
}
// force the segment list to `n`: drop dust (tiny mass), merge the lightest into its neighbour, split the widest
function fitSegments(segs, proj, n) {
  segs = segs.filter((s) => s.mass > 40);
  while (segs.length > n) {
    let k = 0;
    segs.forEach((s, i) => { if (s.mass < segs[k].mass) k = i; });
    const j = k === 0 ? 1 : k === segs.length - 1 ? k - 1 : (segs[k].a - segs[k - 1].b < segs[k + 1].a - segs[k].b ? k - 1 : k + 1);
    const [l, r] = [Math.min(j, k), Math.max(j, k)];
    segs.splice(l, 2, { a: segs[l].a, b: segs[r].b, mass: segs[l].mass + segs[r].mass });
  }
  while (segs.length < n) {
    let k = 0;
    segs.forEach((s, i) => { if (s.b - s.a > segs[k].b - segs[k].a) k = i; });
    const s = segs[k], len = s.b - s.a;
    let best = -1, bv = 1e9;
    for (let i = s.a + Math.floor(len * 0.25); i < s.b - Math.floor(len * 0.25); i++) if (proj[i] < bv) { bv = proj[i]; best = i; }
    const m1 = proj.slice(s.a, best).reduce((x, y) => x + y, 0);
    segs.splice(k, 1, { a: s.a, b: best, mass: m1 }, { a: best, b: s.b, mass: s.mass - m1 });
  }
  return segs;
}

function findFrames(img, def) {
  const given = def.rows.every((r) => r[2] && r[2].y);
  let rows;
  if (given) rows = def.rows.map((r) => ({ a: r[2].y[0], b: r[2].y[1] }));
  else {
    const rowsP = projection(img, 0, 0, img.width, img.height, 'y');
    rows = fitSegments(runs(rowsP, 6), rowsP, def.rows.length);
  }
  const out = [];
  rows.forEach((r, ri) => {
    const [name, count, opts = {}] = def.rows[ri];
    const [x0, x1] = opts.x || [0, img.width];
    const colP = projection(img, x0, r.a, x1, r.b, 'x');
    const cols = fitSegments(runs(colP, 5), colP, count);
    out.push({ name, y0: r.a, y1: r.b, cols: cols.map((c) => [c.a + x0, c.b + x0]), found: runs(colP, 5).filter((s) => s.mass > 40).length });
  });
  return out;
}

// ---------------------------------------------------------------- frame extraction
function crop(img, x0, y0, x1, y1) {
  const w = x1 - x0, h = y1 - y0, o = png.create(w, h);
  for (let y = 0; y < h; y++) img.data.copy(o.data, y * w * 4, ((y0 + y) * img.width + x0) * 4, ((y0 + y) * img.width + x1) * 4);
  return o;
}
function bbox(im) {
  let minx = 1e9, miny = 1e9, maxx = -1, maxy = -1;
  for (let y = 0; y < im.height; y++) for (let x = 0; x < im.width; x++) {
    if (im.data[(y * im.width + x) * 4 + 3] < SOLID) continue;
    if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
  }
  return maxx < 0 ? null : { minx, miny, maxx, maxy };
}
function mirror(im) {
  const o = png.create(im.width, im.height);
  for (let y = 0; y < im.height; y++) for (let x = 0; x < im.width; x++)
    im.data.copy(o.data, (y * im.width + (im.width - 1 - x)) * 4, (y * im.width + x) * 4, (y * im.width + x) * 4 + 4);
  return o;
}
// area-average downscale with alpha-weighted colour (pixel art stays crisp enough at these ratios)
function scaleImage(im, s) {
  const w = Math.max(1, Math.round(im.width * s)), h = Math.max(1, Math.round(im.height * s));
  const o = png.create(w, h), inv = 1 / s;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx0 = x * inv, sy0 = y * inv, sx1 = Math.min(im.width, sx0 + inv), sy1 = Math.min(im.height, sy0 + inv);
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let yy = Math.floor(sy0); yy < sy1; yy++) for (let xx = Math.floor(sx0); xx < sx1; xx++) {
      const i = (yy * im.width + xx) * 4, al = im.data[i + 3];
      r += im.data[i] * al; g += im.data[i + 1] * al; b += im.data[i + 2] * al; a += al; n++;
    }
    const i = (y * w + x) * 4;
    if (a > 0) { o.data[i] = r / a; o.data[i + 1] = g / a; o.data[i + 2] = b / a; }
    o.data[i + 3] = n ? Math.round(a / n) : 0;
    if (o.data[i + 3] < 24) o.data[i + 3] = 0;
  }
  return o;
}
function blit(dst, src, dx, dy) {
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
    const X = dx + x, Y = dy + y;
    if (X < 0 || Y < 0 || X >= dst.width || Y >= dst.height) continue;
    const si = (y * src.width + x) * 4;
    if (!src.data[si + 3]) continue;
    src.data.copy(dst.data, (Y * dst.width + X) * 4, si, si + 4);
  }
}

// ground line of a frame = lowest row that is mostly body (ignores thin dust / effects under the feet)
function feetOf(im, bb) {
  let best = bb.maxy;
  const need = Math.max(3, (bb.maxx - bb.minx) * 0.12);
  for (let y = bb.maxy; y > bb.miny; y--) {
    let n = 0;
    for (let x = bb.minx; x <= bb.maxx; x++) if (im.data[(y * im.width + x) * 4 + 3] >= 200) n++;
    if (n >= need) { best = y; break; }
  }
  return best;
}
// horizontal body centre = median x of opaque pixels in the lower half
function centreOf(im, bb) {
  const xs = [];
  for (let y = Math.floor((bb.miny + bb.maxy) / 2); y <= bb.maxy; y++) for (let x = bb.minx; x <= bb.maxx; x++)
    if (im.data[(y * im.width + x) * 4 + 3] >= 200) xs.push(x);
  xs.sort((a, b) => a - b);
  return xs.length ? xs[xs.length >> 1] : (bb.minx + bb.maxx) / 2;
}

function buildMonster(id, def, probe) {
  const img = png.read(path.join(ROOT, SRC, def.file));
  const bg = removeBackground(img, def.pocket);
  if (def.clearLight) { // blurry sheets: light grey-white gaps between limbs (never real colour) become transparent
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] && (d[i] + d[i + 1] + d[i + 2]) / 3 >= def.clearLight && Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) <= 40) d[i + 3] = 0;
  }
  if (def.region) { // everything outside the region (labels, headers) is dropped
    const [x0, y0, x1, y1] = def.region;
    for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if (x < x0 || x >= x1 || y < y0 || y >= y1) img.data[(y * img.width + x) * 4 + 3] = 0;
  }
  const rows = findFrames(img, def);
  if (probe) {
    console.log(`${id} (${def.file}) bg ${bg.lo}-${bg.hi}`);
    for (const r of rows) console.log(`  ${r.name.padEnd(14)} y ${r.y0}-${r.y1}  frames ${r.cols.length} (gaps found ${r.found})  w ${r.cols.map(([a, b]) => b - a).join(',')}`);
  }
  // cut every frame
  const frames = [];
  rows.forEach((r, ri) => {
    const opts = { flip: def.flip, ...(def.rows[ri][2] || {}) };
    r.cols.forEach(([a, b], ci) => {
      let im = crop(img, a, r.y0, b, r.y1);
      if (opts.flip) im = mirror(im);
      if (opts.mirrorFrames && opts.mirrorFrames.includes(ci)) im = mirror(im);
      const bb = bbox(im);
      if (!bb) return;
      frames.push({ row: r.name, i: ci, im, bb, feet: feetOf(im, bb), cx: centreOf(im, bb) });
    });
  });
  // one scale per monster: the first frame's body height -> def.height
  const ref = frames[0];
  const s = def.height / (ref.feet - ref.bb.miny + 1);
  // shared cell: big enough for every frame around the pivot
  let left = 0, right = 0, up = 0, down = 0;
  for (const f of frames) {
    left = Math.max(left, (f.cx - f.bb.minx) * s); right = Math.max(right, (f.bb.maxx - f.cx) * s);
    up = Math.max(up, (f.feet - f.bb.miny) * s); down = Math.max(down, (f.bb.maxy - f.feet) * s);
  }
  const ax = Math.ceil(Math.max(left, right)) + 2, ay = Math.ceil(up) + 2;
  const fw = ax * 2, fh = ay + Math.ceil(down) + 2;
  const cols = Math.max(...rows.map((r) => r.cols.length));
  const atlas = png.create(fw * cols, fh * rows.length);
  const anims = {};
  for (const f of frames) {
    const sub = crop(f.im, f.bb.minx, f.bb.miny, f.bb.maxx + 1, f.bb.maxy + 1);
    const sc = scaleImage(sub, s);
    const ri = rows.findIndex((r) => r.name === f.row);
    const dx = f.i * fw + Math.round(ax - (f.cx - f.bb.minx) * s);
    const dy = ri * fh + Math.round(ay - (f.feet - f.bb.miny) * s);
    blit(atlas, sc, dx, dy);
    (anims[f.row] = anims[f.row] || []).push([f.i * fw, ri * fh]);
  }
  const outDir = probe ? path.join(require('os').tmpdir(), 'eo-monster-probe') : path.join(ROOT, 'assets/monsters');
  fs.mkdirSync(outDir, { recursive: true });
  png.write(path.join(outDir, id + '.png'), atlas);
  return { file: `assets/monsters/${id}.png`, fw, fh, ax, ay, scale: +s.toFixed(4), anims };
}

if (require.main === module) {
  const probe = process.argv.includes('--probe');
  const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const meta = {};
  const metaFile = path.join(ROOT, 'assets/monsters/monsters.json');
  if (!probe && only.length && fs.existsSync(metaFile)) Object.assign(meta, JSON.parse(fs.readFileSync(metaFile, 'utf8')));
  for (const [id, def] of Object.entries(SHEETS)) {
    if (only.length && !only.includes(id)) continue;
    meta[id] = buildMonster(id, def, probe);
    console.log(`${id}: ${Object.keys(meta[id].anims).length} anims, cell ${meta[id].fw}x${meta[id].fh}`);
  }
  if (!probe) fs.writeFileSync(metaFile, JSON.stringify(meta, null, 1));
}
// shared with tools/build-boss-vfx.js
module.exports = { SHEETS, removeBackground, projection, runs, fitSegments, crop, scaleImage, bbox, mirror };

