// PROCEDURAL VFX (pure, no DOM): an effect = DATA (params) -> pixels. Same code in the VFX Lab (tools/vfxlab.html)
// and later in the game (live drawing / baked strips). Recipe (Night Camp "energy orb"):
//   noise -> domain warp (marble) -> posterize into N flat colours (hand-painted look) -> dissolve holes with a bright
//   rim -> split BACK / FRONT layers so a character can stand inside (back drawn under the body, front over it).
// renderFx(params, t, layer, size?) -> { w, h, data: Uint8ClampedArray RGBA }.  t = seconds (animation time).

export const FX_SHAPES = ['orb', 'ring', 'disc', 'pillar'];
export const FX_LAYERS = ['both', 'back', 'front'];

export const FX_DEFAULTS = {
  shape: 'orb',          // orb = sphere (front / back halves) · ring = ground ring · disc = flat circle · pillar = column
  size: 128,             // canvas px (square)
  radius: 0.46,          // of size
  thickness: 0.25,       // ring / pillar width (of radius)
  seed: 1,
  scale: 3,              // noise frequency
  warp: 1.2,             // domain warp strength (0 = plain clouds, 1-2 = marble)
  speed: 0.25,           // pattern drift per second
  spin: 0.6,             // sphere rotation per second (orb)
  colors: ['#3a0610', '#8a1020', '#d8283a', '#ff7a6a', '#ffe0c8'], // dark -> light, posterize steps
  hole: 0.3,             // dissolve: 0 = solid, 1 = gone
  holeScale: 2.2,
  rim: 0.06,             // bright edge width around holes
  rimColor: '#fff0e0',
  edgeGlow: 0.6,         // fresnel brightening at the silhouette
  frontAlpha: 0.55,      // front half is see-through so the character shows
  backDark: 0.55,        // back half darkened (it is behind)
  alpha: 1,
  pulse: 0,              // 0..1 heartbeat brightness
  pulseRate: 1.3,        // beats per second
  frames: 8, fps: 12,    // export strip
};

export function fxParams(p = {}) { return { ...FX_DEFAULTS, ...p, colors: (p.colors || FX_DEFAULTS.colors).slice() }; }

