// SKILL LOADOUT — which skills sit on keys 1-4 (key 5 is always the class ultimate).
// A class may know more skills than it has slots (Umbral Sword: 6 actives, 4 slots); the player picks.
// Pure data: no DOM, no game references — saved with the character and unit-tested.
//
//   class data: skills (all skills, incl. the ultimate), defaultLoadout?: [id, id, id, id]
export const ACTIVE_SLOTS = 4;

export class Loadout {
  constructor(cls, ids) {
    this.cls = cls;
    this.slots = [];
    this.load(ids);
  }
  pool() { return this.cls.skills.filter((s) => s.type !== 'ultimate'); }
  ultimate() { return this.cls.skills.find((s) => s.type === 'ultimate') || null; }
  has(id) { return this.pool().some((s) => s.id === id); }
  defaults() { return this.cls.defaultLoadout || this.pool().slice(0, ACTIVE_SLOTS).map((s) => s.id); }

  // restore from a save: keeps valid, unique ids; empty / invalid slots fall back to unused defaults
  load(ids) {
    const want = Array.isArray(ids) ? ids : this.defaults();
    const used = new Set();
    this.slots = [];
    for (let i = 0; i < ACTIVE_SLOTS; i++) {
      const id = want[i];
      if (this.has(id) && !used.has(id)) { this.slots.push(id); used.add(id); } else this.slots.push(null);
    }
    const spare = [...this.defaults(), ...this.pool().map((s) => s.id)].filter((id) => !used.has(id));
    for (let i = 0; i < ACTIVE_SLOTS; i++) if (!this.slots[i] && spare.length) { const id = spare.shift(); this.slots[i] = id; used.add(id); }
    return this;
  }

  // put a skill on slot i (0-based). If it is already on another slot the two swap.
  assign(i, id) {
    if (!(i >= 0 && i < ACTIVE_SLOTS) || !this.has(id)) return false;
    const j = this.slots.indexOf(id);
    if (j === i) return true;
    if (j >= 0) this.slots[j] = this.slots[i];
    this.slots[i] = id;
    return true;
  }

  // key bindings for input + HUD: 1..4 = chosen skills, 5 = ultimate
  bindings() {
    const byId = Object.fromEntries(this.cls.skills.map((s) => [s.id, s]));
    const out = this.slots.map((id, i) => ({ key: String(i + 1), skill: byId[id] || null }));
    const ult = this.ultimate();
    if (ult) out.push({ key: String(ACTIVE_SLOTS + 1), skill: ult });
    return out.filter((b) => b.skill);
  }
  serialize() { return [...this.slots]; }
}
