import { TILE, TEAM } from '../core/constants.js';
import { TAU, rand } from '../core/math.js';

// HAZARD SYSTEM — environmental hazards placed by map data (maps/*.js content.hazards). Only the current map's
// hazards run. Hazards reuse the core systems: statuses (poison / slow / root), telegraphs and enemyStrike, so
// dodging, perfect dodges and guards work against them like against any attack.
//   miasma { tx, ty, r (tiles), interval, statuses: [{ id, dur }] }        standing inside applies the statuses
//   thorns { tx, ty, r (tiles), period, windup, power, root? (seconds) }   telegraphed eruption every `period`
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
