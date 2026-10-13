// GEAR ENHANCEMENT + RANDOM CHESTS (owner 2026-10-13). Run:  node tools/tests/enhance.test.mjs
import { ENHANCE } from '../../src/data/enhance.js';
import { enhanceCost, enhancedModifiers, rollEnhance, plusOf } from '../../src/items/enhance.js';
import { sanitizeInstance, InstanceIds } from '../../src/items/itemInstance.js';
import { chestLoot, chestTable, seededRng, rollLoot } from '../../src/loot/lootSystem.js';
import { ITEMS } from '../../src/items/items.js';
import { GEAR_ITEMS } from '../../src/data/items/index.js';
import { LOOT_TABLES } from '../../src/data/lootTables.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };

test('cost: gold grows each step, materials are real items, +10 has no cost', () => {
  const d = GEAR_ITEMS.relic_oath_mirror;
  let last = 0;
  for (let p = 0; p < ENHANCE.max; p++) { const c = enhanceCost(d, p); ok(c.gold > last, 'gold up at ' + p); last = c.gold; for (const m of Object.keys(c.mats)) ok(ITEMS[m], m); }
  ok(enhanceCost(d, ENHANCE.max) === null, 'max');
});
test('modifiers: good values grow, minus values stay', () => {
  const m = enhancedModifiers([{ type: 'defense', value: 0.2 }, { type: 'movementSpeed', value: -0.1 }], 10);
  ok(Math.abs(m[0].value - 0.3) < 1e-9 && m[1].value === -0.1, JSON.stringify(m));
});
test('roll: success +1; failure from +5 drops one level, below keeps it', () => {
  ok(rollEnhance(0, () => 0.99).plus === 1, '+0 always works');
  ok(rollEnhance(3, () => 0.999).plus === 3, 'low fail keeps');
  const r = rollEnhance(7, () => 0.999); ok(r.plus === 6 && r.dropped, 'high fail drops');
});
test('instances keep their plus through a save (clamped)', () => {
  const x = sanitizeInstance({ instanceId: 'item_000001', itemId: 'relic_oath_mirror', plus: 99 }, new InstanceIds());
  ok(plusOf(x) === ENHANCE.max, 'clamped');
});
test('chests: random tiers, seeded roll is repeatable, fixed chests keep their loot', () => {
  ok(chestTable({ gold: 60 }) === 'chest_1' && chestTable({ gold: 300, rare: true }) === 'chest_rare_3', 'tiers');
  ok(chestTable({ fixed: true, gold: 300 }) === null, 'fixed');
  const it = { id: 'c', gold: 150, rare: true };
  ok(JSON.stringify(chestLoot(it, seededRng('p|c'))) === JSON.stringify(chestLoot(it, seededRng('p|c'))), 'same seed');
  for (const id of ['chest_2', 'chest_3', 'chest_rare_1']) for (const g of LOOT_TABLES[id].oneOf) for (const x of g.items) ok(GEAR_ITEMS[x.item].allowedClasses.includes('all'), x.item + ' is for every class');
});
test('random gear picks: another class line is rarer', () => {
  let ub = 0;
  for (let i = 0; i < 5000; i++) for (const l of rollLoot('elite', Math.random, { classId: 'aegis_guardian' }).items) if (/red_thirst|full_moon|shadow_hunger|charm_assassin/.test(l.item)) ub++;
  ok(ub < 5000 * 0.25 * 0.08, 'umbral share ' + ub);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
