// ITEM MODIFIER SYSTEM (pure) — collects the modifiers of everything equipped and builds the final stats.
//
//   base stats (class + level + older gear flat stats)  ->  calculateStats(base)  ->  final stats
//
// The base object is never edited: calculateStats returns a new object. Totals are cached and only rebuilt after a
// modifier was added / removed (dirty flag) — nothing here runs every frame. Rules (stat, apply, stacking, caps) are
// data: data/items/rules.js MODIFIER_TYPES. Temporary buffs (statuses) stay in the status system, applied after this.
import { MODIFIER_TYPES } from '../data/items/rules.js';

export class ModifierSet {
  constructor(rules = MODIFIER_TYPES) {
    this.rules = rules;
    this.list = []; // [{ source, type, value }]
    this.cache = null; // { type: capped total }
  }
  // source = who owns it (an instanceId, a slot, a buff id) so it can be removed again. Unknown / bad values refused.
  addModifier(source, mod) {
    if (!mod || !this.rules[mod.type] || !Number.isFinite(mod.value)) return false;
    this.list.push({ source, type: mod.type, value: mod.value });
    this.cache = null;
    return true;
  }
  // removes every modifier of a source (or only one type of it); returns how many were removed
  removeModifier(source, type = null) {
    const before = this.list.length;
    this.list = this.list.filter((m) => !(m.source === source && (!type || m.type === type)));
    if (this.list.length !== before) this.cache = null;
    return before - this.list.length;
  }
  clear() { if (this.list.length) { this.list = []; this.cache = null; } }
  recalculate() {
    const sums = {};
    for (const m of this.list) {
      const r = this.rules[m.type];
      if (r.stacking === 'multiplicative') sums[m.type] = (1 + (sums[m.type] ?? 0)) * (1 + m.value) - 1;
      else sums[m.type] = (sums[m.type] ?? 0) + m.value;
    }
    for (const [t, v] of Object.entries(sums)) sums[t] = clamp(v, this.rules[t].min, this.rules[t].max);
    this.cache = sums;
    return sums;
  }
  totals() { return this.cache || this.recalculate(); }
  // the capped total of one modifier type (0 = none). Systems read the non-stat types through this (counterDamage, ...)
  getModifierValue(type) { return this.totals()[type] || 0; }
  // final stats = a copy of base with every stat-bound modifier applied
  calculateStats(base) {
    const out = { ...base };
    for (const [type, total] of Object.entries(this.totals())) {
      const r = this.rules[type];
      if (!r.stat || !total) continue;
      const v = out[r.stat] || 0;
      out[r.stat] = r.apply === 'mult' ? v * (1 + total) : v + total;
    }
    return out;
  }
  // debug / UI: what is active, per source and per type
  active() { return this.list.map((m) => ({ ...m })); }
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
