import { ITEMS } from '../items/items.js';
import { isGear, canClassUse } from '../items/itemDefs.js';
import { ModifierSet } from '../items/modifierSystem.js';
import { GEAR_SLOTS, LOADOUT_RULES, EQUIP_FAIL } from '../data/items/rules.js';

const SLOT = Object.fromEntries(GEAR_SLOTS.map((s) => [s.id, s]));

// GEAR LOADOUT (7 slots: data/items/rules.js GEAR_SLOTS) — weapon core, armor core, relic, charm, rune 1-3.
// `slots` = item id per slot (what the game reads); `inst` = the INSTANCE worn there (items/itemInstance.js), moved to /
// from the inventory on equip / unequip so an item keeps its instanceId. Code that sets `slots` directly (class start
// gear, class change) gets a fresh instance the next time one is needed (instanceFor).
// Items never change the sprite: they change stats (older gear: flat `stats` / `mods` / `skillModifiers`; new gear:
// `modifiers` through one ModifierSet) — Player.recomputeStats asks applyTo for both.
export class Equipment {
  constructor(game) {
    this.game = game;
    this.slots = Object.fromEntries(GEAR_SLOTS.map((s) => [s.id, null]));
    this.slots.weapon = 'umbral_sword'; this.slots.armor = 'umbral_cloak';
    this.inst = {}; // slot -> { instanceId, itemId }
    this.modifiers = new ModifierSet();
    this.modKey = null; // which slot contents the modifier set was built from
    this.lastError = null; // EQUIP_FAIL key of the last refused equip / unequip
    this.temp = new Map(); // TEMPORARY item-effect buffs: source -> { type, value } (items/effectSystem.js modifyStat)
    this.tempVersion = 0;
  }
  // a temporary modifier (an item effect's buff) joins the same set as the worn items, so the caps cover both
  addTemp(source, mod) { this.temp.set(source, { type: mod.type, value: mod.value }); this.tempVersion++; this.changed(); }
  removeTemp(source) { if (this.temp.delete(source)) { this.tempVersion++; this.changed(); return true; } return false; }
  clearTemp() { if (this.temp.size) { this.temp.clear(); this.tempVersion++; this.changed(); } }
  // the instance worn in a slot (made when the slot was filled without one, or holds a different item)
  instanceFor(slot) {
    const id = this.slots[slot];
    if (!id) { delete this.inst[slot]; return null; }
    const cur = this.inst[slot];
    if (!cur || cur.itemId !== id) this.inst[slot] = this.game.inventory.newInstance(id);
    return this.inst[slot];
  }
  // the prompt-style view: { weaponCore, armorCore, relic, charm, runes: [a, b, c] } (item ids)
  view() {
    const s = this.slots;
    return { weaponCore: s.weapon, armorCore: s.armor, relic: s.relic, charm: s.charm, runes: [s.rune1, s.rune2, s.rune3] };
  }
  // which slot an item would go to (slot given = must fit; else an empty slot of its type, else the first of its type)
  slotFor(def, slot = null) {
    if (slot) return SLOT[slot] && SLOT[slot].type === def.type ? slot : null;
    const fits = GEAR_SLOTS.filter((s) => s.type === def.type);
    return (fits.find((s) => !this.slots[s.id]) || fits[0] || {}).id || null;
  }
  // can this item go on? -> { ok, slot, reason } (reason = EQUIP_FAIL key). Pure check, nothing changes.
  check(id, slot = null) {
    const def = ITEMS[id];
    if (!def) return { ok: false, reason: 'unknown' };
    if (!isGear(def)) return { ok: false, reason: 'notGear' };
    const to = this.slotFor(def, slot);
    if (!to) return { ok: false, reason: 'wrongSlot' };
    if (!this.game.inventory.findItem(id)) return { ok: false, reason: 'notOwned' };
    const p = this.game.player;
    if (p && p.cls && !canClassUse(def, p.cls.id)) return { ok: false, reason: 'class' };
    if (!LOADOUT_RULES.duplicates && GEAR_SLOTS.some((s) => s.id !== to && this.slots[s.id] === id)) return { ok: false, reason: 'duplicate' };
    return { ok: true, slot: to };
  }
  equip(id, slot = null) {
    const c = this.check(id, slot);
    this.lastError = c.ok ? null : c.reason;
    if (!c.ok) return false;
    const inv = this.game.inventory, inst = inv.findItem(id);
    const prev = this.slots[c.slot] ? this.instanceFor(c.slot) : null;
    inv.removeItem(inst.instanceId);
    if (prev && !inv.addItem(prev)) { inv.addItem(inst); this.lastError = 'bagFull'; return false; } // nothing changes
    this.slots[c.slot] = id;
    this.inst[c.slot] = inst;
    this.changed();
    this.game.audio.sfx('equip');
    this.game.events.emit('equipChanged', { slot: c.slot, id, instanceId: inst.instanceId, removed: prev && prev.itemId });
    return true;
  }
  unequip(slot) {
    const id = this.slots[slot];
    if (!id) return false;
    if (SLOT[slot] && SLOT[slot].fixed) { this.lastError = 'fixed'; return false; }
    if (!this.game.inventory.addItem(this.instanceFor(slot))) { this.lastError = 'bagFull'; return false; }
    this.slots[slot] = null;
    delete this.inst[slot];
    this.changed();
    this.game.events.emit('equipChanged', { slot, id: null, removed: id });
    return true;
  }
  lastErrorText() { return EQUIP_FAIL[this.lastError] || ''; }
  // takes off everything the class may not use (after a class change). Fixed slots keep their item.
  enforceClass(classId) {
    let n = 0;
    for (const s of GEAR_SLOTS) {
      const id = this.slots[s.id];
      if (!id || s.fixed || canClassUse(ITEMS[id], classId)) continue;
      if (this.game.inventory.addItem(this.instanceFor(s.id))) { this.slots[s.id] = null; delete this.inst[s.id]; n++; }
    }
    if (n) this.changed();
    return n;
  }
  changed() {
    this.modKey = null;
    if (this.game.player) this.game.player.recomputeStats();
  }
  // the ModifierSet of the worn items, rebuilt only when the slot contents changed (also after direct `slots` writes)
  itemModifiers() {
    const key = GEAR_SLOTS.map((s) => this.slots[s.id] || '').join('|') + '#' + this.tempVersion;
    if (key !== this.modKey) {
      this.modifiers.clear();
      for (const s of GEAR_SLOTS) {
        const def = ITEMS[this.slots[s.id]];
        if (def) for (const m of def.modifiers) this.modifiers.addModifier(s.id, m);
      }
      for (const [source, m] of this.temp) this.modifiers.addModifier(source, m);
      this.modKey = key;
    }
    return this.modifiers;
  }
  // older gear: flat stats + behaviour flags (mods) + skill modifiers. New gear modifiers: finalStats (below).
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
  // base stats -> final stats with the item modifiers (a new object; base untouched)
  finalStats(base) { return this.itemModifiers().calculateStats(base); }
  getModifierValue(type) { return this.itemModifiers().getModifierValue(type); }

