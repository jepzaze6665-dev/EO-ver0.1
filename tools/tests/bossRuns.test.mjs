// Boss runs (owner 2026-10-02): repeat kills roll the boss table again with the signature item only by REPEAT_KILL
// chance. Run:  node tools/tests/bossRuns.test.mjs
import { rollLoot, repeatChance } from '../../src/loot/lootSystem.js';
import { LOOT_TABLES, REPEAT_KILL } from '../../src/data/lootTables.js';
import { GEAR_ITEMS } from '../../src/data/items/index.js';
import { BOSSES } from '../../src/data/bosses.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const sig = (table) => (LOOT_TABLES[table].drops || []).map((d) => d.item).find((id) => GEAR_ITEMS[id] && GEAR_ITEMS[id].signature);

console.log('bossRuns');
test('first kill: the signature item is certain (table chance 1)', () => {
  const r = rollLoot('rune_knight', () => 0.99);
  ok(r.items.some((x) => x.item === sig('rune_knight')), 'signature dropped');
});
test('repeat kill: normal drops stay, the signature only by its rarity chance', () => {
  const id = sig('rune_knight'), ch = REPEAT_KILL.signatureChance[GEAR_ITEMS[id].rarity];
  ok(ch > 0 && ch < 1 && repeatChance(id, 1) === ch, 'chance ' + ch);
  const miss = rollLoot('rune_knight', () => ch + 0.01, { repeat: true });
  ok(!miss.items.some((x) => x.item === id) && miss.items.some((x) => x.item === 'rune_crystal'), 'just above the chance: no signature, materials yes');
  const hit = rollLoot('rune_knight', () => ch - 0.01, { repeat: true });
  ok(hit.items.some((x) => x.item === id), 'just below: signature');
});
test('rarer signatures are rarer on repeat; non-signature items keep their own chance', () => {
  const c = REPEAT_KILL.signatureChance;
  ok(c.epic > c.legendary && c.legendary > c.mythic, 'epic > legendary > mythic');
  ok(repeatChance('hp_potion', 0.5) === 0.5 && repeatChance('rune_crystal', 1) === 1, 'others unchanged');
});
test('every boss with a loot table has a signature item that repeat kills can still find (chance > 0)', () => {
  for (const b of Object.values(BOSSES)) {
    const t = b.rewards && b.rewards.loot;
    if (!t || !LOOT_TABLES[t]) continue;
    const s = sig(t);
    if (s) ok(repeatChance(s, 1) > 0, b.id + ' ' + s);
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
