// RESOURCE SYSTEM — generic, data-driven resource pool (one per character).
// Knows nothing about classes: it only reads rule data (data/resources.js).
// Guarantees: values stay within [0, max], invalid numbers are ignored, spending fails
// cleanly when unaffordable, and regen/decay are frame-rate independent.
//
//   const pool = new ResourcePool(['shadow_gauge'], defs, { stats: () => player.stats, onChange })
//   pool.gain('shadow_gauge', 4)          // multiplied by stats[def.gainStat]
//   pool.gain('shadow_gauge', 20, { raw: true })
//   pool.spend('shadow_gauge', 12)        // -> true / false
//   pool.update(dt, { inCombat })
export class ResourcePool {
  constructor(ids, defs, opts = {}) {
    this.defs = {};
    this.values = {};
    this.sinceGain = {};
    this.modifiers = []; // { id, resource, kind: 'maxAdd' | 'gainMult' | 'costMult', value }
    this.stats = opts.stats || (() => ({}));
    this.onChange = opts.onChange || null;
    for (const id of ids) {
      const d = defs[id];
      if (!d) throw new Error(`Unknown resource "${id}"`);
      this.defs[id] = d;
      this.values[id] = d.start;
      this.sinceGain[id] = 99;
    }
  }

  has(id) { return id in this.defs; }
  get(id) { return this.values[id] ?? 0; }
  max(id) {
    const d = this.defs[id];
    if (!d) return 0;
    let m = d.max;
    for (const mod of this.modifiers) if (mod.resource === id && mod.kind === 'maxAdd') m += mod.value;
    return Math.max(1, m);
  }
  ratio(id) { return this.get(id) / this.max(id); }
  mult(id, kind) {
    let m = 1;
    for (const mod of this.modifiers) if (mod.resource === id && mod.kind === kind) m *= mod.value;
    return m;
  }
  cost(id, amount) { return Math.max(0, amount * this.mult(id, 'costMult')); }
  canAfford(id, amount) { return this.has(id) && this.get(id) >= this.cost(id, amount); }

  set(id, value, reason = 'set') {
    if (!this.has(id) || !Number.isFinite(value)) return;
    const before = this.values[id];
    this.values[id] = Math.min(this.max(id), Math.max(0, value));
    if (this.onChange && Math.floor(before) !== Math.floor(this.values[id])) this.onChange({ resource: id, before, value: this.values[id], reason });
  }
  gain(id, amount, { raw = false, reason = 'gain' } = {}) {
    if (!this.has(id) || !Number.isFinite(amount) || amount <= 0) return 0;
    const d = this.defs[id];
    let amt = amount;
    if (!raw) amt *= (d.gainStat && this.stats()[d.gainStat]) || 1;
    amt *= this.mult(id, 'gainMult');
    const before = this.values[id];
    this.set(id, before + amt, reason);
    this.sinceGain[id] = 0;
    return this.values[id] - before;
  }
  spend(id, amount, reason = 'spend') {
    if (!Number.isFinite(amount) || amount < 0) return false;
    const c = this.cost(id, amount);
    if (!this.canAfford(id, amount)) return false;
    this.set(id, this.values[id] - c, reason);
    return true;
  }
  fill(id) { this.set(id, this.max(id), 'fill'); }

  addModifier(mod) { this.removeModifier(mod.id); this.modifiers.push(mod); this.clampAll(); }
  removeModifier(modId) { this.modifiers = this.modifiers.filter((m) => m.id !== modId); this.clampAll(); }
  clampAll() { for (const id in this.values) this.values[id] = Math.min(this.max(id), this.values[id]); }

  update(dt, { inCombat = false } = {}) {
    if (!(dt > 0)) return;
    for (const id in this.defs) {
      const d = this.defs[id];
      this.sinceGain[id] += dt;
      const regen = d.regen ? (inCombat ? d.regen.inCombat : d.regen.outOfCombat) || 0 : 0;
      const decay = d.decay && this.sinceGain[id] >= (d.decay.delay || 0) ? (inCombat ? d.decay.inCombat : d.decay.outOfCombat) || 0 : 0;
      const delta = (regen - decay) * dt;
      if (delta) this.values[id] = Math.min(this.max(id), Math.max(0, this.values[id] + delta)); // silent: no event spam per frame
    }
  }

  // plain data for saving / a future server snapshot
  serialize() { return { ...this.values }; }
  load(data) { for (const id in data || {}) if (this.has(id)) this.set(id, data[id], 'load'); }
}
