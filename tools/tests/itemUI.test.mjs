// Item System G5: tooltip text, "if equipped" preview, final-stat rows, build tags (the UI builders, no DOM).
// Run:  node tools/tests/itemUI.test.mjs
import { EventBus } from '../../src/core/events.js';
import { Inventory } from '../../src/inventory/inventory.js';
import { Equipment } from '../../src/equipment/equipment.js';
import { ITEMS } from '../../src/items/items.js';
import { itemTooltipHTML, swapPreview, modifierText } from '../../src/ui/itemTooltip.js';
import { finalStatRows, buildTags } from '../../src/ui/loadoutUI.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const eq = (a, b, msg = '') => { if (a !== b) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const game = () => {
  const g = { events: new EventBus(), audio: { sfx() {} }, player: { cls: { id: 'aegis_guardian' }, recomputeStats() {} } };
  g.inventory = new Inventory(g); g.equipment = new Equipment(g);
  return g;
};

console.log('tooltip');
test('shows name, rarity, type, description, modifiers, unique effect, tags, source (spec §26)', () => {
  const h = itemTooltipHTML(ITEMS.relic_oath_mirror, { classId: 'aegis_guardian' });
  for (const w of ['OATH MIRROR', 'LEGENDARY', 'RELIC', 'Perfect Guard reflects', '+15% Counter Damage', 'UNIQUE EFFECT', 'On Perfect Guard', 'GUARD', 'COUNTER', 'BOSS A1'])
    ok(h.includes(w), `missing "${w}"`);
});
test('every item has a tooltip; text is escaped', () => {
  for (const d of Object.values(ITEMS)) ok(itemTooltipHTML(d).includes(d.name.toUpperCase().replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))), d.id);
  ok(!itemTooltipHTML({ ...ITEMS.charm_heavy, description: '<script>' }).includes('<script>'), 'escaped');
});
test('good / bad colouring: a minus on resourceCost is good, a minus on speed is bad', () => {
  ok(itemTooltipHTML({ ...ITEMS.charm_heavy, modifiers: [{ type: 'resourceCost', value: -0.1 }] }).includes('good'), 'cost');
  ok(itemTooltipHTML(ITEMS.charm_heavy).includes('tt-mod bad'), 'speed');
  eq(modifierText({ type: 'movementSpeed', value: -0.05 }), '-5% Movement Speed');
});
test('class-only items say which classes; legacy gear shows its modText', () => {
  ok(itemTooltipHTML({ ...ITEMS.relic_dawn_core, allowedClasses: ['umbral_sword'] }, { classId: 'aegis_guardian' }).includes('Only: Umbral Sword'), 'only');
  ok(itemTooltipHTML(ITEMS.eclipse_sigil).includes('Shadow Break'), 'modText');
});

console.log('preview');
test('if equipped: the slot, what it replaces, each modifier before -> after', () => {
  const g = game(); g.inventory.add('armor_guardian'); g.inventory.add('armor_risk'); g.equipment.equip('armor_guardian');
  const sw = swapPreview(g.equipment, 'armor_risk');
  eq(sw.slot, 'armor'); eq(sw.replaces, 'armor_guardian');
  const c = Object.fromEntries(sw.changes.map((x) => [x.type, x]));
  eq(c.barrierStrength.after, 0); eq(+c.barrierStrength.before.toFixed(2), 0.25); eq(+c.defense.after.toFixed(2), -0.2);
  ok(itemTooltipHTML(ITEMS.armor_risk, { swap: sw }).includes('Replaces Guardian Armor'), 'html');
  eq(swapPreview(g.equipment, 'hp_potion'), null);
});
test('the preview never changes the real loadout', () => {
  const g = game(); g.inventory.add('core_counter'); const before = JSON.stringify(g.equipment.slots);
  swapPreview(g.equipment, 'core_counter'); eq(JSON.stringify(g.equipment.slots), before); eq(g.equipment.getModifierValue('counterDamage'), 0);
});

console.log('loadout window');
test('final stats rows: all spec §27 stats, base shown next to final', () => {
  const p = { maxHp: 356, stats: { hp: 356, def: 15, atk: 20, speed: 131, cdr: 0, barrierPower: 0.25 }, baseStats: { hp: 330, def: 13, atk: 20, speed: 138, cdr: 0, barrierPower: 0 },
    gearMod: (t) => ({ guardGeneration: 0.4, counterDamage: 0.15, aggro: 0.5 }[t] || 0) };
  const rows = Object.fromEntries(finalStatRows(p).map(([l, v, b]) => [l, [v, b]]));
  for (const l of ['HP', 'Defense', 'Attack', 'Movement Speed', 'Cooldown Reduction', 'Resource Generation', 'Barrier Strength', 'Counter Damage', 'Aggro', 'Guard Generation']) ok(rows[l], l);
  eq(rows.HP.join(), '356,330'); eq(rows.Defense.join(), '15,13'); eq(rows['Guard Generation'][0], '+40%'); eq(rows['Barrier Strength'][0], '+25%');
  eq(rows.Aggro[0], '+50%'); eq(rows['Magic Damage'][0], rows['Magic Damage'][1], 'zero rows match their base text');
});
test('build tags count the worn items', () => {
  const g = game(); for (const id of ['core_ironheart', 'armor_guardian', 'rune_guarding_soul']) { g.inventory.add(id); g.equipment.equip(id); }
  const t = Object.fromEntries(buildTags(g.equipment));
  eq(t.guard, 3); eq(t.barrier, 1); ok(!t.counter, 'no counter');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
