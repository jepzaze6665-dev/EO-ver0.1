// Item system I2: set bonuses (data/items/sets.js + items/setSystem.js) — counted from worn items, modifiers join the
// item modifier set (same caps), effects run through the item effect system, swap preview + tooltip show them.
// Run:  node tools/tests/itemSets.test.mjs
import { EventBus } from '../../src/core/events.js';
import { Inventory } from '../../src/inventory/inventory.js';
import { Equipment } from '../../src/equipment/equipment.js';
import { ItemEffectSystem } from '../../src/items/effectSystem.js';
import { ITEMS } from '../../src/items/items.js';
import { SETS } from '../../src/data/items/sets.js';
import { setPieces, setCounts, activeSetBonuses, setSummary, setProblems } from '../../src/items/setSystem.js';
import { swapPreview, itemTooltipHTML } from '../../src/ui/itemTooltip.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const eq = (a, b, msg = '') => { if (a !== b) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const near = (a, b, msg = '') => { if (Math.abs(a - b) > 1e-9) throw new Error(`${msg} expected ${b}, got ${a}`); };

function game() {
  const g = { time: 0, events: new EventBus(), audio: { sfx() {} }, vfx: { text() {} } };
  g.combat = { inCombat: true, dealDamage() {} };
  g.marks = { get: () => 0, list: () => [] };
  g.inventory = new Inventory(g); g.equipment = new Equipment(g);
  g.equipment.slots.weapon = 'aegis_shield'; g.equipment.slots.armor = null;
  const p = { team: 'player', hp: 300, maxHp: 300, dead: false, level: 10, x: 0, y: 0, cls: { id: 'aegis_guardian' }, recomputeStats() {}, gearMod: (t) => g.equipment.getModifierValue(t) };
  g.player = p;
  g.fx = new ItemEffectSystem(g);
  const wear = (...ids) => { for (const id of ids) { g.inventory.add(id); ok(g.equipment.equip(id), 'equip ' + id + ' ' + g.equipment.lastError); } };
  return { g, p, wear };
}

console.log('data');
test('every set passes the data check (pieces exist, bonuses valid, items name real sets)', () => {
  eq(setProblems().join(' | '), '');
});
test('the check catches bad sets', () => {
  const items = { a: { id: 'a', setId: 's' }, b: { id: 'b', setId: 'ghost' } };
  const sets = { s: { name: 'S', bonuses: [{ pieces: 3, text: 't', modifiers: [{ type: 'luck', value: 1 }] }, { pieces: 2, text: '' }] } };
  const p = setProblems(items, sets).join(' ');
  for (const w of ['only 1 item', 'needs 3 pieces', 'luck', 'without text', 'does nothing', 'unknown set "ghost"']) ok(p.includes(w), `missing "${w}" in ${p}`);
});
test('Iron Vigil = 3 pieces (Ironheart Core, Fortress Armor, Heavy Charm), bonuses at 2 and 3', () => {
  eq(setPieces('iron_vigil').sort().join(','), 'armor_fortress,charm_heavy,core_ironheart');
  eq(SETS.iron_vigil.bonuses.map((b) => b.pieces).join(','), '2,3');
});

console.log('counting');
test('pieces count once per item id; bonuses switch on at their piece count', () => {
  eq(setCounts(['core_ironheart', 'core_ironheart', null]).iron_vigil, 1);
  eq(activeSetBonuses(['core_ironheart']).length, 0, '1 piece');
  eq(activeSetBonuses(['core_ironheart', 'armor_fortress']).length, 1, '2 pieces');
  eq(activeSetBonuses(['core_ironheart', 'armor_fortress', 'charm_heavy']).length, 2, '3 pieces');
  const s = setSummary(['core_ironheart', 'armor_fortress'])[0];
  eq(s.count, 2); eq(s.total, 3); ok(s.bonuses[0].on && !s.bonuses[1].on, 'summary');
});

console.log('in the loadout');
test('2 pieces = +10% Guard Generation on top of the items; taking one off removes it', () => {
  const { g, wear } = game();
  wear('core_ironheart'); near(g.equipment.getModifierValue('guardGeneration'), 0.25, '1 piece');
  wear('armor_fortress'); near(g.equipment.getModifierValue('guardGeneration'), 0.35, '2 pieces');
  ok(g.equipment.unequip('armor'), 'unequip'); near(g.equipment.getModifierValue('guardGeneration'), 0.25, 'back');
});
test('3 pieces = the set effect fires on a block (cooldown); 2 pieces = it does not', () => {
  const { g, p, wear } = game();
  wear('core_ironheart', 'armor_fortress');
  g.events.emit('guardBlocked', { player: p, blocked: 10 }); near(g.equipment.getModifierValue('damageReduction'), 0, '2 pieces: no effect');
  wear('charm_heavy');
  g.events.emit('guardBlocked', { player: p, blocked: 10 }); near(g.equipment.getModifierValue('damageReduction'), 0.1, '3 pieces');
  const e = g.fx.active().find((x) => x.setId === 'iron_vigil');
  ok(e && e.name.includes('Iron Vigil') && e.running, 'shown as a running set effect');
  g.time = 3.5; g.fx.update(); near(g.equipment.getModifierValue('damageReduction'), 0, 'buff ended after 3 s');
  g.events.emit('guardBlocked', { player: p, blocked: 10 }); near(g.equipment.getModifierValue('damageReduction'), 0, 'cooldown 4 s');
  ok(g.equipment.unequip('charm'), 'take one off'); eq(g.fx.active().filter((x) => x.setId).length, 0, 'set effect gone');
});
test('swap preview: the piece that completes a set shows the set bonus as a gain', () => {
  const { g, wear } = game();
  wear('core_ironheart'); g.inventory.add('armor_fortress');
  const s = swapPreview(g.equipment, 'armor_fortress');
  ok(s.changes.some((c) => c.type === 'guardGeneration' && Math.abs(c.after - 0.35) < 1e-9), 'set modifier in the compare');
  ok(s.gained.some((t) => t.includes('Iron Vigil 2')), 'bonus gained: ' + s.gained.join(' / '));
});
test('tooltip lists the set, worn pieces and bonuses', () => {
  const h = itemTooltipHTML(ITEMS.armor_fortress, { worn: ['core_ironheart', 'armor_fortress'] });
  ok(h.includes('SET: IRON VIGIL 2/3'), 'header'); ok(h.includes('+10% Guard Generation.'), 'bonus text');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
