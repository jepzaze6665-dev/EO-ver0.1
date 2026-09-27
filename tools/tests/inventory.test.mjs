// Unit tests for inventory stacks + the gold API. Run:  node tools/tests/inventory.test.mjs
import { Inventory } from '../../src/inventory/inventory.js';
import { ITEMS, MAX_STACK, maxStackOf } from '../../src/items/items.js';
import { EventBus } from '../../src/core/events.js';
import { Player } from '../../src/player/player.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const eq = (a, b, msg = '') => { if (a !== b) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const make = () => { const g = { events: new EventBus(), seen: [] }; ['itemCollected', 'inventoryFull'].forEach((n) => g.events.on(n, (e) => g.seen.push([n, e]))); return [new Inventory(g), g]; };

console.log('inventory');
test('every item has a max stack', () => { for (const id of Object.keys(ITEMS)) ok(maxStackOf(id) >= 1, id); eq(maxStackOf('hp_potion'), MAX_STACK.Consumable); });
test('add stacks, reports itemCollected, returns the amount added', () => {
  const [inv, g] = make();
  eq(inv.add('wolf_fang', 5), 5); eq(inv.add('wolf_fang', 2, true), 2); eq(inv.count('wolf_fang'), 7);
  eq(g.seen.length, 2); eq(g.seen[1][1].silent, true); eq(g.seen[1][1].total, 7);
});
test('never above max stack (overflow reported, not added)', () => {
  const [inv, g] = make();
  eq(inv.add('seal_fragment', 3), 1); eq(inv.count('seal_fragment'), 1); ok(g.seen.some(([n, e]) => n === 'inventoryFull' && e.lost === 2), 'full event');
  eq(inv.add('seal_fragment', 1), 0); ok(!inv.canAdd('seal_fragment'), 'canAdd false');
});
test('never negative: bad amounts ignored, remove more than owned fails', () => {
  const [inv] = make();
  inv.add('hp_potion', 2);
  eq(inv.add('hp_potion', -5), 0); eq(inv.add('hp_potion', 0), 0); eq(inv.add('nope', 1), 0);
  ok(!inv.remove('hp_potion', 3), 'remove 3 of 2'); ok(!inv.remove('hp_potion', -1), 'remove negative');
  ok(inv.remove('hp_potion', 2), 'remove all'); eq(inv.count('hp_potion'), 0); ok(!('hp_potion' in inv.items), 'entry deleted');
});
test('load cleans bad saves (unknown ids, negatives, over-stack)', () => {
  const [inv] = make();
  inv.load({ items: { hp_potion: 500, wolf_fang: -3, ghost_item: 4, goblin_iron: 2.7 }, storage: { hp_potion: 50 } });
  eq(inv.count('hp_potion'), MAX_STACK.Consumable); eq(inv.count('wolf_fang'), 0); eq(inv.count('ghost_item'), 0); eq(inv.count('goblin_iron'), 2);
  eq(inv.storage.hp_potion, 50);
});

console.log('gold');
const wallet = (gold) => ({ gold, game: { events: new EventBus() }, canAfford: Player.prototype.canAfford });
test('addGold / removeGold / canAfford never go negative', () => {
  const w = wallet(100), add = Player.prototype.addGold, rem = Player.prototype.removeGold, can = Player.prototype.canAfford;
  eq(add.call(w, 50), 50); eq(w.gold, 150); eq(add.call(w, -20), 0); eq(add.call(w, NaN), 0); eq(w.gold, 150);
  ok(can.call(w, 150) && !can.call(w, 151) && !can.call(w, -1), 'canAfford');
  ok(!rem.call(w, 200), 'cannot overspend'); eq(w.gold, 150); ok(!rem.call(w, -10), 'negative remove'); ok(rem.call(w, 150), 'spend all'); eq(w.gold, 0);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
