import { makeCanvas } from '../core/assets.js';
import { RNG } from '../core/rng.js';

// Procedurally drawn props that need animation or world-state visuals.
const cache = {};

function bones() {
  if (cache.bones) return cache.bones;
  const c = makeCanvas(28, 14), g = c.getContext('2d');
  g.fillStyle = '#d8d0bc';
  g.fillRect(2, 8, 12, 2); g.fillRect(1, 7, 3, 4); g.fillRect(12, 7, 3, 4);
  g.fillRect(16, 4, 7, 6); g.fillStyle = '#2a2420'; g.fillRect(17, 6, 2, 2); g.fillRect(21, 6, 1, 2);
  g.fillStyle = '#b8b09c'; g.fillRect(8, 11, 10, 2);
  return (cache.bones = c);
}

export function drawSpecialProp(ctx, p, time, state, game) {
  if (p.arenaRings) { drawArenaRings(ctx, p, time, game); return true; }
  const x = p.x, y = p.y;
  if (p.name === 'bones') { ctx.drawImage(bones(), Math.round(x - 14), Math.round(y - 12)); return true; }
  if (p.waterfall) { drawWaterfall(ctx, p, time); return true; }
  if (p.crack) { drawCrack(ctx, p, time, state); return true; }
  if (p.bramble) { drawBramble(ctx, p, time); return true; }
  if (p.barrier) { drawBarrier(ctx, p, time); return true; }
  if (p.glyph) { drawGlyph(ctx, p, time); return true; }
  return false;
}

function drawWaterfall(ctx, p, t) {
  const x0 = p.x - p.w / 2, y1 = p.y, y0 = p.y - p.h;
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, 'rgba(90,160,210,0.9)');
  g.addColorStop(1, 'rgba(150,210,240,0.95)');
  ctx.fillStyle = g;
  ctx.fillRect(x0 + 6, y0, p.w - 12, p.h - 30);
  ctx.fillStyle = 'rgba(230,248,255,0.8)';
  for (let i = 0; i < 14; i++) {
    const lx = x0 + 8 + ((i * 37) % (p.w - 16));
    const off = ((t * 140 + i * 53) % p.h);
    ctx.fillRect(lx, y0 + off - 20, 2, 16);
  }
  // foam at the base
  for (let i = 0; i < 10; i++) {
    const a = t * 3 + i;
    ctx.fillStyle = `rgba(235,250,255,${0.5 + 0.3 * Math.sin(a)})`;
    ctx.beginPath();
    ctx.arc(x0 + 10 + i * (p.w - 20) / 9, y1 - 30 + Math.sin(a * 1.3) * 3, 5 + Math.sin(a) * 2, 0, 7);
    ctx.fill();
  }
}

