// FIREFLIES (A1 Whispering Forest) — "the forest whispers to those who listen". Stand still out of combat for `still`
// seconds and a swarm of fireflies rises around you and drifts toward the nearest thing this map still hides: an
// undiscovered secret (any interactable / NPC tagged `secret` that is not found yet) or an unopened chest. Nothing left
// within `range` tiles -> they just circle you and fade (the forest has nothing more to say here).
// Presentation only (every client runs its own swarm: no online state). The first time on the map a toast explains it.
//   options: { still: s, range: tiles, every: s between swarms, count, travel: tiles a firefly flies }
import { registerMapMechanic, MapMechanic } from '../mapMechanics.js';
import { TILE } from '../../core/constants.js';
import { TAU, rand } from '../../core/math.js';

const D = { still: 1.6, range: 48, every: 3.5, count: 7, travel: 8 };

export class Fireflies extends MapMechanic {
  enter() {
    this.o = { ...D, ...this.def };
    this.flies = [];
    this.emitT = 0;
    this.target = null;
    this.hintT = 2; // first-visit tip after the map banner
  }
  exit() { this.flies = []; }
  reset() { this.flies = []; this.emitT = 0; }

  // what is still hidden here: undiscovered secrets first, then unopened chests (nearest of each kind)
  targets() {
    const w = this.world, found = w.secretsFound, out = [];
    for (const it of w.interactables) {
      if (!w.onMap(it)) continue;
      if (it.secret && !found.has(it.secret)) out.push({ x: it.x, y: it.y, secret: true });
      else if (it.kind === 'chest' && !w.state.chests[it.id]) out.push({ x: it.x, y: it.y, secret: false });
    }
    for (const n of w.npcs) if (n.secret && !found.has(n.secret) && w.onMap(n)) out.push({ x: n.x, y: n.y, secret: true });
    return out;
  }
  pick(p) {
    const max = this.o.range * TILE;
    let best = null, bd = Infinity;
    for (const t of this.targets()) {
      const d = Math.hypot(t.x - p.x, t.y - p.y) * (t.secret ? 0.6 : 1); // secrets call louder than chests
      if (d < bd && d / (t.secret ? 0.6 : 1) <= max) { bd = d; best = t; }
    }
    return best;
  }

  update(dt) {
    const g = this.game, p = g.player;
    if (this.hintT > 0 && (this.hintT -= dt) <= 0 && !this.saved.told) {
      this.saved.told = true;
      g.ui.toast('The forest whispers… stand still and watch the fireflies', 4);
    }
    for (const f of this.flies) {
      f.t += dt;
      const k = f.t / f.life;
      const tx = f.ax + (f.bx - f.ax) * easeIn(k), ty = f.ay + (f.by - f.ay) * easeIn(k);
      f.x = tx + Math.sin(f.t * f.w + f.ph) * f.wob; f.y = ty + Math.cos(f.t * f.w * 0.8 + f.ph) * f.wob * 0.7 - 14;
    }
    this.flies = this.flies.filter((f) => f.t < f.life);
    const listening = !p.dead && (p.idleT || 0) >= this.o.still && !g.combat.inCombat;
    if (!listening) { this.emitT = 0; return; }
    this.emitT -= dt;
    if (this.emitT > 0) return;
    this.emitT = this.o.every;
    this.target = this.pick(p);
    this.emit(p, this.target);
  }
  emit(p, target) {
    const travel = this.o.travel * TILE;
    for (let i = 0; i < this.o.count; i++) {
      const ax = p.x + rand(-26, 26), ay = p.y + rand(-14, 14);
      let bx, by, life;
      if (target) {
        const a = Math.atan2(target.y - ay, target.x - ax) + rand(-0.18, 0.18);
        const len = Math.min(travel, Math.hypot(target.x - ax, target.y - ay)) * rand(0.75, 1);
        bx = ax + Math.cos(a) * len; by = ay + Math.sin(a) * len; life = rand(2.6, 3.4) + i * 0.12;
      } else { // nothing left nearby: a lazy circle around you
        const a = rand(0, TAU);
        bx = p.x + Math.cos(a) * 30; by = p.y + Math.sin(a) * 18; life = rand(1.4, 2);
      }
      this.flies.push({ ax, ay, bx, by, x: ax, y: ay, t: -i * 0.09, life, w: rand(3, 6), ph: rand(0, TAU), wob: rand(4, 9), hue: target && target.secret ? 1 : 0 });
    }
  }

  drawAbove(ctx, t) {
    if (!this.flies.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const f of this.flies) {
      if (f.t < 0) continue;
      const k = f.t / f.life, a = Math.min(1, f.t * 3, (1 - k) * 2.5) * (0.65 + 0.35 * Math.sin(t * 9 + f.ph));
      const c = f.hue ? '200,255,150' : '255,225,140';
      ctx.fillStyle = `rgba(${c},${a * 0.18})`;
      ctx.beginPath(); ctx.arc(f.x, f.y, 11, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(${c},${a * 0.45})`;
      ctx.beginPath(); ctx.arc(f.x, f.y, 5, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(255,255,230,${a})`;
      ctx.fillRect(Math.round(f.x) - 1.5, Math.round(f.y) - 1.5, 3, 3);
    }
    ctx.restore();
  }
  hudTags() {
    return this.flies.length && this.target ? [{ label: '✦ The fireflies lead the way', color: '#d8ff9a' }] : [];
  }
}
const easeIn = (k) => { const c = Math.max(0, Math.min(1, k)); return c * c * (3 - 2 * c); };
registerMapMechanic('fireflies', Fireflies);
