import { ITEMS } from '../items/items.js';

// Equipment slots. Items change raw stats and can add skill modifiers (build changes),
// e.g. Duskfang -> Twin Fang hits 3x, Eclipse Sigil -> Shadow Break second wave.
export class Equipment {
  constructor(game) {
    this.game = game;
    this.slots = { weapon: 'umbral_sword', armor: 'umbral_cloak', accessory: null };
  }
  equip(id) {
    const def = ITEMS[id];
    if (!def || !def.slot) return false;
    const inv = this.game.inventory;
    if (!inv.has(id)) return false;
    const prev = this.slots[def.slot];
    inv.remove(id, 1);
    if (prev) inv.add(prev, 1, true);
    this.slots[def.slot] = id;
    this.game.player.recomputeStats();
    this.game.audio.sfx('equip');
    this.game.events.emit('equipChanged', { slot: def.slot, id });
    return true;
  }
  unequip(slot) {
    const id = this.slots[slot];
    if (!id || slot === 'weapon') return false;
    this.slots[slot] = null;
    this.game.inventory.add(id, 1, true);
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
    }
  }
  serialize() { return { ...this.slots }; }
  // class starting gear is the default; saved slots override it
  load(d) { if (d) this.slots = { ...this.slots, ...d }; }
}
