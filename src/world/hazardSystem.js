import { TILE, TEAM } from '../core/constants.js';
import { TAU, rand } from '../core/math.js';

// HAZARD SYSTEM — environmental hazards placed by map data (maps/*.js content.hazards). Only the current map's
// hazards run. Hazards reuse the core systems: statuses (poison / slow / root), telegraphs and enemyStrike, so
// dodging, perfect dodges and guards work against them like against any attack.
//   miasma { tx, ty, r (tiles), interval, statuses: [{ id, dur }] }        standing inside applies the statuses
//   thorns { tx, ty, r (tiles), period, windup, power, root? (seconds) }   telegraphed eruption every `period`
//   beam   { tx, ty, len (tiles), angle (rad), width (px), period, windup, power }  rune-ward pylons at both
//          ends fire a telegraphed line across a room on a rhythm — time the crossing (or dodge through)
//   while  { flag?, notFlag? }                                              active only while the world flags match
// The Guardian's own arena hazards stay in world.js (they follow the boss phases).
export class HazardSystem {
  constructor(world, maps) {
    this.world = world;
    this.list = [];
    for (const d of maps) for (const h of (d.content && d.content.hazards) || []) {
      const x = (h.tx + 0.5) * TILE, y = (h.ty + 0.5) * TILE;
      this.list.push({ interval: 1, period: 5, windup: 0.9, power: 14, ...h, mapId: d.id, x, y, r: h.r * TILE,
        t: rand(0, h.period || 5), tick: 0, src: { x, y, team: TEAM.ENEMY, name: h.name || h.kind } });
    }
  }
  active(h) {
    const w = this.world, f = w.state.flags, c = h.while || {};
    if (h.mapId !== w.mapId) return false;
    if (c.flag && !f[c.flag]) return false;
    if (c.notFlag && f[c.notFlag]) return false;
    return true;
  }
  // hazards are drawn flattened (ellipse 1 : 0.65) — "inside" uses the same shape
  inside(h, x, y) { const dx = (x - h.x) / h.r, dy = (y - h.y) / (h.r * 0.65); return dx * dx + dy * dy <= 1; }
  update(dt) {
    const g = this.world.game, p = g.player;
    for (const h of this.list) {
      if (!this.active(h)) continue;
      if (h.kind === 'miasma') {
        h.tick -= dt;
        if (h.tick <= 0 && !p.dead && this.inside(h, p.x, p.y)) {
          h.tick = h.interval;
          for (const s of h.statuses || []) p.status.add(s.id, s.dur);
          g.vfx.burst(p.x, p.y - 8, '#8adf50', 6, 50);
        }
        if (Math.random() < 0.12) g.vfx.particle(h.x + rand(-h.r, h.r) * 0.8, h.y + rand(-h.r, h.r) * 0.5, { color: '#7ad050', vy: -18, life: 1, size: 2, add: true });
      } else if (h.kind === 'beam') {
        h.t += dt;
        h.glow = Math.max(0, (h.glow || 0) - dt * 3);
        if (h.t < h.period) continue;
        h.t = 0;
        const tel = g.combat.telegraphs.add({ shape: 'line', x: h.x, y: h.y, ang: h.angle || 0, len: h.len * TILE, width: h.width || 12, total: h.windup, color: '120,220,255', owner: h });
        tel.onResolve = () => {
          h.glow = 1;
          g.combat.enemyStrike(h.src, tel, h.power, { knock: 90, knockAng: (h.angle || 0) + Math.PI / 2 });
          const ex = h.x + Math.cos(h.angle || 0) * h.len * TILE, ey = h.y + Math.sin(h.angle || 0) * h.len * TILE;
          for (let i = 0; i <= 6; i++) g.vfx.burst(h.x + (ex - h.x) * (i / 6), h.y + (ey - h.y) * (i / 6), '#8ae8ff', 3, 60);
          g.audio.sfx('shatter');
        };
      } else if (h.kind === 'thorns') {
        h.t += dt;
        if (h.t < h.period) continue;
        h.t = 0;
        const tel = g.combat.telegraphs.add({ shape: 'circle', x: h.x, y: h.y, r: h.r, total: h.windup, color: '120,255,120', owner: h });
        tel.onResolve = () => {
          g.combat.enemyStrike(h.src, tel, h.power, { knock: 120, onHit: (pl) => { if (h.root) pl.status.add('root', h.root); } });
          this.world.rootSpike(h.x, h.y);
          g.vfx.burst(h.x, h.y, '#6adf6a', 12, 100);
        };
      }
    }
  }
  draw(ctx, t) {
    for (const h of this.list) {
      if (!this.active(h)) continue;
      if (h.kind === 'miasma') {
        const pulse = 0.5 + 0.5 * Math.sin(t * 2 + h.x);
        ctx.fillStyle = `rgba(60,90,30,${0.42 + pulse * 0.12})`;
        ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r * 0.65, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = `rgba(150,220,80,${0.35 + pulse * 0.35})`;
        ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r * 0.65, 0, 0, TAU); ctx.stroke();
        ctx.fillStyle = 'rgba(170,240,90,0.5)';
        for (let i = 0; i < 4; i++) { // bubbles
          const a = i * 1.7 + h.x, k = (t * 0.6 + i * 0.25) % 1;
          ctx.beginPath(); ctx.arc(h.x + Math.cos(a) * h.r * 0.5, h.y + Math.sin(a) * h.r * 0.3, 1 + k * 2, 0, TAU); ctx.fill();
        }
      } else if (h.kind === 'beam') {
        // the two rune pylons; they brighten as the beam charges and flash when it fires
        const a = h.angle || 0, ex = h.x + Math.cos(a) * h.len * TILE, ey = h.y + Math.sin(a) * h.len * TILE;
        const charge = Math.max(0, (h.t - (h.period - h.windup - 0.6)) / (h.windup + 0.6));
        const lit = Math.max(charge, h.glow || 0);
        for (const [px, py] of [[h.x, h.y], [ex, ey]]) {
          ctx.fillStyle = `rgba(90,200,255,${0.25 + lit * 0.6})`;
          ctx.beginPath(); ctx.ellipse(px, py - 10, 5 + lit * 3, 9 + lit * 3, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#cff6ff';
          ctx.fillRect(px - 1, py - 14, 2, 8);
        }
        if (h.glow > 0) {
          ctx.strokeStyle = `rgba(170,240,255,${h.glow})`; ctx.lineWidth = (h.width || 12) * h.glow;
          ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(ex, ey); ctx.stroke(); ctx.lineWidth = 1;
        }
      } else if (h.kind === 'thorns') {
        ctx.fillStyle = 'rgba(40,50,25,0.55)';
        ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r * 0.65, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#4a3a24'; ctx.lineWidth = 2;
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * TAU + h.x;
          ctx.beginPath(); ctx.moveTo(h.x, h.y);
          ctx.quadraticCurveTo(h.x + Math.cos(a + 0.5) * h.r * 0.6, h.y + Math.sin(a + 0.5) * h.r * 0.4, h.x + Math.cos(a) * h.r, h.y + Math.sin(a) * h.r * 0.65);
          ctx.stroke();
        }
        ctx.lineWidth = 1;
      }
    }
  }
}
