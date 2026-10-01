// Item system I4: boss signature items (every map boss + the secret dragon has one), the dragon KEY item, item debug API.
// Run:  node tools/tests/itemI4.test.mjs
import { EventBus } from '../../src/core/events.js';
import { Inventory } from '../../src/inventory/inventory.js';
import { Equipment } from '../../src/equipment/equipment.js';
import { ItemEffectSystem } from '../../src/items/effectSystem.js';
import { ItemDebug } from '../../src/items/itemDebug.js';
import { ITEMS, RARITY_COLOR } from '../../src/items/items.js';
import { itemProblems } from '../../src/items/itemDefs.js';
import { BOSS_ITEMS } from '../../src/data/items/bossItems.js';
import { BOSSES } from '../../src/data/bosses.js';
import { getLootTable, calculateDropChance } from '../../src/loot/lootSystem.js';
import { CLASSES } from '../../src/skills/classes.js';
import { itemTooltipHTML } from '../../src/ui/itemTooltip.js';
import { MAPS } from '../../src/maps/mapRegistry.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const eq = (a, b, msg = '') => { if (a !== b) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };

console.log('boss items');
test('4 new signature items pass the data check, each with a tradeoff', () => {
  eq(Object.keys(BOSS_ITEMS).length, 4);
  for (const [id, d] of Object.entries(BOSS_ITEMS)) {
    eq(itemProblems(ITEMS[id], Object.keys(CLASSES)).join(' '), '', id);
    ok(d.signature && d.dropSource, id + ' signature');
    ok(d.modifiers.some((m) => m.value < 0), id + ' tradeoff');
  }
});
test('every map boss (area / major / secret) now has exactly one signature item, dropped at 100%', () => {
  const sig = {};
  for (const d of Object.values(ITEMS)) if (d.signature) sig[d.dropSource] = (sig[d.dropSource] || 0) + 1;
  for (const [id, b] of Object.entries(BOSSES)) {
    if (b.type === 'mini' || b.status === 'planned' || !b.rewards || !b.rewards.loot) continue;
    eq(sig[id], 1, id);
    const item = Object.values(ITEMS).find((d) => d.signature && d.dropSource === id);
    eq(calculateDropChance(b.rewards.loot, item.id), 1, id + ' drop');
  }
});
test("Cinder King's Crown = MYTHIC (red), LV 45, from Varkharon", () => {
  const c = ITEMS.relic_cinder_crown;
  eq(c.rarity, 'mythic'); eq(c.levelRequirement, 45); eq(c.dropSource, 'boss_varkharon');
  ok(getLootTable('varkharon').drops.some((x) => x.item === 'relic_cinder_crown' && x.chance === 1), 'table');
});

console.log('dragon key');
test("Varkharon's Seal = red MYTHIC KEY item: no stats, no sale, not gear", () => {
  const s = ITEMS.varkharon_seal;
  eq(s.rarity, 'mythic'); ok(s.key, 'key flag'); eq(s.cat, 'Quest Item'); ok(!s.sell && !s.price, 'cannot be sold / bought');
  ok(!s.modifiers.length && !s.effects.length, 'no stats'); eq(s.type, 'quest_item');
  ok(/^#ff[0-4]/i.test(RARITY_COLOR.mythic), 'mythic is red: ' + RARITY_COLOR.mythic);
  ok(itemTooltipHTML(s).includes('KEY ITEM'), 'tooltip label');
});
test('the Dragon Door keeps the seal (consume: false) — it is the key to the Cinder Throne', () => {
  const door = MAPS.find((m) => m.id === 'a2').content.interactables.find((x) => x.kind === 'sealDoor');
  eq(door.item, 'varkharon_seal'); eq(door.consume, false);
});

console.log('debug API');
test('__game.items: give / equip / inspect / modifiers / loadout / unequip / remove', () => {
  const g = { time: 0, events: new EventBus(), audio: { sfx() {} }, vfx: { text() {} } };
  g.combat = { inCombat: false, dealDamage() {} };
  g.inventory = new Inventory(g); g.equipment = new Equipment(g);
  g.player = { level: 30, cls: { id: 'umbral_sword' }, maxHp: 300, hp: 300, stats: { hp: 300, def: 10, atk: 20 }, recomputeStats() {}, gearMod: (t) => g.equipment.getModifierValue(t) };
  g.itemEffects = new ItemEffectSystem(g);
  const d = new ItemDebug(g);
  ok(d.help().includes('__game.items.inspect'), 'help');
  ok(d.list('rune').every((x) => x.type === 'rune'), 'list filter');
  ok(d.give('rune_full_moon').includes('+1'), 'give');
  ok(d.equip('rune_full_moon').includes('rune1'), 'equip');
  ok(d.equip('core_star_loom').startsWith('refused'), 'refused text');
  const ins = d.inspect('rune_full_moon');
  eq(ins.worn, true); ok(ins.effects[0].includes('onMarksFull'), 'effects');
  eq(d.inspect('relic_cinder_crown').canEquip, 'no: You do not have this item');
  eq(d.loadout().find((r) => r.slot === 'Rune 1').id, 'rune_full_moon');
  ok(d.unequip('rune1').includes('back in the bag'), 'unequip'); ok(d.remove('rune_full_moon').includes('removed'), 'remove');
  ok(d.inspect('nope').startsWith('unknown'), 'unknown');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