// ---------- noise ----------
function hash(x, y, s) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const fade = (t) => t * t * (3 - 2 * t);
export function noise2(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  const u = fade(xf), v = fade(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, s = 0, oct = 4) {
  let v = 0, amp = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { v += amp * noise2(x * f, y * f, s + i * 17); n += amp; amp *= 0.5; f *= 2; }
  return v / n;
}
// domain-warped fbm = marble swirls
export function marble(x, y, s, warp) {
  if (!warp) return fbm(x, y, s, 3);
  const qx = fbm(x, y, s + 3), qy = fbm(x + 5.2, y + 1.3, s + 7);
  return fbm(x + warp * 4 * (qx - 0.5), y + warp * 4 * (qy - 0.5), s, 3);
}

export function hexRgb(h) {
  const m = /^#?([0-9a-f]{6})$/i.exec(h || '');
  const n = m ? parseInt(m[1], 16) : 0xffffff;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ---------- render ----------
function renderLayer(params, t, layer, size) {
  const p = fxParams(params);
  const S = Math.max(8, Math.round(size || p.size));
  const data = new Uint8ClampedArray(S * S * 4);
  const pal = p.colors.map(hexRgb), N = pal.length;
  const rimC = hexRgb(p.rimColor);
  const R = p.radius * S, cx = S / 2, cy = S / 2;
  const beat = p.pulse ? p.pulse * heartbeat(t * p.pulseRate) : 0;
  const drift = t * p.speed, rot = t * p.spin;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (x + 0.5 - cx) / R, dy = (y + 0.5 - cy) / R;
      const g = geometry(p, dx, dy, layer);
      if (!g) continue;
      const { u, v, edge, half } = g;
      // pattern
      let n = marble(u * p.scale + drift, v * p.scale - drift * 0.6, p.seed, p.warp);
      n = Math.min(1, Math.max(0, (n - 0.28) / 0.44));   // stretch: fbm sits near 0.5, use the whole palette
      // dissolve holes (separate noise)
      const h = fbm(u * p.holeScale + 11 - drift * 0.4, v * p.holeScale + 7, p.seed + 99, 3);
      const cut = p.hole;
      if (cut > 0 && h < cut) continue;
      const nearHole = cut > 0 && h < cut + p.rim;
      // posterize
      let k = Math.min(N - 1, Math.floor(n * N));
      let c = pal[k];
      let a = 1;
      if (nearHole) c = rimC;
      // fresnel edge glow -> step up the palette
      if (!nearHole && edge > 1 - p.edgeGlow * 0.5) c = pal[Math.min(N - 1, k + 1 + (edge > 0.93 ? 1 : 0))];
      let r = c[0], gg = c[1], b = c[2];
      if (half === 'back') { const m = p.backDark, d0 = pal[0]; r += (d0[0] - r) * m; gg += (d0[1] - gg) * m; b += (d0[2] - b) * m; }
      if (half === 'front') a = nearHole ? 1 : Math.min(1, p.frontAlpha * (0.25 + 0.75 * edge) + edge ** 6);   // clear in the middle: the body shows
      if (beat) { r += (255 - r) * beat * 0.5; gg += (255 - gg) * beat * 0.5; b += (255 - b) * beat * 0.5; }
      const i = (y * S + x) * 4;
      data[i] = r; data[i + 1] = gg; data[i + 2] = b; data[i + 3] = 255 * a * p.alpha * g.fade;
    }
  }
  return { w: S, h: S, data };

  function geometry(p, dx, dy, layer) {
    const d = Math.hypot(dx, dy);
    if (p.shape === 'orb') {
      if (d > 1) return null;
      const z = Math.sqrt(1 - d * d);
      // a pixel shows the front surface (z) or, behind it, the back surface (-z)
      const want = layer === 'front' ? 'front' : layer === 'back' ? 'back' : null;
      const half = want || 'front';
      const sz = half === 'front' ? z : -z;
      // rotate sphere around the vertical axis
      const c = Math.cos(rot), s = Math.sin(rot), X = dx * c - sz * s, Z = dx * s + sz * c;   // 3-D point: no seam
      return { u: X * 1.4 + Z * 0.9, v: dy * 1.6 - Z * 0.5, edge: d, half, fade: 1 };
    }
    if (p.shape === 'ring') {
      const ey = dy * 2.2; const dd = Math.hypot(dx, ey);         // squashed = lying on the ground
      const inner = 1 - p.thickness;
      if (dd > 1 || dd < inner) return null;
      const half = ey < 0 ? 'back' : 'front';
      if (layer !== 'both' && layer !== half) return null;
      const w = (dd - inner) / p.thickness;
      return { u: Math.atan2(ey, dx) * 1.5 + rot, v: w * 1.2, edge: Math.abs(w - 0.5) * 2, half: 'flat', fade: 1 };
    }
    if (p.shape === 'disc') {
      if (layer === 'front' || d > 1) return null;
      return { u: dx, v: dy, edge: d, half: 'flat', fade: 1 };
    }
    if (p.shape === 'pillar') {
      const w = p.thickness * 1.6;
      if (Math.abs(dx) > w || dy > 1 || dy < -1) return null;
      const s = dx / w, z = Math.sqrt(Math.max(0, 1 - s * s));
      const half = layer === 'back' ? 'back' : 'front';
      if (layer === 'back') return null;
      const top = dy < -0.6 ? (dy + 1) / 0.4 : 1;
      return { u: Math.atan2(s, z) + rot, v: dy * 1.5 + drift, edge: Math.abs(s), half: 'flat', fade: Math.max(0, top) };
    }
    return null;
  }
}

// heartbeat shape: two quick peaks then rest ("ตุบ-ตุบ"), 0..1
export function heartbeat(x) {
  const f = x - Math.floor(x);
  const peak = (c, w) => Math.max(0, 1 - Math.abs(f - c) / w);
  return Math.max(peak(0.08, 0.07), 0.75 * peak(0.24, 0.07));
}

// Bake a strip: frames side by side (right-facing VFX strip like assets/vfx/*.png). Returns { w, h, fw, frames, data }.
export function bakeStrip(params, layer = 'both') {
  const p = fxParams(params);
  const n = Math.max(1, p.frames | 0), S = p.size;
  const out = new Uint8ClampedArray(S * n * S * 4);
  const loop = n / p.fps;
  for (let f = 0; f < n; f++) {
    const img = renderFx(p, (f / n) * loop, layer, S);
    for (let y = 0; y < S; y++) out.set(img.data.subarray(y * S * 4, (y + 1) * S * 4), (y * S * n + f * S) * 4);
  }
  return { w: S * n, h: S, fw: S, frames: n, data: out };
}

// One layer, or 'both' = back + front composited (orb: the back shell shows through the holes / see-through front).
export function renderFx(params, t = 0, layer = 'both', size) {
  const p = fxParams(params);
  if (layer !== 'both' || p.shape !== 'orb') return renderLayer(p, t, layer, size);
  const back = renderLayer(p, t, 'back', size), front = renderLayer(p, t, 'front', size);
  const d = back.data, f = front.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = f[i + 3] / 255; if (!a) continue;
    const ba = d[i + 3] / 255, oa = a + ba * (1 - a);
    for (let k = 0; k < 3; k++) d[i + k] = (f[i + k] * a + d[i + k] * ba * (1 - a)) / oa;
    d[i + 3] = oa * 255;
  }
  return back;
}
