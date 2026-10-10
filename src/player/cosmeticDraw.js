// F4: draw a character's worn cosmetics (data/cosmetics.js). Shared by the local Player and remote players (online),
// so everyone sees the same look. Presentation only: no game state, no stats.
import { cosmeticOf } from '../data/cosmetics.js';
import { makeGlowSheet, glowAlpha } from '../vfx/glowLayer.js';

const TAU = Math.PI * 2;
const glowCache = new WeakMap(); // sheet image -> Map(cosmetic id -> glow canvas)

function glowSheetFor(img, id, opts) {
  if (!img || typeof document === 'undefined') return null;
  let m = glowCache.get(img);
  if (!m) glowCache.set(img, (m = new Map()));
  if (!m.has(id)) { try { m.set(id, makeGlowSheet(img, opts)); } catch { m.set(id, null); } }
  return m.get(id);
}

// ring of light at the feet; layer 'under' = ring + columns behind the body, 'over' = faint ring in front
export function drawCosmeticAura(ctx, x, y, look, t, layer) {
  const c = cosmeticOf(look && look.aura);
  if (!c) return;
  const a = c.aura, col = a.color, pulse = 0.5 + 0.5 * Math.sin(t * 3), R = 26 * (a.ring || 1);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (layer === 'under') {
    const gr = ctx.createRadialGradient(x, y, 2, x, y, R);
    gr.addColorStop(0, `rgba(${col},${0.28 + 0.1 * pulse})`); gr.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(x, y, R, R * 0.42, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(${col},${0.45 + 0.25 * pulse})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(x, y, R * 0.85, R * 0.36, 0, Math.PI, TAU); ctx.stroke();   // back half of the ring
    for (let i = 0; i < (a.columns || 0); i++) {
      const ang = (i / a.columns) * TAU + t * 0.5, cx = x + Math.cos(ang) * R * 0.8, cy = y + Math.sin(ang) * R * 0.34;
      const h = 22 + 8 * Math.sin(t * 2.4 + i), lg = ctx.createLinearGradient(cx, cy, cx, cy - h);
      lg.addColorStop(0, `rgba(${col},0.45)`); lg.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = lg; ctx.fillRect(cx - 1.5, cy - h, 3, h);
    }
  } else {
    ctx.strokeStyle = `rgba(${col},${0.5 + 0.3 * pulse})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(x, y, R * 0.85, R * 0.36, 0, 0, Math.PI); ctx.stroke();       // front half
  }
  ctx.restore();
}

// the body with its dye, then its glow layer (same frame, same flip)
export function drawCosmeticBody(ctx, sprites, f, x, y, alpha, look, t) {
  const dye = cosmeticOf(look && look.dye);
  if (dye && dye.filter) { ctx.save(); ctx.filter = dye.filter; sprites.draw(ctx, f, x, y, alpha); ctx.restore(); }
  else sprites.draw(ctx, f, x, y, alpha);
  const gl = cosmeticOf(look && look.glow);
  if (!gl || !f.img || alpha < 0.3) return;
  const sheet = glowSheetFor(f.img, look.glow, gl.glow);
  if (!sheet) return;
  let a = glowAlpha(gl.glow, t) * alpha;
  const g = { ...f, img: sheet };
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  while (a > 0.01) { sprites.draw(ctx, g, x, y, Math.min(1, a)); a -= 1; }
  ctx.restore();
}

export const hasLook = (look) => !!(look && (look.dye || look.aura || look.glow));
