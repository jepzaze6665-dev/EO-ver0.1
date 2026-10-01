import { ITEMS } from '../items/items.js';

// Equipment slots. Items change raw stats and can add skill modifiers (build changes),
// e.g. Duskfang -> Twin Fang hits 3x, Eclipse Sigil -> Shadow Break second wave.
// `slots` = item id per slot (what the game reads); `inst` = the INSTANCE worn in that slot (items/itemInstance.js),
// moved to / from the inventory on equip / unequip so an item keeps its instanceId. Code that sets `slots` directly
// (class start gear, class change) gets a fresh instance the next time one is needed (instanceFor).
export class Equipment {
  constructor(game) {
    this.game = game;
    this.slots = { weapon: 'umbral_sword', armor: 'umbral_cloak', accessory: null };
    this.inst = {}; // slot -> { instanceId, itemId }
  }
  // the instance worn in a slot (made when the slot was filled without one, or holds a different item)
  instanceFor(slot) {
    const id = this.slots[slot];
    if (!id) { delete this.inst[slot]; return null; }
    const cur = this.inst[slot];
    if (!cur || cur.itemId !== id) this.inst[slot] = this.game.inventory.newInstance(id);
    return this.inst[slot];
  }
  equip(id) {
    const def = ITEMS[id];
    if (!def || !def.slot) return false;
    const inv = this.game.inventory;
    const inst = inv.findItem(id);
    if (!inst) return false;
    const prev = this.slots[def.slot] ? this.instanceFor(def.slot) : null;
    inv.removeItem(inst.instanceId);
    if (prev && !inv.addItem(prev)) { inv.addItem(inst); return false; } // bag full: nothing changes
    this.slots[def.slot] = id;
    this.inst[def.slot] = inst;
    this.game.player.recomputeStats();
    this.game.audio.sfx('equip');
    this.game.events.emit('equipChanged', { slot: def.slot, id, instanceId: inst.instanceId });
    return true;
  }
  unequip(slot) {
    const id = this.slots[slot];
    if (!id || slot === 'weapon') return false;
    if (!this.game.inventory.addItem(this.instanceFor(slot))) return false; // bag full
    this.slots[slot] = null;
    delete this.inst[slot];
    this.game.player.recomputeStats();
    return true;
  }
  applyTo(stats, mods) {
    for (const id of Object.values(this.slots)) {
      if (!id) continue;
      const def = ITEMS[id];
      for (const [k, v] of Object.entries(def.stats || {})) {
        if (k === 'armorBreak') stats.armorBreak = (stats.armorBreak || 1) * v;
        else stats[k] = (stats[k] || 0) + v;
      }
      Object.assign(mods, def.mods || {});
      // skill modifiers from gear (progression/skillModifiers.js) — a list, never overwritten by another item
      if (def.skillModifiers) mods.skillModifiers = [...(mods.skillModifiers || []), ...def.skillModifiers];
    }
  }
  // save v5: { weapon, armor, accessory, inst: { slot: instance } }
  serialize() {
    const inst = {};
    for (const slot of Object.keys(this.slots)) { const x = this.instanceFor(slot); if (x) inst[slot] = { ...x }; }
    return { ...this.slots, inst };
  }
  // class starting gear is the default; saved slots override it. Unknown ids / instance mismatches are repaired.
  load(d) {
    if (!d) return;
    for (const slot of Object.keys(this.slots)) {
      if (!(slot in d)) continue;
      const id = d[slot];
      this.slots[slot] = id && ITEMS[id] && ITEMS[id].slot === slot ? id : (slot === 'weapon' ? this.slots.weapon : null);
    }
    this.inst = {};
    const inv = this.game.inventory, saved = d.inst || {};
    for (const slot of Object.keys(this.slots)) {
      const x = saved[slot];
      // a saved instance keeps its id unless the bag already holds that id (then instanceFor makes a new one)
      if (x && x.itemId === this.slots[slot] && typeof x.instanceId === 'string' && !inv.hasItem(x.instanceId)
        && !Object.values(this.inst).some((y) => y.instanceId === x.instanceId)) {
        inv.ids.seen(x.instanceId);
        this.inst[slot] = { instanceId: x.instanceId, itemId: x.itemId };
      }
    }
  }
}
