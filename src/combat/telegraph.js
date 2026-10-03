import { TAU } from '../core/math.js';

// Ground warnings shown before enemy / boss attacks. Shapes:
//  circle {x,y,r} | ring {x,y,r0,r} | cone {x,y,r,ang,half} | line {x,y,ang,len,width}
// TIERS (owner, docs/ui/telegraph_mockup.png) — the look says how dangerous it is:
//   1 LIGHT  : ordinary monster attacks — dashed faint outline + a thin line closing in (no fill)
//   2 HEAVY  : heavy / guard-break attacks, elites, world hazards, ordinary boss moves — soft edge glow, a ring closing in
//   3 DANGER : unblockable, big boss moves, mechanics (def.danger) — deep red, hatch, ⚠, glowing white edge
// def.tier overrides; else telegraphTier(def). Player setting (localStorage, TELEGRAPH_VIEW): which tiers are DRAWN —
// 'all' | 'heavy' (default: tier 2+) | 'danger' (tier 3). Hidden ones still resolve (gameplay never changes).
export const TELEGRAPH_VIEW = { options: ['all', 'heavy', 'danger'], default: 'heavy', storageKey: 'eclipse_telegraph_view', bigBoss: 90 };

export function telegraphTier(t) {
  if (t.tier) return t.tier;
  const o = t.owner;
  if (t.unblockable || t.danger) return 3;
  if (o && o.isBoss) return t.guardBreak || t.heavy || (t.r || 0) >= TELEGRAPH_VIEW.bigBoss || (t.len || 0) >= TELEGRAPH_VIEW.bigBoss * 2 ? 3 : 2;
  if (o && o.b && o.b.isBoss) return 3;                       // a boss mechanic (boss/mechanics.js keeps its boss in .b)
  if (t.heavy || t.guardBreak || (o && o.elite)) return 2;
  const monster = o && typeof o.hp === 'number' && o.def;     // an ordinary monster (or its online puppet)
  return monster || !o ? 1 : 2;                               // other owners = world hazards
}

let view = null;
export const telegraphView = () => {
  if (view) return view;
  let v = null;
  try { v = localStorage.getItem(TELEGRAPH_VIEW.storageKey); } catch (e) { v = null; }
  return (view = TELEGRAPH_VIEW.options.includes(v) ? v : TELEGRAPH_VIEW.default);
};
export const setTelegraphView = (v) => {
  if (!TELEGRAPH_VIEW.options.includes(v)) return;
  view = v;
  try { localStorage.setItem(TELEGRAPH_VIEW.storageKey, v); } catch (e) { /* private mode: this session only */ }
};
const minTier = () => ({ all: 1, heavy: 2, danger: 3 })[telegraphView()];

export class Telegraphs {
  constructor() {
    this.list = [];
  }
  add(def) {
    const t = { time: 0, total: 0.6, color: '255,60,60', resolved: false, fade: 0, ...def };
    t.tierN = telegraphTier(t);
    this.list.push(t);
    return t;
  }
  cancelOwner(owner) {
    for (const t of this.list) if (t.owner === owner && !t.resolved) { t.cancelled = true; t.resolved = true; t.fade = 0.12; }
  }
  update(dt) {
    for (const t of this.list) {
      if (t.resolved) { t.fade -= dt; continue; }
      if (t.owner && t.owner.dead) { t.resolved = true; t.cancelled = true; t.fade = 0.1; continue; }
      if (t.follow) t.follow(t, dt);
      t.time += dt;
      if (t.time >= t.total) {
        t.resolved = true;
        t.fade = 0.18;
        if (t.onResolve) t.onResolve(t);
      }
    }
    this.list = this.list.filter((t) => !t.resolved || t.fade > 0);
  }
  clear() { this.list.length = 0; }

