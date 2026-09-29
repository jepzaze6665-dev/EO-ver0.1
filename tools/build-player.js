// Converts raw class sheets (fake-checkerboard background, 6 columns, 4-row direction groups)
// into clean alpha sprite strips + an atlas description consumed by src/player/playerSprites.js.
// Every class preset is normalised to the SAME visual standard (body height, canvas, pivot).
// Usage: node tools/build-player.js            (all classes)
//        node tools/build-player.js aw         (one class: ub | aw | ag | rp | dr | be | wd | bs)
const fs = require('fs');
const path = require('path');
const png = require('./png.js');

const ROOT = path.join(__dirname, '..');

// CHARACTER VISUAL STANDARD (shared by every animation)
const STD = {
  bodyHeight: 60,          // neutral-pose body height in game pixels (all sheets normalised to this)
  canvas: [160, 160],      // every frame of every animation uses this canvas (room for staff swings / magic circles)
  pivot: [80, 140],        // feet-centre pivot inside the canvas (ground line y = 140, 20 px below for floor effects)
};
// class preset -> output folder + sheets (name -> [file, rows])
const PRESETS = {};
PRESETS.ub = { out: 'assets/player', sheets: {
  walk: ['desgin/class cr/UB/UB/UB WALK1.png', 4],
  run: ['desgin/class cr/UB/UB/UB WALK2', 4],
  atk1: ['desgin/class cr/UB/UB/UB ATK1', 4],
  atk2: ['desgin/class cr/UB/UB/UB ATK2', 4],
  guard: ['desgin/class cr/UB/UB/UB DF', 4],
  hit: ['desgin/class cr/UB/UB/UB HIT', 4],
  pr: ['desgin/class cr/UB/UB/UB PR', 4],
  sk1: ['desgin/class cr/UB/UB/UB SK1.png', 4],
  sk2: ['desgin/class cr/UB/UB/UB SK2.png', 4],
  sk3: ['desgin/class cr/UB/UB/UB SK3.PNG', 4],
  sk4: ['desgin/class cr/UB/UB/UB SK4.png', 4],
  sk5: ['desgin/class cr/UB/UB/UB SK5.png', 4],
  sk6: ['desgin/class cr/UB/UB/UB SK6.png', 4, { frames: 5 }], // the explosion frame is drawn double-wide: 5 frames per row
  ult: ['desgin/class cr/UB/UB/UB UT.png', 4],
  vfx: ['desgin/class cr/UB/UB/UB VFX', 8],
} };
// Aegis Guardian — the owner's new AG set (2026-09-29): silver armour, blue cape, blue / gold shield in every sheet.
// No separate idle / 2nd attack / parry sheet: idle = walk col 0, ATK1 holds all 3 combo cuts, DEF holds guard + riposte.
const AGN = 'desgin/class cr/AG/AG NEW/';
// nearestBody: the thrust / swing blades are drawn a pixel away from the hand (see componentFrames)
// bg: flat near-white sheets + silver armour -> only near-white is background, pockets in the armour are kept
PRESETS.ag = { out: 'assets/player/ag', nearestBody: true, bg: { strict: 245, strictSat: 7, loose: 238, looseSat: 9, holes: 400 }, sheets: {
  walk: [AGN + 'walk1.png', 4],
  // ATK1: row 2's cuts go RIGHT with the head turned right; row 3 cuts left but looks right (head "turns wrong") ->
  // both sides use row 2, mirrored for the left
  atk1: [AGN + 'ATK1', 4, { facing: { right: 2, left: 2, flipLeft: true } }],
  guard: [AGN + 'DEF', 4],
  dash: [AGN + 'DASH', 4],
  hit: [AGN + 'HIT', 4],
  sk1: [AGN + 'SK1', 4, { facing: { right: 3, left: 3, flipLeft: true } }], // row 2 looks left but bashes right
  sk2: [AGN + 'SK2', 4],
  sk3: [AGN + 'SK3', 4],
  sk4: [AGN + 'SK4', 4],
  sk5: [AGN + 'SK5', 4],
  sk6: [AGN + 'SK6', 4],
  ult: [AGN + 'UT', 4],
} };
// Nightfall Reaper (Class 2 of Umbral Sword)
// facing: the hood hides the face, so the skin-based side detection cannot tell left from right —
// the RP sheets draw row 2 facing LEFT and row 3 facing RIGHT (both drawn, no mirroring needed).
const RP = 'desgin/class cr/UB/RP/';
PRESETS.rp = { out: 'assets/player/rp', facing: { right: 3, left: 2 }, sheets: {
  walk: [RP + 'WALK1.PNG', 4],
  idle: [RP + 'WALK2.PNG', 4],
  atk1: [RP + 'ATK1', 4],
  atk2: [RP + 'ATK2', 4],
  dash: [RP + 'DASH', 4, { frames: 5 }], // 5 poses per row
  hit: [RP + 'HIT', 4],
  extra: [RP + 'เสริม', 4],
  sk1: [RP + 'SK1', 4],
  sk2: [RP + 'SK2', 4],
  sk3: [RP + 'SK3', 4],
  sk4: [RP + 'SK4', 4],
  sk5: [RP + 'SK5', 4],
  sk6: [RP + 'SK6', 4],
  ult: [RP + 'UT', 4],
} };
// Duskrunner (Class 2 of Umbral Sword): twin blue dusk blades, blue scarf
const DR = 'desgin/class cr/UB/DR/';
PRESETS.dr = { out: 'assets/player/dr', sheets: {
  walk: [DR + 'walk 1.png', 4],
  idle: [DR + 'walk2', 4],
  atk1: [DR + 'atk1', 4],
  atk2: [DR + 'atk2', 4, { frames: 5 }], // 5 poses per row
  dash: [DR + 'dash', 4],
  hit: [DR + 'hit', 4],
  sk1: [DR + 'sk1', 4],
  sk2: [DR + 'sk2', 4],
  sk3: [DR + 'sk3', 4],
  sk4: [DR + 'sk4', 4],
  sk5: [DR + 'sk5', 4],
  sk6: [DR + 'sk6', 4],
  ult: [DR + 'ut', 4],
} };
// Blade of Echoes (Class 2 of Umbral Sword): long crimson memory blade, white / red coat
const BE = 'desgin/class cr/UB/BE/';
// nearestBody: its long blade is often drawn a pixel away from the hand (see componentFrames)
PRESETS.be = { out: 'assets/player/be', nearestBody: true, sheets: {
  walk: [BE + 'walk1.png', 4],
  idle: [BE + 'walk2', 4],
  atk1: [BE + 'atk1', 4],
  atk2: [BE + 'atk2', 4, { frames: 5 }], // 5 poses per row
  dash: [BE + 'dash', 4],
  hit: [BE + 'hit', 4],
  sk1: [BE + 'sk1', 4],
  sk2: [BE + 'sk2', 4],
  sk3: [BE + 'sk3', 4],
  sk4: [BE + 'sk4', 4],
  sk5: [BE + 'sk5', 4],
  sk6: [BE + 'sk6', 4],
  ult: [BE + 'ut', 4],
} };
// Warden of Dawn (Class 2 of Aegis Guardian): silver plate, white / blue dawn shield, holy sword. Same flat white
// sheets + silver armour as AG -> the same tight background rule.
// facing: row 3 is the only side row drawn consistently (row 2 turns its head / cuts the other way, DASH / SK2 draw
// both rows facing right) -> row 3 = right, mirrored for the left, so the head always faces the blow
const WD = 'desgin/class cr/AG/WD/';
PRESETS.wd = { out: 'assets/player/wd', nearestBody: true, bg: PRESETS.ag.bg, facing: { right: 3, left: 3, flipLeft: true }, sheets: {
  walk: [WD + 'WALK 1', 4],
  atk1: [WD + 'ATK1', 4],
  atk2: [WD + 'ATK2', 4],
  dash: [WD + 'DASH', 4],
  hit: [WD + 'HIT', 4],
  sk1: [WD + 'SK1', 4],
  sk2: [WD + 'SK2', 4],
  sk3: [WD + 'SK3', 4],
  sk4: [WD + 'SK4', 4],
  sk5: [WD + 'SK5', 4],
  sk6: [WD + 'SK6', 4],
  ult: [WD + 'UT', 4],
} };
// Bulwark Sentinel (Class 2 of Aegis Guardian): gold / steel fortress plate, tower shield, bastion sword
const BS = 'desgin/class cr/AG/BS/';
PRESETS.bs = { out: 'assets/player/bs', nearestBody: true, bg: PRESETS.ag.bg, sheets: {
  walk: [BS + 'WALK 1', 4],
  idle: [BS + 'WALK 2', 4],
  atk1: [BS + 'ATK1', 4],
  atk2: [BS + 'ATK2', 4],
  dash: [BS + 'DASH', 4],
  hit: [BS + 'HIT', 4],
  sk1: [BS + 'SK1', 4],
  sk2: [BS + 'SK2', 4],
  sk3: [BS + 'SK3', 4],
  sk4: [BS + 'SK4', 4],
  sk5: [BS + 'SK5', 4],
  sk6: [BS + 'SK6', 4],
  ult: [BS + 'UT', 4],
} };
const AW = 'desgin/class cr/AW/';
PRESETS.aw = { out: 'assets/player/aw', sheets: {
  walk: [AW + 'AW2', 4],
  atk1: [AW + 'AW1.PNG', 4],
  atk2: [AW + 'AW3', 4],
  cast: [AW + 'AW4', 4],
  hit: [AW + 'aw5', 4],
  sk1: [AW + 'sk1', 4],
  sk2: [AW + 'sk2', 4],
  sk3: [AW + 'sk3', 4],
  sk4: [AW + 'sk4', 4],
  sk5: [AW + 'sk5', 4],
  sk6: [AW + 'sk6', 4],
  ult: [AW + 'ut', 4],
} };
const COLS = 6;

