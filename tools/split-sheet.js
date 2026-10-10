// SHEET SPLITTER (dev tool) — cuts one big AI character sheet into the per-animation PNGs that
// tools/build-player.js wants.
//
// WHY: the owner normally gets 1 big sheet per class (rows x 4 directions), but build-player.js reads
// ONE file per animation (walk1, ATK1, SK3, ...). Asking the AI for 14 files per class is wasted
// effort: ask for ONE sheet whose rows are the animations, tell the tool which row is which, and it
// cuts the sheet for you.
//
//   const S = await import('/tools/split-sheet.js');
//   await S.run(__game);                      // config at the top of this file
//   await S.run(__game, '/desgin/class cr/DRG/wr/SHEET.png', { walk1: 2, atk1: 3 });
//
// Row numbers are 1-based. The tool splits the source on empty bands (rows and columns) exactly like the
// builder does, writes one PNG per animation next to the source, and prints the PRESET block to paste
// into tools/build-player.js.
//
// IT DOES NOT fix art problems (a pose cut in half, a missing direction, a wrong-facing column). It only
// cuts; the builder still validates scale, feet and centring, and the sprite test still fails on an empty
// frame.
// The dev server only accepts /dev/recording/<name>.png (flat, no paths) and writes it to D:/EO/recordings/.
// So the files are written there with a folder prefix; copy them into the class folder with the printed command.
const PREFIX = 'DRG_wr_';

// animation name -> 1-based row in the sheet. ADJUST THIS after looking at the sheet.
const ROWS = { walk1: 2, idle: 1, atk1: 3, atk2: 4, dash: 5, hit: 6, sk1: 7, sk2: 8, sk3: 9, sk4: 10, sk5: 11, sk6: 12, ult: 13 };

const img = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });

// content mask: a pixel counts as content when it has alpha AND is not pure black. AI sheets are black
// background, but some generators paint a near-black fill (alpha 255, rgb ~0) — both cases are handled.
function mask(img) {
  const c = new OffscreenCanvas(img.width, img.height), x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  const m = new Uint8Array(c.width * c.height);
  for (let i = 0, p = 0; p < m.length; i += 4, p++) m[p] = (d[i + 3] > 8 && d[i] + d[i + 1] + d[i + 2] > 24) ? 1 : 0;
  return { w: c.width, h: c.height, m };
}

// busy[] = how many content pixels each line holds, over an optional y range
function lines(f, y0, y1) {
  const rows = new Int32Array(f.h), cols = new Int32Array(f.w);
  for (let y = y0; y < y1; y++) {
    let n = 0;
    for (let x = 0; x < f.w; x++) { if (f.m[y * f.w + x]) { n++; cols[x]++; } }
    rows[y] = n;
  }
  return { rows, cols };
}

// bands = contiguous runs of content, with gaps shorter than minGap treated as still-busy (a thin dark
// seam inside a pose must not cut it)
function bands(busy, minGap) {
  const out = [];
  let start = -1, gap = -1;
  for (let i = 0; i < busy.length; i++) {
    if (busy[i] > 0) {
      if (start < 0) start = i;
      else if (gap >= 0 && i - gap >= minGap) { out.push([start, gap]); start = i; }
      gap = -1;
    } else if (start >= 0 && gap < 0) gap = i;
  }
  if (start >= 0) out.push([start, busy.length]);
  return out;
}

export async function run(g, src, rows = ROWS, prefix = PREFIX) {
  const image = await img(src || (g.rootURL || '/') + 'desgin/class%20cr/DRG/wr/SHEET.png');
  const f = mask(image);
  const rowB = bands(lines(f, 0, f.h).rows, Math.max(3, Math.round(f.h * 0.010)));
  console.log('sheet ' + f.w + 'x' + f.h + ' -> found ' + rowB.length + ' row bands: ' +
    rowB.map((b, i) => (i + 1) + ':' + (b[1] - b[0])).join(' '));
  if (rowB.length < 3) { console.warn('Only ' + rowB.length + ' rows found — is the background really black?'); return null; }

  // take the row band closest to each requested 1-based index (a sheet may start with a title band)
  const pick = (want) => {
    let best = -1, d = Infinity;
    rowB.forEach((b, i) => { const dd = Math.abs((i + 1) - want); if (dd < d) { d = dd; best = i; } });
    return rowB[best];
  };

  const out = [];
  for (const [name, want] of Object.entries(rows)) {
    const band = pick(want);
    const y0 = band[0], y1 = band[1];
    const colB = bands(lines(f, y0, y1).cols, Math.max(2, Math.round(f.w * 0.006)));
    if (colB.length < 2) { console.warn(name + ' row ' + want + ' -> only ' + colB.length + ' columns found; skipped'); continue; }
    const cw = Math.max.apply(null, colB.map((b) => b[1] - b[0]));
    for (const col of colB) {
      const c = new OffscreenCanvas(cw, y1 - y0), x = c.getContext('2d');
      x.drawImage(image, col[0], y0, cw, y1 - y0, 0, 0, cw, y1 - y0);
      const blob = await c.convertToBlob({ type: 'image/png' });
      const file = prefix + name + '.png';
      const ok = await (await fetch('/dev/recording/' + file, { method: 'POST', body: blob })).ok;
      if (!ok) console.warn('write failed: ' + file);
      out.push({ name, file, cols: colB.length, w: cw, h: y1 - y0 });
    }
  }
  const block = Object.keys(rows).map((n) => "  " + n + ": [DRG + '" + n.toUpperCase() + ".png', 4],").join('\n');
  console.log('wrote ' + out.length + ' files -> recordings/ (' + prefix + '*)');
  console.log('move them:  mv recordings/' + prefix + '*.png "desgin/class cr/DRG/wr/"');
  console.log('PRESET block for tools/build-player.js:\n' + block);
  return out;
}