  draw(ctx, time) {
    const min = minTier();
    for (const t of this.list) {
      const tier = t.tierN || 1;
      if (tier < min) continue;
      const p = Math.min(1, t.time / t.total);
      ctx.save();
      if (t.resolved) {
        if (t.cancelled) { ctx.restore(); continue; }
        // impact flash (light attacks: a faint one)
        ctx.globalAlpha = Math.max(0, t.fade / 0.18) * (tier === 1 ? 0.3 : tier === 2 ? 0.55 : 0.75);
        ctx.fillStyle = 'rgba(255,230,210,1)';
        this.path(ctx, t, 1);
        ctx.fill();
        ctx.restore();
        continue;
      }
      ctx.globalAlpha = Math.min(1, t.time / 0.12); // fade in
      if (tier === 1) this.drawLight(ctx, t, p);
      else this.drawZone(ctx, t, p, tier, time);
      ctx.restore();
    }
  }
  drawLight(ctx, t, p) {
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = 'rgba(255,190,150,0.4)'; ctx.lineWidth = 1.2;
    this.path(ctx, t, 1); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = `rgba(255,205,165,${0.3 + p * 0.45})`; ctx.lineWidth = 1.6;
    this.path(ctx, t, p); ctx.stroke();
  }
  drawZone(ctx, t, p, tier, time) {
    const danger = tier === 3;
    const col = danger ? (t.color === '255,60,60' ? '200,20,40' : t.color) : (t.color === '255,60,60' ? '255,90,60' : t.color);
    // soft fill: clear centre, coloured edge
    const R = t.shape === 'line' ? t.len : t.r || 1;
    const cx = t.shape === 'line' ? t.x + Math.cos(t.ang) * t.len / 2 : t.x, cy = t.shape === 'line' ? t.y + Math.sin(t.ang) * t.len / 2 : t.y;
    const gr = ctx.createRadialGradient(cx, cy, R * (t.shape === 'line' ? 0.05 : 0), cx, cy, Math.max(1, R * (t.shape === 'line' ? 0.6 : 1)));
    gr.addColorStop(0, `rgba(${col},${danger ? 0.1 : 0.04})`);
    gr.addColorStop(1, `rgba(${col},${(danger ? 0.36 : 0.24) + p * 0.08})`);
    ctx.fillStyle = gr;
    this.path(ctx, t, 1); ctx.fill();
    // closing ring = when it lands
    ctx.strokeStyle = `rgba(255,${danger ? 120 : 175},125,${0.45 + p * 0.45})`;
    ctx.lineWidth = danger ? 3 : 2;
    this.path(ctx, t, Math.max(0.05, p)); ctx.stroke();
    if (danger) {
      ctx.save();
      this.path(ctx, t, 1); ctx.clip();
      ctx.strokeStyle = 'rgba(255,60,70,0.16)'; ctx.lineWidth = 3;
      const s = R * 1.2;
      for (let i = -s * 2; i < s * 2; i += 14) { ctx.beginPath(); ctx.moveTo(cx + i - s, cy - s); ctx.lineTo(cx + i + s, cy + s); ctx.stroke(); }
      ctx.restore();
      const gx = t.shape === 'cone' ? t.x + Math.cos(t.ang) * t.r * 0.55 : cx, gy = t.shape === 'cone' ? t.y + Math.sin(t.ang) * t.r * 0.55 : cy;
      if (R > 30) { ctx.font = '700 20px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,235,220,0.9)'; ctx.fillText('⚠', gx, gy + 7); }
    }
    // outline: glowing; the last quarter pulses white (danger) / brighter (heavy)
    const late = p > 0.75 && Math.sin(time * 10) > 0;
    ctx.shadowColor = `rgba(${col},0.9)`; ctx.shadowBlur = danger ? 14 : 6;
    ctx.strokeStyle = danger ? (late ? 'rgba(255,250,245,1)' : 'rgba(255,225,215,0.9)') : late ? `rgba(255,220,190,0.95)` : `rgba(${col},0.85)`;
    ctx.lineWidth = danger ? 3 : 1.6;
    this.path(ctx, t, 1); ctx.stroke();
    ctx.shadowBlur = 0;
  }

  path(ctx, t, s) {
    ctx.beginPath();
    switch (t.shape) {
      case 'circle':
        ctx.arc(t.x, t.y, Math.max(0.1, t.r * s), 0, TAU);
        break;
      case 'ring': {
        const r0 = t.r0, r1 = t.r0 + (t.r - t.r0) * s;
        ctx.arc(t.x, t.y, r1, 0, TAU);
        ctx.arc(t.x, t.y, r0, 0, TAU, true);
        break;
      }
      case 'cone':
        ctx.moveTo(t.x, t.y);
        ctx.arc(t.x, t.y, Math.max(0.1, t.r * s), t.ang - t.half, t.ang + t.half);
        ctx.closePath();
        break;
      case 'line': {
        const c = Math.cos(t.ang), sn = Math.sin(t.ang), hw = t.width;
        const L = t.len * s;
        ctx.moveTo(t.x - sn * hw, t.y + c * hw);
        ctx.lineTo(t.x + c * L - sn * hw, t.y + sn * L + c * hw);
        ctx.lineTo(t.x + c * L + sn * hw, t.y + sn * L - c * hw);
        ctx.lineTo(t.x + sn * hw, t.y - c * hw);
        ctx.closePath();
        break;
      }
    }
  }
}
