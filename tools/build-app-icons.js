// MOBILE M2 — app icons for the PWA (manifest.webmanifest): the eclipse emblem on the game's dark background, square,
// emblem inside the central 72% so Android's round / squircle masks never cut it ("maskable").
//   node tools/build-app-icons.js   ->  assets/app/icon-192.png, icon-512.png, apple-touch-icon.png (180)
const fs = require('fs');
const path = require('path');
const png = require('./png.js');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'app');
const BG = [7, 6, 12];

// box-filter resample of an RGBA image to w × h (premultiplied so the soft edge stays clean)
function resize(im, w, h) {
  const out = Buffer.alloc(w * h * 4), sx = im.width / w, sy = im.height / h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx)), y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
      const i = (yy * im.width + xx) * 4, al = im.data[i + 3] / 255;
      r += im.data[i] * al; g += im.data[i + 1] * al; b += im.data[i + 2] * al; a += al; n++;
    }
    const o = (y * w + x) * 4;
    if (a > 0) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; }
    out[o + 3] = Math.round((a / n) * 255);
  }
  return { width: w, height: h, data: out };
}

function icon(emblem, size, inner = 0.72) {
  const s = Math.min((size * inner) / emblem.width, (size * inner) / emblem.height);
  const em = resize(emblem, Math.round(emblem.width * s), Math.round(emblem.height * s));
  const data = Buffer.alloc(size * size * 4); // png.js encode wants a Buffer
  for (let i = 0; i < size * size; i++) { data[i * 4] = BG[0]; data[i * 4 + 1] = BG[1]; data[i * 4 + 2] = BG[2]; data[i * 4 + 3] = 255; }
  const ox = Math.round((size - em.width) / 2), oy = Math.round((size - em.height) / 2);
  for (let y = 0; y < em.height; y++) for (let x = 0; x < em.width; x++) {
    const i = (y * em.width + x) * 4, o = ((y + oy) * size + (x + ox)) * 4, a = em.data[i + 3] / 255;
    for (let c = 0; c < 3; c++) data[o + c] = Math.round(em.data[i + c] * a + data[o + c] * (1 - a));
  }
  return { width: size, height: size, data };
}

const emblem = png.read(path.join(ROOT, 'assets', 'ui', 'title', 'emblem.png'));
fs.mkdirSync(OUT, { recursive: true });
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  png.write(path.join(OUT, name), icon(emblem, size));
  console.log('wrote', path.join('assets', 'app', name));
}
