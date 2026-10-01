import { makeCanvas } from '../core/assets.js';

// Placeholder pixel-art monster sheets generated at startup. Each type exposes the same
// structure a real sprite sheet would: frames per state, facing right, anchor at the feet.
// Replace by loading a PNG sheet with identical frame layout.

function outline(c, color = '#0b0810') {
  const g = c.getContext('2d');
  const { width: w, height: h } = c;
  const src = g.getImageData(0, 0, w, h);
  const out = g.createImageData(w, h);
  out.data.set(src.data);
  const [r, gg, b] = [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (src.data[i + 3] > 0) continue;
    let n = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const X = x + dx, Y = y + dy;
      if (X >= 0 && Y >= 0 && X < w && Y < h && src.data[(Y * w + X) * 4 + 3] > 128) { n = true; break; }
    }
    if (n) { out.data[i] = r; out.data[i + 1] = gg; out.data[i + 2] = b; out.data[i + 3] = 255; }
  }
  g.putImageData(out, 0, 0);
  return c;
}

function frame(w, h, fn) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  fn(g);
  return outline(c);
}

const px = (g, c, x, y, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
const ell = (g, c, x, y, rx, ry) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); };
const poly = (g, c, pts) => { g.fillStyle = c; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); };

// ---------------- FOREST WOLF (side view, facing right) 48x34, feet at y=31
function wolfFrame(pal, pose) {
  const { body = 0, head = 0, legs = [0, 0, 0, 0], stretch = 0, crouch = 0, mouth = 0 } = pose;
  return frame(48, 34, (g) => {
    const by = 17 + crouch + body;
    // tail
    poly(g, pal.dark, [[9, by - 3], [2, by - 9 - crouch], [5, by - 11], [12, by - 5]]);
    px(g, pal.mid, 4, by - 10, 2, 2);
    // back legs
    const legY = by + 4;
    px(g, pal.dark, 12 + legs[0], legY, 3, 10 - crouch);
    px(g, pal.dark, 17 + legs[1], legY, 3, 10 - crouch);
    // body
    ell(g, pal.mid, 22 + stretch / 2, by, 13 + stretch / 2, 7);
    ell(g, pal.dark, 22 + stretch / 2, by - 3, 12 + stretch / 2, 4);
    ell(g, pal.light, 24 + stretch / 2, by + 3, 9, 3);
    // mane fur tufts
    for (let i = 0; i < 5; i++) px(g, pal.dark, 26 + i * 2 + stretch, by - 7 - (i % 2), 2, 3);
    // front legs
    px(g, pal.mid, 27 + legs[2] + stretch, legY, 3, 10 - crouch);
    px(g, pal.mid, 31 + legs[3] + stretch, legY, 3, 10 - crouch);
    px(g, pal.dark, 27 + legs[2] + stretch, legY + 8 - crouch, 4, 2);
    px(g, pal.dark, 31 + legs[3] + stretch, legY + 8 - crouch, 4, 2);
    // head
    const hx = 36 + stretch, hy = by - 6 + head + crouch * 0.5;
    ell(g, pal.mid, hx, hy, 6, 5);
    poly(g, pal.mid, [[hx + 2, hy - 1], [hx + 10, hy + 1], [hx + 9, hy + 3 + mouth], [hx + 2, hy + 4]]);
    poly(g, pal.dark, [[hx - 3, hy - 3], [hx - 2, hy - 10], [hx + 1, hy - 4]]);
    poly(g, pal.dark, [[hx, hy - 4], [hx + 2, hy - 10], [hx + 4, hy - 4]]);
    px(g, '#101010', hx + 9, hy, 2, 2);
    if (mouth) { px(g, '#5a0a14', hx + 4, hy + 3, 6, mouth); px(g, '#f0f0f0', hx + 5, hy + 2, 1, 2); px(g, '#f0f0f0', hx + 8, hy + 2, 1, 2); }
    px(g, pal.eye, hx + 2, hy - 2, 2, 2);
  });
}

function wolfSet(pal) {
  const walk = [[0, 3, 3, 0], [2, 1, 1, 2], [3, 0, 0, 3], [1, 2, 2, 1]].map((l, i) => wolfFrame(pal, { legs: l.map((v) => v - 1.5), body: i % 2 ? -1 : 0 }));
  return {
    w: 48, h: 34, ax: 24, ay: 31,
    idle: [wolfFrame(pal, {}), wolfFrame(pal, { body: 1 })],
    move: walk,
    windup: [wolfFrame(pal, { crouch: 3, head: 2, mouth: 1 })],
    attack: [wolfFrame(pal, { stretch: 6, legs: [-3, -2, 3, 4], mouth: 3 }), wolfFrame(pal, { stretch: 4, mouth: 2 })],
    hurt: [wolfFrame(pal, { head: -2, body: -1, legs: [1, 1, -1, -1] })],
  };
}

