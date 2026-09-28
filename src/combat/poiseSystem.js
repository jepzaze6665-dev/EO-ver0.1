import { POISE } from '../data/poise.js';

// POISE (Combat 2.0 §48) — generic, pure (no game refs): one per enemy. Hits lower it; at 0 the owner STAGGERS,
// poise refills to max and a short immunity stops stun-locks. It regenerates when the owner avoids damage.
//   const poise = new Poise(60, POISE.monster)
//   poise.hit(opts.stagger, { heavy, counter, big, canBreak })  -> true when this hit broke it
//   poise.update(dt)
export class Poise {
  constructor(max, rules = POISE.monster) {
    this.max = Math.max(1, max || 1);
    this.rules = rules;
    this.value = this.max;
    this.sinceHit = 99;
    this.immuneT = 0;
    this.breaks = 0;
  }
  ratio() { return this.value / this.max; }
  // how much poise one hit removes (pure)
  static amount(stagger, { heavy = false, counter = false, big = false } = {}, rules = POISE.monster) {
    let a = stagger ?? POISE.defaultHit;
    if (big) a *= POISE.bigMult;
    if (counter) a *= POISE.counterMult;
    if (heavy) a *= rules.heavyArmor ?? 1;
    return Math.max(0, a);
  }
  // canBreak = false: poise can reach 0 but the break waits for a hit when it is allowed (e.g. boss mid-move)
  hit(stagger, opts = {}) {
    this.sinceHit = 0;
    if (this.immuneT > 0) return false;
    this.value = Math.max(0, this.value - Poise.amount(stagger, opts, this.rules));
    if (this.value > 0 || opts.canBreak === false) return false;
    this.value = this.max;
    this.immuneT = this.rules.breakImmunity || 0;
    this.breaks++;
    return true;
  }
  update(dt) {
    if (!(dt > 0)) return;
    this.immuneT = Math.max(0, this.immuneT - dt);
    this.sinceHit += dt;
    if (this.sinceHit >= this.rules.regenDelay && this.value < this.max) this.value = Math.min(this.max, this.value + this.max * this.rules.regenRate * dt);
  }
  reset() { this.value = this.max; this.sinceHit = 99; this.immuneT = 0; }
}
