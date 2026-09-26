// Unit tests for the pure combat core. Run:  node tools/tests/combat.test.mjs
import { computeDamage, DAMAGE_RULES } from '../../src/combat/damageSystem.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const eq = (a, b, msg = '') => { if (a !== b) throw new Error(`${msg} expected ${b}, got ${a}`); };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const mid = () => 0.5;                 // roll: no variance, never crits (crit < 0.5)
const high = () => 0.999, low = () => 0;
const hero = { stats: { atk: 20, crit: 0, critDmg: 0, shadowDmg: 0.1 } };

console.log('damageSystem');
test('basic damage = power × atk − def × 0.5', () => {
  eq(computeDamage(hero, { defense: 10 }, { power: 1, type: 'physical' }, mid).amount, 15);
});
test('type bonus comes from stats.<type>Dmg (no class names in core)', () => {
  eq(computeDamage(hero, { defense: 0 }, { power: 1, type: 'shadow' }, mid).amount, 22);
});
test('crit multiplies by critBase', () => {
  const r = computeDamage(hero, { defense: 0 }, { power: 1, forceCrit: true }, mid);
  ok(r.crit, 'should crit'); eq(r.amount, Math.round(20 * DAMAGE_RULES.critBase));
});
test('crit chance uses the injected roll (deterministic)', () => {
  const a = { stats: { atk: 10, crit: 0.3 } };
  ok(computeDamage(a, {}, { power: 1 }, low).crit, 'roll 0 < 0.3 should crit');
  ok(!computeDamage(a, {}, { power: 1 }, high).crit, 'roll .999 should not crit');
});
test('weakness and weak window stack', () => {
  const r = computeDamage(hero, { weakness: ['physical'], vulnerable: true }, { power: 1, type: 'physical' }, mid);
  eq(r.amount, Math.round(20 * 1.2 * 1.35)); ok(r.tags.includes('weak') && r.tags.includes('window'), 'tags');
});
test('armour absorbs damage and reports armour damage; weak point bypasses', () => {
  const r = computeDamage(hero, { armor: 100 }, { power: 1 }, mid);
  eq(r.amount, 6); eq(r.armorDamage, 20); ok(!r.armorBroken, 'not broken');
  const w = computeDamage(hero, { armor: 100 }, { power: 1, weakPoint: true }, mid);
  eq(w.amount, 32); eq(w.armorDamage, 0);
});
test('flat attacker (monster, no stats) deals its power', () => {
  eq(computeDamage(null, { stats: { def: 6 } }, { power: 20 }, mid).amount, 17);
});
test('damage never below 1, never negative, never NaN/Infinity', () => {
  eq(computeDamage(hero, { defense: 99999 }, { power: 1 }, mid).amount, 1);
  eq(computeDamage(null, {}, { power: NaN }, mid).amount, 1);
  eq(computeDamage({ stats: { atk: Infinity } }, {}, { power: 1 }, mid).amount, 1);
  eq(computeDamage(hero, {}, { power: -50 }, mid).amount, 1);
});
test('variance stays within ±8 %', () => {
  const lo = computeDamage({ stats: { atk: 100 } }, {}, { power: 1 }, () => 0.0001).amount;
  const hi = computeDamage({ stats: { atk: 100 } }, {}, { power: 1 }, () => 0.9999).amount;
  ok(lo >= 92 && hi <= 108, `got ${lo}..${hi}`);
});
test('no side effects: inputs are not mutated', () => {
  const t = { defense: 5, armor: 50 }; const h = { power: 2 };
  computeDamage(hero, t, h, mid);
  eq(t.armor, 50); eq(Object.keys(h).length, 1);
});
test('HP applied from repeated hits reaches 0 in a finite number of hits', () => {
  let hp = 1000, n = 0;
  while (hp > 0 && n < 10000) { hp -= computeDamage(hero, { defense: 30 }, { power: 1 }, mid).amount; n++; }
  ok(hp <= 0 && n < 10000, `took ${n} hits`);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
