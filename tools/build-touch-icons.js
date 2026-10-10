// MOBILE: the owner's touch button art (desgin/UI/touch/<name>.png, transparent round icons) -> assets/ui/touch/<name>.png
// cropped to the drawn icon (alpha > 8) and shrunk to 192 px (crisp on 2-3x phone screens at ~92 px).
//   node tools/build-touch-icons.js
const fs = require('fs');
const path = require('path');
const png = require('./png.js');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'desgin', 'UI', 'touch');
const OUT = path.join(ROOT, 'assets', 'ui', 'touch');
const SIZE = 192;

function crop(im) {
  let x0 = im.width, y0 = im.height, x1 = -1, y1 = -1;
  for (let y = 0; y < im.height; y++) for (let x = 0; x < im.width; x++) if (im.data[(y * im.width + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const s = Math.max(x1 - x0, y1 - y0) + 1, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; // square around the centre
  const out = Buffer.alloc(s * s * 4), ox = Math.round(cx - s / 2), oy = Math.round(cy - s / 2);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const sx = x + ox, sy = y + oy;
    if (sx < 0 || sy < 0 || sx >= im.width || sy >= im.height) continue;
    im.data.copy(out, (y * s + x) * 4, (sy * im.width + sx) * 4, (sy * im.width + sx) * 4 + 4);
  }
  return { width: s, height: s, data: out };
}
// box-filter resample (premultiplied: clean soft edges)
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

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(SRC).filter((f) => /\.png$/i.test(f))) {
  const im = png.decode(fs.readFileSync(path.join(SRC, f)));
  const out = resize(crop(im), SIZE, SIZE);
  fs.writeFileSync(path.join(OUT, f.toLowerCase()), png.encode(out));
  console.log('touch icon', f, `${im.width}x${im.height} ->`, `${SIZE}px`);
}
