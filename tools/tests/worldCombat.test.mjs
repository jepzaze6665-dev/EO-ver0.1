// Unit tests for the combat <-> world glue: target system, loot tables, enemyDefeated listeners.
// Run:  node tools/tests/worldCombat.test.mjs
import { DIFFICULTY } from '../../src/data/difficulty.js';
import { TargetSystem } from '../../src/combat/targetSystem.js';
import { rollLoot, LootSystem } from '../../src/loot/lootSystem.js';
import { LOOT_TABLES } from '../../src/data/lootTables.js';
import { MONSTERS } from '../../src/monsters/monsterTypes.js';
import { ITEMS } from '../../src/items/items.js';
import { ExperienceSystem } from '../../src/progression/experienceSystem.js';
import { EventBus } from '../../src/core/events.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const eq = (a, b, msg = '') => { if (a !== b) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const foe = (x, y, extra = {}) => ({ x, y, hp: 50, maxHp: 50, radius: 10, height: 30, dead: false, ...extra });

console.log('target system');
test('nearest picks the closest valid enemy in range; repeat cycles', () => {
  const a = foe(100, 0), b = foe(50, 0), c = foe(2000, 0), d = foe(10, 0, { dead: true });
  const ts = new TargetSystem({ candidates: () => [a, b, c, d] });
  eq(ts.nearest({ x: 0, y: 0 }), b); eq(ts.nearest({ x: 0, y: 0 }, true), a); eq(ts.nearest({ x: 0, y: 0 }, true), b);
});
test('nothing in range -> null (no error)', () => {
  const ts = new TargetSystem({ candidates: () => [foe(5000, 0)] });
  eq(ts.nearest({ x: 0, y: 0 }), null); eq(ts.current, null);
});
test('click picks the enemy under the point', () => {
  const a = foe(100, 100), b = foe(300, 100);
  const ts = new TargetSystem({ candidates: () => [a, b] });
  eq(ts.pickAt(302, 90), b); eq(ts.pickAt(700, 700), null);
});
test('dead / removed / far target is dropped -> null, with change events', () => {
  const a = foe(100, 0), seen = [];
  const ts = new TargetSystem({ candidates: () => [a], onChange: (e) => seen.push(e.target) });
  ts.set(a); a.dead = true; ts.update({ x: 0, y: 0 });
  eq(ts.current, null); eq(seen.length, 2);
  const b = foe(100, 0); ts.set(b); b.x = 5000; ts.update({ x: 0, y: 0 }); eq(ts.current, null);
  ts.set(foe(0, 0, { hp: 0 })); eq(ts.current, null, 'cannot select a dead enemy');
});

console.log('loot');
test('every monster names an existing loot table; every drop is a real item', () => {
  for (const [id, m] of Object.entries(MONSTERS)) ok(LOOT_TABLES[m.loot], `${id} -> ${m.loot}`);
  for (const [id, t] of Object.entries(LOOT_TABLES)) for (const d of t.drops) ok(ITEMS[d.item] && d.chance >= 0 && d.chance <= 1, `${id}: ${d.item}`);
});
test('rollLoot: gold in range, chance respected, deterministic with an rng', () => {
  const lo = rollLoot('leafling', () => 0), hi = rollLoot('leafling', () => 0.999);
  eq(lo.gold, 6); eq(hi.gold, 14); eq(lo.items.length, 2); eq(hi.items.length, 0);
  const alpha = rollLoot('elder_treant', () => 0.5); ok(alpha.items.some((i) => i.item === 'crystal_shard' && i.count === 3), 'counts');
  eq(rollLoot('nope').gold, 0);
});

