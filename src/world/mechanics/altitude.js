// ALTITUDE COLD (B3 Frostpeak) — the climb itself is the enemy. The higher you are (smaller tile y) the faster COLD
// builds: nothing below `low`, the full `rate` at `high` and above. Same cold meter / statuses as the blizzard (60% =
// FROSTBITE slower, 100% = FROZEN THROUGH damage). Answers:
//   CAMPFIRES (`fires`) at the camps: warm you up, the safe stops of the climb (respawn is a waystone anyway).
//   WARM EMBERS (`embers`): glowing coals on the path — walk over one for WARMTH (`warmth` s: no cold, and it drains);
//   each comes back `regrow` s after it was taken. Personal (every client has its own embers): no online state.
//   options: { low, high (tile y), rate (cold / s at the top), fires, embers, warmth, regrow, warmR, warmRate, drain }
import { registerMapMechanic, MapMechanic } from '../mapMechanics.js';
import { TILE } from '../../core/constants.js';
import { TAU, rand } from '../../core/math.js';
import { drawCampfire } from './blizzard.js';

const D = { low: 160, high: 40, rate: 5, fires: [], embers: [], warmth: 40, regrow: 120, warmR: 96, warmRate: 20, drain: 3 };

export class AltitudeCold extends MapMechanic {
  enter() {
    this.o = { ...D, ...this.def };
    const m = this.world.map;
    this.fires = this.o.fires.map(([tx, ty]) => m.findOpen((tx + 0.5) * TILE, (ty + 0.5) * TILE, 3));
    this.embers = this.o.embers.map(([tx, ty]) => ({ ...m.findOpen((tx + 0.5) * TILE, (ty + 0.5) * TILE, 3), gone: 0 }));
    this.cold = 0;
    this.warmT = 0;
    this.told = false;
  }
  exit() { this.clearStatus(); }
  reset() { this.cold = 0; this.warmT = 0; this.clearStatus(); }
  clearStatus() { const p = this.game.player; if (p && p.status) { p.status.remove('frostbite'); p.status.remove('frozen_through'); } }
  nearFire(e) { return this.fires.some((f) => Math.hypot(f.x - e.x, f.y - e.y) <= this.o.warmR); }
  // 0 at the foot of the mountain .. 1 at the top band
  height(y) { const ty = y / TILE, o = this.o; return Math.max(0, Math.min(1, (o.low - ty) / (o.low - o.high))); }

  update(dt) {
    const p = this.game.player, o = this.o;
    for (const e of this.embers) if (e.gone > 0) e.gone -= dt;
    if (!p || p.dead) return;
    // walk over an ember: warmth
    for (const e of this.embers) {
      if (e.gone > 0 || Math.hypot(e.x - p.x, e.y - p.y) > 26) continue;
      e.gone = o.regrow;
      this.warmT = o.warmth;
      this.game.ui.toast(`Warm Ember — no cold for ${o.warmth} s`, 2);
      this.game.vfx.burst(e.x, e.y - 6, '#ffb060', 14, 90);
      this.game.audio.sfx('gather');
    }
    const h = this.height(p.y);
    if (h > 0.15 && !this.told && !this.saved.told) { this.told = this.saved.told = true; this.game.ui.toast('The air thins and bites — keep near fires, gather warm embers', 4); }
    if (this.warmT > 0) this.warmT -= dt;
    const warm = this.nearFire(p);
    if (warm) this.cold -= o.warmRate * dt;
    else if (this.warmT > 0) this.cold -= o.drain * 2 * dt;
    else if (h > 0) this.cold += o.rate * h * dt;
    else this.cold -= o.drain * dt;
    this.cold = Math.max(0, Math.min(100, this.cold));
    const keep = (id, data) => { const s = p.status.map.get(id); if (!s || s.t < 0.4) p.status.add(id, 1.2, data); };
    if (this.cold >= 60) keep('frostbite');
    if (this.cold >= 100) keep('frozen_through', { damage: Math.max(4, Math.round(p.maxHp * 0.03)) });
    if ((warm || this.warmT > 0) && Math.random() < dt * 4) this.game.vfx.particle(p.x + rand(-10, 10), p.y - 18, { color: '#ffb060', vy: -24, life: 0.8, size: 2, add: true, drag: 0 });
  }

  drawGround(ctx, t) {
    for (const f of this.fires) drawCampfire(ctx, f, t, this.o.warmR, this.game);
    for (const e of this.embers) {
      if (e.gone > 0) continue;
      const pulse = 0.6 + 0.4 * Math.sin(t * 4 + e.x);
      ctx.fillStyle = `rgba(255,140,50,${0.18 * pulse})`;
      ctx.beginPath(); ctx.ellipse(e.x, e.y, 18, 11, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3a2a24'; ctx.fillRect(e.x - 6, e.y - 3, 12, 5);
      ctx.fillStyle = `rgba(255,${150 + 70 * pulse | 0},70,1)`;
      ctx.fillRect(e.x - 4, e.y - 4, 3, 3); ctx.fillRect(e.x + 1, e.y - 3, 3, 2); ctx.fillRect(e.x - 1, e.y - 1, 2, 2);
      if (Math.random() < 0.06) this.game.vfx.particle(e.x + rand(-4, 4), e.y - 6, { color: '#ffb060', vy: -20, life: 0.8, size: 1.2, add: true, drag: 0 });
    }
  }
  // frost creeps in at the screen edges as the cold rises
  drawScreen(ctx) {
    const k = Math.max(0, (this.cold - 30) / 70);
    if (k <= 0) return;
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const gr = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.7);
    gr.addColorStop(0, 'rgba(200,225,255,0)'); gr.addColorStop(1, `rgba(200,225,255,${0.55 * k})`);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  }
  hudTags() {
    const out = [], p = this.game.player;
    if (this.warmT > 0) out.push({ label: `🔥 WARMTH ${Math.ceil(this.warmT)}s`, color: '#ffc080' });
    if (this.cold > 1 || (p && this.height(p.y) > 0)) out.push({ label: `❄ ALTITUDE COLD ${Math.round(this.cold)}%${p && this.nearFire(p) ? ' · warming' : ''}`, color: this.cold >= 60 ? '#7ab8ff' : '#c8dcf0' });
    return out;
  }
}
registerMapMechanic('altitude_cold', AltitudeCold);
