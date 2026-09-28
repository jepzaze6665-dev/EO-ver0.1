import { dist, TAU } from '../core/math.js';

// BOSS MECHANICS — the signature rule that makes one boss fight different from another (data: data/bosses.js
// `mechanics: [{ type, ... }]`). An AreaBoss owns a list of these and calls their hooks; no boss is named here.
//   hooks (all optional): reset() · update(dt) · onMoveDone(id, move) · onImpact({ x, y, r, move })
//                         wantsTurn() -> generator | null (take over the boss's next action) · tags() -> HUD tags
//   A new mechanic = one class + one line in MECHANICS.
//
// overheat   : every fire move heats the boss (gain: { moveId: heat }). At `max` it OVERHEATS: a big telegraphed
//              blast around it (survive it: dodge out or through), then it collapses — a long weak window
//              (`weak` s) where it takes the burst. Heat resets. Tags: HEAT n% / OVERHEATING.
// lava_pools : impacts of the named moves leave burning pools on the ground for `life` s (phase 2: `life2`);
//              standing in one burns. The arena shrinks while they last — keep moving.
class Overheat {
  constructor(boss, d) { this.b = boss; this.d = { max: 100, weak: 5, blast: { r: 170, power: 44, windup: 1.6 }, ...d }; this.reset(); }
  reset() { this.heat = 0; this.pending = false; }
  onMoveDone(id) {
    const add = (this.d.gain || {})[id] || 0;
    if (!add || this.b.state !== 'fight') return;
    this.heat = Math.min(this.d.max, this.heat + add * (this.b.phase > 1 ? this.d.phase2Mult || 1.25 : 1));
    if (this.heat >= this.d.max) this.pending = true;
  }
  wantsTurn() { return this.pending ? this.overheat() : null; }
  *overheat() {
    const b = this.b, g = b.game, fx = b.look.vfx || {}, bl = this.d.blast;
    this.pending = false;
    b.pose = 'roar';
    g.ui.callout('OVERHEATING', 'Get clear of the blast — then strike its exposed core!', '#ff9a50');
    g.audio.sfx('roar');
    if (fx.charge) g.vfx.sprite(fx.charge, b.x, b.y - b.height * 0.5, 0, { scale: 2.2, life: b.wind(bl.windup), follow: b });
    const tel = b.tele({ shape: 'circle', x: b.x, y: b.y, r: bl.r, total: b.wind(bl.windup), color: '255,110,30' }, { dmg: 'magic' });
    yield tel.total;
    b.hit(tel, { power: bl.power, knock: 320, dmg: 'magic', status: [{ id: 'burn', dur: 3 }] });
    g.camera.shake(0.9);
    g.vfx.flash('255,140,60', 0.45, 2);
    g.vfx.ring(b.x, b.y, 20, bl.r, { color: '255,120,40', life: 0.5, width: 10, fill: true });
    if (fx.nova) g.vfx.sprite(fx.nova, b.x, b.y, 0, { scale: bl.r / 45, life: 0.6, ground: true, squash: 0.6 });
    g.audio.sfx('slam_big');
    this.heat = 0;
    yield 0.3;
    b.enterWeak(this.d.weak, 'OVERHEATED');
    g.events.emit('bossOverheated', { bossId: b.bossId });
  }
  tags() {
    const p = Math.round((this.heat / this.d.max) * 100);
    return [{ label: p >= 80 ? `OVERHEATING ${p}%` : `HEAT ${p}%`, color: p >= 80 ? '#ff6a30' : '#ffb070' }];
  }
}

class LavaPools {
  constructor(boss, d) { this.b = boss; this.d = { life: 7, life2: 9, max: 14, scale: 0.8, tick: 0.5, burn: 2, from: [], ...d }; this.pools = []; }
  reset() { this.pools = []; }
  onImpact({ x, y, r, move }) {
    if (!this.d.from.includes(move.id)) return;
    const b = this.b, g = b.game, life = b.phase > 1 ? this.d.life2 : this.d.life;
    if (this.pools.length >= this.d.max) this.pools.shift();
    this.pools.push({ x, y, r: r * this.d.scale, t: life, tick: 0 });
    const fx = b.look.vfx || {};
    if (fx.pool) g.vfx.sprite(fx.pool, x, y, 0, { scale: (r * this.d.scale) / 40, life, ground: true, squash: 0.7, frame: 4, alpha: 0.85, glow: 0.2 });
  }
  update(dt) {
    const g = this.b.game;
    for (const p of this.pools) {
      p.t -= dt; p.tick -= dt;
      if (p.tick > 0) continue;
      for (const pl of g.players()) {
        if (pl.dead || pl.invulnerable() || dist(pl.x, pl.y, p.x, p.y) > p.r) continue;
        pl.status.add('burn', this.d.burn, { source: this.b });
        p.tick = this.d.tick;
      }
      if (Math.random() < 0.3) g.vfx.particle(p.x + (Math.random() - 0.5) * p.r, p.y + (Math.random() - 0.5) * p.r * 0.6, { color: '#ff8a30', vy: -30, life: 0.6, size: 2, add: true });
    }
    this.pools = this.pools.filter((p) => p.t > 0);
  }
  // pools stay on the ground drawn by their VFX sprite; without one, a glowing ellipse
  draw(ctx) {
    if ((this.b.look.vfx || {}).pool) return;
    for (const p of this.pools) {
      ctx.fillStyle = `rgba(255,110,30,${0.25 + 0.1 * Math.sin(p.t * 5)})`;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 0.6, 0, 0, TAU); ctx.fill();
    }
  }
}

export const MECHANICS = { overheat: Overheat, lava_pools: LavaPools };
export const MECHANIC_TYPES = Object.keys(MECHANICS);