// DEFAULT_BG: grey fake-checkerboard sheets. A preset whose art has light grey / silver parts (AG armour) passes a
// tighter `bg` (only near-white counts) + `holes`: after the fill, background pockets smaller than that many source px
// that only reach the real background through a 1-px gap are put back (armour highlights were read as background).
const DEFAULT_BG = { strict: 212, strictSat: 20, loose: 175, looseSat: 26 };
function removeBackground(img, bg = DEFAULT_BG) {
  const { width: w, height: h, data } = img;
  const isBg = (i, loose) => {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const mn = Math.min(r, g, b), mx = Math.max(r, g, b);
    return loose ? mn > bg.loose && mx - mn < bg.looseSat : mn > bg.strict && mx - mn < bg.strictSat;
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
  if (bg.holes) fillPockets(mark, w, h, bg.holes);
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

// Background pockets inside the figure: erode the background mask by 1 px (cuts 1-2 px channels), label what is
// left, and give back every marked pixel that is not within 1 px of a LARGE eroded region.
function fillPockets(mark, w, h, minArea) {
  const er = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const p = y * w + x;
    if (mark[p] && mark[p - 1] && mark[p + 1] && mark[p - w] && mark[p + w] && mark[p - w - 1] && mark[p - w + 1] && mark[p + w - 1] && mark[p + w + 1]) er[p] = 1;
  }
  // border rows / columns: keep as background (the sheet edge is always background)
  for (let x = 0; x < w; x++) { if (mark[x]) er[x] = 1; if (mark[(h - 1) * w + x]) er[(h - 1) * w + x] = 1; }
  for (let y = 0; y < h; y++) { if (mark[y * w]) er[y * w] = 1; if (mark[y * w + w - 1]) er[y * w + w - 1] = 1; }
  const big = new Uint8Array(w * h), seen = new Uint8Array(w * h), comp = [];
  for (let p0 = 0; p0 < w * h; p0++) {
    if (!er[p0] || seen[p0]) continue;
    comp.length = 0; comp.push(p0); seen[p0] = 1;
    for (let k = 0; k < comp.length; k++) {
      const p = comp[k], x = p % w, y = (p / w) | 0;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) if (q >= 0 && er[q] && !seen[q]) { seen[q] = 1; comp.push(q); }
    }
    if (comp.length >= minArea) for (const p of comp) big[p] = 1;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x;
    if (!mark[p] || big[p]) continue;
    let near = false;
    for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && big[ny * w + nx]) near = true;
    }
    if (!near) mark[p] = 0;
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