// ---------------- NPC humanoids 26x44 (front view)
export function npcSprite(look) {
  const L = {
    guide: { robe: '#2e4a7a', trim: '#c8a24a', hair: '#6a4a2a', skin: '#e0b894', extra: 'sword' },
    elder: { robe: '#5a4a6a', trim: '#d8d0e0', hair: '#e8e8e8', skin: '#d8b08c', extra: 'staff' },
    smith: { robe: '#6a3a24', trim: '#3a2a20', hair: '#2a1a10', skin: '#c8906a', extra: 'hammer' },
    merchant: { robe: '#2a6a5a', trim: '#e0c070', hair: '#c86a3a', skin: '#f0c8a0', extra: 'bag' },
    guard: { robe: '#4a5060', trim: '#9aa0b0', hair: '#3a2a1a', skin: '#d8a880', extra: 'spear' },
    child: { robe: '#8a5a3a', trim: '#e8d8a0', hair: '#e0b050', skin: '#f0c8a0', small: true },
    villager: { robe: '#7a5a6a', trim: '#e0d0c0', hair: '#5a3a2a', skin: '#e8b890' },
    wanderer: { robe: '#1a1428', trim: '#8a60c0', hair: '#1a1428', skin: '#3a3050', hood: true, glow: '#b080ff' },
    pilgrim: { robe: '#2a2220', trim: '#c0562a', hair: '#2a2220', skin: '#3a2a26', hood: true, glow: '#ff7a30', extra: 'staff' }, // the Ashen Pilgrim
    scout: { robe: '#3a5a3a', trim: '#b0a060', hair: '#7a3a2a', skin: '#e0b090', extra: 'bow' },
    guildmaster: { robe: '#24346a', trim: '#e0c070', hair: '#d8d0c0', skin: '#e0b894', extra: 'staff' },
    knight: { robe: '#5a6478', trim: '#d8b060', hair: '#4a3a2a', skin: '#d8a880', extra: 'sword' },
  }[look] || { robe: '#555', trim: '#999', hair: '#333', skin: '#dba' };
  const make = (bob) => frame(28, 46, (g) => {
    const s = L.small ? 0.8 : 1;
    const by = 44;
    const top = by - 40 * s + bob;
    // legs/robe
    poly(g, L.robe, [[14 - 8 * s, by - 2], [14 - 6 * s, top + 16 * s], [14 + 6 * s, top + 16 * s], [14 + 8 * s, by - 2]]);
    px(g, L.trim, 14 - 8 * s, by - 4, 16 * s, 2);
    px(g, '#2a1c14', 14 - 5 * s, by - 2, 4, 2); px(g, '#2a1c14', 14 + 1 * s, by - 2, 4, 2);
    // torso
    ell(g, L.robe, 14, top + 18 * s, 7 * s, 8 * s);
    px(g, L.trim, 13, top + 12 * s, 2, 14 * s);
    // arms
    px(g, L.robe, 14 - 9 * s, top + 13 * s, 3, 11 * s); px(g, L.robe, 14 + 6 * s, top + 13 * s, 3, 11 * s);
    px(g, L.skin, 14 - 9 * s, top + 23 * s, 3, 3); px(g, L.skin, 14 + 6 * s, top + 23 * s, 3, 3);
    // head
    ell(g, L.skin, 14, top + 6 * s, 6 * s, 6 * s);
    if (L.hood) { ell(g, L.robe, 14, top + 4 * s, 7.5 * s, 7.5 * s); ell(g, '#05030a', 14, top + 7 * s, 4.5, 4); px(g, L.glow, 11, top + 6, 2, 1); px(g, L.glow, 15, top + 6, 2, 1); }
    else {
      ell(g, L.hair, 14, top + 2 * s, 6.5 * s, 4 * s);
      px(g, L.hair, 14 - 6 * s, top + 2, 2, 6 * s); px(g, L.hair, 14 + 5 * s, top + 2, 2, 6 * s);
      px(g, '#1a1a2a', 11, top + 7 * s, 2, 2); px(g, '#1a1a2a', 15, top + 7 * s, 2, 2);
    }
    if (L.extra === 'staff') { px(g, '#6a4a2a', 23, top, 2, 40); ell(g, '#8ae0ff', 24, top, 3, 3); }
    if (L.extra === 'sword') { px(g, '#9aa0b0', 22, top + 16, 2, 16); px(g, '#c8a24a', 20, top + 22, 6, 2); }
    if (L.extra === 'hammer') { px(g, '#5a3a20', 22, top + 18, 2, 14); px(g, '#6a6a72', 19, top + 16, 8, 5); }
    if (L.extra === 'spear') { px(g, '#6a4a2a', 23, top - 6, 2, 46); poly(g, '#c0c8d0', [[22, top - 6], [24, top - 13], [26, top - 6]]); }
    if (L.extra === 'bag') { ell(g, '#8a6a3a', 5, top + 26, 4, 5); }
    if (L.extra === 'bow') { g.strokeStyle = '#6a4a2a'; g.lineWidth = 2; g.beginPath(); g.arc(22, top + 20, 10, -1.2, 1.2); g.stroke(); }
  });
  return { w: 28, h: 46, ax: 14, ay: 44, idle: [make(0), make(1)] };
}

// ---------------- palettes & registry
const PALS = {
  wolf: { dark: '#2a2e3d', mid: '#3e4458', light: '#6a7088', eye: '#ffd040' },
  wolfC: { dark: '#231a33', mid: '#3a2c52', light: '#5a4a78', eye: '#ff40ff' },
};

export function buildMonsterSprites() {
  return {
    wolf: wolfSet(PALS.wolf), wolfC: wolfSet(PALS.wolfC),
  };
}

// white silhouettes for hit flash (cached per frame canvas)
const flashCache = new WeakMap();
export function flashOf(c) {
  let f = flashCache.get(c);
  if (!f) {
    f = makeCanvas(c.width, c.height);
    const g = f.getContext('2d');
    g.drawImage(c, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#fff';
    g.fillRect(0, 0, f.width, f.height);
    flashCache.set(c, f);
  }
  return f;
}
