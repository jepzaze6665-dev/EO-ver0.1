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

// ---------------- FOREST GOBLIN 40x42, feet at y=40
function goblinFrame(pal, pose) {
  const { club = 0, lean = 0, step = 0, squat = 0 } = pose; // club: 0 rest, 1 raised, 2 slammed
  return frame(44, 44, (g) => {
    const cx = 18 + lean, by = 40 - squat;
    // legs
    px(g, pal.skinDark, cx - 5 + step, by - 8, 4, 8);
    px(g, pal.skinDark, cx + 2 - step, by - 8, 4, 8);
    px(g, '#2a1c14', cx - 6 + step, by - 2, 6, 2); px(g, '#2a1c14', cx + 1 - step, by - 2, 6, 2);
    // body tunic
    ell(g, pal.cloth, cx, by - 15, 8, 9);
    px(g, pal.clothDark, cx - 8, by - 12, 16, 3);
    px(g, '#8a6a3a', cx - 7, by - 12, 14, 1);
    // head
    const hy = by - 27 + squat * 0.5;
    ell(g, pal.skin, cx + 2, hy, 7, 6);
    poly(g, pal.skin, [[cx - 4, hy - 1], [cx - 12, hy - 5], [cx - 4, hy + 2]]);
    poly(g, pal.skin, [[cx + 7, hy - 2], [cx + 14, hy - 7], [cx + 8, hy + 2]]);
    px(g, pal.skinDark, cx - 3, hy + 3, 10, 2);
    px(g, pal.eye, cx + 4, hy - 1, 2, 2); px(g, pal.eye, cx + 1, hy - 1, 2, 1);
    px(g, '#e8e0c8', cx + 5, hy + 3, 1, 2);
    // arm + club
    g.save();
    const ax = cx + 5, ay = by - 18;
    const ang = club === 0 ? 0.6 : club === 1 ? -2.2 : 1.35;
    g.translate(ax, ay);
    g.rotate(ang);
    px(g, pal.skin, 0, -2, 7, 4);
    px(g, '#5a3a20', 5, -2, 14, 4);
    px(g, '#6e4a28', 16, -4, 7, 8);
    px(g, '#8a8a90', 18, -5, 2, 2); px(g, '#8a8a90', 21, 3, 2, 2);
    g.restore();
  });
}

function goblinSet(pal) {
  return {
    w: 44, h: 44, ax: 18, ay: 40,
    idle: [goblinFrame(pal, {}), goblinFrame(pal, { squat: 1 })],
    move: [goblinFrame(pal, { step: 2 }), goblinFrame(pal, { step: 0, squat: 1 }), goblinFrame(pal, { step: -2 }), goblinFrame(pal, { step: 0, squat: 1 })],
    windup: [goblinFrame(pal, { club: 1, lean: -2, squat: 2 })],
    attack: [goblinFrame(pal, { club: 2, lean: 3 }), goblinFrame(pal, { club: 2, lean: 2, squat: 2 })],
    hurt: [goblinFrame(pal, { lean: -3, squat: 1 })],
  };
}

// ---------------- CRYSTAL BEAST 64x48, feet at y=45
function beastFrame(pal, pose) {
  const { legs = [0, 0], armored = true, crouch = 0, rear = 0, core = 1 } = pose;
  return frame(66, 50, (g) => {
    const by = 28 + crouch - rear;
    // legs
    px(g, pal.dark, 14 + legs[0], by + 8, 7, 12 - crouch + rear);
    px(g, pal.dark, 42 + legs[1], by + 8, 7, 12 - crouch + rear);
    px(g, pal.mid, 22 - legs[0], by + 9, 6, 11 - crouch + rear);
    px(g, pal.mid, 48 - legs[1], by + 9, 6, 11 - crouch + rear);
    // body
    ell(g, pal.mid, 32, by, 22, 12);
    ell(g, pal.light, 34, by + 4, 16, 6);
    ell(g, pal.dark, 30, by - 5, 19, 6);
    // rear weak point (crystal core) — glows when armour is broken
    ell(g, core ? '#ff9ad8' : '#6a3a5a', 12, by - 2, 4, 4);
    if (core) px(g, '#fff0ff', 11, by - 3, 2, 2);
    // head
    ell(g, pal.mid, 55, by + 2 - rear, 9, 8);
    px(g, pal.dark, 56, by + 5 - rear, 9, 3);
    px(g, '#5af0ff', 58, by - 1 - rear, 3, 2);
    px(g, '#d8d8e0', 62, by + 7 - rear, 2, 3);
    // crystals on back
    if (armored) {
      const spikes = [[18, 10], [25, 15], [32, 17], [39, 14], [46, 10]];
      spikes.forEach(([x, h], i) => {
        poly(g, i % 2 ? pal.cry : pal.cryDark, [[x - 4, by - 8], [x, by - 8 - h], [x + 4, by - 8]]);
        px(g, pal.cryLight, x - 1, by - 6 - h * 0.8, 1, h * 0.6);
      });
    } else {
      for (const x of [18, 26, 34, 42]) poly(g, pal.cryDark, [[x - 3, by - 8], [x, by - 12], [x + 3, by - 8]]);
    }
  });
}