// FEATHER: effects that cross a source cell border fade out over this many output px
// instead of ending on a hard straight line.
const FEATHER = 4;
function downscale(src, sx, sy, sw, sh, scale, clip) {
  const dw = Math.max(1, Math.round(sw * scale)), dh = Math.max(1, Math.round(sh * scale));
  const out = png.create(dw, dh);
  const inv = 1 / scale, F = FEATHER * inv;
  // only real cell borders feather (not the outer edge of the sheet)
  const fx0 = clip.x0 > 0, fy0 = clip.y0 > 0, fx1 = clip.x1 < src.width, fy1 = clip.y1 < src.height;
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    const fx0 = sx + x * inv, fy0 = sy + y * inv;
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let yy = Math.floor(fy0); yy < Math.floor(fy0 + inv); yy++) for (let xx = Math.floor(fx0); xx < Math.floor(fx0 + inv); xx++) {
      n++;
      if (xx < clip.x0 || yy < clip.y0 || xx >= clip.x1 || yy >= clip.y1) continue;
      let edge = Infinity;
      if (fx0) edge = Math.min(edge, xx - clip.x0); if (fx1) edge = Math.min(edge, clip.x1 - 1 - xx);
      if (fy0) edge = Math.min(edge, yy - clip.y0); if (fy1) edge = Math.min(edge, clip.y1 - 1 - yy);
      const i = (yy * src.width + xx) * 4, al = (src.data[i + 3] / 255) * Math.min(1, edge / F);
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

// height of the dark body (same rule as validate()) in one downscaled frame
function darkHeight(f) {
  let t = 1e9, b = -1;
  for (let y = 0; y < f.height; y++) for (let x = 0; x < f.width; x++) {
    const i = (y * f.width + x) * 4, d = f.data;
    if (d[i + 3] > 150 && d[i] + d[i + 1] + d[i + 2] < 200) { if (y < t) t = y; if (y > b) b = y; }
  }
  return b < 0 ? 0 : b - t;
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
  // detached sparks / projectiles make extra runs: merge the lightest run into its closest neighbour
  const mass = (r) => { let m = 0; for (let i = r[0]; i <= r[1]; i++) m += count[i]; return m; };
  while (runs.length > n) {
    let k = 0;
    runs.forEach((r, i) => { if (mass(r) < mass(runs[k])) k = i; });
    const gl = k > 0 ? runs[k][0] - runs[k - 1][1] : Infinity, gr = k < runs.length - 1 ? runs[k + 1][0] - runs[k][1] : Infinity;
    const j = gl <= gr ? k - 1 : k + 1, lo = Math.min(j, k);
    runs.splice(lo, 2, [runs[lo][0], runs[lo + 1][1]]);
  }
  if (runs.length !== n) return null;
  const out = [0];
  for (let k = 0; k < n - 1; k++) out.push(Math.round((runs[k][1] + runs[k + 1][0]) / 2));
  out.push(len);
  return out;
}
// column projection of the character BODY only (dark robe / hair) — bright skill effects that reach
// into neighbouring cells or float between frames never move the frame boundaries
function bodyProjection(img, a0, a1) {
  const count = new Float64Array(img.width);
  for (let y = a0; y < a1; y++) for (let x = 0; x < img.width; x++) {
    const i = (y * img.width + x) * 4, d = img.data;
    if (d[i + 3] >= 200 && d[i] + d[i + 1] + d[i + 2] < 150) count[x]++;
  }
  return count;
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
    if ((c === 0 || c === COLS - 1) && r % 4 < 2) heights.push(b - t); // neutral front/back poses — the same frames the scale is measured on
    feet.push(b - PY); centers.push(xs / n - PX);
  }
  const med = (a) => a.slice().sort((p, q) => p - q)[a.length >> 1];
  // feet: 90th percentile, so one or two frames with a dark effect under the feet (a dome rim, shadow smoke)
  // are not reported, while a real alignment error (many frames off the ground line) still is
  const absFeet = feet.map(Math.abs).sort((p, q) => p - q);
  const h = med(heights), feetMax = absFeet[Math.floor((absFeet.length - 1) * 0.9)], centerMed = med(centers);
  const issues = [];
  if (Math.abs(h - STD.bodyHeight) > 4) issues.push('Scale Difference');
  if (feetMax > 3) issues.push('Ground Offset');
  if (Math.abs(centerMed) > 6) issues.push('Pivot Offset');
  return { bodyHeight: h, feetMaxOffset: feetMax, centerOffset: Math.round(centerMed), ok: issues.length === 0, issues };
}

