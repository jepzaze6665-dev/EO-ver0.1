import { ATTACK_SLOTS } from '../data/attackSlots.js';

// ATTACK SLOTS (Combat 2.0 §64) — generic, pure (no game refs). Limits how many enemies attack one target at once.
//   slots.request(attacker, target, cost) -> true when the attacker holds (or now gets) its points on that target
//   slots.release(attacker)               -> its points return after rules.releaseDelay
//   slots.update(dt)                      -> ticks the returning points
// Rules: data/attackSlots.js. Works for any number of targets (party-ready).
export class AttackSlots {
  constructor(rules = ATTACK_SLOTS) {
    this.rules = rules;
    this.holders = new Map();  // attacker -> { target, cost }
    this.cooling = [];         // { target, cost, t } points on their way back
  }
  used(target) {
    let n = 0;
    for (const h of this.holders.values()) if (h.target === target) n += h.cost;
    for (const c of this.cooling) if (c.target === target) n += c.cost;
    return n;
  }
  attackers(target) { return [...this.holders].filter(([, h]) => h.target === target).map(([a]) => a); }
  costOf(attack) { return attack && attack.heavy ? this.rules.cost.heavy : this.rules.cost.normal; }
  request(attacker, target, cost = 1) {
    const h = this.holders.get(attacker);
    if (h && h.target === target) return true;
    if (h) this.release(attacker, true);
    // a single attack that costs more than the whole capacity may still go when nobody else is attacking
    if (this.used(target) + cost > this.rules.capacity && this.used(target) > 0) return false;
    this.holders.set(attacker, { target, cost });
    return true;
  }
  release(attacker, now = false) {
    const h = this.holders.get(attacker);
    if (!h) return;
    this.holders.delete(attacker);
    if (!now && this.rules.releaseDelay > 0) this.cooling.push({ target: h.target, cost: h.cost, t: this.rules.releaseDelay });
  }
  update(dt) {
    for (const c of this.cooling) c.t -= dt;
    if (this.cooling.length) this.cooling = this.cooling.filter((c) => c.t > 0);
  }
  // drop holders that can no longer attack (dead, left behind on another map) — the caller decides what is stale
  prune(stale) { for (const a of [...this.holders.keys()]) if (stale(a)) this.holders.delete(a); }
  clear() { this.holders.clear(); this.cooling.length = 0; }
}
