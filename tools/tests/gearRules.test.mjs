// Character Build B3: rule runes (data/items/gearRules.js + items/gearRules.js + data/items/ruleRunes.js).
// Run:  node tools/tests/gearRules.test.mjs
import { EventBus } from '../../src/core/events.js';
import { Inventory } from '../../src/inventory/inventory.js';
import { Equipment } from '../../src/equipment/equipment.js';
import { ITEMS } from '../../src/items/items.js';
import { RULE_RUNES } from '../../src/data/items/ruleRunes.js';
import { GEAR_RULES } from '../../src/data/items/gearRules.js';
import { rulesOf, ruleHitMult, ruleTakenMult, ruleSkillMods, ruleDodgeHp, ruleProblems, installGearRules } from '../../src/items/gearRules.js';
import { TH_ITEMS } from '../../src/i18n/th/items.js';
import { LOOT_TABLES } from '../../src/data/lootTables.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const eq = (a, b, msg = '') => { if (Math.abs(a - b) > 1e-9) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };

console.log('Rule runes');
test('data: every rule type exists, every rule rune has text + Thai + a loot source', () => {
  ok(!ruleProblems().length, ruleProblems().join());
  const pool = JSON.stringify(LOOT_TABLES);
  for (const [id, d] of Object.entries(RULE_RUNES)) {
    ok(ITEMS[id] && ITEMS[id].type === 'rune', id + ' registered');
    ok(d.ruleText && TH_ITEMS[id] && TH_ITEMS[id].ruleText, id + ' text / Thai');
    ok(pool.includes(`'${id}'`) || pool.includes(`"${id}"`), id + ' drops nowhere');
  }
  eq(Object.keys(RULE_RUNES).length, Object.keys(GEAR_RULES).length, 'one rune per rule');
});
test('rulesOf fills defaults', () => {
  const r = rulesOf(['rune_reckless']);
  eq(r.reckless.dealt, 1.25); eq(r.reckless.taken, 1.25);
});
test('hit / taken multipliers', () => {
  const p = { hp: 20, maxHp: 100, idleT: 1 };
  eq(ruleHitMult(rulesOf(['rune_still_blade']), p), 1.3, 'still');
  eq(ruleHitMult(rulesOf(['rune_still_blade']), { ...p, idleT: 0 }), 0.9, 'moving');
  eq(ruleHitMult(rulesOf(['rune_desperation']), p), 1.35, 'low HP');
  eq(ruleHitMult(rulesOf(['rune_desperation']), { hp: 95, maxHp: 100 }), 0.9, 'high HP');
  eq(ruleTakenMult(rulesOf(['rune_reckless'])), 1.25);
});
test('overclock: cost ×1.8, cooldown ×0.6 (floor 0.4)', () => {
  const m = ruleSkillMods(rulesOf(['rune_overclock']), { cost: 1, cooldown: 1 });
  eq(m.cost, 1.8); eq(m.cooldown, 0.6);
  eq(ruleSkillMods(rulesOf(['rune_overclock']), { cost: 1, cooldown: 0.5 }).cooldown, 0.4, 'floor');
});
test('blood step: 5% max HP per dodge', () => { eq(ruleDodgeHp(rulesOf(['rune_blood_step']), { maxHp: 300 }), 15); });
test('only one rule rune worn at a time', () => {
  const g = { time: 0, events: new EventBus(), audio: { sfx() {} }, vfx: { text() {} }, player: { level: 50, cls: { id: 'umbral_sword' }, recomputeStats() {} } };
  g.inventory = new Inventory(g); g.equipment = new Equipment(g);
  for (const id of ['rune_reckless', 'rune_overclock', 'rune_guarding_soul']) g.inventory.add(id);
  ok(g.equipment.equip('rune_reckless', 'rune1'), 'first ' + g.equipment.lastError);
  ok(!g.equipment.equip('rune_overclock', 'rune2'), 'second refused');
  eq(g.equipment.lastError === 'oneRule' ? 1 : 0, 1, 'reason');
  ok(g.equipment.equip('rune_guarding_soul', 'rune2'), 'a normal rune still fits');
  ok(g.equipment.equip('rune_overclock', 'rune1'), 'swap in the same slot');
  ok(g.equipment.rules().overclock && !g.equipment.rules().reckless, 'cache follows the slots');
});
test('blood pact heals from hits, capped per hit', () => {
  const ev = new EventBus(); let healed = 0;
  const p = { team: 1, maxHp: 200, dead: false, heal: (n) => { healed += n; }, gearRules: () => rulesOf(['rune_blood_pact']) };
  installGearRules({ events: ev, player: p });
  ev.emit('damageDealt', { source: p, target: { team: 2 }, amount: 50 });
  eq(healed, 2, '4% of 50');
  ev.emit('damageDealt', { source: p, target: { team: 2 }, amount: 1000 });
  eq(healed, 6, 'cap 2% of 200');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