  // save v5: { weapon, armor, relic, charm, rune1, rune2, rune3, inst: { slot: instance } }
  serialize() {
    const inst = {};
    for (const slot of Object.keys(this.slots)) { const x = this.instanceFor(slot); if (x) inst[slot] = { ...x }; }
    return { ...this.slots, inst };
  }
  // class starting gear is the default; saved slots override it. Unknown ids / wrong types are dropped.
  // Older saves: the one ACCESSORY slot moves to the slot of its type (relic / charm / rune1).
  load(d) {
    if (!d) return;
    d = { ...d, inst: { ...(d.inst || {}) } };
    if (d.accessory && ITEMS[d.accessory]) {
      const to = this.slotFor(ITEMS[d.accessory]);
      if (to && !d[to]) { d[to] = d.accessory; if (d.inst.accessory) d.inst[to] = d.inst.accessory; }
    }
    for (const s of GEAR_SLOTS) {
      if (!(s.id in d)) continue;
      const def = ITEMS[d[s.id]];
      this.slots[s.id] = def && def.type === s.type ? d[s.id] : (s.fixed ? this.slots[s.id] : null);
    }
    if (!LOADOUT_RULES.duplicates) { // an edited save with one item in two slots keeps the first
      const seen = new Set();
      for (const s of GEAR_SLOTS) { const id = this.slots[s.id]; if (id && seen.has(id) && !s.fixed) this.slots[s.id] = null; else if (id) seen.add(id); }
    }
    this.inst = {};
    const inv = this.game.inventory;
    for (const slot of Object.keys(this.slots)) {
      const x = d.inst[slot];
      // a saved instance keeps its id unless the bag / another slot already uses it (then instanceFor makes a new one)
      if (x && x.itemId === this.slots[slot] && typeof x.instanceId === 'string' && !inv.hasItem(x.instanceId)
        && !Object.values(this.inst).some((y) => y.instanceId === x.instanceId)) {
        inv.ids.seen(x.instanceId);
        this.inst[slot] = { instanceId: x.instanceId, itemId: x.itemId };
      }
    }
    this.modKey = null;
  }
}