console.log('enemyDefeated listeners');
const fakeGame = () => {
  const g = { events: new EventBus(), got: { exp: 0, gold: 0, items: {} } };
  g.player = { gainExp: (n) => { g.got.exp += n; }, addGold: (n) => { g.got.gold += n; } };
  g.inventory = { add: (id, n) => { g.got.items[id] = (g.got.items[id] || 0) + n; } };
  new ExperienceSystem(g); new LootSystem(g, () => 0);
  return g;
};
test('a defeat gives EXP + gold + drops once, and reports lootDropped', () => {
  const g = fakeGame(); let dropped = 0;
  g.events.on('lootDropped', () => dropped++);
  g.events.emit('enemyDefeated', { type: 'wolf', exp: 18, loot: 'wolf', x: 0, y: 0 });
  eq(g.got.exp, Math.round(18 * DIFFICULTY.expRate)); eq(g.got.gold, 2); eq(g.got.items.wolf_fang, 1); eq(dropped, 1);
});
test('summoned adds give nothing (no infinite EXP / loot)', () => {
  const g = fakeGame();
  g.events.emit('enemyDefeated', { type: 'thornling', exp: 8, loot: 'thornling', summoned: true });
  eq(g.got.exp, 0); eq(g.got.gold, 0);
});

test('EXP sources: quest reward + exploration events use data values', () => {
  const g = fakeGame();
  g.events.emit('questCompleted', { id: 'q', reward: { exp: 80 } });
  g.events.emit('secretFound', { id: 1 }); g.events.emit('areaDiscovered', {}); g.events.emit('loreFound', {});
  g.events.emit('questCompleted', { id: 'q2', reward: {} });
  g.events.emit('hiddenFound', { id: 'x', reward: { exp: 60, gold: 7 } });
  eq(g.got.exp, [80, 10, 25, 60].reduce((s, n) => s + Math.round(n * DIFFICULTY.expRate), 0), 'secretFound itself gives nothing; the hidden entry pays'); eq(g.got.gold, 7);
});

console.log('monster foundation');
const { Monster } = await import('../../src/monsters/monster.js');
const { ELITE_MOD, CORRUPT_MOD, MONSTER_STATE } = await import('../../src/monsters/monsterTypes.js');
const mon = (type, opts) => new Monster({ monsterSprites: {} }, type, 100, 100, opts);
test('spec fields come from data (name, hp, attack, defense, speed, ranges, exp, loot, state)', () => {
  const m = mon('wolf');
  eq(m.name, 'Forest Wolf'); const hpK = DIFFICULTY.monsterHp.skirmisher; eq(m.maxHp, Math.round(70 * hpK)); eq(m.hp, m.maxHp); eq(m.attack, 18); eq(m.defense, 2);
  eq(m.movementSpeed, 128); eq(m.aggroRange, 150); eq(m.attackRange, 125); eq(m.expReward, 18); eq(m.lootTable, 'wolf');
  eq(m.state, MONSTER_STATE.IDLE); ok(typeof m.id === 'number', 'id');
});
test('elite: tougher, more EXP, extra loot roll; stacks with corrupted', () => {
  const e = mon('treant', { elite: true });
  eq(e.maxHp, Math.round(300 * ELITE_MOD.hp * DIFFICULTY.monsterHp.bruiser)); eq(e.expReward, 48 * ELITE_MOD.exp); ok(e.name.startsWith('Elite'), e.name);
  eq(JSON.stringify(e.lootTable), JSON.stringify(['treant', 'elite'])); ok(LOOT_TABLES.elite, 'elite table');
  const ce = mon('treant', { elite: true, corrupted: true });
  eq(ce.maxHp, Math.round(300 * ELITE_MOD.hp * CORRUPT_MOD.hp * DIFFICULTY.monsterHp.bruiser)); eq(ce.mod.power, ELITE_MOD.power * CORRUPT_MOD.power);
});
test('display levels fit a LV 1 start (field monsters below the boss)', () => {
  for (const t of ['wolf', 'leafling', 'treant']) ok(MONSTERS[t].level < MONSTERS.guardian.level && MONSTERS[t].level <= 6, t);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
