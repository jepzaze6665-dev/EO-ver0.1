// ITEM DEBUG (spec §32) — console tools for the item system. Uses the same game APIs as the UI (inventory, equipment,
// loot); it never edits item data. From the browser console (page loaded):
//   __game.items.help()
//   __game.items.list('rune')            every gear item (filter: type / rarity / tag / text)
//   __game.items.give('core_shadow_fang') / remove('core_shadow_fang')
//   __game.items.equip('core_shadow_fang') / equip('rune_full_moon', 'rune2') / unequip('relic')
//   __game.items.inspect('core_shadow_fang')   data + can-equip check + sources + set
//   __game.items.modifiers()             every active modifier, per source (slot / set / buff)
//   __game.items.stats()                 final stats (base -> with items) + active effects
//   __game.items.loadout()               the 7 slots
import { ITEMS } from './items.js';
import { isGear } from './itemDefs.js';
import { SETS } from '../data/items/sets.js';
import { setPieces, setSummary } from './setSystem.js';
import { itemSources } from '../loot/lootSystem.js';
import { GEAR_SLOTS, EQUIP_FAIL } from '../data/items/rules.js';
import { modifierText, classLabel } from '../ui/itemTooltip.js';
import { finalStatRows } from '../ui/loadoutUI.js';

// prints a table in the browser console (not in node tests) and returns the rows
const table = (rows) => { try { if (typeof window !== 'undefined' && rows && rows.length && console.table) console.table(rows); } catch { /* no console */ } return rows; };

export class ItemDebug {
  constructor(game) { this.game = game; }
  help() {
    const lines = ['list(filter?)', 'give(id, n = 1)', 'remove(id)', 'equip(id, slot?)', 'unequip(slot)', 'inspect(id)', 'modifiers()', 'stats()', 'loadout()'];
    return lines.map((l) => '__game.items.' + l).join('\n');
  }
  list(filter = '') {
    const f = String(filter).toLowerCase(), gear = Object.values(ITEMS).filter(isGear);
    // an exact type / rarity / tag wins; otherwise a text search in id / name
    const exact = gear.filter((d) => d.type === f || d.rarity === f || d.tags.includes(f));
    return table((!f ? gear : exact.length ? exact : gear.filter((d) => d.id.includes(f) || d.name.toLowerCase().includes(f)))
      .map((d) => ({ id: d.id, name: d.name, type: d.type, rarity: d.rarity, classes: d.allowedClasses.map(classLabel).join(', '), set: d.setId || '', owned: this.game.inventory.count(d.id) })));
  }
  give(id, n = 1) {
    if (!ITEMS[id]) return `unknown item "${id}"`;
    const added = this.game.inventory.add(id, n, true);
    return `${ITEMS[id].name}: +${added} (now ${this.game.inventory.count(id)})`;
  }
  remove(id) {
    const ok = this.game.inventory.remove(id, 1);
    return ok ? `${ITEMS[id].name} removed (now ${this.game.inventory.count(id)})` : `"${id}" is not in the bag (worn items: unequip first)`;
  }
  equip(id, slot = null) {
    const eq = this.game.equipment;
    if (eq.equip(id, slot)) return `${ITEMS[id].name} -> ${GEAR_SLOTS.find((s) => eq.slots[s.id] === id).id}`;
    return `refused: ${EQUIP_FAIL[eq.lastError] || eq.lastError}`;
  }
  unequip(slot) {
    const eq = this.game.equipment, id = eq.slots[slot];
    if (eq.unequip(slot)) return `${ITEMS[id].name} back in the bag`;
    return `refused: ${EQUIP_FAIL[eq.lastError] || eq.lastError || 'slot empty'}`;
  }
  inspect(id) {
    const d = ITEMS[id];
    if (!d) return `unknown item "${id}"`;
    const eq = this.game.equipment, check = isGear(d) ? eq.check(id) : null;
    return {
      id: d.id, name: d.name, type: d.type, rarity: d.rarity, description: d.description,
      classes: d.allowedClasses.map(classLabel), levelRequirement: d.levelRequirement || 0, tags: d.tags,
      modifiers: d.modifiers.map(modifierText), effects: d.effects.map((e) => `[${e.trigger}] ${e.text}`),
      skillModifiers: d.skillModifiers || [], oldStats: d.stats || {},
      set: d.setId ? { name: SETS[d.setId].name, pieces: setPieces(d.setId), bonuses: SETS[d.setId].bonuses.map((b) => `(${b.pieces}) ${b.text}`) } : null,
      sources: d.dropSource ? [`boss ${d.dropSource} (signature, 100% first kill)`] : itemSources(id).map((x) => `${x.table} ${Math.round(x.chance * 1000) / 10}%`),
      owned: this.game.inventory.count(id), worn: eq.wornIds().includes(id),
      canEquip: check ? (check.ok ? `yes (${check.slot})` : `no: ${EQUIP_FAIL[check.reason] || check.reason}`) : 'not gear',
    };
  }
  modifiers() {
    const eq = this.game.equipment;
    eq.itemModifiers();
    return table(eq.modifiers.active().map((m) => {
      const slot = GEAR_SLOTS.find((s) => s.id === m.source);
      const from = slot ? `${slot.label}: ${ITEMS[eq.slots[slot.id]].name}` : String(m.source).startsWith('set:') ? `set ${m.source.split(':')[1]}` : `buff ${m.source}`;
      return { from, modifier: modifierText(m) };
    }));
  }
  stats() {
    const p = this.game.player;
    return {
      stats: table(finalStatRows(p).map(([stat, now, base]) => ({ stat, now, base }))),
      sets: setSummary(this.game.equipment.wornIds()).map((s) => `${s.name} ${s.count}/${s.total}`),
      effects: this.game.itemEffects ? this.game.itemEffects.active().map((x) => `${x.name} [${x.trigger}] ${x.running ? 'ACTIVE' : x.cooldownLeft > 0 ? x.cooldownLeft.toFixed(1) + ' s' : 'ready'}`) : [],
    };
  }
  loadout() {
    const eq = this.game.equipment;
    return table(GEAR_SLOTS.map((s) => ({ slot: s.label, id: eq.slots[s.id] || '', name: eq.slots[s.id] ? ITEMS[eq.slots[s.id]].name : '— empty —', instance: (eq.inst[s.id] || {}).instanceId || '' })));
  }
}