// Splits one row band into frames by OWNERSHIP instead of straight cuts: every connected blob of
// pixels belongs to the frame whose character body it contains (or, for loose effects such as
// magic circles, sparks and constellations, the frame its centre falls in). A frame may therefore
// be wider than its grid cell and effects are never sliced. Returns one cropped RGBA image per frame.
// opts.nearestBody: a loose piece without a body in it (a blade drawn a pixel away from the hand) goes to the body it
// is closest to (pixel distance, up to NEAREST_R px) instead of the cell holding most of it — otherwise a long blade
// that crosses a cell split lands in the NEXT frame (hand cut off here, a floating sword there).
const NEAREST_R = 40;
function componentFrames(img, y0, y1, xs, n = COLS, opts = {}) {
  const W = img.width, H = y1 - y0, d = img.data;
  const lab = new Int32Array(W * H).fill(-1), comps = [];
  const at = (x, y) => ((y0 + y) * W + x) * 4;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x;
    if (lab[p] >= 0 || d[at(x, y) + 3] < 40) continue;
    const id = comps.length, c = { n: 0, sx: 0, dark: new Float64Array(n), dx: new Float64Array(n), dy: new Float64Array(n), dMin: 1e9, dMax: -1, minx: x, maxx: x, miny: y, maxy: y };
    comps.push(c);
    const st = [p]; lab[p] = id;
    while (st.length) {
      const q = st.pop(), qx = q % W, qy = (q / W) | 0, i = at(qx, qy);
      c.n++; c.sx += qx;
      if (qx < c.minx) c.minx = qx; if (qx > c.maxx) c.maxx = qx; if (qy < c.miny) c.miny = qy; if (qy > c.maxy) c.maxy = qy;
      if (d[i + 3] >= 200 && d[i] + d[i + 1] + d[i + 2] < 150) {
        let k = 0; while (k < n - 1 && qx >= xs[k + 1]) k++;
        c.dark[k]++; c.dx[k] += qx; c.dy[k] += qy;
      }
      if (d[i + 3] >= 40 && d[i] + d[i + 1] + d[i + 2] < 110) { if (qy < c.dMin) c.dMin = qy; if (qy > c.dMax) c.dMax = qy; }
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = qx + dx, ny = qy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const r = ny * W + nx;
        if (lab[r] < 0 && d[at(nx, ny) + 3] >= 40) { lab[r] = id; st.push(r); }
      }
    }
  }
  // owner: the cell holding most of the blob's body pixels, else the cell containing its centre.
  // A blob that contains SEVERAL bodies (an effect touching two frames) is split per pixel:
  // each pixel goes to the nearest body centre (owner = -2 marks such blobs).
  const BODY_MIN = 200;
  const bodies = comps.map((c) => { const b = []; c.dark.forEach((m, k) => { if (m >= BODY_MIN) b.push({ k, x: c.dx[k] / m, y: c.dy[k] / m }); }); return b; });
  const owner = comps.map((c, i) => {
    if (c.n < 6) return -1; // dust
    if (bodies[i].length > 1) return -2;
    let best = -1, bm = 29;
    c.dark.forEach((m, k) => { if (m > bm) { bm = m; best = k; } });
    if (best >= 0) return best;
    const cx = c.sx / c.n; let k = 0; while (k < n - 1 && cx >= xs[k + 1]) k++; return k;
  });
  if (opts.nearestBody) {
    // the character of frame k = the blob with the most body (dark) pixels in cell k; every other blob is a loose piece
    const main = [...Array(n)].map((_, k) => { let best = -1; comps.forEach((c, i) => { if (c.dark[k] >= BODY_MIN && (best < 0 || c.dark[k] > comps[best].dark[k])) best = i; }); return best; });
    const isMain = new Set(main.filter((i) => i >= 0));
    // a blob only holds the bodies it is the MAIN blob of: a dark blade crossing a split is not a second character
    comps.forEach((c, i) => {
      if (owner[i] === -1) return;
      bodies[i] = bodies[i].filter((b) => main[b.k] === i);
      if (bodies[i].length > 1) owner[i] = -2;
      else if (bodies[i].length === 1) owner[i] = bodies[i][0].k;
    });
    const bodyAt = new Int8Array(W * H).fill(-1);
    for (let p = 0; p < W * H; p++) {
      const l = lab[p];
      if (l < 0 || !isMain.has(l)) continue;
      const ks = main.map((m, k) => (m === l ? k : -1)).filter((k) => k >= 0);
      if (ks.length === 1) { bodyAt[p] = ks[0]; continue; }
      const x = p % W, y = (p / W) | 0; let best = -1, bd = Infinity; // one blob, two characters: nearest body centre
      for (const k of ks) { const dd = (c => (c.dx[k] / c.dark[k] - x) ** 2 + (c.dy[k] / c.dark[k] - y) ** 2)(comps[l]); if (dd < bd) { bd = dd; best = k; } }
      bodyAt[p] = best;
    }
    comps.forEach((c, i) => {
      if (owner[i] === -1 || isMain.has(i) || c.n < 30) return;
      // multi-source BFS from the piece's pixels over any pixel, until a body pixel is reached
      const bx0 = Math.max(0, c.minx - NEAREST_R), bx1 = Math.min(W - 1, c.maxx + NEAREST_R), by0 = Math.max(0, c.miny - NEAREST_R), by1 = Math.min(H - 1, c.maxy + NEAREST_R);
      const bw = bx1 - bx0 + 1, dist = new Int16Array(bw * (by1 - by0 + 1)).fill(-1), q = [];
      for (let y = c.miny; y <= c.maxy; y++) for (let x = c.minx; x <= c.maxx; x++) if (lab[y * W + x] === i) { dist[(y - by0) * bw + x - bx0] = 0; q.push(x, y); }
      for (let h = 0; h < q.length; h += 2) {
        const x = q[h], y = q[h + 1], dd = dist[(y - by0) * bw + x - bx0];
        const k = bodyAt[y * W + x];
        if (k >= 0) { owner[i] = k; bodies[i] = []; return; }
        if (dd >= NEAREST_R) continue;
        for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + ax, ny = y + ay;
          if (nx < bx0 || ny < by0 || nx > bx1 || ny > by1) continue;
          const o = (ny - by0) * bw + nx - bx0;
          if (dist[o] < 0) { dist[o] = dd + 1; q.push(nx, ny); }
        }
      }
    });
  }
  const pixelOwner = (l, x, y) => {
    const o = owner[l];
    if (o !== -2) return o;
    let best = -1, bd = Infinity;
    for (const b of bodies[l]) { const dd = (b.x - x) ** 2 + (b.y - y) ** 2; if (dd < bd) { bd = dd; best = b.k; } }
    return best;
  };
  const owns = (l, k) => l >= 0 && (owner[l] === k || (owner[l] === -2 && bodies[l].some((b) => b.k === k)));
  const frames = [];
  for (let k = 0; k < n; k++) {
    let minx = 1e9, maxx = -1, miny = 1e9, maxy = -1;
    let bTop = 1e9, bBot = -1; // body extent (for the scale / ground measurement)
    comps.forEach((c, i) => {
      if (!owns(i, k)) return;
      minx = Math.min(minx, c.minx); maxx = Math.max(maxx, c.maxx); miny = Math.min(miny, c.miny); maxy = Math.max(maxy, c.maxy);
      if (owner[i] >= 0 && c.dark[k] >= BODY_MIN) { bTop = Math.min(bTop, c.dMin); bBot = Math.max(bBot, c.dMax); }
    });
    if (maxx < 0) { frames.push(null); continue; }
    minx = Math.max(0, minx - 2); miny = Math.max(0, miny - 2); maxx = Math.min(W - 1, maxx + 2); maxy = Math.min(H - 1, maxy + 2);
    const fw = maxx - minx + 1, fh = maxy - miny + 1, f = png.create(fw, fh);
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
      const sx = minx + x, sy = miny + y, l = lab[sy * W + sx];
      let own = l >= 0 && owns(l, k) && pixelOwner(l, sx, sy) === k;
      if (l < 0 && d[at(sx, sy) + 3] > 0) { // soft fringe (alpha < 40): keep if it touches an owned pixel
        for (let dy = -1; dy <= 1 && !own; dy++) for (let dx = -1; dx <= 1 && !own; dx++) {
          const nx = sx + dx, ny = sy + dy;
          if (nx >= 0 && ny >= 0 && nx < W && ny < H) { const m = lab[ny * W + nx]; if (owns(m, k) && pixelOwner(m, nx, ny) === k) own = true; }
        }
      }
      if (own) d.copy(f.data, (y * fw + x) * 4, at(sx, sy), at(sx, sy) + 4);
    }
    if (bBot >= 0) f.body = { top: bTop - miny, bottom: bBot - miny };
    frames.push(f);
  }
  return frames;
}

