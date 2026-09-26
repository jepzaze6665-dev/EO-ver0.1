// Generic timed status effects shared by player, monsters and the boss.
// stun: cannot act | slow: move mult | vulnerable: weak window (bonus damage taken)
// haste: move mult | surge: damage mult | armorBroken: crystal armor shattered
export class StatusSet {
  constructor() {
    this.map = new Map();
  }
  add(name, duration, data = {}) {
    const cur = this.map.get(name);
    if (cur && cur.t > duration && !data.refresh) return cur;
    const s = { t: duration, total: duration, ...data };
    this.map.set(name, s);
    return s;
  }
  has(name) { return this.map.has(name); }
  get(name) { return this.map.get(name); }
  remove(name) { this.map.delete(name); }
  clear() { this.map.clear(); }
  update(dt) {
    for (const [k, s] of this.map) {
      s.t -= dt;
      if (s.t <= 0) this.map.delete(k);
    }
  }
  moveMult() {
    let m = 1;
    if (this.map.has('slow')) m *= this.map.get('slow').mult ?? 0.6;
    if (this.map.has('haste')) m *= this.map.get('haste').mult ?? 1.25;
    return m;
  }
  damageMult() {
    return this.map.has('surge') ? this.map.get('surge').mult ?? 1.15 : 1;
  }
}