function beastSet(pal) {
  const make = (armored) => ({
    idle: [beastFrame(pal, { armored }), beastFrame(pal, { armored, crouch: 1 })],
    move: [beastFrame(pal, { armored, legs: [2, -2] }), beastFrame(pal, { armored }), beastFrame(pal, { armored, legs: [-2, 2] }), beastFrame(pal, { armored })],
    windup: [beastFrame(pal, { armored, rear: 5 })],
    attack: [beastFrame(pal, { armored, crouch: 4 }), beastFrame(pal, { armored, crouch: 2 })],
    hurt: [beastFrame(pal, { armored, crouch: 2, legs: [1, 1] })],
  });
  return { w: 66, h: 50, ax: 33, ay: 46, ...make(true), broken: make(false) };
}

// ---------------- THORNLING (boss summon) 30x26
function thornFrame(pose) {
  const { hop = 0, open = 0 } = pose;
  return frame(30, 28, (g) => {
    const by = 24 - hop;
    for (let i = 0; i < 5; i++) poly(g, i % 2 ? '#3a5a2a' : '#2a4020', [[8 + i * 3, by - 6], [6 + i * 4, by - 18 - (i % 2) * 4], [12 + i * 3, by - 7]]);
    ell(g, '#4a3a24', 15, by - 5, 9, 6);
    px(g, '#2a1c10', 8, by - 1, 3, 3); px(g, '#2a1c10', 19, by - 1, 3, 3);
    px(g, '#9affd8', 18, by - 7, 3, 2);
    if (open) px(g, '#1a0a0a', 20, by - 4, 5, open);
    px(g, '#5af0ff', 11, by - 12, 2, 2);
  });
}
function thornSet() {
  return {
    w: 30, h: 28, ax: 15, ay: 24,
    idle: [thornFrame({}), thornFrame({ hop: 1 })],
    move: [thornFrame({ hop: 2 }), thornFrame({}), thornFrame({ hop: 3 }), thornFrame({})],
    windup: [thornFrame({ open: 2 })], attack: [thornFrame({ hop: 4, open: 3 }), thornFrame({ open: 2 })], hurt: [thornFrame({ hop: 1 })],
  };
}

// ---------------- RUNE WRAITH (valley) 36x48 floating
function wraithFrame(pose) {
  const { bob = 0, cast = 0 } = pose;
  return frame(40, 50, (g) => {
    const cy = 22 + bob;
    poly(g, '#221a34', [[20, cy - 16], [31, cy + 2], [29, cy + 22], [24, cy + 18], [20, cy + 24], [16, cy + 18], [11, cy + 22], [9, cy + 2]]);
    poly(g, '#3a2c58', [[20, cy - 16], [27, cy - 2], [20, cy + 6], [13, cy - 2]]);
    ell(g, '#0a0612', 20, cy - 6, 5, 5);
    px(g, '#ffd070', 17, cy - 7, 2, 2); px(g, '#ffd070', 21, cy - 7, 2, 2);
    px(g, '#c89a4a', 14, cy + 6, 12, 1); px(g, '#c89a4a', 19, cy + 3, 2, 8);
    // arms
    const armY = cast ? cy - 8 : cy + 2;
    poly(g, '#221a34', [[10, cy], [2, armY], [5, armY + 3], [12, cy + 4]]);
    poly(g, '#221a34', [[30, cy], [38, armY], [35, armY + 3], [28, cy + 4]]);
    if (cast) { ell(g, '#e0b0ff', 3, armY, 3, 3); ell(g, '#e0b0ff', 37, armY, 3, 3); }
  });
}
function wraithSet() {
  return {
    w: 40, h: 50, ax: 20, ay: 46,
    idle: [wraithFrame({}), wraithFrame({ bob: -2 })],
    move: [wraithFrame({ bob: -1 }), wraithFrame({ bob: -3 }), wraithFrame({ bob: -1 }), wraithFrame({ bob: 0 })],
    windup: [wraithFrame({ cast: 1, bob: -3 })], attack: [wraithFrame({ cast: 1 }), wraithFrame({ cast: 1, bob: -1 })], hurt: [wraithFrame({ bob: 2 })],
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
    scout: { robe: '#3a5a3a', trim: '#b0a060', hair: '#7a3a2a', skin: '#e0b090', extra: 'bow' },
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
  goblin: { skin: '#6a8a42', skinDark: '#4a6230', cloth: '#5a4030', clothDark: '#3a2a20', eye: '#ffe060' },
  goblinC: { skin: '#6a6a52', skinDark: '#4a4238', cloth: '#3a2a44', clothDark: '#24182c', eye: '#ff50ff' },
  beast: { dark: '#2a3040', mid: '#3e4658', light: '#566070', cry: '#5af0ff', cryDark: '#2aa0c8', cryLight: '#dffcff' },
  alpha: { dark: '#2a2038', mid: '#403458', light: '#5a4c78', cry: '#c080ff', cryDark: '#7a40c8', cryLight: '#f4e0ff' },
};

export function buildMonsterSprites() {
  return {
    wolf: wolfSet(PALS.wolf), wolfC: wolfSet(PALS.wolfC),
    goblin: goblinSet(PALS.goblin), goblinC: goblinSet(PALS.goblinC),
    crystal_beast: beastSet(PALS.beast), crystal_alpha: beastSet(PALS.alpha),
    thornling: thornSet(), wraith: wraithSet(),
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