function drawCrack(ctx, p, t, state) {
  if (p.broken) {
    ctx.fillStyle = '#0c0912';
    ctx.beginPath(); ctx.ellipse(p.x, p.y - 30, 30, 30, 0, Math.PI, 0); ctx.fill();
    return;
  }
  const pulse = 0.55 + 0.45 * Math.sin(t * 2.4);
  ctx.strokeStyle = `rgba(190,110,255,${pulse})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  const pts = [[0, -84], [-6, -70], [3, -58], [-5, -44], [6, -30], [-2, -18], [4, -6]];
  pts.forEach(([dx, dy], i) => (i ? ctx.lineTo(p.x + dx, p.y + dy) : ctx.moveTo(p.x + dx, p.y + dy)));
  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(p.x + 3, p.y - 58); ctx.lineTo(p.x + 16, p.y - 52); ctx.moveTo(p.x - 5, p.y - 44); ctx.lineTo(p.x - 18, p.y - 38); ctx.stroke();
  ctx.lineWidth = 1;
  if (state && state.hp < state.maxHp) {
    ctx.fillStyle = 'rgba(255,220,255,0.8)';
    ctx.fillRect(p.x - 12, p.y - 90, 24 * (state.hp / state.maxHp), 2);
  }
}

function drawBramble(ctx, p, t) {
  if (p.cut) {
    ctx.fillStyle = '#3a2a1c';
    for (let i = 0; i < 6; i++) ctx.fillRect(p.x - 56 + i * 20, p.y - 6, 10, 4);
    return;
  }
  const r = new RNG(9);
  for (let i = 0; i < 38; i++) {
    const bx = p.x - 64 + r.range(0, 128), by = p.y - r.range(0, 34);
    ctx.strokeStyle = r.chance(0.5) ? '#3a2a1c' : '#4a3a24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx + r.range(-14, 14), by - r.range(6, 18), bx + r.range(-20, 20), by - r.range(10, 26));
    ctx.stroke();
    ctx.fillStyle = '#2f4a26';
    ctx.fillRect(bx + r.range(-6, 6), by - r.range(4, 20), 4, 3);
    if (r.chance(0.2)) { ctx.fillStyle = '#a02a3a'; ctx.fillRect(bx, by - 12, 2, 2); }
  }
  ctx.lineWidth = 1;
}

function drawBarrier(ctx, p, t) {
  const w = p.w;
  for (let i = 0; i < 16; i++) {
    const bx = p.x - w / 2 + (i + 0.5) * (w / 16);
    const h = 34 + Math.sin(i * 2.3) * 12 + Math.sin(t * 2 + i) * 3;
    ctx.strokeStyle = i % 2 ? '#3b1f52' : '#5a2a7a';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(bx, p.y); ctx.quadraticCurveTo(bx + Math.sin(i) * 10, p.y - h / 2, bx + Math.sin(i * 3) * 8, p.y - h); ctx.stroke();
    ctx.fillStyle = `rgba(200,100,255,${0.5 + 0.4 * Math.sin(t * 3 + i)})`;
    ctx.fillRect(bx - 1, p.y - h * 0.6, 3, 3);
  }
  ctx.lineWidth = 1;
}

function drawGlyph(ctx, p, t) {
  if (p.broken) return;
  const a = 0.5 + 0.5 * Math.sin(t * 2);
  ctx.strokeStyle = `rgba(90,240,255,${0.4 + a * 0.5})`;
  ctx.lineWidth = 2;
  const cx = p.x, cy = p.y - 60;
  ctx.beginPath(); ctx.arc(cx, cy, 11, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy - 16); ctx.lineTo(cx, cy + 16); ctx.moveTo(cx - 14, cy); ctx.lineTo(cx + 14, cy); ctx.stroke();
  ctx.fillStyle = `rgba(160,250,255,${a})`;
  ctx.fillRect(cx - 2, cy - 2, 4, 4);
  ctx.lineWidth = 1;
}

// Concentric rune rings on the Guardian Arena floor; colour follows the boss phase / world state.
function drawArenaRings(ctx, p, t, game) {
  const w = game.world, ph = w.arenaPhase, restored = w.state.flags.guardianDefeated;
  const col = restored ? '140,255,190' : ph === 3 ? '200,90,255' : ph === 2 ? '110,240,190' : '90,220,255';
  const pulse = 0.5 + 0.5 * Math.sin(t * (ph === 3 ? 4 : 1.5));
  ctx.save();
  ctx.lineWidth = 2;
  for (const [k, a] of [[0.97, 0.5], [0.66, 0.35], [0.36, 0.45]]) {
    const R = p.r * k;
    ctx.strokeStyle = `rgba(${col},${a * (0.55 + pulse * 0.45)})`;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, R, R, 0, 0, Math.PI * 2); ctx.stroke();
    // rune ticks
    const n = Math.round(R / 14);
    ctx.fillStyle = `rgba(${col},${a * 0.9})`;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + t * 0.05 * (k > 0.5 ? 1 : -1);
      const x = p.x + Math.cos(ang) * (R + 6), y = p.y + Math.sin(ang) * (R + 6);
      if (i % 3 === 0) ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
      else ctx.fillRect(Math.round(x) - 1, Math.round(y), 3, 1);
    }
  }
  ctx.restore();
}
