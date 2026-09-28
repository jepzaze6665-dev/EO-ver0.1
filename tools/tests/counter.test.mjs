// Combat 2.0 phase C3 — Counter Window rules. Run:  node tools/tests/counter.test.mjs
import { COUNTER, counterDuration } from '../../src/data/counter.js';
import { STATUSES } from '../../src/data/statuses.js';
import { computeDamage } from '../../src/combat/damageSystem.js';
import { CLASSES } from '../../src/skills/classes.js';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n     ', e.message); } };
const ok = (c, msg) => { if (!c) throw new Error(msg); };
const foe = (o = {}) => ({ status: {}, dead: false, ...o });

console.log('counter window');
test('status exists: less DEF, more damage taken, short', () => {
  const s = STATUSES[COUNTER.status];
  ok(s && s.modifiers.defenseMult < 1 && s.modifiers.damageTakenMult > 1, 'modifiers');
  ok(Object.values(COUNTER.sources).every((d) => d > 0 && d <= 2.5), 'short windows');
});
test('parry > perfect dodge > whiff (harder = longer window)', () => {
  const s = COUNTER.sources; ok(s.parry >= s.perfectDodge && s.perfectDodge > s.whiff, 'order');
});
test('counterDuration: bosses / elites shorter, dead or status-less targets none, unknown reason none', () => {
  ok(counterDuration('perfectDodge', foe()) === COUNTER.sources.perfectDodge, 'normal');
  ok(counterDuration('perfectDodge', foe({ isBoss: true })) < COUNTER.sources.perfectDodge, 'boss');
  ok(counterDuration('whiff', foe({ elite: true })) < COUNTER.sources.whiff, 'elite');
  ok(counterDuration('perfectDodge', foe({ dead: true })) === 0, 'dead');
  ok(counterDuration('perfectDodge', { x: 0 }) === 0, 'hazard / no status');
  ok(counterDuration('nope', foe()) === 0, 'unknown');
});
test('defenseMult lowers the DEF a hit is reduced by', () => {
  const hit = { power: 2, noCrit: true };
  const atk = { stats: { atk: 20, crit: 0 } };
  const a = computeDamage(atk, { defense: 20 }, hit).amount, b = computeDamage(atk, { defense: 20, defenseMult: 0.5 }, hit).amount;
  ok(b > a, `${a} -> ${b}`);
});
test('every class has a small counterBonus', () => {
  for (const [id, c] of Object.entries(CLASSES)) {
    const b = c.counterBonus; ok(b, id + ' has counterBonus');
    ok(!b.marks || b.marks <= 1, id + ' marks'); ok(!b.resource || b.resource <= 10, id + ' resource');
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
