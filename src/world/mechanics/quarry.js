// QUARRY (random event, A1: the GOLDEN HARE) — on some map entries (`chance`) a rare creature appears somewhere far from you
// (`monster` type, tougher: hp ×`hp`), glowing gold. It never fights: it bolts away from anyone within `scare` px (faster
// than you walk — cut it off, dash, use ranged skills) and slips away for good after `life` seconds. Catch it = a burst of
// gold + `reward` items + a banner. The monster's own AI is replaced by Monster.scripted (generic hook).
// ONLINE: the host's monster is the real one (guests see a puppet like any monster); the reward is paid by whoever's
// client sees the kill (enemyDefeated) — like normal loot.
//   options: { monster, name, chance, hp, speed, scare (px), life (s), gold, reward: [{ item, count }], spots: [[tx, ty]] }
import { registerMapMechanic, MapMechanic } from '../mapMechanics.js';
import { TILE } from '../../core/constants.js';
import { TAU, rand } from '../../core/math.js';
import { Monster } from '../../monsters/monster.js';

const D = { chance: 0.3, hp: 4, speed: 1.6, scare: 260, life: 75, gold: 400, reward: [] };

export class Quarry extends MapMechanic {
  enter() {
    this.o = { ...D, ...this.def };
    this.mon = null; this.t = 0; this.fled = false; this.caught = false;
    if (!this.authority || !(Quarry.force || Math.random() < this.o.chance)) return; // Quarry.force: tests
    this.spawn();
  }
  spawn() {
    const w = this.world, g = this.game, o = this.o, p = g.player;
    const spots = (o.spots || []).map(([tx, ty]) => w.map.findOpen((tx + 0.5) * TILE, (ty + 0.5) * TILE, 3))
      .filter((s) => w.mapManager.idAt(s.x, s.y) === this.mapId && Math.hypot(s.x - p.x, s.y - p.y) > 600);
    if (!spots.length) return;
    const at = spots[Math.floor(Math.random() * spots.length)];
    const home = w.mapManager.get(this.mapId);
    const m = new Monster(g, o.monster, at.x, at.y, { levelBand: home && home.levelBand, mapId: this.mapId });
    m.maxHp = Math.round(m.maxHp * o.hp); m.hp = m.maxHp;
    Object.defineProperty(m, 'name', { value: o.name || 'Golden ' + m.def.name });
    m.golden = true;
    m.scripted = (mm, dt) => this.flee(mm, dt);
    w.monsters.push(m);
    this.mon = m; this.t = 0;
    this.onKill = (e) => { if (e.monster === m || e.entity === m || e.enemy === m) this.reward(); };
    g.events.on('enemyDefeated', this.onKill);
    g.ui.banner(`A ${o.name || 'golden creature'} stirs`, 'Something bright is hiding nearby — catch it before it slips away', '#ffd860');
  }
  // run from the nearest player who comes close; otherwise nibble around
  flee(m, dt) {
    const g = this.game, map = this.world.map, o = this.o;
    const who = g.combatants().filter((q) => !q.dead);
    let near = null, nd = o.scare;
    for (const q of who) { const d = Math.hypot(q.x - m.x, q.y - m.y); if (d < nd) { nd = d; near = q; } }
    m.state = 'patrol';
    if (near) {
      let a = Math.atan2(m.y - near.y, m.x - near.x) + Math.sin(this.t * 3) * 0.5; // zig-zag a little
      const v = m.def.speed * o.speed * dt;
      const bx = m.x, by = m.y;
      map.moveCircle(m, Math.cos(a) * v, Math.sin(a) * v);
      if (Math.hypot(m.x - bx, m.y - by) < v * 0.3) { a += Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1); map.moveCircle(m, Math.cos(a) * v, Math.sin(a) * v); } // cornered: sidestep
      m.facing = a; m.moving = true;
    } else m.moving = false;
    if (Math.random() < 0.25) g.vfx.particle(m.x + rand(-6, 6), m.y - rand(4, 16), { color: '#ffe070', vy: -16, life: 0.6, size: 1.6, add: true });
  }
  reward() {
    if (this.caught) return;
    this.caught = true;
    const g = this.game, p = g.player, o = this.o, m = this.mon;
    const E = g.online && g.online.econ, pay = () => { p.addGold(o.gold); for (const r of o.reward) g.inventory.add(r.item, r.count); }; // ONLINE H5c: reason quarry:<map>
    if (E) E.why('quarry', this.mapId, pay); else pay();
    g.ui.pickup({ name: 'Gold', color: '#ffd24a', icon: 'coin' }, o.gold);
    g.ui.banner('CAUGHT!', `${o.name || 'It'} leaves a trail of gold`, '#ffd860');
    g.vfx.burst(m.x, m.y - 10, '#ffd860', 40, 200);
    g.audio.sfx('chest_rare');
    this.stop();
  }
  update(dt) {
    const m = this.mon;
    if (!m || m.dead || this.caught) return;
    this.t += dt;
    if (this.t >= this.o.life) { // it slips away
      this.fled = true;
      this.game.vfx.burst(m.x, m.y - 10, '#ffe070', 20, 120);
      this.game.ui.toast(`The ${this.o.name || 'creature'} slipped away…`, 2.5);
      m.removed = true; m.dead = true; m.deathT = 99;
      this.stop();
    }
  }
  stop() { if (this.onKill) { this.game.events.off && this.game.events.off('enemyDefeated', this.onKill); this.onKill = null; } }
  exit() {
    this.stop();
    if (this.mon && !this.mon.dead) { this.mon.removed = true; this.mon.dead = true; this.mon.deathT = 99; }
  }
  drawAbove(ctx, t) {
    const m = this.mon;
    if (!m || m.dead) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const k = 0.6 + 0.4 * Math.sin(t * 6);
    ctx.fillStyle = `rgba(255,200,60,${0.45 * k})`;
    ctx.beginPath(); ctx.ellipse(m.x, m.y - 10, 20, 16, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(255,230,120,${0.2 * k})`;
    ctx.beginPath(); ctx.ellipse(m.x, m.y - 10, 34, 28, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  hudTags() {
    const m = this.mon;
    return m && !m.dead && !this.caught ? [{ label: `✦ ${this.o.name || 'Quarry'} — ${Math.ceil(this.o.life - this.t)}s`, color: '#ffd860' }] : [];
  }
}
registerMapMechanic('quarry', Quarry);