const [CW, CH] = STD.canvas, [PX, PY] = STD.pivot;
function buildPreset(key) {
const { out: outRel, sheets: SHEETS, facing: FACING, nearestBody, bg } = PRESETS[key];
const OUT = path.join(ROOT, outRel);
fs.mkdirSync(OUT, { recursive: true });
console.log('== preset', key, '->', outRel);
const atlas = { preset: key, standard: STD, cols: COLS, sheets: {}, validation: {} };
for (const [name, [file, rows, opt = {}]] of Object.entries(SHEETS)) {
  const n = opt.frames || COLS; // frames actually drawn per row in the source (output is always COLS wide)
  const img = png.read(path.join(ROOT, file));
  removeBackground(img, bg);
  const py = projection(img, true);
  const ys = blobSplits(py, rows, img.height) || splits(py, rows, img.height);
  const cells = [], neutral = [];
  for (let r = 0; r < rows; r++) {
    const bx = bodyProjection(img, ys[r], ys[r + 1]), px = projection(img, false, ys[r], ys[r + 1]);
    const xs = blobSplits(bx, n, img.width) || blobSplits(px, n, img.width) || splits(px, n, img.width);
    const frames = componentFrames(img, ys[r], ys[r + 1], xs, n, { nearestBody });
    while (frames.length < COLS) frames.push(frames[frames.length - 1]); // short rows: hold the last pose
    for (let c = 0; c < COLS; c++) {
      const f = frames[c];
      const a = f && analyseCell(f, 0, 0, f.width, f.height);
      if (a) Object.assign(a, { img: f, x0: 0, y0: 0, x1: f.width, y1: f.height });
      // body-only metrics: loose dark specks from effects never change the scale or the ground line
      if (a && f.body) { a.bodyH = f.body.bottom - f.body.top; }
      cells.push(a);
      if (a && (c === 0 || c === COLS - 1) && r % 4 < 2) neutral.push(a.bodyH); // front/back neutral poses
    }
  }
  // one measured factor per sheet: the neutral body always becomes STD.bodyHeight
  neutral.sort((p, q) => p - q);
  const scale = STD.bodyHeight / neutral[neutral.length >> 1];
  const sheet = png.create(CW * COLS, CH * rows);
  cells.forEach((a, idx) => {
    if (!a) return;
    const r = Math.floor(idx / COLS), c = idx % COLS;
    // Sampling phase: a downscale can average a 1-px outline away depending on where the sampling
    // blocks fall. Try 8 sub-pixel vertical phases (feet move < 1 px) and keep the one that preserves
    // the most body outline; ties go to the smallest shift. Result is independent of canvas size.
    const inv = 1 / scale, sx = Math.round(a.ax - PX * inv), sy0 = a.ay - PY * inv;
    let frame = null, bestH = -1, bestShift = Infinity;
    for (let k = 0; k < 8; k++) {
      const shift = (k / 8 - 0.5) * inv;
      const f = downscale(a.img, sx, sy0 + shift, CW * inv, CH * inv, scale, a);
      const h = darkHeight(f);
      if (h > bestH || (h === bestH && Math.abs(shift) < bestShift)) { frame = f; bestH = h; bestShift = Math.abs(shift); }
    }
    blit(sheet, frame, c * CW, r * CH);
  });
  png.write(path.join(OUT, name + '.png'), sheet);
  const sides = [];
  const face = opt.facing || FACING; // per-sheet facing override > preset facing > detected
  for (let base = 0; base < rows; base += 4) sides.push(face ? { right: base + face.right, left: base + face.left, flipLeft: !!face.flipLeft, flipRight: !!face.flipRight } : sideRows(sheet, { fw: CW, fh: CH, ax: PX }, base));
  atlas.sheets[name] = { file: outRel + '/' + name + '.png', fw: CW, fh: CH, rows, cols: COLS, ax: PX, ay: PY, sides, sourceScale: +scale.toFixed(4) };
  // frames with (almost) no character body: animations must never show them (tools/tests/sprites.test.mjs)
  atlas.sheets[name].emptyFrames = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < COLS; c++) {
    let cnt = 0;
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) { const i = ((r * CH + y) * sheet.width + c * CW + x) * 4, dd = sheet.data; if (dd[i + 3] > 150 && dd[i] + dd[i + 1] + dd[i + 2] < 200) cnt++; }
    if (cnt < 300) atlas.sheets[name].emptyFrames.push([r, c]);
  }
  if (atlas.sheets[name].emptyFrames.length) console.log('   empty frames in', name, JSON.stringify(atlas.sheets[name].emptyFrames));
  const v = validate(sheet, rows);
  atlas.validation[name] = v;
  console.log(name.padEnd(6), 'scale', scale.toFixed(3), 'body', v.bodyHeight, 'feet±', v.feetMaxOffset, 'center', v.centerOffset, v.ok ? 'OK' : '⚠ ' + v.issues.join(', '));
}
fs.writeFileSync(path.join(OUT, 'atlas.json'), JSON.stringify(atlas, null, 1));
}
const only = process.argv[2];
if (only && !PRESETS[only]) throw new Error('Unknown preset "' + only + '" (use: ' + Object.keys(PRESETS).join(', ') + ')');
for (const key of only ? [only] : Object.keys(PRESETS)) buildPreset(key);
