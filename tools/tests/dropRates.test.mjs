// Drop rates D1: global gear multiplier, boss repeat-kill chances (signature ~1 in 9, gear group 30%, no trophies, half gold).
// Run:  node tools/tests/dropRates.test.mjs
import { rollLoot, entryChance, calculateDropChance, getLootTable } from '../../src/loot/lootSystem.js';
import { DROP_RATES } from '../../src/data/dropRates.js';
import { ITEMS } from '../../src/items/items.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const eq = (a, b, msg = '') => { if (a !== b) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const near = (a, b, msg = '') => { if (Math.abs(a - b) > 1e-9) throw new Error(`${msg} expected ${b}, got ${a}`); };

console.log('rules');
test('owner decisions in data: rematch on, signature ~1 in 9 (8-10 kills), no pity field', () => {
  ok(DROP_RATES.bossRematch, 'rematch');
  ok(DROP_RATES.repeat.signature >= 0.1 && DROP_RATES.repeat.signature <= 0.125, 'signature ' + DROP_RATES.repeat.signature);
  ok(!('pity' in DROP_RATES), 'no pity');
});
test('first kill = the table as written (signature 100%)', () => {
  eq(calculateDropChance('magma_beast', 'relic_dawn_core'), 1);
  eq(calculateDropChance('varkharon', 'relic_cinder_crown'), 1);
});
test('repeat kill: signature 11%, guaranteed gear group 30%, trophies (max stack 1) never, materials as before', () => {
  near(calculateDropChance('magma_beast', 'relic_dawn_core', { repeat: true }), DROP_RATES.repeat.signature);
  const grp = getLootTable('magma_beast').oneOf[0];
  near(entryChance(grp, 'group', { repeat: true }), DROP_RATES.repeat.gearGroup);
  const trophy = Object.values(ITEMS).find((d) => d.maxStack === 1 && d.cat === 'Material');
  ok(trophy, 'a trophy item exists');
  eq(entryChance({ item: trophy.id, chance: 1 }, 'drop', { repeat: true }), 0);
  eq(entryChance({ item: 'ember_core', chance: 1 }, 'drop', { repeat: true }), 1, 'materials still drop');
});
test('repeat kill gold = 50% of the first-kill roll', () => {
  const rng = () => 0; // lowest roll, every chance passes
  const a = rollLoot('magma_beast', rng), b = rollLoot('magma_beast', rng, { repeat: true });
  eq(b.gold, Math.round(a.gold * DROP_RATES.repeat.gold));
});
test('global multiplier scales gear only (capped at 100%), never materials', () => {
  const rates = { ...DROP_RATES, global: 2 };
  near(entryChance({ item: 'rune_iron_will', chance: 0.2 }, 'drop', { rates }), 0.4);
  eq(entryChance({ item: 'rune_iron_will', chance: 0.7 }, 'drop', { rates }), 1, 'cap');
  eq(entryChance({ item: 'wolf_fang', chance: 0.6 }, 'drop', { rates }), 0.6, 'material unchanged');
  const elite = getLootTable('elite').oneOf[0];
  near(entryChance(elite, 'group', { rates }), Math.min(1, elite.chance * 2));
});
test('over many repeat kills the signature drops about once in 9', () => {
  let seed = 7; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let n = 0; const N = 9000;
  for (let i = 0; i < N; i++) if (rollLoot('magma_beast', rng, { repeat: true }).items.some((x) => x.item === 'relic_dawn_core')) n++;
  ok(Math.abs(n / N - DROP_RATES.repeat.signature) < 0.015, `rate ${(n / N).toFixed(3)}`);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
