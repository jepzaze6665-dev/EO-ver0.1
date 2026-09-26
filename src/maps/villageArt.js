import { makeCanvas } from '../core/assets.js';
import { RNG } from '../core/rng.js';

// Procedural 3/4-view pixel houses for Lumina Village (the asset set only ships modules).
const ROOFS = {
  blue: ['#2c3f6b', '#3a5288', '#5470a8', '#1a2542'],
  red: ['#6b2f2a', '#86413a', '#a85a4c', '#3f1a17'],
  green: ['#2e4f35', '#3d6644', '#56835a', '#1b3020'],
  slate: ['#3f434f', '#525766', '#6a7082', '#262830'],
};

export function makeHouse(wTiles, style = 'blue', seed = 1, opts = {}) {
  const r = new RNG(seed);
  const W = wTiles * 32, wallH = opts.wallH || 34, roofH = opts.roofH || Math.round(W * 0.55);
  const H = wallH + roofH;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const pal = ROOFS[style];
  // walls: timber frame + plaster
  const wy = roofH - 4;
  g.fillStyle = '#b8a27a'; g.fillRect(2, wy, W - 4, wallH + 4);
  g.fillStyle = '#9c8662'; g.fillRect(2, wy + wallH - 6, W - 4, 10);
  g.fillStyle = '#5a3d24';
  g.fillRect(2, wy, 3, wallH + 4); g.fillRect(W - 5, wy, 3, wallH + 4);
  g.fillRect(2, wy + 1, W - 4, 3);
  for (let x = 32; x < W - 8; x += 32) g.fillRect(x - 1, wy, 3, wallH + 4);
  // stone base
  g.fillStyle = '#5e5a5a'; g.fillRect(2, wy + wallH - 2, W - 4, 6);
  g.fillStyle = '#3e3a3c';
  for (let x = 4; x < W - 4; x += 7) g.fillRect(x, wy + wallH - 2, 1, 6);
  // door
  const dx = Math.floor(W / 2) - 7;
  g.fillStyle = '#3a2414'; g.fillRect(dx - 1, wy + wallH - 22, 16, 24);
  g.fillStyle = '#6b4424'; g.fillRect(dx, wy + wallH - 21, 14, 23);
  g.fillStyle = '#8a5a30'; g.fillRect(dx + 2, wy + wallH - 19, 4, 19); g.fillRect(dx + 8, wy + wallH - 19, 4, 19);
  g.fillStyle = '#d8b050'; g.fillRect(dx + 11, wy + wallH - 10, 2, 2);
  // windows with warm light
  const wins = [];
  for (let x = 10; x < W - 20; x += 32) if (Math.abs(x + 6 - W / 2) > 16) wins.push(x);
  for (const x of wins) {
    g.fillStyle = '#3a2414'; g.fillRect(x - 1, wy + 9, 14, 13);
    g.fillStyle = r.chance(0.8) ? '#f0c068' : '#2a2a3a'; g.fillRect(x, wy + 10, 12, 11);
    g.fillStyle = '#ffe2a0'; g.fillRect(x + 1, wy + 11, 4, 3);
    g.fillStyle = '#3a2414'; g.fillRect(x + 5, wy + 10, 2, 11); g.fillRect(x, wy + 15, 12, 1);
    // flower box
    if (r.chance(0.6)) {
      g.fillStyle = '#5a3a20'; g.fillRect(x - 1, wy + 21, 14, 3);
      for (let i = 0; i < 5; i++) { g.fillStyle = r.pick(['#d86a8a', '#e8d06a', '#a07ad8', '#6ab04a']); g.fillRect(x + i * 3, wy + 19, 2, 2); }
    }
  }
  // roof: shingle rows, lighter toward the top-left
  const eave = 5;
  for (let y = 0; y < roofH; y++) {
    const t = y / roofH;
    const inset = Math.round((1 - t) * 6);
    const row = Math.floor(y / 5);
    for (let x = inset - eave + 4; x < W - inset + eave - 4; x++) {
      if (x < 0 || x >= W) continue;
      const shingle = (x + (row % 2) * 4) % 8;
      let col = pal[0];
      if (y % 5 === 4) col = pal[3];
      else if (shingle === 0) col = pal[3];
      else if (y % 5 === 0) col = pal[2];
      else if (x < W / 2 && r.chance(0.1)) col = pal[1];
      if (t < 0.12) col = pal[3];
      g.fillStyle = col; g.fillRect(x, y, 1, 1);
    }
  }
  // ridge + chimney
  g.fillStyle = pal[3]; g.fillRect(4, 0, W - 8, 3);
  if (opts.chimney !== false) {
    const cx = Math.round(W * 0.72);
    g.fillStyle = '#5e5a5a'; g.fillRect(cx, -2 + 4, 9, 14);
    g.fillStyle = '#3e3a3c'; g.fillRect(cx, 4, 9, 2);
  }
  // eave shadow on wall
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(2, roofH - 4, W - 4, 4);
  return c;
}

// Well / small props not in the asset sheet
export function makeWell() {
  const c = makeCanvas(40, 46);
  const g = c.getContext('2d');
  g.fillStyle = '#4a4650'; g.beginPath(); g.ellipse(20, 34, 16, 9, 0, 0, 7); g.fill();
  g.fillStyle = '#6a6672'; g.beginPath(); g.ellipse(20, 31, 16, 9, 0, 0, 7); g.fill();
  g.fillStyle = '#10223a'; g.beginPath(); g.ellipse(20, 31, 11, 5.5, 0, 0, 7); g.fill();
  g.fillStyle = '#5a3d24'; g.fillRect(5, 6, 3, 28); g.fillRect(32, 6, 3, 28); g.fillRect(3, 4, 34, 4);
  g.fillStyle = '#86413a'; g.fillRect(1, 0, 38, 6);
  return c;
}
