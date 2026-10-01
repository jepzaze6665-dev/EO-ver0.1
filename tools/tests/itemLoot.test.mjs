// Item System G6: gear loot (oneOf groups, boss signature items), drop chances, sources, permanent vs dungeon loot.
// Run:  node tools/tests/itemLoot.test.mjs
import { rollLoot, getLootTable, calculateDropChance, itemSources, LootSystem } from '../../src/loot/lootSystem.js';
import { LOOT_TABLES } from '../../src/data/lootTables.js';
import { BOSSES } from '../../src/data/bosses.js';
import { ITEMS } from '../../src/items/items.js';
import { GEAR_ITEMS } from '../../src/data/items/index.js';
import { isGear, lostOnDeath } from '../../src/items/itemDefs.js';
import { EventBus } from '../../src/core/events.js';
import { Inventory } from '../../src/inventory/inventory.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const eq = (a, b, msg = '') => { if (a !== b) throw new Error(`${msg} expected ${b}, got ${a}`); };
const near = (a, b, msg = '') => { if (Math.abs(a - b) > 1e-9) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };

console.log('tables');
test('oneOf groups name real items with weights; chances in 0..1', () => {
  for (const [id, t] of Object.entries(LOOT_TABLES)) for (const grp of t.oneOf || []) {
    ok(grp.chance >= 0 && grp.chance <= 1, `${id} chance`);
    for (const x of grp.items) ok(ITEMS[x.item] && (x.weight ?? 1) > 0, `${id}: ${x.item}`);
  }
});
test('getLootTable', () => { ok(getLootTable('guardian') === LOOT_TABLES.guardian, 'found'); eq(getLootTable('nope'), null); });

console.log('roll');
test('oneOf gives exactly ONE item of the group, picked by weight (deterministic rng)', () => {
  // gold roll, 2 drops, group chance roll, weight pick
  const lo = rollLoot('hollow_fang', seq(0, 0, 0, 0, 0)), hi = rollLoot('hollow_fang', seq(0, 0, 0, 0, 0.99));
  const cores = (r) => r.items.filter((x) => isGear(ITEMS[x.item]));
  eq(cores(lo).length, 1); eq(cores(lo)[0].item, 'core_ironheart'); eq(cores(hi)[0].item, 'core_vanguard');
});
test('a group whose chance misses gives nothing from it', () => {
  const r = rollLoot('elite', seq(0, 0.99, 0.99, 0.99));
  ok(!r.items.some((x) => isGear(ITEMS[x.item])), JSON.stringify(r.items));
});
test('the weights hold over many rolls (elite: about 25% any gear)', () => {
  let rng = 12345; const rand = () => ((rng = (rng * 1103515245 + 12345) % 2147483648) / 2147483648);
  let gear = 0; const N = 20000;
  for (let i = 0; i < N; i++) if (rollLoot('elite', rand).items.some((x) => isGear(ITEMS[x.item]))) gear++;
  ok(Math.abs(gear / N - 0.25) < 0.02, `${gear / N}`);
});

console.log('drop chance + sources');
test('calculateDropChance: drops, oneOf share, nothing', () => {
  eq(calculateDropChance('guardian', 'relic_oath_mirror'), 1);
  near(calculateDropChance('hollow_fang', 'core_counter'), 1 / 3);
  near(calculateDropChance('elite', 'rune_guarding_soul'), 0.25 * 3 / 20);
  eq(calculateDropChance('wolf', 'relic_oath_mirror'), 0); eq(calculateDropChance('nope', 'x'), 0);
});
test('BOSS SIGNATURE: every item with a dropSource drops from that boss\'s reward table at 100% (bosses pay once)', () => {
  const sig = Object.values(ITEMS).filter((d) => d.dropSource);
  ok(sig.length >= 3, 'some signature items');
  for (const d of sig) {
    const boss = BOSSES[d.dropSource];
    ok(boss && boss.rewards && boss.rewards.loot, `${d.id}: boss ${d.dropSource} has a loot table`);
    eq(calculateDropChance(boss.rewards.loot, d.id), 1, `${d.id} from ${d.dropSource}`);
  }
  eq(ITEMS.relic_oath_mirror.dropSource, 'boss_a1'); eq(ITEMS.relic_dawn_core.dropSource, 'boss_a2');
});
test('every new gear item can be found somewhere (itemSources)', () => {
  for (const id of Object.keys(GEAR_ITEMS)) ok(itemSources(id).length > 0, `${id} drops nowhere`);
  ok(itemSources('core_ironheart').some((x) => x.table === 'hollow_fang'), 'core from Hollow Fang');
});

console.log('loot system');
const game = () => {
  const g = { events: new EventBus(), player: { gold: 0, addGold(n) { this.gold += n; } }, got: [] };
  g.inventory = new Inventory(g); g.loot = new LootSystem(g, seq(0, 0, 0, 0, 0, 0, 0));
  g.events.on('lootDropped', (e) => g.got.push(e));
  return g;
};
test('a boss kill puts its signature item in the bag as a real instance', () => {
  const g = game();
  g.events.emit('enemyDefeated', { type: 'guardian', bossId: 'boss_a1', loot: 'guardian', x: 0, y: 0 });
  const inst = g.inventory.findItem('relic_oath_mirror');
  ok(inst && /^item_\d{6}$/.test(inst.instanceId), JSON.stringify(inst));
  eq(g.got[0].bossId, 'boss_a1');
});
test('two copies = two instances with their own ids', () => {
  const g = game();
  g.events.emit('enemyDefeated', { type: 'x', loot: 'hollow_fang' }); g.events.emit('enemyDefeated', { type: 'x', loot: 'hollow_fang' });
  const all = g.inventory.instancesOf('core_ironheart');
  eq(all.length, 2); ok(all[0].instanceId !== all[1].instanceId, 'unique');
});

console.log('death rule');
test('gear and quest items are PERMANENT (never lost on death); nothing is dungeon loot yet', () => {
  for (const d of Object.values(ITEMS)) {
    if (isGear(d) || d.type === 'quest_item') eq(d.persistence, 'permanent', d.id);
    eq(lostOnDeath(d), false, d.id);
  }
  ok(lostOnDeath({ persistence: 'dungeon' }), 'dungeon loot would be');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
