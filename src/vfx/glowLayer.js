// GLOW LAYER (F3, Night Camp clip 2): find the "lit" pixels of a sprite sheet (bright + saturated = runes, blades, gems,
// flames), keep only those as an EMISSIVE mask, blur it once into a GLOW sheet with the same layout, then draw that sheet
// on top of the body with additive light ('lighter') and a heartbeat pulse. Mask rules are data (GLOW_DEFAULTS / opts).

import { heartbeat } from './proceduralFx.js';

export const GLOW_DEFAULTS = {
  minLum: 0.62,     // pixel brightness 0..1
  minSat: 0.45,     // colour saturation 0..1 (white highlights on armour are NOT lit unless whites: true)
  whites: false,    // also take near-white pixels (lum >= whiteLum)
  whiteLum: 0.93,
  hue: null,        // [from, to] degrees: only this colour family (e.g. [330, 30] = reds), null = any
  tint: null,       // '#rrggbb' = glow colour; null = the pixel's own colour
  blur: 3,          // px (source sheet)
  strength: 1.8,    // glow brightness
  pulse: 0.6,       // 0 = steady, 1 = full heartbeat
  rate: 1.1,        // beats per second
};

function hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60; if (h < 0) h += 360;
  return [h, s, l];
}
const inHue = (h, [a, b]) => (a <= b ? h >= a && h <= b : h >= a || h <= b);

// pure: RGBA data -> new RGBA data with only the lit pixels (others transparent). Returns { data, lit } (lit = pixel count).
export function glowMask(data, opts = {}) {
  const o = { ...GLOW_DEFAULTS, ...opts };
  const out = new Uint8ClampedArray(data.length);
  const tint = o.tint ? [parseInt(o.tint.slice(1, 3), 16), parseInt(o.tint.slice(3, 5), 16), parseInt(o.tint.slice(5, 7), 16)] : null;
  let lit = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const [h, s, l] = hsl(data[i], data[i + 1], data[i + 2]);
    const hot = (l >= o.minLum && s >= o.minSat && (!o.hue || inHue(h, o.hue))) || (o.whites && l >= o.whiteLum);
    if (!hot) continue;
    lit++;
    if (tint) { out[i] = tint[0]; out[i + 1] = tint[1]; out[i + 2] = tint[2]; }
    else { out[i] = data[i]; out[i + 1] = data[i + 1]; out[i + 2] = data[i + 2]; }
    out[i + 3] = 255;
  }
  return { data: out, lit };
}

// pulse 0..1 -> alpha multiplier for the glow at time t
export function glowAlpha(opts, t) {
  const o = { ...GLOW_DEFAULTS, ...opts };
  return Math.min(2, o.strength * ((1 - o.pulse) * 0.6 + o.pulse * (0.3 + 0.7 * heartbeat(t * o.rate))));   // > 1 = drawn twice
}

// DOM: image -> glow canvas (same size / layout: frame rects stay valid). Sharp mask + blurred halo.
export function makeGlowSheet(img, opts = {}) {
  const o = { ...GLOW_DEFAULTS, ...opts };
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const src = document.createElement('canvas'); src.width = w; src.height = h;
  const sx = src.getContext('2d', { willReadFrequently: true }); sx.drawImage(img, 0, 0);
  const m = glowMask(sx.getImageData(0, 0, w, h).data, o);
  sx.clearRect(0, 0, w, h); sx.putImageData(new ImageData(m.data, w, h), 0, 0);
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const ox = out.getContext('2d');
  ox.filter = `blur(${o.blur * 2}px)`; ox.drawImage(src, 0, 0);
  ox.filter = `blur(${o.blur}px)`; ox.drawImage(src, 0, 0);
  ox.filter = 'none'; ox.globalAlpha = 0.7; ox.drawImage(src, 0, 0);
  out.lit = m.lit;
  return out;
}

// draw the glow of one frame over a body already drawn at (dx, dy, dw, dh)
export function drawGlow(ctx, glowSheet, sx, sy, sw, sh, dx, dy, dw, dh, opts, t) {
  const a = glowAlpha(opts, t); if (a <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  if (a > 1) { ctx.globalAlpha = 1; ctx.drawImage(glowSheet, sx, sy, sw, sh, dx, dy, dw, dh); }
  ctx.globalAlpha = a > 1 ? a - 1 : a;
  ctx.drawImage(glowSheet, sx, sy, sw, sh, dx, dy, dw, dh);
  ctx.restore();
}
